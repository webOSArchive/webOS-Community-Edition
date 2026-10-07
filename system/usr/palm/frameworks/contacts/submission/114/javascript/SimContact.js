/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, Class, _, Contact, Person, DisplayNameType, Organization, ContactPhoto, LIB_ROOT, Utils, SimIndex, SimEntryType, Assert, PhoneNumber, DB */


var SimContact = Class.create(Contact, {
	initialize: function initialize(obj) {
		this.$super(initialize)(obj);
		
		// initialize the display properties
		this._init(obj);
	},
	
	_init: function (obj) {
		if (!obj) {
			obj = {};
		}
		var hasDatabaseId = !!obj._id;
		//if (tempContact.getSimIndex() === index && tempContact.getSimEntryType() === type) 
		
		this.setKind(SimContact.kind);
		this._extendWithPropertyAndValue("simIndex", Utils.lazyWrapper(SimIndex, [obj.simIndex, hasDatabaseId]));
		this._extendWithPropertyAndValue("simEntryType", Utils.lazyWrapper(SimEntryType, [obj.simEntryType, hasDatabaseId]));
	},
	
	getSimIndex: function () {
		return this.accessor("simIndex");
	},
	
	setSimIndex: function (value) {
		this.getSimIndex().setValue(value);
	},
	
	getSimEntryType: function () {
		return this.accessor("simEntryType");
	},
	
	setSimEntryType: function (value) {
		this.getSimEntryType().setValue(value);
	},
	
	setPhoneNumber: function (obj) {
		var phoneNumbers = this.getPhoneNumbers().getArray(),
			phoneNumber;
		
		if (phoneNumbers.length > 0) {
			phoneNumber = this.getPhoneNumbers().getArray()[0];
			phoneNumber.setValue(obj.value ? obj.value : phoneNumber.getValue());
			phoneNumber.setType(obj.type ? obj.type : phoneNumber.getType());
		} else {
			this.getPhoneNumbers().add(new PhoneNumber(obj));
		}
	},
	
	deleteContactInDBOnly: function () {
		var id = this.getId();
		
		Assert.requireDefined(id, "deleteContactInDBOnly unable to delete, there is no _id param");
		
		// Just delete the contact by Id
		return DB.del([id]);
	},
	
	saveContactInDBOnly: function () {
		var future;
		
		// if this object has a DB _id then use merge
		if (this.getId()) {
			future = DB.merge([this.getDBObject()]);
		}
		else {
			future = DB.put([this.getDBObject()]);	
		}
		
		future.then(this, function (future) {
			var result = Utils.DBResultHelper(future.result);
			Assert.require(result, "SimContact save put - result is null");
			Assert.requireArray(result, "SimContact save");
			Assert.require(result.length, "SimContact save put - result length is zero");
			this.setId(result[0].id);
			this.setRev(result[0].rev);
			this.markNotDirty();
			future.result = true;
		});
		
		return future;
	}	
});

exports.SimContact = SimContact;

SimContact.getSimContactbyId = function (id) {
	Assert.requireDefined(id, "getSimContactById unable to get contact, there is no _id param");
	return DB.get([id]).then(function (future) {		
		var result = Utils.DBResultHelper(future.result),
			contactsToReturn = [];
		if (result && result.length > 0) {
			result.forEach(function (contact) {
				contactsToReturn.push(new SimContact(contact));
			});
			future.result = contactsToReturn;
		} else {
			future.result = [];
		}
	}); 
};

SimContact.getContactsByAccountId = function (accountId) {
	Assert.requireString(accountId, "SimContact.getContactsByAccountId requires an accountId that is a valid string");
	
	return DB.find({
		from: SimContact.kind,
		where: [{
			prop: "accountId",
			op: "=",
			val: accountId
		}],
		orderBy: "simIndex"
	}).then(function (future) {
		var result = Utils.DBResultHelper(future.result),
			contactsToReturn = [];
		if (result && result.length > 0) {
			result.forEach(function (contact) {
				contactsToReturn.push(new SimContact(contact));
			});
			future.result = contactsToReturn;
		} else {
			future.result = [];
		}
	});
};

SimContact.kind = "com.palm.contact.sim:1";