/* Copyright 2010 Palm, Inc.  All rights reserved. */

/*global Utils: false, exports: false */
/*jslint laxbreak: true, white: false */
function RRuleManager(){
	this.utils = new Utils();
}

RRuleManager.prototype = {
	
	flagPositions :  
	{
		byMonth		: 0,
		byMonthDay	: 1,
		byDay		: 2,
		byYearDay	: 3,
		byWeekNumber: 4
	},
	
	hasRules : 
	{
		byMonth		: 1, //(1 << 0) 
		byMonthDay	: 2, //(1 << 1)
		byDay		: 4, //(1 << 2)
		byYearDay	: 8, //(1 << 3)
		byWeekNumber: 16 //(1 << 4)
	}, 
	
	rlog: function(string){
		//console.info("========== rrulemgr: "+string);
	},
	
	/*
     * findMonthPosition: finds the ordinal position of a day within the month
     * (if timestamp is a Tuesday, will tell if it's 1st Tuesday, 2nd Tuesday, etc.)
	 * if !findPositivePosition, it will search from the end of the month
	 * param date: date to find the position of
	 * param findPositivePosition: if true, searches from the start of the month and returns a positive number.
	 *                             if false, searches from the end of the month and returns a negative number
	 * returns: an integer representing the position of the day within the month 
	 */
	//Timezone agnostic
	findMonthPosition: function(date, findPositivePosition){
		var daysApart;
		if(findPositivePosition) {
			var firstOfMonth = date.clone();
			firstOfMonth.setDate(1);
			daysApart = this.utils.howManyDaysBetweenShortRange(firstOfMonth, date);
			return Math.floor(daysApart / 7) + 1;	
		} else {
			var lastOfMonth = date.clone();
			if(this.utils.isLeapYear(lastOfMonth.getFullYear())) {
				lastOfMonth.setDate(this.utils.leapYearDaysInMonth[lastOfMonth.getMonth()]);
			} else {
				lastOfMonth.setDate(this.utils.regularYearDaysInMonth[lastOfMonth.getMonth()]);	
			}
			daysApart = this.utils.howManyDaysBetweenShortRange(date, lastOfMonth);	
			return Math.floor((daysApart / 7) + 1) * -1;	
		}	
	},

	/*
	 * getNegativeDayOfMonth: finds the day number of a day in the month, counting from the end of the month
	 * (last day = -1, second to last day = -2, etc.)
	 * param date: date to find the position of
	 * returns: an negative integer representing the position of the day within the month
	 */
	//Timezone agnostic
	getNegativeDayOfMonth: function(date){
		var lastOfMonth = date.clone();
		if (this.utils.isLeapYear(lastOfMonth.getFullYear())) {
			lastOfMonth.setDate(this.utils.leapYearDaysInMonth[lastOfMonth.getMonth()]);
		}
		else {
			lastOfMonth.setDate(this.utils.regularYearDaysInMonth[lastOfMonth.getMonth()]);
		}
		var daysApart = this.utils.howManyDaysBetweenShortRange(date, lastOfMonth);	
		return (daysApart + 1) * -1;
	},

	/*
	 * getWeekNumber: Finds the number of the week in the year. 
	 * param date: date to find the week number of
	 * returns: an integer representing the week number
	 */
	getWeekNumber: function (date){
		//From wikipedia:
		//Method: Using ISO weekday numbers (running from 1 for Monday to 7 for Sunday), 
		//subtract the weekday from the ordinal date, then add 10. 
		//Divide the result by 7. Ignore the remainder; the quotient equals the week number. 
		//If the week number thus obtained equals 0, it means that the given date belongs to the 
		//preceding (week-based) year. If a week number of 53 is obtained, one must check that 
		//the date is not actually in week 1 of the following year.
		
		var ordinalDay;
		var weekNumber;
		var weekday = date.getDay();
		
		if (weekday === 0) {
			weekday = 7;
		}
		
		if(date.getMonth() === 0){
			ordinalDay = date.getDate();
		} else if (this.utils.isLeapYear(date.getFullYear())) {
			ordinalDay = this.utils.leapYearDaysCumulative[date.getMonth() - 1] + date.getDate();
		} else { 
			ordinalDay = this.utils.regularYearDaysCumulative[date.getMonth() - 1] + date.getDate();
		}
		weekNumber = Math.floor((ordinalDay - weekday + 10) / 7);
		
		return weekNumber;
	},

	/*
	 * getNegativeWeekNumber: Finds the number of the week in the year, counting from the end of the year.
	 * (Last week of the year = -1, second to last = -2, etc.)
	 * param date: date to find the week number of
	 * returns: an integer representing the week number  
	 */
	getNegativeWeekNumber: function (date){
		var endOfYear = new Date(date.getFullYear(), 11, 31);
		var weeksInYear = this.getWeekNumber(endOfYear);
		var positiveWeekNumber = this.getWeekNumber(date);
		return (weeksInYear - positiveWeekNumber + 1) * -1;
	},


	//Repeating events:
	//a. test interval
	//b. test rules 
	//c. test exception dates 
	
	//DEBATE: How often does an event get ruled out because of exception, vs. 
	//how often can you rule something out by interval?
	//Exceptions are O(n) (I think), so how many exceptions can you test before 
	//it takes longer than calculating and testing the interval?
	//It's worth experimenting to see the most fastest test order
	// - exceptions - interval - rules
	// - interval - exceptions - rules
	// - interval - rules - exceptions
	
	//Before evaluating the BYxxx rules, find any data that is assumed based on the start date.
	
	//How the BYXXX rule tests work:
	//There is a flag object that contains two bit-flags:  
	// flags.rulesPresent tracks which BYXXX rules were listed or implied in the RRULE
	// flags.rulesTrue tracks which BYXXX rules evaluated to true for this particular date.
	//At the end, if these two bit-flags match, then the event repeats on the given date.
	
	//If you're not a crusty C programmer like me, here's how bit-flags work:
	//A bit-flag is a number.  Think of it in binary form: 00000000, where the digits are numbered right to left.
	//Each digit position in the number represents a boolean: 00000010 = position 2 is true, all others are false.
	//To set a position to true, use bitwise operators to move a 1 into that position. Set position 2 to be true:
	//	flag = 1 << 2;  00000010
	//To aggregate booleans into one bit-flag, use bitwise OR:
	//  flag = flag | 1 << 4; 00001010
   

	/*
	 * setPresentFlag: sets the rulesPresent flag to true at the specified position
	 */
	setPresentFlag: function(flags, position) {
		flags.rulesPresent = flags.rulesPresent | (1 << position);
	},

	/*
	 * setTrueFlag: sets the rulesTrue flag to true at the specified position
	 */
	setTrueFlag: function(flags, position) {
		flags.rulesTrue = flags.rulesTrue | (1 << position);
	},

	/*
	 * byMonthTest: Sets the rulesPresent flag for byMonth flag position
	 * Tests if todayDate matches the recurrence specified by rule and sets rulesTrue.
	 * param rule      a BYMONTH rule
	 * param todayDate a Date object containing the date to test
	 * param flags     an object containing two bitflags: rulesPresent and rulesTrue
	 */ 
	byMonthTest: function (rule, todayDate, flags) {
		//this.rlog("byMonthTest: "+JSON.stringify(rule)+" / "+todayDate+" / "+JSON.stringify(flags));
		var flagPosition = this.flagPositions.byMonth;
		this.setPresentFlag(flags, flagPosition);	
		var month = todayDate.getMonth() + 1; //make it 1..12
		var ruleLength = rule.ruleValue.length;
		for(var i = 0; i < ruleLength; i++) {
			var ord = rule.ruleValue[i].ord;
			//this.rlog("byMonthTest: testing: ord: "+ord+" =?= "+month);
			if(ord == month) {
				//this.rlog("byMonthTest: TRUE");
				this.setTrueFlag(flags, flagPosition);
				break;
			}
		}
	},

	/*
	 * byMonthDayTest: Sets the rulesPresent flag for byMonthDay flag position
	 * Tests if todayDate matches the recurrence specified by rule and sets rulesTrue.
	 * param rule      a BYMONTHDAY rule
	 * param todayDate a Date object containing the date to test
	 * param flags     an object containing two bitflags: rulesPresent and rulesTrue 
	 */
	byMonthDayTest: function(rule, todayDate, flags) {
		//this.rlog("byMonthDayTest: "+JSON.stringify(rule)+" / "+todayDate+" / "+JSON.stringify(flags));
		var flagPosition = this.flagPositions.byMonthDay;
		this.setPresentFlag(flags, flagPosition);
		var dayOfMonth = todayDate.getDate();
		var negativeDayOfMonth = this.getNegativeDayOfMonth(todayDate);
		var ruleLength = rule.ruleValue.length;
		for(var i = 0; i < ruleLength; i++) {
			var ord = rule.ruleValue[i].ord;
			//this.rlog("byMonthDayTest: testing: ord: "+ord+" =?= "+dayOfMonth+" or =?= "+negativeDayOfMonth);
			if(ord == dayOfMonth || ord == negativeDayOfMonth) {
				//this.rlog("byMonthDayTest: TRUE");
				this.setTrueFlag(flags, flagPosition);
				break;
			}
		}
	},

	/*
	 * byDayTest: Sets the rulesPresent flag for byDay flag position
	 * Tests if todayDate matches the recurrence specified by rule and sets rulesTrue.
	 * param rule      a BYDAY rule
	 * param todayDate a Date object containing the date to test
	 * param flags     an object containing two bitflags: rulesPresent and rulesTrue 
	 */
	byDayTest: function (rule, todayDate, flags) {
		//this.rlog("byDayTest: "+JSON.stringify(rule)+" / "+todayDate+" / "+JSON.stringify(flags));
		var flagPosition = this.flagPositions.byDay;
		this.setPresentFlag(flags, flagPosition);
		var positiveMonthPosition;
		var negativeMonthPosition;
		var monthPosition;
		var ruleLength = rule.ruleValue.length;
		for(var i = 0; i < ruleLength; i++) {
			var ord = rule.ruleValue[i].ord;
			var day = rule.ruleValue[i].day;
			//this.rlog("byDayTest: ord: "+ord+", day: "+day);
			if(ord) {
				//this.rlog("byDayTest: has ord");
				//find relevant month position of todayDate
				if(ord > 0){
					if (!positiveMonthPosition) {
						positiveMonthPosition = this.findMonthPosition(todayDate, true);
					}
					monthPosition = positiveMonthPosition;
					//this.rlog("byDayTest: has ord > 0, positiveMonthPosition: "+positiveMonthPosition);	
				} else {
					if (!negativeMonthPosition) {
						negativeMonthPosition = this.findMonthPosition(todayDate, false);
					}
					monthPosition = negativeMonthPosition;	
					//this.rlog("byDayTest: has ord <= 0, negativeMonthPosition: "+negativeMonthPosition);
				}
				//this.rlog("byDayTest: testing: ord: "+ord+" =?= "+monthPosition+" and day: "+ day+" =?= "+todayDate.getDay());
				if(ord == monthPosition && day == todayDate.getDay()) {
					this.setTrueFlag(flags, flagPosition);
					//this.rlog("byDayTest: TRUE");
					break;
				}
			}
			else if (day == todayDate.getDay()) {
				//this.rlog("byDayTest: SIMPLE TEST TRUE");
				this.setTrueFlag(flags, flagPosition);
				break;
			}
		}
	},

	/*
	 * byWeekNumberTest: Sets the rulesPresent flag for byWeekNumber flag position
	 * Tests if todayDate matches the recurrence specified by rule and sets rulesTrue.
	 * param rule      a BYWEEKNO rule
	 * param todayDate a Date object containing the date to test
	 * param flags     an object containing two bitflags: rulesPresent and rulesTrue 
	 */
	byWeekNumberTest: function(rule, todayDate, flags) {
		//this.rlog("byWeekNumberTest: "+JSON.stringify(rule)+" / "+todayDate+" / "+JSON.stringify(flags));
		var flagPosition = this.flagPositions.byWeekNumber;
		this.setPresentFlag(flags, flagPosition);
		
		var weekNumber = this.getWeekNumber(todayDate);
		var negativeWeekNumber = this.getNegativeWeekNumber(todayDate);
		var ruleLength = rule.ruleValue.length;
		for(var i = 0; i < ruleLength; i++) {
			var ord = rule.ruleValue[i].ord;
			//this.rlog("byWeekNumberTest: testing: ord: "+ord+" =?= "+weekNumber+" or =?= "+negativeWeekNumber);
			if(ord == weekNumber || ord == negativeWeekNumber) {
				this.setTrueFlag(flags, flagPosition);
				//this.rlog("byWeekNumberTest: TRUE");
				break;
			}
		}
	},
	
	/*
	 * byYearDayTest: Sets the rulesPresent flag for byYearDay flag position
	 * Tests if todayDate matches the recurrence specified by rule and sets rulesTrue.
	 * param rule      a BYYEARDAY rule
	 * param todayDate a Date object containing the date to test
	 * param flags     an object containing two bitflags: rulesPresent and rulesTrue 
	 */
	byYearDayTest: function(rule, todayDate, flags) {
		//this.rlog("byYearDayTest: "+JSON.stringify(rule)+" / "+todayDate+" / "+JSON.stringify(flags));
		var flagPosition = this.flagPositions.byYearDay;
		this.setPresentFlag(flags, flagPosition);
		var yearDayNumber = this.utils.howManyDaysSinceJanuaryFirst(todayDate) + 1;
		var negativeYearDayNumber = (this.utils.howManyDaysTillDecember31(todayDate) + 1) * -1;
		var ruleLength = rule.ruleValue.length;
		for(var i = 0; i < ruleLength; i++) {
			var ord = rule.ruleValue[i].ord;
			//this.rlog("byYearDayTest: testing: ord: "+ord+" =?= "+yearDayNumber+" or =?= "+negativeYearDayNumber);
			if(ord == yearDayNumber || ord == negativeYearDayNumber) {
				this.setTrueFlag(flags, flagPosition);
				//this.rlog("byYearDayTest: TRUE");
				break;
			}
		}		
	},
	
	dateComponentsEqual: function(date1, date2){
		return ((date1.getFullYear() === date2.getFullYear()) &&
			(date1.getMonth() === date2.getMonth()) &&
			(date1.getDate() === date2.getDate()));
	},	
	/*
	 * Notes on exdates:
	 * Exdates can be in three formats: date, date-time (may include a timezone), and utc date-time.
	 *     EXDATE;VALUE=DATE:20090821,20090915
	 *     EXDATE:20090821T080000Z,20090915T080000Z
	 *     EXDATE;TZID=America/New_York:19970714T133000,20090821T080000,20090915T080000
	 * If exdates have a time component, it is usually set to the start time of the event.
	 * 
	 * Thoughts:
	 * For evaluation, technically we should be evaluating the exdates after we evaluate the rest of the rule, but
	 * I think, performance wise, it might be faster to evaluate this first.
	 * 
	 * It would be nice if the list were sorted, so that once we hit an exdate later than the test date, we can exit early.
	 * But since they're stored as strings, they would be sorted alphabetically.  If we had a mix of formats (UTC & not UTC), 
	 * this wouldn't necessarily work, because of the UTC conversion.  So for now, we iterate over the whole list.
	 */	
	
	/*
	 * evaluateExceptions: tests if todayDate is in the exceptions list
	 * param date: the timestamp indicating the date to test
	 * param eventStart: the original start time of the event
	 * param exdates: list of exceptions
	 * param tzId: timezone of the event
	 * returns: true if todayDate is in the exception list
	 */
	evaluateExceptions: function(date, exdates, eventStart, tzId) {
		var testDate = new Date(date);
		var testYear = testDate.getFullYear();
		var testMonth = testDate.getMonth() + 1;
		var testDay = testDate.getDate();
		var exdatesLength = exdates ? exdates.length : 0;

		// webOS CE: an exception names a day of the event's zone, and date is that day's label, so
		// only the calendar date is compared. The time in an exception adds nothing: a repeat
		// happens at most once a day here. A UTC exception is first read in the event's zone.
		for (var i = 0; i < exdatesLength; i++) {
			var exdate = exdates[i];
			var year = parseInt(exdate.substr(0, 4), 10);
			var month = parseInt(exdate.substr(4, 2), 10);
			var day = parseInt(exdate.substr(6, 2), 10);

			if (exdate.length === 16) {
				var timezoneManager = new TimezoneManager();
				var instant = Date.UTC(year, month - 1, day, parseInt(exdate.substr(9, 2), 10), parseInt(exdate.substr(11, 2), 10), parseInt(exdate.substr(13, 2), 10));
				var clock = new Date(instant + timezoneManager.getOffset(new Date(instant).getFullYear(), tzId, instant / 1000) * 1000);
				year = clock.getUTCFullYear();
				month = clock.getUTCMonth() + 1;
				day = clock.getUTCDate();
			}
			else if (exdate.length !== 8 && exdate.length !== 15) {
				continue;		//malformed. can't evaluate
			}

			if (year === testYear && month === testMonth && day === testDay) {
				return true;
			}
		}
		return false;
	},

	/*
	 * evaluateRules: Iterates through the array of rules and evaluates each, setting results in the appropriate bitflags
	 * param rules     an array of BYxxx rules
	 * param todayDate a Date object containing the date to test
	 * param flags     an object containing two bitflags: rulesPresent and rulesTrue 
	 */
	//TODO: Do we want to actively reject malformed rules?  If so, add some enforcement about the 
	//frequency type vs. the BYxxx rules we got.
	evaluateRules: function(rules, todayDate, flags) {
	
		//this.rlog("evaluateRules: "+JSON.stringify(rules));
		for(var i = 0; i < rules.length; i++) {
				
			var rule = rules[i];		
			switch(rule.ruleType) {
				case "BYMONTH": //[1..12]
					this.byMonthTest(rule, todayDate, flags);
					break;
			
				case "BYWEEKNO":	//[-53..-1,1..53]
					this.byWeekNumberTest(rule, todayDate, flags);
					break;
						
				case "BYMONTHDAY": //[-31..-1,1..31]         
					this.byMonthDayTest(rule, todayDate, flags);
					break;
				
				case "BYDAY": //[MO|WE,3MO,2WE,-3WE,-1FR]
					this.byDayTest(rule, todayDate, flags);
					break;
				
				case "BYYEARDAY":
					this.byYearDayTest(rule, todayDate, flags);
					break;	
			}	
		}
	},

	/*
	 * frequencyTypeDaily: tests an rrule whose frequency=DAILY
	 * param today       timestamp representing the date to be tested
	 * param eventStart  timestamp representing the start date/time of the first occurrence of the event
	 * param rrule       rrule object whose frequency=DAILY
	 * Returns true if this event repeats on today.
	 */
	frequencyTypeDaily: function(today, eventStart, rrule) {
		//this.rlog("Frequency daily: rule: "+JSON.stringify(rrule));
		var flags = {"rulesPresent": 0, "rulesTrue": 0};
		var todayDate = new Date(today);
		var eventStartDate = new Date(eventStart);  
		
		if (!rrule.interval) {
			rrule.interval = 1;
		}
		
		//Interval test
		if(rrule.interval !== 1) {
			var days = this.utils.howManyDaysBetween(eventStartDate, todayDate);
			if (days % rrule.interval !== 0) {
				//this.rlog("Frequency daily: failed interval check");
				return false;
			}
		}

		//Rule tests
		if (rrule.rules && rrule.rules.length > 0) {
			this.evaluateRules(rrule.rules, todayDate, flags);
		}
		
		//this.rlog("Frequency daily: "+(flags.rulesPresent == flags.rulesTrue));		
		return (flags.rulesPresent == flags.rulesTrue);
	},

	/*
	 * frequencyTypeWeekly: tests an rrule whose frequency=WEEKLY
	 * param today       timestamp representing the date to be tested
	 * param eventStart  timestamp representing the start date/time of the first occurrence of the event
	 * param rrule       rrule object whose frequency=WEEKLY
	 * Returns true if this event repeats on today.
	 */
	frequencyTypeWeekly: function(today, eventStart, rrule){
		//this.rlog("Frequency weekly: rule: "+JSON.stringify(rrule));
		var flags = {"rulesPresent": 0, "rulesTrue": 0};
		var todayDate = new Date(today);
		var eventStartDate = new Date(eventStart);
		var defaultRule = {"ruleType":"BYDAY", "ruleValue": [{"day": eventStartDate.getDay()}]};
		var hasByDayRule = false;	
				
		if (!rrule.interval) {
			rrule.interval = 1;
		}
				
		//Interval test
		if (rrule.interval !== 1) {
			var weeks = this.utils.howManyWeeksBetween(eventStartDate, todayDate);
			if (weeks % rrule.interval !== 0) {	
				//this.rlog("Frequency weekly: failed interval check");		
				return false;
			}
		}
		
		//What data to we have?  Do we have a day of week to repeat on?
		//Figure out if the day of week was specified
		if(rrule.rules && rrule.rules.length > 0){
			for(var i = 0; i < rrule.rules.length; i++){
				if (rrule.rules[i].ruleType == "BYDAY") {
					hasByDayRule = true;
				}
			}
		}
		
		//Fill in anything missing
		//if we're missing which day of the week to repeat on, get it from the start date			
		if (rrule.rules && !hasByDayRule) {
			rrule.rules.push(defaultRule);
			//this.rlog("Frequency weekly: adding additional default rule");
		}
		else if (!rrule.rules) {
			rrule.rules = [defaultRule];
			//this.rlog("Frequency weekly: no rules, adding default rule");
		}
						
		//Rule tests
		this.evaluateRules(rrule.rules, todayDate, flags);
		
		//this.rlog("Frequency daily: "+(flags.rulesPresent == flags.rulesTrue));			
		return (flags.rulesPresent == flags.rulesTrue);
	},

	/*
	 * frequencyTypeMonthly: tests an rrule whose frequency=MONTHLY
	 * param today       timestamp representing the date to be tested
	 * param eventStart  timestamp representing the start date/time of the first occurrence of the event
	 * param rrule       rrule object whose frequency=MONTHLY
	 * Returns true if this event repeats on today.
	 */
	frequencyTypeMonthly: function(today, eventStart, rrule){
		//this.rlog("Frequency monthly: rule: "+JSON.stringify(rrule));
		var flags = {"rulesPresent": 0, "rulesTrue": 0};
		var hasByDayRule = false;
		var hasByMonthDayRule = false;
		var todayDate = new Date(today);
		var eventStartDate = new Date(eventStart);
		var defaultRule = {"ruleType":"BYMONTHDAY", "ruleValue": [{"ord": eventStartDate.getDate()}]};
	
		if (!rrule.interval) {
			rrule.interval = 1;
		}
		
		//Interval test
		if(rrule.interval != 1) {
			var months = this.utils.howManyMonthsBetween(eventStartDate, todayDate);
			if (months % rrule.interval !== 0) {
				//this.rlog("Frequency monthly: failed interval check");	
				return false;
			}
		}
	
		//What data to we have? Do we have a date or day of month to repeat?
		if(rrule.rules && rrule.rules.length > 0) {
			for(var i = 0; i < rrule.rules.length; i++){
				if (rrule.rules[i].ruleType == "BYDAY") {
					hasByDayRule = true;
				}
				if (rrule.rules[i].ruleType == "BYMONTHDAY") {
					hasByMonthDayRule = true;
				}
			}
		}
	
		//Fill in anything missing	
		//if we're missing which day of the month to repeat on, get it from the start date			
		if (rrule.rules && !hasByDayRule && !hasByMonthDayRule) {
			//this.rlog("Frequency monthly: adding default rule");
			rrule.rules.push(defaultRule);
		}
		else if (!rrule.rules) {
			//this.rlog("Frequency monthly: no rules, adding default rule");			
			rrule.rules = [defaultRule];
		}	
			
		//Rule tests
		this.evaluateRules(rrule.rules, todayDate, flags);
		
		//this.rlog("Frequency monthly: "+(flags.rulesPresent == flags.rulesTrue));			
		return (flags.rulesPresent == flags.rulesTrue);
	},

	/*
	 * frequencyTypeYearly: tests an rrule whose frequency=YEARLY
	 * param today       timestamp representing the date to be tested
	 * param eventStart  timestamp representing the start date/time of the first occurrence of the event
	 * param rrule       rrule object whose frequency=YEARLY
	 * Returns true if this event repeats on today.
	 */
	frequencyTypeYearly: function (today, eventStart, rrule){
		//this.rlog("Frequency yearly: rule: "+JSON.stringify(rrule));
		var flags = {"rulesPresent": 0, "rulesTrue": 0};
		
		var todayDate = new Date(today);
		var eventStartDate = new Date(eventStart);
		
		if (!rrule.interval) {
			rrule.interval = 1;
		}
		
		//Interval test
		if(rrule.interval !== 1) {
			var years = todayDate.getFullYear() - eventStartDate.getFullYear();
			if (years % rrule.interval !== 0) {
				//this.rlog("Frequency yearly: failed interval check");
				return false;
			}
		}
		
		//if we have no rules, add bymonth and bymonthday
		if(!rrule.rules || rrule.rules.length === 0) {
			//if no rules - need bymonthday=date, bymonth=month
			rrule.rules = [
				{	"ruleType":"BYMONTH"
				,	"ruleValue":[{"ord":eventStartDate.getMonth()+1}]
				}, 
				{	"ruleType":"BYMONTHDAY"
				,	"ruleValue":[{"ord": eventStartDate.getDate()}]
				}
			];
			//this.rlog("Frequency yearly: no rules, adding default rule");
		}
		
		//figure out what rules we have
		for(var i = 0; i < rrule.rules.length; i++) {
			var rule = rrule.rules[i];
			if (rule.ruleType == "BYMONTH") {				
				this.setPresentFlag(flags, this.flagPositions.byMonth);
			}
			else if (rule.ruleType == "BYMONTHDAY") {
				this.setPresentFlag(flags, this.flagPositions.byMonthDay);
			}
			else if (rule.ruleType == "BYDAY") {
				this.setPresentFlag(flags, this.flagPositions.byDay);
			}
			else if (rule.ruleType == "BYWEEKNO") {
				this.setPresentFlag(flags, this.flagPositions.byWeekNumber);
			}
			else if (rule.ruleType == "BYYEARDAY") {
				this.setPresentFlag(flags, this.flagPositions.byYearDay);
			}
		}
		
		//this.rlog("Frequency yearly: processed what rules we have: "+flags.rulesPresent);
		
		//Check for compatible flag combinations: byYearDay, byWeekNo && byDay, byMonth && byMonthDay
		//if we have something else, then we need to take data from the start date	
		//have month, but no byDay and no byMonthDay
		if((flags.rulesPresent & this.hasRules.byMonth) && (!(flags.rulesPresent & this.hasRules.byDay) && !(flags.rulesPresent & this.hasRules.byMonthDay))){
			rrule.rules.push({"ruleType": "BYMONTHDAY", "ruleValue": [{"ord": eventStartDate.getDate()}]});
			//this.rlog("Frequency yearly: adding BYMONTHDAY RULE");
		}
	
		//have month day but no month
		if(!(flags.rulesPresent & this.hasRules.byMonth) && (flags.rulesPresent & this.hasRules.byMonthDay)){
			rrule.rules.push({"ruleType":"BYMONTH", "ruleValue": [{"ord": eventStartDate.getMonth()+1}]});
			//this.rlog("Frequency yearly: adding BYMONTH RULE");
		}
		
		//have week number but no weekday
		if((flags.rulesPresent & this.hasRules.byWeekNumber) && !(flags.rulesPresent & this.hasRules.byDay)){ 
			//add weekday
			rrule.rules.push({"ruleType":"BYDAY", "ruleValue": [{"day":eventStartDate.getDay()}]});
			//this.rlog("Frequency yearly: adding BYDAY RULE");	
		}
		
		//Rule tests
		this.evaluateRules(rrule.rules, todayDate, flags);
		
		//this.rlog("Frequency yearly: "+(flags.rulesPresent == flags.rulesTrue));
		return (flags.rulesPresent == flags.rulesTrue);
	},

	/*
	 * evaluateRRule: tests a recurring event to see if it repeats on the specified date	
	 * param date: date to test, assumed to be in the event's timezone
	 * param eventStart: event's segment start time
	 * param eventsOriginalStart: event's original start time
	 * param rrule: the rrule to evaluate
	 * param exdates: the event's exception dates
	 * param eventTzID: timezone id of the event, for use with exdates
	 * returns: true if the event repeats on the specified date
	 *			false if the event doesn't repeat on the specified date
	 *			-1 if the date is an EXDATE
	 */	
	evaluateRRule: function(date, eventStart, eventOriginalStart, rrule, exdates, eventTzID, countInfo){
		// webOS CE: date is a day label, and until is real time, so this can only rule out a date
		// that's clearly past it. The caller tests the occurrence's real start against until.
		var margin = 172800000;
		if(rrule.until && rrule.until + margin < date){
			return false;
		}
		else if(countInfo &&
				((countInfo.until && countInfo.until + margin < date) ||
				 (countInfo.estimateEnd && countInfo.estimateEnd + margin < date))
			   ){
			return false;
		}

		var repeatsOnDate;
		switch (rrule.freq) {
			case "DAILY":
				repeatsOnDate = this.frequencyTypeDaily(date, eventStart, rrule);
				break;
			case "WEEKLY":
				repeatsOnDate = this.frequencyTypeWeekly(date, eventStart, rrule);
				break;
			case "MONTHLY":
				repeatsOnDate = this.frequencyTypeMonthly(date, eventStart, rrule);
				break;
			case "YEARLY":
				repeatsOnDate = this.frequencyTypeYearly(date, eventStart, rrule);
				break;
			default:
				repeatsOnDate = false;
		}

		// webOS CE: only an actual occurrence can be an exception. An exception on some other date
		// mustn't use up a count, or hide anything.
		if(repeatsOnDate && exdates && this.evaluateExceptions(date, exdates, eventOriginalStart, eventTzID)){
			//An exception counts as an occurrence for count-based repeat, so don't return false.
			//But don't return true either, because it shouldn't be shown.
			return -1;
		}

		return repeatsOnDate;
	}

};

exports.RRuleManager = RRuleManager;
