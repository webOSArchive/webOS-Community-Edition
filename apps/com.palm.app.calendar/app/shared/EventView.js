/**
NOTES:
	- calendar.EventView is the Calendar app's Event GUI base kind.

TODOs:
	- ...
**/
enyo.kind({
	name	: "calendar.EventView",
	kind	: enyo.Control,
	showing	: false,

	published:
	{	calendars		: null	// Object			: For watching calendar changes (i.e. color, on/off state)
	,	event			: null	// CalendarEvent	: Calendar event data model.
	,	watchCalendars	: true	// Boolean			: Indicates whether this event should watch calendars changes.
	},

	create: function create () {
		this.inherited (arguments);
		this.event && this.eventChanged();
		this.broadcastMessage ("isActive", [true]);
	},

	destroy: function destroy () {
//		this.addClass ("fade-out");
		this.broadcastMessage ("isActive", [false]);
		this.inherited (arguments);
	},

// BEGIN :-------: Custom Handlers :-----------------------------------------------------------------------------------------------------------------------//

	isActiveHandler: function isActiveHandler (isActive) {
		var handle = isActive && this.watchCalendars ? "watch" : "ignore";
		enyo.application [handle] ({ calendars:this });
	},

// BEGIN :-------: Published Property Handlers :--------------------------------------------------------------------------------------------------------------//

	calendarsChanged: function calendarsChanged (oldCalendars) {
		var event = this.event;
		if (!event) { return; }

		var calendar = this.calendars && this.calendars [event.calendarId];
		if (!calendar) { return; }

		if (("color" in event) && (calendar.color != event.color) || (calendar.color != this.color)) {
			this.removeClass ("theme-" + event.color);
			this.removeClass ("theme-" + this.color);
		}
		if (("color" in calendar)) {
			event.color = this.color = calendar.color;
			this.addClass ("theme-" + event.color);
		}
		(this.showing != calendar.on) && this.setShowing (!!calendar.on);		// Hide/Show this event based on its calendar's state.
	},

	eventChanged: function eventChanged (oldEvent) {
		var event = this.event;
		if (!event) { return; }
//		this.addClass ("fade-in");
		this.calendarsChanged();
		this.setContent (event.subject || $L("No Subject"));	// OK because, enyo.Control.render() overrides with children's content if present.
	}
});
