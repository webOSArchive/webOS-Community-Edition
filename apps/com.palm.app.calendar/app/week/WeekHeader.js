/**
NOTES:
	- WeekHeader is the visual representation of a week's date and day headers.

	+ WeekCarousel:
		+ WeekView:
			- WeekHeader	<------------ This module.
			- Week AllDay Header
			+ weekdays:
				- DayView (7)
			+ weekhours:
				- DayHour (24)

TODOs:
	- ...
*/
enyo.kind({
	name		: "calendar.week.WeekHeader",
	className	: "week-header header",
	kind		: enyo.Control,

	published:
	{	date		: null	// Date		: This week's start date.
	,	startOfWeek	: 0		// Number	: The first day (0:Sunday -> 6:Saturday) of this week.
	},

	G11N:
	{	HeaderFmt	: new enyo.g11n.DateFmt ({date:"medium", dateComponents:"d", weekday:true})
	,	Fmts		: new enyo.g11n.Fmts()
	},

	components: [
		{name:"dateHeader", kind:"calendar.DateHeader", className:"date", duration:6, fit: false, formats:{
				"short"	: new enyo.g11n.DateFmt ({date:"medium"})
			,	full	: new enyo.g11n.DateFmt ({date:"long"})
		}},
		{name:"dayHeader", className:"days-header", kind: enyo.HFlexBox}
	],

	constructor: function constructor () {
		this.inherited (arguments);
		this.timeMachine = new Date();
	},

	create	: function create () {
		this.inherited (arguments);

		var dayHeader	= this.$.dayHeader
		,	weekLength	= this.G11N.Fmts.dateTimeHash.long.day.length
		;
		for (var i=0; i < weekLength; ++i) {
			dayHeader.createComponent (
			{	name		: "dayLabel" + i
			,	className	: "day"
			,	align		: "center"
			,	pack		: "center"
			,	flex		: 1
			});
		}
		this.dateChanged();
	},

	dateChanged: function dateChanged (oldDate) {
		var date = this.date;
		if (!date || +this.date === +oldDate) {
			return;
		}
		var	ui			= this.$
		,	startDate	= this.timeMachine.setTime (+date)
		;
		ui.dateHeader.setDate (new Date(startDate));
		this.startOfWeekChanged();
	},

	startOfWeekChanged: function startOfWeekChanged (oldStartOfWeek) {
		if (this.startOfWeek === oldStartOfWeek) {
			return;
		}
		var	days		= this.$.dayHeader.getComponents()
		,	date		= this.timeMachine
		,	weekLength = this.G11N.Fmts.dateTimeHash.long.day.length
		;
		date.setTime (Date.now());
		var	today = +date.clearTime();
		date.setTime (this.date);

		for (var day, i = 0; i < weekLength; i++) {
			day = days[i];
			day.setContent (this.G11N.HeaderFmt.format (date));
			day.date = +date; // For the clickHandler
			(day.date == today) ? day.addClass ("todayDate") : day.removeClass ("todayDate");
			date.addDays (1);
		}
	}
});
