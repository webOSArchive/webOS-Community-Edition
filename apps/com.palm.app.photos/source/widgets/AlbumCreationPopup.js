enyo.kind({
	name: 'AlbumCreationPopup',
	kind: 'ModalDialog',
	caption: $L('New Album'),
	initialPhotoSpecs: null,
	events: {
		onFailure: ''
	},
	components: [
		// Graphical components
		{ kind: 'VFlexBox', components: [
		
			// ********************************************************************************
			// HEY YOU MR. INTERNATIONALIZATION GUY!!! DON'T BOTHER TRANSLATING THIS STUFF YET,
			// THIS IS PLACEHOLDER UI THAT I DON'T YET HAVE VISUAL DESIGNS FOR, SO THE WORDING
			// IS LIKELY INCORRECT.  
			// ********************************************************************************
			//{ name: 'title', content: $L('New Album'), style: 'height: 50px; font-size: 20px' },
			{ name: 'input', kind: 'Input', hint: $L('Enter album name'), onchange: 'inputChange', onkeydown: 'keypress', style: 'margin: 10px 0 10px 0;' },
			{ name: 'createAlbumButton', kind: 'Button', className: 'enyo-button-dark', caption: $L('Create Album'), onclick: 'createAlbum' },
			{ name: 'cancelButton', kind: 'Button', caption: $L('Cancel'), onclick: 'close' }
		]}
	],
	createAlbum: function() {
		var input = this.$.input;
		var albumName = input.getValue();
		if (!this.isValidAlbumName(albumName)) {
			// I don't think that you really want an album with no name.
			input.applyStyle('background-color', '#911');
			window.setTimeout(function() { input.applyStyle('background-color', '#CCE'); }, 2000);
			input.forceFocus();
			return;
		}
		// Create new local album with no initial pictures.
		app.$.service.createAlbum(albumName, 'local', this.initialPhotoSpecs);
		this.close();
	},
	isValidAlbumName: function(aString) {
		// XXXXX FIXME: obviously not good enough
		return aString !== '';
	},
	keypress: function(inSender, inEvent) {
		if (event.keyCode == 13) {
			this.createAlbum();
			return true;
		}
	},
	open: function() {
		this.inherited(arguments);
		this.$.input.forceFocus();
	},
	close: function() {
		this.inherited(arguments);
		if (this.$.input) { // Guard against calls before lazy-initialization
			this.$.input.setValue(''); 
			this.$.input.forceBlur();
		}
	}
});
