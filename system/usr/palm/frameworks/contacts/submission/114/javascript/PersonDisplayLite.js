/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, Class, Person, PersonDisplay, PersonFactory, ContactFactory, Name, SortKey, 
Globalization, ListWidget, PersonPhotos */

/**
 * PersonDisplayLite adds helper methods to a raw person object by dynamically setting the prototype chain on the passed in rawPersonObject 
 * when {@link PersonDisplayLite#create} is called.  This should be used in cases where speed is a large factor.  The contacts app list 
 * view uses PersonDisplayLite in the list scene because it is too expensive to create LOTS of decorated {@link PersonDisplay} objects.
 * @namespace
 * @augments PersonDisplayLite.methods
 * @example
 *	var rawPerson = {
 *		"name": {
 *			"honorificPrefix": "Mr",
 *			"givenName": "Austin",
 *			"middleName": "Danger",
 *			"familyName": "Powers",
 *			"honorificSuffix": "Jr"
 *		}
 *	};
 *	
 *	PersonDisplayLite.create(rawPerson, sortOrder);
 */
var PersonDisplayLite = {
	/**
	 * This adds fields to the raw person object that are needed for display in list views
	 * @param {Object} rawPersonObject A raw person object from the DB
	 * @returns {Object} the reference to the same rawPersonObject that was passed in
	 */
	create: function (rawPersonObject, sortOrder) {
		var sortKey,
			dividerText;
		
		/*
		 * Add a couple of misc fields...
		 */
		rawPersonObject.displayName = Person.generateDisplayNameFromRawPerson(rawPersonObject);
		rawPersonObject.imageId = "personImage_" + rawPersonObject._id;
		rawPersonObject.listPhotoPath = (rawPersonObject.photos && rawPersonObject.photos.listPhotoPath) || PersonPhotos.DEFAULT_LIST_AVATAR;
		
		/*
		 * Add a field for the favorites star
		 */
		if (rawPersonObject.favorite) {
			rawPersonObject.favoriteClass = "favorite";
		} else {
			rawPersonObject.favoriteClass = "";
		}
		
		/*
		 * Generate the divider text for this person...
		 */
		
		//if we're in first-last or last-first, let the divider text be the first character, or the default divider text
		//if we're in company-first-last or company-last-first, let the divider text be the full company name, or the default divider text
		sortKey = rawPersonObject.sortKey;
		if (sortOrder === ListWidget.SortOrder.firstLast || sortOrder === ListWidget.SortOrder.lastFirst) {
			//if there's a sort key and it doesn't start with the default character, use it
			if (sortKey && sortKey.slice(0, 1) !== SortKey.DEFAULT_CHAR) {
				dividerText = sortKey.slice(0, 1);
				
				//make the divider text accent-free and uppercase
				dividerText = Globalization.Locale.getBaseString(dividerText);
				
				//Some characters have a 2 character base
				dividerText = dividerText.slice(0, 1);
				
				//TODO: do this in CSS?
				rawPersonObject.dividerText = Globalization.Character.toUpperCase(dividerText);
			} else {
				//else we use the default divider text
				rawPersonObject.dividerText = SortKey.DEFAULT_NAME_DIVIDER_TEXT;
			}
		} else {
			//if there's a sort key and it doesn't start with the default character, use it
			if (sortKey && sortKey.slice(0, 1) !== SortKey.DEFAULT_CHAR) {
				dividerText = rawPersonObject.organization && rawPersonObject.organization.name;
				
				if (dividerText) {
					//make the divider text accent-free and uppercase
					dividerText = Globalization.Locale.getBaseString(dividerText);
					
					//TODO: do this in CSS?
					rawPersonObject.dividerText = Globalization.Character.toUpperCase(dividerText);
				} else {
					//not sure how we could ever get into this case, considering we have an org name in the sortKey
					//TODO: instead of reading from the org name directly, as above, should we parse the org name off the sortKey?
					
					//else we use the default divider text
					dividerText = SortKey.DEFAULT_COMPANY_DIVIDER_TEXT;
					//TODO: do this in CSS?
					rawPersonObject.dividerText = Globalization.Character.toUpperCase(dividerText);
				}
			} else {
				//else we use the default divider text
				dividerText = SortKey.DEFAULT_COMPANY_DIVIDER_TEXT;
				//TODO: do this in CSS?
				rawPersonObject.dividerText = Globalization.Character.toUpperCase(dividerText);
			}
		}
		
		return rawPersonObject;
	}
};
