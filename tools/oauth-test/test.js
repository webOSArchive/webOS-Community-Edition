#!/usr/bin/env node
/*
 * Tests of com.palm.service.oauth's core (system/usr/palm/services/com.palm.service.oauth/
 * oauth-core.js), on the build machine: the same file the TouchPad runs.
 *
 *   node tools/oauth-test/test.js                  the rules, against a made-up broker and clock
 *   node tools/oauth-test/test.js http://host:8092 http://host:8091
 *                                                  and then a whole sign-in, refresh and revoke
 *                                                  through servers.sh's broker and provider
 */
const path = require("path");
const { execFile } = require("child_process");
const CEOAuthCore = require(path.join(__dirname, "../../system/usr/palm/services/com.palm.service.oauth/oauth-core.js"));

let failures = 0, checks = 0;
function check(ok, what) { checks++; if (!ok) { failures++; console.log("FAIL: " + what); } }
const call = (f, ...a) => new Promise((res) => f(...a, res));
const idToken = (claims) => "x." + Buffer.from(JSON.stringify(claims)).toString("base64url") + ".";

const CONFIG = {
	broker: "https://broker.test/",
	providers: {
		google: { title: "Google", templateId: "t.google", brokerApp: "google", requiredScope: "https://mail.google.com/",
			mail: { server: "imap.gmail.com", port: 993, encryption: "ssl", smtpConfig: { server: "smtp.gmail.com", port: 465, encryption: "ssl", useSmtpAuth: true } } },
		microsoft: { title: "Microsoft", templateId: "t.microsoft", brokerApp: "microsoft", mail: { server: "outlook.office365.com" } },
		microsoft365: { title: "Microsoft Outlook", templateId: "t.m365", brokerApp: "microsoft365", validator: "palm://com.palm.eas/validateAccount", mail: { server: "https://outlook.office365.com" } },
		unlisted: { title: "No broker app" },
		// The provider's own device-code flow (Microsoft on CE).
		exchange: { title: "Microsoft Outlook", templateId: "t.exchange", validator: "palm://com.palm.eas/validateAccount", fallback: "outlook",
			device: { clientId: "client-1", deviceUrl: "https://ms.test/devicecode", tokenUrl: "https://ms.test/token", scope: "EAS offline_access openid email" },
			mail: { server: "https://outlook.office365.com" } },
		outlook: { title: "Microsoft", templateId: "t.outlook",
			device: { clientId: "client-1", deviceUrl: "https://ms.test/devicecode", tokenUrl: "https://ms.test/token", scope: "IMAP SMTP offline_access openid email" },
			mail: { server: "outlook.office365.com", smtpConfig: { server: "smtp.office365.com" } } }
	}
};

/* A core over a made-up broker: `answers` maps "METHOD url-substring" to what http gives. */
function world(store) {
	const w = { now: 1e12, saved: store || null, requests: [], answers: {}, n: 0, logs: [] };
	w.core = CEOAuthCore({
		http(method, url, body, cb) {
			w.requests.push({ method, url, body });
			const key = Object.keys(w.answers).find((k) => (method + " " + url).includes(k));
			const a = key ? w.answers[key] : { err: "no route" };
			const give = typeof a === "function" ? a(url, body) : a;
			setImmediate(() => cb(give.err || null, give.json, give.status || 200));
		},
		load: () => (w.saved ? JSON.parse(JSON.stringify(w.saved)) : null),
		save: (a) => { w.saved = JSON.parse(JSON.stringify(a)); },
		now: () => w.now,
		randomHex: (n) => String(++w.n).padStart(n * 2, "0"),
		log: (t) => w.logs.push(t),
		decode64: (t) => Buffer.from(t, "base64").toString("utf8"),
		config: CONFIG
	});
	return w;
}
const tokens = (email, more) => Object.assign({ status: "ready", access_token: "at-1", refresh_token: "rt-1", expires_in: 3600,
	id_token: idToken({ email }), scope: "https://mail.google.com/ openid email" }, more);

async function rules() {
	let w = world(), r;

	// Providers and the code.
	r = w.core.listProviders();
	check(r.returnValue && r.providers.length === 5 && !r.providers.some((p) => p.id === "unlisted"), "listProviders: those with a broker app or a device-code flow");
	r = await call(w.core.start, "nobody");
	check(!r.returnValue && r.errorCode === -2, "start: an unknown provider is refused");
	w.answers["GET https://broker.test/get-code.php?app=google"] = { json: { code: "BKF7Q", useUrl: "https://broker.test/google", pollSeconds: 3 } };
	r = await call(w.core.start, "google");
	check(r.returnValue && r.code === "BKF7Q" && r.url === "https://broker.test/google" && r.pollSeconds === 3, "start: the broker's code and address");
	check(!w.requests[0].url.includes("//get-code"), "the broker's trailing slash doesn't double");
	w.answers["GET https://broker.test/get-code.php?app=microsoft"] = { err: "curl 6" };
	r = await call(w.core.start, "microsoft");
	check(!r.returnValue && r.errorCode === -9, "start: an unreachable broker is an error");

	// Waiting, then done.
	w.answers["check-code.php?app=google&code=BKF7Q"] = { json: { status: "pending" } };
	r = await call(w.core.check, "google", "bkf-7q".toUpperCase(), null);
	check(r.returnValue && r.step === "pending" && !r.unreachable, "check: pending (and a code typed with a dash)");
	w.answers["check-code.php?app=google&code=BKF7Q"] = { err: "curl 28" };
	r = await call(w.core.check, "google", "BKF7Q", null);
	check(r.returnValue && r.step === "pending" && r.unreachable, "check: an unreachable broker is still pending");
	w.answers["check-code.php?app=google&code=BKF7Q"] = { json: { error: "Activation code not found or expired." }, status: 404 };
	r = await call(w.core.check, "google", "BKF7Q", null);
	check(!r.returnValue && r.errorCode === -10, "check: a code that ran out");
	w.answers["check-code.php?app=google&code=BKF7Q"] = { json: tokens("Someone@Gmail.com") };
	r = await call(w.core.check, "google", "BKF7Q", null);
	const handle = r.handle;
	check(r.returnValue && r.step === "done" && /^oauth2:[0-9a-f]{32}$/.test(handle) && !r.existing, "check: done, with a handle");
	check(r.email === "Someone@Gmail.com" && r.templateId === "t.google" && r.validator === "palm://com.palm.imap/validateAccount", "done: the address, account type and IMAP's validator");
	check(r.config.server === "imap.gmail.com" && r.config.username === "Someone@Gmail.com" && r.config.smtpConfig.username === "Someone@Gmail.com"
		&& CONFIG.providers.google.mail.username === undefined, "done: the mail settings carry the address (the provider's own aren't changed)");
	check(w.saved[handle].access === "at-1" && w.saved[handle].refresh === "rt-1" && w.saved[handle].expires === w.now + 3600e3, "done: the tokens are stored");

	// The token: as it is, then refreshed.
	r = await call(w.core.token, handle, false);
	check(r.returnValue && r.accessToken === "at-1" && r.fresh === true && r.expiresIn === 3600, "token: just issued is fresh, with an hour left");
	w.now += 61e3;
	r = await call(w.core.token, handle, false);
	check(r.accessToken === "at-1" && r.fresh === false, "token: a minute on, not fresh");
	r = await call(w.core.token, "oauth2:" + "f".repeat(32), false);
	check(!r.returnValue && r.errorCode === -11, "token: an unknown handle is -11");
	r = await call(w.core.token, "constructor", false);
	check(!r.returnValue && r.errorCode === -11, "token: an object's own names aren't handles");
	let before = w.requests.length;
	w.answers["POST https://broker.test/refresh.php?app=google"] = (url, body) => ({ json: { status: "ready", access_token: "at-2", refresh_token: "rt-2", expires_in: 3600 }, body });
	w.now += 3600e3 - 61e3 - 4 * 60e3;     // four minutes left
	const both = await Promise.all([call(w.core.token, handle, false), call(w.core.token, handle, false)]);
	check(both[0].accessToken === "at-2" && both[1].accessToken === "at-2" && both[0].fresh, "token: under five minutes left is refreshed");
	check(w.requests.length === before + 1 && w.requests[before].body === "refresh_token=rt-1", "two logins at once make one refresh, the token in the body");
	check(w.saved[handle].refresh === "rt-2", "the provider's new refresh token is kept");

	// The server refused the token (stale): refreshed, unless brand new.
	before = w.requests.length;
	r = await call(w.core.token, handle, true);
	check(r.accessToken === "at-2" && w.requests.length === before, "stale, but under a minute old: the same token, no refresh");
	w.now += 10 * 60e3;
	w.answers["POST https://broker.test/refresh.php?app=google"] = { json: { status: "ready", access_token: "at-3", expires_in: 3600 } };
	r = await call(w.core.token, handle, true);
	check(r.accessToken === "at-3" && w.saved[handle].refresh === "rt-2", "stale: refreshed; no new refresh token keeps the old one");

	// The broker can't be reached: the old token while it lasts, then -12; a stale one is -12 at once.
	w.answers["POST https://broker.test/refresh.php?app=google"] = { err: "curl 7" };
	w.now += 3600e3 - 2 * 60e3;
	r = await call(w.core.token, handle, false);
	check(r.returnValue && r.accessToken === "at-3", "refresh unreachable, two minutes left: the old token");
	r = await call(w.core.token, handle, true);
	check(!r.returnValue && r.errorCode === -12, "refresh unreachable and the token refused: -12");
	w.answers["POST https://broker.test/refresh.php?app=google"] = { json: { error: "Temporary failure refreshing token. Try again later." }, status: 503 };
	w.now += 5 * 60e3;
	r = await call(w.core.token, handle, false);
	check(!r.returnValue && r.errorCode === -12, "the broker's own 503, token expired: -12");
	check(w.saved[handle].refresh === "rt-2", "a failed refresh keeps the sign-in");

	// The provider ended the sign-in.
	w.answers["POST https://broker.test/refresh.php?app=google"] = { json: { status: "invalid_grant" } };
	r = await call(w.core.token, handle, false);
	check(r.returnValue && r.accessToken === "" && r.fresh === false && r.expiresIn === 0, "a refused refresh: an empty token (Email asks for a new sign-in)");
	before = w.requests.length;
	r = await call(w.core.token, handle, false);
	check(r.accessToken === "" && w.requests.length === before, "and it stays empty without asking again");

	// Signing the same account in again keeps the handle.
	w.answers["check-code.php?app=google&code=AGAIN"] = { json: tokens("someone@gmail.com", { access_token: "at-9", refresh_token: "rt-9" }) };
	r = await call(w.core.check, "google", "AGAIN", null);
	check(r.step === "done" && r.handle === handle && r.existing === true, "the same account again: the same handle, marked existing");
	r = await call(w.core.token, handle, false);
	check(r.accessToken === "at-9" && r.fresh, "and its token works again");

	// A stored alias (an older handle of the same account) reaches the one record.
	w = world({ "oauth2:old": { provider: "google", email: "a@b.c", same: "oauth2:new" },
		"oauth2:new": { provider: "google", email: "a@b.c", access: "at", got: 1e12, expires: 1e12 + 3600e3, refresh: "rt", broker: true } });
	r = await call(w.core.token, "oauth2:old", false);
	check(r.accessToken === "at", "an older handle of the account gives the same token");
	w.answers["check-code.php"] = { json: tokens("A@B.C", { access_token: "at-n" }) };
	r = await call(w.core.check, "google", "X1", null);
	check(r.handle === "oauth2:new" && w.saved["oauth2:old"].same === "oauth2:new", "signing in again goes to the record, not the alias");

	// The broker fell back to another app (a personal Microsoft account).
	w = world();
	w.answers["check-code.php?app=microsoft365"] = { json: tokens("me@outlook.com", { broker_app: "microsoft", scope: "" }) };
	r = await call(w.core.check, "microsoft365", "FALL1", null);
	check(r.step === "done" && r.provider === "microsoft" && r.templateId === "t.microsoft" && r.validator === "palm://com.palm.imap/validateAccount"
		&& r.config.server === "outlook.office365.com", "broker_app: the account is the fallback provider's kind");
	w.now += 3600e3;
	w.answers["POST https://broker.test/refresh.php?app=microsoft"] = { json: { status: "ready", access_token: "at-m", expires_in: 3600 } };
	r = await call(w.core.token, r.handle, false);
	check(r.accessToken === "at-m" && w.requests[w.requests.length - 1].url.endsWith("refresh.php?app=microsoft"), "and refreshes through that app");
	w.answers["check-code.php?app=microsoft365"] = { json: tokens("me@outlook.com", { broker_app: "elsewhere" }) };
	r = await call(w.core.check, "microsoft365", "FALL2", null);
	check(!r.returnValue && r.errorCode === -10, "broker_app this device doesn't know is refused");
	w.answers["check-code.php?app=microsoft365"] = { json: tokens("w@work.example", { scope: "" }) };
	r = await call(w.core.check, "microsoft365", "WORK1", null);
	check(r.provider === "microsoft365" && r.validator === "palm://com.palm.eas/validateAccount", "no broker_app: Exchange, with its validator");

	// Refusals at the end of a sign-in.
	w.answers["check-code.php?app=microsoft365"] = { json: { status: "error", error: "access_denied", error_description: "AADSTS65004: User declined to consent." } };
	r = await call(w.core.check, "microsoft365", "NOPE1", null);
	check(!r.returnValue && r.aadsts === 65004 && r.providerError === "access_denied", "a refusal carries the provider's error and Microsoft's number");
	w.answers["check-code.php?app=google"] = { json: tokens("x@gmail.com", { scope: "openid email" }) };
	r = await call(w.core.check, "google", "NOSCOPE", null);
	check(!r.returnValue && r.errorCode === -8 && /tick the box/.test(r.errorText), "Google without the mail permission is refused");
	w.answers["check-code.php?app=google"] = { json: tokens("x@gmail.com", { id_token: "" }) };
	r = await call(w.core.check, "google", "NOID", null);
	check(!r.returnValue && r.errorCode === -8, "no id_token: refused (which account is unknown)");
	w.answers["check-code.php?app=google"] = { json: tokens("x", { id_token: idToken({ preferred_username: "upn@work.example" }) }) };
	r = await call(w.core.check, "google", "UPN", null);
	check(r.email === "upn@work.example", "the address from preferred_username");

	// ---- the provider's own device-code flow ----
	w = world();
	const form = (b) => Object.fromEntries(new URLSearchParams(b));
	w.answers["POST https://ms.test/devicecode"] = (url, body) => ({ json: form(body).scope.startsWith("EAS")
		? { user_code: "ABCD1234", device_code: "dev-eas", verification_uri: "https://login.microsoft.com/device", interval: 5, expires_in: 900 }
		: { user_code: "WXYZ9876", device_code: "dev-imap", verification_uri: "https://login.microsoft.com/device", interval: 5, expires_in: 900 } });
	r = await call(w.core.start, "exchange");
	check(r.returnValue && r.code === "ABCD1234" && r.url === "https://login.microsoft.com/device" && r.state === "dev-eas" && r.pollSeconds === 5, "device: the provider's code, address and state");
	check(form(w.requests[0].body).client_id === "client-1" && !/secret/.test(w.requests[0].body), "device: asked as the public client, with no secret");
	r = await call(w.core.check, "exchange", "ABCD1234", "");
	check(!r.returnValue && r.errorCode === -6, "device: check without the state is refused");
	w.answers["POST https://ms.test/token"] = { json: { error: "authorization_pending" }, status: 400 };
	r = await call(w.core.check, "exchange", "ABCD1234", "dev-eas");
	check(r.returnValue && r.step === "pending" && !r.slower, "device: pending until the person signs in");
	const sent = form(w.requests[w.requests.length - 1].body);
	check(sent.grant_type === "urn:ietf:params:oauth:grant-type:device_code" && sent.device_code === "dev-eas" && sent.client_id === "client-1", "device: polled with the device code");
	w.answers["POST https://ms.test/token"] = { json: { error: "slow_down" }, status: 400 };
	r = await call(w.core.check, "exchange", "ABCD1234", "dev-eas");
	check(r.step === "pending" && r.slower === true, "device: slow_down is still pending");
	w.answers["POST https://ms.test/token"] = { err: "curl 28" };
	r = await call(w.core.check, "exchange", "ABCD1234", "dev-eas");
	check(r.step === "pending" && r.unreachable, "device: an unreachable provider is still pending");
	w.answers["POST https://ms.test/token"] = { json: tokens("w@work.example", { access_token: "ms-at-1", refresh_token: "ms-rt-1", scope: "EAS" }) };
	r = await call(w.core.check, "exchange", "ABCD1234", "dev-eas");
	const msHandle = r.handle;
	check(r.step === "done" && r.provider === "exchange" && r.email === "w@work.example" && r.validator === "palm://com.palm.eas/validateAccount"
		&& w.saved[msHandle].broker === false, "device: done, an Exchange account, kept as signed in directly");
	w.now += 3600e3;
	w.answers["POST https://ms.test/token"] = (url, body) => ({ json: form(body).grant_type === "refresh_token"
		? { access_token: "ms-at-2", refresh_token: "ms-rt-2", expires_in: 3600 } : { error: "unexpected" } });
	r = await call(w.core.token, msHandle, false);
	const refreshBody = form(w.requests[w.requests.length - 1].body);
	check(r.accessToken === "ms-at-2" && w.requests[w.requests.length - 1].url === "https://ms.test/token" && refreshBody.refresh_token === "ms-rt-1"
		&& refreshBody.client_id === "client-1" && refreshBody.scope === "EAS offline_access openid email", "device: refreshed with the provider itself, saying the scope");
	check(w.saved[msHandle].refresh === "ms-rt-2", "device: Microsoft's new refresh token is kept");
	w.now += 3600e3;
	w.answers["POST https://ms.test/token"] = { json: { error: "invalid_grant", error_description: "AADSTS700082: The refresh token has expired due to inactivity." }, status: 400 };
	r = await call(w.core.token, msHandle, false);
	check(r.returnValue && r.accessToken === "", "device: a refused refresh ends the sign-in");

	// A personal account: Exchange's scope refused, so the mail-only provider's code follows.
	w.answers["POST https://ms.test/token"] = { json: { error: "invalid_scope", error_description: "AADSTS70011: The provided value for the input parameter 'scope' is not valid." }, status: 400 };
	r = await call(w.core.check, "exchange", "ABCD1234", "dev-eas");
	check(r.returnValue && r.step === "again" && r.provider === "outlook" && r.code === "WXYZ9876" && r.state === "dev-imap", "device: a refused scope starts the fallback provider's sign-in");
	w.answers["POST https://ms.test/token"] = { json: tokens("me@outlook.com", { access_token: "ms-at-p", refresh_token: "ms-rt-p" }) };
	r = await call(w.core.check, "outlook", "WXYZ9876", "dev-imap");
	check(r.step === "done" && r.provider === "outlook" && r.templateId === "t.outlook" && r.validator === "palm://com.palm.imap/validateAccount"
		&& r.config.smtpConfig.username === "me@outlook.com", "device: the fallback signs in as a mail-only account");
	w.answers["POST https://ms.test/token"] = { json: { error: "invalid_scope" }, status: 400 };
	r = await call(w.core.check, "outlook", "WXYZ9876", "dev-imap");
	check(!r.returnValue && r.errorCode === -8, "device: the fallback has no fallback of its own");

	// How it ends otherwise.
	w.answers["POST https://ms.test/token"] = { json: { error: "expired_token" }, status: 400 };
	r = await call(w.core.check, "exchange", "X", "dev-eas");
	check(!r.returnValue && r.errorCode === -10, "device: the code ran out");
	w.answers["POST https://ms.test/token"] = { json: { error: "authorization_declined" }, status: 400 };
	r = await call(w.core.check, "exchange", "X", "dev-eas");
	check(!r.returnValue && r.errorCode === -8 && /declined/.test(r.errorText), "device: declined by the person");
	w.answers["POST https://ms.test/token"] = { json: { error: "invalid_client", error_description: "AADSTS7000218: The request body must contain the following parameter: 'client_assertion' or 'client_secret'." }, status: 401 };
	r = await call(w.core.check, "exchange", "X", "dev-eas");
	check(!r.returnValue && r.aadsts === 7000218 && r.providerError === "invalid_client", "device: a registration that isn't a public client says so (Microsoft's number kept)");
	w.answers["POST https://ms.test/devicecode"] = { json: { error: "unauthorized_client", error_description: "AADSTS700016: no such application" }, status: 400 };
	r = await call(w.core.start, "exchange");
	check(!r.returnValue && r.errorCode === -9 && r.aadsts === 700016, "device: a refused code request is an error");

	// Removed accounts' tokens go, a day after the sign-in.
	w = world({
		"oauth2:kept": { provider: "google", email: "Kept@gmail.com", access: "a", got: 1e12 - 5 * 86400e3, expires: 0, refresh: "r", broker: true },
		"oauth2:gone": { provider: "google", email: "gone@gmail.com", access: "a", got: 1e12 - 5 * 86400e3, expires: 0, refresh: "r", broker: true },
		"oauth2:alias": { provider: "google", email: "gone@gmail.com", same: "oauth2:gone" },
		"oauth2:new": { provider: "microsoft", email: "new@outlook.com", access: "a", got: 1e12 - 3600e3, expires: 0, refresh: "r", broker: true }
	});
	const gone = w.core.prune([{ templateId: "t.google", username: "kept@gmail.com" }, { templateId: "com.palm.eas", username: "gone@gmail.com" }]);
	check(gone === 2 && w.saved["oauth2:kept"] && w.saved["oauth2:new"] && !w.saved["oauth2:gone"] && !w.saved["oauth2:alias"], "prune: a removed account's tokens go; a kept one's and a new sign-in's stay");
	r = w.core.forget("oauth2:kept");
	check(r.returnValue && !w.saved["oauth2:kept"], "forget drops a handle");
}

/* A whole sign-in through servers.sh's broker and provider, the browser's part played here. */
async function live(broker, provider) {
	const http = (method, url, body, cb) => {
		const args = ["-sS", "-m", "25", "-H", "Accept: application/json", "-w", "\n%{http_code}"];
		if (body !== null) { args.push("-H", "Content-Type: application/x-www-form-urlencoded", "--data-binary", body); }
		args.push(url);
		execFile("curl", args, (err, out) => {
			if (err) { return cb(String(err.message).slice(0, 120)); }
			const cut = out.lastIndexOf("\n");
			try { cb(null, JSON.parse(out.slice(0, cut)), parseInt(out.slice(cut + 1), 10)); } catch (e) { cb("HTTP " + out.slice(cut + 1)); }
		});
	};
	let saved = null, now = 0;
	const core = CEOAuthCore({ http, load: () => saved, save: (a) => { saved = JSON.parse(JSON.stringify(a)); }, now: () => Date.now() + now,
		randomHex: (n) => require("crypto").randomBytes(n).toString("hex"), log: () => {}, decode64: (t) => Buffer.from(t, "base64").toString("utf8"),
		config: { broker, providers: { google: { title: "Google (test)", templateId: "org.webosarchive.ce.google", brokerApp: "fake", mail: { server: "x" } } } } });

	/* The person, on another device: enters the code at the broker, allows (or denies) at the provider. */
	async function person(code, allow) {
		let r = await fetch(broker + "/start.php?app=fake", { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "code=" + code });
		const authorize = r.headers.get("location") || "";
		const cookie = (r.headers.getSetCookie() || []).map((c) => c.split(";")[0]).join("; ");   // the broker keeps its CSRF nonce in the browser's session
		if (!authorize.startsWith(provider + "/authorize")) { throw new Error("broker didn't send the browser to the provider: " + r.status + " " + authorize); }
		const q = new URL(authorize).searchParams;
		q.set("allow", allow ? "1" : "0");
		r = await fetch(provider + "/approve", { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: q.toString() });
		const back = r.headers.get("location") || "";
		if (!back.startsWith(broker + "/callback.php")) { throw new Error("provider didn't send the browser back to the broker: " + back); }
		return (await fetch(back, { headers: { Cookie: cookie } })).status;
	}

	let r = await call(core.start, "google");
	check(r.returnValue && /^[A-Z0-9]{4,8}$/.test(r.code) && r.url === broker + "/fake", "live: the broker gives a code and its address");
	const code = r.code;
	r = await call(core.check, "google", code, null);
	check(r.step === "pending", "live: pending before the person signs in");
	await person(code, true);
	r = await call(core.check, "google", code, null);
	check(r.step === "done" && r.email === "dummy@lunacy.test" && /^oauth2:[0-9a-f]{32}$/.test(r.handle), "live: done after it, as dummy@lunacy.test");
	const handle = r.handle;
	const second = await call(core.check, "google", code, null);
	check(!second.returnValue && second.errorCode === -10, "live: the broker hands the tokens over once only");
	r = await call(core.token, handle, false);
	const first = r.accessToken;
	check(r.returnValue && /^fake-at-/.test(first) && r.fresh, "live: the provider's access token");

	now = 3600e3;     // an hour on: expired here
	r = await call(core.token, handle, false);
	check(r.returnValue && /^fake-at-/.test(r.accessToken) && r.accessToken !== first && r.fresh, "live: expired, refreshed through the broker");
	const refreshedOnce = r.accessToken;

	now = 3600e3 + 120e3;   // the server refused it (stale), two minutes after it was had
	r = await call(core.token, handle, true);
	check(r.returnValue && r.accessToken !== refreshedOnce, "live: a refused token is refreshed again");

	await fetch(provider + "/admin/revoke");
	now = 3 * 3600e3;
	r = await call(core.token, handle, false);
	check(r.returnValue && r.accessToken === "", "live: a revoked sign-in gives an empty token");

	// Signing in again brings the same handle back.
	r = await call(core.start, "google");
	await person(r.code, true);
	r = await call(core.check, "google", r.code, null);
	check(r.step === "done" && r.handle === handle && r.existing, "live: signing in again keeps the handle");
	r = await call(core.token, handle, false);
	check(/^fake-at-/.test(r.accessToken), "live: and its token works");

	// Deny at the provider: the broker tells the person, and leaves the code for another try.
	r = await call(core.start, "google");
	const denied = r.code;
	await person(denied, false);
	r = await call(core.check, "google", denied, null);
	check(r.returnValue && r.step === "pending", "live: Deny at the provider leaves the code pending");
	await person(denied, true);
	r = await call(core.check, "google", denied, null);
	check(r.step === "done" && r.handle === handle, "live: and Allow, with the same code, finishes it");

	// The broker gone.
	const dead = CEOAuthCore({ http, load: () => saved, save: () => {}, now: () => Date.now() + 10 * 3600e3, randomHex: () => "", log: () => {},
		decode64: (t) => Buffer.from(t, "base64").toString("utf8"), config: { broker: "http://127.0.0.1:1", providers: { google: { brokerApp: "fake" } } } });
	r = await call(dead.token, handle, false);
	check(!r.returnValue && r.errorCode === -12, "live: no broker and an expired token is -12");
}

(async () => {
	await rules();
	if (process.argv[2]) { await live(process.argv[2].replace(/\/+$/, ""), (process.argv[3] || "").replace(/\/+$/, "")); }
	console.log(failures ? "oauth test: " + failures + " of " + checks + " failed" : "oauth test: ok (" + checks + " checks" + (process.argv[2] ? ", live" : "") + ")");
	process.exit(failures ? 1 : 0);
})().catch((e) => { console.log("oauth test: " + e.stack); process.exit(1); });
