/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var account = new Account({
 *	domain: "gmail",
 *	userName: "austinPowers",
 *	userid: "12345"
 * });
 * 
 * var accountDomain = account.getDomain();
 * var accountDomainAgain = account.x_domain; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Account = PropertyBase.create({
	/**
	* @lends Account#
	* @property {string} x_domain
	* @property {string} x_userName
	* @property {string} x_userid
	*/
	data: [
		{
			dbFieldName: "domain",
			defaultValue: "",
			/**
			* @name Account#setDomain
			* @function
			* @param {string} domain
			*/
			setterName: "setDomain", 
			/**
			* @name Account#getDomain
			* @function
			* @returns {string}
			*/
			getterName: "getDomain"
		},
		{
			dbFieldName: "userName",
			defaultValue: "",
			/**
			* @name Account#setUserName
			* @function
			* @param {string} userName
			*/
			setterName: "setUserName",
			/**
			* @name Account#getUserName
			* @function
			* @returns {string}
			*/
			getterName: "getUserName"
		},
		{
			dbFieldName: "userid",
			defaultValue: "",
			/**
			* @name Account#setUserId
			* @function
			* @param {string} userid
			*/
			setterName: "setUserId",
			/**
			* @name Account#getUserId
			* @function
			* @returns {string}
			*/
			getterName: "getUserId"
		}
	]
});