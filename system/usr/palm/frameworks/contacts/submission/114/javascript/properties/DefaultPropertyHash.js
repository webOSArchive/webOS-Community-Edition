/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, Assert, Crypto*/

/**
 * @class
 * @augments PropertyBase
 * @param string obj the raw database object
 * @example
 * var defaultPropertyHash = new DefaultPropertyHash({"value": "faw789a943fkjaf", "type": "PhoneNumber"});
 * 
 * var defaultPropertyHashValue = defaultPropertyHash.getValue();
 * var defaultPropertyHashValueAgain = defaultPropertyHash.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var DefaultPropertyHash = PropertyBase.create({
	/**
	* @lends DefaultPropertyHash#
	* @property string x_value
	*/
	data: [
		{
			dbFieldName: "value",
			defaultValue: null,
			/**
			* Only call this method when you pre-md5ied the value. If you want
			* to set the value without having to md5 it, call DefaultPropertyHash#setPlainValue
			* @name DefaultPropertyHash#setValue
			* @function
			* @param string value
			*/
			setterName: "setValue",
			/**
			* @name DefaultPropertyHash#getValue
			* @function
			* @returns string
			*/
			getterName: "getValue"
		}, {
			dbFieldName: "type",
			defaultValue: null,
			/**
			* @name DefaultPropertyHash#setType
			* @function
			* @param string type
			*/
			setterName: "setType",
			/**
			* @name DefaultPropertyHash#getType
			* @function
			* @returns string
			*/
			getterName: "getType"
		}, {
			dbFieldName: "favoriteData",
			defaultValue: null,
			
			setterName: "setFavoriteData",
			
			getterName: "getFavoriteData"
		}
	]
});

/**
* @param {DefaultPropertyHash} value
* @returns boolean
*/
DefaultPropertyHash.prototype.equals = function (value) {
	if (value instanceof DefaultPropertyHash) {
		return this.getValue() === value.getValue() && this.getType() === value.getType();
	}
	return false;
};

/**
* Sets the value of the DefaultPropertyHash. DefaultPropertyHashes have values that are md5s.
* This method allows you to set the value without having to calculate the md5 for it. You
* should always call this method and not md5 it before hand.
* @param {string} value - the value for this DefaultPropertyHash.
*/
DefaultPropertyHash.prototype.setPlainValue = function (value) {
	this.setValue(value ? Crypto.MD5.b64_md5(value) : null);
};

DefaultPropertyHash.prototype.isPlainValueEqual = function (value) {
	return value ? (Crypto.MD5.b64_md5(value) === this.getValue()) : (value === this.getValue());
};