// Allows dudes to request a callback to be triggered after a specified timeout.
// However, if there is already a scheduled callback that has not yet been triggered,
// no new timeout is scheduled (of course, once the callback is triggered, the 
// ThrottledTimeout is again available to schedule another callback).

enyo.kind({
	name: "ThrottledTimeout",
	kind: "Component",
	events: {
		onTimeout: ''
	},
	timeout: null,
	create: function() {
		this.inherited(arguments);
		if (!this.duration) throw new Error('no duration specified');
		
	},
	callback: function() {
		this.timeout = null;
		this.doTimeout();
	},
	schedule: function() {
		if (this.timeout) return;  // timeout already scheduled
		this.timeout = window.setTimeout(enyo.bind(this, 'callback'), this.duration);
	}
});
 	