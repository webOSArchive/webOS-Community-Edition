enyo.kind({
	name: 'LibraryNavigationPanel',
	kind: 'VFlexBox',
	className: 'library-navigation-panel',
	height: '100%',
	events: {
		// Provides the dbRecord for the selected album, or null
		// if no album is selected.
		onSelectAlbum: '',
		// Provide the name of the current photo-source, one of:
		//   - all				(all of the sources below)
		//   - local			(photos imported directly onto the device)
		//   - facebook
		//   - photobucket
		//   - snapfish
		// Also provide the caption associated with the current
		// photo-source, for use elsewhere in the UI.
		onSelectPhotoSource: '',
		// Obtain the URL of an image-file to use as the thumbnail of
		// a specific album.  The argument is the album's MojoDB _id.
		onRequireAlbumThumbnail: ''
	},
	published: {
		selectedSource: null,
		selectedAlbumId: null,
	},
	components: [
		{	content: $L('Libraries &amp; Albums'),
			className: 'navPanel PanelHeader',
			height:'54px',
			style: 'text-align:center;font-size:0.8em;line-height:50px;'
		},
		{ name: 'sources',
			kind: 'DividerDrawer',
			defaultKind: 'PhotoAccountLibraryNavigationItem',
			caption: $L('LIBRARIES'),
			captionClassName: 'library-navigation-item library-navigation-section-divider',
			onOpenAnimationComplete: 'resize',
		},
		{ 	kind: 'Divider',
			name: 'albumDivider',
			caption: $L('ALL ALBUMS'),
			// onclick: 'toggleDrawer',
			className: 'library-navigation-item library-navigation-section-divider' },
		{ name: 'albumList',
			kind: 'PuntyDbList',
			flex: 1,
			className: 'library-navigation-list-pane',
			onQuery: 'dbQuery',
			onSetupRow: 'setupRow',
			onScroll: 'clearMouseDownHighlight',
			desc: true,
			components: [
				{	name: 'item',
					kind: 'LibraryNavigationItem',
					onItemSelected: 'albumItemSelected',
					onmousedown: 'setMouseDownHighlight',
					onmouseup: 'clearMouseDownHighlight',
					components: [
						{ name: 'image', kind: 'Image', className: 'library-navigation-icon-album-foreground', onclick: 'albumItemSelected' },
						{ name: 'smallIcon', kind: 'Image', width: '20px', height: '20px', style: 'position: absolute; bottom: 8px; left: 11px'}
					]
				}
			]
		},

		{ kind: 'Toolbar', className:'enyo-toolbar ', pack: 'center', style:'width:100%', components: [
			{ name: 'createAlbumPopup', kind: 'AlbumCreationPopup' },
			{ name: 'createAlbumButton',
				kind: enyo.button,
				onclick: 'openAlbumCreationPopup',
				className: 'newAlbumButton',
				content: $L('New Album'),
			}
		]},
		{ name: 'db',
			kind: 'AlbumLocalizationHackDbService',
			method: 'find',
			dbKind: 'com.palm.media.image.album:1',
			subscribe: true,
			onSuccess: 'dbResponse',
			onFailure: 'dbFailure',
			onWatch: 'dbWatch',
			reCallWatches: true,
			mockDataProvider: function(req) { return 'mock/list-albums.json'; }
		},
		{ name: 'refreshThumbnailTimeout', kind: 'ThrottledTimeout', duration: 500, onTimeout: 'refreshThumbnailAfterTimeout' },
		{ name: 'albumViewer', kind: 'ModelViewer' }
	],

	clearMouseDownHighlight: function() {
		var row = this.mouseDownRow;
		if (row !== undefined) {
			this.mouseDownRow = undefined;
			this.$.albumList.updateRow(row);
		}
	},
	setMouseDownHighlight: function(inSender, inEvent) {
		this.mouseDownRow = inEvent.rowIndex;
		this.$.albumList.updateRow(inEvent.rowIndex);
	},

 	// -------------------- Initialization --------------------

	create: function() {
		this.inherited(arguments);
		this.$.albumViewer.pendingAlbums = {};
	},

 	// -------------------- UI Behavior --------------------

	toggleDrawer: function() {
		this.$.sources.toggleOpen();
	},
	resize: function() {
		this.$.albumList.resized();
	},

	// --------------------- Displaying and selecting Cloud photo sources --------------------

	accountsChanged: function(inSender, accounts) {
		// Remember the current filter so that we can reselect the same item
		// when the list of accounts changes.
		var oldFilter = this.selectedSource && this.selectedSource.albumFilter;

		// Reset and recreate from scratch.
		this.selectedSource = null;
		var srcs = this.$.sources;
		srcs.destroyControls();

		// These two options are always available.
		var s1 = srcs.createComponent({ kind: 'LibraryNavigationItem', albumFilter: null, type: 'all', caption: $L('All Photos & Videos'), owner: this });

		// Create an entry for each available cloud source.
		var that = this;
		accounts.forEach(function(a) {
			// Chop off all but the end of the template-id to obtain the type.
			var type = a.accountType.split('.');
			type = type[type.length-1];
			srcs.createComponent({ account: a, albumFilter: a.accountId, type: type, caption: a.accountName, owner: that });
		});

		// Set the icons for all of these bad boys (including the two that are always available).
		var items = srcs.getControls();
		items.forEach(function(item) {
			item.$.icon.addClass('library-navigation-icon-' + item.type);
		});

		// Set the selected source.  Either re-select the same source as before,
		// or if it is no longer available, fallback to "All Photos & Videos".
		var newSelectedSource = items[0];
		items.forEach(function(item) {
			if (item.albumFilter === oldFilter) newSelectedSource = item;
		});
		this.setSelectedSource(newSelectedSource);

		// Update processing state appropriately, before finally rendering the photo-sources.
		this.syncStatusChanged();
		srcs.render();

		// If the drawer is open, it probably resized, and therefore we need to
		// resize the sibling DbList.
		if (srcs) {	this.resize(); }
	},
	// Iterate through all photo-accounts, and update the displayed
	// sync-status of each.
	syncStatusChanged: function() {
		// Skip "All Photos & Videos"
		var srcs = this.$.sources.getControls().slice(1);
		srcs.forEach(function(src) {
			src.updateSyncStatus();
		});
	},
	selectedSourceChanged: function(oldSource) {
		if (oldSource) { oldSource.unhighlight(); }
		if (this.selectedSource) { this.selectedSource.highlight(); }

		// There are a number of actions that we don't wan't to take in
		// in the middle of create().  We take advantage of the fact that
		// 'oldSource' is only null the first time to exit early.
		if (!oldSource) {
			console.log('exiting early the first time through selectedSourceChanged()');
			return;
		}

		// This seems like the desired behavior from the HI point of view.
		this.setSelectedAlbumId(null);

		// HI decided to always show all albums (i.e. don't filter by cloud-account).
		// Therefore, we can avoid a janky flash-to-blank by not refreshing the list...
		// it's an enyo issue that there is a flash at all, but now that the list items
		// aren't changed there's no need to provoke the issue, so don't punt.
//
//		// Don't want to start at some random place in the updated list
//		// of albums, so reset the list to start at the top.
//		if (oldSource !== this.selectedSource) {
//			 this.$.albumList.punt();
//		}

		// Tell the world that the photo-source has changed.
		this.doSelectPhotoSource(this.selectedSource.type, this.selectedSource.albumFilter, this.selectedSource.caption);
	},
	itemSelected: function(inSender, inEvent) {
		this.setSelectedSource(inSender);
	},


	// -------------------- Dealing with the outside world --------------------

	selectedAlbumIdChanged: function(oldSelectedId) {
		if (this.selectedAlbumId === oldSelectedId) return; // no change
		this.$.albumList.refresh();

		// If there is an album selected, then remove the highlight on the source.
		// This was explicitly requested by HI.
		if (this.selectedAlbumId && this.selectedSource) {
			this.selectedSource.unhighlight();
		}

		// Tell the world
		this.doSelectAlbum(this.selectedAlbumId);
	},

	//  -------------------- DB queries, responses, and error-handling --------------------

	dbQuery: function(inSender, inQuery) {
		inQuery.where = [{prop: "showAlbum", op: "=", val: true}];
		inQuery.orderBy = "modifiedTime";

		var albumFilter = this.selectedSource && this.selectedSource.albumFilter;
		// HI has requested that we always show all albums in the nav-panel list.
		// The filter only applies to the LibraryMode view (i.e. what used to be
		// the filmstrip-view).  Also see selectedSourceChanged().
//		if (albumFilter) {
		if (false) {
			// Local albums don't have an explicit accountId, so we need to
			// adjust the query accordingly.
			if (albumFilter === 'local') {
				inQuery.where.push({prop: 'type', op: '=', val: 'local'});
			} else {
				inQuery.where.push({prop: 'accountId', op: '=', val: albumFilter});
			}
		}

		console.log('&& nav-panel dbQuery(): ' + enyo.json.stringify(inQuery));
		return this.$.db.call({query: inQuery});
	},
	dbResponse: function(inSender, inResponse, inRequest) {
		console.log("&& nav-panel dbResponse()     count: " + inResponse.results.length + "  next: " + inResponse.next );
		this.$.albumList.queryResponse(inResponse, inRequest);
	},
	dbFailure: function(inSender, inResponse) {
		console.log("&& nav-panel dbFailure():   " + enyo.json.stringify(inResponse));
	},
	// Hack suggested by the enyo team to address DFISH-15780.  We end up requerying
	// more data than we need to, as in the common case where a property in a DB-entry
	// changes, but no entries are added/removed.
	dbWatch: function() {
		this.$.albumList.reset();
	},


	//  -------------------- Album-list generation and event-handling --------------------

	setupRow: function(inSender, inRecord, inIndex) {
		// Normalization to make things easier for ourselves
		if (!inRecord.type) {
			console.log('No album source-type specified... using "local".');
			inRecord.type = 'local';
		}

		// If a filter is specified, ensure that the record matches,
		// otherwise don't generate the row.  We do this here so that
		// filtering works in the web-browser (it shouldn't be necessary)
		// for running on the device, since the db-results will already
		// be filtered.
		var item = this.$.item;
		var image = this.$.image;
		var icon = this.$.smallIcon;

		// If we're running in the browser, need to manually filter the DB results.
		// On-device, we set up the DB query to only return the desired results.
		if (!window.PalmSystem) {
			var albumFilter = this.selectedSource && this.selectedSource.albumFilter;
			var accountId = inRecord.accountId || 'local';  // since that's what we match with our filter
			if (albumFilter && (albumFilter !== accountId)) {
				item.canGenerate = false;
				image.canGenerate = false;
				icon.canGenerate = false;
				return;
			}
		}

		item.canGenerate = true;
		image.canGenerate = true;

		item.setCaption(inRecord.name);
		item.$.icon.addClass('library-navigation-icon-album-background');

		// Obtain a thumbnail to represent the current album.
		var imageAndAlbumType = this.doRequireAlbumThumbnail(inRecord._id);
		var imgSrc = imageAndAlbumType[0];
		if (!imgSrc) {
			imgSrc = 'images/icon_album_thumbnail_generic.png';

			// Register with the album so that we know immediately
			// when a thumbnail becomes available.
			this.registerForAlbumThumbnail(inRecord._id, imageAndAlbumType[2]);
		}
		image.setSrc(imgSrc);

		var albumType = imageAndAlbumType[1];
		if (!albumType || albumType === 'local') {
			icon.canGenerate = false;
		}
		else {
			icon.canGenerate = true;
			albumType = albumType.split('.');
			albumType = albumType[albumType.length-1];
			icon.setSrc('images/icon_' + albumType + '_20x20.png');
		}

		// Highlight the selected album, if any.
		if (inRecord._id === this.selectedAlbumId) {
					item.highlight();
				}
				else if (this.mouseDownRow === inIndex) {
					item.applyStyle('background', '#333');
				}
				else {	
					item.unhighlight();
				}
	},

	albumItemSelected: function(inSender, inEvent) {
		var albumList = this.$.albumList;
		var origRecord = albumList.fetch(inEvent.rowIndex);

		// Update the UI and notify the world.
		this.setSelectedAlbumId(origRecord._id);
	},


	// --------------------- Updating thumbnails --------------------

	// We may be interested in the new album's thumbnail.  Let's see...
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
		this.$.albumList.refresh();
	},

	// --------------------- End-user Album creation --------------------

	openAlbumCreationPopup: function() {
		this.$.createAlbumPopup.openAtCenter();
	},


	//  -------------------- HACKS!!! --------------------

	// XXXXX FIXME: I don't believe that it should be necessary to
	// explicitly refresh the album-list, but it seems like it is,
	// for example when switching back from full-screen view.
	refresh: function() {
		// XXXXX FIXME: I *definitely* don't believe that it should be
		// neccessary to refresh the album-list asynchronously, but it
		// is when switching back from full-screen view.
		enyo.asyncMethod(this.$.albumList, 'refresh');
	}
});


// Helper class for the UI elements in a LibraryNavigationPanel.
enyo.kind({
	name: 'LibraryNavigationItem',
	kind: 'Item',
	layoutKind: enyo.VFlexLayout,
	className: 'library-navigation-item library-navigation-list-item',
	tapHighlight: true,
	published: {
		caption: '',
		showIcon: true
	},
	events: {
		onItemSelected: 'itemSelected'
	},
	chrome: [
		// The !important is important, because otherwise the HFlexBox will append a
		// '-webkit-box-align: stretch' that stomps my 'center'.
		{ kind: 'HFlexBox', flex: 1, style: 'padding: 0px; -webkit-box-align: center !important;', onclick: 'doItemSelected', components: [
			{ name: 'icon', className: 'library-navigation-icon-40x40 library-navigation-icon-all'},
			{ name: 'caption', flex: 1, className: 'library-navigation-caption'}
		]},

	],
	create: function() {
		this.inherited(arguments);
		this.setClassName(this.className);
		this.captionChanged();
		this.showIconChanged();
	},
	captionChanged: function() {
		this.$.caption.setContent(this.caption);
	},
	showIconChanged: function() {
		this.$.icon.setShowing(this.showIcon);
	},
	highlight: function() {
		this.applyStyle('background', 'url(images/list-highlight.png) no-repeat');
	},
	unhighlight: function() {
		this.applyStyle('background', 'url(../images/divider_separator_line.png');
	}
});

// Specialization of LibraryNavigationItem to display photo-accounts in a LibraryNavigationPanel.
enyo.kind({
	name: 'PhotoAccountLibraryNavigationItem',
	kind: 'LibraryNavigationItem',
	components: [
		{ kind: 'Spinner', style: 'position: absolute; top: 13px; right: 15px;', height: '32px', width: '32px', showing: false }
	],
	create: function() {
		this.inherited(arguments);
		if (!this.account) { console.warn('no PhotoAccount provided at initialization'); }
		this.syncStatus = 'idle';
	},
	updateSyncStatus: function() {
		if (this.syncStatus === this.account.syncStatus) return;
		this.syncStatus = this.account.syncStatus;

		// XXXXX For debugging/testing... force spinners to turn off/on.
//		if (this.syncStatus === 'idle') { this.syncStatus = 'processing' }
//		else { this.syncStatus = 'idle'; }

		console.log('updating sync-status to: ' + this.syncStatus + '   in: ' + this.$.caption.content);
		if (this.syncStatus === 'idle') { this.$.spinner.hide(); }
		else { this.$.spinner.show(); }
	}
});


