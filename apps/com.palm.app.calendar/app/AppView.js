/**
NOTES:
	- calendar.AppView is the Calendar App's GUI controller.

TODOs:
	- BUG	: !!! enyo.Control.resizeHandler() is called on every carousel scroll!
	- BUG	: !!! enyo.Control.resizeHandler() should only propagate resize events to children if parent is showing.
	- BUG	: !!! broadcastMessage() still only exists on enyo.Control and not enyo.Component as of 2011.05.05.
	- BUG	: Handle screen rotation (i.e. adjust layout as needed for Portrait vs. Landscape mode).

	- PLAN	: Move FirstUseView from calendar.App to here and rename to FirstLaunchView.
	- ...
**/
enyo.kind({
	name		: "calendar.AppView",
	className	: "calendar",
	kind		: enyo.VFlexBox,

	published:
	{	is24Hr		: null	// Boolean	: For watching 24hr clock mode changes.
	,	showEvent	: null	// Object	: For watching all show event requests (i.e. From Day, Week, or Month views, ReminderDialog, or Cross Launch).
	,	showView	: null	// Object	: For watching all show view requests.
	},

	components: [
		{kind:"ApplicationEvents"
		,	onBack					: "backHandler"
		,	onUnload				: "unloadHandler"
		,	onWindowActivated		: "windowActivatedHandler"
		,	onWindowDeactivated		: "windowDeactivatedHandler"
		,	onWindowHidden			: "windowHiddenHandler"
		,	onWindowParamsChange	: "windowParamsChangeHandler"
		,	onWindowRotated			: "windowRotatedHandler"
		,	onWindowShown			: "windowShownHandler"
		},//End: ApplicationEvents

		{name:"appMenu", kind:"calendar.AppMenu", lazy:false
		,	onCreateAllDayEvent		: "createAllDayEvent"
		,	onCreateEvent			: "createTimedEvent"
//		,	onDeleteEvent			: "showDeleteConfirm"
		,	onJumpTo				: "showJumpTo"
		,	onShowHelp				: "showHelp"
//		,	onShowMap				: "showMap"
//		,	onShowMapRoute			: "showMap"
		,	onShowMissedReminders	: "showReminders"
		,	onShowPreferences		: "showPreferences"
		,	onShowToday				: "showDate"
		,	onSyncNow				: "syncNow"
		},//End: AppMenu

		{kind: enyo.Pane, flex: 1, onSelectView: "viewSelected", components: [
			{name: "calendar", kind: enyo.VFlexBox,
				components: [
					{kind:"calendar.CalendarList"},
					{name:"main", className:"view", kind:enyo.Pane, flex: 1, onSelectView: "viewSelected", transitionKind: "calendar.SimpleTransition", components: [  // Using a custom transition until the discovered enyo issue in enyo.transitions.Simple is resolved (DFISH-28771)
						{name:"dayCarousel"		, kind:"calendar.day.DayCarousel"		, flex:1, lazy: true},
						{name:"weekCarousel"	, kind:"calendar.week.WeekCarousel"		, flex:1, lazy: true},
						{name:"monthCarousel"	, kind:"calendar.month.MonthCarousel"	, flex:1, lazy: true}
					]},
					{className:"view-controls", kind: enyo.HFlexBox, align:"center", pack:"center", components: [
						{name: "btnNew", kind: enyo.Button, className: "enyo-button-light" , caption:$L("New event"), i_con: "../images/menu-icon-createNew.png"	, onclick:"createTimedEvent"},
						{kind: enyo.Spacer},
						{name:"viewSwitcher", kind: enyo.RadioGroup, className: "Rbutton", onChange:"switchView", onclick:"switchViewClicked", value:-1, components: [
							{name:"daySwitch"	, kind: enyo.RadioButton, lab_el: $L("Day")		, icon: "../images/menu-icon-day.png"	, value: 0 },	// lab_el is intentionally misspelled to keep but not use the display text per Calendar's Visual Design.
							{name:"weekSwitch"	, kind: enyo.RadioButton, lab_el: $L("Week")	, icon: "../images/menu-icon-week.png"	, value: 1 },	// lab_el is intentionally misspelled to keep but not use the display text per Calendar's Visual Design.
							{name:"monthSwitch"	, kind: enyo.RadioButton, lab_el: $L("Month")	, icon: "../images/menu-icon-month.png"	, value: 2 }	// lab_el is intentionally misspelled to keep but not use the display text per Calendar's Visual Design.
						]},
						{kind: enyo.Spacer},
						{name: "btnJump",   kind: enyo.IconButton, className: "enyo-button-light", caption: $L("Jump to..."), i_con: "../images/menu-icon-jumpTo.png", onclick:"showJumpTo"}
						//{name: "btnJump",   kind: enyo.IconButton, className: "menuButtons enyo-button-light", ca_ption: $L("Jump to..."), icon: "../images/menu-icon-jumpTo.png", onclick:"showJumpTo"},				// ca_ption is intentionally misspelled to keep but not use the display text per Calendar's Visual Design.
						//{name: "btnToday",  kind: enyo.IconButton, className: "menuButtons btnToday enyo-button-light", ca_ption: $L("Show today"), icon: "../images/menu-icon-showToday.png", onclick:"showToday"}		// ca_ption is intentionally misspelled to keep but not use the display text per Calendar's Visual Design.
					]},
					{className:"footerPageEffect"}
			]},//End: calendar
			{name:"editView"		, kind:"calendar.edit.EditView"			, lazy: true, showing: false, onExit:"closeView", onDelete:"showDeleteConfirm", flex:1},
			{name:"prefsView"		, kind:"calendar.prefs.PreferencesView"	, lazy: true, showing: false, onExit:"closeView"}
//			{name:"firstLaunchView"	, kind:"calendar.FirstLaunchView"		, lazy: true, showing: false, onExit:"exitFirstLaunch"}	// TODO: Move from calendar.js
		]}//End: pane
	],//End:components

	popups: [	// PERF: Store popups and dialogs separately from the main GUI components to avoid costly premature creation.
		{name: "jumpToDialog", kind: enyo.ModalDialog, caption: $L("Jump To..."), scrim:true, showing:false, onClose:"resetMenu", components: [
			{name: "jumpTo", kind: "calendar.JumpToView", onDateChanged:"jumpToDate" }
		]},
		{name: "detailPopup", kind: enyo.ModalDialog, scrim:true, caption: $L("Event Details"), className: "enyo-modaldialog-customWidth", showing:false, onClose:"resetMenu", components: [
			{name: "detailView", kind: "calendar.edit.DetailView", showing:false, onEdit:"displayEvent", onDelete:"showDeleteConfirm"}
		]},
		{name: "deleteDialog", kind: enyo.ModalDialog, scrim:true, showing:false, components: [
			{name: "deleteConfirm", kind: "calendar.edit.DeleteConfirm"}
		]}
	],//End:popups

	constructor: function AppView () {
		this.inherited (arguments);
		this.EventView		= calendar.EventView;
		this.timeMachine	= new Date();
	},

	constructed: function constructed () {
		this.createEventThen			=	enyo.bind (this, this.createEventThen);
		this.createLaunchEventThen		=	enyo.bind (this, this.createLaunchEventThen);
		this.handleUniversalSearch		=	enyo.bind (this, this.handleUniversalSearch);

		this.inherited (arguments);
		//(typeof HACKS != "undefined")	&&	HACKS.HACK_ENYO_DEFAULT_TARGET_EVENT_HANDLER (this);
	},

	create: function create () {		// PERF: new AppView() takes ~350 ms.
		this.inherited (arguments);
		window.PalmSystem && window.PalmSystem.keepAlive (true);

		var enyoApp	= enyo.application
		,	ui		= this.$
		;
		ui.daySwitch.clickHandler();
		ui.pane.selectView (ui.calendar);

		this.createComponents (this.popups);

		this.is24Hr = !enyoApp.fmts.isAmPm();	// Use the current 24hr mode system setting as default.
		enyoApp.autoDate = true;				// When switching views (example: WeekView->DayView), use the previous view's date.

		enyoApp.watch	({ is24Hr:this, showEvent:this, showView:this });
	},

	destroy: function destroy () {
		enyo.application.ignore ({ is24Hr:this, showEvent:this, showView:this });
		this.inherited (arguments);
	},

// BEGIN :-------: Framework Handlers :-----------------------------------------------------------------------------------------------------------------------//

	backHandler: function backHandler (from, event) {
		//	As of v0.3 enyo doesn't seem to support nested "back" handlers so this method
		//	determines how to handle "back" events for each multi-view pane.
		//	event.preventDefault() is used to stop accidental cardmode on "back" events.
		this.closeView();
		(this.$.pane.getViewName() != "calendar") && event.preventDefault();
	},

	resizeHandler: function resizeHandler (from, domEvent) {
		this.inherited (arguments);
		var view = this.$.main.getView();
		view && view.showing && view.resized();
	},

	unloadHandler: function unloadHandler () {
		DEBUG && this.log ("======= UNLOADING...\t");

		// Triggers the chain of destroy handlers (appview -> dayview -> etc.)
		// Destroy handlers are where most views unsubscribe listeners from data hub and cancel service requests.
		this.destroy();
	},

	windowActivatedHandler: function windowActivatedHandler(){
		DEBUG && this.log ("======= ACTIVATED\t");
	},

	windowDeactivatedHandler: function windowDeactivatedHandler(){
		DEBUG && this.log ("======= DEACTIVATED\t");
	},

	windowHiddenHandler: function windowHiddenHandler () {		// TODO: Set start date & view based on user's app preferences.
		DEBUG && this.log ("======= HIDDEN\t");
		var	view	= {data: {view: calendar.day.DayView, autoDate: false}, wait: true};	// Since keep-alive suspends timers, make share synchronous.

		enyo.application.share	({showView: view});							// Ensure that "today" view is already displayed when opened with keep-alive.
		enyo.application.shareCurrentDate	({date:new Date(), wait:true});	// Ensure that the current date is already today when opened with keep-alive.
	},

	windowParamsChangeHandler: function windowParamsChangeHandler () {
		DEBUG && this.log ("======= PARAMS CHANGED: ", enyo.windowParams, "\t");
		this.handleLaunchParams(enyo.windowParams);
	},

	windowReactivatedHandler: function windowReactivatedHandler(){
		DEBUG && this.log ("======= REACTIVATED\t");
	},

	windowRotatedHandler: function windowRotatedHandler (from, event) {
		DEBUG && this.log ("======= ROTATED\t");
	},

	windowShownHandler: function windowShownHandler () {
		DEBUG && this.log ("======= SHOWN\t");
	},

// BEGIN :-------: Published Property Handlers :--------------------------------------------------------------------------------------------------------------//

	is24HrChanged: function is24HrChanged (oldIs24Hr) {
		this.$.pane.broadcastMessage ("is24Hr", [this.is24Hr]);	// Since we only get 24Hr changes from App, we pass them on immediately.
	},

	showEventChanged: function showEventChanged (lastEventShown) {
		this.log(" ENYO PERF: SINGLE CLICK OCCURED time: "+ Date.now());
		this.displayEvent (this, this.showEvent);
		this.log(" ENYO PERF: TRANSITION DONE time: "+ Date.now());
	},

	showViewChanged: function showViewChanged (lastShowView) {
		enyo.application.free ({showView:true});	// Free the showView from datahub just in case it is being kept.

		var showView = this.showView;
		if (!showView) { return; }

		var	ui			= this.$
		,	view		= showView.view
		,	autoDate	= showView.autoDate
		;
		switch (view) {
			case calendar.day.DayView:
			case "DayView":
				enyo.application.autoDate = (autoDate === false) ? false : true;
				ui.daySwitch.clickHandler();
				break;

			case calendar.week.WeekView:
			case "WeekView":
				enyo.application.autoDate = (autoDate === false) ? false : true;
				ui.weekSwitch.clickHandler();
				break;

			case calendar.month.MonthView:
			case "MonthView":
				enyo.application.autoDate = (autoDate === false) ? false : true;
				ui.monthSwitch.clickHandler();
				break;

			default:
				this.warn ("\tUnable to show unrecognized view:\n\n\t", this.showView, "\t");
				break;
		}//END:switch (view)
	},//END:showViewChanged()

// BEGIN :-------: Custom Methods :---------------------------------------------------------------------------------------------------------------------------//

	closeView: function closeView (event) {
		this.$.pane.back();
	},

	createAllDayEvent: function createAllDayEvent (from, domEvent) {
		var date = this.timeMachine;
		date.setTime (Date.now());

		var	hour	= date.getHours()
		,	minutes	= date.getMinutes()
		;
		date.setTime	(enyo.application.currentDate);
		date.clearTime	();
		date.setHours	(hour);
		date.setMinutes	(minutes);

		var createEvent =
		{	event	: {allDay:true, dtstart:+date}
		,	then	: this.createEventThen
		};
		enyo.application.share ({createEvent: {data: createEvent}});	// Request event creation.
		return true;
	},

	createEventThen: function createEventThen (event) {
		if (!event) {
			this.error ("\tFailed to create event GUI using event [", event, "].\t");
			return;
		}
		var addEvent = {event:event, show:true, then:undefined};	// "then" can be a Function or be omitted.
		enyo.application.share ({addEvent: {data: addEvent}});				// Request adding the event to a view.
	},

	createLaunchEventThen: function createLaunchEventThen (event) {
		if (!event) {
			this.error ("\tFailed to create cross-launched event using these properties [", event, "].\t");
			return;
		}
		enyo.application.shareCurrentDate ({date:new Date (event.dtstart).clearTime(), wait:true});

		event.saveAsIs	= true;											// Notifies Edit View that this event should be saved even if the user doesn't change it.
		var addEvent	= {event:event, show:true, then:undefined};	// "then" can be a Function, falsey or be omitted.

		DEBUG && this.log ("\tEvent: ", event, "\t");
		enyo.application.share ({addEvent: {data: addEvent, keep: true}});					// Request adding the event to a view.
	},

	createTimedEvent: function createTimedEvent (from, domEvent) {
		var date = this.timeMachine;
		date.setTime (Date.now());

		var	hour	= date.getHours()
		,	minutes	= date.getMinutes()
		;
		date.setTime	(enyo.application.currentDate);
		date.clearTime	();
		date.setHours	(hour);
		date.setMinutes	(minutes);
		
		var createEvent =
		{	event	: {dtstart: +date}
		,	then	: this.createEventThen
		};
		enyo.application.share ({createEvent: {data: createEvent}});	// Request event creation.
		return true;
	},

	displayEvent: function displayEvent (from, eventGUIOrEvent) {
		DEBUG && this.log ("Event:", eventGUIOrEvent);

		if (!eventGUIOrEvent) {
			this.error ("\tUnable to edit non-existent event.\t");
			return;
		}
		var event = eventGUIOrEvent.event || eventGUIOrEvent;
		var	hasId	= ("_id" in event)
		,	ui		= this.$
		,	view
		;

		// Had to add an additional case below for when detailView hasn't been loaded yet.  from == ui.detailView in this case, since they are both undefined.
		if ((!ui.detailView || (from != ui.detailView)) && hasId) {		// Show Event Detail if not already doing so or performing a tap-to-create:
			ui.detailPopup.lazy && ui.detailPopup.validateComponents();
			view				= ui.detailView;						//		cache detail view,
			this.viewSelected	(from, view, from);						//		trigger menu update,
			view.setShowing		(true);									//		trigger ContactsManager lazy loading if needed,
			view.setEvent		(eventGUIOrEvent);						//		update the view with the event's content,
			ui.detailPopup.openAtCenter();								//		then show Detail View.
			//ui.detailPopup.resize();
		} else {														// Otherwise:
			ui.pane.viewByName ("editView").setEvent (eventGUIOrEvent);	//		Update Edit View with the event's content.
			ui.pane.selectView (ui.editView);							//		then show Edit View.
		}
	},

	handleLaunchParams: function handleLaunchParams (params) {
		DEBUG && this.log ("\tParams: ", params, "\t");

		switch (true) {
			case !params || (typeof params != "object"): 	// Ensure that params exist and that they're within an object.
				break;

			case ("newEvent"		in params):				// Supports "New Calendar Event" Spec on webOS Developer Network:
			case ("quickLaunchText"	in params):				// Supports Just Type "New Calendar Event" Quick Action:
				var createEvent =
				{	event		: params.newEvent || {subject: params.quickLaunchText}
				,	keepTime	: !!params.newEvent
				,	then		: this.createLaunchEventThen
				};
				enyo.application.share ({createEvent: {data: createEvent}});
				return;

			case ("showEventDetail" in params):
				enyo.application.databaseManager.getEvent
				(	params.showEventDetail					// This launch param is expected to be an event id.
				,	this.handleUniversalSearch
				,	this.handleUniversalSearch
				);
				return;
			
			case ("showDetailFromReminder" in params):
				var eventId = params.showDetailFromReminder.eventId
				,	start	= parseInt(params.showDetailFromReminder.startTime, 10)
				,	end		= parseInt(params.showDetailFromReminder.endTime, 10)
				;
				
				if(eventId === undefined || start === undefined || end === undefined){
					return; 
				}
				
				//This needs to be bound with the new arguments every time.
				var handleShowReminderDetail = enyo.bind (this, this.handleShowReminderDetail, start, end);
				enyo.application.databaseManager.getEvent
				(	eventId
				,	handleShowReminderDetail
				,	handleShowReminderDetail
				);
				return;	

			default:
				break;
		}

		var view = this.$.main.getView();
		view && enyo.isFunction (view.currentDateChanged) && view.currentDateChanged();
	},

	handleShowReminderDetail: function handleShowReminderDetail (startTime, endTime, response) {
		var event = response.returnValue && response.results && response.results.length && response.results[0];
		if (event) {
			event.currentLocalStart = startTime;
			event.currentLocalEnd = endTime;
			this.displayEvent	(null, event);
			enyo.application.shareCurrentDate ({date:startTime/*, wait:true*/});
			return;
		}
		this.error ("\tCalendar Detail From Reminder Failed: ", response, "\t");
	},

	handleUniversalSearch: function handleUniversalSearch (response) {
		var event = response.returnValue && response.results && response.results.length && response.results[0];
		if (event) {
			this.displayEvent	(null, event);
			enyo.application.shareCurrentDate ({date:event.dtstart/*, wait:true*/});
			return;
		}
		this.error ("\tCalendar Universal Search Failed: ", response, "\t");
	},

	jumpToDate: function jumpToDate (from, date) {
		this.showDate (date);
	},

	resetMenu: function resetMenu (from) {
		this.log(" ENYO PERF: SINGLE CLICK OCCURED time: "+ Date.now());
		this.viewSelected (from, this.$.main.getView(), from);
		this.log(" ENYO PERF: TRANSITION DONE time: "+ Date.now());
	},

	showDate: function showDate (date) {
		!(date && isFinite (+date)) && (date = new Date());
		DEBUG && this.log ("\t",date,"\t");
		enyo.application.shareCurrentDate ({date:date});
	},

	showDeleteConfirm: function showDeleteConfirm (from, eventOrEventGUI) {
		DEBUG && this.log ("########## Showing the delete confirmation popup.");
		var ui = this.$;
		ui.deleteDialog.lazy && ui.deleteDialog.validateComponents();
		ui.deleteConfirm.setEvent (eventOrEventGUI);
		ui.deleteDialog.openAtCenter();
	},

	showHelp: function showHelp () {
		enyo.application.share ({launch: {data: {appId: "com.palm.app.help" }}});
	},

	showJumpTo: function showJumpTo () {
		var ui = this.$;
		ui.jumpToDialog.lazy && ui.jumpToDialog.validateComponents();
		ui.jumpToDialog.openAtCenter();
	},

	showPreferences: function showPreferences () {
		this.$.pane.selectViewByName ("prefsView");
	},

	viewIdNameMap: ["dayCarousel", "weekCarousel", "monthCarousel"],

	switchView: function switchView (from, i) {							// This is called when switching between views.
		var name = this.viewIdNameMap [i];	
		this.switchViewClicked.lastClickedViewName = name;				//	Set the view switching flag.
		this.log(" ENYO PERF: SINGLE CLICK OCCURED time: "+ Date.now());
		this.$.main.selectViewByName (name);							//	Switch to the selected view.
	},

	switchViewClicked: function switchViewClicked (from, domEvent) {	// This is automatically called after switchView.
		var nowShowing = this.$.main.getViewName();						//	Which view is currently showing
		if(nowShowing == this.switchViewClicked.lastClickedViewName){	//	Is that the last-clicked view, meaning we're already showing it?
			this.showDate();											//  Then show today within the current view.
		}		
		return true;													//	Stop the click event from being handled by any ancestor component.
	},

	syncNow: function syncNow () {
		enyo.application.calendarsManager.syncAllCalendars();
	},

	viewSelected: function viewSelected (from, view, lastView) {
		var	viewName = view && view.name;

		this.$.appMenu.setViews ({current:view, last:lastView});
		if(viewName == "calendar"){
			viewName = this.$.main.getViewName();
		}
		this.$.pane.broadcastMessage("viewSwitched", [viewName]);
	}

});//END:calendar.AppView
