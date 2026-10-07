/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, Assert, JSON, Utils, DB, PalmCall, ContactBackupHash, PropertyArray, DefaultPropertyHash, Contact, ContactLinkable, Future */

var FavoriteBackup = exports.FavoriteBackup = Class.create({
	/** @lends FavoriteBackup#*/
	
	/**
	 * This defines a decorated FavoriteBackup.  This object hides the raw FavoriteBackup data and exposes methods for accessing decorated
	 * property objects for which getters/setters can be called.  These decorated properties also hide raw data, and can be passed 
	 * directly to framework widgets.
	 * @constructs
	 * @param {Object} rawFavoriteBackup - raw favoriteBackup object
	 * @example
	 * var favoriteBackup = new FavoriteBackup({
	 *                     contactBackupHash: 3XC8|local,
	 *                     defaultPropertyHashes: [{
	 *                          value: "FEF89&wef,jfew9823",
	 *                          type: "PhoneNumber",
	 *                          favoriteData: {...} }] 
	 *                });
	 * 
	 * var favoriteBackupContactHash = favoriteBackup.getContactBackupHash();
	 * var favoriteBackupDefaultPhoneNumber = favoriteBackup.getDefaultPhoneNumber();
	 */
	initialize: function (obj) {
		if (!obj) {
			obj = {};
		}
		
		var rawFavoriteBackup = obj,
			_data = {
				_kind: FavoriteBackup.kind,
				_id: rawFavoriteBackup._id,
				_rev: rawFavoriteBackup._rev,
				_del: rawFavoriteBackup._del,
				contactBackupHash: Utils.lazyWrapper(ContactBackupHash, [rawFavoriteBackup.contactBackupHash, true]),
				defaultPropertyHashes:  Utils.lazyWrapper(PropertyArray, [DefaultPropertyHash, rawFavoriteBackup.defaultPropertyHashes, true])
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
	 * Gets the contactId for this favorite backup from the contactBackupHash
	 * @returns {string} The id of the contact for this favorite backup
	 */
	getContactBackupHashContactId: function () {
		var backupHash = this.getContactBackupHash().getValue();
		
		return Contact.getIdFromLinkHash(backupHash);
	},
	
	/**
	 * @returns {array} The value of the default phone number for this favorite backup
	 */
	getDefaultPropertyHashes: function () {
		return this.accessor("defaultPropertyHashes");
	},
	
	/**
	 * Gets the default for this favorite backup
	 * @returns {object} The value of the default phone number for this favorite backup
	 */
	getDefaultsForContactPointType: function (contactPointType) {
		var propertyHashes = this.getDefaultPropertyHashes().getArray(),
			i,
			tempProperty,
			toReturn = [];
			
		for (i = 0; i < propertyHashes.length; i += 1) {
			tempProperty = propertyHashes[i];
			if (tempProperty.getType() === contactPointType) {
				toReturn.push(tempProperty);
			}
		}
		
		return toReturn;
	},
	
	/**
	 * Set the default phone number value for this favorite backup
	 * @param {string} value - the value of the phone number to set as default
	 * @param {string} contactPointType - the type of contact point this favorite is set on
	 * @param {object} favoriteData - the data on the favorite to back up
	 * @returns {boolean}
	 */
	setDefaultForContactPointType: function (value, contactPointType, favoriteData) {
		var propertyHashes = this.getDefaultPropertyHashes(),
			propertyHashesArray = propertyHashes.getArray(),
			i,
			tempProperty,
			foundEntry = false;
			
		for (i = 0; i < propertyHashesArray.length; i += 1) {
			tempProperty = propertyHashesArray[i];
			if (tempProperty.getType() === contactPointType && tempProperty.isPlainValueEqual(value)) {
				foundEntry = true;
				tempProperty.setFavoriteData(favoriteData);
				break;
			} else if (tempProperty.getType() === contactPointType && tempProperty.isPlainValueEqual(null)) {
				foundEntry = true;
				tempProperty.setFavoriteData(favoriteData);
				tempProperty.setType(contactPointType);
				tempProperty.setPlainValue(value);
				break;
			}
		}
		
		if (!foundEntry) {
			tempProperty = new DefaultPropertyHash();
			tempProperty.setPlainValue(value);
			tempProperty.setType(contactPointType);
			tempProperty.setFavoriteData(favoriteData);
			propertyHashes.add(tempProperty);
		}
		
		return true;
	},
	
	/**
	 * Delete the current favorite backup from the DB
	 * @returns {Future} The Future.result will be set to result of the call the delete the favorite backup from the DB.
	 */
	deleteFavoriteBackup: function () {
		var id = this.getId();
		Assert.requireDefined(id, "deleteFavoriteBackup unable to delete, there is no _id param");
		
		return DB.del([id]);
	},
	
	/**
	 * Save the current favoriteBackup to the DB
	 * @returns {Future} The Future.result will be set to result of the call the save the favoriteBackup to the DB.
	 */
	save: function () {
		return DB.put([this.getDBObject()]).then(this, function (future) {
			var result = Utils.DBResultHelper(future.result);
			Assert.require(result, "FavoriteBackup save put - result is null");
			Assert.requireArray(result, "FavoriteBackup save");
			Assert.require(result.length, "FavoriteBackup save put - result length is zero");
			
			this.setId(result[0].id);
			this.setRev(result[0].rev);
			future.result = true;
		});
	},
	
	/**
	 * Returns the string representation of {@link FavoriteBackup#getDBOBject}.  This is for testing.
	 * @returns {string}
	 */
	toString: function () {
		return JSON.stringify(this.getDBObject());
	}
});

FavoriteBackup.kind = "com.palm.person.favoritebackup:1";

/**
 * Gets a favorite backup for a given contact.
 * @param {object} contact - the contact that the favorite backup is associated with
 * @returns {Future.result -> FavoriteBackup} The favorite backup for the contact id specified
 */
FavoriteBackup.getBackupForContact = function (contact) {
	Assert.require(contact, "FavoriteBackup.getBackupForContact requires a contact");
	
	var future = new Future();
	
	future.now(function () {
		return ContactLinkable.getLinkHash(contact);
	});
	
	future.then(function () {
		var result = future.result.linkHash;
		
		return FavoriteBackup.getBackupForLinkhash(result);
	});
	
	return future;
};

FavoriteBackup.getBackupForLinkhash = function (linkHash) {
	var future = new Future();
	
	future.now(function () {
		return DB.find({
			"from": FavoriteBackup.kind,
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
			future.result = new FavoriteBackup(result[0]);
		} else {
			future.result = undefined;
		}
	});
	
	return future;
};

/**
 * Remove a favorite backup for a given contact.
 * @param {object} contact - the contact that the favorite backup is associated with
 * @returns {Future.result -> boolean} Indicates if removing the backup was successful
 */
FavoriteBackup.removeBackupForContact = function (contact) {
	Assert.require(contact, "FavoriteBackup.removeBackupForContact requires a contact");
	
	var future = new Future();
	
	future.now(function () {
		return ContactLinkable.getLinkHash(contact);
	});
	
	future.then(function () {
		var contactHash = future.result.linkHash,
			query = {
				"from": FavoriteBackup.kind,
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