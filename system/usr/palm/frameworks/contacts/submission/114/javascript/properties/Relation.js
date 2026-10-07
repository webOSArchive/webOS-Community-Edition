/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, RB, console, _, Class, PropertyBase, Utils, Assert */

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var relation = new Relation({
 *	value: "Cindy",
 *	type: "Mother",
 *	primary: false
 * });
 * 
 */
var Relation = exports.Relation = PropertyBase.create({
	/**
	* @lends Relation#
	* @property {string} x_value The name of the person represented by this relation, as a string. This property is a defineGetter/defineSetter that calls getValue()/setValue()
	* @property {string} x_type The type string. This property is a defineGetter/defineSetter that calls getType()/setType()
	* @property {string} x_primary The primary string. This property is a defineGetter/defineSetter that calls getPrimary()/setPrimary()
	*/
	data: [
		{
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name Relation#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Relation#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}, {
			dbFieldName: "type",
			defaultValue: "",
			/**
			* @name Relation#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name Relation#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		}, {
			dbFieldName: "primary",
			defaultValue: false,
			/**
			* @name Relation#setPrimary
			* @function
			* @param {string} type
			*/
			setterName: "setPrimary",
			/**
			* @name Relation#getPrimary
			* @function
			* @returns {string}
			*/
			getterName: "getPrimary"
		}
	]
});

Relation.prototype.getNormalizedHashKey = function () {
	return this.getValue() + ":(|)" + this.getType();
};

Relation.prototype.equals = function (obj) {
	if (obj instanceof Relation) {
		return ((this.getValue() === obj.getValue()) && (this.getType() === obj.getType()) && (this.getPrimary() === obj.getPrimary()));
	}
	return false;
};

/**
 * @returns {string}
 */
Relation.prototype.getDisplayValue = function () {
	return this.getValue();
};

/** 
 * @name Relation#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Relation.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});

/**
 * @constant
 */
// prefixing these with "type_" to discourage direct display of these values
Relation.TYPE = Utils.defineConstants({
	ASSISTANT: "type_assistant",
	BROTHER: "type_brother",
	CHILD: "type_child",
	DOMESTIC_PARTNER: "type_domestic_partner",
	FATHER: "type_father",
	FRIEND: "type_friend",
	MANAGER: "type_manager",
	MOTHER: "type_mother",
	PARENT: "type_parent",
	PARTNER: "type_partner",
	REFERRED_BY: "type_referred_by",
	RELATIVE: "type_relative",
	SISTER: "type_sister",
	SPOUSE: "type_spouse",
	OTHER: "type_other"
});
