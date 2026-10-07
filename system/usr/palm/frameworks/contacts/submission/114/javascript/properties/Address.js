/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, PropertyBase, Utils, RB, Globalization */

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var address = new Address({
 *	streetAddress: "950 W Maude Ave",
 *	locality: "Sunnyvale",
 *	postalCode: "94085",
 *	region: "CA",
 *	country: "USA"
 * });
 * 
 * var addressStreet = address.getStreetAddress();
 * var addressStreetAgain = address.x_streetAddress; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Address = exports.Address = PropertyBase.create({
	/**
	* @lends Address#
	* @property {string} x_streetAddress
	* @property {string} x_locality
	* @property {string} x_postalCode
	* @property {string} x_region
	* @property {string} x_country
	* @property {string} x_value
	* @property {string} x_type
	* @property {string} x_primary
	*/
	data: [
		{
			dbFieldName: "streetAddress",
			defaultValue: "",
			/**
			* @name Address#setStreetAddress
			* @function
			* @param {string} streetAddress
			*/
			setterName: "setStreetAddress",
			/**
			* @name Address#getStreetAddress
			* @function
			* @returns {string}
			*/
			getterName: "getStreetAddress"
		}, {
			dbFieldName: "locality",
			defaultValue: "",
			/**
			* @name Address#setLocality
			* @function
			* @param {string} locality
			*/
			setterName: "setLocality",
			/**
			* @name Address#getLocality
			* @function
			* @returns {string}
			*/
			getterName: "getLocality"
		}, {
			dbFieldName: "postalCode",
			defaultValue: "",
			/**
			* @name Address#setPostalCode
			* @function
			* @param {string} postalCode
			*/
			setterName: "setPostalCode",
			/**
			* @name Address#getPostalCode
			* @function
			* @returns {string}
			*/
			getterName: "getPostalCode"
		}, {
			dbFieldName: "region",
			defaultValue: "",
			/**
			* @name Address#setRegion
			* @function
			* @param {string} region
			*/
			setterName: "setRegion",
			/**
			* @name Address#getRegion
			* @function
			* @returns {string}
			*/
			getterName: "getRegion"
		}, {
			dbFieldName: "country",
			defaultValue: "", 
			/**
			* @name Address#setCountry
			* @function
			* @param {string} country
			*/
			setterName: "setCountry",
			/**
			* @name Address#getCountry
			* @function
			* @returns {string}
			*/
			getterName: "getCountry"
		}, {
			dbFieldName: "type",
			defaultValue: "type_work",
			/**
			* @name Address#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name Address#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		}, {
			dbFieldName: "primary",
			defaultValue: false,
			/**
			* @name Address#setPrimary
			* @function
			* @param {string} primary
			*/
			setterName: "setPrimary",
			/**
			* @name Address#getPrimary
			* @function
			* @returns {string}
			*/
			getterName: "getPrimary"
		}
	]
});

/** 
 * @name Address#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Address.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});

/** 
 * @name Address#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Address.prototype.__defineSetter__("x_displayValue", function (newAddressValue) {
	var parsedAddress = Globalization.Address.parseAddress(newAddressValue);
	
	this.setStreetAddress(parsedAddress.streetAddress || "");
	this.setLocality(parsedAddress.locality || "");
	this.setRegion(parsedAddress.region || "");
	this.setPostalCode(parsedAddress.postalCode || "");
	this.setCountry(parsedAddress.country || "");
});

/**
 * @returns {string}
 */
Address.prototype.getDisplayValue = function (onlyOneLine) {
	//TODO: escape html and then replace "\n" with "<br />"?
	
	var address = Globalization.Address.formatAddress(this.getDBObject());
	if (onlyOneLine) {
		//if we only want one line, then replace all newlines with spaces
		address = address.replace(/\n/g, " ");
	}
	return address;
};

Address.prototype.getStringValue = function (insertSpaces) {
	var space = (insertSpaces) ? " " : "";
	
	return this.getStreetAddress() + space + this.getLocality() + space + this.getPostalCode() + space + this.getRegion() + space + this.getCountry() + space + this.getType();
};

/**
 * @name Address#x_displayType
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayType()
 */
Address.prototype.__defineGetter__("x_displayType", function () {
	return this.getDisplayType();
});


/**
 * @returns {string}
 */
Address.prototype.getDisplayType = function () {
	return (Address.Labels.getLabel(this.getType()) || Address.Labels.getLabel(Address.TYPE.OTHER));
};

Address.prototype.getNormalizedHashKey = function () {
	var toReturn = "";
	
	toReturn += this.getStringValue();
	
	toReturn = toReturn.toUpperCase();
	
	return toReturn.replace(/\W/g, "");
};

/** 
 * @name Address#x_displayType
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayType()
 */
Address.prototype.__defineGetter__("x_displayType", function () {
	return this.getDisplayType();
});


/*
//TODO: use this somehow for the app?
ContactPointDecorator.addressFormatter = function (addr) {
	//    if (addr.hasBeenFormatted) {
	//        return addr;
	//    }
	//TODO This could be simpler and faster, see exactly what this is doing
	_.extend(addr, new Address(addr));
	addr.parseAddress(addr.freeformAddress);
	ContactPointDecorator.formatContactPoint(addr, Address.labels);
	if (!(addr.city || addr.state || addr.zipCode)) {
		addr.showMore = "none";
	}
	addr.freeformAddress = addr.getOneLine();
	addr.displayValue = addr.freeformAddress.gsub("\n", "<br />");
	addr.type = "address";
	addr.hasBeenFormatted = true;
	return addr;
};
*/



/**
 * @constant
 */
// prefixing these with "type_" to discourage direct display of these values
Address.TYPE = Utils.defineConstants({
	HOME: "type_home",
	WORK: "type_work",
	OTHER: "type_other"
});

Address.Labels = Utils.createLabelFunctions([{
	value: Address.TYPE.HOME,
	displayValue: RB.$L('Home'),
	isPopupLabel: true
}, {
	value: Address.TYPE.WORK,
	displayValue: RB.$L('Work'),
	isPopupLabel: true
}, {
	value: Address.TYPE.OTHER,
	displayValue: RB.$L('Other'),
	isPopupLabel: true
}]);
