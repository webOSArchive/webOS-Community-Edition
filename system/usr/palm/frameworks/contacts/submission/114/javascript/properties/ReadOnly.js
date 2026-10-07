/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {boolean} obj the raw database object
 * @example
 * var readOnly = new ReadOnly(true);
 * 
 * var isReadOnly = readOnly.getValue();
 * var isReadOnlyAgain = readOnly.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var ReadOnly = PropertyBase.create({
	/**
	* @lends ReadOnly#
	* @property {boolean} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: false,
			/**
			* @name ReadOnly#setValue
			* @function
			* @param {boolean} value
			*/
			setterName: "setValue",
			/**
			* @name ReadOnly#getValue
			* @function
			* @returns {boolean}
			*/
			getterName: "getValue"
		}
	]
});