/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, Assert, JSON, Utils, DB, PalmCall, ContactBackupHash, PropertyArray, SpeedDialHash, Contact, ContactLinkable, Future */

var SpeedDialBackup = exports.SpeedDialBackup = Class.create({
	/** @lends SpeedDialBackup#*/
	
	/**
	 * This defines a decorated SpeedDialBackup.  This object hides the raw SpeedDialBackup data and exposes methods for accessing decorated
	 * property objects for which getters/setters can be called.  These decorated properties also hide raw data, and can be passed 
	 * directly to framework widgets.
	 * @constructs
	 * @param {Object} rawSpeedDialBackup - raw speedDialBackup object
	 * @example
	 * var speedDialBackup = new SpeedDialBackup({
	 *                     contactBackupHash: 3XC8|local,
	 *                     speedDials: [{
	 *                          key: "k",
	 *                          hashedPhoneNumber: "3289hjf2*#2320j"
	 *                });
	 * 
	 * var speedDialBackupContactHash = speedDialBackup.getContactBackupHash();
	 */
	initialize: function (obj) {
		if (!obj) {
			obj = {};
		}
		
		var rawSpeedDialBackup = obj,
			_data = {
				_kind: SpeedDialBackup.kind,
				_id: rawSpeedDialBackup._id,
				_rev: rawSpeedDialBackup._rev,
				_del: rawSpeedDialBackup._del,
				contactBackupHash: Utils.lazyWrapper(ContactBackupHash, [rawSpeedDialBackup.contactBackupHash, true]),
				speedDials: Utils.lazyWrapper(PropertyArray, [SpeedDialHash, rawSpeedDialBackup.speedDials, true])
			};

		/**
		 * This method should only be used internally.  This allows us to control access to the private data
		 * above.  This has been implemented to only fetch data.  This cannot be used to set the private fields.
		 * Individual setters will be implemented below for fields that require the ability to be set.
		 * @private
		 * @param {string} fieldName
		 */
		this.accessor = function (fieldName) {
			var field = _data[fieldName];
			Assert.requireDefined(fieldName, "fieldName must be specified for the accessor");
			//Assert.require(field, "the field you requested does not exist: _data[" + fieldName + "]");
			
			if (field && typeof field === "object" && field.isLazyWrapper) {
				field = _data[fieldName] = field.createInstance();
			}
			
			return field;
		};
		
		/**
		 * Setter for the _id field
		 * @param {string} id
		 */
		this.setId = function (id) {
			_data._id = id;
		};
		
		/**
		 * Setter for the _rev field
		 * @param {string} rev
		 */
		this.setRev = function (rev) {
			_data._rev = rev;
		};
		
		/**
		 * This converts the favoriteBackup into a database writable object
		 * This calls getDBObjects on all properties and combines the data into one object
		 * @returns {Object} The raw database object
		 */
		this.getDBObject = function () {
			return Utils.getDBObjectForAllProperties(this.accessor, _.keys(_data));
		};
	},

	/**
	 * Gets the id for favorite backup
	 * @returns {string} The id
	 */
	getId: function () {
		return this.accessor("_id");
	},

	/**
	 * Gets the kind for favorite backup
	 * @returns {string} The kind
	 */
	getKind: function () {
		return this.accessor("_kind");
	},
	
	/**
	 * Gets the contactBackupHash for this favorite backup
	 * @returns {string} The contactBackupHash
	 */
	getContactBackupHash: function () { 
		return this.accessor("contactBackupHash");
	},
	
	/**
	 * Gets the contactId for this speeddial backup from the contactBackupHash
	 * @returns {string} The id of the contact for this speeddial backup
	 */
	getContactBackupHashContactId: function () {
		var backupHash = this.getContactBackupHash().getValue();
		
		return Contact.getIdFromLinkHash(backupHash);
	},
	
	/**
	 * @returns {array} The speeddials for this contact
	 */
	getSpeedDials: function () {
		return this.accessor("speedDials");
	},
	
	/**
	 * Delete the current speeddial backup from the DB
	 * @returns {Future} The Future.result will be set to result of the call the delete the speeddial backup from the DB.
	 */
	deleteSpeedDialBackup: function () {
		var id = this.getId();
		Assert.requireDefined(id, "deleteSpeedDialBackup unable to delete, there is no _id param");
		
		return DB.del([id]);
	},
	
	/**
	 * Save the current speeddial backup to the DB
	 * @returns {Future} The Future.result will be set to result of the call the save the speeddialBackup to the DB.
	 */
	save: function () {
		return DB.put([this.getDBObject()]).then(this, function (future) {
			var result = Utils.DBResultHelper(future.result);
			Assert.require(result, "SpeedDialBackup save put - result is null");
			Assert.requireArray(result, "SpeedDialBackup save");
			Assert.require(result.length, "SpeedDialBackup save put - result length is zero");
			
			this.setId(result[0].id);
			this.setRev(result[0].rev);
			future.result = true;
		});
	},
	
	/**
	 * Returns the string representation of {@link SpeedDialBackup#getDBOBject}.  This is for testing.
	 * @returns {string}
	 */
	toString: function () {
		return JSON.stringify(this.getDBObject());
	}
});

SpeedDialBackup.kind = "com.palm.person.speeddialbackup:1";

/**
 * Gets a speeddial backup for a given contact.
 * @param {object} contact - the contact that the speeddial backup is associated with
 * @returns {Future.result -> SpeedDialBackup} The speeddial backup for the contact id specified
 */
SpeedDialBackup.getBackupForContact = function (contact) {
	Assert.require(contact, "SpeedDialBackup.getBackupForContact requires a contact");
	
	var future = new Future();
	
	future.now(function () {
		return ContactLinkable.getLinkHash(contact);
	});
	
	future.then(function () {
		var result = future.result.linkHash;
		
		return SpeedDialBackup.getBackupForLinkhash(result);
	});
	
	return future;
};

SpeedDialBackup.getBackupsForLinkHashes = function (linkHashes) {
	var future = new Future();
	
	future.now(function () {
		return DB.find({
			"from": SpeedDialBackup.kind,
			"where": [{
				"prop": "contactBackupHash",
				"op": "=",
				"val": linkHashes
			}]
		});
	});
	
	future.then(function () {
		//console.log(JSON.stringify(future.result));
		var result = Utils.DBResultHelper(future.result),
			speedDialBackups = [];
		if (result) {
			result.forEach(function (rawSpeedDialBackup) {
				speedDialBackups.push(new SpeedDialBackup(result[0]));
			});
			
			return speedDialBackups;
		} else {
			future.result = undefined;
		}
	});
	
	return future;
};

SpeedDialBackup.getBackupForLinkHash = function (linkHash) {
	var future = new Future();
	
	future.now(function () {
		return DB.find({
			"from": SpeedDialBackup.kind,
			"where": [{
				"prop": "contactBackupHash",
				"op": "=",
				"val": linkHash
			}]
		});
	});
	
	future.then(function () {
		//console.log(JSON.stringify(future.result));
		var result = Utils.DBResultHelper(future.result);
		if (result && result[0]) {
			future.result = new SpeedDialBackup(result[0]);
		} else {
			future.result = undefined;
		}
	});
	
	return future;
};

/**
 * Remove a speeddial backup for a given contact.
 * @param {object} contact - the contact that the speeddial backup is associated with
 * @returns {Future.result -> boolean} Indicates if removing the backup was successful
 */
SpeedDialBackup.removeBackupForContact = function (contact) {
	Assert.require(contact, "SpeedDialBackup.removeBackupForContact requires a contact");
	
	var future = new Future();
	
	future.now(function () {
		return ContactLinkable.getLinkHash(contact);
	});
	
	future.then(function () {
		var contactHash = future.result.linkHash,
			query = {
				"from": SpeedDialBackup.kind,
				"where": [{
					"prop": "contactBackupHash",
					"op": "=",
					"val": contactHash
				}]
			};
		
		return DB.del(query);
	});
	
	future.then(function () {
		var result = Utils.DBResultHelper(future.result);
		return result && result.count > 0;
	});
	
	return future;
};