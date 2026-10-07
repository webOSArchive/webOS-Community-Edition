/**
NOTES:
	- This is the Calendar App's GUI starting point and control script for calendar.html.

TODOs:
	- PLAN	: Move FirstUse to AppView as a pane; should be called FirstLaunch to avoid confusion with actual FirstUse process & app.
	- Only run tests if "test" launch or URL param is present.
**/
(function initializeCalendarView (window, undefined) {

	var	DEBUG			= !!this.DEBUG		// Inherit any globally defined DEBUG state.
	,	enyoApp			= enyo.application
	,	firstLaunchView
	;

	DEBUG && console.log ("\tAPP WINDOW VISIBLE\t"+ (timing.start+Date.now()) +"\t\tPERF\t");

	var firstLaunchWatcher =
	{	firstLaunch:
		{	name	: "firstLaunchWatcher"
		,	setFirstLaunch: function setFirstLaunch (firstLaunch) {
				showView		(firstLaunch);									// If we are going to show the main view, do so first before destroying First Launch (perf).
				if (!firstLaunch && firstLaunchView) {							
					!firstLaunchView.destroyed && firstLaunchView.destroy();			//		Destroy first Launch.
					firstLaunchView = undefined;
				}
			}
		}
	};

	function showView (isFirstLaunch) {
		var view;

		if (isFirstLaunch) {													// If this is the Calendar application's first launch:
			view = firstLaunchView = new calendar.FirstLaunchView();					//		Create the First Launch view.
		} else {																// Otherwise:
			enyoApp.ignore	(firstLaunchWatcher);										//		Ignore First Launch changes.
			view = new calendar.AppView();										//		Create the main view.
		}
		view.renderInto	(window.document.body);									// Display the created view.
	}

	window.addEventListener ("unload", function cleanupCalendarViewInitialization () {
		enyoApp.ignore (firstLaunchWatcher);
	}, false);

	enyoApp.watch (firstLaunchWatcher);											// Watch to see which view to load into the main window.

})(this);
