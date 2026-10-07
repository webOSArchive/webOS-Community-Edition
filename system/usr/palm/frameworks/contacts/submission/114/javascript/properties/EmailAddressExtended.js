/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, Class, EmailAddress, exports, StringUtils, PropertyBase, FavoritableEmailAddress*/

/**
* @class
* @augments EmailAddress
* @param {object} obj the raw database object
* @example
* var email = new EmailAddressExtended({
*	value: "support@palm.com",
*	type: "type_work",
*	primary: true
* });
* 
* var emailString = email.getValue();
* var emailStringAgain = email.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
* var normalizedValue = email.getNormalizedValue();
*/
var EmailAddressExtended = PropertyBase.create({
	/**
	* @lends EmailaddressExtended#
	* @property {string} x_normalizedValue
	*/
	superClass: FavoritableEmailAddress,
	data: [
		{	// Override value so we can implement a beforeSet method that sets a boolean to
			// indicate that the normalizedValue needs to be generated.  If this 'true', we
			// will set the normalizedValue when getNormalizedValue() is called or getDBObject()
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name EmailAddressExtended#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name EmailAddressExtended#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue",
			beforeSet: function (value) {
				this.doGenerateNormalizedValue = true;
				return value;
			}
		},
		{
			dbFieldName: "normalizedValue",
			defaultValue: "",
			/**
			* @name EmailAddressExtended#setNormalizedValue
			* @function
			* @param {string} value
			*/
			setterName: "setNormalizedValue",
			/**
			* @name EmailAddressExtended#getNormalizedValue
			* @function
			* @returns {string}
			*/
			getterName: "getNormalizedValue",
			beforeGet: function (origNormalizedValue) {
				var normalizedValue = origNormalizedValue,
					value = this.getValue();
					
				// only generate the normalizedValue if the value has been set
				if (!value || this.doGenerateNormalizedValue) {
					normalizedValue = EmailAddress.normalizeEmail(value);
					this.setNormalizedValue(normalizedValue);
					this.doGenerateNormalizedValue = false;
				}
				return normalizedValue;
			}
		}
	]
});

EmailAddressExtended.prototype._extendedGetDBObject = function (dbObject) {
	// make sure that the normalizedValue is up to date since we delay calculating it until it is read
	dbObject.normalizedValue = this.getNormalizedValue();
	return dbObject;
};