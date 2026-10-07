/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, Class, Contact, exports, ArrayUtil, Future, PersonFactory, Person, DB, PalmCall, Assert */

var ContactLinkable = exports.ContactLinkable = Class.create(Contact, {
	initialize: function initialize(rawContact) {
		this.$super(initialize)(rawContact);
		//_.extend(this, person);
		
		// initialize the display properties
		this._init();
		
		// If a person was passed in, create display params based on the person params
		if (rawContact) {
			//this.generateDisplayParams();
		}
	},
	
	/**
	 * These are linkable-only properties
	 */
	_init: function () {
		// this.displayName = "";
		// this.fullName = "";
		// this.workInfoLine = "";
		// this.contactCount = "";
	},

	/**
	 * Reset the linkable params and the params on the person
	 */
//	reset: function reset() {
//		this.$super(reset)();
//		this._init();
//	},
	
	getLinkHash: function () {
		return ContactLinkable.getLinkHash(this);
	},
	
	getPersonFromCLBObject: function (clbLink) {
		var future = new Future(),
			returningBothPersonRecords = false;
		
		future.now(this, function () {
			return this.getLinkHash();
		});
			
		future.then(this, function () {
			var linkHash = future.result.linkHash,
				idToFetch,
				clbLinkA,
				clbLinkB;
			
			if (clbLink.contactEntityA === linkHash) {
				idToFetch = clbLink.contactEntityB.split("|")[1];
			} else if (clbLink.contactEntityB === linkHash) {
				idToFetch = clbLink.contactEntityA.split("|")[1];
			} else {
				returningBothPersonRecords = true;
				clbLinkA = clbLink.contactEntityA.split("|")[1];
				clbLinkB = clbLink.contactEntityB.split("|")[1];
			}

			if (returningBothPersonRecords) {
				return ContactLinkable.getTwoPeopleFromLinkHashIds(clbLinkA, clbLinkB);
			} else {
				return ContactLinkable.getOnePersonFromLinkHashId(idToFetch);
			}
		});
		
		future.then(this, function () {
			var result = future.result;
			
			if (returningBothPersonRecords) {
				return result;
			} else {
				return [result];
			}
		});
		
		return future;
	}
});

ContactLinkable.getTwoPeopleFromLinkHashIds = function (linkHashId1, linkHashId2) {
	var contactIdDelimIndex = linkHashId1.indexOf(ContactLinkable.LOCAL_ID_DELIM),
		bothContactIds = false,
		link1IsContactId = false,
		link2IsContactId = false,
		toReturn = [];
	
	if (contactIdDelimIndex !== -1) {
		linkHashId1 = linkHashId1.substring(contactIdDelimIndex + ContactLinkable.LOCAL_ID_DELIM.length);
		bothContactIds = true;
		link1IsContactId = true;
	}
	
	contactIdDelimIndex = linkHashId2.indexOf(ContactLinkable.LOCAL_ID_DELIM);
	
	if (contactIdDelimIndex !== -1) {
		linkHashId2 = linkHashId2.substring(contactIdDelimIndex + ContactLinkable.LOCAL_ID_DELIM.length);
		link2IsContactId = true;
	} else {
		bothContactIds = false;
	}
	
	if (bothContactIds) {
		// Both linkHashes are contactIds so get both people using the linkhashes as contactIds
		return ContactLinkable.batchGetTwoPeopleWithContactIds(linkHashId1, linkHashId2);
	} else if ((link1IsContactId && !link2IsContactId) || (!link1IsContactId && link2IsContactId)) {
		// One or the other is a contactId so we can't get them via batch. Use getOnePersonFromLinkHashId
		// to get the people from each link hash
		return ContactLinkable.getOnePersonFromLinkHashId(linkHashId1).then(function (future) {
			var result = future.result;
			
			toReturn.push(result);
			
			return ContactLinkable.getOnePersonFromLinkHashId(linkHashId2).then(function (secondPersonFuture) {
				var result = secondPersonFuture.result;

				toReturn.push(result);
				
				return toReturn;
			});
		});
	} else {
		// Neither of the link hashes are contactIds, both are remoteIds, so do a batch and get the contacts
		// then people that have those contacts.
		return ContactLinkable.batchGetTwoContactsWithRemoteIds(linkHashId1, linkHashId2).then(function (future) {
			var result = future.result,
				contact1 = result.contact1,
				contact2 = result.contact2;
			
			if (contact1 && contact2) {
				return ContactLinkable.batchGetTwoPeopleWithContactIds(contact1.getId(), contact2.getId());
			} else {
				return null;
			}
		});
	}
};

ContactLinkable.batchGetTwoContactsWithRemoteIds = function (remoteId1, remoteId2) {
	var future = new Future();
	
	future.now(function () {
		return DB.execute("batch", {
			operations: [{
				method: "find",
				params: {
					query: {
						"from": Contact.kind,
						"where": [{
							"prop": "remoteId",
							"op": "=",
							"val": remoteId1
						}]
					}
				}
			}, {
				method: "find",
				params: {
					query: {
						"from": Contact.kind,
						"where": [{
							"prop": "remoteId",
							"op": "=",
							"val": remoteId2
						}]
					}
				}
			}]
		});
	});
	
	future.then(function () {
		var result = future.result,
			contact1,
			contact2;
		
		if (result && result.responses && result.responses.length > 1) {
			contact1 = new Contact(result.responses[0].results[0]);
			contact2 = new Contact(result.responses[1].results[0]);
		}
		
		return {
			contact1: contact1,
			contact2: contact2
		};
	});
	
	return future;
};

ContactLinkable.batchGetTwoPeopleWithContactIds = function (contactId1, contactId2) {
	var future = new Future();
	
	future.now(function () {
		return DB.execute("batch", {
			operations: [{
				method: "find",
				params: {
					query: {
						"from": Person.kind,
						"where": [{
							"prop": "contactIds",
							"op": "=",
							"val": contactId1
						}]
					}
				}
			}, {
				method: "find",
				params: {
					query: {
						"from": Person.kind,
						"where": [{
							"prop": "contactIds",
							"op": "=",
							"val": contactId2
						}]
					}
				}
			}]
		});
	});
	
	future.then(function () {
		var result = future.result,
			toReturn = [];
		
		if (result && result.responses && result.responses.length > 1) {
			toReturn[0] = new Person(result.responses[0].results[0]);
			toReturn[1] = new Person(result.responses[1].results[0]);
		} 
		
		return toReturn;
	});
	
	return future;
};

ContactLinkable.getOnePersonFromLinkHashId = function (linkHashId) {
	var contactIdDelimIndex = linkHashId.indexOf(ContactLinkable.LOCAL_ID_DELIM);
	
	if (contactIdDelimIndex !== -1) {
		linkHashId = linkHashId.substring(contactIdDelimIndex + ContactLinkable.LOCAL_ID_DELIM.length);
		
		return Person.findByContactIds([linkHashId]);
	} else {
		return Contact.getContactByRemoteId(linkHashId).then(function (future) {
			var result = future.result;
			
			if (result) {
				return Person.findByContactIds([result.getId()]);
			} else {
				return null;
			}
		});
	}
};

ContactLinkable.getIdFromLinkHash = function (linkHash) {
	var idPart = linkHash.split("|")[1],
		contactIdDelimIndex = idPart.indexOf(ContactLinkable.LOCAL_ID_DELIM),
		toReturn,
		future = new Future();
	
	future.now(function () {
		if (contactIdDelimIndex !== -1) {
			return idPart.substring(contactIdDelimIndex + ContactLinkable.LOCAL_ID_DELIM.length);
		} else {
			return Contact.getContactByRemoteId(idPart).then(function (getContactFuture) {
				var result = getContactFuture.result;

				if (result) {
					return result.getId();
				} else {
					return null;
				}
			});
		}
	});
	
	
	return future;
};

ContactLinkable.LOCAL_ID_DELIM = "~~:(!)~~";

/*
	Remote Contact:
	syncSource|remoteID|acctUsername
	syncSource = The type of sync source for this contact. (Facebook, LinkedIn, IM)
	remoteID = The id of the contact from the sync source. This is a persistent id from the server.
	acctUsername = The username of the account for this sync source. We need this because using syncSource and remoteID is not unique enough by themselves.

	Sim Contact:
	SIM|idx|(sim imsi)
	idx = The index of the contact coming from the SIM card.
	
	Local Contact (Palm Profile):
	Local|remoteID
	remoteID = The id given to a palm profile contact. This id is persistent across restores.

	ATT AddressBook:
	ATTBook|remoteID
	remoteID = This will be the id given from ATT's server when fetching or creating a contact.
*/
ContactLinkable.getLinkHash = function (contact) {
	var future = new Future();
	
	future.now(function () {
		var contactKindName = contact.getKindName();
		
		switch (contactKindName) {
		case "com.palm.contact.sim":
			return ContactLinkable.getSimContactHash(contact);
		case "com.palm.contact.attaddresssync":
			return { 
				syncSource: "ATTBook",
				remoteId: contact.getRemoteId()
			};
		case "com.palm.contact.palmprofile":
			return { 
				syncSource: "Local",
				remoteId: contact.getRemoteId()
			};
		default :
			return ContactLinkable.getRemoteContactHash(contact);
		}
	});
	
	future.then(function () {
		var result = future.result,
			syncSource = result.syncSource,
			acctUsername = result.acctUsername,
			remoteId = result.remoteId,
			toReturn;
		
		if (remoteId) {
			toReturn = syncSource + "|" + remoteId;
		} else {
			// Handle accounts that do not have a remoteId for the time being by using their mojodb id.
			// This should be unique enough with the other pieces that it won't clash across backup and restore.
			toReturn = syncSource + "|" + ContactLinkable.LOCAL_ID_DELIM + contact.getId();
		}
		
		toReturn += (acctUsername ? "|" + acctUsername : "");
		
		return {
			linkHash: toReturn,
			shouldBackup: !!remoteId
		};
	});
	
	return future;
};

ContactLinkable.getSimContactHash = function (contact) {
	/*var future = new Future(),
		simContact,
		idx;
	
	future.now(function () {
		return SimContact.getSimContactbyId(contact.getId());
	});
	
	future.then(function () {
		// get the simindex from the returned contact
		var simContact = future.result;
		
		idx = simContact.getSimIndex();
		
		return DB.find({
			from: "com.palm.account.transport.sim:1",
			where: where
		});
	});
	
	future.then(function () {
		var result = future.result;
		// get the imsi from the returned sim account transport object
	});*/
	
	return { 
		syncSource: "SIM"
	};
};

ContactLinkable.getRemoteContactHash = function (contact) {
	var future = new Future();
	
	future.now(function () {
		return PalmCall.call("palm://com.palm.service.accounts", "getAccountInfo", {
			accountId: contact.getAccountId().getValue()
		});
	});
	
	future.then(function () {
		var result = future.result,
			accountObject,
			capability,
			kindName = contact.getKindName(true);
		
		Assert.require(result.returnValue, "ContactLinkable.getRemoteContactHash failed because com.palm.service.accounts returned a falsy returnValue");
		Assert.require(result.result, "ContactLinkable.getRemoteContactHash failed because com.palm.service.accounts did not return a result.result");
		
		accountObject = result.result;
		
		capability = _.detect(accountObject.capabilityProviders, function (capabilityProvider) {
			return capabilityProvider && capabilityProvider.dbkinds && capabilityProvider.dbkinds.contact && (capabilityProvider.dbkinds.contact === kindName);
		});
		
		return {
			syncSource: capability ? capability.id : undefined,
			remoteId: contact.getRemoteId(),
			acctUsername: accountObject.username
		};
	});
	
	return future;
};