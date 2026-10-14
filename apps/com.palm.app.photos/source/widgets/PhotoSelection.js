// enyo.selection doesn't do quite what I need.
// XXXXX Limitations!
// - isSelected() may "erroneously" answer true when this.inverted... it has no way of
//   checking whether the value is valid.
// - has no way of knowing that an entry has been removed from the DB.  The grid might
//   notice that the album photo-count has been reduced by one and call setTotalImageAndVideoCount(),
//   but there's no good way to tell whether the deleted entry is a selected one, since we don't
//   even know which entry was deleted (maybe we could add this to the service, but we have no plans),
//   or (in the this.inverted case) explicitly know which entries are actually selected.
enyo.kind({
	name: 'PhotoSelection',
	kind: enyo.Component,
	events: {
		onChange: '',
	},
	// Private variables
	_imageCount: 0, // total number of internally-selected images (i.e. inversion not accounted for)
	_videoCount: 0, // total number of internally-selected videos (i.e. inversion not accounted for)
	_totalImages: 0, // total number of images in the album
	_totalVideos: 0, // total number of videos in the album
	// Initialize a new selection.
	create: function() {
		this.entries = {};
		this.isInverted = false;
		this.inherited(arguments);
	},
	// Set the total number of images/videos in the potentially-selectable set...
	// these are used to compute the actual number of selected images/videos from
	// the user's POV.
	setTotalImageAndVideoCount: function(totalImages, totalVideos) {
		if (this._totalImages === totalImages && this._totalVideos === totalVideos) return;  // no change
		this._totalImages = totalImages;
		this._totalVideos = totalVideos;
		
		// If we're inverted and the total number of photos/videos changes,
		// that implies that the total number of selected photos/videos has
		// changed (since the total set of explicitly-unselected photos/videos
		// has not changed).
		if (this.isInverted) this.doChange();
	},
	// Answer the number of selected images.
	imageCount: function() {
		return this.isInverted
					? this._totalImages - this._imageCount
					: this._imageCount;
	},
	// Answer the number of selected videos.
	videoCount: function() {
		return this.isInverted
					? this._totalVideos - this._videoCount
					: this._videoCount;
	},
	// Answer the total number of all selected items.
	totalCount: function() {
		return this.imageCount() + this.videoCount();
	},
	// Test whether the specified entry is selected.  Return true or false (not truthy/falsy)
	isSelected: function(dbEntryOrKey) {
		// Determine whether this is a db-entry or the key itself 
		// by whether it has an _id property
		var key = dbEntryOrKey.hasOwnProperty('_id')
						? dbEntryOrKey._id
						: dbEntryOrKey;
		var hasEntry = this.entries[key] || false;
		return this.isInverted 
					? !hasEntry
					: hasEntry && true;
	},
	areAllSelected: function() {
		if (this.imageCount() !== this._totalImages) return false;
		if (this.videoCount() !== this._totalVideos) return false;
		return true
	},
	// Toggle whether the key is selected or not.
	toggle: function(dbEntry) {
		this.isSelected(dbEntry._id) 
			? this.deselect(dbEntry) 
			: this.select(dbEntry);
	},
	// Select the specified key.  If already selected, don't signal doChange().
	select: function(dbEntry) {
		this.isInverted
			? this._removeEntry(dbEntry)
			: this._addEntry(dbEntry);
	},
	// De-select the specified key.  If already deselected, don't signal doChange().
	deselect: function(dbEntry) {
		this.isInverted
			? this._addEntry(dbEntry)
			: this._removeEntry(dbEntry);
	},
	// Select all photos... we do this by clearing / inverting the selection.
	selectAll : function() {
		if (this.imageCount() === this._totalImages && this.videoCount() === this._totalVideos) return; // all are already selected
		this.isInverted = true;
		this._imageCount = this._videoCount = 0;
		this.entries = {};
		this.doChange();
	},
	// De-select all photos... we do this by clearing / inverting the selection.
	selectNone : function() {
		if (this.imageCount() === 0 && this.videoCount() === 0) return; // none are already selected
		this.isInverted = false;
		this._imageCount = this._videoCount = 0;
		this.entries = {};
		this.doChange();
	},
	// Private.  After accounting for inversion-status, we've determined that 
	// the entry must be added to our internal selection-set.	
	_addEntry: function(dbEntry) {
		if (this.entries[dbEntry._id]) return; // already exists
		this.entries[dbEntry._id] = dbEntry;
		this._adjustCount(1, dbEntry.mediaType || 'image'); // XXXXX bulletproofing shouldn't be necessary
	},
	// Private.  After accounting for inversion-status, we've determined that 
	// the entry must be removed from our internal selection-set.
	_removeEntry: function(dbEntry) {
		if (!this.entries[dbEntry._id]) return; // nothing to remove
		delete this.entries[dbEntry._id];
		this._adjustCount(-1, dbEntry.mediaType || 'image'); // XXXXX bulletproofing shouldn't be necessary
	},
	// Private. Called by _addEntry() and _removeEntry() only when we know that something has changed.
	_adjustCount : function(amount, mediaType) {
		this['_' + mediaType + 'Count'] += amount;
		this.doChange();
	},
	// Answer the keys of all currently-selected objects.
	selectedKeys: function() {
		var array = [];
		for (key in this.entries) array.push(key);
		return array;
	}
});

