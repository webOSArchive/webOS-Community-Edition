/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var simEntryType = new SimEntryType("adn");
 * 
 * var simEntryTypeString = simEntryType.getValue();
 * var simEntryTypeStringAgain = simEntryType.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var SimEntryType = PropertyBase.create({
	/**
	* @lends SimEntryType#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name SimEntryType#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name SimEntryType#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});