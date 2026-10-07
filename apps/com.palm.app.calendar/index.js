/**
NOTES:
	- This is the Calendar app's starting point and control script for index.html.

TODOs:
	- Only run tests if "test" launch or URL param is present.
**/
(function initializeCalendarApp (global, undefined) {

	var DEBUG = !!this.DEBUG;		// Inherit any globally defined DEBUG state.

	function begin () {
		initializeTiming (true);

		enyo.application.appLaunch = enyo.application.appLaunch || new calendar.AppLaunch();				

		// initializeUtils();
		// initializeTests();
		initializeTiming (false);
	}

	function initializeTests () {
		// TODO: Only run tests if "test" launch or URL param is present.
		enyo.loadScript && enyo.loadScript ("tests/testContactsManager.js");
	}

	function initializeTiming (start) {
		if (!start) {
			DEBUG && console.log	("===:===: Calendar app initialized\t: ".toUpperCase() + (timing.start+Date.now()) +" ms");
			return;
		}
		DEBUG && console.log	("===:===: Calendar app resources loaded\t: ".toUpperCase() + (timing.start+Date.now()) +" ms");

		global.document && document.addEventListener ("DOMContentLoaded", function calendarDOMLoaded () {
			DEBUG && console.log ("===:===: Calendar app DOM loaded\t: ".toUpperCase() + (timing.start+Date.now()) +" ms");
		});

		global.window && window.addEventListener ("load", function calendarViewLoaded () {
			// console.profileEnd && console.profileEnd ("calendar"); 
			DEBUG && console.log ("===:===: Calendar app GUI loaded\t: ".toUpperCase() + (timing.start+Date.now()) +" ms");
		});
	}

	function initializeUtils () {
		LogsConfig =
		[	{	host	: global
			,	config	:
				{	prepend	:	"\n\n===:===: Calendar: "
				,	append	:	"\n\n"
				,	level	:	"log"
				}
			}
		];
		enyo.loadScript && enyo.loadScript ("libs/Logger.js");
	}

	begin();

})(this);//End: initializeCalendarApp()
