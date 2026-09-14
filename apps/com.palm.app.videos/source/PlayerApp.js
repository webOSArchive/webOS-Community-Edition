/*
 * PlayerApp — the card. Everything that touches <video> goes through VideoEngine.
 *
 * Launch params (superset of what Photos and the stock Mojo handler already send):
 *   { target: "/path/or/http-url" | video: {path, title, _id} | _id: "<db8 id>",
 *     title | videoTitle: "...", initialPos: seconds, selftest: "scrub|eos|http" }
 */
enyo.kind({
	name: "PlayerApp",
	kind: enyo.Control,
	className: "player",
	CONTROLS_HIDE_MS: 5000,
	FLICK_FWD: 30,
	FLICK_BACK: 10,
	components: [
		{kind: "ApplicationEvents", onWindowDeactivated: "windowDeactivated", onWindowActivated: "windowActivated",
			onUnload: "unload", onApplicationRelaunch: "relaunch"},
		// preferences live in the Tweaks framework (tweaks/com.palm.app.videos.json);
		// absent Tweaks the defaults below apply
		{name: "tweaks", kind: "PalmService", service: "palm://org.webosinternals.tweaks.prefs/", method: "get",
			onSuccess: "tweaksLoaded", onFailure: "tweaksUnavailable"},
		{name: "stage", className: "stage", onclick: "stageClick", onflick: "stageFlick"},
		{name: "notice", className: "notice hidden"},
		{name: "header", className: "bar header", components: [
			{name: "status", tag: "span", className: "status"},
			{name: "title", tag: "span"}
		]},
		{name: "controls", className: "bar controls", onclick: "controlsClick", components: [
			{className: "row", components: [
				{name: "playBtn", className: "mbtn left", onclick: "playClick", onmousedown: "btnDown", onmouseup: "btnUp", onmouseout: "btnUp",
					components: [{name: "playIcon", className: "micon play"}]},
				{name: "elapsed", className: "time elapsed", content: "0:00"},
				{name: "scrub", kind: "ProgressSlider", className: "scrub", minimum: 0, maximum: 1000, lockBar: true,
					animatePosition: false, onChanging: "scrubChanging", onChange: "scrubChange"},
				{name: "remaining", className: "time remaining", content: "-0:00"},
				{name: "fitBtn", className: "mbtn right", onclick: "fitClick", onmousedown: "btnDown", onmouseup: "btnUp", onmouseout: "btnUp",
					components: [{name: "fitIcon", className: "micon fill"}]}
			]}
		]}
	],

	btnDown: function (inSender) { inSender.addClass("down"); },
	btnUp: function (inSender) { inSender.removeClass("down"); },

	create: function () {
		this.inherited(arguments);
		this.log = enyo.bind(this, function (msg) { console.log("[vids] " + msg); });
		this.controlsShown = true;
		this.hideTimer = 0;
		this.scrubbing = false;
		this.fill = false;
		this.blockingTimeout = false;
		this.tick = enyo.bind(this, this.refresh);
		this.prefs = {pauseWhenCarded: false};
		this.$.tweaks.call({owner: "com.palm.app.videos", keys: ["pauseWhenCarded"]});
	},

	// ---- prefs (Tweaks framework) ----------------------------------------------

	tweaksLoaded: function (inSender, r) {
		if (r && r.returnValue && r.pauseWhenCarded !== undefined) { this.prefs.pauseWhenCarded = !!r.pauseWhenCarded; }
		this.log("tweaks: pauseWhenCarded=" + this.prefs.pauseWhenCarded);
		if (this.engine) { this.engine.opts.resumeExternalPause = !this.prefs.pauseWhenCarded; }
	},

	tweaksUnavailable: function (inSender, r) {
		this.log("tweaks service unavailable, using defaults");
	},

	rendered: function () {
		this.inherited(arguments);
		this.engine = new VideoEngine(this.$.stage.hasNode(), {
			log: this.log,
			resumeExternalPause: !this.prefs.pauseWhenCarded,
			onChange: enyo.bind(this, this.engineChanged),
			onTime: enyo.bind(this, this.refresh)
		});
		this.tickTimer = setInterval(this.tick, 250);
		this.layoutScrub();
		enyo.setAllowedOrientation("free");
		enyo.setFullScreen(true);
		this.handleParams(enyo.windowParams || {});
	},

	layoutScrub: function () {
		// CSS positions the scrubber with left/right; nothing to compute
	},

	resizeHandler: function () {
		this.inherited(arguments);
		this.$.scrub.resize && this.$.scrub.resize();
	},

	// ---- launch ----------------------------------------------------------

	handleParams: function (p) {
		this.log("launch params: " + enyo.json.stringify(p));
		var url = p.target || (p.video && p.video.path) || p.url;
		var title = p.title || p.videoTitle || (p.video && p.video.title);
		if (p._id && !url) {
			this.lookupById(p._id);
			return;
		}
		if (!url) {
			this.showNotice("No video to play");
			return;
		}
		this.open(url, title, p.initialPos || 0, !p.noAutoPlay);
		if (p.selftest) {
			this.selfTest = new SelfTest(this.engine, this.log, p.selftest, p);
			this.selfTest.start();
		}
	},

	lookupById: function (id) {
		var self = this;
		new enyo.PalmService({service: "palm://com.palm.db/", method: "get",
			onSuccess: function (s, r) {
				var v = r && r.results && r.results[0];
				if (v && v.path) { self.open(v.path, v.title, v.playbackPosition || v.lastPlayTime || 0, true); }
				else { self.showNotice("Video not found"); }
			},
			onFailure: function () { self.showNotice("Video not found"); }
		}).call({ids: [id]});
	},

	relaunch: function (inSender, inEvent) {
		this.handleParams(enyo.windowParams || {});
		return true;
	},

	open: function (url, title, pos, autoplay) {
		this.url = url;
		var name = title;
		if (!name) { name = url.replace(/[?#].*$/, ""); name = name.substring(name.lastIndexOf("/") + 1); }
		// URLs (and titles some apps derive from them) arrive percent-encoded:
		// "My%20Video.mp4". Decode for display only; a malformed sequence keeps the raw text.
		if (/%[0-9A-Fa-f]{2}/.test(name)) {
			try { name = decodeURIComponent(name); } catch (e) {}
		}
		this.$.title.setContent(enyo.string.escapeHtml(name));
		this.showNotice(null);
		if (!(pos > 0)) { pos = this.loadPosition(url); }
		this.engine.load(url, pos);
		if (autoplay) { this.engine.play(); }
		this.showControls();
	},

	// ---- resume positions --------------------------------------------------------
	// Photos keeps lastPlayTime on com.palm.media.video.file:1, but db8 denies other
	// apps that kind (verified: "db: permission denied" for both get and merge), so
	// the player remembers positions itself, per device, keyed by path/URL.

	POS_KEY: "com.palm.app.videos.positions",
	MIN_RESUME_SECS: 10,        // same thresholds as the stock Mojo player
	END_MARGIN_SECS: 10,

	readPositions: function () {
		try { var raw = window.localStorage.getItem(this.POS_KEY); return raw ? enyo.json.parse(raw) : {}; } catch (e) { return {}; }
	},

	loadPosition: function (url) {
		var p = this.readPositions()[url];
		return (p && p.t > this.MIN_RESUME_SECS) ? p.t : 0;
	},

	savePosition: function () {
		if (!this.engine || !this.url) { return; }
		var s = this.engine.snapshot();
		if (!isFinite(s.duration) || s.duration <= 0) { return; }
		var t = s.currentTime;
		if (s.atEnd || t < this.MIN_RESUME_SECS || t > s.duration - this.END_MARGIN_SECS) { t = 0; }
		try {
			var all = this.readPositions(), keys = [], k;
			all[this.url] = {t: Math.floor(t), at: new Date().getTime()};
			for (k in all) { if (all.hasOwnProperty(k)) { keys.push(k); } }
			if (keys.length > 60) {                       // keep the 60 most recent
				keys.sort(function (a, b) { return all[b].at - all[a].at; });
				for (var i = 60; i < keys.length; i++) { delete all[keys[i]]; }
			}
			window.localStorage.setItem(this.POS_KEY, enyo.json.stringify(all));
		} catch (e) {}
	},

	// ---- engine -> UI ------------------------------------------------------

	engineChanged: function (s) {
		var playing = s.wantPlaying && s.phase !== "ended" && s.phase !== "error";
		this.$.playIcon.addRemoveClass("pause", playing);
		this.$.playIcon.addRemoveClass("play", !playing);
		var st = "";
		if (s.phase === "loading") { st = "loading"; }
		else if (s.phase === "seeking") { st = "seeking"; }
		else if (s.phase === "recovering") { st = "recovering"; }
		else if (s.phase === "error") { st = "error"; }
		else if (s.busy) { st = "…"; }
		this.$.status.setContent(st);
		this.$.scrub.addRemoveClass("disabled", !s.seekable);
		if (s.phase === "error") {
			this.showNotice("Could not play this video (" + s.error + ")");
		} else if (s.phase === "playing") {
			this.showNotice(null);
		}
		this.setBlockTimeout(s.phase === "playing");
		if (s.phase === "paused" || s.phase === "ended") { this.savePosition(); }
		if (s.phase === "playing") { this.scheduleHide(); }
		else { this.cancelHide(); if (!this.controlsShown) { this.showControls(); } }
		this.refresh();
	},

	refresh: function () {
		if (!this.engine) { return; }
		var s = this.engine.snapshot();
		var d = s.duration, t = s.currentTime;
		if (!this.scrubbing) {
			this.$.elapsed.setContent(this.fmt(t));
			if (isFinite(d) && d > 0) {
				this.$.remaining.setContent("-" + this.fmt(Math.max(0, d - t)));
				this.$.scrub.setPositionImmediate(Math.min(1000, t / d * 1000));
				// a local file is "buffered" end to end as far as the element knows —
				// showing that would promise instant seeks, so only HTTP gets the alt bar
				this.$.scrub.setAltBarPosition(s.isHttp ? Math.min(1000, s.buffered / d * 1000) : 0);
			} else {
				this.$.remaining.setContent("--:--");
				this.$.scrub.setPositionImmediate(0);
				this.$.scrub.setAltBarPosition(0);
			}
		}
	},

	fmt: function (secs) {
		if (!isFinite(secs) || secs < 0) { secs = 0; }
		secs = Math.floor(secs);
		var h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
		var mm = (h ? (m < 10 ? "0" : "") : "") + m, ss = (s < 10 ? "0" : "") + s;
		return (h ? h + ":" : "") + mm + ":" + ss;
	},

	showNotice: function (text) {
		this.$.notice.setContent(text ? enyo.string.escapeHtml(text) : "");
		this.$.notice.addRemoveClass("hidden", !text);
	},

	// ---- UI -> engine -------------------------------------------------------

	playClick: function (inSender, inEvent) {
		this.engine.togglePlay();
		this.showControls();
	},

	// the button shows the mode you would switch TO (Mojo convention: getFitFillMenuItem)
	fitClick: function () {
		this.fill = !this.fill;
		this.$.fitIcon.addRemoveClass("fit", this.fill);
		this.$.fitIcon.addRemoveClass("fill", !this.fill);
		this.engine.setFitMode(this.fill);
		this.showControls();
	},

	// Rule 3: while dragging only the labels move. One seek on release.
	scrubChanging: function (inSender, pos) {
		this.scrubbing = true;
		this.cancelHide();
		var d = this.engine.snapshot().duration;
		if (isFinite(d) && d > 0) {
			var t = pos / 1000 * d;
			this.$.elapsed.setContent(this.fmt(t));
			this.$.remaining.setContent("-" + this.fmt(d - t));
		}
	},

	scrubChange: function (inSender, pos) {
		this.scrubbing = false;
		var s = this.engine.snapshot();
		if (isFinite(s.duration) && s.duration > 0 && s.seekable) {
			this.engine.seek(pos / 1000 * s.duration);
		}
		this.showControls();
	},

	stageClick: function () {
		if (this.controlsShown) { this.hideControls(); } else { this.showControls(); }
	},

	controlsClick: function (inSender, inEvent) {
		this.showControls();
	},

	stageFlick: function (inSender, inEvent) {
		var vx = inEvent.xVel || inEvent.xVelocity || 0, vy = inEvent.yVel || inEvent.yVelocity || 0;
		if (Math.abs(vx) < Math.abs(vy)) { return; }
		this.engine.skip(vx > 0 ? this.FLICK_FWD : -this.FLICK_BACK);
		this.showControls();
		return true;
	},

	// ---- controls visibility -------------------------------------------------

	showControls: function () {
		this.controlsShown = true;
		this.$.header.removeClass("hidden");
		this.$.controls.removeClass("hidden");
		this.scheduleHide();
	},

	hideControls: function () {
		if (this.scrubbing) { return; }
		this.controlsShown = false;
		this.$.header.addClass("hidden");
		this.$.controls.addClass("hidden");
	},

	scheduleHide: function () {
		this.cancelHide();
		if (!this.engine || this.engine.snapshot().phase !== "playing") { return; }
		this.hideTimer = setTimeout(enyo.bind(this, this.hideControls), this.CONTROLS_HIDE_MS);
	},

	cancelHide: function () {
		if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = 0; }
	},

	// ---- window / power ----------------------------------------------------------

	setBlockTimeout: function (block) {
		if (block === this.blockingTimeout) { return; }
		this.blockingTimeout = block;
		if (window.PalmSystem) { window.PalmSystem.setWindowProperties({blockScreenTimeout: block}); }
	},

	// Default: keep playing when carded (the user's call — the pause + overlay flash
	// on return is worse than a video playing small in card view). App menu toggle.
	windowDeactivated: function () {
		this.log("window deactivated, pauseWhenCarded=" + this.prefs.pauseWhenCarded);
		this.savePosition();
		if (this.engine && !this.selfTest && this.prefs.pauseWhenCarded) { this.engine.pause(); }
	},

	windowActivated: function () {
		this.log("window activated");
		this.showControls();
	},

	unload: function () {
		this.log("unload");
		this.savePosition();
		if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = 0; }
		this.cancelHide();
		if (this.selfTest) { this.selfTest.stop(); }
		if (this.engine) { this.engine.destroy(); this.engine = null; }
	}
});
