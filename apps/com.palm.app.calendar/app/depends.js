
var DEBUG = !!(enyo.args && enyo.args.debug);	// Define global DEBUG state used by all modules. TODO: move to AppComponent.debug.

enyo.depends
(	"$enyo-lib/accounts/"
,	"$enyo-lib/addressing/"
,	"$enyo-lib/contactsui/"
,	"../libs/date.js"							// Okay because DateJS now avoids multiple instantiation thereby avoiding the Date.toString() stack overflow issue.
,	"shared/SimpleTransition.js"					// We need to include the custom transition before AppView.js
,	"shared/HoursScroller.js"						// webOS CE: before day/ and week/, which use it
,	"AppMenu.js"
,	"AppView.css"
,	"AppView.js"
,	"header/CalendarList.css"
,	"header/CalendarList.js"
,	"day/"
,	"month/"
,	"week/"
//,	"edit/"
,	"edit/ContactView.js"
,	"edit/DeleteConfirm.js"
,	"edit/RepeatChangeConfirm.js"
,	"edit/EditView.css"
,	"edit/EditView.js"
,	"edit/TimeSelectView.js"
,	"edit/AttendeesView.js"
,	"edit/RepeatView.js"
,	"edit/RepeatView.css"
,	"edit/DetailView.js"
,	"edit/DetailView.css"
,	"firstLaunch/FirstLaunchView.js"
//,	"prefs/"
,	"prefs/PreferencesView.css"
,	"prefs/PreferencesView.js"
,	"reminders/MissedRemindersView.js"
,	"shared/CalendarEvent.js"
,	"shared/MeetingTimeFormatter.js"
,	"shared/FormatterCache.js"
,	"shared/JumpToView.js"
,	"shared/Utilities.js"
);
