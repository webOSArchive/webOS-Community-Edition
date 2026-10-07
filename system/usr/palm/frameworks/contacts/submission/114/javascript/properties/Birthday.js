/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, exports, RB, console, Mojo */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 *							year - month - day
 * var birthday = new Birthday("1984-04-04");
 * 
 * var birthdayString = birthday.getValue();
 * var birthdayStringAgain = birthday.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Birthday = exports.Birthday = PropertyBase.create({
	/**
	* @lends Birthday#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Birthday#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Birthday#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

// TODO: add methods to get the year month day and use them in the getDisplayValue and getDateObject functions

/**
 * @returns {string}
 */
Birthday.prototype.getDisplayValue = function (options) {
	var date = this.getDateObject(),
		formatObj = {};
	
	formatObj.date = "long";

	if (date) {	
		if (Mojo && Mojo.Format && Mojo.Format.formatDate) {
			
			//TODO: check to make sure the date from the string is not actually 1900
			if (date.getFullYear() === 1900) {
				formatObj.dateComponents = "dm";
			}
			
			options = options || formatObj;
		
			return Mojo.Format.formatDate(date, options);
		} else {
			return date.toLocaleDateString();
		}
	} else {
		return "";
	}
};

Birthday.prototype.getDateObject = function () {
	var value = this.getValue(),
		splitDateValue = value ? value.split("-") : [];
	
	if (splitDateValue.length > 2) {
		return new Date(splitDateValue[0], parseInt(splitDateValue[1], 10) - 1, splitDateValue[2]);
	} else if (splitDateValue.length > 1 && value.length > 6) {
		return new Date(splitDateValue[0], splitDateValue[1], -1);
	} else if (splitDateValue.length > 1 && value.length > 4) {
		return new Date(-1, parseInt(splitDateValue[0], 10) - 1, splitDateValue[1]);
	} else if (splitDateValue.length > 0) {
		return new Date(splitDateValue[0]);
	} else {
		return;
	}
};

/** 
 * @name Birthday#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Birthday.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});

// This is only here to get the birthday into the form the localDateToDate function
// expects
Birthday.translateBirthdayFromCurrentForm = function (unformatted) {
	return unformatted ? unformatted.replace(/-/gi, "") : unformatted;
	//return unformatted;
};

Birthday.parseBirthday = function (unformatted) {
	var date,
		options = {};
	
	options.date = "long";

	unformatted = Birthday.translateBirthdayFromCurrentForm(unformatted);
	date = parseInt(unformatted, 10);
	
	if (date === "NaN") {
		console.log("The birthday " + unformatted + " is not in the localdate int format");
		return Mojo.Format.formatDate(new Date(), options);
	}
	
	date = Birthday.localDateToDate(date);
	if ((date.getFullYear() === 1900) || (date.getFullYear() === 0)) {
		options.dateComponents = "dm";
	}

	return Mojo.Format.formatDate(date, options);
};

Birthday.localDateToDate = function (date) {
	var day, month, year, returnDate;
	
	if (!date) {
		return null;
	}
	// This was written assuming the format of the date is
	// yearmonthday
	// xxxxxxxx
	// easier to do this numerically
	
	// Get the last 2 digits
	day = date % 100;
	// reduce the date by 2 digits (day)
	date = Math.floor(date / 100);
	// Get the next 2 digits
	month = date % 100;
	// Put the month value into 0 - 11 form
	month = month - 1;
	// Reduce the date by 2 digits (month)
	date = Math.floor(date / 100);
	// Set the year to what is left on the date
	year = date; // possibly 0. this means it's a yearless birthday and not a birthdate
	returnDate = new Date(year, month, day);
	return returnDate;
};
