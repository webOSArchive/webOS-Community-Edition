// Contains 3 classes: AbstractGrid and the two concrete subclasses DbGrid and VirtualGrid.

// Abstract base-class for displaying a scrollable grid.  Has concrete subclasses 
// VirtualGrid and DbGrid.
enyo.kind({
	name: "AbstractGrid",
	kind: "VFlexBox",
	published: {
		columnCount: 4, // number of columns in each row
		rowSpec: { style: "display: -webkit-box; -webkit-box-align: stretch; -webkit-box-pack: justify; -webkit-box-orient: horizontal;" }
	},
	events: {
		/**
		Fires when a cell of a row is rendered.  Similar to 'onSetupRow' in a DbList,
		which this event replaces ('onSetupRow' is never triggered).  Slightly different
		is that the handler returns true if it wants the grid-cell is to be shown, 
		and false otherwise.
		
		inRecord {Object} Object containing row data.
		
		rowIndex {Integer} Index of the row that the cell belongs to.
		
		columnIndex {Integer} Index of the cell within the row.
		
		flyweight {Object} Flyweight created by object-spec in columnCountChanged().
		*/
		onSetupCell: "",
			
		/**
		Fires when a cell is clicked on.
		
		inRecord {Object} Object containing row data.

		rowIndex {Integer} Index of the row that the cell belongs to.

		columnIndex {Integer} Index of the cell within the row.
		*/
		onCellClick: "",
		
		onCellMouseHold: "",
		onCellMouseRelease: "",
		onCellDragStart: "",
		onCellDrag: "",
		onCellDragFinish: "",
		
		/**
		Called when generating the flyweight content for a cell.  The owner should respond
		with a enyo object-spec that will be used to generate the flyweight.  
		*/
		onCreateCell: ""		
	},

	components: [
		// These are expected to be stomped/redeclared by subclass component-specs.  That's OK, this is just here so
		// that you don't wonder what is being referred to when you see "this.$.cells" and "this.$.list" in the code.
		{ name: "list", kind: "Control", components: [
			// Subclasses don't need to explicitly declare a component named "cells"; 
			// instead, this is dynamically created based on the value of the "rowSpec" property...
			// see rowSpecChanged().
			{ name: "cells" }
		]}
	],
	create: function() {
		this.inherited(arguments);

		// XXXXX This should probably be the default for vertically-scrolling VirtualLists...
		// if that happens, this code should be removed.
		this.getScroller().setHorizontal(false);

		this.rowSpecChanged();
		this.columnCountChanged();
	},
	// Recreate the "cells" component that controls layout of the grid cells in a row.
	// It isn't necessary to provide a name for the component; we automatically name
	// it "cells" here.
	rowSpecChanged: function() {
		if (this.$.cells) { this.$.cells.destroy(); }
		this.rowSpec = enyo.clone(this.rowSpec);
		this.rowSpec.name = "cells";
		this.$.list.createComponent(this.rowSpec, {owner: this});
		
		// Don't do this if we haven't rendered yet, eg: in create() 
		if (this.hasNode()) {
			this.refresh();
		}
	},
	columnCountChanged: function(oldColumnCount) {
		if (this.columnCount === oldColumnCount) return; // no change
		
		// Destroy existing cells.  The setNode() is necessary, because otherwise destroying the 
		// flyweight-row will also destroy the DOM-node currently associated with it.
		this.$.cells.setNode(null);
		this.$.cells.destroyControls();
		this.cells = [];

		// Sometimes the user doesn't want event-handling to happen on the
		// outermost cell-control.  They can use the 'manualEventHandlerSetup'
		// property to do themselves.  In this case, they are responsible for
		// doing the following to each sub-control that they want to handle
		// events:
		//   - setting the 'idx' property
		//   - setting up onclick/onmousehold/etc. handlers for each
		//     event to be handled.  The handlers must use the correct
		//     handler-name (eg: cellClick/cellMouseHold/etc.)
		var mixin;
		if (this.manualEventHandlerSetup) { mixin = { owner: this } }
		else {
			mixin = {
				owner: this,
				onclick: "_signalCellClick",
				onmousehold: "_signalCellMouseHold",
				onmouserelease: "_signalCellMouseRelease",
				ondragstart: "_signalCellDragStart",
				ondrag: "_signalCellDrag",
				ondragfinish: "_signalCellDragFinish"
			}
		}

		// Create a cell for each column.
		for (var i=0; i<this.columnCount; i++) {
			mixin.idx = i;
			var spec = this.doCreateCell(i);			
			if (!spec) {
				// If our owner didn't generate a flyweight-spec, then generate our own placeholder.
				spec = {name: "cellFlyweight"+i, contents: 'CELL', style: 'height: 50px; width: 100px; background-color: yellow;', idx: i};
			}			
			
			var c = this.$.cells.createComponent(spec, mixin);
			this.cells.push(c);
		}
		
		// Don't reset if we haven't even rendered the first time.
		// If we don't have this test, the grid will often show up 
		// blank until scrolled, and then will often not start in 
		// the desired initial position (i.e. at the top).
		if (this.hasNode()) {
			this.refreshAfterColumnCountChanged();
		}
	},
	// Hook for overridin'
	refreshAfterColumnCountChanged: function() {
		this.refresh();
	},
	// 
	_setupGridRow: function(inSender, rowIndex) {
		var showRow = false;
		var colIndex, cell;
		for (colIndex = 0; cell=this.cells[colIndex]; colIndex++) {			
			// Set up the cell.  Subclass responsibility.
			var showCell = this._setupCell(rowIndex, colIndex, cell);
			// Show the cell or hide it.
			cell.applyStyle("visibility", showCell ? "visible" : "hidden");
			// If any cells in the row are to be shown, then the row must be shown.
			if (showCell) { showRow = true; }
		}
		// If no cells were shown in the whole row, don't bother showing the row.
		this.$.cells.canGenerate = showRow; // probably unnecessary; returning false should be enough		
		return showRow;
	},
	/**
	Called to set up the contents of the specified cell.  Returns true if the cell
	is to be displayed, and false otherwise (eg: when there isn't enough data to
	fill the entire row.
	*/
	_setupCell: function(rowIndex, colIndex, cell) {
		throw new Error("must implement in subclass");
	},
	/**
	Hack... some users of this kind need access our list's inner scroller.
	Cannot implement here, because the "component nesting path" of the scroller
	will be different depending on whether we encapsulate a DbList or a VirtualList.
	*/
	getScroller: function() {
		throw new Error("must implement in subclass");
	},
	refresh: function() {
		this.$.list.refresh();
	},
	punt: function() {
		this.$.list.punt();
	},
	reset: function() {
		// If we're running in the browser, just do a refresh, since subsequent DB queries
		// aren't set up to provide the right mock data.
		var grid = this.$.grid;
		if (!window.PalmSystem) { this.refresh(); }
		else { this.$.list.reset(); }
	},
	// Update the whole row containing the cell.  This isn't perfect,
	// but it sure beats refreshing the whole grid.
	updateCell: function(row, column) {
		this.$.list.updateRow(row);
	},
	// Indirection to allow subclasses to modify the list of event-arguments.
	_signalCellEvent: function(eventName, inSender, inEvent, inRowIndex) {
		return this["doCell" + eventName].call(this, inSender, inEvent.rowIndex, inSender.idx);
	},
	_signalCellClick: function(inSender, inEvent) {
		return this._signalCellEvent("Click", inSender, inEvent);
	},
	_signalCellMouseHold: function(inSender, inEvent) {
		return this._signalCellEvent("MouseHold", inSender, inEvent);
	},
	_signalCellMouseRelease: function(inSender, inEvent) {
		return this._signalCellEvent("MouseRelease", inSender, inEvent);
	},
	_signalCellDragStart: function(inSender, inEvent) {
		return this._signalCellEvent("DragStart", inSender, inEvent);
	},
	_signalCellDrag: function(inSender, inEvent) {
		return this._signalCellEvent("Drag", inSender, inEvent);
	},
	_signalCellDragFinish: function(inSender, inEvent) {
		return this._signalCellEvent("DragFinish", inSender, inEvent);
	}
});


// Subclass of DbList that overrides a teensy-tiny bit of code that was breaking DbGrid.
enyo.kind({
	name: "DbGridList",
	kind: "DbList",
	setupRow: function(inSender, inIndex) {
		// Let grid decide whether to generate row.
		return this.doSetupRow(null, inIndex);
	},
	refresh: function() {
		console.log("- @ - @ -  refresh()");
		this.inherited(arguments);
	},
	reset: function() {
		console.log("- @ - @ -  reset()");		
		this.inherited(arguments);
	}
});


// Concrete subclass that obtains the grid-data from a DB-query, much like DbList.
enyo.kind({
	name: "DbGrid",
	kind: "AbstractGrid",
	published: {
		pageSize: 20,
		desc: false,
	},
	events: {
		onQuery: ""
	},
	components: [
		{ name: "list",
			kind: "DbGridList", 
			flex: 1,
			onQuery: "doQuery",
			onSetupRow: "_setupGridRow",
		}
	],
	create: function() {
		this.inherited(arguments);
		this.descChanged();
	},
	/**
	Hack... some users of this kind need access our list's inner scroller.
	*/
	getScroller: function() {
		return this.$.list.$.scroller;
	},
	queryResponse: function(inResponse, inRequest) {
		this.$.list.queryResponse(inResponse, inRequest);
	},
	_setupCell: function(rowIndex, colIndex, cell) {
		// Obtain the DB-entry corresponding to the specified cell, if available.
		var idx = (rowIndex * this.columnCount) + colIndex;
		var dbEntry = this.$.list.$.dbPages.fetch(idx);
		// If the entry isn't available, return false (there is nothing to show
		// in the cell).  Otherwise, delegate cell-setup to our owner.
		return !!dbEntry && this.doSetupCell(rowIndex, colIndex, cell, dbEntry);
	},
	// We don't care about the dbEntry given to us by the dbList; it is wrong
	// because we need multiple entries per row, not just one.  Throw it away
	// and call the superclass implementation.
	_setupGridRow: function(inSender, dbEntry, rowIndex) {
		return this.inherited(arguments, [inSender, rowIndex]);
	},
	// Basically just like the superclass imnplementation, except that we
	// appen the DB-entry to the list of event arguments.
	_signalCellEvent: function(eventName, inSender, inEvent, inRowIndex) {
		var idx = inEvent.rowIndex * this.columnCount + inSender.idx;
		var entry = this.$.list.fetch(idx);
		if (!entry) {
			// Just for debugging.
			console.warn("No db-entry found for " + eventName + " on cell(" + inSender.idx + "," + inEvent.rowIndex + ")");
			return false;
		}
		return this["doCell" + eventName].call(this, inSender, inEvent.rowIndex, inSender.idx, entry);
	},
// ***** We don't need to implement this ourself, but we do need to mess with the
// page-size of ouur list.  However, we don't have as much control over this as
// we used to (when we subclassed from DbList), so I'm not sure what the plan is.
	pageSizeChanged: function() {
		this.$.list.setPageSize(this.pageSize);
		// ***** in the DbList implementation, there's no column-count to multiply by.
		this.$.list.$.dbPages.size = this.pageSize * this.columnCount; 
	},
	descChanged: function() {
		this.$.list.setDesc(this.desc);
	},
	// XXXXX TODO: allow number of columns to change dynamically.  I believe that
	// trouble will result from messing with this.$.dbPages.size if the db-pages 
	// already have data, and I'm not addressing this.
	columnCountChanged: function(oldColumnCount) {
		this.$.list.$.dbPages.size = this.pageSize * this.columnCount;
		this.inherited(arguments);
	},
	refreshAfterColumnCountChanged: function() {
		// DbPages doesn't take kindly to resetting it's page size... reset it.
		this.reset();
	}
});
	
	
// Concrete subclass that obtains the grid-data directly from the owner-component,
// much like VirtualList.	
enyo.kind({
	name: "VirtualGrid",
	kind: "AbstractGrid",
	events: {
		onAcquirePage: "",
		onDiscardPage: ""
	},
	components: [
		{ name: "list",
			kind: "VirtualList",
			flex: 1,
			onSetupRow: "_setupGridRow",
			onAcquirePage: "doAcquirePage",
			onDiscardPage: "doDiscardPage",
		}
	],
	_setupCell: function(rowIndex, colIndex, cell) {
		// Delegate cell-setup to owner.
		return this.doSetupCell(rowIndex, colIndex, cell);
	},
	/**
	Hack... some users of this kind need access our list's inner scroller.
	*/
	getScroller: function() {
		return this.$.list.$.scroller;
	},
});
	
	