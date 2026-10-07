/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var anniversary = new Anniversary("2005-10-30");
 * 
 * var anniversaryString = anniversary.getValue();
 * var anniversaryStringAgain = anniversary.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Anniversary = PropertyBase.create({
	/**
	* @lends Anniversary#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Anniversary#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Anniversary#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});