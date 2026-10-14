enyo.kind({
	name: "AlbumView",
	kind: enyo.Control,
	events: { 
		onAlbumSelected: "",
		onAlbumTitleChanged: "",
		onAlbumPictureCountChanged: "",
		onPictureSelected: ""
	},
	album: null,
	pictures: null,
	photoCount: 0,
	videoCount: 0,
	create: function() {
		this.inherited(arguments);
		this.pictures = {};
		if (!this.album) { throw new Error("no album specified"); }
		
		// Set the title and description.
		this.notifyTitleChanged(this.album.title);
		this.notifyDescriptionChanged(this.album.description);
		
		// Set the picture count.
		if (this.album.photoCount || this.album.videoCount) {
			this.notifyPictureCountChanged(this.album.photoCount, this.album.videoCount);
		}

		// Register this AlbumView to receive notifications of changes in the Album.
		this.createComponent({ kind: "ModelViewer", model: this.album.$.albumViews });
	},
	// Assumes that we contain a "title" sub-component.
	notifyTitleChanged: function(newTitle) { 
		this.doAlbumTitleChanged(newTitle);
		this.$.title.setContent(newTitle);
	},
	// Assumes that we contain a "description" sub-component.
	notifyDescriptionChanged: function(newDescription) {
		this.$.description.setContent(newDescription); 
	},	
	notifyPictureCountChanged: function(photoCount, videoCount) {
		this.photoCount = photoCount;
		this.videoCount = videoCount;
		this.doAlbumPictureCountChanged(photoCount, videoCount);
	}
});
