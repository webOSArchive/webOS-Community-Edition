/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, Class, _, Contact, Person, DisplayNameType, Organization, ContactPhoto, LIB_ROOT */

/**
 * ContactDisplay is a contact object that can be used for display in the UI.  The database object (Contact) is
 * encapsulated via a closure.  Templates can reference properties on the
 * database object by using the getters/setters exposed on Contact.  These getter/setter properties will always start
 * with a the x_ prefix
 *
 * <div id="someDiv">#{ContactDisplay.x_displayName}</div>
 *
 * @param {Object} contact
 */
var ContactDisplay = Class.create(Contact, {
	initialize: function initialize(obj) {
		this.$super(initialize)(obj);
		
		// initialize the display properties
		this._init();
		
		this.generateDisplayParams();
	},
	
	/**
	 * These are display-only properties
	 */
	_init: function () {
		this.displayName = "";
		this.fullName = "";
		this.workInfoLine = "";
		this.showWorkInfoClass = "";
		
		this.freeformName = "";
		this.dirty = true; // temporary
		this.primary = ""; // temporary
		this.singleItem = "";
		
		
		//		this.listPic = "";
		//		this.listFrame = "";
	},
	
	/**
	 * Reset the display params and the params on the contact
	 */
//	reset: function reset() {
//		this.$super(reset)();
//		this._init();
//	},
	
	generateDisplayParams: function () {
		var displayNameData = this.generateDisplayName(true),
			photosArray,
			squarePhoto;
		
		this.displayName = displayNameData.displayName;
		this.fullName = this.getName().getFullName() || this.displayName;
		// Do not set the workline if the display name is already showing this data
		this.workInfoLine = (displayNameData.basedOnField !== DisplayNameType.TITLE_AND_ORGANIZATION_NAME &&
							displayNameData.basedOnField !== DisplayNameType.ORGANIZATION_NAME ? this.generateWorkInfoLine() : "");
		
		if (this.workInfoLine) {
			this.showWorkInfoClass = ContactDisplay.SHOW_WORK_INFO_CLASS;
		}
	}
});

ContactDisplay.SHOW_WORK_INFO_CLASS = "show-work-info";

ContactDisplay.DEFAULT_DRAWER_PHOTO = ContactPhoto.DEFAULT_DRAWER_PHOTO;


exports.ContactDisplay = ContactDisplay;