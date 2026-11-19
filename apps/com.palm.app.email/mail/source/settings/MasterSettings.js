enyo.kind({
	name: "MasterSettings",
	width: "100%",
	kind: enyo.VFlexBox,
	className: "basic-back",
	events: {
		onPreferenceChanged: ""
	},
	components: [
		{name: "settingPane", kind: "Pane", flex: 1, components: [
				{kind:"Preferences", name: "preferences"},
				{kind: "AccountSettings", name:"accountSettings"},
				{kind: "CRUDAccounts", name: "crudAccounts"},
				{kind: "AccountsUI", name: "addAccountView", capability: "MAIL", onAccountsUI_Done: "showPreferences"},
				// webOS CE: an account type with its own sign-in page (validator.customUI: Google
				// and Microsoft Outlook, signed in with OAuth by com.palm.app.signin) changes its
				// login there, as the Accounts app does (the accounts library's entry-modify.js).
				// Palm's password form can't sign it in. From Lunacy.
				{kind: "Accounts.crossAppUI", name: "signInUI", onResult: "signInDone"}
			]
		}
	],
	create: function() {
		this.inherited(arguments);
	},
	doBack: function() {
		enyo.dispatchBack();
	},
	showPreferences: function() {
		this.$.preferences.loadAccounts(); // leave this in for now
		this.$.settingPane.selectView(this.$.preferences);
	},
	showAccountSetting: function(accountId) {
		this.$.accountSettings.loadAccount(accountId);
		this.$.settingPane.selectView(this.$.accountSettings);
	},
	showAddAccount: function(filteredTemplates) {
		// in case the user calls this before we can get a filtered list of templates from accounts ui, 
		// use the list we've cached
		filteredTemplates = filteredTemplates || enyo.application.accounts.templateList.filter(function(elem) { return !elem.hidden; });
		this.$.addAccountView.AddAccount(filteredTemplates);
		this.$.settingPane.selectView(this.$.addAccountView);
	},
	showEditMode: function(accountId) {
		var accts = enyo.application.accounts;
		// webOS CE: the type's own sign-in page, where it has one.
		var account = accts.getAccount(accountId);
		var template = account && accts.accountTemplates && accts.accountTemplates[account.getTemplateId()];
		if (template && template.validator && template.validator.customUI) {
			this.signInAccountId = accountId;
			this.$.settingPane.selectView(this.$.signInUI);
			this.$.signInUI.launchCrossAppUI(template.validator.customUI, {mode: "modify", account: account.getAccountData(), capability: "MAIL"});
			return;
		}
		this.$.crudAccounts.loadAccount(account);
		this.$.settingPane.selectView(this.$.crudAccounts);
	},
	// webOS CE: the sign-in page is done (signed in again, or cancelled): back to the account.
	signInDone: function() {
		this.showAccountSetting(this.signInAccountId);
	},
	
	/**
	 * quick check to see if a branded template is being edited.
	 * Branded templates show up as unique mail account types on account creation,
	 * even though they may rely on a standard transport
	 * Examples include Google and Yahoo, which use IMAP, but have their own templates
	 * @param {Object} toEdit
	 */
	_isBrandedEdit: function(toEdit) {
		// written funky for JSLINT
		var verdict = true;
		switch (toEdit.templateId) {
			case "com.palm.eas":
			case "com.palm.imap":
			case "com.palm.pop":
				verdict = false;
				break;
			default:
				// already true
				break; 
		}
		return verdict;
	},
	
	showManualConfig: function() {
		this.$.crudAccounts.loadAccount(this.toEdit);
		this.$.settingPane.selectView(this.$.manualConfig);
	},
	showAccountWizard: function() {
		this.$.crudAccounts.setWizardMode();
		this.$.settingPane.selectView(this.$.crudAccounts);
	}
});

