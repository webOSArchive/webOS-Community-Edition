/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500, sub: true */
/*global RB, _, Class, Assert, JSON, PropertyBase, StringUtils, Globalization, exports */

/**
 * @class
 * @augments PropertyBase
 * @param {Object} obj the raw database name object
 * @example
 * var name = new Name({
 *	givenName: "Austin",
 *	middleName: "Danger",
 *	familyName: "Powers",
 *	honorificPrefix: "Sir",
 *	honorificSuffix: "Jr"
 * });
 * 
 * var givenNameString = name.getGivenName();
 * var givenNameString = name.x_givenName; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Name = exports.Name = PropertyBase.create({
	/**
	* @lends Name#
	* @property {string} x_givenName defineGetter that calls this.getGivenName() + defineSetter that calls this.setGivenName()
	* @property {string} x_middleName defineGetter that calls this.getMiddleName() + defineSetter that calls this.setMiddleName()
	* @property {string} x_familyName defineGetter that calls this.getFamilyName() + defineSetter that calls this.setFamilyName()
	* @property {string} x_honorificPrefix defineGetter that calls this.getHonorificPrefix() + defineSetter that calls this.setHonorificPrefix()
	* @property {string} x_honorificSuffix defineGetter that calls this.getHonorificSuffix() + defineSetter that calls this.setHonorificSuffix()
	*/
	data: [
		{
			dbFieldName: "givenName",
			defaultValue: "",
			/**
			* @name Name#setGivenName
			* @function
			* @param {string} givenName
			*/
			setterName: "setGivenName",
			/**
			* @name Name#getGivenName
			* @function
			* @returns {string}
			*/
			getterName: "getGivenName"
		},
		{
			dbFieldName: "middleName",
			defaultValue: "",
			/**
			* @name Name#setMiddleName
			* @function
			* @param {string} middleName
			*/
			setterName: "setMiddleName",
			/**
			* @name Name#getMiddleName
			* @function
			* @returns {string}
			*/
			getterName: "getMiddleName"
		},
		{
			dbFieldName: "familyName",
			defaultValue: "",
			/**
			* @name Name#setFamilyName
			* @function
			* @param {string} familyName
			*/
			setterName: "setFamilyName",
			/**
			* @name Name#getFamilyName
			* @function
			* @returns {string}
			*/
			getterName: "getFamilyName"
		},
		{
			dbFieldName: "honorificPrefix",
			defaultValue: "",
			/**
			* @name Name#setHonorificPrefix
			* @function
			* @param {string} honorificPrefix
			*/
			setterName: "setHonorificPrefix",
			/**
			* @name Name#getHonorificPrefix
			* @function
			* @returns {string}
			*/
			getterName: "getHonorificPrefix"
		},
		{
			dbFieldName: "honorificSuffix",
			defaultValue: "",
			/**
			* @name Name#setHonorificSuffix
			* @function
			* @param {string} honorificSuffix
			*/
			setterName: "setHonorificSuffix",
			/**
			* @name Name#getHonorificSuffix
			* @function
			* @returns {string}
			*/
			getterName: "getHonorificSuffix"
		}
	]
});

/**
 * Returns a unique string for the name object
 * @returns {string}
 */
Name.prototype.getNormalizedHashKey = function () {
	return this.getNormalizedGivenName() + ":(|)" + this.getNormalizedFamilyName();
};

/**
 * Should not be used for display.
 * @returns {string}
 */
Name.prototype.getNormalizedGivenName = function () {
	return Name.normalizeName(this.getGivenName());
};

/**
 * Should not be used for display.
 * @returns {string}
 */
Name.prototype.getNormalizedMiddleName = function () {
	return Name.normalizeName(this.getMiddleName());
};

/**
 * Should not be used for display.
 * @returns {string}
 */
Name.prototype.getNormalizedFamilyName = function () {
	return Name.normalizeName(this.getFamilyName());
};

/**
 * Should not be used for display.
 * @returns {string}
 */
Name.prototype.getNormalizedHonorificPrefixName = function () {
	return Name.normalizeName(this.getHonorificPrefix());
};

/**
 * Should not be used for display.
 * @returns {string}
 */
Name.prototype.getNormalizedHonorificSuffixName = function () {
	return Name.normalizeName(this.getHonorificSuffix());
};

/**
 * Normalize a name string.
 * @returns {string}
 */
Name.normalizeName = function (str) {
	if (!str || !_.isString(str)) {
		str = "";
	}
	return str.toLowerCase().trim();
};

/**
 * Set the current {@link Name} object based on the passed in {@link Name} object
 * @param {Name} nameObj
 */
Name.prototype.set = function (nameObj) {
	Assert.requireClass(nameObj, Name, "this.set requires an argument of type Name");
	this.setFamilyName(nameObj.getFamilyName() || "");
	this.setGivenName(nameObj.getGivenName() || "");
	this.setMiddleName(nameObj.getMiddleName() || "");
	this.setHonorificPrefix(nameObj.getHonorificPrefix() || "");
	this.setHonorificSuffix(nameObj.getHonorificSuffix() || "");
};

/**
 * Return the fully concatenated name
 * @param {boolean} doNotStrip - do not strip each name part before the full name is concatenated together
 * @returns {string}
 */
Name.prototype.getFullName = function (doNotStrip) {
	return Globalization.Name.formatPersonalName({
		prefix: this.getHonorificPrefix(),
		givenName: this.getGivenName(),
		middleName: this.getMiddleName(),
		familyName: this.getFamilyName(),
		suffix: this.getHonorificSuffix()
	}, Globalization.Name.longName);
};

/**
 * Parses a free form name string and sets the appropriate fields on the {@link Name} object
 * @param {string} freeformName
 */
Name.prototype.parseName = function (freeformName) {
	var structuredName = Globalization.Name.parsePersonalName(freeformName);
	
	this.setFamilyName(structuredName.familyName || "");
	this.setGivenName(structuredName.givenName || "");
	this.setMiddleName(structuredName.middleName || "");
	this.setHonorificPrefix(structuredName.prefix || "");
	this.setHonorificSuffix(structuredName.suffix || "");
};

/**
 * Sets all of the fields on the {@link Name} object to empty string
 */
Name.prototype.clear = function () {
	this.setFamilyName("");
	this.setGivenName("");
	this.setMiddleName("");
	this.setHonorificPrefix("");
	this.setHonorificSuffix("");
};

/** 
 * @name Name#x_fullName
 * @property 
 * @type string
 * @description defineGetter that calls this.getFullName() + defineSetter that calls this.parseName()
 */
Name.prototype.__defineGetter__("x_fullName", function () {
	return this.getFullName();
});


Name.prototype.__defineSetter__("x_fullName", function (value) {
	this.parseName(value);
});

/**
 * Takes a raw name object an concatenates the names into a string.  Missing fields will be ignored.
 * @param {Object} rawName - {honorificPrefix: {string}, givenName: {string}, middleName: {string}, familyName: {string}, honorificSuffix: {string}}
 * @param {boolean} doNotStrip - do not strip each name part before the full name is concatenated together
 * @returns {string}
 */
Name.getFullNameFromRawObject = function (rawName, doNotStrip) {
	return Globalization.Name.formatPersonalName({
		prefix: rawName.honorificPrefix,
		givenName: rawName.givenName,
		middleName: rawName.middleName,
		familyName: rawName.familyName,
		suffix: rawName.honorificSuffix
	}, Globalization.Name.longName);
};

