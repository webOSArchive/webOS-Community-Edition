enyo.kind({
	name: 'PictureMode',
	kind: enyo.VFlexBox,
	className: 'PictureMode',
	events: { onLeave: '', onSlideshowClick: '' },
	published: {
		backToCaption: $L('All Photos & Videos')  // there are a few copies of this sprinkled around, sorry.
	},
	images: [],
	index: 0,
	controlsAreShown: true,
	commentsAreShown: false,
	hideControlbarIdleTimeout: 6000,
	isPictureModeActive: false,
	components: [
		{ name: 'imageView', kind: 'DbImageView', debugging: false, flex: 1, onclick: 'toggleControls',
			onChangePicture: 'pictureChanged', onSwipe: 'onSwipeHandler', onLeave: 'leavePictureMode' },
		{ name: 'topControls', kind: 'HFlexBox', className: 'PictureModeTopControls', components: [
			{ name: 'backButton',
				kind: 'Button',
				className: 'enyo-button-dark enyo-text-ellipsis',
				style:'max-width:30%',
				caption: ' - ',
				components:[{name:"backButtonLabel",className:"backButtonLabel enyo-text-ellipsis",kind:"enyo.Control"}],
				onclick: 'leavePictureMode',
			},
			{ name: 'spacer', flex: 1},
			{ name: 'slideshowButton', kind: 'ToolButton', icon: "images/icn-slideshow.png",className: 'image-view-button',  onclick: 'clickSlideshow'
			},
			{ name: 'shareButton', kind: 'ToolButton',  icon: "images/icn-share-contact.png", className: 'image-view-button',  onclick: 'clickShare'
			},
			{ name: 'commentsButton', kind: 'ToolButton', icon: "images/icn-comments.png", className: 'image-view-button',  onclick: 'toggleComments'
			},
			{ name: 'printButton', kind: 'ToolButton', icon: "images/icn-print.png", className: 'image-view-button', onclick: 'clickPrint'
			},
			{ name: 'deleteButton', kind: 'ToolButton', icon: "images/icn-delete.png",className: 'image-view-button', onclick: 'openDeletePopup'
			},
			{ name: 'moreBtn', kind: 'ToolButton',icon: "images/icn-more.png", className: 'image-view-button', onclick: 'toggleMoreMenu'
			},
			// { name: 'slideshowButton', kind: 'Button', className: 'photos button image-view-button', caption: ' ', onclick: 'clickSlideshow', components:[
			// 				{kind: "Image", src: "images/icn-slideshow.png"}
			// 			]},
			// 			{ name: 'shareButton', kind: 'Button',  className: 'photos button image-view-button', caption: ' ',  onclick: 'clickShare', components:[
			// 				{kind: "Image", src: "images/icn-share-contact.png"}
			// 			]},
			// 			{ name: 'commentsButton', kind: 'Button', className: 'photos button image-view-button', caption: ' ', onclick: 'toggleComments', components: [
			// 				{kind: "Image", src: "images/icn-comments.png"}
			// 			]},
			// 			{ name: 'printButton', kind: 'Button', className:'photos button image-view-button', caption: ' ', onclick: 'clickPrint',components:[
			// 				{kind: "Image", src: "images/icn-print.png"}
			// 			]},
			// 			{ name: 'deleteButton', kind: 'Button', className:'photos button image-view-button', caption: ' ', onclick: 'openDeletePopup',components:[
			// 				{kind: "Image", src: "images/icn-delete.png"}
			// 			]},
			// 			{ name: 'moreBtn', kind: 'Button', className: 'photos button image-view-button', caption: ' ', onclick: 'toggleMoreMenu', components: [
			// 				{kind: "Image", src: "images/icn-more.png", style:'margin-top:4px'}
			// 			]},
			{ name: 'pictureComments', kind: 'PictureComments', onCommentSubmit: 'submitComment', onClose: 'closeComments', maxHeight: 220 }
		]},
		{ name: "moreSlideup", kind: "enyo.BasicDrawer", className: "more-menu hide",
			components: [
				{ name: "addAlbumMenuItem", kind: "Control", className: "more-menu-item",
					content: $L("Add to Album"), value: "addAlbum", onclick: "moreMenuItemSelectHandler" },
				{ name: "setWallpaperMenuItem", kind: "Control", className: "more-menu-item",
					content: $L("Set As Wallpaper"), value: "setWallpaper", onclick: "moreMenuItemSelectHandler" }
			]
		},
		{ 	kind: 'PrintDialog',
			lazy: false,
			mediaSizeOption: true,
			duplexOption: false,
			colorOption: true,
			appName: 'Photos'
		},

		// Popups for buttons in top control-bar
		{ name: 'createAlbumPopup', kind: 'AlbumCreationPopup' },
		{ name: 'addToAlbumPopup',
			kind: 'AlbumPickerPopup',
			onSelectAlbum: 'addPhotoToAlbum',
			onCreateAlbum: 'addPhotoToNewAlbum'
		},
		{ name: 'addToLocalAlbumPopup',
			kind: 'LocalAlbumPickerPopup',
			onSelectAlbum: 'addPhotoToAlbum',
			onCreateAlbum: 'addPhotoToNewAlbum'
		},
		{ name: 'deletePhotosPopup', kind: 'ModalDialog', caption: $L('Delete'), style:'width:300px', components: [
         { name: 'deletePhotosPopupContent', style:'font-size:16px', content:$L('Are you sure you want to delete this stuff?') },
         { kind: 'Button', flex: 1, caption: $L('Delete'), onclick: 'clickConfirmDelete', style: 'background-color: red;color:#fff' },
         { kind: 'Button', flex: 1, caption: $L('Cancel'), onclick: 'closeDeletePopup' }
		]},
		// For making service-requests
		{ kind: 'PalmService', service: 'palm://com.palm.service.photos/', components: [
			{ name: 'addPhotosService', method: 'addPhotos', onSuccess: 'addPhotoSuccess', onFailure: 'addPhotoFailure' },
			{ name: 'getCommentService', method: 'facebookGetPhotoComments', onSuccess: 'getCommentSuccess', onFailure: 'getCommentFailure'},
			{ name: 'putCommentService', method: 'facebookAddPhotoComments', onSuccess: 'putCommentSuccess', onFailure: 'putCommentFailure'}
		]},
		{ name: "msgDialog", kind: "MessageDialog", message: $L("Please download more photos to play slideshow.") },
		{ name: 'showControlsGroup', kind: 'TaskGroup' },
		{ name: 'hideControlsGroup', kind: 'TaskGroup' }
	],
	g11nBackButtonCaption: G11N.template($L('#{location}'), 'location'),
	create: function() {
		this.inherited(arguments);
		this.isMoreMenuFirstUse = true;
		this.isMoreMenuShown = false;
		this.backToCaptionChanged();
		var thisInst = this;
		if (this.$.showControlsGroup) {
			this.$.imageView.setShowControlsGroup(this.$.showControlsGroup);
			this.$.showControlsGroup.addTask({ method: thisInst._showControls, scope: thisInst });
		}
		if (this.$.hideControlsGroup) {
			this.$.imageView.setHideControlsGroup(this.$.hideControlsGroup);
			this.$.hideControlsGroup.addTask({ method: thisInst._hideControls, scope: thisInst });
		}
	},
	getShowControlsGroup: function () {
		return this.$.showControlsGroup;
	},
	getHideControlsGroup: function () {
		return this.$.hideControlsGroup;
	},
	destroy: function() {
		this.inherited(arguments);
	},
	setLibrary: function (lib) {
		this.library = lib;
		this.$.imageView.setLibrary(this.library);
	},
	resizeHandler: function () {
		this.resize();
	},
	resize: function() {
		this.$.imageView.resize();
		this.alignMoreMenu();
	},
	viewPictureInAlbum: function(pictureId, albumId, mediaType, type) {
		this.updateShownControls(mediaType, type);

		this.$.imageView.setAlbumId(albumId);
		this.$.imageView.viewPicture(pictureId);
	},
	updateShownControls: function(mediaType, type) {
		if (mediaType === "video") {
			this.showControlsApplicableToVideo(type);
		}
		else if (mediaType === "image") {
			this.showControlsApplicableToImage(type);
		}
		else {
			// leaveSlideshowView() doesn't pass a type, which is OK (if a bit sloppy)
			console.log("no type/mediaType, so cannot adjust control visibility");
		}
	},
	toggleControls: function() {
		this.doToggleControls();
		return true;
	},
	doToggleControls: function () {
		if (this.commentsAreShown) this.closeComments();
		else if (this.controlsAreShown) this.$.hideControlsGroup.execute();
		else this.$.showControlsGroup.execute();
	},
	/**
	 * @protected
	 * Should call this.$.hideControlsGroup.schedule(milliseconds) or execute() instead.
	 */
	_hideControls: function() {
		if (this.isMoreMenuShown) { this.toggleMoreMenu(); }
		if (!this.controlsAreShown) return;  // already hidden
		this.controlsAreShown = false;
		this.closeComments();
		this.$.topControls.addClass('TopControlsHide');
	},
	/**
	 * @protected
	 * Should call this.$.showControlsGroup.schedule(milliseconds) or execute() instead.
	 */
	_showControls: function() {
		if (this.controlsAreShown) return;  // already showing
		this.controlsAreShown = true;
		this.$.topControls.removeClass('TopControlsHide');
		this.setHideControlsTimeout();
	},
	showControlsApplicableToImage: function (type) {
		var fn = function(capabilities) {
			if (capabilities && capabilities.getComments) { this.$.commentsButton.show(); }
			else { this.$.commentsButton.hide(); }

			if (capabilities && capabilities.deletePhoto) { this.$.deleteButton.show(); }
			else { this.$.deleteButton.hide(); }
		}
		app.$.accounts.$.capabilities.fetchCapabilities(type, enyo.bind(this, fn));

		this.$.slideshowButton.show();
		this.$.printButton.show();
		this.$.setWallpaperMenuItem.show();
	},
	showControlsApplicableToVideo: function (type) {
		var fn = function(capabilities) {
			if (capabilities && capabilities.deletePhoto) { this.$.deleteButton.show(); }
			else { this.$.deleteButton.hide(); }
		}
		app.$.accounts.$.capabilities.fetchCapabilities(type, enyo.bind(this, fn));

		this.$.slideshowButton.hide();
		this.$.printButton.hide();
		this.$.commentsButton.hide();
		this.$.setWallpaperMenuItem.hide();
	},
	onSwipeHandler: function (inSender, viewArgs) {
		var activatingView = viewArgs.activatingView;
		var mediaType = activatingView.getMediaType();
		var type = activatingView.getType();
		switch (mediaType) {
			case "video":
				this.showControlsApplicableToVideo(type);
				break;
			case "image":
			default:
				this.showControlsApplicableToImage(type);
				break;
		}
    this.log(" ENYO PERF: TRANSITION DONE time: "+ Date.now());
	},
	setHideControlsTimeout: function() {
		this.$.hideControlsGroup.schedule(this.hideControlbarIdleTimeout);
	},
    alignMoreMenu: function () {
		var moreBtnEl = undefined, left = 0;
		if (this.$.moreBtn && this.$.moreBtn.id) {
			moreBtnEl = document.getElementById(this.$.moreBtn.id);
		}
		var styleText = null;
		if (moreBtnEl) {
			styleText = "right:5px;bottom:"+(moreBtnEl.clientHeight-7)+"px;";
			this.$.moreSlideup.addStyles(styleText);
		}
    },
	toggleMoreMenu: function() {
		if (this.isMoreMenuFirstUse) {
			this.isMoreMenuFirstUse = false;
			this.$.moreSlideup.removeClass("hide");
		}
		this.isMoreMenuShown = this.isMoreMenuShown ? false : true;
		this.$.moreSlideup.setOpen(this.isMoreMenuShown);
	},
	moreMenuItemSelectHandler: function (inSender, ev) {
		var value = inSender.value;
		switch (value) {
			case "addAlbum":
				this.$.imageView.suspend();
				this.openAddToAlbumPopup();
				break;
			case "setWallpaper":
				this.clickWallpaper();
				break;
			default:
				break;
		}
		this.toggleMoreMenu();
	},
	clickWallpaper: function() {
		var dbEntry = this.$.imageView.center.dbEntry;
		app.$.wallpaper.set(dbEntry);
	},
	clickSlideshow: function() {
		this.$.hideControlsGroup.cancel();
		console.log('CONGRATS!! You clicked on the slideshow button');
		var pictId = undefined;
		var dbEntry = this.$.imageView.center.dbEntry;
		var albumInfo = this.library.getAlbum(dbEntry.albumId);
		if (albumInfo && (albumInfo.photoCount > 0)) {
			if (dbEntry.mediaType == "image") {
				pictId = dbEntry._id;
			}
			this.doSlideshowClick(pictId, dbEntry.albumId);
		} else {
			this.$.msgDialog.openAtCenter();
		}
		this.log(" ENYO PERF: TRANSITION DONE time: "+ Date.now());
	},
	clickShare: function() {
		this.$.hideControlsGroup.cancel();
		var dbEntry = this.$.imageView.center.dbEntry;
		if (!dbEntry) {
			console.warn("cannot find dbEntry for picture to share");
			return;
		}
		app.$.service.sharePhotos("email", [dbEntry]);
	},
	openDeletePopup: function() {
		var dbEntry = this.$.imageView.center.dbEntry;
		if (!dbEntry) {
			// Ruh-roh!
			console.error("cannot open delete-popup because no current picture DB-entry");
			return;
		}

		var popup = this.$.deletePhotosPopup;
		// Popup is lazy, so must do this before we use any of its components.
		popup.validateComponents();

		var popupContent = this.$.deletePhotosPopupContent;
		if (dbEntry.mediaType === 'video') {
			popupContent.setContent($L("Are you sure you want to delete this video?"));
		}
		else {
			popupContent.setContent($L("Are you sure you want to delete this image?"));
		}

		popup.openAtCenter();
	},
	closeDeletePopup: function() {
		this.$.deletePhotosPopup.close();
	},
	clickConfirmDelete: function() {
		var dbEntry = this.$.imageView.center.dbEntry;
		if (!dbEntry) {
			// Ruh-roh!
			console.error("cannot delete current picture because no DB-entry");
			return;
		}
		app.$.service.deletePhotos([dbEntry._id], false, dbEntry.albumId);
		this.closeDeletePopup();
	},

	// ---------- Add Photo to another album (either existing or new) --------------------

	openAddToAlbumPopup: function() {
		this.$.hideControlsGroup.cancel();
		var dbEntry = this.$.imageView.center.dbEntry;
		if (dbEntry.mediaType == "video") {
			this.$.addToLocalAlbumPopup.openAtCenter();
		} else {
			this.$.addToAlbumPopup.openAtCenter();
		}
	},
	addPhotoToAlbum: function(inSender, dbEntry) {
		// Close the add-to-album popup; we have what we need.
		this.$.addToAlbumPopup.close();

		// Get DB-entry of current photo/video
		var current = this.currentPhotoEntry();
		if (!current) {
			console.warn('no current photo/video found');
			return;
		}

		// Create arguments for service-request
		var serviceArgs = {specs: [{
			targetAlbum: dbEntry._id,
			sourceAlbum: current.albumId,
			photos: [current._id],
			exclude: false
		}]};
		console.log('requesting add photo to album: ' + JSON.stringify(serviceArgs));
		this.$.addPhotosService.call(serviceArgs);
	},
	addPhotoToNewAlbum: function(inSender) {
		// Close the album-selector; we'll quickly replace it with a create-album popup.
		this.$.addToAlbumPopup.close();

		// Get DB-entry of current photo/video
		var current = this.currentPhotoEntry();
		if (!current) {
			console.warn('no current photo/video found');
			return;
		}

		// Create specs to identify photos to immediately add to the new album.
		var specs = [{
			sourceAlbum: current.albumId,
			photos: [current._id],
			exclude: false
		}];

		// Open the create-album popup
		this.$.createAlbumPopup.initialPhotoSpecs = specs;
		this.$.createAlbumPopup.openAtCenter();
	},
	addPhotoSuccess: function(inSender, inResponse, inRequest) {
		console.log('successfully added photo to album');
	},
	addPhotoFailure: function(inSender, inResponse, inRequest) {
		console.warn('failed to add photo to album: ' + JSON.stringify(inResponse));
	},
	pictureChanged: function() {
		this.closeComments();
		this.$.pictureComments.clearInput();
		var im = this.$.imageView;
		if (im.center && im.center.dbEntry) {
			this.updateShownControls(im.center.dbEntry.mediaType, im.center.dbEntry.type);
		}
	},


	// ---------- Printing ---------------------------------------------------------------

	clickPrint: function() {
		this.$.hideControlsGroup.cancel();

		try {
			var path;

			//@todo we really want the hi-res image for facebook printing (any printing, really)
		   //@todo we want to have an 'appFullResolution' property that the application can look for, with the same reasoning as appStripThumbnail and friends.
			//@todo should this now be "com.palm.app.facebook"?
			if(this.$.imageView.center.dbEntry.type === "facebook"){
				path = this.$.imageView.center.dbEntry.thumbnails[0].data.path;
			}
			else{
				path = this.$.imageView.center.dbEntry.path;
			}
			console.log('Opening print-dialog for file: ' + path);
			this.$.printDialog.setImagesToPrint([path]);
			this.$.printDialog.openAtCenter();
		}
		catch(err) {
			console.log('Could not open print-dialog because: ' + err);
		}
	},
	clickMore: function() {
		this.$.hideControlsGroup.cancel();
		console.log('CONGRATS!! You clicked on the More... button');
	},


	// ---------- Comments ---------------------------------------------------------------

	// For polling to notice new comments.  See below.
	_commentInterval: null,
	closeComments: function() {
		if (this.commentsAreShown) {
			this.commentsAreShown = false;
			this.$.pictureComments.close();
		}
		if (this._commentInterval) {
			window.clearInterval(this._commentInterval);
			this._commentInterval = null;
		}
	},
	toggleComments: function() {
		this.$.hideControlsGroup.cancel();

		if (this.commentsAreShown) {
			this.closeComments();
		}
		else {
			this.commentsAreShown = true;

			// Show whatever comments we have.
			var entry = this.currentPhotoEntry();
			var pc = this.$.pictureComments;
			pc.scrollToTop();
			pc.setCommentList(entry.comments || []);
			// XXXXX FIXME: performance... this takes too long to open
			pc.openAt({top: 10, right: 10});

			// Arrange to poll for changes in our cached DB record for the
			// picture.  This should be a cheap operation, since:
			// - we don't query the DB
			// - we don't change the DOM unless the list of comments has changed.
			var that = this;
			this._commentInterval = window.setInterval(function() {
				var entry = that.currentPhotoEntry();
				pc.setCommentList(entry.comments || []);
			}, 1000);

			// Freshen the comments.
			this.$.getCommentService.call(entry);
		}
		return true;
	},
	submitComment: function(inSender, commentText) {
		var entry = this.currentPhotoEntry();
		this.$.putCommentService.call({photo: entry, text: commentText});
	},
	putCommentSuccess: function(inSender, inResult, inRequest) {
		console.log('SUCCESSFULLY UPLOADED COMMENT!  ' + JSON.stringify(inResult));
	},
	putCommentFailure: function(inSender, inResult, inRequest) {
		console.log('FAILED TO UPLOAD COMMENT!  ' + JSON.stringify(inResult));
	},


	// ---------- Enter and leave PictureMode --------------------------------------------

	beforeEnterPictureMode: function() {
		this.$.imageView.reset();
	},
	enterPictureMode: function() {
		this.setFullScreen(true);
	    this.$.showControlsGroup.execute();
	    this.$.hideControlsGroup.schedule(this.hideControlbarIdleTimeout);
		this.isPictureModeActive = true;
	},
	leavePictureMode: function() {
		this.closeComments();
		if (this.isMoreMenuShown) { this.toggleMoreMenu(); }
		if (this.$.imageView.onLeaveView) { this.$.imageView.onLeaveView(); }
		this.setFullScreen(false);
		this.isPictureModeActive = false;
		this.doLeave();
    this.log(" ENYO PERF: TRANSITION DONE time: "+ Date.now());
	},
	isPictureMode: function () {
		return this.isPictureModeActive;
	},
	setFullScreen: function (boolFullScreen) {
		if (window.PalmSystem) {
			window.PalmSystem.enableFullScreenMode(boolFullScreen);
		}
	},
	backToCaptionChanged: function() {
		this.$.backButtonLabel.setContent(this.g11nBackButtonCaption(this.backToCaption));
	},
	

	// ---------- window life-cycle ----------------------------------------------------------

	windowDeactivatedHandler: function () {
		this.$.imageView.windowDeactivatedHandler && this.$.imageView.windowDeactivatedHandler();
	},
	windowActivatedHandler: function () {
		this.$.imageView.windowActivatedHandler && this.$.imageView.windowActivatedHandler();
	},
	unloadHandler: function () {
		this.$.imageView.unloadHandler && this.$.imageView.unloadHandler();
	},
	windowTossedHandler: function () {
		this.$.imageView.windowTossedHandler && this.$.imageView.windowTossedHandler();
		this.leavePictureMode();
	},

	// ---------- Miscellaneous ----------------------------------------------------------

	// Answer the DB-entry of the currently-viewed photo.
	currentPhotoEntry: function() {
		var center = this.$.imageView.center;
		return center && center.dbEntry;
	}
});


