/*jslint node: true */
/*exported Base64, unquote, quote, fold */

/**
 * Unquotes not allowed characters from a vcard/ical string.
 * @param string should be the value of a field in a vcard or ical
 * @return unquoted string
 */
exports.unquote = function (string) {
	"use strict";
	if (string === undefined || string === null || typeof string !== "string") {
		return string;
	}
	string = string.replace(/\\\\/gmi, "\\");
	string = string.replace(/\\,/gmi, ",");
	string = string.replace(/\\;/gmi, ";");
	string = string.replace(/\\:/gmi, ":");
	string = string.replace(/\\n/gmi, "\n");
	string = string.replace(/\\r/gmi, "\r");
	string = string.replace(/&amp;/gmi, "&");
	string = string.replace(/&lt;/gmi, "<");
	string = string.replace(/&gt;/gmi, ">");
	string = string.replace(/&quot;/gmi, "\"");
	string = string.replace(/&apos;/gmi, "'");
	return string;
};

/**
 * Quotes not allowed characters in a vcard/ical string.
 * @param string should be the value of a field in a vcard or ical
 * @return quoted string
 */
exports.quote = function (string) {
	"use strict";
	if (string === undefined || string === null || typeof string !== "string") {
		return string;
	}
	string = string.replace(/\\/gmi, "\\\\");
	string = string.replace(/,/gmi, "\\,");
	string = string.replace(/;/gmi, "\\;");
	string = string.replace(/\n/gmi, "\\n");
	string = string.replace(/\r/gmi, "\\r");
	return string;
};

/**
 * Applies string folding, vCard/iCal strings should not be too long,
 * if they are too long new line and spaces need to be inserted.
 * @param string should be the value of a field in a vcard or ical
 * @return folded string
 */
exports.fold = function (string) {
	"use strict";
	var parts = [];
	while (string.length > 72) {
		parts.push(string.substring(0, 72));
		string = " " + string.substring(72);
	}
	parts.push(string);
	return parts.join("\r\n");
};
