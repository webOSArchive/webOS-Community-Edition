/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var simIndex = new SimIndex(1);
 * 
 * var simInt = simIndex.getValue();
 * var simIntAgain = simIndex.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var SimIndex = PropertyBase.create({
	/**
	* @lends SimIndex#
	* @property {int} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: -1,
			/**
			* @name SimIndex#setValue
			* @function
			* @param {int} value
			*/
			setterName: "setValue",
			/**
			* @name SimIndex#getValue
			* @function
			* @returns {int}
			*/
			getterName: "getValue"
		}
	]
});