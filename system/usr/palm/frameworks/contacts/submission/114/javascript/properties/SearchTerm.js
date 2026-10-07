/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var term = new SearchTerm("myTerm");
 * 
 * var termString = term.getValue();
 * var termStringAgain = term.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var SearchTerm = PropertyBase.create({
	/**
	* @lends SearchTerm#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name SearchTerm#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name SearchTerm#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});