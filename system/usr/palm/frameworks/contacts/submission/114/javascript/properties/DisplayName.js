/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var displayName = new DisplayName("Lude crude dude packed full of pre-chewed food");
 * 
 * var displayNameString = displayName.getValue();
 * var displayNameStringAgain = displayName.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var DisplayName = PropertyBase.create({
	/**
	* @lends DisplayName#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name DisplayName#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name DisplayName#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});