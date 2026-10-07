/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var tag = new Tag("cool");
 * 
 * var tagString = tag.getValue();
 * var tagStringAgain = tag.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Tag = PropertyBase.create({
	/**
	* @lends Tag#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Tag#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Tag#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});