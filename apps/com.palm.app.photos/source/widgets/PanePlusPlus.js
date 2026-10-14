// Improves on Pane in various ways.
enyo.kind({
	name: "PanePlusPlus",
	kind: enyo.Pane,
	resizeHandler: function() {
		for (var i=0, cs=this.controls, c; c=cs[i]; i++) {
			// Only broadcast resize message to:
			// - non-view controls, if any
			// - the current view
			if (!this.controlIsView(c) || c == this.view) {
				c.broadcastMessage("resize");
			}
		}
	}
});

