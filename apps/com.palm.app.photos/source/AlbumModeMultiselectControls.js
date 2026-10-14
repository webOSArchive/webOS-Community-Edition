// Factor out the bottom multiselect control-bar from AlbumMode.
enyo.kind({ 
	name: 'AlbumModeMultiselectControls',
	kind: 'Control',
	events: {
		onGetSelection: 'getSelection',
		onGetCurrentAlbum: 'getCurrentAlbum',
		onHideMultiselectControls: ''
	},
	className: 'MultiselectControls MultiselectBottom MultiselectHideBottom',
	components: [{ kind: 'HFlexBox', components: [
		// Layout the buttons for share/copy/print/delete operations.
		{ flex: 1 },
		//{ name: 'shareButton', kind: 'Button', className: 'photos button', style: 'margin: 0 4px 0 4px', caption: ' ', onclick: 'clickShare', components:[
		//	{kind: 'Image', src: 'images/icn-share-contact.png'}
		//]},
		{ name: 'copyButton', kind: 'ToolButton',icon: 'images/icn-add-album.png', onclick: 'openAddToAlbumPopup'
		},
		//{ name: 'copyButton', kind: 'Button', className: 'photos button', style: 'margin: 0 0px 0 0px', caption: ' ', onclick: 'openAddToAlbumPopup', components:[
		//	{kind: 'Image', src: 'images/icn-add-album.png'}
		//]},
		// { name: 'printButton', kind: 'Button', className: 'photos button', style: 'margin: 0 55px 0 0px', caption: ' ', onclick: 'clickPrint',components:[
		//	{kind: 'Image', src: 'images/icn-print.png'}
		//]},
		{ name: 'deleteButton', kind: 'ToolButton',icon: 'images/icn-trash.png', onclick: 'openDeletePopup'
		},
		/*	{ name: 'deleteButton', kind: 'Button', className: 'photos button', style: 'margin: 0 0px 0 55px', caption: ' ', onclick: 'openDeletePopup', components:[
				{kind: 'Image', src: 'images/icn-trash.png'}
			]},*/
		{ flex: 1 },
		// Service-ref to perform the specified operations on the selected photos/videos.
		{ kind: 'PalmService', service: 'palm://com.palm.service.photos/', onFailure: 'multiselectActionFailure', components: [
			// Add the specified photos into the target album.  Almost the same as the "newAlbumService", except
			// that a target album must be specified (since none is being created), and the specs may additionally
			// have an optional "targetAlbum" that overrides the default one.
			//		targetAlbum: _id of album to add photos to
			//		specs: array of { sourceAlbum: _id, 
			//								targetAlbum: (optional), 
			//								photos: [_id1, _id2, etc], 
			//								exclude: (optional, default: false) }
			{ name: 'addPhotosService', method: 'addPhotos', onSuccess: 'addPhotosSuccessResponse' },
			// Delete the specified photos.
			//		album: _id of the album to delete the photos in
			//		photos: array or photo _ids to remove
			//		exclude: optional, 
			{ name: 'deletePhotosService', method: 'deletePhotos', onSuccess: 'deletePhotosSuccessResponse' }
		]},
		// Popup dialogs to confirm/specify/etc. the operation on the selected photos/videos.
		{ name: 'deletePhotosPopup', kind: 'ModalDialog', className:'PhotosPopup_title',caption: $L('Delete'), /* style:'width:300px',*/ components: [
         { name: 'deletePhotosPopupContent', className:'PopupContent',content:$L('Are you sure you want to delete this stuff?') },
         { kind: 'Button', flex: 1, caption: $L('Delete'),onclick: 'clickConfirmDelete', className:'enyo-button-negative' },
         { kind: 'Button', flex: 1, caption: $L('Cancel'), onclick: 'closeDeletePopup' }			
		]},
		{ name: 'okPopup', kind: 'ModalDialog', className:'PhotosPopup_title', caption:$L('my title'), components: [
			// { name: 'okPopupTitle', content: 'my title', style: 'font-size: 18px'},
				{ name: 'okPopupContent', className:'PopupContent', content: 'some content' },
         		{ kind: 'Button', name: 'okButton', flex: 1, caption: $L('Cancel'), onclick: 'closeOkPopup' }
		]},
		{ name: 'createAlbumPopup', kind: 'AlbumCreationPopup', onClose: 'doHideMultiselectControls'},
		{ name: 'addToAlbumPopup', 
			kind: 'AlbumPickerPopup', 
			onSelectAlbum: 'addSelectedPhotosToAlbum',
			onCreateAlbum: 'addSelectedPhotosToNewAlbum'
		}
	]}],
	g11nDeleteVideoTmp: new enyo.g11n.Template($L("Are you sure you want to delete these #{itemCount} videos?")),
	g11nDeleteImageTmp: new enyo.g11n.Template($L("Are you sure you want to delete these #{itemCount} images?")),
	g11nDeleteItemTmp: new enyo.g11n.Template($L("Are you sure you want to delete these #{itemCount} items?")),
	// Open operation-cancel dialog.
	openOkPopup: function(title, content, buttonText) {
		this.$.okPopup.validateComponents();
		this.$.okPopup.setCaption(title);
		// this.$.okPopupTitle.setContent(title);
		this.$.okPopupContent.setContent(content);
		this.$.okButton.setCaption(buttonText);
		this.$.okPopup.openAtCenter();
	},
	closeOkPopup: function() {
		this.$.okPopup.close();
	},
	
	// Enable/disable UI elements, depending on the capabilities of the currently-viewed album's account.
	updateCapabilities: function(album) {
		var accountId = album && album.accountId;
		if (!accountId) {
			// Show everything... what else can we do?
			this.$.deleteButton.show();
			console.error("no accountId available");
			return;
		}
		
		var fn = function(capabilities) {
			if (capabilities && capabilities.deletePhoto) { this.$.deleteButton.show(); }
			else { this.$.deleteButton.hide(); }
		}
		app.$.accounts.$.capabilities.fetchCapabilities(accountId, enyo.bind(this, fn));
	},
	
	// ---------- Add Photos to another album --------------------------------------------
	
	openAddToAlbumPopup: function() {		
		// If nothing is selected, tell the user.	
		var sel = this.doGetSelection();
		var count = sel.totalCount();
		if (count == 0) {
			this.openOkPopup($L('No items selected'), $L('No items selected for adding to album'), $L('OK'));
			console.log('no items are selected');
			return;
		}
		this.$.addToAlbumPopup.openAtCenter();
	},
	addSelectedPhotosToAlbum: function(inSender, dbEntry) {
		var sel = this.doGetSelection();
		app.$.service.addPhotos(dbEntry._id, sel.selectedKeys(), sel.isInverted, this.doGetCurrentAlbum().guid);
		this.$.addToAlbumPopup.close();
		this.doHideMultiselectControls();
	},
	addSelectedPhotosToNewAlbum: function(inSender) {
		// Close the album-selector; we'll quickly replace it with a create-album popup.
		inSender.close();
		
		this.$.addToAlbumPopup.close();
		
		// Create specs to identify photos to immediately add to the new album.
		var sel = this.doGetSelection();
		var specs = [{
			sourceAlbum: this.doGetCurrentAlbum().guid,
			photos: sel.selectedKeys(),
			exclude: sel.isInverted
		}];

		// Open the create-album popup
		this.$.createAlbumPopup.initialPhotoSpecs = specs;
		this.$.createAlbumPopup.openAtCenter();
	},
	addPhotosSuccessResponse: function(inSender, inResponse, inRequest) {
		console.log('successfully added photos to album');
	},
	
	
	// ---------- Delete Photos ----------------------------------------------------------	
	// Open dialog to confirm photo/video deletion.
	openDeletePopup: function() {
		var sel = this.doGetSelection();
		var imCount = sel.imageCount();
		var vidCount = sel.videoCount();
		var totalCount = imCount + vidCount;
		
		var popup = this.$.deletePhotosPopup;
		// Popup is lazy, so must do this before we use any of its components.
		popup.validateComponents();
		
		var popupContent = this.$.deletePhotosPopupContent;

		// If there aren't any
		if (totalCount == 0) {
			this.openOkPopup($L('No items selected'), $L('No items selected for deletion'), $L('OK'));
			return;
		}
		else if (totalCount == 1) {
			if (imCount) {
				popupContent.setContent($L("Are you sure you want to delete this image?"));
			}
			else {
				popupContent.setContent($L("Are you sure you want to delete this video?"));
			}
		}
		else {
			var localizedContent;
			if (imCount === 0) { 
				localizedContent = this.g11nDeleteVideoTmp.evaluate({itemCount: totalCount});
			}
			else if (vidCount === 0) {
				localizedContent = this.g11nDeleteImageTmp.evaluate({itemCount: totalCount});
			}
			else {
				localizedContent = this.g11nDeleteItemTmp.evaluate({itemCount: totalCount});
			}
			popupContent.setContent(localizedContent);
		}
		popup.openAtCenter();
	},
	// User confirmed deletion operation.
	clickConfirmDelete: function() {
		var sel = this.doGetSelection();
		app.$.service.deletePhotos(sel.selectedKeys(), sel.isInverted, this.doGetCurrentAlbum().guid);
		this.closeDeletePopup();
		this.doHideMultiselectControls();
	},
	closeDeletePopup: function() {
		this.$.deletePhotosPopup.close();
	},
	deleteSuccessResponse: function(inSender, inResponse) {
		console.log('Successfully deleted photos/videos: ' + JSON.stringify(inResponse));
	},
	
	// ---------- Misc -------------------------------------------------------------------
	multiselectActionFailure: function(inSender, inResponse) {
		console.log('MULTISELECT ACTION FAILED: ' + JSON.stringify(inResponse));
	}
	

	
	
	
	
	
});