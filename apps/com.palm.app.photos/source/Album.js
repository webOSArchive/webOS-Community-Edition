/*global enyo, $L, console */

enyo.kind({
	name: "Album",
	kind: "Component",
	published: {
		title: $L("Unnamed Album"),
		description: "some lovely pictures",
		pictureEntry: null,  // first photo in the album
		// READ-ONLY
		type: "local" // or facebook, photobucket, etc.
	},
	components: [
		// Add Model mixin to notify AlbumViews of changes.
		// We currently send the following messages (try to keep this updated!)
		//   - notifyPictureAdded()
		//   - notifyPictureRemoved()
		//   - notifyTitleChanged()
		//   - notifyDescriptionChanged()
		// NOTE: we use createComponent() so that we can pass it our GUID.
		// { kind: "Model", name: "albumViews"},
		{ name: "photoDb",
			kind: "DbService",
			method: "find",
			dbKind: "com.palm.media.types:1",
			onSuccess: "photoQueryResponse",
			onFailure: "dbQueryFail",
			subscribe: true,
			reCallWatches: true
		},
		{ name: "albumDb",
			kind: "AlbumLocalizationHackDbService",
			method: "find",
			dbKind: "com.palm.media.image.album:1",
			onSuccess: "albumQueryResponse",
			onFailure: "dbQueryFail",
			subscribe: true,
			reCallWatches: true
		},
		// This is hackety-hackety to keep the displayed image/video count up-to-date.
		// It would be better for the service to maintain this information in the album
		// DB-entry, but Tosin's analysis suggests that this is too disruptive a change
		// to make for Duval.
		{ name: "countDb",
			kind: "DbService",
			onFailure: "dbQueryFail",
			components: [
				{ name: "photoCountDb", method: "find", onSuccess: "photoCountResponse", dbKind: "com.palm.media.image.file:1" },
				{ name: "videoCountDb", method: "find", onSuccess: "videoCountResponse", dbKind: "com.palm.media.video.file:1" },
				{ name: "countWatchDb", 
					method: "find", 
					onSuccess: "revWatchResponse",
					onFailure: "revWatchFailure",
					onWatch: "revWatchWatch",
					dbKind: "com.palm.media.types:1",
					subscribe: true
				},
				{ name: 'revWatchCallThrottle', kind: 'ThrottledTimeout', duration: 200, onTimeout: 'revWatchCall' },
				{ name: 'revWatchResponseThrottle', kind: 'ThrottledTimeout', duration: 200, onTimeout: 'hackUpdatePhotoAndVideoCounts' }
			]
		}
	],
	photoCount: 0,
	videoCount: 0,
	albumEntry: null,
	highestRev: 0,
	create: function(inProps) {
		this.inherited(arguments);
		this.createComponent({ kind: "Model", name: "albumViews", guid: this.guid });
		
		this.$.photoDb.mockDataProvider = function (req) {
		    return enyo.mock.photos.albumIdToUri[req.params.query.where[0].val];
		};
		this.$.albumDb.mockDataProvider = function (req) {
		    return enyo.mock.photos.albumIdToAlbumUri[req.params.query.where[0].val];
		};
		
		this.albumQuery();
		this.photoQuery();
		
		// Begin watching for changes in the photos/videos counts.
		// If we're running in the browser, don't bother, since we know
		// that the photo/video counts will never change.
		if (!enyo.mock) { this.revWatchCall(); }
	},
	// We just received a response; use it to update the highest revision number
	// for subsequent queries.
	revWatchResponse: function(inSender, inResponse, inRequest) {
		var result = inResponse.results[0];
		if (result) {
			this.highestRev = inResponse.results[0]._rev; 
		}
		else {
			// This happens when we delete the last picture in the album.
			// If we were able to successfully watch for deleted items, the
			// response would include the DB-entry of the deleted entry, but
			// MojoDB seems not to support this.
		}
		this.$.revWatchResponseThrottle.schedule();
	},
	// Something went wrong with our album-change watcher.  This is bad.
	revWatchFailure: function(inSender, inResponse, inRequest) {
		console.warn("album-modification change-watch failed... " + enyo.json.stringify(inResponse) + "      " + enyo.json.stringify(inRequest.params));
	},
	// Something changed.  Wait a moment before finding out what changed, in case other watches are received.
	// This may not be possible... does MojoDB only ever give you one watch-notification until you next re-query?
	revWatchWatch: function(inSender, inResponse, inRequest) {
		// Destroy the previous request, because we now have a new highest-rev that we want to watch for.
		inRequest.destroy();
		this.$.revWatchCallThrottle.schedule();
	},
	// Call to watch if anything changes in the album.
	revWatchCall: function() {
		// This query will let us notice added pictures/videos.  It won't catch deleted ones (how can we force
		// our query to also return deleted entries?).  We handle this explicitly by calling hackUpdatePhotoAndVideoCounts()
		// explicitly when we delete photos, although this wouldn't update when photos are eg: deleted in MSM mode.
		var queryObj = {
			query: {
				where: [
					{prop: "albumId", op: "=", val: this.guid}, 
					{prop: "appCacheComplete", op: "=", val: true}, 
					{prop: "_rev", op: ">", val: this.highestRev}
				],
				select: ["_rev"],
				limit: 1,
				incDel: false, // wish this could be true, but MojoDB seems not to support this (at least, our watches don't fire)
				desc: true
			},
			watch: true
		};
		this.$.countWatchDb.call(queryObj);		
	},
	// We need the correct photo/video count with respect to the queries that
	// we actually do.  In particular, we only care about images that have 
	// "appCacheComplete" set to true.
	hackUpdatePhotoAndVideoCounts: function() {
		var queryObj = {
			query: {
				where: [{prop: "albumId", op: "=", val: this.guid}, {prop: "appCacheComplete", op: "=", val: true}],
				limit: 1
			},
			count: true
		};
		this.$.photoCountDb.call(queryObj);
		this.$.videoCountDb.call(queryObj);		
	},
	photoCountResponse: function(inSender, inResponse, inRequest) {
		if (this.photoCount !== inResponse.count) {
			this.photoCount = inResponse.count;
			this.pictureCountChanged();
		}
	},
	videoCountResponse: function(inSender, inResponse, inRequest) {
		if (this.videoCount !== inResponse.count) {
			this.videoCount = inResponse.count;
			this.pictureCountChanged();
		}
	},

	// Only query for the first image... we use 
	// it for the nav-pane thumbnail
	photoQuery: function() {
		this.$.photoDb.call({
			query: {
				where: [{prop: "albumId", op: "=", val: this.guid}, {prop: "appCacheComplete", op: "=", val: true}],
				orderBy: "createdTime",
				desc: true,
				limit: 1
			},
			count: true
		});
	},
	photoQueryResponse: function(inSender, inResponse, inRequest) {
		var entry = inResponse.results.length ? inResponse.results[0] : null;
		this.setPictureEntry(entry);
	},
	albumQuery: function() {
		this.$.albumDb.call({
			query: { 
				where: [{prop: "_id", op: "=", val: this.guid}],
				limit: 1
			}
		});
	},
	albumQueryResponse: function(inSender, inResponse, inRequest) {
		if (!inResponse.results.length) {
			this.albumEntry = null;
			return;
		}
		this.albumEntry = inResponse.results[0];
		
		var modTime = this.albumEntry.modifiedTime;
		if (this.albumEntry.modifiedTime*1000 !== this.modifiedTime.getTime()) {
			this.modifiedTime = new Date(this.albumEntry.modifiedTime*1000);
			this.modifiedTimeChanged();
		}
		if (this.albumEntry.name !== this.title){
			this.title = this.albumEntry.name;
			this.titleChanged();
		}
	},
	dbQueryFail: function(inSender, inResponse) {
		console.log('&& dbQueryFail():   ' + enyo.json.stringify(inResponse));
	},
	// Log to console.
	log: function(logString) {
		console.log("Album[" + this.title + "]  " + logString);
	},
	// Invoke a method on all registered AlbumViews.
	tellAlbumViews: function(methodName, etc) {
		this.$.albumViews.viewersCall(arguments);
	},
	// The album title just changed; notify interested parties.
	titleChanged: function() {
		this.tellAlbumViews("notifyTitleChanged", this.title);
	},
	// The album description just changed; notify interested parties.
	descriptionChanged: function() {
		this.tellAlbumViews("notifyDescriptionChanged", this.description);
	},
	pictureEntryChanged: function() {
		this.tellAlbumViews("notifyPictureEntryChanged", this.pictureEntry);
	},
	pictureCountChanged: function() {
		this.tellAlbumViews("notifyPictureCountChanged", this.photoCount, this.videoCount);
	},
	modifiedTimeChanged: function() {
		this.tellAlbumViews("notifyModifiedTimeChanged", this.modifiedTime);
	},
	// This should never happen!  That's what READ-ONLY means!
	typeChanged: function() {
		throw new Error("Album.type is a read-only property");
	},
	// Answer true if it's OK to rename this album, and false otherwise.
	canBeRenamed: function() {
		var ok = true;
		var path = this.path;
		["camera://"].forEach(function(banned) {
			if (path === banned) ok = false;
		});
		return ok;
	}
});

