/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, Foundations */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var note = new Note("buy a pen and paper so I can write down a notes for my contacts");
 * 
 * var noteString = note.getValue();
 * var noteStringAgain = note.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Note = PropertyBase.create({
	/**
	* @lends Note#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Note#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Note#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

Note.prototype.getNormalizedHashKey = function () {
	var toReturn = this.getValue();
	return toReturn.toUpperCase();
};

/**
 * @returns {string}
 */
Note.prototype.getDisplayValue = function () {
	var temp = this.getValue();
	temp = Foundations.StringUtils.escapeHTML(temp);
	temp = temp.replace(/\n/g, "<br>");
	return temp;
};

/** 
 * @name Note#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Note.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});
