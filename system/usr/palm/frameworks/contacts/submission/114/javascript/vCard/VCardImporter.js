/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, Assert, JSON, VCard, Utils, DB, PalmCall, Future, console, Birthday, Name, IMAddress, Organization, Address, ContactBackupHash, VCardFileReader, Relation, PropertyArray, DefaultPropertyHash, Contact, ContactLinkable, Foundations, PhoneNumber, EmailAddress, Url, Nickname, StringUtils,Crypto, AppPrefs */

var VCardImporter = exports.vCardImporter = Class.create({
	/** @lends VCardImporter#*/
	
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
		this.importToAccountId = obj.importToAccountId ? obj.importToAccountId : "";
		this.importToContactSetId = obj.importToContactSetId ? obj.importToContactSetId : 1;
		this.currentContact = null;
		this.vCardFileReader = null;
	},
	
	// Until foundations.IO support for reading ISO files is added, there is no support for ISO vCards. I.E. vCards from outlook
	
	readVCard: function (processedContactCallback) {
		return this._importVCard(processedContactCallback, false);
	},
	
	importVCard: function (processedContactCallback) {
		return this._setupImport(processedContactCallback, false);
	},

	importVCardNoDuplicates: function (processedContactCallback) {
		return this._setupImport(processedContactCallback, true);
	},

	/**
	 * PRIVATE
	 */
	_importVCard: function (processedContactCallback, saveToDB) {
		var currentLine,
			currentContact,
			processedContactCallbackValue,
			future = new Future(),
			contactProcessedFunction,
			savedProcessedContactFuture = new Future(),
			allContacts = [];
		
		future.now(this, function () {
			if (processedContactCallback && typeof(processedContactCallback) !== "function") {
				throw new Error("importVCard exception: cannot specify a processedContactCallback parameter that is not a function");
			}
			
			this.vCardFileReader = new VCardFileReader({filePath: this.filePath});
			
			future.result = true;
		});
		
		contactProcessedFunction = function (contactProcessedFuture) {
			var result = contactProcessedFuture.result;
		
			if (result.keepProcessing) {
				
				if (!saveToDB && result.processedContact) {
					allContacts.push(result.processedContact);
				}
				
				processedContactCallbackValue = processedContactCallback ? processedContactCallback(result.result) : true;
				if (processedContactCallbackValue) {
					savedProcessedContactFuture.then(this, contactProcessedFunction);
					savedProcessedContactFuture.nest(this._processOneContact(saveToDB));
				} else {
					// processedContactCallback returned false. This means cancel so stop processing vCards
					console.log("importVCard: Consumer cancelled processing of vCard!!");
					if (saveToDB) {
						future.result = true;
					} else {
						future.result = allContacts;
					}
					return;
				}
			} else {
				// Done processing vCard
				if (saveToDB) {
					future.result = true;
				} else {
					future.result = allContacts;
				}
				return;
			}
		};
		
		future.then(this, function () {
			var processOneContactReturnValue,
				result;
				
			savedProcessedContactFuture.then(this, contactProcessedFunction);
			savedProcessedContactFuture.nest(this._processOneContact(saveToDB));
		});
		
		return future;
	},
	
	
	_processOneContact: function (saveToDB) {
		var currentLine = this.vCardFileReader.readLine(),
			currentContact,
			duplicate,
			hash,
			onContactSaveFunction = function (future) {
				var result = future.result;
				future.result = { keepProcessing: true, result: result, processedContact: currentContact };
			};
		
		while (currentLine !== null) {
			if (VCardImporter._isLineBeginVCard(currentLine)) {
				this._setCurrentContact(new Contact());
				currentLine = this.vCardFileReader.readLine();
				continue;
			}

			if (VCardImporter._isLineEndVCard(currentLine)) {
				currentContact = this._getCurrentContact();
				
				if (saveToDB) {
					duplicate = false;
					if (this._hashes) {
						hash = this._generateHash(currentContact);
						duplicate = this._hashes[hash] ? true : false;
					}
					if (duplicate) {
						return new Future({ keepProcessing: true, result: true, processedContact: currentContact });
					} else {
						currentContact.setKind(this._importContactDBKind);
						currentContact.getAccountId().setValue(this.importToAccountId);
						return currentContact.save().then(onContactSaveFunction);
					}
				} else {
					return new Future({ keepProcessing: true, result: true, processedContact: currentContact });
				}
				
			} else {
				// Process the current line
				this._handleLine(currentLine, this.vCardFileReader);
			}
			
			currentLine = this.vCardFileReader.readLine();
		}
		
		return new Future({ keepProcessing: false });
	},
	
	/**
	 * Counts the number of vCards(contacts) contained in the vCard specified at the path.
	 * @param {string} filePath - the filePath of a vCard
	 * @returns {int} The number of contacts in the vCard
	 */
	countContacts: function () {
		return VCardImporter.countContacts(this.filePath);
	},
	
	// PRIVATE
	_getCurrentContact: function () {
		return this.currentContact;
	},
	
	_setCurrentContact: function (contactToAdd) {
		this.currentContact = contactToAdd;
	},
	//////////////////////////////////////
	
	/**
	 * PRIVATE
	 * Given a line from the vCard
	 * process the current line and add it to the current contact object
	 * @param {string}  line from vCard to process
	 * @param {VCardFileReader} a fileReader for a vCard
	 * @returns {} 
	 */
	_handleLine: function (line, fileReader) {
		var lineType = this._getVCardLinePrefixType(line),
			currentContact = this._getCurrentContact(),
			tempOrganization,
			tempLine2,
			endCardRegex;
		
		if (!currentContact) {
			currentContact = new Contact();
			this._setCurrentContact(currentContact);
		}
		
		if (!lineType) {
			return;
		}
		
		switch (lineType) {
		case VCard.MARKERS.NAME:
			currentContact.getName().set(this._handleName(line));
			break;
		case VCard.MARKERS.NICKNAME:
			currentContact.getNickname().setValue(this._handleNickname(line));
			break;
		case VCard.MARKERS.COMPANY:
			this._doOrganizationLine(currentContact, line, this._handleCompanyName);
			break;
		case VCard.MARKERS.JOBTITLE:
			this._doOrganizationLine(currentContact, line, this._handleJobTitle);
			break;
		case VCard.MARKERS.PHONE:
			currentContact.getPhoneNumbers().add(this._handlePhoneNumber(line));
			break;
		case VCard.MARKERS.EMAIL:
			currentContact.getEmails().add(this._handleEmail(line));
			break;
		case VCard.MARKERS.ADDRESS:
			currentContact.getAddresses().add(this._handleAddress(line));
			break;
		case VCard.MARKERS.BIRTHDAY:
			currentContact.getBirthday().setValue(this._handleBirthday(line));
			break;
		case VCard.MARKERS.URL:
			currentContact.getUrls().add(this._handleUrl(line));
			break;
		case VCard.MARKERS.RELATED:
			// Peek at the next line to make sure that it is not
			// an end:vcard line.
			tempLine2 = fileReader.peek();
			endCardRegex = new RegExp(VCard.MARKERS.END);
			if (endCardRegex.exec(VCardImporter._handleBadPeoplesImplementationOfvCardsFixupLine(tempLine2))) {
				console.warn("vCardImporter._handleLine ERROR: ran into a malformed vCard entry when handling related line");
				return;
			}
			// We do this since the next line is not an end:vCard marker and we don't want the next line to be
			// used again since it is going to be used for handleRelation
			tempLine2 = fileReader.readLine();
			currentContact.getRelations().add(this._handleRelation(line, tempLine2));
			break;
		case VCard.MARKERS.SPOUSE_ONE_LINE:
			currentContact.getRelations().add(this._handleRelation(line, VCard.TYPEMARKERS.SPOUSE_ONE_LINER));
			break;
		case VCard.MARKERS.CHILD_ONE_LINE:
			currentContact.getRelations().add(this._handleRelation(line, VCard.TYPEMARKERS.CHILD_ONE_LINER));
			break;
		case VCard.MARKERS.GTALK:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.GTALK.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.AIM:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.AIM.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.MSN:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.MSN.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.YAHOO:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.YAHOO.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.JABBER:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.JABBER.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.QQ:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.QQ.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.ICQ:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.ICQ.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.SKYPE:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.SKYPE.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.IM:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.OTHER.SERVICE_NAME, line));//falls to default
			break;
		case VCard.MARKERS.NOTE:
			currentContact.getNote().setValue(this._handleNote(line));
			break;
		}
		
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard and an array of accumulated multiLine object data
	 * process the current line and add it to this contact object
	 * @param {string}  line from vCard to process
	 */
	_doOrganizationLine: function (currentContact, line, handleOrganizationFunction) {
		var tempOrganization = currentContact.getOrganizations().getArray()[0];
		if (!tempOrganization) {
			tempOrganization = handleOrganizationFunction.apply(this, [line, tempOrganization]);
			currentContact.getOrganizations().add(tempOrganization);
		} else {
			handleOrganizationFunction.apply(this, [line, tempOrganization]);
		}
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates a PhoneNumber object and returns
	 * it.
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {PhoneNumber} the PhoneNumber object that represents the line from the vCard
	 */
	_handlePhoneNumber: function (line) {
		var toReturn = new PhoneNumber();
		toReturn.setValue(this._getLineValue(line));
		toReturn.setType(this._setThisTypeIfUndefined(this._mapVCardValueToContactPointType(this._extractLabel(line), VCard.TYPES.PHONE_NUMBER), VCard.TYPES.PHONE_NUMBER.OTHER.CONTACT_POINT_VALUE));
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates an EmailAddress object and returns
	 * it.
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {EmailAddress} the EmailAddress object that represents the line from the vCard
	 */
	_handleEmail: function (line) {
		var toReturn = new EmailAddress();
		toReturn.setValue(this._getLineValue(line));
		toReturn.setType(this._setThisTypeIfUndefined(this._mapVCardValueToContactPointType(this._extractLabel(line), VCard.TYPES.EMAIL), VCard.TYPES.EMAIL.OTHER.CONTACT_POINT_VALUE));
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates a Nickname object and returns
	 * it.
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {Nickname} the Nickname object that represents the line from the vCard
	 */
	_handleNickname: function (line) {
                return this._unescapeString(this._getLineValue(line));
            },
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates a Url object and returns
	 * it.
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {Url} the Url object that represents the line from the vCard
	 */
	_handleUrl: function (line) {
		var toReturn = new Url();
			//urlString = this._getLineValue(line);
		
		// Need to figure out what this was used for at some point and time
		//urlString = urlString.replace(/\\(.{1})/g, "$1");
		toReturn.setValue(this._getLineValue(line));
		toReturn.setType(this._setThisTypeIfUndefined(this._mapVCardValueToContactPointType(this._extractLabel(line), VCard.TYPES.URL), VCard.TYPES.URL.OTHER.CONTACT_POINT_VALUE));
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates a Birthday object and returns
	 * it.
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {Birthday} the Birthday object that represents the line from the vCard
	 */
	_handleBirthday: function (line) {
		var toReturn,
			bdayValue = this._getLineValue(line);
		
		if (bdayValue.length < 8) {
			console.log("Birthday for vCard contact is too short to parse");
			return undefined;
		}
		
		if (bdayValue.length === 8) {
			bdayValue = bdayValue.substring(0, 4) + "-" + bdayValue.substring(4, 6) + "-" + bdayValue.substring(6, 8);
		} else if (bdayValue.length > 10) {
			return undefined;
		}
		
		return bdayValue;
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates a Name object and returns
	 * it.
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {Name} the Name object that represents the line from the vCard
	 */
	_handleName: function (line) {
		var name = this._getLineValue(line),
			namePieces = this._splitValues(name),
			i = 0,
			namePiece,
			toReturn;
			
		toReturn = new Name();
		
		if (namePieces.length === 0) {
			return toReturn;
		}
		
		for (i = 0; i < namePieces.length; i += 1) {
			namePiece = namePieces[i];
			switch (i) {
			case 0:
				toReturn.setFamilyName(namePiece);
				break;
			case 1:
				toReturn.setGivenName(namePiece);
				break;
			case 2:
				toReturn.setMiddleName(namePiece);
				break;
			case 3:
				toReturn.setHonorificPrefix(namePiece);
				break;
			case 4:
				toReturn.setHonorificSuffix(namePiece);
				break;
			}
		}
		
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Given a line and im type from the vCard this creates an IMAddress object and returns
	 * it.
	 * @param {string} the type of the im address that is being processed
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {IMAddress} the IMAddress object that represents the line from the vCard
	 */
	_handleIM: function (type, line) {
		var im = new IMAddress();
		
		if (!type || !line) {
			return undefined;
		}
		
		switch (type) {
		case VCard.IM_SERVICES.GTALK.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.GTALK.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.AIM.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.AIM.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.MSN.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.MSN.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.JABBER.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.JABBER.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.YAHOO.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.YAHOO.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.ICQ.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.ICQ.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.QQ.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.QQ.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.SKYPE.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.SKYPE.SERVICE_NAME);
			break;
		default:
			im.setType(VCard.IM_SERVICES.OTHER.SERVICE_NAME);
			break;
		}
		
		im.setValue(this._getLineValue(line));
		//im.setType(VCard.TYPES.IM_ADDRESS.OTHER.CONTACT_POINT_VALUE);
		
		return im;
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates an organization object if the
	 * one passed in is not defined and sets the name.
	 * @param {string}  line that contains a contact point entry and a label
	 * @param {Organization} optional - organization object that was returned from a previous
	 *                                  vCard line that contained organization information
	 * @returns {Organization} an organization object with the name value set.
	 */
	_handleCompanyName: function (line, organization) {
		var companyString = this._getLineValue(line),
			splitCompany = this._splitValues(companyString),
			companyName = splitCompany[0];
		
		// splitCompany[1] has the department. We should add this someday
		
		organization = organization ? organization : new Organization();
		
		organization.setName(companyName ? companyName : "");
		
		return organization;
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates an organization object if the
	 * one passed in is not defined and sets the job title.
	 * @param {string}  line that contains a contact point entry and a label
	 * @param {Organization} optional - organization object that was returned from a previous
	 *                                  vCard line that contained organization information
	 * @returns {Organization} an organization object with the jobTitle value set.
	 */
	_handleJobTitle: function (line, organization) {
		var jobTitle = this._unescapeString(this._getLineValue(line));
		
		organization = organization ? organization : new Organization();
		
		organization.setTitle(jobTitle ? jobTitle : "");
		
		return organization;
	},
	
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates an address object and fills it with the line
	 * @param {string}  line that contains an address
	 * @returns {Address} an address object that represents the address from the vCard line
	 */
	_handleAddress: function (line) {
		var toReturn = new Address(),
			poBox = "",
			street = "",
			extended = "",
			addressValue = this._getLineValue(line),
			addressParts,
			addressPart,
			strippedAddress,
			i;
		
		addressParts = addressValue.split(";");
		
		for (i = 0; i < addressParts.length; i += 1) {
			addressPart = addressParts[i];
			
			switch (i) {
			case 0:
				// PO BOX
				poBox = addressPart;
				break;
			case 1:
				// Extended Address. For things like apartment numbers, suites.
				// Google shoves their addresses in here since they are freeform. Kinda annoying.
				strippedAddress = addressPart.replace(/\\n/g, "\n");
				strippedAddress = strippedAddress.replace(/\\\,/g, ",");
				extended = strippedAddress;
				break;
			case 2:
				// Street Address
				street = addressPart;
				break;
			case 3:
				// City
				toReturn.setLocality(addressPart);
				break;
			case 4:
				// State
				toReturn.setRegion(addressPart);
				break;
			case 5:
				// Zip code
				toReturn.setPostalCode(addressPart);
				break;
			case 6:
				// Country
				toReturn.setCountry(addressPart);
				break;
			}
		}
		
		
		// Fancy-shmancy street address handling of shoving PO Box, Street, and extended.
		// Only add commas to one of this if the address component to follow it
		// contains something. If it doesn't contain anything then no point in adding a
		// comma
		poBox = poBox && (street || extended) ? poBox + ", " : poBox;
		street = street && extended ? street + ", " : street;
		toReturn.setStreetAddress(poBox + street + extended);
		
		toReturn.setType(this._setThisTypeIfUndefined(this._mapVCardValueToContactPointType(this._extractLabel(line), VCard.TYPES.ADDRESS), VCard.TYPES.ADDRESS.OTHER.CONTACT_POINT_VALUE));
		
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Given two lines from the vCard this creates a Relation object
	 * @param {string} line that has a relation's name
	 * @param {string} line that holds the type of a relation
	 * @returns {Relation} a relation object from the two lines passed in.
	 */
	_handleRelation: function (relationNameLine, relationTypeLine) {
		var name = relationNameLine ? this._getLineValue(relationNameLine) : undefined,
			type = relationTypeLine ? this._setThisTypeIfUndefined(this._mapVCardValueToContactPointType(this._extractRelationLabel(relationTypeLine), VCard.TYPES.RELATION), VCard.TYPES.RELATION.OTHER.CONTACT_POINT_VALUE) : undefined;
		
		if (name && type) {
			return new Relation({ value: name, type: type, primary: false });
		}
	},
	
	/**
	 * PRIVATE
	 * Gets the type into a standard for for the extractLabel methods
	 * @param {string}  line that contains the label
	 * @returns {string} the label in a standard form
	 */
	_getTypeInfo: function (line) {
		var seperatorIndex = line.indexOf(VCard.MARKERS.SEPERATOR),
			typeInfo,
			toReturn = VCard.TYPEMARKERS.OTHER;
		
		// Do this so that if we don't find the marker we can at least
		// analyze some of the line
		seperatorIndex = seperatorIndex === -1 ? undefined : seperatorIndex;
		
		typeInfo = line.substring(0, seperatorIndex);
		
		typeInfo = VCardImporter._handleBadPeoplesImplementationOfvCardsFixupLine(typeInfo);
		
		return typeInfo;
	},
	
	/**
	 * PRIVATE
	 * Gets the label for a relation
	 * @param {string}  line that contains the relation label
	 * @returns {string} the relation TYPEMARKER that was found 
	 */
	_extractRelationLabel: function (line) {
		var typeInfo = this._getLineValue(line),
			toReturn = VCard.TYPEMARKERS.OTHER;
		
		typeInfo = typeInfo ? VCardImporter._handleBadPeoplesImplementationOfvCardsFixupLine(typeInfo) : "";
		
		if (typeInfo.indexOf(VCard.TYPEMARKERS.ASSISTANT) !== -1) {
			toReturn = VCard.TYPEMARKERS.ASSISTANT;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.BROTHER) !== -1) {
			toReturn = VCard.TYPEMARKERS.BROTHER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.CHILD) !== -1) {
			toReturn = VCard.TYPEMARKERS.CHILD;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.FATHER) !== -1) {
			toReturn = VCard.TYPEMARKERS.FATHER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.FRIEND) !== -1) {
			toReturn = VCard.TYPEMARKERS.FRIEND;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.MANAGER) !== -1) {
			toReturn = VCard.TYPEMARKERS.MANAGER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.MOTHER) !== -1) {
			toReturn = VCard.TYPEMARKERS.MOTHER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.PARENT) !== -1) {
			toReturn = VCard.TYPEMARKERS.PARENT;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.PARTNER) !== -1) {
			toReturn = VCard.TYPEMARKERS.PARTNER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.RELATIVE) !== -1) {
			toReturn = VCard.TYPEMARKERS.RELATIVE;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.SISTER) !== -1) {
			toReturn = VCard.TYPEMARKERS.SISTER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.SPOUSE) !== -1) {
			toReturn = VCard.TYPEMARKERS.SPOUSE;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.REFERRED_BY) !== -1) {
			toReturn = VCard.TYPEMARKERS.REFERRED_BY;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.DOMESTIC_PARTNER) !== -1) {
			toReturn = VCard.TYPEMARKERS.DOMESTIC_PARTNER;
		}
		
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Gets the label for a contact point entry in a line
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {string} the TYPEMARKER that was found 
	 */
	_extractLabel: function (line) {
		var typeInfo = this._getTypeInfo(line),
			toReturn = VCard.TYPEMARKERS.OTHER;
		
		if (typeInfo.indexOf(VCard.TYPEMARKERS.FAX) !== -1) {
			if (typeInfo.indexOf(VCard.TYPEMARKERS.HOME) !== -1) {
				toReturn = VCard.TYPEMARKERS.FAX_HOME;
			} else {
				toReturn = VCard.TYPEMARKERS.FAX_WORK;
			}
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.WORK) !== -1) {
			toReturn = VCard.TYPEMARKERS.WORK;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.HOME) !== -1) {
			toReturn = VCard.TYPEMARKERS.HOME;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.CELL) !== -1) {
			toReturn = VCard.TYPEMARKERS.CELL;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.PAGER) !== -1) {
			toReturn = VCard.TYPEMARKERS.PAGER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.MAIN) !== -1) {
			toReturn = VCard.TYPEMARKERS.MAIN;
		}
		
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Gets the value for a line. With a vCard anything after the seperator
	 * is considered the value.
	 * @param {string}  line that you want the value from
	 * @returns {string} The part of the line after the seperator
	 */
	_getLineValue: function (line) {
		line = Foundations.StringUtils.escapeHTML(line);
		return line.substring(line.indexOf(VCard.MARKERS.SEPERATOR) + 1).replace(/\r$/, "");
	},
	
	/**
	 * PRIVATE
	 * Gets the vCard line's contact point type (TEL, ADR, ...)
	 * @param {string}  line that you want the type from
	 * @returns {string} The type of this line's contact point type
	 */
	_getVCardLinePrefixType: function (line) {
		var prefixMatcher = new RegExp(VCardImporter.PREFIX_REGEX, "i"),
			items = prefixMatcher.exec(line),
			prefixType,
			typeValues,
			tmpType;
			
		if (items && items.length > 2) {
			prefixType = items[2].toUpperCase();
			
			// In case of Yahoo VCard, for each of the entries we will have two lines for IM addresses:
			// One line will be of type X-YAHOO-ID, X-SKYPE-ID (each of the extensions will gain a "-ID")
			// The other line will be an X-IM line of form X-IM;YAHOO;.., X-IM;SKYPE; and so on. In this case we 
			// would need to rewrite the line type
			if (prefixType === VCard.MARKERS.IM) {
				typeValues = this._splitValues(line);
				if (typeValues.length > 1) {
					tmpType = typeValues[1];
                    if (tmpType && VCard.IM_SERVICES[tmpType] && VCard.MARKERS[tmpType]) {
						prefixType = VCard.MARKERS[tmpType];
					}
				}
			}
			return prefixType;
		}
		return undefined;
	},
	
	/**
	 * PRIVATE
	 * Given a vCard type map it into the specific contactPointType passed in
	 * @param {string}  the vCardType, probably returned from _extractLabel
	 * @param {object} an object containing objects with the attributes "VCARD_VALUE", and "CONTACT_POINT_VALUE".
	 *                 one of the objects in the containing objects should not have a VCARD_VALUE. This will be
	 *                 used as the default when the vCardType parameter is not contained in the contactPointTypeObjects
	 * @returns {string} The label for the type of contactPoint
	 */
	_mapVCardValueToContactPointType: function (vCardType, contactPointTypeObjects) {
		var contactPointType,
			contactPointTypeObject,
			defaultContactPointType;
			
		for (contactPointType in contactPointTypeObjects) {
			if (contactPointTypeObjects.hasOwnProperty(contactPointType)) {
				contactPointTypeObject = contactPointTypeObjects[contactPointType];
				
				if (contactPointTypeObject.VCARD_VALUE && contactPointTypeObject.VCARD_VALUE === vCardType) {
					return contactPointTypeObject.CONTACT_POINT_VALUE ? contactPointTypeObject.CONTACT_POINT_VALUE : undefined;
				} else if (!contactPointTypeObject.VCARD_VALUE && !defaultContactPointType) {
					defaultContactPointType = contactPointTypeObject.CONTACT_POINT_VALUE ? contactPointTypeObject.CONTACT_POINT_VALUE : undefined;
				}
			}
		}
		
		return defaultContactPointType;
	},
	
	/**
	 * PRIVATE
	 * Given the returnedContactPointType return it if it was defined, otherwise return this other type
	 * @param {string}  the contactPointType to see if it was undefined
	 * @param {string} the type to return if the returnedContactPointType is undefined
	 * @returns {string} The label for the type of contactPoint
	 */
	_setThisTypeIfUndefined: function (returnedContactPointType, typeToSetIfUndefined) {
		return returnedContactPointType ? returnedContactPointType : typeToSetIfUndefined;
	},

	/**
	 * PRIVATE
	 * Split a 'value string' of the form xxx;yyy;zzz paying attention to the fact that the string
	 * can have escaped (i.e. '\;') semicolons in it and we don't want to split on that. Generally
	 * speaking, we want to consider a valid semicolon to split on to be any one that is preceded by
	 * zero or an even number of backslashes. so, in a nutshell this is an implementation of a
	 * negative "look behind" that js doesn't support natively in its regex engine.
	 *
	 * Additionally, the values need to be un- escaped. Specifically, the following escape sequences
	 * are recognized: 
	 * 
	 * \\ ====> \
	 * \: ====> ;
	 * \; ====> ;
	 * \, ====> ,
	 * 
	 * @param {string}  the value string to split
	 * @returns {array} an array of unescaped values
	 */
	_splitValues: function (string) {
		var	values = [],
		value = "",
		ch,
		backslashes,
		i;
		
		// optimization: see if there are any '\;' in the string
		if (/\\;/.test(string)) {
			for (i = 0; i < string.length; i = i + 1) {
				ch = string.charAt(i);
				if (ch === ';') {
					// see how many backslashes preceed the semicolon
					backslashes = value.match(/[\\]+$/);
					if (backslashes) {
						if ((backslashes[0].length % 2) === 0) {
							values.push(value);
							value = "";
						} else {
							value += ch;
						}
					} else {
						values.push(value);
						value = "";
					}
				} else {
					value += ch;
				}
			}
		
			if (value) {
				values.push(value);
			}
		}
		else {
			values = string.split(';');
		}
		
		// unescape each text value per the vCard spec. Specificly:
		// \: is unescaped as :
		// \; is escaped as ;
		// \, is escaped as ,
		// \\ is escaped as \
		
		for (i = 0; i < values.length; i = i + 1) {
			values[i] = StringUtils.escapeCommon(values[i], /(\\\\)|(\\:)|(\\;)|(\\,)/g, {"\\\\": "\\", "\\:": ":", "\\;": ";", "\\,": ","});
		}
		
		return values;
	},

	/**
	 * PRIVATE
	 * Unescape a string according to the vCard specification. Specifically, the following escape
	 * sequences are recognized: 
	 * 
	 * \\ ====> \
	 * \: ====> ;
	 * \; ====> ;
	 * \, ====> ,
	 * \n ====> newline ('\n')
	 * \N ====> newline ('\n')
	 * 
	 * @param {string}  the string to split
	 * @returns {string} the unescaped string
	 */
	_unescapeString: function (string) {
		return StringUtils.escapeCommon(string, /(\\\\)|(\\:)|(\\;)|(\\,)|(\\N)|(\\n)/g, {"\\\\": "\\", "\\:": ":", "\\;": ";", "\\,": ",", "\\N": "\n", "\\n": "\n" });
	},

	/**
	 * PRIVATE
	 * handle the contact's notes
	 * @param {string} line that has the note
	 * @returns {Note} a note object
	 */
	_handleNote: function (line) {
		return this._unescapeString(this._getLineValue(line));
	},

	/**
	 * PRIVATE
	 * setup for a vacrd import when we need to save the contact to the db
	 * @param {function} the 'saved contact' call back function (can be null)
	 * @param {bool} 'true' to not allow duplicate contacts into the account.
	 * @returns {future} the import future.
	 */
	_setupImport: function (processedContactCallback, deduplicate) {
		var	future = new Future();

		future.now(this, function () {
			if (this.importToAccountId === "") {
				var appPrefs = new AppPrefs(future.callback(function () {
				        return appPrefs.get(AppPrefs.Pref.defaultAccountId);
			        }));
			} else {
				return this.importToAccountId;
			}
		});

		future.then(this, function () {
			this.importToAccountId = future.result;
			console.log("vcards imported to account:" + this.importToAccountId);

			// we need to get the db kind for saving the contact from the account passed in.
			PalmCall.call("palm://com.palm.service.accounts/", "getAccountInfo", {"accountId" : this.importToAccountId}).then(this, function (accountFuture) {
				var	account = accountFuture.result.result,
					provider,
					i,
					noDBKinds = false,
					hash,
					hashes = {},
					hasHashes = false,
					query = {};

				if (accountFuture.result && accountFuture.result.returnValue && (accountFuture.result.returnValue === true)) {

					for (i = 0; (i < account.capabilityProviders.length) && !this._importContactDBKind && !noDBKinds; i = i + 1) {

						provider = account.capabilityProviders[i];
						if (provider.capability === "CONTACTS") {

							if (provider.id === "com.palm.palmprofile.contacts") {
								this._importContactDBKind = "com.palm.contact.palmprofile:1";
							} else if (provider.dbkinds && provider.dbkinds.contact) {
								this._importContactDBKind = provider.dbkinds.contact;
							} else {
								noDBKinds = true;
							}
						}
					}

					if (this._importContactDBKind) {
						if (deduplicate) {
							// generate the hashes for the purpose of de-duplication.
							query.from = Contact.kind;
							query.where = [{ prop: "accountId", op: "=", val: this.importToAccountId}];
							DB.find(query, false, true).then(this, function processContacts(contactsFuture) {
								var	contacts,
									contact,
									count;

								if (contactsFuture.result && contactsFuture.result.returnValue && (contactsFuture.result.returnValue === true) && (contactsFuture.result.results.length > 0)) {
									contacts = contactsFuture.result.results;
									count = contactsFuture.result.results.length;
									for (i = 0; i < count; i = i + 1) {
										hash = this._generateHash(new Contact(contacts[i]));
										if (hash) {
											hashes[hash] = true;
											hasHashes = true;
										}
									}

									if (hasHashes) {
										this._hashes = hashes;
									}
								}

								if (contactsFuture.next) {
									query = {};
									query.from = Contact.kind;
									query.next = contactsFuture.next;
									DB.find(query, false, true).then(_.bind(processContacts, this));
								} else {
									this._importVCard(processedContactCallback, true).then(this, function () {
										future.result = true;
									});
								}
							});
						} else {
							this._importVCard(processedContactCallback, true).then(this, function () {
								future.result = true;
							});
						}
					} else {
						future.exception = {	"errorCode" : "NO_PROVIDER_FOR_CONTACTS",
												"errorText" : "no provider for contacts could be retrieved for account: \"" + this.importToAccountId + "\"" };
					}
				} else {
					future.exception = {	"errorCode" : "NO_ACCOUNT_INFO",
											"errorText" : "no account info could be retrieved for account: \"" + this.importToAccountId + "\"" };
				}
			});
		});

		return future;
	},

	/**
	 * PRIVATE
	 * generate a hash on an item for the purposes of deduplication
	 * @param {contact}  the contact
	 * @returns {string} the hash for the item or null if there are no non-empty properties
	 */

	_generateHash: function (contact) {
		var i,
			j,
			item,
			data = "",
			hash,
			ar;

		item = contact.getAnniversary().getValue();
		data += item ? item : "";

		item = contact.getBirthday().getValue();
		data += item ? item : "";

		item = contact.getGender().getValue();
		data += item ? item : "";

		item = contact.getNickname().getValue();
		data += item ? item : "";

		item = contact.getNote().getValue() ? contact.getNote().getNormalizedHashKey() : null;
		data += item ? item : "";

		item = contact.getName().getNormalizedHashKey();
		data += item ? item : "";

		ar = contact.getAddresses().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getNormalizedHashKey();
			data += item;
		}

		ar = contact.getEmails().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getNormalizedHashKey();
			data += item;
		}

		ar = contact.getIms().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getNormalizedHashKey();
			data += item;
		}

		ar = contact.getOrganizations().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getName();
			item += ar[i].getDepartment();
			item += ar[i].getTitle();
			item += ar[i].getType();
			item += ar[i].getStartDate();
			item += ar[i].getEndDate();
			if (ar[i].getLocation()) {
				item += ar[i].getLocation().getNormalizedHashKey();
			}
			data += item;
		}

		ar = contact.getPhoneNumbers().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getNormalizedHashKey();
			data += item;
		}

		ar = contact.getUrls().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getNormalizedHashKey();
			data += item;
		}

		ar = contact.getRelations().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getNormalizedHashKey();
			data += item;
		}

		hash = (data.length > 0) ? Crypto.MD5.b64_md5(data) : null;
		return hash;
	}
});

/**
 * PRIVATE
 * This method is here to illustrate how morons that don't follow a standard make
 * things more difficult for developers that are trying to consume the standard.
 * Yeah this means you some versions of outlook!!!!!
 */
VCardImporter._handleBadPeoplesImplementationOfvCardsFixupLine = function (line) {
	return line.toUpperCase();
};

VCardImporter._isLineBeginVCard = function (line) {
	var newCardRegex = new RegExp(VCard.MARKERS.BEGIN);
	return newCardRegex.exec(VCardImporter._handleBadPeoplesImplementationOfvCardsFixupLine(line));
};

VCardImporter._isLineEndVCard = function (line) {
	var newCardRegex = new RegExp(VCard.MARKERS.END);
	return newCardRegex.exec(VCardImporter._handleBadPeoplesImplementationOfvCardsFixupLine(line));
};

/**
 * Counts the number of vCards(contacts) contained in the vCard specified at the path.
 * @param {string} filePath - the filePath of a vCard
 * @returns {int} The number of contacts in the vCard
 */
VCardImporter.countContacts = function (filePath) {
	Assert.require(Foundations.Comms.loadFile(filePath), "File to count vCards does not exist");
	
	var vCardReader = new VCardFileReader({filePath: filePath}),
		currentLine = null,
		contactCount = 0;
		
	currentLine = vCardReader.readLine();
	
	while (currentLine !== null) {
		if (VCardImporter._isLineBeginVCard(currentLine)) {
			contactCount += 1;
		}
		currentLine = vCardReader.readLine();
	}
	
	return contactCount;
};

VCardImporter.PREFIX_REGEX = "^(item[0-9]*?.)?([A-Z-]+)[;|:].*";
