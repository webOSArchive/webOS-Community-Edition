/*
 * webOS CE: OAuth 2 sign-in for mail accounts, the part that has no webOS in it
 * (Docs/EMAIL-MODERNIZATION-PLAN.md, phase 2). service.js puts it on the bus.
 *
 * Google and Microsoft no longer take a password from a mail client; Palm's mail services
 * know nothing else. An account signed in here is given, as its password, a handle
 * ("oauth2:" and 32 hex digits) that names its tokens in this service. libce-mailshim.so
 * (packages/mailshim) asks token() for the access token at each login and sends that instead.
 *
 * The logic is Lunacy's card/OAuth.kt. The TouchPad's browser can't show a provider's page, so
 * the person always signs in on another device with a short code. Two ways, by provider:
 * - through the broker (webOSArchive's oauth-broker-for-webos; a provider with `brokerApp`):
 *   the broker gives the code, holds the client secret, hands over the tokens and refreshes
 *   them. Google: its own code flow doesn't allow the mail scope.
 * - the provider's own device-code flow (RFC 8628; a provider with `device`): the provider
 *   gives the code, and this service redeems and refreshes with it directly, as a public client
 *   with no secret. Microsoft: the same app registration Lunacy signs in with on the device.
 *
 * Kept free of the service framework and of Node's newer APIs, so tools/oauth-test runs
 * this same file on the build machine. env:
 *   http(method, url, body, cb(err, json, status))   body: a form string, or null
 *   load() -> the stored accounts object, save(accounts)
 *   now() -> ms, randomHex(bytes) -> string, log(text)
 *   decode64(text) -> string
 *   config: { broker, providers: { id: {...} } }   (providers.json)
 *
 * Every answer is a plain object with returnValue, as it goes on the bus.
 */
function CEOAuthCore(env) {
	var HANDLE = "oauth2:";
	var providers = env.config.providers || {};
	var broker = String(env.config.broker || "https://oauth.wosa.link").replace(/\/+$/, "");
	var accounts = env.load() || {};
	var refreshing = {};   // handle -> callbacks waiting for one refresh

	// An account signed in with a provider's own code belongs to the client id it signed in
	// with: its refresh token works with no other. The id is kept with the account (`client`),
	// so that a later image with another app registration in providers.json signs new accounts
	// in with the new one and leaves these working. An account from before the id was kept
	// signed in with the id of the time, which is the one in providers.json when this first
	// runs over it.
	(function () {
		var h, a, p, changed = false;
		for (h in accounts) {
			a = accounts.hasOwnProperty(h) ? accounts[h] : null;
			p = a && providers[a.provider];
			if (a && !a.same && !a.broker && !a.client && p && p.device) { a.client = p.device.clientId; changed = true; }
		}
		if (changed) { env.save(accounts); }
	}());

	function ok(more) {
		var r = { returnValue: true }, k;
		for (k in more) { if (more.hasOwnProperty(k)) { r[k] = more[k]; } }
		return r;
	}
	function error(text, code, more) {
		var r = { returnValue: false, errorCode: code, errorText: text }, k;
		for (k in more) { if (more && more.hasOwnProperty(k)) { r[k] = more[k]; } }
		return r;
	}
	function enc(s) { return encodeURIComponent(s); }
	function copy(o) { return JSON.parse(JSON.stringify(o)); }
	function save() { env.save(accounts); }

	/** The provider whose app at the broker is this one. */
	function byBrokerApp(app) {
		var id;
		for (id in providers) { if (providers.hasOwnProperty(id) && providers[id].brokerApp === app) { return id; } }
		return null;
	}

	/** The account's address, from the OpenID id_token the providers send with the tokens. */
	function emailOf(tokens) {
		var parts = String(tokens.id_token || "").split("."), claims, names = ["email", "preferred_username", "upn"], i;
		if (parts.length < 2) { return null; }
		try {
			var b = parts[1].replace(/-/g, "+").replace(/_/g, "/");
			while (b.length % 4) { b += "="; }
			claims = JSON.parse(env.decode64(b));
		} catch (e) { return null; }
		for (i = 0; i < names.length; i++) {
			if (typeof claims[names[i]] === "string" && claims[names[i]].indexOf("@") !== -1) { return claims[names[i]]; }
		}
		return null;
	}

	/** Microsoft's AADSTS number in a provider's words, which says why a sign-in was refused. */
	function aadsts(text) {
		var m = /AADSTS(\d+)/.exec(String(text || ""));
		return m ? parseInt(m[1], 10) : undefined;
	}

	// ---- signing in ----

	function listProviders() {
		var list = [], id;
		for (id in providers) {
			if (providers.hasOwnProperty(id) && (providers[id].brokerApp || providers[id].device)) {
				list.push({ id: id, title: providers[id].title || id, templateId: providers[id].templateId || "" });
			}
		}
		return ok({ providers: list });
	}

	/** The provider refused the scope for the account, not the sign-in (Microsoft, Exchange's scope for a personal account: AADSTS70011). */
	function scopeRefused(j) {
		return !!j && (j.error === "invalid_scope" || String(j.error_description || "").indexOf("AADSTS70011") !== -1);
	}

	/**
	 * Asks the provider itself for a code (device-code flow). `state` is the provider's device
	 * code, which check() needs back: the page keeps it, so this service keeps nothing between
	 * the two calls. more: fields added to the answer.
	 */
	function startDevice(providerId, more, cb) {
		var d = providers[providerId].device;
		env.http("POST", d.deviceUrl, "client_id=" + enc(d.clientId) + "&scope=" + enc(d.scope), function (err, j) {
			if (!j || !j.user_code || !j.device_code) {
				var why = err || (j && (j.error_description || j.error)) || "no code";
				return cb(error((providers[providerId].title || providerId) + " didn't give a sign-in code: " + why, -9,
					{ providerError: j && j.error, aadsts: aadsts(why) }));
			}
			var r = ok({ provider: providerId, code: String(j.user_code), url: j.verification_uri || j.verification_url || "",
				state: String(j.device_code), pollSeconds: Math.max(2, Math.min(30, parseInt(j.interval, 10) || 5)) }), k;
			for (k in more) { if (more.hasOwnProperty(k)) { r[k] = more[k]; } }
			cb(r);
		});
	}

	/**
	 * Asks the provider whether the code's sign-in has finished. A provider that refuses its
	 * scope for the account and names a `fallback` (Microsoft's Exchange sign-in, for a personal
	 * account) starts that provider's sign-in instead: {step: "again", provider, code, url,
	 * state}, a second code for the person to enter.
	 */
	function checkDevice(providerId, state, cb) {
		var p = providers[providerId], d = p.device;
		if (!state) { return cb(error("No sign-in is waiting for that", -6)); }
		env.http("POST", d.tokenUrl, "grant_type=" + enc("urn:ietf:params:oauth:grant-type:device_code") + "&client_id=" + enc(d.clientId) +
			"&device_code=" + enc(state), function (err, j, status) {
			if (err || !j) { return cb(ok({ step: "pending", unreachable: true })); }
			if (j.access_token) { return cb(done(providerId, j, false)); }
			if (j.error === "authorization_pending" || j.error === "slow_down") { return cb(ok({ step: "pending", slower: j.error === "slow_down" })); }
			if (scopeRefused(j) && p.fallback && providers[p.fallback] && providers[p.fallback].device) {
				env.log(providerId + " refused for this account; signing in to " + p.fallback + " instead");
				return startDevice(p.fallback, { step: "again" }, cb);
			}
			var why = j.error_description || j.error || "no token";
			var text = j.error === "expired_token" ? "The code ran out before sign-in finished"
				: (j.error === "authorization_declined" || j.error === "access_denied") ? "The sign-in was declined"
				: "Sign-in failed: " + why;
			cb(error(text, j.error === "expired_token" ? -10 : -8, { providerError: j.error, aadsts: aadsts(why), httpStatus: status }));
		});
	}

	/** Asks for a code: {provider, code, url, pollSeconds[, state]}. The person enters the code at url on another device. */
	function start(providerId, cb) {
		var p = providers[providerId];
		if (p && p.device) { return startDevice(providerId, {}, cb); }
		if (!p || !p.brokerApp) { return cb(error("Unknown provider", -2)); }
		env.http("GET", broker + "/get-code.php?app=" + enc(p.brokerApp), null, function (err, j) {
			var code = j && j.code;
			if (!code) { return cb(error("The sign-in helper didn't answer: " + (err || (j && j.error) || "no code"), -9)); }
			var wait = parseInt(j.pollSeconds, 10) || 3;
			cb(ok({ provider: providerId, code: String(code), url: j.useUrl || "", pollSeconds: Math.max(2, Math.min(30, wait)) }));
		});
	}

	/**
	 * Asks whether the code's sign-in has finished: {step: "pending"} while it hasn't (and
	 * while the broker or provider can't be reached), then once {step: "done", provider, handle,
	 * email, existing, config, validator, templateId}, or an error. state: what start() gave,
	 * for a provider that gave one. The tokens are handed over once only, so a "done" not acted
	 * on is a sign-in to start again.
	 */
	function check(providerId, code, state, cb) {
		var p = providers[providerId];
		if (p && p.device) { return checkDevice(providerId, String(state || ""), cb); }
		if (!p || !p.brokerApp) { return cb(error("Unknown provider", -2)); }
		code = String(code || "").replace(/[^A-Za-z0-9]/g, "");
		if (!code) { return cb(error("No code", -2)); }
		env.http("GET", broker + "/check-code.php?app=" + enc(p.brokerApp) + "&code=" + enc(code), null, function (err, j, status) {
			if (err || !j) { return cb(ok({ step: "pending", unreachable: true })); }
			if (j.status === "pending") { return cb(ok({ step: "pending" })); }
			if (!j.access_token) {
				var why = j.error_description || j.error || "the code ran out";
				return cb(error("The sign-in helper: " + why, -10, { providerError: j.error, aadsts: aadsts(why), httpStatus: status }));
			}
			// The broker signed the account in with another of its apps (Microsoft refused
			// Exchange's scope for a personal account): the account is that provider's kind,
			// and refreshes through that app.
			var id = providerId;
			if (j.broker_app && j.broker_app !== p.brokerApp) {
				id = byBrokerApp(j.broker_app);
				if (!id) { return cb(error("The sign-in helper used an app this device doesn't know: " + j.broker_app, -10)); }
				env.log(providerId + " refused for this account; signed in to " + id + " instead");
			}
			cb(done(id, j, true));
		});
	}

	/** Stores a new sign-in's tokens and says what the sign-in page needs to make the account. */
	function done(providerId, tokens, viaBroker) {
		var p = providers[providerId], email = emailOf(tokens), now = env.now();
		if (!email) { return error((p.title || providerId) + " didn't say which account this is", -8); }
		// Google lets the person untick a permission on its consent page; a token without the
		// mail scope would only fail later, at the mail server, as a bad login.
		var granted = String(tokens.scope || "");
		if (p.requiredScope && granted && (" " + granted + " ").indexOf(" " + p.requiredScope + " ") === -1) {
			return error((p.title || providerId) + " wasn't given access to your mail. Sign in again and tick the box that lets webOS Email read and send your email.", -8);
		}
		// Signing the same account in again keeps its handle, which is the account's password:
		// only the tokens behind it change. Every handle the account was given before points at
		// the one record, since a provider that hands out a new refresh token with each refresh
		// (Microsoft) would leave copies stale.
		var same = [], h, a;
		for (h in accounts) {
			a = accounts[h];
			if (accounts.hasOwnProperty(h) && a && a.provider === providerId && String(a.email || "").toLowerCase() === email.toLowerCase()) { same.push(h); }
		}
		var existing = null, i;
		for (i = 0; i < same.length; i++) { if (!accounts[same[i]].same) { existing = same[i]; break; } }
		if (!existing && same.length) { existing = same[0]; }
		var handle = existing || (HANDLE + env.randomHex(16));
		accounts[handle] = {
			provider: providerId, email: email, access: String(tokens.access_token), got: now,
			expires: now + (parseInt(tokens.expires_in, 10) || 3600) * 1000,
			refresh: String(tokens.refresh_token || ""), broker: !!viaBroker
		};
		if (!viaBroker && p.device) { accounts[handle].client = p.device.clientId; }   // whose refresh token it is
		for (i = 0; i < same.length; i++) {
			if (same[i] !== handle) { accounts[same[i]] = { provider: providerId, email: email, same: handle }; }
		}
		save();
		env.log("signed in to " + providerId + (viaBroker ? " through the broker" : " with its own code"));
		var config = p.mail ? copy(p.mail) : {};
		config.email = email;
		config.username = email;
		if (config.smtpConfig) { config.smtpConfig.username = email; }
		return ok({
			step: "done", provider: providerId, handle: handle, existing: !!existing, email: email, config: config,
			// Which mail service checks and keeps the account: IMAP, or Exchange ActiveSync.
			validator: p.validator || "palm://com.palm.imap/validateAccount",
			templateId: p.templateId || ""
		});
	}

	// ---- keeping signed in ----

	function given(a, token) {
		// expiresIn: the seconds the token has left, so the mail shim can keep it for a while.
		return ok({ accessToken: token, fresh: !!token && env.now() - a.got < 60 * 1000,
			expiresIn: token ? Math.max(0, Math.floor((a.expires - env.now()) / 1000)) : 0 });
	}

	/**
	 * The account's new access token to cb: "" when the provider refused the refresh (the
	 * sign-in is over); null when it couldn't be asked and the token held won't do (expired,
	 * or the one the server just refused: stale).
	 */
	function refreshed(handle, a, stale, cb) {
		if (!a.refresh) { return cb(""); }
		if (refreshing[handle]) { refreshing[handle].push(cb); return; }   // one refresh at a time: Microsoft's refresh token changes with each
		refreshing[handle] = [cb];
		function finish(v) {
			var waiting = refreshing[handle], i;
			delete refreshing[handle];
			for (i = 0; i < waiting.length; i++) { waiting[i](v); }
		}
		var p = providers[a.provider];
		var app = (p && p.brokerApp) || a.provider;
		var url = broker + "/refresh.php?app=" + enc(app), body = "refresh_token=" + enc(a.refresh);
		if (!a.broker) {
			// Signed in with the provider's own code: refreshed with the provider, no secret,
			// as the client the account signed in with (which may no longer be the provider's).
			if (!p || !p.device) { return finish(null); }
			url = p.device.tokenUrl;
			body = "grant_type=refresh_token&client_id=" + enc(a.client || p.device.clientId) + "&refresh_token=" + enc(a.refresh) + "&scope=" + enc(p.device.scope);
		}
		env.http("POST", url, body, function (err, t) {
			if (t && t.access_token) {
				a.access = String(t.access_token);
				a.got = env.now();
				a.expires = a.got + (parseInt(t.expires_in, 10) || 3600) * 1000;
				if (t.refresh_token) { a.refresh = String(t.refresh_token); }
				save();
				env.log("refreshed a " + a.provider + " token");
				return finish(a.access);
			}
			// Refused (a revoked or expired refresh token) is the end of this sign-in. A
			// failure to ask isn't: the old token while it lasts, and otherwise none just now,
			// which the mail service takes as a connection failure and tries again.
			// unauthorized_client and invalid_client: the app registration the account signed in
			// with is gone or was changed (Microsoft's AADSTS700016); no later try will work.
			if (t && (t.status === "invalid_grant" || t.error === "invalid_grant" || t.error === "unauthorized_client" || t.error === "invalid_client")) {
				env.log(a.provider + " refused the refresh (" + (t.error || t.status) + "); the account needs signing in again: " + String(t.error_description || "").slice(0, 300));
				a.refresh = ""; a.access = "";
				save();
				return finish("");
			}
			env.log("couldn't refresh a " + a.provider + " token: " + (err || JSON.stringify(t)));
			finish(!stale && a.access && a.expires - env.now() > 30 * 1000 ? a.access : null);
		});
	}

	/**
	 * The access token for a mail service's login: {accessToken, fresh, expiresIn}. Refreshed first when
	 * it has under five minutes left, or when stale says the server refused the one last given
	 * (unless that one is under a minute old). `fresh`: issued within the minute, so a refusal
	 * of it is the server's last word. accessToken "" when the sign-in no longer works: the
	 * login then fails as a wrong password, and Email asks for the account to be signed in
	 * again. Error -11 for a handle this service doesn't have, -12 when no working token can
	 * be had just now. libce-mailshim.so's ma_token reads exactly these.
	 */
	function token(handle, stale, cb) {
		var held = accounts[handle] && accounts[handle].same ? accounts[handle].same : handle;
		var a = accounts.hasOwnProperty(held) ? accounts[held] : null;
		if (!a || a.same) { return cb(error("Unknown handle", -11)); }
		stale = !!stale && env.now() - (a.got || 0) > 60 * 1000;
		if (!stale && a.expires - env.now() > 5 * 60 * 1000) { return cb(given(a, a.access)); }
		refreshed(held, a, stale, function (t) {
			cb(t === null ? error("Couldn't refresh the sign-in just now", -12) : given(a, t));
		});
	}

	function forget(handle) {
		if (accounts.hasOwnProperty(handle)) { delete accounts[handle]; save(); }
		return ok({});
	}

	/**
	 * Drops the tokens of accounts that are gone (Remove Account). kept: the accounts there
	 * are, as [{templateId, username}]. A sign-in under a day old stays, since its account may
	 * still be being made. Answers how many went.
	 */
	function prune(kept) {
		var have = {}, i, id, h, a, gone = 0, old = env.now() - 24 * 3600 * 1000;
		var byTemplate = {};
		for (id in providers) { if (providers.hasOwnProperty(id) && providers[id].templateId) { byTemplate[providers[id].templateId] = id; } }
		for (i = 0; i < kept.length; i++) {
			id = byTemplate[kept[i].templateId];
			if (id) { have[id + " " + String(kept[i].username || "").toLowerCase()] = true; }
		}
		for (h in accounts) {
			if (!accounts.hasOwnProperty(h)) { continue; }
			a = accounts[h];
			var record = a && a.same ? accounts[a.same] : a;
			if (!record || (!have[a.provider + " " + String(a.email || "").toLowerCase()] && (record.got || 0) < old)) { delete accounts[h]; gone++; }
		}
		if (gone) { save(); env.log("forgot the tokens of " + gone + " removed account(s)"); }
		return gone;
	}

	return { listProviders: listProviders, start: start, check: check, token: token, forget: forget, prune: prune,
		providerOf: function (id) { return providers[id] || null; } };
}

if (typeof module !== "undefined" && module.exports) { module.exports = CEOAuthCore; }
