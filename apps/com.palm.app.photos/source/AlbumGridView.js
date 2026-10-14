enyo.kind({
	name: 'AlbumGridViewCell',
	kind: enyo.Control,
	className: 'AlbumGridThumb',
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
		{ kind: 'Image',
			className: 'AlbumGridThumbImg',
			onclick: "doCellClick",
			onmousehold: "doCellMouseHold",
			onmouserelease: "doCellMouseRelease",
			ondragstart: "doCellDragStart",
			ondrag: "doCellDrag",
			ondragfinish: "doCellDragFinish",
			onerror: "handleError"
		},
		{ kind: 'VideoSymbolBar',
			onBarClick: "doCellClick",  // just use the event that Simon made
			onmousehold: "doCellMouseHold",
			onmouserelease: "doCellMouseRelease",
			ondragstart: "doCellDragStart",
			ondrag: "doCellDrag",
			ondragfinish: "doCellDragFinish"
		}
	],
	handleError: function(inSender, inEvent) {
		// Fast hack to get the DB-entry for the image that couldn't load.
		// This is *possibly* due to a zero-length file, which can happen
		// if eg: the device is hard-rebooted after the MojoDB entry has
		// been synced, but before the generated thumbnail files have
		// been synced (we don't explicitly fsync 'em)
		var grid = this.owner.owner.$.grid;
		var idx = inEvent.rowIndex * grid.columnCount + inSender.owner.idx;
		var entry = grid.$.list.$.dbPages.fetch(idx);
		if (!entry) {
			console.warn("could not find DB-entry to retry thumbnail generation");
			return;
		}
		app.$.service.retryThumbnailGeneration(entry._id);
	}
});

enyo.kind({
	name: 'AlbumGridView',
	kind: enyo.VFlexBox,
	events: {
		onPictureSelected: '',
		onSelectionChanged: '',
		onAlbumPictureCountChanged: '',
		onAlbumModifiedTimeChanged: '',
		onAlbumTitleChanged: ''
	},
	published: {
		debugging: true,
		selecting: false,
	},
	photoCount: 0,
	videoCount: 0,
	queryCount: 0,
	cellMargin: "0px",
	components: [
		{name: 'db',
			kind: 'DbService',
			method: 'find',
			dbKind: 'com.palm.media.types:1',
			subscribe: true,
			onSuccess: 'dbResponse',
			onFailure: 'dbFailure',
			onWatch: 'dbWatch',
			reCallWatches: true
		},
		{flex: 1,
			name: 'grid',
			kind: 'DbGrid',
			desc: true, // newest first
			className: 'list',
			rowSpec: { kind: "Flyweight", layoutKind: "HLayout" },
			onQuery: 'dbQuery',
			onCreateCell: 'gridCreateCell',
			onSetupCell: 'gridSetupCell',
			onCellClick: 'gridCellClick',
			manualEventHandlerSetup: true,
// WILL BE USED FOR DRAG'N'DROP
//			onCellDragStart: 'gridCellDragStart',
//			onCellDrag: 'gridCellDrag',
//			onCellDragFinish: 'gridCellDragFinish',
//			onCellMouseHold: 'gridCellMouseHold',
//			onCellMouseRelease: 'gridCellMouseRelease',
		},
		{name: 'selection', kind: 'PhotoSelection', onChange: 'selectionChanged'}
	],
	create: function() {
		this.inherited(arguments);

		this.$.db.mockDataProvider = function (req) {
			return enyo.mock.photos.albumIdToUri[req.params.query.where[0].val];
		};

		// Register this AlbumView to receive notifications of changes in the Album.
		this.createComponent({ kind: "ModelViewer", model: this.album.$.albumViews });
		this.$.selection.setTotalImageAndVideoCount(this.album.photoCount, this.album.videoCount);
	},
	resizeHandler: function() {
		this.resize();
		this.inherited(arguments);
	},
	// Used when changing number of grid-columns.  The goal is to find the
	// row-index in the updated grid that is "most like" the original row.
	// The similarity metric is how many items in the original row show up
	// in the new row.  For example, when switching from 3 columns to 4:
	// - row 0 maps to row 0
	//   - consists of items [0,1,2], all of which are in row 0
	//     of the 4-column grid
	// - row 1 maps to row 1
	//   - consists of items [3,4,5].  In the 4-column grid, [3] is subset
	//     of row 0, and [4,5] is subset of row 1, so row 1 "wins"
	// - row 2 also maps to row 1
	//   - consists of items [6,7,8].  In the 4-column grid, [6,7] is subset
	//     of row 1, and [8] is subset of row 2, so row 1 "wins" again.
	matchRowToNewColumnCount: function(rowInd, oldCols, newCols) {
		if (oldCols <= 0 || newCols <= 0) throw new Error("column-count must be greater than zero");

		var oldRow = this.rowValuesForColumnCount(rowInd, oldCols);
		var counts = {};
		var maxCount = 0;
		var maxCountInd;
		var that = this;
		oldRow.forEach(function(itemInd) {
			var ind = that.rowIndexForColumnCount(itemInd, newCols);
			if (!counts[ind]) counts[ind] = 0;
			if (++counts[ind] > maxCount) {
				maxCount++; // can only be one greater than before
				maxCountInd = ind;

				console.log("######      " + itemInd + " maps to " + maxCountInd + "   " + maxCount + " times");
			}
		});
		return maxCountInd;
	},
	// Figure out the linear indices for all values in the specified row
	// of a row-major grid.
	rowValuesForColumnCount: function(rowInd, colCount) {
		var i,vals = [];
		for (i=0; i<colCount; i++) { vals.push(rowInd*colCount+i); }
		return vals;
	},
	// Given an linear index in a row-major grid of the specified column
	// count, determine which row that item falls in.
	rowIndexForColumnCount: function(itemInd, colCount) {
		return Math.floor(itemInd / colCount);
	},
	resize: function() {
		var columnCountChanged = this.adjustColumnCount();
		if (columnCountChanged) {
			this.$.grid.reset();

			// XXXXX FIX THIS HACK.  This needs to happen after the reset(), or
			// else the scroll-position will be incorrect.  The hack is that we
			// stash this.scrollPosition in adjustColumnCount(); this is just messy.
			// The easiest way is to just roll everything, including the reset()
			// above, into adjustColumnCount().  Then, test if the grid has been
			// rendered yet... if not, don't reset/set-scroll-position.
			var scroller = this.$.grid.getScroller();
			scroller.$.scroll.setScrollPosition(this.scrollPosition);
			scroller.scroll();
		}
	},
	// Update the number of columns based on our current size.  Return true
	// if the number of columns changed, and false otherwise.  Doesn't trigger
	// a refresh/reset... it's up to someone else to decide if that's appropriate.
	adjustColumnCount: function() {
		var countChanged = false;

		var cellWidth = 240;

		var viewWidth = this.getBounds().width;
		var numColumns = Math.floor(viewWidth / cellWidth);

		// Don't change anything if there is no room for a column.  This might
		// be due to not having bounds because we haven't been rendered yet, or
		// there really might not be enough space for a single column.  Regardless,
		// we don't have a better option that to ignore the attempt.
		if (numColumns === 0) return false;

		// If there is no change in the number of columns, we're done.
		if (numColumns !== this.$.grid.columnCount) {
			countChanged = true;  // how exciting!

			var rowHeight = cellWidth;  // it just is.
			var scroller = this.$.grid.getScroller();
			var math = scroller.$.scroll;
			var extra = math.y % rowHeight; // keep track of partially-scrolled row
			if (extra > 0) { extra -= rowHeight; } // extra always scrolls a bit upward, never downward

			var oldRow = Math.floor(math.y / -rowHeight);
			var newRow = this.matchRowToNewColumnCount(oldRow, this.$.grid.columnCount, numColumns);
			var newY = newRow*-rowHeight + extra;

			this.$.grid.setColumnCount(numColumns);

			// XXXXX FIXME: hacky way to pass info back to resize()
			this.scrollPosition = newY;
		}

		var margin = Math.floor((viewWidth/numColumns - cellWidth) / 2 );
		this.cellMargin = "0 " + margin + "px";

		return countChanged;
	},
	refresh: function() {
		this.$.grid.refresh();
	},
	reset: function() {
		this.$.grid.reset();
	},
	dbQuery: function(inSender, inQuery) {
		console.log('&& album-grid dbQuery(' + ++this.queryCount + '): ' + enyo.json.stringify(inQuery));
		var albumGuid = this.album.guid;

		inQuery.where = [{prop: 'albumId', op: '=', val: albumGuid}, {prop: "appCacheComplete", op: "=", val: true}];
		inQuery.select = ["_id", "appCacheComplete", "appGridThumbnail", "mediaType", "type", "albumId", "duration", "path"];
		inQuery.orderBy = "createdTime";

		return this.$.db.call({query: inQuery}, {queryCount: this.queryCount});
	},
	dbResponse: function(inSender, inResponse, inRequest) {
		console.log('&& album-grid dbResponse(' + inRequest.queryCount +')     count: ' + inResponse.results.length + '  next: ' + inResponse.next );
		this.$.grid.queryResponse(inResponse, inRequest);
    this.log(" ENYO PERF: TRANSITION DONE time: "+ Date.now());
	},
	dbFailure: function(inSender, inResponse) {
		console.log('&& album-grid dbFailure():   ' + enyo.json.stringify(inResponse));
	},
	// Hack suggested by the enyo team to address DFISH-15780.  We end up requerying
	// more data than we need to, as in the common case where a property in a DB-entry
	// changes, but no entries are added/removed.
	dbWatch: function(inSender, inResponse) {
		console.log('&& album-grid dbWatch():   ' + enyo.json.stringify(inResponse));
		this.$.grid.$.list.reset();
	},
	gridCreateCell: function() {
		return { kind: 'AlbumGridViewCell' };
	},
	gridSetupCell: function(inSender, inRow, inColumn, inFlyweight, inRecord) {
//		if (app.currViewMode != app.albumViewMode) {
//			console.log("NOT IN ALBUM MODE WHILE SETTING UP CELL " + inColumn + "," + inRow + "   " + enyo.json.stringify(inRecord));
//		}

		inFlyweight.applyStyle("margin", this.cellMargin);

		var path = inRecord.appGridThumbnail && inRecord.appGridThumbnail.path;
		if (!path) {
			if (inRecord.mediaType == "video") {
				// XXXXX TODO FOR REALZ!!! Need image dimensions for video thumbnail-placeholder.
				// IMPORTANT IMPORTANT IMPORTANT: don't change this file without talking to Josh.
				// Do not think about substituting it for one with different dimensions.
				path = "images/blank-video.png";
			}
			else {
				// This should never happen if appCacheComplete is true.  Don't display this cell.
				console.warn('could not obtain appGridThumbnail for cell (' + inColumn + ',' + inRow + ')');
				return false;
			}
		}

		var img = inFlyweight.$.image;
		img.setSrc(path);
//		var fname = inRecord.path.split("/");
//		fname = fname[fname.length-1];
//		console.log("- @ - @ -  setup cell (" + inColumn + "," + inRow + "):   " + fname);

		// If this cell contains a video-thumbnail, we need to show some extra controls.
		var vidBar = inFlyweight.$.videoSymbolBar;
		if (inRecord.mediaType === "video") {
			vidBar.canGenerate = true;
			vidBar.updateFromDbEntry(inRecord);
		}
		else {
			vidBar.canGenerate = false;
		}

		// Hack in some highlighting.
		if (this.$.selection.isSelected(inRecord._id)) {
			inFlyweight.addClass('MultiselectHighlight');
		}
		else {
			inFlyweight.removeClass('MultiselectHighlight');
		}

		return true;  // show this cell
	},
	gridCellClick: function(inGrid, inSender, row, column, dbEntry) {
		if (!this.selecting) {
			this.doPictureSelected(dbEntry.albumId, dbEntry._id, dbEntry.mediaType, dbEntry.type);
		}
		else {
			// So that we can update just the row containing the cell that we clicked on.
			this.justSelectedCell = {row: row, column: column};
			this.$.selection.toggle(dbEntry);
		}
	},
	gridCellDragStart: function() {
		console.log("HIT gridCellDragStart() !!!");
		return this.selecting;
	},
	gridCellDrag: function() {
		console.log("HIT gridCellDrag() !!!");
		return this.selecting;
	},
	gridCellDragFinish: function() {
		console.log("HIT gridCellDragFinish() !!!");
		return this.selecting;
	},
	gridCellMouseHold: function() {
		console.log("HIT gridCellMouseHold() !!!");
		return this.selecting;
	},
	gridCellMouseRelease: function() {
		console.log("HIT gridCellMouseRelease() !!!");
		return this.selecting;
	},
	// Change whether we're in multiselect mode.
	selectingChanged: function(oldSetting) {
		if (oldSetting === this.selecting) return; // no change
		if (!this.selecting) {
			this.$.selection.selectNone();
		}
	},
	// The set of selected items has changed... update.
	selectionChanged: function() {
		// Try to update a single cell, if possible...
		if (this.justSelectedCell) {
			var row = this.justSelectedCell.row;
			var column = this.justSelectedCell.column;
			this.$.grid.updateCell(row, column);
			this.justSelectedCell = null;
		}
		// ... otherwise fall back to refreshing the whole grid.
		else {
			this.$.grid.refresh();
		}
		this.doSelectionChanged(this.$.selection.totalCount(), this.$.selection);
	},
	// XXXXX FIXME: probably make AlbumGridView a sub-class of AlbumView...
	// it isn't because for a long time AlbumStripView wasn't DB-driven,
	// and notification of picture add/remove was done through AlbumView;
	// AlbumGridView didn't need all of that since it was DB-driven.
	notifyTitleChanged: function(newTitle) { 
		this.doAlbumTitleChanged(newTitle);
	},
	notifyDescriptionChanged: function(newDescription) { },
	notifyPictureCountChanged: function(photoCount, videoCount) {
		this.$.selection.setTotalImageAndVideoCount(photoCount, videoCount);
		this.doAlbumPictureCountChanged(photoCount, videoCount);
	},
	notifyModifiedTimeChanged: function(modTime) {
		this.doAlbumModifiedTimeChanged(modTime);
	}
});

