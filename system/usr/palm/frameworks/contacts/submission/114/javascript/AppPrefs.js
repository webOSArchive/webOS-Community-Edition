/* Copyright 2009 Palm, Inc.  All rights reserved. */
/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, Utils, DB, _, console, ListWidget */


/******************************************************************************
	Loads and manages changes to a prefs object, stored in MojoDB.
	External changes are currently NOT watched for -- we assume only the app will be mucking with its preferences.
	
	Pass the mojodb kind and an object containing default values to the constructor.
	The prefs object will be added to the database if missing, and loaded & used otherwise.
	It is assumed to be a singleton if it exists.
	
	The object's "ready" property will be true once initialization is complete, and prefs have been loaded.
	
	Shamelessly stolen from the Mail app and slightly reworked to be contacts-specific.
	
******************************************************************************/
var AppPrefs = exports.AppPrefs = function (onReady, kind, defaults) {
	kind = kind || AppPrefs.dbKind;
	defaults = defaults || {
		listSortOrder: ListWidget.SortOrder.defaultSortOrder,
		defaultAccountId: "",
		contactsPhoneRegion: "us"
	};
	
	this.ready = false; // set to true after we've loaded our prefs object.
	this._kind = kind;
	this._defaults = defaults;
	this._onReady = onReady;
	
	Utils.mixInBroadcaster(this);
	
	this._doQuery();
};

//store the dbKind of AppPrefs
Utils.defineConstant("dbKind", "com.palm.app.contacts.prefs:1", AppPrefs);

//the list of prefs currently stored in this object in the db
AppPrefs.Pref = Utils.defineConstants({
	listSortOrder: "listSortOrder",
	defaultAccountId: "defaultAccountId",
	contactsPhoneRegion: "contactsPhoneRegion"
});

AppPrefs.prototype._doQuery = function () {
	this._future = DB.find({ from: this._kind, limit: 2 });
	this._future.then(this, this._handleResult);
};

AppPrefs.prototype._handleResult = function (future) {
	var length = future.result.results.length,
		shallowCopy;
	
	if (length > 1) {
		console.error("AppPrefs: Expected singleton object for " + this._kind + ", but received >1 result.");
		// Fall through into len === 1 case... just use the 1st prefs object.
	} else if (length === 0) {
		console.log("AppPrefs: No prefs found, creating " + this._kind);
		
		// No prefs object exists, put one in the db, and read it back so we get a deep clone.
		shallowCopy = _.clone(this._defaults);
		shallowCopy._kind = this._kind;
		DB.put([shallowCopy]);
		
		this._doQuery();
		
		return;
	}
	
	// else save the prefs object, and set our ready flag.
	this._prefs = future.result.results[0];
	this.ready = true;
	
	if (this._onReady) {
		this._onReady();
		this._onReady = undefined;
	}
};

/*
	Get a named prefs value.
	Dot notation is supported for getting deep properties within a prefs object.
	Property names with dots in them are NOT supported.
*/
AppPrefs.prototype.get = function (propName) {
	var result = this._prefs,
		props;
	
	if (!this.ready) {
		console.error("AppPrefs: Access to pref " + propName + " before prefs object is ready. Using default.");
		result = this._defaults;
	}
	
	props = propName.split('.');	
	while (result && props.length > 0) {
		result = result[props.shift()];
	}
	
	if (props.length > 0) {
		// We couldn't follow the whole trail of property names.
		console.warn("AppPrefs: Invalid attempt to access pref at " + propName);
	}
	
	return result;
};

/*
	Set a named prefs value.  Modifies the local object, and writes to mojodb.
	Don't try to set a nested property in an array using dot notation, it might not go well.
	Property names with dots in them are NOT supported.
*/
AppPrefs.prototype.set = function (propName, value) {
	var prefs = this._prefs,
		mergeObj,
		objToSet,
		props,
		curProp;
	
	if (!this.ready) {
		console.error("AppPrefs: Attempt to set pref " + propName + " before prefs object is ready. Ignoring.");
		return;
	}
	
	mergeObj = objToSet = { _id: this._prefs._id };
	
	props = propName.split('.');
	
	// Traverse the property path in the prefs object, while also building up an object chain for the mojodb merge.
	// Since we just build this with objects, it's probably not a good idea to try to set a value in an array using the dot notation.
	while (objToSet && props.length > 1) {
		curProp = props.shift();
		
		// Add intermediary objects if needed.
		if (!prefs[curProp]) {
			prefs[curProp] = {};
		}
		prefs = prefs[curProp];
		
		objToSet[curProp] = {};
		objToSet = objToSet[curProp];
	}
	
	curProp = props.shift();
	prefs[curProp] = value;
	objToSet[curProp] = value;
	
	DB.merge([mergeObj]);
	
	this.broadcast(propName, value);
};
