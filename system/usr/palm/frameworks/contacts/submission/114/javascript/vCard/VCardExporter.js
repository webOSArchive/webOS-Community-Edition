/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500, plusplus: false, bitwise: false */
/*global exports, _, Class, Assert, JSON, Future, Utils, DB, PalmCall, VCardFileWriter, ContactBackupHash, PropertyArray, VCard, DefaultPropertyHash, Contact, ContactLinkable, Url, Name, Person, Nickname, Address, Organization, Birthday, PhoneNumber, EmailAddress, IMAddress, Note, console */

var VCardExporter = exports.VCardExporter = Class.create({
	/** @lends VCardExporter#*/
	
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
	 *                          value: FEF89&wef,jfew9823,
	 *                          type: "PhoneNumber" }] 
	 *                });
	 * 
	 * var favoriteBackupContactHash = favoriteBackup.getContactBackupHash();
	 * var favoriteBackupDefaultPhoneNumber = favoriteBackup.getDefaultPhoneNumber();
	 */
	initialize: function (obj) {
		if (!obj || !obj.filePath) {
			throw new Error("File path must be specified to make a VCardImporter");
		}
		
		this.filePath = obj.filePath;
		
		this.vCardVersion = obj.version ?  obj.version : VCard.VERSIONS.THREE;
		this.charset = obj.charset ? obj.charset : VCard.CHARSET.UTF8;
		this.useFileCache = obj.useFileCache || false;
		this.vCardFileWriter = new VCardFileWriter({ filePath: this.filePath, charset: this.charset});
		this.onlyPhoneNumber = false;
	},
	
	exportOne: function (personId, onlyPhoneNumber) {
		var filecacheFuture,
			future = new Future();
			
		future.now(this, function () {
			Assert.require(personId, "personId passed to export was not truthy. export requires a valid personId to export");
			this.onlyPhoneNumber = onlyPhoneNumber;
			future.nest(Person.getDisplayablePersonAndContactsById(personId));
		});
		
		future.then(this, function () {
			var person = future.result;
			Assert.require(person, "The personId passed into export was not a person that currently exists");
			
			this.vCardFileWriter.open();
			
			this._exportVCard(person);
			
			future.result = {size: this.vCardFileWriter.getSize()};
		});
		
		if (this.useFileCache) {			
			future.then(this, function () {
				var result = future.result,
					size = result.size;
				
				//make an entry in the file cache first
				filecacheFuture = PalmCall.call("palm://com.palm.filecache/", "InsertCacheObject", 
					{	typeName: "contactvcard",
						fileName: this.filePath,
						size: size,
						subscribe: true
					});
								
				return filecacheFuture;					
			});			
		}
		
		future.then(this, function () {
			var result = future.result,
				path = result.pathName || this.filePath;
			
			future.result = {
				success: this.vCardFileWriter.close(path),
				filePath: path
			};
		});
		
		if (this.useFileCache) {
			future.then(this, function () {
				var result = future.result;
				PalmCall.cancel(filecacheFuture);
				future.result = result; 
			});
		}
		
		return future;
	},
	
	exportAll: function (onlyPhoneNumber) {
		var future = new Future();
		
		
		future.now(this, function () {
			var dbFuture, 
				findParams = {
					query: {
						from: Person.kind,
						limit: 500
					}
				};
			
			this.onlyPhoneNumber = onlyPhoneNumber;
			
			this.vCardFileWriter.open();
			
			dbFuture = DB.execute("find", findParams);
			dbFuture.then(this, this._getNextPageForExportAll);
			future.nest(dbFuture);
		});
		
		return future;
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_getNextPageForExportAll: function (nestedFuture) {
		var innerNestedFuture,
			result = nestedFuture.result,
			currentPagePeople,
			nextPageKey = result.next,
			i,
			tempPerson,
			findParams = {
				query: {
					from: Person.kind,
					limit: 500
				}
			};
			
		try {
			currentPagePeople = result.results;
		
			for (i = 0; i < currentPagePeople.length; i += 1) {
				tempPerson = new Person(currentPagePeople[i]);
				this._exportVCard(tempPerson);
			}
		
			// Just in case this doesn't get GCed want to clear it so we don't
			// have tons of people sitting in memory when we are not using them.
			currentPagePeople = undefined;
		
			if (!nextPageKey) {
				nestedFuture.result = {
					success: this.vCardFileWriter.close(),
					filePath: this.filePath
				};
			} else {
				//else we got a page key, so we must do another query to get the next page
				findParams.query.page = nextPageKey;
				innerNestedFuture = DB.execute("find", findParams);

				innerNestedFuture.then(this, this._getNextPageForExportAll);

				nestedFuture.nest(innerNestedFuture);
			}
		} catch (e) {
			this.vCardFileWriter.close();
			throw e;
		}
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_exportVCard: function (person) {
		var phoneNumbers,
			emailAddresses,
			addresses,
			urls,
			ims,
			notes,
			nameToUse,
			i;
		
		if (!person) {
			console.warn("_exportVCard: encountered a false person. Skipping");
			return;
		}
		
		phoneNumbers = person.getPhoneNumbers().getArray();
		
		if (this.onlyPhoneNumber && phoneNumbers.length < 1) {
			console.warn("_exportVCard: encountered a person with no phone numbers where onlyPhoneNumber is true. Skipping that person.");
			return;
		}
		
		nameToUse = this._pickNameToUse(person);
		
		this.vCardFileWriter.writeLine(VCard.MARKERS.BEGIN + "\r");
		
		if (this.vCardVersion === VCard.VERSIONS.TWO_POINT_ONE) {
			this.vCardFileWriter.writeLine(VCard.MARKERS.VERSION + ":" + VCard.VERSIONS.TWO_POINT_ONE + "\r");
		} else {
			this.vCardFileWriter.writeLine(VCard.MARKERS.VERSION + ":" + VCard.VERSIONS.THREE + "\r");
		}
		
		this._writeNameToVCard(nameToUse);
		
		this._writeFullNameToVCard(person);
		
		if (!this.onlyPhoneNumber) {
			this._writeOrganizationToVCard(person.getOrganization());
			
			this._writeNicknameToVCard(person.getNickname());
		}
		
		for (i = 0; i < phoneNumbers.length; i += 1) {
			this._writePhoneNumberToVCard(phoneNumbers[i], this.onlyPhoneNumber);
		}
		
		if (!this.onlyPhoneNumber) {
			emailAddresses = person.getEmails().getArray();
			for (i = 0; i < emailAddresses.length; i += 1) {
				this._writeEmailAddressToVCard(emailAddresses[i]);
			}
			
			addresses = person.getAddresses().getArray();
			for (i = 0; i < addresses.length; i += 1) {
				this._writeAddressToVCard(addresses[i]);
			}
			
			urls = person.getUrls().getArray();
			for (i = 0; i < urls.length; i += 1) {
				this._writeUrlToVCard(urls[i]);
			}
			
			ims = person.getIms().getArray();
			for (i = 0; i < ims.length; i += 1) {
				this._writeIMAddressToVCard(ims[i]);
			}
			
			this._writeBirthdayToVCard(person.getBirthday());
			
			notes = person.getNotes().getArray();
			for (i = 0; i < notes.length; i += 1) {
				if (notes[i]) {
					this._writeNoteToVCard(notes[i]);
					break;
				}
			}
		}
		
		this.vCardFileWriter.writeLine(VCard.MARKERS.END + "\r\n\r");
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	// This method is kinda funky. Depending on if there is a first and 
	// last name it will either put the display name in the last name or
	// will return the whole name of the person. This is mostly for carkits
	// and displaying company names.
	_pickNameToUse: function (person) {
		var generateNameFromCompany = false,
			generateNameFromDisplayText = false,
			toReturn;
			
		if (!person || !person.getName()) {
			return new Name();
		}	
		
		if (!person.getName().getGivenName() && !person.getName().getFamilyName()) {
			toReturn = new Name();
			toReturn.setFamilyName(person.generateDisplayName());
		} else {
			toReturn = person.getName();
		}
		
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeNameToVCard: function (nameObject) {
		if (!nameObject) {
			return;
		}
		
		Assert.require(nameObject instanceof Name, "Object passed to _writeNameToVCard must be an instance of Name");
		var nameLine = "",
			nameValue = "";
		
		nameLine += VCard.MARKERS.NAME;
		
		if (this.charset === VCard.CHARSET.UTF8 && this.vCardVersion === VCard.VERSIONS.TWO_POINT_ONE) {
			nameLine += ";" + VCard.MARKERS.CHARSET_UTF8;
		}
		
		nameLine += ":";
		
		if (nameObject.getFamilyName()) {
			nameLine += nameObject.getFamilyName();
		}
		
		nameLine += ";";
		
		if (nameObject.getGivenName()) {
			nameLine += nameObject.getGivenName();
		}
		
		nameLine += ";";
		
		if (nameObject.getMiddleName()) {
			nameLine += nameObject.getMiddleName();
		}
		
		nameLine += ";";
		
		if (nameObject.getHonorificPrefix()) {
			nameLine += nameObject.getHonorificPrefix();
		}
		
		nameLine += ";";
		
		if (nameObject.getHonorificSuffix()) {
			nameLine += nameObject.getHonorificSuffix();
		}
		
		nameLine += "\r";
		
		this.vCardFileWriter.writeLine(nameLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeFullNameToVCard: function (personObject) {
		if (!personObject) {
			return;
		}
		
		Assert.require(personObject instanceof Person, "Object passed to _writeFullNameToVCard must be an instance of Person");
		
		var fullNameLine = "",
			displayValue = personObject.generateDisplayName();
			
		if ((!displayValue || displayValue.length < 1)) {
			console.warn("VCardExporter bad person passed into _writeFullNameToVCard");
			return;
		}
		
		fullNameLine += VCard.MARKERS.FULL_NAME;
		
		if (this.charset === VCard.CHARSET.UTF8 && this.vCardVersion === VCard.VERSIONS.TWO_POINT_ONE) {
			fullNameLine += ";" + VCard.MARKERS.CHARSET_UTF8;
		}
		
		fullNameLine += ":";
		
		fullNameLine += displayValue + "\r";
		
		this.vCardFileWriter.writeLine(fullNameLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeNicknameToVCard: function (nicknameObject) {
		if (!nicknameObject) {
			return;
		}
		
		Assert.require(nicknameObject instanceof Nickname, "Object passed to _writeNicknameToVCard must be an instance of Nickname");
		var nicknameLine = "",
			nicknameValue = nicknameObject.getValue();
			
		if (!nicknameValue || nicknameValue.length < 1) {
			console.warn("VCardExporter bad nickname passed into _writeNicknameToVCard. Not writing nickname.");
			return;
		}
		
		nicknameLine += VCard.MARKERS.NICKNAME + ":";
		
		nicknameLine += nicknameValue + "\r";
		
		this.vCardFileWriter.writeLine(nicknameLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeOrganizationToVCard: function (organizationObject) {
		if (!organizationObject) {
			return;
		}
		
		Assert.require(organizationObject instanceof Organization, "Object passed to _writeOrganizationToVCard must be an instance of Organization");
		var organizationLine = "",
			jobTitleLine = "",
			organizationValue = organizationObject.getName(),
			jobTitleValue = organizationObject.getTitle();
			
		if (!organizationValue && !jobTitleValue) {
			console.warn("VCardExporter bad organization passed into _writeOrganizationToVCard. Not writing organization.");
			return;
		}
		
		if (organizationValue) {
			organizationLine += VCard.MARKERS.COMPANY + ":";
		
			organizationLine += organizationValue + ";\r";
		
			this.vCardFileWriter.writeLine(organizationLine);
		}
		
		if (jobTitleValue) {
			jobTitleLine += VCard.MARKERS.JOBTITLE + ":";
		
			jobTitleLine += jobTitleValue + "\r";
		
			this.vCardFileWriter.writeLine(jobTitleLine);
		}
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writePhoneNumberToVCard: function (phoneNumber, stripFormatting) {
		if (!phoneNumber) {
			return;
		}
		
		Assert.require(phoneNumber instanceof PhoneNumber, "Object passed to _writePhoneNumberToVCard must be an instance of PhoneNumber");
		var phoneNumberValue = phoneNumber.getValue(),
			phoneNumberLine = "",
			label;
		
		if (stripFormatting) {
			phoneNumberValue = PhoneNumber.unformatForVCard(phoneNumberValue);
		}
		
		// In case the unformatter strip everything or the phoneNumber value is just bad, don't write it.
		if (!phoneNumberValue) {
			console.warn("VCardExporter bad phone number: number = " + phoneNumberValue + " type = " + phoneNumber.getType());
			return;
		}
		
		phoneNumberLine += VCard.MARKERS.PHONE;
		
		if (this.charset === VCard.CHARSET.UTF8 && this.vCardVersion === VCard.VERSIONS.TWO_POINT_ONE) {
			phoneNumberLine += ";" + VCard.MARKERS.CHARSET_UTF8;
		}
		
		label = VCardExporter._buildCorrectLabelBasedOnVersion(this.vCardVersion, VCardExporter._getPhoneLabels(phoneNumber.getType()));
		
		if (label.length > 0) {
			phoneNumberLine += ";" + label;
		}
		
		phoneNumberLine += ":" + phoneNumberValue + "\r";
		
		this.vCardFileWriter.writeLine(phoneNumberLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeEmailAddressToVCard: function (emailAddress) {
		if (!emailAddress) {
			return;
		}
		
		Assert.require(emailAddress instanceof EmailAddress, "Object passed to _writeEmailAddressToVCard must be an instance of EmailAddress");
		var emailAddressValue = emailAddress.getValue(),
			emailAddressLine = "",
			label;
		
		if (!emailAddressValue || emailAddressValue.length < 1) {
			console.warn("VCardExporter bad email address passed into _writeEmailAddressToVCard. Not writing email.");
			return;
		}
		
		emailAddressLine += VCard.MARKERS.EMAIL + ";";
		
		emailAddressLine += VCardExporter._buildCorrectLabelBasedOnVersion(this.vCardVersion, VCardExporter._getEmailLabels(emailAddress.getType()));
		
		emailAddressLine += ":" + emailAddressValue + "\r";
		
		this.vCardFileWriter.writeLine(emailAddressLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeIMAddressToVCard: function (imAddress) {
		if (!imAddress) {
			return;
		}
		
		Assert.require(imAddress instanceof IMAddress, "Object passed to _writeIMAddressToVCard must be an instance of IMAddress");
		var imAddressValue = imAddress.getValue(),
			imAddressLine = "";
			
		if (!imAddressValue || imAddressValue.length < 1) {
			console.warn("VCardExporter bad IM Address passed into _writeIMAddressToVCard. Not writing IM.");
			return;
		}
		
		imAddressLine += VCardExporter._getIMLabels(imAddress.getType()) + ":";
		
		imAddressLine += imAddressValue + "\r";
		
		this.vCardFileWriter.writeLine(imAddressLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeUrlToVCard: function (urlObject) {
		if (!urlObject) {
			return;
		}
		
		Assert.require(urlObject instanceof Url, "Object passed to _writeUrlToVCard must be an instance of Url");
		var urlValue = urlObject.getValue(),
			urlLine = "";
			
		if (!urlValue || urlValue.length < 1) {
			console.warn("VCardExporter bad Url passed into _writeUrlToVCard. Not writing URL.");
			return;
		}
		
		urlLine += VCardExporter._buildCorrectLabelBasedOnVersion(this.vCardVersion, VCardExporter._getUrlLabels(urlObject.getType())) + ":";
		
		urlLine += urlValue + "\r";
		
		this.vCardFileWriter.writeLine(urlLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeAddressToVCard: function (addressObject) {
		if (!addressObject) {
			return;
		}
		
		Assert.require(addressObject instanceof Address, "Object passed to _writeAddressToVCard must be an instance of Address");
		var addressLine = "",
			formattedAddressValue = VCardExporter._formatAddress(addressObject);
			
		if (!formattedAddressValue || formattedAddressValue.length < 1) {
			console.warn("VCardExporter bad address passed into _writeAddressToVCard. Not writing address.");
			return;
		}
		
		addressLine += VCard.MARKERS.ADDRESS + ";";
		
		addressLine += VCardExporter._buildCorrectLabelBasedOnVersion(this.vCardVersion, VCardExporter._getAddressLabels(addressObject.getType()));
		
		addressLine += ":;;";
		
		addressLine += formattedAddressValue + "\r";
		
		this.vCardFileWriter.writeLine(addressLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeNoteToVCard: function (noteObject) {
		if (!noteObject) {
			return;
		}
		
		Assert.require(noteObject instanceof Note, "Object passed to _writeNoteToVCard must be an instance of Note");
		var noteLine = "",
			noteValue = noteObject.getValue();
			
		if (!noteValue || noteValue.length < 1) {
			console.warn("VCardExporter bad note passed into _writeNoteToVCard. Not writing note.");
			return;
		}
		
		noteValue = noteValue.replace(/\n/g, "\\n");
		
		noteValue = noteValue.replace(/\r/g, "\\r");
		
		noteLine += VCard.MARKERS.NOTE + ":";
		
		noteLine += noteValue + "\r";
		
		this.vCardFileWriter.writeLine(noteLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeBirthdayToVCard: function (birthdayObject) {
		if (!birthdayObject) {
			return;
		}
		
		Assert.require(birthdayObject instanceof Birthday, "Object passed to _writeBirthdayToVCard must be an instance of Birthday");
		var birthdayLine = "",
			birthdayValue = birthdayObject.getValue();
			
		if (!birthdayValue || birthdayValue.length < 1) {
			console.warn("VCardExporter bad birthday passed into _writeBirthdayToVCard. Not writing birthday.");
			return;
		}
		
		birthdayLine += VCard.MARKERS.BIRTHDAY + ":";
		
		birthdayLine += birthdayValue + "\r";
		
		this.vCardFileWriter.writeLine(birthdayLine);
	}
	
});

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._formatAddress = function (address) {
	Assert.require(address instanceof Address, "Object passed to VCardExporter._formatAddress must be an instance of Address");
	
	var toReturn = "";
	
	if (address.getStreetAddress()) {
		// Will probably have newlines if we are dealing
		// with an address that came from a freeform source
		toReturn += address.getStreetAddress().replace(/\n/g, " ");
	}
	
	toReturn += ";";
	
	if (address.getLocality()) {
		toReturn += address.getLocality();
	} 
	
	toReturn += ";";
	
	if (address.getRegion()) {
		toReturn += address.getRegion();
	}
	
	toReturn += ";";
	
	if (address.getPostalCode()) {
		toReturn += address.getPostalCode();
	}
	
	toReturn += ";";
	
	if (address.getCountry()) {
		toReturn += address.getCountry();
	}
	
	return toReturn;
};

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._buildCorrectLabelBasedOnVersion = function (vCardVersion, labels) {
	if (vCardVersion === VCard.VERSIONS.TWO_POINT_ONE) {
		return VCardExporter._build2_1TypeLabel(labels);
	} else {
		return VCardExporter._build3_0TypeLabel(labels);
	}
};

/**
 * PRIVATE
 * Given an array of labels, generate the 3.0 vCard type string
 * @param {array[string]} the labels to put together to make a type
 * @returns {string} the label portion for a 3.0 vCard line's label
 */
VCardExporter._build3_0TypeLabel = function (labels) {
	if (labels) {
		return VCardExporter._buildTypeLabelHelper(labels, ",", "TYPE=");
	} else {
		return "";
	}
};

/**
 * PRIVATE
 * Given an array of labels, generate the 2.1 vCard type string
 * @param {array[string]} the labels to put together to make a type
 * @returns {string} the label portion for a 2.1 vCard line's label
 */
VCardExporter._build2_1TypeLabel = function (labels) {
	if (labels) {
		return VCardExporter._buildTypeLabelHelper(labels, ";");
	} else {
		return "";
	}
};

/**
 * PRIVATE
 * Given an array of labels, a seperator, and a prefix build the type label
 * @param {array[string]} the labels to put together to make a type
 * @param {string} the seperator to put between each label
 * @param {string} the prefix to put at the beginning of the type label
 * @returns {string} the label portion for a 3.0 vCard line's label
 */
VCardExporter._buildTypeLabelHelper = function (labels, seperator, prefix) {
	var toReturn = prefix ? prefix : "",
		i;
	
	for (i = 0; i < labels.length; i += 1) {
		toReturn += labels[i];
		if (i < (labels.length - 1)) {
			toReturn += seperator;
		}
	}
	
	return toReturn;
};

/**
 * PRIVATE
 * Iterate through the customLabel passed in and remove any characters that are not
 * alphanumeric or a dash, and return the newly created label
 * @param {string} the custom label to sanitize.
 * @returns {string} the custom label without any illegal characters for the custom type
 */
VCardExporter._sanitizeCustomLabel = function (label) {
	// Take any character that is not a-z or A-Z or 0-9 or - and
	// replace it with empty string
	var toReturn = "";
	label.replace(/[a-zA-Z0-9\-]/g, function (substr) {
		toReturn += substr;
	});
	
	return toReturn;
};

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._getPhoneLabels = function (contactPointValue, customType) {
	return this._getLabelsHelper(VCard.PHONE_LABELS, contactPointValue, false, customType);
};

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._getEmailLabels = function (contactPointValue, customType) {
	return this._getLabelsHelper(VCard.EMAIL_LABELS, contactPointValue, false, customType, ["INTERNET"]);
};

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._getIMLabels = function (serviceName) {
	return this._getLabelsHelper(VCard.IM_SERVICES, serviceName, true);
};

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._getAddressLabels = function (contactPointValue, customType) {
	return this._getLabelsHelper(VCard.ADDRESS_LABELS, contactPointValue, false, customType);
};

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._getUrlLabels = function (contactPointValue, customType) {
	return this._getLabelsHelper(VCard.URL_LABELS, contactPointValue, false, customType);
};

// TODO: We are not supporting custom types anymore. Will have to check if we are going to need to.
/**
 * PRIVATE
 * 
 *
 */
VCardExporter._getLabelsHelper = function (labelObjects, contactPointValue, isIMServiceName, customType, customTypeLabelsToAppend) {
	var toReturn,
		labelObject,
		otherObject,
		i;
	
	otherObject = labelObjects.OTHER ? labelObjects.OTHER.LABELS : [];
	
	if (!contactPointValue) {
		return otherObject;
	}
	
	for (labelObject in labelObjects) {
		if (labelObjects.hasOwnProperty(labelObject)) {
			labelObject = labelObjects[labelObject];
			
			if (isIMServiceName) {
				if (labelObject.SERVICE_NAME === contactPointValue) {
					return labelObject.LABELS;
				}
			} else {
				if (labelObject.CONTACT_POINT_VALUE === contactPointValue) {
					// We need to do special behavior if the type on the labelObject was other.
					// we could be dealing with a custom type
					if (labelObject.CONTACT_POINT_VALUE === labelObjects.OTHER.CONTACT_POINT_VALUE) {
						if (customType) {
							toReturn = [ "X-" + VCardExporter._sanitizeCustomLabel(customType) ];
							if (customTypeLabelsToAppend) {
								for (i = 0; i < customTypeLabelsToAppend.length; i += 1) {
									toReturn.push(customTypeLabelsToAppend[i]);
								}
							}
							return toReturn;
						}
						// If we are not dealing with a custom type, break out of the loop and return the OTHER labels
						break;
					} else {
						return labelObject.LABELS;
					}
				}
			}
		}
	}
	
	return otherObject;
};
