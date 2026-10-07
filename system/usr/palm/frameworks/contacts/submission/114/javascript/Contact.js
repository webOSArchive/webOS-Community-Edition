/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, Assert, JSON, Utils, DB, PalmCall, Person, Name, PropertyArray, Account, Address, 
Anniversary, Birthday, ContactId, DisplayName, EmailAddress, Gender, IMAddress, Nickname, Note, Organization, 
PhoneNumber, ContactPhoto, ReadOnly, SyncSource, Tag, Url, Relation, ContactFactory, ContactType, AccountId, Future, console, ContactLinkable */

var Contact = exports.Contact = Class.create({
	initialize: function (obj) {
		if (!obj) {
			obj = {};
		}
		
		var hasDatabaseId = !!obj._id,
			constructedFromPerson = obj instanceof Person,
			rawContact = (!constructedFromPerson ? obj : {}),
			_origData = (constructedFromPerson ? obj.getDBObject() : rawContact),
			_data = {
				_kind: rawContact._kind || Contact.kind,
				_id: rawContact._id,
				_rev: rawContact._rev,
				_del: rawContact._del,
				remoteId: rawContact.remoteId,
				accounts: Utils.lazyWrapper(PropertyArray, [Account, rawContact.accounts, hasDatabaseId]),
				accountId: Utils.lazyWrapper(AccountId, [rawContact.accountId, hasDatabaseId]),
				addresses: Utils.lazyWrapper(PropertyArray, [Address, rawContact.addresses, hasDatabaseId]),
				anniversary: Utils.lazyWrapper(Anniversary, [rawContact.anniversary, hasDatabaseId]),
				birthday: Utils.lazyWrapper(Birthday, [rawContact.birthday, hasDatabaseId]),
				displayName: Utils.lazyWrapper(DisplayName, [rawContact.displayName, hasDatabaseId]),			// for transport use ONLY
				emails: Utils.lazyWrapper(PropertyArray, [EmailAddress, rawContact.emails, hasDatabaseId]),
				gender: Utils.lazyWrapper(Gender, [rawContact.gender, hasDatabaseId]),
				ims: Utils.lazyWrapper(PropertyArray, [IMAddress, rawContact.ims, hasDatabaseId]),
				name: Utils.lazyWrapper(Name, [rawContact.name, hasDatabaseId]),
				nickname: Utils.lazyWrapper(Nickname, [rawContact.nickname, hasDatabaseId]),
				note: Utils.lazyWrapper(Note, [rawContact.note, hasDatabaseId]),
				organizations: Utils.lazyWrapper(PropertyArray, [Organization, rawContact.organizations, hasDatabaseId]),
				phoneNumbers: Utils.lazyWrapper(PropertyArray, [PhoneNumber, rawContact.phoneNumbers, hasDatabaseId]),
				photos: Utils.lazyWrapper(PropertyArray, [ContactPhoto, rawContact.photos, hasDatabaseId]),
				syncSource: Utils.lazyWrapper(SyncSource, [rawContact.syncSource, hasDatabaseId]),
				tags: Utils.lazyWrapper(PropertyArray, [Tag, rawContact.tags, hasDatabaseId]),
				urls: Utils.lazyWrapper(PropertyArray, [Url, rawContact.urls, hasDatabaseId]),
				relations: Utils.lazyWrapper(PropertyArray, [Relation, rawContact.relations, hasDatabaseId])
			};

		this.accessor = function (fieldName) {
			var field = _data[fieldName];
			Assert.requireDefined(fieldName, "fieldName must be specified for the accessor");
			//Assert.require(field, "the field you requested does not exist: _data[" + fieldName + "]");
			
			if (field && typeof field === "object" && field.isLazyWrapper) {
				field = _data[fieldName] = field.createInstance();
			}
			
			return field;
		};
		
		this.setId = function (id) {
			_data._id = id;
		};
		
		this.setRev = function (rev) {
			_data._rev = rev;
		};
		
		this.setKind = function (kind) {
			_data._kind = kind;
		};
		
		// Only to be used for subclasses to add properties to the data object
		this._extendWithPropertyAndValue = function (propertyName, value) {
			_data[propertyName] = value;
		};
		
		// This converts the person into a database writable object
		// calls getDBObjects on all properties
		this.getDBObject = function () {
			var newData = Utils.getDBObjectForAllProperties(this.accessor, _.keys(_data));
			return _.extend(_origData, newData);
		};
		this.getDirtyDBObject = function () {
			var newData = _.extend(_origData, Utils.getDBObjectForAllDirtyProperties(this.accessor, _.keys(_data)));
			if (newData._rev) {
				delete newData._rev;
			}
			return newData;
		};

		if (constructedFromPerson) {
			this.populateFromPerson(obj);
		}
	},
	
	
	
	// This is intended to be used for UI hacks.
	// Example: linking in the contacts details view. We need to
	// temporarily show an entry in the linked contacts list
	// until the backend can notify us to update
	populateFromPerson: function (person) {
		Assert.requireDefined(person, "populateFromPerson requires a person argument");
		Assert.require(person instanceof Person, "populateFromPerson requires a person argument that is a child of Person");
		
		this.getOrganizations().set(person.getOrganization());
		this.getName().set(person.getName());
		this.getNickname().setValue(person.getNickname().getValue());
		this.getEmails().set(person.getEmails().getArray());
		this.getIms().set(person.getIms());
		this.getPhoneNumbers().set(person.getPhoneNumbers());
		// TODO: add these when this data is available on person
		//this.getPhotos().set(person.getPhotos());
		//this.getUrls().set(person.getUrls());
		//this.getBirthday().set(person.getBirthday());
		//this.getAnniversary().set(person.getAnniversary());
		//this.getNotes().set(person.getNotes());
		
		return true;
	},
	
	addContactDataFromPerson: function (person) {
		Assert.requireDefined(person, "populateFromPerson requires a person argument");
		Assert.require(person instanceof Person, "populateFromPerson requires a person argument that is a child of Person");
		
		// add as raw objects to force validation to strip things off like normalizedValue
		this.getOrganizations().add(person.getOrganization().getDBObject());
		this.getEmails().add(person.getEmails().getDBObject());
		this.getIms().add(person.getIms().getDBObject());
		this.getPhoneNumbers().add(person.getPhoneNumbers().getDBObject());
		return true;
	},

	getKind: function () {
		return this.accessor("_kind");
	},
	
	getId: function () {
		return this.accessor("_id");
	},
	
	getRev: function () {
		return this.accessor("_rev");
	},
	
	getRemoteId: function () {
		return this.accessor("remoteId");
	},
	
	markedForDelete: function () {
		return this.accessor("_del") || false;
	},
	
	getAccountId: function () {
		return this.accessor("accountId");
	},
	
	getAccounts: function () {
		return this.accessor("accounts");
	},
	
	getAddresses: function () {
		return this.accessor("addresses");
	},
	
	getAnniversary: function () {
		return this.accessor("anniversary");
	},
	
	getBirthday: function () {
		return this.accessor("birthday");
	},
	
	getEmails: function () {
		return this.accessor("emails");
	},
	
	getGender: function () {
		return this.accessor("gender");
	},
	
	getIms: function () {
		return this.accessor("ims");
	},
	
	getName: function () {
		return this.accessor("name");
	},
	
	getNickname: function () {
		return this.accessor("nickname");
	},
	
	getNote: function () {
		return this.accessor("note");
	},
	
	getOrganizations: function () {
		return this.accessor("organizations");
	},
	
	getPhoneNumbers: function () {
		return this.accessor("phoneNumbers");
	},
	
	getPhotos: function () {
		return this.accessor("photos");
	},
	
	getSyncSource: function () {
		return this.accessor("syncSource");
	},
	
	getTags: function () {
		return this.accessor("tags");
	},
	
	getUrls: function () {
		return this.accessor("urls");
	},
	
	getRelations: function () {
		return this.accessor("relations");
	},
	
	/*getAccountName: function (cachedAccounts) {
		var accountId = this.getAccountId(),
			tempAccountName = cachedAccounts[accountId],
			future = new Future();
		
		if (tempAccountName) {
			future.result = tempAccountName;
		} else if (accountId) {
			future.nest(DB.get([accountId]));
			
			future.then(this, function () {
				var result = future.result,
					capabilities,
					contactsCapability;
					
				if (result) {
					capabilities = result.capabilityProviders;
					if (capabilities) {
						contactsCapability = _.detect(capabilities, function (capability) { 
								return capability.capability === "CONTACTS"; 
							});
						
						if (contactsCapability) {
							cachedAccounts[accountId] = contactsCapability.id;
							future.result = contactsCapability.id;
							return;
						} 
					}
				}
				
				future.result = "";
				return;
			});
		} else {
			future.result = "";
		}
		
		return future;
	},*/
	
	getKindName: function (includeVersion) {
		var toReturn = this.getKind() || "";
		
		if (!includeVersion) {
			toReturn = toReturn.split(":")[0];
		}
		
		return toReturn;
	},
	
	// TODO: check the end date if it has one
	getBestOrganization: function () {
		var orgs = this.getOrganizations().getArray(),
			i,
			org,
			bestOrg = null;
		
		for (i = 0; i < orgs.length; i = i + 1) {
			org = orgs[i];
			if (!bestOrg) {
				bestOrg = org;
				if (bestOrg.getName() && bestOrg.getTitle()) {
					break;
				}
			} else {
				
				
				if ((org.getName() && org.getTitle()) ||
					(!bestOrg.getName() && org.getName()) || 
					(!bestOrg.getName() && !bestOrg.getTitle() && org.getTitle())) {
					bestOrg = org;
				}
			}
		}
		
		return bestOrg;
	},
	
	generateWorkInfoLine: function () {
		var arr = [],
			org = this.getBestOrganization(),
			orgTitle = "",
			orgName = "";
		
		if (org) {
			orgTitle = org.getTitle();
			orgName = org.getName();
			
			if (orgTitle) {
				arr.push(orgTitle);
			}
			
			if (orgName) {
				arr.push(orgName);
			}
		}
		
		return arr.join(", ");
	},
	
	generateDisplayName: function (includeBasedOnField) {
		return Utils.generateDisplayName(this, includeBasedOnField);
	},
		
	clearPhotos: function () {
		var future = new Future();
		
		future.now(this, function () {
			var innerFuture,
				photos,
				i,
				localPath,
				expireFunction = function (futureSoBrightIGottaWearShades, localPath) {
					try {
						var dummy = futureSoBrightIGottaWearShades.result;
					} catch ( e ) {
						console.error(e);
					}
					if (localPath && typeof(localPath) === "string" && localPath.indexOf("/var") === 0) {
						// console.log("@@@@ Contact.clearPhotos: expiring file " + localPath);
						futureSoBrightIGottaWearShades.nest(ContactPhoto.expire(localPath));
					}
					return true;
				};
			
			// first expire anything in the file cache
			innerFuture = new Future({});
			photos = this.getPhotos().getArray();
			for (i = 0; i < photos.length; i += 1) {
				innerFuture.then(expireFunction.bind(this, innerFuture, photos[i].getLocalPath()));
			}
			
			return innerFuture;
		});

		future.then(this, function () {
			// then actually clear the photos array
			var dummy;
			try {
				dummy = future.result;
			} catch ( e ) {
				console.error(e);
			}
			this.getPhotos().clear();
			return dummy;
		});
		
		return future;
	},
	
	deleteContact: function () {
		var id = this.getId(),
			future = new Future();
		
		Assert.requireDefined(id, "deleteContact unable to delete, there is no _id param");
		
		// if the contact is a SIM contact, use the sim service to delete it
		if (this.getKindName() === "com.palm.contact.sim") {
			future.now(this, function () {
				return PalmCall.call("palm://com.palm.service.contacts.sim/", "deleteContact", {
					"contact": this.getDBObject()
				});
			});

			future.then(this, function () {
				var dummy = future.result;
				PalmCall.cancel(future);
				return this.clearPhotos();
			});
			
		} else {
			future.now(this, function () {
				return this.clearPhotos();
			});
		}
		
		future.then(this, function () {
			var dummy = future.result;
			return DB.del([id]);
		});
		
		return future;
	},
	
	save: function () {
		var future;
		
		// if the contact is a SIM contact, use the sim service to save it
		if (this.getKindName() === "com.palm.contact.sim") {
			future = PalmCall.call("palm://com.palm.service.contacts.sim/", "saveContact", {
				"contact": this.getDBObject()
			});
			
			future.then(this, function () {
				var dummy = future.result;
				PalmCall.cancel(future);
				future.result = true;
			});
		}
		else {
			// if this object has a DB _id then use merge
			if (this.getId()) {
				future = DB.merge([this.getDirtyDBObject()]);
			}
			else {
				future = DB.put([this.getDBObject()]);
			}

			future.then(this, function (future) {
				var result = Utils.DBResultHelper(future.result);
				Assert.require(result, "Contact save put - result is null");
				Assert.requireArray(result, "Contact save");
				Assert.require(result.length, "Contact save put - result length is zero");
				this.setId(result[0].id);
				this.setRev(result[0].rev);
				this.markNotDirty();
				future.result = true;
			});
		}		
		return future;
	},
	
	toString: function () {
		return JSON.stringify(this.getDBObject());
	},
	
	isDirty: function () {
		return Utils.callFunctionsOnProperties(this.accessor, Contact.PROPERTIES.objects, "isDirty", Contact.PROPERTIES.arrays, "containsDirtyEntry");
	},
	
	markNotDirty: function () {
		Utils.callFunctionsOnProperties(this.accessor, Contact.PROPERTIES.objects, "markNotDirty", Contact.PROPERTIES.arrays, "markElementsNotDirty");
	},
	
	// For the time being I am calling equals on each of the contact properties by hand.
	// It would be cool if we had an easy way to iterate over all of them.
	equals: function (otherContact) {
		var isEqual = true,
			i,
			j,
			tempArray,
			otherTempArray,
			property = "",
			properties = Contact.PROPERTIES.objects,
			propertyArrays = Contact.PROPERTIES.arrays;
		
		Assert.require(otherContact instanceof Contact, "The object passed into equals must be an instance of Contact");
		
		for (i = 0; i < properties.length; i += 1) {
			property = properties[i];
			isEqual = isEqual && this.accessor(property).equals(otherContact.accessor(property));
		}
		
		for (j = 0; j < propertyArrays.length; j += 1) {
			property = propertyArrays[j];
			tempArray = this.accessor(property).getArray();
			otherTempArray = otherContact.accessor(property).getArray();
			
			for (i = 0; i < tempArray.length; i += 1) {
				isEqual = isEqual && tempArray[i].equals(otherTempArray[i]);
			}
		}
		
		return isEqual;
	},
	
	/**
	 * Set a cropped version of the given photo into the contact. This method will 
	 * automatically crop and scale the images to the correct size for photo type. The type 
	 * parameter must be one of sizes found in ContactPhoto.TYPE. The contact must be
	 * saved after this method is done in order to write the results out to the database.
	 * 
	 * @param path the path to the source image
	 * @param cropInfo cropping info used to generate the proper thumbnail
	 * @param photoType one of ContactPhoto.TYPE constants
	 * @returns future the future object that performs the cropping/scaling asynchronously.
	 * The future eventually returns the path name to the cropped version of the image. 
	 */
	setCroppedContactPhoto: function (path, cropInfo, photoType) {
		var future = new Future(),
			photos,
			croppedPath;
		
		future.now(this, function () {
			var i,
				photo,
				innerFuture,
				localPath,
				expireFunction = function (brightNewFuture, localPath) {
					try {
						var dummy = brightNewFuture.result;
					} catch ( e ) {
						console.error(e);
					}
					if (localPath && typeof(localPath) === "string" && localPath.indexOf("/var") === 0) {
						// console.log("@@@@ Contact.setCroppedContactPhoto: expiring file " + localPath);
						brightNewFuture.nest(ContactPhoto.expire(localPath));
					}
					return true;
				};
			
			photos = this.getPhotos().getArray();
			
			innerFuture = new Future({});
			for (i = photos.length - 1; i >= 0; i -= 1) {
				photo = photos[i];
				if (photo.getType() === photoType) {
					innerFuture.then(expireFunction.bind(this, innerFuture, photos[i].getLocalPath()));
					photos.splice(i, 1);
				}
			}
			
			future.nest(innerFuture);
		});

		future.then(this, function () {
			try {
				var dummy = future.result;
			} catch ( e ) {
				console.error(e);
			}

			return PalmCall.call("palm://com.palm.service.accounts", "getAccountInfo", {
				accountId: this.getAccountId().getValue()
			});
		});
		
		future.then(this, function () {
			var template,
				innerFuture;
			try {
				template = future.result.result.templateId;
			} catch ( e ) {
				console.error(e);
			}

			if (template === "com.palm.palmprofile")
			{
				// In the case of a palmprofile photo, we don't want to reference the original photo
				// so we set the "value" (in addition to "localPath") to the newly generated image 
				innerFuture = ContactPhoto.cropAndGetPathToMediaInternal(path, cropInfo, photoType);
				innerFuture.then(this, function () {
					path = innerFuture.result;
					return path;
				});
				return innerFuture;
			}
			else
			{
				return ContactPhoto.cropAndGetPath(path, cropInfo, photoType);
			}
		});
		
		future.then(this, function () {
			var contactPhoto,
			croppedPath = future.result;
			
			//console.log("@@@@ Contact.setCroppedContactPhoto: cropping done. path is " + croppedPath);
			//TODO: what do we save for the value?  Palm Profile needs the local source path as the value, but other sync engines need <xyz> remote path? Yes.
			contactPhoto = new ContactPhoto({
				value: path,
				localPath: croppedPath,
				type: photoType
			});
			
			contactPhoto.forceMarkDirty();		// yes, it's dirty, but it's not porn
			photos.splice(0, 0, contactPhoto);
			
			this.getPhotos().set(photos);
			
			return croppedPath;
		});
		
		return future;
	},
	
	//This is the workaround for babelfish-blowfish data migration
	//This function is called after the Person has the tmp_speedDial migrated to speedDial
	//both Person and Contact will strip the tmp_speedDial from its record
	stripTmpPhoneNumberField: function () {
		var i,
			phoneNumber,
			phoneNumbers = this.getPhoneNumbers().getDBObject(); 
		if (phoneNumbers) {
			this.getPhoneNumbers().clear();//clear the contact phone number
			for (i = 0; i < phoneNumbers.length; i += 1) {
				this.getPhoneNumbers().add(new PhoneNumber());
				phoneNumber = this.getPhoneNumbers().getArray()[i];
				phoneNumber.setValue(phoneNumbers[i].value ? phoneNumbers[i].value : phoneNumber.getValue());
				phoneNumber.setType(phoneNumbers[i].type ? phoneNumbers[i].type : phoneNumber.getType());
				if (phoneNumbers[i].primary) {
					phoneNumber.setPrimary(phoneNumbers[i].primary);
				}
			}
		}	
	}		
});

/**
 * The DB kind string for the Contact object
 * @name Contact.kind
 * @property {string} kind 
 */
Utils.defineConstant("kind", "com.palm.contact:1", Contact);

Contact.PROPERTIES = { 
	objects: ["anniversary", "birthday", "displayName", "gender", "name", "nickname", "note", "syncSource"],
	arrays: ["accounts", "addresses", "emails", "ims", "organizations", "phoneNumbers", "photos", "tags", "urls", "relations"]
};

Contact.getIdFromLinkHash = function (linkHash) {
	return ContactLinkable.getIdFromLinkHash(linkHash);
};

Contact.getContactByRemoteId = function (remoteId) {
	var future = new Future();
	
	future.now(function () {
		Assert.requireString(remoteId, "Contact.getContactByRemoteId requires a remoteId that is a valid string");
		
		return DB.find({
			from: Contact.kind,
			where: [{
				prop: "remoteId",
				op: "=",
				val: remoteId
			}]
		});
	});
	
	future.then(function () {
		var result = Utils.DBResultHelper(future.result);
		
		if (result && result.length > 0) {
			return new Contact(result[0]);
		} else {
			return null;
		}
	});
	
	return future;
};

//TODO: this will only fetch the first 500 contacts!!
Contact.getContactsByAccountId = function (accountId) {
	var future = new Future();
	
	future.now(function () {
		Assert.requireString(accountId, "Contact.getContactsByAccountId requires an accountId that is a valid string");
		
		return DB.find({
			from: Contact.kind,
			where: [{
				prop: "accountId",
				op: "=",
				val: accountId
			}]
		});
	});
	
	future.then(function (future) {
		var result = Utils.DBResultHelper(future.result);
		
		if (result && result.length > 0) {
			future.result = result.map(function (contact) {
				return new Contact(contact);
			});
		} else {
			future.result = [];
		}
	});
	
	return future;
};
