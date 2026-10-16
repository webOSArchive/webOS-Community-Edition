/*global IMPORTS, Buffer, setTimeout, console */
/*
 * Backup Diagnostic: works out why a woce-backup store on this device is, or is
 * not, offered by Restore -- and, when it is not, what the backup was doing
 * when it stopped.
 *
 * READ-ONLY. It never touches /media/internal/webos-backups or
 * /media/internal/.woce-backup; the only file it writes is the report,
 * /media/internal/backup-diagnosis.txt, so it can be run on a device whose
 * store is the evidence.
 *
 *   scan   {deep}  runs the whole diagnosis and answers {report} when done.
 *                  deep: also md5 every stored file (slow: reads the whole store).
 *   status         {state, phase, done, total} while a scan runs, for the
 *                  progress line; the scan yields between files so this answers.
 *   append {title, text}  adds a section to the last report (the app uses it for
 *                  what the Backup service itself answered) and rewrites the file.
 *
 * The rules mirrored here come from woce-backup 3.1.1:
 *   service/common.js                 paths
 *   util/backup-service.js            MANIFEST_NAME_REGEX, getServerFilename, syncManifests
 *   handlers/get-restore-devices.js   which manifests the Restore picker shows
 *   handlers/backup.js                the manifest is written LAST, after every file
 *   app ChooseBackupPage.js           dbVersion >= 300 is refused as "newer webOS"
 * Device node is 0.4: no fs.existsSync, no zlib, hash.update wants a string.
 */
var fs = IMPORTS.require('fs');
var crypto = IMPORTS.require('crypto');
var childProcess = IMPORTS.require('child_process');

var INTERNAL = "/media/internal/";
var STORE = INTERNAL + "webos-backups/";
var WORK = INTERNAL + ".woce-backup/";
var REPORT = INTERNAL + "backup-diagnosis.txt";
var MANIFEST_NAME_REGEX = /^([0-9]{6})(-([0-9a-zA-Z]+))?$/;
var INCOMPATIBLE_DB_VERSION = 300;

var state = { state: "idle", phase: "", done: 0, total: 0 };
var lastReport = null;

function BackupDiagService() {}

/* ------------------------------------------------------------------ helpers */

function stat(p) {
	try { return fs.statSync(p); } catch (e) { return null; }
}

function isDir(p) {
	var s = stat(p);
	return !!(s && s.isDirectory());
}

function readdir(p) {
	try { return fs.readdirSync(p).sort(); } catch (e) { return null; }
}

function readText(p, max) {
	try {
		var t = fs.readFileSync(p, "utf8");
		if (max && t.length > max) { t = t.substring(0, max) + "\n... (" + t.length + " chars, truncated)"; }
		return t;
	} catch (e) { return null; }
}

function mb(bytes) {
	return (bytes / 1048576).toFixed(1) + " MB";
}

function pad2(n) { return n < 10 ? "0" + n : "" + n; }

function fmtTime(d) {
	if (!d) { return "?"; }
	if (!(d instanceof Date)) { d = new Date(d); }
	if (isNaN(d.getTime())) { return "?"; }
	return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " +
		pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
}

function md5File(p) {
	var fd = fs.openSync(p, "r");
	var hash = crypto.createHash("md5");
	var buf = new Buffer(65536);
	var pos = 0, n;
	try {
		while ((n = fs.readSync(fd, buf, 0, buf.length, pos)) > 0) {
			hash.update(buf.toString("binary", 0, n), "binary");
			pos += n;
		}
	} finally {
		fs.closeSync(fd);
	}
	return hash.digest("hex");
}

function sh(cmd, cb) {
	try {
		childProcess.exec(cmd, function (err, stdout, stderr) {
			cb((stdout || "") + (stderr ? stderr : "") + (err && !stdout ? "(exit: " + err.message + ")" : ""));
		});
	} catch (e) {
		cb("(could not run: " + e + ")");
	}
}

// The name the store keeps a manifest file entry under (getServerFilename).
function storedName(fd) {
	var base = fd.checksum ? fd.checksum : fd.origChecksum;
	return base + (fd.compressed ? ".gz" : "");
}

// Every file descriptor a manifest references, with where it came from.
function manifestRefs(m) {
	var refs = [];
	(m.services || []).forEach(function (s) {
		(s.files || []).forEach(function (f) { refs.push({ fd: f, owner: s.service }); });
	});
	(m.packages || []).forEach(function (p) {
		if (p.file) { refs.push({ fd: p.file, owner: "package " + p.id + " (.ipk)" }); }
		if (p.dirFile) { refs.push({ fd: p.dirFile, owner: "package " + p.id + " (app dir)" }); }
	});
	return refs;
}

/* ------------------------------------------------------------------- report */

function Report() {
	this.lines = [];
	this.findings = [];      // {level, text}; level: PROBLEM | WARN | OK | INFO
	this.timeline = [];      // {t: ms, text}
}
Report.prototype.h = function (title) {
	this.lines.push("");
	this.lines.push("== " + title + " ==");
};
Report.prototype.p = function (text) { this.lines.push(text); };
Report.prototype.find = function (level, text) { this.findings.push({ level: level, text: text }); };
Report.prototype.at = function (t, text) {
	if (t && !isNaN(new Date(t).getTime())) { this.timeline.push({ t: new Date(t).getTime(), text: text }); }
};
Report.prototype.render = function (header) {
	var out = [header, ""];
	out.push("== VERDICT ==");
	var order = { PROBLEM: 0, WARN: 1, INFO: 2, OK: 3 };
	this.findings.sort(function (a, b) { return order[a.level] - order[b.level]; });
	if (this.findings.length === 0) { out.push("(no findings)"); }
	this.findings.forEach(function (f) { out.push("[" + f.level + "] " + f.text); });

	out.push("");
	out.push("== TIMELINE (file times on /media/internal, device clock) ==");
	this.timeline.sort(function (a, b) { return a.t - b.t; });
	if (this.timeline.length === 0) { out.push("(nothing dated)"); }
	this.timeline.forEach(function (e) { out.push(fmtTime(e.t) + "  " + e.text); });

	return out.concat(this.lines).join("\n") + "\n";
};

/* ---------------------------------------------------------------- the scan */

// Runs fn over items one per tick, so `status` calls are answered meanwhile.
function eachAsync(items, fn, done) {
	var i = 0;
	function next() {
		var start = Date.now();
		// a few cheap items per tick; one at a time once they get slow
		while (i < items.length) {
			fn(items[i], i);
			i++;
			state.done = i;
			if (Date.now() - start > 50) { break; }
		}
		if (i < items.length) { setTimeout(next, 0); } else { done(); }
	}
	next();
}

// Directories under /media/internal (two levels) that look like a backup store.
function findStores() {
	var found = [];
	function looks(dir) {
		var m = readdir(dir + "manifests");
		var f = isDir(dir + "files");
		return (m !== null) || f;
	}
	(readdir(INTERNAL) || []).forEach(function (a) {
		var d1 = INTERNAL + a + "/";
		if (!isDir(d1) || a === ".woce-backup") { return; }
		if (looks(d1)) { found.push(d1); }
		(readdir(d1) || []).forEach(function (b) {
			var d2 = d1 + b + "/";
			if (isDir(d2) && looks(d2)) { found.push(d2); }
		});
	});
	return found;
}

function scanManifests(R, root) {
	var result = { all: [], restorable: [], names: [] };
	var dir = root + "manifests/";
	var names = readdir(dir);
	R.h("Manifests in " + dir);
	if (names === null) {
		R.p("manifests/ does not exist.");
		return result;
	}
	if (names.length === 0) { R.p("manifests/ is EMPTY."); }

	names.forEach(function (name) {
		var p = dir + name;
		var s = stat(p);
		var m = { name: name, size: s ? s.size : -1, mtime: s ? s.mtime : null, reasons: [] };
		result.all.push(m);
		R.at(m.mtime, "manifest file " + name + " last written (" + m.size + " bytes)");

		if (s && s.isDirectory()) {
			m.reasons.push("is a folder");
		} else if (!MANIFEST_NAME_REGEX.test(name)) {
			if (/\.part$/.test(name)) {
				m.reasons.push("an interrupted manifest write (.part) -- the backup died while saving its manifest");
			} else if (name.indexOf("._") === 0) {
				m.reasons.push("a Mac resource-fork file (harmless)");
			} else {
				m.reasons.push("name does not match NNNNNN-<nduId> (renamed or copied by a tool that changed it?)");
			}
		}

		var text = readText(p);
		if (text === null && !(s && s.isDirectory())) {
			m.reasons.push("cannot be read");
		} else if (text !== null) {
			try {
				m.json = JSON.parse(text);
			} catch (e) {
				m.reasons.push("is not valid JSON (" + e.message + "); first bytes: " +
					JSON.stringify(text.substring(0, 60)) + ", last bytes: " + JSON.stringify(text.substring(text.length - 60)));
			}
		}

		var j = m.json;
		if (j) {
			// the getRestoreDevices filter, then restore's own checks, then the picker's
			if (!j.size || j.size <= 0) { m.reasons.push("size is " + j.size + " -- Restore hides zero-size backups"); }
			if (!j.services || !j.services.length) { m.reasons.push("has no services section -- restore would call it unusable"); }
			if (j.dbVersion >= INCOMPATIBLE_DB_VERSION) { m.reasons.push("dbVersion " + j.dbVersion + " -- the picker refuses it as made by newer webOS"); }
			if (!j.finished) { m.reasons.push("has no finished time"); }
			R.at(j.started, "backup " + name + " started (manifest)");
			R.at(j.finished, "backup " + name + " finished (manifest)");
			if (j.lastRestored) { R.at(j.lastRestored, "backup " + name + " last restored"); }
		}

		var usable = m.reasons.length === 0;
		if (usable) { result.restorable.push(m); }
		if (MANIFEST_NAME_REGEX.test(name)) { result.names.push(name); }

		R.p("");
		R.p(name + "  (" + m.size + " bytes, written " + fmtTime(m.mtime) + ")");
		if (j) {
			var di = j.deviceInfo || {};
			R.p("  type=" + j.type + " size=" + j.size + " (" + mb(j.size || 0) + ") dbVersion=" + j.dbVersion +
				" version=" + j.version);
			R.p("  started=" + j.started + "  finished=" + j.finished);
			R.p("  device: nduId=" + di.nduId + " hardwareType=" + di.hardwareType + " model=" + di.deviceModel +
				" name=" + di.deviceName);
			R.p("  osVersion=" + JSON.stringify(j.osVersion));
			R.p("  services (" + (j.services || []).length + "): " + (j.services || []).map(function (sv) {
				return sv.service + "[" + (sv.files || []).length + " files, " + sv.size + "B]";
			}).join(", "));
			var pk = j.packages || [];
			var arch = pk.filter(function (x) { return x.archived; }).length;
			var dirs = pk.filter(function (x) { return x.dirBackedUp; }).length;
			var errs = pk.filter(function (x) { return x.archiveError; });
			R.p("  packages: " + pk.length + " listed, " + arch + " as .ipk, " + dirs + " as app dir, " +
				errs.length + " with archiveError");
			errs.forEach(function (x) { R.p("    " + x.id + ": " + x.archiveError); });
			if ((j.skipped || []).length) { R.p("  skipped: " + JSON.stringify(j.skipped)); }
			R.p("  restoredCount=" + (j.restoredCount || 0) + " lastRestored=" + (j.lastRestored || "never"));
			R.p("  top-level keys: " + Object.keys(j).join(", "));
		}
		R.p("  => " + (usable ? "OFFERED by Restore" : "NOT offered by Restore: " + m.reasons.join("; ")));
	});
	return result;
}

function scanStore(R, root, manifests, deep, done) {
	var dir = root + "files/";
	var names = readdir(dir);
	R.h("File store " + dir);
	if (names === null) {
		R.p("files/ does not exist.");
		R.find("PROBLEM", "The store has no files/ folder at " + dir);
		return done();
	}

	var present = {};
	var total = 0, partials = [], oldest = null, newest = null;
	state.phase = "Reading the file store";
	state.total = names.length;
	state.done = 0;
	eachAsync(names, function (name) {
		var s = stat(dir + name);
		if (!s) { return; }
		present[name] = s;
		total += s.size;
		if (/\.part$/.test(name)) { partials.push({ name: name, s: s }); }
		if (!oldest || s.mtime < oldest.s.mtime) { oldest = { name: name, s: s }; }
		if (!newest || s.mtime > newest.s.mtime) { newest = { name: name, s: s }; }
	}, function () {
		R.p(names.length + " entries, " + mb(total) + " in total.");
		if (oldest) {
			R.p("Oldest: " + fmtTime(oldest.s.mtime) + " " + oldest.name);
			R.p("Newest: " + fmtTime(newest.s.mtime) + " " + newest.name + " (" + newest.s.size + " bytes)");
			R.at(oldest.s.mtime, "first file in files/ written");
			R.at(newest.s.mtime, "last file in files/ written (" + newest.name + ", " + newest.s.size + " bytes)");
		}
		partials.forEach(function (x) {
			R.p("Interrupted write: " + x.name + " (" + x.s.size + " bytes, " + fmtTime(x.s.mtime) + ")");
			R.at(x.s.mtime, "INTERRUPTED write of files/" + x.name + " (" + x.s.size + " bytes)");
		});
		if (partials.length) {
			R.find("PROBLEM", partials.length + " .part file(s) in files/ -- a backup was killed mid-copy (last one " +
				fmtTime(partials[partials.length - 1].s.mtime) + ").");
		}

		// references
		var referenced = {};
		var checks = [];
		manifests.all.forEach(function (m) {
			if (!m.json) { return; }
			var missing = [], wrongSize = [], refs = manifestRefs(m.json);
			refs.forEach(function (r) {
				var sn = storedName(r.fd);
				referenced[sn] = true;
				var s = present[sn];
				if (!s) {
					missing.push(sn + " (" + r.owner + ")");
				} else if (r.fd.finalSize !== undefined && s.size !== r.fd.finalSize) {
					wrongSize.push(sn + " is " + s.size + " bytes, manifest says " + r.fd.finalSize + " (" + r.owner + ")");
				} else if (deep && r.fd.finalChecksum) {
					checks.push({ m: m, sn: sn, want: r.fd.finalChecksum, owner: r.owner });
				}
			});
			m.missing = missing;
			m.wrongSize = wrongSize;
			m.corrupt = [];
			R.p("");
			R.p(m.name + ": references " + refs.length + " file(s); " + missing.length + " missing, " +
				wrongSize.length + " wrong size.");
			missing.slice(0, 40).forEach(function (x) { R.p("  missing: " + x); });
			if (missing.length > 40) { R.p("  ... and " + (missing.length - 40) + " more missing"); }
			wrongSize.slice(0, 40).forEach(function (x) { R.p("  wrong size: " + x); });
		});

		var orphans = [], orphanBytes = 0;
		names.forEach(function (n) {
			if (!referenced[n] && !/\.part$/.test(n) && present[n]) {
				orphans.push(n);
				orphanBytes += present[n].size;
			}
		});
		R.p("");
		R.p("Unreferenced (no manifest names them): " + orphans.length + " file(s), " + mb(orphanBytes) + ".");
		if (orphans.length) {
			var oo = null, on = null;
			orphans.forEach(function (n) {
				var s = present[n];
				if (!oo || s.mtime < oo.mtime) { oo = s; }
				if (!on || s.mtime > on.mtime) { on = s; }
			});
			R.p("  written between " + fmtTime(oo.mtime) + " and " + fmtTime(on.mtime));
			R.at(oo.mtime, "first UNREFERENCED file written");
			R.at(on.mtime, "last UNREFERENCED file written");
			var big = orphans.slice().sort(function (a, b) { return present[b].size - present[a].size; }).slice(0, 10);
			big.forEach(function (n) { R.p("  " + n + "  " + present[n].size + " bytes  " + fmtTime(present[n].mtime)); });
			manifests.orphans = { count: orphans.length, bytes: orphanBytes, from: oo.mtime, to: on.mtime };
		}

		if (!deep || checks.length === 0) { return done(); }

		state.phase = "Verifying checksums";
		state.total = checks.length;
		state.done = 0;
		eachAsync(checks, function (c) {
			var got;
			try { got = md5File(dir + c.sn); } catch (e) { got = "unreadable: " + e; }
			if (got !== c.want) { c.m.corrupt.push(c.sn + " md5 " + got + " != " + c.want + " (" + c.owner + ")"); }
		}, function () {
			R.p("");
			R.p("Checksum verification (" + checks.length + " files):");
			manifests.all.forEach(function (m) {
				if (!m.corrupt) { return; }
				R.p("  " + m.name + ": " + m.corrupt.length + " corrupt");
				m.corrupt.slice(0, 40).forEach(function (x) { R.p("    " + x); });
			});
			done();
		});
	});
}

// What the backup service left in its work area: the manifest cache, staging
// folders it never cleaned up, and job files to/from the root helper.
function scanWorkArea(R, store, manifests) {
	R.h("Backup service work area " + WORK);
	var top = readdir(WORK);
	if (top === null) {
		R.p("Does not exist. (The Backup service has never run on this /media/internal.)");
		return;
	}
	R.p("Contains: " + top.join(", "));

	// manifest cache vs. target
	var cache = readdir(WORK + "manifests/") || [];
	R.p("");
	R.p("Manifest cache (" + cache.length + "): ");
	cache.forEach(function (n) {
		var s = stat(WORK + "manifests/" + n);
		var line = "  " + n + "  " + (s ? s.size : "?") + " bytes  " + fmtTime(s && s.mtime);
		if (MANIFEST_NAME_REGEX.test(n) && store) {
			var t = stat(store + "manifests/" + n);
			if (!t) {
				line += "  -- NOT in the store";
			} else {
				var same = false;
				try { same = md5File(WORK + "manifests/" + n) === md5File(store + "manifests/" + n); } catch (e) {}
				line += same ? "  -- same as store" : "  -- DIFFERS from the store's copy";
				if (!same) {
					R.find("WARN", "Cached manifest " + n + " differs from the store's (the stale-cache bug fixed in 3.1.1; " +
						"harmless if this device runs 3.1.1, which re-fetches).");
				}
			}
		}
		R.p(line);
	});

	// staging folders: STAGE_ROOT + <ms> (backup) or restore-<ms>; removed on success
	var stage = readdir(WORK + "stage/") || [];
	R.p("");
	R.p("Staging folders left behind (" + stage.length + "):");
	stage.forEach(function (n) {
		var m = /^(restore-)?([0-9]{10,})$/.exec(n);
		var kind = m ? (m[1] ? "restore" : "backup") : "unknown";
		var started = m ? new Date(parseInt(m[2], 10)) : null;
		R.p("  " + n + "  (" + kind + (started ? " started " + fmtTime(started) : "") + ")");
		if (started) { R.at(started, kind + " run started (staging folder " + n + " never cleaned up)"); }
		var walk = function (d, prefix, depth) {
			(readdir(d) || []).forEach(function (e) {
				var s = stat(d + e);
				if (!s) { return; }
				if (s.isDirectory()) {
					R.p("    " + prefix + e + "/");
					if (depth < 3) { walk(d + e + "/", prefix + e + "/", depth + 1); }
				} else {
					R.p("    " + prefix + e + "  " + s.size + " bytes  " + fmtTime(s.mtime));
					R.at(s.mtime, "staged " + prefix + e + " (" + s.size + " bytes) in " + n);
				}
			});
		};
		walk(WORK + "stage/" + n + "/", "", 0);
		if (kind === "backup") {
			R.find("PROBLEM", "A backup started " + fmtTime(started) + " never finished: its staging folder " + n +
				" is still there (it is deleted only after the manifest is saved). The newest file inside it is " +
				"what it was working on when it stopped -- see the timeline.");
		}
	});

	// jobs for the root helper: <id>.job (request), .done (answer), .tmp
	var jobs = readdir(WORK + "jobs/") || [];
	R.p("");
	R.p("Helper job files (" + jobs.length + "):");
	jobs.forEach(function (n) {
		var s = stat(WORK + "jobs/" + n);
		R.p("  " + n + "  " + (s ? s.size : "?") + " bytes  " + fmtTime(s && s.mtime));
		R.at(s && s.mtime, "helper job file " + n);
		var t = readText(WORK + "jobs/" + n, 1500);
		if (t !== null) { R.p("    " + t.replace(/\n/g, "\n    ")); }
		if (/\.job$/.test(n) && jobs.indexOf(n.replace(/\.job$/, ".done")) < 0) {
			R.find("WARN", "Helper job " + n + " was never answered -- the privileged helper (woce-backupd) was not " +
				"running, or the backup was killed while it worked.");
		}
	});

	(top || []).forEach(function (n) {
		if (["manifests", "stage", "jobs"].indexOf(n) < 0) {
			var s = stat(WORK + n);
			R.p("Other: " + n + " " + (s && s.isDirectory() ? "(folder)" : (s ? s.size + " bytes" : "")) + " " + fmtTime(s && s.mtime));
		}
	});
}

function verdict(R, stores, primary, manifests) {
	if (stores.length === 0) {
		R.find("PROBLEM", "There is no backup store anywhere on /media/internal (looked for manifests/ or files/ " +
			"two folders deep). The backup files are gone, or were never written here.");
		return;
	}
	if (!primary) {
		R.find("PROBLEM", "There is no " + STORE + " -- but a store-shaped folder exists at " + stores.join(", ") +
			". Restore only looks in " + STORE + "; it was probably moved or copied into the wrong place.");
		return;
	}
	if (stores.length > 1) {
		R.find("WARN", "More than one store-shaped folder: " + stores.join(", ") + ". Restore only reads " + STORE + ".");
	}
	var filesExist = isDir(primary + "files/");
	if (manifests.all.length === 0 || manifests.names.length === 0) {
		var o = manifests.orphans;
		R.find("PROBLEM", "The store has NO manifest" + (filesExist && o ? ", but " + o.count + " stored file(s) (" + mb(o.bytes) +
			") written " + fmtTime(o.from) + " to " + fmtTime(o.to) : "") + ". A manifest is written only after every " +
			"file is stored, as the backup's very last step, so the backup was interrupted (or failed) before it " +
			"finished. Without a manifest Restore has nothing to offer: it cannot know what the files are.");
		return;
	}
	manifests.all.forEach(function (m) {
		if (m.reasons.length && m.name.indexOf("._") !== 0) {
			R.find(manifests.restorable.length ? "WARN" : "PROBLEM", m.name + " is not offered by Restore: " + m.reasons.join("; "));
		}
	});
	if (manifests.restorable.length === 0) {
		R.find("PROBLEM", "None of the " + manifests.all.length + " manifest(s) passes Restore's checks -- see " +
			"'Manifests' below for each one's reason.");
	} else {
		manifests.restorable.forEach(function (m) {
			var bad = (m.missing || []).length + (m.wrongSize || []).length + (m.corrupt || []).length;
			if (bad) {
				R.find("PROBLEM", m.name + " is offered by Restore but " + (m.missing || []).length + " referenced file(s) " +
					"are missing, " + (m.wrongSize || []).length + " are the wrong size" +
					((m.corrupt || []).length ? ", " + m.corrupt.length + " fail their checksum" : "") +
					" -- restore would fail with 'Not found in backup'.");
			} else {
				R.find("OK", m.name + " passes every check this tool knows about and should be offered by Restore.");
			}
		});
	}
	if (manifests.orphans && manifests.orphans.count) {
		R.find("INFO", manifests.orphans.count + " stored file(s) (" + mb(manifests.orphans.bytes) + ") belong to no " +
			"manifest -- the leftovers of a backup that stored files and never wrote its manifest, written " +
			fmtTime(manifests.orphans.from) + " to " + fmtTime(manifests.orphans.to) + ".");
	}
}

function runScan(deep, finish) {
	var R = new Report();
	var header = [];
	header.push("Backup Diagnostic report -- " + fmtTime(new Date()) + (deep ? " (deep: checksums verified)" : " (quick)"));
	header.push("Read-only: nothing in webos-backups/ or .woce-backup/ was changed by this tool.");

	state = { state: "running", phase: "Looking for backup stores", done: 0, total: 0 };

	var stores = findStores();
	var primary = isDir(STORE) ? STORE : null;
	R.h("Where the backup lives");
	R.p("Restore reads: " + STORE + (primary ? " (exists)" : " (MISSING)"));
	R.p("Store-shaped folders under /media/internal: " + (stores.length ? stores.join(", ") : "none"));
	R.p("Top of /media/internal: " + (readdir(INTERNAL) || []).join(", "));
	if (primary) {
		R.p("webos-backups/ contains: " + (readdir(STORE) || []).join(", "));
		(readdir(STORE + "receipts/") || []).forEach(function (n) {
			var s = stat(STORE + "receipts/" + n);
			R.at(s && s.mtime, "restore receipt " + n);
			R.p("  receipt " + n + ": " + readText(STORE + "receipts/" + n, 1200));
		});
	}

	var scanRoot = primary || stores[0] || null;
	var manifests = scanRoot ? scanManifests(R, scanRoot) : { all: [], restorable: [], names: [] };

	var afterStore = function () {
		state.phase = "Reading the work area";
		scanWorkArea(R, scanRoot, manifests);
		verdict(R, stores, primary, manifests);

		state.phase = "Collecting device facts";
		R.h("Device");
		var info = readText("/etc/palm-build-info", 800);
		R.p(info ? info.trim() : "(/etc/palm-build-info unreadable)");
		["/usr/palm/applications/com.palm.app.backup/appinfo.json",
		 "/media/cryptofs/apps/usr/palm/applications/com.palm.app.backup/appinfo.json"].forEach(function (p) {
			var t = readText(p);
			var v = null;
			try { v = t && JSON.parse(t).version; } catch (e) {}
			R.p("Backup app at " + p + ": " + (t === null ? "not present/readable" : "version " + v));
		});
		sh("df -k /media/internal; echo; uptime; echo; ls -la /media/internal/webos-backups /media/internal/.woce-backup 2>&1 | head -40", function (out) {
			R.p(out.trim());
			sh("grep -h -i -E 'woce|backup' /var/log/messages /var/log/woce-backupd.log 2>&1 | tail -60", function (log) {
				R.h("Device log lines mentioning backup (this boot only; older logs did not survive the Doctor)");
				R.p(log.trim() || "(none)");
				var text = R.render(header.join("\n"));
				lastReport = text;
				try { fs.writeFileSync(REPORT, text, "utf8"); } catch (e) { text = "(could not save " + REPORT + ": " + e + ")\n\n" + text; }
				state = { state: "done", phase: "", done: 0, total: 0 };
				finish(text);
			});
		});
	};

	if (scanRoot) { scanStore(R, scanRoot, manifests, deep, afterStore); } else { afterStore(); }
}

/* ----------------------------------------------------------------- commands */

function ScanAssistant() {}
ScanAssistant.prototype.run = function (future) {
	if (state.state === "running") {
		future.result = { returnValue: false, errorText: "a scan is already running" };
		return;
	}
	var deep = !!this.controller.args.deep;
	try {
		runScan(deep, function (text) {
			future.result = { returnValue: true, report: text, path: REPORT };
		});
	} catch (e) {
		state = { state: "idle", phase: "", done: 0, total: 0 };
		console.error("backupdiag: scan failed: " + (e.stack || e));
		future.result = { returnValue: true, report: "The scan itself failed: " + (e.stack || e), path: null };
	}
};

function StatusAssistant() {}
StatusAssistant.prototype.run = function (future) {
	future.result = { returnValue: true, state: state.state, phase: state.phase, done: state.done, total: state.total };
};

function AppendAssistant() {}
AppendAssistant.prototype.run = function (future) {
	var a = this.controller.args;
	if (lastReport === null) { lastReport = readText(REPORT) || ""; }
	lastReport += "\n== " + (a.title || "Note") + " ==\n" + (a.text || "") + "\n";
	try { fs.writeFileSync(REPORT, lastReport, "utf8"); } catch (e) {}
	future.result = { returnValue: true, report: lastReport };
};
