enyo.kind({
	name: "BasicFadeScroller",
	//* @protected
	kind: "BasicScroller",
	initComponents: function() {
		this.createChrome([{kind: "ScrollFades"}]);
		this.inherited(arguments);
	},
	scroll: function(inSender) {
		this.inherited(arguments);
		this.$.scrollFades.showHideFades(this);
	}
});

