/*global window, PalmSystem, console, enyo, $L */

enyo.kind({
	name: "TabletUI",
	kind: "VFlexBox",
	libraryViewMode:   "library",
	albumViewMode:     "album",
	pictureViewMode:   "picture",
	slideshowViewMode: "slideshow",
	components: [
		// Outer pane that allows us to transition between fullscreen and navigation views.
		{ kind: "PanePlusPlus", name: "outerPane", transitionKind: "enyo.transitions.Simple", flex: 1, components: [
			{ name: "slidingPane", kind: "SlidingPane", multiViewMinWidth: 540, className: "uiSlidingGroup",
				components: [
					{ name: "navPanelSlider", width: "280px", numToggleOverlapped: false,
						style: "background-image: url(images/divider_background.png);",
						components: [
							{ name: "navPanel",
								kind: "LibraryNavigationPanel",
								onSelectAlbum: "handleAlbumSelection",
								onSelectPhotoSource: "handlePhotoSourceSelection",
								onRequireAlbumThumbnail: "hackThumbnailUrlForAlbum"
							}
						]
					},
					{ name: "albumViewSlider", flex: 1, dragAnywhere: true,
						components: [
//							{ kind: "PanePlusPlus", name: "contentPane", transitionKind: "enyo.transitions.Fade", flex: 1, components: [
							{ kind: "PanePlusPlus", name: "contentPane", transitionKind: "enyo.transitions.Simple", flex: 1, components: [
								// Put the same background image on each pane-view instead of up on the pane
								// so that alpha-blend transitions between them work properly.  Think about it :-)
								{kind: "LibraryMode",
									name: "libraryMode",  // so we can easily switch between LibraryMode and LibraryMode2
									className: "PanelContent",
									onAlbumSelected: "handleAlbumSelection",
									onPictureSelected: "handlePictureSelection",
									onSlideshowClick: "onLibrarySlideshowClickHandler",
									onRequireAlbumThumbnail: "hackThumbnailUrlForAlbum"},
								{kind: "AlbumMode",
									className: "PanelContent",
									onAlbumRenamed: "renameAlbum",
									onPictureSelected: "handlePictureSelection",
									onSlideshowClick: "onAlbumSlideshowClickHandler"}
							]}
					]}
				]
			},
			{ kind: "PictureMode", onLeave: "leavePictureView", onSlideshowClick: "onSlideshowClickHandler" },
			{ kind: "SlideshowMode", onLeave: "leaveSlideshowView" },
			{ name: "checkFirstLaunch", kind: "Accounts.checkFirstLaunch", appId: "com.palm.app.photos", onCheckFirstLaunchResult: "checkFirstLaunchResult" },
			{ name: "firstLaunch",
				kind: "firstLaunchView",
				iconSmall: "images/icn-all-photos.png",
				iconLarge: "icon-256x256.png",
				capability: ["PHOTO.UPLOAD", "LOCAL.FILESTORAGE"],
				onAccountsFirstLaunchDone: "leaveFirstLaunch",
				lazy: true
			}
		]},
		{ kind: "Library", name: "library" },
		{ kind: "AppMenu", components: [
			{ caption: $L("Preferences & Accounts"), onclick: "openAccountsApp" },
			{ caption: $L("Help"), onclick: "openHelp" },
			{ name: "accountsLauncher", kind: "PalmService", service: "palm://com.palm.applicationManager/", method: "launch" },
			{ name: "helpLauncher", kind: "PalmService", service: "palm://com.palm.applicationManager/", method: "open" }
		]},
		{ kind: "HFlexBox", showing: false, className: "DebugButtons", components: [
// L10N Notes: Do not localize the button labels, these are for debugging only, not user visible
//			{ kind : "Button", name : "libraryModeButton", caption: "Library View", onclick: "goToLibraryView" },
//			{ kind: "Button", name: "albumModeButton", caption: "Album View", onclick: "goToAlbumView" },
//			{ kind: "Button", name: "pictureModeButton", caption: "Picture View", onclick: "goToPictureView" },
//			{ kind: "Button", name: "debugLayout", caption: "Layout Experiments", onclick: "goToDebugLayout" },
			{ kind: "Button", name: "fbClearCache", caption: "Clear FB Cache", onclick: "debugClearFacebookCache" },
			{ kind: "Button", name: "generateThumbnails", caption: "Generate Thumbnails", onclick: "requestThumbnailGeneration" }
		]},
		{ name: "audiMon", kind: "PalmService", service: "palm://com.palm.audio/",
			method: "media/lockVolumeKeys", subscribe: true,
			onSuccess: "audioVolumeLockResponseHandler", onFailure: "audioVolumeLockFailureHandler"
		},
		{ name: "appEvent", kind: "ApplicationEvents",
			onWindowActivated: "windowActivatedHandler", onWindowDeactivated: "windowDeactivatedHandler",
			onWindowHidden: "windowHiddenHandler"
		},
		{ name: "dashboard", kind: "Dashboard", smallIcon: "images/icn-all-photos-small.png" },
		{ name: "service", kind: "PhotosAndVideosService", onNotify: "dashboardNotify" },
		{ name: 'accounts',
			kind: 'PhotoAccounts',
			onAccountsChanged: 'accountsChanged',
			onSyncStatusChanged: 'syncStatusChanged'
		},
		{ name: "wallpaper", kind: "WallpaperManager" }
	],
	create: function(cfg) {
		window.PalmSystem && PalmSystem.keepAlive(true);

		enyo.create({name: "dbservice", kind: cfg.dbservice, owner: this});

		this.inherited(arguments);
		if (!this.$.dbservice) throw("TabletUI.create(): no service-interface was provided");  // XXXXX could push this into superclass.
		if (window.PalmSystem) {
			if (!this.isAudioVolumeKeyFirstAttempt) {
				this.isAudioVolumeKeyFirstAttempt = true;
				this.$.audiMon.call({});
			} else {
				delete this.isAudioVolumeKeyFirstAttempt;
			}
		}
		this.$.libraryMode.setLibrary(this.$.library);
		this.$.pictureMode.setLibrary(this.$.library);

		// The "local" account always exists, so don't wait around for it to show up.
		this.accountsChanged(null, [this.$.accounts.$.localAccount]);
		this.$.accounts.start();
		//		window.setTimeout(enyo.bind(this.$.accounts, 'start'), 5000);

		this.goToLibraryView();
	},
	checkFirstLaunchResult: function(inSender, inResponse) {
		// If we're running in the browser, the only way to show first-use screen
		// is to explicitly force it.
		if ((window.PalmSystem && inResponse.showFirstLaunch) || this.forceFirstUse) {
			this.enterFirstLaunch();
		}
	},
	enterFirstLaunch: function() {
		// Create the first-launch component if it doesn't already exist.
		if (!this.$.firstLaunch) {  this.$.outerPane.createView("firstLaunch"); }
		
		// Realistic behavior... only enter first-use once, even when explicitly
		// forcing it for debugging purposes.
		this.forceFirstUse = false;

		// tell the Accounts lib that first launch has been shown
		this.$.checkFirstLaunch.firstLaunchHasBeenShown();

		this.$.firstLaunch.startFirstLaunch(undefined, {
			pageTitle: $L("Your photos and videos libraries"),
			localFileStorage: $L("Get started with media on your device:")
		});
		this.$.outerPane.selectView(this.$.firstLaunch);
	},
	leaveFirstLaunch: function() {
		var fl = this.$.firstLaunch;
		if (!fl) { return; }
		
		// Should really go to whatever view was current before entering first-launch...
		this.goToLibraryView();
		window.setTimeout(function() { fl.destroy(); }, 5000);
	},

	// --------------------------- Account Management --------------------------
	// Pass through changes in active accounts to interested parties.
	accountsChanged: function(inSender, accounts) {
		this.$.navPanel.accountsChanged(inSender, accounts);
	},
	// Pass through changes in sync-status to interested parties.
	syncStatusChanged: function(inSender, accounts) {
		this.$.navPanel.syncStatusChanged(inSender, accounts);
	},

	// -------------------- Entering and leaving various modes -----------------
	/**
	 * @return It returns boolean - a true indicates going to library mode can proceed, and a false
	 *         indicates otherwise, i.e. it is already in library mode.
	 */
	goToLibraryView: function() {
		// Do this just in case we were in first-use.
		this.$.outerPane.selectView(this.$.slidingPane);
						
		if (this.currViewMode === this.libraryViewMode) return false; // already in library-mode
		this.prevViewMode = this.currViewMode;
		this.currViewMode = this.libraryViewMode;

		this.$.albumMode.setAlbum(null);
		this.$.contentPane.selectView(this.$.libraryMode);
		return true;
	},
	/**
	 * @return It returns boolean - a true indicates going to album mode can proceed, and a false
	 *         indicates otherwise, i.e. it is already in album mode.
	 */
	goToAlbumView: function(album) {
		// If an album is specified, update various parts of the UI to
		// reflect the new album.  If no album is specified, just switch
		// to album-mode and continue to view the same album.
		if (!!album) {
			// Accept either an Album or an album-id.
			if (album.kind !== 'Album') {
				var albumId = album;
				album = this.$.library.getAlbum(albumId);
				if (!album) {
					console.warn("could not find album with guid: " + albumId);
				}
				else {
					this.$.albumMode.setAlbum(album);
					this.$.navPanel.setSelectedAlbumId(album.guid);
					this.$.pictureMode.setBackToCaption(album.title);
				}
			}
		}

		// Make the album-view the current view, if it isn't already.
		if (this.currViewMode === this.albumViewMode) return false; // already in album-mode
		this.prevViewMode = this.currViewMode;
		this.currViewMode = this.albumViewMode;

		this.$.outerPane.selectView(this.$.slidingPane);
		this.$.contentPane.selectView(this.$.albumMode);
		return true;
	},
	/**
	 * @return It returns boolean - a true indicates going to picture mode can proceed, and a false
	 *         indicates otherwise, i.e. it is already in picture mode.
	 */
	goToPictureView: function() {
		if (this.currViewMode === this.pictureViewMode) { return false; }
		this.prevViewMode = this.currViewMode;
		this.currViewMode = this.pictureViewMode;
		this.$.pictureMode.beforeEnterPictureMode();
		this.$.outerPane.selectView(this.$.pictureMode);
		// Because selectView() is async.
		enyo.asyncMethod(this.$.pictureMode, "enterPictureMode");
		return true;
	},
	/**
	 * @return It returns boolean - a true indicates going to slideshow mode can proceed, and a false
	 *         indicates otherwise, i.e. it is already in slideshow mode.
	 */
	goToSlideshowView: function(pictId, albumIds) {
		if (this.currViewMode == this.slideshowViewMode) { return false; }
		this.prevViewMode = this.currViewMode;
		this.currViewMode = this.slideshowViewMode;
		var slideshowMode = this.$.slideshowMode;
		this.$.outerPane.selectView(slideshowMode);
		slideshowMode.enterSlideshowMode(pictId, albumIds);
		return true;
	},
	leavePictureView: function() {
		// XXXXX: This is ugly, but we need to keep this.currViewMode consistent.
		switch (this.$.contentPane.view) {
			case this.$.albumMode:
        this.log(" ENYO PERF: TRANSITION START time: "+ Date.now());
				console.log("Going back to album mode from full-screen view");
				this.goToAlbumView();
				break;
			case this.$.libraryMode:
				console.log("Going back to library mode from full-screen view");
				this.goToLibraryView();
				break;
			default:
				throw new Error("unrecognized mode: " + this.$.contentPane.view);
		}
	},
	leaveSlideshowView: function (inSender, pictId, albumId) {
		switch(this.prevViewMode) {
			case this.albumViewMode:
				this.goToAlbumView();
// XXXXX: I (Josh) removed the similar code from leavePictureView() because it wasn't doing anything
// useful that I could see (DFISH-2714 seems to no longer be relevant), and I wanted to clear the waters
// before trying to address DFISH-7551.
				this.$.navPanel.refresh();
				this.$.slidingPane.resize();
				break;
			case this.pictureViewMode:
				if (!this.goToPictureView()) {
					// goToPictureView() returns false only when we're already in picture-mode.
					console.warn("leaveSlideshowView(): we think we're in picture-mode");
					return;
				}
				this.$.pictureMode.viewPictureInAlbum(pictId, albumId, undefined, undefined);
				break;
			case this.libraryViewMode:
			default:
				this.goToLibraryView();
// XXXXX: as above
				this.$.navPanel.refresh();
				this.$.slidingPane.resize();

				break;
		}
	},

	// -------------------- App Menu -------------------------------------------
	openAppMenuHandler: function() {
		this.$.appMenu && this.$.appMenu.open();
	},
	closeAppMenuHandler: function() {
		this.$.appMenu && this.$.appMenu.close();
	},
	openAccountsApp: function() {
		this.$.accountsLauncher && this.$.accountsLauncher.call({ id: "com.palm.app.accounts" });
	},
	openHelp: function() {
		this.$.helpLauncher && this.$.helpLauncher.call({
			id: "com.palm.app.help",
			params: {target: "http://help.palm.com/photos_and_videos/index.json"}
		 });
	},

	// -------------------- Album creation/deletion ----------------------------
	albumCreated: function(newAlbum) {
		this.$.libraryMode.albumCreated(newAlbum);
		this.$.navPanel.albumCreated(newAlbum);
	},
	albumDeleted: function(albumGuid) {
		this.$.libraryMode.albumDeleted(albumGuid);
		this.$.navPanel.albumDeleted(albumGuid);

		var currentAlbum = this.$.albumMode.album;
		if (currentAlbum && currentAlbum.guid == albumGuid) {
			// TODO: probably want a notification that we're switching to
			// library mode because the album that we were viewing is gone.
			this.goToLibraryView();
		}
	},
	onSlideshowClickHandler: function (inSender, pictId, albumId) {
		this.goToSlideshowView(pictId, [ albumId ]);
	},
	renameAlbum: function (inSender, inAlbum) {
    // Perform a service request
		this.$.service.changeAlbumName(inAlbum, function () {
			this.$.navPanel.$.albumList.punt();
		}.bind(this));
	},
	handlePictureSelection: function(inSender, albumId, pictureId, mediaType, type) {
		if (!this.goToPictureView()) { return; }
		this.$.pictureMode.viewPictureInAlbum(pictureId, albumId, mediaType, type);
	},
	handleAlbumSelection: function(inSender, album) {
		if (!album) {
			this.goToLibraryView();
		}
		else {
			this.goToAlbumView(album);
			var pane = this.$.slidingPane;

			// Phonification... if we're in portrait mode on a phone,
			// then use single-pane view.
			if (pane.multiViewMinWidth >= this.node.clientWidth) {
				pane.selectView(this.$.albumViewSlider);
			}
		}
	},
	// Update to reflect the new photo-source selection.  This involves:
	//   - set the header label and icon to match the new selection.
	//   - TODO: only show film-strips for albums from the specified photo-source
	handlePhotoSourceSelection: function(inSender, albumType, accountIdFilter, sourceCaption) {
		var header = this.$.libraryMode.$.panelHeader;
		header.setLabel(sourceCaption);
		header.setIconStyle('library-navigation-icon-20x20-' + albumType);
		this.$.libraryMode.setSourceFilter(accountIdFilter);
		this.$.pictureMode.setBackToCaption(sourceCaption);
	},
	// Request the Photos Service to generate thumbnails for all pictures
	// that don't already have them.  Two sizes of thumbnails are generated,
	// one for use in AlbumStripView and one for AlbumGridView.
	requestThumbnailGeneration: function() {
		this.$.photoservice.generateThumbnails();
	},
	// FACEBOOK DEBUGGING
	debugClearFacebookCache: function() {
// XXXXX Untested! Made changes after adding OrderedRegistry to Library, but didn't test
// because we don't call this function anyway.
		var albums = this.$.library.albums.array;
		var facebookAlbums = albums.filter(function(a) { return a.type == 'facebook'; });
		var counts = facebookAlbums.map(function(album) { return album.photoCount; });
		facebookAlbums.forEach(function(alb) {
			console.log("\t\t album-id: " + alb.guid + "     photo-count: " + alb.photoCount);
		});
		this.photoservice.facebookClearCache();
	},
	// Find a thumbnail URL to use for the specified album.
	// Answer an array [url, album-type, album].
	// NOTE: now that the LibraryNavigationPanel is registering
	// with the album to get the initial thumbnail update, it's
	// a bit weird to handle the query here (vs. just getting
	// album directly there), but this is the smallest fix that
	// addresses the use-case.
	hackThumbnailUrlForAlbum: function(inSender, albumId) {
		var album = this.$.library.getAlbum(albumId);
		if (!album) {
			console.log("Could not obtain thumbnail for missing album: " + albumId);
			return [null, null, null];
		}
		var pic = album.pictureEntry;
		if (!pic) {
			console.log("Could not find first picture in album: " + albumId);
			return [null, album.type, album];
		}
		if (!pic.appGridThumbnail) {
			if (pic.mediaType == "video") {
				// If pic is a video, then we can at least use the blank-video image.
				return ["images/blank-video-small.png", album.type, album];
			}
			if (!!window.PalmSystem) {
				// XXXXX FIXME We don't have all appGridThumbnails in our mock data;
				// this works around a flood of distracting log messages.
				console.log("No appGridThumbnail for thumbnail for album: " + albumId);
			}
			return [null, album.type, album];
		}
		return [pic.appGridThumbnail.path, album.type, album];
	},
	// SUB-COMPONENT EVENT HANDLERS
	// Methods that are invoked in response to events from sub-components.

	// Default method triggered by Library "onAlbumCreated" event when an album
	// is created.  Only the library-mode needs to be immediately updated when
	// an album is created.
	libraryAlbumAdded: function(library, newAlbum) {
		this.albumCreated(newAlbum);
	},
	// Default method triggered by Library "onAlbumDeleted" event when an album
	// is deleted.  The library-mode always needs to be updated.  The album-mode
	// needs to be updated only if it is viewing the deleted album; in this case
	// it must release the album, and the app switches to library-mode.
	libraryAlbumRemoved: function(library, albumGuid) {
		this.albumDeleted(albumGuid);
	},
	// SERVICE-INTERFACE EVENT HANDLERS
	// Methods that are invoked by events originating in the ServiceInterface.

	// Default method triggered by ServiceInterface "onAlbumsCreated" event when
	// albums were created.  Delegate to the library.
	serviceCreatedAlbums: function (serv, albumSpecs) {
		var library = this.$.library;
		var ids = ["LIBRARY CREATED " + albumSpecs.length + " ALBUMS:    "];
		albumSpecs.forEach(function(spec) {
			library.createAlbum(spec);
			ids.push(spec.guid);
		});
		console.log(ids.join(" "));
	},
	// Default method triggered by ServiceInterface "onAlbumsDeleted" event when
	// albums were deleted.  Delegate to the library.
	serviceDeletedAlbums: function (serv, albumGuids) {
		var library = this.$.library;
		albumGuids.forEach(function(guid) {
			library.deleteAlbum(guid);
		});
	},

	onLibrarySlideshowClickHandler: function (inSender, albumIds) {
		this.goToSlideshowView(null, albumIds);
	},

	onAlbumSlideshowClickHandler: function (inSender, albumId) {
		this.goToSlideshowView(null, [ albumId ]);
	},

	audioVolumeLockResponseHandler: function (audService, resp) {
		// no-op
	},

	audioVolumeLockFailureHandler: function (audService, resp) {
		console.log("Unable to lock audio volume key, cause: "+enyo.json.stringify(resp));
	},

	windowHiddenHandler: function () {
		this.windowDeactivatedHandler();
		if (this.$.pictureMode && this.$.pictureMode.windowTossedHandler) {
			this.$.pictureMode.windowTossedHandler();
		}
	},

	windowDeactivatedHandler: function () {
		if (window.PalmSystem) {
			this.$.audiMon && this.$.audiMon.cancel();
			this.isAudioVolumeKeyReleased = true;
		}
		if (this.$.slideshowMode && this.$.slideshowMode.windowDeactivatedHandler) {
			this.$.slideshowMode.windowDeactivatedHandler();
		}
		if (this.$.pictureMode && this.$.pictureMode.windowDeactivatedHandler) {
			this.$.pictureMode.windowDeactivatedHandler();
		}
	},

	windowActivatedHandler: function () {
		this.initializeVolumeKeyState();

		try {
			if (this.$.slideshowMode && this.$.slideshowMode.windowActivatedHandler) {
				this.$.slideshowMode.windowActivatedHandler();
			}
			if (this.$.pictureMode && this.$.pictureMode.windowActivatedHandler) {
				this.$.pictureMode.windowActivatedHandler();
			}
		} catch(e) { console.log("ERROR IN windowActivatedHandler(): " + e); }

		// Grab the album/picture ID if any, then delete them from the global window-params
		// so that they don't cause us to return to the same picture/album each time the
		// window is re-activated.
		var aID = enyo.windowParams.albumID;
		var pID = enyo.windowParams.pictureID;
		delete enyo.windowParams.albumID;
		delete enyo.windowParams.pictureID;
		this.activateAndViewAlbumOrPicture(aID, pID);
	},
	activateAndViewAlbumOrPicture : function(albumId, pictureId) {
		// Only check first-launch status if we're not being activated by someone else (with a specific album/picture ID).
		// We'll still force the user to go through first-use later.
		if (!albumId) {
			this.$.checkFirstLaunch.shouldFirstLaunchBeShown();
			return;
		}
		
		if (pictureId) {
			// View picture in full-screen mode
			console.log("Activating and viewing picture: " + pictureId + " in album: " + albumId);

			// Hack so that the full-screen "back" button will take the user back to the album.
			// By tricking ourself to think that we're already in album-mode, we can switch
			// to the correct album without forcing a visual switch to album mode.
			this.currViewMode = this.albumViewMode;
			this.goToAlbumView(albumId);
			this.$.contentPane.selectView(this.$.albumMode);

			this.goToPictureView();
			this.$.pictureMode.viewPictureInAlbum(pictureId, albumId, undefined, undefined);
		}
		else {
			// Go to view of specified album
			console.log("Activating and viewing album: " + albumId);
			this.goToAlbumView(albumId);
		}
	},
	initializeVolumeKeyState: function() {
		if (window.PalmSystem) {
			if (!this.isAudioVolumeKeyFirstAttempt || this.isAudioVolumeKeyReleased) {
				if (this.isAudioVolumeKeyReleased) {
					this.isAudioVolumeKeyReleased = false;
				} else if (!this.isAudioVolumeKeyFirstAttempt) {
					this.isAudioVolumeKeyFirstAttempt = true;
				}
				this.$.audiMon && this.$.audiMon.call({});
			} else {
				delete this.isAudioVolumeKeyFirstAttempt;
			}
		}
	},
	unloadHandler: function () {
		if (window.PalmSystem) { this.$.audiMon && this.$.audiMon.destroy(); }
		if (this.$.slideshowMode && this.$.slideshowMode.unloadHandler) {
			this.$.slideshowMode.unloadHandler();
		}
		if (this.$.pictureMode && this.$.pictureMode.unloadHandler) {
			this.$.pictureMode.unloadHandler();
		}
	},
	dashboardNotify: function(inSender, title, details) {
		this.$.dashboard.push({
			icon: "images/icn-all-photos.png",
			title: title,
			text: details
		});
	}
});
