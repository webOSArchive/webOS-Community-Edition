/*global enyo */

/**
NOTES:
	- WeekView is the visual representation of a week (i.e. 7 days).

	+ WeekCarousel:
		+ WeekView:	<------------ This module.
			- WeekHeader
			- Week AllDay Header
			+ weekdays:
				- DayView (7)
			+ weekhours:
				- DayHour (24)

TODOs:
	- Create base component for Day and Week views to inherit from.
	- 
*/
enyo.kind({
	name		: "calendar.week.WeekView",
	kind		: enyo.VFlexBox,
	className	: "week-view",
	flex		: 1,

	published:
	{	clock	: null		// Date		: For watching time changes.
	,	date	: null		// Date		: This week's date.
	,	days	: null		// Array	: For watching day-formatted Calendar Events.
	,	is24Hr	: undefined	// Boolean	: For accepting 24hr clock mode changes.
	,	prefs	: null		// Object	: For watching Preferences changes (i.e. startOfWeek).
	,	range	: null		// Object	: {start:Number, end:Number}: This week's start and end timestamps.
	,	tzId	: ""		// String	: For watching timezone changes.
	},

	G11N:
	{	Events	: $L("Events:")
	},

	components:	[
		{name:"header", kind:"calendar.week.WeekHeader"},
		{name:"weekHours", className:"week-hours", kind: "calendar.HoursScroller", flex:1, autoHorizontal:false, horizontal:false, vertical:true, components: [	// webOS CE: was enyo.Scroller (see shared/HoursScroller.js)
			{name: "weekContainer", className: "week-container", kind: enyo.Control, components: [
				{name:"allDayContainer", className:"allday-header", kind: enyo.HFlexBox, components: [
					{name:"allDayLabel", className:"label enyo-text-ellipsis events-header"}
				]},
				{name:"hourLabels"	, className:"hours", kind:"calendar.day.DayHours"},
				{name:"week"	, className:"days enyo-fit", kind: HJSFlex, defaultKind:"calendar.day.DayView"}
			]}
		]}
	],

	constructor: function WeekView () {
		this.timeMachine = new Date();	// For calculating date/times without creating new instances.
		this.inherited (arguments);

		!this.commonWatches && (this.commonWatches =
		{	clock		:this
		,	days		:this
		,	is24Hr		:this
		,	prefs		:this
		,	tzId		:this
		});
	},

	create: function create () {
		this.inherited (arguments);

		this.prefsChanged();
		this.is24Hr === undefined && this.setIs24Hr(!enyo.application.fmts.isAmPm());	// If 24Hr isn't set yet, grab the current setting.

		var ui = this.$;
		ui.allDayLabel.setContent (this.G11N.Events);

		this.weekdays = [];

		for (var week=ui.week, i=0; i < 7; i++) {
			this.weekdays[i]  = week.createComponent
			({	flex			: 1
			,	inWeekView		: true
			,	owner			: this
			});
		}
		this.broadcastMessage ("isActive", [true]);
	},

	destroy: function destroy () {
		this.broadcastMessage ("isActive", [false]);
		this.inherited (arguments);
	},

// BEGIN :-------: Custom Handlers :-----------------------------------------------------------------------------------------------------------------------//
	
	becameCurrentPaneHandler: function becameCurrentPaneHandler(isCurrentPane){
		this.$.week && this.$.week.broadcastMessage("becameCurrentPane", [isCurrentPane]);
	},
	
	isActiveHandler: function isActiveHandler (isActive) {
		enyo.application [isActive ? "watch" : "ignore"] (this.commonWatches);
		this.$.week && this.$.week.broadcastMessage ("isActive", [isActive]);
	},

// BEGIN: Published Properties Change Handlers ---------------------------------------------------------------------------------------------------------------//

	clockChanged: function clockChanged (oldClock) {
		this.updateCurrentHour();
	},

	dateChanged: function dateChanged (oldDate) {
		var date = this.date;
		if(!date) {
			return;
		}

		var weekdays = this.weekdays;

		this.$.header && this.$.header.setDate (this.date);

		var timeMachine = this.timeMachine;
		timeMachine.setTime(+this.date);

		for (var i=0; i < 7; i++) {
			weekdays[i].setDate(new Date (timeMachine).addDays (i).clearTime());
		}
		this.updateCurrentHour ({scroll: true});
	},

	daysChanged: function daysChanged (oldDays) {
		var days = this.days;
		if(!days[String(+this.date)]) {					// Skip modifying child days if this week's date isn't present in the days object.
			return;
		}
		var weekdays = this.weekdays;
		for (var i=0; i < 7; i++) {
			weekdays[i].setDays(days);
		}
	},

	is24HrChanged: function is24HrChanged(was24Hr){
		var is24Hr = this.is24Hr = !!this.is24Hr;		// Ensure is24Hr is a boolean value.
		if (was24Hr !== undefined && is24Hr == was24Hr) {		// 24Hr mode was previously defined and still has the same value:
			return;														//	So do nothing.
		}
		this.$.hourLabels.setIs24Hr (is24Hr);
	},

	prefsChanged: function prefsChanged (oldPrefs) {
		var header	= this.$.header
		,	prefs	= this.prefs || enyo.application.prefsManager.prefs
		;
		if (!header || !this.prefs || isNaN (this.prefs.startOfWeek)) {
			return;
		}
		this.date && header.setDate			(this.date);
		header.setStartOfWeek	(this.prefs.startOfWeek - 1);	// Date.getDay() is zero-based, but Calendar prefs startOfWeek is 1-based.
	},

// BEGIN: Custom Methods -------------------------------------------------------------------------------------------------------------------------------------//

	updateCurrentHour: function updateCurrentHour (options) {
		/*	Update the now indicator for the currently displayed day or hide it
			if today is not the currently viewed day.
			options?:	{scroll?:Boolean}
		*/
		if (!this.showing) { return; }

		var	now			= new Date()
		,	weekDate	= +(this.date || +now)
		,	currentHour	= now.getHours()										// Store the actual current hour.
		,	timeMachine	= this.timeMachine
		,	ui			= this.$
		,	hourLabels	= ui.hourLabels.hours
		;

		timeMachine.setTime (weekDate);
		timeMachine.addDays (7).addSeconds (-1);

		now = +now;

		var isToday = now >= weekDate && now <= +timeMachine					// Store whether this week contains today.

		isFinite(this.currentHour) && hourLabels[this.currentHour].setIsCurrentHour (false);	// Clear the now indicator if this week doesn't contain today or the current hour is wrong.
		isToday	&& hourLabels[currentHour].setIsCurrentHour (true);				// If this week contains today, update the now (current hour) indicator.
		this.currentHour = currentHour;

		if (options && options.scroll) {
			/*(currentHour > 0) && (--currentHour); 							// Scroll to the hour before the current hour.
			currentHour = Math.min(currentHour, 17); 							// Can't scroll past 4pm anyway
			var top = 59 * currentHour;
			isFinite(top) && ui.hours.setScrollTop(top);*/
			(currentHour > 0) && (--currentHour);
			currentHour = Math.min(currentHour, 17); 							// Can't scroll past 4pm anyway
			var	top = hourLabels [currentHour].hasNode();
			isFinite (top && (top = top.offsetTop)) && ui.weekHours.setScrollTop (top);			// Scroll to the hour before the current hour.
		}
	}
});
