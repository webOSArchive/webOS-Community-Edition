/**
NOTES:
	- calendar.App is the Calendar app's controller.

TODOs:
	- PLAN	: Merge AppLaunch into App.
**/
enyo.kind ({
	name: "calendar.App",
	kind: enyo.Component,

	published:
	{	is24Hr	: undefined		// boolean, undefined when not yet shared.
	,	tzId	: undefined		// string, undefined when not yet shared.
	},

	components:[
		{kind: enyo.SystemService, components:[
			{name:"getSystemPrefs"		, method:"getPreferences"		, subscribe:true, onSuccess: "gotSystemPrefs"	, onFailure: "gotSystemPrefsFailure"},
			{name:"getSystemTime"		, method:"time/getSystemTime"	, subscribe:true, onSuccess: "gotSystemTime"	, onFailure: "gotSystemTimeFailure"}
		]}
	],

	constructor: function App () {
		this.inherited	(arguments);
	},

	create: function create () {
		this.inherited (arguments);

		var	a		= this.$
		,	enyoApp	= enyo.application
		;

		a.getSystemPrefs.call ({keys: ["timeFormat"]});
		a.getSystemTime.call ();

		this.watchClock	(true);

		this.loadLibraries ();
		!window.PalmSystem		&&	MOCK.initialize ({override: true});						// !!! Must initialize mock before creating CalendarsManager, DatabaseManager, and EventManager because it overrides their prototypes for the browser environment !!!
		!enyoApp.cacheManager	&&	(enyoApp.cacheManager = new calendar.CacheManager());	// Requires EventManager so needs MOCK.initialize() to happen before.
	},

	destroy: function destroy () {
		this.watchClock			(false);

		var a = this.$;			// Cancel Services:
		a && a.getSystemPrefs	&& a.getSystemPrefs.cancel();
		a && a.getSystemTime	&& a.getSystemTime.cancel();

		enyo.application.cacheManager.destroy();
		delete enyo.application.cacheManager;

		var appWindow = enyo.windows.fetchWindow ("Calendar");
		if (appWindow) {
			appWindow.PalmSystem && appWindow.PalmSystem.keepAlive (false);
			appWindow.close();
		}

		this.inherited (arguments);
	},

// BEGIN :-------: Published Property Handlers :--------------------------------------------------------------------------------------------------------------//

	is24HrChanged: function is24HrChanged(oldIs24Hr) {
		var is24Hr = !!this.is24Hr;
		if (oldIs24Hr !== undefined && is24Hr == oldIs24Hr) {	// 24Hr mode was previously defined and still has the same value:
			return;												//	So do nothing.
		}

		var enyoApp		= enyo.application;
		enyoApp.fmts = new enyo.g11n.Fmts();					// Rebuild the formats object since 24Hr format changed.

		enyoApp.share ({is24Hr: {data: is24Hr, keep: true}});						// Share the 24Hr mode.
	},

	tzIdChanged: function tzIdChanged(oldTzId) {
		var tzId = this.tzId;
		if (oldTzId !== undefined && tzId == oldTzId) {			// tzId was previously defined and still has the same value:
			return;												//	So do nothing.
		}

		var enyoApp = enyo.application;

		// We need to notify everyone that the timezone changed both by re-issuing all dates and by sharing the new timezone itself.
		var	time =
		{	tzId		: {data: tzId, keep: true}
		,	clock		: {data: new Date(), keep: true}

		// If we just changed from a previous timezone, we use the "concept date".  Otherwise we share a new date (now).
		,	currentDate	: {data: new Date((enyoApp.currentDate && oldTzId) ? enyoApp.cacheManager.eventManager.utils.timezoneManager.convertTime(+enyoApp.currentDate,tzId,oldTzId) : Date.now()), keep: true}
		}

		enyoApp.share (time);
	},

// BEGIN :-------: Custom Methods :---------------------------------------------------------------------------------------------------------------------------//

	gotSystemPrefs: function gotSystemPrefs (from, response) {
		/* System preferences (timeFormat) service success response handler.
		*/
		DEBUG && this.log ("---:---: Got time format?", response.timeFormat);
		this.setIs24Hr(response && response.timeFormat === "HH24");
	},

	gotSystemPrefsFailure: function gotSystemPrefsFailure (from, response) {
		/* System preferences (timeFormat) service failure response handler.
		*/
		this.error ("---:---: Failed to retrieve system time format.\n\t", response);
	},

	gotSystemTime: function gotSystemTime (from, response) {
		/* System time service success response handler.
		*/
		var tzId = response.timezone;
		DEBUG && this.log ("---:---: Got system time? ", tzId);
		this.tzId != tzId ? this.setTzId (tzId) : this.watchClock (true);
	},

	gotSystemTimeFailure: function gotSystemTimeFailure (from, response) {
		/* System time service failure response handler.
			NOTE: enyo Mock service supplies mock data when "returnValue: true" isn't specified and merged into the returned results. bug?
		*/
		this.error ("---:---: Failed to retrieve system time.\n\t", response);
	},

	loadLibraries: function loadLibraries (global) {
		// Loads Calendar app's required libraries using MojoLoader:

		var libsInfo =
		[	{	name	: "calendar"			// TODO: Create enyo-compatible version.
			,	ourName	: "Calendar"
			,	version	: "1.0"
			}
//		,	{	name	: "unittest"
//			,	ourName	: "UnitTest"
//			,	version	: "1.0"
//			}
//		,	{	name	: "network.alerts"		// Replaces ConnectionWidget which wasn't used.
//			,	ourName	: "NetworkAlerts"		// Will need for send by bluetooth and before
//			,	version	: "1.0"					// launching account login view.
//			}
		];

		var results	= { pass: [], fail: [] };
		global		= global || enyo.global || this.valueOf.apply() || this;			// Get a reference to the global scope

		// Attempt to load as many libraries as possible even if failures occur:
		libsInfo.forEach (function loadEachLibrary (info) {
			try {
				var lib = MojoLoader.require (info);

				if (info.ourName) {

					if ("UnitTest" === info.ourName) {
						global [info.ourName] = (global.Mojo || (Mojo={})).Test = lib [info.name].UnitTest;

					}  else {
						global [info.ourName] = lib [info.name];
					}
				}
				results.pass.push (info.ourName ? info.ourName : info.name);
			} catch (e) {
				results.fail.push (info.ourName ? info.ourName : info.name);
				e.stack && console.error (e.stack);
			}
		});
		if (results.pass.length) {
			DEBUG && this.log ("---:---: Successfully loaded libraries: ", results.pass);
		}
		if (results.fail.length) {
			this.error ("---:---: Failed to load libraries: ", results.fail);
		}
		global.Calendar && (EventManager = Calendar.EventManager);
		return results;
	},//END:loadLibraries()

	watchClock: function defineWatchClock (keepGoing) {
		function watchClock (keepGoing) {
			/* Observes time changes and updates watchers.
			*/

			top.clearTimeout (watchClock.thread);											// Clear any pre-existing watchClock timeout threads.
			if (keepGoing === false) { return; }											// If asked to stop, don't setup a new watchClock call.
			var	date	= new Date()
			,	delay	= ((60 - date.getMinutes()) * 60000) - (date.getSeconds() * 1000)	// Calculate the milliseconds between now and the next hour
			;
			watchClock.thread = top.setTimeout (watchClock, delay);							//		then delay watchClock until then.

			enyo.application.share ({clock: {data: date, keep: true}});											// Share the current date and time with clock watchers.
		}
		var self		= this;			// Cache local reference to "this" used by local watchClock.
		this.watchClock	= watchClock;	// Reassign this.watchClock to local watchClock closure.
		watchClock (keepGoing);			// First and only direct execution of local watchClock.
	}

});//END:calendar.App
