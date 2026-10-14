enyo.kind({
	name: 'CloudAccounts',
	kind: 'Component',
	events: {
		onAccountsChanged: ''
	},
	accounts: null,
	capability: null,
	started: false,
	components: [
		{ name: 'lib', kind: 'Accounts.getAccounts', onGetAccounts_AccountsAvailable: 'onGetAccounts_AccountsAvailable_Handler' }
	],
	create: function() {
		this.inherited(arguments);
		this.accounts = [];
	},
	start: function() {
		if (this.started) {
			console.log('CloudAccounts already started');
			return;
		}
		if (!this.capability) {
			console.warn('no capability provided to CloudAccounts');
			return;
		}
		console.log('Starting CloudAccounts');
		this.started = true; // so we don't start again
		this.$.lib.getAccounts({ capability: this.capability });
	},
	// Silly handler name for a silly event name.
	onGetAccounts_AccountsAvailable_Handler: function(inSender, inResult) {
		// We only care about a few properties... get rid of the rest.
		// Facebook accounts are the most important (just 'cause) and
		// we impose a sort order that puts them first.
		this.accounts = inResult.accounts.map(function(a) {
			var sortOrder;
			switch (a.templateId) {
				case 'com.palm.facebook': 
					sortOrder = 1;
					break;
				default:
					sortOrder = 2;
			}
			return {
				alias: a.alias,
				accountId: a._id,
				templateId: a.templateId,
				sortOrder: sortOrder
			}
		});

		// Sort accounts consistently.
		this.accounts.sort(function(a,b) {
			if (a.sortOrder < b.sortOrder) return -1;
			else if (a.sortOrder > b.sortOrder) return 1;
			else if (a.templateId < b.templateId) return -1;
			else if (a.templateId > b.templateId) return 1;
			else if (a.alias < b.alias) return -1;
			else return 1;
		});
		
		console.info('cloud accounts updated, now ' + this.accounts.length + ' enabled');
		
		this.doAccountsChanged(this.accounts);
	}
});

/* EXAMPLE QUERY RESULT:
{"accounts":[
	{	"_id":"++HT4Hnfd4sI6cpW",
		"_kind":"com.palm.account:1",
		"_rev":8852,
		"_sync":true,
		"alias":"Facebook",
		"beingDeleted":false,
		"capabilityProviders":[
			{"_id":"2295","capability":"PHOTO.UPLOAD","id":"com.palm.facebook.photoupload","implementation":"palm://com.palm.service.photos.facebook/upload"},
			{"_id":"2296","capability":"VIDEO.UPLOAD","id":"com.palm.facebook.videoupload","implementation":"palm://com.palm.service.videos.facebook/"}
		],
		"templateId":"com.palm.facebook",
		"username":"schwa@fastmail.us",
		"icon":{
			"loc_32x32":"/usr/palm/public/accounts/com.palm.facebook/images/facebook-32x32.png",
			"loc_48x48":"/usr/palm/public/accounts/com.palm.facebook/images/facebook-48x48.png"
		},
		"loc_name":"Facebook",
		"loc_usernameLabel":"email address",
		"readPermissions":["com.palm.app.facebook","com.palm.app.facebook.beta"],
		"validator":"palm://com.palm.service.contacts.facebook/checkCredentials",
		"writ
*/