/*global IMPORTS, CEOAuthCore, Buffer */
/*
 * webOS CE: palm://com.palm.service.oauth, OAuth 2 sign-in for mail accounts
 * (Docs/EMAIL-MODERNIZATION-PLAN.md, phase 2). oauth-core.js has the logic and the reasons;
 * this file gives it the device: /usr/bin/curl for HTTPS (this Node's TLS stops at 1.0), a
 * file for the tokens, and the bus.
 *
 *   listProviders {}                    -> {providers: [{id, title, templateId}]}
 *   start  {provider}                   -> {code, url, pollSeconds[, state]}: show code and url; the
 *                                          person signs in at url, on another device, with the code
 *   check  {provider, code[, state]}    -> {step: "pending"} until then; once, {step: "done",
 *                                          handle, email, config, validator, templateId, ...};
 *                                          {step: "again", provider, code, url, state}: another
 *                                          code to enter, for the provider named; or
 *                                          {step: "failed", errorCode, errorText, aadsts}
 *   forget {handle}
 *   token  {handle, stale}              -> {accessToken, fresh}; errorCode -11, -12
 *
 * token is on the private bus only: libce-mailshim.so calls it from inside the mail services,
 * and a handle is the key to it. The others are for the pages that add a mail account.
 */
var Foundations = IMPORTS.foundations;
var PalmCall = Foundations.Comms.PalmCall;
var fs = IMPORTS.require("fs");
var spawn = IMPORTS.require("child_process").spawn;

var SERVICE_DIR = "/usr/palm/services/com.palm.service.oauth";
var DATA_DIR = "/var/palm/data/com.palm.service.oauth";
var STORE = DATA_DIR + "/accounts.json";
/* A root-owned file that replaces providers.json, for test servers (tools/oauth-test). */
var TEST_PROVIDERS = DATA_DIR + "/providers.json";
/* The apps whose pages sign mail accounts in: CE's sign-in page, and the two it runs inside. */
var PAGES = { "com.palm.app.signin": 1, "com.palm.app.email": 1, "com.palm.app.accounts": 1 };

function log(text) { console.error("ce.oauth: " + text); }

function readJson(path) {
	try { return JSON.parse(fs.readFileSync(path, "utf8")); } catch (e) { return null; }
}

/* The JSON a token endpoint or the broker answers, error statuses included (they carry `error`). */
function http(method, url, body, cb) {
	var args = ["-sS", "-m", "25", "--connect-timeout", "15", "-H", "Accept: application/json", "-w", "\n%{http_code}"];
	if (body !== null) { args.push("-H", "Content-Type: application/x-www-form-urlencoded", "--data-binary", "@-"); }
	args.push(url);
	var out = "", errText = "", code = null, open = 2, child;
	function finish() {
		if (--open > 0) { return; }
		var host = (/^https?:\/\/([^\/:]+)/.exec(url) || [])[1] || url;
		if (code !== 0) { return cb("curl " + code + " for " + host + ": " + errText.replace(/\s+$/, "").slice(0, 200)); }
		var cut = out.lastIndexOf("\n"), status = parseInt(out.slice(cut + 1), 10) || 0, json;
		try { json = JSON.parse(out.slice(0, cut)); } catch (e) { return cb("HTTP " + status + " from " + host); }
		cb(null, json, status);
	}
	try {
		child = spawn("/usr/bin/curl", args);
	} catch (e) { return cb("can't run curl: " + e); }
	child.stdout.on("data", function (d) { out += d; });
	child.stderr.on("data", function (d) { errText += d; });
	child.stdout.on("end", finish);
	child.on("exit", function (c) { code = c; finish(); });
	// The body (a refresh token) goes in on stdin, never on the command line.
	if (body !== null) { child.stdin.write(body); }
	child.stdin.end();
}

function saveStore(accounts) {
	try { fs.mkdirSync(DATA_DIR, 448); } catch (e) {}
	var tmp = STORE + ".tmp";
	var fd = fs.openSync(tmp, "w", 384);     // 0600: tokens
	var text = JSON.stringify(accounts);
	fs.writeSync(fd, text, 0);
	fs.closeSync(fd);
	fs.renameSync(tmp, STORE);
}

function randomHex(n) {
	var fd = fs.openSync("/dev/urandom", "r"), b = new Buffer(n), hex = "", i;
	fs.readSync(fd, b, 0, n, null);
	fs.closeSync(fd);
	for (i = 0; i < n; i++) { hex += (b[i] < 16 ? "0" : "") + b[i].toString(16); }
	return hex;
}

var core = null;
function getCore() {
	if (!core) {
		core = CEOAuthCore({
			http: http, load: function () { return readJson(STORE); }, save: saveStore,
			now: function () { return Date.now(); }, randomHex: randomHex, log: log,
			decode64: function (t) { return new Buffer(t, "base64").toString("utf8"); },
			config: readJson(TEST_PROVIDERS) || readJson(SERVICE_DIR + "/providers.json") || {}
		});
	}
	return core;
}

function callerOf(controller) {
	var m = controller.message;
	try {
		return String((m.applicationID && m.applicationID()) || (m.senderServiceName && m.senderServiceName()) || "").split(" ")[0];
	} catch (e) { return ""; }
}

// The service framework forces returnValue:true onto any result it is handed, so a failure has
// to be raised as an exception to reach the caller as returnValue:false.
function fail(future, reply) {
	var e = new Error(reply.errorText);
	e.errorCode = reply.errorCode;
	e.errorText = reply.errorText;
	future.exception = e;
}
function answer(future, reply) {
	if (reply.returnValue) { future.result = reply; } else { fail(future, reply); }
}
function pageOnly(assistant, future) {
	var who = callerOf(assistant.controller);
	if (PAGES[who]) { return true; }
	fail(future, { errorCode: -1, errorText: "Only the mail sign-in pages can sign accounts in (asked by " + who + ")" });
	return false;
}

/*
 * The accounts there are, for prune and for telling a mail service its account signed in
 * again. Asked of the accounts service, as any app may.
 */
function listAccounts(cb) {
	var f = PalmCall.call("palm://com.palm.service.accounts/", "listAccounts", {});
	f.then(function (f2) {
		var r;
		try { r = f2.result; } catch (e) { log("listAccounts: " + e); return cb(null); }
		cb((r && r.results) || []);
	});
}

function OAuthService() {}
OAuthService.prototype.setup = function () {
	// A removed account's tokens go when the service starts.
	try {
		getCore();
		listAccounts(function (list) {
			var kept = [], i;
			if (!list) { return; }
			for (i = 0; i < list.length; i++) {
				if (!list[i].beingDeleted) { kept.push({ templateId: list[i].templateId, username: list[i].username }); }
			}
			core.prune(kept);
		});
	} catch (e) { log("setup: " + e); }
};

/*
 * The same account signed in again: its handle, which Accounts holds as its password, has
 * working tokens behind it once more, so the account's mail services are told its credentials
 * changed, as Accounts tells them when a password is saved. They log in at once and clear the
 * sign-in error. No account yet is the usual case for a first sign-in: the page makes it.
 */
function signedInAgain(done) {
	listAccounts(function (list) {
		var account = null, i;
		for (i = 0; list && i < list.length; i++) {
			if (list[i].templateId === done.templateId && !list[i].beingDeleted && String(list[i].username || "").toLowerCase() === done.email.toLowerCase()) { account = list[i]; break; }
		}
		if (!account) { return; }
		PalmCall.call("palm://com.palm.service.accounts/", "listAccountTemplates", {}).then(function (f) {
			var ts, template = null, hooks = [], seen = {}, enabled = {}, j, cps;
			try { ts = f.result.results || []; } catch (e) { return; }
			for (j = 0; j < ts.length; j++) { if (ts[j].templateId === done.templateId) { template = ts[j]; } }
			if (!template) { return; }
			cps = account.capabilityProviders || [];
			for (j = 0; j < cps.length; j++) { enabled[cps[j].id] = true; }
			if (template.onCredentialsChanged) { hooks.push(template.onCredentialsChanged); }
			cps = template.capabilityProviders || [];
			for (j = 0; j < cps.length; j++) {
				if (enabled[cps[j].id] && cps[j].onCredentialsChanged) { hooks.push(cps[j].onCredentialsChanged); }
			}
			for (j = 0; j < hooks.length; j++) {
				if (seen[hooks[j]]) { continue; }
				seen[hooks[j]] = true;
				log(done.provider + " signed in again; telling " + hooks[j]);
				PalmCall.call(hooks[j], "", { accountId: account._id });
			}
		});
	});
}

function ListProvidersAssistant() {}
ListProvidersAssistant.prototype.run = function (future) {
	if (pageOnly(this, future)) { future.result = getCore().listProviders(); }
};

function StartAssistant() {}
StartAssistant.prototype.run = function (future) {
	if (!pageOnly(this, future)) { return; }
	getCore().start(this.controller.args.provider, function (r) { answer(future, r); });
};

function CheckAssistant() {}
CheckAssistant.prototype.run = function (future) {
	if (!pageOnly(this, future)) { return; }
	var args = this.controller.args;
	getCore().check(args.provider, args.code, args.state, function (r) {
		if (r.returnValue && r.step === "done" && r.existing) { signedInAgain(r); }
		// A refusal keeps what the provider said (aadsts, providerError), which an exception
		// would drop: it is a step of its own.
		if (!r.returnValue) { r.returnValue = true; r.step = "failed"; }
		future.result = r;
	});
};

function ForgetAssistant() {}
ForgetAssistant.prototype.run = function (future) {
	if (pageOnly(this, future)) { future.result = getCore().forget(String(this.controller.args.handle || "")); }
};

function TokenAssistant() {}
TokenAssistant.prototype.run = function (future) {
	var args = this.controller.args;
	getCore().token(String(args.handle || ""), !!args.stale, function (r) { answer(future, r); });
};
