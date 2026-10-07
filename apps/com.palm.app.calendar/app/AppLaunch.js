/**
NOTES:
	- calendar.AppLaunch handles the Calendar application's launch responsibilities.

TODOs:
	- PLAN	: Merge AppLaunch into App.
**/
enyo.kind ({
	name: "calendar.AppLaunch",
	kind: enyo.Component,

	published:
	{	createEvent		: null				// Object	: For watching create event requests.
	,	currentDate		: null				// Date		: For watching when the current date changes.
	,	firstLaunchDone	: undefined			// Boolean	: For watching when First Launch is done.
	},

	components:[
		{kind: "ApplicationEvents"
//		,	onApplicationRelaunch	: "applicationRelaunchHandler"		// Called by tapping on Calendar's Launcher icon while the app's carded or hidden via keep-alive.
		,	onUnload				: "unloadHandler"
		,	onWindowActivated		: "windowActivatedHandler"
		,	onWindowDeactivated		: "windowDeactivatedHandler"
		,	onWindowParamsChange	: "windowParamsChangeHandler"
		},
		{name: "checkFirstLaunch", kind: "Accounts.checkFirstLaunch", onCheckFirstLaunchResult: "checkFirstLaunchResult"},
		{name: "appIcon", kind: "calendar.AppIcon"}
	],

	constructor: function AppLaunch () {
		this.inherited	(arguments);
		this.timeMachine		= new Date();							// For calculating date/times without creating new Date instances.
		DataHub.enhance	(enyo.application);
	},

	create: function create () {
		this.inherited (arguments);

		var enyoApp = enyo.application;
		enyoApp.fmts				= new enyo.g11n.Fmts();				// Cached for getting format info.
		enyoApp.watch ({createEvent:this, currentDate:this});
		enyoApp.app					= new calendar.App();
		enyoApp.shareCurrentDate	= enyo.bind (this, this.shareCurrentDate);
	},

	destroy: function destroy () {
		var	enyoApp				=	enyo.application;
		enyoApp.app				&& enyoApp.app.destroy();
		enyoApp.reminderManager	&& enyoApp.reminderManager.destroy();

		// TODO: Make the following components proper members of this componebt so they'll be auto-destroyed when it is.
		enyoApp.calendarsManager.destroy();
		enyoApp.databaseManager.destroy();
		enyoApp.lunaAppManager.destroy();

		delete enyoApp.app;
		delete enyoApp.calendarsManager;
		delete enyoApp.databaseManager;
		delete enyoApp.lunaAppManager;
		delete enyoApp.prefsManager;
		delete enyoApp.reminderManager;

		enyoApp.ignore ({createEvent:this, currentDate:this});
		this.inherited (arguments);
		enyoApp.clearHub();
	},
	
	ready: function ready () {
		!enyo.application.reminderManager && (enyo.application.reminderManager = new ReminderManager());
		this.$.checkFirstLaunch.shouldFirstLaunchBeShown ("com.palm.app.calendar");
//		this.handleLaunchParams (enyo.windowParams);
	},

// BEGIN :-------: Framework Handlers :-----------------------------------------------------------------------------------------------------------------------//

	applicationRelaunchHandler: function applicationRelaunchHandler () {	// TODO: Re-enable now that enyo.ApplicationEvents supports this.
		DEBUG && this.log ("======= RELAUNCHED\t");
		this.handleLaunchParams (enyo.windowParams);
	},

	unloadHandler: function unloadHandler () {
		DEBUG && this.log ("======= UNLOADING\t");
		this.destroy();
	},

	windowActivatedHandler: function windowActivatedHandler () {
		DEBUG && this.log ("======= ACTIVATED\t");
	},

	windowDeactivatedHandler: function windowDeactivatedHandler () {
		DEBUG && this.log ("======= DEACTIVATED\t");
	},

	windowParamsChangeHandler: function windowParamsChangeHandler () {
		DEBUG && this.log ("======= PARAMS CHANGED\t");
		this.handleLaunchParams (enyo.windowParams);
	},

	windowReactivatedHandler: function windowReactivatedHandler () {		// enyo.ApplicationEvents doesn't call this...
		DEBUG && this.log ("======= REACTIVATED\t");
		this.handleLaunchParams (enyo.windowParams);
	},

// BEGIN :-------: Published Property Handlers :--------------------------------------------------------------------------------------------------------------//

	createEventChanged: function createEventChanged (lastCreatedEvent) {
		/* Handles "createEvent" requests:
			{	createEvent:
				{	event		: Object	- Partial or complete CalendarEvent object
				,	keepTime	: Boolean	- Whether to keep the event's specified time as is.
				,	then		: Function	- Function to send created event to.
				}
			}
		*/
		DEBUG && this.log ("\tcreateEvent: ", this.createEvent, "\t");

		var	calMgr		= enyo.application.calendarsManager
		,	prefsMgr	= enyo.application.prefsManager
		,	prefs		= prefsMgr				&& prefsMgr.getPrefs()
		,	event		= this.createEvent		&& this.createEvent.event
		,	keepTime	= !!(this.createEvent	&& this.createEvent.keepTime)
		,	accountId
		,	calendar
		,	alarm		= event.alarm
		,	color		= event.color
		,	start		= event && parseInt (event.dtstart, 10)
		,	end			= event && parseInt (event.dtend, 10)
		,	eventDate	= this.timeMachine
		;

		event				= new CalendarEvent (event);
		isNaN (start) &&	(event.dtstart = start = Date.now());
		eventDate.setTime	(start);

		if (!keepTime) {
			var	hour		= eventDate.getHours()								// Keep the event's start hour.
			,	minute		= Math.ceil (eventDate.getMinutes() / 15) * 15		// Calculate the closest 15 minute interval after the current time.
			;
			eventDate.clearTime();					// Set the event's start time to midnight.
			eventDate.setHours (hour);				// Set the event's start hour.
			eventDate.setMinutes (minute);			// Set the event's start minute. !!! DateJS' set ({minute:minute}) disallows minute=60.
			event.dtstart = start = +eventDate;		// Create event's dtstart timestamp.
		}

		if (!("calendarId" in event)) {
			event.calendarId = prefsMgr.getDefaultCalendar();
		}

		if (!("accountId" in event)) {
			calendar	= calMgr.getCal (event.calendarId);
			accountId	= (calendar && calendar.accountId);
			(accountId != null) && (event.accountId = accountId);
		}

		event.color = color == null															// If the event had no color:
		?	((calendar && calendar.color) || calMgr.getCalColor (event.calendarId) || "blue")	//	Use its calendar color or default to blue.
		:	color																				//	Otherwise reset its color since new CalendarEvent() strips it.
		;

		if (isNaN (event.dtend)) {
			var	duration	= (prefs && prefs.defaultEventDuration && (prefs.defaultEventDuration * 6e4)) || 36e5	// Default to 1 hr. 6e4=60000ms=1minute, 36e5=3600000ms=1hour
			event.dtend		= start + duration;
		}

		if (!alarm) {
			if (prefs) {
				alarm = event.allDay ? prefs.defaultAllDayEventReminder : prefs.defaultEventReminder;
			} else {
				alarm = event.allDay ? "-P1D" : "-PT15M";
			}
			Utilities.setAlarm (event.alarm[0], alarm);
		}

		DEBUG && this.log ("\tevent:",event,"\t");

		var	then = this.createEvent && this.createEvent.then;
		enyo.isFunction	(then)										// If a then function was provided
		&&	setTimeout	(enyo.bind (this, then, event), 15.625);	//	use it to return the newly created CalendarEvent asynchronously.

		this.createEvent = null;	// Clear the current "createEvent" request so its info won't be accidentally reused.
	},

	currentDateChanged: function currentDateChanged (oldDate) {
		var	enyoApp			=	enyo.application
		,	currentDate		=	enyoApp.currentDate
		;
		!currentDate		&&	(currentDate = new Date()); //use new Date, because we're setting the value into enyoApp.currentDate
		this.currentDate	&&	currentDate.setTime (+this.currentDate);
		enyoApp.currentDate	=	currentDate.clearTime();
	},

	firstLaunchDoneChanged: function firstLaunchDoneChanged (oldFirstLaunchDone) {
		var firstLaunchDone = !!this.firstLaunchDone;
		if (firstLaunchDone) {
			enyo.application.ignore ({firstLaunchDone: this});					// Stop watching for First Launch to be done.

			// Share the new firstLaunch state synchronously.
			enyo.application.share	({firstLaunch: {data: false, keep: true, wait: true}});
			this.$.checkFirstLaunch.firstLaunchHasBeenShown ();
		}
	},

// BEGIN :-------: Custom Methods :---------------------------------------------------------------------------------------------------------------------------//

	checkFirstLaunchResult: function checkFirstLaunchResult (inSender, inResponse) {

		var showFirstLaunch = !!(inResponse && inResponse.showFirstLaunch);

		showFirstLaunch && enyo.application.watch ({firstLaunchDone: this});	// If we're going to show First Launch, watch for when it is done.

		// Share the result so that when the window is ready it will receive it and launch the appropriate view synchronously (perf).
		enyo.application.share	({firstLaunch: {data: showFirstLaunch, keep: true, wait: true}});
	},

	shareCurrentDate: function shareCurrentDate (params) {
		var	currentDate		= {
			data	: ((params && params.date && new Date (params.date)) || new Date(enyo.application.currentDate) || new Date())
		,	keep	: (params && "keep" in params) ? !!params.keep : true
		,	wait	: (params && "wait" in params) ? !!params.wait : false
		};
		enyo.application.share ({currentDate: currentDate});
	},

	showCalendarView: function showCalendarView () {
		var calendarWindow	= enyo.windows.fetchWindow ("Calendar")		// Find any pre-existing Calendar GUI Window.
		,	enyoApp			= enyo.application
		;

		var	launchDate
		,	timeMachine		= this.timeMachine

		// Show day view at launch.  Turn off auto-propogation of the previous view's date.
		,	view			= {data: {view:"DayView", autoDate:false}, keep: true}
		,	windowParams	= enyo.windowParams
		;
		calendarWindow && (view.wait = true);									// If the window already exists, make it switch views first.
		enyoApp.share ({showView: view});

		// Set up the launch date.
		if ("date" in windowParams && isFinite (windowParams.date)) {
			timeMachine.setTime(windowParams.date);
			launchDate = new Date(timeMachine);
		} else {
			launchDate = new Date();
		}

		// If the launch date is different than the current date, share it.
		timeMachine.setTime(+launchDate);
		var launch = +timeMachine.clearTime()
		,	current = enyoApp.currentDate && (timeMachine.setTime(+enyoApp.currentDate), +timeMachine.clearTime())
		;

		if (!current || launch != current) {
			enyoApp.shareCurrentDate ({date: launchDate});
		}

		DEBUG && this.log ("======= LAUNCHING APP GUI...");
		enyo.windows.activate ("app/calendar.html", "Calendar", windowParams);	// Activate/open the Calendar GUI window.
	},

	handleLaunchParams: function handleLaunchParams (params) {
		DEBUG && this.log ("\tparams: ", params, "\t");

		if (params.launchedAtBoot) {
			DEBUG && this.log ("========= LAUNCHED AT BOOT");
			return;
		}

		if (params.dayChange) {
			DEBUG && this.log ("========= LAUNCHED DAY CHANGE");
			this.$.appIcon.handleLaunchParams (params);
			return;
		}
//	THIS CHUNK OF CODE IS FOR TESTING REMINDER LAUNCH PARAMS
//		if(!enyo.application.launchCount){
//			console.info("========= SETTING windowParams.alarm");
//			enyo.windowParams.alarm = [
//				{"_kind": "com.palm.service.calendar.reminders:1", "_id": "FAKEREMINDER1", "eventId": "2+801", "subject": "Reminder 1", "location": "somewhere", "isAllDay": false, "attendees":[], "emailAccountId": "", "startTime": 1271714400000, "endTime": 1271718000000, "alarmTime": 1271714100000, "autoCloseTime": 1271718000000, "isRepeating": false},
//				{"_kind": "com.palm.service.calendar.reminders:1", "_id": "FAKEREMINDER2", "eventId": "2+802", "subject": "Reminder 2", "location": "somewhere", "isAllDay": false, 				
//				"emailAccountId": "", "startTime": 1271714400000, "endTime": 1271718000000, "alarmTime": 1271714100000, "autoCloseTime": 1271718000000, "isRepeating": false, attendees: [{commonName: "Dana Sculley (FBI)", email:"dana.sculley@fbi.gov", role: "REQ-PARTICIPANT", organizer: true}, {commonName: "Fox Mulder (FBI)", role: "REQ-PARTICIPANT", email:"fox.mulder@fbi.gov"}]},
//				{"_kind": "com.palm.service.calendar.reminders:1", "_id": "FAKEREMINDER3", "eventId": "2+803", "subject": "Reminder 3", "location": "somewhere", "isAllDay": false, "attendees":[], "emailAccountId": "", "startTime": 1271714400000, "endTime": 1271718000000, "alarmTime": 1271714100000, "autoCloseTime": 1271718000000, "isRepeating": false}
//			];	
//			enyo.application.launchCount = 1;
//		}

		if(params.alarm || params.alarmClose || params.alarmDeleted || params.alarmUpdated){
			DEBUG && this.log ("========= LAUNCHED REMINDER");
			enyo.application.reminderManager.handleLaunchParams(params);
		}

		else {
			this.showCalendarView();
		}

//			else if(params.makeABunchOfEvents){
//				this.db.makeABunchOfEvents(params.makeABunchOfEvents);
//			}
//			else if (params.launchType == "passwordInvalid") {
//				this.showPasswordNotification(params);
//			}
//			else{
//				if(app.exists){
//					if (params && params.reminders) {
//						//show reminders list
//					}		
//			
//					if(params && params.launchType == "editPassword"){
//						this.controller.closeStage("PasswordChangedNotification");
//						stageController.pushScene ("prefs");
//						stageController.pushScene ("accountlogin", params.accountId, params.login, null, null, "", null);
//					}	
//				}
//			}
	}//END:handleLaunchParams()
});//END:calendar.AppLaunch
