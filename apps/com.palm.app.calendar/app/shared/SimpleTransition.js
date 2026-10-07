//* @public
/**
	This transition performs as we would expect enyo's Simple transition to work with
	panes, an effectively serves as a drop-in replacement for the Fade transition.
*/

enyo.kind({
	name: "calendar.SimpleTransition",
	//* @protected
	kind: enyo.Component,
	viewChanged: function(inFromView, inToView) {
		this.fromView = inFromView;
		this.toView = inToView;
		this.begin();
	},
	isTransitioningView: function(inView) {
		return (inView == this.fromView) || (inView == this.toView);
	},
	begin: function() {
//		This part from Simple transition is what causes the problem.
//		var t1 = this.pane.transitioneeForView(this.fromView);
//		if (t1) {
//			t1.hide();
//		}
//		var t2 = this.pane.transitioneeForView(this.toView);
//		if (t2) {
//			t2.show();
//		}
		this.done();
	},
	done: function() {
		this.pane.transitionDone(this.fromView, this.toView);
	}
});