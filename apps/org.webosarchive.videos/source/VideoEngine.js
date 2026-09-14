/*
 * VideoEngine — the only thing in this app that touches the <video> element.
 *
 * Framework-agnostic (no Enyo), ES3 (this WebKit has no Function.prototype.bind).
 * Implements the rules from Docs/VIDEO-PLAYER-REWRITE.md §3.2:
 *   1  one in-flight operation, everything else queues
 *   2  seeks coalesce to the newest target, nothing is retried
 *   3  scrubbing never seeks the pipeline (the UI calls seek() once, on release)
 *   4  pause around seek when playing
 *   5  EOS is a state; restart seeks to 0 through the gate (or reloads)
 *   6  deadlines recover (reload -> rebuild -> error), they never retry
 *   7  mediaserver lifecycle events are inputs to rule 6, not fatal
 *   8  every timer is owned here and cleared in destroy()
 *   9  seekability is decided once, after loadedmetadata
 *  10  a play that does not start is a failure
 *  11  pipeline errors during an op recover immediately
 *
 * Usage:
 *   var e = new VideoEngine(containerNode, {log: fn, onChange: fn, onTime: fn});
 *   e.load(url, startSeconds); e.play(); e.pause(); e.seek(s); e.destroy();
 *   e.snapshot() -> plain object with the current state for the UI.
 */
function VideoEngine(container, opts) {
	this.container = container;
	this.opts = opts || {};
	this.log = this.opts.log || function () {};
	this.onChange = this.opts.onChange || function () {};
	this.onTime = this.opts.onTime || function () {};

	this.el = null;               // the <video>
	this.url = null;
	this.isHttp = false;
	this.queue = [];              // pending ops: {kind, arg}
	this.op = null;               // in-flight op
	this.opTimer = 0;
	this.pendingSeek = null;      // newest requested seek target (seconds), rule 2
	this.resumeAfterSeek = false;

	this.phase = "empty";         // empty|loading|ready|playing|paused|seeking|ended|recovering|error
	this.duration = NaN;
	this.seekable = false;
	this.seekableDecided = false;
	this.atEnd = false;
	this.buffered = 0;            // seconds buffered (end of last range)
	this.lastTime = 0;            // last currentTime reported by the element
	this.lastWall = 0;            // Date.now() at lastTime
	this.wantPlaying = false;     // user intent
	this.error = null;

	this.recoverCount = 0;
	this.healthyTimer = 0;
	this.started = false;         // reached playing at least once since load
	this.stats = {ops: 0, seeks: 0, seeksCoalesced: 0, recoveries: 0, rebuilds: 0, maxSeekMs: 0};
	this.handlers = {};
}

VideoEngine.prototype = {
	// deadlines, ms. Local far seeks measured up to 3.3 s on a 10 s GOP (Phase 0),
	// HTTP start measured ~2.5 s. These are "something is wrong", not "hurry up".
	DEADLINE: {
		load:  {local: 8000,  http: 15000},
		seek:  {local: 6000,  http: 10000},
		play:  {local: 2500,  http: 8000},
		pause: {local: 2000,  http: 2000}
	},
	MIN_SEEK_SPACING: 400,
	// A seek issued before a freshly loaded pipeline has rendered a frame crashes
	// media-pipeline in the video sink's RGB capture (_vhm_rotate <- rgb_capture,
	// rdxd 2026-09-14 17:33:56, 70 ms after load). readyState says 4 long before
	// that, so this is time-based: first seek no sooner than this after canplay.
	POST_LOAD_SEEK_HOLD: 1200,
	HEALTHY_AFTER_MS: 5000,
	MAX_RECOVERIES: 3,

	// ---- public --------------------------------------------------------

	load: function (url, startPos) {
		this.url = url;
		this.startPos = startPos || 0;
		this.isHttp = /^https?:/i.test(url);
		this.recoverCount = 0;
		this.enqueue("load");
	},

	play: function () {
		this.wantPlaying = true;
		this.enqueue("play");
	},

	pause: function () {
		this.wantPlaying = false;
		this.enqueue("pause");
	},

	togglePlay: function () {
		if (this.wantPlaying && (this.phase === "playing" || this.op && this.op.kind === "play")) {
			this.pause();
		} else {
			this.play();
		}
	},

	// Rule 2/3: the UI calls this once per gesture. Repeated calls while an op is
	// in flight simply replace the target.
	seek: function (seconds) {
		if (!this.seekable) { this.log("seek ignored: source not seekable"); return; }
		if (isNaN(seconds)) { return; }
		var d = this.duration;
		if (seconds < 0) { seconds = 0; }
		if (d > 0 && seconds > d - 0.5) { seconds = Math.max(0, d - 0.5); }
		if (this.pendingSeek !== null) { this.stats.seeksCoalesced++; }
		this.pendingSeek = seconds;
		// present the target immediately so the UI never shows the old position
		this.lastTime = seconds; this.lastWall = 0;
		this.pump();
	},

	skip: function (delta) {
		this.seek(this.currentTime() + delta);
	},

	currentTime: function () {
		if (this.phase === "playing" && this.lastWall) {
			var t = this.lastTime + (this.now() - this.lastWall) / 1000;
			return (this.duration > 0) ? Math.min(t, this.duration) : t;
		}
		return this.lastTime;
	},

	snapshot: function () {
		return {
			phase: this.phase,
			busy: !!this.op,
			currentTime: this.currentTime(),
			duration: this.duration,
			seekable: this.seekable,
			buffered: this.buffered,
			atEnd: this.atEnd,
			wantPlaying: this.wantPlaying,
			error: this.error,
			isHttp: this.isHttp,
			stats: this.stats
		};
	},

	destroy: function () {
		this.clearOpTimer();
		this.clearHealthyTimer();
		this.queue = [];
		this.op = null;
		this.pendingSeek = null;
		this.teardownElement();
		this.phase = "empty";
	},

	// ---- element lifecycle (rule 6/7) -----------------------------------

	buildElement: function () {
		this.teardownElement();
		var el = document.createElement("video");
		el.setAttribute("x-palm-media-audio-class", "media");
		el.setAttribute("x-palm-media-extended-overlay-playback", "true");
		el.setAttribute("x-palm-media-extended-fitmode", this.opts.fill ? "VIDEO_FILL" : "VIDEO_FIT");
		el.autoplay = false;
		el.className = "ve-video";
		var self = this;
		var names = ["loadstart", "loadedmetadata", "loadeddata", "canplay", "canplaythrough",
			"durationchange", "play", "playing", "pause", "seeking", "seeked", "timeupdate",
			"ended", "waiting", "stalled", "error", "emptied", "progress",
			"x-palm-disconnect", "x-palm-connect", "x-palm-watchdog-triggered"];
		for (var i = 0; i < names.length; i++) {
			(function (n) {
				var h = function (ev) { self.onEvent(n, ev); };
				self.handlers[n] = h;
				el.addEventListener(n, h, false);
			})(names[i]);
		}
		this.container.appendChild(el);
		this.el = el;
		this.seekableDecided = false;
		this.seekableFinal = false;
		this.seekable = false;
		this.seekGuardUntil = 0;
		this.duration = NaN;
		this.buffered = 0;
		this.started = false;
	},

	teardownElement: function () {
		var el = this.el;
		if (!el) { return; }
		for (var n in this.handlers) {
			if (this.handlers.hasOwnProperty(n)) { el.removeEventListener(n, this.handlers[n], false); }
		}
		this.handlers = {};
		try { el.pause(); } catch (e1) {}
		try { el.removeAttribute("src"); el.load(); } catch (e2) {}
		if (el.parentNode) { el.parentNode.removeChild(el); }
		this.el = null;
	},

	setFitMode: function (fill) {
		this.opts.fill = !!fill;
		if (this.el) { this.el.setAttribute("x-palm-media-extended-fitmode", fill ? "VIDEO_FILL" : "VIDEO_FIT"); }
	},

	// ---- the gate (rule 1) ---------------------------------------------

	enqueue: function (kind, arg) {
		// collapse redundant play/pause: only the last intent matters
		if (kind === "play" || kind === "pause") {
			var q = [];
			for (var i = 0; i < this.queue.length; i++) {
				if (this.queue[i].kind !== "play" && this.queue[i].kind !== "pause") { q.push(this.queue[i]); }
			}
			this.queue = q;
		}
		if (kind === "load") { this.queue = []; this.pendingSeek = null; }
		this.queue.push({kind: kind, arg: arg});
		this.pump();
	},

	pump: function () {
		if (this.op || this.phase === "recovering") { return; }
		var next = null;
		// a pending seek outranks queued play/pause (the user just moved the knob)
		if (this.pendingSeek !== null && this.phase !== "empty" && this.phase !== "loading" && this.phase !== "error") {
			var sinceLast = this.now() - (this.lastSeekIssued || 0);
			if (sinceLast < this.MIN_SEEK_SPACING) {
				var self = this;
				this.spacingTimer = setTimeout(function () { self.spacingTimer = 0; self.pump(); }, this.MIN_SEEK_SPACING - sinceLast);
				return;
			}
			next = {kind: "seek", arg: this.pendingSeek};
			this.pendingSeek = null;
		} else if (this.queue.length) {
			next = this.queue.shift();
		}
		if (!next) { return; }
		this.start(next);
	},

	start: function (op) {
		this.op = op;
		this.stats.ops++;
		op.t0 = this.now();
		this.log("op " + op.kind + (op.arg !== undefined ? "(" + op.arg + ")" : "") + " phase=" + this.phase);
		try {
			switch (op.kind) {
			case "load":  this.doLoad(); break;
			case "play":  this.doPlay(); break;
			case "pause": this.doPause(); break;
			case "seek":  this.doSeek(op.arg); break;
			default: this.finish(); return;
			}
		} catch (ex) {
			// the element throws when mediaserver is gone (Photos comment, DbViewVideo.js:926)
			this.log("op " + op.kind + " threw: " + ex);
			this.recover("exception in " + op.kind);
		}
	},

	arm: function (kind) {
		this.clearOpTimer();
		var ms = this.DEADLINE[kind][this.isHttp ? "http" : "local"];
		var self = this;
		this.opTimer = setTimeout(function () { self.opTimer = 0; self.deadline(); }, ms);
	},

	finish: function () {
		var op = this.op;
		this.clearOpTimer();
		this.op = null;
		if (op) {
			var ms = this.now() - op.t0;
			if (op.kind === "seek" && ms > this.stats.maxSeekMs) { this.stats.maxSeekMs = ms; }
			this.log("op " + op.kind + " done in " + ms + "ms");
		}
		this.changed();
		this.pump();
	},

	deadline: function () {
		var op = this.op;
		if (!op) { return; }
		this.log("DEADLINE on " + op.kind + " after " + (this.now() - op.t0) + "ms (phase=" + this.phase + ")");
		this.recover("deadline:" + op.kind);
	},

	// Rule 9 fallback: WebKit reports a full seekable range even for hosts that
	// ignore Range (Phase 1 measurement), so the only evidence is a seek that fails.
	// One failed HTTP seek marks the URL unseekable for the rest of the session and
	// the recovery reloads from 0 rather than re-seeking into the same failure.
	markUnseekable: function (why) {
		this.log("marking source unseekable: " + why);
		this.seekable = false;
		this.seekableFinal = true;
		this.unseekableUrl = this.url;
		this.pendingSeek = null;
	},

	// ---- ops -----------------------------------------------------------

	doLoad: function () {
		if (!this.url) { this.fail("no url"); return; }
		this.buildElement();
		this.phase = "loading";
		this.atEnd = false;
		this.lastTime = this.startPos || 0; this.lastWall = 0;
		this.changed();
		this.arm("load");
		var url = this.url;
		if (url.charAt(0) === "/") { url = "file://" + url; }
		if (/\.(webm|mkv)(\?|#|$)/i.test(url)) {
			// CE's webm reroute: WebKit rejects video/webm in supportsType, so hand it
			// a <source type=video/ogg> and let mediaserver typefind the real container.
			var s = document.createElement("source");
			s.setAttribute("src", url);
			s.setAttribute("type", "video/ogg");
			this.el.appendChild(s);
			this.el.load();
		} else {
			this.el.src = url;
			this.el.load();
		}
	},

	doPlay: function () {
		if (!this.el || this.phase === "empty" || this.phase === "error") { this.finish(); return; }
		if (this.phase === "loading") { this.queue.unshift(this.op); this.op = null; return; } // retried when load finishes
		if (this.atEnd) {
			// rule 5: restart is a seek through the gate, or a reload for unseekable sources
			this.atEnd = false;
			if (this.seekable) {
				this.op = null;
				this.pendingSeek = 0;
				this.queue.unshift({kind: "play"});
				this.pump();
			} else {
				this.log("restart of unseekable source: reloading");
				this.op = null;
				this.startPos = 0;
				this.queue.unshift({kind: "play"});
				this.queue.unshift({kind: "load"});
				this.pump();
			}
			return;
		}
		if (this.phase === "playing" && !this.el.paused) { this.finish(); return; }
		this.arm("play");
		this.el.play();
	},

	doPause: function () {
		if (!this.el || this.phase !== "playing" || this.el.paused) { this.phase = (this.phase === "playing") ? "paused" : this.phase; this.finish(); return; }
		this.arm("pause");
		this.el.pause();
	},

	doSeek: function (seconds) {
		if (!this.el || !this.seekable) { this.finish(); return; }
		this.stats.seeks++;
		this.lastSeekIssued = this.now();
		this.resumeAfterSeek = (this.phase === "playing") && this.wantPlaying;
		this.atEnd = false;
		this.op.target = seconds;
		if (this.phase === "playing" && !this.el.paused) {
			// rule 4: pause first; the seek itself is issued from the 'pause' event
			this.op.stage = "pausing";
			this.arm("pause");
			this.el.pause();
		} else {
			this.issueSeek(seconds);
		}
	},

	issueSeek: function (seconds) {
		this.op.stage = "seeking";
		this.phase = "seeking";
		this.changed();
		this.arm("seek");
		this.el.currentTime = seconds;
	},

	// mediaserver's currentTime property reaches WebKit over the bus a beat AFTER the
	// 'seeked' event, so for a moment the element still reports the pre-seek time.
	// Until a timeupdate agrees with the target, element times far from it are noise.
	acceptTime: function (t) {
		if (this.seekGuardUntil && this.now() < this.seekGuardUntil) {
			if (Math.abs(t - this.seekGuardTarget) > 2.5) { return false; }
			this.seekGuardUntil = 0;
		}
		return true;
	},

	setTime: function (t, wall) {
		if (!this.acceptTime(t)) { return; }
		this.lastTime = t; this.lastWall = wall;
	},

	// ---- element events --------------------------------------------------

	onEvent: function (name, ev) {
		var el = this.el;
		if (!el) { return; }
		if (name !== "timeupdate" && name !== "progress") { this.log("ev " + name + " t=" + this.fmt(el.currentTime) + " rs=" + el.readyState + " paused=" + el.paused); }
		var op = this.op;
		switch (name) {
		case "durationchange":
		case "loadedmetadata":
			this.duration = el.duration;
			this.log("  duration=" + el.duration + " " + this.describeSeekable());
			// decide once a finite duration is known; a source that never reports one
			// is decided (unseekable) at canplay. A later finite duration upgrades it.
			if (!this.seekableDecided || (!this.seekable && isFinite(el.duration) && el.duration > 0 && !this.seekableFinal)) {
				if (isFinite(el.duration) && el.duration > 0) { this.decideSeekable(); }
			}
			this.changed();
			break;
		case "canplay":
			if (op && op.kind === "load") {
				this.phase = "ready";
				if (!this.seekableDecided) { this.decideSeekable(); }
				this.lastSeekIssued = this.now() + this.POST_LOAD_SEEK_HOLD - this.MIN_SEEK_SPACING;
				this.finish();
				// a seek the user requested during load/recovery outranks the resume position
				if (this.pendingSeek === null && this.startPos > 0 && this.seekable) { this.pendingSeek = this.startPos; }
				this.startPos = 0;
				this.pump();
			}
			break;
		case "playing":
			this.phase = "playing";
			this.atEnd = false;
			if (this.lastWall === 0) { this.lastWall = this.now(); }   // start interpolating from the trusted time
			this.setTime(el.currentTime, this.now());
			this.markHealthySoon();
			if (op && op.kind === "play") { this.finish(); } else { this.changed(); }
			break;
		case "pause":
			if (op && op.kind === "seek" && op.stage === "pausing") {
				this.issueSeek(op.target);
				break;
			}
			if (this.phase !== "ended" && this.phase !== "seeking") { this.phase = "paused"; }
			this.setTime(el.currentTime, 0);
			this.lastWall = 0;
			if (op && op.kind === "pause") { this.finish(); } else { this.changed(); }
			break;
		case "seeked":
			if (op && op.kind === "seek") {
				// trust the target, not the element (see acceptTime)
				this.lastTime = op.target; this.lastWall = 0;
				this.seekGuardTarget = op.target;
				this.seekGuardUntil = this.now() + 3000;
				this.phase = el.paused ? "paused" : "playing";
				var resume = this.resumeAfterSeek && this.wantPlaying;
				this.finish();
				if (resume && this.pendingSeek === null) { this.enqueue("play"); }
			} else {
				this.setTime(el.currentTime, 0);
				this.changed();
			}
			break;
		case "timeupdate":
			if (!el.paused && !el.seeking) {
				this.setTime(el.currentTime, this.now());
				if (this.phase !== "playing" && this.phase !== "ended" && this.phase !== "seeking" && op === null) { this.phase = "playing"; }
			}
			this.onTime(this.currentTime());
			break;
		case "progress":
			try {
				var b = el.buffered;
				if (b && b.length) { this.buffered = b.end(b.length - 1); }
			} catch (e) {}
			break;
		case "ended":
			this.atEnd = true;
			this.wantPlaying = false;
			this.phase = "ended";
			this.lastTime = (this.duration > 0) ? this.duration : el.currentTime; this.lastWall = 0;
			if (op && (op.kind === "play" || op.kind === "seek")) { this.finish(); } else { this.changed(); }
			break;
		case "error":
			var code = el.error ? el.error.code : -1;
			if (code === 1 /* ABORTED */) { break; }
			this.log("media error code=" + code + " ext=" + el.getAttribute("x-palm-media-extended-error"));
			this.recover("error:" + code);
			break;
		case "x-palm-disconnect":
		case "x-palm-watchdog-triggered":
			this.recover(name);
			break;
		default:
			break;
		}
	},

	describeSeekable: function () {
		var el = this.el;
		try {
			var s = el.seekable, b = el.buffered, out = "seekable=";
			out += (s && s.length) ? ("[" + s.start(0) + "-" + s.end(s.length - 1) + "]") : "empty";
			out += " buffered=" + ((b && b.length) ? ("[" + b.start(0) + "-" + b.end(b.length - 1) + "]") : "empty");
			return out + " rs=" + el.readyState + " ns=" + el.networkState;
		} catch (e) { return "seekable=throws(" + e + ")"; }
	},

	// Rule 9.
	decideSeekable: function () {
		var el = this.el;
		var d = el.duration;
		var ok = isFinite(d) && d > 0;
		var why = "duration=" + d + " " + this.describeSeekable();
		if (ok && this.unseekableUrl === this.url) { ok = false; why += " (failed a seek earlier)"; }
		else if (ok) {
			try {
				var s = el.seekable;
				if (s && s.length > 0) {
					ok = s.end(s.length - 1) > 0;
				} else {
					// local files without a seekable range are still seekable in practice;
					// HTTP ones are not (no Range support / chunked)
					ok = !this.isHttp;
				}
			} catch (e) { ok = !this.isHttp; }
		}
		this.seekableDecided = true;
		// a decision made on a finite duration is final; one made on NaN/Infinity may upgrade
		this.seekableFinal = (isFinite(d) && d > 0) || this.unseekableUrl === this.url;
		this.seekable = ok;
		this.log("seekable=" + ok + (this.seekableFinal ? "" : " (provisional)") + " (" + why + ")");
		this.changed();
	},

	// ---- recovery (rule 6) ------------------------------------------------

	recover: function (why) {
		this.clearOpTimer();
		var wasPlaying = this.wantPlaying;
		var pos = this.currentTime();
		if (!isFinite(pos) || pos < 0) { pos = 0; }
		// an HTTP seek that fails outright, or a network error landing within a few
		// seconds of a seek that "succeeded" (the no-Range host answers the seek and
		// then feeds the decoder the wrong bytes), both mean: stop seeking this URL
		if (this.isHttp && ((this.op && this.op.kind === "seek") ||
			(this.stats.seeks > 0 && this.now() - this.lastSeekIssued < 10000))) { this.markUnseekable(why); }
		this.op = null;
		this.pendingSeek = null;
		this.recoverCount++;
		this.stats.recoveries++;
		this.log("RECOVER #" + this.recoverCount + " (" + why + ") at " + this.fmt(pos) + " wantPlaying=" + wasPlaying);
		if (this.recoverCount > this.MAX_RECOVERIES || !this.url) {
			this.fail(why);
			return;
		}
		this.phase = "recovering";
		this.changed();
		// attempt 1 reuses the element (cheap); later attempts rebuild it — a fresh
		// element is a fresh mediaserver session.
		var rebuild = this.recoverCount >= 2;
		if (rebuild) { this.stats.rebuilds++; }
		this.startPos = this.seekable ? pos : 0;
		this.queue = [];
		var self = this;
		setTimeout(function () {
			if (self.phase !== "recovering") { return; }
			if (!rebuild && self.el) {
				try { self.el.removeAttribute("src"); self.el.load(); } catch (e) {}
			}
			self.phase = "empty";              // pump() refuses to run while recovering
			self.queue.push({kind: "load"});
			if (wasPlaying) { self.queue.push({kind: "play"}); }
			self.pump();
		}, rebuild ? 500 : 100);
	},

	fail: function (why) {
		this.clearOpTimer();
		this.op = null;
		this.queue = [];
		this.pendingSeek = null;
		this.phase = "error";
		this.error = why;
		this.wantPlaying = false;
		this.log("FAILED: " + why);
		this.changed();
	},

	// once playback has run for a while, forget earlier recoveries
	markHealthySoon: function () {
		this.clearHealthyTimer();
		var self = this;
		this.healthyTimer = setTimeout(function () {
			self.healthyTimer = 0;
			if (self.phase === "playing") { self.recoverCount = 0; self.started = true; }
		}, this.HEALTHY_AFTER_MS);
	},

	// ---- utils -----------------------------------------------------------

	changed: function () { this.onChange(this.snapshot()); },
	clearOpTimer: function () { if (this.opTimer) { clearTimeout(this.opTimer); this.opTimer = 0; } },
	clearHealthyTimer: function () { if (this.healthyTimer) { clearTimeout(this.healthyTimer); this.healthyTimer = 0; } if (this.spacingTimer) { clearTimeout(this.spacingTimer); this.spacingTimer = 0; } },
	now: function () { return new Date().getTime(); },
	fmt: function (s) { return (isFinite(s) ? Math.round(s * 100) / 100 : s) + "s"; }
};
