
var DEBUG = !!(enyo.args && enyo.args.debug);	// Define global DEBUG state used by all modules. TODO: move to AppComponent.debug.

enyo.depends
(	"$enyo-lib/accounts/"
,	"libs/DataHub.js"
,	"libs/date.js"								// Okay because DateJS now avoids multiple instantiation thereby avoiding the Date.toString() stack overflow issue.
,	"libs/Mojo.Core.Service.js"					// Required by MojoLoaded calendar 1.0 library.
,	"libs/Mojo.Service.Request.js"				// Required by MojoLoaded calendar 1.0 library.
,	"app/App.js"
,	"app/AppIcon.js"
,	"app/AppLaunch.js"
,	"app/shared/BusyFreeManager.js"
,	"app/shared/CacheManager.js"
,	"app/shared/CalendarEvent.js"
,	"app/shared/CalendarsManager.js"
,	"app/shared/DatabaseManager.js"
,	"app/shared/LayoutManager.js"
,	"app/shared/LunaAppManager.js"
,	"app/shared/PrefsManager.js"
,	"app/shared/ReminderManager.js"
,	"app/shared/Utilities.js"
);
