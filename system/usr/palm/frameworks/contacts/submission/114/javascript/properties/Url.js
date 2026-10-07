/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, PropertyBase, Utils, RB */

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var url = new URL({
 *	value: "http://www.palm.com",
 *	type: "",
 *	primary: false
 * });
 * 
 * var urlString = url.getValue();
 * var urlStringAgain = url.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Url = exports.Url = PropertyBase.create({
	/**
	* @lends Url#
	* @property {string} x_value
	* @property {string} x_type
	* @property {string} x_primary
	*/
	data: [
		{
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name Url#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Url#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}, {
			dbFieldName: "type",
			defaultValue: "",
			/**
			* @name Url#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name Url#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		}, {
			dbFieldName: "primary",
			defaultValue: false,
			/**
			* @name Url#setPrimary
			* @function
			* @param {string} primary
			*/
			setterName: "setPrimary",
			/**
			* @name Url#getPrimary
			* @function
			* @returns {string}
			*/
			getterName: "getPrimary"
		}
	]
});

/**
 * @returns {string}
 */
Url.prototype.getDisplayValue = function () {
	return this.getValue().toLocaleLowerCase();
};

/** 
 * @name Url#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Url.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});


/*
//TODO: use this somehow for the app?
ContactPointDecorator.urlFormatter = function (url) {
	//    if (url.hasBeenFormatted) {
	//        return url;
	//    }
	url.type = "web";
	if (url.url && url.url.indexOf("http") !== 0) {
		url.url = "http://" + url.url;
	}
	url.hasBeenFormatted = true;
	return url;
};*/


/**
 * @constant
 */
// prefixing these with "type_" to discourage direct display of these values
Url.TYPE = Utils.defineConstants({
	HOME: "type_home",
	HOMEPAGE: "type_homepage",
	BLOG: "type_blog",
	FTP: "type_ftp",
	PROFILE: "type_profile",
	WORK: "type_work",
	OTHER: "type_other"
});

Url.prototype.getNormalizedHashKey = function () {
	return this.getValue().toLowerCase();
};

Url.Labels = Utils.createLabelFunctions([{
	value: Url.TYPE.HOME,
	displayValue: RB.$L('Home'),
	isPopupLabel: false
}, {
	value: Url.TYPE.HOMEPAGE,
	displayValue: RB.$L('Homepage'),
	isPopupLabel: false
}, {
	value: Url.TYPE.BLOG,
	displayValue: RB.$L('Blog'),
	isPopupLabel: false
}, {
	value: Url.TYPE.FTP,
	displayValue: RB.$L('FTP'),
	isPopupLabel: false
}, {
	value: Url.TYPE.PROFILE,
	displayValue: RB.$L('Profile'),
	isPopupLabel: false
}, {
	value: Url.TYPE.WORK,
	displayValue: RB.$L('Work'),
	isPopupLabel: false
}, {
	value: Url.TYPE.OTHER,
	displayValue: RB.$L('Other'),
	isPopupLabel: false
}]);