/* Copyright 2011 Palm, Inc.  All rights reserved. */

/*jslint laxbreak: true, white: false */
/*global CalendarsManager, DatabaseManager, Mojo
*/

function PrefsManager () {
	this.databaseManager 	= enyo.application.databaseManager;
	this.calendarsManager	= enyo.application.calendarsManager;
	this.gotPrefs			= enyo.bind (this, this.gotPrefs);
	this.readPrefsFailed	= enyo.bind (this, this.readPrefsFailed);
	this.savedPrefs			= enyo.bind (this, this.savedPrefs);
	this.readPrefs();
}

PrefsManager.prototype.plog = function plog(str){
	//console.info("====== PrefsManager: "+str);
};

PrefsManager.prototype.getPrefs = function getPrefs () {
	return this.prefs;
};

PrefsManager.prototype.readPrefs = function readPrefs (options) {
	if (options && options.fromDB) {
		this.prefs = null;						// Clear local cache of preferences.
		enyo.application.free ({prefs:true});	// Free any previously shared preferences that were kept.
	}
	if (this.prefs) {
		//this.plog("readPrefs: returning pre-exising prefs: "+JSON.stringify(this.prefs)); 
		enyo.application.share ({prefs: {data: this.prefs, keep: true}});
		return; 
	}
	if (!this.defaultPrefs._kind) {
		this.defaultPrefs._kind = enyo.application.databaseManager.calendarPrefsTable;
	}
	//this.plog("readPrefs: getting prefs from db");
	this.readRequest = this.databaseManager.getCalendarPrefs (this.gotPrefs, this.readPrefsFailed);
};

PrefsManager.prototype.readPrefsFailed = function readPrefsFailed (response) {
	console.log("Reading preferences failed! "+JSON.stringify(response));
};
			
PrefsManager.prototype.gotPrefs = function gotPrefs (response) {
	//this.plog("gotPrefs: "+JSON.stringify(response));
	var	fmts				= new enyo.g11n.Fmts()
	,	localeStartOfWeek	= fmts.getFirstDayOfWeek() + 1
	,	results				= response && response.results
	,	resultsLength		= results && results.length
	,	saveToDB			= false
	;

	if (resultsLength === 0) {
		// No preferences exist in the db so create defaults:
		this.prefs = this.defaultPrefs;
		//this.plog("gotPrefs: using default prefs");
		this.prefs.startOfWeek = localeStartOfWeek;
		saveToDB = true;
	}
	else {
		this.prefs = results[0];
		//this.plog("gotPrefs: using db prefs");
	}

	if(resultsLength > 1){
		var latestPrefIndex = 0;
		var latestPrefRev = results[0]._rev;
		var idsToDelete = [results[0]._id];
		//find the latest one
		for(var i = 1; i < resultsLength; i++){
			var rev = results[i]._rev;
			idsToDelete.push(results[i]._id);
			if(rev > latestPrefRev){
				latestPrefIndex = i;
				latestPrefRev = rev;
			}
		}
		this.prefs = results[latestPrefIndex];
		//this.plog("gotPrefs: spare prefs in the db!");
		idsToDelete.splice(latestPrefIndex, 1);

		//delete the spares
		this.databaseManager.deleteByIds(idsToDelete, this.deleteCB, this.deleteCB);
	}

	if (this.prefs.startOfWeek != localeStartOfWeek && !this.prefs.userChangedStartOfWeek) {
		//if system start of week is not the same as ours, and it's not because the user changed it, update our start of week.
		//don't notify, because notification will happen at the end of saveToDB.
		this.prefs.startOfWeek = localeStartOfWeek;
		saveToDB = true;
	}

	if (saveToDB) {
		//this.plog("gotPrefs: saving prefs");
		this.savePrefs (this.prefs);
	}

	enyo.application.share ({prefs: {data: this.prefs, keep: true}});
};

PrefsManager.prototype.deleteCB = function deleteCB(response){
	//this.plog("Spares deleted: "+JSON.stringify(response));
};
	
PrefsManager.prototype.savePrefs = function savePrefs (prefs) {
	if(!prefs) { 
		//this.plog("savePrefs: asked to save, but no prefs supplied");
		return; 
	}
	this.prefs = prefs;
	//this.plog("savePrefs: saving: "+JSON.stringify(prefs));
	this.saveRequest = this.databaseManager.setCalendarPrefs (this.prefs, this.savedPrefs, this.savedPrefs);
};	
		
PrefsManager.prototype.savedPrefs = function savedPrefs (response) {
	// Release the db service request:
	if (!response.returnValue || !response.results.length) {
		console.error ("Calendar preferences not saved! "+JSON.stringify(response));
		return;
	}				
	
	//this.plog("savedPrefs: "+JSON.stringify(response));
	// Update the _id and _rev fields of the cached preferences so subsequent updates will succeed:
	var results		= response.results[0];
	this.prefs._id	= results.id;
	this.prefs._rev = results.rev;

	//Notify observers
	enyo.application.share ({prefs: {data: this.prefs, keep: true}});
};
	
// *** DEFAULT CALENDAR ***
PrefsManager.prototype.validateDefaultCalPref = function validateDefaultCalPref () {
	//this.plog("validateDefaultCalPref");

	if (!this.prefs){ return; }
	var prefsChanged = false;
	var calMgr = enyo.application.calendarsManager;
	var defaultCalId = this.prefs.defaultCalendarID;
	var calId;
	var cal;
	
	//Prior to July 2011, defaultCalendarID was a calendar database ID.  However, since during backup/restore, 
	//the id of a particular calendar is not the same, it was impossible to find the user's previously chosen
	//default calendar choice.  Thus, in July 2011, it was decided to store the defaultCalendarID as a 
	//few pieces of information that should uniquely identify a calendar, regardless of its database ID.
	//New defaultCalendarID format:
	// { UID: UID of the calendar from the transport, 
	//   name: name of the calendar,
	//   username: account username, 
	//   calendarId: calendar databse ID. Not used for comparison purposes, only for potentially easy lookup	
	// }
		
	//If defaultCalendarID has a value, determine if it's old format (a string) or new format (an object)
	//and try to match it to one of the existing calendars.
	if(defaultCalId){
		
		//If we have a defaultCalId, and it's a string, try to find a calendar with that database ID.  If it exists, convert the defaultCalId to the object format.	
		if(typeof defaultCalId == "string"){
			calId = defaultCalId;
			cal = calMgr.getCal(calId);
			if(cal){
				//defaultCalendarID is a string, and it matches an existing calendar database ID. Convert it to the new object format
				username = calMgr.getCalAccountUser(cal._id);
				this.prefs.defaultCalendarID = 
				{	UID: cal.UID
				,	calendarId: cal._id
				,	name: cal.name
				,	username: username		
				}
			}
			else{
				//defaultCalendarID is a string, but it does not match an existing calendar. Clear the value, so we know to use the autoDefaultCalendar.
				this.prefs.defaultCalendarID = null;
			}
			prefsChanged = true;
		}
		
		//If we have a defaultCalId, and it's an object string, try to find the calendar.		
		else if (typeof defaultCalId == "object") {
									
			//First look using the database ID.  If it exists, then the object is correct, and the default calendar pref is valid.
			calId = defaultCalId.calendarId;
			if (!calId || !calMgr.getCal(calId)) {
				
				//If it doesn't exist, search the existing calendars for a match by comparing UID, username, and name.
				var calList = calMgr.getCalendarsList({excludeReadOnly: true, sorted: true});
				var numCals = calList && calList.length;
				var username;
				for(var i = 0; i < numCals; i++){
					cal = calList[i];
					username = calMgr.getCalAccountUser(cal._id);
					username = username && username.toLowerCase();
					defaultUsername = defaultCalId.username && defaultCalId.username.toLowerCase();
					//if our default calendar info matches an existing calendar but with a different id, use that calendar as the default.
					//Set the calendarId to the right value, and the default calendar pref is valid.
					if(cal.UID == defaultCalId.UID && cal.name == defaultCalId.name && username == defaultUsername){
						this.prefs.defaultCalendarID = 
						{	UID: cal.UID
						,	calendarId: cal._id
						,	name: cal.name
						,	username: username		
						}
						prefsChanged = true;
						break;
					}					
				}
				//If we made it through the whole list without breaking, then we didn't find the calendar. 
				//Clear the value, so we know to use the autoDefaultCalendar.
				if(i == numCals){
					this.prefs.defaultCalendarID = null;
					prefsChanged = true;
				}
			}
		}
	}
	
	if (this.prefs.autoDefaultCalendarID !== 0) {
		if (this.calendarsManager.getCalName(this.prefs.autoDefaultCalendarID) === undefined) {
			//this.plog("validateDefaultCalPref: autoDefaultCalendarID is no longer available");
			// The calendar the app chose to be the default is no longer there			
			this.prefs.autoDefaultCalendarID = 0;
			prefsChanged = true;
		}
	}

	if (prefsChanged) {
		// Save updated preferences to the database:
		this.savePrefs(this.prefs);
	}
};

PrefsManager.prototype.getDefaultCalendar = function getDefaultCalendar () {
	//this.plog("getDefaultCalendar: defaultCalendarId: "+ this.prefs.defaultCalendarID + "autodDefaultCalendarId: " +this.prefs.autoDefaultCalendarID);

	if (!this.prefs.defaultCalendarID) {
		// The user hasn't manually set the default calendar, so let's use
		// some smarts to figure this one out
		if (this.prefs.autoDefaultCalendarID === 0) {
		// If there is a calendar account other than Local, let's use that one
			var nonLocalCalId = this.calendarsManager.getNonLocalCalendarId(true /*excludeReadOnly*/);
			if (nonLocalCalId !== 0) {
				//this.plog("getDefaultCalendar: Found a non-local calendar");
				// Save the setting so the same calendar is returned as default next time
				this.prefs.autoDefaultCalendarID = nonLocalCalId;
				// Save the updated autoDefaultCalendarID calendar preference to the database:
				this.savePrefs (this.prefs);
			} else {
				//this.plog("getDefaultCalendar: Could not find a non-local calendar");
				// If there is no non-local account we return the local calendar, but
				// DO NOT save it in the prefs
				return this.calendarsManager.getLocalCalendarId();
			}
		}
		return this.prefs.autoDefaultCalendarID;
	} else {
		if(typeof this.prefs.defaultCalendarID == "string"){
			return this.prefs.defaultCalendarID;
		}
		else{
			return this.prefs.defaultCalendarID.calendarId;
		}
			
	}
};

PrefsManager.prototype.alarmSoundOptions =
{	mute		: 0
,	systemSound	: 1
,	ringtone	: 2
,	vibrate		: 3
};

PrefsManager.prototype.defaultPrefs =
{	_kind						: null			// Should be DatabaseManager.calendarPrefsTable, but DatabaseManager may not yet be defined.
,	alarmSoundOn				: 1				// systemSound
,	autoDefaultCalendarID		: 0
,	defaultAllDayEventReminder	: "-P1D"
,	defaultCalendarID			: 0
,	defaultEventDuration		: 60
,	defaultEventReminder		: "-PT15M"
,	endTimeOfDay				: -111599994	// This is based on UTC
,	isFirstUse					: true
//,	nextLaunch					: "last"		// Remember last used view. Other values are agenda, day, week, and month.
,	startOfWeek					: 1				// Sunday
,	startTimeOfDay				: -226799992	// This is based on UTC
,	userChangedStartOfWeek		: false
};
