/*jslint node: true, nomen: true */
/*global Log, PalmCall, Calendar, Future, checkResult, libPath */

var Quoting = require(libPath + "Quoting.js");
var Time = require(libPath + "iCalTimeHandling.js");

//from later node.js versions. If we fade out 2.x support, this can go away and be replaced by node.js util._extend method.
var extend = function (origin, add) {
	"use strict";
	// Don't do anything if add isn't an object
	if (!add || typeof add !== 'object') {
		return origin;
	}

	var keys = Object.keys(add),
		i = keys.length;
	while (i) {
		i -= 1;
		origin[keys[i]] = add[keys[i]];
	}
	return origin;
};

// This is a small iCal to webOs event parser.
// Its meant to be simple and has some deficiencies.
// It can only parse VCALENDAR objects with exactly one VEVENT in them.
// It ignores most of the parameter values, if they are not really necessary and won't set them.
// Currently its hardly tied to the needs of the SyncML implementation and an egroupware server.
// Many things might not be really tested.
// ParentId of exceptions to reccurring events is not really set. I try to set it for all events I have an id for.
// If and event has no id set and has exceptions, then an recurringId is set. If the event is an execption it has the parentLocalId set to the same
// id. That means, that the processing entity should fill the parentId in for this event.

//Known issues:
//Timezones... :(
//Easiest thing is: Server and Client are in same TS and server sends events in "right" tz. Or server nows tz of client and sends in the right tz.
//Ok is: Server sends dates as UTC (currently NOT working! :() To fix: Change to "date.UTC" in icaltowebos (and something similar in other function!)
//Quite impossible: Server sends dates in other TS than device is in... Don't know how to handle that, yet. :(

var iCal = (function () {
//  var e = { //structure of webOs events:
//      alarm                   : [ { //=VALARM
//        action              : "", //one or more of "audio", "display", "email"
//        alarmTrigger : { //only first one supported (from webpage.. don't really understand what that means.
//                         //Is this meant to be an array? or only for first alarm supported? or is only datetime supported?
//          value:         "", // "19981208T000000Z | (+/-) PT15M"
//          valueType: "DURATION"        // DATETIME | DURATION - should match the value. :) => in RFC this is DATE-TIME..?
//        },
//        attach       : "", //string => url / binary? => don't use. :) => not in RFC?
//        description  : "", //text of e-mail body or text description. Does webOs actually support this? I didn't see something like that, yet. => not in RFC?
//        duration     : "", //time between repeats => makes repeat required.
//        repeat       : 0,  //number of times to repeat. => makes duration required.
//        summary      : "", //subject for e-mail. => not in RFC?
//        trigger      : ""} ], //original trigger string vom iCal. => will be only stored. Hm.
//      allDay         : false, //all day has no time, only a date. TODO: check if that really is true.. we had severe problems with allDay and sync. :( => not in RFC => real problem!
//      attach         : [""], //attachment as uri.
//      attendees      : [{
//        calendarUserType    : "", //comma seperated list of "INDIVIDUAL", "GROUP", "RESOURCE", "ROOM", "UNKNOWN", "other"
//        commonName          : "", //name of attendee.
//        delegatedFrom       : "",
//        delegatedTo         : "",
//        dir                 : "", //LDAP or webadress - not checked.
//        email               : "",
//        language            : "", //not validated.
//        organizer           : false,
//        member              : string,
//        participationStatus : "", //Comma-separated list of "NEEDS-ACTION", "ACCEPTED", "DECLINED", "TENTATIVE", "DELEGATED", "other".
//        role                : "", //Comma-separated list of "CHAIR", "REQ-PARTICIPANT", "OPT-PARTICIPANT", "NON-PARTICIPANT", "other".
//        rsvp                : boolean,
//        sentBy              : string }],
//      calendarId     : "",
//      categories     : "",
//      classification : "", //RFC field. "PUBLIC" "PRIVATE" | "CONFIDENTIAL".
//      comment        : "",
//      contact        : "",
//      created        : 0,  //created time.
//      dtend          : 0,  //end time
//      dtstart        : 0,  //start time
//      dtstamp        : "", //object created.
//      exdates        : [""],
//      geo            : "", //lat/long coordinates listed as "float;float".
//      lastModified   : 0,  //lastModified
//      location       : "", //event location.
//      note           : "", //text content.
//      parentDtstart  : 0,  //quite complex to fill, see "tryToFillParentID"
//      parentId       : 0,  // same as parteDtstart
//      priority       : 0,  //0-9: 0=undefined, 1=high, 9=low
//      rdates         : [""],
//      recurrenceId   : "",
//      relatedTo      : "",
//      requestStatus  : "",
//      resources      : "",
//      rrule          : { },
//      sequence       : 0,  //kind of "version" of the event.
//      subject        : "", //event subject
//      transp         : "", //"OPAQUE" | "TRANSPARENT". Opaque if this event displays as busy on a calendar, transparent if it displays as free.
//      tzId           : "",
//      url            : ""
//  },
	"use strict";
	var dayToNum = { "SU": 0, "MO": 1, "TU": 2, "WE": 3, "TH": 4, "FR": 5, "SA": 6 },
		numToDay = { "0": "SU", "1": "MO", "2": "TU", "3": "WE", "4": "TH", "5": "FR", "6": "SA"},
		DATETIME = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)(Z?)$/,
		DATE = /^(\d{4})(\d\d)(\d\d)$/;
		//DATE: yyyymmdd, time: hhmmss, if both are present they are divided by a T. A Z at the end is optional.
		//if only a Date is given (=> allDay), no letters are present and just 8 numbers should be given.
		//Usually the Z at the end of DATE-TIME should say that it's UTC. But I'm quite sure that most programs do this wrong... :(
		//there is a timezone property that could be set.
		//it could also be a comma seperated list of dates / date times. But we don't support that, yet.. ;)
		//used to try timeZone correction...

	function parseDATEARRAY(str, exdates) {
		var parts, times = [], i;
		parts = str.split(",");
		for (i = 0; i < parts.length; i += 1) {
			if (DATE.test(parts[i]) || DATETIME.test(parts[i])) { //skip empty / false values.
				times.push(parts[i]);
			}
		}

		if (exdates && exdates.concat) {
			return exdates.concat(times);
		}
		return times;
	}

	//this is strange. This should correctly parse RFC things... even, from RFC, there should also only be numbers in BYDAY, not days.
	//days are only specified for wkst. But the samples from palm, which say that BYSETPOS is not defined (but it's used in their own
	//samples to explain the rrule object ????) use days for BYDAY...
	function parseRULEofRRULE(key, value) {
		var days, day, i, rule = { ruleType: key, ruleValue: []};
		days = value.split(",");
		for (i = 0; i < days.length; i += 1) {
			if (days[i].length >= 2) {
				day = days[i].substr(days[i].length - 2); //extract day of week
				day = dayToNum[day];
				if (day || day === 0) { //really was a day, as it seems. :) === 0 is necessary for sunday..
					rule.ruleValue.push({day: day, ord: days[i].substring(0, days[i].length - 2)});
				} else {
					rule.ruleValue.push({ord: days[i]});
				}
			} else {
				rule.ruleValue.push({ord: days[i]});
			}
		}
		return rule;
	}

	function buildRRULE(rr, allDay) {
		var text = "RRULE:", i, j, day;
		text += "FREQ=" + rr.freq + ";";
		if (rr.count) {
			text += "COUNT=" + rr.count + ";";
		}
		if (rr.interval && parseInt(rr.interval, 10) !== 1) {
			text += "INTERVAL=" + rr.interval + ";";
		}
		if (rr.until) {
			// RFC 5545: UNTIL must be DATE when DTSTART is DATE (all-day), DATETIME otherwise
			text += "UNTIL=" + Time.webOsTimeToICal(rr.until, allDay || false, !allDay) + ";";
		}
		if (rr.wkst || rr.wkst === 0 || rr.wkst === "0") {
			text += "WKST=" + numToDay[rr.wkst] + ";";
		}
		for (i = 0; rr.rules && i < rr.rules.length; i += 1) {
			text += rr.rules[i].ruleType + "=";
			for (j = 0; j < rr.rules[i].ruleValue.length; j += 1) {
				day = rr.rules[i].ruleValue[j];
				if (j !== 0) {
					text += ",";
				}
				if (day.ord || day.ord === 0) {
					text += day.ord;
				}
				if (day.day || day.day === 0) {
					if (rr.rules[i].ruleType === "BYDAY") {
						text += numToDay[day.day];
					} else {
						text += day.day;
					}
				}
			}
			text += ";";
		}
		//remove last ";".
		return text.substring(0, text.length - 1);
	}

	function parseRRULEvCalendar(rs) {
		var rrule = { rules: []}, parts, transFreq = {"D": "DAILY", "W": "WEEKLY", "M": "MONTHLY", "Y": "YEARLY"},
			ruleType = "BYDAY",
			interVal = 1,
			needRules = true,
			part,
			day,
			partialRules = [],
			i,
			j,
			ord = /([0-9]+)([\-+]?)/,
			ordParts,
			ordNum,
			rule;
		parts = rs.split(" ");
		rrule.freq = transFreq[rs.charAt(0)]; //first char determines interval.
		if (!rrule.freq) { //if we could not read frequency, most probably other things are broken, too.
			Log.log("Could not read frequency. Malformed RRULE string: " + rs);
			return undefined;
		}
		if (rs.charAt(1) === "D") {
			if (rrule.freq === "MONTHLY") {
				needRules = false; //have not seen sensible rules I can support for MD.
			}
			interVal = 2;
		} else if (rs.charAt(1) === "P") {
			needRules = true;
			interVal = 2;
		} else if (rs.charAt(1) === "M") {
			if (rrule.freq === "YEARLY") {
				needRules = false; //have not seen sensible rules I can support for YM.
			}
			interVal = 2;
		}
		rrule.interval = rs.charAt(interVal);
		rule = {ruleValue: [], ruleType: ruleType};
		for (i = 1; i < parts.length; i += 1) {
			part = parts[i];
			if (part.charAt(0) === "#") {
				//end of rule, rest is count (which is not supported by webos for some strange reason).
				rrule.count = part.substring(1);
			} else if (DATETIME.test(part)) { //found until.
				rrule.until = part; //will be transformed to Timestamp when everything else is finished.
			} else if (needRules) { //this is not count or until, might be a day or a number.
				day = dayToNum[part];
				if (day !== undefined) { //read a day. All ords before are belonging to this day.
					for (j = 0; j < partialRules.length; j += 1) {
						partialRules[j].day = day;
					}
					if (!partialRules.length) { //no ords, only day.
						rule.ruleValue.push({day: day});
					} else { //got ord and day values.
						rule.ruleValue = partialRules;
					}
					if (rrule.freq === "DAILY") { //can't really support daily repeats by week day, makes more sense for weekly anyways.
						rrule.freq = "WEEKLY";
					}
					partialRules = []; //empty ords
				} else { //did not get day, yet. Will be ord in form of NUMBER[+/-]
					ordParts = ord.exec(part);
					if (ordParts) {
						ordNum = parseInt(ordParts[0], 10);
						if (ordParts[1] === "-") {
							ordNum *= -1;
						}
						partialRules.push({ord: ordNum});
					} else {
						Log.log("Something went wrong, could not interpret part " + part + " of rrule string " + rs);
					}
				}
			}
		}
		if (partialRules.length) { //did not have a day.
			rule.ruleValue = partialRules;
		}
		if (rule.ruleValue.length) {
			rrule.rules.push(rule);
		}
		if (!rrule.rules.length) {
			delete rrule.rules;
		}
		return rrule;
	}

	// BYSETPOS=N;BYDAY=XX is BYDAY=NXX (the 2nd Tuesday), which webOS can hold, but only for one
	// day of a month. BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1 picks the last of those days each month,
	// which is one event; written as -1MO,-1TU... it would be five. webOS has no way to say that,
	// so the rule is marked and parseWebCalICal keeps the first occurrence alone.
	function applyBySetPos(rrule) {
		var positions = String(rrule.bySetPos).split(","), byDay, day, oneDay, i;
		delete rrule.bySetPos;
		(rrule.rules || []).forEach(function (rule) {
			if (rule.ruleType === "BYDAY") {
				byDay = rule;
			}
		});
		oneDay = byDay && (rrule.freq === "MONTHLY" || rrule.freq === "YEARLY") && byDay.ruleValue.length === 1;
		if (!oneDay || byDay.ruleValue[0].ord) {
			rrule.unsupported = "BYSETPOS";
			return;
		}
		day = byDay.ruleValue[0].day;
		byDay.ruleValue = [];
		for (i = 0; i < positions.length; i += 1) {
			byDay.ruleValue.push({day: day, ord: parseInt(positions[i], 10)});
		}
	}

	function parseRRULE(rs) {
		var rrule = {}, params, kv, i;
		params = rs.split(";");
		for (i = 0; i < params.length; i += 1) {
			kv = params[i].split("=");
			switch (kv[0]) {
			case "FREQ":
				rrule.freq = kv[1];
				break;
			case "COUNT":
				rrule.count = parseInt(kv[1], 10);
				break;
			case "UNTIL":
				rrule.until = kv[1]; //will be transformed to TS at the end of event processing to get TZID right.
				break;
			case "INTERVAL":
				rrule.interval = parseInt(kv[1], 10);
				break;
			case "WKST":
				rrule.wkst = dayToNum[kv[1]];
				break;
			case "BYDAY":
			case "BYMONTHDAY":
			case "BYYEARDAY":
			case "BYWEEKNO":
			case "BYMONTH":
				if (!rrule.rules) {
					rrule.rules = [];
				}
				rrule.rules.push(parseRULEofRRULE(kv[0], kv[1]));
				break;
			case "BYSETPOS":
				rrule.bySetPos = kv[1];
				break;
			default:
				if (kv[0].charAt(0) !== "D" && kv[0].charAt(0) !== "W" && kv[0].charAt(0) !== "M" && kv[0].charAt(0) !== "Y") { //no complaint about vCalendar rules.
					Log.log("rrule Parameter " + kv[0] + " not supported. Will skip " + params[i]);
				}
				break;
			}
		}
		if (rrule.bySetPos) {
			applyBySetPos(rrule);
		}
		if (!rrule.freq) {
			return parseRRULEvCalendar(rs);
		}
		return rrule;
	}

	function parseOneLine(line) {
		//line:
		//name *(";" param ) ":" value CRLF
		//param = param-name "=" param-value *("," param-value)
		//param-value = either forbidden [control, dquote, ;, :, ,] or dquoted, then everything but dquote and control.
		//value = any textual character (i.e. no newline)

		var lObj = { line: line, parameters: {} }, index, index2, oldIndex, paramName;
		//first get name. This is the part before the first : or ;
		index = line.indexOf(":");
		index2 = line.indexOf(";");
		if (index2 >= 0 && index2 < index) {
			index = index2;
		}
		lObj.key = line.substring(0, index).toUpperCase();

		//now extract parameters here
		while (line[index] === ";") {
			oldIndex = index + 1;
			index = line.indexOf("=", oldIndex);
			paramName = line.substring(oldIndex, index).toLowerCase();

			//get parameter value
			oldIndex = index + 1;
			if (line[oldIndex] === '"') {
				// Scan for closing quote, skipping backslash-escaped characters (e.g. \").
				index = oldIndex + 1;
				while (index < line.length && line[index] !== '"') {
					if (line[index] === "\\") { index += 1; } // skip escaped char
					index += 1;
				}
				index += 1; // move past closing quote; line[index] should now be ";" or ":"
				if (index > line.length || (line[index] !== ";" && line[index] !== ":")) {
					throw "Could not correctly parse line " + line + " paramName = " + paramName + " remaining line: " + line.substring(oldIndex);
				}
			} else {
				//parameter not quoted => find either ";" or ":"
				index = line.indexOf(":", oldIndex);
				index2 = line.indexOf(";", oldIndex);
				if (index2 >= 0 && index2 < index) {
					//we have more parameters
					index = index2;
				}
			}

			lObj.parameters[paramName] = line.substring(oldIndex, index);
		}

		lObj.value = line.substring(index + 1);

		//TZID="Eastern Standard Time" has to match the same name unquoted.
		if (lObj.parameters.tzid) {
			lObj.parameters.tzid = lObj.parameters.tzid.replace(/^"|"$/g, "");
		}

		return lObj;
	}

	function parseAlarm(lObj, alarm) {
		//webos does not support attendee here => e-Mail won't work. Don't care. Hopefully nothing crashes. ;)
		if (lObj.key === "TRIGGER") {
			//process trigger.
			alarm.trigger = lObj.line; //save complete trigger string.
			//TODO: try to repair some deficiencies of webOs here... for example related end could be easily repaired if dtend and dtstart are known.
			alarm.alarmTrigger = { value: lObj.value, valueType: lObj.parameters.value || "DURATION" }; //decode string a bit for webOs.
			if (alarm.alarmTrigger.value === "P" || alarm.alarmTrigger.value === "-P" || alarm.alarmTrigger.value === "P0D") { //fix issue in webOS 2.1.1 with alarm 0 min before start.
				alarm.alarmTrigger.value = "-PT0M";
			}

			if (alarm.alarmTrigger.valueType === "DATE-TIME") {
				//docs say webos wants "DATETIME" not "DATE-TIME" like iCal... :(
				alarm.alarmTrigger.valueType = "DATETIME";
			}
			//log_icalDebug("Parsed trigger", lObj.line, "to", alarm.alarmTrigger);
		} else if (lObj.key === "END") {
			if (lObj.value !== "VALARM") {
				throw ({name: "SyntaxError", message: "BEGIN:VALARM was not followed by END:VALARM. Something is very wrong here."});
			}
			//log_icalDebug("Build alarm:", alarm);
			return undefined;
		} else {
			alarm[lObj.key.toLowerCase()] = lObj.value;
		}
		return alarm;
	}

	// "+0530" is 5.5 hours. Dividing by 100 made it 5.3.
	function parseUtcOffset(value) {
		var parts = /^([+\-])(\d\d)(\d\d)/.exec(value), hours;
		if (!parts) {
			return undefined;
		}
		hours = parseInt(parts[2], 10) + parseInt(parts[3], 10) / 60;
		return parts[1] === "-" ? -hours : hours;
	}

	function parseDaylightStandard(lObj, obj) {
		switch (lObj.key) {
		case "TZOFFSETTO":
			obj.offset = parseUtcOffset(lObj.value);
			break;
		case "RRULE":
			obj.rrule = parseRRULE(lObj.value);
			break;
		case "END":
			delete obj.mode;
			//Log.log_icalDebug(obj);
			break;
		case "DTSTART":
			obj.dtstart = lObj.value;
			break;
		default:
			if (lObj.key !== "TZNAME" && lObj.key !== "TZOFFSETFROM" && lObj.key !== "RDATE") {
				Log.log("Current translation from iCal-TZ to webOs event does not understand " + lObj.key + " yet. Will skip line " + lObj.line);
			}
			break;
		}
	}

	function parseTimezone(lObj, tz) {
		if (!tz.standard) {
			tz.standard = {};
		}
		if (!tz.daylight) {
			tz.daylight = {};
		}
		if (tz.standard.mode) {
			parseDaylightStandard(lObj, tz.standard);
			return true;
		} else if (tz.daylight.mode) {
			parseDaylightStandard(lObj, tz.daylight);
			return true;
		}
		switch (lObj.key) {
		case "TZID":
			tz.tzId = lObj.value;
			break;
		case "BEGIN":
			if (lObj.value === "STANDARD") {
				tz.standard.mode = true;
			} else if (lObj.value === "DAYLIGHT") {
				tz.daylight.mode = true;
			}
			break;
		case "END":
			if (lObj.value !== "VTIMEZONE") {
				throw ({name: "SyntaxError", message: "Something went wrong during TIMEZONE parsing, expected END:VTIMEZONE."});
			}
			return false; //signal that we are finished
		default:
			if (lObj.key !== "X-LIC-LOCATION" && lObj.key !== "RDATE") {
				Log.log("My translation from iCal-TZ to webOs event does not understand " + lObj.key + " yet. Will skip line " + lObj.line);
			}
			break;
		}
		return true;
	}

	function buildALARM(alarm, text) {
		var i, field, translation, value;
		translation = {
			"action" : "ACTION",
			//alarmTrigger will be handled extra,
			"attach" : "ATTACH",
			"description" : "DESCRIPTION",
			"duration" : "DURATION",
			"repeat" : "REPEAT",
			//"trigger": "TRIGGER",
			"summary" : "SUMMARY"
		};
		for (i = 0; i < alarm.length; i += 1) {
			if (alarm[i] && alarm[i].alarmTrigger && alarm[i].alarmTrigger.value !== "none") { //skip empty alarms! Also trigger is MUST.
				text.push("BEGIN:VALARM");
				for (field in alarm[i]) {
					if (alarm[i].hasOwnProperty(field)) {
						if (field === "alarmTrigger") { //use webos fields to allow edit on device.
							text.push("TRIGGER" +
								(alarm[i].alarmTrigger.valueType === "DATETIME" ? ";VALUE=DATE-TIME" : ";VALUE=DURATION") +
								":" + alarm[i].alarmTrigger.value); //only other mode supported by webOs is DURATION which is the default.
						} else if (translation[field]) { //ignore trigger field and other unkown things..
							value = alarm[i][field];
							if (field === "action") {
								value = alarm[i][field].toUpperCase();
							}
							text.push(translation[field] + ":" + value); //just copy most values.
						}
					}
				}
				text.push("END:VALARM");
			}
		}
		return text;
	}

	function parseAttendee(lObj, attendees, organizer) {
		var i = 0, attendee = {}, parts, translation;
		if (!attendees) {
			attendees = [];
		}
		if (lObj.parameters) {
			attendee.email = lObj.parameters.email; //sometimes e-mail is in extra parameter.
			if (!attendee.email) { //if not parse value for "MAILTO:e-mail".
				if (lObj.value.indexOf(":") !== -1) {
					parts = lObj.value.split(":"); //might be mailto:...
					for (i = 0; i < parts.length; i += 1) {
						if (parts[i].indexOf("@") !== -1) { //if part contains an @ it's not MAILTO and not X-EGROUPWARE... which egroupware seems to add. Strange.
							attendee.email = parts[i];
							break;
						}
					}
				}
			}
		}
		if (organizer) {
			for (i = 0; attendees && i < attendees.length; i += 1) {
				if (attendees[i].email === attendee.email) {
					attendees[i].organizer = true; //found ORGANIZER field for attendee that already was parsed. Do nothing. :)
					return attendees;
				}
			}
			attendee.organizer = true;
		}
		translation = {
			"cn": "commonName",
			"cutype": "calendarUserType",
			"role": "role",
			"partstat": "participationStatus",
			"rsvp": "rsvp",
			"email": "email",
			"member": "member",
			"DELEGATED-FROM": "delegatedFrom",
			"DELEGATED-TO": "delegatedTo",
			"DIR": "dir",
			"LANGUAGE": "language",
			"SENT-BY": "sentBy"
		};
		//translate all the fields:
		for (i in translation) {
			if (translation.hasOwnProperty(i)) {
				if (lObj.parameters[i]) {
					/*if (i === "cn") {
						lObj.parameters.cn = lObj.parameters.cn.replace(/"/g, ""); //remove " from the name if there are some.
					}*/
					attendee[translation[i]] = lObj.parameters[i];
				}
			}
		}
		//if (!attendee.email) {
			//webos calendar requires email field, but some send nothing for groups.
			//attendee.email = "group-placeholder@invalid.invalid";
		//}
		attendees.push(attendee);
		return attendees;
	}

	function buildATTENDEE(attendee) {
		var text = "ATTENDEE", translation, field, res;
		translation = {
			"commonName": "CN",
			"calendarUserType": "CUTYPE",
			"role": "ROLE",
			"participationStatus": "PARTSTAT",
			"rsvp": "RSVP",
			"email": "EMAIL",
			"member": "MEMBER",
			"delegatedFrom": "DELEGATED-FROM",
			"delegatedTo": "DELEGATED-TO",
			"dir": "DIR",
			"language": "LANGUAGE",
			"sentBy": "SENT-BY"
		};
		//if (attendee.email === "group-placeholder@invalid.invalid") {
	 //    delete attendee.email; //remove fake mail
		//}
		for (field in translation) {
			if (translation.hasOwnProperty(field)) {
				if (attendee[field]) {
					text += ";" + translation[field] + "=" + attendee[field];
				}
			}
		}
		text += ":";
		if (attendee.email) {
			text += "MAILTO:" + attendee.email;
			if (attendee.email.indexOf("@") === -1) {
				text += "@mail.invalid"; //prevent parsing errors on some servers.
			}
		}
		res = [text];
		if (attendee.organizer) {
			res.push("ORGANIZER;CN=" + attendee.commonName + (attendee.email ? (":MAILTO:" + attendee.email) : ":"));
		}
		return res;
	}

	function parseLineIntoObject(lObj, event) {
		var translation, translationQuote, transTime, year;
		//not in webOs: UID
		//in webos but not iCal: allDay, calendarID, parentId, parentDtStart (???)
		//string arrays: attach, exdates, rdates
		//more complex objects: ATTENDEES, ORGANIZER, BEGIN:VALARM, RRULE
		translation = {
			"CATEGORIES"    :    "categories",
			"CLASS"         :    "classification",
			"GEO"           :    "geo",
			"CONTACT"       :    "contact",
			"PRIORITY"      :    "priority",
			"RELATED-TO"    :    "relatedTo",
			"STATUS"        :    "requestStatus",
			"RESOURCES"     :    "resources",
			"SEQUENCE"      :    "sequence",
			"TRANSP"        :    "transp",
			"TZID"          :    "tzId",
			"URL"           :    "url",
			"RECURRENCE-ID" :    "recurrenceId",
			"UID"           :    "uid"
		};
		translationQuote = {
			"COMMENT"       :    "comment",
			"DESCRIPTION"   :    "note",
			"LOCATION"      :    "location",
			"SUMMARY"       :    "subject"
		};
		transTime = {
			"DTSTAMP"       :    "dtstamp",
			"DTSTART"       :    "dtstart",
			"DTEND"         :    "dtend",
			"CREATED"       :    "created",
			"LAST-MODIFIED" :    "lastModified"
		};

		if (translation[lObj.key]) {
			event[translation[lObj.key]] = lObj.value;
		} else if (translationQuote[lObj.key]) {
			event[translationQuote[lObj.key]] = Quoting.unquote(lObj.value);
		} else if (transTime[lObj.key]) {
			if (!DATETIME.test(lObj.value) && !DATE.test(lObj.value)) {
				Log.log("Skipping unreadable time in line " + lObj.line);
				return event;
			}
			if (lObj.parameters.tzid) {
				Log.log_icalDebug("Having Timezone: ", lObj.parameters.tzid);
				if (lObj.value.charAt(lObj.value.length - 1) === "Z") {
					Log.log_icalDebug("Z in time with TZID?? Should not happen!!");
				}

				if (!event.tzId) {
					event.tzId = lObj.parameters.tzid;
				}
				if (!event.tzId && event.tz) {
					event.tzId = event.tz.tzId;
				}

				year = parseInt(lObj.value.substr(0, 4), 10);
				event[transTime[lObj.key]] = {tzId: lObj.parameters.tzid, year: year, value: lObj.value};
			} else {
				//UTC or floating time!
				event[transTime[lObj.key]] = {tzId: false, value: lObj.value};
			}

			if (transTime[lObj.key] === "dtstart") {
				event.allDay = !DATETIME.test(lObj.value); //if we only have DATE not DATETIME in dtstart, make event allday.
			}

		} else if (lObj.key.indexOf("X-") === 0 && event.valid && !event.finished) {
			if (lObj.key === "X-FUNAMBOL-ALLDAY") {
				if (lObj.value === "1") {
					event.allDay = true;
				} else {
					event.allDay = false;
				}
			}
			if (lObj.key === "X-ALLDAYEVENT" || lObj.key === "X-MICROSOFT-CDO-ALLDAYEVENT") {
				if (lObj.value.toLowerCase() === "true") {
					event.allDay = true;
				} else {
					event.allDay = false;
				}
			}
			event[lObj.key.toLowerCase()] = lObj.line; //keep X-* extensions in object.
		} else { //one of the more complex cases.
			switch (lObj.key) {
			case "ATTACH": //I still don't get why this is an array?
				if (!event.attach) {
					event.attach = [];
				}
				event.attach.push(lObj.value);
				break;
			case "EXDATE": //EXDATE / RDATE is a list of timestamps . webOs wants them in an array
				event.exdates = parseDATEARRAY(lObj.value, event.exdates); // => split list, fill array. Doc says webos wants the date-time strings not ts like everywhere else.. hm.
				break;
			case "RDATE": //EXDATE / RDATE is a list of timestamps . webOs wants them in an array
				event.rdates = parseDATEARRAY(lObj.value, event.rdates); // => split list, fill array. Doc says webos wants the date-time strings not ts like everywhere else.. hm.
				break;
			case "BEGIN": //ignore begins other than ALARM.
				if (lObj.value === "VALARM") {
					event.alarm.push({}); //add new alarm object.
					event.alarmMode = true;
				} else if (lObj.value === "VTIMEZONE") {
					event.tzMode = true;
				} else if (lObj.value === "VTODO") {
					event.ignoreMode = lObj.value; //TODO: add todo support here.
				} else if (lObj.value === "VJOURNAL" || lObj.value === "VFREEBUSY") {
					event.ignoreMode = lObj.value;
				} else if (lObj.value === "VEVENT") {
					event.valid = true;
				} //will ignore begins of VTIMEZONE and VCALENDAR.
				break;
			case "END":
				if (lObj.value === "VEVENT") {
					event.finished = true;
				}
				break;
			case "ORGANIZER":
				//organizer is a full attendee again. Problem: This might cause duplicate attendees!
				//if there is just one attendee, there is just an organizer field and no attendee field at all.
				//but if there are more attendees, then there is an attendee field for the organizer and an
				//organizer field also that also contains most of the data...
				event.attendees = parseAttendee(lObj, event.attendees, true);
				break;
			case "ATTENDEE":
				event.attendees = parseAttendee(lObj, event.attendees, false);
				break;
			case "RRULE":
				event.rrule = parseRRULE(lObj.value);
				break;
			case "VERSION":
				if (lObj.value !== "2.0") {
					Log.log("WARNING: Parser only tested for iCal version 2.0, read: ", lObj.value);
				}
				break;
			case "DURATION":
				//this can be specified instead of DTEND.
				event.duration = lObj.value;
				break;
			default:
				if (lObj.key !== "PRODID" && lObj.key !== "METHOD" && lObj.key !== "END") {
					Log.log("My translation from iCal to webOs event does not understand " + lObj.key + " yet. Will skip line " + lObj.line);
				}
				break;
			}
		}

		return event;
	}

	function tryToFillParentIds(events, exceptions) {
		var i, event, revent, parentdtstart;
		//try to fill "parent id" and parentdtstamp for exceptions to recurring dates.

		if (events.length <= 1) {
			return events[0]; //only one event, no exceptions.
		}

		//search for original event, should usually be the first event.
		Log.log_icalDebug("processing ", events.length, " events in search of parentids.");
		for (i = events.length - 1; i >= 0; i -= 1) {
			if (events[i].rrule) {
				revent = events[i];
				parentdtstart = revent.dtstart;

				events.splice(i, 1); //remove this event.
			}
		}

		if (!revent) {
			Log.log_icalDebug("Got no recurring event. No events at all? ", events);
			return;
		}

		Log.log_icalDebug("Have parent ", revent, " and ", events.length, " children.");

		if (!revent.exdates) {
			revent.exdates = [];
		}

		for (i = 0; i < events.length; i += 1) {
			event = events[i];

			//need to fill _id after insertion into db.
			if (revent._id) {
				event.parentId = revent._id;
			}
			event.parentDtstart = parentdtstart;
			event.relatedTo = revent.uid || revent.uId;

			exceptions.push(event);
		}

		return revent;
	}


	function isTimeStringInTimeStringArray(timestring, tsArray, field) {
		var i, ts;
		if (!tsArray || !timestring) {
			return false;
		}
		ts = Time.iCalTimeToWebOsTime(timestring);
		for (i = 0; i < tsArray.length; i += 1) {
			if (field) {
				if (Time.iCalTimeToWebOsTime(tsArray[i][field]) === ts) {
					Log.log_icalDebug("Found ", tsArray[i][field], " for ", timestring);
					return true;
				}
			} else {
				if (Time.iCalTimeToWebOsTime(tsArray[i]) === ts) {
					Log.log_icalDebug("Found ", tsArray[i], " for ", timestring);
					return true;
				}
			}
		}

		return false;
	}

	function applyHacks(event, children) {
		var i, val, start, diff, date, recc, ex, lastChar;

		//webOs does not support DATE-TIME as alarm trigger. Try to calculate a relative alarm from that...
		//issue: this does not work, if server and device are in different timezones. Then the offset from
		//server to GMT still exists... hm.
		for (i = 0; event.alarm && i < event.alarm.length; i += 1) {
			if (event.alarm[i].alarmTrigger.valueType === "DATETIME" || event.alarm[i].alarmTrigger.valueType === "DATE-TIME") {
				//log_icalDebug("Calling iCalTimeToWebOsTime with " + event.alarm[i].alarmTrigger.value + " and " + {tzId: event.tzId});
				val = Time.iCalTimeToWebOsTime(event.alarm[i].alarmTrigger.value);
				Log.log_icalDebug("Hacking alarm, got alarm TS: ", val);
				Log.log_icalDebug("Value: ", event.alarm[i].alarmTrigger.value);
				start = event.dtstart;
				Log.log_icalDebug("Start is: ", start);
				date = new Date(start);
				Log.log_icalDebug("Date: ", date);
				diff = (val - start) / 60000; //now minutes.
				Log.log_icalDebug("Diff: ", diff);
				if (diff < 0) {
					val = "-PT";
					diff *= -1;
				} else {
					val = "PT";
				}
				Log.log_icalDebug("Diff after < 0: ", diff, " val: ", val);
				if (diff / 10080 >= 1) { //we have weeks.
					val += (diff / 10080).toFixed() + "W";
				} else if (diff / 1440 >= 1) { //we have days. :)
					val += (diff / 1440).toFixed() + "D";
					Log.log_icalDebug("Day: ", val);
				} else if (diff / 60 >= 1) {
					val += (diff / 60).toFixed() + "H";
					Log.log_icalDebug("Hour: ", val);
				} else {
					val += diff + "M";
					Log.log_icalDebug("Minutes: ", val, ", diff: ", diff);
				}
				Log.log_icalDebug("Val is: ", val);
				event.alarm[i].alarmTrigger.value = val;
				event.alarm[i].alarmTrigger.valueType = "DURATION";
				Log.log_icalDebug("Hacked alarm to ", event.alarm[i]);
			}
		}

		//allday events that span more than one day get one day to long in webOs.
		//webOs itself defines allDay events from 0:00 on the first day to 23:59 on the last day.
		//BUT, to avoid issues with timezones, we now set allday events to be from 12:00:00 to 12:00:01
		//So we need to subtract a whole day here, because it is now on 12:00:00 on the day after the event finished.
		//so substracting one second should repair this issue (hopefully :().
		if (event.allDay) { //86400000 = one day.
			event.dtend -= 86399000;
			//Some exporters write DTEND = DTSTART for a one day event, which would now end the day before.
			if (event.dtend < event.dtstart) {
				event.dtend = event.dtstart + 1000;
			}
		}

		//webOS interprets RFC5545 a bit different here than the rest of the world.
		//it requires *every* exception to be listed in exdates. Even those
		//that have an own child event with different settings. That's not
		//what the rest of the world does.
		//So we need to add all recurrenceIds of children to exdates array here
		//or webOS displays the unchange recurrence AND the changed one.
		if (event.rrule && children) {
			Log.log_icalDebug("Have parent with children. Adding recurrenceIds to exdates: ", event, " and ", children);
			if (!event.exdates) {
				event.exdates = [];
			}
			for (i = 0; i < children.length; i += 1) {
				if (!children[i].recurrenceId) {
					Log.log("========================== ERROR: child without reccurrenceId: ", children[i]);
				} else {
					//both can be either local or UTC => we can savely convert to webOS ts here.
					if (!isTimeStringInTimeStringArray(children[i].recurrenceId, event.exdates)) {
						recc = children[i].recurrenceId;
						Log.log_icalDebug(recc, " missing in exdates ", event.exdates, ", adding.");
						if (event.exdates.length) {
							ex = event.exdates[0];
							lastChar = ex[ex.length - 1];
							if (lastChar !== recc[recc.length - 1]) {
								recc = Time.webOsTimeToICal(Time.iCalTimeToWebOsTime(recc), event.allDay, lastChar === "Z" || lastChar === "z");
								Log.log_icalDebug("Modifyed time string to match those in exdates array: ", ex, " and ", recc);
							}
						}
						event.exdates.push(recc);
					}
				}
			}
		}

		return event;
	}

	function removeHacks(event, children) {
		var i;
		//webOS interprets RFC5545 a bit different here than the rest of the world.
		//it requires *every* exception to be listed in exdates. Even those
		//that have an own child event with different settings. That's not
		//what the rest of the world does.
		//So we need to remove all recurrenceIds of children from exdates array here
		//or remote servers will do stupid things.
		if (event.rrule && children) {
			Log.log_icalDebug("Have parent with children. Removing recurrenceIds from exdates: ", event, " and ", children);
			if (event.exdates) { //only necessary if we have exdates.
				event.exdates = event.exdates.slice(0); //copy exdates array, to avoid changes in original event here.
				for (i = event.exdates.length - 1; i >= 0; i -= 1) {
					if (isTimeStringInTimeStringArray(event.exdates[i], children, "recurrenceId")) {
						Log.log_icalDebug(event.exdates[i], " already in recurrenceIds, removing.");
						event.exdates.splice(i, 1);
					} else {
						Log.log_icalDebug(event.exdates[i], " unique.");
					}
				}
			} else {
				Log.log_icalDebug("No exdates array in event, hack not applicabel");
			}
		}

		return event;
	}

	function generateICalIntern(event) {
		var field = "", i, text = [], translation, translationQuote, transTime, allDay, value, result;
		//not in webOs: UID
		//in webos but not iCal: allDay, calendarID, parentId, parentDtStart (???)
		//string arrays: attach, exdates, rdates
		//more complex objects: ATTENDEES, ORGANIZER, BEGIN:VALARM, RRULE
		translation = {
			"categories"        :    "CATEGORIES",
			"classification"    :    "CLASS",
			"geo"               :    "GEO",
			"contact"           :    "CONTACT",
			"priority"          :    "PRIORITY",
			"relatedTo"         :    "RELATED-TO",
			"requestStatus"     :    "STATUS",
			"resources"         :    "RESOURCES",
			"sequence"          :    "SEQUENCE",
			//"transp"          :    "TRANSP", //intentionally skip this to let server decide...
			//"tzId"            :    "TZID", //skip this. It's not used anyway by most, and we now transmit everything using UTC.
			"url"               :    "URL",
			"aalarm"            :    "AALARM",
			"uid"               :    "UID" //try to sed uId. I hope it will be saved in DB although docs don't talk about it. ;)
		};
		translationQuote = {
			"comment"           :    "COMMENT",
			"note"              :    "DESCRIPTION",
			"location"          :    "LOCATION",
			"subject"           :    "SUMMARY"
		};
		transTime = {
			//"dtstamp"         :    "DTSTAMP",
			"created"           :    "CREATED",
			"lastModified"      :    "LAST-MODIFIED",
			"dtstart"           :    "DTSTART",
			"dtend"             :    "DTEND"
		};
		if (event._del === true) {
			return "";
		}
		if (event.uId) {
			event.uid = event.uid || event.uId;
			delete event.uId;
		}

		/*if (!event.tzId) {
			event.tzId = localTzId;
		}*/
		Log.log_icalDebug("Generating iCal for event", event);
		text.push("BEGIN:VEVENT");
		for (field in event) {
			if (event.hasOwnProperty(field)) {
				if (translation[field]) {
					text.push(translation[field] + ":" + event[field]);
				} else if (translationQuote[field] && event[field] !== "") {
					text.push(translationQuote[field] + ":" + Quoting.quote(event[field]));
				} else if (transTime[field]) {
					allDay = event.allDay;
					if (field !== "dtstart" && field !== "dtend") {
						allDay = false;
					}
					value = event[field];
					if (field === "dtend" && event.allDay) {
						//43200000 = 12 hours => 0 o'clock, -1 second, because we start from 12:00:01.
						//TODO: is this ALWAYS right?
						value += 43199000;
					}
					text.push(transTime[field] +
						(allDay ? ";VALUE=DATE" : "") +
						(!allDay && event.tzId && event.tzId !== "UTC" ? ";TZID=" + event.tzId : "") +
						":" +
						Time.webOsTimeToICal(value, allDay, event.tzId === "UTC"));
				} else if (field.indexOf("x-") === 0 && typeof event[field] === "string") {
					text.push(event[field]);
				} else { //more complex fields.
					switch (field) {
					case "attach":
						text.push("ATTACH:" + event.attach.join("")); //still don't have a clue why this is an array..
						break;
					case "exdates":
						if (event.exdates.length > 0) {
							text.push("EXDATE" + (event.allDay ? ";VALUE=DATE" : ";VALUE=DATE-TIME") + (!event.allDay && event.tzId && event.tzId !== "UTC" ? ";TZID=" + event.tzId : "") + ":" + event.exdates.join(","));
						}
						break;
					case "rdates":
						if (event.rdates.length > 0) {
							text.push("RDATE" + (event.allDay ? ";VALUE=DATE" : ";VALUE=DATE-TIME") + (!event.allDay && event.tzId && event.tzId !== "UTC" ? ";TZID=" + event.tzId : "") + ":" + event.rdates.join(","));
						}
						break;
					case "recurrenceId":
						text.push("RECURRENCE-ID" + (event.allDay ? ";VALUE=DATE" : ";VALUE=DATE-TIME") + (!event.allDay && event.tzId && event.recurrenceId.indexOf("Z") === -1 && event.tzId !== "UTC" ? ";TZID=" + event.tzId : "") + ":" + event.recurrenceId);
						break;
					case "alarm":
						text = buildALARM(event.alarm, text);
						break;
					case "attendees":
						for (i = 0; event.attendees && i < event.attendees.length; i += 1) {
							text = text.concat(buildATTENDEE(event.attendees[i]));
						}
						break;
					case "rrule":
						if (event.rrule) {
							text.push(buildRRULE(event.rrule, event.allDay));
						}
						break;
					default:
						if (field !== "_id" && field !== "_kind" && field !== "_rev" && field !== "parentId" && field !== "allDay" &&
								field !== "remoteId" && field !== "uri" && field !== "tzId" && field !== "etag" &&
								field !== "eventDisplayRevset" && field !== "parentDtstart" && field !== "calendarId" &&
								field !== "transp" && field !== "accountId" && field !== "dtstamp" && field !== "created" &&
								field !== "lastModified" && field !== "tz" && event[field] !== "") {
							Log.log_icalDebug("Unknown field ", field, " in event object with value ", event[field]);
						}
						break;
					}
				}
			}
		} //field loop

		text.push("END:VEVENT");

		//lines "should not" be longer than 75 chars in icalendar spec.
		for (i = 0; i < text.length; i += 1) {
			text[i] = Quoting.fold(text[i]);
		}
		result = text.join("\r\n");
		Log.log_icalDebug("Resulting iCal: " + result);
		return result;
	}

	// A UID's events make one series if they are a lone event, or one repeating event and its
	// exceptions.
	function isOneSeries(group) {
		var masters = group.filter(function (ev) { return !ev.recurrenceId; });
		return group.length === 1 || (masters.length === 1 && !!masters[0].rrule);
	}

	// Anything else with a shared UID is separate events: some exporters reuse one UID, and an
	// export can hold exceptions without the event they belong to. Each keeps its own UID, built
	// so that it stays the same from one parse to the next, and an exact repeat is dropped.
	function splitGroup(group) {
		var seen = {}, result = [];
		group.forEach(function (ev) {
			var uid = ev.uid || ev.uId,
				key = uid + "#" + (ev.recurrenceId || ev.dtstart);
			if (!seen[key]) {
				seen[key] = true;
				if (uid) {
					ev.uid = key;
				}
				delete ev.recurrenceId;
				result.push(ev);
			}
		});
		return result;
	}

	function getNewEvent() {
		return {
			alarm: [],
			comment: "",
			note: "",
			location: "",
			subject: "",
			attendees: [],
			rrule: null
		};
	}

	function preProcessIcal(ical) {
		var i, j, lines, lines2, line, result = [], proc;
		proc = ical.replace(/\r\n[ \t]/g, ""); //remove line breaks in key:value pairs. RFC 5545 folds with a space or a tab.
		proc = proc.replace(/\n[ \t]/g, ""); //remove line breaks in key:value pairs.
		// NOTE: do NOT strip =\r\n or =\n here — those are vCalendar 1.0 QP soft
		// line breaks and are not used in iCal 2.0. Stripping them corrupts any
		// property value (UID, base64, etc.) that legitimately ends with '='.

		lines = proc.split("\r\n"); //now every line contains a key:value pair => split them. somehow the \r seems to get lost somewhere?? is this always the case?

		for (i = 0; i < lines.length; i += 1) {
			lines2 = lines[i].split("\n");
			for (j = 0; j < lines2.length; j += 1) {
				line = lines2[j];
				if (line !== "") {
					result.push(line);
				}
			}
		}

		return result;
	}

	return {
		/**
		 * parses text representation of iCal into webOS calendarevent
		 * @param ical the ical string
		 * @return future that will contain the webOS object in result.result
		 */
		parseICal: function (ical) {
			var lines, i, lObj, event = getNewEvent(), alarm, tzContinue, outerFuture = new Future(), tz = {}, tzDataMap = {}, events = [];

			lines = preProcessIcal(ical);

			for (i = 0; i < lines.length; i += 1) {
				lObj = parseOneLine(lines[i]);
				if (event.alarmMode) {
					alarm = parseAlarm(lObj, event.alarm[event.alarm.length - 1]);
					if (alarm) {
						event.alarm[event.alarm.length - 1] = alarm;
					} else {
						delete event.alarmMode; //switch off alarm mode.
					}
				} else if (event.tzMode) {
					tzContinue = parseTimezone(lObj, tz);
					if (!tzContinue) {
						delete event.tzMode;
						if (tz.tzId) {
							tzDataMap[tz.tzId] = {standard: tz.standard, daylight: tz.daylight};
						}
						tz = {};
					}
				} else if (event.ignoreMode) {
					if (lObj.key === "END" && event.ignoreMode === lObj.value) { //make sure you ignore from the correct begin to the correct end.
						delete event.ignoreMode;
					}
				} else {
					event = parseLineIntoObject(lObj, event);
				}

				//END:VEVENT read. Prepare for next event.
				if (event.finished) {
					delete event.finished;
					events.push(event);
					event = getNewEvent();
				}
			}

			for (i = events.length - 1; i >= 0; i -= 1) {
				if (!events[i].valid) {
					events.splice(i, 1);
				} else {
					delete events[i].valid;
				}
			}

			Log.log_icalDebug("Parsing finished, event:", events);

			Time.setInlineTimezones(tzDataMap);
			Time.normalizeToLocalTimezone(events).then(function (future) {
				var result = checkResult(future), exceptions = [], revent;
				if (result.returnValue) {
					revent = tryToFillParentIds(events, exceptions);
					if (!revent) {
						Log.log("VCALENDAR Object did not contain valid VEVENT.");
						outerFuture.result = {returnValue: false};
						return;
					}
					exceptions.forEach(function (event) {
						applyHacks(event);
					});
					applyHacks(revent, exceptions);
					Log.log_icalDebug("After TZ conversion:", revent, " and ", exceptions);
					outerFuture.result = {returnValue: true, result: revent, hasExceptions: exceptions.length > 0, exceptions: exceptions};
				} else {
					outerFuture.result = result;
				}
			});

			return outerFuture;
		},

		/**
		 * generates text representation of webOS calendarevent
		 * @param event the event object
		 * @return future with the text in result.result
		 */
		generateICal: function (eventIn) {
			var future, event;

			event = extend({}, eventIn);
			removeHacks(event);
			future = Time.normalizeToEventTimezone([event]);

			future.then(this, function () {
				checkResult(future);
				var result = generateICalIntern(event);
				result = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:WEBOS.0.3.7\r\nMETHOD:PUBLISH\r\n" + result + "\r\nEND:VCALENDAR";
				future.result = { returnValue: true, result: result};
			});

			return future;
		},

		/**
		 * generates text representation of webOS calendarevent
		 * @param event the event object
		 * @return future with the text in result.result
		 */
		generateICalWithExceptions: function (eventIn, childrenIn) {
			var future, event, children = [];

			event = extend({}, eventIn);
			if (!childrenIn) {
				childrenIn = [];
			}
			childrenIn.forEach(function (e) {
				var event = extend({}, e);
				removeHacks(event);
				children.push(event);
			});
			removeHacks(event, children);

			future = Time.normalizeToEventTimezone([event].concat(children));
			future.then(function tzManagerCB() {
				checkResult(future);

				var result = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:WEBOS.0.3.7\r\nMETHOD:PUBLISH\r\n";
				result += generateICalIntern(event);

				children.forEach(function (e) {
					result += "\r\n" + generateICalIntern(e);
				});

				result += "\r\nEND:VCALENDAR";
				future.result = { returnValue: true, result: result};
			});

			return future;
		},

		/*
		 * Parse a full WebCal subscription .ics file containing multiple independent VEVENTs.
		 * Groups VEVENTs by UID to correctly handle recurring events and their exceptions.
		 * Returns future with: { returnValue: true, events: [{result, exceptions, hasExceptions}, ...] }
		 */
		parseWebCalICal: function (ical) {
			var lines, i, lObj, event, alarm, tzContinue, outerFuture, tz, tzDataMap, events, anonCounter, unreadable;

			event = getNewEvent();
			outerFuture = new Future();
			tz = {};
			tzDataMap = {};
			events = [];
			anonCounter = 0;
			unreadable = 0;

			lines = preProcessIcal(ical);

			for (i = 0; i < lines.length; i += 1) {
				try {
					lObj = parseOneLine(lines[i]);
				} catch (e) {
					Log.log("Skipping unreadable line: ", e);
					continue;
				}
				if (event.alarmMode) {
					alarm = parseAlarm(lObj, event.alarm[event.alarm.length - 1]);
					if (alarm) {
						event.alarm[event.alarm.length - 1] = alarm;
					} else {
						delete event.alarmMode;
					}
				} else if (event.tzMode) {
					tzContinue = parseTimezone(lObj, tz);
					if (!tzContinue) {
						delete event.tzMode;
						if (tz.tzId) {
							tzDataMap[tz.tzId] = {standard: tz.standard, daylight: tz.daylight};
						}
						tz = {};
					}
				} else if (event.ignoreMode) {
					if (lObj.key === "END" && event.ignoreMode === lObj.value) {
						delete event.ignoreMode;
					}
				} else {
					event = parseLineIntoObject(lObj, event);
				}

				if (event.finished) {
					delete event.finished;
					events.push(event);
					event = getNewEvent();
				}
			}

			for (i = events.length - 1; i >= 0; i -= 1) {
				if (!events[i].valid || !events[i].dtstart) {
					if (events[i].valid) {
						unreadable += 1;
					}
					events.splice(i, 1);
				} else {
					delete events[i].valid;
					if (events[i].rrule && events[i].rrule.unsupported) {
						Log.log("Keeping only the first occurrence, rule not supported: ", events[i].rrule.unsupported);
						events[i].rrule = null;
						delete events[i].exdates;
						events[i].rruleDropped = true;
					}
				}
			}

			if (events.length === 0) {
				outerFuture.result = {returnValue: false, unreadable: unreadable};
				return outerFuture;
			}

			Time.setInlineTimezones(tzDataMap);
			Time.normalizeToLocalTimezone(events).then(function (future) {
				var result = checkResult(future), uid, group, exceptions, revent, grouped, uidGroups, uidOrder;
				if (!result.returnValue) {
					outerFuture.result = result;
					return;
				}

				uidGroups = {};
				uidOrder = [];
				events.forEach(function (ev) {
					uid = ev.uid || ev.uId;
					if (!uid) {
						anonCounter += 1;
						uid = "anon_" + anonCounter;
					}
					if (!uidGroups[uid]) {
						uidGroups[uid] = [];
						uidOrder.push(uid);
					}
					uidGroups[uid].push(ev);
				});

				grouped = [];
				uidOrder.forEach(function (uid) {
					group = uidGroups[uid];
					if (!isOneSeries(group)) {
						splitGroup(group).forEach(function (ev) {
							applyHacks(ev);
							grouped.push({result: ev, exceptions: [], hasExceptions: false});
						});
						return;
					}
					exceptions = [];
					revent = tryToFillParentIds(group, exceptions);
					if (revent) {
						applyHacks(revent, exceptions);
						exceptions.forEach(function (e) { applyHacks(e); });
						grouped.push({
							result: revent,
							exceptions: exceptions,
							hasExceptions: exceptions.length > 0
						});
					}
				});

				outerFuture.result = {
					returnValue: true,
					events: grouped,
					unreadable: unreadable,
					unknownTimezones: Time.getUnknownTimezones()
				};
			});

			return outerFuture;
		},

		initialize: function () {
			return Time.initialize();
		}
	}; //end of public interface
}());

module.exports = iCal;
