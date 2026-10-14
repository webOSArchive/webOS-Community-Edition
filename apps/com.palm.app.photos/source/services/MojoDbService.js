// MockServiceInterface provides a fake ServiceInterface
// implementation that doesn't actually talk to any Node
// services... it uses hard-coded resources so that the
// rest of the app doesn't know it's not actually talking
// to a service.  See the comments in ServiceInterface.js

enyo.kind({
	name: "MojoDbService",
	kind: "ServiceInterface",
	components: [
		{name: "albumDbService", 
			kind: "AlbumLocalizationHackDbService", 
			dbKind: "com.palm.media.image.album:1", 
			method: "find", 
			subscribe: true, 
			onSuccess: "gotAlbumData",
			reCallWatches:true},
		{name: "merger",
			kind: "DbService",
			method: "merge",
			onSuccess: "mergedEntry",
			onFailure: "failedToMerge"
		}
	],
	create: function() {
		this.inherited(arguments);
		this.albumIds = {};
	},
	sendPoke: function() {
		//var self = this;
		//this.defer(100, function() { self.receiveCreateAlbums(self.albums); });
		this.queryDbForAlbums();
	},
	sendCreateAlbums: function(albumSpecs) {
		var self = this;
		self.defer(100, function() {
			// Ensure that these albums don't already exist.
			var guidGetter = function(elem) { return elem.guid; };
			var existingGuids = self.albums.map(guidGetter);
			var specGuids = albumSpecs.map(guidGetter);
			var newGuids = specGuids.filter(function(g1) {
				return !existingGuids.some(function(g2) { return g1 == g2; });
			});
			if (specGuids.length != newGuids.length) {
				console.warn("" + (specGuids.length - newGuids.length) + " album-GUIDs already existed.");
			}
			
			// Add the new albums to the "database".
			albumSpecs.forEach(function(spec) { self.albums.push(spec); });
			
			// Wait a moment, and tell the app about the newly-created albums.
			self.defer(100, function() {
				console.log("DEFERRED MockServiceInterface.receiveCreateAlbums()");
				self.receiveCreateAlbums(albumSpecs);
			});
		});
		
	},
	sendDeleteAlbums: function(albumGuids) {
		var self = this;
		var deleted = [];
		self.defer(100, function() {
			albumGuids.forEach(function(guid) {
				var found = false;
				if (!found) {
					console.log("MockServiceInterface.sendDeleteAlbums(): no album found with guid: " + guid);
				}
				else {
					// When we bounce back the response, we only want to include
					// the albums that we actually deleted (when we're actually
					// hooked up to MojoDB, this is how it will work).
					deleted.push(guid); 
				}
			});
			self.defer(100, function() {
				console.log("DEFERRED MockServiceInterface.receiveDeleteAlbums()");
				self.receiveDeleteAlbums(deleted);
			});
		});
	},
	// Later we might make this fancier, like to defer by variable amounts.
	defer: function(msecs, closure) {
		closure();
//		window.setTimeout(closure, msecs);
	},
	getAlbumGuid: function(dbId){
		return "album-"+dbId;
	},
	queryDbForAlbums: function() {
		var q = { query: {
			where: [{prop: "showAlbum", op: "=", val: true}]
		}};
		this.$.albumDbService.call(q);
	},
	gotAlbumData:function(inSender, inResponse) {
		if (inResponse.fired) {
			//it is a subscribed call, so need to ask to requery to get the latest data
			inSender.reCall(this.queryDbForAlbums);
		} else {

			this.receiveAlbumsDbResponse(inResponse);

			// Generate an album-spec for each entry in the DB-results.
			// Stash each in a property keyed by the album's guid, so that
			// we can efficiently check whether the album is present.
			var that = this;
			var albumSpecs = {};
			inResponse.results.forEach(function(albumEntry) {
				var id = albumEntry._id;
				var spec = {
					title: albumEntry.name,
					description: "Collection from device",
					guid: id,
					type: (albumEntry.type || "local"),
					photoCount: albumEntry.total.images || 0,
					videoCount: albumEntry.total.videos || 0,
					modifiedTime: albumEntry.modifiedTime,
					dbEntry: albumEntry
				};
				albumSpecs[id] = spec;				
			});
			
			// Find deleted albums
			var deletedAlbums = [];
			for (id in this.albumIds) {
				if (!(id in albumSpecs)) {
					delete this.albumIds[id];
					deletedAlbums.push(id);
				}
			}
			// Notify app of deleted albums (only if there are more than zero).
			if (deletedAlbums.length > 0) {
				console.log ("Deleting " + deletedAlbums.length + " albums in response to DB change");
				this.receiveDeleteAlbums(deletedAlbums);
			}
			
			// Find created albums
			var createdAlbums = [];
			for (id in albumSpecs) {
				if (!(id in this.albumIds)) {
					this.albumIds[id] = true;
					createdAlbums.push(albumSpecs[id]);
				}
			}
			// Notify app of created albums (only if there are more than zero).
			if (createdAlbums.length > 0) {
				console.log ("Creating " + createdAlbums.length + " albums in response to DB change");
				this.receiveCreateAlbums(createdAlbums);
			}
		}
	},
	getExtractFsUrl: function(thumbnail){
		var height = NonCssParams.AlbumStripThumb_height;
		var width = Math.ceil(height * 4 / 3);
		var offset, length;
		
		if (thumbnail.type ==="embedded" ) {
			offset = thumbnail.offset;
			length = thumbnail.length;t
		}
		else {
			offset = length = 0;
		}

		//format is /var/luna/data/extractfs/[full path]:[offset]:[size]:[width]:[height]:[crop]		
		var extractFsPath ="/var/luna/data/extractfs";
		var finalPath = extractFsPath+thumbnail.path+':'+offset+':'+length+':'+width+':'+height+':3';

		//console.info("******* final extractFs Path :"+finalPath);
		return finalPath;	
	},
	mergedEntry: function(inSender, inResponse) {
		console.info("merged DB entries");
	},
	failedToMerge: function(inSender, inResponse) {
		console.info("failed to merge DB entries");
	},
	mergeEntries: function(arrayOfDbEntries) {
		this.$.merger.call({objects: arrayOfDbEntries});
	}
});


