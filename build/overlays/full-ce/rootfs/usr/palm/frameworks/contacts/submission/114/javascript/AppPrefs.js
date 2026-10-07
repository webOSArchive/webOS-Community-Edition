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

// webOS CE: the AppPrefs objects waiting on another one in this process that is
// creating its kind's prefs record right now, by kind. Contacts makes two AppPrefs as it
// starts (ContactsApp and contactsui's PersonList), and on a first launch both finds came
// back empty before either put landed, so two records were written. Now the first to find
// none creates the record; the others wait for that put and then read what it made.
AppPrefs._creating = {};

AppPrefs.prototype._doQuery = function () {
	// webOS CE: limit was 2; read enough to heal more than one duplicate at once.
	this._future = DB.find({ from: this._kind, limit: 10 });
	this._future.then(this, this._handleResult);
};

AppPrefs.prototype._handleResult = function (future) {
	var results = future.result.results,
		length = results.length,
		kind = this._kind,
		waiters,
		shallowCopy;
	
	if (length > 1) {
		console.error("AppPrefs: Expected singleton object for " + kind + ", but received >1 result.");
		results = [this._healDuplicates(results)];	// webOS CE: keep one, delete the rest.
	} else if (length === 0) {
		if (AppPrefs._creating[kind]) {
			// webOS CE: another AppPrefs in this process is creating it; read it once that's done.
			AppPrefs._creating[kind].push(this);
			return;
		}
		console.log("AppPrefs: No prefs found, creating " + kind);
		
		// No prefs object exists, put one in the db, and read it back so we get a deep clone.
		waiters = AppPrefs._creating[kind] = [];
		shallowCopy = _.clone(this._defaults);
		shallowCopy._kind = kind;
		// webOS CE: read back once the put is done (stock re-queried at once). A then()
		// without an error function also runs when the put fails, so nobody waits forever.
		DB.put([shallowCopy]).then(this, function () {
			delete AppPrefs._creating[kind];
			waiters.forEach(function (w) {
				w._doQuery();
			});
			this._doQuery();
		});
		
		return;
	}
	
	// else save the prefs object, and set our ready flag.
	this._prefs = results[0];
	this.ready = true;
	
	if (this._onReady) {
		this._onReady();
		this._onReady = undefined;
	}
};

/*
	webOS CE: repair a kind that already has duplicate prefs records (every Contacts first
	launch before CE 3.2.0 left two). Keep the record whose default account is set, else the
	newest; carry over any pref that another record changed from its default; delete the
	others. The choice is deterministic, so the app and com.palm.service.contacts healing at
	the same time keep the same record.
*/
AppPrefs.prototype._healDuplicates = function (results) {
	var defaults = this._defaults,
		sorted = results.slice().sort(function (a, b) {
			return ((b.defaultAccountId ? 1 : 0) - (a.defaultAccountId ? 1 : 0)) || ((b._rev || 0) - (a._rev || 0));
		}),
		keep = sorted[0],
		others = sorted.slice(1),
		merge = { _id: keep._id },
		changed = false;
	
	others.forEach(function (other) {
		Object.keys(defaults).forEach(function (key) {
			var mine = keep[key];
			if ((mine === undefined || mine === defaults[key]) && other[key] !== undefined && other[key] !== defaults[key]) {
				keep[key] = merge[key] = other[key];
				changed = true;
			}
		});
	});
	
	if (changed) {
		DB.merge([merge]);
	}
	DB.del(others.map(function (other) {
		return other._id;
	}));
	console.warn("AppPrefs: kept " + keep._id + " and deleted " + others.length + " duplicate " + this._kind + " record(s)");
	return keep;
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
