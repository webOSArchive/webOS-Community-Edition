
var PowerUser = function(name) {
	enyo.application.powerSeq = (enyo.application.powerSeq || 0) + 1;
	this.id = "com.palm.app.email." + name + "-" + enyo.application.powerSeq;
	this.started = false;
	
	return this;
};

PowerUser.prototype = {
	start: function(durationMs) {
		this.started = true;
	
		this._startRequest = EmailApp.Util.callService("palm://com.palm.power/com/palm/power/activityStart",
			{id: this.id, duration_ms: durationMs}
		);
	},
	
	stop: function() {
		if (this.started) {
			this._stopRequest = EmailApp.Util.callService("palm://com.palm.power/com/palm/power/activityEnd",
				{id: this.id}
			);
			this.started = false;
		}
	}
};
