/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, Assert, Person, Contact, PalmCall*/

var App = exports.App = {
	/**
	 * Launches the contacts app via the applicationManager to the PseudoDetailScene
	 * @param {Object} launchParams
	 *						{
	 *							person: {Person || raw person object},		// when displaying a person that is already stored in the DB
	 *							contact: {Contact || raw contact object}	// used for adding new contact data
	 *						}
	 */
	launchContactsAppToPseudoDetailScene: function (launchParams) {
		Assert.require(launchParams && (launchParams.person || launchParams.contact), "launchContactsAppToPseudoDetailScene requires a person or contact object to be passed");
		Assert.require(!(launchParams.person && launchParams.contact), "launchContactsAppToPseudoDetailScene You must specify a person OR a contact. Not both.");
		
		launchParams.launchType = "pseudo-card";
		
		if (launchParams.person && launchParams.person instanceof Person) {
			launchParams.person = launchParams.person.getDBObject();
		}
		
		if (launchParams.contact && launchParams.contact instanceof Contact) {
			launchParams.contact = launchParams.contact.getDBObject();
		}
		
		return PalmCall.call("palm://com.palm.applicationManager/", "open", {
			id: "com.palm.app.contacts",
			params: launchParams
		});
	}
};
