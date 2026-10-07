/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports Class, Contact, ContactLinkable, ContactDisplay, ContactType */

var ContactFactory = Class.create({
	initialize: function () {
	}
});

//this is deprecated, but alias it for now so nothing breaks.
//TODO: remove this eventually.
ContactFactory.ContactType = ContactType;

ContactFactory.createContactDisplay = function (rawContactObject) {
	return new ContactDisplay(rawContactObject);
};

ContactFactory.createContactLinkable = function (rawContactObject) {
	return new ContactLinkable(rawContactObject);
};

ContactFactory.createContactEditable = function (rawContactObject) {
	return new Contact(rawContactObject);
};

ContactFactory.create = function (contactType, rawContactObject) {
	switch (contactType) {
	case ContactType.DISPLAYABLE:
		return ContactFactory.createContactDisplay(rawContactObject);
	case ContactType.LINKABLE:
		return ContactFactory.createContactLinkable(rawContactObject);
	case ContactType.EDITABLE:
		return ContactFactory.createContactEditable(rawContactObject);
	case ContactType.RAWOBJECT:
		return rawContactObject;
	default:
		return ContactFactory.createContactDisplay(rawContactObject);
	}
};

exports.ContactFactory = ContactFactory;