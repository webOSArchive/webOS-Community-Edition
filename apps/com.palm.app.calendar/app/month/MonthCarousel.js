/**
NOTES:
	-	calendar.MonthCarousel allows interacting with Calendar's Month View as
		either a horizontal or vertical carousel.

TODOs:
	- BUG	: enyo.DomNode.showingChanged() should be called on destroy() as it is on create()!
	- BUG	: enyo.Carousel.fetchView ("center") returns left view after 1st scroll!
	- PLAN	: Change "events" watch type to "cache" since we're watching cache changes.
	- PLAN	: Create base component for Day, Week, and month Carousels to inherit from.
	- ...
**/
enyo.kind({
	name	: "calendar.month.MonthCarousel",
	kind	: enyo.VFlexBox,
	showing	: false,

	published:
	{	calendars	: null	// Object	: For monitoring calendars' on/off states.
	,	currentDate	: null	// Date		: For watching when the current date changes.
	,	events		: null	// Object	: For watching Calendar Events (aka cache updates).
	,	prefs		: null	// Object	: For watching calendar prefs
	},

	G11N:
	{	fmts	: new enyo.g11n.Fmts()
	},
	
	components: [
		{name: "monthCarousel", kind: enyo.VirtualCarousel, flex:1, onSetupView:"setupView", onSnap:"snap", onSnapFinish:"snapFinish", viewControl: {kind: calendar.month.MonthView}}
	],

	constructor: function MonthCarousel () {
		this.MonthDay		= calendar.month.MonthDay;
		this.startOfWeek	= 0;
		this.timeMachine	= new Date();

		this.inherited (arguments);
	},

	create: function create () {
		this.inherited (arguments);
		enyo.application.watch ({ calendars:this, events:this, prefs:this });
	},

	destroy: function destroy () {
		enyo.application.ignore ({ calendars:this, currentDate:this, events:this, prefs: this });	// !!! Ignore currentDate here b/c DomNode.showingChanged() is only called on create() not on destroy() !!!
		this.inherited (arguments);
	},

// BEGIN :-------: Framework Handlers :-----------------------------------------------------------------------------------------------------------------------//

	clickHandler: function monthClicked (from, domEvent) {
		if (from instanceof this.MonthDay) {							// If any part of a MonthDay was clicked
			DEBUG && this.log ("\tMonthDay: [",from.date,"]\t");
			this.monthDayClicked = from.date;
			enyo.application.share		({showView: {data: {view: calendar.day.DayView}}});	//	and switch to DayView.
			return true;
		}
	},
	
	viewSwitchedHandler: function viewSwitchedHandler(viewName){ /*do nothing */},


// BEGIN :-------: Published Property Handlers :--------------------------------------------------------------------------------------------------------------//

	calendarsChanged: function calendarsChanged (oldCalendars) {
		if (this.calendars == oldCalendars) { return; }
		this.MonthDay.prototype.calendars = this.calendars;
	},

	currentDateChanged: function currentDateChanged (oldDate) {
		if (!(this.generated && this.showing)) { return; }				// Avoid GUI updates if not rendered or showing. !!!this.generated is a protected enyo property!!!

		var	currentDate = enyo.application.currentDate;

		DEBUG && this.log ("\tCurrentMonth: [",this.currentMonth,"]\tCurrentDate: [",this.currentDate,"]\t");

		if (!(this.currentMonth && (+this.currentMonth == +currentDate))) {			// If the current month isn't already being displayed:
			!this.currentMonth	&&	(this.currentMonth = new Date());				//	Create the current month if it doesn't exist.
			currentDate			&&	(this.currentMonth.setTime (+currentDate));		//	Update the current month to the actual current date if it exists.
			this.currentMonth.clearTime().setDate (1);								//	Reset the current month's time to midnight of the first month day.

			DEBUG && this.log ("\n\n============ MONTH:",String (this.currentMonth),"============\n\n");

			this.viewsReady = false;												// VirtualCarousel doesn't allow you to pass through any additional parameters to setupView so we have to do this.
			this.$.monthCarousel.renderViews(0);
			this.viewsReady = true;
		}
		else if(this.currentMonth.getDate() != 1){									//  Reset the current month's time to midnight of the first month day.
			this.currentMonth.clearTime().setDate (1);
			enyo.application.currentDate.setTime (+this.currentMonth);				// Immediately update the app's current date to the current month's date.
		}
		this.eventsChanged();	// Fetch events for all of the views.
	},

	eventsChanged: function eventsChanged (oldEvents) {					/*return;*/			// TODO: Optimize for month view querying.
		if (!this.showing || !this.currentMonth) { return; }								// Avoid updating the GUI if it's not visible or currentMonth doesn't exist.
		var	date	= new Date (this.currentMonth || Date.now()).addDays(15).clearTime()
		,	expand	= 46//Math.ceil (((this.visibleWeeks || 6) * 7 * 3) / 2)				// This is half of the total _visible_ days (3 months = 126 days).
		;
		enyo.application.cacheManager.getDays ({ date:date, expand:expand });				// TODO: Center-out querying requerys carousel's left & right views' events.
	},

	prefsChanged: function prefsChanged () {
		var prefs		= this.prefs || enyo.application.prefsManager.prefs
		,	startOfWeek	= prefs && prefs.startOfWeek
		;
		if (isNaN (startOfWeek) || (startOfWeek < 1 || startOfWeek > 7)) {
			this.warn ("Invalid startOfWeek:",startOfWeek,"found in Preferences:",prefs);
			return;									// Invalid startOfWeek so do nothing.
		}
		--startOfWeek;								// Date.getDay() is zero-based, but Calendar prefs startOfWeek is 1-based.

		if (this.startOfWeek == startOfWeek) {
			return;									// Start of week hasn't changed so do nothing.
		}
		this.startOfWeek = startOfWeek;				

		if (!this.currentMonth) { return; }			// No views exist yet since currentDate hasn't been set.

		// Instead of individually updating each view, we call renderViews on the carousel since it does the work needed.
		this.viewsReady = false;
		this.$.monthCarousel.renderViews(0);
		this.viewsReady = true;
		this.eventsChanged();	// Fetch events for all of the views since their cached day events are cleared with the date change (each day gets a new date with day of week changes).
	},

	showingChanged: function showingChanged (wasShowing) {
		this.inherited (arguments);

		var showing = this.showing;
		if (!this.generated) { return; }								// Avoid GUI updates if not rendered. !!!this.generated is a protected enyo property!!!

		var enyoApp = enyo.application;

		this.broadcastMessage ("isActive", [showing]);				// Activate carousel views so they watch/ignore events as needed.
		enyoApp [showing ? "watch" : "ignore"] ({currentDate:this});

		if (!showing && this.currentMonth && enyoApp.autoDate) {
			var	currentDay			= this.monthDayClicked || this.getCurrentDay (this.currentMonth);
			this.monthDayClicked	= null;
			enyoApp.shareCurrentDate ({date:currentDay, wait: true});
		}

		enyoApp.autoDate = true;	// Reset autoDate mode.
	},

// BEGIN :-------: Custom Methods :---------------------------------------------------------------------------------------------------------------------------//

	getCurrentDay: function getCurrentDay (currentDate) {
		if (!currentDate) {
			return new Date(enyo.application.currentDate);
		}
		var	start	= +currentDate
		,	time	= this.timeMachine
		;		
		time.setTime (start);			// Reuse the date instance
		time.addMonths (1);				// Advance to midnight 1 month ahead of currentDate.
		var end = +time;				// Store that timestamp.

		time.setTime (Date.now());		// Reuse the date instance,
		var today = +time.clearTime();	// to create "today".

		// Return today if it occurs in this month:
		return (start <= today && end >= today) ? today : currentDate;
	},

	setupView: function setupView (inSender, inView, inViewIndex) {
		var viewDate	= (new Date(this.currentMonth)).addMonths (inViewIndex)
		,	timeMachine	= this.timeMachine
		,	carousel	= this.$.monthCarousel
		;

		if (this.viewsReady) {

			// Start from middle of month.
			var rangeDate	= (new Date(viewDate)).addDays (15).clearTime();

			// Update currentMonth to the center view.
			this.currentMonth.addMonths (inViewIndex > carousel.viewIndex ? 1 : -1);

			DEBUG && this.log ("\n\n============ MONTH:", String (this.currentMonth),"============\n\n");

			// Immediately update the app's current date to the current month's date.
			enyo.application.currentDate.setTime (+this.currentMonth);

			// Reset the view index.
			carousel.viewIndex = 0;
			enyo.application.cacheManager.getDays ({date:rangeDate, expand:16});	// We may need to do this after setting the date on the view if we switch to synchronous Days shares.
		}

		timeMachine.setTime (viewDate);
		timeMachine.setDate	(1);
		timeMachine.clearTime();

		inView.setRange			({start: +timeMachine, end: +timeMachine.addMonths(1).addSeconds(-1)});
		inView.setStartOfWeek	(this.startOfWeek);
		inView.setDate			(viewDate);

		//this.log("Current View index",inViewIndex, "Carousel view index",this.$.monthCarousel.viewIndex,"Center index",this.$.monthCarousel.centerIndex,"SnapScroll index",this.$.monthCarousel.index);
		return true;
	},

	snap: function snap (carousel) {
	},

	snapFinish: function snapFinish (carousel) {
	}
});
