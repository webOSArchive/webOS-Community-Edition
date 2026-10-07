/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, Address, console, _, exports, Utils, RB */

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var org = new Organization({
 *	{
 *		name: "Shamwow Software Inc.",
 *		department: "Sofware Engineering",
 *		title: "Super Senior Software Engineer with Sugar on Top",
 *		type: "Mobile",
 *		startDate: "1945-01-01",
 *		endDate: "2005-02-01",
 *		location: {
 *			streetAddress: "123 L33t Str33t",
 *			locality: "Funnyville",
 *			region: "CA",
 *			postalCode: "94040",
 *			country: "USA"
 *		},
 *		description: "Code monkeys"
 *	}
 * });
 * 
 * var companyName = org.getName();
 * var companyNameAgain = org.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Organization = exports.Organization = PropertyBase.create({
	/**
	* @lends Organization#
	* @property {string} x_name
	* @property {string} x_department
	* @property {string} x_title
	* @property {string} x_startDate
	* @property {string} x_endDate
	* @property {Address} x_location
	* @property {string} x_description
	*/
	data: [
		{
			dbFieldName: "name",
			defaultValue: "",
			/**
			* @name Organization#setName
			* @function
			* @param {string} name
			*/
			setterName: "setName",
			/**
			* @name Organization#getName
			* @function
			* @returns {string}
			*/
			getterName: "getName"
		},
		{
			dbFieldName: "department",
			defaultValue: "",
			/**
			* @name Organization#setDepartment
			* @function
			* @param {string} department
			*/
			setterName: "setDepartment",
			/**
			* @name Organization#getDepartment
			* @function
			* @returns {string}
			*/
			getterName: "getDepartment"
		},
		{
			dbFieldName: "title",
			defaultValue: "",
			/**
			* @name Organization#setTitle
			* @function
			* @param {string} title
			*/
			setterName: "setTitle",
			/**
			* @name Organization#getTitle
			* @function
			* @returns {string}
			*/
			getterName: "getTitle"
		},
		{
			dbFieldName: "type",
			defaultValue: "",
			/**
			* @name Organization#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name Organization#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		},
		{
			dbFieldName: "startDate",
			defaultValue: "",
			/**
			* @name Organization#setStartDate
			* @function
			* @param {string} startDate
			*/
			setterName: "setStartDate",
			/**
			* @name Organization#getStartDate
			* @function
			* @returns {string}
			*/
			getterName: "getStartDate"
		},
		{
			dbFieldName: "endDate",
			defaultValue: "",
			/**
			* @name Organization#setEndDate
			* @function
			* @param {string} endDate
			*/
			setterName: "setEndDate",
			/**
			* @name Organization#getEndDate
			* @function
			* @returns {string}
			*/
			getterName: "getEndDate"
		},
		{
			dbFieldName: "location",
			defaultValue: {},
			/**
			* @name Organization#setLocation
			* @function
			* @param {Address} location
			*/
			setterName: "setLocation",
			/**
			* @name Organization#getLocation
			* @function
			* @returns {Address}
			*/
			getterName: "getLocation",
			classObject: Address
//			beforeSet: function (value) {	// location is a sub object. Any time we set this value, we need to construct a new Address
//				return new Address(value);	// As a result of this, we need to implement _extendedGetDBObject to handle unwrapping this field
//			}
		},
		{
			dbFieldName: "description",
			defaultValue: "",
			/**
			* @name Organization#setDescription
			* @function
			* @param {string} description
			*/
			setterName: "setDescription",
			/**
			* @name Organization#getDescription
			* @function
			* @returns {string}
			*/
			getterName: "getDescription"
		}
	]
});

// TODO: unwrapping sub objects should probably be handled by PropertyBase

// Handle the unwrapping of the location field when we dump the DB object to save
Organization.prototype._extendedGetDBObject = function (data) {
	var address = this.getLocation(),
		newData = _.clone(data);
		
	if (address && address.getDBObject) {
		newData.location = address.getDBObject();
	} else {
		console.warn("Organization: address does not appear to be a correct wrapped object.  Unable to call getDBObject()");
	}
	return newData;
};


/**
 * @constant
 */
// prefixing these with "type_" to discourage direct display of these values
Organization.TYPE = Utils.defineConstants({
	HOME: "type_home",
	WORK: "type_work",
	SCHOOL: "type_school",
	OTHER: "type_other"
});

Organization.Labels = Utils.createLabelFunctions([{
	value: Organization.TYPE.HOME,
	displayValue: RB.$L('Home'),
	isPopupLabel: true
}, {
	value: Organization.TYPE.WORK,
	displayValue: RB.$L('Work'),
	isPopupLabel: true
}, {
	value: Organization.TYPE.SCHOOL,
	displayValue: RB.$L('School'),
	isPopupLabel: true
}, {
	value: Organization.TYPE.OTHER,
	displayValue: RB.$L('Other'),
	isPopupLabel: true
}]);