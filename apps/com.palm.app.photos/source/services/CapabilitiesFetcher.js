// Used to read capabilities for a photo/video service

enyo.kind({
	name: "CapabilitiesFetcher",
	kind: "Component",
	pendingCallbacks: null,
	fetchedCapabilities: {},
	pendingCallbacks: null,
	tools: [
		{
			kind: 'PalmService',
			name: 'capabilitiesService', 
			service: 'palm://com.palm.service.photos/', 
			method: 'getAccountsCapability', 
			subscribe: false, 
			onSuccess: '_getCapabilitiesSuccess',
			onFailure: '_getCapabilitiesFailure'
		}
	],
	create: function() {
		this.inherited(arguments);
		this.createComponents(this.tools);
		
		// cached capabilities previously fetched
		this.fetchedCapabilities = {},
		// callbacks waiting for the capabilities to be fetched,
		// in the format of {callback: function, id: string}
		this.pendingCallbacks = [];		
	},
	
	/*
		trigger all the callbacks with the requested capabilites, clear the pendingCallbacks array
	*/
	_hitCallbacks: function(capabilities){
		var length = this.pendingCallbacks.length;
		for (var i =0; i<length; i++){
			var callback = this.pendingCallbacks[i].callback;
			var serviceId = this.pendingCallbacks[i].serviceId;
			callback(capabilities[serviceId] || {});
		}
		this.pendingCallbacks = [];
	},
	
	/*
		Successfully received capabilities from the service
	*/
	_getCapabilitiesSuccess: function(inSender, inResponse, inRequest){
		this.fetchedCapabilities = {};
		
		var capabilities = inResponse.AccountsCapability;
		for (serviceId in capabilities){
			this.fetchedCapabilities[serviceId] = capabilities[serviceId];
		} 
		
		this._hitCallbacks(this.fetchedCapabilities);
	},
	
	/**
	 * Fetch capabilities for a given service
	 * @public
	 * @param {String} serviceId The id of the service to fetch capabilities for
	 * @param {function} callback The callback to trigger when the capabilities have been fetched
	 *		in the form of callback(capabilities)
	 * @returns nothing
	 * @type String|Object|Array|Boolean|Number
	 */	
	fetchCapabilities: function(serviceId, callback) {
		if (this.fetchedCapabilities && this.fetchedCapabilities[serviceId]){
			callback && callback(this.fetchedCapabilities[serviceId]);
		} else {
			if (this.pendingCallbacks.length === 0){
				this.$.capabilitiesService.call();
			}
			callback && this.pendingCallbacks.push({callback: callback, serviceId: serviceId});
		}
	},
	
	/*
		service called failed for unknown reasons
	*/
	_getCapabilitiesFailure: function(inSender, inResponse) {
		console.log('CAPABILITIES ACTION FAILED: ' + JSON.stringify(inResponse));
		this._hitCallbacks([]);
	}
});
