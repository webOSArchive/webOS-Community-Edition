/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports */

/**
 * @namespace
 * This object is just a global enum for use with the ContactFactory
 */
var ContactType = {
	/** @field {string} */
	DISPLAYABLE: "displayable",
	/** @field {string} */
	LINKABLE: "linkable",
	/** @field {string} */
	EDITABLE: "editable",		// Added this for sim
	/** @field {string} */
	RAWOBJECT: "rawobject"
};

/** 
 * Exported from {@link ContactType}
 * @extends ContactType
 */
exports.ContactType = ContactType;
