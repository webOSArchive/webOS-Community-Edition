/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports PhoneNumberExtended, EmailAddressExtended, IMAddressExtended*/

var ContactPointTypes = exports.ContactPointTypes = {
	PhoneNumber: "contact_point_type_phoneNumber",
	EmailAddress: "contact_point_type_emailAddress",
	IMAddress: "contact_point_type_imAddress",
	Address: "contact_point_type_address",
	Url: "contact_point_type_url"
};

ContactPointTypes.getFavoritableTypeForInstanceOf = function (object) {
	if (object instanceof PhoneNumberExtended) {
		return ContactPointTypes.PhoneNumber;
	} else if (object instanceof EmailAddressExtended) {
		return ContactPointTypes.EmailAddress;
	} else if (object instanceof IMAddressExtended) {
		return ContactPointTypes.IMAddress;
	} else {
		return "Not_A_Favoriteable_Type";
	}
};