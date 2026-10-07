/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, Class, Utils, Person, ArrayUtil, Future, DB, PersonFactory */

//TODO - Add method for manual link of a contact to a person

var PersonLinkable = Class.create(Person, {
	initialize: function initialize(rawPerson) {
		this.$super(initialize)(rawPerson);
		//_.extend(this, person);
		
		// initialize the display properties
		this._init();
		
		// If a person was passed in, create display params based on the person params
		if (rawPerson) {
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
	
	addContact: function (contact) {
		if (contact) {
			if (contact.getId()) {
				this.getContactIds().add(contact.getId());
			}
		}
	},
	
	removeContactId: function (contactId) {
		if (contactId) {
			return this.getContactIds().remove(contactId);
		}
	},
	
	copyOfContactIds: function () {
		return ArrayUtil.copyOfArray(this.getContactIds().getDBObject());
	},
	
	mergeContactIds: function (otherContactIds) {
		if (otherContactIds) {
			//ArrayUtil.pushAll(this.contactsIds, otherContactsIds);
			this.getContactIds().add(otherContactIds);
		}
	},
	
	linkSingleContact: function (contact) {
		this.mergeContactIds([contact.getId()]);
	},
	
	mergePeople: function (peopleToMerge, doneMergeFuture) {
		this.mergePeopleAndContact(peopleToMerge, undefined, doneMergeFuture);
	},
	
	// People to merge may contain the current person.
	// In that case it is ignored in the array
	mergePeopleAndContact: function (peopleToMerge, contact, doneMergeFuture) {
		var doneSaveUpdatedPersonFuture = new Future(),
			doneRemovePeopleFromDBFuture = new Future(),
			doneGettingPersonForFutureSaving = new Future(),
			ids = [],
			i,
			tempPerson;

		if (peopleToMerge) {
			for (i = 0; i < peopleToMerge.length; i += 1) {
				tempPerson = peopleToMerge[i];
				if (tempPerson.getId() !== this.getId()) {
					ids.push(tempPerson.getId());
					this.mergeContactIds(tempPerson.getContactIds().getArray());
				}
			}
		}

		if (contact) {
			this.mergeContactIds([contact.getId()]);
		}

		doneSaveUpdatedPersonFuture.nest(this.save());

		doneSaveUpdatedPersonFuture.then(this, function (doneSaveFuture) {
			if (doneSaveFuture.result) {
				//console.log("Updated person record saved");
				doneRemovePeopleFromDBFuture.nest(DB.del(ids));
				//doneRemovePeopleFromDBFuture.result = true;
			} else {
				//console.log("Updated person record failed to save");
				doneMergeFuture.result = {
					newPerson: undefined
				};
			}
		});

		doneRemovePeopleFromDBFuture.then(this, function (doneRemove) {
			if (doneRemove.result && doneRemove.result.results) {
				//console.log("Removed the other person objects");
			} else {
				//console.log("!!!!Failed to remove the other person object!!!!");
			}

			doneGettingPersonForFutureSaving.nest(DB.find({
				"from": Person.kind,
				"where": [{
					"prop": "_id",
					"op": "=",
					"val": this.getId()
				}]
			}));
		});

		// We need to get the latest record from the db so we can do fix up on it later
		doneGettingPersonForFutureSaving.then(this, function (doneGettingCurrent) {
			var result = Utils.DBResultHelper(doneGettingCurrent.result);
			
			if (result) {
				if (result.length > 0) {
					doneMergeFuture.result = {
						newPerson: PersonFactory.createPersonLinkable(result[0])
					};
				} else {
					//console.log("Could not get the current person from db");
					doneMergeFuture.result = {
						newPerson: this
					};
				}
			} else {
				//console.log("Could not get the current person from db");
				doneMergeFuture.result = {
					newPerson: this
				};
			}

		});
	}
});