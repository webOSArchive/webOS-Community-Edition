/*global IMPORTS, Buffer */
/*
 * webOS CE: the file half of the Photos editor (rotate and crop).
 *
 * A web app cannot write files, so Photos renders the edited picture in a canvas
 * and hands this service the encoded bytes, base64, in chunks:
 *
 *   writeChunk {path, data, append}  -> bytes go to a hidden temp file beside `path`
 *   commit     {path, replace}       -> the temp file becomes the picture:
 *                                       replace: over `path`
 *                                       copy:    at `path`, or `name-2.ext`, `name-3.ext`...
 *                                       if that exists. Answers {path} it used.
 *   discard    {path}                -> removes the temp file
 *
 * Only Photos may call it, and only for .jpg/.jpeg/.png files under /media/internal.
 */
var fs = IMPORTS.require('fs');
var pathLib = IMPORTS.require('path');

var ROOT = "/media/internal/";
var CALLER = "com.palm.app.photos";

function PhotoEditService() {}

// The service framework forces returnValue:true onto any result it is handed, so a
// failure has to be raised as an exception to reach the caller as returnValue:false.
function fail(future, text) {
	console.error("photos.service: " + text);
	var e = new Error(text);
	e.errorCode = -1;
	e.errorText = text;
	future.exception = e;
}

function callerOf(controller) {
	var m = controller.message;
	try {
		return (m.applicationID && m.applicationID()) || (m.senderServiceName && m.senderServiceName()) || "";
	} catch (e) {
		return "";
	}
}

// The picture's path, validated, or null.
function checkPath(p) {
	if (typeof p !== "string") { return null; }
	p = pathLib.normalize(p);
	if (p.indexOf(ROOT) !== 0 || p.indexOf("/.") !== -1) { return null; }
	if (!/\.(jpe?g|png)$/i.test(p)) { return null; }
	return p;
}

function tempOf(p) {
	return pathLib.join(pathLib.dirname(p), "." + pathLib.basename(p) + ".ce-edit");
}

function exists(p) {
	try { fs.statSync(p); return true; } catch (e) { return false; }
}

// Common gate: answers the validated path, or null after failing the call.
function gate(assistant, future) {
	var who = callerOf(assistant.controller).split(" ")[0];
	if (who !== CALLER) {
		fail(future, "caller not allowed: " + who);
		return null;
	}
	var p = checkPath(assistant.controller.args.path);
	if (!p) {
		fail(future, "bad path: " + assistant.controller.args.path);
		return null;
	}
	return p;
}

function WriteChunkAssistant() {}
WriteChunkAssistant.prototype.run = function (future) {
	var p = gate(this, future);
	if (!p) { return; }
	var args = this.controller.args;
	if (typeof args.data !== "string") { return fail(future, "no data"); }
	var tmp = tempOf(p), fd;
	try {
		fd = fs.openSync(tmp, args.append ? "a" : "w", 420);
		var buf = new Buffer(args.data, "base64");
		fs.writeSync(fd, buf, 0, buf.length, null);
		fs.closeSync(fd);
		future.result = { returnValue: true, size: fs.statSync(tmp).size };
	} catch (e) {
		try { if (fd !== undefined) { fs.closeSync(fd); } } catch (e2) {}
		fail(future, "write failed: " + e);
	}
};

function CommitAssistant() {}
CommitAssistant.prototype.run = function (future) {
	var p = gate(this, future);
	if (!p) { return; }
	var tmp = tempOf(p);
	if (!exists(tmp)) { return fail(future, "nothing written for " + p); }
	try {
		var dest = p;
		// (the file's times cannot be kept: this node has no utimes, busybox touch no -d --
		// and the indexer files a rewritten picture as a new record regardless)
		if (this.controller.args.replace) {
			if (!exists(p)) { return fail(future, "no picture to replace at " + p); }
			fs.renameSync(tmp, p);
		} else {
			var ext = pathLib.extname(p), stem = p.slice(0, p.length - ext.length), n = 2;
			while (exists(dest)) { dest = stem + "-" + (n++) + ext; }
			fs.renameSync(tmp, dest);
		}
		future.result = { returnValue: true, path: dest, size: fs.statSync(dest).size };
	} catch (e) {
		fail(future, "commit failed: " + e);
	}
};

function DiscardAssistant() {}
DiscardAssistant.prototype.run = function (future) {
	var p = gate(this, future);
	if (!p) { return; }
	try { fs.unlinkSync(tempOf(p)); } catch (e) {}
	future.result = { returnValue: true };
};
