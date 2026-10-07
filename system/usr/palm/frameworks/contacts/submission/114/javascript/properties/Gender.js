/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var gender = new Gender("male");
 * 
 * var genderString = gender.getValue();
 * var genderStringAgain = gender.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Gender = PropertyBase.create({
	/**
	* @lends Gender#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Gender#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Gender#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});