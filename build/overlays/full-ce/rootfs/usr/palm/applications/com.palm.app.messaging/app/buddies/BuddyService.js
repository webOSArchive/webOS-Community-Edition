enyo.kind({
	name: "BuddyService",
	kind: enyo.Service,
	requestKind: "BuddyRequest",
	events: {
		onWatch: ""
	}
});

enyo.kind({
	name: "BuddyRequest",
	kind: enyo.Request,
	events: {
		onWatch: "doWatch"
	},
	components: [
		{kind: "DbService", onFailure: "fail", components: [
			{name: "buddies", method: "find", service: "palm://com.palm.tempdb/", dbKind: "com.palm.imbuddystatus:1", onSuccess: "gotBuddies", subscribe: true, onWatch: "doWatch"/*, resubscribe: true, reCallWatches: true*/},
			{name: "buddiesSearch", method: "search", service: "palm://com.palm.tempdb/", dbKind: "com.palm.imbuddystatus:1", onSuccess: "gotBuddies", subscribe: true, onWatch: "doWatch"/*, resubscribe: true, reCallWatches: true*/},
			{name: "threads", dbKind: "com.palm.chatthread:1", method: "find", onSuccess: "gotThreads", subscribe: true, onWatch: "doWatch"/*, resubscribe: true, reCallWatches: true*/ },
			// [Lunacy] the threads of buddies with no person, by address (see assembleIds)
			{name: "addressThreads", dbKind: "com.palm.chatthread:1", method: "find", onSuccess: "gotAddressThreads", subscribe: true, onWatch: "doWatch"},
			{name: "people", dbKind: "com.palm.person:1", method: "find", onSuccess: "gotPeople", subscribe: true, onWatch: "doWatch"/*, resubscribe: true, reCallWatches: true*/}
		]},
		{name: "mockBuddies", kind: "MockDb", dbKind: "buddies/com.palm.imbuddystatus:1", method: "find", onSuccess: "gotBuddies", onFailure: "fail", onWatch: "doWatch"},
		{name: "mockPeople", kind: "MockDb", dbKind: "persons/com.palm.person:1", method: "find", onSuccess: "gotPeople", onFailure: "fail", onWatch: "doWatch"},
		{name: "mockThreads", kind: "MockDb", dbKind: "chatthreads/com.palm.chatthread:1", method: "find", onSuccess: "gotThreads", onFailure: "fail", onWatch: "doWatch"}
	],
	create: function() {
		this.inherited(arguments);
	},
	initComponents: function() {
		this.inherited(arguments);
		if (!window.PalmSystem) {
			this.$.buddies = this.$.mockBuddies;
			this.$.people = this.$.mockPeople;
			this.$.threads = this.$.mockThreads;
		}
	},
	call: function() {
	    //enyo.log(this.params);
		if (this.params && this.params.query && this.params.query.search) {
			this.params.query.search = undefined;
			this.$.buddiesSearch.cancel();
			this.$.buddiesSearch.call(this.params);
		} else {
			this.$.buddies.cancel();
			this.$.buddies.call(this.params);
		}
	},
	reply: function() {
		//enyo.log(this.data);
		this.receive(this.data);
	},
	fail: function(inSender, inResponse) {
		enyo.error("BuddyService - DbService failure: ", inResponse);
		this.reply();
	},
	finish: function() {
		// don't destroy automatically, so we can see watches
	},
	gotBuddies: function(inSender, inResponse, inRequest) {
	    //enyo.log("#@#@ got buddies in ", inRequest.latency, "ms");
	    //enyo.log(inResponse);
		this.data = inResponse;
		this.assembleIds();
		this.queryPeople();
	},
	assembleIds: function() {
		this.pids = [];
		// [Lunacy] A buddy the contacts linker hasn't given a person (no personId) would put
		// undefined in pids: the threads query then matched every thread without a person (a
		// Synergy connector's), and the buddy showed one of their unread counts. Such a buddy's
		// thread is found by its address instead, as Messaging.js finds it when it is tapped.
		this.addresses = [];
		for (var i=0, d; d=this.data.results[i]; i++) {
			if (d.personId) {
				this.pids.push(d.personId);
			} else if (d.username) {
				this.addresses.push(enyo.messaging.utils.normalizeAddress(d.username, d.serviceName));
			}
		}
	},
	queryPeople: function() {
		// [Lunacy] no buddy has a person: nothing to join by person, only by address
		if (!this.pids.length) {
			this.gotThreads(null, {results: []});
			return;
		}
		this.$.people.id = "buddyRequest_people";
		this.$.people.cancel();
		this.$.people.call({query: {
			                  where: [{
			                	       prop: "_id",
									   op: "=",
									   val: this.pids
								     }],
			                  select: enyo.messaging.person.selectAttributes
		                           }
		                  });
	},
	gotPeople: function(inSender, inResponse, inRequest) {
		// enyo.log("#@#@ got people in ", inRequest.latency, "ms");
		// enyo.log("#@#@ got people", inResponse);
		// join person data to buddy data
		enyo.messaging.utils.joinData(this.data, inResponse.results, "_id", "personId", "person");
		this.queryThreads();
	},
	queryThreads: function() {
		this.$.threads.id = "buddyRequest_threads";
		this.$.threads.cancel();
		this.$.threads.call({query: {
			                   where: [{ 
			                	         prop: "personId",
									     op: "=",
									     val: this.pids
								      }],
							   select: [
							            "_id",			
                                        "_kind",
                                        "personId",
                                        "normalizedAddress",
                                        "displayName",
                                        "unreadCount"
		                               ]
		                            }
		                   });
	},
	gotThreads: function(inSender, inResponse, inRequest) {
		//enyo.log("#@#@ got chat threads in ", inRequest.latency, "ms");
		//enyo.log("#@#@ got chat threads: ", inResponse);
		// join chat thread data to buddy data
		enyo.messaging.utils.joinData(this.data, inResponse.results, "personId", "personId", "thread");
		// [Lunacy] then the buddies with no person, by address
		if (this.addresses && this.addresses.length) {
			this.queryAddressThreads();
			return;
		}
		// all done now
		this.reply();
	},
	// [Lunacy] see assembleIds
	queryAddressThreads: function() {
		this.$.addressThreads.id = "buddyRequest_addressThreads";
		this.$.addressThreads.cancel();
		this.$.addressThreads.call({query: {
			where: [{prop: "normalizedAddress", op: "=", val: this.addresses}],
			select: ["_id", "_kind", "personId", "normalizedAddress", "displayName", "unreadCount"]
		}});
	},
	gotAddressThreads: function(inSender, inResponse) {
		var byAddress = {}, r = inResponse.results || [], i, d;
		for (i = 0; (d = r[i]); i++) {
			if (!d.personId) { byAddress[d.normalizedAddress] = d; }
		}
		for (i = 0; (d = this.data.results[i]); i++) {
			if (!d.personId && d.username) {
				d.thread = byAddress[enyo.messaging.utils.normalizeAddress(d.username, d.serviceName)];
			}
		}
		this.reply();
	}
});