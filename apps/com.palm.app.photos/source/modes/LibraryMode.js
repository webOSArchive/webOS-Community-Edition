/*global  window, console, enyo, NonCssParams, $L */

enyo.kind({
	name: "LibraryModeGridCell",
	kind: enyo.Control,
	style: "width: 184px;",	
	events: {
		// Private events
		onCellClick: "_signalCellClick",
		onCellMouseHold: "_signalCellMouseHold",
		onCellMouseRelease: "_signalCellMouseRelease",
		onCellDragStart: "_signalCellDragStart",
		onCellDrag: "_signalCellDrag",
		onCellDragFinish: "_signalCellDragFinish"
	},
	components: [
		{ 
			kind: "Control",
			name: "imageHolder",
			height: "120px",
			width: "184px",
			style: "position: relative;",

			components: [
				{ 
					kind: "Image", 
					className: "AlbumGridThumbImg", 
					height: (""+NonCssParams.AlbumGridThumb_height+"px"), 
					onclick: "doCellClick",
					onmousehold: "doCellMouseHold",
					onmouserelease: "doCellMouseRelease",
					ondragstart: "doCellDragStart",
					ondrag: "doCellDrag",
					ondragfinish: "doCellDragFinish"
				}
			]
		},
		{ kind: "Control",
			name: "albumName",
			className:"enyo-text-ellipsis",
		//	pack: "center", (for some reason it doesnt work in this context ???)
			style: "text-align: center; font-size: 0.7em; ",
			
			content: "Hello handsome!"
		},
		{ kind: "Control",
			name: "itemCount",
			className:"enyo-text-ellipsis",
			height: "40px",
			style: "visibility:hidden;text-align: center; font-size: 0.7em;",
//			width: "100%",
			content: "45 photos, 7 videos"
		}
	]
});

enyo.kind({
	name: "LibraryMode",
	kind: enyo.VFlexBox,
	published: {
		// Determines which albumviews should be filtered (i.e. not displayed).
		// If the value is null, all albums are shown.  Otherwise only those
		// albums whose types match the filter are shown.
		sourceFilter: null
	},
	library: null,
	events: {
		onAlbumSelected: "",
		onSlideshowClick: "",
		// Obtain the URL of an image-file to use as the thumbnail of
		// a specific album.  The argument is the album's MojoDB _id.
		onRequireAlbumThumbnail: ''
	},
	className: "LibraryMode",
	components: [
		{ kind: "PanelHeader",
			label: $L("All Photos & Videos"),  // there are a few copies of this sprinkled around, sorry.
			controlAreaStyle: "stripview-header-controls"
		},
		
		/*
		{ kind: "VirtualGrid",
			name: "grid",
			flex: 1,
			style: "background-color: #171", 
			onAcquirePage: "acquirePage",
			onDiscardPage: "discardPage",
			onSetupCell: "setupCell", 
			onCreateCell: "createCell"
		},
		*/
		{ 
			kind: "DbGrid",
			name: "grid",
			flex: 1,
			onQuery: "dbQuery",
			onCreateCell: "gridCreateCell",
			onSetupCell: "gridSetupCell",
			onCellClick: "gridCellClick",
			manualEventHandlerSetup: true,
			desc: true,
			components: [
				{
					name: "db", 
					kind: "AlbumLocalizationHackDbService", 
					method: "find", 
					dbKind: "com.palm.media.image.album:1", 
					subscribe: true, 
					onSuccess: "dbResponse", 
					onFailure: "dbFailure", 
					onWatch: "dbWatch", 
					reCallWatches: true,
					mockDataProvider: function(req) { return "mock/list-albums.json"; }
				}
			]
		},	
		{	
			name: "bottomPanel",
			kind: "Toolbar",
		//	height: '54px;',
			className: "enyo-toolbar",
			components: [
				{	
					kind: "Image", 
					slidingHandler: true,
					src: "images/drag-handle.png", 
					style: "position: absolute; z-index: 1"
				},
				{
					name: 'spacer', flex:1
				},
				{
					name: "btnSlideShow", 
					kind: "ToolButton", 
					style: "padding:0px;",
					icon:"images/icn-slideshow.png",
					onclick: "clickSlideshow", 
					
				}
			]
		},
		{ 
			name: 'refreshThumbnailTimeout', 
			kind: 'ThrottledTimeout', 
			duration: 500, 
			onTimeout: 'refreshThumbnailAfterTimeout' 
		},
		{ 
			name: 'albumViewer', 
			kind: 'ModelViewer' 
		},
		{ 
			name: "msgDialog", 
			kind: "MessageDialog", 
			message: $L("Please download more photos to play slideshow.") 
		}

	],
	create: function() {
		this.inherited(arguments);
		this.$.albumViewer.pendingAlbums = {};	
	},

	setLibrary: function (library) {
		this.library = library;
	},

	resize: function() {
		this.$.grid.resized();
	},
	
	// See the comment on "sourceFilter" above.
	sourceFilterChanged: function(accountId) {
		if (this.sourceFilter === accountId) return; // fiter didn't change
		this.$.grid.punt();
	},
	
	gridCreateCell: function() {
		return { kind: "LibraryModeGridCell" };
	},
	gridSetupCell: function(inSender, inRow, inColumn, inFlyweight, inRecord) {
		// Normalization to make things easier for ourselves
		if (!inRecord.type) {
			console.log('No album source-type specified... using "local".');
			inRecord.type = 'local';
		}
		
		// Obtain a thumbnail to represent the current album.
		var imageAndAlbumType = this.doRequireAlbumThumbnail(inRecord._id);		
		var imgSrc = imageAndAlbumType[0];
		var img = inFlyweight.$.image;
		if (!imgSrc) {	
			// Register with the album so that we know immediately 
			// when a thumbnail becomes available.
			this.registerForAlbumThumbnail(inRecord._id, imageAndAlbumType[2]);
			imgSrc = "images/photo-frame.png";
		}
		img.setSrc(imgSrc);

		inFlyweight.$.albumName.setContent(inRecord.name);	
		
		var photos = inRecord.total.images;
		var videos = inRecord.total.videos;
		var count = "";
		if (photos) { count += photos + " photos"; }
		if (photos && videos) { count += ", "; }
		if (videos) { count += videos + " videos"; }
		inFlyweight.$.itemCount.setContent(count);
		
		return true;  // show this cell
	},
	gridCellClick: function(inGrid, inSender, row, column, dbEntry) {
		this.doAlbumSelected(dbEntry._id);
	},
	dbQuery: function(inSender, inQuery) {
		inQuery.where = [{prop: "showAlbum", op: "=", val: true}];
		inQuery.orderBy = "modifiedTime";
					
		var accountId = this.sourceFilter;
		if (accountId) {
			// Local albums don't have an explicit accountId, so we need to
			// adjust the query accordingly.

			if (accountId === "local") {
				inQuery.where.push({prop: "type", op: "=", val: "local"});
			} else {
				inQuery.where.push({prop: "accountId", op: "=", val: accountId});
			}
		}

		console.log("&& library-mode dbQuery(): " + enyo.json.stringify(inQuery));
		return this.$.db.call({query: inQuery});
	},
	dbResponse: function(inSender, inResponse, inRequest) {
		// If we're running in the browser, filter the DB results to correspond to the query.
		// We used to do this in gridSetupCell, but this is cleaner, with less side-effects.
		if (!window.PalmSystem && this.sourceFilter) {
			inResponse.results = inResponse.results.filter(function(dbEntry) {
				// The "||" is to handle both local and cloud accounts.
				return (dbEntry.accountId === this.sourceFilter) || (dbEntry.type === this.sourceFilter);
			}, this);
		}
		
		console.log("&& library-mode dbResponse()     count: " + inResponse.results.length + "  next: " + inResponse.next );
		this.$.grid.queryResponse(inResponse, inRequest);
	},
	dbFailure: function(inSender, inResponse) {
		console.log('&& library-mode dbFailure():   ' + enyo.json.stringify(inResponse));
	},
	// Hack suggested by the enyo team to address DFISH-15780.  We end up requerying
	// more data than we need to, as in the common case where a property in a DB-entry
	// changes, but no entries are added/removed.
	dbWatch: function() {
		this.$.grid.$.list.reset();
	},
	
	
	// XXXXX FIXME!!! UUUUUGH!!! CUT'N'PASTE DIRECTLY FROM LibraryNavigationPanel
	
	// The list of albums has changed... refresh our display.  On startup,
	// we get many albums in a short period of time, so throttle the number of
	// grid-refreshes that we do.
	albumCreated: function(album) {
		// If we're not waiting for this album's thumbnail, then we're done.
		var pending = this.$.albumViewer.pendingAlbums;
		if (!pending[album.guid]) { return; }
		
		// Stop waiting for the album...
		delete pending[album.guid];
		// ... and then register our interest in its thumbnail.
		this.registerForAlbumThumbnail(album.guid, album);
		
		// You never know, maybe the new album already has a
		// suitable thumbnail.  If so, unregister ourself from
		// the album, and use the thumbnail.
		if (album.pictureEntry) {
			// Both uses the new thumbnail, and removes the current registration.
			this.notifyPictureEntryChanged(album.pictureEntry);
		}
	},
	// We're no longer interested in this album's thumbnail.
	albumDeleted: function(albumId) {
		// If we were registered for notifications for the destroyed album, 
		// then we were automatically unregistered when.  All we need to do
		// is clean up the possible entry in "pendingAlbums".
		delete this.$.albumViewer.pendingAlbums[albumId];
	},
	// We need a thumbnail from the specified album, so register
	// for changes in the album's "pictureEntry".
	registerForAlbumThumbnail: function(albumId, album) {
		if (!album) {
			// There is no album, so make that we're interested if the
			// album becomes available.
			this.$.albumViewer.pendingAlbums[albumId] = true;
		}
		else {
			album.$.albumViews.registerViewer(this.$.albumViewer);
		}
	},
	// A thumbnail for an album that we're interested in has become available.
	notifyPictureEntryChanged: function(entry) {
		if (!entry) return;
		var albumModel = this.$.albumViewer.models[entry.albumId];
		if (albumModel) {
			this.$.albumViewer.removeModel(albumModel);
			// Don't update immediately... it's likely that thumbnails for
			// other albums will show up soon, so avoid multiple relayouts.
			this.$.refreshThumbnailTimeout.schedule();
		}
		else {
			console.log('could not find registration for album ' + entry.albumId + ', but was notified!?!');
		}
	},
	// For when we want to periodically force a refresh.
	refreshThumbnailAfterTimeout: function() {
		console.log('Refreshing list after timeout (waiting for appGridThumbnails to be created)');
		this.$.grid.refresh();
	},
	

	clickSlideshow: function () {
		if (!this.library) { return; }
        var albumIds = this.library.getAlbumIds();
		if (!albumIds || 0 === albumIds.length) {
			this.$.msgDialog.openAtCenter();
			return;
		}
		var i, len = albumIds.length, albumIdArray = [];
		for (i = 0; i < len; i++) {
			var album = this.library.getAlbum(albumIds[i]);
			if (!album) { continue; }
			if (album.photoCount > 0) {
				albumIdArray.push(album.guid);
			}
		}
		if (albumIdArray.length > 0) {
			this.doSlideshowClick(albumIdArray);
		} else {
			this.$.msgDialog.openAtCenter();
		}
	}	
	
});
