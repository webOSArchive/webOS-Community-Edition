/**
NOTES:
	- ...

TODOs:
	+ BUG	: enyo.Scroller::destroyComponents destroys .scroll component which then causes errors on .render()!
				- Workaround it by wrapping the .destroyComponents target in a Scroller.
	- PLAN	: Integrate LayoutManager for proper event layout (i.e. adjacency grouping & earliest to left).
	- PLAN	: Scroll day after loading events; if not today scroll to 1 hr. before the earliest event.
	- ...
*/
enyo.kind({
	name		: "calendar.day.DayView",
	className	: "day",
	kind		: enyo.VFlexBox,

	published:
	{	addEvent	: null		// Object	: For watching "add event" requests.
	,	calendars	: null		// Object	: For watching calendar changes
	,	clock		: null		// Date		: For observing clock changes.
	,	date		: null		// Date		: This day's date.
	,	days		: null		// Object	: For watching day-formatted Calendar Events.
	,	inWeekView	: false		// Boolean	: Whether this view is being used within weekView.
	,	is24Hr		: undefined	// Boolean	: For accepting 24hr clock mode changes.
	,	prefs		: null		// Object	: For watching Preferences changes.
	,	tzId		: ""		// String	: For watching timezone changes.
	,	weekRange	: null		// Object	: {start:Number, end:Number}: The start and end of this day's week.
	},

	G11N:
	{	Events			: $L("Events:")
	,	DateFormat	: {
			"short"	: new enyo.g11n.DateFmt ({date: "medium", weekday:true})
		,	full	: new enyo.g11n.DateFmt ({date: "full"})
		}
	,	Today			: $L("Today")
	},

	constructor: function DayView () {
		this.timeMachine	= new Date();				// For calculating date/times without creating new instances.

		this.date			= new Date();				// Creating a date for reuse (instead of using setDate() outside of the view.

		this.inherited (arguments);

		!this.commonWatches && (this.commonWatches =
		{	addEvent	:this		// Object	: For watching "add event" requests.
		,	calendars	:this		// Object	: For watching calendar changes.
		,	tzId		:this		// String	: For watching the system's timezone changes.
		});

		!this.dayWatches && (this.dayWatches =
		{	clock		:this		// Date		: For watching the system clock's time changes.
		,	days		:this		// Array	: For watching event updates formatted "by day".
		,	prefs		:this		// Object	: For watching the application's preferences changes.
		});
	},

	create: function create () {
		this.inherited (arguments);

		this.is24Hr === undefined && this.setIs24Hr(!enyo.application.fmts.isAmPm());	// If 24Hr isn't set yet, grab the default setting.

		this.createEventThen	= enyo.bind (this, this.createEventThen);
		this.updateCurrentHour	= enyo.bind (this, this.updateCurrentHour);
		
		//this.busyFreeManager	= enyo.application.busyFreeManager;
		this.layoutManager		= enyo.application.layoutManager;

		if(!this.inWeekView) {
			this.createComponent
			({name:"header", className:"header", kind:enyo.HFlexBox, components:[
				{name:"dateHeader"		, kind:"calendar.DateHeader", formats:this.G11N.DateFormat, flex:1}
			,	{name:"today"			, className:"today", showing:false}
			]});
		}

		this.createComponent
		({name:"allDayContainer", className:"allday-header", kind: enyo.HFlexBox, showing:false, components: [
			{name:"allDayLabel", className:"label"},
			{kind:enyo.Scroller, name: "allDayScroller", vertical:false, flex:1, components: [
				{name:"allDayHeader", layoutKind: enyo.HLayout, defaultKind:"calendar.day.AllDayEvent", onclick:"createAllDayEvent"}
			]}
		]});

		this.createDay();

		var	ui = this.$;
		this.inWeekView && ui.allDayLabel.destroy();

		if (!this.inWeekView) {									// If not being show as part of Week View:
			ui.today		.setContent (this.G11N.Today);		//		Update the "Today" indicator.
			ui.allDayLabel	.setContent (this.G11N.Events);		//		Show the all-day "Events:" label.
		}

		!this.inWeekView && this.broadcastMessage ("isActive", [true]);	// Already would've been activated by WeekView.
	},

	destroy: function destroy () {
		this.broadcastMessage ("isActive", [false]);
		this.inherited (arguments);
	},

// BEGIN :-------: Framework Handlers :-----------------------------------------------------------------------------------------------------------------------//

	// clickHandler: function dayClicked (from, domEvent) {						// TODO: Support clicking WeekDay to go to DayView.
	// 	this.inWeekView && enyo.application.share ({showView: {data: calendar.day.DayView}});
	// 	return this.inWeekView;
	// },
	
	childrenNeedResizeHandler: function childrenNeedResizeHandler(resizeNeeded){
		this.broadcastMessage("childNeedsResize", [resizeNeeded]);
	},

// BEGIN :-------: Custom Handlers :--------------------------------------------------------------------------------------------------------------------------//

	becameCurrentPaneHandler: function becameCurrentPaneHandler(isCurrentPane){
		this.eventGroup && this.eventGroup.broadcastMessage("becameCurrentPane", [isCurrentPane]);
	},

	isActiveHandler: function isActiveHandler (isActive) {						// BUG: !!! This is being double-called on DayCarousel.destroy()
		var	handle	=	isActive ? "watch" : "ignore";
		DEBUG && this.log (this.date,": ",handle.toUpperCase(),": ",(this.inWeekView ? "weekdayWatches" : "dayWatches")," [",this.name,"]");

		isActive && this.showingChanged();
		this.inWeekViewChanged(this.inWeekView);	// We aren't changing whether we are in week view or not but inWeekViewChanged checks to see if this has changed, so pass in the current variable.

		enyo.application [handle] (this.commonWatches);
		!this.inWeekView && enyo.application [handle] (this.dayWatches);		// Adjust watches based on whether this day is part of WeekView.

		this.$.allDayHeader.broadcastMessage ("isActive", [isActive]);			// Notify all-day events of active state.
	},

	is24HrHandler: function is24HrHandler (is24Hr) {
		this.setIs24Hr (is24Hr);
		!this.inWeekView && this.$.hourLabels.broadcastMessage ("is24Hr", [is24Hr]);			// Pass the message on to the hour labels.
	},
	
// BEGIN :-------: Published Property Handlers :--------------------------------------------------------------------------------------------------------------//

	addEventChanged: function addEventChanged (lastEventAdded) {
		DEBUG && this.log ("Event: ", this.addEvent);

		var	eventDate	= this.timeMachine
		,	event		= this.addEvent && this.addEvent.event
		,	show		= !!(this.addEvent && this.addEvent.show)
		,	start		= event && parseInt (event.dtstart, 10)
		;
		this.addEvent	= null;							// Clear this day's add event request.
		enyo.application.free ({addEvent: true});		// Clear any kept add event data.

		eventDate.setTime (isFinite (start) ? start : (start = Date.now()));
		var hour = eventDate.getHours();

		eventDate.clearTime();
		var start = +eventDate;							// TODO: What about events ending on this day? Handled by EventManager? No...

		if (+start == +this.date) {						// If the event starts on this day:
			this.createEventThen (hour, show, event);	//	create its GUI.
		}
	},

	calendarsChanged: function calendarsChanged(oldCalendars){
		var day = this.day;

		if (!day) {
			return;
		}
		
		var allEvents = [];
		Array.isArray (day.allDayEvents)	&& (allEvents = allEvents.concat (day.allDayEvents));
		Array.isArray (day.hiddenAllDay)	&& (allEvents = allEvents.concat (day.hiddenAllDay));
		Array.isArray (day.events)			&& (allEvents = allEvents.concat (day.events));
		Array.isArray (day.hiddenEvents)	&& (allEvents = allEvents.concat (day.hiddenEvents));
		var events = enyo.application.cacheManager.mapEventsByDate (enyo.application.cacheManager.filterEvents(allEvents, [this.date]));
		this.setDays(events);
	},

	clockChanged: function clockChanged (oldClock) {
		this.updateCurrentHour ({scroll: false});		// Don't scroll when the hour changes; user may want to stay on the specific date and/or time. TODO: Auto-scroll preference?
	},

	dateChanged: function dateChanged (oldDate) {
		var date = this.date;
		if(!date) {
			return;
		}

		this.day = undefined;
		this.eventGroup.setDate(new Date(date));
		this.clearEventDisplay ();

		if(!this.inWeekView) {
			this.$.dateHeader.setDate(new Date(date));
			this.updateCurrentHour ({scroll: true});
		}
	},

	daysChanged: function daysChanged (oldDays) {
		var dateString = String(+this.date)
		,	day = this.days && this.days[dateString] && (this.day = this.days[dateString])
		;

		if (!this.showing || !day) {
			DEBUG &&	this.warn ("\tNo event updates available for: ",this.date,"\t");
			return;
		}
		
		DEBUG &&	this.log ("\tRequest rendering events for day: ",this.date,"...:\n\n\t");//, days, "\n\n\t");
				
		this.layoutManager.positionEvents (day.events, {overlap: true});
		this.updateHours({allDayEvents: day.allDayEvents, events: day.events});
	},
	
	inWeekViewChanged: function inWeekViewChanged (wasInWeekView) {
		this.showing && this.$.allDayContainer && this.$.allDayContainer.setShowing (!!this.inWeekView);	// Always show all-day header if in Week View.

		if (!!wasInWeekView != !!this.inWeekView) {												// If changing "In Week View" state:
			!wasInWeekView && enyo.application.ignore (this.dayWatches);						//	ignore prior state's watches.
		}
	},

	showingChanged: function showingChanged (wasShowing) {
		this.inherited (arguments);
		this.showing && this.updateCurrentHour ({scroll: true});
	},

// BEGIN :-------: Custom Methods :---------------------------------------------------------------------------------------------------------------------------//

	clearEventDisplay: function clearEventDisplay () {
		this.updateHours({allDayEvents: [], events: []});
	},

	createDay: function createDay () {
		var inWeekView		= this.inWeekView
		,	hourContainer	= inWeekView ? {kind: enyo.Control} : {kind: "calendar.HoursScroller", horizontal:false, vertical:true}	// webOS CE: was enyo.Scroller
		,	hoursContainer
		,	is24Hr			= this.is24Hr
		;
		hourContainer.className	= "hours";
		hourContainer.name		= "hours";
		hourContainer.flex		= 1;
		hourContainer			= this.createComponent (hourContainer);

		this.inWeekView && (hoursContainer = hourContainer);

		if (!inWeekView) {
			var	dayContainer	= hourContainer.createComponent	({name: "dayContainer"	, kind: enyo.HFlexBox, className:"day-container"})
			,	hourLabels		= dayContainer.createComponent	({name: "hourLabels"	, kind:"calendar.day.DayHours", owner: this, is24Hr:is24Hr})	// Build hour labels with the retained 24hr setting.
			;
			hoursContainer		= dayContainer.createComponent	({name: "hoursContainer", kind: enyo.Control, style: "height: 1440px; position: relative;", flex: 1});
		}

		this.eventGroup = hoursContainer.createComponent(
		{	kind	: "calendar.day.DayEventGroup"
		,	flex	: 1
		,	style	: "position: relative; height: 1440px;"
		,	owner	: this
		,	edge	: inWeekView ? "none" : "default"
		});
	},

	createAllDayEvent: function createAllDayEvent (from, domEvent) {
		if (!this.createAllDayEvent.then) {
			this.createAllDayEvent.then = enyo.bind (this, this.createEventThen, null, true);
		}
		var	createEvent =
		{	event	: {allDay: true, dtstart: +this.date}
		,	then	: this.createAllDayEvent.then
		};
		enyo.application.share	({createEvent: {data: createEvent}});	// Request event creation.
		return true;
	},

	createEventThen: function createEventThen (hour, show, event) {
		if (!event) {
			this.error ("\tFailed to create event GUI using event [",event,"] and hour [",hour,"].\t");
			return;
		}

		var eventGUI;
		if(event.allDay){
			eventGUI = this.$.allDayHeader.createComponent ({event:event})					//	create an all-day event GUI
		}
		else{
			eventGUI = event;
		}
		show && eventGUI && enyo.application.share ({showEvent: {data: eventGUI}});		// Request showing the event.
	},

	isToday: function isToday (date, today) {
		!date	&& (date	= this.date);
		!today	&& (today	= (this.timeMachine.setTime (Date.now()), this.timeMachine));
		var isToday = !!(date && (+date.clearTime() == +today.clearTime()));
		if (!this.currentIsToday || this.currentIsToday != isToday) {
			var ui = this.$;
			this.currentIsToday = isToday;
			ui.today.setShowing (isToday);
			ui.dateHeader.checkFormatFit();
		}
		return isToday;
	},

	updateCurrentHour: function updateCurrentHour (options) {
		/*	Update the now indicator for the currently displayed day or hide it
			if today is not the currently viewed day.
			options?:	{scroll?:Boolean}
		*/
		if (!this.showing || this.inWeekView || !this.$.today) { return; }
		var	dayDate		= new Date (this.date || Date.now())					// Copy date to avoid external side-effects .
		,	now			= new Date()
		,	currentHour	= now.getHours()										// Store the actual current hour.
		,	isToday		= this.isToday (dayDate, now)							// Store whether this day is today.
		,	ui			= this.$
		,	hourLabels	= ui.hourLabels.hours
		;
		isFinite(this.currentHour) && hourLabels[this.currentHour].setIsCurrentHour (false);					// Clear the now indicator if this isn't today or the current hour is wrong.
		isToday	&& hourLabels[currentHour].setIsCurrentHour (true);				// If this day is today, update the now (current hour) indicator.
		this.currentHour = currentHour;
		
		if (options && options.scroll) {
			(currentHour > 0) && (--currentHour); 								// Scroll to the hour before the current hour.
			currentHour = Math.min(currentHour, 17); 							// Can't scroll past 4pm anyway
			var top = 59 * currentHour;
			isFinite(top) && ui.hours.setScrollTop(top);
		}
	},

//	updateHour: function updateHour (hourInfo) {
//		/* Changes the contents for the DayHour component specified in hourInfo.
//			hourInfo: {hour:Number, dayHour?:DayHour, dayHours?:[DayHour], dayHoursIndex?:Number}
//		*/
//		var	events	= hourInfo && hourInfo.events				// Events starting during the given hour.
//		,	hour	= hourInfo && hourInfo.hour					// Hour to set the component to.
//		,	hours	= hourInfo && hourInfo.dayHours				// Array of DayHour components to change.
//		,	index	= hourInfo && hourInfo.dayHoursIndex		// DayHour index in the DayHour components list.
//		,	dayHour	= Array.isArray (hours) && hours [index]	// DayHour component to change.
//		;
//		!dayHour && (dayHour = hourInfo && hourInfo.dayHour);	// DayHour may have been provided directly.
//
//		if (!(hourInfo && isFinite (hour) && (isFinite (index) || (dayHour instanceof calendar.day.DayHour)))) {
//			this.error ("---:---: Unable to change this day's hour with the invalid hourInfo supplied: ", hourInfo);
//			return;
//		}
//		dayHour.setHour (hour);
//
//		var	date		= new Date()
//		,	hourLabel	= this.$.hourLabels && this.$.hourLabels.hours && this.$.hourLabels.hours [hour]
//		,	prefs		= this.prefs
//		,	endHr		= prefs && isFinite (prefs.endTimeOfDay)	&& date.setTime (prefs.endTimeOfDay)	&& date.getHours()
//		,	startHr		= prefs && isFinite (prefs.startTimeOfDay)	&& date.setTime (prefs.startTimeOfDay)	&& date.getHours()
//		;
//		hourLabel	&& hourLabel.setIsActiveHour (hour >= (startHr || 9) && hour < (endHr || 17));
//		events		&& dayHour.setEvents && dayHour.setEvents (events);
//	},
	
	groupSort: function groupSort(a, b) {
		if(a.group_id < b.group_id){
			return -1;
		}
		if (a.group_id > b.group_id) {
			return 1;
		}
		if(a.group_id == b.group_id){
			if(a.overlap_index < b.overlap_index){
				return -1;
			}
			if(a.overlap_index > b.overlap_index){
				return 1;
			}
			if(a.overlap_index == b.overlap_index){
				if(a.start_decimal < b.start_decimal){
					return -1;
				}
				if(a.start_decimal > b.start_decimal){
					return 1;
				}
				if(a.start_decimal == b.start_decimal){
					if(a.end_decimal < b.end_decimal){
						return 1;
					}
					if(a.end_decimal > b.end_decimal){
						return -1;
					}
				}
			}	
		}
		
		return 0;
	},

	updateHours: function updateHours (events) {
		/* Changes the events displayed in the day's hours:
			events	: Object	: A collection of events mapped by their ids.
		*/	
		if (!events) {
			this.error ("\tUnable to render the day using the invalid events available:\n\n\t", events, "\n\n\t");
			return;
		}
		var	calendar
		,	control
		,	event
		,	allDayHeader		= this.$.allDayHeader
		,	allDayControls		= allDayHeader.getControls()
		,	allDayEvents		= events.allDayEvents
		,	calendars			= this.calendars
		,	controlIndex		= 0
		,	hasRenderContent	= !!allDayHeader.renderContent
		,	numAllDay			= allDayEvents.length
		,	numControls			= allDayControls.length
		,	hidSomething		= false
		;

		// If we already have allDayEvent controls, let's reuse them.
		for (; controlIndex < numControls; ++controlIndex) {
			control	= allDayControls[controlIndex];
			event	= allDayEvents[controlIndex];

			// If we have a control and there is an event to go with it, set the event.  Otherwise, hide the control.
			if (event) {
				if (!event.color && calendars) {	// TODO: We use this logic multiple times, this could probably be done better.
					calendar = calendars [event.calendarId];
					calendar && (event.color = calendar.color);
				}
				DEBUG && this.log ("\tGrouping all-day event (Reusing existing control):\n\n\t", event, "\n\n\t");
				control.setEvent (event);
				control.show();
			} else {
				DEBUG && this.log ("\tHiding all-day event control.\n\n\t");
				control.setEvent(null);
				control.hide();
				hidSomething = true;
			}
		}
		hidSomething && this.$.allDayScroller.setScrollLeft(0);  //reset the scroll position all the way to the left, so we didn't leave the user on a blank area of the scroller
		
		// If we ran out of available controls, build some for the rest of the allDayEvents.
		for (; controlIndex < numAllDay; ++controlIndex) {
			event = allDayEvents[controlIndex];
			if (!event.color && calendars) {
				calendar = calendars [event.calendarId];
				calendar && (event.color = calendar.color);
			}
			DEBUG && this.log ("\tGrouping all-day event (Creating new control):\n\n\t", event, "\n\n\t");
			allDayHeader.createComponent ({event:event});
		}

		(numAllDay > 0) && (hasRenderContent ? allDayHeader.renderContent() : allDayHeader.render());	// renderContent does less work but the enyo team is deprecating it...
		this.$.allDayContainer.setShowing ((numAllDay > 0) || !!this.inWeekView);

		var timedEvents = events.events;
		var numTimed = timedEvents.length;		
		for (var i = 0; i < numTimed; i++) {
			event = timedEvents[i];
			if (calendars) {
				calendar = calendars [event.calendarId];
				calendar && (event.color = calendar.color);
			}
		}
		timedEvents.sort(this.groupSort);
		this.eventGroup.setEvents (timedEvents);
	}
});//End:calendar.day.DayView Kind
