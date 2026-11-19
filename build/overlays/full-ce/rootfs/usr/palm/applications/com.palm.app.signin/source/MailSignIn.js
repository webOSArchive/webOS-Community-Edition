/*
 * webOS CE: signing a Google or Microsoft mail account in, for Accounts. It is the account
 * types' own page (validator.customUI), shown instead of a username and password form, since
 * these providers no longer take a password from a mail client
 * (Docs/EMAIL-MODERNIZATION-PLAN.md).
 *
 * The page is Lunacy's MailSignIn.js with one way to sign in. A TouchPad's browser can't show
 * Google's or Microsoft's sign-in page, so the person signs in on another device: this page
 * asks palm://com.palm.service.oauth for a code, shows the code and the address to enter it
 * at, and asks every few seconds whether the sign-in has finished. The service answers with a
 * handle for the account's tokens, which goes to Palm's mail service as the password: that
 * service checks the account against the server, as Email's wizard has one checked, and the
 * page hands Accounts the account to make.
 *
 * Microsoft has one entry for every kind of account: Exchange ActiveSync for work and school
 * accounts and, for a personal account (Outlook.com), which Microsoft refuses Exchange's
 * permission, IMAP. For such an account the service gives a second code, for its mail-only
 * provider, and the account is made as that provider's type (hidden from Add Account).
 */
enyo.kind({
	name: "MailSignIn",
	kind: "VFlexBox",
	className: "enyo-bg",
	width: "100%",
	height: "100%",
	published: {
		params: null
	},
	components: [
		{kind: "Toolbar", pack: "center", className: "enyo-toolbar-light accounts-header", components: [
			{name: "header", kind: "Control"}
		]},
		{className: "accounts-header-shadow"},
		{name: "pane", kind: "Pane", flex: 1, transitionKind: "enyo.transitions.Simple", components: [
			{name: "intro", kind: "Scroller", components: [
				{kind: "Control", className: "box-center", components: [
					{name: "title", className: "accounts-body-title"},
					{name: "text", className: "accounts-body-text", style: "margin-top: 8px;"},
					{name: "problem", className: "accounts-body-text", style: "margin-top: 16px; color: #b00;", showing: false},
					{name: "signInButton", kind: "ActivityButton", className: "enyo-button-affirmative", style: "margin-top: 16px;", caption: $L("Sign In"), onclick: "start", showing: false},
					{name: "remove", kind: "Accounts.RemoveAccount", style: "margin-top: 16px;", showing: false, onAccountsRemove_Done: "cancel"}
				]}
			]},
			{name: "waiting", kind: "Scroller", components: [
				{kind: "Control", className: "box-center", components: [
					{name: "waitTitle", className: "accounts-body-title"},
					{name: "waitText", className: "accounts-body-text", style: "margin-top: 8px;"},
					{name: "address", style: "margin-top: 24px; font-size: 22px; text-align: center;", showing: false},
					{name: "code", style: "margin: 16px 0 24px 0; font-size: 44px; letter-spacing: 6px; text-align: center; font-weight: bold;", showing: false},
					{name: "waitNote", className: "accounts-body-text", style: "text-align: center;", showing: false},
					{kind: "HFlexBox", pack: "center", style: "margin-top: 24px;", components: [{name: "spinner", kind: "SpinnerLarge"}]}
				]}
			]}
		]},
		{className: "accounts-footer-shadow"},
		{kind: "Toolbar", className: "enyo-toolbar-light", components: [
			{name: "cancelButton", kind: "Button", className: "accounts-toolbar-btn", caption: $L("Cancel"), onclick: "cancel"}
		]},
		{kind: "CrossAppResult"},
		{name: "providers", kind: "PalmService", service: "palm://com.palm.service.oauth/", method: "listProviders", onResponse: "gotProviders"},
		{name: "begin", kind: "PalmService", service: "palm://com.palm.service.oauth/", method: "start", onResponse: "gotCode"},
		{name: "check", kind: "PalmService", service: "palm://com.palm.service.oauth/", method: "check", onResponse: "checked"},
		{name: "forget", kind: "PalmService", service: "palm://com.palm.service.oauth/", method: "forget"},
		// The account type a fallback sign-in made the account (hidden from Add Account, so not in params).
		{name: "templates", kind: "PalmService", service: "palm://com.palm.service.accounts/", method: "listAccountTemplates", onResponse: "gotTemplates"},
		{name: "validate", kind: "PalmService", service: "palm://com.palm.imap/", method: "validateAccount", onResponse: "validated"},
		{name: "modifyAccount", kind: "PalmService", service: "palm://com.palm.service.accounts/", method: "modifyAccount", onResponse: "modified"},
		// An Exchange server's security policy, as Email's wizard handles one (CRUDAccounts.handlePasswordPolicy):
		// the policy the service downloaded, and webOS's own prompt to set the PIN or password it asks for.
		{name: "getPolicy", kind: "PalmService", service: "palm://com.palm.systemmanager/", method: "getSecurityPolicy", onResponse: "gotPolicy"},
		{name: "guard", kind: "SecurityPolicyGuard", onSuccess: "policyMet", onFailure: "policyRefused", onCancel: "policyRefused"}
	],

	create: function () {
		this.inherited(arguments);
		var p = this.params || {};
		this.templateId = (p.template && p.template.templateId) || (p.account && p.account.templateId) || "";
		this.$.header.setContent((p.template && p.template.loc_name) || (p.account && (p.account.loc_name || p.account.alias)) || $L("Sign In"));
		if (p.mode === "modify") {
			// The account's own page: signing in again (Email sends a "bad credentials" account here)
			// and Accounts' Remove Account.
			this.modifying = p.account;
			this.$.cancelButton.setCaption($L("Done"));
			this.$.remove.show();
			this.$.remove.init(p.account);
		}
		this.$.providers.call({});
	},

	destroy: function () {
		this.stopAsking();
		this.inherited(arguments);
	},

	gotProviders: function (inSender, r) {
		var list = (r && r.providers) || [], i;
		this.providerList = list;
		for (i = 0; i < list.length; i++) {
			if (list[i].templateId === this.templateId) {
				this.provider = list[i];
			}
		}
		var name = this.provider ? this.provider.title : this.$.header.getContent();
		if (!this.provider) {
			this.$.title.setContent($L("Not available"));
			this.$.text.setContent(new enyo.g11n.Template($L("Signing in to #{name} isn't set up on this device.")).evaluate({name: name}));
			return;
		}
		if (this.modifying) {
			this.$.title.setContent(this.modifying.username || name);
			this.$.text.setContent(new enyo.g11n.Template($L("If Email can't reach this account any more, sign in to #{name} again. You sign in on another device, such as a phone or computer; your password goes to #{name} only.")).evaluate({name: name}));
			this.$.signInButton.setCaption($L("Sign In Again"));
		} else {
			this.$.title.setContent(new enyo.g11n.Template($L("Sign in to #{name}")).evaluate({name: name}));
			// An Exchange account (Microsoft 365) brings contacts and calendar as well as mail.
			var cps = (this.params && this.params.template && this.params.template.capabilityProviders) || [], more = false;
			for (i = 0; i < cps.length; i++) {
				if (cps[i].capability === "CONTACTS" || cps[i].capability === "CALENDAR") {
					more = true;
				}
			}
			this.$.text.setContent(new enyo.g11n.Template(more
				? $L("#{name} asks you to sign in on its own page, which this device's browser can't show. You'll sign in on another device, such as a phone or computer, with a code shown here. Your password goes to #{name} only; this device is given permission to keep your mail, contacts and calendar.")
				: $L("#{name} asks you to sign in on its own page, which this device's browser can't show. You'll sign in on another device, such as a phone or computer, with a code shown here. Your password goes to #{name} only; Email is given permission to read and send your mail.")).evaluate({name: name}));
		}
		this.$.signInButton.show();
	},

	providerName: function (id) {
		var list = this.providerList || [], i;
		for (i = 0; i < list.length; i++) {
			if (list[i].id === id) {
				return list[i].title;
			}
		}
		return id;
	},

	start: function () {
		this.$.problem.hide();
		this.forgetHandle();
		this.stopAsking();
		// A new account may become another type than the one tapped (Microsoft's personal accounts);
		// signing an account in again keeps its type.
		this.templateId = this.firstTemplateId || this.templateId;
		this.firstTemplateId = this.templateId;
		this.asking = {provider: this.provider.id};
		this.$.signInButton.setActive(true);
		this.$.begin.call({provider: this.provider.id});
	},

	// The code to enter, from the service: shown, and asked about until the sign-in ends.
	gotCode: function (inSender, r) {
		if (!r || !r.returnValue || !r.code) {
			this.failed(this.refusal(r) || (r && r.errorText) || $L("Signing in didn't work."));
			return;
		}
		this.showCode(r, false);
	},

	showCode: function (r, again) {
		this.asking = {provider: r.provider, code: r.code, state: r.state, every: Math.max(2, r.pollSeconds || 5) * 1000};
		// The second code surprised its first user, who took it for the first one failing: say first that it worked.
		this.showWaiting(again ? $L("That worked. One more code to enter") : $L("Sign in on another device"), again
			? $L("Your sign-in went through. This is a personal Microsoft account (Outlook.com, Hotmail, MSN or Live), and Microsoft asks those to approve mail access separately. On the phone or computer, go to the same address once more and enter this second code:")
			: $L("On a phone or computer, go to this address and enter the code:"));
		this.$.address.setContent(String(r.url || "").replace(/^https?:\/\//, ""));
		this.$.code.setContent(r.code);
		this.$.waitNote.setContent(again ? $L("This is the last step. This page moves on by itself when you have entered it.") : $L("This page moves on by itself when you have signed in."));
		this.$.address.show();
		this.$.code.show();
		this.$.waitNote.show();
		this.askSoon();
	},

	askSoon: function () {
		this.stopAsking(true);
		this.timer = window.setTimeout(enyo.bind(this, "ask"), (this.asking && this.asking.every) || 5000);
	},

	ask: function () {
		this.timer = null;
		if (this.asking && this.asking.code) {
			this.$.check.call({provider: this.asking.provider, code: this.asking.code, state: this.asking.state});
		}
	},

	// keep: only the timer goes; the sign-in being asked about stays.
	stopAsking: function (keep) {
		if (this.timer) {
			window.clearTimeout(this.timer);
			this.timer = null;
		}
		if (!keep) {
			this.asking = null;
		}
	},

	checked: function (inSender, r) {
		if (!this.asking) {
			return;   // cancelled meanwhile
		}
		if (!r || !r.returnValue || r.step === "failed") {
			this.failed(this.refusal(r) || (r && r.errorText) || $L("Signing in didn't work."));
			return;
		}
		if (r.step === "pending") {
			if (r.slower && this.asking.every < 30000) {
				this.asking.every += 5000;
			}
			this.askSoon();
		} else if (r.step === "again") {
			// The provider refused the account what was asked for and has a narrower sign-in.
			if (this.modifying) {
				this.failed($L("This account can't be signed in to that way any more. Remove it and add it again."));
				return;
			}
			this.showCode(r, true);
		} else if (r.step === "done") {
			this.stopAsking();
			this.signedInStep(r);
		}
	},

	signedInStep: function (r) {
		// A handle an account already has (the same account signed in before) is never forgotten here.
		this.handle = r.existing ? null : r.handle;
		this.signedIn = r.handle;
		this.email = r.email;
		this.config = r.config;
		// Signed in with the fallback provider: the account is of its type.
		this.fellBack = Boolean(r.templateId && r.templateId !== this.templateId && !this.modifying);
		if (this.fellBack) {
			this.templateId = r.templateId;
		}
		this.showWaiting($L("Checking your account"), this.fellBack
			? new enyo.g11n.Template($L("#{email} is a personal Microsoft account. Microsoft gives Email its mail, but not its contacts or calendar.")).evaluate({email: r.email})
			: r.email);
		this.$.address.hide();
		this.$.code.hide();
		this.$.waitNote.hide();
		if (this.modifying && this.modifying.username && r.email.toLowerCase() !== this.modifying.username.toLowerCase()) {
			this.failed(new enyo.g11n.Template($L("That was #{other}. Sign in as #{email} to keep this account.")).evaluate({other: r.email, email: this.modifying.username}));
			return;
		}
		// The provider's mail service checks the account, as Email's wizard has it checked:
		// Palm's IMAP service, or its Exchange ActiveSync one.
		var v = /^(palm:\/\/[^\/]+\/)(.+)$/.exec(r.validator || "palm://com.palm.imap/validateAccount");
		var config = enyo.clone(r.config);
		this.exchange = v[1] === "palm://com.palm.eas/";
		if (this.exchange) {
			config.password = r.handle;   // mojomail-eas reads the account from its config, as Email's wizard sends it
		}
		this.$.validate.setService(v[1]);
		this.$.validate.setMethod(v[2]);
		this.$.validate.call({username: r.email, password: r.handle, email: r.email, protocol: this.exchange ? "EAS" : "IMAP", templateId: this.templateId, config: config});
	},

	/*
	 * A refusal the provider explained (the OAuth service passes its error and, for Microsoft,
	 * the AADSTS number), in plain words, with Microsoft's code kept for whoever helps. Microsoft's
	 * codes: 65001, 90094, 90095 an administrator's consent needed; 65004 the person declined
	 * (Microsoft's "Need admin approval" page leads there too: access_denied); 50105 the person
	 * isn't assigned to the app; 53003 the organisation's sign-in rules (Conditional Access)
	 * blocked it, which is also how an organisation that forbids signing in with a code says so.
	 * Null for anything else: the service's own text says it.
	 */
	refusal: function (r) {
		var code = r && r.aadsts, error = r && r.providerError, name = this.providerName(this.asking ? this.asking.provider : (this.provider && this.provider.id));
		var t;
		if (code === 65001 || code === 90094 || code === 90095 || error === "consent_required") {
			t = $L("Your organization's administrator has to approve the app \"webOS Email\" before this device can reach the account. Ask them to approve it, then sign in again.");
		} else if (code === 65004 || error === "access_denied" || error === "authorization_declined") {
			t = new enyo.g11n.Template($L("#{name} didn't give this device permission to reach the account. Sign in again and accept; if the account belongs to work or school and #{name} asks for an administrator's approval, your organization's administrator has to approve the app \"webOS Email\" first.")).evaluate({name: name});
		} else if (code === 50105) {
			t = $L("Your organization hasn't given you access to the app \"webOS Email\". Ask its administrator to allow it, then sign in again.");
		} else if (code === 53003) {
			t = $L("Your organization's sign-in rules don't allow this device or this way of signing in. Ask its administrator.");
		} else if (error === "expired_token") {
			t = $L("The code ran out before you signed in. Tap Sign In for a new one.");
		} else {
			return null;
		}
		return code ? t + " (AADSTS" + code + ")" : t;
	},

	showWaiting: function (title, text) {
		this.$.waitTitle.setContent(title);
		this.$.waitText.setContent(text);
		this.$.spinner.show();
		this.$.pane.selectView(this.$.waiting);
	},

	validated: function (inSender, r) {
		// 2500: the account is fine, and its Exchange server sent a security policy to meet first
		// (EmailAccountValidation.SECURITY_POLICY_CHECK_NEEDED; the mail services say it in
		// mailErrorCode, as Email's wizard reads it).
		if (r && !r.returnValue && (r.mailErrorCode === 2500 || r.errorCode === 2500)) {
			this.$.getPolicy.call({});
			return;
		}
		// 1110 (ACCOUNT_UNAVAILABLE): the server asked to be left alone for a while (a throttled
		// Exchange; libce-mailshim.so's easerr.h), which is no fault of the sign-in.
		if (r && !r.returnValue && (r.mailErrorCode === 1110 || r.errorCode === "503_SERVICE_UNAVAILABLE")) {
			this.failed(new enyo.g11n.Template($L("#{email} signed in, but its mail server is busy and asked to be left alone for a while. Try again in a few minutes.")).evaluate({email: this.email}));
			this.forgetHandle();
			return;
		}
		if (!r || !r.returnValue) {
			this.failed(new enyo.g11n.Template($L("#{email} signed in, but its mail server didn't take the sign-in. #{why}")).evaluate({
				email: this.email, why: (r && r.errorText) || ""}));
			this.forgetHandle();
			return;
		}
		var config = (r.protocolSettings && r.protocolSettings.config) || this.config;
		if (this.modifying) {
			// Accounts takes nothing back from an account's page in modify mode: the page saves the
			// credentials itself, and the mail service hears of it (onCredentialsChanged) and tries again.
			this.$.modifyAccount.call({accountId: this.modifying._id, object: {credentials: {common: {password: this.signedIn}}}});
			this.handle = null;
			return;
		}
		this.validConfig = config;
		if (this.fellBack) {
			this.$.templates.call({});
			return;
		}
		this.made((this.params || {}).template);
	},

	gotTemplates: function (inSender, r) {
		var list = (r && r.results) || [], i;
		for (i = 0; i < list.length; i++) {
			if (list[i].templateId === this.templateId) {
				this.made(list[i]);
				return;
			}
		}
		this.failed($L("Signed in, but the account couldn't be saved.") + " " + this.templateId);
		this.forgetHandle();
	},

	// Accounts' own pages take the template back with the account (entry-first-launch.js).
	made: function (template) {
		var config = this.validConfig;
		if (this.exchange && config) {
			config.password = this.signedIn;
		}
		this.$.crossAppResult.sendResult({
			returnValue: true,
			template: template,
			templateId: this.templateId,
			username: this.email,
			alias: this.$.header.getContent(),
			credentials: {common: {password: this.signedIn}},
			config: config
		});
		this.handle = null;
	},

	gotPolicy: function (inSender, r) {
		var policy = r && r.policy;
		var status = policy && policy.status, password = policy && policy.password;
		if (status && status.enforced === false && password && password.enabled === true) {
			policy.id = this.email;   // as Email's wizard does: the policy is this account's
			this.$.guard.setPolicy(policy);
			return;
		}
		this.policyMet();
	},

	// The policy is met: the account is made from what the sign-in gave, as Email's wizard does.
	policyMet: function () {
		this.validated(null, {returnValue: true});
	},

	policyRefused: function () {
		this.failed($L("This account's server requires a screen lock on this device. Set one when asked to add the account."));
		this.forgetHandle();
	},

	modified: function (inSender, r) {
		if (!r || !r.returnValue) {
			this.failed($L("Signed in, but the account couldn't be saved.") + " " + ((r && r.errorText) || ""));
			return;
		}
		this.$.crossAppResult.sendResult({returnValue: true});
	},

	failed: function (text) {
		this.stopAsking();
		this.$.signInButton.setActive(false);
		this.$.spinner.hide();
		this.$.problem.setContent(text);
		this.$.problem.show();
		this.$.pane.selectView(this.$.intro);
	},

	// A handle made by a sign-in that wasn't kept: its tokens go too. Not in modify mode, where
	// the handle is the account's own (signing in again keeps it).
	forgetHandle: function () {
		if (this.handle && !this.modifying) {
			this.$.forget.call({handle: this.handle});
			this.handle = null;
		}
	},

	cancel: function () {
		this.stopAsking();
		this.forgetHandle();
		this.$.crossAppResult.sendResult({returnValue: false});
	}
});
