/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, console, Class, Assert, PalmCall, JSON, Utils, PersonDisplayLite, PropertyArray, Contact, ContactId, Name, DisplayName, 
Photo, CachedPhoto, EmailAddressExtended, PhoneNumberExtended, IMAddressExtended, Nickname, Relation, SpeedDialSaver, 
SearchTerm, SortKey, PersonFactory, ContactFactory, Future, _, Contact, DB, Organization, Reminder, Ringtone, PhoneNumber, EmailAddress, 
IMAddress, DisplayNameType, Favorite, ContactType, PersonType, PersonDisplay, PersonLinkable, FavoriteBackup, ContactLinkable,
Address, Url, Gender, Anniversary, Birthday, Note, Globalization, LauncherId, AppPrefs, ListWidget, ContactPointTypes, FingerWalkerSorter, PersonPhotos, RB, ContactPhoto, Foundations */


// TODO: Handle the case where we this person has contacts that have favoritebackups but the favorite information for this person is not up to date

var Person = Class.create({
	/** @lends Person#*/
	
	/**
	 * This defines a decorated Person.  This object hides the raw person data and exposes methods for accessing decorated
	 * property objects for which getters/setters can be called.  These decorated properties also hide raw data, and can be passed 
	 * directly to framework widgets.
	 * @constructs
	 * @param {Object} rawPerson - raw person object
	 * @example
	 * var person = new Person({
	 *		"displayName": "Mr. Austin Danger Powers Jr",
	 *		"contactIds": ["aa1", "aa2", "aa3"],
	 *		"names": [{
	 *			"honorificPrefix": "Mr",
	 *			"givenName": "Austin",
	 *			"middleName": "Danger",
	 *			"familyName": "Powers",
	 *			"honorificSuffix": "Jr"
	 *		}],
	 *		"name": {
	 *			"honorificPrefix": "Mr",
	 *			"givenName": "Austin",
	 *			"middleName": "Danger",
	 *			"familyName": "Powers",
	 *			"honorificSuffix": "Jr"
	 *		},
	 *		"emails": [{
	 *			"value": "someAddress@gmail.com",
	 *			"type": null,
	 *			"primary": false
	 *		}],
	 *		"phoneNumbers": [{
	 *			"value": "(444) 123-1234",
	 *			"type": "mobile",
	 *			"isPrimary": true
	 *		}],
	 *		"ims": [{
	 *			"value": "someAddress",
	 *			"type": "type_gtalk",
	 *			"primary": false
	 *		}]
	 *	});
	 * 
	 * var givenNameString = name.getGivenName();
	 * var givenNameString = name.x_givenName; // This is for use in widgets. Code should always call the getter rather than accessing the property.
	 */
	initialize: function (rawPerson) {
		if (!rawPerson) {
			rawPerson = {};
		}
		var hasDatabaseId = !!rawPerson._id,
			constructedFromContact = rawPerson instanceof Contact,
			_data = {
				_kind: Person.kind,
				_id: (rawPerson._id || undefined), // should be primitive type Or a different property name
				_rev: rawPerson._rev,
				_del: rawPerson._del,
				favorite: Utils.lazyWrapper(Favorite, [rawPerson.favorite, hasDatabaseId]),
				contactIds: Utils.lazyWrapper(PropertyArray, [ContactId, rawPerson.contactIds, hasDatabaseId]),
				sortKey: Utils.lazyWrapper(SortKey, [rawPerson.sortKey, hasDatabaseId]),
				name: Utils.lazyWrapper(Name, [rawPerson.name, hasDatabaseId]),
				names: Utils.lazyWrapper(PropertyArray, [Name, rawPerson.names, hasDatabaseId]),
				nickname: Utils.lazyWrapper(Nickname, [rawPerson.nickname, hasDatabaseId]),
				organization: Utils.lazyWrapper(Organization, [rawPerson.organization, hasDatabaseId]),
				searchTerms: Utils.lazyWrapper(PropertyArray, [SearchTerm, rawPerson.searchTerms, hasDatabaseId]),
				emails: Utils.lazyWrapper(PropertyArray, [EmailAddressExtended, rawPerson.emails, hasDatabaseId]),
				phoneNumbers: Utils.lazyWrapper(PropertyArray, [PhoneNumberExtended, rawPerson.phoneNumbers, hasDatabaseId]),
				ims: Utils.lazyWrapper(PropertyArray, [IMAddressExtended, rawPerson.ims, hasDatabaseId]),
				photos: Utils.lazyWrapper(PersonPhotos, [rawPerson.photos, hasDatabaseId]),
				addresses: Utils.lazyWrapper(PropertyArray, [Address, rawPerson.addresses, hasDatabaseId]),
				urls: Utils.lazyWrapper(PropertyArray, [Url, rawPerson.urls, hasDatabaseId]),
				notes: Utils.lazyWrapper(PropertyArray, [Note, rawPerson.notes, hasDatabaseId]),
				birthday: Utils.lazyWrapper(Birthday, [rawPerson.birthday, hasDatabaseId]),
				anniversary: Utils.lazyWrapper(Anniversary, [rawPerson.anniversary, hasDatabaseId]),
				gender: Utils.lazyWrapper(Gender, [rawPerson.gender, hasDatabaseId]),
				reminder: Utils.lazyWrapper(Reminder, [rawPerson.reminder, hasDatabaseId]),
				launcherId: Utils.lazyWrapper(LauncherId, [rawPerson.launcherId, hasDatabaseId]),
				relations: Utils.lazyWrapper(PropertyArray, [Relation, rawPerson.relations, hasDatabaseId]),
				ringtone: Utils.lazyWrapper(Ringtone, [rawPerson.ringtone, hasDatabaseId])
			},
			_contacts = new PropertyArray(Contact, null),
			_transientFavoriteState = { 
				instantiationFavoriteValue: false,
				favoriteDefaultsChanged: false
			},
			_beingSaved = false;
		
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
		
		_transientFavoriteState.instantiationFavoriteValue = this.accessor("favorite").getValue();
		
		/**
		 * PRIVATE
		 * Gets the _transientFavoriteState object to determine what the current state of various favorite
		 * information is in relation to its save status.
		 * @returns {object}
		 */
		this._getTransientFavoriteState = function () {
			return _transientFavoriteState;
		};
		
		/**
		 * PRIVATE
		 * Indicates if this person is currently being saved
		 * @returns {boolean}
		 */
		this._isBeingSaved = function () {
			return _beingSaved;
		};
		
		/**
		 * PRIVATE
		 * Setter for the _setBeingSaved field
		 * @param {boolean} value
		 */
		this._setBeingSaved = function (value) {
			_beingSaved = value;
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
		 * Fetches the Array of linked contacts for this person.  The array is a shallow copy of the internal array that is stored in {@link PropertyArray}.
		 * Inserting/removing elements from this array will not change what is stored in {@link PropertyArray} (you should not do this).  However, the elements in the array are references
		 * to the real decorated {@link Contact} objects.  You can call getters/setters on these elements and those changes will be reflected on the {@link Person}.
		 * @returns {Array}
		 */
		this.getContacts = function () {
			return _contacts.getArray();
		};
		
		/**
		 * Stores an array of contacts on this person
		 * @param {Array} contacts - this array can consist of raw contact objects and/or decorated {@link Contact} objects
		 */
		this.setContacts = function (contacts) {
			_contacts.set(contacts);
		};
		
		/**
		 * This converts the person into a database writable object
		 * This calls getDBObjects on all properties and combines the data into one object
		 * @returns {Object} The raw database object
		 */
		this.getDBObject = function () {
			return Utils.getDBObjectForAllProperties(this.accessor, _.keys(_data));
		};

		/**
		 * This converts the person into a database writable object
		 * This calls getDBObjects on all properties that are dirty and combines the data into one object.
		 * it does not include the _rev so the object is sutiable for a merge.
		 * @returns {Object} The raw database object for dirty properties suitable for a merge
		 */
		this.getDirtyDBObject = function () {
			return Utils.getDBObjectForAllDirtyProperties(this.accessor, _.keys(_data));
		};

		if (constructedFromContact) {
			this.populateFromContact(rawPerson);
		}
	},
	
	// This is intended to be used for UI hacks.
	populateFromContact: function (contact) {
		Assert.requireDefined(contact, "populateFromContact requires a person argument");
		Assert.require(contact instanceof Contact, "populateFromContact requires a person argument that is a child of Person");
		
		this.setContacts([contact]);
		this.fixupNoReloadContacts();
		
		return true;
	},
	
	// Public
	/**
	 * Returns the person kind string
	 * @returns {string}
	 */
	getKind: function () {
		return this.accessor("_kind");
	},
	
	/**
	 * Returns the database id for the person ("_id")
	 * @returns {string}
	 */
	getId: function () {
		return this.accessor("_id");
	},
	
	/**
	 * Returns the launcherId of this person
	 * @returns {string}
	 */
	getLauncherId: function () {
		return this.accessor("launcherId");
	},
	
	/**
	 * Returns the launcher id for a person seperated by the Person.DELIMITER
	 * @returns {string}
	 */
	generateLauncherCallbackId: function () {
		var contactIds = this.getContactIds().getArray(),
			toReturn = "";
		
		contactIds = contactIds.map(function (contactId) {
			return contactId.getValue();
		});
		
		return contactIds.join(Person.DELIMITER);
	},
	
	/**
	 * Returns the database revision for the person ("_rev")
	 * @returns {string}
	 */
	getRev: function () {
		return this.accessor("_rev");
	},
	
	/**
	 * Returns a boolean that indicates if the person has been marked for deletion
	 * @returns {boolean}
	 */
	markedForDelete: function () {
		return this.accessor("_del") || false;
	},
	
	/**
	 * Mark this person as a favorite
	 * @param {object} 
	 * @returns {Future}
	 */
	makeFavorite: function (param) {
		if (!param || (typeof param !== "object")) {
			param = {};
		}
		
		param.personId = this.getId();
		
		this.accessor("favorite").setValue(true);
		return Person.favoritePerson(param);
	},

	/**
	 * Un-mark this person as a favorite
	 * @param {object} - [{personId: "personId"}]
	 * @returns {Future}
	 */	
	unfavorite: function (param) {
		if (!param || (typeof param !== "object")) {
			param = {};
		}
		
		param.personId = this.getId();
		
		this.accessor("favorite").setValue(false);
		return Person.unfavoritePerson(param);
	},
	
	/**
	 * Returns if the person is marked as a favorite
	 * @returns {boolean}
	 */
	isFavorite: function () {
		return this.accessor("favorite").getValue() || false;
	},

	/**
	 * PRIVATE
	 * Returns a reference to the decorated {@link Favorite} object that is stored on this person
	 * @returns {Favorite}
	 */
	getFavorite: function () {
		return this.accessor("favorite");
	},
	
	setFavoriteDefault: function (param) {
		if (!param || (typeof param !== "object")) {
			param = {};
		}
		
		param.personId = this.getId();
		
		return Person.setFavoriteDefault(param);
	},
	
	_getDefaultContactPointsForTypeAndAppId: function (contactPointType, applicationID) {
		var toReturn = [],
			tempData,
			tempArray,
			hasFavoriteDataEntry,
			i,
			getAllFavorites = applicationID ? false : true;
		
		tempArray = this._getContactPointArrayForType(contactPointType);
		
		// TODO could use filter
		for (i = 0; i < tempArray.length; i += 1) {
			tempData = tempArray[i];
			
			if (getAllFavorites) {
				hasFavoriteDataEntry = tempData.hasFavoriteDataForAnyApp();
			} else {
				hasFavoriteDataEntry = tempData.getFavoriteDataForAppWithId(applicationID);
			}
			
			if (hasFavoriteDataEntry) {
				toReturn.push(tempData);
			}
		}
		
		return toReturn;
	},
	
	_setDefaultForContactPointType: function (contactPointType, normalizedValue, type, applicationID, listIndex, auxData) {
		var contactPointArray,
			contactPointPropertyArray,
			contactPoint,
			itemIndex;
		
		contactPointPropertyArray = this._getContactPointArrayForType(contactPointType, true);
		contactPointArray = contactPointPropertyArray.getArray();
		contactPoint = _.detect(contactPointArray, function (item, curIndex) {
			if (item.getNormalizedValue() === normalizedValue && item.getType() === type) {
				itemIndex = curIndex;
				return true;
			}
		});
		
		if (contactPoint) {
			contactPoint.addFavoriteData(applicationID, {
				listIndex: listIndex,
				auxData: auxData
			});
			
			// Bubble the newly selected default to the top of the property array for that contact point
			contactPointArray.splice(itemIndex, 1);
			contactPointPropertyArray.clear();
			contactPointPropertyArray.add(contactPoint);
			contactPointPropertyArray.add(contactPointArray);
			
			return true;
		} else {
			return false;
		}
	},
	
	_getContactPointArrayForType: function (contactPointType, returnPropertyArray) {
		var toReturn;
		
		switch (contactPointType) {
		case ContactPointTypes.PhoneNumber:
			toReturn = this.getPhoneNumbers();
			break;
		case ContactPointTypes.EmailAddress:
			toReturn = this.getEmails();
			break;
		case ContactPointTypes.IMAddress:
			toReturn = this.getIms();
			break;
		// case ContactPointTypes.Address:
		// toReturn = this.getAddresses().getArray();
		// break;
		// case ContactPointTypes.Url:
		// toReturn = this.getUrls().getArray();
		// break;
		default:
			if (returnPropertyArray) {
				toReturn = new PropertyArray(Object, {});
				toReturn.add(this.getPhoneNumbers().getArray());
				toReturn.add(this.getEmails().getArray());
				toReturn.add(this.getIms().getArray());
				//toReturn.add(this.getAddresses().getArray());
				//toReturn.add(this.getUrls().getArray());
			} else {
				toReturn = [];
				toReturn = toReturn.concat(this.getPhoneNumbers().getArray());
				toReturn = toReturn.concat(this.getEmails().getArray());
				toReturn = toReturn.concat(this.getIms().getArray());
				//toReturn = toReturn.concat(this.getAddresses().getArray());
				//toReturn = toReturn.concat(this.getUrls().getArray());
			}
			
			return toReturn;
		}
		
		return returnPropertyArray ? toReturn : toReturn.getArray();
	},
	
	/**
	 * PRIVATE
	 * Tells you if the person's favorite value has changed since the last save
	 * @returns {boolean}
	 */
	hasInstantiationFavoriteValueChanged: function () {
		return (this._getTransientFavoriteState().instantiationFavoriteValue !== this.getFavorite().getValue());
	},
	
	// If the person is being saved then we want to update the favorite values current state. This is because
	// when we save we will perform any favorite backup work that is necessary. From this person's point of view,
	// its favorite state will be what ever state is currently being saved. This allows us to manipulate the favorite
	// value on a person in memory that already had its favorite state changed and saved.
	/**
	 * PRIVATE
	 * Updates the instantiationFavoriteValue state to the current favorite value
	 */
	_updateInstantiationFavoriteValueToCurrentState: function () {
		if (this._isBeingSaved()) {
			this._getTransientFavoriteState().instantiationFavoriteValue = this.getFavorite().getValue();
		}
	},
	
	/**
	 * PRIVATE
	 * Tells you if the communication point's default values have changed since the last save
	 * @returns {boolean}
	 */
	_hasFavoriteDefaultsChanged: function () {
		return this._getTransientFavoriteState().favoriteDefaultsChanged;
	},
	
	/**
	 * PRIVATE
	 * Mark that any of the communication point's defaults have changed
	 */
	_markFavoriteDefaultsChanged: function () {
		this._getTransientFavoriteState().favoriteDefaultsChanged = true;
	},
	
	/**
	 * PRIVATE
	 * Mark that any of the communication point's defaults have not changed
	 */
	_markFavoriteDefaultsUnChanged: function () {
		this._getTransientFavoriteState().favoriteDefaultsChanged = false;
	},
	
	/**
	 * Returns a reference to the {@link PropertyArray} containing decorated {@link ContactId} objects
	 * @returns {PropertyArray&lt;ContactId&gt;}
	 */
	getContactIds: function () {
		return this.accessor("contactIds");
	},
	
	/**
	 * Sets the given contactId as the primary in this person assuming the contactId is
	 * linked to this person
	 * @returns {boolean} true if the contact was found and is not set as the primary
	 */
	setContactWithIdAsPrimary: function (contactIdToSetPrimary) {
		var contactIds = this.getContactIds().getArray(),
			indexFoundContactId = -1,
			removedContactId;
		
		contactIds.some(function (contactId, index) {
			if (contactId.getValue() === contactIdToSetPrimary) {
				indexFoundContactId = index;
				return true;
			}
			
			return false;
		});
		
		if (indexFoundContactId > 0) {
			removedContactId = contactIds[indexFoundContactId];
			contactIds.splice(indexFoundContactId, 1);
			contactIds.splice(0, 0, removedContactId);
			this.getContactIds().set(contactIds);
			return true;
		} else {
			return false;
		}
	},
	
	/**
	 * Returns the sort key string.  This should only be used for sorting data.
	 * @returns {string}
	 */
	getSortKey: function () {
		return this.accessor("sortKey");
	},
	
	/**
	 * This is the best name based on the linked contacts.  The linker makes this decision and sets the name.
	 * @returns {Name}
	 */
	getName: function () {
		return this.accessor("name");
	},
	
	/**
	 * These are all of the names found on the linked contacts.  This is used by the linker.
	 * @returns {PropertyArray&lt;Name&gt;} containing decorated {@link Name} objects
	 */
	getNames: function () {
		return this.accessor("names");
	},
	
	/**
	 * Returns the decorated {@link Nickname} object
	 * @returns {Nickname}
	 */
	getNickname: function () {
		return this.accessor("nickname");
	},
	
	/**
	 * Returns the decorated {@link Organization} object
	 * @returns {Organization}
	 */
	getOrganization: function () {
		return this.accessor("organization");
	},
	
	/**
	 * All of the email addresses found on the linked contacts.
	 * @returns {PropertyArray&lt;EmailAddress&gt;} PropertyArray containing decorated {@link EmailAddress} objects
	 */
	getEmails: function () {
		return this.accessor("emails");
	},
	
	/**
	 * All of the IM addresses found on the linked contacts.
	 * @returns {PropertyArray&lt;IMAddress&gt;} PropertyArray containing decorated {@link IMAddress} objects
	 */
	getIms: function () {
		return this.accessor("ims");
	},
	
	/**
	 * All of the phone numbers found on the linked contacts.
	 * @returns {PropertyArray&lt;PhoneNumber&gt;} PropertyArray containing decorated {@link PhoneNumber} objects
	 */
	getPhoneNumbers: function () {
		return this.accessor("phoneNumbers");
	},
	
	/**
	 * Returns the decorated {@link PersonPhotos} object.
	 * @returns {PersonPhotos}
	 */	
	getPhotos: function () {
		return this.accessor("photos");
	},
	
	/**
	 * The addresses that belong to this person
	 * @returns {PropertyArray&lt;Address&gt;} PropertyArray containing decorated {@link Address} objects
	 */
	getAddresses: function () {
		return this.accessor("addresses");
	},
	
	/**
	 * The urls that belong to this person
	 * @returns {PropertyArray&lt;Url&gt;} PropertyArray containing decorated {@link Url} objects
	 */
	getUrls: function () {
		return this.accessor("urls");
	},
	
	/**
	 * The notes that belong to this person
	 * @returns {PropertyArray&lt;Notes&gt;} PropertyArray containing decorated {@link Notes} objects
	 */
	getNotes: function () {
		return this.accessor("notes");
	},
	
	/**
	 * The birthday that belongs to this person
	 * @returns {Birthday}
	 */
	getBirthday: function () {
		return this.accessor("birthday");
	},
	
	/**
	 * The anniversary of this person
	 * @returns {Anniversary}
	 */
	getAnniversary: function () {
		return this.accessor("anniversary");
	},
	
	/**
	 * The gender of this person
	 * @returns {Gender}
	 */
	getGender: function () {
		return this.accessor("gender");
	},
	
	/**
	 * Array of search terms that is used to query for person objects based on a typedown filter.  This should only be used for searching.
	 * @returns {PropertyArray&lt;SearchTerm&gt;} PropertyArray containing decorated {@link SearchTerm} objects
	 */
	getSearchTerms: function () {
		return this.accessor("searchTerms");
	},
	
	/**
	 * Returns the decorated {@link Reminder} object.
	 * @returns {Reminder}
	 */	
	getReminder: function () {
		return this.accessor("reminder");
	},
	
	/**
	 * The relations that belong to this person
	 * @returns {PropertyArray&lt;Relation&gt;} PropertyArray containing decorated {@link Relation} objects
	 */
	getRelations: function () {
		return this.accessor("relations");
	},
	
	/**
	 * Returns the decorated {@link Ringtone} object.
	 * @return {Ringtone}
	 */
	getRingtone: function () {
		return this.accessor("ringtone");
	},
	
	/**
	 * Generates a display name for the person based on the following criteria:<br>
	 * 1) Name<br>
	 * 2) Nickname<br>
	 * 3) Organization Title && Organization Name<br>
	 * 4) Organization Name<br>
	 * 5) Email Address<br>
	 * 6) PhoneNumber<br>
	 * 7) "[No Name Available]"<br>
	 * @param {boolean}  includeBasedOnField If false, the return value is a {string}<br>
	 *						If true, the return value is an {Object}
	 * @return {string OR Object} When an {Object} is returned, the basedOnField property will be set from one of the constants defined in {@link DisplayNameType}
	 * @example
	 * If includeBasedOnField is true, the returned {Object} will have this structure: 
	 *		{
	 *			displayName: displayName,
	 *			basedOnField: basedOnField
	 *		}
	 */
	generateDisplayName: function (includeBasedOnField) {
		return Utils.generateDisplayName(this, includeBasedOnField);
	},
		
	/**
	 * Concatenates the Organization Title + Organization Name
	 * @return {string}
	 */
	// previously this used to concat: ['jobTitle', 'deptName', 'companyName']
	generateWorkInfoLine: function () {
		var arr = [],
			title = this.getOrganization().getTitle(),
			orgName = this.getOrganization().getName();
		
		if (title) {
			arr.push(title);
		}
		
		if (orgName) {
			arr.push(orgName);
		}
		
		return arr.join(", ");
	},
	
	/**
	 * Fetches all of the linked contacts for the person from the DB.  A decorated {@link Contact} object is created for each result.
	 * The decorated {@link Contact} array is set on the current person via {@link Person#setContacts}.  The array is also set as the result
	 * of the Future that is returned by this method
	 * @param {ContactType} contactType - The type of decorated contact object to create for each raw linked contact returned from the DB.
	 * @returns {Future} the result of this future will be set the array of decorated contacts
	 */	
	reloadContacts: function (contactType) {
		var future = null;
		
		contactType = contactType || this.getDefaultContactType();
		
		future = Person.getLinkedContacts(this, contactType);
		
		future.then(this, function getContactsFromResultsAndSetOnPerson() {
			var contacts;
			contacts = future.result || [];
			this.setContacts(contacts);
			future.result = contacts;
		});
		
		return future;
	},
	
	/**
	 * Clears the fields on the person 
	 */
	// TODO: this implementation needs some work
	clearFieldsForFixup: function () {
		//this.getContactIds().clear();
		this.getName().clear();
		this.getNames().clear();
		this.getNickname().clear();
		this.getOrganization().clear();
		this.getSearchTerms().clear();
		this.getEmails().clear();
		this.getPhoneNumbers().clear();
		this.getIms().clear();
		this.getAddresses().clear();
		this.getUrls().clear();
		this.getNotes().clear();
		this.getBirthday().setValue("");
		this.getAnniversary().setValue("");
		this.getGender().setValue("");
		this.getPhotos().clear();
		this.getSortKey().setValue("");
		this.getRelations().clear();
		//note that we are explicitly *not* clearing the photos
	},
		
//	fixup: function () {
//		var i,
//			name;
//		// iterate over contacts + find the primary
//		//		- set the displayName to primaryContact.getName().getFullName()
//		
//		if (_contacts && _contacts.length) {
//			// the primary will be first.  Iterate over the array until the first good name is found
//			for (i = 0; i < _contacts.length; i = i + 1) {
//				name = _contacts[i].getName().getFullName();
//				if (name) {
//					_data.displayName = name;
//					break;
//				}
//			}
//		} else {
//			console.log("_contacts array is empty!");
//		}
//		
//	},
	
	fixup: function (otherPeopleBeingLinked, configParams) {
		return this.fixupFromObjects(undefined, ContactType.EDITABLE, otherPeopleBeingLinked, configParams);
	},
	
	fixupNoReloadContacts: function (otherPeopleBeingLinked, configParams) {
		return this.fixupFromObjects(this.getContacts(), ContactType.EDITABLE, otherPeopleBeingLinked, configParams);
	},
	
	fixupFromObjects: function (contacts, contactType, otherPeopleBeingLinked, configParams) {
		//TODO: can any of these be moved into a future.then?
		var future,
			allPeopleBeingLinked,
			dupeFavoriteBackupData,
			notDupeFavoriteBackupData,
			speedDialSaver,
			rawNewPersonPhotos,
			newListContactPhoto,
			wasAFavoriteFromBackups = false,
			timingRecorder = (configParams && configParams.timingRecorder) || {
				startTimingForJob: function () {
					
				},
				stopTimingForJob: function () {
					
				}
			}; // TODO: take me out when performance push is done!!!!
		
		if (!contacts) {
			timingRecorder.startTimingForJob("Fixup_Reload_Contacts");
			future = this.reloadContacts();
		} else {
			future = new Future();
			future.now(function () {
				future.result = true;
			});
		}
		
		future.then(this, function doneLoadingContactsForPerson() {
			var tempResult;
			
			if (!contacts) {
				timingRecorder.stopTimingForJob("Fixup_Reload_Contacts");
				contacts = [];
				tempResult = future.result;
				contacts = tempResult;
				/*console.log("Contacts from future - " + tempResult);
				if (tempResult) {
					for (i = 0; i < tempResult.length; i += 1) {
						contacts[i] = ContactFactory.create(contactType, tempResult[i]);
					}
				}
				
				console.log("Contacts in contacts array - " + contacts);*/
			}
			
			otherPeopleBeingLinked = Array.isArray(otherPeopleBeingLinked) ? _.clone(otherPeopleBeingLinked) : [];
			allPeopleBeingLinked = [this].concat(otherPeopleBeingLinked);
			
			speedDialSaver = new SpeedDialSaver(allPeopleBeingLinked);
			
			timingRecorder.startTimingForJob("Fixup_Fetch_Favorite_Backups");
			//save favorites and default information
			future.nest(Person._getAllFavoriteBackupsForPeople(allPeopleBeingLinked));
		});
		
		future.then(this, function () {
			timingRecorder.stopTimingForJob("Fixup_Fetch_Favorite_Backups");
			
			var contact,
				allFavoriteBackups = future.result,
				favoriteBackupDefaultSavers = [],
				tempDupeObject,
				tempFavoriteBackup,
				nameBeenCopied = false,
				nicknameCopied = false,
				birthdayCopied = false,
				anniversaryCopied = false,
				genderCopied = false,
				organizationCopied = false,
				i,
				name,
				nickname,
				organization,
				birthday,
				gender,
				anniversary,
				emailArray,
				phoneNumberArray,
				imArray,
				addressesArray,
				urlsArray,
				relationsArray,
				note,
				numbersToAdd,
				dupSearchTermsHash = {},
				dupEmailHash = {},
				dupNumberHash = {},
				dupImHash = {},
				dupName = {},
				dupAddressHash = {},
				dupUrlsHash = {},
				dupRelationsHash = {},
				dupNotesHash = {};
			
			for (i = 0; i < allFavoriteBackups.length; i += 1) {
				tempFavoriteBackup = allFavoriteBackups[i];
				if (tempFavoriteBackup) {
					wasAFavoriteFromBackups = true;
					favoriteBackupDefaultSavers = favoriteBackupDefaultSavers.concat(tempFavoriteBackup.getDefaultPropertyHashes().getArray());
				}
			}
			
			tempDupeObject = Person._discoverFavoriteSaverBackupDupes(favoriteBackupDefaultSavers);
			
			dupeFavoriteBackupData = tempDupeObject.dupes;
			notDupeFavoriteBackupData = tempDupeObject.notDupes;
			
			this.clearFieldsForFixup();
			
			timingRecorder.startTimingForJob("Fixup_Copying_And_De-dupping_Contact_Point_Data");
			
			
			for (i = 0; i < contacts.length; i += 1) {
				//console.log("In contacts");
				contact = contacts[i];
				//console.log("Contacts array - " + JSON.stringify(contacts));
				//console.log("Contact currently getting fixup from - " + JSON.stringify(contact));
				//
				
				//console.log("Current contact - " + contact);
				if (contact) {
					
					// Copy up name
					name = contact.getName();
					if (name.getFullName() !== "") {
						if (!nameBeenCopied) {
							//console.log("Contact library: fixup - Name on person before set - " + this.getName());
							this.getName().set(name);
							//console.log("Contact library: fixup - Name on contact - " + name);
							//console.log("Contact library: fixup - Name on person now - " + this.getName());
							nameBeenCopied = true;
						} 
						
						this.getNames().add(Utils.dedupeEntries(dupName, [name], "getNormalizedHashKey"));
					}
					
					// Copy up nickname
					if (!nicknameCopied) {
						nickname = contact.getNickname();
						
						if (nickname.getValue()) {
							this.getNickname().setValue(nickname.getValue());
							nicknameCopied = true;
						}
					}
					
					// Copy up organization
					if (!organizationCopied) {
						organization = contact.getBestOrganization();
						if (organization) {
							this.getOrganization().initialize(organization);
							this.getOrganization().forceMarkDirty();
							organizationCopied = true;
						}
					}
					
					// Copy up searchTerms
					this.getSearchTerms().add(Utils.dedupeEntries(dupSearchTermsHash, Utils.getSearchTermsFromContact(contact)));
					
					emailArray = contact.getEmails().getArray();
					
					if (emailArray) {
						this.getEmails().add(Utils.dedupeEntries(dupEmailHash, emailArray, "getNormalizedHashKey"));
					}
					
					phoneNumberArray = contact.getPhoneNumbers().getArray();
					if (phoneNumberArray) {
						// Compare search normalized values for phone numbers
						numbersToAdd = Utils.dedupeEntries(dupNumberHash, phoneNumberArray, "getNormalizedSearchHashKey");
						if (numbersToAdd) {
							this.getPhoneNumbers().add(numbersToAdd);
						}
					}
					
					imArray = contact.getIms().getArray();
					if (imArray) {
						this.getIms().add(Utils.dedupeEntries(dupImHash, imArray, "getNormalizedHashKey"));
					}
					
					addressesArray = contact.getAddresses().getArray();
					if (addressesArray) {
						this.getAddresses().add(Utils.dedupeEntries(dupAddressHash, addressesArray, "getNormalizedHashKey"));
					}
					
					urlsArray = contact.getUrls().getArray();
					if (urlsArray) {
						this.getUrls().add(Utils.dedupeEntries(dupUrlsHash, urlsArray, "getNormalizedHashKey"));
					}
					
					relationsArray = contact.getRelations().getArray();
					if (relationsArray) {
						this.getRelations().add(Utils.dedupeEntries(dupRelationsHash, relationsArray, "getNormalizedHashKey"));
					}
					
					note = contact.getNote();
					if (note.getValue()) {
						this.getNotes().add(Utils.dedupeEntries(dupNotesHash, [note], "getNormalizedHashKey"));
					}
					
					if (!birthdayCopied) {
						birthday = contact.getBirthday().getValue();
						if (birthday) {
							this.getBirthday().setValue(birthday);
							birthdayCopied = true;
						}
					}
					
					if (!anniversaryCopied) {
						anniversary = contact.getAnniversary().getValue();
						if (anniversary) {
							this.getAnniversary().setValue(anniversary);
							anniversaryCopied = true;
						}
					}
					
					if (!genderCopied) {
						gender = contact.getGender().getValue();
						if (gender) {
							this.getGender().setValue(gender);
							genderCopied = true;
						}
					}
				}
			}
			
			if (!nicknameCopied) {
				this.getNickname().setValue("");
			}
		
			timingRecorder.stopTimingForJob("Fixup_Copying_And_De-dupping_Contact_Point_Data");
			
			
			timingRecorder.startTimingForJob("Fixup_Generating_SortKey");
			//now, generate the sortKey
			future.nest(SortKey.generateSortKey(this, configParams));
		});
		
		future.then(this, function () {
			timingRecorder.stopTimingForJob("Fixup_Generating_SortKey");
			
			var sortKey = future.result,
				contactPhotosArray,
				newListPhotoSource,
				squareContactPhoto,
				bigContactPhoto,
				squareContactPhotoPath = "",
				bigContactPhotoPath = "",
				squareContactPhotoId = "",
				bigContactPhotoId = "",
				splitFilePath,
				oldPhotos,
				contactWithNewPhotos;
			
			this.getSortKey().setValue(sortKey);
			
			
			/*
			 * Now, we deal with photos...
			 */
			timingRecorder.startTimingForJob("Fixup_Prepping_Photos");
			
			
			oldPhotos = this.getPhotos();
			
			//we use the first contact that has any photos
			contactWithNewPhotos = _.detect(contacts, function (contact) {
				return (contact.getPhotos().getArray().length > 0);
			});
			
			//if none of the contacts have photos, we just create an empty rawNewPersonPhotos object so that default images will be used
			if (!contactWithNewPhotos) {
				rawNewPersonPhotos = {};
				return {
					returnValue: true,
					skippedImageConvertCall: true
				};
			}
			
			//first, we find a square photo and a big photo that have local paths
			contactPhotosArray = contactWithNewPhotos.getPhotos().getArray();
			squareContactPhoto = _.detect(contactPhotosArray, function (contactPhoto) {
				return contactPhoto.getType() === ContactPhoto.TYPE.SQUARE && contactPhoto.getLocalPath();
			});
			bigContactPhoto = _.detect(contactPhotosArray, function (contactPhoto) {
				return contactPhoto.getType() === ContactPhoto.TYPE.BIG && contactPhoto.getLocalPath();
			});
			
			//now we pick one to use for the list photo.  we prefer to use a square one.
			if (squareContactPhoto) {
				newListContactPhoto = squareContactPhoto;
			} else if (bigContactPhoto) {
				newListContactPhoto = bigContactPhoto;
			} else {
				console.warn("Contacts library: fixup - no square or big photo found on a contact with photos (maybe they had photo objs without local paths?).  Not storing a photo on the person.");
				rawNewPersonPhotos = {};
				return {
					returnValue: true,
					skippedImageConvertCall: true
				};
			}
			newListPhotoSource = newListContactPhoto.getType();
			
			//TODO: will contactPhoto.getId() work?  probably not...
			if (squareContactPhoto) {
				squareContactPhotoPath = squareContactPhoto.getLocalPath();
				squareContactPhotoId = squareContactPhoto.getDBObject()._id;
			}
			if (bigContactPhoto) {
				bigContactPhotoPath = bigContactPhoto.getLocalPath();
				bigContactPhotoId = bigContactPhoto.getDBObject()._id;
			}
			
			//Now we figure out if the new list photo is going to actually be different than the old one.
			if (newListPhotoSource === oldPhotos.getListPhotoSource() && newListContactPhoto.getValue() === oldPhotos.getListPhotoSourcePath()) {
				//If we're using the same type of photo as the old one, and the source has the same exact file path, 
				//we don't have to create a new list photo - we just use the old one.
				
				//we don't have to recrop, but we do need to reconstruct the PersonPhotos object to make sure we get any updates
				rawNewPersonPhotos = {
					bigPhotoPath: bigContactPhotoPath, //the potentially-changed big photo path (one of big and square could have changed, if the other was the list photo source)
					squarePhotoPath: squareContactPhotoPath, //the potentially-changed square photo path (one of big and square could have changed, if the other was the list photo source)
					listPhotoPath: oldPhotos.getListPhotoPath(), //the old list photo path, since we're still using that one
					listPhotoSource: newListPhotoSource, //the is the same as oldPhotos.getListPhotoSource()
					bigPhotoId: bigContactPhotoId, //the id off the new big photo, since it could have changed
					squarePhotoId: squareContactPhotoId, //the id off the new big photo, since it could have changed
					contactId: contactWithNewPhotos.getId(), //the id off the new contact, since it theoretically could have changed
					accountId: contactWithNewPhotos.getAccountId().getValue() //the account id off the new contact
				};
				return {
					returnValue: true,
					skippedImageConvertCall: true
				};
			} else {
				//something changed, so we have to do a crop to get a new list photo
				
				rawNewPersonPhotos = {
					bigPhotoPath: bigContactPhotoPath,
					squarePhotoPath: squareContactPhotoPath,
					//we omit listPhotoPath, since we need to do the crop and get it below
					listPhotoSource: newListPhotoSource,
					bigPhotoId: bigContactPhotoId,
					squarePhotoId: squareContactPhotoId,
					contactId: contactWithNewPhotos.getId(),
					accountId: contactWithNewPhotos.getAccountId().getValue()
				};
				
				return {
					returnValue: true
				};
			}
		});
		
		future.then(this, function () {
			timingRecorder.stopTimingForJob("Fixup_Prepping_Photos");
			
			var result = future.result,
				cropFuture;
			
			if (result.skippedImageConvertCall) {
				return result;
			} else {
				timingRecorder.startTimingForJob("Fixup_Cropping_Photo_And_File_Cache");
				
				cropFuture = ContactPhoto.cropAndGetPath(newListContactPhoto.getLocalPath(), {}, PersonPhotos.TYPE.LIST, timingRecorder);
				
				cropFuture.then(function () {
					var result;
					try {
						result = cropFuture.result;
					} catch (ex) {
						console.warn("Person fixup: cropping list photo and got error.  We're ignoring it.  " + ex);
						result = "";
					}
					
					timingRecorder.stopTimingForJob("Fixup_Cropping_Photo_And_File_Cache");
					
					return {
						returnValue: true,
						skippedImageConvertCall: false,
						pathResult: result
					};
				});
				
				return cropFuture;
			}
		});
		
		future.then(this, function () {
			var result = future.result,
				otherPersonWithLauncherId,
				completeReminder,
				otherPersonWithRingtone,
				that = this;
				
			/*
			 * First let's deal with the result of the photos call
			 */
			
			if (result && result.returnValue) {
				if (!result.skippedImageConvertCall) {
					//if we're in here, that means we actually had to do some photo cropping
					rawNewPersonPhotos.listPhotoPath = result.pathResult;
				} else {
					console.log("Contact library: fixup - photo cropping was not necessary");
				}
			} else {
				if (rawNewPersonPhotos.squarePhotoPath) {
					rawNewPersonPhotos.listPhotoPath = "";
					rawNewPersonPhotos.listPhotoSource = ContactPhoto.TYPE.SQUARE;
				} else if (rawNewPersonPhotos.bigPhotoPath) {
					rawNewPersonPhotos.listPhotoPath = "";
					rawNewPersonPhotos.listPhotoSource = ContactPhoto.TYPE.BIG;
				}
			}
			//finally, store the new values to the person
			this.getPhotos().reinitialize(rawNewPersonPhotos);
			
			
			/*
			 * Now deal with the person-specific stuff: launcher id, reminder, and ringtone
			 */
			timingRecorder.startTimingForJob("Fixup_Restoring_Person_Specific_Stuff");
			//if this person doesn't have a launcher id, see if any of the others do and copy over the first one we find
			if (!this.getLauncherId().getValue()) {
				otherPersonWithLauncherId = _.detect(otherPeopleBeingLinked, function (otherPerson) {
					if (!otherPerson || ! otherPerson.getLauncherId()) {
						return false;
					}
					
					return !!otherPerson.getLauncherId().getValue();
				});
				if (otherPersonWithLauncherId) {
					this.getLauncherId().setValue(otherPersonWithLauncherId.getLauncherId().getValue());
				}
			}
			
			//take all the reminders from each person and join them into one big reminder string to store
			completeReminder = allPeopleBeingLinked.reduce(function (accumulatedReminder, currentPerson) {
				var currentReminder = currentPerson.getReminder().getValue();
				if (currentReminder) {
					return accumulatedReminder ? accumulatedReminder + ". "  + currentReminder : currentReminder;
				} else {
					return accumulatedReminder;
				}
			}, "");
			this.getReminder().setValue(completeReminder);
			
			//if this person doesn't have a ringtone, see if any of the others do and copy over the first one we find
			if (!this.getRingtone().getName() || !this.getRingtone().getLocation()) {
				otherPersonWithRingtone = _.detect(otherPeopleBeingLinked, function (otherPerson) {
					if (!otherPerson || ! otherPerson.getRingtone()) {
						return false;
					}
					
					return !!otherPerson.getRingtone().getName() && !!otherPerson.getRingtone().getLocation();
				});
				if (otherPersonWithRingtone) {
					this.getRingtone().setName(otherPersonWithRingtone.getRingtone().getName());
					this.getRingtone().setLocation(otherPersonWithRingtone.getRingtone().getLocation());
				}
			}
			timingRecorder.stopTimingForJob("Fixup_Restoring_Person_Specific_Stuff");
			
			
			timingRecorder.startTimingForJob("Fixup_Restoring_SpeedDials");
			/*
			 * now restore speed dials
			 */
			speedDialSaver.restoreSpeedDials(this);
			
			return speedDialSaver.restoreSpeedDialsFromBackups(this);
		});
		
		future.then(this, function () {
			var dummy = future.result,
				backupDataToRestore = [],
				tempFavoriteBackup,
				tempFavoriteBackupType,
				anyPersonWasFavorite,
				i,
				contactPointDataObject = {},
				contactPointArray,
				contactPointArrayIndex,
				tempContactPoint,
				that = this;
			
			timingRecorder.stopTimingForJob("Fixup_Restoring_SpeedDials");
			
			timingRecorder.startTimingForJob("Fixup_Restoring_Favorite_Data");
			/*
			 * now restore favorite data
			 */
			anyPersonWasFavorite = _.isArray(otherPeopleBeingLinked) ? _.clone(otherPeopleBeingLinked) : [];
			anyPersonWasFavorite = anyPersonWasFavorite.some(function (otherPerson) {
				return otherPerson.isFavorite();
			});
			//don't set it to false, in case this person is already a favorite
			if (anyPersonWasFavorite || wasAFavoriteFromBackups) {
				this.getFavorite().setValue(true);
			}
			
			backupDataToRestore = backupDataToRestore.concat(dupeFavoriteBackupData);
			backupDataToRestore = backupDataToRestore.concat(notDupeFavoriteBackupData);
			
			for (i = 0; i < backupDataToRestore.length; i += 1) {
				tempFavoriteBackup = backupDataToRestore[i];
				tempFavoriteBackupType = tempFavoriteBackup.getType();
				if (!contactPointDataObject[tempFavoriteBackupType]) {
					contactPointDataObject[tempFavoriteBackupType] = this._getContactPointArrayForType(tempFavoriteBackupType);
				}
				
				contactPointArray = contactPointDataObject[tempFavoriteBackupType];
				
				for (contactPointArrayIndex = 0; contactPointArrayIndex < contactPointArray.length; contactPointArrayIndex += 1) {
					tempContactPoint = contactPointArray[contactPointArrayIndex];
					if (tempFavoriteBackup.isPlainValueEqual(tempContactPoint.getNormalizedValue())) {
						tempContactPoint.setFavoriteData(tempFavoriteBackup.getFavoriteData());
						// backupDataToRestore.splice(i, 1);
						// i -= 1;
						break;
					}
				}
			}
			
			// Promote all the defaults to the front of the contact point arrays
			Person.supportedFavoriteTypes.forEach(function (contactPointType) {
				var contactPointPropertyArray = that._getContactPointArrayForType(contactPointType, true),
					contactPointArray = contactPointPropertyArray.getArray(),
					objectsToPromote = [];
					
				contactPointArray.forEach(function (contactPoint, currentIndex) {
					if (contactPoint.hasFavoriteDataForAnyApp()) {
						contactPointArray.splice(currentIndex, 1);
						objectsToPromote.push(contactPoint);
					}
				});
				
				if (objectsToPromote.length > 0) {
					contactPointPropertyArray.clear();
					contactPointPropertyArray.add(objectsToPromote);
					contactPointPropertyArray.add(contactPointArray);
				}
			});
			
			timingRecorder.stopTimingForJob("Fixup_Restoring_Favorite_Data");
			
			//TODO: we should probably just return the decorated person object instead of generating the raw object
			return this.getDBObject();
		});
		
		return future;
	},
	
	
	
	// Eventually we might want to have this person object update itself automatically
	// and allow consumers of this library to be notified of when it changes, but
	// lets take the simple route first
	//
	/**
	 * Creates a DB watch for the current person object.  When the watch fires, the result will be set on the future that this method returns.
	 * @returns {Future} When the watch fires, the Future.result will be set to the latest raw person data
	 */
	watchForDatabaseChanges: function () {
		Assert.require(this.getId(), "watchForDatabaseChanges - cannot watch person that has no id");
		var query = {
				"from": this.getKind(),
				"where": [{
					"prop": "_id",
					"op": "=",
					"val": this.getId()
				}]
			},
			revId = this.getRev(),
			dbFuture;
		
//		if (revId) {
//			query.where.push({
//				"prop": "_rev",
//				"op": ">",
//				"val": revId
//			});
//		}
	
		dbFuture = DB.find(query, true);
		
		dbFuture.then(function () {
			var result = Utils.DBResultHelper(dbFuture.result);
			if (result && Array.isArray(result)) {
				result = result[0];
			}
			dbFuture.result = result;
		});
		
		return dbFuture;
	},
	
	/**
	 * Cancel the watch that was created by watchForDatabaseChanges
	 * @param {Future} future - this is the Future returned by {@link Person#watchForDatabaseChanges}
	 * @returns {boolean}
	 */
	stopWatchingForDatabaseChanges: function (future) {
		PalmCall.cancel(future);
		return true;
	},
	
	// TODO: implement this to ensure the defaults on the person's contact points don't disappear when performing fixup
	favoriteFixup: function () {
	},
	
	/**
	 * Return the appropriate ContactType for the current person.  If the current person is a
	 * PersonDisplay, this will reutrn ContactType.DISPLAYABLE.  If no match is found, ContactType.EDITABLE will be returned
	 * @returns {string} 
	 */
	getDefaultContactType: function () {
		if (this instanceof PersonDisplay) {
			return ContactType.DISPLAYABLE;
		} else if (this instanceof PersonLinkable) {
			return ContactType.LINKABLE;
		} else {
			return ContactType.EDITABLE;
		}
	},
	
	/**
	 * Delete the current person from the DB
	 * @returns {Future} The Future.result will be set to result of the call the delete the person from the DB.
	 */
	deletePerson: function () {
		var id = this.getId();
		Assert.require(id, "deletePerson unable to delete because there is no _id.");
		return DB.del([id]);
	},
	
	/**
	 * PRIVATE
	 *  Adds the favorite backup entries for this person.
	 * @returns {Future} The Future.result will be set to result of the call to update the favorite backups from the db
	 */
	_addFavoriteBackupDBEntries: function () {
		var toMapReduce = [],
			tempBackup,
			future = new Future(),
			that = this;
			
		if (this._isBeingSaved()) {
			future.now(this, function () {
				return this.reloadContacts();
			});

			future.then(this, function () {
				var contacts = future.result;

				return Foundations.Control.mapReduce({
					map: function (contact) {
						var mapFuture = new Future(),
							linkHash;

						mapFuture.now(function () {
							return ContactLinkable.getLinkHash(contact);
						});

						mapFuture.then(function () {
							linkHash = mapFuture.result.linkHash;
							
							return FavoriteBackup.getBackupForLinkhash(linkHash);
						});
						
						mapFuture.then(function () {
							var result = mapFuture.result,
								tempBackup;
							
							if (result) {
								tempBackup = result;
							} else {
								tempBackup = new FavoriteBackup({
									contactBackupHash: linkHash,
									defaultPropertyHashes: []
								});
							}

							that._setAllDefaultsInBackup(tempBackup);
							toMapReduce.push({"function": tempBackup.save, object: tempBackup});
							
							return true;
						});

						return mapFuture;
					}
				}, contacts);

			});
			
			future.then(this, function () {
				var result = future.result;
				return Utils.mapReduceAndVerifyResultsTrue(toMapReduce);
			});
			
			return future;
		} else {
			throw new Error("_addFavoriteBackupDBEntries: cannot call this method when the person is not being saved! Actually you probably shouldn't be calling this anyway!!");
		}
	},
	
	/**
	 * PRIVATE
	 *  Updates the favorite backup entries for this person.
	 * @returns {Future} The Future.result will be set to result of the call to update the favorite backups from the db
	 */
	_updateFavoriteBackupDBEntries: function () {
		var toMapReduce = [],
			i,
			future,
			tempId,
			j,
			contacts,
			that = this;
		
		if (this._isBeingSaved()) {
			
			future = new Future();
			
			future.now(this, function () {
				return this.reloadContacts();
			});
			
			future.then(this, function () {
				var result = future.result;
				
				contacts = result;
				
				contacts.forEach(function (contact) {
					toMapReduce.push({"function": Utils.curry(FavoriteBackup.getBackupForContact, contact)});
				});

				// Get all of the current favorite backups from the db
				return Utils.mapReduceAndReturnResults(toMapReduce);
			});
			
			// Loop through them and update the entries to have the new defaults that are set on this person
			future.then(this, function () {
				var favoriteBackups = future.result,
					i,
					tempBackup;
					
				toMapReduce = [];
				
				return Foundations.Control.mapReduce({
					map: function (tempBackup) {
						var mapFuture = new Future();
						
						mapFuture.now(function () {
							if (tempBackup) {
								return tempBackup.getContactBackupHashContactId();
							} else {
								console.log("_updateFavoriteBackupDBEntries: One of the backup entries for this person did not exist in the database.");
								console.log("_updateFavoriteBackupDBEntries (cont.d): Instead of failing we will go ahead and add this missing entry.");
								return null;
							}
						});
						
						mapFuture.then(function () {
							var result = mapFuture.result;
							
							if (result) {
								for (j = 0; j < contacts.length; j += 1) {
									if (result === contacts[j].getId()) {
										contacts.splice(j, 1);
									}
								}

								that._setAllDefaultsInBackup(tempBackup);
								toMapReduce.push({"function": tempBackup.save, object: tempBackup});
							}
							
							return true;
						});
						
						return mapFuture;
					}
				}, favoriteBackups);
				
			});
			
			future.then(this, function () {
				var result = future.result;
				
				// This means that not all of the records that should have been in the favoriteBackup table were there.
				// We need to add them rather than keep this hole.
				
				return Foundations.Control.mapReduce({
					map: function (contact) {
						var mapFuture = new Future();
						
						mapFuture.now(function () {
							return ContactLinkable.getLinkHash(contact);
						});
						
						mapFuture.then(function () {
							var result = mapFuture.result.linkHash,
							tempBackup;
							
							tempBackup = new FavoriteBackup({
								contactBackupHash: result,
								defaultPropertyHashes: []
							});
				
							that._setAllDefaultsInBackup(tempBackup);
							toMapReduce.push({"function": tempBackup.save, object: tempBackup});
						});
						
						return mapFuture;
					}
				}, contacts);
				
			});
			
			future.then(this, function () {
				var result = future.result;
				// Save the newly updated favorite backups
				return Utils.mapReduceAndVerifyResultsTrue(toMapReduce);
			});
			
			return future;
		} else {
			throw new Error("_updateFavoriteBackupDBEntries: cannot call this method when the person is not being saved! Actually you probably shouldn't be calling this anyway!!");
		}
	},
	
	/**
	  * PRIVATE
	  */
	_setAllDefaultsInBackup: function (favoriteBackup) {
		var currentSupportedType,
			tempDefaults,
			tempDefault,
			i,
			j;
		
		for (i = 0; i < Person.supportedFavoriteTypes.length; i += 1) {
			currentSupportedType = Person.supportedFavoriteTypes[i];
			tempDefaults = this._getDefaultContactPointsForTypeAndAppId(currentSupportedType);
			for (j = 0; j < tempDefaults.length; j += 1) {
				tempDefault = tempDefaults[j];
				favoriteBackup.setDefaultForContactPointType(tempDefault.getNormalizedValue(), currentSupportedType, tempDefault.getFavoriteData());
			}
		}
	},
	
	/**
	 * PRIVATE
	 *  Remove the favorite backup entries associated with this person from the db.
	 * @returns {Future} The Future.result will be set to result of the call to remove the favorite backups from the db
	 */
	_removeFavoriteBackupDBEntries: function () {
		var toMapReduce = [],
			future = new Future();
		
		if (this._isBeingSaved()) {
			future.now(this, function () {
				return this.reloadContacts();
			});
			
			future.then(this, function () {
				var contacts = future.result;
				
				contacts.forEach(function (contact) {
					toMapReduce.push({"function": Utils.curry(FavoriteBackup.removeBackupForContact, contact)});
				});
				
				return Utils.mapReduceAndVerifyResultsTrue(toMapReduce);
			});
			
			return future;
		} else {
			throw new Error("_removeFavoriteBackupDBEntries: cannot call this method when the person is not being saved! Actually you probably shouldn't be calling this anyway!!");
		}
	},
	
	/**
	 * Save the current person to the DB
	 * @returns {Future} The Future.result will be set to result of the call the save the person to the DB.
	 */
	// TODO: need a flag to indicate if fixup is required on the save
	//       we are locally calling fixup in the edit scene to get instant UI feedback
	save: function () {
		if (!this._isBeingSaved()) {
			this._setBeingSaved(true);
			
			var future;

			if (this.getId()) {
				future = DB.merge([this.getDirtyDBObject()]);
			} else {
				future = DB.put([this.getDBObject()]);
			}
			
			future.then(this, function (future) {
				var result = Utils.DBResultHelper(future.result),
					favoriteValue = this.getFavorite().getValue(),
					updatingFavorites = false;
				
				Assert.require(result, "savePerson put - result is null");
				Assert.requireArray(result, "savePerson put - result is not an array");
				Assert.require(result.length, "savePerson put - result length is zero");
				
				// Favorites handling code
				if (favoriteValue) {
					if (this.hasInstantiationFavoriteValueChanged() || (!this.getId())) {
						updatingFavorites = true;
						future.nest(this._addFavoriteBackupDBEntries());
					} else if (this._hasFavoriteDefaultsChanged()) {
						updatingFavorites = true;
						future.nest(this._updateFavoriteBackupDBEntries());
					}
				} else {
					if (this.hasInstantiationFavoriteValueChanged() && this.getId()) {
						updatingFavorites = true;
						future.nest(this._removeFavoriteBackupDBEntries());
					}
				}
				
				this.setId(result[0].id);
				this.setRev(result[0].rev);
				this.markNotDirty();
				
				if (!updatingFavorites) {
					future.result = true;
				}
				
			}).then(this, function (future) {
				var result = future.result,
					speedDialSaver;
				
				// SpeedDialBackup code
				speedDialSaver = new SpeedDialSaver(this);
				
				return speedDialSaver.saveBackupRecordsForSpeedDials();
			}).then(this, function (future) {
				var result = true;
				if (future && !future.result) {
					console.log("Person save ERROR!: Updating the favorites data failed");
					result = false;
				} else {
					// Now that the favorite fixup has been done, update the person's current
					// favorite state.
					this._updateInstantiationFavoriteValueToCurrentState();
					this._markFavoriteDefaultsUnChanged();
				}
				
				this._setBeingSaved(false);
				future.result = result;
			});
			
			return future;
		}
		
		throw new Error("You can't call save on a person that is currently being saved");
	},
	
	/**
	 * Ridiculously PRIVATE
	 * Save the current person to the DB doing some wicked sick magic to save a new person and a new contact
	 * and guarentee the autolinker does not smack the contact's person off.
	 * @returns {Future} The Future.result will be set to result of the call the save the person to the DB.
	 */
	_savePersonAttachingTheseContacts: function (newContacts, callSaveContactInDBOnly) {
		Assert.requireDefined(newContacts, "You must pass an array of contacts to _savePersonAttachingTheseContacts");
		Assert.requireArray(newContacts, "The parameter to _savePersonAttachingTheseContacts must be an array");
		Assert.require(newContacts.length > 0, "There must be contacts in the param to use _savePersonAttachingTheseContacts");
		
		var future = new Future(),
			contactsToGetIds = [],
			contactIds = [],
			reservedContactIds,
			contactsToSave = [],
			newContactIds = [],
			i,
			contactSaveFutureFunction,
			saveSuccessful = true;
		
		if (!this._isBeingSaved()) {
			this._setBeingSaved(true);
			
			
			future.now(this, function () {
				// No point in getting the ids for contacts that already have an id.
				// They must be in the db, so lets not make the mistake of adding them too.
				for (i = 0; i < newContacts.length; i += 1) {
					if (newContacts[i].getId()) {
						contactIds.push(newContacts[i].getId());
						contactsToSave.push(newContacts[i]);
						newContacts.splice(i, 1);
					}
				}
				
				if (newContacts.length > 0) {
					future.nest(DB.reserveIds(newContacts.length));
				} else {
					future.result = { ids: [] };
				}
			});
		
			// Got the reserved ids. Now lets add them to the contacts that need
			// them and save the person
			future.then(this, function () {
				var result = future.result;
			
				reservedContactIds = result.ids;
			
				if (reservedContactIds.length !== newContacts.length) {
					throw new Error("_savePersonAttachingTheseContacts failed because there were not enough reserved ids return to give to all the contacts");
				}
			
				for (i = 0; i < newContacts.length; i += 1) {
					newContacts[i].setId(reservedContactIds[i]);
					contactIds.push(reservedContactIds[i]);
					contactsToSave.push(newContacts[i]);
				}
				
				if (this.getContacts().length === 0) {
					future.nest(this.reloadContacts());
				} else {
					future.result = true;
				}
				
			});
			
			future.then(this, function () {
				this.getContactIds().clear();
				this.getContactIds().add(contactIds);
				future.nest(this.fixupFromObjects(this.getContacts().concat(newContacts), ContactType.EDITABLE));
			});
			
			future.then(this, function () {
				this._setBeingSaved(false);
				future.nest(this.save());
			});
			
			// Now that we saved the person go through and save all of the contacts
			//
			// TODO: Look into if this has to be done in a batch to guarentee that the
			// linker does not do something that will cause a funky race condition.
			// With an autolink and losing one of these new contactIds. Possibly there
			// could be an issue with the linker calling fixup and the updated contact
			// data is not fully saved.
			future.then(this, function () {
				var result = future.result,
					toMapReduce = [];
			
				if (result) {
					for (i = 0; i < contactsToSave.length; i += 1) {
						if (callSaveContactInDBOnly && contactsToSave[i].saveContactInDBOnly) {
							toMapReduce.push({"function": contactsToSave[i].saveContactInDBOnly, object: contactsToSave[i]});
						} else {
							toMapReduce.push({"function": contactsToSave[i].save, object: contactsToSave[i]});
						}
					}
					
					future.nest(Utils.mapReduceAndVerifyResultsTrue(toMapReduce));
				} else {
					console.log("There was an error saving person from _savePersonAttachingTheseContacts");
					this._setBeingSaved(true);
					saveSuccessful = false;
					future.nest(this._removeFavoriteBackupDBEntries());
				}
			});
			
			// Now that we are done saving all of the contacts. Mark the person as saved
			// and set the future result
			future.then(this, function () {
				var result = future.result;
				
				this._setBeingSaved(false);
				
				if (result && saveSuccessful) {
					future.result = true;
				} else {
					future.result = false;
				}
			});
			
			return future;
		}
			
		throw new Error("You can't call _savePersonAttachingTheseContacts on a person that is currently being saved");
	},
	
	
	/**
	 * Returns the string representation of {@link Person#getDBOBject}.  This is for testing.
	 * @returns {string}
	 */
	toString: function () {
		return JSON.stringify(this.getDBObject());
	},
	
	isDirty: function () {
		return Utils.callFunctionsOnProperties(this.accessor, Person.PROPERTIES.objects, "isDirty", Person.PROPERTIES.arrays, "containsDirtyEntry");
	},
	
	markNotDirty: function () {
		Utils.callFunctionsOnProperties(this.accessor, Person.PROPERTIES.objects, "markNotDirty", Person.PROPERTIES.arrays, "markElementsNotDirty");
	},
	
	// For the time being I am calling _equals on each of the contact properties by hand.
	// It would be cool if we had an easy way to iterate over all of them.
	equals: function (otherPerson) {
		var isEqual = true,
			i,
			j,
			tempArray,
			otherTempArray,
			property = "",
			properties = Person.PROPERTIES.objects,
			propertyArrays = Person.PROPERTIES.arrays;
		
		Assert.require(otherPerson instanceof Person, "The object passed into equals must be an instance of Person");
		
		for (i = 0; i < properties.length; i += 1) {
			property = properties[i];
			isEqual = isEqual && this.accessor(property).equals(otherPerson.accessor(property));
		}
		
		for (j = 0; j < propertyArrays.length; j += 1) {
			property = propertyArrays[j];
			tempArray = this.accessor(property).getArray();
			otherTempArray = otherPerson.accessor(property).getArray();
			
			for (i = 0; i < tempArray.length; i += 1) {
				isEqual = isEqual && tempArray[i].equals(otherTempArray[i]);
			}
		}
		
		return isEqual;
	},
	
	/**
	 * Set a cropped version of the given photo for the primary contact linked to this Person into 
	 * the database. This method will automatically crop and scale the images to the correct 
	 * size for photo type, and set the image onto the primary contact only. The type 
	 * parameter must be one of sizes found in PersonPhotos.TYPE.
	 * 
	 * @param path the path to the source image
	 * @param cropInfo cropping info used to generate the proper thumbnail
	 * @param photoType one of PersonPhotos.TYPE constants
	 * @returns future the future object that performs the cropping/scaling asynchronously. The
	 * future eventually returns the path to the cropped image.
	 */
	setCroppedContactPhoto: function (path, cropInfo, photoType) {
		var future,
			param = {};
		
		param.personId = this.getId();
		param.path = path;
		param.cropInfo = cropInfo;
		param.photoType = photoType;
		
		future = PalmCall.call("palm://com.palm.service.contacts/", "setCroppedContactPhoto", param);
		future.then(function () {
			var result = future.result;
			PalmCall.cancel(future);
			future.result = result;
		});
		return future;
	}, 
	
	//This is the workaround for babelfish-blowfish data migration
	//This function is called after the Person has the tmp_speedDial migrated to speedDial
	//both Person and Contact will strip the tmp_speedDial from its record
	stripTmpPhoneNumberField: function (obj) {
		var i,
			phoneNumber,
			contacts,
			contact,
			future;
		if (obj.length > 0) {
			this.getPhoneNumbers().clear();
			for (i = 0; i < obj.length; i += 1) {
				this.getPhoneNumbers().add(new PhoneNumber());
				phoneNumber = this.getPhoneNumbers().getArray()[i];
				phoneNumber.setValue(obj[i].value ? obj[i].value : phoneNumber.getValue());
				phoneNumber.setType(obj[i].type ? obj[i].type : phoneNumber.getType());
				phoneNumber.setPrimary(obj[i].primary ? obj[i].primary : phoneNumber.getPrimary());
				phoneNumber.setNormalizedValue(obj[i].normalizedValue ? obj[i].normalizedValue : phoneNumber.getNormalizedValue());
				phoneNumber.setSpeedDial(obj[i].speedDial ? obj[i].speedDial : phoneNumber.getSpeedDial());
			}
			
			future = Person.getLinkedContacts(this, ContactType.RAWOBJECT);
		
			future.then(this, function () {				
				contacts = future.result || [];

				for (i = 0; i < contacts.length; i += 1) {
					contact = new Contact(contacts[0]);
					contact.stripTmpPhoneNumberField(); 
					contact.save(); 
				}
				future.result = contacts;
			});
			
			return future;			
		}	
		
	}		

});

/**
 * The DB kind string for the Person object
 * @constant {string} kind
 */
Utils.defineConstant("kind", "com.palm.person:1", Person);

Person.PROPERTIES = { 
	objects: ["favorite", "sortKey", "name", "nickname", "organization", "photos", "reminder", "ringtone"],
	arrays: ["contactIds", "names", "searchTerms", "emails", "phoneNumbers", "ims"]
};

/**
 * Generates a display name for a raw person object.  This is used in situations where it is too expensive to have created
 * a decorated Person object.  The display name is based on the following criteria:<br>
 * 1) Name<br>
 * 2) Nickname<br>
 * 3) Organization Title && Organization Name<br>
 * 4) Organization Name<br>
 * 5) Email Address<br>
 * 6) PhoneNumber<br>
 * 7) "[No Name Available]"<br>
 * @param {Object} rawPerson Raw person object
 * @param {boolean} includeBasedOnField If false, the return value is a {string}<br>
 *						If true, the return value is an {Object}
 * @return {string OR Object} When an {Object} is returned, the baseOnField property will be set from one of the constants defined in {@link DisplayNameType}
 * @example
 * If includeBasedOnField is true, the returned {Object} will have this structure: 
 *		{
 *			displayName: displayName,
 *			basedOnField: basedOnField
 *		}
 * 
 */
//TODO: the logic in this needs to be merged with Utils.generateDisplayName somehow
Person.generateDisplayNameFromRawPerson = function (rawPerson, includeBasedOnField) {
	var obj = rawPerson,
		displayName = "",
		basedOnField = null,
		fullName = Name.getFullNameFromRawObject(obj.name), // FIXME: this needs to use a framework loc function to generate a displayName
		org;	
	
	if (fullName) {
		displayName = fullName;
		basedOnField = DisplayNameType.NAME;
	} else if (obj.nickname) {
		displayName = obj.nickname;
		basedOnField = DisplayNameType.NICKNAME;
	} 
	
	if (!displayName && obj.organization) {
		if (obj.organization.title && obj.organization.name) {
			displayName = obj.organization.title + ", " + obj.organization.name;
			basedOnField = DisplayNameType.TITLE_AND_ORGANIZATION_NAME;
		} else if (!obj.organization.title && obj.organization.name) {
			displayName = obj.organization.name;
			basedOnField = DisplayNameType.ORGANIZATION_NAME;
		} else if (obj.organization.title && !obj.organization.name) {
			displayName = obj.organization.title;
			basedOnField = DisplayNameType.TITLE;
		}
	}
	
	if (!displayName) {
		if (obj.emails && obj.emails.length) {
			displayName = obj.emails[0].value;
			basedOnField = DisplayNameType.EMAIL;
		} else if (obj.ims && obj.ims.length) {
			displayName = obj.ims[0].value;
			basedOnField = DisplayNameType.IM;
		} else if (obj.phoneNumbers && obj.phoneNumbers.length) {
			displayName = obj.phoneNumbers[0].value;
			basedOnField = DisplayNameType.PHONE;
		} else {
			displayName = RB.$L("[No Name Available]");
			basedOnField = DisplayNameType.NONE;
		}
	}
	
	if (includeBasedOnField) {
		return {
			displayName: displayName,
			basedOnField: basedOnField
		};
	} else {
		return displayName;
	}
};

/**
 * Fetches a person + all linked contacts from the DB based on the "id" param.  A decorated {@link PersonDisplay} object is created along with
 * a decorated {@link ContactDisplay} for each linked contact.
 * @param {string} id The DB _id for the person
 * @returns {Future} The Future.result will be set to the decorated {@link PersonDisplay} object which also contains an array of decorated {@link ContactDisplay} objects
 */
Person.getDisplayablePersonAndContactsById = function (id) {
	return Person.getPersonAndContactsById(id, PersonType.DISPLAYABLE, ContactType.DISPLAYABLE);
};

/**
 * Fetches a person + all linked contacts from the DB based on the "id" param.  A decorated {@link PersonLinkable} object is created along with
 * a decorated {@link ContactLinkable} for each linked contact.
 * @param {string} id The DB _id for the person
 * @returns {Future} The Future.result will be set to the decorated {@link PersonLinkable} object which also contains an array of decorated {@link ContactLinkable} objects
 */
Person.getLinkablePersonAndContactsById = function (id) {
	return Person.getPersonAndContactsById(id, PersonType.LINKABLE, ContactType.LINKABLE);
};

/**
 * Fetches a person + all linked contacts from the DB based on the "id" param.  A decorated {@link PersonType} object is created along with
 * a decorated {@link ContactType} for each linked contact.
 * @param {string} id The DB _id for the person
 * @param {string} personType The type of decorated person object to be created after the raw data has been fetched.  Constants defined in {@link PersonType}
 * @param {string} contactType The type of decorated contact objects to be created after the raw data has been fetched.  Constants defined in {@link ContactType}
 * @returns {Future} The Future.result will be set to the decorated `personType` object which also contains an array of decorated `contactType` objects
 */
Person.getPersonAndContactsById = function (id, personType, contactType) {
	Assert.requireString(id, "getPersonAndContactsById requires an id that is a String");
	Assert.requireString(personType, "getPersonAndContactsById requires a person type that is a String");
	Assert.requireString(contactType, "getPersonAndContactsById requires a contact type that is a String");
	
	var person = null,
		contacts = null;
	
	return Person.findById(id, personType).then(function (personFuture) {
		person = personFuture.result;
		Assert.require(person, "Unable to find person by Id");
		personFuture.nest(Person.getLinkedContacts(person, contactType));
	}).then(function (contactFuture) {
		contacts = contactFuture.result || [];
		person.setContacts(contacts);
		contactFuture.result = person;
	});
};

/**
 * Fetches all of the linked contacts for a {@link Person} from the DB.  The retrieved raw contacts are converted into decorated contact objects and returned.
 * @param {Person} person 
 * @param {string} contactType The type of decorated contact that should be created for each contact returned from the DB.  Constants defined in {@link ContactType}
 * @returns {Future} The Future.result will be set to the decorated `contactType` object 
 */
Person.getLinkedContacts = function (person, contactType) {
	Assert.require(person instanceof Person, "getLinkedContacts requires a decorated person arg");
	Assert.requireString(contactType, "getContacts requires a contactType that is a string");
	
	return DB.get(person.getContactIds().getDBObject()).then(function (theFuture) {
		var contacts = Utils.DBResultHelper(theFuture.result) || [],
			decoratedContacts = [],
			i;
		
		for (i = 0; i < contacts.length; i = i + 1) {
			decoratedContacts.push(ContactFactory.create(contactType, contacts[i]));
		}
		theFuture.result = decoratedContacts;
	});
};

/**
 * Link one person to another
 * @param {string} personToLinkTo The DB _id of the person to link to
 * @param {string} personToLink The DB _id of the person to link
 * @returns {Future} Future.result will be set to the result of calling manualLink on the contact linker service
 */
//luna-send -n 1 palm://com.palm.service.contacts.linker/manualLink '{ "personToLinkTo":id, "personToLink":id }'
Person.manualLink = function (personToLinkTo, personToLink) {
	Assert.requireDefined(personToLinkTo, "manualLink: missing required argument - personToLinkTo");
	Assert.requireDefined(personToLink, "manualLink: missing required argument - personToLink");
	var future = PalmCall.call("palm://com.palm.service.contacts.linker/", "manualLink", {
		"personToLinkTo": personToLinkTo,
		"personToLink": personToLink
	});
	future.then(function () {
		var result = future.result;
		PalmCall.cancel(future);
		future.result = result;
	});
	return future;
};

/**
 * Unlink a contact from a person
 * @param {string} personToRemoveLinkFrom The DB _id of the person to remove the link from
 * @param {string} contactToRemoveFromPerson The DB _id of the contact to remove from a person
 * @returns {Future} Future.result will be set to the result of calling manualUnlink on the contact linker service
 */
// luna-send -n 1 palm://com.palm.service.contacts.linker/manualUnlink '{ "personToRemoveLinkFrom":id, "contactToRemoveFromPerson":id }'
Person.manualUnlink = function (personToRemoveLinkFrom, contactToRemoveFromPerson) {
	Assert.requireDefined(personToRemoveLinkFrom, "manualUnlink: missing required argument - personToRemoveLinkFrom");
	Assert.requireDefined(contactToRemoveFromPerson, "manualUnlink: missing required argument - contactToRemoveFromPerson");
	var future = PalmCall.call("palm://com.palm.service.contacts.linker/", "manualUnlink", {
		"personToRemoveLinkFrom": personToRemoveLinkFrom,
		"contactToRemoveFromPerson": contactToRemoveFromPerson
	});
	future.then(function () {
		var result = future.result;
		PalmCall.cancel(future);
		future.result = result;
	});
	return future;
};

/**
 *
 * Favorite a person
 * @param {object} the data to favorite person. Form:
 *    { personId: "1", defaultData: { value: "1234", contactPointType: "ContactsLib.ContactPointTypes.PhoneNumber", listIndex: 3, auxData: { } }}
 * @returns {Future}
 *
 */
Person.favoritePerson = function (param) {
	var future = PalmCall.call("palm://com.palm.service.contacts/", "favoritePerson", param);
	future.then(function () {
		var result = future.result;
		PalmCall.cancel(future);
		future.result = result;
	});
	return future;
};

/**
 * PRIVATE
 * Mark the person as favorite
 * @param {object} the data to favorite person. Form:
 *    { personId: "1", defaultData: { value: "1234", contactPointType: "ContactsLib.ContactPointTypes.PhoneNumber", listIndex: 3, auxData: { } }}
 * @param {string} the application's bus id that is setting the favorite
 * @returns {Future}
 */
Person._favoritePerson = function (param, applicationID) {
	var personId,
		defaultData,
		personToFavorite,
		future = new Future();
	
	future.now(function () {
		personId = param.personId;
		defaultData = param.defaultData;
		
		future.nest(Person._getPersonAndSetFavoriteValueTo(personId, true));
	});
	
	future.then(function () {
		personToFavorite = future.result;
		
		if (defaultData) {
			future.nest(Person._setFavoriteDefault(param, applicationID));
		} else {
			future.result = true;
		}
	});
	
	future.then(function () {
		var result = future.result;
		
		future.nest(personToFavorite.save());
	});
	
	return future;
};

/**
 * Set a favorite default on a person
 * @param {object} the data to set default on a person. Form:
 *    { personId: "1", defaultData: { value: "1234", contactPointType: "ContactsLib.ContactPointTypes.PhoneNumber", listIndex: 3, auxData: { } }}
 * @returns {Future}
 */
Person.setFavoriteDefault = function (param) {
	var future = PalmCall.call("palm://com.palm.service.contacts/", "setFavoriteDefault", param);
	future.then(function () {
		var result = future.result;
		PalmCall.cancel(future);
		future.result = result;
	});
	return future;
};

/**
 * PRIVATE
 * @param {object} the data to favorite person. Form:
 *    { personId: "1", defaultData: { value: "1234", contactPointType: "ContactsLib.ContactPointTypes.PhoneNumber", listIndex: 3, auxData: { } }}
 * @param {string} the application's bus id that is setting the favorite
 * @returns {Future}
 */
Person._setFavoriteDefault = function (param, applicationID) {
	var personId,
		defaultData,
		personToSetDefaultOn,
		defaultsForApp,
		contactPointType,
		listIndex,
		value,
		type,
		i,
		future = new Future();
	
	future.now(function () {
		var contactPointTypeIsSupported = false;
		
		Assert.requireDefined(applicationID, "_setFavoriteDefault: missing required argument - applicationID");
		applicationID = applicationID.split(" ")[0];
		
		personId = param.personId;
		Assert.requireDefined(personId, "_setFavoriteDefault: missing required argument - personId");
		
		defaultData = param.defaultData;
		Assert.requireDefined(defaultData, "_setFavoriteDefault: missing required argument - defaultData");
		
		contactPointType = defaultData.contactPointType;
		listIndex = defaultData.listIndex;
		value = defaultData.value;
		type = defaultData.type;
		
		Assert.requireDefined(contactPointType, "_setFavoriteDefault: missing required defaultData property - contactPointType");
		
		contactPointTypeIsSupported = Person.supportedFavoriteTypes.some(function (supportedFavoriteType) {
			return contactPointType === supportedFavoriteType;
		});
		
		Assert.require(contactPointTypeIsSupported, "_setFavoriteDefault: unsupported contact point type specified");
		Assert.requireDefined(listIndex, "_setFavoriteDefault: missing required defaultData property - listIndex");
		Assert.requireDefined(value, "_setFavoriteDefault: missing required defaultData property - value");
		
		future.nest(Person.findById(personId));
	});
	
	future.then(function () {
		var setDefaultSuccess = false,
			defaultContactPointsForApp,
			tempDefaultContactPointForApp,
			normalizedValueForContactPoint;
		
		personToSetDefaultOn = future.result;
		
		Assert.requireDefined(personToSetDefaultOn, "_setFavoriteDefault: could not find the person with id - " + personId);
		Assert.require(personToSetDefaultOn.isFavorite(), "_setFavoriteDefault: cannot set a default on a person that is not a favorite");
		
		normalizedValueForContactPoint = Person._getNormalizedValueForContactPointType(contactPointType, value);
		
		setDefaultSuccess = personToSetDefaultOn._setDefaultForContactPointType(contactPointType, normalizedValueForContactPoint, type, applicationID, listIndex, defaultData.auxData);
		
		if (setDefaultSuccess) {
			// Don't pass in a contactPointType argument gives us all of the defaults which is necessary to
			// enforce only one default per person per app across multiple contact point types.
			defaultContactPointsForApp = personToSetDefaultOn._getDefaultContactPointsForTypeAndAppId(undefined, applicationID);
			
			// Clean up the other defaults set for this app.
			// This is what forces each app to only have one default
			// set.
			for (i = 0; i < defaultContactPointsForApp.length; i += 1) {
				tempDefaultContactPointForApp = defaultContactPointsForApp[i];
				if (tempDefaultContactPointForApp.getNormalizedValue() !== normalizedValueForContactPoint) {
					tempDefaultContactPointForApp.removeFavoriteDefaultForAppWithId(applicationID);
				}
			}
			
			// TODO look at potentially passing true or something into save rather than using this flag
			personToSetDefaultOn._markFavoriteDefaultsChanged();
			
			future.nest(personToSetDefaultOn.save());
		} else {
			// We could not set the default so throw exception
			throw new Error("Setting favorite default on person - " + personId + " - failed! Could not find a contact point with value - " + value + " - on person");
		}
	});
	
	return future;
};

/**
 * Mark the person as not a favorite - in db and in local object
 * @param {object} { personId: "personId" }
 * @returns {Future}
 */
Person.unfavoritePerson = function (param) {
	var future = PalmCall.call("palm://com.palm.service.contacts/", "unfavoritePerson", param);
	future.then(function () {
		var result = future.result;
		PalmCall.cancel(future);
		future.result = result;
	});
	return future;
};

/**
 * Mark the person as not a favorite
 * @param {object} { personId: "personId" }
 * @returns {Future}
 */
Person._unfavoritePerson = function (param) {
	var personId,
		future = new Future(),
		personToUnfavorite;
	
	future.now(function () {
		personId = param.personId;
		
		future.nest(Person._getPersonAndSetFavoriteValueTo(personId, false));
	});
	
	future.then(function () {
		personToUnfavorite = future.result;
		
		Person._removeFavoriteDefaults(personToUnfavorite);
		
		future.nest(personToUnfavorite.save());
	});
	
	return future;
};

/**
 * Set a specified photo for a person
 * @param {object} { personId: "personId", path: "/path/to/photo", cropInfo: {}, photoType: "" }
 * @returns {Future}
 */
Person._setCroppedContactPhotoPerson = function (param) {
	var personId = param.personId,
		contact,
		future = new Future();
	
	future.now(function () {
		console.log("Person._setCroppedContactPhotoPerson finding person for person ID: " + personId);
		return Person.getDisplayablePersonAndContactsById(personId);
	});
	
	future.then(function () {
		var personToSet = future.result;

        contact = personToSet.getContacts()[0];
		return contact.setCroppedContactPhoto(param.path, param.cropInfo, param.photoType);
	});

	future.then(function () {
		var result = future.result;
		return contact.save();
	});
	
	return future;
};

Person._removeFavoriteDefaults = function (person) {
	Assert.require(person, "Person passed to _removeFavoriteDefaults must be defined");
	
	var i,
		defaults,
		tempDefault;
		
	defaults = person._getDefaultContactPointsForTypeAndAppId();
		
	for (i = 0; i < defaults.length; i += 1) {
		tempDefault = defaults[i];
		tempDefault.removeAllFavoriteData();
	}
};

//TODO: may need some work, could join dupes and notDupes into one array
Person._discoverFavoriteSaverBackupDupes = function (favoriteSavers) {
	var i,
		j,
		tempSaverA,
		tempSaverAValue,
		tempSaverAType,
		tempSaverB,
		dupes = [],
		dupesDifferentFavoriteData = [],
		notDupes = [],
		wasDupe = false,
		tempSaverBType;
		
	Assert.requireArray(favoriteSavers, "You must pass in a valid array to Person._removeFavoriteSaverDupes");
	
	for (i = 0; i < favoriteSavers.length; i += 1) {
		wasDupe = false;
		tempSaverA = favoriteSavers[i];
		tempSaverAValue = tempSaverA.getValue();
		tempSaverAType = tempSaverA.getType();
		
		for (j = i + 1; j < favoriteSavers.length; j += 1) {
			tempSaverB = favoriteSavers[j];
			
			// Get the type of the saver
			tempSaverBType = tempSaverB.getType();
			
			if ((tempSaverAValue === tempSaverB.getValue()) && (tempSaverAType === tempSaverBType)) {
				wasDupe = true;
				if (_.isEqual(tempSaverA.getFavoriteData(), tempSaverB.getFavoriteData())) {
					dupes.push(tempSaverA);
				} else {
					dupesDifferentFavoriteData.push(tempSaverA);
					dupesDifferentFavoriteData.push(tempSaverB);
				}
			}
		}
		
		if (!wasDupe) {
			notDupes.push(tempSaverA);
		}
	}
	
	return { dupesDifferentFavoriteData: dupesDifferentFavoriteData, dupes: dupes, notDupes: notDupes };
};

// TODO: maybe take out the array of people for only one person
// since it should have all the contactIds on it
Person._getAllFavoriteBackupsForPeople = function (people) {
	var contactIds = [],
		tempContactIds,
		i,
		j,
		future = new Future(),
		toMapReduce = [];
	
	future.now(function () {
		Assert.requireArray(people, "You must pass in a valid array to Person._getAllFavoriteBackupsForPeople");
		
		for (i = 0; i < people.length; i += 1) {
			tempContactIds = people[i].getContactIds().getArray();
			for (j = 0; j < tempContactIds.length; j += 1) {
				contactIds.push(tempContactIds[j].getValue());
			}
		}
	
		// For some reason when passing an empty array into _.uniq it barfs and returns undefined.
		// Go figure.
		contactIds = _.uniq(contactIds) || [];
		
		return DB.get(contactIds).then(function (theFuture) {
			var contacts = Utils.DBResultHelper(theFuture.result) || [],
				decoratedContacts = [];
			
			contacts.forEach(function (contact) {
				decoratedContacts.push(new Contact(contact));
			});
			return decoratedContacts;
		});
	});
	
	future.then(function () {
		var result = future.result,
			contacts = result;
		
		contacts.forEach(function (contact) {
			toMapReduce.push({"function": Utils.curry(FavoriteBackup.getBackupForContact, contact)});
		});

		// Get all of the current favorite backups from the db
		return Utils.mapReduceAndReturnResults(toMapReduce);
	});
	
	return future;
};

/**
  * PRIVATE
  * Helper method to get a person and set it's favorite value
  * @param {string} the id of the person to get
  * @param {boolean} the favorite value to set
  * @returns {Future}
  */
Person._getPersonAndSetFavoriteValueTo = function (personId, favoriteValue) {
	var future = new Future();
	
	future.now(function () {
		Assert.requireDefined(personId, "_getPersonAndSetFavoriteValueTo: missing required argument - personId");
		
		future.nest(Person.findById(personId));
	});
	
	future.then(function () {
		var person = future.result;
		
		Assert.requireDefined(person, "_getPersonAndSetFavoriteValueTo: could not find the person with id - " + personId);
		
		person.getFavorite().setValue(favoriteValue);
		
		future.result = person;
	});
	
	return future;
};

/**
  * PRIVATE
  */
Person._getNormalizedValueForContactPointType = function (contactPointType, value) {
	var toReturn = value;
	
	switch (contactPointType) {
	case ContactPointTypes.PhoneNumber:
		toReturn = PhoneNumber.normalizePhoneNumber(value);
		break;
	case ContactPointTypes.EmailAddress:
		toReturn = EmailAddress.normalizeEmail(value);
		break;
	case ContactPointTypes.IMAddress:
		toReturn = IMAddress.normalizeIm(value);
		break;
	//case ContactPointTypes.Address:
	// TODO: implement normalize on address
		//toReturn = value;
		//break;
	//case ContactPointTypes.Url:
	// TODO: implement normalize on url
		//toReturn = value;
		//break;
	}
	
	return toReturn;
};


/**
 * Fetches the reminder string for a person based on the person id
 * @param {string} personId
 * @returns {Future} Future.result will be set to the reminder string
 */
Person.getReminder = function (personId) {
	Assert.requireString(personId, "Person.getReminder requires an id that is a string");
	return Person.findById(personId).then(function (getPersonFuture) {
		var person = getPersonFuture.result;
		getPersonFuture.result = person.getReminder().getValue();
	});
};

/*
 * Methods to find persons from the database
*/

/**
 * Fetch a person from the DB based on the id.
 * @param {string} id the DB _id of the person.
 * @param {string} personType The type of decorated person object to be returned. Constants defined in: {@link PersonType}.
 * @returns {Person} This will return a Person subclass based on the `personType` param or undefined if there were no matches.
 */
Person.findById = function (id, personType) {
	var future = new Future();
	
	future.now(function () {
		personType = personType || PersonType.DISPLAYABLE;

		Assert.requireString(id, "Person.findById requires an id that is a string");
		Assert.requireString(personType, "Person.findById requires a personType that is a string");

		future.nest(DB.get([id]));
	});
	
	future.then(function () {
		var result = Utils.DBResultHelper(future.result);
		
		//TODO: check the kind of the item that came back to see if it's com.palm.person:1?
		if (result && result[0] && result[0]._kind === Person.kind) {
			future.result = PersonFactory.create(result[0], personType);
		} else {
			future.result = undefined;
		}
	});
	
	return future;
};


/**
 * Fetch a person from the DB based on an email address.
 * @param {string} emailAddress The email address to use for the lookup.
 * @param {object} params A set of optional parameters:
 *					* includeMatchingItem If truthy, return the following instead of just the matching person:
 *							{
 *								item: exact item matching the query will be returned
 *								person: the person matching the query
 *							}
 *					* returnAllMatches If truthy, all database matches will be returned, else only one will be returned.  Defaults to falsy.
 *					* personType The type of decorated person object to be returned. Constants defined in: {@link PersonType}.  
 *									Defaults to PersonType.DISPLAYABLE.
 * @returns {Person} Unless includeMatchingItem is specified, this will return a Person subclass based 
 *						on the `personType` param or falsy/empty array if there were no matches.
 */
Person.findByEmail = function (emailAddress, params) {
	var future = new Future(),
		personType,
		normalizedEmail;
	
	future.now(function () {
		params = params || {};
		
		Assert.requireString(emailAddress, "Person.findByEmail requires an email address that is a string");
		
		personType = params.personType || PersonType.DISPLAYABLE;
		Assert.requireString(personType, "Person.findByEmail requires a personType that is a string");
		
		normalizedEmail = EmailAddress.normalizeEmail(emailAddress);
		
		var where = [{
			prop: "emails.normalizedValue",
			op: "=",
			val: normalizedEmail
		}];
		
		return Person._find(where, true, PersonType.RAWOBJECT);
	});
	
	future.then(function () {
		var potentiallyMatchingPersons = future.result,
			curPerson,
			i,
			matchesToReturn = [],
			match,
			matchingEmail,
			compareNormValue = function (email) {
				return email.normalizedValue === normalizedEmail;
			};
		
		if (!potentiallyMatchingPersons || potentiallyMatchingPersons.length === 0) {
			return Person._findByReturnEmpty(params.returnAllMatches);
		}
		
		//for each person found, find the matching email
		for (i = 0; i < potentiallyMatchingPersons.length; i += 1) {
			curPerson = potentiallyMatchingPersons[i];
			
			matchingEmail = _.detect(curPerson.emails, compareNormValue);
			
			//if we found a match, either return them or push them on the array we return
			if (matchingEmail) {
				match = Person._findByGenerateReturnValue(params.includeMatchingItem, personType, EmailAddressExtended, curPerson, matchingEmail);
				if (params.returnAllMatches) {
					matchesToReturn.push(match);
				} else {
					return match;
				}
			}
		}
		
		//once we get here, we either have no matches or we're returning all the matches we have
		//(the case where you have one or more matches and are only returning one of them was already handled above)
		if (matchesToReturn.length === 0) {
			//no matches, so return the correct empty result
			return Person._findByReturnEmpty(params.returnAllMatches);
		} else {
			return matchesToReturn;
		}
	});
	
	return future;
};

/**
 * Fetch a person from the DB based on an IM address.
 * @param {string} imAddress The IM address to use for the lookup.
 * @param {string} type (Optional) If provided, the lookup will only operate on IM addresses of the specified type.  See {@link IMAddress}.TYPE for the types.
 * @param {object} params A set of optional parameters:
 *					* includeMatchingItem If truthy, return the following instead of just the matching person:
 *							{
 *								item: exact item matching the query will be returned
 *								person: the person matching the query
 *							}
 *					* returnAllMatches If truthy, all database matches will be returned, else only one will be returned.  Defaults to falsy.
 *					* personType The type of decorated person object to be returned. Constants defined in: {@link PersonType}.  
 *									Defaults to PersonType.DISPLAYABLE.
 * @returns {Person} Unless includeMatchingItem is specified, this will return a Person subclass based 
 *						on the `personType` param or falsy/empty array if there were no matches.
 */
Person.findByIM = function (imAddress, type, params) {
	var future = new Future(),
		normalizedIMAddress,
		personType;
	
	future.now(function () {
		var where;
		
		params = params || {};
		
		Assert.requireString(imAddress, "Person.findByIM requires an im address that is a string");
		if (type) {
			Assert.requireString(type, "Person.findByIM requires the provided service name be a string");
		}
		
		personType = params.personType || PersonType.DISPLAYABLE;
		Assert.requireString(personType, "Person.findByIM requires a personType that is a string");
		
		normalizedIMAddress = IMAddress.normalizeIm(imAddress);
		
		where = [{
			prop: "ims.normalizedValue",
			op: "=",
			val: normalizedIMAddress
		}];
		
		return Person._find(where, true, PersonType.RAWOBJECT);
	});
	
	future.then(function () {
		var potentiallyMatchingPersons = future.result,
			curPerson,
			i,
			matchesToReturn = [],
			match,
			matchingIM,
			compareNormValueAndType = function (im) {
				//the normalizedValue has to be the same and either we don't care about type or it's the same
				return im.normalizedValue === normalizedIMAddress && (!type || im.type === type);
			};
		
		//if we didn't find any matches, just return the appropriate empty result
		if (!potentiallyMatchingPersons || potentiallyMatchingPersons.length === 0) {
			return Person._findByReturnEmpty(params.returnAllMatches);
		}
		
		//for each person found, find the matching im and optionally check to see if it has the right service name
		for (i = 0; i < potentiallyMatchingPersons.length; i += 1) {
			curPerson = potentiallyMatchingPersons[i];
			
			matchingIM = _.detect(curPerson.ims, compareNormValueAndType);
			
			//if we found a match, either return them or push them on the array we return
			if (matchingIM) {
				match = Person._findByGenerateReturnValue(params.includeMatchingItem, personType, IMAddressExtended, curPerson, matchingIM);
				if (params.returnAllMatches) {
					matchesToReturn.push(match);
				} else {
					return match;
				}
			}
		}
		
		//once we get here, we either have no matches or we're returning all the matches we have
		//(the case where you have one or more matches and are only returning one of them was already handled above)
		if (matchesToReturn.length === 0) {
			//no matches, so return the correct empty result
			return Person._findByReturnEmpty(params.returnAllMatches);
		} else {
			return matchesToReturn;
		}
	});
	
	return future;
};

/**
 * Fetch a person from the DB based on a phone number.
 * @param {string} phoneNumber The phone number to use for the lookup.
 * @param {object} params A set of optional parameters:
 *					* includeMatchingItem If truthy, return the following instead of just the matching person:
 *							{
 *								item: exact item matching the query will be returned
 *								person: the person matching the query
 *							}
 *					* returnAllMatches If truthy, all database matches will be returned, else only one will be returned.  Defaults to falsy.
 *					* personType The type of decorated person object to be returned. Constants defined in: {@link PersonType}.  
 *									Defaults to PersonType.DISPLAYABLE.
 *                  * mcc The MCC of the carrier the device is currently connected to, which helps in properly parsing the phone number
 * @returns {Person} Unless includeMatchingItem is specified, this will return a Person subclass based 
 *						on the `personType` param or falsy/empty array if there were no matches.
 */
Person.findByPhone = function (phoneNumber, params) {
	var future = new Future(),
		parsedPhoneNumber,
		personType;
	
	future.now(function () {
		params = params || {};
		
		Assert.requireString(phoneNumber, "Person.findByPhone requires a phone number that is a string");
		
		personType = params.personType || PersonType.DISPLAYABLE;
		Assert.requireString(personType, "Person.findByPhone requires a personType that is a string");
		
		var normalizedPhoneNumber,
			where;
		
		parsedPhoneNumber = Globalization.Phone.parsePhoneNumber(phoneNumber, undefined, params.mcc);
		if (!parsedPhoneNumber) {
			//if parsing doesn't work for some reason, set the result to something falsy here, which will cause us to return undefined below
			return null;
		}
		normalizedPhoneNumber = PhoneNumber.normalizePhoneNumber(parsedPhoneNumber, true);
		if (!normalizedPhoneNumber) {
			//if normalizing doesn't work for some reason, set the result to something falsy here, which will cause us to return undefined below
			return null;
		}
		
		where = [{
			prop: "phoneNumbers.normalizedValue",
			op: "%",
			val: normalizedPhoneNumber
		}];
		
		return Person._find(where, true, PersonType.RAWOBJECT);
	});
	
	future.then(function () {
		var potentiallyMatchingPersons = future.result,
			potentiallyMatchingPerson,
			realMatches,
			i,
			j,
			pmpPhoneNumbers,
			pmpPhoneNumber,
			parsedPmpPhoneNumber,
			matchQuality,
			match;
		
		if (!potentiallyMatchingPersons || potentiallyMatchingPersons.length === 0) {
			return Person._findByReturnEmpty(params.returnAllMatches);
		}
		
		realMatches = [];
		//loop across each person returned
		for (i = 0; i < potentiallyMatchingPersons.length; i += 1) {
			potentiallyMatchingPerson = potentiallyMatchingPersons[i];
			pmpPhoneNumbers = potentiallyMatchingPerson.phoneNumbers;
			
			//loop across each phone number this person has
			for (j = 0; j < pmpPhoneNumbers.length; j += 1) {
				pmpPhoneNumber = pmpPhoneNumbers[j];
				
				//parse the number, then compare it to the one passed in
				parsedPmpPhoneNumber = Globalization.Phone.parsePhoneNumber(pmpPhoneNumber.value);
				matchQuality = Globalization.Phone.comparePhoneNumbers(parsedPhoneNumber, parsedPmpPhoneNumber);
				
				//if we have a match, create the right return value and then either return it or add it to the array
				if (matchQuality > 0) {
					match = Person._findByGenerateReturnValue(params.includeMatchingItem, personType, PhoneNumberExtended, potentiallyMatchingPerson, pmpPhoneNumber);
					if (params.returnAllMatches) {
						realMatches.push({
							match: match,
							quality: matchQuality
						});
					} else {
						return match;
					}
				}
			}
		}
		
		if (realMatches.length === 0) {
			return Person._findByReturnEmpty(params.returnAllMatches);
		} else {
			realMatches.sort(function (elem1, elem2) {
				return elem1.quality - elem2.quality;
			});
			
			return realMatches.map(function (elem) {
				return elem.match;
			});
		}
	});
	
	return future;
};

//a helper method for the Person.findByXXX methods that generates the proper return value given the specified personType and includeMatchingItem params
Person._findByGenerateReturnValue = function (includeMatchingItem, personType, ItemConstructor, person, item) {
	if (personType !== PersonType.RAWOBJECT) {
		item = new ItemConstructor(item);
	}
	if (includeMatchingItem) {
		return {
			person: PersonFactory.create(person, personType),
			item: item
		};
	} else {
		return PersonFactory.create(person, personType);
	}
};

//a helper method for the Person.findByXXX methods that generates the proper empty return value for the given returnAllMatches params
Person._findByReturnEmpty = function (returnAllMatches) {
	if (returnAllMatches) {
		return [];
	} else {
		return null;
	}
};

Person._find = function (where, returnAllMatches, personType) {
	var future = DB.find({
		from: Person.kind,
		where: where
	});
	
	personType = personType || PersonType.DISPLAYABLE;
	Assert.requireString(personType, "Person._find requires a personType that is a string");
	
	future.then(function (future) {
		var result = future.result;
		
		if (!result || !result.results || result.results.length === 0) {
			return null;
		}
		
		if (returnAllMatches) {
			return result.results.map(function (person) {
				return PersonFactory.create(person, personType);
			});
		} else {
			return PersonFactory.create(result.results[0], personType);
		}
	});
	
	return future;
};

Person.getContactIdsFromLauncherCallbackId = function (launcherCallbackId) {
	Assert.requireString(launcherCallbackId, "Person.getContactIdsFromLauncherCallbackId requires launcherCallbackId to be a string");
	
	return launcherCallbackId.split(Person.DELIMITER);
};

/**
 * Fetch a person given an array of contactIds.
 * @param {array} contactIds - The array of contactIds to find the best matching person
 * @param {string} personType - The type of person to return.
 * @returns {future -> future.result = Person} returns the closest person match given the contactIds
 */
Person.findByContactIds = function (contactIds, personType) {
	var future = new Future();
	
	future.now(function () {
		var where;
		
		Assert.requireArray(contactIds, "Person.findByContactIds requires a contactIds parameter that is an array");
		
		personType = personType || PersonType.DISPLAYABLE;
		
		Assert.requireString(personType, "Person.findByContactIds requires a personType parameter that is a string");
		Assert.require(personType !== PersonType.RAWOBJECT, "Person.findByContactIds does not allow personType of RAWOBJECT");
		
		where  = {
			prop: "contactIds", 
			op: "=",
			val: contactIds
		};
		
		return Person._find([where], true, personType);
	});
	
	future.then(function () {
		var result = future.result,
			personsAlreadySeen = {},
			bestPersonMatch,
			mostMatchedContactIdsCount = 0;
			
		if (result && result.length > 0) {
			result.some(function (person) {
				var personsContactIds,
					matchedContactIdsCount;
				
				// Deal with duped people from find
				if (personsAlreadySeen[person.getId()]) {
					return false;
				}
				
				personsContactIds = person.getContactIds().getArray();
				
				personsContactIds = personsContactIds.map(function (contactId) {
					return contactId.getValue();
				});
				
				// If the current person has the primary from the contactIdsString
				// we want to return that person.
				if (personsContactIds.indexOf(contactIds[0]) >= 0) {
					// We found a person that had the primary contactId. Return the person and
					// stop the looping.
					bestPersonMatch = person;
					return true;
				} else {
					// Get the number of matched contacts the current person has
					matchedContactIdsCount = _.intersect(personsContactIds, contactIds).length;
					
					if (matchedContactIdsCount > mostMatchedContactIdsCount) {
						bestPersonMatch = person;
						mostMatchedContactIdsCount = matchedContactIdsCount;
					}
					
					personsAlreadySeen[person.getId()] = true;	
				}
				
				// We did not find the person that has the primary contactId from the contactIdsString
				// Return false to keep looping
				return false;
			});
			
			return bestPersonMatch;
		} else {
			return null;
		}
	});
	
	return future;
};

Person.orderContactIds = function (person, otherPeopleToMerge, newContactToMerge) {
	var arraysToSort = [],
		primaryContactToSave,
		tempContactsArray,
		fingerWalkerSorter,
		sortedContacts,
		sortedContactIds;
	
	tempContactsArray = person.getContacts();
	
	if (newContactToMerge) {
		arraysToSort.push([newContactToMerge]);
	} else {
		primaryContactToSave = tempContactsArray.shift();
	}
	
	arraysToSort.push(tempContactsArray);
	
	if (otherPeopleToMerge && _.isArray(otherPeopleToMerge)) {
		otherPeopleToMerge.forEach(function (personToMerge) {
			arraysToSort.push(personToMerge.getContacts());
		});
	}
	
	fingerWalkerSorter = new FingerWalkerSorter(arraysToSort, Person.contactOrderComparator);
	sortedContacts = fingerWalkerSorter.sort();
	
	sortedContactIds = _.map(sortedContacts, function (contact) {
		return contact.getId();
	});
	
	if (primaryContactToSave) {
		sortedContactIds.splice(0, 0, primaryContactToSave.getId());
	}
	
	return sortedContactIds;
};

Person.contactOrderComparator = function (contactsToCompare) {
	var lowestContactPriorityValue,
		lowestIndex,
		getPriorityValue = function (contact) {
			var priorityValue = Person.SYNC_SOURCE_PRIORITY_LIST[contact.getKindName()];

			if (priorityValue === undefined) {
				priorityValue = Person.SYNC_SOURCE_PRIORITY_LIST.thirdParty;
			}
			
			return priorityValue;
		};
	
	contactsToCompare.forEach(function (contactToCompare, currentIndex) {
		var tempContactPriorityValue;
		
		if (lowestIndex === undefined) {
			lowestContactPriorityValue = getPriorityValue(contactToCompare);
			
			lowestIndex = currentIndex;
			
			return;
		}
		
		tempContactPriorityValue = getPriorityValue(contactToCompare);
		
		if (tempContactPriorityValue < lowestContactPriorityValue) {
			lowestContactPriorityValue = tempContactPriorityValue;
			lowestIndex = currentIndex;
		}
	});
	
	return lowestIndex;
};

Person.supportedFavoriteTypes = [ContactPointTypes.PhoneNumber, ContactPointTypes.EmailAddress, ContactPointTypes.IMAddress];

Person.SYNC_SOURCE_PRIORITY_LIST = {
	"com.palm.contact.linkedin": 1,
	"com.palm.contact.facebook": 2,
	"com.palm.contact.eas": 3,
	"com.palm.contact.palmprofile": 4,
	"thirdParty": 5,
	"com.palm.contact.google": 6,
	"com.palm.contact.yahoo": 7,
	"com.palm.contact.sim": 8,
	"com.palm.contact.attaddresssync": 9,
	//IM
	"com.palm.contact.skype": 10,
	"com.palm.contact.libpurple": 11,
	"com.palm.contact.imyahoo": 12
};

Person.DELIMITER = ":(|)";

/** 
 * Exported from {@link Person}
 * @name Person.kind
 * @extends Person
 */
exports.Person = Person;
