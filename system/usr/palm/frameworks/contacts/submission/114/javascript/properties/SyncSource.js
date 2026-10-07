/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global console, _, Class, PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var source = new SyncSource({
 *	name: "google",
 *	extended: {}
 * });
 * 
 * var sourceString = source.getName();
 * var sourceStringAgain = key.x_name; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var SyncSource = PropertyBase.create({
	/**
	* @lends SyncSource#
	* @property {string} x_name
	* @property {object} x_extended
	*/
	data: [
		{
			dbFieldName: "name",
			defaultValue: null,
			/**
			* @name SyncSource#setName
			* @function
			* @param {string} name
			*/
			setterName: "setName",
			/**
			* @name SyncSource#getName
			* @function
			* @returns {string}
			*/
			getterName: "getName"
		}, {
			dbFieldName: "extended",
			defaultValue: {},
			/**
			* @name SyncSource#setExtended
			* @function
			* @param {object} extended
			*/
			setterName: "setExtended",
			/**
			* @name SyncSource#getExtended
			* @function
			* @returns {object}
			*/
			getterName: "getExtended"
		}
	]
});

SyncSource.prototype.equals = function (obj) {
	if (obj instanceof SyncSource) {
		return (this.getName() === obj.getName());
	} 
	return false;
};