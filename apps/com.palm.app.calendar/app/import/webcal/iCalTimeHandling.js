/*jslint node: true */
/*global Calendar, Log, Future, checkResult */

//Only for time and timezone handling. Ahrg.
var timezoneMapper = require(libPath + "timezoneMapper.js");

var Time = (function () {
	"use strict";
	var DATETIME = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)(Z?)$/,
		DATE = /^(\d{4})(\d\d)(\d\d)$/,
		//DATE: yyyymmdd, time: hhmmss, if both are present they are divided by a T. A Z at the end is optional.
		//if only a Date is given (=> allDay), no letters are present and just 8 numbers should be given.
		//Usually the Z at the end of DATE-TIME should say that it's UTC. But I'm quite sure that most programs do this wrong... :(
		//there is a timezone property that could be set.
		//it could also be a comma seperated list of dates / date times. But we don't support that, yet.. ;)
		//used to try timeZone correction...
		DAY = 86400000,
		TZManager = Calendar.TimezoneManager(),
		TZManagerInitialized = false,
		shiftAllDay = true,
		inlineTimezoneData = {},
		unknownTimezones = {};
	/**
	 * Converts iCal time string of format YYYYMMDDTHHMM(Z) into javascript timestamp (from local timezone or UTC if Z is present).
	 * Exchange looks like: DTSTART;TZID="Pacific Standard Time":YYYYMMDDTHHMMSS
	 */
	function iCalTimeToWebOsTime(time) {
		var t = 0, result, date, utc = time.charAt(time.length - 1) === "Z",
			allDayCue = !DATETIME.test(time);

		if (allDayCue) {
			//only have DATE, add hours, minutes, and seconds
			result = DATE.exec(time);
			result.push(12); //use 12 here, so that time is in the middle of day and timezone changes, i.e. daylight saving times, won't spread all day events to multiple days.
			result.push(0);
			result.push(0);
		} else {
			//have date and time:
			result = DATETIME.exec(time);
		}
		//look at tzId. Shift whole thing that we have all day events on the right day, no matter the TZ.
		date = new Date(result[1], result[2] - 1, result[3], result[4], result[5], result[6]);
		if (!utc) {
			//for times in the local tz, this will be ok in any case.
			t = date.getTime();
		} else { //got UTC time, we can easily correct that:
			t = Date.UTC(result[1], result[2] - 1, result[3], result[4], result[5], result[6]); //get UTC timestamp from UTC date values :)
			if (allDayCue && shiftAllDay) { //move to 0:00 in local timeZone.
				t += date.getTimezoneOffset() * 60000;
			}
		}
		return t;
	}

	/**
	 * Converts javascript ts into iCal time string of format YYYYMMDDTHHMM in local TZ.
	 * If allday param is true, only YYYYMMDD will be returned.
	 * If utc param is true, string will be in UTC and a "Z" will be appended.
	 */
	function webOsTimeToICal(time, allDay, utc) {
		var t = "", date;

		date = new Date(time);
		if (utc) {
			if (allDay && shiftAllDay) {
				t = date.getFullYear() + (date.getMonth() + 1 < 10 ? "0" : "") + (date.getMonth() + 1) + (date.getDate() < 10 ? "0" : "") + date.getDate();
			} else {
				t = date.getUTCFullYear() + (date.getUTCMonth() + 1 < 10 ? "0" : "") + (date.getUTCMonth() + 1) + (date.getUTCDate() < 10 ? "0" : "") + date.getUTCDate();
				if (!allDay) {
					t += "T" + (date.getUTCHours() < 10 ? "0" : "") + date.getUTCHours();
					t += (date.getUTCMinutes() < 10 ? "0" : "") + date.getUTCMinutes();
					t += (date.getUTCSeconds() < 10 ? "0" : "") + date.getUTCSeconds();
					t += "Z"; //is a hint that time is in UTC.
				}
			}
		} else {
			t = date.getFullYear() + (date.getMonth() + 1 < 10 ? "0" : "") + (date.getMonth() + 1) + (date.getDate() < 10 ? "0" : "") + date.getDate();
			if (!allDay) {
				t += "T" + (date.getHours() < 10 ? "0" : "") + date.getHours();
				t += (date.getMinutes() < 10 ? "0" : "") + date.getMinutes();
				t += (date.getSeconds() < 10 ? "0" : "") + date.getSeconds();
			}
		}
		return t;
	}

	/**
	 * Convert duration string (for example +P0D) into microseconds to add to javascript timestamps.
	 */
	function convertDurationIntoMicroseconds(duration) {
		var signRegExp = /^([+\-])?PT?([0-9DHM]+)/gi, parts, sign, remaining,
			weekRegExp = /(\d)+W/gi,
			dayRegExp = /(\d)+D/gi,
			hourRegExp = /(\d)+H/gi,
			minuteRegExp = /(\d)+M/gi,
			secondRegExp = /(\d)+S/gi,
			offset = 0;

		parts = signRegExp.exec(duration);
		if (parts) {
			sign = parts[1] === "-" ? -1 : 1;
			remaining = parts[2];

			parts = weekRegExp.exec(remaining);
			if (parts) {
				offset += parseInt(parts[1], 10) * 86400000 * 7;
			}

			parts = dayRegExp.exec(remaining);
			if (parts) {
				offset += parseInt(parts[1], 10) * 86400000;
			}

			parts = hourRegExp.exec(remaining);
			if (parts) {
				offset += parseInt(parts[1], 10) * 3600000;
			}

			parts = minuteRegExp.exec(remaining);
			if (parts) {
				offset += parseInt(parts[1], 10) * 60000;
			}

			parts = secondRegExp.exec(remaining);
			if (parts) {
				offset += parseInt(parts[1], 10) * 1000;
			}

			offset *= sign;
			Log.log_icalDebug("Converted duration " + duration + " into offset " + offset);
			return offset;
		}
		//else
		Log.log("iCal.js======> DURATION DID NOT MATCH: ", duration);
		return 0;
	}

	/**
	 * fetchTimezone information for timezones in the event and years required by the event.
	 */
	function fetchTimezones(events) {
		var timezones = [],
			years = [],
			tsFields = ["dtstart", "dtstamp", "dtend", "created", "lastModified"],
			tsArrays = ["exdates", "rdates", "recurrenceId"],
			seenTimezones = {},
			untilYears = [],
			MAX_TZ_YEAR = (new Date()).getFullYear() + 5;

		// Once per zone: one per event asked the time zone service for every zone-year
		// thousands of times over on a large file.
		function pushTimezone(tzId) {
			if (tzId && !seenTimezones[tzId]) {
				seenTimezones[tzId] = true;
				timezones.push(tzId);
			}
		}

		events.forEach(function (event) {
			var dtendYear,
				dtstartYear,
				dtend,
				dtstart,
				until;

			pushTimezone(event.tzId || TZManager.timezone);
			//Also push the mapped timezone, in case its needed
			pushTimezone(timezoneMapper.mapWindowsToIANA(event.tzId));

			tsFields.forEach(function (field) {
				if (event[field]) {
					if (typeof event[field] === "object") {
						if (event[field].tzId) {
							pushTimezone(event[field].tzId);
							pushTimezone(timezoneMapper.mapWindowsToIANA(event[field].tzId));
						}
						if (event[field].year) {
							Log.log_icalDebug("Adding year ", event[field].year, " from ", field, " which was object: ", event[field]);
							years.push(event[field].year);
						}
						event.clockTexts = event.clockTexts || {};
						event.clockTexts[field] = event[field].value;
						event[field] = iCalTimeToWebOsTime(event[field].value); //overwrite objects with ts here.
					} else {
						var date = new Date(event[field]);
						Log.log_icalDebug("Adding year ", date.getFullYear(), " from ", field, " which was ts? ", event[field]);
						years.push(date.getFullYear());
					}
				}
			});

			tsArrays.forEach(function (field) {
				var i, year;
				if (typeof event[field] === "string") {
					year = parseInt(event[field].substr(0, 4), 10);
					Log.log_icalDebug("Adding year ", year, " from ", field, " which was string");
					years.push(year);
				} else if (event[field] && event[field].length) {
					for (i = 0; i < event[field].length; i += 1) {
						if (typeof event[field][i] === "string") {
							year = parseInt(event[field][i].substr(0, 4), 10);
							Log.log_icalDebug("Adding year ", year, " from ", field, " which was array.");
							years.push(year);
						}
					}
				}
			});

			if (event.rrule && event.rrule.until) {
				Log.log_icalDebug("fetchTimezones(): rrule: ", event.rrule);
				if (typeof event.rrule.until === "string") {
					event.rrule.untilText = event.rrule.until;
					until = parseInt(event.rrule.until.substr(0, 4), 10);
					event.rrule.until = iCalTimeToWebOsTime(event.rrule.until); //overwrite objects with ts here.

				} else {
					until = new Date(event.rrule.until).getUTCFullYear();
				}
				Log.log_icalDebug("Adding year ", until, " from rrule.");
				// Cap far-future UNTIL years (e.g. UNTIL=2090 on a recurring event): only
				// the event's own years need to convert exactly.
				untilYears.push(until > MAX_TZ_YEAR ? MAX_TZ_YEAR : until);
			}
		});

		// Deduplicate before asking TZManager to load.
		years = years.concat(untilYears);
		var uniqueYearMap = {}, cappedYears = [], y;
		for (y = 0; y < years.length; y += 1) {
			var capped = years[y];
			if (!uniqueYearMap[capped]) {
				uniqueYearMap[capped] = true;
				cappedYears.push(capped);
			}
		}

		Log.log_icalDebug("fetchTimezones(): years: ", cappedYears, " for ", timezones);

		return TZManager.loadTimezones(timezones, cappedYears);
	}

	function normalizeICalTimeString(value, source, target) {
		if (value) {
			var lastChar = value[value.length - 1],
				oldDate,
				newDate;
				if (lastChar !== "Z" && lastChar !== "z") {
					if (DATE.test(value)) {
						return value; // DATE-only values are timezone-independent, never shift them
					}
					Log.log_icalDebug("Need to process, because of lastChar: ", lastChar);
					oldDate = iCalTimeToWebOsTime(value); // new Date( event[field][i] );
					newDate = convertTime(oldDate, source, target);
				value = webOsTimeToICal(newDate, false, false);
				Log.log_icalDebug("    ", oldDate, " (", new Date(oldDate).toDateString(), ") -> ", newDate, " (", new Date(newDate).toDateString(),  ") value = ", value);
			}
			return value;
		}
	}

	/*
	 * normalize an array of timestamps (i.e. exdates or rdates) for the local timezone
	 */
	function normalizeToLocalTimezoneArray(event, field, direction) {
		if (event[field]) {
			var i,
				oldDate,
				newDate,
				value,
				lastChar,
				source = event.tzId,
				target = TZManager.timezone;
			if (direction === "event") {
				source = TZManager.timezone;
				target = event.tzId;
			}

			Log.log_icalDebug("----CONVERTING ", field, " TZ from ", source, " to ", target, "; ", event[field]);

			for (i = 0; i < event[field].length; i += 1) {
				Log.log_icalDebug("    item ", i, ": ", event[field][i]);
				value = event[field][i];
				event[field][i] = normalizeICalTimeString(value, source, target);
			}
		}
	}

	/**
	 * Normalize events to local timezone or
	 * event in local timezone into the timezone specified by tzId.
	 */

	/* Add support for Windows timezones */
	function isUtc(tzString) {
		return (/^(Etc\/)?(UTC|UCT|GMT|Zulu)$/i).test(tzString);
	}

	// TZManager.getOffset, minus two faults. It answers 0 for any name containing "UTC", which
	// takes in "UTC-11" and "(UTC-05:00) Eastern Time (US & Canada)". And it never applies
	// daylight time south of the equator, where dstStart comes after dstEnd in the year. Answers
	// undefined when the zone was not loaded, which is all an unknown name ever gets.
	function loadedOffset(year, tzString, timestampNoMillis) {
		var info, inDaylight;
		if (isUtc(tzString)) {
			return 0;
		}
		if (!TZManager.hasTimezoneInfo(tzString, year)) {
			return undefined;
		}
		info = TZManager.timezones[year][tzString];
		if (!info.hasDstChange) {
			return info.utcOffset;
		}
		if (info.dstStart <= info.dstEnd) {
			inDaylight = timestampNoMillis >= info.dstStart && timestampNoMillis < info.dstEnd;
		} else {
			inDaylight = timestampNoMillis >= info.dstStart || timestampNoMillis < info.dstEnd;
		}
		return inDaylight ? info.dstOffset : info.utcOffset;
	}

	// When a VTIMEZONE section's changeover falls in a year, as a clock reading held in a UTC
	// timestamp. Null if the section doesn't say.
	function inlineChangeover(section, year) {
		var start = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)/.exec(section.dtstart || ""),
			rules = (section.rrule && section.rrule.rules) || [],
			month, weekday, ord, day, date;
		if (!start) {
			return null;
		}
		month = parseInt(start[2], 10);
		day = parseInt(start[3], 10);
		rules.forEach(function (rule) {
			if (rule.ruleType === "BYMONTH") {
				month = parseInt(rule.ruleValue[0].ord, 10);
			} else if (rule.ruleType === "BYDAY") {
				weekday = rule.ruleValue[0].day;
				ord = parseInt(rule.ruleValue[0].ord, 10);
			}
		});
		if (weekday !== undefined && ord) {
			if (ord > 0) {
				date = new Date(Date.UTC(year, month - 1, 1));
				day = 1 + (weekday - date.getUTCDay() + 7) % 7 + (ord - 1) * 7;
			} else {
				date = new Date(Date.UTC(year, month, 0)); //last day of the month
				day = date.getUTCDate() - (date.getUTCDay() - weekday + 7) % 7 + (ord + 1) * 7;
			}
		}
		return Date.UTC(year, month - 1, day, parseInt(start[4], 10), parseInt(start[5], 10));
	}

	// A file's own VTIMEZONE at a real moment, from its changeover rules. Each changeover is a
	// clock reading in the offset in force before it.
	function inlineOffset(inlineTz, timestampNoMillis) {
		var instant = timestampNoMillis * 1000,
			standard = inlineTz.standard || {},
			daylight = inlineTz.daylight || {},
			year,
			toDaylight,
			toStandard,
			inDaylight;
		if (daylight.offset === undefined) {
			return standard.offset === undefined ? undefined : standard.offset * 3600;
		}
		if (standard.offset === undefined) {
			return daylight.offset * 3600;
		}
		year = new Date(instant + standard.offset * 3600000).getUTCFullYear();
		toDaylight = inlineChangeover(daylight, year);
		toStandard = inlineChangeover(standard, year);
		if (toDaylight === null || toStandard === null) {
			return standard.offset * 3600;
		}
		toDaylight -= standard.offset * 3600000;
		toStandard -= daylight.offset * 3600000;
		if (toDaylight < toStandard) {
			inDaylight = instant >= toDaylight && instant < toStandard;
		} else {
			inDaylight = instant >= toDaylight || instant < toStandard; //south of the equator
		}
		return (inDaylight ? daylight.offset : standard.offset) * 3600;
	}

	// The calendar works out repeats in an event's tzId, and only knows real zone names. A
	// Windows name becomes its IANA name; one the device can't look up gets the device's zone.
	function usableTimezone(tzId, year) {
		var mapped;
		if (!tzId || (!isUtc(tzId) && !TZManager.hasTimezoneInfo(tzId, year))) {
			mapped = tzId && timezoneMapper.mapWindowsToIANA(tzId);
			return (mapped && TZManager.hasTimezoneInfo(mapped, year)) ? mapped : TZManager.timezone;
		}
		return tzId;
	}

	function getOffsetWithMapping(year, tzString, timestampNoMillis) {
		var offSet = loadedOffset(year, tzString, timestampNoMillis), mappedTZ;
		if (offSet === undefined) {
			mappedTZ = timezoneMapper.mapWindowsToIANA(tzString);
			if (mappedTZ) {
				offSet = loadedOffset(year, mappedTZ, timestampNoMillis);
			}
		}
		// Fall back to inline VTIMEZONE data from the parsed iCal file
		if (offSet === undefined && inlineTimezoneData[tzString]) {
			offSet = inlineOffset(inlineTimezoneData[tzString], timestampNoMillis);
		}
		// Last resort for the device's own timezone: the JS runtime always
		// reflects the actual OS timezone offset, even when TZManager doesn't
		// recognize the timezone name string.
		if (offSet === undefined && tzString === TZManager.timezone) {
			offSet = -(new Date(timestampNoMillis * 1000).getTimezoneOffset()) * 60;
		}
		return offSet;
	}
	// Three kinds of value pass through here. A timestamp in the device's zone is real time. One
	// in another zone is that zone's clock reading held on the device's clock, which is how a
	// parsed time arrives. A wall is a clock reading held in UTC fields, so offsets can be
	// applied to it without Date getting involved.
	function wallOfHeldTime(timestamp) {
		var d = new Date(timestamp);
		return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
	}

	function heldTimeOfWall(wall) {
		var d = new Date(wall);
		return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()).getTime();
	}

	function offsetAt(tzId, instant) {
		var offset = getOffsetWithMapping(new Date(instant).getFullYear(), tzId, instant / 1000);
		return offset === undefined ? undefined : offset * 1000;
	}

	// A skipped clock reading takes the offset from before the change, and a repeated one means
	// the first time round, as RFC 5545 says. Undefined for a zone nothing recognises.
	function wallToInstant(wall, tzId) {
		var before = offsetAt(tzId, wall - 86400000),
			after = offsetAt(tzId, wall + 86400000),
			first,
			second,
			firstValid,
			secondValid;
		if (before === undefined) {
			before = after;
		}
		if (after === undefined) {
			after = before;
		}
		if (before === undefined) {
			return undefined;
		}
		first = wall - before;
		second = wall - after;
		if (before === after) {
			return first;
		}
		firstValid = offsetAt(tzId, first) === before;
		secondValid = offsetAt(tzId, second) === after;
		if (firstValid && secondValid) {
			return Math.min(first, second);
		}
		return (secondValid && !firstValid) ? second : first;
	}

	function wallOfText(text) {
		var parts = DATETIME.exec(text);
		return parts && !parts[7] ? Date.UTC(parts[1], parts[2] - 1, parts[3], parts[4], parts[5], parts[6]) : undefined;
	}

	// A time from the file, converted from its text. Its parsed timestamp was held on the device's
	// clock, which moves a reading inside the device's own skipped hour.
	function convertFileTime(event, field, source, target) {
		var wall = event.clockTexts && wallOfText(event.clockTexts[field] || ""),
			instant;
		if (wall !== undefined && source && source !== TZManager.timezone && target === TZManager.timezone) {
			instant = wallToInstant(wall, source);
			if (instant !== undefined) {
				return instant;
			}
		}
		return convertTime(event[field], source, target);
	}

	function convertTime (timestamp, srcTz, destTz) {
		var defaultTz = TZManager.timezone,
			source = srcTz || defaultTz,
			dest = destTz || defaultTz,
			instant,
			offset;
		if (source === dest) {
			return timestamp;
		}
		instant = source === defaultTz ? timestamp : wallToInstant(wallOfHeldTime(timestamp), source);
		// A name nothing recognises can't be converted. Keep the clock reading the file gave,
		// which is right whenever the event is in this zone, and let the caller report it.
		if (instant === undefined) {
			unknownTimezones[source] = true;
			return timestamp;
		}
		if (dest === defaultTz) {
			return instant;
		}
		offset = offsetAt(dest, instant);
		if (offset === undefined) {
			unknownTimezones[dest] = true;
			return timestamp;
		}
		return heldTimeOfWall(instant + offset);
	}
	/* End support for Windows timezones */

	function wallAt(instant, tzId) {
		return instant + (offsetAt(tzId || TZManager.timezone, instant) || 0);
	}

	function dayOfWall(wall) {
		var d = new Date(wall), month = d.getUTCMonth() + 1, day = d.getUTCDate();
		return d.getUTCFullYear() + (month < 10 ? "0" : "") + month + (day < 10 ? "0" : "") + day;
	}

	// The calendar compares an exception by its day in the event's zone. A clock reading in that
	// zone already says which day. Only a UTC time has to be worked out.
	function exceptionDay(value, tzId) {
		if (value.charAt(value.length - 1) !== "Z" && value.charAt(value.length - 1) !== "z") {
			return value.substr(0, 8);
		}
		return dayOfWall(wallAt(iCalTimeToWebOsTime(value), tzId));
	}

	// The calendar stops a repeat with until < date, where date is midnight on the device's clock
	// of the occurrence's day in the event's zone. It also skips the whole repeat when until is
	// before the range on screen, and that range is real time. So until has to reach the end of
	// the last day as the event's zone counts it, and also the real end of the last occurrence,
	// which can be later when the event's zone is behind the device. That can reach the next day,
	// so any day it takes in is an exception, or it would gain an occurrence.
	function setCalendarUntil(event, source) {
		var rrule = event.rrule,
			text = rrule.untilText,
			device = TZManager.timezone,
			instant,
			clock,
			start,
			lastDay,
			last,
			lastEnd,
			endOfDay,
			next;

		delete rrule.untilText;
		if (event.allDay) {
			rrule.until = new Date(parseInt(text.substr(0, 4), 10), parseInt(text.substr(4, 2), 10) - 1,
				parseInt(text.substr(6, 2), 10), 23, 59, 59).getTime();
			return;
		}

		instant = text.charAt(text.length - 1) === "Z" ? rrule.until : convertFileTime({until: rrule.until, clockTexts: {until: text}}, "until", source, device);
		clock = wallAt(instant, event.tzId);
		start = wallAt(event.dtstart, event.tzId);
		lastDay = Math.floor(clock / DAY);
		// UNTIL before that day's start time means the day before was the last.
		if (clock - lastDay * DAY < start - Math.floor(start / DAY) * DAY) {
			lastDay -= 1;
		}

		last = new Date(lastDay * DAY);
		endOfDay = new Date(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate(), 23, 59, 59).getTime();
		lastEnd = wallToInstant(lastDay * DAY + (start - Math.floor(start / DAY) * DAY), event.tzId) +
			(event.dtend - event.dtstart);
		rrule.until = Math.max(endOfDay, lastEnd);

		for (next = lastDay + 1; new Date(new Date(next * DAY).getUTCFullYear(), new Date(next * DAY).getUTCMonth(),
				new Date(next * DAY).getUTCDate()).getTime() <= rrule.until; next += 1) {
			event.exceptionDays.push(dayOfWall(next * DAY));
		}
	}

	function normalizeToTimezone(events, direction) {
		var future = fetchTimezones(events),
			tsFields = ["dtstamp", "created", "lastModified"];

		future.then(function (future) {
			future.getResult();
			Log.log_icalDebug("Processing ", events.length, " events.", events);
			events.forEach(function (event) {
				Log.log_icalDebug("normalizeTo", direction, "Timezone(): ");
				var newDtend, oldVal, dt, source = event.tzId, target = TZManager.timezone,
					exceptions = (event.exdates || []).concat(event.recurrenceId ? [event.recurrenceId] : []);
				if (direction === "event") {
					target = event.tzId;
					source = TZManager.timezone;
				}

				if (event.dtstart) {
					Log.log_icalDebug("----CONVERTING TZ from ", source, " to ", target);
					oldVal = event.dtstart;
					if (!event.allDay) {
						event.dtstart = convertFileTime(event, "dtstart", source, target);
					}
					Log.log_icalDebug("    ", (new Date(oldVal).toDateString() + " " + new Date(oldVal).toLocaleTimeString()), " -> ", (new Date(event.dtstart).toDateString() + " " + new Date(event.dtstart).toLocaleTimeString()));
				}

				if (event.dtend) {
					if (!event.allDay) {
						newDtend = convertFileTime(event, "dtend", source, target);
					} else {
						newDtend = event.dtend;
					}
					Log.log_icalDebug("----DTEND EXISTED ", event.dtend, "->", newDtend);
					event.dtend = newDtend;
				} else if (event.duration) {
					event.dtend = event.dtstart + convertDurationIntoMicroseconds(event.duration);
					Log.log_icalDebug("----Created dtend ", event.dtend, " from ", event.duration, " and ", event.dtstart);
					delete event.duration;
				} else if (event.dtstart && !event.recurrenceId) {
					// dtend does not exist; if this is not an exception to another
					// event, synthesize one at the end of the day
					if (event.allDay) {
						// for all-day events advance to noon next day (applyHacks will adjust to 12:00:01 same day)
						dt = new Date(event.dtstart);
						dt.setDate(dt.getDate() + 1);
						newDtend = dt.getTime();
					} else {
						dt = new Date(event.dtstart);
						dt.setHours(23);
						dt.setMinutes(59);
						dt.setSeconds(59);
						newDtend = convertTime(dt.getTime(), source, target);
					}
					Log.log_icalDebug("----DTEND DID NOT EXIST ", dt.getTime(), " -> ", newDtend);
					event.dtend = newDtend;
				}

				if (event.recurrenceId) {
					oldVal = event.recurrenceId;
					event.recurrenceId = normalizeICalTimeString(event.recurrenceId, source, target);
					Log.log_icalDebug("----RECURRENCE-ID converted ", oldVal, " to ", event.recurrenceId);
				}

				tsFields.forEach(function (field) {
					var val = event[field];
					if (val) {
						event[field] = convertTime(val, source, target);
						Log.log_icalDebug("----", field.toUpperCase(), " converted ", val, " to ", event[field]);
					}
				});

				if (event.rrule && event.rrule.until && !event.allDay && direction === "event") {
					event.rrule.until = convertTime(
						event.rrule.until,
						source,
						target
					);
				}

				delete event.clockTexts;
				normalizeToLocalTimezoneArray(event, "exdates", direction);
				normalizeToLocalTimezoneArray(event, "rdates", direction);

				if (direction !== "event") {
					event.tzId = usableTimezone(event.tzId, new Date(event.dtstart).getFullYear());
					event.exceptionDays = exceptions.map(function (value) {
						return exceptionDay(value, event.tzId);
					});
					if (event.rrule && event.rrule.untilText) {
						setCalendarUntil(event, source);
					}
				}
			});

			future.result = {returnValue: true, events: events};
		});

		return future;
	}

	function normalizeToLocalTimezone(events) {
		return normalizeToTimezone(events, "local");
	}

	function normalizeToEventTimezone(events) {
		return normalizeToTimezone(events, "event");
	}

	return {
		/**
		 * Normalize event to local timezone.
		 * Meant as post processing after ical parsing.
		 * Timestamp members need to be objects with this fields:
		 * { tzId: "", year: "", value: "YYYYMMDD(THHMM(Z))" (required) }
		 */
		normalizeToLocalTimezone: normalizeToLocalTimezone,

		/**
		 * Normalize local timestamps to event timezone
		 * Meant as pre processing before ical generation.
		 */
		normalizeToEventTimezone: normalizeToEventTimezone,

		/**
		 * Supply inline VTIMEZONE offset data parsed from an iCal file.
		 * Used as a fallback when TZManager and the Windows mapper both return 0.
		 * @param tzMap object keyed by tzId, values { standard: {offset}, daylight: {offset} }
		 */
		setInlineTimezones: function (tzMap) {
			inlineTimezoneData = tzMap || {};
			unknownTimezones = {};
		},

		/**
		 * Zone names seen since setInlineTimezones that could not be converted.
		 * @return array of names
		 */
		getUnknownTimezones: function () {
			return Object.keys(unknownTimezones);
		},

		convertDurationIntoMicroseconds: convertDurationIntoMicroseconds,
		iCalTimeToWebOsTime: iCalTimeToWebOsTime,
		webOsTimeToICal: webOsTimeToICal,

		initialize: function () {
			var future = new Future();
			if (!TZManagerInitialized) {
				Log.log_icalDebug("iCal: init TZManager");
				future.nest(TZManager.setup());
				future.then(this, function tzManagerReturn() {
					checkResult(future);
					Log.log_icalDebug("TZManager initialized");
					TZManagerInitialized = true;
					future.result = { returnValue: true };
				});
			} else { //TZManager already initialized.
				future.result = { returnValue: true };
			}

			return future;
		}

	};
}());

module.exports = Time;
