/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var nickname = new Nickname("the situation");
 * 
 * var nicknameString = nickname.getValue();
 * var nicknameStringAgain = nickname.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Nickname = PropertyBase.create({
	/**
	* @lends Nickname#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Nickname#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Nickname#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

/**
 * @returns {string}
 */
Nickname.prototype.getDisplayValue = function () {
	return this.getValue();
};

/** 
 * @name Nickname#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Nickname.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});
