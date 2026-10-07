/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {boolean} obj the raw database object
 * @example
 * var favorite = new Favorite(true);
 * 
 * var favoriteValue = favorite.getValue();
 * var favoriteValueAgain = favorite.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Favorite = PropertyBase.create({
	/**
	* @lends Favorite#
	* @property {boolean} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: false,
			/**
			* @name Favorite#setValue
			* @function
			* @param {boolean} value
			*/
			setterName: "setValue",
			/**
			* @name Favorite#getValue
			* @function
			* @returns {boolean}
			*/
			getterName: "getValue"
		}
	]
});

/**
* @param {Favorite} value The raw {boolean} value can be passed as well.
* @returns {boolean}
*/
Favorite.prototype.equals = function (value) {
	if (value instanceof Favorite) {
		return this.getValue() === value.getValue();
	} else {
		return this.getValue() === value;
	}
};
