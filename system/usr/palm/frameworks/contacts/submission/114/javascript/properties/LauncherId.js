/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, exports, $L, console */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 *							
 * var launcherId = new LauncherId("4rJ5");
 * 
 * var launcherIdValue = launcherId.getValue();
 * var launcherIdValueAgain = launcherId.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var LauncherId = exports.LauncherId = PropertyBase.create({
	/**
	* @lends LauncherId#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name LauncherId#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name LauncherId#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});