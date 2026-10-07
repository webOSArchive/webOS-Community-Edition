/* Copyright 2009 Palm, Inc.  All rights reserved. */
/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, console, DB, TempDB, Utils, PalmCall */

// Class for monitoring a particular query in the db.
// When the watch is no longer needed, we're cancelled, and can release any resources we were holding on to.
var DBWatcher = function (query, watchFiredCallback, useTempDB) {
	console.log("Creating DBWatcher.");
	
	//sanity-check the params
	if (!query || !watchFiredCallback || !_.isFunction(watchFiredCallback)) {
		console.warn("Tried to create DBWatcher with invalid params. %s %s", query, watchFiredCallback);
		return;
	}
	
	this._watchFiredCallback = watchFiredCallback;
	this._query = query;
	this._useTempDB = !!useTempDB;
	
	this._doQuery();
};

// Cancels the watch so that it will no longer receive updates
DBWatcher.prototype.cancel = function () {
	console.log("Cancelling DBWatcher.");
	if (this._dbFindFuture) {
		PalmCall.cancel(this._dbFindFuture);
		this._dbFindFuture.cancel();
		this._dbFindFuture = undefined;
	}
};

DBWatcher.prototype._doQuery = function () {
	var DBObject = (this._useTempDB) ? TempDB : DB;
	
	if (this._dbFindFuture) {
		PalmCall.cancel(this._dbFindFuture);
		this._dbFindFuture.cancel();
	}
	
	this._dbFindFuture = DBObject.find(this._query, true);
	this._dbFindFuture.onError(this, this._queryError);
	this._dbFindFuture.then(this, this._queryResponse);
};

DBWatcher.prototype._queryError = function () {
	console.warn("DBWatcher query failed.");
};

DBWatcher.prototype._queryResponse = function () {
	var result = this._dbFindFuture.result,
		results;
	
	//set up the future to call me again when the watch fires
	this._dbFindFuture.then(this, this._queryResponse);
	
	if (!result) {
		console.warn("DBWatcher: Falsy query result: " + Utils.stringify(result));
		return;
	}
	
	//if this was a mojodb watch firing, do the query
	if (result.fired) {
		console.warn("DBWatcher: watch fired, re-issuing query.");
		this._doQuery();
		return;
	}
	
	results = result.results;
	
	if (!results || !_.isArray(results)) {
		console.warn("DBWatcher: Query result did not contain results array: " + Utils.stringify(results));
		return;
	}
	
	//now make the callback with the results
	this._watchFiredCallback(results);
};
