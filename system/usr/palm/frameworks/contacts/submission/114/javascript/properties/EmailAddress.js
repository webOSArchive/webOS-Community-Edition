/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, PropertyBase, Utils, RB, StringUtils*/

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var email = new EmailAddress({
 *	value: "support@palm.com",
 *	type: "work",
 *	primary: true
 * });
 * 
 * var emailString = email.getValue();
 * var emailStringAgain = email.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var EmailAddress = exports.EmailAddress = PropertyBase.create({
	/**
	* @lends EmailAddress#
	* @property {string} x_value
	* @property {string} x_type
	* @property {string} x_primary
	*/
	data: [
		{
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name EmailAddress#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name EmailAddress#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}, {
			dbFieldName: "type",
			defaultValue: "type_home",
			/**
			* @name EmailAddress#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name EmailAddress#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		}, {
			dbFieldName: "primary",
			defaultValue: false,
			/**
			* @name EmailAddress#setPrimary
			* @function
			* @param {string} primary
			*/
			setterName: "setPrimary",
			/**
			* @name EmailAddress#getPrimary
			* @function
			* @returns {string}
			*/
			getterName: "getPrimary"
		}
	]
});

EmailAddress.prototype.getNormalizedHashKey = function () {
	return this.getNormalizedValue();
};

EmailAddress.prototype.getNormalizedValue = function () {
	// TODO: implement me
	return EmailAddress.normalizeEmail(this.getValue());
};

EmailAddress.normalizeEmail = function (str) {
	if (!str || !_.isString(str)) {
		str = "";
	}
	return str.toLowerCase().trim();
};


/**
 * @returns {string}
 */
EmailAddress.prototype.getDisplayValue = function () {
	return this.getValue();
};

/** 
 * @name EmailAddress#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
EmailAddress.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});

/**
 * @returns {string}
 */
EmailAddress.prototype.getDisplayType = function () {
	return EmailAddress.getDisplayType(this.getType());
};
/** 
 * @name EmailAddress#x_displayType
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayType()
 */
EmailAddress.prototype.__defineGetter__("x_displayType", function () {
	return this.getDisplayType();
});

EmailAddress.getDisplayType = function (type) {
	return (EmailAddress.Labels.getLabel(type) || EmailAddress.Labels.getLabel(EmailAddress.TYPE.OTHER));
};


/*
//TODO: use this somehow for the app?
ContactPointDecorator.emailFormatter = function (pt) {
	//if (pt.hasBeenFormatted) {
		//return pt;
	//}
	ContactPointDecorator.formatContactPoint(pt);
	//pt.displayValue = pt.value;
	//pt.type = "email";
	return pt;
};
*/


/**
 * @constant
 */
// prefixing these with "type_" to discourage direct display of these values
EmailAddress.TYPE = Utils.defineConstants({
	HOME: "type_home",
	WORK: "type_work",
	OTHER: "type_other"
});

EmailAddress.Labels = Utils.createLabelFunctions([{
	value: EmailAddress.TYPE.HOME,
	displayValue: RB.$L('Home'),
	isPopupLabel: true
}, {
	value: EmailAddress.TYPE.WORK,
	displayValue: RB.$L('Work'),
	isPopupLabel: true
}, {
	value: EmailAddress.TYPE.OTHER,
	displayValue: RB.$L('Other'),
	isPopupLabel: true
}]);
