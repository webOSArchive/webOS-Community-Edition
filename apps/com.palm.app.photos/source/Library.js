enyo.kind({
	name: "Library",
	kind: enyo.Component,
	albums: null,
	events: {
		onAlbumCreated: "libraryAlbumAdded",
		onAlbumRemoved: "libraryAlbumRemoved",
	},
	create: function() {
		this.inherited(arguments);
		this.albums = new OrderedRegistry();
	},
	hasAlbum: function(guid) {
		return this.albums.hasId(guid);
	},
	createAlbum: function(albumSpec) {
		var guid = albumSpec.guid;
		var existingAlbum = this.albums.hasId(guid);
		if (existingAlbum) {
			// Decide whether it's OK that the album already exists.
			//
			// (In the future, we might improve UI responsiveness by
			// immediately creating an album in response to a user
			// action, rather than sending a message to the service
			// and waiting for the resulting message.  For now, we
			// don't do this, so if we see an existing album, we want
			// to notice, figure out why, and fix it).  
			console.warn("album already exists: " + guid);
			return;
		}
		
		// Create and store a new Album component.
		var newAlbum = this.createComponent({
			kind: "Album",
			title: albumSpec.title,
			path: albumSpec.dbEntry.path,
			description: albumSpec.description,
			type: albumSpec.type,
			accountId: albumSpec.dbEntry.accountId || 'local',
			modifiedTime: new Date(albumSpec.modifiedTime * 1000),
			photoCount: albumSpec.photoCount,
			videoCount: albumSpec.videoCount,
			guid: guid
		});
		this.albums.put(guid, newAlbum);
		
		// Signal an event.  Our owner is responsible for updating
		// the UI appropriately.
		this.doAlbumCreated(newAlbum);
		
		return newAlbum;
	},
	deleteAlbum: function(guid) {
		if (!this.albums.hasId(guid)) {
			console.log("Library does not have album to delete: " + guid);
			return;
		}
		this.albums.removeId(guid);
		
		// Signal an event.  Our owner is responsible for updating
		// the UI appropriately.
		this.doAlbumRemoved(guid);
	},
	getAlbumIds: function () {
		return this.albums.allIds()
	},
	getAlbum: function (albumId) {
		return this.albums.get(albumId);
	},
	getAlbumByName: function(albumName) {
		var arr = this.albums._array;
		var i;
		for (i=0; i<arr.length; i++) {
			if (arr[i].title === albumName) return arr[i];
		}
		return undefined;
	},
});
