/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param string obj the raw database object
 * @example
 * var contactBackupHash = new ContactBackupHash("afewuh|12312");
 * 
 * var contactBackupHashValue = contactBackupHash.getValue();
 * var contactBackupHashValueAgain = contactBackupHash.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var ContactBackupHash = PropertyBase.create({
	/**
	* @lends ContactBackupHash#
	* @property string x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: false,
			/**
			* @name Favorite#setValue
			* @function
			* @param string value
			*/
			setterName: "setValue",
			/**
			* @name Favorite#getValue
			* @function
			* @returns string
			*/
			getterName: "getValue"
		}
	]
});

/**
* @param {ContactBackupHash} value The raw {boolean} value can be passed as well.
* @returns boolean
*/
ContactBackupHash.prototype.equals = function (value) {
	if (value instanceof ContactBackupHash) {
		return this.getValue() === value.getValue();
	} else {
		return this.getValue() === value;
	}
};
