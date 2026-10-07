/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, PropertyBase, Utils, Future, IO, Assert, _, PalmCall, LIB_ROOT, palmGetResource, 
console, ContactPhoto, Person */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var photo = new PersonPhotos({ }); //TODO: fill out these params
 * 
 * var photoString = photo.getValue();
 * var photoStringAgain = photo.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var PersonPhotos = exports.PersonPhotos = PropertyBase.create({
	/**
	* @lends PersonPhotos#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "bigPhotoPath",
			defaultValue: "",
			/**
			* @name PersonPhoto#setBigPhotoPath
			* @function
			* @param {string} bigPhotoPath
			*/
			setterName: "setBigPhotoPath",
			/**
			* @name PersonPhoto#getBigPhotoPath
			* @function
			* @returns {string}
			*/
			getterName: "getBigPhotoPath"
		}, {
			dbFieldName: "squarePhotoPath",
			defaultValue: "",
			/**
			* @name PersonPhoto#setSquarePhotoPath
			* @function
			* @param {string} squarePhotoPath
			*/
			setterName: "setSquarePhotoPath",
			/**
			* @name PersonPhoto#getSquarePhotoPath
			* @function
			* @returns {string}
			*/
			getterName: "getSquarePhotoPath"
		}, {
			dbFieldName: "listPhotoPath",
			defaultValue: "",
			/**
			* @name PersonPhoto#setListPhotoPath
			* @function
			* @param {string} listPhotoPath
			*/
			setterName: "setListPhotoPath",
			/**
			* @name PersonPhoto#getListPhotoPath
			* @function
			* @returns {string}
			*/
			getterName: "getListPhotoPath"
		}, {
			dbFieldName: "listPhotoSource",
			defaultValue: "",
			/**
			* @name PersonPhoto#setListPhotoSource
			* @function
			* @param {string} listPhotoSource
			*/
			setterName: "setListPhotoSource",
			/**
			* @name PersonPhoto#getListPhotoSource
			* @function
			* @returns {string}
			*/
			getterName: "getListPhotoSource"
		}, {
			dbFieldName: "bigPhotoId",
			defaultValue: "",
			/**
			* @name PersonPhoto#setBigPhotoId
			* @function
			* @param {string} bigPhotoId
			*/
			setterName: "setBigPhotoId",
			/**
			* @name PersonPhoto#getBigPhotoId
			* @function
			* @returns {string}
			*/
			getterName: "getBigPhotoId"
		}, {
			dbFieldName: "squarePhotoId",
			defaultValue: "",
			/**
			* @name PersonPhoto#setSquarePhotoId
			* @function
			* @param {string} squarePhotoId
			*/
			setterName: "setSquarePhotoId",
			/**
			* @name PersonPhoto#getSquarePhotoId
			* @function
			* @returns {string}
			*/
			getterName: "getSquarePhotoId"
		}, {
			dbFieldName: "contactId",
			defaultValue: "",
			/**
			* @name PersonPhoto#setContactId
			* @function
			* @param {string} contactId
			*/
			setterName: "setContactId",
			/**
			* @name PersonPhoto#getContactId
			* @function
			* @returns {string}
			*/
			getterName: "getContactId"
		}, {
			dbFieldName: "accountId",
			defaultValue: "",
			/**
			* @name PersonPhoto#setAccountId
			* @function
			* @param {string} accountId
			*/
			setterName: "setAccountId",
			/**
			* @name PersonPhoto#getAccountId
			* @function
			* @returns {string}
			*/
			getterName: "getAccountId"
		}
	]
});

PersonPhotos.prototype.getListPhotoSourcePath = function () {
	return (this.getListPhotoSource() === PersonPhotos.TYPE.BIG) ? this.getBigPhotoPath() : this.getSquarePhotoPath();
};

PersonPhotos.prototype.getListPhotoSourceId = function () {
	return (this.getListPhotoSource() === PersonPhotos.TYPE.BIG) ? this.getBigPhotoId() : this.getSquarePhotoId();
};

/**
 * Returns a filepath to a photo that is guaranteed to exist on disk.  If disallowOtherTypes is 
 * false, then it falls back on another photo type (if possible), rather than refetching from the 
 * source.  Touches the file in the filecache before returning its path, so it hopefully doesn't 
 * get kicked out before the caller can use it
 */
PersonPhotos.prototype.getPhotoPath = function (photoType, disallowOtherTypes) {
	return PersonPhotos.getPhotoPath(this.getDBObject(), photoType, disallowOtherTypes);
};

/**
 * Returns a filepath to a photo that is guaranteed to exist on disk.  If disallowOtherTypes is 
 * false, then it falls back on another photo type (if possible), rather than refetching from the 
 * source.  Touches the file in the filecache before returning its path, so it hopefully doesn't 
 * get kicked out before the caller can use it
 */
PersonPhotos.getPhotoPath = function (rawPersonPhotos, photoType, disallowOtherTypes) {
	var future = new Future(),
		filePathToReturn;
	
	future.now(function () {
		var savePathFuture,
			filePath,
			similarPhotoType,
			sptFilePath,
			fileExists,
			photoId,
			i;
		
		photoType = photoType || PersonPhotos.TYPE.SQUARE;
		
		Assert.requireObject(rawPersonPhotos, "PersonPhotos.getPhotoPath requires an object for the rawPersonPhotos argument");
		Assert.requireString(photoType, "You must pass a valid photoType");
		Assert.require(photoType === PersonPhotos.TYPE.BIG || photoType === PersonPhotos.TYPE.SQUARE || photoType === PersonPhotos.TYPE.LIST, "You must pass a valid photoType");
		
		if (rawPersonPhotos.bigPhotoPath === "" && rawPersonPhotos.squarePhotoPath === "" && 
			rawPersonPhotos.listPhotoPath === "" && rawPersonPhotos.accountId === "") 
		{
			future.result = "";
			return;
		}
		
		if (!disallowOtherTypes) {
			//we can use any type, so let's go through all the types in order of similarity and see if any of them exist, while
			//refetching any that are missing
			for (i = 0; i < PersonPhotos.TYPE_SIMILARITIES[photoType].length; i += 1)
			{ 
				similarPhotoType = PersonPhotos.TYPE_SIMILARITIES[photoType][i];
				sptFilePath = PersonPhotos.getPhotoPathFromType(rawPersonPhotos, similarPhotoType);
				fileExists = PersonPhotos.fileExists(sptFilePath);
				if (sptFilePath && fileExists)
				{
					// Use this photo since it exists
					future.result = sptFilePath;
					return;
				}
				else if (sptFilePath)
				{
					// Refetch the missing photo
					future.nest(PersonPhotos._refetchPhoto(similarPhotoType, 
									rawPersonPhotos.accountId, 
									rawPersonPhotos.contactId, 
									PersonPhotos._getPhotoIdToRefetch(rawPersonPhotos, similarPhotoType)));
				}
				else if (photoType === similarPhotoType && rawPersonPhotos.accountId)
				{
					// If this is the phototype we want, and it doesn't have a path set but does have an accountId, try to do a refetch if we can
					photoId = PersonPhotos._getPhotoIdToRefetch(rawPersonPhotos, similarPhotoType);
					if (photoId)
					{
						// Refetch the missing photo
						future.nest(PersonPhotos._refetchPhoto(similarPhotoType, 
										rawPersonPhotos.accountId, 
										rawPersonPhotos.contactId, 
										photoId));
					}
				}
			}

			//else no photos existed, so photos were refetched in the above loop
			future.result = "";
			return;
		} else {
			//else we have to use the type specified, so get it and see if it exists
			filePath = PersonPhotos.getPhotoPathFromType(rawPersonPhotos, photoType);
			if (PersonPhotos.fileExists(filePath)) {
				future.result = filePath;
				return;
			} else {
				//if we're looking for a list photo, see if we can skip the server roundtrip by recropping it from the local copy of the big or square photo
				//this is very important for EAS, where the photos can't actually be downloaded again from the server
				if (photoType === PersonPhotos.TYPE.LIST) {
					//first, get the square photo and see if it exists - if it does, crop from it
					filePath = rawPersonPhotos.squarePhotoPath;
					if (!filePath || !PersonPhotos.fileExists(filePath)) {
						//if square didn't work, get the big photo and see if it exists - if it does, crop from it
						filePath = rawPersonPhotos.bigPhotoPath;
						if (!filePath || !PersonPhotos.fileExists(filePath)) {
							//if that didn't work, then set filePath to something falsy so we fall through into the "refetch from server" case
							filePath = "";
						}
					}
					
					//if we found a valid file to crop from, do the crop
					if (filePath) {
						savePathFuture = ContactPhoto.cropAndGetPath(filePath, {}, PersonPhotos.TYPE.LIST);

						// After getting the path, we need to save the path back to the person object
						savePathFuture.then(function () {
							rawPersonPhotos.listPhotoPath = savePathFuture.result;
							return Person.findByContactIds([rawPersonPhotos.contactId]);
						});
						savePathFuture.then(function () {
							var person = savePathFuture.result;
							person.getPhotos().reinitialize(rawPersonPhotos);
							person.save();
						});
						return savePathFuture;
					}
				}
			
				//at this point, we have to refetch it from the server
				//TODO: this is going to pass the big/square photo path through to the list view, if called with LIST/true.  This is bad.
				if (rawPersonPhotos.accountId && rawPersonPhotos.contactId)
				{
					future.nest(PersonPhotos._refetchPhoto(photoType, 
														rawPersonPhotos.accountId, 
														rawPersonPhotos.contactId,
														PersonPhotos._getPhotoIdToRefetch(rawPersonPhotos, photoType)));
				}
				return;
			}
		}
	});
	
	future.then(function () {
		//store the file path outside this function so that we can return it in the next future.then
		filePathToReturn = future.result;
		//console.log("\n\n\n---------------->>>>>>>>>>>>>>> filePathToReturn: " + Utils.stringify(filePathToReturn) + "\n\n\n");
		
		//optimization: touch the photo in the filecache so that it's less likely to be kicked out 
		//before the caller gets to use it
		if (filePathToReturn) {
			var innerFuture = PalmCall.call("palm://com.palm.filecache", "TouchCacheObject", {
				pathName: filePathToReturn
			});
			innerFuture.onError(function () {
				//this was just an optimization, so if there's an error let's log it and keep going
				console.warn("Ignoring error while touching filecache object.  The filepath we tried to touch: " + Utils.stringify(filePathToReturn));
				
				//now move the outer future along
				future.result = true;
			});
			future.nest(innerFuture);
		} else {
			future.result = true;
		}
	});
	
	future.then(function () {
		//touching the file was just an optimization, so we can ignore the results
		var dummy = future.result;
		
		//now return the actual path
		//console.log("\n\n\n---------------->>>>>>>>>>>>>>> PersonPhotos.getDefaultPhotoPathFromType(photoType): " + Utils.stringify(PersonPhotos.getDefaultPhotoPathFromType(photoType)) + "\n\n\n");
		future.result = filePathToReturn || PersonPhotos.getDefaultPhotoPathFromType(photoType);
	});
	
	return future;
};

PersonPhotos.getPhotoPathFromType = function (rawPersonPhotos, photoType) {
	Assert.requireObject(rawPersonPhotos, "PersonPhotos.getPhotoPathFromType requires an object for the rawPersonPhotos argument");
	Assert.requireString(photoType, "PersonPhotos.getPhotoPathFromType requires a string for the photoType argument");
	Assert.require(photoType === PersonPhotos.TYPE.BIG || photoType === PersonPhotos.TYPE.SQUARE || photoType === PersonPhotos.TYPE.LIST, 
		"PersonPhotos.getPhotoPathFromType requires either PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.BIG, or PersonPhotos.TYPE.LIST for the photoType argument");
	
	switch (photoType) {
	case PersonPhotos.TYPE.BIG:
		return rawPersonPhotos.bigPhotoPath;
	case PersonPhotos.TYPE.SQUARE:
		return rawPersonPhotos.squarePhotoPath;
	case PersonPhotos.TYPE.LIST:
		return rawPersonPhotos.listPhotoPath;
	}
};

PersonPhotos.getDefaultPhotoPathFromType = function (photoType) {
	Assert.requireString(photoType, "PersonPhotos.getDefaultPhotoPathFromType requires a string for the photoType argument");
	Assert.require(photoType === PersonPhotos.TYPE.BIG || photoType === PersonPhotos.TYPE.SQUARE || photoType === PersonPhotos.TYPE.LIST, 
		"PersonPhotos.getDefaultPhotoPathFromType requires either PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.BIG, or PersonPhotos.TYPE.LIST for the photoType argument");

	switch (photoType) {
	case PersonPhotos.TYPE.BIG:
		return PersonPhotos.DEFAULT_DETAILS_AVATAR;
	case PersonPhotos.TYPE.SQUARE:
		return PersonPhotos.DEFAULT_FAVORITES_AVATAR;
	case PersonPhotos.TYPE.LIST:
		return PersonPhotos.DEFAULT_LIST_AVATAR;
	}
};

PersonPhotos._getPhotoIdToRefetch = function (rawPersonPhotos, photoType) {
	Assert.requireObject(rawPersonPhotos, "PersonPhotos._getPhotoIdToRefetch requires an object for the rawPersonPhotos argument");
	Assert.requireString(photoType, "PersonPhotos._getPhotoIdToRefetch requires a string for the photoType argument");
	Assert.require(photoType === PersonPhotos.TYPE.BIG || photoType === PersonPhotos.TYPE.SQUARE || photoType === PersonPhotos.TYPE.LIST, 
		"PersonPhotos._getPhotoIdToRefetch requires either PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.BIG, or PersonPhotos.TYPE.LIST for the photoType argument");
	
	switch (photoType) {
	case PersonPhotos.TYPE.BIG:
		return rawPersonPhotos.bigPhotoId;
	case PersonPhotos.TYPE.SQUARE:
		return rawPersonPhotos.squarePhotoId;
	case PersonPhotos.TYPE.LIST:
		return (rawPersonPhotos.listPhotoSource === PersonPhotos.TYPE.BIG) ? rawPersonPhotos.bigPhotoId : rawPersonPhotos.squarePhotoId;
	}
};

PersonPhotos.fileExists = function (filePath) {
	Assert.requireString(filePath, "PersonPhotos.fileExists requires a string for the filePath argument");
	
	try {
		if (!palmGetResource(filePath))
		{
			return false;
		}
		return true;
	} catch (ex) {
		return false;
	}
};

PersonPhotos._refetchPhoto = function (photoType, accountId, contactId, photoId) {
	var future = new Future();
	
	future.now(function () {
		Assert.requireString(photoType, "PersonPhotos._refetchPhoto requires a string for the photoType argument");
		Assert.require(photoType === PersonPhotos.TYPE.BIG || photoType === PersonPhotos.TYPE.SQUARE || photoType === PersonPhotos.TYPE.LIST, 
			"PersonPhotos._refetchPhoto requires either PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.BIG, or PersonPhotos.TYPE.LIST for the photoType argument");
		Assert.requireString(accountId, "PersonPhotos._refetchPhoto requires a string for the accountId argument");
		Assert.requireString(contactId, "PersonPhotos._refetchPhoto requires a string for the contactId argument");
		Assert.requireString(photoId, "PersonPhotos._refetchPhoto requires a string for the photoId argument");
		
		//first get the account info so we can find out what bus address to talk to
		future.nest(PalmCall.call("palm://com.palm.service.accounts", "getAccountInfo", {
			accountId: accountId
		}));
	});
	
	future.then(function () {
		var result = future.result,
			account,
			contactsCapability;
		
		if (result && result.returnValue) {
			account = result.result;
			contactsCapability = Utils.getContactsCapabilityProvider(account);
			
			//now ping that bus address and get it to refetch the photo
			if (contactsCapability && contactsCapability.refetchPhoto) {
				future.nest(PalmCall.call(contactsCapability.refetchPhoto, "", {
					accountId: accountId,
					contactId: contactId,
					photoId: photoId
				}));
			} else {
				future.result = "";
			}
		} else {
			future.result = "";
		}
	});
	
	future.then(function () {
		var result = future.result;
		
		if (result && result.returnValue) {
			future.result = result.localPath;
		} else {
			future.result = "";
		}
	});
	
	return future;
};



Utils.defineConstant("DEFAULT_LIST_AVATAR", LIB_ROOT + "images/personlist_avatar.png", PersonPhotos);
Utils.defineConstant("DEFAULT_DETAILS_AVATAR", LIB_ROOT + "images/detail_avatar.png", PersonPhotos);
Utils.defineConstant("DEFAULT_FAVORITES_AVATAR", LIB_ROOT + "images/favorites_avatar.png", PersonPhotos);

Utils.defineConstant("LIST_PHOTO_WIDTH", 50, PersonPhotos);
Utils.defineConstant("LIST_PHOTO_HEIGHT", 50, PersonPhotos);
Utils.defineConstant("PHOTO_FILETYPE", "jpg", PersonPhotos);
Utils.defineConstant("LIST_PHOTO_FILECACHE_SIZE", 8192, PersonPhotos);

Utils.defineConstant("GOOGLE_PHOTO_WIDTH", 96, PersonPhotos);
Utils.defineConstant("GOOGLE_PHOTO_HEIGHT", 96, PersonPhotos);
Utils.defineConstant("BIG_PHOTO_WIDTH", 196, PersonPhotos);
Utils.defineConstant("BIG_PHOTO_HEIGHT", 196, PersonPhotos);
// I was able to produce some "big" photos that were up to 134kb by setting them from photos on the phone
// Thus, 150kb seems like a reasonable upper estimate
Utils.defineConstant("BIG_PHOTO_FILECACHE_SIZE", 150000, PersonPhotos); 

PersonPhotos.TYPE = Utils.defineConstants({
	BIG: "type_big",
	SQUARE: "type_square",
	LIST: "type_list"
});

PersonPhotos.TYPE_SIMILARITIES = (function () {
	var typeSimilarities = {};
	typeSimilarities[PersonPhotos.TYPE.BIG] = [PersonPhotos.TYPE.BIG, PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.LIST];
	typeSimilarities[PersonPhotos.TYPE.SQUARE] = [PersonPhotos.TYPE.BIG, PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.LIST];
	typeSimilarities[PersonPhotos.TYPE.LIST] = [PersonPhotos.TYPE.LIST, PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.BIG];
	return typeSimilarities;
}());
