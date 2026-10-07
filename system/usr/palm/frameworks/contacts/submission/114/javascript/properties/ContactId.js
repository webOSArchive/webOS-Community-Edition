/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var contactId = new ContactId("12345");
 * 
 * var contactIdString = contactId.getValue();
 * var contactIdStringAgain = contactId.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var ContactId = PropertyBase.create({
	/**
	* @lends ContactId#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name ContactId#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name ContactId#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});
/**
* @param {ContactId} value The raw {string} value can be passed as well.
* @returns {boolean}
*/
ContactId.prototype.equals = function (value) {
	if (value instanceof ContactId) {
		return this.getValue() === value.getValue();
	} else {
		return this.getValue() === value;
	}
};
