/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class Ringtone
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var ringtone = new Ringtone({ name: "Awesome Ringtone", location: "/usr/ringtones/awesomeRingtone.mp3" });
 * 
 * var ringtoneNameString = ringtone.getName();
 * var ringtoneNameStringAgain = ringtone.x_name; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 * 
 * var ringtoneLocationString = ringtone.getLocation();
 * 
 */
var Ringtone = PropertyBase.create({
	/**
	* @lends Ringtone#
	* @property {string} x_name
	* @property {string} x_location
	*/
	data: [
		{
			dbFieldName: "name",
			defaultValue: "",
			/**
			* @name Ringtone#setName
			* @function
			* @param {string} value
			*/
			setterName: "setName",
			/**
			* @name Ringtone#getName
			* @function
			* @returns {string}
			*/
			getterName: "getName"
		}, {
			dbFieldName: "location",
			defaultValue: "",
			/**
			* @name Ringtone#setLocation
			* @function
			* @param {string} value
			*/
			setterName: "setLocation",
			/**
			* @name Ringtone#getLocation
			* @function
			* @returns {string}
			*/
			getterName: "getLocation"
		}
	]
});