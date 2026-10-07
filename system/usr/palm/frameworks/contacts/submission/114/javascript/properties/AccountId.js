/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, exports, console */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 *							
 * var accountId = new AccountId("4rJ5");
 * 
 * var accountIdValue = accountId.getValue();
 * var accountIdValueAgain = accountId.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var AccountId = exports.AccountId = PropertyBase.create({
	/**
	* @lends AccountId#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name AccountId#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name AccountId#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});