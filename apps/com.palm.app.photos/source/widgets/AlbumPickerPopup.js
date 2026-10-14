/*global enyo, $L, console*/
enyo.kind({
	name: 'AlbumPickerPopup',
	kind: 'ModalDialog',
	caption: $L('Add to Album'),
	published: {
		allowAlbumCreation: true
	},
	events: {
		onSelectAlbum: '',
		onCreateAlbum: '',
		onCancel: ''
	},
	components: [
		{ kind: 'VFlexBox', height: '322px', components: [
			{ name: 'albumList', 
				kind: 'DbList',
				flex:1,
				onQuery: 'dbQuery',
				onSetupRow: 'setupRow', 
				className: 'enyo-input-focus',
				desc: true,
				components: [
					{ name: 'rowItem',
						kind: 'Item',
						style: 'padding:15px;',
						onclick: 'itemSelected',
						className: 'item-listing',
						tapHighlight: true,
						components: [
							{ name: 'rowIcon', kind: 'Image'},
							{ name: 'rowLabel', content: $L('Album Name')}
						]
					}
				]
			},
			{ kind: 'HFlexBox', style:'margin-top:10px;', components: [
				{ name: 'Cancel', kind:'Button', className:'enyo-button-light', flex:1, content: $L('Cancel'), showing: true,onclick: 'cancel'},
				{ name: 'createAlbum', kind:'Button', className:'enyo-button-light', flex:2, content: $L('Create New Album'), showing: true, onclick: 'doCreateAlbum'}
			]}
		]},
		{ name: 'db',
			kind: 'AlbumLocalizationHackDbService',
			method: 'find',
			dbKind: 'com.palm.media.image.album:1',
			subscribe: true,
			onSuccess: 'dbResponse',
			onFailure: 'dbFailure',
			reCallWatches: true,
			mockDataProvider: function(req) { return 'mock/list-albums.json'; }
		}
	],
	dbQuery: function(inSender, inQuery) {
		console.log('&& album-picker dbQuery():  ' + enyo.json.stringify(inQuery));
		
		inQuery.where = [{prop: "showAlbum", op: "=", val: true}];
		inQuery.orderBy = "modifiedTime";
		
		return this.$.db.call({query: inQuery});
	},
	dbResponse: function(inSender, inResponse, inRequest) {
		console.log('&& album-picker dbResponse()     count: ' + inResponse.results.length + '  next: ' + inResponse.next );		
		this.$.albumList.queryResponse(inResponse, inRequest);
	},
	dbFailure: function(inSender, inResponse) {
		console.log('&& album-picker dbFailure():  ' + enyo.json.stringify(inResponse));
	},
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
		var item = this.$.rowItem;
		var icon = this.$.rowIcon;
		var label = this.$.rowLabel;
		
		item.canGenerate = true;
		label.canGenerate = true;
		icon.canGenerate = false;
		
		// Remove any entries for the camera-roll album... it is read-only.
		if (inRecord.path.slice(0,7) === "camera:") {
			item.canGenerate = false;
			return;
		}
		
		label.setContent(inRecord.name);
		
		// Obtain a thumbnail to represent the current album.
//		var imageAndAlbumType = this.doRequireAlbumThumbnail(inRecord._id);
		
		// Hack... if no thumbnail is available, try again soon.
//		if (imageAndAlbumType[2]) {
//			this.$.hackTimeout.schedule();
//		}
		
//		var imgSrc = imageAndAlbumType[0];
//		if (!imgSrc) {	imgSrc = 'images/icon_album_thumbnail_generic.png'; }
//		image.setSrc(imgSrc);
		
/*		var albumType = imageAndAlbumType[1];
		if (!albumType || albumType === 'local') {
			icon.canGenerate = false;
		}
		else {
			icon.canGenerate = true;
			icon.setSrc('images/icon_' + albumType + '_20x20.png');	
		}		
*/
/*		
		// Highlight the selected album, if any.
		(inRecord._id === this.selectedAlbumId) ?
			item.highlight() :
			item.unhighlight();
			
*/
	},
	itemSelected: function(inSender, inEvent) {
		var dbEntry = this.$.albumList.fetch(inEvent.rowIndex);
		this.doSelectAlbum(dbEntry);		
	},
	componentsReady: function() {
		this.inherited(arguments);
		this.allowAlbumCreationChanged();
	},
	allowAlbumCreationChanged: function() {
		if (this.$.createAlbum.showing !== this.allowAlbumCreation) {
			this.$.createAlbum.setShowing(this.allowAlbumCreation);
		}
	},
	cancel: function() {
		this.close();
		this.doCancel();
	}
});

