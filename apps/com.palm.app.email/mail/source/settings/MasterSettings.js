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
				{kind: "AccountsUI", name: "addAccountView", capability: "MAIL", onAccountsUI_Done: "showPreferences"}
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
		this.$.crudAccounts.loadAccount(accts.getAccount(accountId));
		this.$.settingPane.selectView(this.$.crudAccounts);
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

