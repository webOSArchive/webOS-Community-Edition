/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, Utils, exports, Date, Globalization, PalmCall, Future, Foundations, _, PersonPhotos, LIB_ROOT, Assert, console */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var photo = new ContactPhoto({}); //TODO: update this
 * 
 * var photoString = photo.getValue();
 * var photoStringAgain = photo.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var ContactPhoto = exports.ContactPhoto = PropertyBase.create({
	/**
	* @lends ContactPhoto#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name ContactPhoto#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name ContactPhoto#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}, {
			dbFieldName: "type",
			defaultValue: "type_square",
			/**
			* @name ContactPhoto#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name ContactPhoto#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		}, {
			dbFieldName: "primary",
			defaultValue: false,
			/**
			* @name ContactPhoto#setPrimary
			* @function
			* @param {string} primary
			*/
			setterName: "setPrimary",
			/**
			* @name ContactPhoto#getPrimary
			* @function
			* @returns {string}
			*/
			getterName: "getPrimary"
		}, {
			dbFieldName: "localPath",
			defaultValue: "",
			/**
			* @name ContactPhoto#setLocalPath
			* @function
			* @param {string} localPath
			*/
			setterName: "setLocalPath",
			/**
			* @name ContactPhoto#getLocalPath
			* @function
			* @returns {string}
			*/
			getterName: "getLocalPath"
		}
	]
});

//TODO: is there a better way to do this?
ContactPhoto.prototype.getId = function () {
	return this.getDBObject()._id;
};

/**
 * For the contact provided, return a valid filepath of the specified photoType (or any photo, if one of the specified type does not exist).
 * Contact must be wrapped.  Returns a future.
 */
ContactPhoto.getPhotoPath = function (contact, photoType) {
	var future = new Future();
	
	future.now(function () {
		var drawerPhotoPath,
			drawerPhotoId,
			photosArray,
			squarePhoto;
		
		photoType = photoType || ContactPhoto.TYPE.SQUARE;
		Assert.requireString(photoType, "ContactPhoto.attachPhotoPathsToContacts requires a string for the photoType argument");
		Assert.require(photoType === ContactPhoto.TYPE.BIG || photoType === ContactPhoto.TYPE.SQUARE, 
			"ContactPhoto.attachPhotoPathsToContacts requires either ContactPhoto.TYPE.SQUARE or ContactPhoto.TYPE.BIG for the photoType argument");
		
		if (contact.getPhotos() && contact.getPhotos().getArray()) {
			photosArray = contact.getPhotos().getArray();
			
			//if we have an array...
			if (photosArray && _.isArray(photosArray)) {
				//find the square one...
				squarePhoto = _.detect(photosArray, function (photo) {
					return photo.getType() === photoType;
				});
				//or just use the first one...
				squarePhoto = squarePhoto || photosArray[0];
				
				//if we have something, get the local path...
				if (squarePhoto) {
					drawerPhotoPath = squarePhoto.getLocalPath();
					drawerPhotoId = squarePhoto.getId();
				}
			}
		}
		
		if (drawerPhotoPath) {
			//if we have a photo, check to see if it exists
			if (PersonPhotos.fileExists(drawerPhotoPath)) {
				future.result = drawerPhotoPath;
				return;
			} else {
				//else it doesn't exist, so refetch the photo
				future.nest(PersonPhotos._refetchPhoto(photoType, contact.getAccountId().getValue(), contact.getId(), drawerPhotoId));
				return;
			}
		} else {
			//else we didn't find one, so use the default
			if (photoType === ContactPhoto.TYPE.BIG)
			{
				future.result = ContactPhoto.DEFAULT_BIG_PHOTO;
			}
			else
			{
				future.result = ContactPhoto.DEFAULT_SQUARE_PHOTO;
			}

			return;
		}
	});
	
	return future;
};

/**
 * For each contact provided, attach a valid filepath at contact[fieldName] of the specified photoType (or any photo, if one of the specified type does not exist).
 * Contacts must be wrapped.  Returns a future.
 */
ContactPhoto.attachPhotoPathsToContacts = function (contacts, photoType, fieldName) {
	var future = Foundations.Control.mapReduce({
		map: function (contact) {
			var future = new Future();
			
			future.now(function () {
				photoType = photoType || ContactPhoto.TYPE.SQUARE;
				Assert.requireString(photoType, "ContactPhoto.attachPhotoPathsToContacts requires a string for the photoType argument");
				Assert.require(photoType === ContactPhoto.TYPE.BIG || photoType === ContactPhoto.TYPE.SQUARE, 
					"ContactPhoto.attachPhotoPathsToContacts requires either ContactPhoto.TYPE.SQUARE or ContactPhoto.TYPE.BIG for the photoType argument");
				
				fieldName = fieldName || "drawerPhotoPath";
				Assert.requireString(fieldName, "ContactPhoto.attachPhotoPathsToContacts requires a string for the fieldName argument");
				
				future.nest(ContactPhoto.getPhotoPath(contact, photoType));
			});
			
			future.then(function () {
				contact[fieldName] = future.result;
				
				future.result = true;
			});
			
			return future;
		}
	}, contacts);
	
	return future;
};

ContactPhoto.cropAndGetPathToMediaInternal = function (fromPath, cropInfo, type, timingRecorderParam) {
	var destWidth = PersonPhotos.LIST_PHOTO_WIDTH,
		cropWidth = PersonPhotos.LIST_PHOTO_WIDTH,
		cropHeight = PersonPhotos.LIST_PHOTO_HEIGHT,
		size = PersonPhotos.LIST_PHOTO_FILECACHE_SIZE,
		fromFile,
		toPath,
		future = new Future(),
		cacheFuture;
	
	future.now(function () {
		if (type === ContactPhoto.TYPE.BIG) {
			destWidth = PersonPhotos.BIG_PHOTO_WIDTH;
			cropWidth = PersonPhotos.BIG_PHOTO_WIDTH;
			cropHeight = PersonPhotos.BIG_PHOTO_HEIGHT;
			size = PersonPhotos.BIG_PHOTO_FILECACHE_SIZE;
		}
		
		fromFile = fromPath.split("/");
		if ((fromFile.length - 1) >= 0) {
			fromFile = fromFile[fromFile.length - 1];
		} else {
			fromFile = "default." + PersonPhotos.PHOTO_FILETYPE;
		}
		
		toPath = "/media/internal/.contactphotos/";
		toPath += Date.now();
		toPath += "." + PersonPhotos.PHOTO_FILETYPE;

		//console.log("contact photo thumbnail to be saved to: " + toPath );
		// console.log("@@@@ cropAndGetPath: cropping image, w: " + cropWidth + ", h: " + cropHeight + ", source: " + fromPath + " toPath: " + toPath);
		
		var imageConvertParams = {
			src: fromPath,
			dest: toPath,
			destType: PersonPhotos.PHOTO_FILETYPE,
			focusX: cropInfo.focusX,
			focusY: cropInfo.focusY,
			scale: destWidth / cropInfo.suggestedXsize,
			cropW: cropWidth,
			cropH: cropHeight
		};
		
		return PalmCall.call("palm://com.palm.image", "convert", imageConvertParams);
	});
	
	future.then(function () {
		var result;
		
		try {
			result = future.result;	// read it to cause any exceptions to be thrown
		} catch (e) {
			throw e;
		}
		
		return toPath;
	});
	
	return future;
};


ContactPhoto.cropAndGetPath = function (fromPath, cropInfo, type, timingRecorderParam) {
	var destWidth = PersonPhotos.LIST_PHOTO_WIDTH,
		cropWidth = PersonPhotos.LIST_PHOTO_WIDTH,
		cropHeight = PersonPhotos.LIST_PHOTO_HEIGHT,
		size = PersonPhotos.LIST_PHOTO_FILECACHE_SIZE,
		toPath,
		future = new Future(),
		cacheFuture,
		timingRecorder = timingRecorderParam || {
			startTimingForJob: function () {
				
			},
			stopTimingForJob: function () {
				
			}
		}; // TODO: take me out when performance push is done!!!!;
	
	if (type === ContactPhoto.TYPE.BIG) {
		destWidth = PersonPhotos.GOOGLE_PHOTO_WIDTH; //PersonPhotos.BIG_PHOTO_WIDTH;
		cropWidth = PersonPhotos.GOOGLE_PHOTO_WIDTH; //PersonPhotos.BIG_PHOTO_WIDTH;
		cropHeight = PersonPhotos.GOOGLE_PHOTO_HEIGHT; //PersonPhotos.BIG_PHOTO_HEIGHT;
		size = PersonPhotos.BIG_PHOTO_FILECACHE_SIZE;
	}

	future.now(function () {
		
		var fromFile = fromPath.split("/");
		if ((fromFile.length - 1) >= 0) {
			fromFile = fromFile[fromFile.length - 1];
		} else {
			fromFile = "default." + PersonPhotos.PHOTO_FILETYPE;
		}
		
		timingRecorder.startTimingForJob("Fixup_Photos_FileCache_Insert");
		
		cacheFuture = PalmCall.call("palm://com.palm.filecache", 
			"InsertCacheObject", 
			{
				typeName: "contactphoto",
				size: size,
				fileName: fromFile,
				subscribe: true
			}
		);
		return cacheFuture;
	});
	
	future.then(function (result) {
		toPath = future.result.pathName;
		
		timingRecorder.stopTimingForJob("Fixup_Photos_FileCache_Insert");
		
		// console.log("@@@@ cropAndGetPath: cropping image, w: " + cropWidth + ", h: " + cropHeight + ", source: " + fromPath + " toPath: " + toPath);
		
		var imageConvertParams = {
			src: fromPath,
			dest: toPath,
			destType: PersonPhotos.PHOTO_FILETYPE
		};

		timingRecorder.startTimingForJob("Fixup_Photos_Image_Convert");

		if (type === PersonPhotos.TYPE.LIST) 
		{
			imageConvertParams.destSizeW = cropWidth;
			imageConvertParams.destSizeH = cropHeight;
			return PalmCall.call("palm://com.palm.image", "ezResize", imageConvertParams);
		}

		imageConvertParams.focusX = cropInfo.focusX;
		imageConvertParams.focusY = cropInfo.focusY;
		imageConvertParams.scale = destWidth / cropInfo.suggestedXsize;
		imageConvertParams.cropW = cropWidth;
		imageConvertParams.cropH = cropHeight;

		return PalmCall.call("palm://com.palm.image", "convert", imageConvertParams);
	});
	
	future.then(function () {
		var result;
		timingRecorder.stopTimingForJob("Fixup_Photos_Image_Convert");
		
		try {
			result = future.result;	// read it to cause any exceptions to be thrown
		} catch (e) {
			throw e;
		} finally {
			// need to cancel the futures even when an exception is thrown, otherwise the subscription never goes away
			// wow, that sounds like a bad sci fi novel!
			if (cacheFuture) {
				// cancel the subscription on the cached file now that we are done with it
				PalmCall.cancel(cacheFuture);
			}
		}
		
		return toPath;
	});
	
	return future;
};

ContactPhoto.expire = function (photoPath)
{
	var future;
	
	// console.log("@@@@ ContactPhoto.expire: expiring file cache object " + JSON.stringify(photoPath) + " type is " + typeof(photoPath));
	if (!photoPath) {
		return new Future({});	// not a photo?
	}
	future = PalmCall.call("palm://com.palm.filecache",
		"ExpireCacheObject", 
		{
			pathName: photoPath
		}
	);
	future.then(function () {
		try {
			var result = future.result;
			future.result = result;
		} catch (ex) {
			console.error("Exception when expiring photo at '" + photoPath + "': " + ex);
			future.result = {};
		}
	});
	return future;
};


Utils.defineConstant("DEFAULT_SQUARE_PHOTO", LIB_ROOT + "images/personlist_avatar.png", ContactPhoto);
Utils.defineConstant("DEFAULT_BIG_PHOTO", LIB_ROOT + "images/detail_avatar.png", ContactPhoto);

ContactPhoto.TYPE = Utils.defineConstants({
	BIG: PersonPhotos.TYPE.BIG,
	SQUARE: PersonPhotos.TYPE.SQUARE
});
