// Begin to centralize some commands that were distributed throughout the application.

enyo.kind({
	name: "PhotosAndVideosService",
	kind: enyo.Component,
	events: {
		onNotify: ""
	},
	errorStrings: {
		0: $L("Unknown error"),
		1: $L("Unable to access database"),
		2: $L("Unable to merge details into database"),
		3: $L("Unable to add entry to database"),
		4: $L("Unable to delete entry from database"),
		5: $L("Unable to fetch data from database"),
		6: $L("Network error"),
		7: $L("Syncing Failed"),
		8: $L("Remote service failed to respond"),
		9: $L("File-copy failed")
	},
	components: [
		{ kind: "PalmService", service: "palm://com.palm.service.photos/", onFailure: "_genericPhotosFailure", components: [
			// Add the specified photos into the target album.  Almost the same as the "newAlbumService", except
			// that a target album must be specified (since none is being created), and the specs may additionally
			// have an optional "targetAlbum" that overrides the default one.
			//		targetAlbum: _id of album to add photos to
			//		specs: array of { sourceAlbum: _id,
			//								targetAlbum: (optional),
			//								photos: [_id1, _id2, etc],
			//								exclude: (optional, default: false) }
			{ name: "addPhotos", method: "addPhotos", onSuccess: "_addPhotosResponse", onFailure: "_addPhotosFailure" },
			// Delete the specified photos.
			//		album: _id of the album to delete the photos in
			//		photos: array or photo _ids to remove
			//		exclude: optional,
			{ name: "deletePhotos", method: "deletePhotos", onSuccess: "_deletePhotosResponse", onFailure: "_deletePhotosFailure" },
			// Create a new album.
			{ name: "createAlbum", method: "createAlbum", onSuccess: "_createAlbumResponse", onFailure: "_createAlbumFailure" },
			// Rename an album.
			{ name: "renameAlbum", method: "renameAlbum", onSuccess: "_renameAlbumResponse", onFailure: "_renameAlbumFailure" },
			// Delete an album.
			{ name: "deleteAlbum", method: "deleteAlbum", onSuccess: "_deleteAlbumResponse", onFailure: "_deleteAlbumFailure" }
		]},
		{ name: "launcher", kind: "PalmService", service: "palm://com.palm.applicationManager/", method: "launch" },
		{ name: "retryThumbnailGenerationTimeout", kind: "ThrottledTimeout", duration: 2000, onTimeout: 'retryThumbnailGenerationAfterTimeout' },
	],
	create: function() {
		this.inherited(arguments);
		this._thumbnailRetryQueue = [];
	},

	// Obtain a user-suitable, localized string corresponding to the error code.
	// If the error-code is unknown, use a generic one.
	//* @public
	stringForErrorCode: function(errorCode) {
		var string = this.errorStrings[errorCode];
		if (!string) {
			console.warn("unknown error code: " + errorCode);
			string = this.errorStrings[0];
		}
		return string;
	},

	// Add a single photo/video to the specified album.
	//* @public
	addPhoto: function(targetAlbumId, sourcePhotoId) {
		this.addPhotos(targetAlbumId, [sourcePhotoId]);
	},
	// Add to the specified album a set of photos, specified as follows...
	// - if "inverted" is falsy then simply add the photos specified by "sourcePhotoIds"
	// - else add all photos in "sourceAlbumId" except for those specified by "sourcePhotoIds"
	//* @public
	addPhotos: function(targetAlbumId, sourcePhotoIds, inverted, sourceAlbumId) {
		// Make the service-call.
		var spec = {
			targetAlbum: targetAlbumId,
			sourceAlbum: sourceAlbumId || null,
			photos: sourcePhotoIds,
			exclude: !!inverted
		}
		console.log("--- Adding photos to album: " + enyo.json.stringify(spec));
		this.$.addPhotos.call({specs: [spec]});
	},
	// Delete a set of photos, specified as follows...
	// - if "inverted" is falsy then simply delete the photos specified by "sourcePhotoIds"
	// - else delete all photos in "sourceAlbumId" except for those specified by "sourcePhotoIds"
	//* @public
	deletePhotos: function(sourcePhotoIds, inverted, sourceAlbumId) {
		// Make the service-call.
		var spec = {
			sourceAlbum: sourceAlbumId || null,
			photos: sourcePhotoIds,
			exclude: !!inverted
		}
		console.log("--- Deleting photos: " + enyo.json.stringify(spec));
		// We need to stash the album in the request so that, when the response
		// arrives, we can update the count of photos/videos.  See comment in
		// _deletePhotosResponse() for more details.
		var req = this.$.deletePhotos.call({specs: [spec]});
		req.album = app.$.library.getAlbum(sourceAlbumId);
	},
	// Share photos, given a shareMethod (only "email" for now, but eventually "mms") and
	// a list of photo DB-entries
	//* @public
	sharePhotos: function(shareMethod, photoEntries) {
		if (shareMethod !== "email") { throw new Error("unsupported share method: " + shareMethod); }
		var attachments = photoEntries.map(function(dbEntry) {
			var nm = dbEntry.path.split("/");
			nm = nm[nm.length-1];
			return {
				name: nm,
				path: dbEntry.path
			}
		});
		var params = {
			id: "com.palm.app.email",
			params: { attachments: attachments }
		}
		console.log("--- Sharing photos via email: " + enyo.json.stringify(attachments));
		this.$.launcher.call(params);
	},
	// Create album, possibly initialized with a set of photos/videos.
	//    albumName: name of the newly-created album
	//		accountId: _id of facebook/etc account, or "local" if the album is to be created on the local device
	//		initialPhotoSpecs: (optional) array of { sourceAlbum: _id, photos: [_id1, _id2, etc.] }
	//* @public
	createAlbum: function(albumName, accountId, initialPhotoSpecs) {
		var args = { name: albumName, accountId: accountId };
		if (initialPhotoSpecs) { args.specs = initialPhotoSpecs; }
		this.$.createAlbum.call(args);
	},

	changeAlbumName: function (albumToRename, onComplete) {
		this._onRenameAlbumComplete = onComplete;
		this.$.renameAlbum.call({ albumId: albumToRename.albumId, newName: albumToRename.newName });
	},

	// Delete album.  The service call takes an array of albums to delete, but we don't require that for now...
	// if we do later, we can adjust our API.
	//    albumId: id of the album to delete
	//* @public
	deleteAlbum: function(albumId) {
		this.$.deleteAlbum.call([albumId]);
	},
	retryThumbnailGeneration: function(dbId) {
		this._thumbnailRetryQueue.push({
			_id: dbId,
			appGridThumbnail: null,
			appStripThumbnail: null,
			appScreenNail: null,
			appCacheComplete: "unattempted"
		});
		this.$.retryThumbnailGenerationTimeout.schedule();
	},
	retryThumbnailGenerationAfterTimeout: function() {
		console.log("clearing thumbnail-properties of " + this._thumbnailRetryQueue.length + " DB-entries");
		app.$.dbservice.mergeEntries(this._thumbnailRetryQueue);
		this._thumbnailRetryQueue = [];
		app.$.photoservice.generateThumbnails();
	},

	// PRIVATE -----------------------------------------------------------

	//* @protected
	_notifyAndLogError: function(title, inResponse) {
		this.doNotify(title, this.stringForErrorCode(inResponse.errorCode));
		console.error(title + " (" + inResponse.errorCode + "):  " + inResponse.error + "     (details: " + inResponse.details + ")" );
	},
	//* @protected
	_addPhotosResponse: function(inSender, inResponse, inRequest) {
		// nothing to do
	},
	//* @protected
	_addPhotosFailure: function(inSender, inResponse, inRequest) {
		this._notifyAndLogError($L("Failed to add photos to album"), inResponse);
	},
	//* @protected
	_deletePhotosResponse: function(inSender, inResponse, inRequest) {
		// Hack to poll for updated photo/video count.  Ideally, we'd use the DB-watch
		// on the highest _rev in the album to notifiy us of a change, but it doesn't
		// fire for deleted entries, even if we specify "incDel=true" in the query
		// and DB-kind.
		if (inRequest.album) { inRequest.album.hackUpdatePhotoAndVideoCounts(); }
		else { console.warn("no album available to update photo/video counts"); }
	},
	//* @protected
	_deletePhotosFailure: function(inSender, inResponse, inRequest) {
		this._notifyAndLogError($L("Failed to delete photos"), inResponse);

		// Hack to poll for updated photo/video count.  Ideally, we'd use the DB-watch
		// on the highest _rev in the album to notifiy us of a change, but it doesn't
		// fire for deleted entries, even if we specify "incDel=true" in the query
		// and DB-kind.
		if (inRequest.album) { inRequest.album.hackUpdatePhotoAndVideoCounts(); }
		else { console.warn("no album available to update photo/video counts"); }
	},
	//* @protected
	_createAlbumResponse: function(inSender, inResponse, inRequest) {
		console.log('Successfully created album: ' + enyo.json.stringify(inResponse));
		// XXXXX TODO: maybe notify the user?
	},
	//* @protected
	_createAlbumFailure: function(inSender, inResponse, inRequest) {
		this._notifyAndLogError($L("Failed to create album"), inResponse);
	},
	//* @protected
	_renameAlbumResponse: function(inSender, inResponse, inRequest) {
		console.log('Successfully renamed album: ' + enyo.json.stringify(inResponse));

		if (this._onRenameAlbumComplete) {
			this._onRenameAlbumComplete();
		}
		// XXXXX TODO: maybe notify the user?
	},
	//* @protected
	_renameAlbumFailure: function(inSender, inResponse, inRequest) {
		this._notifyAndLogError($L("Failed to rename album"), inResponse);
	},
	//* @protected
	_deleteAlbumResponse: function(inSender, inResponse, inRequest) {
		console.log('Successfully deleted album: ' + enyo.json.stringify(inResponse));
		// XXXXX TODO: maybe notify the user?
	},
	//* @protected
	_deleteAlbumFailure: function(inSender, inResponse, inRequest) {
		this._notifyAndLogError($L("Failed to delete album"), inResponse);
	},
	//* @protected
	_genericPhotosFailure: function(inSender, inResponse, inRequest) {
		console.error("generic photos-service failure: " + enyo.json.stringify(inResponse));
	}
});
