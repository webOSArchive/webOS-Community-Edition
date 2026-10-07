/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true,
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global ContactsLib, document, enyo, console, $L, crb */

enyo.kind({
	name		: "calendar.edit.ContactView",
	kind		: enyo.VFlexBox,

	events:
	{	onCloseClicked: "",
		onExit: ""
	},

	published:
	{
	},

	components: [
		{kind: "com.palm.library.contactsui.detailsInDialog",
			name: "detailsInDialog",
			flex: 1,
			showButtonsHideBar: true,
			onEdit: "doExit",
			onAddToExisting: "doExit",
			onAddToNew: "doExit"
		},
		{kind: enyo.HFlexBox, components: [
			{kind: enyo.Button, name: "contactsDialogBack", flex: 1, caption: $L("Back"), onclick: "doExit", className: "enyo-button-light"},
			{kind: enyo.Button, name: "contactsDialogCancel", flex: 1, caption: $L("Close"), onclick: "closeClicked", className: "spaceButton enyo-button-dark"}
		]}
	],

	closeClicked: function closeClicked () {
		this.doCloseClicked();
	},
	setPersonId: function (personId) {
		this.$.detailsInDialog.setPersonId(personId);
	},
	setContact: function (rawContact) {
		this.$.detailsInDialog.setContact(rawContact);
	}

});
