enyo.kind({
	name: 'AlbumMode',
	kind: enyo.VFlexBox,
	events: {
		onPictureSelected: '', // args are (albumId, pictureId)
		onSlideshowClick: '',
		onAlbumRenamed: ''
	},
	className: 'AlbumMode',
	published: {
		album: null
	},
	showingMultiselect: false,
	components: [
		{ kind: 'PanelHeader', label: $L('Album'), controlAreaStyle: 'gridview-header-controls', onClickLabel: 'editAlbumName', components:[
				{
					kind: "Input",
					name: "albumNameEditable",
					className: "edit-album-name",
					selectAllOnFocus: true,
					showing: false,
					onchange: "albumNameEdited",
					onblur: "hideAlbumNameEditable"
				}
		] },
		{ kind: 'VFlexBox', name: 'gridSpace',  flex: 1, components: [
			{ name: 'emptyAlbum', kind: 'VFlexBox',style:'margin:50px 0 0 75px;',align:'center', components: [
				{ flex: 0.3 },
				{ kind: 'Image', src: 'icon-256x256.png' },
				{ content: $L('Your album is empty.'), style:'margin: 15px 0 40px 0;font-size:1.1em' },
         	{ kind: 'Button', name: 'addPhotosButton', width: '280px', caption: $L('Add Photos'), onclick: 'openFilePicker' , style: 'margin-bottom: 15px;'},
         	{ kind: 'Button', name: 'deleteAlbumButton', width: '280px', caption: $L('Delete Album'),className:'enyo-button-negative', onclick: 'openDeleteConfirmation'},
				{ name: 'deleteAlbumConfirmation', kind: 'ModalDialog', caption: $L('Delete Album'), components: [
					{ style:'font-size:16px', content:$L('Are you sure you want to delete this album?') },
	         	{ kind: 'Button', flex: 1, caption: $L('Delete Album'), onclick: 'deleteCurrentAlbum', className:'enyo-button-negative' },
	         	{ kind: 'Button', flex: 1, caption: $L('Cancel'), onclick: 'closeDeleteConfirmation' }
				]},
				{ flex: 1.0 },
				{ kind: 'FilePicker', allowMultiSelect: true, fileType: ['image', 'video'], onPickFile: 'populateEmptyAlbum' }
			]}
		]},
		{ kind: 'Toolbar', className: 'enyo-toolbar', components: [
			{ kind: "Image", slidingHandler: true, src: "images/drag-handle.png", style: "position: absolute; z-index: 1" },
			{ kind: 'HFlexBox', flex:1, pack:'center', style:'margin:0 -60px 0 30px ;', className: 'collapsed-items', components: [
						{ name: 'lblAlbumDate', content: '', className: 'AlbumSubHeaderText'},
						{ name: 'lblAlbumPhotoCount', content: '', className: 'AlbumSubHeaderText'},
						{ name: 'lblAlbumVideoCount', content: '', className: 'AlbumSubHeaderText'}
			]},
			{ name: 'btnMultiselect',
				kind: 'ToolButton',
				icon: 'images/icn-edit.png',
				style:  'padding:0px;',
				onclick: 'clickMultiselect'
			//	className: 'photos button',
			//	caption: ' ',		
			//	components: [{ kind: 'Image', src: 'images/icn-edit.png' }]
			},
// XXXXX punted for dartfish
//			{ name: 'btnPrint',
//				kind: 'Button',
//				style: 'margin-left:55px',
//				className: 'photos button',
//				caption: ' ',
//				onclick: 'clickPrint',
//				components: [{kind: 'Image', src:'images/icn-print.png' }]
//			},
			{ name: 'btnSlideShow',
				kind: 'ToolButton',
				icon:'images/icn-slideshow.png',
				style: 'margin-left:15px; padding:0px;',
				onclick: 'clickSlideshow',
			//	className: 'photos button',	
			//	caption: ' ',	
			//	components: [{kind: 'Image', src:'images/icn-slideshow.png' }]
			}
		]},
		{ kind: 'Control',
			name: 'topMultiselectControls',
			className: 'MultiselectControls MultiselectTop MultiselectHideTop',
			components: [{ components: [{ kind: 'HFlexBox',pack:'Justify', style:'margin-top:4px;',components: [
				{ kind: 'Button', caption: $L('Cancel'), className: 'enyo-button-blue', style:'margin-left:10px;',onclick: 'hideMultiselectControls'},
				{ flex: 1 },
				{ name: 'multiselectCount', content: $L('0 Selected'),style:'padding:8px;'},
				{ flex: 1 },
				{ name: 'btnSelectAll', kind: 'Button', caption: $L('Select All'), className: 'enyo-button-blue', style:'margin-right:10px;',onclick: 'clickSelectAllOrNone' }

			]}]}]
		},
		{ kind: 'AlbumModeMultiselectControls',
			name: 'bottomMultiselectControls',
			className: 'enyo-toolbar',
			onGetSelection: 'getSelection',
			onGetCurrentAlbum: 'getAlbum',
			onHideMultiselectControls:	'hideMultiselectControls'
		},
		{ name: "msgDialog", kind: "MessageDialog", message: $L("Please download more photos to play slideshow.") }
	],
	grid: null,
	g11nPhotoCount: G11N.template($L('#{num} images'), 'num'),
	g11nVideoCount: G11N.template($L('#{num} videos'), 'num'),
	g11nSelectedCount: G11N.template($L('#{num} Selected'), 'num'),
	g11nDate: new enyo.g11n.DateFmt({date: "long"}),
	create: function()
	{
		this.inherited(arguments);
	},
	albumChanged: function(oldAlbum) {
		var newAlbum = this.album;
		if (newAlbum === oldAlbum) { return; }  // No change

    this.log(" ENYO PERF: TRANSITION START time: "+ Date.now());
		console.log("AlbumMode changed to view album: " + (this.album ? this.album.title + " (" + this.album.guid + ")" : null));

		this.hideMultiselectControls();
		if (this.grid) {
			this.grid.destroy();
			this.grid = null;
		}
		if (newAlbum) {
			this.$.panelHeader.setIconStyle('library-navigation-icon-40x40-' + newAlbum.type);
			this.$.panelHeader.setLabel(newAlbum.title);

			// We also use this as an event-handler, so we need to put something
			// for the first arg... null will do fine.
			this.handleAlbumPictureCountChanged(null, newAlbum.photoCount, newAlbum.videoCount);
			this.handleAlbumDateChanged(null, newAlbum.modifiedTime);

			this.grid = this.createGrid();

			// The render ensures that a DOM-node is created so that resize() knows
			// its bounds so that it can eg: compute the number of columns.
			this.grid.render();
			this.grid.resize();
		}
		else {
			this.$.panelHeader.setIconStyle('library-navigation-icon-40x40-local');
		}
	},
	createGrid: function() {
		var gridViewKind = 'AlbumGridView';

		// I'm developing a new grid-view that implements Ed's new visual-design.
		// However, since Poornima hasn't yet added thumbnail dimensions to the DB,
		// I can only do this in the browser with mock data, and since I'm lazy I've
		// only typed in the thumbnail-dimensions for one album.
		if (!window.PalmSystem && this.album.guid === '++HLSdeoYRKhOpM_') {
			gridViewKind = 'AlbumGridView';
		}

		return this.$.gridSpace.createComponent(
			{
				kind: gridViewKind,
				onPictureSelected: 'doPictureSelected',
				onSelectionChanged: 'handleSelectionChanged',
				onAlbumPictureCountChanged: 'handleAlbumPictureCountChanged',
				onAlbumModifiedTimeChanged: 'handleAlbumDateChanged',
				onAlbumTitleChanged: 'handleAlbumTitleChanged',
				album: this.album,
				flex: 1
			},
			{ owner: this}
		);
	},
	// Called/notified by Album.titleChanged()
	handleAlbumTitleChanged: function(ignore, newAlbumTitle) {
		this.$.panelHeader.setLabel(newAlbumTitle);
	},
	// We get this from the grid-view, but it would probably be more uniform
	// to be notified of it by the Album, as we are for Album title changes...
	// see this.handleAlbumTitleChanged()
	handleAlbumPictureCountChanged: function(inSender, photoCount, videoCount) {
		// Guard against-rare-but possible condition.
		if (!this.album) {
			console.warn("picture count changed, but no current album");
			return;
		}

		// Update text.
		this.$.lblAlbumPhotoCount.setContent(this.g11nPhotoCount(photoCount));
		this.$.lblAlbumVideoCount.setContent(this.g11nVideoCount(videoCount));

		// Special handling if album contains no photos/videos.
		var showing = photoCount + videoCount === 0;
		if (showing) {
			// If we're showing the empty-album screen, then check the current album
			// capabilities to see if we're able to delete the album... if so, show
			// the delete button.
			var btn = this.$.deleteAlbumButton;
			app.$.accounts.$.capabilities.fetchCapabilities(
				this.album.type,
				function(capabilities) { btn.setShowing(capabilities && capabilities.deleteAlbum); }
			);
		}
		this.$.emptyAlbum.setShowing(showing);

		if (this.album.photoCount > 0) {
			this.$.btnSlideShow.show();
		} else {
			this.$.btnSlideShow.hide();
		}
	},
	handleAlbumDateChanged: function(inSender, date) {
		this.$.lblAlbumDate.setContent(this.g11nDate.format(date));
	},
	refresh: function() {
		if (this.grid) this.grid.refresh();
	},
	resize: function() {
		if (this.grid) this.grid.resize();
	},
	// Button has been clicked... either select all images, or deselect them all;
	// the latter only happens when all images are currently selected.
	clickSelectAllOrNone: function() {
		var sel = this.grid.$.selection;
		sel.areAllSelected()
			? sel.selectNone()
			: sel.selectAll();
	},
	// Toggle whether or not we're in multiselect mode.  This involves
	// adding/removing the CSS classes that cause the controls to animate
	// into/off the screen.
	clickMultiselect: function() {
		this.showingMultiselect
			? this.hideMultiselectControls()
			: this.showMultiselectControls();
	},
	showMultiselectControls: function() {
		if (this.showingMultiselect) return;  // already showing

		// Show/hide some of the UI elements.
		this.$.bottomMultiselectControls.updateCapabilities(this.album);

		this.grid.setSelecting(this.showingMultiselect = true);
		this.$.topMultiselectControls.removeClass('MultiselectHideTop');
		this.$.bottomMultiselectControls.removeClass('MultiselectHideBottom');
		this.addClass('AlbumModeMultiselect');
	},
	hideMultiselectControls: function() {
		if (!this.showingMultiselect) return;  // already not showing
		this.grid.setSelecting(this.showingMultiselect = false);
		this.$.topMultiselectControls.addClass('MultiselectHideTop');
		this.$.bottomMultiselectControls.addClass('MultiselectHideBottom');
		this.removeClass('AlbumModeMultiselect');
	},
	// Handle a change in the multi-selection.  Update the displayed selection
	// count, and change the button label to 'Select All' or 'Select None',
	// as appropriate.
	handleSelectionChanged: function(inSender, selectionCount, selection) {
		this.$.multiselectCount.setContent(this.g11nSelectedCount(selectionCount));
		if (selectionCount && selection.areAllSelected()) {
			this.$.btnSelectAll.setContent($L('Select None'));
		}
		else {
			this.$.btnSelectAll.setContent($L('Select All'));
		}
	},
	// Used as an event-handler, so that child components can obtain the current selection without
	// needing a sideways reference to the grid itself.
	getSelection: function() {
		return this.grid.$.selection;
	},
	clickSlideshow: function() {
		if (!this.album) return;
		if (this.album.photoCount <= 0) {
			this.$.msgDialog.openAtCenter();
			return;
		}
		this.doSlideshowClick(this.album.guid);
	},
	// Open dialog to confirm whether the user wishes to delete the current album.
	openDeleteConfirmation: function() {
		this.$.deleteAlbumConfirmation.openAtCenter();
	},
	// Close the delete-confirmation dialog.
	closeDeleteConfirmation: function() {
		this.$.deleteAlbumConfirmation.close();
	},
	// Delete the current album.
	deleteCurrentAlbum: function() {
		if (this.album) {
			app.$.service.deleteAlbum(this.album.guid);
		}
		this.closeDeleteConfirmation();
	},
	// Open the file-picker to add photos/videos to an empty album.
	openFilePicker: function() {
		this.$.filePicker.pickFile();
	},
	handleAlbumTitleChanged: function(inSender,inNewTitle){
		this.$.panelHeader.setLabel(inNewTitle);
	},
	editAlbumName: function () {
		// Ensure that we're allowed to rename this album.
		if (!this.album || !this.album.canBeRenamed()) return;
		
		// if it's not showing, show it!
		if (this.$.albumNameEditable.getShowing() === false) {
			// set the input value to the album's current name and force it's focus
			this.$.albumNameEditable.setValue(this.$.panelHeader.getLabel());
			// show the input text field
			this.$.albumNameEditable.setShowing(true);
			this.$.albumNameEditable.forceFocus();
			// remove the album's name for now
			this.$.panelHeader.setLabel("");
		}
	},
	albumNameEdited: function (inSender, inEvent, inValue) {
		// let everyone know we've renamed the album
		this.$.albumNameEditable.forceBlur();
		this.doAlbumRenamed({albumId: this.album.guid, newName: inValue});
	},
	hideAlbumNameEditable: function (inSender) {
		// set the header back
		this.$.panelHeader.setLabel(this.album.title);

		// hide text field
		this.$.albumNameEditable.setShowing(false);
	},
	populateEmptyAlbum: function(inSender, photoSpecs) {
		if (!this.album) {
			console.error("cannot populate empty album, because there is no album!");
			return;
		}
		var photoIds = photoSpecs.map(function(spec) { return spec.dbId; });
		app.$.service.addPhotos(this.album.guid, photoIds);
	}
});
