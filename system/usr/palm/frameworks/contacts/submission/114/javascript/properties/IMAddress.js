/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, PropertyBase, Utils, RB, StringUtils, console */

// TODO: where do we store presence???  custom message??

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var im = new IMAddress({
 *	value: "donaldTrump",
 *	type: "",
 *	primary: false
 * });
 * 
 * var imString = im.getValue();
 * var imStringAgain = im.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var IMAddress = exports.IMAddress = PropertyBase.create({
	/**
	* @lends IMAddress#
	* @property {string} x_value
	* @property {string} x_type
	* @property {string} x_label
	* @property {string} x_primary
	*/
	data: [
		{
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name IMAddress#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name IMAddress#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}, {
			dbFieldName: "type",
			defaultValue: "",
			/**
			* @name IMAddress#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name IMAddress#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		}, {
			dbFieldName: "label",
			defaultValue: "",
			/**
			* @name IMAddress#setLabel
			* @function
			* @param {string} label
			*/
			setterName: "setLabel",
			/**
			* @name IMAddress#getLabel
			* @function
			* @returns {string}
			*/
			getterName: "getLabel"
		}, {
			dbFieldName: "primary",
			defaultValue: false,
			/**
			* @name IMAddress#setPrimary
			* @function
			* @param {string} primary
			*/
			setterName: "setPrimary",
			/**
			* @name IMAddress#getPrimary
			* @function
			* @returns {string}
			*/
			getterName: "getPrimary"
		}
	]
});


/**
 * @returns {string}
 */

IMAddress.prototype.getNormalizedHashKey = function () {
	return this.getNormalizedValue() + ":(|)" + this.getType();
};

IMAddress.prototype.getDisplayValue = function () {
	return this.getValue();
};

IMAddress.normalizeIm = function (str) {
	if (!str || !_.isString(str)) {
		str = "";
	}
	return str.toLowerCase().trim();
};

IMAddress.prototype.getNormalizedValue = function () {
	return IMAddress.normalizeIm(this.getValue());
};

/** 
 * @name IMAddress#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
IMAddress.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});

/**
 * @returns {string}
 */
IMAddress.prototype.getDisplayType = function () {
	return IMAddress.getDisplayType(this.getType());
};
/** 
 * @name IMAddress#x_displayType
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayType()
 */
IMAddress.prototype.__defineGetter__("x_displayType", function () {
	return this.getDisplayType();
});

IMAddress.getDisplayType = function (type) {
	return (IMAddress.Labels.getLabel(type) || IMAddress.Labels.getLabel(IMAddress.TYPE.DEFAULT));
};


/*
//TODO: use this somehow for the app?
ContactPointDecorator.messagingFormatter = function	(im) {
	//if (im.hasBeenFormatted) {
		//return im;
	//}
	ContactPointDecorator.formatContactPoint(im, IMName.labels);
	im.displayValue = im.value || im.displayValue;
	im.showPresence = true;
	
	if (im.showPresence) {
		switch (im.availability) {
		case IMName.BUSY:
			im.statusImage = 'status-busy';
			break;
		case IMName.IDLE:
			im.statusImage = 'status-idle';
			break;
		case IMName.ONLINE:
			im.statusImage = 'status-available';
			break;
		case IMName.OFFLINE:
			im.statusImage = 'status-offline';
			break;
		default:
			im.statusImage = '';
		}
	}
	
	im.type = "im";
	
	if (im.customMessage) {
		im.customMessage = im.customMessage.unescapeHTML();
		im.customMessage = im.customMessage.replace(/&apos;/g, "'").replace(/&quot;/g, "\"");
		im.showCustomMessage = 'show-custom-message';
	}
	im.hasBeenFormatted = true;
	return im;
};
*/


/**
 * @constant
 */
IMAddress.STATUS = Utils.defineConstants({
	ONLINE: 0,
	BUSY: 2,
	OFFLINE: 4,
	NO_PRESENCE: 6
});

// prefixing these with "type_" to discourage direct display of these values
IMAddress.TYPE = Utils.defineConstants({
	AIM: "type_aim",
	YAHOO: "type_yahoo",
	GTALK: "type_gtalk",
	MSN: "type_msn",
	JABBER: "type_jabber",
	ICQ: "type_icq",
	IRC: "type_irc",
	QQ: "type_qq",
	SKYPE: "type_skype",
	YJP: "type_yjp",
	LCS: "type_lcs",
	DOTMAC: "type_dotmac",
	FACEBOOK: "type_facebook",
	MYSPACE: "type_myspace",
	GADUGADU: "type_gadugadu",
	DEFAULT: "type_default"
});

// prefixing these with "label_" to discourage direct display of these values
IMAddress.LABEL = Utils.defineConstants({
	HOME: "label_home",
	WORK: "label_work",
	OTHER: "label_other"
});

IMAddress.Labels = Utils.createLabelFunctions([{
	value: IMAddress.TYPE.AIM,
	displayValue: RB.$L('AIM'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.GTALK,
	displayValue: RB.$L('GTalk'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.YAHOO,
	displayValue: RB.$L('Yahoo!'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.SKYPE,
	displayValue: RB.$L('Skype'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.MSN,
	displayValue: RB.$L('Messenger'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.JABBER,
	displayValue: RB.$L('Jabber'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.ICQ,
	displayValue: RB.$L('ICQ'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.IRC,
	displayValue: RB.$L('IRC'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.QQ,
	displayValue: RB.$L('QQ'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.YJP,
	displayValue: RB.$L('Y! Japan'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.LCS,
	displayValue: RB.$L('LCS'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.DOTMAC,
	displayValue: RB.$L('.Mac'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.FACEBOOK,
	displayValue: RB.$L('Facebook'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.MYSPACE,
	displayValue: RB.$L('MySpace'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.GADUGADU,
	displayValue: RB.$L('GaduGadu'),
	isPopupLabel: true
}, {
	value: IMAddress.TYPE.DEFAULT,
	displayValue: RB.$L('IM'),
	isPopupLabel: false
}], true);