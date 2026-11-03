/*global _, Activity, Class, console, ContactsLib, Date, DBModels, Future, include, mapReduce, MojoDB, Person, PalmCall*/
/*
 * Copyright 2010 Palm, Inc.  All rights reserved.
 */

// this.controller has the following properties: service,config,message,args,future,activity,assistant,_timeout,_timer		
// example this.controller.args {"$activity":{"activityId":1,"trigger":{"fired":true,"returnValue":true}}}
var NewMessagesCommandAssistant = Class.create({
	run: function(future) {
		this.revision = this.controller.args.revision || 0;
		console.log("Starting NewMessagesCommandAssistant rev=" + this.revision);

		// Serialize activations. Because each activation now drains a whole page (async db8
		// work), two overlapping runs would race on a conversation's unreadCount
		// read-modify-write and lose increments. If another run holds the lock (and it isn't
		// stale), skip — the active run drains the backlog and the db8 watch re-fires for
		// anything still unthreaded. Stale-lock guards against a run that dies mid-flight.
		var now = Date.now();
		if (NewMessagesCommandAssistant._busyUntil && now < NewMessagesCommandAssistant._busyUntil) {
			console.info("NewMessagesCommandAssistant: another activation active, skipping");
			future.result = true;
			return;
		}
		NewMessagesCommandAssistant._busyUntil = now + 60000;
		this._ownsLock = true;

		// Query for messages not associated with a conversations
		future.now(this, function(future) {
			future.nest(DBModels.Messages.findUnthreaded(this.revision));
		});

		/*
			for each Message {
				get the list of addresses based on folder type
				for each address {
					deal with the message & address 
				}
			}
		*/
		// Each message can have multiple addresses so it can be associated with multiple conversations.
		future.then(this, function(future) {
			var messageList = future.result ? future.result.results : [];
			console.info("NewMessagesCommandAssistant: number of unassociated mesages: " +messageList.length);
			if (messageList !== undefined && messageList.length > 0) {
				// Thread the WHOLE fetched batch in this single activation instead of only
				// messageList[0] + complete()/re-watch per message. The old one-at-a-time
				// design capped throughput at ~1 activity round-trip per message (~1.75 msg/s
				// measured), so busy group chats / IRC built an unbounded backlog. findUnthreaded
				// returns the lowest-_rev unthreaded page (<=500) ordered by _rev, so draining
				// the page and letting the high-water revision advance to its max skips nothing.
				future.nest(this.handleAllMessages(messageList));
			} else {
				future.result = true;
			}
		});
	},

	// Sequentially thread every message from a findUnthreaded page within one activation.
	// Resolves once the batch is done. Per-message errors are logged and skipped so a
	// single bad record cannot stall the batch. Chaining is async (each step runs after the
	// previous message's futures settle), so there is no deep recursion even for a full page.
	handleAllMessages: function(messageList) {
		var outer = new Future();
		var self = this;
		var i = 0;
		// Per-batch conversation cache: within one activation, all messages from the same
		// IM address thread into the same conversation, so resolve the contact + conversation
		// once and reuse it — avoids a Person.findByIM + Conversations.findOrCreate per message
		// (the dominant cost once the activity round-trip is amortized). Not used for group
		// chats (keyed on the chat, not a participant address).
		this._convCache = {};
		// Write-batching accumulators, flushed once at end of the activation:
		//  _dirtyConvs  — conversations updated in-memory by cache hits (summary/unreadCount);
		//                 one MojoDB.merge for all of them instead of one per message.
		//  _msgMerges   — the per-message {_id,conversations} links; one MojoDB.merge for all.
		this._dirtyConvs = {};
		this._msgMerges = [];
		function step() {
			for (;;) {
				if (i >= messageList.length) {
					self.flushBatch(outer);
					return;
				}
				var msg = messageList[i++];
				var f;
				try {
					f = self.handleMessage(msg);
				} catch (e) {
					console.error("NewMessagesCommandAssistant: handleMessage threw, skipping: " + e);
					continue;
				}
				f.then(function(inner) {
					try { var r = inner.result; } catch (e) {
						console.error("NewMessagesCommandAssistant: message future error, skipping: " + e);
					}
					step();
				});
				return;
			}
		}
		step();
		return outer;
	},

	// Persist the whole activation's accumulated writes in at most two db8 calls:
	// one merge for every conversation whose summary/unreadCount changed via a cache hit,
	// then one merge for all the message->conversation links. Replaces up to two db8
	// writes per message with two per batch.
	flushBatch: function(outer) {
		var convMerges = [];
		var dirty = this._dirtyConvs || {};
		for (var k in dirty) {
			if (dirty.hasOwnProperty(k)) {
				var c = dirty[k];
				// Merge by _id (last-write-wins). Drop _rev so a stale cached revision
				// (findOrCreate bumped it when it first wrote the thread) can't reject the merge.
				if (c._rev !== undefined) { delete c._rev; }
				convMerges.push(c);
			}
		}
		var msgMerges = this._msgMerges || [];
		this._dirtyConvs = {};
		this._msgMerges = [];
		console.info("NewMessagesCommandAssistant: flushBatch convMerges=" + convMerges.length +
			" msgMerges=" + msgMerges.length);

		var chain = new Future();
		chain.now(function(future) {
			if (convMerges.length > 0) { future.nest(MojoDB.merge(convMerges)); }
			else { future.result = true; }
		});
		chain.then(function(future) {
			try { var r = future.result; } catch (e) {
				console.error("NewMessagesCommandAssistant: flushBatch conversation merge error: " + e);
			}
			if (msgMerges.length > 0) { future.nest(MojoDB.merge(msgMerges)); }
			else { future.result = true; }
		});
		chain.then(function(future) {
			try { var r2 = future.result; } catch (e) {
				console.error("NewMessagesCommandAssistant: flushBatch message merge error: " + e);
			}
			outer.result = true;
		});
	},

	// Complete the activity with restart
	complete: function(activity) {
		// Release the serialization lock (only the run that took it may clear it).
		if (this._ownsLock) {
			NewMessagesCommandAssistant._busyUntil = 0;
			this._ownsLock = false;
		}
		console.info("NewMessagesCommandAssistant:complete activity " + activity._activityId + ", rev="+this.revision);
		var restartParams = {
			activityId: activity._activityId,
			restart: true,
			trigger: {
				method: "palm://com.palm.db/watch",
				key: "fired",
				params: {
					query: {
						from: "com.palm.message:1",
						where: [
							{prop: "conversations", op: "=", val: null},
							{prop: "flags.visible", op: "=", val: true},
							{prop: "_rev", op: ">", val: this.revision}
						]
					}
				}
			},
			callback: {
				method: "palm://com.palm.messaging.chatthreader/newMessages",
				params: { revision: this.revision }
			}
		};
		return PalmCall.call(activity._service, "complete", restartParams);
	},
	
	// The message can have multiple addresses associated with it, so use mapReduce to handle each address
	handleMessage: function(message) {
		//console.info(handleMessage " + JSON.stringify(message));

		if (message._rev > this.revision) {
			this.revision = message._rev;
		}

		// SELF-HEAL / loop-breaker. A message that keeps returning unthreaded across activations is a
		// poison record (bad data, or a stuck db state - e.g. a conversation the resolver can't settle).
		// Left alone it re-fires the db8 watch forever: 100% CPU + log flood (as happened once after a
		// mid-thread reboot). We count sightings per _id in a static that survives activations; after a
		// few tries we STOP trusting the normal resolver (that's where the poison lives) and merge a
		// stable sentinel conversation straight onto the message. That makes it fail findUnthreaded's
		// "conversations = null" test forever, so the activity settles no matter what. The merge carries
		// no _rev so it can't be rejected. Worst case the message is parked (not mis-threaded), and the
		// error log names it + its channel so the underlying record can be looked at later.
		var seen = NewMessagesCommandAssistant._seenCounts || (NewMessagesCommandAssistant._seenCounts = {});
		NewMessagesCommandAssistant._seenCalls = (NewMessagesCommandAssistant._seenCalls || 0) + 1;
		// Periodic hygiene so the map can't grow unbounded; a genuine loop spikes one _id to the
		// threshold in a handful of activations, long before this reset could interfere.
		if (NewMessagesCommandAssistant._seenCalls % 5000 === 0) { seen = NewMessagesCommandAssistant._seenCounts = {}; }
		var seenN = seen[message._id] = (seen[message._id] || 0) + 1;
		if (seenN >= 5) {
			console.error("NewMessagesCommandAssistant: SELF-HEAL breaking re-thread loop on stuck message " +
				message._id + " (seen " + seenN + "x, chan=" + message.channelName + "); parking it in the self-healed sentinel thread");
			delete seen[message._id];
			return MojoDB.merge([{ _id: message._id, conversations: [DBModels.kSelfHealedThreadId] }]);
		}

		var addressList = Messaging.Message.getAddressesForThreading(message);
		if (addressList.length > 0) {
			//console.info("NewMessagesCommandAssistant: mapReduce on " + JSON.stringify(message));
			var mapFunc = _.bind(this.handleMessageAndAddress, this, message);
			return mapReduce({map:mapFunc}, addressList);
		} else {
			// The message should always have recips. If doesn't, put it in a 
			// default chatthread since it must be assigned to one.
			console.error("NewMessagesCommandAssistant: ERROR: message is missing recipient " + JSON.stringify(message));
			var future = DBModels.Conversations.findOrCreate(undefined, message, {});
			future.then(function(future) {
				var conversation = future.result;
				future.nest(DBModels.Messages.addConversation(message, conversation));
			});
			return future;
		}
	},

	/*
		contacts reverse lookup to get the Person
		if no Person {
			lookup "orphan" conversation with given address
			if conversation doesn't exist, create it.
		} else {
			lookup conversation associated with person ID
			if conversation doesn't exist, create it.
		}
		add conversation ID to message
	 */
	handleMessageAndAddress: function(message, address) {
		var outerFuture = new Future();
		var self = this;
		//console.info("handleMessageAndAddress looking for " +JSON.stringify(address));
		address = this.convertAddressToObject(address);

		// Fast path: reuse a conversation already resolved for this address in this batch
		// (1:1/IM only — group chats and Server/Room channels are keyed on the chat/channel,
		// not a participant address, so they must not share a per-address cache entry).
		var cacheKey = (!message.groupChatName && !message.channelName && this._convCache) ?
			((address.addr || "") + "|" + (message.serviceName || "")) : null;
		if (cacheKey && this._convCache[cacheKey]) {
			var cachedConv = this._convCache[cacheKey];
			// Keep the thread's summary/timestamp/unreadCount correct across the burst by
			// applying the same in-memory update findOrCreate would (it increments unreadCount
			// and sets the latest summary). Mark the conversation dirty so flushBatch persists
			// the final state once, and collect the message link for the batched merge.
			Messaging.ChatThread._updateFromNewMessage(cachedConv, message, address);
			this._dirtyConvs[cacheKey] = cachedConv;
			outerFuture.now(this, function(future) {
				future.nest(DBModels.Messages.addConversation(message, cachedConv, undefined, self._msgMerges));
			});
			return outerFuture;
		}

		// Do contacts reverse lookup
		outerFuture.now(this, function(future) {
			console.info("handleMessageAndAddress: nesting contactReverseLookup ");
			future.nest(this.contactReverseLookup(address, message));
		});

		// Lookup or create the conversation
		outerFuture.then(this, function(future) {
			//console.info("handleMessageAndAddress: result from contactReverseLookup " + JSON.stringify(future.result));
			var person  = this.getPerson(future);
			future.nest(DBModels.Conversations.findOrCreate(person, message, address));
		});

		// Associate the message with the conversation
		outerFuture.then(function(future) {
			var conversation = future.result;
			if (conversation) {
				var id = conversation && conversation._id;
				console.info("handleMessageAndAddress: got conversation id=" + id);
				if (cacheKey) { self._convCache[cacheKey] = conversation; }
				future.nest(DBModels.Messages.addConversation(message, conversation, undefined, self._msgMerges));
			} else {
				future.result = true;
			}
		});

		return outerFuture;
	},

	contactReverseLookup: function(params, message) {
		//console.info("contactReverseLookup " +JSON.stringify(params)+ "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
		var address = params.addr;
		var future;
		var self = this;

		if (address === undefined) {
			console.error("contactReverseLookup address is undefined");
			future = new Future();
			future.result = undefined;
		// GroupChats and Server/Room channels are keyed on the chat/channel, not a participant,
		// so skip the (expensive, and here meaningless) contact reverse lookup for them.
		} else if (message.groupChatName || message.channelName) {
			future = new Future();
			future.result = undefined;
		// Assume it is a phone number if the dbkind is com.palm.smsmessage or com.palm.mmsmessage
		// TODO: verify this works for phone services that have usernames instead of numbers
		} else if (NewMessagesCommandAssistant.SmsOrMmsRegex.test(message._kind)) {
			// For phone numbers, just look up the first person with that phone number
			var findByPhoneParams = {
				personType:ContactsLib.PersonType.RAWOBJECT,
				returnAllMatches: false
			};
			future = Person.findByPhone(address, findByPhoneParams);
		} else {
			var findByImParams = {
				personType:ContactsLib.PersonType.RAWOBJECT,
				returnAllMatches: true
			};
			future = Person.findByIM(address, message.serviceName, findByImParams);
			future.then(this, function(future) {
				var results = future.result || [];
				console.info("contactReverseLookup: found "+results.length+" IM persons for address="+address+", serviceName="+message.serviceName);

				if (results.length > 1) {
					// Need to figure out which person is the right one by finding which account the 
					// message was sent to.				
					var myUsername = this.getUsername(message); 
					
					// If my user name isn't set, then just assume the first person in the list
					if (myUsername === undefined) {
						console.error("contactReverseLookup: message was missing my username so choosing first person");
						future.result = results[0];
					} else {
						future.nest(this.findPersonForAccount(myUsername, message.serviceName, results));
					}
				} else if (results.length === 0) {
					// webOS: Person.findByIM normalizes a WhatsApp address by STRIPPING the leading "+"
					// (Messaging.Utils.normalizeAddress, type_whatsapp branch), but a contact's WhatsApp im
					// can be stored with the "+" KEPT in its normalizedValue (e.g. an aggregate person
					// merged with a CardDAV/Google contact). findByIM then misses, so an outgoing-only
					// thread (no incoming from.name to fall back on) never links and shows the bare number.
					// imbuddystatus is the authoritative buddy->person link, keyed on the EXACT raw username,
					// and already carries personId + displayName (set by a different, exact-match path).
					// Fall back to it so the thread gets associated with the real contact.
					future.nest(self.findPersonViaBuddy(address, message.serviceName));
				} else {
					//result is just a single person.
					future.result = future.result;
				}
			});
		}
		return future;
	},

	// Resolve a person via the linked buddy (imbuddystatus) when Person.findByIM can't (normalization
	// mismatch). Matches the buddy by its exact raw username + serviceName; if it carries a personId,
	// returns that person as a raw object so the caller associates the thread. Resolves to undefined on
	// a miss (indexed lookup mirrors personChanged.addPersonIdToBuddy's query, so no new index needed).
	findPersonViaBuddy: function(address, serviceName) {
		var future = TempDB.find({
			from: "com.palm.imbuddystatus:1",
			where: [
				{ prop: "username", op: "=", val: address },
				{ prop: "serviceName", op: "=", val: serviceName }
			]
		}, false);
		future.then(this, function(future) {
			var buddies = (future.result && future.result.results) || [];
			var personId;
			for (var i = 0; i < buddies.length; ++i) {
				if (buddies[i].personId) { personId = buddies[i].personId; break; }
			}
			if (!personId) {
				future.result = undefined;
				return;
			}
			console.info("contactReverseLookup: resolved person " + personId + " via imbuddystatus for " + address);
			future.nest(MojoDB.get([personId]));
		});
		future.then(this, function(future) {
			// Always set a result: reading future.result consumes it, so a buddy miss that only
			// read it would never resolve, and the message would never be filed into a thread.
			var res = future.result;
			future.result = (res && res.results && res.results.length > 0) ? res.results[0] : undefined;
		});
		return future;
	},
	
	findPersonForAccount: function(myUsername, serviceName, personList) {
		myUsername = Messaging.Utils.normalizeAddress(myUsername, serviceName);
		
		var mapFunc = _.bind(this.getAccountFromUsername, this, myUsername, serviceName);
		
		// 1. Get the contacts associated with each person
		// 2. Get the account associated with each contact
		// 3. Compare the account.username to message.to.addr
		var mapFuture = mapReduce({map:mapFunc}, personList);
		mapFuture.then(this, function(mapFuture) {
			if (mapFuture.result && mapFuture.result.length > 0) {
				mapFuture.result = mapFuture.result;
			} else {
				mapFuture.result = personList;
			}
		});
		
		return mapFuture;
	},
	
	getAccountFromUsername: function(myUsername, serviceName, person) {
		// 1. Get the contacts associated with each person
		var future = MojoDB.get(person.contactIds);
		future.then(this, function(future) {
			var contacts = future.result.results || [];
			var accountIds = this.getAccountIds(contacts, serviceName);
			
			// 2. Get the account associated with each contact
			future.nest(MojoDB.get(accountIds));
		});
		
		// 3. Compare the account.username to message.to.addr
		future.then(this, function(future) {
			var accounts = future.result.results || [];
			var matchedPersons = [];
			//console.log("*****findPersonForAccount: "+accounts.length+" accounts found");
			accounts.forEach(function(account) {
				//console.log("findPersonForAccount: testing account.username ("+account.username+") == myUsername ("+myUsername+")");
				if (myUsername === Messaging.Utils.normalizeAddress(account.username, serviceName)) {
					matchedPersons.push(person);
				}
			});
			future.result = matchedPersons;
		});	
		return future;
	},
	
	/***********************************
	 * Functions below are unit tested *
	 ***********************************/	
	convertAddressToObject: function (address) {
		if (typeof address === "string") {
			console.error("convertAddressToObject address is a string. Converting to object");
			address = {addr: address };
		} else if (!address) {
			console.error("convertAddressToObject address object is undefined, setting to 'No Recipients'");
			address = {addr: Messaging.Utils.kMissingAddress };
		} else if (address.addr === undefined) {
			console.error("convertAddressToObject address.addr is undefined, setting to 'No Recipients'");
			address.addr = Messaging.Utils.kMissingAddress;
		}
		return address;
	},
	
	getPerson: function(future) {
		var person = undefined;
		if (future.result) {
			var results = future.result;
			if (future.result.length === 1) {
				person = future.result[0];
			} else if (future.result.length > 1) {
				//TODO: need to look up which person to use
				person = future.result[0];
			} else {
				person = future.result;
			}
		}
		return person;
	},
	
	getUsername: function(message) {
		var username = undefined; 
		if (message.folder === "inbox") {
			if (message.to && message.to.length > 0) {
				username = message.to[0]; // assume the first since it was sent to me so I should be the only recipient
			}
		} else if (message.from) {
			username = message.from;
		}
		return username;
	},
	
	getAccountIds: function(contacts, serviceName) {
		var accountIds = [];
		contacts.forEach(function(contact) {
			// An IM buddy contact only ever has one im address.
			if (contact.ims && contact.ims.length === 1 && contact.ims[0].type === serviceName) {
				console.info("findPersonForAccount: adding account "+contact.accountId);
				accountIds.push(contact.accountId);
			}
		});
		return accountIds;
	}
});

NewMessagesCommandAssistant.SmsOrMmsRegex = /^com\.palm\.(sms|mms)message/;
// Shared serialization lock (epoch ms until which an activation holds it); 0 = free.
NewMessagesCommandAssistant._busyUntil = 0;