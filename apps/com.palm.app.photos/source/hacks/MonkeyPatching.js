// Subclass DbList to workaround an issue where the list dissappear.
// Also, we want to know when it's scrolling
enyo.kind({
	name: 'PuntyDbList',
	kind: 'DbList',
	events: {
		onScroll: ""
	},
	initComponents: function() {
		this.inherited(arguments);
		this.$.scroller.onScroll = "doScroll";
	}
});

// Recommended by Steve Orvell to work around DFISH-21938, probably DFISH-23230, 
// and maybe even DFISH-23874 (cross your fingers).
PuntyDbList.prototype._refresh = enyo.DbList.prototype.refresh;
PuntyDbList.prototype.refresh = function() {
	this._refresh();
	if (this.$.scroller.top && this.$.scroller.top > this.$.scroller.bottom) {
		console.warn("detected error state in DbList (" + this.id + ")... punting.");
		this.punt();
	}
};
