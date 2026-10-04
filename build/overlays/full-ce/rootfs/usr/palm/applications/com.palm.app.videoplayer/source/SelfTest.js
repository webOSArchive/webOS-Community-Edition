/*
 * SelfTest — drives the engine through its PUBLIC methods, exactly as the slider
 * and the play button do, so a run can be launched with luna-send and read back
 * from /var/log/messages without touching the screen. It proves the engine, not
 * the touch layer; the touch layer is verified by looking.
 *
 * launch params: {"target": "...", "selftest": "scrub" | "eos" | "all", "rounds": N}
 *   scrub: N rounds of a 10 s "drag": random seek target every 25 ms (40/s, what
 *          Phase 0 measured Photos doing), then play 3 s and verify time advances.
 *   eos:   N rounds of seek near the end, wait for ended, play, verify restart.
 * Results: one "[vids] SELFTEST ..." line per check, and a final PASS/FAIL summary.
 */
function SelfTest(engine, log, mode, params) {
	this.engine = engine;
	this.log = log;
	this.mode = mode;
	this.rounds = (params && params.rounds) || 5;
	this.results = [];
	this.timers = [];
	this.stopped = false;
}

SelfTest.prototype = {
	start: function () {
		var self = this;
		this.log("SELFTEST start mode=" + this.mode + " rounds=" + this.rounds);
		this.waitFor(function () { var s = self.engine.snapshot(); return s.phase === "playing"; }, 20000, "initial play", function (ok) {
			if (!ok) { self.done(); return; }
			var steps = [];
			if (self.mode === "scrub" || self.mode === "all") { steps.push(function (cb) { self.scrubRounds(cb); }); }
			if (self.mode === "eos" || self.mode === "all") { steps.push(function (cb) { self.eosRounds(cb); }); }
			self.chain(steps, function () { self.done(); });
		});
	},

	stop: function () {
		this.stopped = true;
		for (var i = 0; i < this.timers.length; i++) { clearTimeout(this.timers[i]); }
		this.timers = [];
	},

	// ---- scenarios -----------------------------------------------------------

	scrubRounds: function (cb) {
		var self = this, round = 0;
		var next = function () {
			if (self.stopped || round >= self.rounds) { cb(); return; }
			round++;
			var s = self.engine.snapshot();
			if (!s.seekable) {
				// unseekable source: the engine must refuse to seek AND keep playing
				var t0u = self.engine.currentTime();
				var seeksBefore = self.engine.stats.seeks;
				self.engine.seek(10); self.engine.seek(20);
				self.later(function () {
					var t1u = self.engine.currentTime();
					self.check("scrub r" + round + " unseekable: no pipeline seek", self.engine.stats.seeks === seeksBefore, "seeks=" + self.engine.stats.seeks);
					self.check("scrub r" + round + " unseekable: still advancing", t1u > t0u + 2.0, "t0=" + t0u.toFixed(1) + " t1=" + t1u.toFixed(1) + " phase=" + self.engine.snapshot().phase);
					next();
				}, 4000);
				return;
			}
			var d = s.duration, n = 0, storm = 0;
			var burst = function () {
				if (self.stopped) { return; }
				if (n < 400) {                       // 10 s at 40 Hz
					n++;
					var t = Math.random() * (d - 2);
					self.engine.seek(t);               // engine coalesces; UI does the same on release
					self.later(burst, 25);
				} else {
					var target = 5 + Math.random() * (d - 10);
					self.engine.seek(target);
					self.engine.play();
					// wait for the engine to go idle and be playing near the target
					self.waitFor(function () {
						var x = self.engine.snapshot();
						return !x.busy && x.phase === "playing";
					}, 25000, "scrub r" + round + " settle", function (ok) {
						if (!ok) { next(); return; }
						var t0 = self.engine.currentTime();
						var x = self.engine.snapshot();
						if (!x.seekable) {
							// the engine downgraded the source mid-storm (HTTP host without Range):
							// the contract is "recovered and playing", not "landed"
							self.check("scrub r" + round + " downgraded to unseekable, recovered", x.phase === "playing", "recoveries=" + self.engine.stats.recoveries + " t=" + t0.toFixed(1));
						} else {
							var near = Math.abs(t0 - target) < 3.0;
							self.check("scrub r" + round + " landed", near, "target=" + target.toFixed(1) + " got=" + t0.toFixed(1) + " seeks=" + self.engine.stats.seeks + " coalesced=" + self.engine.stats.seeksCoalesced + " maxSeekMs=" + self.engine.stats.maxSeekMs);
						}
						// HTTP may legitimately re-buffer after landing past the buffered range;
						// give it up to 12 s to move, local 3 s
						var t0wall = new Date().getTime();
						self.waitFor(function () { return self.engine.currentTime() > t0 + 1.5; },
							x.isHttp ? 12000 : 3000, "scrub r" + round + " advancing", function () {
								self.log("SELFTEST      (resumed after " + (new Date().getTime() - t0wall) + "ms, t=" + self.engine.currentTime().toFixed(1) + ")");
								next();
							});
					});
				}
			};
			burst();
		};
		next();
	},

	eosRounds: function (cb) {
		var self = this, round = 0;
		var next = function () {
			if (self.stopped || round >= self.rounds) { cb(); return; }
			round++;
			var s = self.engine.snapshot();
			if (s.seekable && isFinite(s.duration)) {
				self.engine.seek(Math.max(0, s.duration - 4));
				self.engine.play();
			} else {
				self.engine.play();               // unseekable: just let it run out
			}
			self.waitFor(function () { return self.engine.snapshot().phase === "ended"; }, isFinite(s.duration) && s.seekable ? 20000 : (s.duration || 60) * 1000 + 20000, "eos r" + round + " reach end", function (ok) {
				if (!ok) { next(); return; }
				self.engine.play();
				self.waitFor(function () {
					var x = self.engine.snapshot();
					return !x.busy && x.phase === "playing" && x.currentTime > 0.5 && x.currentTime < 20;
				}, 20000, "eos r" + round + " restarted", function (ok2) {
					if (ok2) {
						var t0 = self.engine.currentTime();
						self.later(function () {
							var t1 = self.engine.currentTime();
							self.check("eos r" + round + " advancing after restart", t1 > t0 + 1.0, "t0=" + t0.toFixed(1) + " t1=" + t1.toFixed(1));
							next();
						}, 2000);
					} else { next(); }
				});
			});
		};
		next();
	},

	// ---- plumbing ------------------------------------------------------------

	check: function (name, ok, detail) {
		this.results.push({name: name, ok: ok});
		this.log("SELFTEST " + (ok ? "ok  " : "FAIL") + " " + name + (detail ? " — " + detail : ""));
	},

	waitFor: function (pred, timeoutMs, name, cb) {
		var self = this, t0 = new Date().getTime();
		var poll = function () {
			if (self.stopped) { return; }
			if (pred()) { self.check(name, true, (new Date().getTime() - t0) + "ms"); cb(true); return; }
			if (new Date().getTime() - t0 > timeoutMs) {
				var s = self.engine.snapshot();
				self.check(name, false, "timeout " + timeoutMs + "ms phase=" + s.phase + " busy=" + s.busy + " t=" + s.currentTime.toFixed(1) + " err=" + s.error);
				cb(false); return;
			}
			self.later(poll, 100);
		};
		poll();
	},

	later: function (fn, ms) {
		var self = this;
		var id = setTimeout(function () {
			var i = self.timers.indexOf(id);
			if (i >= 0) { self.timers.splice(i, 1); }
			if (!self.stopped) { fn(); }
		}, ms);
		this.timers.push(id);
	},

	chain: function (steps, cb) {
		var i = 0, self = this;
		var next = function () { if (i < steps.length) { steps[i++](next); } else { cb(); } };
		next();
	},

	done: function () {
		var pass = 0, fail = 0;
		for (var i = 0; i < this.results.length; i++) { if (this.results[i].ok) { pass++; } else { fail++; } }
		var st = this.engine.stats;
		this.log("SELFTEST " + (fail ? "FAIL" : "PASS") + " pass=" + pass + " fail=" + fail +
			" ops=" + st.ops + " seeks=" + st.seeks + " coalesced=" + st.seeksCoalesced + " maxSeekMs=" + st.maxSeekMs +
			" recoveries=" + st.recoveries + " rebuilds=" + st.rebuilds);
	}
};
