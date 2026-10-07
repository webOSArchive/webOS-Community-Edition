
/**
NOTES:
	- calendar.day.AllDayEvent is the Calendar app's GUI representation of all-day calendar events.

TODOs:
	- ...
**/
enyo.kind({
	name		: "calendar.day.AllDayEvent",
	className	: "allday-event",
	kind		: "calendar.EventView",

	components: [
		{name:"text", className:"text ellipsis", layoutKind: enyo.HLayout}
	],

	create: function create () {
		this.inherited (arguments);
	},

	destroy: function destroy () {
		this.inherited (arguments);
	},

	clickHandler: function allDayEventClicked (from, domEvent) {
		enyo.application.share ({showEvent: {data: this}});
		return true;
	},
	
	mousedownHandler: function (from, domEvent) {
		this.addClass ("held");
	},
	
	mouseupHandler: function (from, domEvent){
		this.removeClass ("held");
	},
	
	dragstartHandler: function(inSender, inEvent) {
		this.removeClass ("held");
	},

	eventChanged: function allDayEventChanged (oldEvent) {
		this.event && this.$.text.setContent (this.event.subject || $L("No Subject"));
		this.inherited (arguments);
	}
});
