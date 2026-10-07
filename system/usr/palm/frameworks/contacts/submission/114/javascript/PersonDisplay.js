/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, LIB_ROOT, Class, Person, DisplayNameType, exports, IMAddress, PersonPhotos */

var PersonDisplay = exports.PersonDisplay = Class.create(Person, {
	/** @lends PersonDisplay# */
	
	/**
	 * This defines a decorated PersonDisplay.  This object has all of the functionality as a decorated {@link Person} object, but it includes
	 * extra params that are only needed for display.  Since the database data is encapsulated in private data on the {@link Person} object, properties
	 * can be set on this object without having to worry about them being saved the the DB by accident.
	 * @constructs
	 * @param {Object} rawPerson - raw person object
	 * @see Person
	 */
	initialize: function initialize(rawPerson) {
		this.$super(initialize)(rawPerson);
		
		// initialize the display properties
		this._init();
		
		// If a person was passed in, create display params based on the person params
		if (rawPerson) {
			this.generateDisplayParams();
		}
	},
	
	/**
	 * These are display-only properties
	 */
	// TODO: implement these as defineGetters + consider caching the result based on an internal rev
	_init: function () {
		/**
		 * The generated display name returned from {@link Person#generateDisplayName}
		 * @property {string}
		 */
		this.displayName = "";
		/**
		 * All of the name fields concatenated together
		 * @property {string}
		 */
		this.fullName = "";
		/**
		 * @property {string}
		 */
		this.nickname = "";
		/**
		 * The generated work info line returned from {@link Person#generateWorkInfoLine}
		 * @property {string}
		 */
		this.workInfoLine = "";
		/**
		 * The number of linked contacts associated with this person
		 * @property {string}
		 */
		this.contactCount = "";
		/**
		 * String to be used in CSS that indicates if the person is a favorite
		 * @property {string}
		 */
		this.isFavoriteClass = "";
	},

	/**
	 * Reset the display params and the params on the person
	 */
//	reset: function reset() {
//		this.$super(reset)();
//		this._init();
//	},
	
	generateDisplayParams: function () {
		var photos,
			contactIds,
			displayNameData = this.generateDisplayName(true),
			listPhotoPath,
			squarePhotoPath;
			
		this.displayName = displayNameData.displayName;
		this.fullName = this.getName().getFullName() || this.displayName;
		// Do not set the workline if the display name is already showing this data
		this.workInfoLine = (displayNameData.basedOnField !== DisplayNameType.TITLE_AND_ORGANIZATION_NAME &&
							displayNameData.basedOnField !== DisplayNameType.ORGANIZATION_NAME &&
							displayNameData.basedOnField !== DisplayNameType.TITLE) ? this.generateWorkInfoLine() : "";
		// Since we generated the display name from the nickname, don't show the nickname in the ui since the name field will have it.
		this.nickname = (displayNameData.basedOnField === DisplayNameType.NICKNAME) ? "" : this.getNickname().getValue();
		this.headerPhotoPath = this.getPhotos().getSquarePhotoPath() || PersonPhotos.DEFAULT_DETAILS_AVATAR;
		this.listPhotoPath = this.getPhotos().getListPhotoPath() || PersonPhotos.DEFAULT_LIST_AVATAR;
		
		// FIXME: If the id is not set this could cause a problem. This might happen
		//        when we need to create a fake person object to inject somewhere for
		//		  perceived perf
		this.imageId = "contactImage_" + this.getId();
		
	//	// fix up the number->string munging that returnStrings does
	//	for (var i = 0; i < Contact.numberFields.length; i++) {
	//		var str = c[Contact.numberFields[i]];
	//		if (str) {
	//			c[Contact.numberFields[i]] = parseInt(str);
	//		}
	//	}
		
		
		if (this.isFavorite()) {
			this.favoritesHeaderClass = PersonDisplay.FAVORITES_HEADER_CLASS;
			this.favoriteIcon = PersonDisplay.FAVORITE_ICON;
			this.favoriteClass = "favorite";
		}
		
		contactIds = this.getContactIds().getArray();
		this.contactCount = contactIds.length;
		if (!contactIds || contactIds.length <= 1) {
			this.hideContactCountClass = PersonDisplay.HIDE_CONTACT_COUNT_CLASS;
		}
	},
	
	toggleFavoriteAppearance: function (newFavoriteState) {
		if (newFavoriteState) {
			this.favoritesHeaderClass = PersonDisplay.FAVORITES_HEADER_CLASS;
			this.favoriteIcon = PersonDisplay.FAVORITE_ICON;
		} else {
			this.favoritesHeaderClass = "";
			this.favoriteIcon = "";
		}
	}
});


PersonDisplay.getImStatusClassName = function (status) {
	switch (status) {
	case IMAddress.STATUS.ONLINE:
		return "status-available";
	case IMAddress.STATUS.BUSY:
		return "status-busy";
	case IMAddress.STATUS.OFFLINE:
		return "status-offline";
	case IMAddress.STATUS.NO_PRESENCE:
		return "hide-status";
	default:
		return "hide-status";
	}
};


/*
 * Various constants used, including CSS classes
 */
PersonDisplay.DEFAULT_LIST_AVATAR = PersonPhotos.DEFAULT_LIST_AVATAR;
PersonDisplay.DEFAULT_DETAILS_AVATAR = PersonPhotos.DEFAULT_DETAILS_AVATAR;
PersonDisplay.FAVORITE_ICON = '<img class="list-favorite" src="' + LIB_ROOT + 'images/favorites-star-blue.png" height="24" width="24" alt="" />';

PersonDisplay.HIDE_CONTACT_COUNT_CLASS = "count-hidden";
PersonDisplay.FAVORITES_HEADER_CLASS = "favorites-header";
PersonDisplay.FAVORITES_LIST_CLASS = "favorites-list";
PersonDisplay.IS_CLIPPED_CLASS = {
	CLIPPED: "clipped",
	NOT_CLIPPED: "not-clipped"
};
