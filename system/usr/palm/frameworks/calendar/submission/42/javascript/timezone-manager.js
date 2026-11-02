/* Copyright 2010 Palm, Inc.  All rights reserved. */
/*
 * DateRange
 * {	Date	start
 * ,	Date	end
 * ,	String	tzId
 * ,	String	calendarId
 * }
 * 
 * TimezoneYear
 * {	String	tz
 * ,	Array	years [YYYY]
 * }
 */

/*global _: false, Class: false, exports: false, Future, PalmCall: false, Utils: false, stringify */
/*jslint devel: true, laxbreak: true, white: false */

var TimezoneManager = Class.create ({

	initialize: function() {
		// Bind all of our methods so they will always get called on the correct object
		_.bindAll(this);
		
		this.timezones		= {};		
		this.timezone		= undefined;
		this.gotLocalTz		= false;
		this.defaultYears	= [];
		this.setupFutures	= [];

		for (var year = new Date().getFullYear(), i = -5; i < 6; ++i) {
			this.defaultYears.push (year + i);
		}
	},

	setup: function() {
		// The problem: callers need TimezoneManager to be fully set-up before
		// they can proceed, but idomatic handling of subscriptions results in
		// a never-ending chain of recursing then()s.
		//
		// The solution: the first time we call getSystemTime, we don't subscribe,
		// and return a new future (which we cache for later notification) for 
		// each caller to attach then()s to.  Once we've gotten a response from
		// the server, we set the result on the cached futures, allowing the
		// callers to go about their business, and then subscribe to getSystemTime.
		// After this point, callers get a "resulted" future returned to them.
		//
		// Callers get unique futures because you never know what each caller
		// will do with their future, and later callers shouldn't be left waiting
		// on earlier callers to finish.

		function getSystemTime(self, then, subscribe) {
			return PalmCall.call("palm://com.palm.systemservice", "time/getSystemTime", {subscribe: subscribe}).then(self, then);
		}

		function handleSubscribe(future) {
			Utils.debug("TimezoneManager.setup(): 8. Subscription response from getSystemTime received");
			var result = future.result;

			Utils.debug("TimezoneManager.setup(): 9. Calling setTimezone() from subscription");
			this.setTimezone(result);

			//register a new "then" with this same function
			Utils.debug("TimezoneManager.setup(): 10. Continuing subscription to getSystemTime");
			future.then(this, handleSubscribe);
		}

		function handleFirstResponse(future) {
			Utils.debug("TimezoneManager.setup(): 4. First response from getSystemTime received");
			var result = future.result,
				setupFuture;

			Utils.debug("TimezoneManager.setup(): 5. Calling setTimezone()");
			this.setTimezone(result);

			// Now notify all our callers that set up is complete
			while ((setupFuture = this.setupFutures.pop())) {
				Utils.debug("TimezoneManager.setup(): 6. Notifying caller that setup is complete");
				setupFuture.result = {returnValue: true};
			}

			// And subscribe to getSystemTime
			Utils.debug("TimezoneManager.setup(): 7. Subscribing to getSystemTime");
			this.sysTzFuture = getSystemTime(this, handleSubscribe, true);
			future.result = {returnValue: true};
		}

		if (!this.timezone) {
			// If there's no timezone, we haven't gotten a response from the 
			// service (possibly because we haven't made the request yet).

			// Create a new future for the caller to wait on, and cache it.
			Utils.debug("TimezoneManager.setup(): 1. timezone not setup; creating and caching future for caller");
			var callerFuture = new Future();
			this.setupFutures.push(callerFuture);

			// Make the getSystemTime request if we haven't yet
			if (!this.sysTzFuture) {
				Utils.debug("TimezoneManager.setup(): 2. Make initial request to getSystemTime");
				this.sysTzFuture = getSystemTime(this, handleFirstResponse, false);
			}

			Utils.debug("TimezoneManager.setup(): 3. Returning future to caller");
			return callerFuture;
		}

		// We're fully set up, so give the caller a future that allows them to
		// continue immediately
		return new Future({returnValue: true});
	},

	setTimezone: function(response) {
		this.timezone	= response.timezone;
		this.gotLocalTz	= false;
	},
	
	getSystemTimezone: function(){
		return this.timezone;
	},
	
	cleanup: function() {
		this.sysTzFuture.cancel();
	},
		
	/*
	 * Called from getEventsSuccess.  This function requires:
	 * tzIds: an array of tzIds
	 * years: an array of years
	 * 
	 * If the params are not present, default them.
	 * Verify if every tz-year pair is already in our cache. If so, do nothing, return.
	 * If not, fetch the data from the service, and return.	 
	 */
	loadTimezones: function(tzIds, years){
		var tzYearPairs,
			future;

		if(!tzIds || tzIds.length === 0){
			tzIds = [this.timezone];
		}
		if(!years || years.length === 0){
			years = this.defaultYears;
		}
		if(!this.gotLocalTz && this.timezone){
			tzIds.push(this.timezone);
			this.gotLocalTz = true;
		}			
					
		tzYearPairs = this.findTzYearPairsNotInCache(tzIds, years);
		if(tzYearPairs.length > 0){
			future = PalmCall.call("palm://com.palm.systemservice/timezone/", "getTimeZoneRules", tzYearPairs);
			future.then(this, this.addTimezones, this.failedToGetTimezones);
		} else {
			future = new Future({returnValue: true});
		}
		return future;
	},
	
	/*
	 * Called from getEventsInRange.  This function requires a future, and expects that the future has two params attached to it:
	 * tzIds: an array of tzIds
	 * years: an array of years
	 * 
	 * If the params are not present, default them.
	 * Verify if every tz-year pair is already in our cache. If so, do nothing, return.
	 * If not, fetch the data from the service, and return.	 
	 */
	getTimezones: function (incomingFuture){

		incomingFuture.getResult();

		var tzIds = incomingFuture.tzIds;
		var years = incomingFuture.years;

		var tzFuture = this.loadTimezones(tzIds, years);
		incomingFuture.nest (tzFuture);
	},
		
	findTzYearPairsNotInCache: function(tzIds, years){
		//See if we need to get any tzInfos from the service
		var tzPairs = [];
		var tzIdsLength = tzIds.length;
		var yearsLength = years.length;
		for(var i = 0; i < tzIdsLength; i++){
			var timezone = tzIds[i];
			var tzYears = [];
			for(var j = 0; j < yearsLength; j++){
				var year = years[j];
				if(!this.hasTimezoneInfo(timezone, year)){
					tzYears.push(year);
				}
			}
			if(tzYears.length > 0){
				tzPairs.push(this.makeTimezoneYearPair(timezone, tzYears));
			}
		}
		return tzPairs;
	},
	
	failedToGetTimezones: function(future){
		if (future.exception) {
			future.result = false;
		}
		else {
			future.result = true;
		}
	},
	
	addTimezones: function(future){
		/* "results": 
		 * [ { "tz": "America\/Los_Angeles", "year": 2009, "hasDstChange": true, "utcOffset": -28800, "dstOffset": -25200, "dstStart": 1236506400, "dstEnd": 1257066000 },
		 *	 { "tz": "UTC", "year": 2010, "hasDstChange": false, "utcOffset": 0, "dstOffset": -1, "dstStart": -1, "dstEnd": -1 } 
		 * ] 
		 */
		var result;
		try {
			result = future.result;
		} catch (e) {
			future.result = {returnValue: false};
			return;
		}
		
		var returnValue = result.returnValue;
		if (returnValue === false) {
			
			future.result = {returnValue: returnValue};
			return;
		}
		
		var results = future.result.results;
		var length = results.length;
		var tzinfo;
		for(var i = 0; i < length; i++){
			tzinfo = results[i];
			var year = tzinfo.year;
			if(!this.timezones [year]){
				this.timezones [year] = {};
			}				
			this.timezones [year][tzinfo.tz] = tzinfo;
		}
		future.result = {returnValue: returnValue};
	},
	
	hasTimezoneInfo: function(tzId, year){
		return !!(this.timezones[year] && this.timezones[year][tzId]);
	},
	 
	makeTimezoneYearPair: function(tzId, years){
		var allYears;
		if(!years || years.length === 0){
			allYears = this.defaultYears;
		}
		else if(JSON.stringify(years) != JSON.stringify(this.defaultYears)){
			allYears = years.concat(this.defaultYears);
		}
		else{
			allYears = years;
		}
			
		var pair = {"tz":tzId, "years":allYears};
		return pair;			
	},
	
	//write a unit test for this
	convertTime: function(timestamp, srcTz, destTz){
		var defaultTz = this.timezone;
		var source = srcTz || defaultTz;
		var dest = destTz || defaultTz;
		
		if(source == dest){
			return timestamp;
		}
				
		var year = new Date(timestamp).getFullYear(); //um, if src isn't local, how do we know if we got the right year until after we get an offset?
		var timestampNoMillis = timestamp / 1000;		
		var destOffset = this.getOffset(year, dest, timestampNoMillis);
		var sourceOffset = this.getOffset(year, source, timestampNoMillis);
		var convertedTime = (timestampNoMillis + destOffset - sourceOffset) * 1000;
		return convertedTime;					
	},
	
	//{ "tz": "America\/Los_Angeles", "year": 2009, "hasDstChange": true, "utcOffset": -28800, "dstOffset": -25200, "dstStart": 1236506400, "dstEnd": 1257066000 },
	getOffset: function(year, tzId, timestampNoMillis){
		if(!tzId){
			tzId = this.timezone;
		}
		else if( /UTC/i.test (tzId) ){
			return 0;
		}
		
		var tzInfoYr = this.timezones[year];
		if(!tzInfoYr){
			//console.info("Timezone Manager didn't load %s", year);
			return 0;
		}
		
		var tzInfo = this.timezones[year][tzId];
		if(!tzInfo){
			//console.info("Timezone Manager didn't load %s/%s", tzId, year);
			return 0;
		}
	
		if(!tzInfo.hasDstChange){
			return tzInfo.utcOffset;
		}
		else if(timestampNoMillis >= tzInfo.dstStart && timestampNoMillis < tzInfo.dstEnd){
			return tzInfo.dstOffset;
		}
		
		return tzInfo.utcOffset;
	}
});

(function(){
	/** Closure to hold private singular TimezoneManager instance. */

	// Create the singular private TimezoneManager instance:
	var singleton = new TimezoneManager();

	// Override the TimezoneManager constructor to always returns its singular instance:
	TimezoneManager = function TimezoneManager(){
		return singleton;
	};

})();

exports.TimezoneManager = TimezoneManager;
