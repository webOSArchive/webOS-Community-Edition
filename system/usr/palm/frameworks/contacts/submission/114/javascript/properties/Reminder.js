/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class Reminder
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var reminder = new Reminder("Don't forget the eggs!!!");
 * 
 * var reminderString = reminder.getValue();
 * var reminderStringAgain = reminder.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Reminder = PropertyBase.create({
	/**
	* @lends Reminder#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Reminder#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Reminder#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});