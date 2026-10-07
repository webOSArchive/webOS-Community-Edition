/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports */

/**
 * @namespace
 * This object is just a global enum for use with the ContactFactory
 */
var PersonType = {
	/** @field {string}*/
	DISPLAYABLE: "displayable",
	/** @field {string}*/
	DISPLAYLITE: "displaylite",
	/** @field {string}*/
	LINKABLE: "linkable",
	/** @field {string}*/
	RAWOBJECT: "rawobject"
};

/** 
 * Exported from {@link PersonType}
 * @extends PersonType
 */
exports.PersonType = PersonType;
