// Model class for all photo-source accounts, both for cloud accounts and for local.
enyo.kind({
	name: 'PhotoAccount',
	kind: 'Component',
	accountId: null,
	accountName: null,
	accountType: null,
	iconSmall: null,
	iconBig: null,
	published: {
		syncStatus: 'idle'
	},
	_sortOrder: null,
	create: function() {
		this.inherited(arguments);

		// Cache to speed-up/simplify sorting.
		switch (this.accountType) {
			case 'local':
				this._sortOrder = 1;
				break;
			case 'com.palm.facebook':
				this._sortOrder = 2;
				break;
			default: 
				this._sortOrder = 3;
		}
	}
});


// Maintain a list of accounts
enyo.kind({
	name: 'PhotoAccounts',
	kind: 'Component',
	events: {
		onAccountsChanged: '',
		onSyncStatusChanged: ''
	},
	accounts: null,
	accountsById: null,
	capability: null,
	started: false,
	_syncStatuses: null,
	components: [
		{ name: 'localAccount', 
			kind: 'PhotoAccount', 
			accountId: 'local',
			accountName: $L('My TouchPad'),
			accountType: 'local',
			iconSmall: '',
			iconBig: 'icn-my-touchpad.png'
		},
		{ name: 'cloudAccounts', kind: 'CloudAccounts', capability: 'PHOTO.UPLOAD', onAccountsChanged: '_cloudAccountsChanged' },
		{ name: 'syncStatus',
			kind: 'PalmService', 
			service: 'palm://com.palm.service.photos/', 
			method: 'subscribeToAccountsInfo', 
			subscribe: true, 
			resubscribe:true,
			onSuccess: '_syncStatusResponse',
			onFailure: '_syncStatusFailure'		
		},
		{ name: 'massStorageMan',
			kind: 'PalmService', 
			service: 'palm://com.palm.bus/signal/', 
			method: 'addmatch', 
			subscribe:true,
			onSuccess: '_MSMStatusResponse',
			onFailure: '_MSMStatusFailure'		
		},
		{ name: 'capabilities',	kind: 'CapabilitiesFetcher' }
	],
	create: function() {
		this._syncStatuses = {};
		
		var sortFn = function(a,b) {
			if (a._sortOrder < b._sortOrder) return -1;
			else if (a._sortOrder > b._sortOrder) return 1;
			else if (a.accountType < b.accountType) return -1;
			else if (a.accountType > b.accountType) return 1;
			else if (a.accountName < b.accountName) return -1;
			else if (a.accountName > b.accountName) return 1;
			else return 0;			
		};
			
		this.registry = new OrderedRegistry(sortFn);
		this.inherited(arguments);
		this.registry.put('local', this.$.localAccount);
	},
	start: function() {
		if (this.started) {
			console.log('Accounts already started');
			return;
		}
		this.started = true;	
		this.$.cloudAccounts.start();
		this.$.syncStatus.call({});
		console.info("subscribing to signals for MSM mode");
		this.$.massStorageMan.call({
				"category" : "/storaged",
				"method" : "MSMStatus"
			});
	},
	
	// Here are the expected return values:
	// first:
	// 	{"accounts":{"local":{"syncStatus":"idle"}},"returnValue":true}
	// then a sequence over time, like:
	// 	{"accountId":"local","syncStatus":"processing","returnValue":true,"fired":true}
	// 	{"accountId":"local","syncStatus":"idle","returnValue":true,"fired":true}
	// 	{"accountId":"local","syncStatus":"processing","returnValue":true,"fired":true}
	// 	{"accountId":"local","syncStatus":"idle","returnValue":true,"fired":true}
	// 	{"accountId":"local","syncStatus":"processing","returnValue":true,"fired":true}
	// 	{"accountId":"local","syncStatus":"idle","returnValue":true,"fired":true}
	_syncStatusResponse: function(inSender, inResponse) {
		var accounts;
		if (inResponse.accounts) {
			// initial response contains sync-status for all accounts
			accounts = inResponse.accounts;
			for (var accountId in accounts) {
				if (accounts.hasOwnProperty(accountId)) { 
					this._updateAccountStatus(accountId, accounts[accountId].syncStatus);
				}
			}
		}
		else {
			// incremental update of a single account's status
			accounts = {};
			accounts[inResponse.accountId] = inResponse.syncStatus;
			this._updateAccountStatus(inResponse.accountId, inResponse.syncStatus);
		}
		this.doSyncStatusChanged(accounts);
	},
	_syncStatusFailure: function(inSender, inResponse) {
		console.warn('failed to subscribe to account sync-state');
	},
	_MSMStatusResponse:function(inSender,inResponse){
		console.info("********************Response for MSM subscription:"+JSON.stringify(inResponse));
		//we specifically check if the value is false because the very first subscription response
		//does not return this property at all
		//so we should be resubscribing to syncstatus only in the case of inMSM property=false
		
		if(inResponse.inMSM===false){
			console.info("************calling sync status subscribe");
			this.$.syncStatus.call({});
		}
	},
	_MSMStatusFailure:function(inSender,inResponse){
		console.info("******************Response for MSM subscription failure:"+JSON.stringify(inResponse));
	},
	_updateAccountStatus: function(accountId, syncStatus) {
		if (!accountId || !syncStatus) {
			console.warn('accountId and/or syncStatus is null');
			return;
		}
		
		var account = this.registry.get(accountId);
		if (account) { account.setSyncStatus(syncStatus); }
		// We may not have an account object for that accountId (due to 
		// a potential race-condition), so store the sync-state in case
		// the account-object is generated later.
		this._syncStatuses[accountId] = syncStatus;
	},
	_cloudAccountsChanged: function(inSender, updatedCloudAccounts) {	
		var currentIds = ['local'];
		var changed = false;
				
		// First pass: iterate through the updated list of accounts.  Add
		// each to a list, so that we can later delete any accounts that
		// don't appear in the updated list.  If an account is new, create
		// a new component for it.
		var fn = function(acct) {
			// Remember this account, so that the second pass doesn't destroy it.
			currentIds.push(acct.accountId);
			// Nothing to do if we already have this account; skip to the next one.
			if (this.registry.hasId(acct.accountId)) return;
			// Create a new account, and note that a change has occurred.
			changed = true;
			// XXXXX FIXME either make this do the right thing, or get rid of it
			// (the old cold paths are generating icons properly anyway)
			var icon = 'FIXMEFIXMEFIXME';
			var newAccount = this.createComponent({
				kind: 'PhotoAccount',
				accountId: acct.accountId,
				accountName: acct.alias,
				accountType: acct.templateId, // eg: 'com.palm.facebook'
				iconSmall: icon + '_20x20.png',
				iconLarge: icon + '_40x40.png',
				// If we don't have an explicit sync-state stored, use the default.
				syncStatus: (this._syncStatuses[acct.accountId] || 'idle')
			});
			this.registry.put(acct.accountId, newAccount);
			// We might soon want to know the capabilities of the new account, so make the request now.
			this.$.capabilities.fetchCapabilities(acct.accountId);			
//			console.log('Added photo-account of type: ' + acct.templateId + '    ' + acct.accountId);
		}
		updatedCloudAccounts.forEach(fn, this);
		
		// Second pass: delete all accounts that aren't in the updated list.
		var lengthBefore = this.registry.length;
		var deletedAccounts = this.registry.removeAllIdsExcept(currentIds);
		if (this.registry.length < lengthBefore) {
			changed = true;
			for (var id in deletedAccounts) {
				var acct = deletedAccounts[id];
				acct.destroy(); 
//				console.log('Deleted photo-account ' + acct.accountId + ' of type: ' + acct.accountType);				
			}
		}
		
		// If there was any change, notify owner.  Pass sorted list of accounts.
		if (changed) { 
			this.doAccountsChanged(this.registry.array); 
		}
	}
});

	
	