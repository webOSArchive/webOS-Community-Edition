/**
NOTES:
	- webOS CE: the scroller behind Day and Week views' hours.

	enyo.BasicScroller keeps its position in bounds on every "resize" message by
	re-measuring itself (stabilize). While the Edit or Preferences view covers the
	calendar, the calendar is display:none, so it measures as 0px tall and clamps
	scrollTop to 0 -- and resizes do arrive meanwhile (the keyboard opening while
	typing an event's title is one). Back in the calendar, the day had jumped to
	midnight. Skip the re-measure while hidden; the next resize or scroll once the
	calendar is visible again measures it properly.
**/
enyo.kind({
	name: "calendar.HoursScroller",
	kind: enyo.Scroller,

	resizeHandler: function resizeHandler () {
		if (this.hasNode() && !this.node.offsetHeight) {	// Hidden (in a display:none ancestor): nothing real to measure.
			return;
		}
		this.inherited (arguments);
	}
});
