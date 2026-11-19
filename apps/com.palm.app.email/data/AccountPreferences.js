/* 
Copyright 2009 Palm, Inc.  All rights reserved.
*/

/*global AccountPreferences:true */
/** 
 * models email account preferences.
 */

var AccountPreferences = {};

AccountPreferences.getPrefsByAccountId = function(accountId) {
	var pref = enyo.application.accounts.getAccount(accountId);
	return pref.getPrefsData();
};

AccountPreferences.saveAccountPreferences = function(params) {
	
	if (!params || !params._id) {
		return;
	}
	
	// correct id. Id passed is com.palm.account id, not com.palm.mail.account id
	params._id = enyo.application.accounts.getAccount(params._id).getPrefsData()._id;
	
	// account name handled by accounts 
	if (params.accountName !== undefined) {
		AccountPreferences.saveAccountName(params._id, params.accountName);
	}
	
	var toSave = {}, sanitizeStr = AccountPreferences.sanitizeStr;
	
	// copy out only the variables that should be saved to the database
	["realName", "_id", "syncFrequencyMins", "syncWindowDays", "replyTo", "deleteFromServer", "deleteOnDevice", "inboxFolderId", "outboxFolderId", "notifications", "draftsFolderId", "trashFolderId"].forEach(function(key) {
		var val = params[key];
		toSave[key] = (typeof val === "string") ? sanitizeStr(val) : val;
	});

	toSave.signature = AccountPreferences._correctSignature(params.signature);
	console.log("@@@ saving the account");
	EmailApp.Util.callService('palm://com.palm.db/merge', {objects:[toSave]});
};

AccountPreferences.saveAccountName = function(accountId, accountName) {
	if (!accountId || accountName === undefined) {
		return;
	}

	console.log("Saving account name");
	// save account alias
	EmailApp.Util.callService('palm://com.palm.service.accounts/modifyAccount', {
		"accountId": accountId,
		"object": {
			"alias": accountName
		}
	}, function() {
		console.log("### Name save operation complete, yo.")
	});
};


AccountPreferences.sanitizeStr = function(str) {
	if (!str || typeof str !== "string") {
		// return whatever we were sent
		return str;
	}
	// strip scripts, then all other tags
	str = str.replace(/<script[^>]*>[\S\s]*?<\/script>/img, '');
	return str.replace(/<\/?[^>]+>/gi, '');
};

AccountPreferences._correctSignature = function(signature) {
	
	signature = signature || AccountPreferences.NO_SIGNATURE_BY_USER;
	// passed gatekeeper, so we're cool to blank out
	var carrierDefs = enyo.application.carrierDefaults; 
	// webOS CE: the default in any form (styled, as Account Settings shows it), and Palm's own
	// signature, are never saved: an account keeps a signature only when one was typed.
	if ((carrierDefs && signature === carrierDefs.defaultSignature) || AccountPreferences.isDefaultSig(signature)) {
		// default signature should never be saved to the database. Different
		// for each device. 
		signature = "";
	}
	
	if (signature.length > 0 && signature !== AccountPreferences.NO_SIGNATURE_BY_USER) {
		var strippedSig = AccountPreferences.sanitizeStr(signature);
		if (strippedSig.trim().length === 0) {
			signature = AccountPreferences.NO_SIGNATURE_BY_USER;
		} else if (strippedSig !== AccountPreferences.NO_SIGNATURE_BY_USER) {
			// preserving old logic. Tgis looks stupid, but I'm guessing
			// we could end up with the no-sig value after cleanup
			signature = AccountPreferences.addStylingToSig(signature);
		}
	} 
	return signature;
};

AccountPreferences.addStylingToSig = function(signature){
	// If the signature is empty or already has styling, just return it. Otherwise add the styling
	if (!signature || signature.indexOf('<div style="font-family: arial') === 0) {
		return signature;
	} 
	return '<div style="font-family: arial, sans-serif; font-size: 12px;color: #999999">' + signature + '</div>';
};




/** function is used to resolve a signature from a raw com.palm.account or an account
 * displayed in the compose view's from dropdown
 */
AccountPreferences.getSignature = function(accountId) {
	var defSig = AccountPreferences.defaultSignature();

	// DFISH-28123: fix default signature being used when sending from a
	// synthetic folder (and a custom signature is set on the default account)
	if (accountId === 'favorite-folders') {
		accountId = enyo.application.accounts.getDefaultAccountId();
	}

	if (!accountId) {
		return defSig;
	}
	
	var account = enyo.application.accounts.getAccount(accountId);
	if (!account) {
		return defSig;
	}
	// webOS CE: an account that saved Palm's signature (Account Settings showed it in an empty
	// field and saved it) gets the default instead.
	var sig = account.getSignature();
	return (sig && !AccountPreferences.isDefaultSig(sig)) ? sig : defSig;
};

/** webOS CE: the default signature, styled: the carrier defaults' when there are some. */
AccountPreferences.defaultSignature = function() {
	var carrierDefs = enyo.application.carrierDefaults;
	return AccountPreferences.addStylingToSig((carrierDefs && carrierDefs.defaultSignature) ||
		AccountPreferences.DEFAULT_SIG);
};

/**
 * webOS CE: whether a signature is a default rather than one the user typed: the current
 * default, or the one Email shipped with ("Sent from my HP TouchPad", in each language it
 * shipped in), styled or not.
 */
AccountPreferences.isDefaultSig = function(signature) {
	if (!signature || typeof signature !== "string") {
		return false;
	}
	var text = AccountPreferences.sanitizeStr(signature).trim();
	var carrierDefs = enyo.application.carrierDefaults;
	var defaults = AccountPreferences.SHIPPED_SIGS.concat([AccountPreferences.DEFAULT_SIG,
		AccountPreferences.sanitizeStr((carrierDefs && carrierDefs.defaultSignature) || "").trim()]);
	return defaults.indexOf(text) >= 0;
};



AccountPreferences.SYNC_MANUAL	= 0;
AccountPreferences.SYNC_5_MINS	= 5;
AccountPreferences.SYNC_10_MINS	= 10;
AccountPreferences.SYNC_15_MINS	= 15;
AccountPreferences.SYNC_30_MINS	= 30;
AccountPreferences.SYNC_1_HR	= 60;
AccountPreferences.SYNC_6_HRS	= 360;
AccountPreferences.SYNC_12_HRS	= 720;
AccountPreferences.SYNC_24_HRS	= 1440;
AccountPreferences.SYNC_PUSH	= -1;


AccountPreferences.LOOKBACK_1_DAY 	= 1;
AccountPreferences.LOOKBACK_3_DAYS 	= 3;
AccountPreferences.LOOKBACK_7_DAYS 	= 7;
AccountPreferences.LOOKBACK_2_WEEKS = 14;
AccountPreferences.LOOKBACK_1_MONTH = 30;
AccountPreferences.LOOKBACK_FOREVER = 0;

AccountPreferences.NO_SIGNATURE_BY_USER = '<div id="no_signature" style="overflow:hidden;"></div>';
AccountPreferences.DEFAULT_SIG = $L("-- Sent from my HP TouchPad");
// webOS CE: the signature as Email shipped it in each language, which accounts set up before
// 3.2.0 may have saved. The maker's name is joined on so that the image build's wording pass
// (build/full-ce/hp_wording.py), which renames the default above, leaves these as they were.
AccountPreferences.SHIPPED_SIGS = (function() {
	var maker = "H" + "P";
	return ["-- Sent from my " + maker + " TouchPad", "-- Gesendet von meinem " + maker + " TouchPad",
		"-- Enviado desde mi " + maker + " TouchPad", "-- Envoy\u00e9 depuis mon " + maker + " TouchPad", "-- Inviato da " + maker + " TouchPad"];
}());

AccountPreferences.NOTIFICATION_MUTE = "mute";
AccountPreferences.NOTIFICATION_SYSTEM = "system";
AccountPreferences.NOTIFICATION_VIBRATE = "vibrate";
AccountPreferences.NOTIFICATION_RINGTONE = "ringtone";


