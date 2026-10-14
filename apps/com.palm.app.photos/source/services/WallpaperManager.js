enyo.kind({
	name: "WallpaperManager",
	kind: enyo.Component,
	components: [
		{ kind: "PalmService", service: "palm://com.palm.systemservice/", onFailure: "_wallpaperFailure", components: [
			// Add the specified photos into the target album.  Almost the same as the "newAlbumService", except
			// that a target album must be specified (since none is being created), and the specs may additionally
			// have an optional "targetAlbum" that overrides the default one.
			//		targetAlbum: _id of album to add photos to
			//		specs: array of { sourceAlbum: _id, 
			//								targetAlbum: (optional), 
			//								photos: [_id1, _id2, etc], 
			//								exclude: (optional, default: false) }
			{ name: "importer", method: "wallpaper/importWallpaper", onSuccess: "_sucessfullyImportedWallpaper" },
			{ name: "setter", method: "setPreferences", onSuccess: "_sucessfullySetWallpaper" }
		]}
	],
	create: function() {
		this.inherited(arguments);
		this._cached = {};
	},
	// Given the DB-entry for a photo, use that photo as the desktop wallpaper.
	set: function(photoEntry) {
		if (!photoEntry) {
			console.warn("no photo-entry provided to set as wallpaper");
			return;
		}
		console.log("setting new desktop wallpaper: " + photoEntry.path);
		
		// Try to find a cached wallpaper entry, in order to avoid unnecessary computation.
		var cachedResult = this._cached[photoEntry._id];
		if (cachedResult) { 
			console.log("... using cached result");
			this.$.setter.call(cachedResult);
		}
		else {
			console.log("... initial wallpaper import of: " + photoEntry.path);
			var request = this.$.importer.call({target: encodeURIComponent(photoEntry.path)});
			request.photoEntry = photoEntry;
		}
	},
	_sucessfullyImportedWallpaper: function(inSender, inResponse, inRequest) {
		// The result of the 'importWallpaper' call is essentially the input
		// to the 'setPreferences' call... we just strip out the returnValue.
		var cachedResult = {wallpaper: inResponse.wallpaper};
		this._cached[inRequest.photoEntry._id] = cachedResult;
		var request = this.$.setter.call(cachedResult);
	},
	_wallpaperFailure: function(inSender, inResponse) {
		console.error("failed to import/set wallpaper: " + enyo.json.stringify(inResponse));
	}
});