

enyo.kind(
{	name	: "calendar.prefs.AlertSelector"
,	kind	: enyo.ListSelector
,	value	: "1"
,	items	:
	[	{caption: $L("Vibrate")			, value: "3"}
	,	{caption: $L("System Sound")	, value: "1"}
	,	{caption: $L("Mute")			, value: "0"}
	]
});

enyo.kind(
{	name	: "calendar.prefs.TimedReminderSelector"
,	kind	: enyo.ListSelector
,	value	: "-PT5M"
,   label   : $L("Timed")
,   hideArrow: true
,	items	:
	[	{caption: $L("No Reminder")			, value: "none"}
	,	{caption: $L("At start time")		, value: "-PT0M"}
	,	{caption: $L("5 minutes before")	, value: "-PT5M"}
	,	{caption: $L("10 minutes before")	, value: "-PT10M"}
	,	{caption: $L("15 minutes before")	, value: "-PT15M"}
	,	{caption: $L("30 minutes before")	, value: "-PT30M"}
	,	{caption: $L("1 hour before")		, value: "-PT1H"}
	,	{caption: $L("1 day before")		, value: "-P1D"}
	]
});

enyo.kind(
{	name	: "calendar.prefs.AllDayReminderSelector"
,	kind	: enyo.ListSelector
,	value	: "-P1D"
,   label   : $L("All Day")
,   hideArrow: true
,	items	:
	[	{caption: $L("No Reminder")			, value: "none"}
	,	{caption: $L("At start time")		, value: "-PT0M"}
	,	{caption: $L("1 day before")		, value: "-P1D"}
	,	{caption: $L("2 days before")		, value: "-P2D"}
	,	{caption: $L("3 days before")		, value: "-P3D"}
	,	{caption: $L("1 week before")		, value: "-P1W"}
	]
});

enyo.kind(
{	name	: "calendar.prefs.DurationSelector"
,	kind	: enyo.ListSelector
,	value	: 60
,	items	:
	[	{caption: $L("30 minutes")	, value: 30}
	,	{caption: $L("1 hour")		, value: 60}
	,	{caption: $L("2 hours")		, value: 120}
	]
});

// TODO: g11n - fix this when we implement alternate calendar support
enyo.kind(
{	name		: "calendar.day.DayPicker"
,	kind		: enyo.ListSelector
,	textAlign	: "left"
,	items		:
	[	{caption: $L("Sunday"),		value: 1}
	,	{caption: $L("Monday"),		value: 2}
	,	{caption: $L("Tuesday"),	value: 3}
	,	{caption: $L("Wednesday"),	value: 4}
	,	{caption: $L("Thursday"),	value: 5}
	,	{caption: $L("Friday"),		value: 6}
	,	{caption: $L("Saturday"),	value: 7}
	]
});

enyo.kind(
{	name		: "calendar.prefs.CalendarPicker"
,	kind		: enyo.ListSelector
,	textAlign	: "left"
});

/*
 * Custom item kind for the ColorPicker popup menu.  Required so we could show the color swatch not using an image.
 * The regular MenuItem only allows a caption and an image-based icon.  Normally we could just add components
 * to get our additonal item for the color swatch, but the MenuItem puts components into a drawer
 * accessed by an arrow button, which is not at all what we want. So we're subclassing, and tweaking the chrome.
 * There's a bit of extra overriding because MenuItem really expects that arrow to be there.
 */
enyo.kind({
	name: "calendar.prefs.ColorPickerItem",
	kind: enyo.MenuItem,
	className: "prefs",
	published:{
		color: "",
		label: ""
	},
	chrome: [
		{name: "item", kind: enyo.Item, tapHighlight: true, align: "center", onclick: "itemClick"}
	],

	itemChrome: [
		{kind: enyo.HFlexBox, components: [
			{name: "colorSwatch"},
			{name: "caption", className:"color-space", align: "center"},
			{name: "arrow", kind: enyo.CustomButton, toggling: false, showing: false, disabled: true} //only here because MenuItem parent is unhappy if it's missing
		]}
	],
	create: function create(){
		this.inherited(arguments);
		this.validateItemChrome();
		this.colorChanged();
		this.labelChanged();
	},
	colorChanged: function colorChanged(){
		var className = "menu theme-"+this.color.toLowerCase()+" legend";
		this.$.colorSwatch.setClassName(className);
		this.setValue(this.color);
	},
	labelChanged: function labelChanged(){
		this.$.caption.setContent(this.label);
	},
	openChanged: function openChanged(){},//MenuItem parent changes arrow properties in here. We don't want that.
	iconChanged: function iconChanged(){}//MenuItem parent changes icon properties in here. We don't want that.
});

enyo.kind(
{	name		: "calendar.prefs.ColorPicker"
,	kind		: enyo.PopupSelect
,	published	: {calendarId: null, calendarIndex: null}
,	defaultKind	: "calendar.prefs.ColorPickerItem"
,	items		:
	[	{color: "blue",		label: $L("Blue")}
	,	{color: "green", 	label: $L("Green")}
	,	{color: "orange", 	label: $L("Orange")}
	,	{color: "pink", 	label: $L("Pink")}
	,	{color: "purple", 	label: $L("Purple")}
	,	{color: "red", 		label: $L("Red")}
	,	{color: "teal", 	label: $L("Teal")}
	,	{color: "yellow", 	label: $L("Yellow")}
	]
,	onSelect	: "colorSelected"
});

enyo.kind({
	name		: "calendar.prefs.PreferencesView",
	kind		: enyo.VFlexBox,
	className	: "prefs enyo-bg",

	events:
	{	onExit	: ""
	},

	published:
	{	accountsAndCalendars: null
	,	is24Hr	: false
	,	prefs	: null

	},

	components: [
		{name: "pane", kind: enyo.Pane, flex: 1, components: [
	    // This is the first view.  It contains all the app preferences and the accountsList

			{kind: enyo.VFlexBox, name: "prefsAndAccounts",  components: [
				//{kind: enyo.Header, className:"accounts-header", pack:"center",
				{kind:enyo.PageHeader, className:"enyo-toolbar-light prefs-header", pack:"center", components:[
					{kind: enyo.Image, src: "../images/header-icon-calendar48x48.png", className: "prefsIcon"},
					{content: $L("Preferences & Accounts"), className:""}
				]},
				{className:"accounts-header-shadow"},
				{name:"contentScroller", kind: enyo.Scroller, flex: 1, components: [
				  {kind:"VFlexBox", className:"box-center accounts-body", components: [
					{kind: enyo.RowGroup, caption: $L("Accounts"), components:[
						{kind: "Accounts.accountsList", name: "accountsList", onAccountsList_AccountSelected: "editAccount",  onAccountsList_AddAccountTemplates:"addAccountTemplates"},
					]},
					{kind: enyo.Button, label: AccountsUtil.BUTTON_ADD_ACCOUNT, onclick: "addAccount"},
					{kind: enyo.Button, name: "btnSyncNow", caption: $L("Sync now"), onclick: "syncNow"},

					{kind: enyo.RowGroup, caption: $L("Default Calendar"), components:[
						{name: "defaultCalendar", kind: "calendar.prefs.CalendarPicker", onChange: "chooseDefaultCalendar"}
					]},
					{content:$L('New events created will default to this calendar.'), className: "accounts-body-text", style:"margin-bottom:8px"},

					{kind: enyo.RowGroup, caption: $L("First Day of Week"), components:[
						{kind: "calendar.day.DayPicker", name: "startOfWeek", onChange: "chooseStartOfWeek"}
					]},
//					Commenting out the following but keeping it in case it is needed again.
//					{kind: enyo.RowGroup, caption: $L("Day Start and End"), components:[
//						{kind: enyo.HFlexBox, components: [
//							{content: $L("Start"), width: "3em", className: "enyo-picker-label"},
//							{name: "dayStartTime", kind: enyo.TimePicker, label: " ", onChange: "chooseDayStartTime"}
//						]},
//						{kind: enyo.HFlexBox, components: [
//							{content: $L("End"), width: "3em", className: "enyo-picker-label"},
//							{name: "dayEndTime", kind: enyo.TimePicker, label: " ", onChange: "chooseDayEndTime"}
//						]}
//					]},
					{kind: enyo.RowGroup, caption: $L("Default Event Duration"), components:[
						{kind: "calendar.prefs.DurationSelector", onChange: "chooseDuration"}
					]},

					{kind: enyo.RowGroup, caption: $L("Default Event Reminder"), components:[
						{kind: "calendar.prefs.TimedReminderSelector"	, name: "reminder"			, onChange: "chooseReminder"},
						{kind: "calendar.prefs.AllDayReminderSelector"	, name: "allDayReminder"	, onChange: "chooseAllDayReminder"}
					]},

					{kind: enyo.RowGroup, caption: $L("Event Reminders"), components:[
						{kind: "calendar.prefs.AlertSelector", onChange: "chooseAlert"}
					]},

					{kind: enyo.Group, caption: $L("Calendar Colors"), components: [
						{name: "calendarList", kind: enyo.VirtualRepeater, onSetupRow: "getCalendar", components: [
							{kind: enyo.Item, name: "calendarItem", onclick: "calendarClick", layoutKind: enyo.HFlexLayout, className:"accounts-list-item", components: [
								{name: "calendarIcon", kind: enyo.Image, className:"icon-image"},
								{name: "calendarName", flex: 1, className: "ellipsis cal-name"},
								{name: "calendarColor"}
							]}
						]},
						{kind: "calendar.prefs.ColorPicker", name: "colorPicker", onSelect: "colorSelected"}
					]}
				 ]}
				]},
				{className:"accounts-footer-shadow"},
				{kind:"Toolbar", className:"enyo-toolbar-light",components:[
				//{kind: enyo.Toolbar, components:[
					{kind: enyo.Button, name: "btnDone", caption: $L("Done"), onclick: "doExit", className: "enyo-button-dark accounts-toolbar-btn" }
				]}
			]},

			// Switch to this view when the user taps on the "Add Account" button
			{kind: "AccountsUI", name: "AccountsView", capability: "CALENDAR", onAccountsUI_Done: "accountsDone"},

			{kind: "AccountsModify", name: "AccountsModify", capability: "CALENDAR", onAccountsModify_Done: "accountsDone"},
		]},
		{kind:"ApplicationEvents"
		,	onWindowHidden: "windowHiddenHandler"
		}
	],

	create: function create () {
		this.inherited (arguments);
		enyo.application.watch({accountsAndCalendars: this});
	},

	ready: function ready (){
		this.$.accountsList.getAccountsList("CALENDAR", []);
	},

	destroy: function destroy(){
		enyo.application.ignore({accountsAndCalendars: this});
		this.inherited (arguments);
	},

// BEGIN :-------: Framework Handlers :-----------------------------------------------------------------------------------------------------------------------//

	windowHiddenHandler: function windowHiddenHandler(){
		this.showing && this.doExit();	
	},

// BEGIN :-------: Published Property Handlers :--------------------------------------------------------------------------------------------------------------//

	accountsAndCalendarsChanged: function accountsAndCalendarsChanged(){
		this.$.calendarList.render();
		this.setupDefaultCalendar();
	},

	is24HrChanged: function is24HrChanged () {
		/* 24hr clock mode has changed so update to reflect the change. */
		var ui		= this.$
		,	is24Hr	= this.getIs24Hr();

		//Saw this as undefined once... not sure how it got caused
		ui.dayStartTime && ui.dayStartTime.setIs24HrMode (is24Hr);
		ui.dayStartTime && ui.dayEndTime.setIs24HrMode (is24Hr);
	},

// BEGIN :-------: Custom Methods :---------------------------------------------------------------------------------------------------------------------------//

	reset: function reset () {
		this.$.contentScroller.setScrollTop (0);	// Reset the scroll position.
	},

	showingChanged: function showingChanged(){
		this.inherited (arguments);
		if(this.showing){
			enyo.application.watch ({ is24Hr: this });
			this.prefsManager = this.prefsManager || enyo.application.prefsManager;
			this.prefs = this.prefsManager.getPrefs() || this.prefsManager.defaultPrefs;	// Browser testing support.
			this.setupUI();
		}
		else{
			this.reset();
			enyo.application.ignore ({ is24Hr: this });
			this.prefs && enyo.application.prefsManager.savePrefs(this.prefs);
		}
	},

	setupUI: function setupUI () {
		var ui = this.$;
		ui.startOfWeek		.setValue (this.prefs.startOfWeek);
		ui.reminder			.setValue (this.prefs.defaultEventReminder);
		ui.allDayReminder	.setValue (this.prefs.defaultAllDayEventReminder);
		ui.durationSelector	.setValue (this.prefs.defaultEventDuration);
		ui.alertSelector	.setValue (this.prefs.alarmSoundOn);

//		Commenting out the following but keeping it in case it is needed again.
//		var utcStartTime = new Date (this.prefs.startTimeOfDay);
//		utcStartTime.addMinutes (utcStartTime.getTimezoneOffset());
//		ui.dayStartTime.setValue (utcStartTime);
//
//		var utcEndTime = new Date (this.prefs.endTimeOfDay);
//		utcEndTime.addMinutes (utcEndTime.getTimezoneOffset());
//		ui.dayEndTime.setValue (utcEndTime);
		this.setupDefaultCalendar();
	},

	setupDefaultCalendar: function setupDefaultCalendar(){
		var calmgr = enyo.application.calendarsManager
		,	defaultCalId = enyo.application.prefsManager.getDefaultCalendar()
		,	writableCalendars = calmgr.getCalendarsList({sorted: true, excludeReadOnly: true})
		,	calLength = writableCalendars.length
		,	items = []
		,	ui = this.$
		;

		for(var i = 0; i < calLength; i++){
			items.push({
				icon: calmgr.getCalAccountIcon(writableCalendars[i].accountId)
			,	caption: writableCalendars[i].showName
			,	value: writableCalendars[i]._id
			});
			//this.log("Calendar added. Id:",writableCalendars[i]._id, "Name:",writableCalendars[i].showName, "Icon:",calmgr.getCalAccountIcon(writableCalendars[i].accountId), "Selected?:",writableCalendars[i]._id == defaultCalId?"true":"false");
		}

		ui.defaultCalendar.setItems(items);
		ui.defaultCalendar.setValue(defaultCalId);
	},

	chooseDefaultCalendar: function chooseDefaultCalendar(){
		var defaultCalId = this.$.defaultCalendar.getValue();
		//this.log("Calendar selected. id:", defaultCalId);
		var cal = enyo.application.calendarsManager.getCal(defaultCalId);
		if(!cal){ return; }
		var defaultCal = {
			UID: cal.UID,
			calendarId: defaultCalId,
			name: cal.name,
			username: enyo.application.calendarsManager.getCalAccountUser(defaultCalId)			
		};
		this.prefs.defaultCalendarID = defaultCal;
	},

	chooseAlert: function chooseAlert (inSender, inNewValue, inOldValue) {
		this.prefs.alarmSoundOn = inNewValue;
	},

	chooseStartOfWeek: function chooseStartOfWeek () {
		this.prefs.startOfWeek = this.$.startOfWeek.getValue();
		this.prefs.userChangedStartOfWeek = true;
	},

//	Commenting out the following but keeping it in case it is needed again.
//	chooseDayStartTime: function chooseDayStartTime () {
//		var value = this.$.dayStartTime.getValue()
//		,	newStartOfDay = new Date(this.prefs.startTimeOfDay);
//		newStartOfDay.setHours(value.getHours());
//		newStartOfDay.setMinutes(value.getMinutes());
//		// Convert the time back to utc
//		newStartOfDay.addMinutes(-newStartOfDay.getTimezoneOffset());
//		this.prefs.startTimeOfDay = newStartOfDay.getTime();
//	},
//
//	chooseDayEndTime: function chooseDayEndTime () {
//		var value = this.$.dayEndTime.getValue()
//		,	newEndOfDay = new Date(this.prefs.endTimeOfDay);
//		newEndOfDay.setHours(value.getHours());
//		newEndOfDay.setMinutes(value.getMinutes());
//		// Convert the time back to utc
//		newEndOfDay.addMinutes(-newEndOfDay.getTimezoneOffset());
//		this.prefs.endTimeOfDay = newEndOfDay.getTime();
//	},
	chooseReminder: function chooseReminder () {
		this.prefs.defaultEventReminder = this.$.reminder.getValue();
	},

	chooseAllDayReminder: function chooseAllDayReminder () {
		this.prefs.defaultAllDayEventReminder = this.$.allDayReminder.getValue();
	},

	chooseDuration: function chooseDuration () {
		this.prefs.defaultEventDuration = this.$.durationSelector.getValue();
	},

	syncNow: function syncNow () {
		enyo.application.calendarsManager.syncAllCalendars();
	},

	getCalendar: function getCalendar (inSender, inIndex) {
		var mgr = enyo.application.calendarsManager;
		this.calendars = mgr.getCalendarsList({sorted: true});
		var length = this.calendars && this.calendars.length && inIndex < this.calendars.length;
		if(length){
			var ui = this.$;
			var calendar = this.calendars[inIndex];
			ui.calendarIcon.setSrc(mgr.getCalAccountIcon(calendar.accountId));
			ui.calendarName.setContent(calendar.showName);
			ui.calendarColor.setClassName("list theme-"+calendar.color+" legend");
			return true;
		}
	},

	calendarClick: function calendarClick(inSender, inEvent) {
		var calendar = this.calendars[inEvent.rowIndex];
		this.$.colorPicker.setCalendarId(calendar._id);
		this.$.colorPicker.setCalendarIndex(inEvent.rowIndex);
		this.$.colorPicker.openAtEvent(inEvent);
	},

	//Fix this to update when the list changes, but keep the original order
	colorSelected: function colorSelected(inSender, inSelected) {
		var value = inSelected.getValue();
		var calendarId = inSender.getCalendarId();
		var calendarIndex = inSender.getCalendarIndex();
		enyo.application.calendarsManager.setCalendarColor(calendarId, value);
	},

	addAccountTemplates: function(inSender, templates) {
		this.templates = templates;
	},


	// "Add Account" button was tapped
	addAccount: function addAccount(button) {
		this.$.AccountsView.AddAccount(this.templates);
		this.$.pane.selectViewByName("AccountsView");
	},
	// User tapped on account to edit
	editAccount: function editAccount(inSender, inResults) {
		this.$.AccountsModify.ModifyAccount(inResults.account, inResults.template, 'CALENDAR');
		this.$.pane.selectViewByName("AccountsModify");
	},
	// Go to the prefs and accounts view
	accountsDone: function accountsDone(inSender, e) {
		this.$.pane.selectViewByName("prefsAndAccounts");
	}

});// end PreferencesView Definition


