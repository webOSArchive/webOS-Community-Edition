/* Copyright 2010 Palm, Inc.  All rights reserved. */

/*
 * DateRange
 * {	Date	start
 * ,	Date	end
 * ,	String	tzId
 * ,	String	calendarId
 * ,	Object	excludeList
 * }
 */

/*jslint browser:true, devel:true, laxbreak:true, white:false */
/*global _, Class, DB, exports, EventManager:true, Future, Foundations, ObjectUtils, RRuleManager, TimezoneManager, PalmCall */

//------------------------------------------------------------------------------------
var EventManagerUtils = Class.create ({
	
	/** Performance Notes:
	 * - Month View is slowed 60% by findRepeatsInRange().
	 * - Month View is slowed 40% by getEventRenderTimes().
	 */

	initialize: function(){
		this.timezoneManager= new TimezoneManager();
		this.rruleManager	= new RRuleManager();
		this.noOccurrences	= [];
	},
	
	logLevels:  
	{
		repeatDetails	: 0x00000001,
		dateDetails		: 0x00000010,
		responses		: 0x00000100,
		singleEvents	: 0x00001000,
		renderTimes		: 0x00010000,
		tzLoading		: 0x00100000,
		getBusyDays		: 0x01000000,
		timeout			: 0x10000000,
		all				: 0x11111111
	},
		
	evlog: function(level, string){
//		this.logging = true;
//		var filterLevel = this.logLevels.all;
//		if((filterLevel & level) > 0){
//			console.info("========== eventmgr: "+string);	
//		}		
	},

	getGEIRTimeLimit: function(){
		return this.GEIRTimeLimit;
	},
	
	setGEIRTimeLimit: function(val){
		this.GEIRTimeLimit = val;
	},

	sortByStartTime: function(a, b){
		return a.renderStartTime - b.renderStartTime;
	},

	/*
	 * Loops through the eventSet and finds each unique timezone id listed, and loads
	 * then prompts the timezone manager to load those timezones.  It's assumed that this
	 * will happen on boot when we do the initial query for all events, and that's when the
	 * bulk of the timezone info will be acquired, so we shouldn't have to wait very often for
	 * timezone manager service calls to come back.
	 */
	loadTimezones: function(eventSet){
		//this.evlog(this.logLevels.tzLoading, "In loadTimezones");
		if(!eventSet || eventSet.length === 0){
			return;
		}			
				
		var tzIds = this.getUniqueTzIdsInEventSet(eventSet);
		//this.evlog(this.logLevels.tzLoading, "loadTimezones: tzIds: "+JSON.stringify(tzIds));

		var future = this.timezoneManager.setup();

		future.then(this, function(){
			var result = future.result;
			future.result = this.timezoneManager.loadTimezones(tzIds);
		});

		return future;
	},
	
	/*
	 * Given a range, finds all the years included between range.start
	 * and range.end, and returns an array of years.  For use in conjunction
	 * with timezone manager requests.
	 */
	getYearsInRange: function(range){
		var timeMachine = new Date();
		if(!range){
			var currentYear = timeMachine.getFullYear();
			//this.evlog(this.logLevels.tzLoading, "getYearsInRange: using current year: "+ currentYear);
			return [currentYear]; 
		}
		
		timeMachine.setTime(range.start);
		var rangeStartYear = timeMachine.getFullYear();
		
		timeMachine.setTime(range.end);
		var rangeEndYear = timeMachine.getFullYear();
		//this.evlog(this.logLevels.tzLoading, "getYearsInRange: range: "+ rangeStartYear + " - " + rangeEndYear);
				
		if(rangeStartYear === rangeEndYear){
			return [rangeStartYear];
		}
		
		var years = [];		
		for(var i = rangeStartYear; i <= rangeEndYear; i++){
			years.push(i);
		}
		
		//this.evlog(this.logLevels.tzLoading, "getYearsInRange: years: "+ JSON.stringify(years));
		return years;
	},
	
	/*
	 * Given an event set, finds each unique timezone id in the set
	 * and returns an array of timezone ids.
	 */
	getUniqueTzIdsInEventSet: function(eventSet){
		var temp = [];
		var tzIds = [];
		var eventsLength = eventSet.length;
		for(var i = 0; i < eventsLength; i++){
			var event = eventSet[i];
			var tzId = event.tzId;
			if(tzId && !temp[tzId]){
				tzIds.push(tzId);
				temp[tzId] = true;
			}
		}
		//this.evlog(this.logLevels.tzLoading, "getUniqueTzIdsInEventSet: tzIds: "+ JSON.stringify(tzIds));
		return tzIds;
	},
			
	/*
	 * occursInRange: tests non-recurring events to see if they occur within the specified range 
	 * @param event: a non-recurring event
	 * @param range: a date range object. Start and end of range is expected to be in device local time.
	 * @returns: true if the event does occur during the specified range
	 */
	occursInRange: function(event, range){

		var eventOccurs = false;
		var startRangeTz = range.start;
		var endRangeTz = range.end;

		//For non-repeating events, the current occurrence is the only occurrence,
		//and a timestamp is a timestamp.
		event.currentLocalStart = event.dtstart;
		event.currentLocalEnd = event.dtend;
		
		//this.evlog(this.logLevels.singleEvents, "occursInRange: range: "+new Date(range.start) + " - " + new Date(range.end));
		//this.evlog(this.logLevels.singleEvents, "occursInRange: event: "+new Date(event.currentLocalStart) + " - " + new Date(event.currentLocalEnd));
		
		//if this event ends at midnight, back it up to 23:59:59
		var startTime = new Date(event.currentLocalStart);
		var endTime = new Date(event.currentLocalEnd);
		//If it's a zero-time event, or some weird hours, don't do anything, it will show up as one day.
		//But if it's not a zero-time event, and it ends at midnight, we need to trim that last second off.
		var isZeroTime = (startTime.compareTo(endTime) === 0);
		if(!isZeroTime && endTime.getHours() === 0 && endTime.getMinutes() === 0 && endTime.getSeconds() === 0){
			event.currentLocalEnd = event.currentLocalEnd - 1000;
			//this.evlog(this.logLevels.singleEvents, "occursInRange: adjusted end time for all-day/midnight-ending event");
		}
		
		if (event.currentLocalEnd >= startRangeTz && event.currentLocalStart < endRangeTz) {
			//this.evlog(this.logLevels.singleEvents, "occursInRange: event occurs within range");
			eventOccurs = true;
		}

		return eventOccurs;
	},
	
	repeatEndedBeforeDate: function(rrule, countInfo, date){
		if((rrule && rrule.until && rrule.until < date) || 
			(countInfo && ((countInfo.until && countInfo.until < date) || (countInfo.estimateEnd && countInfo.estimateEnd < date)))){
			//this.evlog(this.logLevels.repeatDetails, "repeatEndedBeforeDate: true");
			return true;
		}
		return false;	
	},
	
	estimateRepeatEnd: function(event){
		var freq = event.rrule.freq;
		var interval = parseInt(event.rrule.interval, 10) || 1; //convert to number from string otherwise this will get concatenated as string
		var count = parseInt(event.rrule.count, 10);
		var bonusPadding = 3;  //This is random, we're being generous in our estimate
		var base;
		var timeMachine = new Date(event.dtstart);
		switch(freq){
			case "DAILY":
				base = 1;
				break;
			case "WEEKLY":
				base = 7;
				break;
			case "MONTHLY":
				base = 31;
				if(timeMachine.getDate() == 31){  //Is this repeating 31st of the month?
					base = base * 2;
				}
				break;
			case "YEARLY":
				base = 366;
				if(timeMachine.getMonth() == 1 && timeMachine.getDate() == 29){  //Is this feb 29?
					base = base * 4;
				}
				break;
		}
				
		var daysRepeatCycleSpans = base * interval * (count + bonusPadding);
		timeMachine.addDays(daysRepeatCycleSpans);
		//this.evlog(this.logLevels.repeatDetails, "Estimated end date: "+timeMachine);		
		return timeMachine.getTime();
	},
	
	countPrep: function countPrep(event){
		var countInfo = event.countInfo;
		
		if(!countInfo){
			event.countInfo = {};
			countInfo = event.countInfo;
		}
		
		//get a worst-case ballpark end time
		if(!countInfo.estimateEnd){
			countInfo.estimateEnd = this.estimateRepeatEnd(event);				
		}
	},
	
	basicRangeTests: function basicRangeTests (event, range){
		//Before we do any real work, if our event didn't start until 48 hours after the range ends, we're not even bothering.
		//We picked 48 hours because that should be more than enough to account for any timezone and DST shifting issues.
		if(event.dtstart > (range.end+172800000)){
			//this.evlog(this.logLevels.repeatDetails, "basicRangeTests: nowhere close, event hasn't started yet");
			return false;
		}

		if(event.rrule && event.rrule.count){
			if(!event.countInfo){
				this.countPrep(event);	
			}
			if(event.countInfo.estimateEnd < range.start){
				//this.evlog(this.logLevels.repeatDetails, "basicRangeTests: exit: estimated end is before range starts");
				return false;
			}
		}
		//Similarly, if our event ended at least 48 hours before the range started, we're not even bothering.
		else if(event.rrule && event.rrule.until){
			if (event.rrule.until < (range.start - 172800000)) {
				//this.evlog(this.logLevels.repeatDetails, "basicRangeTests: nowhere close, event already ended");
				return false;
			}
		}	
		return true;
	},
	
	allDayAdjustment: function allDayAdjustment(start, end, timeMachine){
		//some special handling for all day events.  If it's listed as midnight to midnight,
		//our getDatesInRange will show it on two dates, when it's really only one.
		//So we need to trim that last second off before finding dates in the event.
		if(!timeMachine){
			timeMachine = new Date();
		}
		
		var startTime = timeMachine.setTime(start);
		var endTime = timeMachine.setTime(end);
		var endDate = timeMachine;
			
		//If it's a zero-time event or some weird hours, don't do anything, it will show up as one day.
		//But if it's not a zero-time event, and it ends at midnight, we need to trim that last second off
		//before we go figure out the dates in the event.
		var isZeroTime = (startTime == endTime);
		if(!isZeroTime && endDate.getHours() === 0 && endDate.getMinutes() === 0 && endDate.getSeconds() === 0){
			end = end - 1000;
			//this.evlog(this.logLevels.repeatDetails, "allDayAdjustment: adjusting for allday event");
		}
		return end;
	},
	
			
	/*
	 * findRepeatsInRange: finds all occurrences of an event within the specified range.
	 * @param event: the event to find the recurrences of
	 * @param range: the range in which to find the recurrences. Range is assumed to be in the device's local time
	 * @param limit: optional. number of results to limit the response to.
	 * @returns: an array of events.  Each event will be a copy of the original, but with the current occurrences' local and tz times set. 
	 */
	findRepeatsInRange: function(event, range, limit){
		//this.evlog(this.logLevels.repeatDetails, "=======================FIND REPEATS IN RANGE==========================================");
		
		//Broad view of what's going on here:
		//Pass in the local range and the event
		//Convert the local range to the event tz range
		//Since RRULE evaluation is done by DAY, we need to break the range into separate dates.
		//If the event spans across days, it's possible it started earlier and spans into the range, 
		//so scoot the beginning of the range back by the number of days the event spans, so we
		//find the start of the event.
		
		//For each date in the range, test if the event could have started on that day
		//When a repeat is found, determine the start & end of the occurrence in the event
		//Test the occurrence times against the original range.  If within, add to list
				
		//RRULE evaluation works by whole dates, so we find all the dates contained by the 
		//range.  We only have to find parts where the event starts.
		
		//Since javascript only supports local time, and the RRule evaluation uses the Date object to find
		//various pieces of data like day of week, the 'getDatesInRange' function converts the timestamps
		//into the 'concept equivalent' of that date in the local timezone. 'Concept equivalent' meaning 
		//that if the timestamp represents Wednesday, 27 Jan 10pm in New York, the timestamp we get back
		//from getDatesInRange is Wednesday, 27 Jan 10pm in the local timezone, so we can call new Date()
		//on it and test if it's a Wednesday. 
		
		//getDatesInRange does conversion from the event's timezone to the current timezone so the 
		//"CONCEPT" of the date is the same, and later calling functions can use new Date()
		//and be dealing with the numbers they need, even though it's not an accurate timestamp.
			
		//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: range: "+new Date(range.start) +" - " + new Date(range.end));
		//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: event: "+new Date(event.dtstart) +" - " + new Date(event.dtend));

		//Test against the range. Maybe we don't repeat anywhere near this range, and don't have to do any work
		var keepGoing = this.basicRangeTests(event, range);
		if(!keepGoing){
			//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: didn't pass basic range tests");
			return this.noOccurrences;
		}
		
		// Single Date object to be reused for calculating multiple time (ms)
		// instances rather than expensively creating multiple Date instances.
		var timeMachine = new Date();
		
		//Start and end timestamps we can adjust without altering the original event
		var tempStart = event.dtstart;
		var tempEnd = event.dtend;

		//All-day events that are midnight-to-midnight need some adjustment  
		if(event.allDay){
			tempEnd = this.allDayAdjustment(tempStart, tempEnd, timeMachine);
		}
		
		//If the event spans across at least one midnight, we need to back up the beginning of the search range by
		//the number of days spanned		
		var datesInEvent = this.getDatesInRange({start: tempStart, end: tempEnd, tzId: event.tzId});
		var datesInEventSize = datesInEvent.length;
		var additionalRangeDaysNeeded = (datesInEventSize - 1);
		var searchRange = range;
		if(additionalRangeDaysNeeded){
			searchRange = Foundations.ObjectUtils.clone(range);
			timeMachine.setTime(range.start);
			timeMachine.addDays(-additionalRangeDaysNeeded);
			searchRange.start = timeMachine.getTime();
			searchRange.end = range.end;
			//remove any existing datesInRange on this range, since we just changed its value
			searchRange.datesInRange = undefined;
			//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: event spans midnights, adjusting range to "+new Date(searchRange.start) +" / "+new Date(searchRange.end));
		}
						
		//We need the 'CONCEPT' time of this event so we can set the hours and minutes on a date from datesInRange
		var eventStartDate = this.timezoneManager.convertTime(event.dtstart, this.timezoneManager.getSystemTimezone(), event.tzId);
		eventStartDate = timeMachine.setTime (eventStartDate) && timeMachine;
		var eventStartHours = eventStartDate.getHours();
		var eventStartMinutes = eventStartDate.getMinutes();
		
		//datesInRange holds 'CONCEPT' dates.  We calculate this once for each range/tzId and cache it on the searchRange
		var datesInRange;
		if(!searchRange.datesInRange){
			searchRange.datesInRange = {};
		}		
		
		if(!searchRange.datesInRange[event.tzId]){
			datesInRange = this.getDatesInRange({start: searchRange.start, end: searchRange.end, tzId: event.tzId});
		}
		else{
			//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: reusing existing datesInRange");
			datesInRange = searchRange.datesInRange[event.tzId];
		}
		searchRange.datesInRange[event.tzId] = datesInRange;		
		
		//Now that we know more about the search range, test again: 
		//Has the event's repeat cycle even started yet?  Did its repeat cycle already end?
		if(event.dtstart > searchRange.end || this.repeatEndedBeforeDate(event.rrule, event.countInfo, searchRange.start)){
			//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: exit: repeat hasn't started yet or already ended");
			return this.noOccurrences;
		}
		
		var eventOccurrences = this.findRepeatsInRangeHelper(event, range, datesInRange, datesInEvent, eventStartHours, eventStartMinutes, limit, timeMachine);
		
		//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: number of occurrences returning: "+ eventOccurrences.length);
//		if(this.logging){
//			for(var x = 0; x < eventOccurrences.length; x++){
//				//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: occurrence["+x+"]: "+ new Date(eventOccurrences[x].currentLocalStart) + " / "+ new Date(eventOccurrences[x].currentLocalEnd));
//			}
//		}
				
		return eventOccurrences;
	},
	
	
	/*
	 * findRepeatsInRangeCountVersion: finds all occurrences of a count-based repeating event within the specified range.
	 * @param event: the event to find the recurrences of
	 * @param range: the range in which to find the recurrences. Range is assumed to be in the device's local time
	 * @returns: an array of events.  Each event will be a copy of the original, but with the current occurrences' local and tz times set. 
	 */
	findRepeatsInRangeCountVersion: function(event, range){
		//this.evlog(this.logLevels.repeatDetails, "=======================FIND REPEATS IN RANGE COUNT VERSION==========================================");
		
		//See findRepeatsInRange for a full explanation of the process.
		//
		
		//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRangeCountVersion: range: "+new Date(range.start) +" - " + new Date(range.end));
		//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRangeCountVersion: event: "+new Date(event.dtstart) +" - " + new Date(event.dtend));

		//The countInfo object holds information about count-based repeating events.
		//It's structure looks like this:
		// countInfo: {
		//		estimateEnd: timestamp - estimate of when the repeat cycle for this event will end
		//		occurrences: [currentLocalStartTimestamp1, currentLocalStartTimestamp2, ...] - an array of timestamps that
		//				represent the currentLocalStart times of the occurrences of this event.  It only holds the 
		//				occurrences we have calculated SO FAR. It may not be complete yet.  When occurrences.length == event.rrule.count, 
		//				then we have found all occurrences.  It is stored on the local copy of the object, not in the database. 
		// }
		
		
		//Test against the range. Maybe we don't repeat anywhere near this range, and don't have to do any work
		var keepGoing = this.basicRangeTests(event, range);
		if(!keepGoing){
			//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRangeCountVersion: didn't pass basic range tests");
			return this.noOccurrences;
		}
				
		//Temporary start and end timestamps we can adjust without altering the original event
		var tempStart = event.dtstart;
		var tempEnd = event.dtend;

		// Single Date object to be reused for calculating multiple time (ms)
		// instances rather than expensively creating multiple Date instances.
		var timeMachine = new Date();
		
		//All-day events that are midnight-to-midnight need some adjustment  
		if(event.allDay){
			tempEnd = this.allDayAdjustment(tempStart, tempEnd, timeMachine);
		}
				
		//We don't need to back up by any number of days, because our range begins from the event's dtstart.
		//But findRepeatsInRangeHelper needs these for testing.		
		var datesInEvent = this.getDatesInRange({start: tempStart, end: tempEnd, tzId: event.tzId});				
								
		//We need the 'CONCEPT' time of this event so we can set the hours and minutes on a date from datesInRange
		var eventStartDate = this.timezoneManager.convertTime(event.dtstart, this.timezoneManager.getSystemTimezone(), event.tzId);
		eventStartDate = timeMachine.setTime (eventStartDate) && timeMachine;
		var eventStartHours = eventStartDate.getHours();
		var eventStartMinutes = eventStartDate.getMinutes();
				
		//If we've tried to evaluate this event before on another range, we might have already populated a countInfo object
		var limit = parseInt(event.rrule.count, 10) || 1;
		var ci = event.countInfo;
		var found = ci && ci.occurrences;
		var numFoundSoFar = found && found.length;			
		var inRangeOccurrences = [];	
		
		//If we already have found some occurrences, see if any fall in the range.
		//If so, use the occurrences to reconstruct full events.  If we found enough -
		//meaning the full count, or until the end of the range - just return those. 
		//If we have to keep looking, use the last one we found to start the next search range
		if(numFoundSoFar){
			var lastFound = found[numFoundSoFar-1];
			var firstFound = found[0];
			
			//Are any of our already found occurrences within range?  If so, reconstruct into full events.
			if(lastFound <= range.end || firstFound >= range.start || (firstFound <= range.start && lastFound >= range.end)) {				
				inRangeOccurrences = this.reconstructOccurrences(event, ci.occurrences, range);
				
//				if(this.logging){
//					//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRangeCountVersion: reconstructed occurrences:");
//					for(var x = 0; x < inRangeOccurrences.length; x++){
//						//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRangeCountVersion: occurrence["+x+"]: "+ new Date(inRangeOccurrences[x].currentLocalStart) + " / "+ new Date(inRangeOccurrences[x].currentLocalEnd));
//					}
//				}				
			}
			
			//If we already found them all, we're done
			//If we've already searched past the end of the search range, we're done
			if (numFoundSoFar == limit || lastFound > range.end) {
				//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRangeCountVersion: found everything for this range already");
				return inRangeOccurrences;
			}
			
			//We need to keep looking. Start looking after the last one we found.
			timeMachine.setTime(lastFound);
			timeMachine.addDays(1);  //+1 day to skip past this occurrence and start looking for the next
			timeMachine.clearTime();
			tempStart = timeMachine.getTime();
			limit = limit - numFoundSoFar;
		}
		
		if(!event.countInfo){			
			console.error("===== Yikes, something is wrong, your countInfo disappeared for event: "+event._id);
			this.countPrep(event);
		}	
		var searchRange = {tzId: event.tzId, start: tempStart, end: Math.min(event.countInfo.estimateEnd, range.end), datesInRange: {}};
		//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRangeCountVersion: searchRange: "+searchRange.start +" / "+searchRange.end);
		//datesInRange holds 'CONCEPT' dates.  Can't cache here, since our range is custom for each event		
		var datesInRange = this.getDatesInRange({start: searchRange.start, end: searchRange.end, tzId: event.tzId});		
		
		var eventOccurrences = this.findRepeatsInRangeHelper(event, null, datesInRange, datesInEvent, eventStartHours, eventStartMinutes, limit, timeMachine);
//		if(this.logging){
//			//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRangeCountVersion: findRepeatsInRangeHelper returned:");
//			for(var x = 0; x < eventOccurrences.length; x++){
//				//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRangeCountVersion: occurrence["+x+"]: "+ new Date(eventOccurrences[x].currentLocalStart) + " / "+ new Date(eventOccurrences[x].currentLocalEnd));
//			}
//		}
			
		var occurrencesLength = eventOccurrences.length;
		var countInfo = event.countInfo;
		var instance;
		var occurrences = countInfo.occurrences || [];
		for(var i = 0; i < occurrencesLength; i++){
			//for each occurrence found, add the currentLocalStart timestamp to the occurrences array
			instance = eventOccurrences[i];
			occurrences.push(instance.currentLocalStart);
			
			//if this occurrence is within the range, add it to the array of events we'll return
			if (instance.currentLocalEnd >= range.start && instance.currentLocalStart < range.end) {
				delete instance.countInfo;
				inRangeOccurrences.push(instance);				
			}
		}
		//cache the occurrences on the event's countInfo object
		countInfo.occurrences = occurrences;
		
		//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRangeCountVersion: countInfo occurrences: "+ JSON.stringify(countInfo.occurrences));		
//		if(this.logging){
//			//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRangeCountVersion: found "+inRangeOccurrences.length+" inRange occurrences");
//			//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRangeCountVersion: inRangeOccurrences returning:");
//			for(var x = 0; x < inRangeOccurrences.length; x++){
//				//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRangeCountVersion: occurrence["+x+"]: "+ new Date(inRangeOccurrences[x].currentLocalStart) + " / "+ new Date(inRangeOccurrences[x].currentLocalEnd));
//			}
//		}
		
		return inRangeOccurrences;
	},
	
	reconstructOccurrences: function reconstructOccurrences(event, occurrences, range){
		var occLength = occurrences.length;
		var duration = event.dtend - event.dtstart;
		var inRangeOccurrences = [];
		var tempEvent;
		for(var i = 0; i < occLength; i++){
			var instanceStart = occurrences[i];
			if(instanceStart >= range.start && instanceStart <= range.end){
				tempEvent = ObjectUtils.clone (event);
				tempEvent.currentLocalStart = instanceStart;
				tempEvent.currentLocalEnd = instanceStart + duration;	
				inRangeOccurrences.push(tempEvent);			
			}
		}
		return inRangeOccurrences;
	},
	
	findRepeatsInRangeHelper: function findRepeatsInRangeHelper(event, range, datesInRange, datesInEvent, eventStartHours, eventStartMinutes, limit, timeMachine){
		var date;
		var nextMidnight;
		var eventStart;
		var repeatsOnDate;
		var dateOfOccurrence;
		var offset;
		var nextOccurrence;
		var occurrenceStartTimestamp;
		var occurrenceEndTimestamp;
		var	start;
		var start12AM;
		var end;
		var end12AM;
		var occurrenceTracker = {};
		var datesInRangeSize = datesInRange.length;
		var eventOccurrences = [];
		var numFound = 0;

		if (isNaN (limit)) {
			limit = 0;
		}
		if (!timeMachine) {
			timeMachine = new Date();
		}

		//evaluate each date in the range. 
		//NOTE: There's no way events could happen 2x in one day here, because we are in the event's timezone.
		for (var i = 0; i < datesInRangeSize; i++){
			var timeLimit = this.getGEIRTimeLimit();
			if(timeLimit && Date.now() >= timeLimit){
				console.error("Exceeded process time limit on event: "+event._id+" at date: "+i + " of "+datesInRangeSize);
				//this.evlog(this.logLevels.timeout, "=========================================================");
				//this.evlog(this.logLevels.timeout, "FRIRHelper: Exceeded time limit on event: "+event._id+" at date: "+i + " of "+datesInRangeSize);
				//this.evlog(this.logLevels.timeout, "=========================================================");			
				break;
			}
			date = datesInRange[i];
			//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: test date: "+new Date(date));
			
			//Did the event's repeat cycle already end?			
			if(this.repeatEndedBeforeDate(event.rrule, event.countInfo, date)){
				//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: exit: repeat already ended 2");
				continue;
			}

			//Has the event's repeat cycle even started yet?
			//webOS CE: date and nextMidnight are in the event's zone, so test the start in that zone.
			//dtstart is real time, which skips the first occurrence when that falls a day later here.
			if(i+1 != datesInRangeSize){
				nextMidnight = datesInRange[i + 1];
			}
			else{
				timeMachine.setTime(date);
				timeMachine.addDays(1);
				nextMidnight = timeMachine.getTime();
			}			
			
			if(datesInEvent[0] >= nextMidnight) {
				//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: exit: repeat hasn't started yet 2");
				continue;
			}		
			
			//evaluate each segment of the event
			eventStart = datesInEvent[0];
			//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: test event segment: "+new Date(eventStart));

			if(date < eventStart){
				//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: exit: repeat hasn't started yet 3");
				continue;
			}

			repeatsOnDate = this.rruleManager.evaluateRRule(date, eventStart, event.dtstart, event.rrule, event.exdates, event.tzId, event.countInfo);
			if (!repeatsOnDate) {
				//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: exit: doesn't repeat on this date");
				continue;
			}
			//If repeatsOnDate == -1, that means it repeated on that date, but it was an EXDATE.
			//So it counts as an occurrence, but we shouldn't return it to the caller
			if(repeatsOnDate === -1){
				numFound++;
				if (numFound === limit) {
					//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: hit limit");
					return eventOccurrences;
				}
				continue;
			}
			
			//this is the date the occurrence starts on
			timeMachine.setTime(datesInRange[i]);
			dateOfOccurrence = timeMachine;
			
			//datesInRange holds 'CONCEPT' dates.  If we're going to set hours and minutes on 
			//the concept date, we need the concept time too.
			//set the time
			dateOfOccurrence.setHours(eventStartHours);
			dateOfOccurrence.setMinutes(eventStartMinutes);
			dateOfOccurrence.setSeconds(0);
			dateOfOccurrence.setMilliseconds(0);

			// Convert it back to real time:
			offset		= this.findOffset (datesInRange [i], event.tzId);
			dateOfOccurrence= dateOfOccurrence.addMinutes (-offset);

			//TODO: Using the duration here could be a problem for DST boundaries.  
			//Example: An all day event on a DST boundary is suddenly an hour longer or shorter than it needs to be.
			//Example: An event that spans the DST change time
			occurrenceStartTimestamp= dateOfOccurrence.getTime();
			occurrenceEndTimestamp	= occurrenceStartTimestamp + (event.dtend - event.dtstart);

			//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: event occurs: "+new Date(occurrenceStartTimestamp) + " - " + new Date(occurrenceEndTimestamp));

			//Are the times within the original search range? (not the expanded search range)
			if(range && (!(occurrenceEndTimestamp >= range.start && occurrenceStartTimestamp < range.end))){
				continue;
			}

			nextOccurrence					= ObjectUtils.clone (event);
			nextOccurrence.currentLocalStart= occurrenceStartTimestamp;
			nextOccurrence.currentLocalEnd	= occurrenceEndTimestamp;

			//this.evlog(this.logLevels.dateDetails, "findRepeatsInRange: event occurs within range");
			// If this is a non-zero length allday event, and it ends at midnight, back it up to 23:59:59:
			if(nextOccurrence.allDay) {
				start		= timeMachine.setTime	(nextOccurrence.currentLocalStart);
				start12AM	= timeMachine.clearTime	().getTime();
				end			= timeMachine.setTime	(nextOccurrence.currentLocalEnd);
				end12AM		= timeMachine.clearTime	().getTime();

				if ((start !== end) && (end === end12AM) && (start === start12AM)) {
					nextOccurrence.currentLocalEnd -= 1000;
					//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: event occurs within range, adjusting all day event");
				}
			}

			if(this.repeatEndedBeforeDate(nextOccurrence.rrule, nextOccurrence.countInfo, nextOccurrence.currentLocalStart)){
				//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: repeat already ended 3");
				continue;
			}
			
			//Because we broke the range and event into separate dates, we might have found two sections 
			//that repeat that are actually the same occurrence.  So just check that we don't already have
			//this occurrence, and make a note in our occurrenceTracker if this is a new occurrence.
			//TODO: Is this still necessary? Without the second loop, it should be obsolete.
			if(occurrenceTracker[nextOccurrence.currentLocalStart] && 
				(occurrenceTracker[nextOccurrence.currentLocalStart] === nextOccurrence.currentLocalEnd)){
					//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: already found this occurrence");
					continue;
				}		
			else{
				occurrenceTracker[nextOccurrence.currentLocalStart] = nextOccurrence.currentLocalEnd;
			}	
								
			eventOccurrences.push (nextOccurrence);
			numFound++;
			if (numFound === limit) {
				//this.evlog(this.logLevels.repeatDetails, "findRepeatsInRange: hit limit");
				return eventOccurrences;
			}

		}
		
		return eventOccurrences;
	},
	
	/*
     * getEventRenderTimes: finds the start times within each day of the range for the specified event, and sets
     * event.renderStartTime and event.renderEndTime.
     * @param event: the event to find the start and end times for
     * @param dates: an array of timestamps representing midnight for each day in a range
     * @returns: an array of event objects cloned from the original event, with two added properties on each:
     *    renderStartTime: timestamp representing the start time of the event on in a particular day
     *    renderEndTime: timestamp representing the end time of the event on in a particular day
     *    Together, these two indicate the hours on a particular day during which the event happens.
     */
	getEventRenderTimes: function(eventArray, dates){
		var eventsByDay	= [];

		if (!(eventArray && eventArray.length && dates && dates.length)) {
			return eventsByDay;
		}

		var eventsLength = eventArray.length;
		var datesLength = dates.length;
		var lastDate = new Date(dates[dates.length - 1]).addDays(1).getTime();
		var date = new Date();					// Temp Date instance used for multiple timestamp calculations.
		for (var j = 0; j < eventsLength; j++) {
			var event = eventArray[j];		
			var start = (event.currentLocalStart < dates[0]) ? dates[0] : event.currentLocalStart;
			var end = (event.currentLocalEnd > lastDate) ? lastDate : event.currentLocalEnd;
			var midnights = [start];

			for(var i = 0; i < datesLength; i++){
				if (dates[i] > start && dates[i] < end) {
					midnights.push(dates[i]);
				}
			}		
			midnights.push(end);
			
//			if(this.logging){
//				for (i = 0; i < midnights.length; i++) {
//					//this.evlog(this.logLevels.renderTimes, "getEventRenderTimes: midnights: "+new Date(midnights[i]));	
//				}
//			}		
			
			var days = midnights.length -1;	// Number of days on which this event occurs.
			
			for (i = 0; i < days; i++) {
				var nextOccurrence = ObjectUtils.clone (event);
	
				if(event.allDay){
					// If this is an all-day event, set its render times to 12am to 23:59:59:
					nextOccurrence.renderStartTime	= date.setTime (midnights [i]) && date.clearTime().getTime();
					nextOccurrence.renderEndTime	= date.setTime (nextOccurrence.renderStartTime + 86399000);
				}
				else {
					nextOccurrence.renderStartTime	= midnights [i];
					nextOccurrence.renderEndTime	= midnights [i+1];
				}
			
				//this.evlog(this.logLevels.renderTimes, "getEventRenderTimes: occurrence: "+new Date(nextOccurrence.renderStartTime) +" - "+new Date(nextOccurrence.renderEndTime));	
	
				eventsByDay.push(nextOccurrence);
			}			
		}
					
		return eventsByDay;		
	},
	
    /* 
     * formatResponse: Takes an array of events and a range.
     * Sorts the events into separate arrays for regular events and all day events.
     * Splits these arrays into an array for each date in the date array.
     * @param events		: an array of events. Events are assumed to have renderStartTime and renderEndTime set by this point.
     * @param dates			: an array of dates
     * @param calendarId	: optional string. include only events with this calendarId in the results
     * @param excludeList	: optional object. This object is an associative array of calendarIds. If no calendarId was
     *						  supplied, any events whose calendarId is in this object will be excluded from the results.
     * @returns: an array of day objects:
     *		day =
			{	date		: dateOfDay
			,	events		: eventsInDay[]
			,	allDayEvents: allDayEventsInDay[]
			,	freeTimes	: []
			,	busyTimes	: []
			,	hiddenEvents: []
			,	hiddenAllDay: []
			} 
     */
	formatResponse: function (events, dates, calendarId, excludedCalendars){
		var	allDayEvents	= []
		,	datesLength		= dates.length
		,	day
		,	days			= []
		,	eventsLength	= events.length
		,	hiddenAllDay	= []
		,	hiddenEvents	= []
		,	i
		,	regularEvents	= [];

		// If we don't have any dates do nothing:
		if (!datesLength) {
			return;
		}

		// If the current calendar is an excluded calendar ignore all excluded calendars:
		var useExcluded = excludedCalendars && !(calendarId && excludedCalendars [calendarId]);

		// Split normal and hidden all-day and regular events into separate arrays:
		var event, isHidden;
		for (i = 0; i < eventsLength; i++){
			event = events[i];

			// Filter events by calendar id or excluded calendar:
			isHidden	=  ((calendarId && (calendarId != event.calendarId))
						||  (useExcluded && excludedCalendars [event.calendarId]));

			if (event.allDay) {
				(isHidden ? hiddenAllDay : allDayEvents).push (event);
			} else {
				(isHidden ? hiddenEvents : regularEvents).push (event);
			}
		}

		// If we only have one date, all events are on that day:
		if (datesLength == 1) {
			days.push(
			{	date		: dates[0]
			,	events		: regularEvents
			,	allDayEvents: allDayEvents
			,	freeTimes	: []
			,	busyTimes	: []
			,	hiddenEvents: hiddenEvents
			,	hiddenAllDay: hiddenAllDay
			});
			//this.evlog(this.logLevels.responses, "formatResponse: "+JSON.stringify(days));
			return days;
		}

		// We have no events so fill each day with empty sets:
		if (eventsLength === 0) {
			for (i = 0; i < datesLength; i++) {
				days.push(
				{	date		: dates[i]
				,	events		: []
				,	allDayEvents: []
				,	freeTimes	: []
				,	busyTimes	: []
				,	hiddenEvents: []
				,	hiddenAllDay: []
				});
			}
			//this.evlog(this.logLevels.responses, "formatResponse: "+JSON.stringify(days));
			return days;
		}		

		//Split the events into day arrays
		var allDayEventsByDay	= this.splitByDays (allDayEvents	, dates)
		,	eventsByDay			= this.splitByDays (regularEvents	, dates)
		,	hiddenByDay			= this.splitByDays (hiddenEvents	, dates)
		,	hiddenAllDayByDay	= this.splitByDays (hiddenAllDay	, dates);

		for(i = 0; i < datesLength; i++) {
			days.push(
			{	date		: dates[i]
			,	events		: eventsByDay[i]
			,	allDayEvents: allDayEventsByDay[i]
			,	freeTimes	: []
			,	busyTimes	: []
			,	hiddenEvents: hiddenByDay[i]
			,	hiddenAllDay: hiddenAllDayByDay[i]
			});
		}

		//this.evlog(this.logLevels.responses, "formatResponse: "+JSON.stringify(days));
		return days;
	},
	
	/* 
	 * Splits an array of events into separate arrays of events for each date in an array of dates.  
	 * The split is done based on the event.renderStartTime property.
	 * Each sub-array contains all the events for that date.
	 * @param eventsToSplit: an array of events. Events are assumed to have renderStartTime and renderEndTime set by this point.
	 * @param dates: an array of timestamps representing the date break points to split on
	 * @returns: an array of arrays of events
	 */
	splitByDays: function(eventsToSplit, dates){
		var datesLength = dates.length;
		var eventsToSplitLength = eventsToSplit.length;
		var sliceStartIndex = 0;
		var sliceEndIndex = 0;
		var eventIndex = 0;
		var dateIndex = 1;
		var eventsByDay = [];
		var events;
		
		while(dateIndex < datesLength && eventIndex < eventsToSplitLength){
			var event = eventsToSplit[eventIndex];
			//if(event && event.currentLocalStart >= dates[dateIndex]){
			if(event && event.renderStartTime >= dates[dateIndex]){
				if (eventIndex - 1 < 0) {
					events = [];
				}
				else {
					events = eventsToSplit.slice(sliceStartIndex, eventIndex);
				}

				eventsByDay.push(events);
				sliceStartIndex = eventIndex;
				dateIndex++;
			}
			else{
				eventIndex++;
			}
		}

		//We still have events left and we're on the last date
		if(eventIndex <= eventsToSplitLength){
			//get the last events			
			events = eventsToSplit.slice(sliceStartIndex);
			eventsByDay.push(events);
			dateIndex++;
		}
		
		//We ran out of events, and we have dates left to push empty arrays for.
		while (dateIndex <= datesLength) {
			eventsByDay.push([]);
			dateIndex++;
		}
		return eventsByDay;
	},
	
	
	findOffset: function(timestamp, tzId){
		var year = new Date(timestamp).getFullYear();
		var localTzId = this.timezoneManager.getSystemTimezone();
		var timeNoMillis = timestamp / 1000;
		var localOffsetFromUTCInSeconds = this.timezoneManager.getOffset(year, localTzId, timeNoMillis);
		var rangeOffsetFromUTCInSeconds = this.timezoneManager.getOffset(year, tzId, timeNoMillis);	
		var offsetFromLocalInSeconds = rangeOffsetFromUTCInSeconds - localOffsetFromUTCInSeconds;
		var offsetMinutes = offsetFromLocalInSeconds / 60;
		return offsetMinutes;
		
	},
	
	/*
	 * Takes a range and returns an array of timestamps representing midnight for each day contained in the range.
	 * MIDNIGHT IN THE RANGE'S TIMEZONE.
	 *
	 * Where do these dates end up:
	 *  - getEventRenderTimes - this expects midnight, but its supplied range also will always be local time, and so only goes through the first case.
	 *  - evaluateRRule:
	 *    - evaluateExceptions - does not care about midnight time, just wants a date, actually changes the time to be event start time. Currently contains
	 *            some awkward conversions between dates and strings, and dates and timezones to start with.        
	 *    - freqType**** - 
	 *      - used to calculate # of days between for interval
	 *      - uses properties of the date to test the rules (month, day of week, etc.)
	 *      - this must be the right number, type of day, etc, not a timestamp equivalent.
	 *
	 * @param range a date range object
	 * @returns an array of timestamps
	 */
	getDatesInRange: function (range){

///*DEBUG:*/	this.getDatesInRange.time = -new Date();
		//this.evlog(this.logLevels.dateDetails, "getDatesInRange: range: "+ new Date(range.start) +" - "+new Date(range.end));
		var	dates			= []
		,	startTimestamp	= range.start
		,	endTimestamp	= range.end
		,	localTzId		= this.timezoneManager.getSystemTimezone()
		;
		
		if (range.tzId != localTzId) {
			var	startOffset	= this.findOffset (startTimestamp, range.tzId)
			,	start		= new Date (startTimestamp);	
			start.setMilliseconds (0);	
			startTimestamp = start.addMinutes (startOffset);  //startTimestamp is now a Date
			//TODO: VERIFY DST DIDN'T CHANGE ON THIS DATE

			var	endOffset		= this.findOffset (endTimestamp, range.tzId)
			,	end				= new Date (endTimestamp)
			;	end.setMilliseconds (0)
			;	endTimestamp	= end.addMinutes (endOffset);  //endTimestamp is now a Date
			//TODO: VERIFY DST DIDN'T CHANGE ON THIS DATE
		}

		var midnight = ((new Date (startTimestamp)).set
		({	hour		: 0
		,	minute		: 0
		,	second		: 0
		,	millisecond	: 0
		}));
			
		var time;
		do
		{	dates.push (time || (time = midnight.getTime()));							// Save current midnight
			//this.evlog(this.logLevels.dateDetails, "getDatesInRange: dates: "+ new Date(time));
			midnight.addDays(1);
			time = midnight.getTime();
		}                                                                                                
		while (time < endTimestamp);                                                                     

///*DEBUG:*/	this.getDatesInRange.time += +new Date();

		return dates;
	},	
	 
	/*
	 * findBusyBlocksInDays: Takes the results of getEventsInRange, and converts it into a format used to construct a busyDays string.
	 * @param days: an array of days, the results of a call to getEventsInRange
	 * @param calendarId: the calendarId of the displayed calendar.  BusyTimes containing events in this calendar will be marked as such.
	 * @returns: an array of objects, one for each day in the days array, detailing if that day has an event at the beginning, middle, or end,
	 * any all day events, and if any of those events belong to the specified calendar.	 
	 */ 
	findBusyBlocksInDays: function (days, calendarId)
	{	
		// Beginning interval : 12am - 12pm 
		// Middle interval : 12pm - 5pm
		// End interval :  5pm - 12am
		var MORNING_ENDS = 12;
		var MIDDAY_ENDS = 17;	
		var eventDays = [];
		var daysLength = days.length;
		var timeMachine = new Date();
		//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays begin");
		for(var i = 0; i < daysLength; i++){
			
			//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: date: "+new Date(days[i].date));
			var midnight = days[i].date;
			var oneAm = midnight + 3600000;		
			var eventDay = {allDay: false, beg: false, mid: false, end: false, calAllDay: false, calBeg: false, calMid: false, calEnd: false};
						
			var allEvents = days[i].allDayEvents.concat(days[i].hiddenAllDay, days[i].events, days[i].hiddenEvents);
			
			var eventsLength = allEvents.length;
			var maxTrue = 8;
			var numTrue = 0;
			//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: allEventsLength: "+eventsLength);
			for(var j = 0; j < eventsLength; j++){
			
				var event = allEvents[j];
				timeMachine.setTime(event.renderStartTime);
				var eventStart = timeMachine.getHours();
				var eventEndTime = timeMachine.setTime(event.renderEndTime);
				var eventEnd = timeMachine.getHours();
				
				//if eventEnd hour is 0/midnight, it could be the end of the day, or it could be early in the morning.
				if(eventEnd === 0){
					
					eventEnd = 24;
					//if it's early in the morning, then fudge and use 1.
					if(eventEndTime < oneAm){
						//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: adjusting for 1am");
						eventEnd = 1;	
					}
				}			
				if (event.allDay) {
					//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: allday event");
					if (!eventDay.allDay) {
						//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: setting allday true");
						eventDay.allDay = true;
						numTrue++;
						if (calendarId != -1 && (!eventDay.calAllDay) && event.calendarId == calendarId) {
							//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: setting calAllday true");
							eventDay.calAllDay = true;
							numTrue++;
						}
					}
					
				}
				else {
					//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: timed event");
					if ((!eventDay.beg) && (eventEnd > 0 && eventStart < MORNING_ENDS)) {
						//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: morning event");
						eventDay.beg = true;
						numTrue++;						
						if (calendarId != -1 && (!eventDay.calBeg) && event.calendarId == calendarId) {
							//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: calMorning event");
							eventDay.calBeg = true;
							numTrue++;
						}
						
					}
					if ((!eventDay.mid) && (eventEnd > MORNING_ENDS && eventStart < MIDDAY_ENDS)) {
						//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: midday event");
						eventDay.mid = true;
						numTrue++;
						if (calendarId != -1 && (!eventDay.calMid) && event.calendarId == calendarId) {
							//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: calMidday event");
							eventDay.calMid = true;
							numTrue++;
						}
					}
					if ((!eventDay.end) && (eventEnd > MIDDAY_ENDS && eventStart < 24)) {
						//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: end event");
						eventDay.end = true;
						numTrue++;
						if (calendarId != -1 && (!eventDay.calEnd) && event.calendarId == calendarId) {
							//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: calEnd event");
							eventDay.calEnd = true;
							numTrue++;
						}
					}
				}
				//We've set everything possible to true for this day.  Cut out early and skip to the next day.
				if (numTrue === maxTrue) {
					//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: cutting out early");
					break;
				}
			}
			eventDays.push(eventDay);			
		}
		return eventDays;
	},
	
	/*
	 * busyDaysToString: Takes the results of findBusyBlocksInDays, and converts it into two strings - one for regular events, and one
	 * for all day events.
	 * @param days: an array of eventDay objects, the results of a call to findBusyBlocksInDays
	 * @returns: an object containing two strings	 
	 */ 
	busyDaysToString: function(days)
	{
		var STATE_TO_TOKEN = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-";
		var dayString = "";
		var allDayString = "";
		var daysLength = days.length;
		for (var i = 0; i < daysLength; i++) {
			var state = 0;
			var allDayState = 0;
			var day = days[i];
			// If we have no day, then we set everything to 0
			// Otherwise ...
			if (day !== null) {
				if (day.beg) {
					state |= 1;
				}
				if (day.mid) {
					state |= 2;
				}
				if (day.end) {
					state |= 4;
				}
				if (day.calBeg) {
					state |= 8;
				}
				if (day.calMid) {
					state |= 16;
				}
				if (day.calEnd) {
					state |= 32;
				}
				if(day.allDay){
					allDayState |= 1;
				}
				if(day.calAllDay){
					allDayState |= 2;
				}
			}
			// Translate the 6-bits of state information to one of 64 symbols
			dayString	+= STATE_TO_TOKEN [state];
			allDayString+= STATE_TO_TOKEN [allDayState];
		}
		//this.evlog(this.logLevels.getBusyDays, "busyDaysToString: dayString: "+dayString);
		//this.evlog(this.logLevels.getBusyDays, "busyDaysToString: allDayString: "+allDayString);
		return { regular: dayString, allDay: allDayString };
	}
});



var EventManager = Class.create ({

	initialize: function () {

		this.queryResults				= [];
		this.databaseChangedObservers	= {};
		this.utils						= new EventManagerUtils();
		this.rruleManager				= new RRuleManager();
		this.timezoneManager			= new TimezoneManager();
		this.lastRevsetNumber			= 0;
		this.cancelGetEventsInRange		= _.bind (this.cancelGetEventsInRange, this);
///*DEBUG:*/	this.timing = {};
	},
	
	logLevels:  
	{
		getEvents			: 0x00000001,
		getEventsInRange	: 0x00000010,
		getBusyDays			: 0x00000100,
		findNextOccurrence	: 0x00001000,
		dates				: 0x00010000,
		responses			: 0x00100000,
		timeout				: 0x01000000,
		all					: 0x11111111
	},
		
	evlog: function(level, string){
//		this.logging = true;
//		var filterLevel = this.logLevels.all;
//		if((filterLevel & level) > 0){
//			console.info("========== eventmgr: "+string);	
//		}		
	},

	cleanup: function() {
		//TODO: Maybe unsubscribe from MojoDB change notifications...
	},

	observeDatabaseChanges: function(sceneName, controller) {
		this.databaseChangedObservers[sceneName] = controller;
	},

	stopObservingDatabaseChanges: function(sceneName) {
		this.databaseChangedObservers[sceneName] = undefined;
	},
	
	notifyObservers: function() {
		for (var observer in this.databaseChangedObservers) {
			if(this.databaseChangedObservers.hasOwnProperty(observer) && this.databaseChangedObservers[observer]){
				this.databaseChangedObservers[observer].databaseChanged();	
			}
			
		} 
	},
		
	getEvents: function () {
		/*
		 * getEvents: 
		 *
		 * There are two operations here: a watch and a query.
		 * The watch looks for all changes later than the last eventDisplayRevset.
		 * The query is actually a batch of three queries:
		 *   - Query for all events
		 *   - Query for the last event added/updated
		 *   - Query for the last event deleted
		 *    
		 * The first query is the event result set.
		 * The last two queries are used to determine the lastRevsetNumber.
		 * As of 10/15/2010, there is no way to query in mojoDB for all events added/updated/deleted and use an orderBy clause.    
		  *
		 * For result sets larger than the DB limit, the DB response will
		 * contain a "next" field (i.e. {next:"<some db id>"}) that will
		 * be used in subsequent queries to build the full result set.
		 */

		var	handleEvents
		,	watchEvents
		,	handleWatch
		,	queryEvents
		,	thi$	= this;

		var query = {	"from"		: "com.palm.calendarevent:1"
					,	"orderBy"	: "eventDisplayRevset"
					};
					
		var queryOp =	{	"method": "find"
						,	"params": 
							{	"query": query	}
						};		
					
		var revsetOp1 = {	"method": "find"
						,	"params":
							{	"query":
								{	"from"		: "com.palm.calendarevent:1"
								,	"orderBy"	: "eventDisplayRevset"
								,	"desc"		: true
								,	"limit"		: 1
								}
							}
						};
								
		var revsetOp2 = {	"method": "find"
						,	"params":
							{	"query": 
								{	"from"		: "com.palm.calendarevent:1"
								,	"where"		: [{"prop": "_del", "op": "=", "val": true}]
								,	"orderBy"	: "eventDisplayRevset"
								,	"desc"		: true
								,	"limit"		: 1
								}
							}
						};
													
		var operations = {	"operations" : [revsetOp1, revsetOp2, queryOp]	};
							
		watchEvents = function watchEvents() {
			// Keep reference to DB request to prevent aggressive Garbage Collection:
			if(thi$.watchRequest){
				PalmCall.cancel(thi$.watchRequest);	
			}		
			
			delete thi$.watchRequest;
			
			var	watchQuery =	{	"subscribe": true
								,	"query":
									{	"from"		: "com.palm.calendarevent:1"
									,	"where"		: [{"prop": "eventDisplayRevset", "op": ">", "val": thi$.lastRevsetNumber}]
									,	"incDel"	: true
									}
								};
							
			thi$.watchRequest = DB.execute ("watch", watchQuery);
			thi$.watchRequest.then(handleWatch);
		};

		handleWatch = function handleWatch (future) {
			var response = future.result;

			//the watch was successfully set up
			if(response && response.returnValue === true && !response.fired && !response.results){
				future.then(handleWatch);
			}
			
			//the watch fired
	        if(response && response.fired){
				queryEvents();		// If the DB events watch fires, re-query and setup another watch.
				return true;
			}
		};

		queryEvents = function queryEvents() {
			// Keep reference to DB request to prevent aggressive Garbage Collection:
			delete thi$.dbRequest;
			thi$.dbRequest = DB.execute ("batch", operations);
			thi$.dbRequest.then(handleEvents);
		};

		
		function getRevsetNumber(response) {
			var revsetNumber = 0;
			if(response){
				var result = response.results;
				if(result && result.length){
					revsetNumber = result[0].eventDisplayRevset;
				}
			}
			return revsetNumber;
		}

		handleEvents = function handleEvents (future) {
			var result = future.result;			
			var responses = result && result.responses;
			
			if(!responses){
				console.error("Event Manager: batch query failed");
				return false;
			}
			
			var revsetResponse1 = responses[0]
			,	revsetResponse2 = responses[1]
			,	queryResponse   = responses[2]
			;

			thi$.queryResults	= query.page										// If processing a page of results
								? thi$.queryResults.concat (queryResponse.results)	// add the page of results to the total results
								: queryResponse.results;							// otherwise set total resuls to this result set.

			if (queryResponse.next) {											// Result set is larger than DB's max (i.e. 500)
				query.page = queryResponse.next;								// so identify next page of results,
	            queryEvents();													// retrieve them
				return true;													// then set this DB.find future's result so it completes.
			}

			delete query.page;													// Last or only page of results so clear query's page.	

			var revsetNum1 = getRevsetNumber(revsetResponse1) || 0;
			var revsetNum2 = getRevsetNumber(revsetResponse2) || 0;
			
			thi$.lastRevsetNumber = Math.max(revsetNum1, revsetNum2);
												
			thi$.utils.loadTimezones (thi$.queryResults);						// Cache any new timezone rules.
			thi$.notifyObservers();												// Notify listeners of event changes.
			watchEvents();														// Continue observing DB changes.
			return true;
		};

		queryEvents();
	},

	cancelGetEventsInRange: function cancelGetEventsInRange (stopTimestamp) {
		if (isNaN (stopTimestamp)) {
			stopTimestamp = parseInt (stopTimestamp, 10);
			if (isNaN (stopTimestamp)) {
				stopTimestamp = Date.now();
			}
		}
		var utils = this.utils;
		if (stopTimestamp < utils.getGEIRTimeLimit())  {
			utils.setGEIRTimeLimit (stopTimestamp);
		}
	},

	/*
     * getEventsInRange: finds all occurrences of events in the query results that occur within the specified range,
     * sorted by start date, and broken down by day.
     * @param range: a date range object (start, end, tzid, calendarId, excludeList)
     *		- start:	the start of the range - timestamp
     *		- end:		the end of the range - timestamp
     *		- tzId:		timezone
     *		- calendarId: optional string. include only events with this calendarId in the results
     *		- excludeList: optional object. This object is an associative array of calendarIds. If no calendarId was
     *					supplied, any events whose calendarId is in this object will be excluded from the results.
     * @aparm callback: function to call when results are ready
     * @param eventSet: optional set of events.  If not supplied, it will use this.queryResults.  This parameter is 
     *             here to enable unit tests, and assumes that the events have dtstart and dtend set, as if they came from a database query.
	 * @param limit: optional. number of results to limit the response to.
     * The response generated contains an array of day objects with the following properties:
     *    date: timestamp
     *    events: array of event objects.  Events will have current TZ/local start/end, renderStartTime, and renderEndTime set by the end of this function. 
     *    allDayEvents: array of event objects
     *    freeTimes: array of ??
     *    busyTimes: array of ??
     */
	getEventsInRange: function (range, callback, eventSet, limit) {
		if (!eventSet) {
			eventSet = this.queryResults;
		}

		var	event
		,	events
		,	eventSetSize= eventSet.length
		,	i
		,	chunkInterval
		,	occurrences	= []
		,	thi$ = this
		;
				
		var timeoutLength = 7000;
				
		//We copy the range and use it instead because a) it's not nice to alter parameters that don't belong to you and 
		//b)findRepeatsInRange will append datesInRange to it, which we can reuse if needed, and any external callers who 
		//might be using using and changing range values within a loop won't be affected.
		var tempRange = Foundations.ObjectUtils.clone(range);
		
		var future		= new Future (null);		
		future.tzIds	= this.utils.getUniqueTzIdsInEventSet	(eventSet);
		future.years	= this.utils.getYearsInRange			(tempRange);

		//load the timezone data needed to process this event set
		future.then	(this.timezoneManager, this.timezoneManager.setup);			
		future.then	(this.timezoneManager, this.timezoneManager.getTimezones);

		future.then	(this, function (future) {
			var result = future.result;
			
			//find which events in the set occur within the range.  
			//this.evlog(this.logLevels.getEventsInRange, "getEventsInRange: Range start: "+new Date(tempRange.start)+" - "+new Date(tempRange.end));

			i = 0;
			var chunkLimit = 50;
			
			//We process in chunks and yield periodically to avoid Webkit's JS timeout.
			function findOccurrences(){
				
				//this.evlog(this.logLevels.timeout, "GEIR: findOccurrences: Timeout at "+this.utils.getGEIRTimeLimit());
				
				var okEvent;
				//i is the index in the full event set. j is the counter for the chunk limit
				for (var j = 0; i < eventSetSize && j < chunkLimit; i++, j++) {
					var timeLimit = this.utils.getGEIRTimeLimit();
					if(timeLimit && Date.now() >= timeLimit){
						//this.evlog(this.logLevels.timeout, "GEIR: Exceeded time limit at event: "+i + " of "+eventSetSize+" / "+eventSet[i]._id);
						break;
					}
					
					//this.evlog(this.logLevels.getEventsInRange, "************** Next event ************************");
					event = eventSet[i];
					okEvent = ("dtstart" in event) && ("dtend" in event) && isFinite(event.dtstart) && isFinite(event.dtend);
					if(!okEvent){
						console.error("===== Skipping malformed calendar event: "+event._id); 
						continue; 
					}
					
					if (!event.rrule) {
						if (this.utils.occursInRange(event, tempRange)) {
							occurrences.push(event);
						}
					}
					else {
						if(event.rrule.count){
							events = this.utils.findRepeatsInRangeCountVersion(event, tempRange);
						}
						else{
							//Repeating events may occur multiple times in the range
							events = this.utils.findRepeatsInRange(event, tempRange, limit);
						}
						
						if (events.length > 0) {
							//this.evlog(this.logLevels.getEventsInRange, "getEventsInRange: Repeating event ["+i+"] occurs "+events.length+" times in range");
							occurrences = occurrences.concat(events);
						}
					}
				}
				
				//If we haven't processed all the events in the event set, return, and this function will get run again.
				if (i < eventSetSize){
					//this.evlog(this.logLevels.timeout, "GEIR: Yielding");					
					return;
				} 
		
				//We've processed all events in the event set.  Now start work to format the response.
				  
				//Have we already calculated the datesInRange for this range/tzId?
				//this.evlog(this.logLevels.getEventsInRange, "===== Done finding occurrences.  Looking for render times =====");
				var dates;
				if(tempRange.datesInRange && tempRange.datesInRange[tempRange.tzId]){
					//this.evlog(this.logLevels.getEventsInRange, "getEventsInRange: reusing existing datesInRange");
					dates = tempRange.datesInRange[tempRange.tzId];
//					if(this.logging){
//						for(var x = 0; x < dates.length; x++){
//							//this.evlog(this.logLevels.dates, "dates: "+new Date(dates[x]));
//						}	
//					}				
				}			
				else{
					dates = this.utils.getDatesInRange(tempRange);
				}
							
				var	eventsWithRenderTimes	= []
				,	occurrencesLength		= occurrences.length
				;
	
				// Get the render times for each occurrence:			
				eventsWithRenderTimes = this.utils.getEventRenderTimes (occurrences, dates);
				
				// Sort by renderStartTime:
				if (eventsWithRenderTimes.length > 0) {
					eventsWithRenderTimes.sort (this.utils.sortByStartTime);
				}
	
				// Split into days arrays:
				var response = { days: this.utils.formatResponse (eventsWithRenderTimes, dates, tempRange.calendarId, tempRange.excludeList) };
				//this.evlog(this.logLevels.responses, "response: "+JSON.stringify(response));
	
				//clean up the setInterval and send the response
				clearInterval (chunkInterval);
				setTimeout (function(){
					thi$.utils.setGEIRTimeLimit(undefined);
					callback (response); 
				}, 15.625);
				future.result = response;
			}//end findOccurrences
			
			//Because large event sets could take a long time, we have to process in chunks and yield periodically to avoid Webkit's JS timeout.
			
			function processEventChunk(){
				thi$.utils.setGEIRTimeLimit(Date.now() + timeoutLength);								
				findOccurrences.apply(thi$); 
			}
			chunkInterval = setInterval (processEventChunk, 31.625);
		});
	},
	
	/*
	 * findNumOccurrencesInRange: finds the number of occurrences of an event within the specified range.
	 * @param event: the event to find the recurrences of
	 * @param range: the range in which to find the recurrences. Range is assumed to be in the device's local time
	 * @param countLimit: stop counting and return if the number of occurrences exceeds this number.  To count all occurrences, pass null.
	 * @returns: the number of occurrences in the range 
	 */
	findNumOccurrencesInRange: function(event, range, countLimit){
		var occurrences;
		if(event.rrule.count){
			occurrences = this.utils.findRepeatsInRangeCountVersion(event, range);
		}
		else{
			occurrences = this.utils.findRepeatsInRange(event, range, countLimit);
		}
		return occurrences.length;
	},
	
	/*
	 * getBusyDays: Finds the busy times within a range.  This is for use with month view.
	 * Busy times are indicators that an event is occurring in the morning/midday/evening block of the day.
	 * Morning = 12am - 12pm
	 * Midday = 12pm - 5pm
	 * Evening = 5pm - 12am
	 * @param range: the range in which to find the busy times. Range is assumed to be in the device's local time
	 * @param calendarId: the calendarId of the displayed calendar.  BusyTimes containing events in this calendar will be marked as such.
	 * @param eventSet: optional set of events.  If not supplied, it will use this.queryResults.  This parameter is 
     *             here to enable unit tests, and assumes that the events have dtstart, dtend, and calendarId set, as if they came from a database query.
	 * @returns: a response object with the following properties:
	 * "date": start of the range 
	 *	"days": a string. Each character in the string represents a day in the range. The character indicates which blocks in the day are busy, and which blocks have
	 *				events that belong to the calendarId specified.  See monthview for more information about the bitflag-ascii encoding going on here.
	 *	"allDay": a string. Each character in the string represents a day in the range. The character indicates if the day has an all day event, and if the
	 *				allday events belong to the calendarId specified.  See monthview for more information about the bitflag-ascii encoding going on here.
	 */	
	
	getBusyDays: function(range, callback, eventSet){
		//this.evlog(this.logLevels.getBusyDays, "getBusyDays begin");
		if (!eventSet) {
			//this.evlog(this.logLevels.getBusyDays, "getBusyDays using queryResults");
			eventSet = this.queryResults;
		}
		
		var busyCallBack = _.bind(this.getBusyDaysCallback, this, callback, range.calendarId);
		this.getEventsInRange(range, busyCallBack, eventSet);
	},

	getBusyDaysCallback: function (callback, calendarId, response) {
		//this.evlog(this.logLevels.getBusyDays, "getBusyDaysCallback begin");
		var	days		= response.days
		,	busyBlocks	= this.utils.findBusyBlocksInDays	(days, calendarId)
		,	busyStrings	= this.utils.busyDaysToString		(busyBlocks);

		var results =  
		{	date	: days[0].date
		,	days	: busyStrings.regular
		,	allDay	: busyStrings.allDay
		};

///*DEBUG:*/	console.log ("\n\n\n\tEventManager:timing: "+JSON.stringify (this.timing)+"\n\n\n");

		callback (results);
	},	

	findNextOccurrenceTimezonePrep: function(eventSet){
		if(!eventSet || eventSet.length === 0){
			return new Foundations.Control.Future({returnValue: true});
		}
		
		//2050 == year in timestamp 2524608000000, which is findNextOccurrence's cut-off point
		var years = [];
		for(var i = new Date().getFullYear(); i < 2051; i++){
			years.push(i);
		}		

		var future = this.timezoneManager.setup();
		future.then(this, function(){
			var result = future.result;
			future.tzIds = this.utils.getUniqueTzIdsInEventSet(eventSet);
			future.years = years;
			future.result = result;
		});
		future.then	(this.timezoneManager, this.timezoneManager.getTimezones);
		
		return future;
	},
	/*
	 * findNextOccurrence: finds the next occurrence of an event.
	 * @param event: the event to find the recurrences of
	 * @param date: the timestamp representing the date/time to start searching from.
	 * @returns: the timestamp (local time) representing the start of the next occurrence of the event, 
	 * or false if the event has stopped repeating 
	 */
	findNextOccurrence: function(event, date){
		//Pass in the local range and the event
		//Convert the local range to the event tz range
		//Since RRULE evaluation is done by DAY, we may need to break the range into separate dates.
		//For each date in the tz-range, test if the event repeats on that date
		//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: begin, searching from "+new Date(date));	
		if (!event.rrule || !event.rrule.freq) {
			//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: doesn't repeat");
			return false;
		}
		
		var until;
		
		//We are hard-coding an until date very far in the future so that there's no way this can become an infinite loop if
		//we get some kind of malformed, never possible to repeat RRULE.
		if(event.rrule.until !== null && event.rrule.until !== undefined){
			until = event.rrule.until;
		} 
		else {
			until = 2524608000000; //Fri 01 Jan 2050 00:00:00 GMT || Thu 31 Dec 2049 16:00:00 PST
		}
				
		//If the event has stopped repeating, we're done.
		if(date > until){
			//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: repeat cycle ended");
			return false;
		}

		//We can use findRepeatsInRange, if we have a range.
		//But if we use too big a range, it might be slow, or a memory hog.
		//So we'll start by assuming we ought to be able to find an occurrence somewhere in the next <unit> of repeat. 
		var jumpDuration = 0;
		var interval = 1;
		if(event.rrule.interval){
			interval = parseInt(event.rrule.interval, 10) || 1;
		}

		switch (event.rrule.freq) {
			case "DAILY":
				jumpDuration =  interval * 86400000; //~ 1 day;
				//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: daily jump duration: "+interval+" days");
				break;
			case "WEEKLY":
				jumpDuration = interval * 604800000; //~ 1 week
				//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: weekly jump duration: "+interval+" weeks");
				break;
			case "MONTHLY":
			case "YEARLY"://I'd rather loop 12 times than do a year-long range
				jumpDuration = interval * 2678400000; //~ 1 month
				//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: monthly jump duration: "+interval+" months");
				break;
			default:
				return false;
		}

		var repeatCycleContinues = true
		,	start = date
		,	end = date
		,	baseOccurrence
		,	nextOccurrence
		,	tzId = this.timezoneManager.getSystemTimezone()
		,	i
		,	nEvents
		,	endDate
		,	timeMachine = new Date()
		;
		//if event & range timezone aren't the same, convert the range to the event's timezone
		var datesInEvent = this.utils.getDatesInRange({start: event.dtstart, end: event.dtend, tzId: event.tzId});
		var datesInEventSize = datesInEvent.length;
		
		while (repeatCycleContinues) {
			//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: LOOP");
			start = end;
			end = end + jumpDuration;
			var range = {start: start, end: end, tzId: tzId};
			//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: calling FIND REPEATS IN RANGE");
			// get the events that are more closer to the date
			var events;
			if(event.rrule.count){
				events = this.utils.findRepeatsInRangeCountVersion(event, range);
				if(event.rrule.count && event.countInfo && event.rrule.count == event.countInfo.length){
					repeatCycleContinues = false;
				}
			}
			else{				
				events = this.utils.findRepeatsInRange(event, range, datesInEventSize);
			}
			nEvents = events && events.length || 0;
			//if there are events that are closer to the date check if there is the occurrence we search for
			for (i=0;i < nEvents;i++) {
				if (events[i].currentLocalStart > date) {
					nextOccurrence = events[i].currentLocalStart;
					break;
				}
			}
			if (nextOccurrence) {
				return nextOccurrence;
			}
			//if the next occurrence is not found then pick the closest event to the date and take it's start 
			//don't go more in the past if an event was already found, but use it as a base to calculate the next date ranges
			if (nEvents > 0 && events[nEvents-1].currentLocalStart <= date) {
				if (!baseOccurrence || baseOccurrence.getTime() < events[nEvents-1].currentLocalStart) {
					timeMachine.setTime(events[nEvents-1].currentLocalStart);
					baseOccurrence = timeMachine;
				}
				end = baseOccurrence.addDays(1).getTime();
			}
			
			if(end > until){
				repeatCycleContinues = false;
			}
		}
		//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: NOT FOUND");
		return false;
	}
});

(function(){
	/** Closure to hold private singular EventManager instance. */

	// Create the singular private EventManager instance:
	var singleton = new EventManager();

	// Override the EventManager constructor to always returns its singular instance:
	EventManager = function EventManager(){
		return singleton;
	};

})();

exports.EventManager = EventManager;
