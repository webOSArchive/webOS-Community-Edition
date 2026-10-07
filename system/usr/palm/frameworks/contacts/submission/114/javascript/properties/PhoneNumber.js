/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, RB, console, _, Class, PropertyBase, Utils, Assert, Globalization, ObjectUtils */

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var phone = new PhoneNumber({
 *	value: "5555555555",
 *	type: "mobile",
 *	primary: false
 * });
 * 
 * var phoneString = phone.getValue();
 * var phoneStringAgain = phone.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var PhoneNumber = exports.PhoneNumber = PropertyBase.create({
	/**
	* @lends PhoneNumber#
	* @property {string} x_value The phone number string. This property is a defineGetter/defineSetter that calls getValue()/setValue()
	* @property {string} x_type The type string. This property is a defineGetter/defineSetter that calls getType()/setType()
	* @property {string} x_primary The primary string. This property is a defineGetter/defineSetter that calls getPrimary()/setPrimary()
	*/
	data: [
		{
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name PhoneNumber#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name PhoneNumber#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
//			beforeSet: function (value) {
//				this.displayValue = PhoneNumber.format(value);
//				return value;
//			}
		}, {
			dbFieldName: "type",
			defaultValue: "",
			/**
			* @name PhoneNumber#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name PhoneNumber#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		}, {
			dbFieldName: "primary",
			defaultValue: false,
			/**
			* @name PhoneNumber#setPrimary
			* @function
			* @param {boolean} type
			*/
			setterName: "setPrimary",
			/**
			* @name PhoneNumber#getPrimary
			* @function
			* @returns {boolean}
			*/
			getterName: "getPrimary"
		}
	]
});

PhoneNumber.prototype.equals = function (obj) {
	if (obj instanceof PhoneNumber) {
		return (this.getValue() === obj.getValue() &&
		this.getType() === obj.getType() &&
		this.getPrimary() === obj.getPrimary());
	} 
	return false;
};


// match on object instance
//		 naked object that is a literal equality on all fields
//		 mojodb id

PhoneNumber.prototype.getNormalizedHashKey = function () {
	return this.getNormalizedValue();
};

PhoneNumber.prototype.getNormalizedValue = function () {
	return PhoneNumber.normalizePhoneNumber(this.getValue());
};

/**
 * Generate search normalized value for phone number
 * @returns {string}
 */
PhoneNumber.prototype.getNormalizedSearchHashKey = function () {
	return PhoneNumber.normalizePhoneNumber(this.getValue(), true);
};

/**
 * @returns {string}
 */
PhoneNumber.prototype.getDisplayValue = function () {
	return PhoneNumber.format(this.getValue());
};

/** 
 * @name PhoneNumber#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
PhoneNumber.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});

/**
 * @returns {string}
 */
PhoneNumber.prototype.getDisplayType = function () {
	return PhoneNumber.getDisplayType(this.getType());
};

/**
 * @name PhoneNumber#x_displayType
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayType()
 */
PhoneNumber.prototype.__defineGetter__("x_displayType", function () {
	return this.getDisplayType();
});

PhoneNumber.normalizePhoneNumber = function (numberParam, wantSearchFormat) {
	var numberParamType = ObjectUtils.type(numberParam),
		parsedPhoneNumber,
		normalizedValue;
	
	Assert.require(numberParamType === "object" || numberParamType === "string", "PhoneNumber.normalizePhoneNumber - number passed is not a string or an object");
	
	//if it's not already parsed, we parse it
	parsedPhoneNumber = (numberParamType === "string") ? Globalization.Phone.parsePhoneNumber(numberParam) : numberParam;
	
	//if we get something empty back, just return the empty string
	if (!parsedPhoneNumber || Object.keys(parsedPhoneNumber).length === 0) {
		return "";
	}
	
	normalizedValue = "";
	if (parsedPhoneNumber.extension) {
		normalizedValue += parsedPhoneNumber.extension.split("").reverse().join("");
	}
	normalizedValue += PhoneNumber.PART_DELIMITER;
	if (parsedPhoneNumber.subscriberNumber) {
		normalizedValue += parsedPhoneNumber.subscriberNumber.split("").reverse().join("");
	} else if (parsedPhoneNumber.serviceCode) {
		normalizedValue += parsedPhoneNumber.serviceCode.split("").reverse().join("");
	} else if (parsedPhoneNumber.emergency) {
		normalizedValue += parsedPhoneNumber.emergency.split("").reverse().join("");
	} else if (parsedPhoneNumber.vsc) {
		normalizedValue += parsedPhoneNumber.vsc.split("").reverse().join("");
	}
	normalizedValue += PhoneNumber.PART_DELIMITER;
	
	if (!wantSearchFormat) {
		if (parsedPhoneNumber.areaCode) {
			normalizedValue += parsedPhoneNumber.areaCode.split("").reverse().join("");
		}
		normalizedValue += PhoneNumber.PART_DELIMITER;
		if (parsedPhoneNumber.countryCode) {
			normalizedValue += parsedPhoneNumber.countryCode.split("").reverse().join("");
		}
		normalizedValue += PhoneNumber.PART_DELIMITER;
		if (parsedPhoneNumber.iddPrefix) {
			normalizedValue += parsedPhoneNumber.iddPrefix.split("").reverse().join("");
		}
	}
	
	return normalizedValue;
};

//TODO: this should be removed in favor of Edwin's logic
PhoneNumber.strip = function (numberStr) {
	if (!numberStr) {
		console.warn("PhoneNumber.strip - empty argument");
		return numberStr;
	}
	//()-+*#/. 
	if (typeof numberStr === 'number') {
		numberStr = "" + numberStr;
	}
	//return numberStr.replace(/[^A-Za-z0-9+*#]+/g, "");
	return numberStr.replace(/-*\(*\)*\**#*\/*\.*\s*/g, "");
};

// International phone number formatter
PhoneNumber.format = function (numberStr) {
	if (!numberStr) {
		console.warn("PhoneNumber.format - empty argument");
		return numberStr;
	}
		
	return Globalization.Phone.reformat(numberStr);	
	
};

// Remove any extra formatting or other characters that you would not want when exporting a phone number.
// This is used for vCard export
PhoneNumber.unformatForVCard = function (numberStr) {
	var toReturn = "";
	numberStr.replace(/[0123456789\+\*wpt#]/gi, function (substr) {
		toReturn += substr;
	});
	
	return toReturn;
};

PhoneNumber.getDisplayType = function (type) {
	return (PhoneNumber.Labels.getLabel(type) || PhoneNumber.Labels.getLabel(PhoneNumber.TYPE.MOBILE));
};


/**
 * @constant
 */
PhoneNumber.PART_DELIMITER = "-";

// vCard stuff is using these types. Make sure if you change anything on this
// that the tests for vCard don't fail. Otherwise the rath of a million sand flies
// will overtake your shorts!
// prefixing these with "type_" to discourage direct display of these values
PhoneNumber.TYPE = Utils.defineConstants({
	MOBILE: "type_mobile",
	HOME: "type_home",
	HOME2: "type_home2",
	WORK: "type_work",
	WORK2: "type_work2",
	MAIN: "type_main",
	PERSONAL_FAX: "type_personal_fax",
	WORK_FAX: "type_work_fax",
	PAGER: "type_pager",
	PERSONAL: "type_personal",
	SIM: "type_sim",
	ASSISTANT: "type_assistant",
	CAR: "type_car",
	RADIO: "type_radio",
	COMPANY: "type_company",
	OTHER: "type_other"
});

PhoneNumber.Labels = Utils.createLabelFunctions([{
	value: PhoneNumber.TYPE.MOBILE,
	displayValue: RB.$L('Mobile'),
	shortDisplayValue: RB.$L('M'),
	isPopupLabel: true
}, {
	value: PhoneNumber.TYPE.HOME,
	displayValue: RB.$L('Home'),
	shortDisplayValue: RB.$L('H'),
	isPopupLabel: true
}, {
	value: PhoneNumber.TYPE.WORK,
	displayValue: RB.$L('Work'),
	shortDisplayValue: RB.$L('W'),
	isPopupLabel: true
}, {
	value: PhoneNumber.TYPE.WORK_FAX,
	displayValue: RB.$L('Fax'),
	shortDisplayValue: RB.$L('F'),
	isPopupLabel: true
}, {
	value: PhoneNumber.TYPE.OTHER,
	displayValue: RB.$L('Other'),
	shortDisplayValue: RB.$L('O'),
	isPopupLabel: true
}, {
	value: PhoneNumber.TYPE.PAGER,
	displayValue: RB.$L('Pager'),
	shortDisplayValue: RB.$L('P'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.PERSONAL,
	displayValue: RB.$L('Personal'),
	shortDisplayValue: RB.$L('Pe'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.SIM,
	displayValue: RB.$L('SIM'),
	shortDisplayValue: RB.$L('S'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.MAIN,
	displayValue: RB.$L('Main'),
	shortDisplayValue: RB.$L('Ma'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.PERSONAL_FAX,
	displayValue: RB.$L('Fax'),
	shortDisplayValue: RB.$L('P'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.ASSISTANT,
	displayValue: RB.$L('Assistant'),
	shortDisplayValue: RB.$L('A'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.CAR,
	displayValue: RB.$L('Car'),
	shortDisplayValue: RB.$L('Ca'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.RADIO,
	displayValue: RB.$L('Radio'),
	shortDisplayValue: RB.$L('R'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.COMPANY,
	displayValue: RB.$L('Company'),
	shortDisplayValue: RB.$L('C'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.WORK2,
	displayValue: RB.$L('Work 2'),
	shortDisplayValue: RB.$L('W2'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.HOME2,
	displayValue: RB.$L('Home 2'),
	shortDisplayValue: RB.$L('H2'),
	isPopupLabel: false
}]);
