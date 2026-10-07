this._root["__MojoFramework_contacts"] = function(MojoLoader, exports, root) {


//@ sourceURL=contacts/prologue.js

/* Copyright 2009 Palm, Inc.  All rights reserved. */
/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global MojoLoader, exports, require:true*/

/**
 * @namespace exports
 */

var IMPORTS = MojoLoader.require({
	name: "foundations",
	version: "1.0"
},
{
	name: "underscore",
	version: "1.0"
},
{
	name: "foundations.crypto",
	version: "1.0"
},
{
	name: "foundations.io",
	version: "1.0"
},
{
	name: "globalization",
	version: "1.0"
});

var Crypto = IMPORTS["foundations.crypto"];
var Foundations = IMPORTS.foundations;
var Globalization = IMPORTS.globalization.Globalization;
exports.Globalization = Globalization;
var _ = IMPORTS.underscore._;

var Assert = Foundations.Assert;
var Class = Foundations.Class;
var DB = Foundations.Data.DB;
var TempDB = Foundations.Data.TempDB;
var Future = Foundations.Control.Future;
var ObjectUtils = Foundations.ObjectUtils;
var PalmCall = Foundations.Comms.PalmCall;
var StringUtils = Foundations.StringUtils;

var LIB_ROOT = MojoLoader.root;

var resourceBundleFactory = new Globalization.ResourceBundleFactory(MojoLoader.root);
var RB = resourceBundleFactory.getResourceBundle();

var RECORD_TIMINGS_FOR_SPEED = false;

// check to see if NOV-108635 is fixed yet
if (typeof require === 'undefined') {
    require = IMPORTS.require;
}


//@ sourceURL=contacts/Utilities/stringify.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global MojoLoader */

var stringifyIMPORTS = MojoLoader.require({
	name: "underscore",
	version: "1.0"
});
var stringify_ = stringifyIMPORTS.underscore._;


//a much better stringify than JSON.stringify, since it doesn't die when given a circular structure.
//however, it's not guaranteed to produce valid JSON (namely, not when given a circular structure or a structure containing functions)
function stringify(root, printFunctionCode, indentSize, maxDepth) {
	var keysFn = Object.keys || function (obj) {
			var keys = [],
				key;
			for (key in obj) {
				if (obj.hasOwnProperty(key)) {
					keys.push(key);
				}
			}
			return keys;
		},
		newline = "",
		indentToken = "",
		gap = "";
	
	//if the caller doesn't pass an indentSize, default to 4.  but let them pass 0
	if (!indentSize && indentSize !== 0) {
		indentSize = 4;
	}
	
	//if the caller doesn't pass a max depth, default to 5.  but let them pass 0
	if (!maxDepth && maxDepth !== 0) {
		maxDepth = 5;
	}
	
	if (indentSize) {
		indentSize = (indentSize > 10) ? 10 : indentSize;
		newline = "\n";
		indentToken = "          ".substring(0, indentSize);
		gap = " ";
	}
	
	//return whether the given node has been visited already, and if not mark it as visited
	function visitNode(visitedNodes, node) {
		var visited = false,
			i;
		
		for (i = 0; i < visitedNodes.length; i += 1) {
			if (visitedNodes[i] === node) {
				visited = true;
				break;
			}
		}
		
		if (!visited) {
			visitedNodes.push(node);
		}
		
		return visited;
	}
	
	//copied from Foundations.ObjectUtils
	function type(model) {
		if (model === null) {
			return "null";
		} else if (model === undefined) {
			return "undefined";
		} else if (typeof model === "number") {
			return "number";
		} else if (typeof model === "string") {
			return "string";
		} else if (model === true || model === false) {
			return "boolean";
		} else if (Object.prototype.toString.call(model) === "[object Array]") {
			return "array";
		} else if (typeof model === "function") {
			return "function";
		} else {
			return "object";
		}
	}
	
	function stringifyHelper(curDepth, curNodeName, curNode, visitedNodes, curIndent) {
		var curNodeType = type(curNode),
			name = curIndent + ((curNodeName) ? "\"" + curNodeName + "\":" + gap : ""),
			innerVisitedNodes,
			visited,
			i,
			keys,
			retVal;
		
		curDepth += 1;
		
		if (curDepth > maxDepth) {
			return name + "<Truncated: Max Depth Reached>";
		}
		
		switch (curNodeType) {
		case "null":
			return name + "null";
			
		case "undefined":
			return name + "undefined";
			
		case "number":
			return name + curNode;
			
		case "string":
			return name + JSON.stringify(curNode);
			
		case "boolean":
			return name + curNode;
			
		case "array":
			innerVisitedNodes = stringify_.clone(visitedNodes);
			visited = visitNode(innerVisitedNodes, curNode);
			if (visited) {
				return name + "<Already Visited Array>";
			} else {
				retVal = name + "[";
				
				for (i = 0; i < curNode.length; i += 1) {
					retVal += (i === 0) ? newline : "";
					retVal += stringifyHelper(curDepth, "", curNode[i], innerVisitedNodes, curIndent + indentToken);
					retVal += (i < curNode.length - 1) ? "," : "";
					retVal += newline;
				}
				
				retVal += (i > 0) ? curIndent : "";
				retVal += "]";
				return retVal;
			}
			//this isn't necessary, except that jslint doesn't do path analysis - both paths of the if return
			break;
			
		case "function":
			if (printFunctionCode) {
				return name + curNode.toString();
			} else {
				return name + "<Function>";
			}
			//this isn't necessary, except that jslint doesn't do path analysis - both paths of the if return
			break;
			
		case "object":
			innerVisitedNodes = stringify_.clone(visitedNodes);
			visited = visitNode(innerVisitedNodes, curNode);
			if (visited) {
				return name + "<Already Visited Object>";
			} else {
				retVal = name + "{";
				keys = keysFn(curNode);
				
				for (i = 0; i < keys.length; i += 1) {
					retVal += (i === 0) ? newline : "";
					retVal += stringifyHelper(curDepth, keys[i], curNode[keys[i]], innerVisitedNodes, curIndent + indentToken);
					retVal += (i < keys.length - 1) ? "," : "";
					retVal += newline;
				}
				
				retVal += (i > 0) ? curIndent : "";
				retVal += "}";
				return retVal;
			}
		}
	}

	return stringifyHelper(0, "", root, [], "");
}


//@ sourceURL=contacts/Utilities/BatchDBWriter.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
 regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global DB, console */

/*
 * Allows you to easily batch db merges and write them to the db all at once.  Exported as Contacts.Utils.BatchDBWriter (see Utils.js).
 */
var BatchDBWriter = function (usePseudoDeepCompare) {
	this._objectCount = 0;
	this._usePseudoDeepCompare = usePseudoDeepCompare;
};

// Save the prop=val write in a hash of pending writes organized by record _id, so we can send them to mojodb all at once, later.
// Checks to see if the value is already current, and ignores the request if so.  
// Otherwise, the value is set in the passed object, so it matches the future state of the database.
BatchDBWriter.prototype.batchWrite = function (obj, prop, val) {
	var writes,
		oldVal,
		id;
	
	// Can't write undefined values, so use null instead.
	if (val === undefined) {
		val = null;
	}
	
	oldVal = obj[prop];
	if (oldVal === undefined) {
		oldVal = null;
	}


	// If value already matches, return without doing anything.
	if (this._usePseudoDeepCompare && JSON.stringify(oldVal) === JSON.stringify(val)) {	//pseudo deep compare
		return;
	} else if (!this._usePseudoDeepCompare && oldVal === val) {	//primitive comparison
		return;
	}
	
	// Else, set the value locally, and queue a write to go to mojodb later.
	obj[prop] = val;
	id = obj._id;
	
	// If this write is to a new object, and it would push us over 500 objects, 
	// then commit the batch, and continue with a new one.
	writes = this._batchedWrites;
	if (writes && !writes[id]) {
		if (this._objectCount > ((this.bufferCommitSize ? this.bufferCommitSize : 500) - 1)) {
			this.commitBatchedWrites();
		}
	}

	this._objectCount += 1;
	
	// Create a new object to hold writes for 'id', if needed.
	// Then save the new prop/value pair in it.
	this._batchedWrites = this._batchedWrites || {};
	writes = this._batchedWrites;
	writes[id] = writes[id] || { _id: id };
	writes[id][prop] = val;
};

// Sets the commit to db threshhold. DBWriter will commit when its buffer size = bufferCommitSize
// Returns true if succeeds, false otherwise
BatchDBWriter.prototype.setBufferCommitSize = function (bufferCommitSize) {
	if (bufferCommitSize && (typeof(bufferCommitSize) === "number") && this._objectCount === 0) {
		if (bufferCommitSize < 2 || bufferCommitSize > 500) { //DO NOT ALLOW BATCHSIZE PARAMETER VALUES <2 OR >500
			return false;
		} else {
			this.bufferCommitSize = bufferCommitSize;
			return true;
		}
	} else {
		return false;
	}
};

// Clears out the hash of pending writes, and sends them to mojodb.
BatchDBWriter.prototype.commitBatchedWrites = function () {
	var writes = this._batchedWrites,
		id,
		objList;
	
	if (!writes) {
		console.log("commitBatchedWrites: no writes, skipping.");
		return;
	}
	
	// Build an array of all the objects in our hash.
	objList = [];
	Object.keys(writes).forEach(function (property) {
		objList.push(writes[property]);
	});
	
	// If we have any, send 'em to mojodb.
	if (objList.length > 0) {
		console.log("commitBatchedWrites: sending " + objList.length + " writes.");
		DB.merge(objList);
	} else {
		console.log("commitBatchedWrites: no writes, not sending.");
	}
	
	this._batchedWrites = undefined;
	this._objectCount = 0;
};


//@ sourceURL=contacts/Utilities/DBWatcher.js

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


//@ sourceURL=contacts/Utilities/FingerWalker.js

/* Copyright 2009 Palm, Inc.  All rights reserved. */
/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global*/


var FingerWalker = function (objects) {
	this.objects = objects;
	this.currentIndex = 0;
};

FingerWalker.prototype.getCurrentValue = function () {
	if (this.hasValueLeft()) {
		return this.objects[this.currentIndex];
	}
};

FingerWalker.prototype.usedCurrentValue = function () {
	this.currentIndex += 1;
};

FingerWalker.prototype.hasValueLeft = function () {
	return this.currentIndex < this.objects.length;
};

//@ sourceURL=contacts/Utilities/FingerWalkerSorter.js

/* Copyright 2009 Palm, Inc.  All rights reserved. */
/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, FingerWalker, Assert */


/** 
 *  arrayOfArrays - each array in this array is a list of values that you want to have sorted
 *                  using the fingerWalkerSort.
 *  compareFunction - function that should expect to get an array of values and return the index
 *                    of the object that it considers the highest.
 */
var FingerWalkerSorter = function (arrayOfArrays, compareFunction) {
	var that = this;
	
	this.fingerWalkers = [];
	this.compareFunction = compareFunction;
	
	arrayOfArrays.forEach(function (array) {
		that.fingerWalkers.push(new FingerWalker(array));
	});
};

FingerWalkerSorter.prototype.sort = function () {
	var sortedValues = [],
		objectsToCompare = this._getObjectsToCompare(),
		highestValueIndex;
	
	while (objectsToCompare.values.length > 0) {
		
		// Call the compareFunction with an array of values.
		// The compareFunction should return the index of the highest value
		highestValueIndex = this.compareFunction(objectsToCompare.values);
		
		Assert.require(highestValueIndex > -1 && highestValueIndex < objectsToCompare.values.length, "FingerWalkerSorter - compareFunction returned an index '" + highestValueIndex + "' outside of the bounds of the values it was passed");
		
		sortedValues.push(objectsToCompare.values[highestValueIndex]);
		
		objectsToCompare.fingerWalkers[highestValueIndex].usedCurrentValue();
		
		objectsToCompare = this._getObjectsToCompare();
	}
	
	return sortedValues;
};

FingerWalkerSorter.prototype._getObjectsToCompare = function () {
	var objectsToCompare = {
		values: [],
		fingerWalkers: []
	};
	
	this.fingerWalkers.forEach(function (fingerWalker) {
		if (fingerWalker.hasValueLeft()) {
			objectsToCompare.values.push(fingerWalker.getCurrentValue());
			objectsToCompare.fingerWalkers.push(fingerWalker);
		}
	});
	
	return objectsToCompare;
};

//@ sourceURL=contacts/Utilities/SpeedDialSaver.js

/* Copyright 2009 Palm, Inc.  All rights reserved. */
/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, Globalization, Future, SpeedDialHash, SpeedDialBackup, Foundations, ContactLinkable, Utils */


/*
 * Used to save speed dials while a person is being edited.  The common use case for this is during fixup.
 */
var SpeedDialSaver = function (personOrPersons) {
	this.savedSpeedDials = [];
	
	var that = this,
		personArray;
	
	if (personOrPersons) {
		//make the argument an array if it's not already
		personArray = _.isArray(personOrPersons) ? personOrPersons : [personOrPersons];
		this.people = personArray;
		
		personArray.forEach(function (person) {
			//for each person we're passed, find the phone numbers that have speed dials and store them
			if (person) {
				person.getPhoneNumbers().getArray().forEach(function (phoneNumber) {
					var speedDial = phoneNumber.getSpeedDial();

					if (speedDial) {
						that.savedSpeedDials.push({
							speedDial: speedDial,
							value: phoneNumber.getValue(),
							person: person
						});
					}
				});
			}
		});
	}
};

SpeedDialSaver.prototype.saveBackupRecordsForSpeedDials = function () {
	var contactLinkHashCache = {},
		future = new Future(),
		speedDialHashes = {};
	
	future.now(this, function () {
		this.savedSpeedDials.forEach(function (speedDial) {
			var tempSpeedDialHash = new SpeedDialHash({
				key: speedDial.speedDial
			});

			tempSpeedDialHash.setPlainValue(speedDial.value);
			
			if (!speedDialHashes[speedDial.person.getId()]) {
				speedDialHashes[speedDial.person.getId()] = [];
				speedDialHashes[speedDial.person.getId()].push(tempSpeedDialHash);
			} else {
				speedDialHashes[speedDial.person.getId()].push(tempSpeedDialHash);
			}
		});
		
		return Foundations.Control.mapReduce({
			map: function (person) {
				var mapFuture = new Future(),
					contactLinkHashes = [],
					toMapReduce = [];

				// If we don't have the contacts from the person, reload them.
				mapFuture.now(function () {
					if (person.getContacts().length === 0) {
						return person.reloadContacts();
					} else {
						return true;
					}
				});

				// Get the linkHashes for all of the contacts on this person
				mapFuture.then(function () {
					var result = mapFuture.result;

					return Foundations.Control.mapReduce({
						map: function (contact) {
							var contactLinkHashFuture = new Future();

							contactLinkHashFuture.now(function () {
								// Check for it in the cache first. 
								if (!contactLinkHashCache[contact.getId()]) {
									// If it wasn't in the cache then we have to fetch it.
									return ContactLinkable.getLinkHash(contact).then(function (getLinkHashFuture) {
										var result = getLinkHashFuture.result;

										contactLinkHashes.push(result.linkHash);
										contactLinkHashCache[contact.getId()] = result.linkHash;
										return true;
									});
								} else {
									return true;
								}
							});

							return contactLinkHashFuture;
						}
					}, person.getContacts());
				});

				// Get the backups for the link hashes from the db and save the updated data. Create any
				// new backup records for entries not currently in the db.
				mapFuture.then(function () {
					var dummy = future.result;
					
					return Foundations.Control.mapReduce({
						map: function (contactLinkHash) {
							var getLinkHashBackupFuture = new Future();

							getLinkHashBackupFuture.now(function () {
								return SpeedDialBackup.getBackupForLinkHash(contactLinkHash);
							});

							getLinkHashBackupFuture.then(function () {
								var result = getLinkHashBackupFuture.result,
									tempBackup;

								if (result) {
									tempBackup = result;
								} else {
									tempBackup = new SpeedDialBackup({
										contactBackupHash: contactLinkHash,
										speedDials: []
									});
								}

								tempBackup.getSpeedDials().clear();
								if (speedDialHashes[person.getId()] && speedDialHashes[person.getId()].length > 0) {
									tempBackup.getSpeedDials().add(speedDialHashes[person.getId()]);
									toMapReduce.push({"function": tempBackup.save, object: tempBackup});
								} else if (tempBackup.getId()) {
									toMapReduce.push({"function": tempBackup.deleteSpeedDialBackup, object: tempBackup});
								}
								
								return true;
							});

							return getLinkHashBackupFuture;
						}
					}, contactLinkHashes);
				});

				// Save the updates of the speed dial backups to the db
				mapFuture.then(function () {
					var dummy = mapFuture.result;
					
					return Utils.mapReduceAndVerifyResultsTrue(toMapReduce);
				});

				return mapFuture;
			}
		}, this.people);
	});
	
	return future;
};

/*
 * Restores any speed dials possible onto the new person.  Does not save the person.
 */
SpeedDialSaver.prototype.restoreSpeedDials = function (personToRestoreTo) {
	//for each saved speed dial, look for the match phone number on the personToRestoreTo and if we find it, resave the speed dial
	this.savedSpeedDials.forEach(function (savedSpeedDial) {
		var matchingPhoneNumber = _.detect(personToRestoreTo.getPhoneNumbers().getArray(), function (phoneNumber) {
			var matchQuality = Globalization.Phone.comparePhoneNumbers(phoneNumber.getValue(), savedSpeedDial.value);
			return matchQuality > 0;
		});
		
		if (matchingPhoneNumber) {
			matchingPhoneNumber.setSpeedDial(savedSpeedDial.speedDial);
		}
	});
};

SpeedDialSaver.prototype.restoreSpeedDialsFromBackups = function (personToRestoreTo) {
	var future = new Future();
	
	future.now(this, function () {
		return this.getLinkHashesForPeople();
	});
	
	future.then(this, function () {
		var linkHashes = future.result;
		
		return SpeedDialBackup.getBackupsForLinkHashes(linkHashes);
	});
	
	future.then(this, function () {
		var backupRecords = future.result;
		
		backupRecords.forEach(function (backupRecord) {
			var speedDials = backupRecord.getSpeedDials().getArray();
			
			speedDials.forEach(function (speedDial) {
				personToRestoreTo.getPhoneNumbers().getArray().some(function (phoneNumber) {
					if (speedDial.isPlainValueEqual(phoneNumber.getValue())) {
						// Allow local speed dials to override backup records
						if (!phoneNumber.getSpeedDial()) {
							phoneNumber.setSpeedDial(speedDial.getKey());
							return true;
						}
					}
					
					return false;
				});
			});
		});
		
		return true;
	});
	
	return future;
};

/*
 * Restores any speed dials from the speed dial backup table. Does not save the person.
 */
SpeedDialSaver.prototype.getLinkHashesForPeople = function () {
	var future = new Future(),
		contactLinkHashes = [],
		contactLinkHashCache = {};
	
	future.now(this, function () {
		return Foundations.Control.mapReduce({
			map: function (person) {
				var mapFuture = new Future(),
					toMapReduce = [];
			
				// If we don't have the contacts from the person, reload them.
				mapFuture.now(function () {
					if (person.getContacts().length === 0) {
						return person.reloadContacts();
					} else {
						return true;
					}
				});

				// Get the linkHashes for all of the contacts on this person
				mapFuture.then(function () {
					var result = mapFuture.result;

					return Foundations.Control.mapReduce({
						map: function (contact) {
							var contactLinkHashFuture = new Future();

							contactLinkHashFuture.now(function () {
								// Check for it in the cache first. 
								if (!contactLinkHashCache[contact.getId()]) {
									// If it wasn't in the cache then we have to fetch it.
									return ContactLinkable.getLinkHash(contact).then(function (getLinkHashFuture) {
										var result = getLinkHashFuture.result;

										contactLinkHashes.push(result.linkHash);
										contactLinkHashCache[contact.getId()] = result.linkHash;
										return true;
									});
								} else {
									contactLinkHashes.push(contactLinkHashCache[contact.getId()]);
									return true;
								}
							});

							return contactLinkHashFuture;
						}
					}, person.getContacts());
				});
				
				return mapFuture;
			}
		}, this.people);
	});
	
	future.then(function () {
		var dummy = future.result;
		
		return contactLinkHashes;
	});
	
	return future;
};


//@ sourceURL=contacts/Utilities/TimingRecorder.js

/* Copyright 2009 Palm, Inc.  All rights reserved. */
/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, console, process */

var TimingRecorder = function (turnOffTimings, process) {
	this.timings = {};
	this.turnOffTimings = turnOffTimings;
	this.process = process;
};

TimingRecorder.prototype.startTimingForJob = function (jobName) {
	if (!this.turnOffTimings || !this.process) {
		return;
	}
	
	var time = this.process.uptime();
	
	if (!this.timings[jobName]) {
		this.timings[jobName] = [];
	}
	
	this.timings[jobName].push({
		startTime: time
	});
};

TimingRecorder.prototype.stopTimingForJob = function (jobName) {
	var time,
		tempJobTimings;
	
	if (!this.turnOffTimings || !this.process) {
		return;
	}
	
	time = this.process.uptime();
	
	tempJobTimings = this.timings[jobName];

	if (!tempJobTimings) {
		console.log("Job '" + jobName + "' did not have a startTiming call!!!!!");
	}
	
	tempJobTimings[tempJobTimings.length - 1].endTime = time;
};

TimingRecorder.prototype.printTimings = function () {
	var tempTimingsForJob,
		jobAverage,
		that = this;
	
	if (!this.turnOffTimings) {
		return;
	}
	
	Object.keys(this.timings).forEach(function (key) {
		jobAverage = 0;
		console.log("Timings for job '" + key + "'");
		
		tempTimingsForJob = that.timings[key];
		console.log(tempTimingsForJob.length + " recordings where made");
		
		tempTimingsForJob.forEach(function (timing, index) {
			console.log((index + 1) + ": " + ((timing.endTime - timing.startTime) / 1000) + "s");
			jobAverage += (timing.endTime - timing.startTime);
		});
		
		console.log("For a total time spent of: " + jobAverage / 1000 + "s");

		jobAverage = jobAverage / tempTimingsForJob.length;
		
		console.log("For an average time spent of: " + jobAverage / 1000 + "s");
	});
};


//@ sourceURL=contacts/Utilities/Utils.js

/* Copyright 2009 Palm, Inc.  All rights reserved. */
/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, exports, Assert, DisplayNameType, Person, Contact, RB, console, Future, Foundations,
stringify, DB, BatchDBWriter, FingerWalker, FingerWalkerSorter, DBWatcher, TimingRecorder, PropertyArray, PropertyBase */

/**
 * @private This is exported to make these functions available to other libraries
 *			that consume this library (contacts.ui)
 * @param {Object} name
 * @param {Object} value
 * @param {Object} applyToObject
 */
var Utils = exports.Utils = {
	/**
	 * A version of JSON.stringify that doesn't barf on circular structures.  
	 * Not guaranteed to produce valid JSON, so don't use it for anything but debugging.
	 * 
	 * @param {Object} root The object to stringify
	 * @param {Object} printFunctionCode Truthy if you want the code of functions to be printed, falsy otherwise.  Defaults to falsy.
	 * @param {Object} indentSize The size, as a count of spaces, to indent each subsequent line.  If 0 is passed, everything is printed on one line.
	 */
	stringify: stringify,
	
	/**
	 * Allows you to easily perform a finger walker type of sort
	 */
	FingerWalker: FingerWalker,
	
	FingerWalkerSorter: FingerWalkerSorter,
	
	/**
	 * Allows you to easily batch db merges and write them to the db all at once.  See BatchDBWriter.js
	 */
	BatchDBWriter: BatchDBWriter,
	
	/**
	 * Allows you to easily set up a watch on the db and get callbacks when the watch fires.  See DBWatcher.js
	 */
	DBWatcher: DBWatcher,
	
	TimingRecorder: TimingRecorder,
	
	// @param {Object} name - name of constant
	// @param {Object} value - value of constant
	// @param {Object} applyToObject -	put this constant property on this object 
	//									rather than creating a new object
	
	defineConstant: function (name, value, applyToObject) {
		var obj = applyToObject || {};
		obj.__defineGetter__(name, function () {
			return value;
		});
		obj.__defineSetter__(name, function () {
			throw new Error(name + " is a constant!");
		});
		return obj;
	},
	
	
	// @param {Object} definitionObj -	Take all direct properties on this object and turn them into constants
	//									on a new object or use applyToObject if specified
	// @param {Object} applyToObject -	put constant properties from definitionObj on this object rather
	//									than creating a new object
	// Example:
	//		PhoneNumber.TYPE = Utils.defineConstants({
	//			HOME: "type_home",
	//			WORK: "type_work",
	//			MOBILE: "type_mobile"
	//		});
	defineConstants: function (definitionObj, applyToObject) {
		var obj = applyToObject || {},
			key;
		for (key in definitionObj) {
			if (definitionObj.hasOwnProperty(key)) {
				Utils.defineConstant(key, definitionObj[key], obj);
			}
		}
		return obj;
	},
	
	
	// This function is used for converting a function's "arguments" object into an array
	// @param startIndex	-	Use this to ignore arguments that you have already pulled out
	//							via the function definition
	//TODO: turn this into a call to arguments.slice?
	functionArgsToArray: function (args, startIndex) {
		var argsArray = [],
			i;
			
		if (!args) {
			return [];
		}
			
		startIndex = startIndex || 0;
		for (i = startIndex; i < args.length; i = i + 1) {
			argsArray.push(args[i]);
		}
		return argsArray;
	},
	
	
	// Wraps a function and passes params
	curry: function (method) {
		Assert.requireFunction(method, "curry requires a function");
		if (!arguments.length) {	
			return method;
		}
		var args = Utils.functionArgsToArray(arguments, 1);
		
		return function () {
			var total = args.concat(Utils.functionArgsToArray(arguments));
			return method.apply(this, total);
		};
	},
	
	
	/**
	 * Allows you to instiantate via "new" and apply an array of args
	 * @param {Object} klass
	 * @param {Object} args
	 */
	instiantiateAndApply: function (klass, args) {
		function F() {
			return klass.apply(this, args);
		}
		F.prototype = klass.prototype;
		return new F();
	},
	
	lazyWrapper: function (klass, args) {
		return {
			isLazyWrapper: true,
			createInstance: Utils.curry(Utils.instiantiateAndApply, klass, args)
		};
	},
	
	generateGettersFromPropertyNames: function (scope, obj) {
		var field = "",
			getterName = "",
			getterFunction = function (fieldName) {
				return obj[fieldName];
			};
		// Generate all getters for fields that do not start with "_"
		for (field in obj) {
			if (obj.hasOwnProperty(field) && field[0] !== "_") {
				getterName = "get" + field[0].toUpperCase() + field.slice(1, field.length);
				scope[getterName] = Utils.curry(getterFunction, field);
			}
		}
	},
	
	getDBObjectForAllProperties: function (accessor, fieldNames) {
		var dbObj = {},
			i,
			prop,
			fieldName;
		
		Assert.requireFunction(accessor, "getDBObjectForAllProperties requires an accessor function");
		Assert.requireArray(fieldNames, "getDBObjectForAllProperties requires a fieldNames array");
		
		for (i = 0; i < fieldNames.length; i += 1) {
			fieldName = fieldNames[i];
			prop = accessor(fieldName);
			
			if (prop !== undefined && typeof prop === "object" && prop.getDBObject) {
				dbObj[fieldName] = prop.getDBObject();
			} else {
				dbObj[fieldName] = prop;
			}
		}
		return dbObj;
	},
	
	getDBObjectForAllDirtyProperties: function (accessor, fieldNames) {
		var dbObj = {},
			i,
			prop,
			fieldName,
			propDBObj;
		
		Assert.requireFunction(accessor, "getDBObjectForAllDirtyProperties requires an accessor function");
		Assert.requireArray(fieldNames, "getDBObjectForAllDirtyProperties requires a fieldNames array");
		
		for (i = 0; i < fieldNames.length; i += 1) {
			fieldName = fieldNames[i];
			prop = accessor(fieldName);
			if (prop !== undefined) {
				if (typeof prop === "object") {
					propDBObj = prop.getDBObject();
					if (propDBObj) {
						if (((prop instanceof PropertyArray) && prop.containsDirtyEntry()) || ((prop instanceof PropertyBase) && prop.isDirty())) {
							dbObj[fieldName] = propDBObj;
						}
					} else if (prop.isDirty()) {
						dbObj[fieldName] = propDBObj;
					}
				} else if (fieldName !== "_rev") {
					dbObj[fieldName] = prop;
				}
			} else {
				dbObj[fieldName] = prop;
			}
		}

		return dbObj;
	},
	
	/**
	 * 
	 * @param {Object} obj - A Person/Contact object or subclass
	 * @param {Object} includeBasedOnField
	 */
	generateDisplayName: function (obj, includeBasedOnField) {
		var displayName = "",
			basedOnField = null,
			fullName = obj.getName().getFullName(),
			org;
		
		if (fullName) {
			displayName = fullName;
			basedOnField = DisplayNameType.NAME;
		} else if (obj.getNickname().getValue()) {
			displayName = obj.getNickname().getValue();
			basedOnField = DisplayNameType.NICKNAME;
		} 
		
		if (!displayName) {
			if (obj instanceof Person) {
				if (obj.getOrganization().getTitle() && obj.getOrganization().getName()) {
					displayName = obj.getOrganization().getTitle() + ", " + obj.getOrganization().getName();
					basedOnField = DisplayNameType.TITLE_AND_ORGANIZATION_NAME;
				} else if (!obj.getOrganization().getTitle() && obj.getOrganization().getName()) { 
					displayName = obj.getOrganization().getName();
					basedOnField = DisplayNameType.ORGANIZATION_NAME;
				} else if (obj.getOrganization().getTitle() && !obj.getOrganization().getName()) {
					displayName = obj.getOrganization().getTitle();
					basedOnField = DisplayNameType.TITLE;
				}
			} else if (obj instanceof Contact) {
				org = obj.getBestOrganization();
				if (org) {
					if (org.getTitle() && org.getName()) {
						displayName = org.getTitle() + ", " + org.getName();
						basedOnField = DisplayNameType.TITLE_AND_ORGANIZATION_NAME;
					} else if (!org.getTitle() && org.getName()) { 
						displayName = org.getName();
						basedOnField = DisplayNameType.ORGANIZATION_NAME;
					} else if (org.getTitle() && !org.getName()) {
						displayName = org.getTitle();
						basedOnField = DisplayNameType.TITLE;
					}
				}
			}
		}
		
		if (!displayName) {
			if (obj.getEmails().getArray().length) {
				displayName = obj.getEmails().getArray()[0].getDisplayValue();
				basedOnField = DisplayNameType.EMAIL;
			} else if (obj.getIms().getArray().length) {
				displayName = obj.getIms().getArray()[0].getDisplayValue();
				basedOnField = DisplayNameType.IM;
			} else if (obj.getPhoneNumbers().getArray().length) {
				displayName = obj.getPhoneNumbers().getArray()[0].getDisplayValue();
				basedOnField = DisplayNameType.PHONE;
			} else {
				displayName = RB.$L("[No Name Available]");
				basedOnField = DisplayNameType.NONE;
			}
		}
		
		if (includeBasedOnField) {
			return {
				displayName: displayName,
				basedOnField: basedOnField
			};
		} else {
			return displayName;
		}
	},
	
	/** 
	 * @name Utils#dedupeEntries
	 * @function
	 * @param {object} object that holds a truthy value for each object that is already in the array you want to add to
	 * @param {array} array of objects that you want to be added.
	 * @param {string} Either undefined, in which case the objects in the array are used directly as the key for the 
	 *					hash, or the name of a method to be called that will generate the key
	 * @returns {array} array of what should be added
	 * @description Takes in an array of objects to add and compares these objects to objects that are already added and returns the
	 *	objects that should be added. This method changes what is in arrayNonDupes.
	 */
	dedupeEntries: function (hashNonDupes, arrayToAdd, keyGenFunc) {
		var toReturn = [];
		
		arrayToAdd.forEach(function (itemToAdd) {
			var key;
			if (keyGenFunc) {
				key = itemToAdd[keyGenFunc]();
			} else {
				key = itemToAdd;
			}
			if (key && !hashNonDupes[key]) {
				hashNonDupes[key] = true;
				toReturn.push(itemToAdd);
			}
		});
		
		return toReturn;
	},
	
	getSearchTermsFromContact: function (contact) {
		var name,
			familyName,
			givenName,
			toReturn = [];
			
		if (!contact || !(contact instanceof Contact)) {
			console.log("Error getSearchTermsFromContact - was called with an invalid contact object");
			return [];
		}
			
		name = contact.getName();
		
		if (name) {
			familyName = name.getFamilyName();
			givenName = name.getGivenName();
			
			if (givenName && familyName) {
				givenName = givenName.toLowerCase();
				familyName = familyName.toLowerCase();
				
				if (givenName && givenName.length > 0 && familyName) {
					//first initial + last
					toReturn.push(givenName.substring(0, 1) + familyName);
					//last + first
					toReturn.push(familyName + givenName);
				}
			}
		}
		
		return toReturn;
	},
	
	createLabelFunctions: function (arr, sortLabels) {
		Assert.requireArray(arr, "labelsConstantCreator requires an array");
		
		var labelsArray = arr,
			labelsHash = {},
			popupLabelsHash = {},
			defaultPopupLabels,
			labelItemCompare = function (a, b) {
				return a.displayValue.localeCompare(b.displayValue);
			},
			getLabelHelper = function (labelType, value) {
				if (!value) {
					return "";
				}
				var item = labelsHash[value];
				if (item) {
					return item[labelType] || ""; // returning a copy of the primitive type
				} else {
					return "";
				}
			};
		
		if (sortLabels) {
			labelsArray.sort(labelItemCompare);
		}
		
		defaultPopupLabels = (function () {
			var popupLabels = [], i, item, popupLabelItem;
			
			for (i = 0; i < labelsArray.length; i = i + 1) {
				item = labelsArray[i];
				labelsHash[item.value] = {
					label: item.displayValue,
					shortLabel: item.shortDisplayValue
				};
				
				
				if (item.isPopupLabel) {
					popupLabelItem = {
						value: item.value,
						label: item.displayValue,
						shortLabel: item.shortDisplayValue,
						command: item.value
					};
					popupLabelsHash[item.value] = popupLabelItem;
					popupLabels.push(popupLabelItem);
				}
			}
			return popupLabels;
		}());
		
		return { // Return copies of everything to protect constants
			getLabel: function (value) {
				return getLabelHelper("label", value);
			},
			getShortLabel: function (value) {
				return getLabelHelper("shortLabel", value);
			},
			getPopupLabels: function (labels) {
				if (!labels) {
					return defaultPopupLabels;
				}
				if (!_.isArray(labels)) {
					console.warn("Error: getPopupLabels requires an array param");
					return [];
				}
				var popupLabels = [], i, item;
				for (i = 0; i < labels.length; i = i + 1) {
					item = popupLabelsHash[labels[i]];
					if (item) {
						popupLabels.push(_.clone(item));
					} else {
						console.warn("Error: getPopupLabels: label not found: " + labels[i]);
					}
				}
				
				return popupLabels;
			}
		};
	},
	
	DBResultHelper: function (result) {
		if (result && result.results) {
			return result.results;
		}
		return result;
	},
	
	getContactsCapabilityProvider: function (account) {
		return _.detect(account.capabilityProviders, function (capabilityProvider) {
			return capabilityProvider.capability === "CONTACTS";
		});
	},
	
	
	/**
	  * Take the data passed in and map reduce it. And return if all of their processes return true
	  * @param {array} array - the array must contain an array of objects with the object and the function to call in each map function
	  *                        [{function: function, object: object, parameters:[parameters]}] if an object is specified then the function 
	  *                        will be called on that object. Otherwise the function will be called by itself.
	  *
	  * @returns {Future.result = boolean} - true on success of all
	  */
	mapReduceAndVerifyResultsTrue: function (dataToMapReduce, propertyToCheck) {
		var failedTest = false,
			reduceFuture;
		
		return Utils._mapReduceUsingThisReduceFunction(dataToMapReduce, function (result, mapReduceFuture) {
			var i;
			
			if (_.isArray(result)) {
				for (i = 0; i < result.length; i += 1) {
					if (!result[i].result) {
						console.log("A function passed to Utils.mapReduceAndVerifyResultsTrue failed");
						failedTest = true;
						break;
					}
				}
			} else {
				Assert.require(propertyToCheck && typeof(propertyToCheck) === "string", "When using a map function that only returns a single result you must specify a propertyToCheck");
				if (!result[propertyToCheck]) {
					failedTest = true;
				}
			}

			reduceFuture = new Future();
			if (failedTest) {
				reduceFuture.result = false;
			} else {
				reduceFuture.result = true;
			}

			return reduceFuture;
		});
	},
	
	/**
	  * Take the data passed in and map reduce it. And return the results of the maps in an array
	  * @param {array} array - the array must contain an array of objects with the object and the function to call in each map function
	  *                        [{function: function, object: object, parameters:[parameters]}] if an object is specified then the function 
	  *                        will be called on that object. Otherwise the function will be called by itself.
	  *
	  * @returns {Future.result = [results]} - true on success of all
	  */
	mapReduceAndReturnResults: function (dataToMapReduce) {
		var failedTest = false,
			reduceFuture,
			results = [];
		
		return Utils._mapReduceUsingThisReduceFunction(dataToMapReduce, function (result, mapReduceFuture) {
			var i;
			for (i = 0; i < result.length; i += 1) {
				results.push(result[i].result); 
			}

			reduceFuture = new Future();
			reduceFuture.result = results;
			
			return reduceFuture;
		});
	},
	
	_mapReduceUsingThisReduceFunction: function (dataToMapReduce, reduceFunction) {
		var failedTest = false,
			reduceFuture;
		
		return Foundations.Control.mapReduce({
			map: function (data) {
				var fn = data["function"];
				Assert.require(fn && _.isFunction(fn), "_mapReduceUsingThisReduceFunction requires a 'function' params");
				if (data.object) {
					return fn.apply(data.object, data.parameters ? data.parameters : []);
				} else {
					return fn();
				}
			},
			reduce: reduceFunction
			
		}, dataToMapReduce);
	},
	
	/*
		Utility function to extend an object with listener/broadcaster functionality.
		It adds four methods to the given object:
			addListener(func) -- adds the given function to the list of listeners.
			removeListener(func) -- removes the given function from the list of listeners.
			countListeners(func) -- Returns number of listeners added to this object.
			broadcast(...) -- Calls all listener functions with the given arguments.
		
		Shamelessly stolen from the Mail app.
	*/
	mixInBroadcaster: function (obj) {
		var listeners = [];
		
		Assert.require(!obj.addListener && !obj.removeListener && !obj.broadcast && !obj.countListeners, "mixInBroadcaster: obj already has these methods defined!");
		
		obj.addListener = function (callback) {
			if (callback) {
				listeners.push(callback);
			}
		};
		
		obj.removeListener = function (callback) {
			var i = listeners.indexOf(callback);
			if (i !== -1) {
				listeners.splice(i, 1);
			} else {
				console.error("removeListener: Cannot find callback to remove.");
			}
		};
		
		obj.countListeners = function () {
			return listeners.length;
		};
		
		obj.broadcast = function () {
			// Call all listeners with whatever arguments we were passed.
			_.invoke(listeners, "apply", undefined, arguments);
		};
		
		return obj;
	},
	
	/*
		Applies a mapping function to all objects matching the given mojodb query.
		mapFunc will be called with each object and must return a future.
		Add a limit to the query if it's necessary to process <500 at a time.
		Returns a future.
		
		Shamelessly stolen from the Mail app and adapted to be asynchronous.
	*/
	dbMap: function dbMap(query, mapFunc) {
		var future = DB.find(query),
			next;
		
		future.then(function () {
			next = future.result.next;
			
			future.nest(Foundations.Control.mapReduce({
				map: mapFunc
			}, future.result.results));
		});
		
		future.then(this, function () {
			if (next) {
				query.page = next;
				future.nest(dbMap(query, mapFunc));
			} else {
				future.result = true;
			}
		});
		
		return future;
	},
	
	/**
	  * Given one or two arrays of object names, iterate over them and get the objects and call the function name passed in as a parameter on them
	  * @param {function} accessorFunction - function to use to get the properties that are specified in propertyObjectNames and propertyArrayNames.
	  * @param {array} propertyObjectNames - an array of property names to fetch using the accessorFunction
	  * @param {string} objectFunctionName - the name of the function to call on each of the objects name in propertyObjectNames
	  * @param {array} propertyArrayNames - an array of property names to fetch using the accessorFunction
	  * @param {string} arrayFunctionName - the name of the function to call on each of the objects named in propertyArrayNames
	  *
	  * @returns {boolean} - An or-ed summary of all the return values from calling the functions on each object
	  */
	callFunctionsOnProperties: function (accessorFunction, propertyObjectNames, objectFunctionName, propertyArrayNames, arrayFunctionName) {
		var toReturn = false;
		
		Assert.requireFunction(accessorFunction, "callFunctionsOnAllProperties - You must specify an accessor function");
		
		if (propertyObjectNames && _.isArray(propertyObjectNames)) {
			Assert.require(objectFunctionName, "callFunctionsOnAllProperties - You must define a function name to be called on each object");
			
			propertyObjectNames.forEach(function (currentPropertyName) {
				toReturn = toReturn || accessorFunction(currentPropertyName)[objectFunctionName]();
			});
		}
		
		if (propertyArrayNames && _.isArray(propertyArrayNames)) {
			Assert.require(arrayFunctionName, "callFunctionsOnAllProperties - You must define a function name to be called on each array object");
			
			propertyArrayNames.forEach(function (currentPropertyName) {
				toReturn = toReturn || accessorFunction(currentPropertyName)[arrayFunctionName]();
			});
		}
		
		return toReturn;
	}
};


//@ sourceURL=contacts/Utilities/ArrayUtil.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global */

var ArrayUtil = {
	pushAll: function (dst, src) {
		var i;
		for (i = 0; i < src.length; i += 1) {
			dst.push(src[i]);
		}
		return dst;
	},

	// Remove the first occurance of toRemove from
	// the src array.
	removeValue: function (src, toRemove) {
		var i,
			found = false;
		for (i = 0; i < src.length; i += 1) {
			if (src[i] === toRemove) {
				src.splice(i, 1);
				found = true;
				return found;
			}
		}
	
		return found;
	},

	copyOfArray: function (src) {
		var toReturn = [],
			i;
	
		if (src) {
	
			for (i = 0; i < src.length; i += 1) {
				toReturn[i] = src[i];
			}
		}
	
		return toReturn;
	}
};


//@ sourceURL=contacts/PropertyArray.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global console, Class, Assert, _, JSON*/
/** @scope _global_ */
var PropertyArray = Class.create({	
	/** @lends PropertyArray# */
	
	/**
	 * This object acts as a simple wrapper around an array that limits how elements can be inserted/removed
	 * @constructs
	 * @param {Object} propertyClass -	A reference to the class object that this array will contain instances of.
	 *									This is a class like PhoneNumber.  This is needed to construct decorated objects from raw objects
	 * @param {Object} obj - This can be:<br>
	 *		1. a raw object									ex: {"value":"5555555555", "type":"mobile", "primary": false}<br>
	 *		2. a decorated object of type <propertyClass>	ex: PhoneNumber<br>
	 *		3. an array of raw objects<br>
	 *		4. an array of decorated objects of type <propertyClass><br>
	 *		5. an array of raw and decorated objects of type <propertyClass><br>
	 * @example
	 * var phoneNumbers = new PropertyArray(PhoneNumber, {});	// constructs an empty PropertyArray
	 * phoneNumbers.add({value: "5555555555", type: "type_mobile", primary: false});
	 * phoneNumbers.add(new PhoneNumber({value: "6666666666", type: "type_mobile", primary: false}));
	 * phoneNumbers.add([new PhoneNumber({...}), new PhoneNumber({...}), {value: "5555555555", type: "type_mobile", primary: false}]);
	 * 
	 * var decoratedPhoneNumberArray = phoneNumbers.getArray();
	 * var firstNumber = decoratedPhoneNumberArray[0].getValue();
	 */
	initialize: function (propertyClass, obj) {
		Assert.requireFunction(propertyClass, "PropertyArray requires a propertyClass to be constructed");
		this._propertyClass = propertyClass;
		this._isDirty = false;
		// this is an array of contact point objects
		this._propertyClassArray = [];
		if (obj) {
			this.add(obj, true);
		}
	},
	
	/**
	 * Clear all elements out of the PropertyArray and add the passed in object(s)
	 * @param {Object} obj - This can be:<br>
	 *		1. a raw object									ex: {"value":"5555555555", "type":"mobile", "primary": false}<br>
	 *		2. a decorated object of type <propertyClass>	ex: PhoneNumber<br>
	 *		3. an array of raw objects<br>
	 *		4. an array of decorated objects of type <propertyClass><br>
	 *		5. an array of raw and decorated objects of type <propertyClass><br>
	 */
	set: function (obj) {
		this._propertyClassArray = [];
		this.add(obj);
	},
	
	/**
	 * Add an object or an array of objects to the PropertyArray
	 * @param {Object} obj - This can be:<br>
	 *		1. a raw object									ex: {"value":"5555555555", "type":"mobile", "primary": false}<br>
	 *		2. a decorated object of type <propertyClass>	ex: PhoneNumber<br>
	 *		3. an array of raw objects<br>
	 *		4. an array of decorated objects of type <propertyClass><br>
	 *		5. an array of raw and decorated objects of type <propertyClass><br>
	 */
	add: function (obj, preventDirty) {
		Assert.requireDefined(obj, "add obj is not defined");
		if (obj instanceof PropertyArray) {
			obj = obj.getArray();
		}
		
		if (_.isArray(obj)) {
			for (var i = 0; i < obj.length; i = i + 1) {
				this._addHelper(obj[i]);
			}
		} else {
			this._addHelper(obj);
		}
		
		if (preventDirty !== true) {
			this._isDirty = true;
		}
	},
	
	/**
	 * @private
	 * @param {Object} obj
	 */
	_addHelper: function (obj) {
		if (obj instanceof this._propertyClass) {
			// make sure the same contact point object has not been added more than once
			if (_.indexOf(this._propertyClassArray, obj) < 0) {
				this._propertyClassArray.push(obj);
			} else {
				console.log("Item already exists! Aborting add.");
			}
		} else {
			this._propertyClassArray.push(new this._propertyClass(obj));
		}
	},
	
//	remove: function (obj) {
//		Assert.requireClass(obj, this._propertyClass, "Cannot remove object.  Incorrect contact point class.");
//		var index = _.indexOf(this._propertyClassArray, obj),
//			foundNumber = (index > -1);
//		if (foundNumber) {
//			this._propertyClassArray.splice(index, 1);
//		}
//		return foundNumber;
//	},

	/**
	 * Remove an object from the PropertyArray.  
	 * @param {Object} obj - The decorated object of type <propertyClass> that should be removed.  This does
	 * not have to be the same object instance, but it must contact exactly the same data.  This can also be a 
	 * primitive type if the <propertyClass> provides support for this in it's equals() method
	 * @returns {boolean}
	 */
	remove: function (obj) {
		Assert.requireDefined(obj, "remove requires an object to be passed in");

		var i,
			item;
		
		for (i = 0; i < this._propertyClassArray.length; i = i + 1) {
			item = this._propertyClassArray[i];
			if (item.equals(obj)) {
				this._propertyClassArray.splice(i, 1);
				this._isDirty = true;
				return true;
			}
		}
		return false;
	},
	
	/**
	 * Check if an object exists in the PropertyArray.  
	 * @param {Object} obj - The decorated object of type <propertyClass> to check if it exists.  This must
	 * be the same object instance.
	 * @returns {boolean}
	 */
	contains: function (obj) {
		Assert.requireDefined(obj, "remove requires an object to be passed in");
		Assert.require(obj instanceof this._propertyClass, "does not contain objects of this type");
		
		var i,
			item;
		
		for (i = 0; i < this._propertyClassArray.length; i = i + 1) {
			item = this._propertyClassArray[i];
			//console.log(item + " === " + obj + "*&*&*&* - " + item === obj);
			if (item === obj) {
				return true;
			}
		}
		
		return false;
	},

	// return a shallow copy of the array
	/**
	 * Returns a shallow copy of the array that PropertyArray wraps.  This returns a copy
	 * to prevent bad data from being inserted into the array that PropertyArray wraps.  The
	 * elements in the returned array are references to the real objects.
	 * @returns {Array}
	 */
	getArray: function () {
		return _.clone(this._propertyClassArray);
	},
	
	/**
	 * @returns {boolean} Indicates of there are any dirty objects in the array
	 */
	containsDirtyEntry: function () {
		return this._isDirty || this._propertyClassArray.some(function (currentObject) {
			return currentObject.isDirty();
		});
	},
	
	/**
	 * Iterates through all elements in array and marks them as not dirty
	 */
	markElementsNotDirty: function () {
		this.markArrayNotDirty();
		this._propertyClassArray.forEach(function (currentObject) {
			currentObject.markNotDirty();
		});
	},
	
	markArrayNotDirty: function () {
		this._isDirty = false;
	},
	
	/**
	 * Clears out all of the elements
	 */
	clear: function () {
		this._propertyClassArray = [];
		this._isDirty = true;
	},
	
	/**
	 * @returns {integer} The number of elements currently stored in the PropertyArray
	 */
	getLength: function () {
		return this._propertyClassArray.length;
	},
	
	/**
	 * Returns the class object that the PropertyArray was instianted for
	 * @returns {Object} propertyClass
	 */
	getClass: function () {
		return this._propertyClass;
	},
	
	/**
	 * Creates an array of raw objects by calling getDBObject() on all decorated objects that are in
	 * the PropertyArray
	 * @returns {Array} An array of raw objects
	 */
	getDBObject: function () {
		var db = [],
			i;
		for (i = 0; i < this._propertyClassArray.length; i = i + 1) {
			db.push(this._propertyClassArray[i].getDBObject());
		}
		return db;
	},

	/**
	 * Dumps the result of getDBObject as a readable string.  This is for testing only.
	 * @returns {string}
	 */
	toString: function () {
		return JSON.stringify(this.getDBObject());
	}
});


//@ sourceURL=contacts/properties/PropertyBase.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global console, _, Class, Assert, JSON, Utils*/

// If the config is ever changed to store data farther down than the "data" property, we need to fix the __CLASS_CONFIG
// that is set in this file.  Currently it creates a shallow copy of the config data for testing purposes.  This would be
// bad if we started passing references

/**
 * @class PropertyBase
 * @description This class defines a wrapped property.  A new property type can be created by instantiating
 * this class with a config object.  This object indiciates what fields will be available and any methods that must
 * be called whenever a value is set/fetched. Each value has a property that is exposed via defineGetter/defineSetter.  These properties
 * are intended to be used with widgets. All code should use the getter/setter method instead of using the property.
 * 
 * @example
 * If any subclass needs to modify the result of getDBObject(), they can implement
 * _extendedGetDBObject() which will give the subclass a shot at modifying the 
 * data before it is returned
 * 
 * 
 * var NewPropertyType = new PropertyBase({
 * superClass: {Function}               [optional]
 * data: [
 *    { 
 *        dbFieldName: "value",         [Required for multi-field properties]
 *                                      This name must match the DB field name exactly.  This will be used when we save.
 *                                      If the property only contains one field, this can be left blank and the primitive
 *                                      type will be returned instead of an object
 *
 *        defaultValue: null,           [Optional] A default value for the property
 *
 *        propertyName: "x_value",      [Optional] The name of the property that will be available in widgets & templates.
 *                                      If not specified, this will default to x_<dbFieldName>
 *
 *        classObject: Address,         [Optional] If the field is a subclass object of PropertyBase.  The specified class will be instianted 
 *
 *        setterName: "setValue",       [Optional] This is the name of the setter/getter functions that will be created for 
 *        getterName: "getValue",       this property.  These only need to be set if you plan to access the property
 *                                      in code.  The widget & template property will still be accessable
 *
 *        beforeSet: function(value) {  [Optional] beforeSet/beforeGet are optional functions that will be called before the
 *            return value;             associated getter/setter is complete.  This allows you to munge/validate data
 *        },                            before it is set or returned.
 *        beforeGet: function(){},
 *                                      "this" will be properly bound to the class for you.  Passing in a bare function is fine.
 *                                      Don't forget to return a value if you implement beforeSet
 *    }
 *	]
 *});
 *
 * var newPropertyInstance = new NewPropertyType();
 */

var PropertyBase = Class.create({});

PropertyBase.create = function (config) {
	Assert.requireDefined(config, "PropertyBase: config is undefined");
	Assert.require((config.data && config.data.length), "PropertyBase requires at least one field to be specified");

	var _PropertyBase,
		_PropertyBaseMethods,
		_configData = config.data,
		_superClass = config.superClass || PropertyBase,	// Default to PropertyBase so all classes will work with instanceof
		_configDataHash = {},
//		_complexFields = [],			// complex fields have a beforeSet method defined or the field is an object that needs to be
										// instianted on INIT (must be a subclass of PropertyBase)
		_isPrimitiveType = false,
		_CONST = {
			DYNAMIC_SETTER_PREFIX: "fn_set_",
			DYNAMIC_GETTER_PREFIX: "fn_get_",
			DYNAMIC_PROPERTY_PREFIX: "x_",
			PRIMITIVE_TYPE_FIELD_NAME: "value",
			ACCESSOR_SET: "set",
			ACCESSOR_GET: "get"
		};
		
	function _initPropertyBase() {
		var i,
			field;
		
		// This property is a primitive type if there is only one field 
		// and dbFieldName is not set
		if (_configData.length === 1 && !_configData[0].dbFieldName) {
			_isPrimitiveType = true;
			// set a default dbFieldName so dynamic getters/setters can be created
			_configData[0].dbFieldName = _CONST.PRIMITIVE_TYPE_FIELD_NAME;
		}
		
		// Set defaults for setter/getter/property names
		// build a hash based on the property name for fast access when setters/getters are called later
		for (i = 0; i < _configData.length; i = i + 1) {
			field = _configData[i];
			Assert.require(field.dbFieldName, "PropertyBase: field is missing required dbFieldName param");
			
			// populate hash with the field name as the key
			_configDataHash[field.dbFieldName] = field;
			
			if (field.classObject && !_.isFunction(field.classObject)) {
				throw new Error("classObject must be a function");
			}
			
//			if ((field.classObject && _.isFunction(field.classObject)) || (field.beforeSet && _.isFunction(field.beforeSet))) {
//				_complexFields.push(field);
//			}
			
			// set defaults if not already defined
			if (!field.setterName) {
				field.setterName = _CONST.DYNAMIC_SETTER_PREFIX + field.dbFieldName;
			}
			
			if (!field.getterName) {
				field.getterName = _CONST.DYNAMIC_GETTER_PREFIX + field.dbFieldName;
			}
			
			if (!field.propertyName) {
				field.propertyName = _CONST.DYNAMIC_PROPERTY_PREFIX + field.dbFieldName;
			}
			
		}
	}
	
	// Create dynamic setters/getters for properties that will be used in widgets/templates
	// These properties will redirect the get/set to the appropriate getter/setter function
	// that we have defined above.
	
	// "this" will be the class instance in each getter/setter
	// @param - ClassObj - this will be _PropertyBase
	function _createGettersSettersProperties(ClassObj) {
		var i,
			j, 
			field,
			item, 
			propertyName,
			setterFunction = function (setterFunctionName, value, inInit) {
				var fn = this[setterFunctionName];
				Assert.requireFunction(fn, "Dynamic setter function does not exist: " + setterFunctionName);
				fn.call(this, value, inInit);
			},
			getterFunction = function (getterFunctionName) {
				var fn = this[getterFunctionName];
				Assert.requireFunction(fn, "Dynamic getter function does not exist: " + getterFunctionName);
				return fn.apply(this);
			},
			// wrap this because this.privateAccessor will only be accessible when there is
			// an instance of this object.
			accessorWrapper = function (type, fieldName, subObj, value, inInit) {
				var i,
					fetchedValue,
					accessor,
					configDataHash;

				// protect against setting a bad value on fields that are sub objects
				if (subObj && type === _CONST.ACCESSOR_SET && (typeof value !== "object" || typeof value === "object" && !(value instanceof subObj))) {
					throw new Error("Calling setter of sub object: " + fieldName + " with a value that is the incorrect type");
				}
				
				// multiple accessors will exist if there is a superclass
				// iterate backwards to start with the lowest subclass
				for (i = this.privateAccessors.length - 1; i >= 0 ; i -= 1) {
					accessor = this.privateAccessors[i].accessor;
					configDataHash = this.privateAccessors[i].configDataHash;
					
					// make sure this field exists before trying to get/set via the accessor
					// don't bother checking parent classes
					// since the subclasses override
					if (configDataHash[fieldName]) {
						return accessor(type, fieldName, value, inInit);
					}
				}
				
				return;
			};
		
		
		for (i = 0; i < _configData.length; i = i + 1) {
			field = _configData[i];
			item = {};
			
			///////////////////////////////////////////////////////
			// Add class configuration data for fields to a 
			// static property this will be used in our unit tests
			//
			// TODO: might be a good idea to only do this when a 
			// global "TESTING" flag is set
			///////////////////////////////////////////////////////
			for (j in field) {
				if (field.hasOwnProperty(j)) {
					//if (!_.isFunction(field[j])) {
					item[j] = field[j];
					//}
				}
			}
			ClassObj.__CLASS_CONFIG.push(item);
			///////////////////////////////////////////////////////
			
			ClassObj.prototype[field.setterName] = Utils.curry(accessorWrapper, _CONST.ACCESSOR_SET, field.dbFieldName, field.classObject);
			ClassObj.prototype[field.getterName] = Utils.curry(accessorWrapper, _CONST.ACCESSOR_GET, field.dbFieldName, field.classObject, undefined);
	
			// propertyName is optional.  If not specified, set a name based on the dbFieldName
			ClassObj.prototype.__defineSetter__(field.propertyName, Utils.curry(setterFunction, field.setterName));
			ClassObj.prototype.__defineGetter__(field.propertyName, Utils.curry(getterFunction, field.getterName));
		}
	}
	
	// Private accessor
	// PERF -	implementing a beforeGet/beforeSet method can be expensive. Especially in
	//			the case where beforeSet is creating an object such as another ProperyBase
	//
	// This originally did not have a type param.  We determined if it was a get/set
	// based on the presence of a value.  This was changed because if someone passes undefined
	// to a setter, this would be interpreted as a getter. Explicitly passing a type will avoid
	// this problem showing up in poorly written/tested code
	function _accessor(data, type, fieldName, value, initializingData) {
		var field = _configDataHash[fieldName];
		Assert.require(type, "Accessor type not found");
		Assert.require(field, "Accessor [" + type + "] field not found: " + fieldName);
		
		if (type === _CONST.ACCESSOR_SET) {
			//console.log("accessor - setter [" + field.dbFieldName + "]: " + value);
			//console.log("initializingData " + initializingData);
			
			if (!initializingData) {
				this._isDirty = true;
			}
			
			if (field.beforeSet && _.isFunction(field.beforeSet)) {
				data[field.dbFieldName] = field.beforeSet.apply(this, [value]);
			} else {
				data[field.dbFieldName] = value;
			}
			return true;
		} else {
			//console.log("accessor - getter [" + field.dbFieldName + "]: " + data[field.dbFieldName]);
			if (field.beforeGet && _.isFunction(field.beforeGet)) {
				return field.beforeGet.apply(this, [data[field.dbFieldName]]);
			} else {
				return data[field.dbFieldName];
			}
		}
	}
	
	// called on object instiantiation.  This pulls out properties and calles their corresponding
	// setter.  This will set up the internal _data object.  We are calling the setter rather than
	// just setting a property directly so we can guarantee that no property will ever be set without
	// first going to through a setter if it has been specified.
	function _initFields(scope, obj, isFromDB) {
		var i, 
			field,
			initValue;
		
		for (i = 0; i < _configData.length; i = i + 1) {
			field = _configData[i];
			initValue = undefined;
			if (obj) {
				if (typeof obj !== "object") {
					Assert.require(_isPrimitiveType, "PropertyBase - Sanity check failed: argument passed is not an object and there is more than one field: " + 
						"field name: " + field.dbFieldName + 
						" OBJ: " + JSON.stringify(obj) + 
						" isPrimitiveType: " + _isPrimitiveType + 
						" config length: " + _configData.length);
					
					initValue = obj;
				} else if (undefined !== obj[field.dbFieldName]) {
					initValue = obj[field.dbFieldName];
				}
			}
			
			// only setting the default when no raw object has been passed
			// We should only do this on new objects.  We don't want to start setting defaults
			// on an object that came down from a sync source because we will send that change back up
			//
			// Do not set a default value if this object is being constructed from a DB object
			//
			// The caller needs to have an undefined check
			if (!isFromDB && undefined === initValue && undefined !== field.defaultValue) {
				initValue = field.defaultValue;
			}
			
			if (field.classObject) {
				initValue = new field.classObject(initValue);
			}
			
			if (undefined !== initValue) {
				scope[field.setterName].apply(scope, [initValue, true]);
			}
		}
	}
	
	// This method makes the assumption that the passed in "obj" is perfect.  We will not
	// validate any of the fields on obj.  This should really only be used when obj is coming
	// directly from the DB
	//
	// TODO:	this needs more investigation.  Contact.addContactDataFromPerson() will try to create normal properties from extended property data
	//			4/16/2010 - this probably cannot be used anymore since we have implemented inheritance
//	function _lazyInitFields(scope, obj) {
//		var i,
//			field,
//			value,
//			initObj;
//			
//		// FIXME: need to figure out what to do with defaults
//			
//		// call the setter for any complex fields.  If a classObject has been specified,
//		// then pass an instance of that class to the setter method
//		
//		for (i = 0; i < _complexFields.length; i += 1) {
//			field = _complexFields[i];
//			if (field.classObject) {
//				if (obj && typeof obj === "object") {
//					initObj = obj[field.dbFieldName];
//				}
//				value = new field.classObject(initObj);
//			} else {
//				value = obj[field.dbFieldName];
//			}
//			scope[field.setterName].apply(scope, [value]);
//		}
//	}
		
	// Parse all class configuration data. This will only happen once when we create the class object. 
	// Not on each class instance.
	_initPropertyBase();
	
	
	/**@lends PropertyBase.prototype*/
	// This is the new class that will be returned.	
	_PropertyBase = Class.create(_superClass, {
		/**@private*/
		// isFromDB: if this property is being constructed from a database object.
		//           If it is, then we should not set any default values.
		//           Only new properties should have defaults set.
		
		// this will get initialized for every new instance of _PropertyBase
		_isDirty: false,
		
		initialize: function initialize(obj, isFromDB) {
			if (obj && obj instanceof PropertyBase) {
				obj = obj.getDBObject();
			}
			
			this._origData = obj || {};
			
			// The private accessor is stored in an array to allow for multiple accessors to be added
			// when PropertyBase objects are inherited
			this.privateAccessors = this.privateAccessors || [];			// this is an array because of inheritance.  Each parent/child class
																			// will store their private accessor function in here with the raw _data
																			// being part of the functions closure
			
			this._dbObjects = this._dbObjects || [];						// stores the raw DB objects that are hidden by PropertyBase
																			// this is dangerous because it exposes the raw object.  Consumers
																			// of PropertyBase should never use this.  Consider using a seal/unseal
																			// mechanism to lock this functionality to avoid bugs
			
			if (_superClass) {
				this.$super(initialize)(obj, isFromDB);
			}
			
			var _data = {};						// this is a representation of the DB data. We will save this object directly
			
			if (obj && obj._id) {
				_data._id = obj._id;
			}
			
			// Create a closure for the accessor + our private _data
			// This method is public, but the _data is still hidden
			this.privateAccessors.push({
				accessor: _.bind(_accessor, this, _data),
				configDataHash: _configDataHash
			});
			
			_initFields(this, obj, isFromDB);
			
			this._dbObjects.push(_data);
		},
		
		// Public
		/**
		 * Return the raw db object representation of this decorated object
		 * @function
		 */
		getDBObject: function getDBObject() {
			var retVal,
				i,
				subObj;
			
			// a primitive type will not have a superclass
			if (_isPrimitiveType && this._dbObjects.length === 1) {
				retVal = this._dbObjects[0][_CONST.PRIMITIVE_TYPE_FIELD_NAME]; //_data[_CONST.PRIMITIVE_TYPE_FIELD_NAME];
			} else {
				retVal = {};
				for (i = 0; i < this._dbObjects.length; i += 1) {
					_.extend(retVal, _.clone(this._dbObjects[i]));
				}
				
				// if any of the properties are PropertyBase objects, call getDBObject on them
				for (i in retVal) {
					if (retVal.hasOwnProperty(i)) {
						subObj = retVal[i];
						if (subObj instanceof PropertyBase) {
							subObj = _.clone(subObj.getDBObject());
						}
					}
				}
				retVal = _.extend(this._origData, retVal);
			}

			// if a _extendedGetDBObject function has been implemented by a subclass,
			// pass the dbObject to it so it can take a shot at the data before it is returned
			if (this._extendedGetDBObject) {
				return this._extendedGetDBObject.apply(this, [retVal]);
			}
			return retVal;
		},
		
		//Resets each field to the default value or the value passed in obj.  Warning: this will 
		//strip any fields not listed in the data array for this type, notably MojoDB ids.
		//Use with caution.
		reinitialize: function (obj, isFromDB) {
			_initFields(this, obj, isFromDB);
			this.forceMarkDirty();
		},
		
		// Sets the data of this object to the default values specified in the config
		clear: function () {
			_initFields(this, undefined);
		},
		
		isDirty: function () {
			return this._isDirty;
		},
		
		markNotDirty: function () {
			this._isDirty = false;
		},
		
		forceMarkDirty: function () {
			this._isDirty = true;
		},

		// This function assumes that all values on this object are either a primitive type or
		// PropertyBase objects.
		_equals: function (otherObject) {
			var thisValue,
				otherValue,
				i,
				field;
			
			try {
				for (i = 0; i < _configData.length; i = i + 1) {
					field = _configData[i];
					thisValue = this[field.getterName]();
					otherValue = otherObject[field.getterName]();
					
					if (thisValue && otherValue) {
						if (thisValue instanceof PropertyBase && otherValue instanceof PropertyBase) {
							if (!thisValue.equals(otherValue)) {
								return false;
							}
						} else if (thisValue !== otherValue) {
							return false;
						}
					}
				}
			} catch (e) {
				console.log(e.message);
				return false;
			}

			return true;
			
		},
		
		equals: function (otherObject) {
			return this._equals(otherObject);
		},
		
		// testing - public accessor using public this.data... we would discourage use by marking it private "@private"
//		publicAccessor: function(fieldName, value) {
//			var data = this.data;
//			var field = _configDataHash[fieldName];
//			Assert.require(field, "Accessor field not found: " + fieldName);
//			// if no value is defined then this is a get request
//			if(undefined == value) {
//				return _get(data, field, value);
//			} else { // have a value, this is a set request
//				_set(data, field, value);
//			}
//		},
		
		toString: function () {
			return JSON.stringify(this.getDBObject());
		}
	});

	// Make a shallow COPY of the class config properties for testing purposes
	// A direct reference to this would be very evil
	_PropertyBase.__CLASS_CONFIG = [];

	// For testing
	_PropertyBase.isPrimitiveType = function () {
		return _isPrimitiveType;
	};
	
	// Add getters/setters/properties to _PropertyBase.prototype after _PropertyBase has been declared
	_createGettersSettersProperties.apply(this, [_PropertyBase]);

	// return the new class
	return _PropertyBase;
};


//@ sourceURL=contacts/properties/AccountId.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, exports, console */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 *							
 * var accountId = new AccountId("4rJ5");
 * 
 * var accountIdValue = accountId.getValue();
 * var accountIdValueAgain = accountId.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var AccountId = exports.AccountId = PropertyBase.create({
	/**
	* @lends AccountId#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name AccountId#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name AccountId#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

//@ sourceURL=contacts/properties/Account.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var account = new Account({
 *	domain: "gmail",
 *	userName: "austinPowers",
 *	userid: "12345"
 * });
 * 
 * var accountDomain = account.getDomain();
 * var accountDomainAgain = account.x_domain; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Account = PropertyBase.create({
	/**
	* @lends Account#
	* @property {string} x_domain
	* @property {string} x_userName
	* @property {string} x_userid
	*/
	data: [
		{
			dbFieldName: "domain",
			defaultValue: "",
			/**
			* @name Account#setDomain
			* @function
			* @param {string} domain
			*/
			setterName: "setDomain", 
			/**
			* @name Account#getDomain
			* @function
			* @returns {string}
			*/
			getterName: "getDomain"
		},
		{
			dbFieldName: "userName",
			defaultValue: "",
			/**
			* @name Account#setUserName
			* @function
			* @param {string} userName
			*/
			setterName: "setUserName",
			/**
			* @name Account#getUserName
			* @function
			* @returns {string}
			*/
			getterName: "getUserName"
		},
		{
			dbFieldName: "userid",
			defaultValue: "",
			/**
			* @name Account#setUserId
			* @function
			* @param {string} userid
			*/
			setterName: "setUserId",
			/**
			* @name Account#getUserId
			* @function
			* @returns {string}
			*/
			getterName: "getUserId"
		}
	]
});

//@ sourceURL=contacts/properties/Address.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, PropertyBase, Utils, RB, Globalization */

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var address = new Address({
 *	streetAddress: "950 W Maude Ave",
 *	locality: "Sunnyvale",
 *	postalCode: "94085",
 *	region: "CA",
 *	country: "USA"
 * });
 * 
 * var addressStreet = address.getStreetAddress();
 * var addressStreetAgain = address.x_streetAddress; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Address = exports.Address = PropertyBase.create({
	/**
	* @lends Address#
	* @property {string} x_streetAddress
	* @property {string} x_locality
	* @property {string} x_postalCode
	* @property {string} x_region
	* @property {string} x_country
	* @property {string} x_value
	* @property {string} x_type
	* @property {string} x_primary
	*/
	data: [
		{
			dbFieldName: "streetAddress",
			defaultValue: "",
			/**
			* @name Address#setStreetAddress
			* @function
			* @param {string} streetAddress
			*/
			setterName: "setStreetAddress",
			/**
			* @name Address#getStreetAddress
			* @function
			* @returns {string}
			*/
			getterName: "getStreetAddress"
		}, {
			dbFieldName: "locality",
			defaultValue: "",
			/**
			* @name Address#setLocality
			* @function
			* @param {string} locality
			*/
			setterName: "setLocality",
			/**
			* @name Address#getLocality
			* @function
			* @returns {string}
			*/
			getterName: "getLocality"
		}, {
			dbFieldName: "postalCode",
			defaultValue: "",
			/**
			* @name Address#setPostalCode
			* @function
			* @param {string} postalCode
			*/
			setterName: "setPostalCode",
			/**
			* @name Address#getPostalCode
			* @function
			* @returns {string}
			*/
			getterName: "getPostalCode"
		}, {
			dbFieldName: "region",
			defaultValue: "",
			/**
			* @name Address#setRegion
			* @function
			* @param {string} region
			*/
			setterName: "setRegion",
			/**
			* @name Address#getRegion
			* @function
			* @returns {string}
			*/
			getterName: "getRegion"
		}, {
			dbFieldName: "country",
			defaultValue: "", 
			/**
			* @name Address#setCountry
			* @function
			* @param {string} country
			*/
			setterName: "setCountry",
			/**
			* @name Address#getCountry
			* @function
			* @returns {string}
			*/
			getterName: "getCountry"
		}, {
			dbFieldName: "type",
			defaultValue: "type_work",
			/**
			* @name Address#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name Address#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		}, {
			dbFieldName: "primary",
			defaultValue: false,
			/**
			* @name Address#setPrimary
			* @function
			* @param {string} primary
			*/
			setterName: "setPrimary",
			/**
			* @name Address#getPrimary
			* @function
			* @returns {string}
			*/
			getterName: "getPrimary"
		}
	]
});

/** 
 * @name Address#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Address.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});

/** 
 * @name Address#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Address.prototype.__defineSetter__("x_displayValue", function (newAddressValue) {
	var parsedAddress = Globalization.Address.parseAddress(newAddressValue);
	
	this.setStreetAddress(parsedAddress.streetAddress || "");
	this.setLocality(parsedAddress.locality || "");
	this.setRegion(parsedAddress.region || "");
	this.setPostalCode(parsedAddress.postalCode || "");
	this.setCountry(parsedAddress.country || "");
});

/**
 * @returns {string}
 */
Address.prototype.getDisplayValue = function (onlyOneLine) {
	//TODO: escape html and then replace "\n" with "<br />"?
	
	var address = Globalization.Address.formatAddress(this.getDBObject());
	if (onlyOneLine) {
		//if we only want one line, then replace all newlines with spaces
		address = address.replace(/\n/g, " ");
	}
	return address;
};

Address.prototype.getStringValue = function (insertSpaces) {
	var space = (insertSpaces) ? " " : "";
	
	return this.getStreetAddress() + space + this.getLocality() + space + this.getPostalCode() + space + this.getRegion() + space + this.getCountry() + space + this.getType();
};

/**
 * @name Address#x_displayType
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayType()
 */
Address.prototype.__defineGetter__("x_displayType", function () {
	return this.getDisplayType();
});


/**
 * @returns {string}
 */
Address.prototype.getDisplayType = function () {
	return (Address.Labels.getLabel(this.getType()) || Address.Labels.getLabel(Address.TYPE.OTHER));
};

Address.prototype.getNormalizedHashKey = function () {
	var toReturn = "";
	
	toReturn += this.getStringValue();
	
	toReturn = toReturn.toUpperCase();
	
	return toReturn.replace(/\W/g, "");
};

/** 
 * @name Address#x_displayType
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayType()
 */
Address.prototype.__defineGetter__("x_displayType", function () {
	return this.getDisplayType();
});


/*
//TODO: use this somehow for the app?
ContactPointDecorator.addressFormatter = function (addr) {
	//    if (addr.hasBeenFormatted) {
	//        return addr;
	//    }
	//TODO This could be simpler and faster, see exactly what this is doing
	_.extend(addr, new Address(addr));
	addr.parseAddress(addr.freeformAddress);
	ContactPointDecorator.formatContactPoint(addr, Address.labels);
	if (!(addr.city || addr.state || addr.zipCode)) {
		addr.showMore = "none";
	}
	addr.freeformAddress = addr.getOneLine();
	addr.displayValue = addr.freeformAddress.gsub("\n", "<br />");
	addr.type = "address";
	addr.hasBeenFormatted = true;
	return addr;
};
*/



/**
 * @constant
 */
// prefixing these with "type_" to discourage direct display of these values
Address.TYPE = Utils.defineConstants({
	HOME: "type_home",
	WORK: "type_work",
	OTHER: "type_other"
});

Address.Labels = Utils.createLabelFunctions([{
	value: Address.TYPE.HOME,
	displayValue: RB.$L('Home'),
	isPopupLabel: true
}, {
	value: Address.TYPE.WORK,
	displayValue: RB.$L('Work'),
	isPopupLabel: true
}, {
	value: Address.TYPE.OTHER,
	displayValue: RB.$L('Other'),
	isPopupLabel: true
}]);


//@ sourceURL=contacts/properties/Anniversary.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var anniversary = new Anniversary("2005-10-30");
 * 
 * var anniversaryString = anniversary.getValue();
 * var anniversaryStringAgain = anniversary.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Anniversary = PropertyBase.create({
	/**
	* @lends Anniversary#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Anniversary#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Anniversary#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

//@ sourceURL=contacts/properties/Birthday.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, exports, RB, console, Mojo */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 *							year - month - day
 * var birthday = new Birthday("1984-04-04");
 * 
 * var birthdayString = birthday.getValue();
 * var birthdayStringAgain = birthday.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Birthday = exports.Birthday = PropertyBase.create({
	/**
	* @lends Birthday#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Birthday#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Birthday#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

// TODO: add methods to get the year month day and use them in the getDisplayValue and getDateObject functions

/**
 * @returns {string}
 */
Birthday.prototype.getDisplayValue = function (options) {
	var date = this.getDateObject(),
		formatObj = {};
	
	formatObj.date = "long";

	if (date) {	
		if (Mojo && Mojo.Format && Mojo.Format.formatDate) {
			
			//TODO: check to make sure the date from the string is not actually 1900
			if (date.getFullYear() === 1900) {
				formatObj.dateComponents = "dm";
			}
			
			options = options || formatObj;
		
			return Mojo.Format.formatDate(date, options);
		} else {
			return date.toLocaleDateString();
		}
	} else {
		return "";
	}
};

Birthday.prototype.getDateObject = function () {
	var value = this.getValue(),
		splitDateValue = value ? value.split("-") : [];
	
	if (splitDateValue.length > 2) {
		return new Date(splitDateValue[0], parseInt(splitDateValue[1], 10) - 1, splitDateValue[2]);
	} else if (splitDateValue.length > 1 && value.length > 6) {
		return new Date(splitDateValue[0], splitDateValue[1], -1);
	} else if (splitDateValue.length > 1 && value.length > 4) {
		return new Date(-1, parseInt(splitDateValue[0], 10) - 1, splitDateValue[1]);
	} else if (splitDateValue.length > 0) {
		return new Date(splitDateValue[0]);
	} else {
		return;
	}
};

/** 
 * @name Birthday#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Birthday.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});

// This is only here to get the birthday into the form the localDateToDate function
// expects
Birthday.translateBirthdayFromCurrentForm = function (unformatted) {
	return unformatted ? unformatted.replace(/-/gi, "") : unformatted;
	//return unformatted;
};

Birthday.parseBirthday = function (unformatted) {
	var date,
		options = {};
	
	options.date = "long";

	unformatted = Birthday.translateBirthdayFromCurrentForm(unformatted);
	date = parseInt(unformatted, 10);
	
	if (date === "NaN") {
		console.log("The birthday " + unformatted + " is not in the localdate int format");
		return Mojo.Format.formatDate(new Date(), options);
	}
	
	date = Birthday.localDateToDate(date);
	if ((date.getFullYear() === 1900) || (date.getFullYear() === 0)) {
		options.dateComponents = "dm";
	}

	return Mojo.Format.formatDate(date, options);
};

Birthday.localDateToDate = function (date) {
	var day, month, year, returnDate;
	
	if (!date) {
		return null;
	}
	// This was written assuming the format of the date is
	// yearmonthday
	// xxxxxxxx
	// easier to do this numerically
	
	// Get the last 2 digits
	day = date % 100;
	// reduce the date by 2 digits (day)
	date = Math.floor(date / 100);
	// Get the next 2 digits
	month = date % 100;
	// Put the month value into 0 - 11 form
	month = month - 1;
	// Reduce the date by 2 digits (month)
	date = Math.floor(date / 100);
	// Set the year to what is left on the date
	year = date; // possibly 0. this means it's a yearless birthday and not a birthdate
	returnDate = new Date(year, month, day);
	return returnDate;
};


//@ sourceURL=contacts/properties/ContactBackupHash.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param string obj the raw database object
 * @example
 * var contactBackupHash = new ContactBackupHash("afewuh|12312");
 * 
 * var contactBackupHashValue = contactBackupHash.getValue();
 * var contactBackupHashValueAgain = contactBackupHash.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var ContactBackupHash = PropertyBase.create({
	/**
	* @lends ContactBackupHash#
	* @property string x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: false,
			/**
			* @name Favorite#setValue
			* @function
			* @param string value
			*/
			setterName: "setValue",
			/**
			* @name Favorite#getValue
			* @function
			* @returns string
			*/
			getterName: "getValue"
		}
	]
});

/**
* @param {ContactBackupHash} value The raw {boolean} value can be passed as well.
* @returns boolean
*/
ContactBackupHash.prototype.equals = function (value) {
	if (value instanceof ContactBackupHash) {
		return this.getValue() === value.getValue();
	} else {
		return this.getValue() === value;
	}
};


//@ sourceURL=contacts/properties/ContactId.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var contactId = new ContactId("12345");
 * 
 * var contactIdString = contactId.getValue();
 * var contactIdStringAgain = contactId.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var ContactId = PropertyBase.create({
	/**
	* @lends ContactId#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name ContactId#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name ContactId#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});
/**
* @param {ContactId} value The raw {string} value can be passed as well.
* @returns {boolean}
*/
ContactId.prototype.equals = function (value) {
	if (value instanceof ContactId) {
		return this.getValue() === value.getValue();
	} else {
		return this.getValue() === value;
	}
};


//@ sourceURL=contacts/properties/DefaultPropertyHash.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, Assert, Crypto*/

/**
 * @class
 * @augments PropertyBase
 * @param string obj the raw database object
 * @example
 * var defaultPropertyHash = new DefaultPropertyHash({"value": "faw789a943fkjaf", "type": "PhoneNumber"});
 * 
 * var defaultPropertyHashValue = defaultPropertyHash.getValue();
 * var defaultPropertyHashValueAgain = defaultPropertyHash.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var DefaultPropertyHash = PropertyBase.create({
	/**
	* @lends DefaultPropertyHash#
	* @property string x_value
	*/
	data: [
		{
			dbFieldName: "value",
			defaultValue: null,
			/**
			* Only call this method when you pre-md5ied the value. If you want
			* to set the value without having to md5 it, call DefaultPropertyHash#setPlainValue
			* @name DefaultPropertyHash#setValue
			* @function
			* @param string value
			*/
			setterName: "setValue",
			/**
			* @name DefaultPropertyHash#getValue
			* @function
			* @returns string
			*/
			getterName: "getValue"
		}, {
			dbFieldName: "type",
			defaultValue: null,
			/**
			* @name DefaultPropertyHash#setType
			* @function
			* @param string type
			*/
			setterName: "setType",
			/**
			* @name DefaultPropertyHash#getType
			* @function
			* @returns string
			*/
			getterName: "getType"
		}, {
			dbFieldName: "favoriteData",
			defaultValue: null,
			
			setterName: "setFavoriteData",
			
			getterName: "getFavoriteData"
		}
	]
});

/**
* @param {DefaultPropertyHash} value
* @returns boolean
*/
DefaultPropertyHash.prototype.equals = function (value) {
	if (value instanceof DefaultPropertyHash) {
		return this.getValue() === value.getValue() && this.getType() === value.getType();
	}
	return false;
};

/**
* Sets the value of the DefaultPropertyHash. DefaultPropertyHashes have values that are md5s.
* This method allows you to set the value without having to calculate the md5 for it. You
* should always call this method and not md5 it before hand.
* @param {string} value - the value for this DefaultPropertyHash.
*/
DefaultPropertyHash.prototype.setPlainValue = function (value) {
	this.setValue(value ? Crypto.MD5.b64_md5(value) : null);
};

DefaultPropertyHash.prototype.isPlainValueEqual = function (value) {
	return value ? (Crypto.MD5.b64_md5(value) === this.getValue()) : (value === this.getValue());
};

//@ sourceURL=contacts/properties/DisplayName.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var displayName = new DisplayName("Lude crude dude packed full of pre-chewed food");
 * 
 * var displayNameString = displayName.getValue();
 * var displayNameStringAgain = displayName.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var DisplayName = PropertyBase.create({
	/**
	* @lends DisplayName#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name DisplayName#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name DisplayName#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

//@ sourceURL=contacts/properties/EmailAddress.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, PropertyBase, Utils, RB, StringUtils*/

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var email = new EmailAddress({
 *	value: "support@palm.com",
 *	type: "work",
 *	primary: true
 * });
 * 
 * var emailString = email.getValue();
 * var emailStringAgain = email.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var EmailAddress = exports.EmailAddress = PropertyBase.create({
	/**
	* @lends EmailAddress#
	* @property {string} x_value
	* @property {string} x_type
	* @property {string} x_primary
	*/
	data: [
		{
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name EmailAddress#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name EmailAddress#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}, {
			dbFieldName: "type",
			defaultValue: "type_home",
			/**
			* @name EmailAddress#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name EmailAddress#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		}, {
			dbFieldName: "primary",
			defaultValue: false,
			/**
			* @name EmailAddress#setPrimary
			* @function
			* @param {string} primary
			*/
			setterName: "setPrimary",
			/**
			* @name EmailAddress#getPrimary
			* @function
			* @returns {string}
			*/
			getterName: "getPrimary"
		}
	]
});

EmailAddress.prototype.getNormalizedHashKey = function () {
	return this.getNormalizedValue();
};

EmailAddress.prototype.getNormalizedValue = function () {
	// TODO: implement me
	return EmailAddress.normalizeEmail(this.getValue());
};

EmailAddress.normalizeEmail = function (str) {
	if (!str || !_.isString(str)) {
		str = "";
	}
	return str.toLowerCase().trim();
};


/**
 * @returns {string}
 */
EmailAddress.prototype.getDisplayValue = function () {
	return this.getValue();
};

/** 
 * @name EmailAddress#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
EmailAddress.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});

/**
 * @returns {string}
 */
EmailAddress.prototype.getDisplayType = function () {
	return EmailAddress.getDisplayType(this.getType());
};
/** 
 * @name EmailAddress#x_displayType
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayType()
 */
EmailAddress.prototype.__defineGetter__("x_displayType", function () {
	return this.getDisplayType();
});

EmailAddress.getDisplayType = function (type) {
	return (EmailAddress.Labels.getLabel(type) || EmailAddress.Labels.getLabel(EmailAddress.TYPE.OTHER));
};


/*
//TODO: use this somehow for the app?
ContactPointDecorator.emailFormatter = function (pt) {
	//if (pt.hasBeenFormatted) {
		//return pt;
	//}
	ContactPointDecorator.formatContactPoint(pt);
	//pt.displayValue = pt.value;
	//pt.type = "email";
	return pt;
};
*/


/**
 * @constant
 */
// prefixing these with "type_" to discourage direct display of these values
EmailAddress.TYPE = Utils.defineConstants({
	HOME: "type_home",
	WORK: "type_work",
	OTHER: "type_other"
});

EmailAddress.Labels = Utils.createLabelFunctions([{
	value: EmailAddress.TYPE.HOME,
	displayValue: RB.$L('Home'),
	isPopupLabel: true
}, {
	value: EmailAddress.TYPE.WORK,
	displayValue: RB.$L('Work'),
	isPopupLabel: true
}, {
	value: EmailAddress.TYPE.OTHER,
	displayValue: RB.$L('Other'),
	isPopupLabel: true
}]);


//@ sourceURL=contacts/properties/FavoritablePersonField.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports _*/

var FavoritablePersonField = {};

FavoritablePersonField.data = [{
		dbFieldName: "favoriteData",
		defaultValue: {},
		/**
		* @name FavoritablePersonField#setFavoriteData
		* @function
		* @param {object} favoriteData
		*/
		setterName: "setFavoriteData",
		/**
		* @name FavoritablePersonField#getFavoriteData
		* @function
		* @returns {object}
		*/
		getterName: "getFavoriteData"
	}
];

FavoritablePersonField.functions = {
	addFavoriteData: function (applicationId, favoriteData) {
		this.getFavoriteData()[applicationId] = favoriteData;
	},
	
	hasFavoriteDataForAnyApp: function () {
		return _.keys(this.getFavoriteData()).length ? true : false; 
	},
	
	getFavoriteDataForAppWithId: function (applicationId) {
		return this.getFavoriteData()[applicationId];
	},
	
	removeFavoriteDefaultForAppWithId: function (applicationId) {
		this.getFavoriteData()[applicationId] = undefined;
	},
	
	removeAllFavoriteData: function () {
		this.setFavoriteData({});
	}
};

//@ sourceURL=contacts/properties/FavoritableEmailAddress.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global console, _, Class, EmailAddress, PropertyBase, FavoritablePersonField*/

var FavoritableEmailAddress = PropertyBase.create({
	superClass: EmailAddress,
	data: FavoritablePersonField.data
});

// Add our functions for handling the favoriteData
//_.extend(FavoritableEmailAddress.prototype, FavoritablePersonField.functions);
FavoritableEmailAddress.prototype.addFavoriteData = FavoritablePersonField.functions.addFavoriteData;
FavoritableEmailAddress.prototype.hasFavoriteDataForAnyApp = FavoritablePersonField.functions.hasFavoriteDataForAnyApp;
FavoritableEmailAddress.prototype.getFavoriteDataForAppWithId = FavoritablePersonField.functions.getFavoriteDataForAppWithId;
FavoritableEmailAddress.prototype.removeFavoriteDefaultForAppWithId = FavoritablePersonField.functions.removeFavoriteDefaultForAppWithId;
FavoritableEmailAddress.prototype.removeAllFavoriteData = FavoritablePersonField.functions.removeAllFavoriteData;

//@ sourceURL=contacts/properties/EmailAddressExtended.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, Class, EmailAddress, exports, StringUtils, PropertyBase, FavoritableEmailAddress*/

/**
* @class
* @augments EmailAddress
* @param {object} obj the raw database object
* @example
* var email = new EmailAddressExtended({
*	value: "support@palm.com",
*	type: "type_work",
*	primary: true
* });
* 
* var emailString = email.getValue();
* var emailStringAgain = email.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
* var normalizedValue = email.getNormalizedValue();
*/
var EmailAddressExtended = PropertyBase.create({
	/**
	* @lends EmailaddressExtended#
	* @property {string} x_normalizedValue
	*/
	superClass: FavoritableEmailAddress,
	data: [
		{	// Override value so we can implement a beforeSet method that sets a boolean to
			// indicate that the normalizedValue needs to be generated.  If this 'true', we
			// will set the normalizedValue when getNormalizedValue() is called or getDBObject()
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name EmailAddressExtended#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name EmailAddressExtended#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue",
			beforeSet: function (value) {
				this.doGenerateNormalizedValue = true;
				return value;
			}
		},
		{
			dbFieldName: "normalizedValue",
			defaultValue: "",
			/**
			* @name EmailAddressExtended#setNormalizedValue
			* @function
			* @param {string} value
			*/
			setterName: "setNormalizedValue",
			/**
			* @name EmailAddressExtended#getNormalizedValue
			* @function
			* @returns {string}
			*/
			getterName: "getNormalizedValue",
			beforeGet: function (origNormalizedValue) {
				var normalizedValue = origNormalizedValue,
					value = this.getValue();
					
				// only generate the normalizedValue if the value has been set
				if (!value || this.doGenerateNormalizedValue) {
					normalizedValue = EmailAddress.normalizeEmail(value);
					this.setNormalizedValue(normalizedValue);
					this.doGenerateNormalizedValue = false;
				}
				return normalizedValue;
			}
		}
	]
});

EmailAddressExtended.prototype._extendedGetDBObject = function (dbObject) {
	// make sure that the normalizedValue is up to date since we delay calculating it until it is read
	dbObject.normalizedValue = this.getNormalizedValue();
	return dbObject;
};

//@ sourceURL=contacts/properties/Favorite.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {boolean} obj the raw database object
 * @example
 * var favorite = new Favorite(true);
 * 
 * var favoriteValue = favorite.getValue();
 * var favoriteValueAgain = favorite.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Favorite = PropertyBase.create({
	/**
	* @lends Favorite#
	* @property {boolean} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: false,
			/**
			* @name Favorite#setValue
			* @function
			* @param {boolean} value
			*/
			setterName: "setValue",
			/**
			* @name Favorite#getValue
			* @function
			* @returns {boolean}
			*/
			getterName: "getValue"
		}
	]
});

/**
* @param {Favorite} value The raw {boolean} value can be passed as well.
* @returns {boolean}
*/
Favorite.prototype.equals = function (value) {
	if (value instanceof Favorite) {
		return this.getValue() === value.getValue();
	} else {
		return this.getValue() === value;
	}
};


//@ sourceURL=contacts/FavoriteBackup.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, Assert, JSON, Utils, DB, PalmCall, ContactBackupHash, PropertyArray, DefaultPropertyHash, Contact, ContactLinkable, Future */

var FavoriteBackup = exports.FavoriteBackup = Class.create({
	/** @lends FavoriteBackup#*/
	
	/**
	 * This defines a decorated FavoriteBackup.  This object hides the raw FavoriteBackup data and exposes methods for accessing decorated
	 * property objects for which getters/setters can be called.  These decorated properties also hide raw data, and can be passed 
	 * directly to framework widgets.
	 * @constructs
	 * @param {Object} rawFavoriteBackup - raw favoriteBackup object
	 * @example
	 * var favoriteBackup = new FavoriteBackup({
	 *                     contactBackupHash: 3XC8|local,
	 *                     defaultPropertyHashes: [{
	 *                          value: "FEF89&wef,jfew9823",
	 *                          type: "PhoneNumber",
	 *                          favoriteData: {...} }] 
	 *                });
	 * 
	 * var favoriteBackupContactHash = favoriteBackup.getContactBackupHash();
	 * var favoriteBackupDefaultPhoneNumber = favoriteBackup.getDefaultPhoneNumber();
	 */
	initialize: function (obj) {
		if (!obj) {
			obj = {};
		}
		
		var rawFavoriteBackup = obj,
			_data = {
				_kind: FavoriteBackup.kind,
				_id: rawFavoriteBackup._id,
				_rev: rawFavoriteBackup._rev,
				_del: rawFavoriteBackup._del,
				contactBackupHash: Utils.lazyWrapper(ContactBackupHash, [rawFavoriteBackup.contactBackupHash, true]),
				defaultPropertyHashes:  Utils.lazyWrapper(PropertyArray, [DefaultPropertyHash, rawFavoriteBackup.defaultPropertyHashes, true])
			};

		/**
		 * This method should only be used internally.  This allows us to control access to the private data
		 * above.  This has been implemented to only fetch data.  This cannot be used to set the private fields.
		 * Individual setters will be implemented below for fields that require the ability to be set.
		 * @private
		 * @param {string} fieldName
		 */
		this.accessor = function (fieldName) {
			var field = _data[fieldName];
			Assert.requireDefined(fieldName, "fieldName must be specified for the accessor");
			//Assert.require(field, "the field you requested does not exist: _data[" + fieldName + "]");
			
			if (field && typeof field === "object" && field.isLazyWrapper) {
				field = _data[fieldName] = field.createInstance();
			}
			
			return field;
		};
		
		/**
		 * Setter for the _id field
		 * @param {string} id
		 */
		this.setId = function (id) {
			_data._id = id;
		};
		
		/**
		 * Setter for the _rev field
		 * @param {string} rev
		 */
		this.setRev = function (rev) {
			_data._rev = rev;
		};
		
		/**
		 * This converts the favoriteBackup into a database writable object
		 * This calls getDBObjects on all properties and combines the data into one object
		 * @returns {Object} The raw database object
		 */
		this.getDBObject = function () {
			return Utils.getDBObjectForAllProperties(this.accessor, _.keys(_data));
		};
	},

	/**
	 * Gets the id for favorite backup
	 * @returns {string} The id
	 */
	getId: function () {
		return this.accessor("_id");
	},

	/**
	 * Gets the kind for favorite backup
	 * @returns {string} The kind
	 */
	getKind: function () {
		return this.accessor("_kind");
	},
	
	/**
	 * Gets the contactBackupHash for this favorite backup
	 * @returns {string} The contactBackupHash
	 */
	getContactBackupHash: function () { 
		return this.accessor("contactBackupHash");
	},
	
	/**
	 * Gets the contactId for this favorite backup from the contactBackupHash
	 * @returns {string} The id of the contact for this favorite backup
	 */
	getContactBackupHashContactId: function () {
		var backupHash = this.getContactBackupHash().getValue();
		
		return Contact.getIdFromLinkHash(backupHash);
	},
	
	/**
	 * @returns {array} The value of the default phone number for this favorite backup
	 */
	getDefaultPropertyHashes: function () {
		return this.accessor("defaultPropertyHashes");
	},
	
	/**
	 * Gets the default for this favorite backup
	 * @returns {object} The value of the default phone number for this favorite backup
	 */
	getDefaultsForContactPointType: function (contactPointType) {
		var propertyHashes = this.getDefaultPropertyHashes().getArray(),
			i,
			tempProperty,
			toReturn = [];
			
		for (i = 0; i < propertyHashes.length; i += 1) {
			tempProperty = propertyHashes[i];
			if (tempProperty.getType() === contactPointType) {
				toReturn.push(tempProperty);
			}
		}
		
		return toReturn;
	},
	
	/**
	 * Set the default phone number value for this favorite backup
	 * @param {string} value - the value of the phone number to set as default
	 * @param {string} contactPointType - the type of contact point this favorite is set on
	 * @param {object} favoriteData - the data on the favorite to back up
	 * @returns {boolean}
	 */
	setDefaultForContactPointType: function (value, contactPointType, favoriteData) {
		var propertyHashes = this.getDefaultPropertyHashes(),
			propertyHashesArray = propertyHashes.getArray(),
			i,
			tempProperty,
			foundEntry = false;
			
		for (i = 0; i < propertyHashesArray.length; i += 1) {
			tempProperty = propertyHashesArray[i];
			if (tempProperty.getType() === contactPointType && tempProperty.isPlainValueEqual(value)) {
				foundEntry = true;
				tempProperty.setFavoriteData(favoriteData);
				break;
			} else if (tempProperty.getType() === contactPointType && tempProperty.isPlainValueEqual(null)) {
				foundEntry = true;
				tempProperty.setFavoriteData(favoriteData);
				tempProperty.setType(contactPointType);
				tempProperty.setPlainValue(value);
				break;
			}
		}
		
		if (!foundEntry) {
			tempProperty = new DefaultPropertyHash();
			tempProperty.setPlainValue(value);
			tempProperty.setType(contactPointType);
			tempProperty.setFavoriteData(favoriteData);
			propertyHashes.add(tempProperty);
		}
		
		return true;
	},
	
	/**
	 * Delete the current favorite backup from the DB
	 * @returns {Future} The Future.result will be set to result of the call the delete the favorite backup from the DB.
	 */
	deleteFavoriteBackup: function () {
		var id = this.getId();
		Assert.requireDefined(id, "deleteFavoriteBackup unable to delete, there is no _id param");
		
		return DB.del([id]);
	},
	
	/**
	 * Save the current favoriteBackup to the DB
	 * @returns {Future} The Future.result will be set to result of the call the save the favoriteBackup to the DB.
	 */
	save: function () {
		return DB.put([this.getDBObject()]).then(this, function (future) {
			var result = Utils.DBResultHelper(future.result);
			Assert.require(result, "FavoriteBackup save put - result is null");
			Assert.requireArray(result, "FavoriteBackup save");
			Assert.require(result.length, "FavoriteBackup save put - result length is zero");
			
			this.setId(result[0].id);
			this.setRev(result[0].rev);
			future.result = true;
		});
	},
	
	/**
	 * Returns the string representation of {@link FavoriteBackup#getDBOBject}.  This is for testing.
	 * @returns {string}
	 */
	toString: function () {
		return JSON.stringify(this.getDBObject());
	}
});

FavoriteBackup.kind = "com.palm.person.favoritebackup:1";

/**
 * Gets a favorite backup for a given contact.
 * @param {object} contact - the contact that the favorite backup is associated with
 * @returns {Future.result -> FavoriteBackup} The favorite backup for the contact id specified
 */
FavoriteBackup.getBackupForContact = function (contact) {
	Assert.require(contact, "FavoriteBackup.getBackupForContact requires a contact");
	
	var future = new Future();
	
	future.now(function () {
		return ContactLinkable.getLinkHash(contact);
	});
	
	future.then(function () {
		var result = future.result.linkHash;
		
		return FavoriteBackup.getBackupForLinkhash(result);
	});
	
	return future;
};

FavoriteBackup.getBackupForLinkhash = function (linkHash) {
	var future = new Future();
	
	future.now(function () {
		return DB.find({
			"from": FavoriteBackup.kind,
			"where": [{
				"prop": "contactBackupHash",
				"op": "=",
				"val": linkHash
			}]
		});
	});
	
	future.then(function () {
		//console.log(JSON.stringify(future.result));
		var result = Utils.DBResultHelper(future.result);
		if (result && result[0]) {
			future.result = new FavoriteBackup(result[0]);
		} else {
			future.result = undefined;
		}
	});
	
	return future;
};

/**
 * Remove a favorite backup for a given contact.
 * @param {object} contact - the contact that the favorite backup is associated with
 * @returns {Future.result -> boolean} Indicates if removing the backup was successful
 */
FavoriteBackup.removeBackupForContact = function (contact) {
	Assert.require(contact, "FavoriteBackup.removeBackupForContact requires a contact");
	
	var future = new Future();
	
	future.now(function () {
		return ContactLinkable.getLinkHash(contact);
	});
	
	future.then(function () {
		var contactHash = future.result.linkHash,
			query = {
				"from": FavoriteBackup.kind,
				"where": [{
					"prop": "contactBackupHash",
					"op": "=",
					"val": contactHash
				}]
			};
		
		return DB.del(query);
	});
	
	future.then(function () {
		var result = Utils.DBResultHelper(future.result);
		return result && result.count > 0;
	});
	
	return future;
};

//@ sourceURL=contacts/properties/Gender.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var gender = new Gender("male");
 * 
 * var genderString = gender.getValue();
 * var genderStringAgain = gender.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Gender = PropertyBase.create({
	/**
	* @lends Gender#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Gender#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Gender#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

//@ sourceURL=contacts/properties/IMAddress.js

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

//@ sourceURL=contacts/properties/FavoritableIMAddress.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global console, _, Class, IMAddress, PropertyBase, FavoritablePersonField*/

var FavoritableIMAddress = PropertyBase.create({
	superClass: IMAddress,
	data: FavoritablePersonField.data
});

// Add our functions for handling the favoriteData
//_.extend(FavoritableIMAddress.prototype, FavoritablePersonField.functions);
FavoritableIMAddress.prototype.addFavoriteData = FavoritablePersonField.functions.addFavoriteData;
FavoritableIMAddress.prototype.hasFavoriteDataForAnyApp = FavoritablePersonField.functions.hasFavoriteDataForAnyApp;
FavoritableIMAddress.prototype.getFavoriteDataForAppWithId = FavoritablePersonField.functions.getFavoriteDataForAppWithId;
FavoritableIMAddress.prototype.removeFavoriteDefaultForAppWithId = FavoritablePersonField.functions.removeFavoriteDefaultForAppWithId;
FavoritableIMAddress.prototype.removeAllFavoriteData = FavoritablePersonField.functions.removeAllFavoriteData;

//@ sourceURL=contacts/properties/IMAddressExtended.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, Class, IMAddress, PropertyBase, FavoritableIMAddress*/

/**
* @class
* @augments IMAddress
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
* var normalizedValue = im.getNormalizedValue();
*/
var IMAddressExtended = PropertyBase.create({
	/**
	* @lends IMAddressExtended#
	* @property {string} x_normalizedValue
	*/
	superClass: FavoritableIMAddress,
	data: [
		{	// Override value so we can implement a beforeSet method that sets a boolean to
			// indicate that the normalizedValue needs to be generated.  If this 'true', we
			// will set the normalizedValue when getNormalizedValue() is called or getDBObject()
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name IMAddressExtended#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name IMAddressExtended#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue",
			beforeSet: function (value) {
				this.doGenerateNormalizedValue = true;
				return value;
			}
		},
		{
			dbFieldName: "normalizedValue",
			defaultValue: "",
			/**
			* @name IMAddressExtended#setNormalizedValue
			* @function
			* @param {string} value
			*/
			setterName: "setNormalizedValue",
			/**
			* @name IMAddressExtended#getNormalizedValue
			* @function
			* @returns {string}
			*/
			getterName: "getNormalizedValue",
			beforeGet: function (origNormalizedValue) {
				var normalizedValue = origNormalizedValue,
					value = this.getValue();
					
				// only generate the normalizedValue if the value has been set
				if (!value || this.doGenerateNormalizedValue) {
					normalizedValue = IMAddress.normalizeIm(value);
					this.setNormalizedValue(normalizedValue);
					this.doGenerateNormalizedValue = false;
				}
				return normalizedValue;
			}
		}
	]
});

IMAddressExtended.prototype._extendedGetDBObject = function (dbObject) {
	// make sure that the normalizedValue is up to date since we delay calculating it until it is read
	dbObject.normalizedValue = this.getNormalizedValue();
	return dbObject;
};

//@ sourceURL=contacts/properties/LauncherId.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, exports, $L, console */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 *							
 * var launcherId = new LauncherId("4rJ5");
 * 
 * var launcherIdValue = launcherId.getValue();
 * var launcherIdValueAgain = launcherId.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var LauncherId = exports.LauncherId = PropertyBase.create({
	/**
	* @lends LauncherId#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name LauncherId#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name LauncherId#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

//@ sourceURL=contacts/properties/Name.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500, sub: true */
/*global RB, _, Class, Assert, JSON, PropertyBase, StringUtils, Globalization, exports */

/**
 * @class
 * @augments PropertyBase
 * @param {Object} obj the raw database name object
 * @example
 * var name = new Name({
 *	givenName: "Austin",
 *	middleName: "Danger",
 *	familyName: "Powers",
 *	honorificPrefix: "Sir",
 *	honorificSuffix: "Jr"
 * });
 * 
 * var givenNameString = name.getGivenName();
 * var givenNameString = name.x_givenName; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Name = exports.Name = PropertyBase.create({
	/**
	* @lends Name#
	* @property {string} x_givenName defineGetter that calls this.getGivenName() + defineSetter that calls this.setGivenName()
	* @property {string} x_middleName defineGetter that calls this.getMiddleName() + defineSetter that calls this.setMiddleName()
	* @property {string} x_familyName defineGetter that calls this.getFamilyName() + defineSetter that calls this.setFamilyName()
	* @property {string} x_honorificPrefix defineGetter that calls this.getHonorificPrefix() + defineSetter that calls this.setHonorificPrefix()
	* @property {string} x_honorificSuffix defineGetter that calls this.getHonorificSuffix() + defineSetter that calls this.setHonorificSuffix()
	*/
	data: [
		{
			dbFieldName: "givenName",
			defaultValue: "",
			/**
			* @name Name#setGivenName
			* @function
			* @param {string} givenName
			*/
			setterName: "setGivenName",
			/**
			* @name Name#getGivenName
			* @function
			* @returns {string}
			*/
			getterName: "getGivenName"
		},
		{
			dbFieldName: "middleName",
			defaultValue: "",
			/**
			* @name Name#setMiddleName
			* @function
			* @param {string} middleName
			*/
			setterName: "setMiddleName",
			/**
			* @name Name#getMiddleName
			* @function
			* @returns {string}
			*/
			getterName: "getMiddleName"
		},
		{
			dbFieldName: "familyName",
			defaultValue: "",
			/**
			* @name Name#setFamilyName
			* @function
			* @param {string} familyName
			*/
			setterName: "setFamilyName",
			/**
			* @name Name#getFamilyName
			* @function
			* @returns {string}
			*/
			getterName: "getFamilyName"
		},
		{
			dbFieldName: "honorificPrefix",
			defaultValue: "",
			/**
			* @name Name#setHonorificPrefix
			* @function
			* @param {string} honorificPrefix
			*/
			setterName: "setHonorificPrefix",
			/**
			* @name Name#getHonorificPrefix
			* @function
			* @returns {string}
			*/
			getterName: "getHonorificPrefix"
		},
		{
			dbFieldName: "honorificSuffix",
			defaultValue: "",
			/**
			* @name Name#setHonorificSuffix
			* @function
			* @param {string} honorificSuffix
			*/
			setterName: "setHonorificSuffix",
			/**
			* @name Name#getHonorificSuffix
			* @function
			* @returns {string}
			*/
			getterName: "getHonorificSuffix"
		}
	]
});

/**
 * Returns a unique string for the name object
 * @returns {string}
 */
Name.prototype.getNormalizedHashKey = function () {
	return this.getNormalizedGivenName() + ":(|)" + this.getNormalizedFamilyName();
};

/**
 * Should not be used for display.
 * @returns {string}
 */
Name.prototype.getNormalizedGivenName = function () {
	return Name.normalizeName(this.getGivenName());
};

/**
 * Should not be used for display.
 * @returns {string}
 */
Name.prototype.getNormalizedMiddleName = function () {
	return Name.normalizeName(this.getMiddleName());
};

/**
 * Should not be used for display.
 * @returns {string}
 */
Name.prototype.getNormalizedFamilyName = function () {
	return Name.normalizeName(this.getFamilyName());
};

/**
 * Should not be used for display.
 * @returns {string}
 */
Name.prototype.getNormalizedHonorificPrefixName = function () {
	return Name.normalizeName(this.getHonorificPrefix());
};

/**
 * Should not be used for display.
 * @returns {string}
 */
Name.prototype.getNormalizedHonorificSuffixName = function () {
	return Name.normalizeName(this.getHonorificSuffix());
};

/**
 * Normalize a name string.
 * @returns {string}
 */
Name.normalizeName = function (str) {
	if (!str || !_.isString(str)) {
		str = "";
	}
	return str.toLowerCase().trim();
};

/**
 * Set the current {@link Name} object based on the passed in {@link Name} object
 * @param {Name} nameObj
 */
Name.prototype.set = function (nameObj) {
	Assert.requireClass(nameObj, Name, "this.set requires an argument of type Name");
	this.setFamilyName(nameObj.getFamilyName() || "");
	this.setGivenName(nameObj.getGivenName() || "");
	this.setMiddleName(nameObj.getMiddleName() || "");
	this.setHonorificPrefix(nameObj.getHonorificPrefix() || "");
	this.setHonorificSuffix(nameObj.getHonorificSuffix() || "");
};

/**
 * Return the fully concatenated name
 * @param {boolean} doNotStrip - do not strip each name part before the full name is concatenated together
 * @returns {string}
 */
Name.prototype.getFullName = function (doNotStrip) {
	return Globalization.Name.formatPersonalName({
		prefix: this.getHonorificPrefix(),
		givenName: this.getGivenName(),
		middleName: this.getMiddleName(),
		familyName: this.getFamilyName(),
		suffix: this.getHonorificSuffix()
	}, Globalization.Name.longName);
};

/**
 * Parses a free form name string and sets the appropriate fields on the {@link Name} object
 * @param {string} freeformName
 */
Name.prototype.parseName = function (freeformName) {
	var structuredName = Globalization.Name.parsePersonalName(freeformName);
	
	this.setFamilyName(structuredName.familyName || "");
	this.setGivenName(structuredName.givenName || "");
	this.setMiddleName(structuredName.middleName || "");
	this.setHonorificPrefix(structuredName.prefix || "");
	this.setHonorificSuffix(structuredName.suffix || "");
};

/**
 * Sets all of the fields on the {@link Name} object to empty string
 */
Name.prototype.clear = function () {
	this.setFamilyName("");
	this.setGivenName("");
	this.setMiddleName("");
	this.setHonorificPrefix("");
	this.setHonorificSuffix("");
};

/** 
 * @name Name#x_fullName
 * @property 
 * @type string
 * @description defineGetter that calls this.getFullName() + defineSetter that calls this.parseName()
 */
Name.prototype.__defineGetter__("x_fullName", function () {
	return this.getFullName();
});


Name.prototype.__defineSetter__("x_fullName", function (value) {
	this.parseName(value);
});

/**
 * Takes a raw name object an concatenates the names into a string.  Missing fields will be ignored.
 * @param {Object} rawName - {honorificPrefix: {string}, givenName: {string}, middleName: {string}, familyName: {string}, honorificSuffix: {string}}
 * @param {boolean} doNotStrip - do not strip each name part before the full name is concatenated together
 * @returns {string}
 */
Name.getFullNameFromRawObject = function (rawName, doNotStrip) {
	return Globalization.Name.formatPersonalName({
		prefix: rawName.honorificPrefix,
		givenName: rawName.givenName,
		middleName: rawName.middleName,
		familyName: rawName.familyName,
		suffix: rawName.honorificSuffix
	}, Globalization.Name.longName);
};



//@ sourceURL=contacts/properties/Nickname.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var nickname = new Nickname("the situation");
 * 
 * var nicknameString = nickname.getValue();
 * var nicknameStringAgain = nickname.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Nickname = PropertyBase.create({
	/**
	* @lends Nickname#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Nickname#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Nickname#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

/**
 * @returns {string}
 */
Nickname.prototype.getDisplayValue = function () {
	return this.getValue();
};

/** 
 * @name Nickname#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Nickname.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});


//@ sourceURL=contacts/properties/Note.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, Foundations */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var note = new Note("buy a pen and paper so I can write down a notes for my contacts");
 * 
 * var noteString = note.getValue();
 * var noteStringAgain = note.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Note = PropertyBase.create({
	/**
	* @lends Note#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Note#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Note#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

Note.prototype.getNormalizedHashKey = function () {
	var toReturn = this.getValue();
	return toReturn.toUpperCase();
};

/**
 * @returns {string}
 */
Note.prototype.getDisplayValue = function () {
	var temp = this.getValue();
	temp = Foundations.StringUtils.escapeHTML(temp);
	temp = temp.replace(/\n/g, "<br>");
	return temp;
};

/** 
 * @name Note#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Note.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});


//@ sourceURL=contacts/properties/Organization.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, Address, console, _, exports, Utils, RB */

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var org = new Organization({
 *	{
 *		name: "Shamwow Software Inc.",
 *		department: "Sofware Engineering",
 *		title: "Super Senior Software Engineer with Sugar on Top",
 *		type: "Mobile",
 *		startDate: "1945-01-01",
 *		endDate: "2005-02-01",
 *		location: {
 *			streetAddress: "123 L33t Str33t",
 *			locality: "Funnyville",
 *			region: "CA",
 *			postalCode: "94040",
 *			country: "USA"
 *		},
 *		description: "Code monkeys"
 *	}
 * });
 * 
 * var companyName = org.getName();
 * var companyNameAgain = org.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Organization = exports.Organization = PropertyBase.create({
	/**
	* @lends Organization#
	* @property {string} x_name
	* @property {string} x_department
	* @property {string} x_title
	* @property {string} x_startDate
	* @property {string} x_endDate
	* @property {Address} x_location
	* @property {string} x_description
	*/
	data: [
		{
			dbFieldName: "name",
			defaultValue: "",
			/**
			* @name Organization#setName
			* @function
			* @param {string} name
			*/
			setterName: "setName",
			/**
			* @name Organization#getName
			* @function
			* @returns {string}
			*/
			getterName: "getName"
		},
		{
			dbFieldName: "department",
			defaultValue: "",
			/**
			* @name Organization#setDepartment
			* @function
			* @param {string} department
			*/
			setterName: "setDepartment",
			/**
			* @name Organization#getDepartment
			* @function
			* @returns {string}
			*/
			getterName: "getDepartment"
		},
		{
			dbFieldName: "title",
			defaultValue: "",
			/**
			* @name Organization#setTitle
			* @function
			* @param {string} title
			*/
			setterName: "setTitle",
			/**
			* @name Organization#getTitle
			* @function
			* @returns {string}
			*/
			getterName: "getTitle"
		},
		{
			dbFieldName: "type",
			defaultValue: "",
			/**
			* @name Organization#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name Organization#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		},
		{
			dbFieldName: "startDate",
			defaultValue: "",
			/**
			* @name Organization#setStartDate
			* @function
			* @param {string} startDate
			*/
			setterName: "setStartDate",
			/**
			* @name Organization#getStartDate
			* @function
			* @returns {string}
			*/
			getterName: "getStartDate"
		},
		{
			dbFieldName: "endDate",
			defaultValue: "",
			/**
			* @name Organization#setEndDate
			* @function
			* @param {string} endDate
			*/
			setterName: "setEndDate",
			/**
			* @name Organization#getEndDate
			* @function
			* @returns {string}
			*/
			getterName: "getEndDate"
		},
		{
			dbFieldName: "location",
			defaultValue: {},
			/**
			* @name Organization#setLocation
			* @function
			* @param {Address} location
			*/
			setterName: "setLocation",
			/**
			* @name Organization#getLocation
			* @function
			* @returns {Address}
			*/
			getterName: "getLocation",
			classObject: Address
//			beforeSet: function (value) {	// location is a sub object. Any time we set this value, we need to construct a new Address
//				return new Address(value);	// As a result of this, we need to implement _extendedGetDBObject to handle unwrapping this field
//			}
		},
		{
			dbFieldName: "description",
			defaultValue: "",
			/**
			* @name Organization#setDescription
			* @function
			* @param {string} description
			*/
			setterName: "setDescription",
			/**
			* @name Organization#getDescription
			* @function
			* @returns {string}
			*/
			getterName: "getDescription"
		}
	]
});

// TODO: unwrapping sub objects should probably be handled by PropertyBase

// Handle the unwrapping of the location field when we dump the DB object to save
Organization.prototype._extendedGetDBObject = function (data) {
	var address = this.getLocation(),
		newData = _.clone(data);
		
	if (address && address.getDBObject) {
		newData.location = address.getDBObject();
	} else {
		console.warn("Organization: address does not appear to be a correct wrapped object.  Unable to call getDBObject()");
	}
	return newData;
};


/**
 * @constant
 */
// prefixing these with "type_" to discourage direct display of these values
Organization.TYPE = Utils.defineConstants({
	HOME: "type_home",
	WORK: "type_work",
	SCHOOL: "type_school",
	OTHER: "type_other"
});

Organization.Labels = Utils.createLabelFunctions([{
	value: Organization.TYPE.HOME,
	displayValue: RB.$L('Home'),
	isPopupLabel: true
}, {
	value: Organization.TYPE.WORK,
	displayValue: RB.$L('Work'),
	isPopupLabel: true
}, {
	value: Organization.TYPE.SCHOOL,
	displayValue: RB.$L('School'),
	isPopupLabel: true
}, {
	value: Organization.TYPE.OTHER,
	displayValue: RB.$L('Other'),
	isPopupLabel: true
}]);

//@ sourceURL=contacts/properties/PhoneNumber.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, RB, console, _, Class, PropertyBase, Utils, Assert, Globalization, ObjectUtils */

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var phone = new PhoneNumber({
 *	value: "5555555555",
 *	type: "mobile",
 *	primary: false
 * });
 * 
 * var phoneString = phone.getValue();
 * var phoneStringAgain = phone.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var PhoneNumber = exports.PhoneNumber = PropertyBase.create({
	/**
	* @lends PhoneNumber#
	* @property {string} x_value The phone number string. This property is a defineGetter/defineSetter that calls getValue()/setValue()
	* @property {string} x_type The type string. This property is a defineGetter/defineSetter that calls getType()/setType()
	* @property {string} x_primary The primary string. This property is a defineGetter/defineSetter that calls getPrimary()/setPrimary()
	*/
	data: [
		{
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name PhoneNumber#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name PhoneNumber#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
//			beforeSet: function (value) {
//				this.displayValue = PhoneNumber.format(value);
//				return value;
//			}
		}, {
			dbFieldName: "type",
			defaultValue: "",
			/**
			* @name PhoneNumber#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name PhoneNumber#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		}, {
			dbFieldName: "primary",
			defaultValue: false,
			/**
			* @name PhoneNumber#setPrimary
			* @function
			* @param {boolean} type
			*/
			setterName: "setPrimary",
			/**
			* @name PhoneNumber#getPrimary
			* @function
			* @returns {boolean}
			*/
			getterName: "getPrimary"
		}
	]
});

PhoneNumber.prototype.equals = function (obj) {
	if (obj instanceof PhoneNumber) {
		return (this.getValue() === obj.getValue() &&
		this.getType() === obj.getType() &&
		this.getPrimary() === obj.getPrimary());
	} 
	return false;
};


// match on object instance
//		 naked object that is a literal equality on all fields
//		 mojodb id

PhoneNumber.prototype.getNormalizedHashKey = function () {
	return this.getNormalizedValue();
};

PhoneNumber.prototype.getNormalizedValue = function () {
	return PhoneNumber.normalizePhoneNumber(this.getValue());
};

/**
 * Generate search normalized value for phone number
 * @returns {string}
 */
PhoneNumber.prototype.getNormalizedSearchHashKey = function () {
	return PhoneNumber.normalizePhoneNumber(this.getValue(), true);
};

/**
 * @returns {string}
 */
PhoneNumber.prototype.getDisplayValue = function () {
	return PhoneNumber.format(this.getValue());
};

/** 
 * @name PhoneNumber#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
PhoneNumber.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});

/**
 * @returns {string}
 */
PhoneNumber.prototype.getDisplayType = function () {
	return PhoneNumber.getDisplayType(this.getType());
};

/**
 * @name PhoneNumber#x_displayType
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayType()
 */
PhoneNumber.prototype.__defineGetter__("x_displayType", function () {
	return this.getDisplayType();
});

PhoneNumber.normalizePhoneNumber = function (numberParam, wantSearchFormat) {
	var numberParamType = ObjectUtils.type(numberParam),
		parsedPhoneNumber,
		normalizedValue;
	
	Assert.require(numberParamType === "object" || numberParamType === "string", "PhoneNumber.normalizePhoneNumber - number passed is not a string or an object");
	
	//if it's not already parsed, we parse it
	parsedPhoneNumber = (numberParamType === "string") ? Globalization.Phone.parsePhoneNumber(numberParam) : numberParam;
	
	//if we get something empty back, just return the empty string
	if (!parsedPhoneNumber || Object.keys(parsedPhoneNumber).length === 0) {
		return "";
	}
	
	normalizedValue = "";
	if (parsedPhoneNumber.extension) {
		normalizedValue += parsedPhoneNumber.extension.split("").reverse().join("");
	}
	normalizedValue += PhoneNumber.PART_DELIMITER;
	if (parsedPhoneNumber.subscriberNumber) {
		normalizedValue += parsedPhoneNumber.subscriberNumber.split("").reverse().join("");
	} else if (parsedPhoneNumber.serviceCode) {
		normalizedValue += parsedPhoneNumber.serviceCode.split("").reverse().join("");
	} else if (parsedPhoneNumber.emergency) {
		normalizedValue += parsedPhoneNumber.emergency.split("").reverse().join("");
	} else if (parsedPhoneNumber.vsc) {
		normalizedValue += parsedPhoneNumber.vsc.split("").reverse().join("");
	}
	normalizedValue += PhoneNumber.PART_DELIMITER;
	
	if (!wantSearchFormat) {
		if (parsedPhoneNumber.areaCode) {
			normalizedValue += parsedPhoneNumber.areaCode.split("").reverse().join("");
		}
		normalizedValue += PhoneNumber.PART_DELIMITER;
		if (parsedPhoneNumber.countryCode) {
			normalizedValue += parsedPhoneNumber.countryCode.split("").reverse().join("");
		}
		normalizedValue += PhoneNumber.PART_DELIMITER;
		if (parsedPhoneNumber.iddPrefix) {
			normalizedValue += parsedPhoneNumber.iddPrefix.split("").reverse().join("");
		}
	}
	
	return normalizedValue;
};

//TODO: this should be removed in favor of Edwin's logic
PhoneNumber.strip = function (numberStr) {
	if (!numberStr) {
		console.warn("PhoneNumber.strip - empty argument");
		return numberStr;
	}
	//()-+*#/. 
	if (typeof numberStr === 'number') {
		numberStr = "" + numberStr;
	}
	//return numberStr.replace(/[^A-Za-z0-9+*#]+/g, "");
	return numberStr.replace(/-*\(*\)*\**#*\/*\.*\s*/g, "");
};

// International phone number formatter
PhoneNumber.format = function (numberStr) {
	if (!numberStr) {
		console.warn("PhoneNumber.format - empty argument");
		return numberStr;
	}
		
	return Globalization.Phone.reformat(numberStr);	
	
};

// Remove any extra formatting or other characters that you would not want when exporting a phone number.
// This is used for vCard export
PhoneNumber.unformatForVCard = function (numberStr) {
	var toReturn = "";
	numberStr.replace(/[0123456789\+\*wpt#]/gi, function (substr) {
		toReturn += substr;
	});
	
	return toReturn;
};

PhoneNumber.getDisplayType = function (type) {
	return (PhoneNumber.Labels.getLabel(type) || PhoneNumber.Labels.getLabel(PhoneNumber.TYPE.MOBILE));
};


/**
 * @constant
 */
PhoneNumber.PART_DELIMITER = "-";

// vCard stuff is using these types. Make sure if you change anything on this
// that the tests for vCard don't fail. Otherwise the rath of a million sand flies
// will overtake your shorts!
// prefixing these with "type_" to discourage direct display of these values
PhoneNumber.TYPE = Utils.defineConstants({
	MOBILE: "type_mobile",
	HOME: "type_home",
	HOME2: "type_home2",
	WORK: "type_work",
	WORK2: "type_work2",
	MAIN: "type_main",
	PERSONAL_FAX: "type_personal_fax",
	WORK_FAX: "type_work_fax",
	PAGER: "type_pager",
	PERSONAL: "type_personal",
	SIM: "type_sim",
	ASSISTANT: "type_assistant",
	CAR: "type_car",
	RADIO: "type_radio",
	COMPANY: "type_company",
	OTHER: "type_other"
});

PhoneNumber.Labels = Utils.createLabelFunctions([{
	value: PhoneNumber.TYPE.MOBILE,
	displayValue: RB.$L('Mobile'),
	shortDisplayValue: RB.$L('M'),
	isPopupLabel: true
}, {
	value: PhoneNumber.TYPE.HOME,
	displayValue: RB.$L('Home'),
	shortDisplayValue: RB.$L('H'),
	isPopupLabel: true
}, {
	value: PhoneNumber.TYPE.WORK,
	displayValue: RB.$L('Work'),
	shortDisplayValue: RB.$L('W'),
	isPopupLabel: true
}, {
	value: PhoneNumber.TYPE.WORK_FAX,
	displayValue: RB.$L('Fax'),
	shortDisplayValue: RB.$L('F'),
	isPopupLabel: true
}, {
	value: PhoneNumber.TYPE.OTHER,
	displayValue: RB.$L('Other'),
	shortDisplayValue: RB.$L('O'),
	isPopupLabel: true
}, {
	value: PhoneNumber.TYPE.PAGER,
	displayValue: RB.$L('Pager'),
	shortDisplayValue: RB.$L('P'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.PERSONAL,
	displayValue: RB.$L('Personal'),
	shortDisplayValue: RB.$L('Pe'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.SIM,
	displayValue: RB.$L('SIM'),
	shortDisplayValue: RB.$L('S'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.MAIN,
	displayValue: RB.$L('Main'),
	shortDisplayValue: RB.$L('Ma'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.PERSONAL_FAX,
	displayValue: RB.$L('Fax'),
	shortDisplayValue: RB.$L('P'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.ASSISTANT,
	displayValue: RB.$L('Assistant'),
	shortDisplayValue: RB.$L('A'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.CAR,
	displayValue: RB.$L('Car'),
	shortDisplayValue: RB.$L('Ca'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.RADIO,
	displayValue: RB.$L('Radio'),
	shortDisplayValue: RB.$L('R'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.COMPANY,
	displayValue: RB.$L('Company'),
	shortDisplayValue: RB.$L('C'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.WORK2,
	displayValue: RB.$L('Work 2'),
	shortDisplayValue: RB.$L('W2'),
	isPopupLabel: false
}, {
	value: PhoneNumber.TYPE.HOME2,
	displayValue: RB.$L('Home 2'),
	shortDisplayValue: RB.$L('H2'),
	isPopupLabel: false
}]);


//@ sourceURL=contacts/properties/FavoritablePhoneNumber.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global console, _, Class, PhoneNumber, PropertyBase, FavoritablePersonField */

var FavoritablePhoneNumber = PropertyBase.create({
	superClass: PhoneNumber,
	data: FavoritablePersonField.data
});

// Add our functions for handling the favoriteData
//_.extend(FavoritablePhoneNumber.prototype, FavoritablePersonField.functions);
FavoritablePhoneNumber.prototype.addFavoriteData = FavoritablePersonField.functions.addFavoriteData;
FavoritablePhoneNumber.prototype.hasFavoriteDataForAnyApp = FavoritablePersonField.functions.hasFavoriteDataForAnyApp;
FavoritablePhoneNumber.prototype.getFavoriteDataForAppWithId = FavoritablePersonField.functions.getFavoriteDataForAppWithId;
FavoritablePhoneNumber.prototype.removeFavoriteDefaultForAppWithId = FavoritablePersonField.functions.removeFavoriteDefaultForAppWithId;
FavoritablePhoneNumber.prototype.removeAllFavoriteData = FavoritablePersonField.functions.removeAllFavoriteData;


//@ sourceURL=contacts/properties/PersonPhotos.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, PropertyBase, Utils, Future, IO, Assert, _, PalmCall, LIB_ROOT, palmGetResource, 
console, ContactPhoto, Person */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var photo = new PersonPhotos({ }); //TODO: fill out these params
 * 
 * var photoString = photo.getValue();
 * var photoStringAgain = photo.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var PersonPhotos = exports.PersonPhotos = PropertyBase.create({
	/**
	* @lends PersonPhotos#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "bigPhotoPath",
			defaultValue: "",
			/**
			* @name PersonPhoto#setBigPhotoPath
			* @function
			* @param {string} bigPhotoPath
			*/
			setterName: "setBigPhotoPath",
			/**
			* @name PersonPhoto#getBigPhotoPath
			* @function
			* @returns {string}
			*/
			getterName: "getBigPhotoPath"
		}, {
			dbFieldName: "squarePhotoPath",
			defaultValue: "",
			/**
			* @name PersonPhoto#setSquarePhotoPath
			* @function
			* @param {string} squarePhotoPath
			*/
			setterName: "setSquarePhotoPath",
			/**
			* @name PersonPhoto#getSquarePhotoPath
			* @function
			* @returns {string}
			*/
			getterName: "getSquarePhotoPath"
		}, {
			dbFieldName: "listPhotoPath",
			defaultValue: "",
			/**
			* @name PersonPhoto#setListPhotoPath
			* @function
			* @param {string} listPhotoPath
			*/
			setterName: "setListPhotoPath",
			/**
			* @name PersonPhoto#getListPhotoPath
			* @function
			* @returns {string}
			*/
			getterName: "getListPhotoPath"
		}, {
			dbFieldName: "listPhotoSource",
			defaultValue: "",
			/**
			* @name PersonPhoto#setListPhotoSource
			* @function
			* @param {string} listPhotoSource
			*/
			setterName: "setListPhotoSource",
			/**
			* @name PersonPhoto#getListPhotoSource
			* @function
			* @returns {string}
			*/
			getterName: "getListPhotoSource"
		}, {
			dbFieldName: "bigPhotoId",
			defaultValue: "",
			/**
			* @name PersonPhoto#setBigPhotoId
			* @function
			* @param {string} bigPhotoId
			*/
			setterName: "setBigPhotoId",
			/**
			* @name PersonPhoto#getBigPhotoId
			* @function
			* @returns {string}
			*/
			getterName: "getBigPhotoId"
		}, {
			dbFieldName: "squarePhotoId",
			defaultValue: "",
			/**
			* @name PersonPhoto#setSquarePhotoId
			* @function
			* @param {string} squarePhotoId
			*/
			setterName: "setSquarePhotoId",
			/**
			* @name PersonPhoto#getSquarePhotoId
			* @function
			* @returns {string}
			*/
			getterName: "getSquarePhotoId"
		}, {
			dbFieldName: "contactId",
			defaultValue: "",
			/**
			* @name PersonPhoto#setContactId
			* @function
			* @param {string} contactId
			*/
			setterName: "setContactId",
			/**
			* @name PersonPhoto#getContactId
			* @function
			* @returns {string}
			*/
			getterName: "getContactId"
		}, {
			dbFieldName: "accountId",
			defaultValue: "",
			/**
			* @name PersonPhoto#setAccountId
			* @function
			* @param {string} accountId
			*/
			setterName: "setAccountId",
			/**
			* @name PersonPhoto#getAccountId
			* @function
			* @returns {string}
			*/
			getterName: "getAccountId"
		}
	]
});

PersonPhotos.prototype.getListPhotoSourcePath = function () {
	return (this.getListPhotoSource() === PersonPhotos.TYPE.BIG) ? this.getBigPhotoPath() : this.getSquarePhotoPath();
};

PersonPhotos.prototype.getListPhotoSourceId = function () {
	return (this.getListPhotoSource() === PersonPhotos.TYPE.BIG) ? this.getBigPhotoId() : this.getSquarePhotoId();
};

/**
 * Returns a filepath to a photo that is guaranteed to exist on disk.  If disallowOtherTypes is 
 * false, then it falls back on another photo type (if possible), rather than refetching from the 
 * source.  Touches the file in the filecache before returning its path, so it hopefully doesn't 
 * get kicked out before the caller can use it
 */
PersonPhotos.prototype.getPhotoPath = function (photoType, disallowOtherTypes) {
	return PersonPhotos.getPhotoPath(this.getDBObject(), photoType, disallowOtherTypes);
};

/**
 * Returns a filepath to a photo that is guaranteed to exist on disk.  If disallowOtherTypes is 
 * false, then it falls back on another photo type (if possible), rather than refetching from the 
 * source.  Touches the file in the filecache before returning its path, so it hopefully doesn't 
 * get kicked out before the caller can use it
 */
PersonPhotos.getPhotoPath = function (rawPersonPhotos, photoType, disallowOtherTypes) {
	var future = new Future(),
		filePathToReturn;
	
	future.now(function () {
		var savePathFuture,
			filePath,
			similarPhotoType,
			sptFilePath,
			fileExists,
			photoId,
			i;
		
		photoType = photoType || PersonPhotos.TYPE.SQUARE;
		
		Assert.requireObject(rawPersonPhotos, "PersonPhotos.getPhotoPath requires an object for the rawPersonPhotos argument");
		Assert.requireString(photoType, "You must pass a valid photoType");
		Assert.require(photoType === PersonPhotos.TYPE.BIG || photoType === PersonPhotos.TYPE.SQUARE || photoType === PersonPhotos.TYPE.LIST, "You must pass a valid photoType");
		
		if (rawPersonPhotos.bigPhotoPath === "" && rawPersonPhotos.squarePhotoPath === "" && 
			rawPersonPhotos.listPhotoPath === "" && rawPersonPhotos.accountId === "") 
		{
			future.result = "";
			return;
		}
		
		if (!disallowOtherTypes) {
			//we can use any type, so let's go through all the types in order of similarity and see if any of them exist, while
			//refetching any that are missing
			for (i = 0; i < PersonPhotos.TYPE_SIMILARITIES[photoType].length; i += 1)
			{ 
				similarPhotoType = PersonPhotos.TYPE_SIMILARITIES[photoType][i];
				sptFilePath = PersonPhotos.getPhotoPathFromType(rawPersonPhotos, similarPhotoType);
				fileExists = PersonPhotos.fileExists(sptFilePath);
				if (sptFilePath && fileExists)
				{
					// Use this photo since it exists
					future.result = sptFilePath;
					return;
				}
				else if (sptFilePath)
				{
					// Refetch the missing photo
					future.nest(PersonPhotos._refetchPhoto(similarPhotoType, 
									rawPersonPhotos.accountId, 
									rawPersonPhotos.contactId, 
									PersonPhotos._getPhotoIdToRefetch(rawPersonPhotos, similarPhotoType)));
				}
				else if (photoType === similarPhotoType && rawPersonPhotos.accountId)
				{
					// If this is the phototype we want, and it doesn't have a path set but does have an accountId, try to do a refetch if we can
					photoId = PersonPhotos._getPhotoIdToRefetch(rawPersonPhotos, similarPhotoType);
					if (photoId)
					{
						// Refetch the missing photo
						future.nest(PersonPhotos._refetchPhoto(similarPhotoType, 
										rawPersonPhotos.accountId, 
										rawPersonPhotos.contactId, 
										photoId));
					}
				}
			}

			//else no photos existed, so photos were refetched in the above loop
			future.result = "";
			return;
		} else {
			//else we have to use the type specified, so get it and see if it exists
			filePath = PersonPhotos.getPhotoPathFromType(rawPersonPhotos, photoType);
			if (PersonPhotos.fileExists(filePath)) {
				future.result = filePath;
				return;
			} else {
				//if we're looking for a list photo, see if we can skip the server roundtrip by recropping it from the local copy of the big or square photo
				//this is very important for EAS, where the photos can't actually be downloaded again from the server
				if (photoType === PersonPhotos.TYPE.LIST) {
					//first, get the square photo and see if it exists - if it does, crop from it
					filePath = rawPersonPhotos.squarePhotoPath;
					if (!filePath || !PersonPhotos.fileExists(filePath)) {
						//if square didn't work, get the big photo and see if it exists - if it does, crop from it
						filePath = rawPersonPhotos.bigPhotoPath;
						if (!filePath || !PersonPhotos.fileExists(filePath)) {
							//if that didn't work, then set filePath to something falsy so we fall through into the "refetch from server" case
							filePath = "";
						}
					}
					
					//if we found a valid file to crop from, do the crop
					if (filePath) {
						savePathFuture = ContactPhoto.cropAndGetPath(filePath, {}, PersonPhotos.TYPE.LIST);

						// After getting the path, we need to save the path back to the person object
						savePathFuture.then(function () {
							rawPersonPhotos.listPhotoPath = savePathFuture.result;
							return Person.findByContactIds([rawPersonPhotos.contactId]);
						});
						savePathFuture.then(function () {
							var person = savePathFuture.result;
							person.getPhotos().reinitialize(rawPersonPhotos);
							person.save();
						});
						return savePathFuture;
					}
				}
			
				//at this point, we have to refetch it from the server
				//TODO: this is going to pass the big/square photo path through to the list view, if called with LIST/true.  This is bad.
				if (rawPersonPhotos.accountId && rawPersonPhotos.contactId)
				{
					future.nest(PersonPhotos._refetchPhoto(photoType, 
														rawPersonPhotos.accountId, 
														rawPersonPhotos.contactId,
														PersonPhotos._getPhotoIdToRefetch(rawPersonPhotos, photoType)));
				}
				return;
			}
		}
	});
	
	future.then(function () {
		//store the file path outside this function so that we can return it in the next future.then
		filePathToReturn = future.result;
		//console.log("\n\n\n---------------->>>>>>>>>>>>>>> filePathToReturn: " + Utils.stringify(filePathToReturn) + "\n\n\n");
		
		//optimization: touch the photo in the filecache so that it's less likely to be kicked out 
		//before the caller gets to use it
		if (filePathToReturn) {
			var innerFuture = PalmCall.call("palm://com.palm.filecache", "TouchCacheObject", {
				pathName: filePathToReturn
			});
			innerFuture.onError(function () {
				//this was just an optimization, so if there's an error let's log it and keep going
				console.warn("Ignoring error while touching filecache object.  The filepath we tried to touch: " + Utils.stringify(filePathToReturn));
				
				//now move the outer future along
				future.result = true;
			});
			future.nest(innerFuture);
		} else {
			future.result = true;
		}
	});
	
	future.then(function () {
		//touching the file was just an optimization, so we can ignore the results
		var dummy = future.result;
		
		//now return the actual path
		//console.log("\n\n\n---------------->>>>>>>>>>>>>>> PersonPhotos.getDefaultPhotoPathFromType(photoType): " + Utils.stringify(PersonPhotos.getDefaultPhotoPathFromType(photoType)) + "\n\n\n");
		future.result = filePathToReturn || PersonPhotos.getDefaultPhotoPathFromType(photoType);
	});
	
	return future;
};

PersonPhotos.getPhotoPathFromType = function (rawPersonPhotos, photoType) {
	Assert.requireObject(rawPersonPhotos, "PersonPhotos.getPhotoPathFromType requires an object for the rawPersonPhotos argument");
	Assert.requireString(photoType, "PersonPhotos.getPhotoPathFromType requires a string for the photoType argument");
	Assert.require(photoType === PersonPhotos.TYPE.BIG || photoType === PersonPhotos.TYPE.SQUARE || photoType === PersonPhotos.TYPE.LIST, 
		"PersonPhotos.getPhotoPathFromType requires either PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.BIG, or PersonPhotos.TYPE.LIST for the photoType argument");
	
	switch (photoType) {
	case PersonPhotos.TYPE.BIG:
		return rawPersonPhotos.bigPhotoPath;
	case PersonPhotos.TYPE.SQUARE:
		return rawPersonPhotos.squarePhotoPath;
	case PersonPhotos.TYPE.LIST:
		return rawPersonPhotos.listPhotoPath;
	}
};

PersonPhotos.getDefaultPhotoPathFromType = function (photoType) {
	Assert.requireString(photoType, "PersonPhotos.getDefaultPhotoPathFromType requires a string for the photoType argument");
	Assert.require(photoType === PersonPhotos.TYPE.BIG || photoType === PersonPhotos.TYPE.SQUARE || photoType === PersonPhotos.TYPE.LIST, 
		"PersonPhotos.getDefaultPhotoPathFromType requires either PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.BIG, or PersonPhotos.TYPE.LIST for the photoType argument");

	switch (photoType) {
	case PersonPhotos.TYPE.BIG:
		return PersonPhotos.DEFAULT_DETAILS_AVATAR;
	case PersonPhotos.TYPE.SQUARE:
		return PersonPhotos.DEFAULT_FAVORITES_AVATAR;
	case PersonPhotos.TYPE.LIST:
		return PersonPhotos.DEFAULT_LIST_AVATAR;
	}
};

PersonPhotos._getPhotoIdToRefetch = function (rawPersonPhotos, photoType) {
	Assert.requireObject(rawPersonPhotos, "PersonPhotos._getPhotoIdToRefetch requires an object for the rawPersonPhotos argument");
	Assert.requireString(photoType, "PersonPhotos._getPhotoIdToRefetch requires a string for the photoType argument");
	Assert.require(photoType === PersonPhotos.TYPE.BIG || photoType === PersonPhotos.TYPE.SQUARE || photoType === PersonPhotos.TYPE.LIST, 
		"PersonPhotos._getPhotoIdToRefetch requires either PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.BIG, or PersonPhotos.TYPE.LIST for the photoType argument");
	
	switch (photoType) {
	case PersonPhotos.TYPE.BIG:
		return rawPersonPhotos.bigPhotoId;
	case PersonPhotos.TYPE.SQUARE:
		return rawPersonPhotos.squarePhotoId;
	case PersonPhotos.TYPE.LIST:
		return (rawPersonPhotos.listPhotoSource === PersonPhotos.TYPE.BIG) ? rawPersonPhotos.bigPhotoId : rawPersonPhotos.squarePhotoId;
	}
};

PersonPhotos.fileExists = function (filePath) {
	Assert.requireString(filePath, "PersonPhotos.fileExists requires a string for the filePath argument");
	
	try {
		if (!palmGetResource(filePath))
		{
			return false;
		}
		return true;
	} catch (ex) {
		return false;
	}
};

PersonPhotos._refetchPhoto = function (photoType, accountId, contactId, photoId) {
	var future = new Future();
	
	future.now(function () {
		Assert.requireString(photoType, "PersonPhotos._refetchPhoto requires a string for the photoType argument");
		Assert.require(photoType === PersonPhotos.TYPE.BIG || photoType === PersonPhotos.TYPE.SQUARE || photoType === PersonPhotos.TYPE.LIST, 
			"PersonPhotos._refetchPhoto requires either PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.BIG, or PersonPhotos.TYPE.LIST for the photoType argument");
		Assert.requireString(accountId, "PersonPhotos._refetchPhoto requires a string for the accountId argument");
		Assert.requireString(contactId, "PersonPhotos._refetchPhoto requires a string for the contactId argument");
		Assert.requireString(photoId, "PersonPhotos._refetchPhoto requires a string for the photoId argument");
		
		//first get the account info so we can find out what bus address to talk to
		future.nest(PalmCall.call("palm://com.palm.service.accounts", "getAccountInfo", {
			accountId: accountId
		}));
	});
	
	future.then(function () {
		var result = future.result,
			account,
			contactsCapability;
		
		if (result && result.returnValue) {
			account = result.result;
			contactsCapability = Utils.getContactsCapabilityProvider(account);
			
			//now ping that bus address and get it to refetch the photo
			if (contactsCapability && contactsCapability.refetchPhoto) {
				future.nest(PalmCall.call(contactsCapability.refetchPhoto, "", {
					accountId: accountId,
					contactId: contactId,
					photoId: photoId
				}));
			} else {
				future.result = "";
			}
		} else {
			future.result = "";
		}
	});
	
	future.then(function () {
		var result = future.result;
		
		if (result && result.returnValue) {
			future.result = result.localPath;
		} else {
			future.result = "";
		}
	});
	
	return future;
};



Utils.defineConstant("DEFAULT_LIST_AVATAR", LIB_ROOT + "images/personlist_avatar.png", PersonPhotos);
Utils.defineConstant("DEFAULT_DETAILS_AVATAR", LIB_ROOT + "images/detail_avatar.png", PersonPhotos);
Utils.defineConstant("DEFAULT_FAVORITES_AVATAR", LIB_ROOT + "images/favorites_avatar.png", PersonPhotos);

Utils.defineConstant("LIST_PHOTO_WIDTH", 50, PersonPhotos);
Utils.defineConstant("LIST_PHOTO_HEIGHT", 50, PersonPhotos);
Utils.defineConstant("PHOTO_FILETYPE", "jpg", PersonPhotos);
Utils.defineConstant("LIST_PHOTO_FILECACHE_SIZE", 8192, PersonPhotos);

Utils.defineConstant("GOOGLE_PHOTO_WIDTH", 96, PersonPhotos);
Utils.defineConstant("GOOGLE_PHOTO_HEIGHT", 96, PersonPhotos);
Utils.defineConstant("BIG_PHOTO_WIDTH", 196, PersonPhotos);
Utils.defineConstant("BIG_PHOTO_HEIGHT", 196, PersonPhotos);
// I was able to produce some "big" photos that were up to 134kb by setting them from photos on the phone
// Thus, 150kb seems like a reasonable upper estimate
Utils.defineConstant("BIG_PHOTO_FILECACHE_SIZE", 150000, PersonPhotos); 

PersonPhotos.TYPE = Utils.defineConstants({
	BIG: "type_big",
	SQUARE: "type_square",
	LIST: "type_list"
});

PersonPhotos.TYPE_SIMILARITIES = (function () {
	var typeSimilarities = {};
	typeSimilarities[PersonPhotos.TYPE.BIG] = [PersonPhotos.TYPE.BIG, PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.LIST];
	typeSimilarities[PersonPhotos.TYPE.SQUARE] = [PersonPhotos.TYPE.BIG, PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.LIST];
	typeSimilarities[PersonPhotos.TYPE.LIST] = [PersonPhotos.TYPE.LIST, PersonPhotos.TYPE.SQUARE, PersonPhotos.TYPE.BIG];
	return typeSimilarities;
}());


//@ sourceURL=contacts/properties/ContactPhoto.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, Utils, exports, Date, Globalization, PalmCall, Future, Foundations, _, PersonPhotos, LIB_ROOT, Assert, console */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var photo = new ContactPhoto({}); //TODO: update this
 * 
 * var photoString = photo.getValue();
 * var photoStringAgain = photo.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var ContactPhoto = exports.ContactPhoto = PropertyBase.create({
	/**
	* @lends ContactPhoto#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name ContactPhoto#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name ContactPhoto#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}, {
			dbFieldName: "type",
			defaultValue: "type_square",
			/**
			* @name ContactPhoto#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name ContactPhoto#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		}, {
			dbFieldName: "primary",
			defaultValue: false,
			/**
			* @name ContactPhoto#setPrimary
			* @function
			* @param {string} primary
			*/
			setterName: "setPrimary",
			/**
			* @name ContactPhoto#getPrimary
			* @function
			* @returns {string}
			*/
			getterName: "getPrimary"
		}, {
			dbFieldName: "localPath",
			defaultValue: "",
			/**
			* @name ContactPhoto#setLocalPath
			* @function
			* @param {string} localPath
			*/
			setterName: "setLocalPath",
			/**
			* @name ContactPhoto#getLocalPath
			* @function
			* @returns {string}
			*/
			getterName: "getLocalPath"
		}
	]
});

//TODO: is there a better way to do this?
ContactPhoto.prototype.getId = function () {
	return this.getDBObject()._id;
};

/**
 * For the contact provided, return a valid filepath of the specified photoType (or any photo, if one of the specified type does not exist).
 * Contact must be wrapped.  Returns a future.
 */
ContactPhoto.getPhotoPath = function (contact, photoType) {
	var future = new Future();
	
	future.now(function () {
		var drawerPhotoPath,
			drawerPhotoId,
			photosArray,
			squarePhoto;
		
		photoType = photoType || ContactPhoto.TYPE.SQUARE;
		Assert.requireString(photoType, "ContactPhoto.attachPhotoPathsToContacts requires a string for the photoType argument");
		Assert.require(photoType === ContactPhoto.TYPE.BIG || photoType === ContactPhoto.TYPE.SQUARE, 
			"ContactPhoto.attachPhotoPathsToContacts requires either ContactPhoto.TYPE.SQUARE or ContactPhoto.TYPE.BIG for the photoType argument");
		
		if (contact.getPhotos() && contact.getPhotos().getArray()) {
			photosArray = contact.getPhotos().getArray();
			
			//if we have an array...
			if (photosArray && _.isArray(photosArray)) {
				//find the square one...
				squarePhoto = _.detect(photosArray, function (photo) {
					return photo.getType() === photoType;
				});
				//or just use the first one...
				squarePhoto = squarePhoto || photosArray[0];
				
				//if we have something, get the local path...
				if (squarePhoto) {
					drawerPhotoPath = squarePhoto.getLocalPath();
					drawerPhotoId = squarePhoto.getId();
				}
			}
		}
		
		if (drawerPhotoPath) {
			//if we have a photo, check to see if it exists
			if (PersonPhotos.fileExists(drawerPhotoPath)) {
				future.result = drawerPhotoPath;
				return;
			} else {
				//else it doesn't exist, so refetch the photo
				future.nest(PersonPhotos._refetchPhoto(photoType, contact.getAccountId().getValue(), contact.getId(), drawerPhotoId));
				return;
			}
		} else {
			//else we didn't find one, so use the default
			if (photoType === ContactPhoto.TYPE.BIG)
			{
				future.result = ContactPhoto.DEFAULT_BIG_PHOTO;
			}
			else
			{
				future.result = ContactPhoto.DEFAULT_SQUARE_PHOTO;
			}

			return;
		}
	});
	
	return future;
};

/**
 * For each contact provided, attach a valid filepath at contact[fieldName] of the specified photoType (or any photo, if one of the specified type does not exist).
 * Contacts must be wrapped.  Returns a future.
 */
ContactPhoto.attachPhotoPathsToContacts = function (contacts, photoType, fieldName) {
	var future = Foundations.Control.mapReduce({
		map: function (contact) {
			var future = new Future();
			
			future.now(function () {
				photoType = photoType || ContactPhoto.TYPE.SQUARE;
				Assert.requireString(photoType, "ContactPhoto.attachPhotoPathsToContacts requires a string for the photoType argument");
				Assert.require(photoType === ContactPhoto.TYPE.BIG || photoType === ContactPhoto.TYPE.SQUARE, 
					"ContactPhoto.attachPhotoPathsToContacts requires either ContactPhoto.TYPE.SQUARE or ContactPhoto.TYPE.BIG for the photoType argument");
				
				fieldName = fieldName || "drawerPhotoPath";
				Assert.requireString(fieldName, "ContactPhoto.attachPhotoPathsToContacts requires a string for the fieldName argument");
				
				future.nest(ContactPhoto.getPhotoPath(contact, photoType));
			});
			
			future.then(function () {
				contact[fieldName] = future.result;
				
				future.result = true;
			});
			
			return future;
		}
	}, contacts);
	
	return future;
};

ContactPhoto.cropAndGetPathToMediaInternal = function (fromPath, cropInfo, type, timingRecorderParam) {
	var destWidth = PersonPhotos.LIST_PHOTO_WIDTH,
		cropWidth = PersonPhotos.LIST_PHOTO_WIDTH,
		cropHeight = PersonPhotos.LIST_PHOTO_HEIGHT,
		size = PersonPhotos.LIST_PHOTO_FILECACHE_SIZE,
		fromFile,
		toPath,
		future = new Future(),
		cacheFuture;
	
	future.now(function () {
		if (type === ContactPhoto.TYPE.BIG) {
			destWidth = PersonPhotos.BIG_PHOTO_WIDTH;
			cropWidth = PersonPhotos.BIG_PHOTO_WIDTH;
			cropHeight = PersonPhotos.BIG_PHOTO_HEIGHT;
			size = PersonPhotos.BIG_PHOTO_FILECACHE_SIZE;
		}
		
		fromFile = fromPath.split("/");
		if ((fromFile.length - 1) >= 0) {
			fromFile = fromFile[fromFile.length - 1];
		} else {
			fromFile = "default." + PersonPhotos.PHOTO_FILETYPE;
		}
		
		toPath = "/media/internal/.contactphotos/";
		toPath += Date.now();
		toPath += "." + PersonPhotos.PHOTO_FILETYPE;

		//console.log("contact photo thumbnail to be saved to: " + toPath );
		// console.log("@@@@ cropAndGetPath: cropping image, w: " + cropWidth + ", h: " + cropHeight + ", source: " + fromPath + " toPath: " + toPath);
		
		var imageConvertParams = {
			src: fromPath,
			dest: toPath,
			destType: PersonPhotos.PHOTO_FILETYPE,
			focusX: cropInfo.focusX,
			focusY: cropInfo.focusY,
			scale: destWidth / cropInfo.suggestedXsize,
			cropW: cropWidth,
			cropH: cropHeight
		};
		
		return PalmCall.call("palm://com.palm.image", "convert", imageConvertParams);
	});
	
	future.then(function () {
		var result;
		
		try {
			result = future.result;	// read it to cause any exceptions to be thrown
		} catch (e) {
			throw e;
		}
		
		return toPath;
	});
	
	return future;
};


ContactPhoto.cropAndGetPath = function (fromPath, cropInfo, type, timingRecorderParam) {
	var destWidth = PersonPhotos.LIST_PHOTO_WIDTH,
		cropWidth = PersonPhotos.LIST_PHOTO_WIDTH,
		cropHeight = PersonPhotos.LIST_PHOTO_HEIGHT,
		size = PersonPhotos.LIST_PHOTO_FILECACHE_SIZE,
		toPath,
		future = new Future(),
		cacheFuture,
		timingRecorder = timingRecorderParam || {
			startTimingForJob: function () {
				
			},
			stopTimingForJob: function () {
				
			}
		}; // TODO: take me out when performance push is done!!!!;
	
	if (type === ContactPhoto.TYPE.BIG) {
		destWidth = PersonPhotos.GOOGLE_PHOTO_WIDTH; //PersonPhotos.BIG_PHOTO_WIDTH;
		cropWidth = PersonPhotos.GOOGLE_PHOTO_WIDTH; //PersonPhotos.BIG_PHOTO_WIDTH;
		cropHeight = PersonPhotos.GOOGLE_PHOTO_HEIGHT; //PersonPhotos.BIG_PHOTO_HEIGHT;
		size = PersonPhotos.BIG_PHOTO_FILECACHE_SIZE;
	}

	future.now(function () {
		
		var fromFile = fromPath.split("/");
		if ((fromFile.length - 1) >= 0) {
			fromFile = fromFile[fromFile.length - 1];
		} else {
			fromFile = "default." + PersonPhotos.PHOTO_FILETYPE;
		}
		
		timingRecorder.startTimingForJob("Fixup_Photos_FileCache_Insert");
		
		cacheFuture = PalmCall.call("palm://com.palm.filecache", 
			"InsertCacheObject", 
			{
				typeName: "contactphoto",
				size: size,
				fileName: fromFile,
				subscribe: true
			}
		);
		return cacheFuture;
	});
	
	future.then(function (result) {
		toPath = future.result.pathName;
		
		timingRecorder.stopTimingForJob("Fixup_Photos_FileCache_Insert");
		
		// console.log("@@@@ cropAndGetPath: cropping image, w: " + cropWidth + ", h: " + cropHeight + ", source: " + fromPath + " toPath: " + toPath);
		
		var imageConvertParams = {
			src: fromPath,
			dest: toPath,
			destType: PersonPhotos.PHOTO_FILETYPE
		};

		timingRecorder.startTimingForJob("Fixup_Photos_Image_Convert");

		if (type === PersonPhotos.TYPE.LIST) 
		{
			imageConvertParams.destSizeW = cropWidth;
			imageConvertParams.destSizeH = cropHeight;
			return PalmCall.call("palm://com.palm.image", "ezResize", imageConvertParams);
		}

		imageConvertParams.focusX = cropInfo.focusX;
		imageConvertParams.focusY = cropInfo.focusY;
		imageConvertParams.scale = destWidth / cropInfo.suggestedXsize;
		imageConvertParams.cropW = cropWidth;
		imageConvertParams.cropH = cropHeight;

		return PalmCall.call("palm://com.palm.image", "convert", imageConvertParams);
	});
	
	future.then(function () {
		var result;
		timingRecorder.stopTimingForJob("Fixup_Photos_Image_Convert");
		
		try {
			result = future.result;	// read it to cause any exceptions to be thrown
		} catch (e) {
			throw e;
		} finally {
			// need to cancel the futures even when an exception is thrown, otherwise the subscription never goes away
			// wow, that sounds like a bad sci fi novel!
			if (cacheFuture) {
				// cancel the subscription on the cached file now that we are done with it
				PalmCall.cancel(cacheFuture);
			}
		}
		
		return toPath;
	});
	
	return future;
};

ContactPhoto.expire = function (photoPath)
{
	var future;
	
	// console.log("@@@@ ContactPhoto.expire: expiring file cache object " + JSON.stringify(photoPath) + " type is " + typeof(photoPath));
	if (!photoPath) {
		return new Future({});	// not a photo?
	}
	future = PalmCall.call("palm://com.palm.filecache",
		"ExpireCacheObject", 
		{
			pathName: photoPath
		}
	);
	future.then(function () {
		try {
			var result = future.result;
			future.result = result;
		} catch (ex) {
			console.error("Exception when expiring photo at '" + photoPath + "': " + ex);
			future.result = {};
		}
	});
	return future;
};


Utils.defineConstant("DEFAULT_SQUARE_PHOTO", LIB_ROOT + "images/personlist_avatar.png", ContactPhoto);
Utils.defineConstant("DEFAULT_BIG_PHOTO", LIB_ROOT + "images/detail_avatar.png", ContactPhoto);

ContactPhoto.TYPE = Utils.defineConstants({
	BIG: PersonPhotos.TYPE.BIG,
	SQUARE: PersonPhotos.TYPE.SQUARE
});


//@ sourceURL=contacts/properties/PhoneNumberExtended.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global console, _, Class, PhoneNumber, PropertyBase, FavoritablePhoneNumber*/


/**
* @class
* @augments PhoneNumber
* @param {object} obj the raw database object
* @example
* var phone = new PhoneNumber({
*	value: "5555555555",
*	type: "mobile",
*	primary: false
* });
* 
* var phoneString = phone.getValue();
* var phoneStringAgain = phone.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
* var normalizedValue = phone.getNormalizedValue();
*/
var PhoneNumberExtended = PropertyBase.create({
	/**
	* @lends PhoneNumberExtended#
	* @property {string} x_normalizedValue
	* @property {string} x_speedDial
	*/
	superClass: FavoritablePhoneNumber,
	data: [
		{	// Override value so we can implement a beforeSet method that sets a boolean to
			// indicate that the normalizedValue needs to be generated.  If this 'true', we
			// will set the normalizedValue when getNormalizedValue() is called or getDBObject()
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name PhoneNumberExtended#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name PhoneNumberExtended#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue",
			beforeSet: function (value) {
				this.doGenerateNormalizedValue = true;
				return value;
			}
		},
		{
			dbFieldName: "normalizedValue",
			defaultValue: "",
			/**
			* @name PhoneNumberExtended#setNormalizedValue
			* @function
			* @param {string} value
			*/
			setterName: "setNormalizedValue",
			/**
			* @name PhoneNumberExtended#getNormalizedValue
			* @function
			* @returns {string}
			*/
			getterName: "getNormalizedValue",
			beforeGet: function (origNormalizedValue) {
				var normalizedValue = origNormalizedValue,
					value = this.getValue();
					
				// only generate the normalizedValue if the value has been set
				if (!value || this.doGenerateNormalizedValue) {
					normalizedValue = PhoneNumber.normalizePhoneNumber(value);
					this.setNormalizedValue(normalizedValue);
					this.doGenerateNormalizedValue = false;
				}
				return normalizedValue;
			}
		}, {
			dbFieldName: "speedDial",
			defaultValue: "",
			/**
			* @name PhoneNumberExtended#setSpeedDial
			* @function
			* @param {string} type
			*/
			setterName: "setSpeedDial",
			/**
			* @name PhoneNumberExtended#getSpeedDial
			* @function
			* @returns {string}
			*/
			getterName: "getSpeedDial"
		}
	]
});

PhoneNumberExtended.prototype._extendedGetDBObject = function (dbObject) {
	// make sure that the normalizedValue is up to date since we delay calculating it until it is read
	dbObject.normalizedValue = this.getNormalizedValue();
	return dbObject;
};

//@ sourceURL=contacts/properties/ReadOnly.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {boolean} obj the raw database object
 * @example
 * var readOnly = new ReadOnly(true);
 * 
 * var isReadOnly = readOnly.getValue();
 * var isReadOnlyAgain = readOnly.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var ReadOnly = PropertyBase.create({
	/**
	* @lends ReadOnly#
	* @property {boolean} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: false,
			/**
			* @name ReadOnly#setValue
			* @function
			* @param {boolean} value
			*/
			setterName: "setValue",
			/**
			* @name ReadOnly#getValue
			* @function
			* @returns {boolean}
			*/
			getterName: "getValue"
		}
	]
});

//@ sourceURL=contacts/properties/Relation.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, RB, console, _, Class, PropertyBase, Utils, Assert */

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var relation = new Relation({
 *	value: "Cindy",
 *	type: "Mother",
 *	primary: false
 * });
 * 
 */
var Relation = exports.Relation = PropertyBase.create({
	/**
	* @lends Relation#
	* @property {string} x_value The name of the person represented by this relation, as a string. This property is a defineGetter/defineSetter that calls getValue()/setValue()
	* @property {string} x_type The type string. This property is a defineGetter/defineSetter that calls getType()/setType()
	* @property {string} x_primary The primary string. This property is a defineGetter/defineSetter that calls getPrimary()/setPrimary()
	*/
	data: [
		{
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name Relation#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Relation#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}, {
			dbFieldName: "type",
			defaultValue: "",
			/**
			* @name Relation#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name Relation#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		}, {
			dbFieldName: "primary",
			defaultValue: false,
			/**
			* @name Relation#setPrimary
			* @function
			* @param {string} type
			*/
			setterName: "setPrimary",
			/**
			* @name Relation#getPrimary
			* @function
			* @returns {string}
			*/
			getterName: "getPrimary"
		}
	]
});

Relation.prototype.getNormalizedHashKey = function () {
	return this.getValue() + ":(|)" + this.getType();
};

Relation.prototype.equals = function (obj) {
	if (obj instanceof Relation) {
		return ((this.getValue() === obj.getValue()) && (this.getType() === obj.getType()) && (this.getPrimary() === obj.getPrimary()));
	}
	return false;
};

/**
 * @returns {string}
 */
Relation.prototype.getDisplayValue = function () {
	return this.getValue();
};

/** 
 * @name Relation#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Relation.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});

/**
 * @constant
 */
// prefixing these with "type_" to discourage direct display of these values
Relation.TYPE = Utils.defineConstants({
	ASSISTANT: "type_assistant",
	BROTHER: "type_brother",
	CHILD: "type_child",
	DOMESTIC_PARTNER: "type_domestic_partner",
	FATHER: "type_father",
	FRIEND: "type_friend",
	MANAGER: "type_manager",
	MOTHER: "type_mother",
	PARENT: "type_parent",
	PARTNER: "type_partner",
	REFERRED_BY: "type_referred_by",
	RELATIVE: "type_relative",
	SISTER: "type_sister",
	SPOUSE: "type_spouse",
	OTHER: "type_other"
});


//@ sourceURL=contacts/properties/Reminder.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class Reminder
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var reminder = new Reminder("Don't forget the eggs!!!");
 * 
 * var reminderString = reminder.getValue();
 * var reminderStringAgain = reminder.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Reminder = PropertyBase.create({
	/**
	* @lends Reminder#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Reminder#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Reminder#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

//@ sourceURL=contacts/properties/Ringtone.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class Ringtone
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var ringtone = new Ringtone({ name: "Awesome Ringtone", location: "/usr/ringtones/awesomeRingtone.mp3" });
 * 
 * var ringtoneNameString = ringtone.getName();
 * var ringtoneNameStringAgain = ringtone.x_name; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 * 
 * var ringtoneLocationString = ringtone.getLocation();
 * 
 */
var Ringtone = PropertyBase.create({
	/**
	* @lends Ringtone#
	* @property {string} x_name
	* @property {string} x_location
	*/
	data: [
		{
			dbFieldName: "name",
			defaultValue: "",
			/**
			* @name Ringtone#setName
			* @function
			* @param {string} value
			*/
			setterName: "setName",
			/**
			* @name Ringtone#getName
			* @function
			* @returns {string}
			*/
			getterName: "getName"
		}, {
			dbFieldName: "location",
			defaultValue: "",
			/**
			* @name Ringtone#setLocation
			* @function
			* @param {string} value
			*/
			setterName: "setLocation",
			/**
			* @name Ringtone#getLocation
			* @function
			* @returns {string}
			*/
			getterName: "getLocation"
		}
	]
});

//@ sourceURL=contacts/properties/SearchTerm.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var term = new SearchTerm("myTerm");
 * 
 * var termString = term.getValue();
 * var termStringAgain = term.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var SearchTerm = PropertyBase.create({
	/**
	* @lends SearchTerm#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name SearchTerm#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name SearchTerm#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

//@ sourceURL=contacts/properties/SimEntryType.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var simEntryType = new SimEntryType("adn");
 * 
 * var simEntryTypeString = simEntryType.getValue();
 * var simEntryTypeStringAgain = simEntryType.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var SimEntryType = PropertyBase.create({
	/**
	* @lends SimEntryType#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name SimEntryType#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name SimEntryType#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

//@ sourceURL=contacts/properties/SimIndex.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var simIndex = new SimIndex(1);
 * 
 * var simInt = simIndex.getValue();
 * var simIntAgain = simIndex.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var SimIndex = PropertyBase.create({
	/**
	* @lends SimIndex#
	* @property {int} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: -1,
			/**
			* @name SimIndex#setValue
			* @function
			* @param {int} value
			*/
			setterName: "setValue",
			/**
			* @name SimIndex#getValue
			* @function
			* @returns {int}
			*/
			getterName: "getValue"
		}
	]
});

//@ sourceURL=contacts/properties/SortKey.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, PropertyBase, Future, Assert, Person, AppPrefs, ListWidget, Utils, PalmCall, console, Globalization, RB */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var key = new SortKey("aaaabbbccdde1234");
 * 
 * var keyString = key.getValue();
 * var keyStringAgain = key.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var SortKey = exports.SortKey = PropertyBase.create({
	/**
	* @lends SortKey#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name SortKey#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name SortKey#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});


/**
 * Generates the sort key for the passed person (either wrapped or raw), first fetching the necessary params (if not passed in).  Does not store it on the person.
 * Returns a future, the result of which is also the sort key.
 */
SortKey.generateSortKey = function (person, optionalConfigParams) {
	var future = new Future(),
		configParams;
	
	//first, we get the list sort order if we weren't passed it
	future.now(function () {
		Assert.require(person, "SortKey.generateSortKey requires a person that is truthy");
		
		configParams = optionalConfigParams || {};
		
		if (configParams.listSortOrder) {
			return true;
		} else {
			var appPrefs = new AppPrefs(future.callback(function () {
				var dummy = future.result;
				
				//store away the listSortOrder
				configParams.listSortOrder = appPrefs.get(AppPrefs.Pref.listSortOrder);
				
				future.result = true;
			}));
		}
	});
	
	/*
	//then, we determine the correct value for shouldConvertToPinyin param, if we weren't passed it
	future.then(function () {
		var dummy = future.result,
			innerFuture;
		
		if (configParams.shouldConvertToPinyin !== undefined) {
			return true;
		} else {
			//fetch the value of shouldConvertToPinyin
			innerFuture = PalmCall.call("palm://com.palm.systemservice/", "getPreferences", {
				"keys": ["contactSort"]
			});
			//TODO: can this be put back in?  It causes things to not work properly if put in place...
			//innerFuture.then(function () {
			//	var result = innerFuture.result;
			//	PalmCall.cancel(innerFuture);
			//	innerFuture.result = result;
			//});
			return innerFuture;
		}
	});
	
	future.then(function () {
		var result = future.result;
				
		if (result && result.contactSort === "pinyin") {
			configParams.shouldConvertToPinyin = true;
		} else {
			//if we didn't make the request or it failed for some reason, we just assume false if we're not passed anything
			if (configParams.shouldConvertToPinyin === undefined) {
				configParams.shouldConvertToPinyin = false;
			}
		}
	});
	*/
	
	future.then(function () {
		var dummy = future.result;
		
		return SortKey._generateSortKeyFromSortOrder(person, configParams);
	});
	
	return future;
};

/**
 * Generates the sort key for the passed person (either wrapped or raw) according to the passed configParams.  Does not store it on the person.
 * Params:
 *     - listSortOrder: a string, one of the values at ListWidget.SortOrder (required)
 *     - shouldConvertToPinyin: true if the IME service exists on device and should be used to translate names from Chinese characters to pinyin, false otherwise (optional)
 * Returns a future, the result of which is the sort key.
 */
//TODO: combine this with the one above?
SortKey._generateSortKeyFromSortOrder = function (person, configParams) {
	var future = new Future(),
		givenName = "",
		familyName = "",
		companyName = "",
		displayName = "";
	
	future.now(function () {
		var name,
			company;
		
		Assert.require(person, "SortKey.generateSortKey requires a person that is truthy");
		Assert.requireObject(configParams, "SortKey.generateSortKey requires an object as the configParams");
		Assert.requireString(configParams.listSortOrder, "SortKey.generateSortKey requires a listSortOrder that is a string");
		//Assert.requireDefined(configParams.shouldConvertToPinyin, "SortKey.generateSortKey requires a shouldConvertToPinyin argument");
		
		if (person instanceof Person) {
			name = person.getName();
			if (name) {
				givenName = name.getGivenName() || "";
				familyName = name.getFamilyName() || "";
			}
			
			company = person.getOrganization();
			if (company) {
				companyName = company.getName() || "";
			}
			
			displayName = person.generateDisplayName() || "";
		} else {
			name = person.name;
			if (name) {
				givenName = name.givenName || "";
				familyName = name.familyName || "";
			}
			
			company = person.organization;
			if (company) {
				companyName = company.name || "";
			}
			
			displayName = Person.generateDisplayNameFromRawPerson(person) || "";
		}
		
		/*
		//if configParams.shouldConvertToPinyin, convert the sortkey fields from Chinese characters to pinyin
		if (configParams.shouldConvertToPinyin) {
			return SortKey._convertToPinyin(familyName, givenName, companyName, displayName);
		} else {
			return true;
		}
	});
	
	future.then(function () {
		var input = future.result,
			startRetrieveCandidateIndex, endRetrieveCandidateIndex;
		
		if (configParams.shouldConvertToPinyin) {
			// Go through each part of the result candidates array and pull out the section of the 
			// candidates array that should hold the given name part and
			// run that through our retrieveCandidateStringFromPinyinConversion function and get
			// the resulting string in pinyin.
			
			//testing, comment me out later
			//console.log(Utils.stringify(input));
			startRetrieveCandidateIndex = 0;
			endRetrieveCandidateIndex = familyName.length;
			familyName = SortKey._retrieveCandidateStringFromPinyinConversion(input.candidates.slice(startRetrieveCandidateIndex, endRetrieveCandidateIndex)); 
			
			startRetrieveCandidateIndex = endRetrieveCandidateIndex;
			endRetrieveCandidateIndex += givenName.length;
			givenName = SortKey._retrieveCandidateStringFromPinyinConversion(input.candidates.slice(startRetrieveCandidateIndex, endRetrieveCandidateIndex));
			
			startRetrieveCandidateIndex = endRetrieveCandidateIndex;
			endRetrieveCandidateIndex += companyName.length;
			companyName = SortKey._retrieveCandidateStringFromPinyinConversion(input.candidates.slice(startRetrieveCandidateIndex, endRetrieveCandidateIndex));
			
			startRetrieveCandidateIndex = endRetrieveCandidateIndex;
			endRetrieveCandidateIndex += displayName.length;
			displayName = SortKey._retrieveCandidateStringFromPinyinConversion(input.candidates.slice(startRetrieveCandidateIndex, endRetrieveCandidateIndex)); 
		}
		*/
		
		familyName = Globalization.Name.getSortName(familyName); //to sort "van der Muellen" under 'M'
		
		//TODO: get and use the basedOnField from Person.generateDisplayNameFromRawPerson and person.generateDisplayName 
		//		so that we don't use the display name if it's just the company name for persons with no first/last name
		//		(for persons that are just a company)
		return SortKey._generateSortKeyHelper(configParams, givenName, familyName, companyName, displayName);
	});
	return future;
};

/*
SortKey._retrieveCandidateStringFromPinyinConversion = function (candidates) {
	var toReturn = "";
	
	candidates.forEach(function (candidate) {
		if ("<unknown>" !== candidate) {
			toReturn = toReturn.concat(candidate);
		}
	});
	
	return toReturn;
};

//convert the unicode string to its pinyin value, input should be like "\u6885" for single character
//or "\u6885", "\u6778" for words.
SortKey._convertToPinyin = function (familyName, givenName, companyName, displayName) {
	var convertedCharacterArray = [],
		innerFuture;
	
	//familyName
	convertedCharacterArray = convertedCharacterArray.concat(SortKey._convertToPinyinHelper(familyName));
	
	//givenName	
	convertedCharacterArray = convertedCharacterArray.concat(SortKey._convertToPinyinHelper(givenName));
	
	//companyName
	convertedCharacterArray = convertedCharacterArray.concat(SortKey._convertToPinyinHelper(companyName));
	
	//displayName
	convertedCharacterArray = convertedCharacterArray.concat(SortKey._convertToPinyinHelper(displayName));
	
	//console.log("rui: the uniString to convert is" + arrayChar.toString());
	if (convertedCharacterArray.length > 0) {
		innerFuture = PalmCall.call("palm://com.palm.ime/", "lookupWords", {
			"unicode": convertedCharacterArray
		});
		innerFuture.then(function () {
			var result = innerFuture.result;
			PalmCall.cancel(innerFuture);
			innerFuture.result = result;
		});
		return innerFuture;
	} 
	
	return true;

};

SortKey._convertToPinyinHelper = function (stringToConvert) {
	var charArray = stringToConvert.split(""),
		toReturn = [],
		hexString = "\\u";
	
	charArray.forEach(function (character) {
		var charToPush = character;
		//if it's ASCII character, we don't use unicode string presentation, just
		//pass as is and expect IME to return as is
		
		if (character.charCodeAt(0) > 128) {
			charToPush = hexString.concat(character.charCodeAt(0).toString(16));
		} else {
			if (character === '"') {
				var charSpecial = "\\";
				charToPush = charSpecial.concat(character);
			}			
		}
		
		toReturn.push(charToPush);
	});
	
	return toReturn;
};
*/

/**
 * PRIVATE
 * Contains the actual logic for generating a sort key from various strings according to the passed list sort order.
 * Returns the sort key as a string.
 */
SortKey._generateSortKeyHelper = function (configParams, givenName, familyName, companyName, displayName) {
	var listSortOrder = configParams.listSortOrder,
		sortKey = "",
		sortKeyDefaultItem = SortKey.DEFAULT_CHAR + SortKey.DEFAULT_CHAR,
		sortKeyDelimiter = "\t",
		firstChar;
	
	givenName = givenName || "";
	familyName = familyName || "";
	companyName = companyName || "";
	displayName = displayName || "";
	
	givenName = givenName.trim();
	familyName = familyName.trim();
	companyName = companyName.trim();
	displayName = displayName.trim();
	
	//first, if the list order says to, append the company name
	if (listSortOrder === ListWidget.SortOrder.companyLastFirst || listSortOrder === ListWidget.SortOrder.companyFirstLast) {
		sortKey += companyName || sortKeyDefaultItem; //if they don't have a company name, sort them to the bottom using the sortKeyDefaultItem
		sortKey += sortKeyDelimiter;
	}
	
	//append either first/last (in the correct order) or the display name
	if (givenName || familyName) {
		if (listSortOrder === ListWidget.SortOrder.companyFirstLast || listSortOrder === ListWidget.SortOrder.firstLast) {
			if (givenName) {
				sortKey += givenName + sortKeyDelimiter;
			}
			if (familyName) {
				sortKey += familyName + sortKeyDelimiter;
			}
		} else {
			//if (listSortOrder === ListWidget.SortOrder.companyLastFirst || listSortOrder === ListWidget.SortOrder.lastFirst)
			//this is the default (ListWidget.SortOrder.lastFirst)
			if (familyName) {
				sortKey += familyName + sortKeyDelimiter;
			}
			if (givenName) {
				sortKey += givenName + sortKeyDelimiter;
			}
		}
	} else {
		sortKey += displayName + sortKeyDelimiter;
	}
	
	sortKey = sortKey.trim();
	//if we have a sortKey at this point, see if we need to prepend the SortKey.DEFAULT_CHAR so that numbered items fall to the bottom.
	//else, generate a default sortKey
	if (sortKey) {
		firstChar = sortKey.charAt(0);
		if (firstChar !== SortKey.DEFAULT_CHAR && firstChar !== sortKeyDelimiter && !Globalization.Character.isLetter(firstChar)) {
			sortKey = SortKey.DEFAULT_CHAR + sortKey;
		}
	} else {
		sortKey = sortKeyDefaultItem;
	}
	
	return sortKey.toLocaleLowerCase().trim();
};

Utils.defineConstant("DEFAULT_CHAR", "\uFAD7", SortKey);
Utils.defineConstant("DEFAULT_NAME_DIVIDER_TEXT", "#", SortKey);
Utils.defineConstant("DEFAULT_COMPANY_DIVIDER_TEXT", RB.$L("None"), SortKey);


//@ sourceURL=contacts/properties/SpeedDialHash.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase, Assert, Crypto*/

/**
 * @class
 * @augments PropertyBase
 * @param string obj the raw database object
 * @example
 * var speedDialHash = new SpeedDialHash({"hashedPhoneNumber": "faw789a943fkjaf", "key": "k"});
 * 
 * var speedDialHashKey = speedDialHash.getKey();
 * var SpeedDialHashKeyAgain = speedDialHash.x_key; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var SpeedDialHash = PropertyBase.create({
	/**
	* @lends SpeedDialHash#
	* @property string x_value
	*/
	data: [
		{
			dbFieldName: "hashedPhoneNumber",
			defaultValue: null,
			/**
			* Only call this method when you pre-md5ied the value. If you want
			* to set the value without having to md5 it, call SpeedDialHash#setPlainValue
			* @name SpeedDialHash#setValue
			* @function
			* @param string value
			*/
			setterName: "setHashedPhoneNumber",
			/**
			* @name SpeedDialHash#getValue
			* @function
			* @returns string
			*/
			getterName: "getHashedPhoneNumber"
		}, {
			dbFieldName: "key",
			defaultValue: null,
			/**
			* @name DefaultPropertyHash#setKey
			* @function
			* @param string key
			*/
			setterName: "setKey",
			/**
			* @name DefaultPropertyHash#getKey
			* @function
			* @returns string
			*/
			getterName: "getKey"
		}
	]
});

/**
* @param {SpeedDialHash} value
* @returns boolean
*/
SpeedDialHash.prototype.equals = function (value) {
	if (value instanceof SpeedDialHash) {
		return this.getHashedPhoneNumber() === value.getHashedPhoneNumber() && this.getKey() === value.getKey();
	}
	return false;
};

/**
* Sets the hashedPhoneNumber of the SpeedDialHash. SpeedDialHash have values that are md5s.
* This method allows you to set the value without having to calculate the md5 for it. You
* should always call this method and not md5 it before hand.
* @param {string} value - the value for this SpeedDialHash.
*/
SpeedDialHash.prototype.setPlainValue = function (value) {
	this.setHashedPhoneNumber(value ? Crypto.MD5.b64_md5(value) : null);
};

SpeedDialHash.prototype.isPlainValueEqual = function (value) {
	return value ? (Crypto.MD5.b64_md5(value) === this.getHashedPhoneNumber()) : (value === this.getHashedPhoneNumber());
};

//@ sourceURL=contacts/properties/SyncSource.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global console, _, Class, PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var source = new SyncSource({
 *	name: "google",
 *	extended: {}
 * });
 * 
 * var sourceString = source.getName();
 * var sourceStringAgain = key.x_name; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var SyncSource = PropertyBase.create({
	/**
	* @lends SyncSource#
	* @property {string} x_name
	* @property {object} x_extended
	*/
	data: [
		{
			dbFieldName: "name",
			defaultValue: null,
			/**
			* @name SyncSource#setName
			* @function
			* @param {string} name
			*/
			setterName: "setName",
			/**
			* @name SyncSource#getName
			* @function
			* @returns {string}
			*/
			getterName: "getName"
		}, {
			dbFieldName: "extended",
			defaultValue: {},
			/**
			* @name SyncSource#setExtended
			* @function
			* @param {object} extended
			*/
			setterName: "setExtended",
			/**
			* @name SyncSource#getExtended
			* @function
			* @returns {object}
			*/
			getterName: "getExtended"
		}
	]
});

SyncSource.prototype.equals = function (obj) {
	if (obj instanceof SyncSource) {
		return (this.getName() === obj.getName());
	} 
	return false;
};

//@ sourceURL=contacts/properties/Tag.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global PropertyBase*/

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var tag = new Tag("cool");
 * 
 * var tagString = tag.getValue();
 * var tagStringAgain = tag.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Tag = PropertyBase.create({
	/**
	* @lends Tag#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name Tag#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Tag#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});

//@ sourceURL=contacts/properties/Url.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, PropertyBase, Utils, RB */

/**
 * @class
 * @augments PropertyBase
 * @param {object} obj the raw database object
 * @example
 * var url = new URL({
 *	value: "http://www.palm.com",
 *	type: "",
 *	primary: false
 * });
 * 
 * var urlString = url.getValue();
 * var urlStringAgain = url.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var Url = exports.Url = PropertyBase.create({
	/**
	* @lends Url#
	* @property {string} x_value
	* @property {string} x_type
	* @property {string} x_primary
	*/
	data: [
		{
			dbFieldName: "value",
			defaultValue: "",
			/**
			* @name Url#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name Url#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}, {
			dbFieldName: "type",
			defaultValue: "",
			/**
			* @name Url#setType
			* @function
			* @param {string} type
			*/
			setterName: "setType",
			/**
			* @name Url#getType
			* @function
			* @returns {string}
			*/
			getterName: "getType"
		}, {
			dbFieldName: "primary",
			defaultValue: false,
			/**
			* @name Url#setPrimary
			* @function
			* @param {string} primary
			*/
			setterName: "setPrimary",
			/**
			* @name Url#getPrimary
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
Url.prototype.getDisplayValue = function () {
	return this.getValue().toLocaleLowerCase();
};

/** 
 * @name Url#x_displayValue
 * @property 
 * @type string
 * @description defineGetter that calls this.getDisplayValue()
 */
Url.prototype.__defineGetter__("x_displayValue", function () {
	return this.getDisplayValue();
});


/*
//TODO: use this somehow for the app?
ContactPointDecorator.urlFormatter = function (url) {
	//    if (url.hasBeenFormatted) {
	//        return url;
	//    }
	url.type = "web";
	if (url.url && url.url.indexOf("http") !== 0) {
		url.url = "http://" + url.url;
	}
	url.hasBeenFormatted = true;
	return url;
};*/


/**
 * @constant
 */
// prefixing these with "type_" to discourage direct display of these values
Url.TYPE = Utils.defineConstants({
	HOME: "type_home",
	HOMEPAGE: "type_homepage",
	BLOG: "type_blog",
	FTP: "type_ftp",
	PROFILE: "type_profile",
	WORK: "type_work",
	OTHER: "type_other"
});

Url.prototype.getNormalizedHashKey = function () {
	return this.getValue().toLowerCase();
};

Url.Labels = Utils.createLabelFunctions([{
	value: Url.TYPE.HOME,
	displayValue: RB.$L('Home'),
	isPopupLabel: false
}, {
	value: Url.TYPE.HOMEPAGE,
	displayValue: RB.$L('Homepage'),
	isPopupLabel: false
}, {
	value: Url.TYPE.BLOG,
	displayValue: RB.$L('Blog'),
	isPopupLabel: false
}, {
	value: Url.TYPE.FTP,
	displayValue: RB.$L('FTP'),
	isPopupLabel: false
}, {
	value: Url.TYPE.PROFILE,
	displayValue: RB.$L('Profile'),
	isPopupLabel: false
}, {
	value: Url.TYPE.WORK,
	displayValue: RB.$L('Work'),
	isPopupLabel: false
}, {
	value: Url.TYPE.OTHER,
	displayValue: RB.$L('Other'),
	isPopupLabel: false
}]);

//@ sourceURL=contacts/AppPrefs.js

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


//@ sourceURL=contacts/Contact.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, Assert, JSON, Utils, DB, PalmCall, Person, Name, PropertyArray, Account, Address, 
Anniversary, Birthday, ContactId, DisplayName, EmailAddress, Gender, IMAddress, Nickname, Note, Organization, 
PhoneNumber, ContactPhoto, ReadOnly, SyncSource, Tag, Url, Relation, ContactFactory, ContactType, AccountId, Future, console, ContactLinkable */

var Contact = exports.Contact = Class.create({
	initialize: function (obj) {
		if (!obj) {
			obj = {};
		}
		
		var hasDatabaseId = !!obj._id,
			constructedFromPerson = obj instanceof Person,
			rawContact = (!constructedFromPerson ? obj : {}),
			_origData = (constructedFromPerson ? obj.getDBObject() : rawContact),
			_data = {
				_kind: rawContact._kind || Contact.kind,
				_id: rawContact._id,
				_rev: rawContact._rev,
				_del: rawContact._del,
				remoteId: rawContact.remoteId,
				accounts: Utils.lazyWrapper(PropertyArray, [Account, rawContact.accounts, hasDatabaseId]),
				accountId: Utils.lazyWrapper(AccountId, [rawContact.accountId, hasDatabaseId]),
				addresses: Utils.lazyWrapper(PropertyArray, [Address, rawContact.addresses, hasDatabaseId]),
				anniversary: Utils.lazyWrapper(Anniversary, [rawContact.anniversary, hasDatabaseId]),
				birthday: Utils.lazyWrapper(Birthday, [rawContact.birthday, hasDatabaseId]),
				displayName: Utils.lazyWrapper(DisplayName, [rawContact.displayName, hasDatabaseId]),			// for transport use ONLY
				emails: Utils.lazyWrapper(PropertyArray, [EmailAddress, rawContact.emails, hasDatabaseId]),
				gender: Utils.lazyWrapper(Gender, [rawContact.gender, hasDatabaseId]),
				ims: Utils.lazyWrapper(PropertyArray, [IMAddress, rawContact.ims, hasDatabaseId]),
				name: Utils.lazyWrapper(Name, [rawContact.name, hasDatabaseId]),
				nickname: Utils.lazyWrapper(Nickname, [rawContact.nickname, hasDatabaseId]),
				note: Utils.lazyWrapper(Note, [rawContact.note, hasDatabaseId]),
				organizations: Utils.lazyWrapper(PropertyArray, [Organization, rawContact.organizations, hasDatabaseId]),
				phoneNumbers: Utils.lazyWrapper(PropertyArray, [PhoneNumber, rawContact.phoneNumbers, hasDatabaseId]),
				photos: Utils.lazyWrapper(PropertyArray, [ContactPhoto, rawContact.photos, hasDatabaseId]),
				syncSource: Utils.lazyWrapper(SyncSource, [rawContact.syncSource, hasDatabaseId]),
				tags: Utils.lazyWrapper(PropertyArray, [Tag, rawContact.tags, hasDatabaseId]),
				urls: Utils.lazyWrapper(PropertyArray, [Url, rawContact.urls, hasDatabaseId]),
				relations: Utils.lazyWrapper(PropertyArray, [Relation, rawContact.relations, hasDatabaseId])
			};

		this.accessor = function (fieldName) {
			var field = _data[fieldName];
			Assert.requireDefined(fieldName, "fieldName must be specified for the accessor");
			//Assert.require(field, "the field you requested does not exist: _data[" + fieldName + "]");
			
			if (field && typeof field === "object" && field.isLazyWrapper) {
				field = _data[fieldName] = field.createInstance();
			}
			
			return field;
		};
		
		this.setId = function (id) {
			_data._id = id;
		};
		
		this.setRev = function (rev) {
			_data._rev = rev;
		};
		
		this.setKind = function (kind) {
			_data._kind = kind;
		};
		
		// Only to be used for subclasses to add properties to the data object
		this._extendWithPropertyAndValue = function (propertyName, value) {
			_data[propertyName] = value;
		};
		
		// This converts the person into a database writable object
		// calls getDBObjects on all properties
		this.getDBObject = function () {
			var newData = Utils.getDBObjectForAllProperties(this.accessor, _.keys(_data));
			return _.extend(_origData, newData);
		};
		this.getDirtyDBObject = function () {
			var newData = _.extend(_origData, Utils.getDBObjectForAllDirtyProperties(this.accessor, _.keys(_data)));
			if (newData._rev) {
				delete newData._rev;
			}
			return newData;
		};

		if (constructedFromPerson) {
			this.populateFromPerson(obj);
		}
	},
	
	
	
	// This is intended to be used for UI hacks.
	// Example: linking in the contacts details view. We need to
	// temporarily show an entry in the linked contacts list
	// until the backend can notify us to update
	populateFromPerson: function (person) {
		Assert.requireDefined(person, "populateFromPerson requires a person argument");
		Assert.require(person instanceof Person, "populateFromPerson requires a person argument that is a child of Person");
		
		this.getOrganizations().set(person.getOrganization());
		this.getName().set(person.getName());
		this.getNickname().setValue(person.getNickname().getValue());
		this.getEmails().set(person.getEmails().getArray());
		this.getIms().set(person.getIms());
		this.getPhoneNumbers().set(person.getPhoneNumbers());
		// TODO: add these when this data is available on person
		//this.getPhotos().set(person.getPhotos());
		//this.getUrls().set(person.getUrls());
		//this.getBirthday().set(person.getBirthday());
		//this.getAnniversary().set(person.getAnniversary());
		//this.getNotes().set(person.getNotes());
		
		return true;
	},
	
	addContactDataFromPerson: function (person) {
		Assert.requireDefined(person, "populateFromPerson requires a person argument");
		Assert.require(person instanceof Person, "populateFromPerson requires a person argument that is a child of Person");
		
		// add as raw objects to force validation to strip things off like normalizedValue
		this.getOrganizations().add(person.getOrganization().getDBObject());
		this.getEmails().add(person.getEmails().getDBObject());
		this.getIms().add(person.getIms().getDBObject());
		this.getPhoneNumbers().add(person.getPhoneNumbers().getDBObject());
		return true;
	},

	getKind: function () {
		return this.accessor("_kind");
	},
	
	getId: function () {
		return this.accessor("_id");
	},
	
	getRev: function () {
		return this.accessor("_rev");
	},
	
	getRemoteId: function () {
		return this.accessor("remoteId");
	},
	
	markedForDelete: function () {
		return this.accessor("_del") || false;
	},
	
	getAccountId: function () {
		return this.accessor("accountId");
	},
	
	getAccounts: function () {
		return this.accessor("accounts");
	},
	
	getAddresses: function () {
		return this.accessor("addresses");
	},
	
	getAnniversary: function () {
		return this.accessor("anniversary");
	},
	
	getBirthday: function () {
		return this.accessor("birthday");
	},
	
	getEmails: function () {
		return this.accessor("emails");
	},
	
	getGender: function () {
		return this.accessor("gender");
	},
	
	getIms: function () {
		return this.accessor("ims");
	},
	
	getName: function () {
		return this.accessor("name");
	},
	
	getNickname: function () {
		return this.accessor("nickname");
	},
	
	getNote: function () {
		return this.accessor("note");
	},
	
	getOrganizations: function () {
		return this.accessor("organizations");
	},
	
	getPhoneNumbers: function () {
		return this.accessor("phoneNumbers");
	},
	
	getPhotos: function () {
		return this.accessor("photos");
	},
	
	getSyncSource: function () {
		return this.accessor("syncSource");
	},
	
	getTags: function () {
		return this.accessor("tags");
	},
	
	getUrls: function () {
		return this.accessor("urls");
	},
	
	getRelations: function () {
		return this.accessor("relations");
	},
	
	/*getAccountName: function (cachedAccounts) {
		var accountId = this.getAccountId(),
			tempAccountName = cachedAccounts[accountId],
			future = new Future();
		
		if (tempAccountName) {
			future.result = tempAccountName;
		} else if (accountId) {
			future.nest(DB.get([accountId]));
			
			future.then(this, function () {
				var result = future.result,
					capabilities,
					contactsCapability;
					
				if (result) {
					capabilities = result.capabilityProviders;
					if (capabilities) {
						contactsCapability = _.detect(capabilities, function (capability) { 
								return capability.capability === "CONTACTS"; 
							});
						
						if (contactsCapability) {
							cachedAccounts[accountId] = contactsCapability.id;
							future.result = contactsCapability.id;
							return;
						} 
					}
				}
				
				future.result = "";
				return;
			});
		} else {
			future.result = "";
		}
		
		return future;
	},*/
	
	getKindName: function (includeVersion) {
		var toReturn = this.getKind() || "";
		
		if (!includeVersion) {
			toReturn = toReturn.split(":")[0];
		}
		
		return toReturn;
	},
	
	// TODO: check the end date if it has one
	getBestOrganization: function () {
		var orgs = this.getOrganizations().getArray(),
			i,
			org,
			bestOrg = null;
		
		for (i = 0; i < orgs.length; i = i + 1) {
			org = orgs[i];
			if (!bestOrg) {
				bestOrg = org;
				if (bestOrg.getName() && bestOrg.getTitle()) {
					break;
				}
			} else {
				
				
				if ((org.getName() && org.getTitle()) ||
					(!bestOrg.getName() && org.getName()) || 
					(!bestOrg.getName() && !bestOrg.getTitle() && org.getTitle())) {
					bestOrg = org;
				}
			}
		}
		
		return bestOrg;
	},
	
	generateWorkInfoLine: function () {
		var arr = [],
			org = this.getBestOrganization(),
			orgTitle = "",
			orgName = "";
		
		if (org) {
			orgTitle = org.getTitle();
			orgName = org.getName();
			
			if (orgTitle) {
				arr.push(orgTitle);
			}
			
			if (orgName) {
				arr.push(orgName);
			}
		}
		
		return arr.join(", ");
	},
	
	generateDisplayName: function (includeBasedOnField) {
		return Utils.generateDisplayName(this, includeBasedOnField);
	},
		
	clearPhotos: function () {
		var future = new Future();
		
		future.now(this, function () {
			var innerFuture,
				photos,
				i,
				localPath,
				expireFunction = function (futureSoBrightIGottaWearShades, localPath) {
					try {
						var dummy = futureSoBrightIGottaWearShades.result;
					} catch ( e ) {
						console.error(e);
					}
					if (localPath && typeof(localPath) === "string" && localPath.indexOf("/var") === 0) {
						// console.log("@@@@ Contact.clearPhotos: expiring file " + localPath);
						futureSoBrightIGottaWearShades.nest(ContactPhoto.expire(localPath));
					}
					return true;
				};
			
			// first expire anything in the file cache
			innerFuture = new Future({});
			photos = this.getPhotos().getArray();
			for (i = 0; i < photos.length; i += 1) {
				innerFuture.then(expireFunction.bind(this, innerFuture, photos[i].getLocalPath()));
			}
			
			return innerFuture;
		});

		future.then(this, function () {
			// then actually clear the photos array
			var dummy;
			try {
				dummy = future.result;
			} catch ( e ) {
				console.error(e);
			}
			this.getPhotos().clear();
			return dummy;
		});
		
		return future;
	},
	
	deleteContact: function () {
		var id = this.getId(),
			future = new Future();
		
		Assert.requireDefined(id, "deleteContact unable to delete, there is no _id param");
		
		// if the contact is a SIM contact, use the sim service to delete it
		if (this.getKindName() === "com.palm.contact.sim") {
			future.now(this, function () {
				return PalmCall.call("palm://com.palm.service.contacts.sim/", "deleteContact", {
					"contact": this.getDBObject()
				});
			});

			future.then(this, function () {
				var dummy = future.result;
				PalmCall.cancel(future);
				return this.clearPhotos();
			});
			
		} else {
			future.now(this, function () {
				return this.clearPhotos();
			});
		}
		
		future.then(this, function () {
			var dummy = future.result;
			return DB.del([id]);
		});
		
		return future;
	},
	
	save: function () {
		var future;
		
		// if the contact is a SIM contact, use the sim service to save it
		if (this.getKindName() === "com.palm.contact.sim") {
			future = PalmCall.call("palm://com.palm.service.contacts.sim/", "saveContact", {
				"contact": this.getDBObject()
			});
			
			future.then(this, function () {
				var dummy = future.result;
				PalmCall.cancel(future);
				future.result = true;
			});
		}
		else {
			// if this object has a DB _id then use merge
			if (this.getId()) {
				future = DB.merge([this.getDirtyDBObject()]);
			}
			else {
				future = DB.put([this.getDBObject()]);
			}

			future.then(this, function (future) {
				var result = Utils.DBResultHelper(future.result);
				Assert.require(result, "Contact save put - result is null");
				Assert.requireArray(result, "Contact save");
				Assert.require(result.length, "Contact save put - result length is zero");
				this.setId(result[0].id);
				this.setRev(result[0].rev);
				this.markNotDirty();
				future.result = true;
			});
		}		
		return future;
	},
	
	toString: function () {
		return JSON.stringify(this.getDBObject());
	},
	
	isDirty: function () {
		return Utils.callFunctionsOnProperties(this.accessor, Contact.PROPERTIES.objects, "isDirty", Contact.PROPERTIES.arrays, "containsDirtyEntry");
	},
	
	markNotDirty: function () {
		Utils.callFunctionsOnProperties(this.accessor, Contact.PROPERTIES.objects, "markNotDirty", Contact.PROPERTIES.arrays, "markElementsNotDirty");
	},
	
	// For the time being I am calling equals on each of the contact properties by hand.
	// It would be cool if we had an easy way to iterate over all of them.
	equals: function (otherContact) {
		var isEqual = true,
			i,
			j,
			tempArray,
			otherTempArray,
			property = "",
			properties = Contact.PROPERTIES.objects,
			propertyArrays = Contact.PROPERTIES.arrays;
		
		Assert.require(otherContact instanceof Contact, "The object passed into equals must be an instance of Contact");
		
		for (i = 0; i < properties.length; i += 1) {
			property = properties[i];
			isEqual = isEqual && this.accessor(property).equals(otherContact.accessor(property));
		}
		
		for (j = 0; j < propertyArrays.length; j += 1) {
			property = propertyArrays[j];
			tempArray = this.accessor(property).getArray();
			otherTempArray = otherContact.accessor(property).getArray();
			
			for (i = 0; i < tempArray.length; i += 1) {
				isEqual = isEqual && tempArray[i].equals(otherTempArray[i]);
			}
		}
		
		return isEqual;
	},
	
	/**
	 * Set a cropped version of the given photo into the contact. This method will 
	 * automatically crop and scale the images to the correct size for photo type. The type 
	 * parameter must be one of sizes found in ContactPhoto.TYPE. The contact must be
	 * saved after this method is done in order to write the results out to the database.
	 * 
	 * @param path the path to the source image
	 * @param cropInfo cropping info used to generate the proper thumbnail
	 * @param photoType one of ContactPhoto.TYPE constants
	 * @returns future the future object that performs the cropping/scaling asynchronously.
	 * The future eventually returns the path name to the cropped version of the image. 
	 */
	setCroppedContactPhoto: function (path, cropInfo, photoType) {
		var future = new Future(),
			photos,
			croppedPath;
		
		future.now(this, function () {
			var i,
				photo,
				innerFuture,
				localPath,
				expireFunction = function (brightNewFuture, localPath) {
					try {
						var dummy = brightNewFuture.result;
					} catch ( e ) {
						console.error(e);
					}
					if (localPath && typeof(localPath) === "string" && localPath.indexOf("/var") === 0) {
						// console.log("@@@@ Contact.setCroppedContactPhoto: expiring file " + localPath);
						brightNewFuture.nest(ContactPhoto.expire(localPath));
					}
					return true;
				};
			
			photos = this.getPhotos().getArray();
			
			innerFuture = new Future({});
			for (i = photos.length - 1; i >= 0; i -= 1) {
				photo = photos[i];
				if (photo.getType() === photoType) {
					innerFuture.then(expireFunction.bind(this, innerFuture, photos[i].getLocalPath()));
					photos.splice(i, 1);
				}
			}
			
			future.nest(innerFuture);
		});

		future.then(this, function () {
			try {
				var dummy = future.result;
			} catch ( e ) {
				console.error(e);
			}

			return PalmCall.call("palm://com.palm.service.accounts", "getAccountInfo", {
				accountId: this.getAccountId().getValue()
			});
		});
		
		future.then(this, function () {
			var template,
				innerFuture;
			try {
				template = future.result.result.templateId;
			} catch ( e ) {
				console.error(e);
			}

			if (template === "com.palm.palmprofile")
			{
				// In the case of a palmprofile photo, we don't want to reference the original photo
				// so we set the "value" (in addition to "localPath") to the newly generated image 
				innerFuture = ContactPhoto.cropAndGetPathToMediaInternal(path, cropInfo, photoType);
				innerFuture.then(this, function () {
					path = innerFuture.result;
					return path;
				});
				return innerFuture;
			}
			else
			{
				return ContactPhoto.cropAndGetPath(path, cropInfo, photoType);
			}
		});
		
		future.then(this, function () {
			var contactPhoto,
			croppedPath = future.result;
			
			//console.log("@@@@ Contact.setCroppedContactPhoto: cropping done. path is " + croppedPath);
			//TODO: what do we save for the value?  Palm Profile needs the local source path as the value, but other sync engines need <xyz> remote path? Yes.
			contactPhoto = new ContactPhoto({
				value: path,
				localPath: croppedPath,
				type: photoType
			});
			
			contactPhoto.forceMarkDirty();		// yes, it's dirty, but it's not porn
			photos.splice(0, 0, contactPhoto);
			
			this.getPhotos().set(photos);
			
			return croppedPath;
		});
		
		return future;
	},
	
	//This is the workaround for babelfish-blowfish data migration
	//This function is called after the Person has the tmp_speedDial migrated to speedDial
	//both Person and Contact will strip the tmp_speedDial from its record
	stripTmpPhoneNumberField: function () {
		var i,
			phoneNumber,
			phoneNumbers = this.getPhoneNumbers().getDBObject(); 
		if (phoneNumbers) {
			this.getPhoneNumbers().clear();//clear the contact phone number
			for (i = 0; i < phoneNumbers.length; i += 1) {
				this.getPhoneNumbers().add(new PhoneNumber());
				phoneNumber = this.getPhoneNumbers().getArray()[i];
				phoneNumber.setValue(phoneNumbers[i].value ? phoneNumbers[i].value : phoneNumber.getValue());
				phoneNumber.setType(phoneNumbers[i].type ? phoneNumbers[i].type : phoneNumber.getType());
				if (phoneNumbers[i].primary) {
					phoneNumber.setPrimary(phoneNumbers[i].primary);
				}
			}
		}	
	}		
});

/**
 * The DB kind string for the Contact object
 * @name Contact.kind
 * @property {string} kind 
 */
Utils.defineConstant("kind", "com.palm.contact:1", Contact);

Contact.PROPERTIES = { 
	objects: ["anniversary", "birthday", "displayName", "gender", "name", "nickname", "note", "syncSource"],
	arrays: ["accounts", "addresses", "emails", "ims", "organizations", "phoneNumbers", "photos", "tags", "urls", "relations"]
};

Contact.getIdFromLinkHash = function (linkHash) {
	return ContactLinkable.getIdFromLinkHash(linkHash);
};

Contact.getContactByRemoteId = function (remoteId) {
	var future = new Future();
	
	future.now(function () {
		Assert.requireString(remoteId, "Contact.getContactByRemoteId requires a remoteId that is a valid string");
		
		return DB.find({
			from: Contact.kind,
			where: [{
				prop: "remoteId",
				op: "=",
				val: remoteId
			}]
		});
	});
	
	future.then(function () {
		var result = Utils.DBResultHelper(future.result);
		
		if (result && result.length > 0) {
			return new Contact(result[0]);
		} else {
			return null;
		}
	});
	
	return future;
};

//TODO: this will only fetch the first 500 contacts!!
Contact.getContactsByAccountId = function (accountId) {
	var future = new Future();
	
	future.now(function () {
		Assert.requireString(accountId, "Contact.getContactsByAccountId requires an accountId that is a valid string");
		
		return DB.find({
			from: Contact.kind,
			where: [{
				prop: "accountId",
				op: "=",
				val: accountId
			}]
		});
	});
	
	future.then(function (future) {
		var result = Utils.DBResultHelper(future.result);
		
		if (result && result.length > 0) {
			future.result = result.map(function (contact) {
				return new Contact(contact);
			});
		} else {
			future.result = [];
		}
	});
	
	return future;
};


//@ sourceURL=contacts/ContactDisplay.js

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

//@ sourceURL=contacts/ContactLinkable.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, Class, Contact, exports, ArrayUtil, Future, PersonFactory, Person, DB, PalmCall, Assert */

var ContactLinkable = exports.ContactLinkable = Class.create(Contact, {
	initialize: function initialize(rawContact) {
		this.$super(initialize)(rawContact);
		//_.extend(this, person);
		
		// initialize the display properties
		this._init();
		
		// If a person was passed in, create display params based on the person params
		if (rawContact) {
			//this.generateDisplayParams();
		}
	},
	
	/**
	 * These are linkable-only properties
	 */
	_init: function () {
		// this.displayName = "";
		// this.fullName = "";
		// this.workInfoLine = "";
		// this.contactCount = "";
	},

	/**
	 * Reset the linkable params and the params on the person
	 */
//	reset: function reset() {
//		this.$super(reset)();
//		this._init();
//	},
	
	getLinkHash: function () {
		return ContactLinkable.getLinkHash(this);
	},
	
	getPersonFromCLBObject: function (clbLink) {
		var future = new Future(),
			returningBothPersonRecords = false;
		
		future.now(this, function () {
			return this.getLinkHash();
		});
			
		future.then(this, function () {
			var linkHash = future.result.linkHash,
				idToFetch,
				clbLinkA,
				clbLinkB;
			
			if (clbLink.contactEntityA === linkHash) {
				idToFetch = clbLink.contactEntityB.split("|")[1];
			} else if (clbLink.contactEntityB === linkHash) {
				idToFetch = clbLink.contactEntityA.split("|")[1];
			} else {
				returningBothPersonRecords = true;
				clbLinkA = clbLink.contactEntityA.split("|")[1];
				clbLinkB = clbLink.contactEntityB.split("|")[1];
			}

			if (returningBothPersonRecords) {
				return ContactLinkable.getTwoPeopleFromLinkHashIds(clbLinkA, clbLinkB);
			} else {
				return ContactLinkable.getOnePersonFromLinkHashId(idToFetch);
			}
		});
		
		future.then(this, function () {
			var result = future.result;
			
			if (returningBothPersonRecords) {
				return result;
			} else {
				return [result];
			}
		});
		
		return future;
	}
});

ContactLinkable.getTwoPeopleFromLinkHashIds = function (linkHashId1, linkHashId2) {
	var contactIdDelimIndex = linkHashId1.indexOf(ContactLinkable.LOCAL_ID_DELIM),
		bothContactIds = false,
		link1IsContactId = false,
		link2IsContactId = false,
		toReturn = [];
	
	if (contactIdDelimIndex !== -1) {
		linkHashId1 = linkHashId1.substring(contactIdDelimIndex + ContactLinkable.LOCAL_ID_DELIM.length);
		bothContactIds = true;
		link1IsContactId = true;
	}
	
	contactIdDelimIndex = linkHashId2.indexOf(ContactLinkable.LOCAL_ID_DELIM);
	
	if (contactIdDelimIndex !== -1) {
		linkHashId2 = linkHashId2.substring(contactIdDelimIndex + ContactLinkable.LOCAL_ID_DELIM.length);
		link2IsContactId = true;
	} else {
		bothContactIds = false;
	}
	
	if (bothContactIds) {
		// Both linkHashes are contactIds so get both people using the linkhashes as contactIds
		return ContactLinkable.batchGetTwoPeopleWithContactIds(linkHashId1, linkHashId2);
	} else if ((link1IsContactId && !link2IsContactId) || (!link1IsContactId && link2IsContactId)) {
		// One or the other is a contactId so we can't get them via batch. Use getOnePersonFromLinkHashId
		// to get the people from each link hash
		return ContactLinkable.getOnePersonFromLinkHashId(linkHashId1).then(function (future) {
			var result = future.result;
			
			toReturn.push(result);
			
			return ContactLinkable.getOnePersonFromLinkHashId(linkHashId2).then(function (secondPersonFuture) {
				var result = secondPersonFuture.result;

				toReturn.push(result);
				
				return toReturn;
			});
		});
	} else {
		// Neither of the link hashes are contactIds, both are remoteIds, so do a batch and get the contacts
		// then people that have those contacts.
		return ContactLinkable.batchGetTwoContactsWithRemoteIds(linkHashId1, linkHashId2).then(function (future) {
			var result = future.result,
				contact1 = result.contact1,
				contact2 = result.contact2;
			
			if (contact1 && contact2) {
				return ContactLinkable.batchGetTwoPeopleWithContactIds(contact1.getId(), contact2.getId());
			} else {
				return null;
			}
		});
	}
};

ContactLinkable.batchGetTwoContactsWithRemoteIds = function (remoteId1, remoteId2) {
	var future = new Future();
	
	future.now(function () {
		return DB.execute("batch", {
			operations: [{
				method: "find",
				params: {
					query: {
						"from": Contact.kind,
						"where": [{
							"prop": "remoteId",
							"op": "=",
							"val": remoteId1
						}]
					}
				}
			}, {
				method: "find",
				params: {
					query: {
						"from": Contact.kind,
						"where": [{
							"prop": "remoteId",
							"op": "=",
							"val": remoteId2
						}]
					}
				}
			}]
		});
	});
	
	future.then(function () {
		var result = future.result,
			contact1,
			contact2;
		
		if (result && result.responses && result.responses.length > 1) {
			contact1 = new Contact(result.responses[0].results[0]);
			contact2 = new Contact(result.responses[1].results[0]);
		}
		
		return {
			contact1: contact1,
			contact2: contact2
		};
	});
	
	return future;
};

ContactLinkable.batchGetTwoPeopleWithContactIds = function (contactId1, contactId2) {
	var future = new Future();
	
	future.now(function () {
		return DB.execute("batch", {
			operations: [{
				method: "find",
				params: {
					query: {
						"from": Person.kind,
						"where": [{
							"prop": "contactIds",
							"op": "=",
							"val": contactId1
						}]
					}
				}
			}, {
				method: "find",
				params: {
					query: {
						"from": Person.kind,
						"where": [{
							"prop": "contactIds",
							"op": "=",
							"val": contactId2
						}]
					}
				}
			}]
		});
	});
	
	future.then(function () {
		var result = future.result,
			toReturn = [];
		
		if (result && result.responses && result.responses.length > 1) {
			toReturn[0] = new Person(result.responses[0].results[0]);
			toReturn[1] = new Person(result.responses[1].results[0]);
		} 
		
		return toReturn;
	});
	
	return future;
};

ContactLinkable.getOnePersonFromLinkHashId = function (linkHashId) {
	var contactIdDelimIndex = linkHashId.indexOf(ContactLinkable.LOCAL_ID_DELIM);
	
	if (contactIdDelimIndex !== -1) {
		linkHashId = linkHashId.substring(contactIdDelimIndex + ContactLinkable.LOCAL_ID_DELIM.length);
		
		return Person.findByContactIds([linkHashId]);
	} else {
		return Contact.getContactByRemoteId(linkHashId).then(function (future) {
			var result = future.result;
			
			if (result) {
				return Person.findByContactIds([result.getId()]);
			} else {
				return null;
			}
		});
	}
};

ContactLinkable.getIdFromLinkHash = function (linkHash) {
	var idPart = linkHash.split("|")[1],
		contactIdDelimIndex = idPart.indexOf(ContactLinkable.LOCAL_ID_DELIM),
		toReturn,
		future = new Future();
	
	future.now(function () {
		if (contactIdDelimIndex !== -1) {
			return idPart.substring(contactIdDelimIndex + ContactLinkable.LOCAL_ID_DELIM.length);
		} else {
			return Contact.getContactByRemoteId(idPart).then(function (getContactFuture) {
				var result = getContactFuture.result;

				if (result) {
					return result.getId();
				} else {
					return null;
				}
			});
		}
	});
	
	
	return future;
};

ContactLinkable.LOCAL_ID_DELIM = "~~:(!)~~";

/*
	Remote Contact:
	syncSource|remoteID|acctUsername
	syncSource = The type of sync source for this contact. (Facebook, LinkedIn, IM)
	remoteID = The id of the contact from the sync source. This is a persistent id from the server.
	acctUsername = The username of the account for this sync source. We need this because using syncSource and remoteID is not unique enough by themselves.

	Sim Contact:
	SIM|idx|(sim imsi)
	idx = The index of the contact coming from the SIM card.
	
	Local Contact (Palm Profile):
	Local|remoteID
	remoteID = The id given to a palm profile contact. This id is persistent across restores.

	ATT AddressBook:
	ATTBook|remoteID
	remoteID = This will be the id given from ATT's server when fetching or creating a contact.
*/
ContactLinkable.getLinkHash = function (contact) {
	var future = new Future();
	
	future.now(function () {
		var contactKindName = contact.getKindName();
		
		switch (contactKindName) {
		case "com.palm.contact.sim":
			return ContactLinkable.getSimContactHash(contact);
		case "com.palm.contact.attaddresssync":
			return { 
				syncSource: "ATTBook",
				remoteId: contact.getRemoteId()
			};
		case "com.palm.contact.palmprofile":
			return { 
				syncSource: "Local",
				remoteId: contact.getRemoteId()
			};
		default :
			return ContactLinkable.getRemoteContactHash(contact);
		}
	});
	
	future.then(function () {
		var result = future.result,
			syncSource = result.syncSource,
			acctUsername = result.acctUsername,
			remoteId = result.remoteId,
			toReturn;
		
		if (remoteId) {
			toReturn = syncSource + "|" + remoteId;
		} else {
			// Handle accounts that do not have a remoteId for the time being by using their mojodb id.
			// This should be unique enough with the other pieces that it won't clash across backup and restore.
			toReturn = syncSource + "|" + ContactLinkable.LOCAL_ID_DELIM + contact.getId();
		}
		
		toReturn += (acctUsername ? "|" + acctUsername : "");
		
		return {
			linkHash: toReturn,
			shouldBackup: !!remoteId
		};
	});
	
	return future;
};

ContactLinkable.getSimContactHash = function (contact) {
	/*var future = new Future(),
		simContact,
		idx;
	
	future.now(function () {
		return SimContact.getSimContactbyId(contact.getId());
	});
	
	future.then(function () {
		// get the simindex from the returned contact
		var simContact = future.result;
		
		idx = simContact.getSimIndex();
		
		return DB.find({
			from: "com.palm.account.transport.sim:1",
			where: where
		});
	});
	
	future.then(function () {
		var result = future.result;
		// get the imsi from the returned sim account transport object
	});*/
	
	return { 
		syncSource: "SIM"
	};
};

ContactLinkable.getRemoteContactHash = function (contact) {
	var future = new Future();
	
	future.now(function () {
		return PalmCall.call("palm://com.palm.service.accounts", "getAccountInfo", {
			accountId: contact.getAccountId().getValue()
		});
	});
	
	future.then(function () {
		var result = future.result,
			accountObject,
			capability,
			kindName = contact.getKindName(true);
		
		Assert.require(result.returnValue, "ContactLinkable.getRemoteContactHash failed because com.palm.service.accounts returned a falsy returnValue");
		Assert.require(result.result, "ContactLinkable.getRemoteContactHash failed because com.palm.service.accounts did not return a result.result");
		
		accountObject = result.result;
		
		capability = _.detect(accountObject.capabilityProviders, function (capabilityProvider) {
			return capabilityProvider && capabilityProvider.dbkinds && capabilityProvider.dbkinds.contact && (capabilityProvider.dbkinds.contact === kindName);
		});
		
		return {
			syncSource: capability ? capability.id : undefined,
			remoteId: contact.getRemoteId(),
			acctUsername: accountObject.username
		};
	});
	
	return future;
};

//@ sourceURL=contacts/ContactPointTypes.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports PhoneNumberExtended, EmailAddressExtended, IMAddressExtended*/

var ContactPointTypes = exports.ContactPointTypes = {
	PhoneNumber: "contact_point_type_phoneNumber",
	EmailAddress: "contact_point_type_emailAddress",
	IMAddress: "contact_point_type_imAddress",
	Address: "contact_point_type_address",
	Url: "contact_point_type_url"
};

ContactPointTypes.getFavoritableTypeForInstanceOf = function (object) {
	if (object instanceof PhoneNumberExtended) {
		return ContactPointTypes.PhoneNumber;
	} else if (object instanceof EmailAddressExtended) {
		return ContactPointTypes.EmailAddress;
	} else if (object instanceof IMAddressExtended) {
		return ContactPointTypes.IMAddress;
	} else {
		return "Not_A_Favoriteable_Type";
	}
};

//@ sourceURL=contacts/ContactType.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports */

/**
 * @namespace
 * This object is just a global enum for use with the ContactFactory
 */
var ContactType = {
	/** @field {string} */
	DISPLAYABLE: "displayable",
	/** @field {string} */
	LINKABLE: "linkable",
	/** @field {string} */
	EDITABLE: "editable",		// Added this for sim
	/** @field {string} */
	RAWOBJECT: "rawobject"
};

/** 
 * Exported from {@link ContactType}
 * @extends ContactType
 */
exports.ContactType = ContactType;


//@ sourceURL=contacts/ContactFactory.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports Class, Contact, ContactLinkable, ContactDisplay, ContactType */

var ContactFactory = Class.create({
	initialize: function () {
	}
});

//this is deprecated, but alias it for now so nothing breaks.
//TODO: remove this eventually.
ContactFactory.ContactType = ContactType;

ContactFactory.createContactDisplay = function (rawContactObject) {
	return new ContactDisplay(rawContactObject);
};

ContactFactory.createContactLinkable = function (rawContactObject) {
	return new ContactLinkable(rawContactObject);
};

ContactFactory.createContactEditable = function (rawContactObject) {
	return new Contact(rawContactObject);
};

ContactFactory.create = function (contactType, rawContactObject) {
	switch (contactType) {
	case ContactType.DISPLAYABLE:
		return ContactFactory.createContactDisplay(rawContactObject);
	case ContactType.LINKABLE:
		return ContactFactory.createContactLinkable(rawContactObject);
	case ContactType.EDITABLE:
		return ContactFactory.createContactEditable(rawContactObject);
	case ContactType.RAWOBJECT:
		return rawContactObject;
	default:
		return ContactFactory.createContactDisplay(rawContactObject);
	}
};

exports.ContactFactory = ContactFactory;

//@ sourceURL=contacts/DisplayNameType.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports*/

var DisplayNameType = {
	NAME: "name",
	NICKNAME: "nickname",
	TITLE_AND_ORGANIZATION_NAME: "title_and_organization_name",
	ORGANIZATION_NAME: "organization_name",
	TITLE: "title",
	EMAIL: "email",
	IM: "im",
	PHONE: "phone",
	NONE: "none"
};

exports.DisplayNameType = DisplayNameType;

//@ sourceURL=contacts/ListWidget.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, Assert, Mojo, _, console, Person, PhoneNumber, EmailAddress, IMAddress, Utils, 
Future, MojoLoader, PalmCall, Foundations */

var ListWidget = exports.ListWidget = (function () {
	
	var rcsAccounts, queryKeepAlive;
		
	// returns a future that will contain the list of rcs contacts accounts
	function getRcsAccounts() {
		var future, collect;
		
		// CASE: not initialized yet
		if (rcsAccounts === undefined) {
			future = new Future();
			
			collect = function (accounts) {
				var firstResponse = (rcsAccounts === undefined); // collect is called on each subscription update
				rcsAccounts = [];
				accounts.forEach(function (account) {
					account.capabilityProviders.forEach(function (capabilityProvider) {
						if (capabilityProvider.capability === "REMOTECONTACTS") {
							rcsAccounts.push(capabilityProvider);
							capabilityProvider.accountId = account._id;
							//console.log("adding remote contacts account: " + JSON.stringify(capabilityProvider)); // todo remove
						}
					});
				});
				if (firstResponse) {
					future.result = rcsAccounts;
				}
			};
			
			future.now(function () {
				var AccountsLib = MojoLoader.require({name: "accounts.ui", version: "1.0"})["accounts.ui"];
				queryKeepAlive = AccountsLib.AccountsList.listAccounts(collect, {
					filterBy: {
						capability: "REMOTECONTACTS"
					},
					subscribe: true
				});
			});
			
			return future;
			
		// CASE: accounts initialized
		} else {
			return new Future(rcsAccounts);
		}
	}
	
	return {
		
		/**
		 * Returns a configured DBDataSourceAssistant.  This function can only be called from inside a mojo app
		 * that has access to the Mojo framework
		 * @param {Object} params	{
		 *								selectFn: {Function}
		 *								favoritesOnly: {boolean},
		 *								excludeFavorites: {boolean}
		 *					}
		 */
		getTypedownDBDataSourceAssistant: function (params) {
			Assert.requireDefined(Mojo, "ListWidget.getTypedownDBDataSourceAssistant requires the mojo framework to be loaded");
			
			params = params || {};
			
			var dsaParams = {
					kind: "com.palm.person:1",
					select: params.select || undefined, //TODO: replace undefined with the correct array for the app list
					makeWhere: function (filterString) {
						var requirements = [],
							favoriteQueryValue;
						
						//set up favoriteQueryValue as a three-valued variable: { true, false, undefined }
						if (params.favoritesOnly) {
							favoriteQueryValue = true;
						} else if (params.excludeFavorites) {
							favoriteQueryValue = false;
						}
						
						if (filterString) {
							//add the typedown search
							requirements.push({
								prop: "searchProperty",
								op: "?",
								val: filterString,
								collate: "primary"
							});
							
							//when doing a search, we use both items in an array so we can use the same index for 
							//normal list view and favorites list view
							if (favoriteQueryValue === undefined) {
								favoriteQueryValue = [true, false];
							}
						}
						
						if (favoriteQueryValue !== undefined) {
							requirements.push({
								prop: "favorite",
								op: "=",
								val: favoriteQueryValue
							});
						}
						
						return requirements;
					},
					watch: true,
					orderBy: "sortKey"
				},
				dataSourceAssistant = new Mojo.DataSource.TypedownDBDataSourceAssistant(dsaParams, {
					select: params.selectFn
				});
			dataSourceAssistant.watchDelay = 1000;
			
			return dataSourceAssistant;
		},
	
		/**
		 * This function can only be called from inside a mojo app.
		 * @param {Object} params	{
		 *								includeEmails: {boolean},
		 *								includePhones: {boolean},
		 *								includeIMs: {boolean},
		 *								imAddressTypes: {array of strings corresponding to IMAddress.TYPE constants}
		 *												This parameter is optional.  If not included, we include all types of IM Addresses.
		 *								favoritesOnly: {boolean},
		 *								excludeFavorites: {boolean}
		 *					}
		 * @return {TypedownDBDataSourceAssistant}
		 */
		getAddressingWidgetDataSourceAssistant: function (params) {
			Assert.requireDefined(Mojo, "ListWidget.getAddressingWidgetDataSourceAssistant requires the mojo framework to be loaded");
			Assert.requireObject(params, "getAddressingWidgetDataSourceAssistant requires a params object to be passed");
		
			var selectFn,
				dataSourceAssistant,
				getItemsToRenderOriginal;
		
			selectFn = function (person) {
				return (
					(params.includePhones && person.phoneNumbers && _.isArray(person.phoneNumbers)) ||
					(params.includeEmails && person.emails && _.isArray(person.emails)) ||
					(params.includeIMs && person.ims && _.isArray(person.ims))
				);
			};
			
			params.selectFn = selectFn;
			//warning!!!  when Person.generateDisplayNameFromRawPerson() changes to require more fields, those have to be added to this list!!
			params.select = ["_id", "favorite", "phoneNumbers", "emails", "ims", "name", "names", "nickname", "organization"];
			dataSourceAssistant = ListWidget.getTypedownDBDataSourceAssistant(params);
			
			// Wrap DSA.getItemsToRender() so we can format the data before it gets to the list
			// this belongs in the list widget code
			getItemsToRenderOriginal = dataSourceAssistant.getItemsToRender.bind(dataSourceAssistant);
			
			dataSourceAssistant.getItemsToRender = function (response, callback) {
				getItemsToRenderOriginal(response, function (items) {
					var i,
						newItems = [];
					
					if (items) {
						for (i = 0; i < items.length; i += 1) {
							newItems = newItems.concat(ListWidget.addressingWidgetRawPersonFormatter(items[i], params));
						}
					}
					//console.log("\n\n\n\nItems for addressing widget: " + JSON.stringify(newItems));
					callback(newItems);
				});
			};
	
			return dataSourceAssistant;
		},
	
		/*
		 * Every item passed to the addressing widget is an object of the following form:
		 *		{
		 *			personId: the id of the person that this item is attached to
		 *			type: the string "IM", "EMAIL", or "PHONE"
		 *			value: the actual email address, phone number, etc. for the item
		 *			label: the type or servicename of the item, suitable for display
		 *			displayName: the name of the person that this item is part of, suitable for display
		 *			serviceName: (IM address items only) the servicename of the item, suitable for use in reverse lookup
		 *		}
		 */
		addressingWidgetRawPersonFormatter: function (rawPerson, params) {
			Assert.requireDefined(Mojo, "ListWidget.addressingWidgetRawPersonFormatter requires the mojo framework to be loaded");
			if (!params) {
				params = {};
				console.warn("ListWidget.addressingWidgetFormatter was not passed a params arg");
			}
			var items = [],
				displayName,
				imAddressTypesToInclude = params.imAddressTypes,
				includeAllIMTypes;
			
			// gal
			if (rawPerson.displayName) {
				displayName = rawPerson.displayName;
			// db
			} else {
				displayName = Person.generateDisplayNameFromRawPerson(rawPerson);
			}
			
			if (params.includePhones && rawPerson.phoneNumbers && _.isArray(rawPerson.phoneNumbers)) {
				rawPerson.phoneNumbers.forEach(function (phoneNumber) {
					items.push({
						personId: rawPerson._id,
						favorite: rawPerson.favorite,
						type: "PHONE",
						value: phoneNumber.value,
						label: PhoneNumber.getDisplayType(phoneNumber.type),
						displayName: displayName
					});
				});
			}
		
			if (params.includeEmails && rawPerson.emails && _.isArray(rawPerson.emails)) {
				rawPerson.emails.forEach(function (email) {
					items.push({
						personId: rawPerson._id,
						favorite: rawPerson.favorite,
						type: "EMAIL",
						value: email.value,
						label: EmailAddress.getDisplayType(email.type),
						displayName: displayName
					});
				});
			}
		
			if (params.includeIMs && rawPerson.ims && _.isArray(rawPerson.ims)) {
				//if we didn't get an array param for imAddressTypesToInclude, then we're including all types of IMs
				includeAllIMTypes = !imAddressTypesToInclude || !_.isArray(imAddressTypesToInclude);
				rawPerson.ims.forEach(function (im) {
					//if we're including everything or if the array we got contains the type of 
					//the current im address, then we include this im address
					if (includeAllIMTypes || imAddressTypesToInclude.indexOf(im.type) !== -1) {
						//TODO: can we remove serviceName and just pass the label?
						items.push({
							personId: rawPerson._id,
							favorite: rawPerson.favorite,
							type: "IM",
							value: im.value,
							label: IMAddress.getDisplayType(im.type),
							displayName: displayName,
							serviceName: im.type
						});
					}
				});
			}
		
			return items;
		},
		
		/**
		 * Returns a configured data source assistant for remote contacts.  This function can only be called from inside a mojo app
		 * that has access to the Mojo framework
		 * @param {Object} params	{
		 *								callback: {Function}  - called when remote contacts are returned, passed the count
		 *					}
		 */
		getTypedownRcsDataSourceAssistant: function (params) {
			Assert.requireDefined(Mojo, "ListWidget.getTypedownRcsDataSourceAssistant requires the mojo framework to be loaded");
			
			var assistant, originalFetchData, remoteContactsAccounts, callback;
			
			callback = params && params.callback;
			
			// assistant setup
			assistant = new Mojo.DataSource.LocalDataSourceAssistant([], {});
			
			originalFetchData = assistant.fetchData;
			assistant.fetchData = function (info, done) {
				// this function touches the following internal attributes in LocalDataSourceAssistant:
				// - this.filterString
				// - this.itemsArray
				var search, future;
				
				// we don't handle this
				if (!this.filterString) {
					return;
				}
				
				search = function (rcsAccount) {
					var future = PalmCall.call(rcsAccount.query, "", {
						accountId: rcsAccount.accountId,
						query: this.filterString,
						limit: 100
					});
					
					future.then(function () {
						var result = future.result.results;
						PalmCall.cancel(future);
						future.result = result;
					});
					
					return future;
				}.bind(this);
				
				future = Foundations.Control.mapReduce({map: search}, rcsAccounts);
				future.then(this, function () {
					var results = [];
					future.result.forEach(function (r) {
						results = results.concat(r.result);
					});
					results.sort(function (left, right) {
						return left && right && left.displayName.localeCompare(right.displayName);
				    });
					this.itemsArray = results;
					if (callback) {
						callback(results.length);
					}
					originalFetchData(info, done);
				});
			};
						
			return assistant;
		},
			
		/**
		 * Returns a configured DBDataSourceAssistant for GAL lookups.  This function can only be called from inside a mojo app
		 * that has access to the Mojo framework
		 * @param {Object} params	{
		 *								selectFn: {Function}
		 *								favoritesOnly: {boolean},
		 *								excludeFavorites: {boolean}
		 *					}
		 */
		getAddressingWidgetRcsDataSourceAssistant: function (params) {		
			Assert.requireDefined(Mojo, "ListWidget.getAddressingWidgetDataSourceAssistant requires the mojo framework to be loaded");
			Assert.requireObject(params, "getAddressingWidgetDataSourceAssistant requires a params object to be passed");
			
			var dataSourceAssistant, getItemsToRenderOriginal;
			
			dataSourceAssistant = ListWidget.getTypedownRcsDataSourceAssistant(params);
			
			// Wrap DSA.getItemsToRender() so we can format the data before it gets to the list
			// this belongs in the list widget code
			getItemsToRenderOriginal = dataSourceAssistant.getItemsToRender.bind(dataSourceAssistant);
			dataSourceAssistant.getItemsToRender = function (response, callback) {
				getItemsToRenderOriginal(response, function (items) {
					var i, newItems = [];
					
					if (items) {
						for (i = 0; i < items.length; i += 1) {
							newItems = newItems.concat(ListWidget.addressingWidgetRawPersonFormatter(items[i], params));
						}
					}
					//console.log("\n\n\n\nItems for addressing widget: " + JSON.stringify(newItems));
					callback(newItems);
				});
			};
			
			return dataSourceAssistant;
		},
		
		isRcsAvailable: function () {
			var future = getRcsAccounts();
			future.then(function () {
				return future.result.length > 0;
			});
			return future;
		},
		
		SortOrder: Utils.defineConstants({
			defaultSortOrder: "LAST_FIRST",
			lastFirst: "LAST_FIRST",
			firstLast: "FIRST_LAST",
			companyLastFirst: "COMPANY_LAST_FIRST",
			companyFirstLast: "COMPANY_FIRST_LAST"
		})
	};
}());


//@ sourceURL=contacts/Person.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, console, Class, Assert, PalmCall, JSON, Utils, PersonDisplayLite, PropertyArray, Contact, ContactId, Name, DisplayName, 
Photo, CachedPhoto, EmailAddressExtended, PhoneNumberExtended, IMAddressExtended, Nickname, Relation, SpeedDialSaver, 
SearchTerm, SortKey, PersonFactory, ContactFactory, Future, _, Contact, DB, Organization, Reminder, Ringtone, PhoneNumber, EmailAddress, 
IMAddress, DisplayNameType, Favorite, ContactType, PersonType, PersonDisplay, PersonLinkable, FavoriteBackup, ContactLinkable,
Address, Url, Gender, Anniversary, Birthday, Note, Globalization, LauncherId, AppPrefs, ListWidget, ContactPointTypes, FingerWalkerSorter, PersonPhotos, RB, ContactPhoto, Foundations */


// TODO: Handle the case where we this person has contacts that have favoritebackups but the favorite information for this person is not up to date

var Person = Class.create({
	/** @lends Person#*/
	
	/**
	 * This defines a decorated Person.  This object hides the raw person data and exposes methods for accessing decorated
	 * property objects for which getters/setters can be called.  These decorated properties also hide raw data, and can be passed 
	 * directly to framework widgets.
	 * @constructs
	 * @param {Object} rawPerson - raw person object
	 * @example
	 * var person = new Person({
	 *		"displayName": "Mr. Austin Danger Powers Jr",
	 *		"contactIds": ["aa1", "aa2", "aa3"],
	 *		"names": [{
	 *			"honorificPrefix": "Mr",
	 *			"givenName": "Austin",
	 *			"middleName": "Danger",
	 *			"familyName": "Powers",
	 *			"honorificSuffix": "Jr"
	 *		}],
	 *		"name": {
	 *			"honorificPrefix": "Mr",
	 *			"givenName": "Austin",
	 *			"middleName": "Danger",
	 *			"familyName": "Powers",
	 *			"honorificSuffix": "Jr"
	 *		},
	 *		"emails": [{
	 *			"value": "someAddress@gmail.com",
	 *			"type": null,
	 *			"primary": false
	 *		}],
	 *		"phoneNumbers": [{
	 *			"value": "(444) 123-1234",
	 *			"type": "mobile",
	 *			"isPrimary": true
	 *		}],
	 *		"ims": [{
	 *			"value": "someAddress",
	 *			"type": "type_gtalk",
	 *			"primary": false
	 *		}]
	 *	});
	 * 
	 * var givenNameString = name.getGivenName();
	 * var givenNameString = name.x_givenName; // This is for use in widgets. Code should always call the getter rather than accessing the property.
	 */
	initialize: function (rawPerson) {
		if (!rawPerson) {
			rawPerson = {};
		}
		var hasDatabaseId = !!rawPerson._id,
			constructedFromContact = rawPerson instanceof Contact,
			_data = {
				_kind: Person.kind,
				_id: (rawPerson._id || undefined), // should be primitive type Or a different property name
				_rev: rawPerson._rev,
				_del: rawPerson._del,
				favorite: Utils.lazyWrapper(Favorite, [rawPerson.favorite, hasDatabaseId]),
				contactIds: Utils.lazyWrapper(PropertyArray, [ContactId, rawPerson.contactIds, hasDatabaseId]),
				sortKey: Utils.lazyWrapper(SortKey, [rawPerson.sortKey, hasDatabaseId]),
				name: Utils.lazyWrapper(Name, [rawPerson.name, hasDatabaseId]),
				names: Utils.lazyWrapper(PropertyArray, [Name, rawPerson.names, hasDatabaseId]),
				nickname: Utils.lazyWrapper(Nickname, [rawPerson.nickname, hasDatabaseId]),
				organization: Utils.lazyWrapper(Organization, [rawPerson.organization, hasDatabaseId]),
				searchTerms: Utils.lazyWrapper(PropertyArray, [SearchTerm, rawPerson.searchTerms, hasDatabaseId]),
				emails: Utils.lazyWrapper(PropertyArray, [EmailAddressExtended, rawPerson.emails, hasDatabaseId]),
				phoneNumbers: Utils.lazyWrapper(PropertyArray, [PhoneNumberExtended, rawPerson.phoneNumbers, hasDatabaseId]),
				ims: Utils.lazyWrapper(PropertyArray, [IMAddressExtended, rawPerson.ims, hasDatabaseId]),
				photos: Utils.lazyWrapper(PersonPhotos, [rawPerson.photos, hasDatabaseId]),
				addresses: Utils.lazyWrapper(PropertyArray, [Address, rawPerson.addresses, hasDatabaseId]),
				urls: Utils.lazyWrapper(PropertyArray, [Url, rawPerson.urls, hasDatabaseId]),
				notes: Utils.lazyWrapper(PropertyArray, [Note, rawPerson.notes, hasDatabaseId]),
				birthday: Utils.lazyWrapper(Birthday, [rawPerson.birthday, hasDatabaseId]),
				anniversary: Utils.lazyWrapper(Anniversary, [rawPerson.anniversary, hasDatabaseId]),
				gender: Utils.lazyWrapper(Gender, [rawPerson.gender, hasDatabaseId]),
				reminder: Utils.lazyWrapper(Reminder, [rawPerson.reminder, hasDatabaseId]),
				launcherId: Utils.lazyWrapper(LauncherId, [rawPerson.launcherId, hasDatabaseId]),
				relations: Utils.lazyWrapper(PropertyArray, [Relation, rawPerson.relations, hasDatabaseId]),
				ringtone: Utils.lazyWrapper(Ringtone, [rawPerson.ringtone, hasDatabaseId])
			},
			_contacts = new PropertyArray(Contact, null),
			_transientFavoriteState = { 
				instantiationFavoriteValue: false,
				favoriteDefaultsChanged: false
			},
			_beingSaved = false;
		
		/**
		 * This method should only be used internally.  This allows us to control access to the private data
		 * above.  This has been implemented to only fetch data.  This cannot be used to set the private fields.
		 * Individual setters will be implemented below for fields that require the ability to be set.
		 * @private
		 * @param {string} fieldName
		 */
		this.accessor = function (fieldName) {
			var field = _data[fieldName];
			Assert.requireDefined(fieldName, "fieldName must be specified for the accessor");
			//Assert.require(field, "the field you requested does not exist: _data[" + fieldName + "]");
			
			if (field && typeof field === "object" && field.isLazyWrapper) {
				field = _data[fieldName] = field.createInstance();
			}
			
			return field;
		};
		
		_transientFavoriteState.instantiationFavoriteValue = this.accessor("favorite").getValue();
		
		/**
		 * PRIVATE
		 * Gets the _transientFavoriteState object to determine what the current state of various favorite
		 * information is in relation to its save status.
		 * @returns {object}
		 */
		this._getTransientFavoriteState = function () {
			return _transientFavoriteState;
		};
		
		/**
		 * PRIVATE
		 * Indicates if this person is currently being saved
		 * @returns {boolean}
		 */
		this._isBeingSaved = function () {
			return _beingSaved;
		};
		
		/**
		 * PRIVATE
		 * Setter for the _setBeingSaved field
		 * @param {boolean} value
		 */
		this._setBeingSaved = function (value) {
			_beingSaved = value;
		};
		
		/**
		 * Setter for the _id field
		 * @param {string} id
		 */
		this.setId = function (id) {
			_data._id = id;
		};
		
		/**
		 * Setter for the _rev field
		 * @param {string} rev
		 */
		this.setRev = function (rev) {
			_data._rev = rev;
		};
		
		/**
		 * Fetches the Array of linked contacts for this person.  The array is a shallow copy of the internal array that is stored in {@link PropertyArray}.
		 * Inserting/removing elements from this array will not change what is stored in {@link PropertyArray} (you should not do this).  However, the elements in the array are references
		 * to the real decorated {@link Contact} objects.  You can call getters/setters on these elements and those changes will be reflected on the {@link Person}.
		 * @returns {Array}
		 */
		this.getContacts = function () {
			return _contacts.getArray();
		};
		
		/**
		 * Stores an array of contacts on this person
		 * @param {Array} contacts - this array can consist of raw contact objects and/or decorated {@link Contact} objects
		 */
		this.setContacts = function (contacts) {
			_contacts.set(contacts);
		};
		
		/**
		 * This converts the person into a database writable object
		 * This calls getDBObjects on all properties and combines the data into one object
		 * @returns {Object} The raw database object
		 */
		this.getDBObject = function () {
			return Utils.getDBObjectForAllProperties(this.accessor, _.keys(_data));
		};

		/**
		 * This converts the person into a database writable object
		 * This calls getDBObjects on all properties that are dirty and combines the data into one object.
		 * it does not include the _rev so the object is sutiable for a merge.
		 * @returns {Object} The raw database object for dirty properties suitable for a merge
		 */
		this.getDirtyDBObject = function () {
			return Utils.getDBObjectForAllDirtyProperties(this.accessor, _.keys(_data));
		};

		if (constructedFromContact) {
			this.populateFromContact(rawPerson);
		}
	},
	
	// This is intended to be used for UI hacks.
	populateFromContact: function (contact) {
		Assert.requireDefined(contact, "populateFromContact requires a person argument");
		Assert.require(contact instanceof Contact, "populateFromContact requires a person argument that is a child of Person");
		
		this.setContacts([contact]);
		this.fixupNoReloadContacts();
		
		return true;
	},
	
	// Public
	/**
	 * Returns the person kind string
	 * @returns {string}
	 */
	getKind: function () {
		return this.accessor("_kind");
	},
	
	/**
	 * Returns the database id for the person ("_id")
	 * @returns {string}
	 */
	getId: function () {
		return this.accessor("_id");
	},
	
	/**
	 * Returns the launcherId of this person
	 * @returns {string}
	 */
	getLauncherId: function () {
		return this.accessor("launcherId");
	},
	
	/**
	 * Returns the launcher id for a person seperated by the Person.DELIMITER
	 * @returns {string}
	 */
	generateLauncherCallbackId: function () {
		var contactIds = this.getContactIds().getArray(),
			toReturn = "";
		
		contactIds = contactIds.map(function (contactId) {
			return contactId.getValue();
		});
		
		return contactIds.join(Person.DELIMITER);
	},
	
	/**
	 * Returns the database revision for the person ("_rev")
	 * @returns {string}
	 */
	getRev: function () {
		return this.accessor("_rev");
	},
	
	/**
	 * Returns a boolean that indicates if the person has been marked for deletion
	 * @returns {boolean}
	 */
	markedForDelete: function () {
		return this.accessor("_del") || false;
	},
	
	/**
	 * Mark this person as a favorite
	 * @param {object} 
	 * @returns {Future}
	 */
	makeFavorite: function (param) {
		if (!param || (typeof param !== "object")) {
			param = {};
		}
		
		param.personId = this.getId();
		
		this.accessor("favorite").setValue(true);
		return Person.favoritePerson(param);
	},

	/**
	 * Un-mark this person as a favorite
	 * @param {object} - [{personId: "personId"}]
	 * @returns {Future}
	 */	
	unfavorite: function (param) {
		if (!param || (typeof param !== "object")) {
			param = {};
		}
		
		param.personId = this.getId();
		
		this.accessor("favorite").setValue(false);
		return Person.unfavoritePerson(param);
	},
	
	/**
	 * Returns if the person is marked as a favorite
	 * @returns {boolean}
	 */
	isFavorite: function () {
		return this.accessor("favorite").getValue() || false;
	},

	/**
	 * PRIVATE
	 * Returns a reference to the decorated {@link Favorite} object that is stored on this person
	 * @returns {Favorite}
	 */
	getFavorite: function () {
		return this.accessor("favorite");
	},
	
	setFavoriteDefault: function (param) {
		if (!param || (typeof param !== "object")) {
			param = {};
		}
		
		param.personId = this.getId();
		
		return Person.setFavoriteDefault(param);
	},
	
	_getDefaultContactPointsForTypeAndAppId: function (contactPointType, applicationID) {
		var toReturn = [],
			tempData,
			tempArray,
			hasFavoriteDataEntry,
			i,
			getAllFavorites = applicationID ? false : true;
		
		tempArray = this._getContactPointArrayForType(contactPointType);
		
		// TODO could use filter
		for (i = 0; i < tempArray.length; i += 1) {
			tempData = tempArray[i];
			
			if (getAllFavorites) {
				hasFavoriteDataEntry = tempData.hasFavoriteDataForAnyApp();
			} else {
				hasFavoriteDataEntry = tempData.getFavoriteDataForAppWithId(applicationID);
			}
			
			if (hasFavoriteDataEntry) {
				toReturn.push(tempData);
			}
		}
		
		return toReturn;
	},
	
	_setDefaultForContactPointType: function (contactPointType, normalizedValue, type, applicationID, listIndex, auxData) {
		var contactPointArray,
			contactPointPropertyArray,
			contactPoint,
			itemIndex;
		
		contactPointPropertyArray = this._getContactPointArrayForType(contactPointType, true);
		contactPointArray = contactPointPropertyArray.getArray();
		contactPoint = _.detect(contactPointArray, function (item, curIndex) {
			if (item.getNormalizedValue() === normalizedValue && item.getType() === type) {
				itemIndex = curIndex;
				return true;
			}
		});
		
		if (contactPoint) {
			contactPoint.addFavoriteData(applicationID, {
				listIndex: listIndex,
				auxData: auxData
			});
			
			// Bubble the newly selected default to the top of the property array for that contact point
			contactPointArray.splice(itemIndex, 1);
			contactPointPropertyArray.clear();
			contactPointPropertyArray.add(contactPoint);
			contactPointPropertyArray.add(contactPointArray);
			
			return true;
		} else {
			return false;
		}
	},
	
	_getContactPointArrayForType: function (contactPointType, returnPropertyArray) {
		var toReturn;
		
		switch (contactPointType) {
		case ContactPointTypes.PhoneNumber:
			toReturn = this.getPhoneNumbers();
			break;
		case ContactPointTypes.EmailAddress:
			toReturn = this.getEmails();
			break;
		case ContactPointTypes.IMAddress:
			toReturn = this.getIms();
			break;
		// case ContactPointTypes.Address:
		// toReturn = this.getAddresses().getArray();
		// break;
		// case ContactPointTypes.Url:
		// toReturn = this.getUrls().getArray();
		// break;
		default:
			if (returnPropertyArray) {
				toReturn = new PropertyArray(Object, {});
				toReturn.add(this.getPhoneNumbers().getArray());
				toReturn.add(this.getEmails().getArray());
				toReturn.add(this.getIms().getArray());
				//toReturn.add(this.getAddresses().getArray());
				//toReturn.add(this.getUrls().getArray());
			} else {
				toReturn = [];
				toReturn = toReturn.concat(this.getPhoneNumbers().getArray());
				toReturn = toReturn.concat(this.getEmails().getArray());
				toReturn = toReturn.concat(this.getIms().getArray());
				//toReturn = toReturn.concat(this.getAddresses().getArray());
				//toReturn = toReturn.concat(this.getUrls().getArray());
			}
			
			return toReturn;
		}
		
		return returnPropertyArray ? toReturn : toReturn.getArray();
	},
	
	/**
	 * PRIVATE
	 * Tells you if the person's favorite value has changed since the last save
	 * @returns {boolean}
	 */
	hasInstantiationFavoriteValueChanged: function () {
		return (this._getTransientFavoriteState().instantiationFavoriteValue !== this.getFavorite().getValue());
	},
	
	// If the person is being saved then we want to update the favorite values current state. This is because
	// when we save we will perform any favorite backup work that is necessary. From this person's point of view,
	// its favorite state will be what ever state is currently being saved. This allows us to manipulate the favorite
	// value on a person in memory that already had its favorite state changed and saved.
	/**
	 * PRIVATE
	 * Updates the instantiationFavoriteValue state to the current favorite value
	 */
	_updateInstantiationFavoriteValueToCurrentState: function () {
		if (this._isBeingSaved()) {
			this._getTransientFavoriteState().instantiationFavoriteValue = this.getFavorite().getValue();
		}
	},
	
	/**
	 * PRIVATE
	 * Tells you if the communication point's default values have changed since the last save
	 * @returns {boolean}
	 */
	_hasFavoriteDefaultsChanged: function () {
		return this._getTransientFavoriteState().favoriteDefaultsChanged;
	},
	
	/**
	 * PRIVATE
	 * Mark that any of the communication point's defaults have changed
	 */
	_markFavoriteDefaultsChanged: function () {
		this._getTransientFavoriteState().favoriteDefaultsChanged = true;
	},
	
	/**
	 * PRIVATE
	 * Mark that any of the communication point's defaults have not changed
	 */
	_markFavoriteDefaultsUnChanged: function () {
		this._getTransientFavoriteState().favoriteDefaultsChanged = false;
	},
	
	/**
	 * Returns a reference to the {@link PropertyArray} containing decorated {@link ContactId} objects
	 * @returns {PropertyArray&lt;ContactId&gt;}
	 */
	getContactIds: function () {
		return this.accessor("contactIds");
	},
	
	/**
	 * Sets the given contactId as the primary in this person assuming the contactId is
	 * linked to this person
	 * @returns {boolean} true if the contact was found and is not set as the primary
	 */
	setContactWithIdAsPrimary: function (contactIdToSetPrimary) {
		var contactIds = this.getContactIds().getArray(),
			indexFoundContactId = -1,
			removedContactId;
		
		contactIds.some(function (contactId, index) {
			if (contactId.getValue() === contactIdToSetPrimary) {
				indexFoundContactId = index;
				return true;
			}
			
			return false;
		});
		
		if (indexFoundContactId > 0) {
			removedContactId = contactIds[indexFoundContactId];
			contactIds.splice(indexFoundContactId, 1);
			contactIds.splice(0, 0, removedContactId);
			this.getContactIds().set(contactIds);
			return true;
		} else {
			return false;
		}
	},
	
	/**
	 * Returns the sort key string.  This should only be used for sorting data.
	 * @returns {string}
	 */
	getSortKey: function () {
		return this.accessor("sortKey");
	},
	
	/**
	 * This is the best name based on the linked contacts.  The linker makes this decision and sets the name.
	 * @returns {Name}
	 */
	getName: function () {
		return this.accessor("name");
	},
	
	/**
	 * These are all of the names found on the linked contacts.  This is used by the linker.
	 * @returns {PropertyArray&lt;Name&gt;} containing decorated {@link Name} objects
	 */
	getNames: function () {
		return this.accessor("names");
	},
	
	/**
	 * Returns the decorated {@link Nickname} object
	 * @returns {Nickname}
	 */
	getNickname: function () {
		return this.accessor("nickname");
	},
	
	/**
	 * Returns the decorated {@link Organization} object
	 * @returns {Organization}
	 */
	getOrganization: function () {
		return this.accessor("organization");
	},
	
	/**
	 * All of the email addresses found on the linked contacts.
	 * @returns {PropertyArray&lt;EmailAddress&gt;} PropertyArray containing decorated {@link EmailAddress} objects
	 */
	getEmails: function () {
		return this.accessor("emails");
	},
	
	/**
	 * All of the IM addresses found on the linked contacts.
	 * @returns {PropertyArray&lt;IMAddress&gt;} PropertyArray containing decorated {@link IMAddress} objects
	 */
	getIms: function () {
		return this.accessor("ims");
	},
	
	/**
	 * All of the phone numbers found on the linked contacts.
	 * @returns {PropertyArray&lt;PhoneNumber&gt;} PropertyArray containing decorated {@link PhoneNumber} objects
	 */
	getPhoneNumbers: function () {
		return this.accessor("phoneNumbers");
	},
	
	/**
	 * Returns the decorated {@link PersonPhotos} object.
	 * @returns {PersonPhotos}
	 */	
	getPhotos: function () {
		return this.accessor("photos");
	},
	
	/**
	 * The addresses that belong to this person
	 * @returns {PropertyArray&lt;Address&gt;} PropertyArray containing decorated {@link Address} objects
	 */
	getAddresses: function () {
		return this.accessor("addresses");
	},
	
	/**
	 * The urls that belong to this person
	 * @returns {PropertyArray&lt;Url&gt;} PropertyArray containing decorated {@link Url} objects
	 */
	getUrls: function () {
		return this.accessor("urls");
	},
	
	/**
	 * The notes that belong to this person
	 * @returns {PropertyArray&lt;Notes&gt;} PropertyArray containing decorated {@link Notes} objects
	 */
	getNotes: function () {
		return this.accessor("notes");
	},
	
	/**
	 * The birthday that belongs to this person
	 * @returns {Birthday}
	 */
	getBirthday: function () {
		return this.accessor("birthday");
	},
	
	/**
	 * The anniversary of this person
	 * @returns {Anniversary}
	 */
	getAnniversary: function () {
		return this.accessor("anniversary");
	},
	
	/**
	 * The gender of this person
	 * @returns {Gender}
	 */
	getGender: function () {
		return this.accessor("gender");
	},
	
	/**
	 * Array of search terms that is used to query for person objects based on a typedown filter.  This should only be used for searching.
	 * @returns {PropertyArray&lt;SearchTerm&gt;} PropertyArray containing decorated {@link SearchTerm} objects
	 */
	getSearchTerms: function () {
		return this.accessor("searchTerms");
	},
	
	/**
	 * Returns the decorated {@link Reminder} object.
	 * @returns {Reminder}
	 */	
	getReminder: function () {
		return this.accessor("reminder");
	},
	
	/**
	 * The relations that belong to this person
	 * @returns {PropertyArray&lt;Relation&gt;} PropertyArray containing decorated {@link Relation} objects
	 */
	getRelations: function () {
		return this.accessor("relations");
	},
	
	/**
	 * Returns the decorated {@link Ringtone} object.
	 * @return {Ringtone}
	 */
	getRingtone: function () {
		return this.accessor("ringtone");
	},
	
	/**
	 * Generates a display name for the person based on the following criteria:<br>
	 * 1) Name<br>
	 * 2) Nickname<br>
	 * 3) Organization Title && Organization Name<br>
	 * 4) Organization Name<br>
	 * 5) Email Address<br>
	 * 6) PhoneNumber<br>
	 * 7) "[No Name Available]"<br>
	 * @param {boolean}  includeBasedOnField If false, the return value is a {string}<br>
	 *						If true, the return value is an {Object}
	 * @return {string OR Object} When an {Object} is returned, the basedOnField property will be set from one of the constants defined in {@link DisplayNameType}
	 * @example
	 * If includeBasedOnField is true, the returned {Object} will have this structure: 
	 *		{
	 *			displayName: displayName,
	 *			basedOnField: basedOnField
	 *		}
	 */
	generateDisplayName: function (includeBasedOnField) {
		return Utils.generateDisplayName(this, includeBasedOnField);
	},
		
	/**
	 * Concatenates the Organization Title + Organization Name
	 * @return {string}
	 */
	// previously this used to concat: ['jobTitle', 'deptName', 'companyName']
	generateWorkInfoLine: function () {
		var arr = [],
			title = this.getOrganization().getTitle(),
			orgName = this.getOrganization().getName();
		
		if (title) {
			arr.push(title);
		}
		
		if (orgName) {
			arr.push(orgName);
		}
		
		return arr.join(", ");
	},
	
	/**
	 * Fetches all of the linked contacts for the person from the DB.  A decorated {@link Contact} object is created for each result.
	 * The decorated {@link Contact} array is set on the current person via {@link Person#setContacts}.  The array is also set as the result
	 * of the Future that is returned by this method
	 * @param {ContactType} contactType - The type of decorated contact object to create for each raw linked contact returned from the DB.
	 * @returns {Future} the result of this future will be set the array of decorated contacts
	 */	
	reloadContacts: function (contactType) {
		var future = null;
		
		contactType = contactType || this.getDefaultContactType();
		
		future = Person.getLinkedContacts(this, contactType);
		
		future.then(this, function getContactsFromResultsAndSetOnPerson() {
			var contacts;
			contacts = future.result || [];
			this.setContacts(contacts);
			future.result = contacts;
		});
		
		return future;
	},
	
	/**
	 * Clears the fields on the person 
	 */
	// TODO: this implementation needs some work
	clearFieldsForFixup: function () {
		//this.getContactIds().clear();
		this.getName().clear();
		this.getNames().clear();
		this.getNickname().clear();
		this.getOrganization().clear();
		this.getSearchTerms().clear();
		this.getEmails().clear();
		this.getPhoneNumbers().clear();
		this.getIms().clear();
		this.getAddresses().clear();
		this.getUrls().clear();
		this.getNotes().clear();
		this.getBirthday().setValue("");
		this.getAnniversary().setValue("");
		this.getGender().setValue("");
		this.getPhotos().clear();
		this.getSortKey().setValue("");
		this.getRelations().clear();
		//note that we are explicitly *not* clearing the photos
	},
		
//	fixup: function () {
//		var i,
//			name;
//		// iterate over contacts + find the primary
//		//		- set the displayName to primaryContact.getName().getFullName()
//		
//		if (_contacts && _contacts.length) {
//			// the primary will be first.  Iterate over the array until the first good name is found
//			for (i = 0; i < _contacts.length; i = i + 1) {
//				name = _contacts[i].getName().getFullName();
//				if (name) {
//					_data.displayName = name;
//					break;
//				}
//			}
//		} else {
//			console.log("_contacts array is empty!");
//		}
//		
//	},
	
	fixup: function (otherPeopleBeingLinked, configParams) {
		return this.fixupFromObjects(undefined, ContactType.EDITABLE, otherPeopleBeingLinked, configParams);
	},
	
	fixupNoReloadContacts: function (otherPeopleBeingLinked, configParams) {
		return this.fixupFromObjects(this.getContacts(), ContactType.EDITABLE, otherPeopleBeingLinked, configParams);
	},
	
	fixupFromObjects: function (contacts, contactType, otherPeopleBeingLinked, configParams) {
		//TODO: can any of these be moved into a future.then?
		var future,
			allPeopleBeingLinked,
			dupeFavoriteBackupData,
			notDupeFavoriteBackupData,
			speedDialSaver,
			rawNewPersonPhotos,
			newListContactPhoto,
			wasAFavoriteFromBackups = false,
			timingRecorder = (configParams && configParams.timingRecorder) || {
				startTimingForJob: function () {
					
				},
				stopTimingForJob: function () {
					
				}
			}; // TODO: take me out when performance push is done!!!!
		
		if (!contacts) {
			timingRecorder.startTimingForJob("Fixup_Reload_Contacts");
			future = this.reloadContacts();
		} else {
			future = new Future();
			future.now(function () {
				future.result = true;
			});
		}
		
		future.then(this, function doneLoadingContactsForPerson() {
			var tempResult;
			
			if (!contacts) {
				timingRecorder.stopTimingForJob("Fixup_Reload_Contacts");
				contacts = [];
				tempResult = future.result;
				contacts = tempResult;
				/*console.log("Contacts from future - " + tempResult);
				if (tempResult) {
					for (i = 0; i < tempResult.length; i += 1) {
						contacts[i] = ContactFactory.create(contactType, tempResult[i]);
					}
				}
				
				console.log("Contacts in contacts array - " + contacts);*/
			}
			
			otherPeopleBeingLinked = Array.isArray(otherPeopleBeingLinked) ? _.clone(otherPeopleBeingLinked) : [];
			allPeopleBeingLinked = [this].concat(otherPeopleBeingLinked);
			
			speedDialSaver = new SpeedDialSaver(allPeopleBeingLinked);
			
			timingRecorder.startTimingForJob("Fixup_Fetch_Favorite_Backups");
			//save favorites and default information
			future.nest(Person._getAllFavoriteBackupsForPeople(allPeopleBeingLinked));
		});
		
		future.then(this, function () {
			timingRecorder.stopTimingForJob("Fixup_Fetch_Favorite_Backups");
			
			var contact,
				allFavoriteBackups = future.result,
				favoriteBackupDefaultSavers = [],
				tempDupeObject,
				tempFavoriteBackup,
				nameBeenCopied = false,
				nicknameCopied = false,
				birthdayCopied = false,
				anniversaryCopied = false,
				genderCopied = false,
				organizationCopied = false,
				i,
				name,
				nickname,
				organization,
				birthday,
				gender,
				anniversary,
				emailArray,
				phoneNumberArray,
				imArray,
				addressesArray,
				urlsArray,
				relationsArray,
				note,
				numbersToAdd,
				dupSearchTermsHash = {},
				dupEmailHash = {},
				dupNumberHash = {},
				dupImHash = {},
				dupName = {},
				dupAddressHash = {},
				dupUrlsHash = {},
				dupRelationsHash = {},
				dupNotesHash = {};
			
			for (i = 0; i < allFavoriteBackups.length; i += 1) {
				tempFavoriteBackup = allFavoriteBackups[i];
				if (tempFavoriteBackup) {
					wasAFavoriteFromBackups = true;
					favoriteBackupDefaultSavers = favoriteBackupDefaultSavers.concat(tempFavoriteBackup.getDefaultPropertyHashes().getArray());
				}
			}
			
			tempDupeObject = Person._discoverFavoriteSaverBackupDupes(favoriteBackupDefaultSavers);
			
			dupeFavoriteBackupData = tempDupeObject.dupes;
			notDupeFavoriteBackupData = tempDupeObject.notDupes;
			
			this.clearFieldsForFixup();
			
			timingRecorder.startTimingForJob("Fixup_Copying_And_De-dupping_Contact_Point_Data");
			
			
			for (i = 0; i < contacts.length; i += 1) {
				//console.log("In contacts");
				contact = contacts[i];
				//console.log("Contacts array - " + JSON.stringify(contacts));
				//console.log("Contact currently getting fixup from - " + JSON.stringify(contact));
				//
				
				//console.log("Current contact - " + contact);
				if (contact) {
					
					// Copy up name
					name = contact.getName();
					if (name.getFullName() !== "") {
						if (!nameBeenCopied) {
							//console.log("Contact library: fixup - Name on person before set - " + this.getName());
							this.getName().set(name);
							//console.log("Contact library: fixup - Name on contact - " + name);
							//console.log("Contact library: fixup - Name on person now - " + this.getName());
							nameBeenCopied = true;
						} 
						
						this.getNames().add(Utils.dedupeEntries(dupName, [name], "getNormalizedHashKey"));
					}
					
					// Copy up nickname
					if (!nicknameCopied) {
						nickname = contact.getNickname();
						
						if (nickname.getValue()) {
							this.getNickname().setValue(nickname.getValue());
							nicknameCopied = true;
						}
					}
					
					// Copy up organization
					if (!organizationCopied) {
						organization = contact.getBestOrganization();
						if (organization) {
							this.getOrganization().initialize(organization);
							this.getOrganization().forceMarkDirty();
							organizationCopied = true;
						}
					}
					
					// Copy up searchTerms
					this.getSearchTerms().add(Utils.dedupeEntries(dupSearchTermsHash, Utils.getSearchTermsFromContact(contact)));
					
					emailArray = contact.getEmails().getArray();
					
					if (emailArray) {
						this.getEmails().add(Utils.dedupeEntries(dupEmailHash, emailArray, "getNormalizedHashKey"));
					}
					
					phoneNumberArray = contact.getPhoneNumbers().getArray();
					if (phoneNumberArray) {
						// Compare search normalized values for phone numbers
						numbersToAdd = Utils.dedupeEntries(dupNumberHash, phoneNumberArray, "getNormalizedSearchHashKey");
						if (numbersToAdd) {
							this.getPhoneNumbers().add(numbersToAdd);
						}
					}
					
					imArray = contact.getIms().getArray();
					if (imArray) {
						this.getIms().add(Utils.dedupeEntries(dupImHash, imArray, "getNormalizedHashKey"));
					}
					
					addressesArray = contact.getAddresses().getArray();
					if (addressesArray) {
						this.getAddresses().add(Utils.dedupeEntries(dupAddressHash, addressesArray, "getNormalizedHashKey"));
					}
					
					urlsArray = contact.getUrls().getArray();
					if (urlsArray) {
						this.getUrls().add(Utils.dedupeEntries(dupUrlsHash, urlsArray, "getNormalizedHashKey"));
					}
					
					relationsArray = contact.getRelations().getArray();
					if (relationsArray) {
						this.getRelations().add(Utils.dedupeEntries(dupRelationsHash, relationsArray, "getNormalizedHashKey"));
					}
					
					note = contact.getNote();
					if (note.getValue()) {
						this.getNotes().add(Utils.dedupeEntries(dupNotesHash, [note], "getNormalizedHashKey"));
					}
					
					if (!birthdayCopied) {
						birthday = contact.getBirthday().getValue();
						if (birthday) {
							this.getBirthday().setValue(birthday);
							birthdayCopied = true;
						}
					}
					
					if (!anniversaryCopied) {
						anniversary = contact.getAnniversary().getValue();
						if (anniversary) {
							this.getAnniversary().setValue(anniversary);
							anniversaryCopied = true;
						}
					}
					
					if (!genderCopied) {
						gender = contact.getGender().getValue();
						if (gender) {
							this.getGender().setValue(gender);
							genderCopied = true;
						}
					}
				}
			}
			
			if (!nicknameCopied) {
				this.getNickname().setValue("");
			}
		
			timingRecorder.stopTimingForJob("Fixup_Copying_And_De-dupping_Contact_Point_Data");
			
			
			timingRecorder.startTimingForJob("Fixup_Generating_SortKey");
			//now, generate the sortKey
			future.nest(SortKey.generateSortKey(this, configParams));
		});
		
		future.then(this, function () {
			timingRecorder.stopTimingForJob("Fixup_Generating_SortKey");
			
			var sortKey = future.result,
				contactPhotosArray,
				newListPhotoSource,
				squareContactPhoto,
				bigContactPhoto,
				squareContactPhotoPath = "",
				bigContactPhotoPath = "",
				squareContactPhotoId = "",
				bigContactPhotoId = "",
				splitFilePath,
				oldPhotos,
				contactWithNewPhotos;
			
			this.getSortKey().setValue(sortKey);
			
			
			/*
			 * Now, we deal with photos...
			 */
			timingRecorder.startTimingForJob("Fixup_Prepping_Photos");
			
			
			oldPhotos = this.getPhotos();
			
			//we use the first contact that has any photos
			contactWithNewPhotos = _.detect(contacts, function (contact) {
				return (contact.getPhotos().getArray().length > 0);
			});
			
			//if none of the contacts have photos, we just create an empty rawNewPersonPhotos object so that default images will be used
			if (!contactWithNewPhotos) {
				rawNewPersonPhotos = {};
				return {
					returnValue: true,
					skippedImageConvertCall: true
				};
			}
			
			//first, we find a square photo and a big photo that have local paths
			contactPhotosArray = contactWithNewPhotos.getPhotos().getArray();
			squareContactPhoto = _.detect(contactPhotosArray, function (contactPhoto) {
				return contactPhoto.getType() === ContactPhoto.TYPE.SQUARE && contactPhoto.getLocalPath();
			});
			bigContactPhoto = _.detect(contactPhotosArray, function (contactPhoto) {
				return contactPhoto.getType() === ContactPhoto.TYPE.BIG && contactPhoto.getLocalPath();
			});
			
			//now we pick one to use for the list photo.  we prefer to use a square one.
			if (squareContactPhoto) {
				newListContactPhoto = squareContactPhoto;
			} else if (bigContactPhoto) {
				newListContactPhoto = bigContactPhoto;
			} else {
				console.warn("Contacts library: fixup - no square or big photo found on a contact with photos (maybe they had photo objs without local paths?).  Not storing a photo on the person.");
				rawNewPersonPhotos = {};
				return {
					returnValue: true,
					skippedImageConvertCall: true
				};
			}
			newListPhotoSource = newListContactPhoto.getType();
			
			//TODO: will contactPhoto.getId() work?  probably not...
			if (squareContactPhoto) {
				squareContactPhotoPath = squareContactPhoto.getLocalPath();
				squareContactPhotoId = squareContactPhoto.getDBObject()._id;
			}
			if (bigContactPhoto) {
				bigContactPhotoPath = bigContactPhoto.getLocalPath();
				bigContactPhotoId = bigContactPhoto.getDBObject()._id;
			}
			
			//Now we figure out if the new list photo is going to actually be different than the old one.
			if (newListPhotoSource === oldPhotos.getListPhotoSource() && newListContactPhoto.getValue() === oldPhotos.getListPhotoSourcePath()) {
				//If we're using the same type of photo as the old one, and the source has the same exact file path, 
				//we don't have to create a new list photo - we just use the old one.
				
				//we don't have to recrop, but we do need to reconstruct the PersonPhotos object to make sure we get any updates
				rawNewPersonPhotos = {
					bigPhotoPath: bigContactPhotoPath, //the potentially-changed big photo path (one of big and square could have changed, if the other was the list photo source)
					squarePhotoPath: squareContactPhotoPath, //the potentially-changed square photo path (one of big and square could have changed, if the other was the list photo source)
					listPhotoPath: oldPhotos.getListPhotoPath(), //the old list photo path, since we're still using that one
					listPhotoSource: newListPhotoSource, //the is the same as oldPhotos.getListPhotoSource()
					bigPhotoId: bigContactPhotoId, //the id off the new big photo, since it could have changed
					squarePhotoId: squareContactPhotoId, //the id off the new big photo, since it could have changed
					contactId: contactWithNewPhotos.getId(), //the id off the new contact, since it theoretically could have changed
					accountId: contactWithNewPhotos.getAccountId().getValue() //the account id off the new contact
				};
				return {
					returnValue: true,
					skippedImageConvertCall: true
				};
			} else {
				//something changed, so we have to do a crop to get a new list photo
				
				rawNewPersonPhotos = {
					bigPhotoPath: bigContactPhotoPath,
					squarePhotoPath: squareContactPhotoPath,
					//we omit listPhotoPath, since we need to do the crop and get it below
					listPhotoSource: newListPhotoSource,
					bigPhotoId: bigContactPhotoId,
					squarePhotoId: squareContactPhotoId,
					contactId: contactWithNewPhotos.getId(),
					accountId: contactWithNewPhotos.getAccountId().getValue()
				};
				
				return {
					returnValue: true
				};
			}
		});
		
		future.then(this, function () {
			timingRecorder.stopTimingForJob("Fixup_Prepping_Photos");
			
			var result = future.result,
				cropFuture;
			
			if (result.skippedImageConvertCall) {
				return result;
			} else {
				timingRecorder.startTimingForJob("Fixup_Cropping_Photo_And_File_Cache");
				
				cropFuture = ContactPhoto.cropAndGetPath(newListContactPhoto.getLocalPath(), {}, PersonPhotos.TYPE.LIST, timingRecorder);
				
				cropFuture.then(function () {
					var result;
					try {
						result = cropFuture.result;
					} catch (ex) {
						console.warn("Person fixup: cropping list photo and got error.  We're ignoring it.  " + ex);
						result = "";
					}
					
					timingRecorder.stopTimingForJob("Fixup_Cropping_Photo_And_File_Cache");
					
					return {
						returnValue: true,
						skippedImageConvertCall: false,
						pathResult: result
					};
				});
				
				return cropFuture;
			}
		});
		
		future.then(this, function () {
			var result = future.result,
				otherPersonWithLauncherId,
				completeReminder,
				otherPersonWithRingtone,
				that = this;
				
			/*
			 * First let's deal with the result of the photos call
			 */
			
			if (result && result.returnValue) {
				if (!result.skippedImageConvertCall) {
					//if we're in here, that means we actually had to do some photo cropping
					rawNewPersonPhotos.listPhotoPath = result.pathResult;
				} else {
					console.log("Contact library: fixup - photo cropping was not necessary");
				}
			} else {
				if (rawNewPersonPhotos.squarePhotoPath) {
					rawNewPersonPhotos.listPhotoPath = "";
					rawNewPersonPhotos.listPhotoSource = ContactPhoto.TYPE.SQUARE;
				} else if (rawNewPersonPhotos.bigPhotoPath) {
					rawNewPersonPhotos.listPhotoPath = "";
					rawNewPersonPhotos.listPhotoSource = ContactPhoto.TYPE.BIG;
				}
			}
			//finally, store the new values to the person
			this.getPhotos().reinitialize(rawNewPersonPhotos);
			
			
			/*
			 * Now deal with the person-specific stuff: launcher id, reminder, and ringtone
			 */
			timingRecorder.startTimingForJob("Fixup_Restoring_Person_Specific_Stuff");
			//if this person doesn't have a launcher id, see if any of the others do and copy over the first one we find
			if (!this.getLauncherId().getValue()) {
				otherPersonWithLauncherId = _.detect(otherPeopleBeingLinked, function (otherPerson) {
					if (!otherPerson || ! otherPerson.getLauncherId()) {
						return false;
					}
					
					return !!otherPerson.getLauncherId().getValue();
				});
				if (otherPersonWithLauncherId) {
					this.getLauncherId().setValue(otherPersonWithLauncherId.getLauncherId().getValue());
				}
			}
			
			//take all the reminders from each person and join them into one big reminder string to store
			completeReminder = allPeopleBeingLinked.reduce(function (accumulatedReminder, currentPerson) {
				var currentReminder = currentPerson.getReminder().getValue();
				if (currentReminder) {
					return accumulatedReminder ? accumulatedReminder + ". "  + currentReminder : currentReminder;
				} else {
					return accumulatedReminder;
				}
			}, "");
			this.getReminder().setValue(completeReminder);
			
			//if this person doesn't have a ringtone, see if any of the others do and copy over the first one we find
			if (!this.getRingtone().getName() || !this.getRingtone().getLocation()) {
				otherPersonWithRingtone = _.detect(otherPeopleBeingLinked, function (otherPerson) {
					if (!otherPerson || ! otherPerson.getRingtone()) {
						return false;
					}
					
					return !!otherPerson.getRingtone().getName() && !!otherPerson.getRingtone().getLocation();
				});
				if (otherPersonWithRingtone) {
					this.getRingtone().setName(otherPersonWithRingtone.getRingtone().getName());
					this.getRingtone().setLocation(otherPersonWithRingtone.getRingtone().getLocation());
				}
			}
			timingRecorder.stopTimingForJob("Fixup_Restoring_Person_Specific_Stuff");
			
			
			timingRecorder.startTimingForJob("Fixup_Restoring_SpeedDials");
			/*
			 * now restore speed dials
			 */
			speedDialSaver.restoreSpeedDials(this);
			
			return speedDialSaver.restoreSpeedDialsFromBackups(this);
		});
		
		future.then(this, function () {
			var dummy = future.result,
				backupDataToRestore = [],
				tempFavoriteBackup,
				tempFavoriteBackupType,
				anyPersonWasFavorite,
				i,
				contactPointDataObject = {},
				contactPointArray,
				contactPointArrayIndex,
				tempContactPoint,
				that = this;
			
			timingRecorder.stopTimingForJob("Fixup_Restoring_SpeedDials");
			
			timingRecorder.startTimingForJob("Fixup_Restoring_Favorite_Data");
			/*
			 * now restore favorite data
			 */
			anyPersonWasFavorite = _.isArray(otherPeopleBeingLinked) ? _.clone(otherPeopleBeingLinked) : [];
			anyPersonWasFavorite = anyPersonWasFavorite.some(function (otherPerson) {
				return otherPerson.isFavorite();
			});
			//don't set it to false, in case this person is already a favorite
			if (anyPersonWasFavorite || wasAFavoriteFromBackups) {
				this.getFavorite().setValue(true);
			}
			
			backupDataToRestore = backupDataToRestore.concat(dupeFavoriteBackupData);
			backupDataToRestore = backupDataToRestore.concat(notDupeFavoriteBackupData);
			
			for (i = 0; i < backupDataToRestore.length; i += 1) {
				tempFavoriteBackup = backupDataToRestore[i];
				tempFavoriteBackupType = tempFavoriteBackup.getType();
				if (!contactPointDataObject[tempFavoriteBackupType]) {
					contactPointDataObject[tempFavoriteBackupType] = this._getContactPointArrayForType(tempFavoriteBackupType);
				}
				
				contactPointArray = contactPointDataObject[tempFavoriteBackupType];
				
				for (contactPointArrayIndex = 0; contactPointArrayIndex < contactPointArray.length; contactPointArrayIndex += 1) {
					tempContactPoint = contactPointArray[contactPointArrayIndex];
					if (tempFavoriteBackup.isPlainValueEqual(tempContactPoint.getNormalizedValue())) {
						tempContactPoint.setFavoriteData(tempFavoriteBackup.getFavoriteData());
						// backupDataToRestore.splice(i, 1);
						// i -= 1;
						break;
					}
				}
			}
			
			// Promote all the defaults to the front of the contact point arrays
			Person.supportedFavoriteTypes.forEach(function (contactPointType) {
				var contactPointPropertyArray = that._getContactPointArrayForType(contactPointType, true),
					contactPointArray = contactPointPropertyArray.getArray(),
					objectsToPromote = [];
					
				contactPointArray.forEach(function (contactPoint, currentIndex) {
					if (contactPoint.hasFavoriteDataForAnyApp()) {
						contactPointArray.splice(currentIndex, 1);
						objectsToPromote.push(contactPoint);
					}
				});
				
				if (objectsToPromote.length > 0) {
					contactPointPropertyArray.clear();
					contactPointPropertyArray.add(objectsToPromote);
					contactPointPropertyArray.add(contactPointArray);
				}
			});
			
			timingRecorder.stopTimingForJob("Fixup_Restoring_Favorite_Data");
			
			//TODO: we should probably just return the decorated person object instead of generating the raw object
			return this.getDBObject();
		});
		
		return future;
	},
	
	
	
	// Eventually we might want to have this person object update itself automatically
	// and allow consumers of this library to be notified of when it changes, but
	// lets take the simple route first
	//
	/**
	 * Creates a DB watch for the current person object.  When the watch fires, the result will be set on the future that this method returns.
	 * @returns {Future} When the watch fires, the Future.result will be set to the latest raw person data
	 */
	watchForDatabaseChanges: function () {
		Assert.require(this.getId(), "watchForDatabaseChanges - cannot watch person that has no id");
		var query = {
				"from": this.getKind(),
				"where": [{
					"prop": "_id",
					"op": "=",
					"val": this.getId()
				}]
			},
			revId = this.getRev(),
			dbFuture;
		
//		if (revId) {
//			query.where.push({
//				"prop": "_rev",
//				"op": ">",
//				"val": revId
//			});
//		}
	
		dbFuture = DB.find(query, true);
		
		dbFuture.then(function () {
			var result = Utils.DBResultHelper(dbFuture.result);
			if (result && Array.isArray(result)) {
				result = result[0];
			}
			dbFuture.result = result;
		});
		
		return dbFuture;
	},
	
	/**
	 * Cancel the watch that was created by watchForDatabaseChanges
	 * @param {Future} future - this is the Future returned by {@link Person#watchForDatabaseChanges}
	 * @returns {boolean}
	 */
	stopWatchingForDatabaseChanges: function (future) {
		PalmCall.cancel(future);
		return true;
	},
	
	// TODO: implement this to ensure the defaults on the person's contact points don't disappear when performing fixup
	favoriteFixup: function () {
	},
	
	/**
	 * Return the appropriate ContactType for the current person.  If the current person is a
	 * PersonDisplay, this will reutrn ContactType.DISPLAYABLE.  If no match is found, ContactType.EDITABLE will be returned
	 * @returns {string} 
	 */
	getDefaultContactType: function () {
		if (this instanceof PersonDisplay) {
			return ContactType.DISPLAYABLE;
		} else if (this instanceof PersonLinkable) {
			return ContactType.LINKABLE;
		} else {
			return ContactType.EDITABLE;
		}
	},
	
	/**
	 * Delete the current person from the DB
	 * @returns {Future} The Future.result will be set to result of the call the delete the person from the DB.
	 */
	deletePerson: function () {
		var id = this.getId();
		Assert.require(id, "deletePerson unable to delete because there is no _id.");
		return DB.del([id]);
	},
	
	/**
	 * PRIVATE
	 *  Adds the favorite backup entries for this person.
	 * @returns {Future} The Future.result will be set to result of the call to update the favorite backups from the db
	 */
	_addFavoriteBackupDBEntries: function () {
		var toMapReduce = [],
			tempBackup,
			future = new Future(),
			that = this;
			
		if (this._isBeingSaved()) {
			future.now(this, function () {
				return this.reloadContacts();
			});

			future.then(this, function () {
				var contacts = future.result;

				return Foundations.Control.mapReduce({
					map: function (contact) {
						var mapFuture = new Future(),
							linkHash;

						mapFuture.now(function () {
							return ContactLinkable.getLinkHash(contact);
						});

						mapFuture.then(function () {
							linkHash = mapFuture.result.linkHash;
							
							return FavoriteBackup.getBackupForLinkhash(linkHash);
						});
						
						mapFuture.then(function () {
							var result = mapFuture.result,
								tempBackup;
							
							if (result) {
								tempBackup = result;
							} else {
								tempBackup = new FavoriteBackup({
									contactBackupHash: linkHash,
									defaultPropertyHashes: []
								});
							}

							that._setAllDefaultsInBackup(tempBackup);
							toMapReduce.push({"function": tempBackup.save, object: tempBackup});
							
							return true;
						});

						return mapFuture;
					}
				}, contacts);

			});
			
			future.then(this, function () {
				var result = future.result;
				return Utils.mapReduceAndVerifyResultsTrue(toMapReduce);
			});
			
			return future;
		} else {
			throw new Error("_addFavoriteBackupDBEntries: cannot call this method when the person is not being saved! Actually you probably shouldn't be calling this anyway!!");
		}
	},
	
	/**
	 * PRIVATE
	 *  Updates the favorite backup entries for this person.
	 * @returns {Future} The Future.result will be set to result of the call to update the favorite backups from the db
	 */
	_updateFavoriteBackupDBEntries: function () {
		var toMapReduce = [],
			i,
			future,
			tempId,
			j,
			contacts,
			that = this;
		
		if (this._isBeingSaved()) {
			
			future = new Future();
			
			future.now(this, function () {
				return this.reloadContacts();
			});
			
			future.then(this, function () {
				var result = future.result;
				
				contacts = result;
				
				contacts.forEach(function (contact) {
					toMapReduce.push({"function": Utils.curry(FavoriteBackup.getBackupForContact, contact)});
				});

				// Get all of the current favorite backups from the db
				return Utils.mapReduceAndReturnResults(toMapReduce);
			});
			
			// Loop through them and update the entries to have the new defaults that are set on this person
			future.then(this, function () {
				var favoriteBackups = future.result,
					i,
					tempBackup;
					
				toMapReduce = [];
				
				return Foundations.Control.mapReduce({
					map: function (tempBackup) {
						var mapFuture = new Future();
						
						mapFuture.now(function () {
							if (tempBackup) {
								return tempBackup.getContactBackupHashContactId();
							} else {
								console.log("_updateFavoriteBackupDBEntries: One of the backup entries for this person did not exist in the database.");
								console.log("_updateFavoriteBackupDBEntries (cont.d): Instead of failing we will go ahead and add this missing entry.");
								return null;
							}
						});
						
						mapFuture.then(function () {
							var result = mapFuture.result;
							
							if (result) {
								for (j = 0; j < contacts.length; j += 1) {
									if (result === contacts[j].getId()) {
										contacts.splice(j, 1);
									}
								}

								that._setAllDefaultsInBackup(tempBackup);
								toMapReduce.push({"function": tempBackup.save, object: tempBackup});
							}
							
							return true;
						});
						
						return mapFuture;
					}
				}, favoriteBackups);
				
			});
			
			future.then(this, function () {
				var result = future.result;
				
				// This means that not all of the records that should have been in the favoriteBackup table were there.
				// We need to add them rather than keep this hole.
				
				return Foundations.Control.mapReduce({
					map: function (contact) {
						var mapFuture = new Future();
						
						mapFuture.now(function () {
							return ContactLinkable.getLinkHash(contact);
						});
						
						mapFuture.then(function () {
							var result = mapFuture.result.linkHash,
							tempBackup;
							
							tempBackup = new FavoriteBackup({
								contactBackupHash: result,
								defaultPropertyHashes: []
							});
				
							that._setAllDefaultsInBackup(tempBackup);
							toMapReduce.push({"function": tempBackup.save, object: tempBackup});
						});
						
						return mapFuture;
					}
				}, contacts);
				
			});
			
			future.then(this, function () {
				var result = future.result;
				// Save the newly updated favorite backups
				return Utils.mapReduceAndVerifyResultsTrue(toMapReduce);
			});
			
			return future;
		} else {
			throw new Error("_updateFavoriteBackupDBEntries: cannot call this method when the person is not being saved! Actually you probably shouldn't be calling this anyway!!");
		}
	},
	
	/**
	  * PRIVATE
	  */
	_setAllDefaultsInBackup: function (favoriteBackup) {
		var currentSupportedType,
			tempDefaults,
			tempDefault,
			i,
			j;
		
		for (i = 0; i < Person.supportedFavoriteTypes.length; i += 1) {
			currentSupportedType = Person.supportedFavoriteTypes[i];
			tempDefaults = this._getDefaultContactPointsForTypeAndAppId(currentSupportedType);
			for (j = 0; j < tempDefaults.length; j += 1) {
				tempDefault = tempDefaults[j];
				favoriteBackup.setDefaultForContactPointType(tempDefault.getNormalizedValue(), currentSupportedType, tempDefault.getFavoriteData());
			}
		}
	},
	
	/**
	 * PRIVATE
	 *  Remove the favorite backup entries associated with this person from the db.
	 * @returns {Future} The Future.result will be set to result of the call to remove the favorite backups from the db
	 */
	_removeFavoriteBackupDBEntries: function () {
		var toMapReduce = [],
			future = new Future();
		
		if (this._isBeingSaved()) {
			future.now(this, function () {
				return this.reloadContacts();
			});
			
			future.then(this, function () {
				var contacts = future.result;
				
				contacts.forEach(function (contact) {
					toMapReduce.push({"function": Utils.curry(FavoriteBackup.removeBackupForContact, contact)});
				});
				
				return Utils.mapReduceAndVerifyResultsTrue(toMapReduce);
			});
			
			return future;
		} else {
			throw new Error("_removeFavoriteBackupDBEntries: cannot call this method when the person is not being saved! Actually you probably shouldn't be calling this anyway!!");
		}
	},
	
	/**
	 * Save the current person to the DB
	 * @returns {Future} The Future.result will be set to result of the call the save the person to the DB.
	 */
	// TODO: need a flag to indicate if fixup is required on the save
	//       we are locally calling fixup in the edit scene to get instant UI feedback
	save: function () {
		if (!this._isBeingSaved()) {
			this._setBeingSaved(true);
			
			var future;

			if (this.getId()) {
				future = DB.merge([this.getDirtyDBObject()]);
			} else {
				future = DB.put([this.getDBObject()]);
			}
			
			future.then(this, function (future) {
				var result = Utils.DBResultHelper(future.result),
					favoriteValue = this.getFavorite().getValue(),
					updatingFavorites = false;
				
				Assert.require(result, "savePerson put - result is null");
				Assert.requireArray(result, "savePerson put - result is not an array");
				Assert.require(result.length, "savePerson put - result length is zero");
				
				// Favorites handling code
				if (favoriteValue) {
					if (this.hasInstantiationFavoriteValueChanged() || (!this.getId())) {
						updatingFavorites = true;
						future.nest(this._addFavoriteBackupDBEntries());
					} else if (this._hasFavoriteDefaultsChanged()) {
						updatingFavorites = true;
						future.nest(this._updateFavoriteBackupDBEntries());
					}
				} else {
					if (this.hasInstantiationFavoriteValueChanged() && this.getId()) {
						updatingFavorites = true;
						future.nest(this._removeFavoriteBackupDBEntries());
					}
				}
				
				this.setId(result[0].id);
				this.setRev(result[0].rev);
				this.markNotDirty();
				
				if (!updatingFavorites) {
					future.result = true;
				}
				
			}).then(this, function (future) {
				var result = future.result,
					speedDialSaver;
				
				// SpeedDialBackup code
				speedDialSaver = new SpeedDialSaver(this);
				
				return speedDialSaver.saveBackupRecordsForSpeedDials();
			}).then(this, function (future) {
				var result = true;
				if (future && !future.result) {
					console.log("Person save ERROR!: Updating the favorites data failed");
					result = false;
				} else {
					// Now that the favorite fixup has been done, update the person's current
					// favorite state.
					this._updateInstantiationFavoriteValueToCurrentState();
					this._markFavoriteDefaultsUnChanged();
				}
				
				this._setBeingSaved(false);
				future.result = result;
			});
			
			return future;
		}
		
		throw new Error("You can't call save on a person that is currently being saved");
	},
	
	/**
	 * Ridiculously PRIVATE
	 * Save the current person to the DB doing some wicked sick magic to save a new person and a new contact
	 * and guarentee the autolinker does not smack the contact's person off.
	 * @returns {Future} The Future.result will be set to result of the call the save the person to the DB.
	 */
	_savePersonAttachingTheseContacts: function (newContacts, callSaveContactInDBOnly) {
		Assert.requireDefined(newContacts, "You must pass an array of contacts to _savePersonAttachingTheseContacts");
		Assert.requireArray(newContacts, "The parameter to _savePersonAttachingTheseContacts must be an array");
		Assert.require(newContacts.length > 0, "There must be contacts in the param to use _savePersonAttachingTheseContacts");
		
		var future = new Future(),
			contactsToGetIds = [],
			contactIds = [],
			reservedContactIds,
			contactsToSave = [],
			newContactIds = [],
			i,
			contactSaveFutureFunction,
			saveSuccessful = true;
		
		if (!this._isBeingSaved()) {
			this._setBeingSaved(true);
			
			
			future.now(this, function () {
				// No point in getting the ids for contacts that already have an id.
				// They must be in the db, so lets not make the mistake of adding them too.
				for (i = 0; i < newContacts.length; i += 1) {
					if (newContacts[i].getId()) {
						contactIds.push(newContacts[i].getId());
						contactsToSave.push(newContacts[i]);
						newContacts.splice(i, 1);
					}
				}
				
				if (newContacts.length > 0) {
					future.nest(DB.reserveIds(newContacts.length));
				} else {
					future.result = { ids: [] };
				}
			});
		
			// Got the reserved ids. Now lets add them to the contacts that need
			// them and save the person
			future.then(this, function () {
				var result = future.result;
			
				reservedContactIds = result.ids;
			
				if (reservedContactIds.length !== newContacts.length) {
					throw new Error("_savePersonAttachingTheseContacts failed because there were not enough reserved ids return to give to all the contacts");
				}
			
				for (i = 0; i < newContacts.length; i += 1) {
					newContacts[i].setId(reservedContactIds[i]);
					contactIds.push(reservedContactIds[i]);
					contactsToSave.push(newContacts[i]);
				}
				
				if (this.getContacts().length === 0) {
					future.nest(this.reloadContacts());
				} else {
					future.result = true;
				}
				
			});
			
			future.then(this, function () {
				this.getContactIds().clear();
				this.getContactIds().add(contactIds);
				future.nest(this.fixupFromObjects(this.getContacts().concat(newContacts), ContactType.EDITABLE));
			});
			
			future.then(this, function () {
				this._setBeingSaved(false);
				future.nest(this.save());
			});
			
			// Now that we saved the person go through and save all of the contacts
			//
			// TODO: Look into if this has to be done in a batch to guarentee that the
			// linker does not do something that will cause a funky race condition.
			// With an autolink and losing one of these new contactIds. Possibly there
			// could be an issue with the linker calling fixup and the updated contact
			// data is not fully saved.
			future.then(this, function () {
				var result = future.result,
					toMapReduce = [];
			
				if (result) {
					for (i = 0; i < contactsToSave.length; i += 1) {
						if (callSaveContactInDBOnly && contactsToSave[i].saveContactInDBOnly) {
							toMapReduce.push({"function": contactsToSave[i].saveContactInDBOnly, object: contactsToSave[i]});
						} else {
							toMapReduce.push({"function": contactsToSave[i].save, object: contactsToSave[i]});
						}
					}
					
					future.nest(Utils.mapReduceAndVerifyResultsTrue(toMapReduce));
				} else {
					console.log("There was an error saving person from _savePersonAttachingTheseContacts");
					this._setBeingSaved(true);
					saveSuccessful = false;
					future.nest(this._removeFavoriteBackupDBEntries());
				}
			});
			
			// Now that we are done saving all of the contacts. Mark the person as saved
			// and set the future result
			future.then(this, function () {
				var result = future.result;
				
				this._setBeingSaved(false);
				
				if (result && saveSuccessful) {
					future.result = true;
				} else {
					future.result = false;
				}
			});
			
			return future;
		}
			
		throw new Error("You can't call _savePersonAttachingTheseContacts on a person that is currently being saved");
	},
	
	
	/**
	 * Returns the string representation of {@link Person#getDBOBject}.  This is for testing.
	 * @returns {string}
	 */
	toString: function () {
		return JSON.stringify(this.getDBObject());
	},
	
	isDirty: function () {
		return Utils.callFunctionsOnProperties(this.accessor, Person.PROPERTIES.objects, "isDirty", Person.PROPERTIES.arrays, "containsDirtyEntry");
	},
	
	markNotDirty: function () {
		Utils.callFunctionsOnProperties(this.accessor, Person.PROPERTIES.objects, "markNotDirty", Person.PROPERTIES.arrays, "markElementsNotDirty");
	},
	
	// For the time being I am calling _equals on each of the contact properties by hand.
	// It would be cool if we had an easy way to iterate over all of them.
	equals: function (otherPerson) {
		var isEqual = true,
			i,
			j,
			tempArray,
			otherTempArray,
			property = "",
			properties = Person.PROPERTIES.objects,
			propertyArrays = Person.PROPERTIES.arrays;
		
		Assert.require(otherPerson instanceof Person, "The object passed into equals must be an instance of Person");
		
		for (i = 0; i < properties.length; i += 1) {
			property = properties[i];
			isEqual = isEqual && this.accessor(property).equals(otherPerson.accessor(property));
		}
		
		for (j = 0; j < propertyArrays.length; j += 1) {
			property = propertyArrays[j];
			tempArray = this.accessor(property).getArray();
			otherTempArray = otherPerson.accessor(property).getArray();
			
			for (i = 0; i < tempArray.length; i += 1) {
				isEqual = isEqual && tempArray[i].equals(otherTempArray[i]);
			}
		}
		
		return isEqual;
	},
	
	/**
	 * Set a cropped version of the given photo for the primary contact linked to this Person into 
	 * the database. This method will automatically crop and scale the images to the correct 
	 * size for photo type, and set the image onto the primary contact only. The type 
	 * parameter must be one of sizes found in PersonPhotos.TYPE.
	 * 
	 * @param path the path to the source image
	 * @param cropInfo cropping info used to generate the proper thumbnail
	 * @param photoType one of PersonPhotos.TYPE constants
	 * @returns future the future object that performs the cropping/scaling asynchronously. The
	 * future eventually returns the path to the cropped image.
	 */
	setCroppedContactPhoto: function (path, cropInfo, photoType) {
		var future,
			param = {};
		
		param.personId = this.getId();
		param.path = path;
		param.cropInfo = cropInfo;
		param.photoType = photoType;
		
		future = PalmCall.call("palm://com.palm.service.contacts/", "setCroppedContactPhoto", param);
		future.then(function () {
			var result = future.result;
			PalmCall.cancel(future);
			future.result = result;
		});
		return future;
	}, 
	
	//This is the workaround for babelfish-blowfish data migration
	//This function is called after the Person has the tmp_speedDial migrated to speedDial
	//both Person and Contact will strip the tmp_speedDial from its record
	stripTmpPhoneNumberField: function (obj) {
		var i,
			phoneNumber,
			contacts,
			contact,
			future;
		if (obj.length > 0) {
			this.getPhoneNumbers().clear();
			for (i = 0; i < obj.length; i += 1) {
				this.getPhoneNumbers().add(new PhoneNumber());
				phoneNumber = this.getPhoneNumbers().getArray()[i];
				phoneNumber.setValue(obj[i].value ? obj[i].value : phoneNumber.getValue());
				phoneNumber.setType(obj[i].type ? obj[i].type : phoneNumber.getType());
				phoneNumber.setPrimary(obj[i].primary ? obj[i].primary : phoneNumber.getPrimary());
				phoneNumber.setNormalizedValue(obj[i].normalizedValue ? obj[i].normalizedValue : phoneNumber.getNormalizedValue());
				phoneNumber.setSpeedDial(obj[i].speedDial ? obj[i].speedDial : phoneNumber.getSpeedDial());
			}
			
			future = Person.getLinkedContacts(this, ContactType.RAWOBJECT);
		
			future.then(this, function () {				
				contacts = future.result || [];

				for (i = 0; i < contacts.length; i += 1) {
					contact = new Contact(contacts[0]);
					contact.stripTmpPhoneNumberField(); 
					contact.save(); 
				}
				future.result = contacts;
			});
			
			return future;			
		}	
		
	}		

});

/**
 * The DB kind string for the Person object
 * @constant {string} kind
 */
Utils.defineConstant("kind", "com.palm.person:1", Person);

Person.PROPERTIES = { 
	objects: ["favorite", "sortKey", "name", "nickname", "organization", "photos", "reminder", "ringtone"],
	arrays: ["contactIds", "names", "searchTerms", "emails", "phoneNumbers", "ims"]
};

/**
 * Generates a display name for a raw person object.  This is used in situations where it is too expensive to have created
 * a decorated Person object.  The display name is based on the following criteria:<br>
 * 1) Name<br>
 * 2) Nickname<br>
 * 3) Organization Title && Organization Name<br>
 * 4) Organization Name<br>
 * 5) Email Address<br>
 * 6) PhoneNumber<br>
 * 7) "[No Name Available]"<br>
 * @param {Object} rawPerson Raw person object
 * @param {boolean} includeBasedOnField If false, the return value is a {string}<br>
 *						If true, the return value is an {Object}
 * @return {string OR Object} When an {Object} is returned, the baseOnField property will be set from one of the constants defined in {@link DisplayNameType}
 * @example
 * If includeBasedOnField is true, the returned {Object} will have this structure: 
 *		{
 *			displayName: displayName,
 *			basedOnField: basedOnField
 *		}
 * 
 */
//TODO: the logic in this needs to be merged with Utils.generateDisplayName somehow
Person.generateDisplayNameFromRawPerson = function (rawPerson, includeBasedOnField) {
	var obj = rawPerson,
		displayName = "",
		basedOnField = null,
		fullName = Name.getFullNameFromRawObject(obj.name), // FIXME: this needs to use a framework loc function to generate a displayName
		org;	
	
	if (fullName) {
		displayName = fullName;
		basedOnField = DisplayNameType.NAME;
	} else if (obj.nickname) {
		displayName = obj.nickname;
		basedOnField = DisplayNameType.NICKNAME;
	} 
	
	if (!displayName && obj.organization) {
		if (obj.organization.title && obj.organization.name) {
			displayName = obj.organization.title + ", " + obj.organization.name;
			basedOnField = DisplayNameType.TITLE_AND_ORGANIZATION_NAME;
		} else if (!obj.organization.title && obj.organization.name) {
			displayName = obj.organization.name;
			basedOnField = DisplayNameType.ORGANIZATION_NAME;
		} else if (obj.organization.title && !obj.organization.name) {
			displayName = obj.organization.title;
			basedOnField = DisplayNameType.TITLE;
		}
	}
	
	if (!displayName) {
		if (obj.emails && obj.emails.length) {
			displayName = obj.emails[0].value;
			basedOnField = DisplayNameType.EMAIL;
		} else if (obj.ims && obj.ims.length) {
			displayName = obj.ims[0].value;
			basedOnField = DisplayNameType.IM;
		} else if (obj.phoneNumbers && obj.phoneNumbers.length) {
			displayName = obj.phoneNumbers[0].value;
			basedOnField = DisplayNameType.PHONE;
		} else {
			displayName = RB.$L("[No Name Available]");
			basedOnField = DisplayNameType.NONE;
		}
	}
	
	if (includeBasedOnField) {
		return {
			displayName: displayName,
			basedOnField: basedOnField
		};
	} else {
		return displayName;
	}
};

/**
 * Fetches a person + all linked contacts from the DB based on the "id" param.  A decorated {@link PersonDisplay} object is created along with
 * a decorated {@link ContactDisplay} for each linked contact.
 * @param {string} id The DB _id for the person
 * @returns {Future} The Future.result will be set to the decorated {@link PersonDisplay} object which also contains an array of decorated {@link ContactDisplay} objects
 */
Person.getDisplayablePersonAndContactsById = function (id) {
	return Person.getPersonAndContactsById(id, PersonType.DISPLAYABLE, ContactType.DISPLAYABLE);
};

/**
 * Fetches a person + all linked contacts from the DB based on the "id" param.  A decorated {@link PersonLinkable} object is created along with
 * a decorated {@link ContactLinkable} for each linked contact.
 * @param {string} id The DB _id for the person
 * @returns {Future} The Future.result will be set to the decorated {@link PersonLinkable} object which also contains an array of decorated {@link ContactLinkable} objects
 */
Person.getLinkablePersonAndContactsById = function (id) {
	return Person.getPersonAndContactsById(id, PersonType.LINKABLE, ContactType.LINKABLE);
};

/**
 * Fetches a person + all linked contacts from the DB based on the "id" param.  A decorated {@link PersonType} object is created along with
 * a decorated {@link ContactType} for each linked contact.
 * @param {string} id The DB _id for the person
 * @param {string} personType The type of decorated person object to be created after the raw data has been fetched.  Constants defined in {@link PersonType}
 * @param {string} contactType The type of decorated contact objects to be created after the raw data has been fetched.  Constants defined in {@link ContactType}
 * @returns {Future} The Future.result will be set to the decorated `personType` object which also contains an array of decorated `contactType` objects
 */
Person.getPersonAndContactsById = function (id, personType, contactType) {
	Assert.requireString(id, "getPersonAndContactsById requires an id that is a String");
	Assert.requireString(personType, "getPersonAndContactsById requires a person type that is a String");
	Assert.requireString(contactType, "getPersonAndContactsById requires a contact type that is a String");
	
	var person = null,
		contacts = null;
	
	return Person.findById(id, personType).then(function (personFuture) {
		person = personFuture.result;
		Assert.require(person, "Unable to find person by Id");
		personFuture.nest(Person.getLinkedContacts(person, contactType));
	}).then(function (contactFuture) {
		contacts = contactFuture.result || [];
		person.setContacts(contacts);
		contactFuture.result = person;
	});
};

/**
 * Fetches all of the linked contacts for a {@link Person} from the DB.  The retrieved raw contacts are converted into decorated contact objects and returned.
 * @param {Person} person 
 * @param {string} contactType The type of decorated contact that should be created for each contact returned from the DB.  Constants defined in {@link ContactType}
 * @returns {Future} The Future.result will be set to the decorated `contactType` object 
 */
Person.getLinkedContacts = function (person, contactType) {
	Assert.require(person instanceof Person, "getLinkedContacts requires a decorated person arg");
	Assert.requireString(contactType, "getContacts requires a contactType that is a string");
	
	return DB.get(person.getContactIds().getDBObject()).then(function (theFuture) {
		var contacts = Utils.DBResultHelper(theFuture.result) || [],
			decoratedContacts = [],
			i;
		
		for (i = 0; i < contacts.length; i = i + 1) {
			decoratedContacts.push(ContactFactory.create(contactType, contacts[i]));
		}
		theFuture.result = decoratedContacts;
	});
};

/**
 * Link one person to another
 * @param {string} personToLinkTo The DB _id of the person to link to
 * @param {string} personToLink The DB _id of the person to link
 * @returns {Future} Future.result will be set to the result of calling manualLink on the contact linker service
 */
//luna-send -n 1 palm://com.palm.service.contacts.linker/manualLink '{ "personToLinkTo":id, "personToLink":id }'
Person.manualLink = function (personToLinkTo, personToLink) {
	Assert.requireDefined(personToLinkTo, "manualLink: missing required argument - personToLinkTo");
	Assert.requireDefined(personToLink, "manualLink: missing required argument - personToLink");
	var future = PalmCall.call("palm://com.palm.service.contacts.linker/", "manualLink", {
		"personToLinkTo": personToLinkTo,
		"personToLink": personToLink
	});
	future.then(function () {
		var result = future.result;
		PalmCall.cancel(future);
		future.result = result;
	});
	return future;
};

/**
 * Unlink a contact from a person
 * @param {string} personToRemoveLinkFrom The DB _id of the person to remove the link from
 * @param {string} contactToRemoveFromPerson The DB _id of the contact to remove from a person
 * @returns {Future} Future.result will be set to the result of calling manualUnlink on the contact linker service
 */
// luna-send -n 1 palm://com.palm.service.contacts.linker/manualUnlink '{ "personToRemoveLinkFrom":id, "contactToRemoveFromPerson":id }'
Person.manualUnlink = function (personToRemoveLinkFrom, contactToRemoveFromPerson) {
	Assert.requireDefined(personToRemoveLinkFrom, "manualUnlink: missing required argument - personToRemoveLinkFrom");
	Assert.requireDefined(contactToRemoveFromPerson, "manualUnlink: missing required argument - contactToRemoveFromPerson");
	var future = PalmCall.call("palm://com.palm.service.contacts.linker/", "manualUnlink", {
		"personToRemoveLinkFrom": personToRemoveLinkFrom,
		"contactToRemoveFromPerson": contactToRemoveFromPerson
	});
	future.then(function () {
		var result = future.result;
		PalmCall.cancel(future);
		future.result = result;
	});
	return future;
};

/**
 *
 * Favorite a person
 * @param {object} the data to favorite person. Form:
 *    { personId: "1", defaultData: { value: "1234", contactPointType: "ContactsLib.ContactPointTypes.PhoneNumber", listIndex: 3, auxData: { } }}
 * @returns {Future}
 *
 */
Person.favoritePerson = function (param) {
	var future = PalmCall.call("palm://com.palm.service.contacts/", "favoritePerson", param);
	future.then(function () {
		var result = future.result;
		PalmCall.cancel(future);
		future.result = result;
	});
	return future;
};

/**
 * PRIVATE
 * Mark the person as favorite
 * @param {object} the data to favorite person. Form:
 *    { personId: "1", defaultData: { value: "1234", contactPointType: "ContactsLib.ContactPointTypes.PhoneNumber", listIndex: 3, auxData: { } }}
 * @param {string} the application's bus id that is setting the favorite
 * @returns {Future}
 */
Person._favoritePerson = function (param, applicationID) {
	var personId,
		defaultData,
		personToFavorite,
		future = new Future();
	
	future.now(function () {
		personId = param.personId;
		defaultData = param.defaultData;
		
		future.nest(Person._getPersonAndSetFavoriteValueTo(personId, true));
	});
	
	future.then(function () {
		personToFavorite = future.result;
		
		if (defaultData) {
			future.nest(Person._setFavoriteDefault(param, applicationID));
		} else {
			future.result = true;
		}
	});
	
	future.then(function () {
		var result = future.result;
		
		future.nest(personToFavorite.save());
	});
	
	return future;
};

/**
 * Set a favorite default on a person
 * @param {object} the data to set default on a person. Form:
 *    { personId: "1", defaultData: { value: "1234", contactPointType: "ContactsLib.ContactPointTypes.PhoneNumber", listIndex: 3, auxData: { } }}
 * @returns {Future}
 */
Person.setFavoriteDefault = function (param) {
	var future = PalmCall.call("palm://com.palm.service.contacts/", "setFavoriteDefault", param);
	future.then(function () {
		var result = future.result;
		PalmCall.cancel(future);
		future.result = result;
	});
	return future;
};

/**
 * PRIVATE
 * @param {object} the data to favorite person. Form:
 *    { personId: "1", defaultData: { value: "1234", contactPointType: "ContactsLib.ContactPointTypes.PhoneNumber", listIndex: 3, auxData: { } }}
 * @param {string} the application's bus id that is setting the favorite
 * @returns {Future}
 */
Person._setFavoriteDefault = function (param, applicationID) {
	var personId,
		defaultData,
		personToSetDefaultOn,
		defaultsForApp,
		contactPointType,
		listIndex,
		value,
		type,
		i,
		future = new Future();
	
	future.now(function () {
		var contactPointTypeIsSupported = false;
		
		Assert.requireDefined(applicationID, "_setFavoriteDefault: missing required argument - applicationID");
		applicationID = applicationID.split(" ")[0];
		
		personId = param.personId;
		Assert.requireDefined(personId, "_setFavoriteDefault: missing required argument - personId");
		
		defaultData = param.defaultData;
		Assert.requireDefined(defaultData, "_setFavoriteDefault: missing required argument - defaultData");
		
		contactPointType = defaultData.contactPointType;
		listIndex = defaultData.listIndex;
		value = defaultData.value;
		type = defaultData.type;
		
		Assert.requireDefined(contactPointType, "_setFavoriteDefault: missing required defaultData property - contactPointType");
		
		contactPointTypeIsSupported = Person.supportedFavoriteTypes.some(function (supportedFavoriteType) {
			return contactPointType === supportedFavoriteType;
		});
		
		Assert.require(contactPointTypeIsSupported, "_setFavoriteDefault: unsupported contact point type specified");
		Assert.requireDefined(listIndex, "_setFavoriteDefault: missing required defaultData property - listIndex");
		Assert.requireDefined(value, "_setFavoriteDefault: missing required defaultData property - value");
		
		future.nest(Person.findById(personId));
	});
	
	future.then(function () {
		var setDefaultSuccess = false,
			defaultContactPointsForApp,
			tempDefaultContactPointForApp,
			normalizedValueForContactPoint;
		
		personToSetDefaultOn = future.result;
		
		Assert.requireDefined(personToSetDefaultOn, "_setFavoriteDefault: could not find the person with id - " + personId);
		Assert.require(personToSetDefaultOn.isFavorite(), "_setFavoriteDefault: cannot set a default on a person that is not a favorite");
		
		normalizedValueForContactPoint = Person._getNormalizedValueForContactPointType(contactPointType, value);
		
		setDefaultSuccess = personToSetDefaultOn._setDefaultForContactPointType(contactPointType, normalizedValueForContactPoint, type, applicationID, listIndex, defaultData.auxData);
		
		if (setDefaultSuccess) {
			// Don't pass in a contactPointType argument gives us all of the defaults which is necessary to
			// enforce only one default per person per app across multiple contact point types.
			defaultContactPointsForApp = personToSetDefaultOn._getDefaultContactPointsForTypeAndAppId(undefined, applicationID);
			
			// Clean up the other defaults set for this app.
			// This is what forces each app to only have one default
			// set.
			for (i = 0; i < defaultContactPointsForApp.length; i += 1) {
				tempDefaultContactPointForApp = defaultContactPointsForApp[i];
				if (tempDefaultContactPointForApp.getNormalizedValue() !== normalizedValueForContactPoint) {
					tempDefaultContactPointForApp.removeFavoriteDefaultForAppWithId(applicationID);
				}
			}
			
			// TODO look at potentially passing true or something into save rather than using this flag
			personToSetDefaultOn._markFavoriteDefaultsChanged();
			
			future.nest(personToSetDefaultOn.save());
		} else {
			// We could not set the default so throw exception
			throw new Error("Setting favorite default on person - " + personId + " - failed! Could not find a contact point with value - " + value + " - on person");
		}
	});
	
	return future;
};

/**
 * Mark the person as not a favorite - in db and in local object
 * @param {object} { personId: "personId" }
 * @returns {Future}
 */
Person.unfavoritePerson = function (param) {
	var future = PalmCall.call("palm://com.palm.service.contacts/", "unfavoritePerson", param);
	future.then(function () {
		var result = future.result;
		PalmCall.cancel(future);
		future.result = result;
	});
	return future;
};

/**
 * Mark the person as not a favorite
 * @param {object} { personId: "personId" }
 * @returns {Future}
 */
Person._unfavoritePerson = function (param) {
	var personId,
		future = new Future(),
		personToUnfavorite;
	
	future.now(function () {
		personId = param.personId;
		
		future.nest(Person._getPersonAndSetFavoriteValueTo(personId, false));
	});
	
	future.then(function () {
		personToUnfavorite = future.result;
		
		Person._removeFavoriteDefaults(personToUnfavorite);
		
		future.nest(personToUnfavorite.save());
	});
	
	return future;
};

/**
 * Set a specified photo for a person
 * @param {object} { personId: "personId", path: "/path/to/photo", cropInfo: {}, photoType: "" }
 * @returns {Future}
 */
Person._setCroppedContactPhotoPerson = function (param) {
	var personId = param.personId,
		contact,
		future = new Future();
	
	future.now(function () {
		console.log("Person._setCroppedContactPhotoPerson finding person for person ID: " + personId);
		return Person.getDisplayablePersonAndContactsById(personId);
	});
	
	future.then(function () {
		var personToSet = future.result;

        contact = personToSet.getContacts()[0];
		return contact.setCroppedContactPhoto(param.path, param.cropInfo, param.photoType);
	});

	future.then(function () {
		var result = future.result;
		return contact.save();
	});
	
	return future;
};

Person._removeFavoriteDefaults = function (person) {
	Assert.require(person, "Person passed to _removeFavoriteDefaults must be defined");
	
	var i,
		defaults,
		tempDefault;
		
	defaults = person._getDefaultContactPointsForTypeAndAppId();
		
	for (i = 0; i < defaults.length; i += 1) {
		tempDefault = defaults[i];
		tempDefault.removeAllFavoriteData();
	}
};

//TODO: may need some work, could join dupes and notDupes into one array
Person._discoverFavoriteSaverBackupDupes = function (favoriteSavers) {
	var i,
		j,
		tempSaverA,
		tempSaverAValue,
		tempSaverAType,
		tempSaverB,
		dupes = [],
		dupesDifferentFavoriteData = [],
		notDupes = [],
		wasDupe = false,
		tempSaverBType;
		
	Assert.requireArray(favoriteSavers, "You must pass in a valid array to Person._removeFavoriteSaverDupes");
	
	for (i = 0; i < favoriteSavers.length; i += 1) {
		wasDupe = false;
		tempSaverA = favoriteSavers[i];
		tempSaverAValue = tempSaverA.getValue();
		tempSaverAType = tempSaverA.getType();
		
		for (j = i + 1; j < favoriteSavers.length; j += 1) {
			tempSaverB = favoriteSavers[j];
			
			// Get the type of the saver
			tempSaverBType = tempSaverB.getType();
			
			if ((tempSaverAValue === tempSaverB.getValue()) && (tempSaverAType === tempSaverBType)) {
				wasDupe = true;
				if (_.isEqual(tempSaverA.getFavoriteData(), tempSaverB.getFavoriteData())) {
					dupes.push(tempSaverA);
				} else {
					dupesDifferentFavoriteData.push(tempSaverA);
					dupesDifferentFavoriteData.push(tempSaverB);
				}
			}
		}
		
		if (!wasDupe) {
			notDupes.push(tempSaverA);
		}
	}
	
	return { dupesDifferentFavoriteData: dupesDifferentFavoriteData, dupes: dupes, notDupes: notDupes };
};

// TODO: maybe take out the array of people for only one person
// since it should have all the contactIds on it
Person._getAllFavoriteBackupsForPeople = function (people) {
	var contactIds = [],
		tempContactIds,
		i,
		j,
		future = new Future(),
		toMapReduce = [];
	
	future.now(function () {
		Assert.requireArray(people, "You must pass in a valid array to Person._getAllFavoriteBackupsForPeople");
		
		for (i = 0; i < people.length; i += 1) {
			tempContactIds = people[i].getContactIds().getArray();
			for (j = 0; j < tempContactIds.length; j += 1) {
				contactIds.push(tempContactIds[j].getValue());
			}
		}
	
		// For some reason when passing an empty array into _.uniq it barfs and returns undefined.
		// Go figure.
		contactIds = _.uniq(contactIds) || [];
		
		return DB.get(contactIds).then(function (theFuture) {
			var contacts = Utils.DBResultHelper(theFuture.result) || [],
				decoratedContacts = [];
			
			contacts.forEach(function (contact) {
				decoratedContacts.push(new Contact(contact));
			});
			return decoratedContacts;
		});
	});
	
	future.then(function () {
		var result = future.result,
			contacts = result;
		
		contacts.forEach(function (contact) {
			toMapReduce.push({"function": Utils.curry(FavoriteBackup.getBackupForContact, contact)});
		});

		// Get all of the current favorite backups from the db
		return Utils.mapReduceAndReturnResults(toMapReduce);
	});
	
	return future;
};

/**
  * PRIVATE
  * Helper method to get a person and set it's favorite value
  * @param {string} the id of the person to get
  * @param {boolean} the favorite value to set
  * @returns {Future}
  */
Person._getPersonAndSetFavoriteValueTo = function (personId, favoriteValue) {
	var future = new Future();
	
	future.now(function () {
		Assert.requireDefined(personId, "_getPersonAndSetFavoriteValueTo: missing required argument - personId");
		
		future.nest(Person.findById(personId));
	});
	
	future.then(function () {
		var person = future.result;
		
		Assert.requireDefined(person, "_getPersonAndSetFavoriteValueTo: could not find the person with id - " + personId);
		
		person.getFavorite().setValue(favoriteValue);
		
		future.result = person;
	});
	
	return future;
};

/**
  * PRIVATE
  */
Person._getNormalizedValueForContactPointType = function (contactPointType, value) {
	var toReturn = value;
	
	switch (contactPointType) {
	case ContactPointTypes.PhoneNumber:
		toReturn = PhoneNumber.normalizePhoneNumber(value);
		break;
	case ContactPointTypes.EmailAddress:
		toReturn = EmailAddress.normalizeEmail(value);
		break;
	case ContactPointTypes.IMAddress:
		toReturn = IMAddress.normalizeIm(value);
		break;
	//case ContactPointTypes.Address:
	// TODO: implement normalize on address
		//toReturn = value;
		//break;
	//case ContactPointTypes.Url:
	// TODO: implement normalize on url
		//toReturn = value;
		//break;
	}
	
	return toReturn;
};


/**
 * Fetches the reminder string for a person based on the person id
 * @param {string} personId
 * @returns {Future} Future.result will be set to the reminder string
 */
Person.getReminder = function (personId) {
	Assert.requireString(personId, "Person.getReminder requires an id that is a string");
	return Person.findById(personId).then(function (getPersonFuture) {
		var person = getPersonFuture.result;
		getPersonFuture.result = person.getReminder().getValue();
	});
};

/*
 * Methods to find persons from the database
*/

/**
 * Fetch a person from the DB based on the id.
 * @param {string} id the DB _id of the person.
 * @param {string} personType The type of decorated person object to be returned. Constants defined in: {@link PersonType}.
 * @returns {Person} This will return a Person subclass based on the `personType` param or undefined if there were no matches.
 */
Person.findById = function (id, personType) {
	var future = new Future();
	
	future.now(function () {
		personType = personType || PersonType.DISPLAYABLE;

		Assert.requireString(id, "Person.findById requires an id that is a string");
		Assert.requireString(personType, "Person.findById requires a personType that is a string");

		future.nest(DB.get([id]));
	});
	
	future.then(function () {
		var result = Utils.DBResultHelper(future.result);
		
		//TODO: check the kind of the item that came back to see if it's com.palm.person:1?
		if (result && result[0] && result[0]._kind === Person.kind) {
			future.result = PersonFactory.create(result[0], personType);
		} else {
			future.result = undefined;
		}
	});
	
	return future;
};


/**
 * Fetch a person from the DB based on an email address.
 * @param {string} emailAddress The email address to use for the lookup.
 * @param {object} params A set of optional parameters:
 *					* includeMatchingItem If truthy, return the following instead of just the matching person:
 *							{
 *								item: exact item matching the query will be returned
 *								person: the person matching the query
 *							}
 *					* returnAllMatches If truthy, all database matches will be returned, else only one will be returned.  Defaults to falsy.
 *					* personType The type of decorated person object to be returned. Constants defined in: {@link PersonType}.  
 *									Defaults to PersonType.DISPLAYABLE.
 * @returns {Person} Unless includeMatchingItem is specified, this will return a Person subclass based 
 *						on the `personType` param or falsy/empty array if there were no matches.
 */
Person.findByEmail = function (emailAddress, params) {
	var future = new Future(),
		personType,
		normalizedEmail;
	
	future.now(function () {
		params = params || {};
		
		Assert.requireString(emailAddress, "Person.findByEmail requires an email address that is a string");
		
		personType = params.personType || PersonType.DISPLAYABLE;
		Assert.requireString(personType, "Person.findByEmail requires a personType that is a string");
		
		normalizedEmail = EmailAddress.normalizeEmail(emailAddress);
		
		var where = [{
			prop: "emails.normalizedValue",
			op: "=",
			val: normalizedEmail
		}];
		
		return Person._find(where, true, PersonType.RAWOBJECT);
	});
	
	future.then(function () {
		var potentiallyMatchingPersons = future.result,
			curPerson,
			i,
			matchesToReturn = [],
			match,
			matchingEmail,
			compareNormValue = function (email) {
				return email.normalizedValue === normalizedEmail;
			};
		
		if (!potentiallyMatchingPersons || potentiallyMatchingPersons.length === 0) {
			return Person._findByReturnEmpty(params.returnAllMatches);
		}
		
		//for each person found, find the matching email
		for (i = 0; i < potentiallyMatchingPersons.length; i += 1) {
			curPerson = potentiallyMatchingPersons[i];
			
			matchingEmail = _.detect(curPerson.emails, compareNormValue);
			
			//if we found a match, either return them or push them on the array we return
			if (matchingEmail) {
				match = Person._findByGenerateReturnValue(params.includeMatchingItem, personType, EmailAddressExtended, curPerson, matchingEmail);
				if (params.returnAllMatches) {
					matchesToReturn.push(match);
				} else {
					return match;
				}
			}
		}
		
		//once we get here, we either have no matches or we're returning all the matches we have
		//(the case where you have one or more matches and are only returning one of them was already handled above)
		if (matchesToReturn.length === 0) {
			//no matches, so return the correct empty result
			return Person._findByReturnEmpty(params.returnAllMatches);
		} else {
			return matchesToReturn;
		}
	});
	
	return future;
};

/**
 * Fetch a person from the DB based on an IM address.
 * @param {string} imAddress The IM address to use for the lookup.
 * @param {string} type (Optional) If provided, the lookup will only operate on IM addresses of the specified type.  See {@link IMAddress}.TYPE for the types.
 * @param {object} params A set of optional parameters:
 *					* includeMatchingItem If truthy, return the following instead of just the matching person:
 *							{
 *								item: exact item matching the query will be returned
 *								person: the person matching the query
 *							}
 *					* returnAllMatches If truthy, all database matches will be returned, else only one will be returned.  Defaults to falsy.
 *					* personType The type of decorated person object to be returned. Constants defined in: {@link PersonType}.  
 *									Defaults to PersonType.DISPLAYABLE.
 * @returns {Person} Unless includeMatchingItem is specified, this will return a Person subclass based 
 *						on the `personType` param or falsy/empty array if there were no matches.
 */
Person.findByIM = function (imAddress, type, params) {
	var future = new Future(),
		normalizedIMAddress,
		personType;
	
	future.now(function () {
		var where;
		
		params = params || {};
		
		Assert.requireString(imAddress, "Person.findByIM requires an im address that is a string");
		if (type) {
			Assert.requireString(type, "Person.findByIM requires the provided service name be a string");
		}
		
		personType = params.personType || PersonType.DISPLAYABLE;
		Assert.requireString(personType, "Person.findByIM requires a personType that is a string");
		
		normalizedIMAddress = IMAddress.normalizeIm(imAddress);
		
		where = [{
			prop: "ims.normalizedValue",
			op: "=",
			val: normalizedIMAddress
		}];
		
		return Person._find(where, true, PersonType.RAWOBJECT);
	});
	
	future.then(function () {
		var potentiallyMatchingPersons = future.result,
			curPerson,
			i,
			matchesToReturn = [],
			match,
			matchingIM,
			compareNormValueAndType = function (im) {
				//the normalizedValue has to be the same and either we don't care about type or it's the same
				return im.normalizedValue === normalizedIMAddress && (!type || im.type === type);
			};
		
		//if we didn't find any matches, just return the appropriate empty result
		if (!potentiallyMatchingPersons || potentiallyMatchingPersons.length === 0) {
			return Person._findByReturnEmpty(params.returnAllMatches);
		}
		
		//for each person found, find the matching im and optionally check to see if it has the right service name
		for (i = 0; i < potentiallyMatchingPersons.length; i += 1) {
			curPerson = potentiallyMatchingPersons[i];
			
			matchingIM = _.detect(curPerson.ims, compareNormValueAndType);
			
			//if we found a match, either return them or push them on the array we return
			if (matchingIM) {
				match = Person._findByGenerateReturnValue(params.includeMatchingItem, personType, IMAddressExtended, curPerson, matchingIM);
				if (params.returnAllMatches) {
					matchesToReturn.push(match);
				} else {
					return match;
				}
			}
		}
		
		//once we get here, we either have no matches or we're returning all the matches we have
		//(the case where you have one or more matches and are only returning one of them was already handled above)
		if (matchesToReturn.length === 0) {
			//no matches, so return the correct empty result
			return Person._findByReturnEmpty(params.returnAllMatches);
		} else {
			return matchesToReturn;
		}
	});
	
	return future;
};

/**
 * Fetch a person from the DB based on a phone number.
 * @param {string} phoneNumber The phone number to use for the lookup.
 * @param {object} params A set of optional parameters:
 *					* includeMatchingItem If truthy, return the following instead of just the matching person:
 *							{
 *								item: exact item matching the query will be returned
 *								person: the person matching the query
 *							}
 *					* returnAllMatches If truthy, all database matches will be returned, else only one will be returned.  Defaults to falsy.
 *					* personType The type of decorated person object to be returned. Constants defined in: {@link PersonType}.  
 *									Defaults to PersonType.DISPLAYABLE.
 *                  * mcc The MCC of the carrier the device is currently connected to, which helps in properly parsing the phone number
 * @returns {Person} Unless includeMatchingItem is specified, this will return a Person subclass based 
 *						on the `personType` param or falsy/empty array if there were no matches.
 */
Person.findByPhone = function (phoneNumber, params) {
	var future = new Future(),
		parsedPhoneNumber,
		personType;
	
	future.now(function () {
		params = params || {};
		
		Assert.requireString(phoneNumber, "Person.findByPhone requires a phone number that is a string");
		
		personType = params.personType || PersonType.DISPLAYABLE;
		Assert.requireString(personType, "Person.findByPhone requires a personType that is a string");
		
		var normalizedPhoneNumber,
			where;
		
		parsedPhoneNumber = Globalization.Phone.parsePhoneNumber(phoneNumber, undefined, params.mcc);
		if (!parsedPhoneNumber) {
			//if parsing doesn't work for some reason, set the result to something falsy here, which will cause us to return undefined below
			return null;
		}
		normalizedPhoneNumber = PhoneNumber.normalizePhoneNumber(parsedPhoneNumber, true);
		if (!normalizedPhoneNumber) {
			//if normalizing doesn't work for some reason, set the result to something falsy here, which will cause us to return undefined below
			return null;
		}
		
		where = [{
			prop: "phoneNumbers.normalizedValue",
			op: "%",
			val: normalizedPhoneNumber
		}];
		
		return Person._find(where, true, PersonType.RAWOBJECT);
	});
	
	future.then(function () {
		var potentiallyMatchingPersons = future.result,
			potentiallyMatchingPerson,
			realMatches,
			i,
			j,
			pmpPhoneNumbers,
			pmpPhoneNumber,
			parsedPmpPhoneNumber,
			matchQuality,
			match;
		
		if (!potentiallyMatchingPersons || potentiallyMatchingPersons.length === 0) {
			return Person._findByReturnEmpty(params.returnAllMatches);
		}
		
		realMatches = [];
		//loop across each person returned
		for (i = 0; i < potentiallyMatchingPersons.length; i += 1) {
			potentiallyMatchingPerson = potentiallyMatchingPersons[i];
			pmpPhoneNumbers = potentiallyMatchingPerson.phoneNumbers;
			
			//loop across each phone number this person has
			for (j = 0; j < pmpPhoneNumbers.length; j += 1) {
				pmpPhoneNumber = pmpPhoneNumbers[j];
				
				//parse the number, then compare it to the one passed in
				parsedPmpPhoneNumber = Globalization.Phone.parsePhoneNumber(pmpPhoneNumber.value);
				matchQuality = Globalization.Phone.comparePhoneNumbers(parsedPhoneNumber, parsedPmpPhoneNumber);
				
				//if we have a match, create the right return value and then either return it or add it to the array
				if (matchQuality > 0) {
					match = Person._findByGenerateReturnValue(params.includeMatchingItem, personType, PhoneNumberExtended, potentiallyMatchingPerson, pmpPhoneNumber);
					if (params.returnAllMatches) {
						realMatches.push({
							match: match,
							quality: matchQuality
						});
					} else {
						return match;
					}
				}
			}
		}
		
		if (realMatches.length === 0) {
			return Person._findByReturnEmpty(params.returnAllMatches);
		} else {
			realMatches.sort(function (elem1, elem2) {
				return elem1.quality - elem2.quality;
			});
			
			return realMatches.map(function (elem) {
				return elem.match;
			});
		}
	});
	
	return future;
};

//a helper method for the Person.findByXXX methods that generates the proper return value given the specified personType and includeMatchingItem params
Person._findByGenerateReturnValue = function (includeMatchingItem, personType, ItemConstructor, person, item) {
	if (personType !== PersonType.RAWOBJECT) {
		item = new ItemConstructor(item);
	}
	if (includeMatchingItem) {
		return {
			person: PersonFactory.create(person, personType),
			item: item
		};
	} else {
		return PersonFactory.create(person, personType);
	}
};

//a helper method for the Person.findByXXX methods that generates the proper empty return value for the given returnAllMatches params
Person._findByReturnEmpty = function (returnAllMatches) {
	if (returnAllMatches) {
		return [];
	} else {
		return null;
	}
};

Person._find = function (where, returnAllMatches, personType) {
	var future = DB.find({
		from: Person.kind,
		where: where
	});
	
	personType = personType || PersonType.DISPLAYABLE;
	Assert.requireString(personType, "Person._find requires a personType that is a string");
	
	future.then(function (future) {
		var result = future.result;
		
		if (!result || !result.results || result.results.length === 0) {
			return null;
		}
		
		if (returnAllMatches) {
			return result.results.map(function (person) {
				return PersonFactory.create(person, personType);
			});
		} else {
			return PersonFactory.create(result.results[0], personType);
		}
	});
	
	return future;
};

Person.getContactIdsFromLauncherCallbackId = function (launcherCallbackId) {
	Assert.requireString(launcherCallbackId, "Person.getContactIdsFromLauncherCallbackId requires launcherCallbackId to be a string");
	
	return launcherCallbackId.split(Person.DELIMITER);
};

/**
 * Fetch a person given an array of contactIds.
 * @param {array} contactIds - The array of contactIds to find the best matching person
 * @param {string} personType - The type of person to return.
 * @returns {future -> future.result = Person} returns the closest person match given the contactIds
 */
Person.findByContactIds = function (contactIds, personType) {
	var future = new Future();
	
	future.now(function () {
		var where;
		
		Assert.requireArray(contactIds, "Person.findByContactIds requires a contactIds parameter that is an array");
		
		personType = personType || PersonType.DISPLAYABLE;
		
		Assert.requireString(personType, "Person.findByContactIds requires a personType parameter that is a string");
		Assert.require(personType !== PersonType.RAWOBJECT, "Person.findByContactIds does not allow personType of RAWOBJECT");
		
		where  = {
			prop: "contactIds", 
			op: "=",
			val: contactIds
		};
		
		return Person._find([where], true, personType);
	});
	
	future.then(function () {
		var result = future.result,
			personsAlreadySeen = {},
			bestPersonMatch,
			mostMatchedContactIdsCount = 0;
			
		if (result && result.length > 0) {
			result.some(function (person) {
				var personsContactIds,
					matchedContactIdsCount;
				
				// Deal with duped people from find
				if (personsAlreadySeen[person.getId()]) {
					return false;
				}
				
				personsContactIds = person.getContactIds().getArray();
				
				personsContactIds = personsContactIds.map(function (contactId) {
					return contactId.getValue();
				});
				
				// If the current person has the primary from the contactIdsString
				// we want to return that person.
				if (personsContactIds.indexOf(contactIds[0]) >= 0) {
					// We found a person that had the primary contactId. Return the person and
					// stop the looping.
					bestPersonMatch = person;
					return true;
				} else {
					// Get the number of matched contacts the current person has
					matchedContactIdsCount = _.intersect(personsContactIds, contactIds).length;
					
					if (matchedContactIdsCount > mostMatchedContactIdsCount) {
						bestPersonMatch = person;
						mostMatchedContactIdsCount = matchedContactIdsCount;
					}
					
					personsAlreadySeen[person.getId()] = true;	
				}
				
				// We did not find the person that has the primary contactId from the contactIdsString
				// Return false to keep looping
				return false;
			});
			
			return bestPersonMatch;
		} else {
			return null;
		}
	});
	
	return future;
};

Person.orderContactIds = function (person, otherPeopleToMerge, newContactToMerge) {
	var arraysToSort = [],
		primaryContactToSave,
		tempContactsArray,
		fingerWalkerSorter,
		sortedContacts,
		sortedContactIds;
	
	tempContactsArray = person.getContacts();
	
	if (newContactToMerge) {
		arraysToSort.push([newContactToMerge]);
	} else {
		primaryContactToSave = tempContactsArray.shift();
	}
	
	arraysToSort.push(tempContactsArray);
	
	if (otherPeopleToMerge && _.isArray(otherPeopleToMerge)) {
		otherPeopleToMerge.forEach(function (personToMerge) {
			arraysToSort.push(personToMerge.getContacts());
		});
	}
	
	fingerWalkerSorter = new FingerWalkerSorter(arraysToSort, Person.contactOrderComparator);
	sortedContacts = fingerWalkerSorter.sort();
	
	sortedContactIds = _.map(sortedContacts, function (contact) {
		return contact.getId();
	});
	
	if (primaryContactToSave) {
		sortedContactIds.splice(0, 0, primaryContactToSave.getId());
	}
	
	return sortedContactIds;
};

Person.contactOrderComparator = function (contactsToCompare) {
	var lowestContactPriorityValue,
		lowestIndex,
		getPriorityValue = function (contact) {
			var priorityValue = Person.SYNC_SOURCE_PRIORITY_LIST[contact.getKindName()];

			if (priorityValue === undefined) {
				priorityValue = Person.SYNC_SOURCE_PRIORITY_LIST.thirdParty;
			}
			
			return priorityValue;
		};
	
	contactsToCompare.forEach(function (contactToCompare, currentIndex) {
		var tempContactPriorityValue;
		
		if (lowestIndex === undefined) {
			lowestContactPriorityValue = getPriorityValue(contactToCompare);
			
			lowestIndex = currentIndex;
			
			return;
		}
		
		tempContactPriorityValue = getPriorityValue(contactToCompare);
		
		if (tempContactPriorityValue < lowestContactPriorityValue) {
			lowestContactPriorityValue = tempContactPriorityValue;
			lowestIndex = currentIndex;
		}
	});
	
	return lowestIndex;
};

Person.supportedFavoriteTypes = [ContactPointTypes.PhoneNumber, ContactPointTypes.EmailAddress, ContactPointTypes.IMAddress];

Person.SYNC_SOURCE_PRIORITY_LIST = {
	"com.palm.contact.linkedin": 1,
	"com.palm.contact.facebook": 2,
	"com.palm.contact.eas": 3,
	"com.palm.contact.palmprofile": 4,
	"thirdParty": 5,
	"com.palm.contact.google": 6,
	"com.palm.contact.yahoo": 7,
	"com.palm.contact.sim": 8,
	"com.palm.contact.attaddresssync": 9,
	//IM
	"com.palm.contact.skype": 10,
	"com.palm.contact.libpurple": 11,
	"com.palm.contact.imyahoo": 12
};

Person.DELIMITER = ":(|)";

/** 
 * Exported from {@link Person}
 * @name Person.kind
 * @extends Person
 */
exports.Person = Person;


//@ sourceURL=contacts/PersonDisplay.js

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


//@ sourceURL=contacts/PersonDisplayLite.js

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


//@ sourceURL=contacts/PersonLinkable.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, Class, Utils, Person, ArrayUtil, Future, DB, PersonFactory */

//TODO - Add method for manual link of a contact to a person

var PersonLinkable = Class.create(Person, {
	initialize: function initialize(rawPerson) {
		this.$super(initialize)(rawPerson);
		//_.extend(this, person);
		
		// initialize the display properties
		this._init();
		
		// If a person was passed in, create display params based on the person params
		if (rawPerson) {
			//this.generateDisplayParams();
		}
	},
	
	/**
	 * These are linkable-only properties
	 */
	_init: function () {
		// this.displayName = "";
		// this.fullName = "";
		// this.workInfoLine = "";
		// this.contactCount = "";
	},

	/**
	 * Reset the linkable params and the params on the person
	 */
//	reset: function reset() {
//		this.$super(reset)();
//		this._init();
//	},
	
	addContact: function (contact) {
		if (contact) {
			if (contact.getId()) {
				this.getContactIds().add(contact.getId());
			}
		}
	},
	
	removeContactId: function (contactId) {
		if (contactId) {
			return this.getContactIds().remove(contactId);
		}
	},
	
	copyOfContactIds: function () {
		return ArrayUtil.copyOfArray(this.getContactIds().getDBObject());
	},
	
	mergeContactIds: function (otherContactIds) {
		if (otherContactIds) {
			//ArrayUtil.pushAll(this.contactsIds, otherContactsIds);
			this.getContactIds().add(otherContactIds);
		}
	},
	
	linkSingleContact: function (contact) {
		this.mergeContactIds([contact.getId()]);
	},
	
	mergePeople: function (peopleToMerge, doneMergeFuture) {
		this.mergePeopleAndContact(peopleToMerge, undefined, doneMergeFuture);
	},
	
	// People to merge may contain the current person.
	// In that case it is ignored in the array
	mergePeopleAndContact: function (peopleToMerge, contact, doneMergeFuture) {
		var doneSaveUpdatedPersonFuture = new Future(),
			doneRemovePeopleFromDBFuture = new Future(),
			doneGettingPersonForFutureSaving = new Future(),
			ids = [],
			i,
			tempPerson;

		if (peopleToMerge) {
			for (i = 0; i < peopleToMerge.length; i += 1) {
				tempPerson = peopleToMerge[i];
				if (tempPerson.getId() !== this.getId()) {
					ids.push(tempPerson.getId());
					this.mergeContactIds(tempPerson.getContactIds().getArray());
				}
			}
		}

		if (contact) {
			this.mergeContactIds([contact.getId()]);
		}

		doneSaveUpdatedPersonFuture.nest(this.save());

		doneSaveUpdatedPersonFuture.then(this, function (doneSaveFuture) {
			if (doneSaveFuture.result) {
				//console.log("Updated person record saved");
				doneRemovePeopleFromDBFuture.nest(DB.del(ids));
				//doneRemovePeopleFromDBFuture.result = true;
			} else {
				//console.log("Updated person record failed to save");
				doneMergeFuture.result = {
					newPerson: undefined
				};
			}
		});

		doneRemovePeopleFromDBFuture.then(this, function (doneRemove) {
			if (doneRemove.result && doneRemove.result.results) {
				//console.log("Removed the other person objects");
			} else {
				//console.log("!!!!Failed to remove the other person object!!!!");
			}

			doneGettingPersonForFutureSaving.nest(DB.find({
				"from": Person.kind,
				"where": [{
					"prop": "_id",
					"op": "=",
					"val": this.getId()
				}]
			}));
		});

		// We need to get the latest record from the db so we can do fix up on it later
		doneGettingPersonForFutureSaving.then(this, function (doneGettingCurrent) {
			var result = Utils.DBResultHelper(doneGettingCurrent.result);
			
			if (result) {
				if (result.length > 0) {
					doneMergeFuture.result = {
						newPerson: PersonFactory.createPersonLinkable(result[0])
					};
				} else {
					//console.log("Could not get the current person from db");
					doneMergeFuture.result = {
						newPerson: this
					};
				}
			} else {
				//console.log("Could not get the current person from db");
				doneMergeFuture.result = {
					newPerson: this
				};
			}

		});
	}
});

//@ sourceURL=contacts/PersonType.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports */

/**
 * @namespace
 * This object is just a global enum for use with the ContactFactory
 */
var PersonType = {
	/** @field {string}*/
	DISPLAYABLE: "displayable",
	/** @field {string}*/
	DISPLAYLITE: "displaylite",
	/** @field {string}*/
	LINKABLE: "linkable",
	/** @field {string}*/
	RAWOBJECT: "rawobject"
};

/** 
 * Exported from {@link PersonType}
 * @extends PersonType
 */
exports.PersonType = PersonType;


//@ sourceURL=contacts/PersonFactory.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, Class, _, Person, PersonDisplay, PersonDisplayLite, PersonLinkableMethods, 
PersonLinkable, PersonType */

/**
 * @name PersonFactory
 * @namespace
 */
var PersonFactory = {
	
	/**
	 * Create a PersonDisplayLite - inexpensively extends a raw person object
	 * @name PersonFactory.createPersonDisplayLite
	 * @param {Object} rawPersonObject
	 */
	createPersonDisplayLite: function (rawPersonObject, sortOrder) {
		return PersonDisplayLite.create(rawPersonObject, sortOrder);
	},
	
	createPersonDisplay: function (rawPersonObject) {
		return new PersonDisplay(rawPersonObject);
	},
	
	createPersonLinkable: function (rawPersonObject) {
		return new PersonLinkable(rawPersonObject);
	},
	
	create: function (rawPersonObject, personType, sortOrder) {
		switch (personType) {
		case PersonType.DISPLAYABLE:
			return PersonFactory.createPersonDisplay(rawPersonObject);
		case PersonType.DISPLAYLITE:
			return PersonDisplayLite.create(rawPersonObject, sortOrder);
		case PersonType.LINKABLE:
			return PersonFactory.createPersonLinkable(rawPersonObject);
		case PersonType.RAWOBJECT:
			return rawPersonObject;
		default:
			return PersonFactory.createPersonDisplay(rawPersonObject);
		}
	}
};

/** 
 * Exported from {@link PersonFactory}
 * @extends PersonFactory
 */
exports.PersonFactory = PersonFactory;


//@ sourceURL=contacts/SimContact.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, Class, _, Contact, Person, DisplayNameType, Organization, ContactPhoto, LIB_ROOT, Utils, SimIndex, SimEntryType, Assert, PhoneNumber, DB */


var SimContact = Class.create(Contact, {
	initialize: function initialize(obj) {
		this.$super(initialize)(obj);
		
		// initialize the display properties
		this._init(obj);
	},
	
	_init: function (obj) {
		if (!obj) {
			obj = {};
		}
		var hasDatabaseId = !!obj._id;
		//if (tempContact.getSimIndex() === index && tempContact.getSimEntryType() === type) 
		
		this.setKind(SimContact.kind);
		this._extendWithPropertyAndValue("simIndex", Utils.lazyWrapper(SimIndex, [obj.simIndex, hasDatabaseId]));
		this._extendWithPropertyAndValue("simEntryType", Utils.lazyWrapper(SimEntryType, [obj.simEntryType, hasDatabaseId]));
	},
	
	getSimIndex: function () {
		return this.accessor("simIndex");
	},
	
	setSimIndex: function (value) {
		this.getSimIndex().setValue(value);
	},
	
	getSimEntryType: function () {
		return this.accessor("simEntryType");
	},
	
	setSimEntryType: function (value) {
		this.getSimEntryType().setValue(value);
	},
	
	setPhoneNumber: function (obj) {
		var phoneNumbers = this.getPhoneNumbers().getArray(),
			phoneNumber;
		
		if (phoneNumbers.length > 0) {
			phoneNumber = this.getPhoneNumbers().getArray()[0];
			phoneNumber.setValue(obj.value ? obj.value : phoneNumber.getValue());
			phoneNumber.setType(obj.type ? obj.type : phoneNumber.getType());
		} else {
			this.getPhoneNumbers().add(new PhoneNumber(obj));
		}
	},
	
	deleteContactInDBOnly: function () {
		var id = this.getId();
		
		Assert.requireDefined(id, "deleteContactInDBOnly unable to delete, there is no _id param");
		
		// Just delete the contact by Id
		return DB.del([id]);
	},
	
	saveContactInDBOnly: function () {
		var future;
		
		// if this object has a DB _id then use merge
		if (this.getId()) {
			future = DB.merge([this.getDBObject()]);
		}
		else {
			future = DB.put([this.getDBObject()]);	
		}
		
		future.then(this, function (future) {
			var result = Utils.DBResultHelper(future.result);
			Assert.require(result, "SimContact save put - result is null");
			Assert.requireArray(result, "SimContact save");
			Assert.require(result.length, "SimContact save put - result length is zero");
			this.setId(result[0].id);
			this.setRev(result[0].rev);
			this.markNotDirty();
			future.result = true;
		});
		
		return future;
	}	
});

exports.SimContact = SimContact;

SimContact.getSimContactbyId = function (id) {
	Assert.requireDefined(id, "getSimContactById unable to get contact, there is no _id param");
	return DB.get([id]).then(function (future) {		
		var result = Utils.DBResultHelper(future.result),
			contactsToReturn = [];
		if (result && result.length > 0) {
			result.forEach(function (contact) {
				contactsToReturn.push(new SimContact(contact));
			});
			future.result = contactsToReturn;
		} else {
			future.result = [];
		}
	}); 
};

SimContact.getContactsByAccountId = function (accountId) {
	Assert.requireString(accountId, "SimContact.getContactsByAccountId requires an accountId that is a valid string");
	
	return DB.find({
		from: SimContact.kind,
		where: [{
			prop: "accountId",
			op: "=",
			val: accountId
		}],
		orderBy: "simIndex"
	}).then(function (future) {
		var result = Utils.DBResultHelper(future.result),
			contactsToReturn = [];
		if (result && result.length > 0) {
			result.forEach(function (contact) {
				contactsToReturn.push(new SimContact(contact));
			});
			future.result = contactsToReturn;
		} else {
			future.result = [];
		}
	});
};

SimContact.kind = "com.palm.contact.sim:1";

//@ sourceURL=contacts/SpeedDialBackup.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, Assert, JSON, Utils, DB, PalmCall, ContactBackupHash, PropertyArray, SpeedDialHash, Contact, ContactLinkable, Future */

var SpeedDialBackup = exports.SpeedDialBackup = Class.create({
	/** @lends SpeedDialBackup#*/
	
	/**
	 * This defines a decorated SpeedDialBackup.  This object hides the raw SpeedDialBackup data and exposes methods for accessing decorated
	 * property objects for which getters/setters can be called.  These decorated properties also hide raw data, and can be passed 
	 * directly to framework widgets.
	 * @constructs
	 * @param {Object} rawSpeedDialBackup - raw speedDialBackup object
	 * @example
	 * var speedDialBackup = new SpeedDialBackup({
	 *                     contactBackupHash: 3XC8|local,
	 *                     speedDials: [{
	 *                          key: "k",
	 *                          hashedPhoneNumber: "3289hjf2*#2320j"
	 *                });
	 * 
	 * var speedDialBackupContactHash = speedDialBackup.getContactBackupHash();
	 */
	initialize: function (obj) {
		if (!obj) {
			obj = {};
		}
		
		var rawSpeedDialBackup = obj,
			_data = {
				_kind: SpeedDialBackup.kind,
				_id: rawSpeedDialBackup._id,
				_rev: rawSpeedDialBackup._rev,
				_del: rawSpeedDialBackup._del,
				contactBackupHash: Utils.lazyWrapper(ContactBackupHash, [rawSpeedDialBackup.contactBackupHash, true]),
				speedDials: Utils.lazyWrapper(PropertyArray, [SpeedDialHash, rawSpeedDialBackup.speedDials, true])
			};

		/**
		 * This method should only be used internally.  This allows us to control access to the private data
		 * above.  This has been implemented to only fetch data.  This cannot be used to set the private fields.
		 * Individual setters will be implemented below for fields that require the ability to be set.
		 * @private
		 * @param {string} fieldName
		 */
		this.accessor = function (fieldName) {
			var field = _data[fieldName];
			Assert.requireDefined(fieldName, "fieldName must be specified for the accessor");
			//Assert.require(field, "the field you requested does not exist: _data[" + fieldName + "]");
			
			if (field && typeof field === "object" && field.isLazyWrapper) {
				field = _data[fieldName] = field.createInstance();
			}
			
			return field;
		};
		
		/**
		 * Setter for the _id field
		 * @param {string} id
		 */
		this.setId = function (id) {
			_data._id = id;
		};
		
		/**
		 * Setter for the _rev field
		 * @param {string} rev
		 */
		this.setRev = function (rev) {
			_data._rev = rev;
		};
		
		/**
		 * This converts the favoriteBackup into a database writable object
		 * This calls getDBObjects on all properties and combines the data into one object
		 * @returns {Object} The raw database object
		 */
		this.getDBObject = function () {
			return Utils.getDBObjectForAllProperties(this.accessor, _.keys(_data));
		};
	},

	/**
	 * Gets the id for favorite backup
	 * @returns {string} The id
	 */
	getId: function () {
		return this.accessor("_id");
	},

	/**
	 * Gets the kind for favorite backup
	 * @returns {string} The kind
	 */
	getKind: function () {
		return this.accessor("_kind");
	},
	
	/**
	 * Gets the contactBackupHash for this favorite backup
	 * @returns {string} The contactBackupHash
	 */
	getContactBackupHash: function () { 
		return this.accessor("contactBackupHash");
	},
	
	/**
	 * Gets the contactId for this speeddial backup from the contactBackupHash
	 * @returns {string} The id of the contact for this speeddial backup
	 */
	getContactBackupHashContactId: function () {
		var backupHash = this.getContactBackupHash().getValue();
		
		return Contact.getIdFromLinkHash(backupHash);
	},
	
	/**
	 * @returns {array} The speeddials for this contact
	 */
	getSpeedDials: function () {
		return this.accessor("speedDials");
	},
	
	/**
	 * Delete the current speeddial backup from the DB
	 * @returns {Future} The Future.result will be set to result of the call the delete the speeddial backup from the DB.
	 */
	deleteSpeedDialBackup: function () {
		var id = this.getId();
		Assert.requireDefined(id, "deleteSpeedDialBackup unable to delete, there is no _id param");
		
		return DB.del([id]);
	},
	
	/**
	 * Save the current speeddial backup to the DB
	 * @returns {Future} The Future.result will be set to result of the call the save the speeddialBackup to the DB.
	 */
	save: function () {
		return DB.put([this.getDBObject()]).then(this, function (future) {
			var result = Utils.DBResultHelper(future.result);
			Assert.require(result, "SpeedDialBackup save put - result is null");
			Assert.requireArray(result, "SpeedDialBackup save");
			Assert.require(result.length, "SpeedDialBackup save put - result length is zero");
			
			this.setId(result[0].id);
			this.setRev(result[0].rev);
			future.result = true;
		});
	},
	
	/**
	 * Returns the string representation of {@link SpeedDialBackup#getDBOBject}.  This is for testing.
	 * @returns {string}
	 */
	toString: function () {
		return JSON.stringify(this.getDBObject());
	}
});

SpeedDialBackup.kind = "com.palm.person.speeddialbackup:1";

/**
 * Gets a speeddial backup for a given contact.
 * @param {object} contact - the contact that the speeddial backup is associated with
 * @returns {Future.result -> SpeedDialBackup} The speeddial backup for the contact id specified
 */
SpeedDialBackup.getBackupForContact = function (contact) {
	Assert.require(contact, "SpeedDialBackup.getBackupForContact requires a contact");
	
	var future = new Future();
	
	future.now(function () {
		return ContactLinkable.getLinkHash(contact);
	});
	
	future.then(function () {
		var result = future.result.linkHash;
		
		return SpeedDialBackup.getBackupForLinkhash(result);
	});
	
	return future;
};

SpeedDialBackup.getBackupsForLinkHashes = function (linkHashes) {
	var future = new Future();
	
	future.now(function () {
		return DB.find({
			"from": SpeedDialBackup.kind,
			"where": [{
				"prop": "contactBackupHash",
				"op": "=",
				"val": linkHashes
			}]
		});
	});
	
	future.then(function () {
		//console.log(JSON.stringify(future.result));
		var result = Utils.DBResultHelper(future.result),
			speedDialBackups = [];
		if (result) {
			result.forEach(function (rawSpeedDialBackup) {
				speedDialBackups.push(new SpeedDialBackup(result[0]));
			});
			
			return speedDialBackups;
		} else {
			future.result = undefined;
		}
	});
	
	return future;
};

SpeedDialBackup.getBackupForLinkHash = function (linkHash) {
	var future = new Future();
	
	future.now(function () {
		return DB.find({
			"from": SpeedDialBackup.kind,
			"where": [{
				"prop": "contactBackupHash",
				"op": "=",
				"val": linkHash
			}]
		});
	});
	
	future.then(function () {
		//console.log(JSON.stringify(future.result));
		var result = Utils.DBResultHelper(future.result);
		if (result && result[0]) {
			future.result = new SpeedDialBackup(result[0]);
		} else {
			future.result = undefined;
		}
	});
	
	return future;
};

/**
 * Remove a speeddial backup for a given contact.
 * @param {object} contact - the contact that the speeddial backup is associated with
 * @returns {Future.result -> boolean} Indicates if removing the backup was successful
 */
SpeedDialBackup.removeBackupForContact = function (contact) {
	Assert.require(contact, "SpeedDialBackup.removeBackupForContact requires a contact");
	
	var future = new Future();
	
	future.now(function () {
		return ContactLinkable.getLinkHash(contact);
	});
	
	future.then(function () {
		var contactHash = future.result.linkHash,
			query = {
				"from": SpeedDialBackup.kind,
				"where": [{
					"prop": "contactBackupHash",
					"op": "=",
					"val": contactHash
				}]
			};
		
		return DB.del(query);
	});
	
	future.then(function () {
		var result = Utils.DBResultHelper(future.result);
		return result && result.count > 0;
	});
	
	return future;
};

//@ sourceURL=contacts/vCard/VCard.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, Assert, JSON, Utils, DB, PalmCall, Future, console, Birthday, Name, IMAddress, Organization, Address, ContactBackupHash, VCardFileReader, Relation, PropertyArray, DefaultPropertyHash, Contact, ContactLinkable, IO, PhoneNumber, EmailAddress, Url, Nickname */

var VCard = exports.VCard = Class.create({
	initialize: function (obj) {
		
	}
});

/////////////// vCard formatting ////////////////

VCard.VERSIONS = {
	TWO_POINT_ONE: "2.1",
	THREE: "3.0"
};

VCard.CHARSET = {
	ASCII: "US-ASCII",
	UTF8: "UTF-8"
};

//////////////// vCard data markers ///////////////

VCard.MARKERS = {
	BEGIN: "BEGIN:VCARD",
	SEPERATOR: ":",
	CHARSET_UTF8: "CHARSET=UTF-8",
	VERSION: "VERSION",
	NICKNAME: "NICKNAME",
	NAME: "N",
	FULL_NAME: "FN",
	COMPANY: "ORG",
	JOBTITLE: "TITLE",
	PHONE: "TEL",
	EMAIL: "EMAIL",
	ADDRESS: "ADR",
	BIRTHDAY: "BDAY",
	URL: "URL",
	NOTE: "NOTE",
	RELATED: "X-ABRELATEDNAMES",
	GTALK: "X-GTALK",
	GOOGLE: "X-GTALK",
	AIM: "X-AIM",
	MSN: "X-MSN",
	YAHOO: "X-YAHOO",
	JABBER: "X-JABBER",
	QQ: "X-QQ",
	ICQ: "X-ICQ",
	SKYPE: "X-SKYPE",
	IM: "X-IM",
	SPOUSE_ONE_LINE: "X-SPOUSE",
	CHILD_ONE_LINE: "X-CHILD",
	END: "END:VCARD"
};

VCard.TYPEMARKERS = {
	HOME: "HOME",
	WORK: "WORK",
	FAX: "FAX",
	FAX_WORK: "FAX_WORK",
	FAX_HOME: "FAX_HOME",
	CELL: "CELL",
	PAGER: "PAGER",
	MAIN: "MAIN",
	OTHER: "OTHER",
	
	// Relation Markers
	ASSISTANT: "ASSISTANT",
	BROTHER: "BROTHER",
	CHILD: "CHILD",
	FATHER: "FATHER",
	FRIEND: "FRIEND",
	MANAGER: "MANAGER",
	MOTHER: "MOTHER",
	PARENT: "PARENT",
	PARTNER: "PARTNER",
	RELATIVE: "RELATIVE",
	SISTER: "SISTER",
	SPOUSE: "SPOUSE",
	
	// These are meant to be shoved into the handleRelation method
	// when we are dealing with a one line relation object.
	// They ensure that the handleRelation method treats the type
	// correctly
	SPOUSE_ONE_LINER: "item1.X-ABLabel:_$!<SPOUSE>!$_",
	CHILD_ONE_LINER: "item1.X-ABLabel:_$!<CHILD>!$_",
	
	// These are not typically used. They are here for completeness
	REFERRED_BY: "REFFERRED_BY",
	DOMESTIC_PARTNER: "DOMESTIC_PARTNER"
};

////////////////// vCard type data ////////////////////

VCard.TYPES = { };

////////////////// Phone Numbers /////////////////////

VCard._PHONE_NUMBER_CONTACT_POINT_VALUE = {
	FAX_HOME: PhoneNumber.TYPE.PERSONAL_FAX,
	FAX_WORK: PhoneNumber.TYPE.WORK_FAX,
	HOME: PhoneNumber.TYPE.HOME,
	WORK: PhoneNumber.TYPE.WORK,
	CELL: PhoneNumber.TYPE.MOBILE,
	PAGER: PhoneNumber.TYPE.PAGER,
	MAIN: PhoneNumber.TYPE.MAIN,
	OTHER: PhoneNumber.TYPE.OTHER
};

VCard.TYPES.PHONE_NUMBER = {
	FAX: { VCARD_VALUE: VCard.TYPEMARKERS.FAX },
	FAX_HOME: { VCARD_VALUE: VCard.TYPEMARKERS.FAX_HOME, CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.FAX_HOME },
	FAX_WORK: { VCARD_VALUE: VCard.TYPEMARKERS.FAX_WORK, CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.FAX_WORK },
	HOME: { VCARD_VALUE: VCard.TYPEMARKERS.HOME, CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.HOME },
	WORK: { VCARD_VALUE: VCard.TYPEMARKERS.WORK, CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.WORK },
	CELL: { VCARD_VALUE: VCard.TYPEMARKERS.CELL, CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.CELL },
	PAGER: { VCARD_VALUE: VCard.TYPEMARKERS.PAGER, CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.PAGER },
	MAIN: { VCARD_VALUE: VCard.TYPEMARKERS.MAIN, CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.MAIN },
	OTHER: { CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.OTHER }
};

VCard.PHONE_LABELS = {
	HOME: { CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.HOME, LABELS: ["HOME", "VOICE"] },
	WORK: { CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.WORK, LABELS: ["WORK", "VOICE"] },
	CELL: { CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.CELL, LABELS: ["CELL", "VOICE"] },
	PAGER: { CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.PAGER, LABELS: ["PAGER"] },
	FAX_HOME: { CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.FAX_HOME, LABELS: ["HOME", "FAX"] },
	FAX_WORK: { CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.FAX_WORK, LABELS: ["WORK", "FAX"] },
	OTHER: { CONTACT_POINT_VALUE: VCard._PHONE_NUMBER_CONTACT_POINT_VALUE.OTHER, LABELS: ["OTHER"] }
};

///////////////// Emails //////////////////////

VCard._EMAIL_CONTACT_POINT_VALUE = {
	HOME: EmailAddress.TYPE.HOME,
	WORK: EmailAddress.TYPE.WORK,
	OTHER: EmailAddress.TYPE.OTHER
};

VCard.TYPES.EMAIL = {
	HOME: { VCARD_VALUE: VCard.TYPEMARKERS.HOME, CONTACT_POINT_VALUE: VCard._EMAIL_CONTACT_POINT_VALUE.HOME },
	WORK: { VCARD_VALUE: VCard.TYPEMARKERS.WORK, CONTACT_POINT_VALUE: VCard._EMAIL_CONTACT_POINT_VALUE.WORK },
	OTHER: { CONTACT_POINT_VALUE: VCard._EMAIL_CONTACT_POINT_VALUE.OTHER }
};

VCard.EMAIL_LABELS = {
	HOME: { CONTACT_POINT_VALUE: VCard._EMAIL_CONTACT_POINT_VALUE.HOME, LABELS: ["HOME", "INTERNET"] },
	WORK: { CONTACT_POINT_VALUE: VCard._EMAIL_CONTACT_POINT_VALUE.WORK, LABELS: ["WORK", "INTERNET"] },
	OTHER: { CONTACT_POINT_VALUE: VCard._EMAIL_CONTACT_POINT_VALUE.OTHER, LABELS: ["INTERNET"] }
};

/////////////////// Urls ///////////////////////

VCard._URL_CONTACT_POINT_VALUE = {
	HOME: Url.TYPE.HOME,
	WORK: Url.TYPE.WORK,
	OTHER: Url.TYPE.OTHER
};

VCard.TYPES.URL = {
	HOME: { VCARD_VALUE: VCard.TYPEMARKERS.HOME, CONTACT_POINT_VALUE: VCard._URL_CONTACT_POINT_VALUE.HOME },
	WORK: { VCARD_VALUE: VCard.TYPEMARKERS.WORK, CONTACT_POINT_VALUE: VCard._URL_CONTACT_POINT_VALUE.WORK },
	OTHER: { CONTACT_POINT_VALUE: VCard._URL_CONTACT_POINT_VALUE.OTHER }
};

VCard.URL_LABELS = {
	HOME: { CONTACT_POINT_VALUE: VCard._URL_CONTACT_POINT_VALUE.WORK, LABELS: ["HOME"] },
	WORK: { CONTACT_POINT_VALUE: VCard._URL_CONTACT_POINT_VALUE.WORK, LABELS: ["WORK"] },
	OTHER: { CONTACT_POINT_VALUE: VCard._URL_CONTACT_POINT_VALUE.OTHER, LABELS: [] }
};

//////////////////// IM Addresses /////////////////

VCard._IMADDRESS_CONTACT_POINT_VALUE = {
	HOME: IMAddress.TYPE.HOME,
	WORK: IMAddress.TYPE.WORK,
	OTHER: IMAddress.TYPE.OTHER
};

VCard.TYPES.IM_ADDRESS = {
	HOME: { VCARD_VALUE: VCard.TYPEMARKERS.HOME, CONTACT_POINT_VALUE: VCard._IMADDRESS_CONTACT_POINT_VALUE.HOME },
	WORK: { VCARD_VALUE: VCard.TYPEMARKERS.WORK, CONTACT_POINT_VALUE: VCard._IMADDRESS_CONTACT_POINT_VALUE.WORK },
	OTHER: { CONTACT_POINT_VALUE: VCard._IMADDRESS_CONTACT_POINT_VALUE.OTHER }
};

VCard.IM_SERVICES = {
	GTALK: { VCARD_VALUE: VCard.MARKERS.GTALK, SERVICE_NAME: IMAddress.TYPE.GTALK, LABELS: [VCard.MARKERS.GTALK] },
	GOOGLE: { VCARD_VALUE: VCard.MARKERS.GTALK, SERVICE_NAME: IMAddress.TYPE.GTALK, LABELS: [VCard.MARKERS.GTALK] },
	AIM: { VCARD_VALUE: VCard.MARKERS.AIM, SERVICE_NAME: IMAddress.TYPE.AIM, LABELS: [VCard.MARKERS.AIM] },
	MSN: { VCARD_VALUE: VCard.MARKERS.MSN, SERVICE_NAME: IMAddress.TYPE.MSN, LABELS: [VCard.MARKERS.MSN] },
	YAHOO: { VCARD_VALUE: VCard.MARKERS.YAHOO, SERVICE_NAME: IMAddress.TYPE.YAHOO, LABELS: [VCard.MARKERS.YAHOO] },
	JABBER: { VCARD_VALUE: VCard.MARKERS.JABBER, SERVICE_NAME: IMAddress.TYPE.JABBER, LABELS: [VCard.MARKERS.JABBER] },
	QQ: { VCARD_VALUE: VCard.MARKERS.QQ, SERVICE_NAME: IMAddress.TYPE.QQ, LABELS: [VCard.MARKERS.QQ] },
	ICQ: { VCARD_VALUE: VCard.MARKERS.ICQ, SERVICE_NAME: IMAddress.TYPE.ICQ, LABELS: [VCard.MARKERS.ICQ] },
	SKYPE: { VCARD_VALUE: VCard.MARKERS.SKYPE, SERVICE_NAME: IMAddress.TYPE.SKYPE, LABELS: [VCard.MARKERS.SKYPE] },
	OTHER: { SERVICE_NAME: IMAddress.TYPE.DEFAULT, LABELS: [VCard.MARKERS.IM] }
};

//////////////////// Addresses //////////////////////

VCard._ADDRESS_CONTACT_POINT_VALUE = {
	HOME: Address.TYPE.HOME,
	WORK: Address.TYPE.WORK,
	OTHER: Address.TYPE.OTHER
};

VCard.TYPES.ADDRESS = {
	HOME: { VCARD_VALUE: VCard.TYPEMARKERS.HOME, CONTACT_POINT_VALUE: VCard._ADDRESS_CONTACT_POINT_VALUE.HOME },
	WORK: { VCARD_VALUE: VCard.TYPEMARKERS.WORK, CONTACT_POINT_VALUE: VCard._ADDRESS_CONTACT_POINT_VALUE.WORK },
	OTHER: { CONTACT_POINT_VALUE: VCard._ADDRESS_CONTACT_POINT_VALUE.OTHER }
};

VCard.ADDRESS_LABELS = {
	HOME: { CONTACT_POINT_VALUE: VCard._ADDRESS_CONTACT_POINT_VALUE.HOME, LABELS: ["HOME"] },
	WORK: { CONTACT_POINT_VALUE: VCard._ADDRESS_CONTACT_POINT_VALUE.WORK, LABELS: ["WORK"] },
	OTHER: { CONTACT_POINT_VALUE: VCard._ADDRESS_CONTACT_POINT_VALUE.OTHER, LABELS: ["OTHER"] }
};

//////////////////// Relation //////////////////////

VCard._RELATION_CONTACT_POINT_VALUE = {
	ASSISTANT: Relation.TYPE.ASSISTANT,
	BROTHER: Relation.TYPE.BROTHER,
	CHILD: Relation.TYPE.CHILD,
	DOMESTIC_PARTNER: Relation.TYPE.DOMESTIC_PARTNER,
	FATHER: Relation.TYPE.FATHER,
	FRIEND: Relation.TYPE.FRIEND,
	MANAGER: Relation.TYPE.MANAGER,
	MOTHER: Relation.TYPE.MOTHER,
	PARENT: Relation.TYPE.PARENT,
	PARTNER: Relation.TYPE.PARTNER,
	REFERRED_BY: Relation.TYPE.REFERRED_BY,
	RELATIVE: Relation.TYPE.RELATIVE,
	SISTER: Relation.TYPE.SISTER,
	SPOUSE: Relation.TYPE.SPOUSE,
	OTHER: Relation.TYPE.OTHER
};

VCard.TYPES.RELATION = {
	ASSISTANT: { VCARD_VALUE: VCard.TYPEMARKERS.ASSISTANT, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.ASSISTANT },
	BROTHER: { VCARD_VALUE: VCard.TYPEMARKERS.BROTHER, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.BROTHER },
	CHILD: { VCARD_VALUE: VCard.TYPEMARKERS.CHILD, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.CHILD },
	DOMESTIC_PARTNER: { VCARD_VALUE: VCard.TYPEMARKERS.DOMESTIC_PARTNER, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.DOMESTIC_PARTNER },
	FATHER: { VCARD_VALUE: VCard.TYPEMARKERS.FATHER, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.FATHER },
	FRIEND: { VCARD_VALUE: VCard.TYPEMARKERS.FRIEND, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.FRIEND },
	MANAGER: { VCARD_VALUE: VCard.TYPEMARKERS.MANAGER, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.MANAGER },
	MOTHER: { VCARD_VALUE: VCard.TYPEMARKERS.MOTHER, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.MOTHER },
	PARENT: { VCARD_VALUE: VCard.TYPEMARKERS.PARENT, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.PARENT },
	PARTNER: { VCARD_VALUE: VCard.TYPEMARKERS.PARTNER, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.PARTNER },
	REFERRED_BY: { VCARD_VALUE: VCard.TYPEMARKERS.REFERRED_BY, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.REFERRED_BY },
	RELATIVE: { VCARD_VALUE: VCard.TYPEMARKERS.RELATIVE, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.RELATIVE },
	SISTER: { VCARD_VALUE: VCard.TYPEMARKERS.SISTER, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.SISTER },
	SPOUSE: { VCARD_VALUE: VCard.TYPEMARKERS.SPOUSE, CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.SPOUSE },
	OTHER: { CONTACT_POINT_VALUE: VCard._RELATION_CONTACT_POINT_VALUE.OTHER }
};

//@ sourceURL=contacts/vCard/VCardExporter.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500, plusplus: false, bitwise: false */
/*global exports, _, Class, Assert, JSON, Future, Utils, DB, PalmCall, VCardFileWriter, ContactBackupHash, PropertyArray, VCard, DefaultPropertyHash, Contact, ContactLinkable, Url, Name, Person, Nickname, Address, Organization, Birthday, PhoneNumber, EmailAddress, IMAddress, Note, console */

var VCardExporter = exports.VCardExporter = Class.create({
	/** @lends VCardExporter#*/
	
	/**
	 * This defines a decorated FavoriteBackup.  This object hides the raw FavoriteBackup data and exposes methods for accessing decorated
	 * property objects for which getters/setters can be called.  These decorated properties also hide raw data, and can be passed 
	 * directly to framework widgets.
	 * @constructs
	 * @param {Object} rawFavoriteBackup - raw favoriteBackup object
	 * @example
	 * var favoriteBackup = new FavoriteBackup({
	 *                     contactBackupHash: 3XC8|local,
	 *                     defaultPropertyHashes: [{
	 *                          value: FEF89&wef,jfew9823,
	 *                          type: "PhoneNumber" }] 
	 *                });
	 * 
	 * var favoriteBackupContactHash = favoriteBackup.getContactBackupHash();
	 * var favoriteBackupDefaultPhoneNumber = favoriteBackup.getDefaultPhoneNumber();
	 */
	initialize: function (obj) {
		if (!obj || !obj.filePath) {
			throw new Error("File path must be specified to make a VCardImporter");
		}
		
		this.filePath = obj.filePath;
		
		this.vCardVersion = obj.version ?  obj.version : VCard.VERSIONS.THREE;
		this.charset = obj.charset ? obj.charset : VCard.CHARSET.UTF8;
		this.useFileCache = obj.useFileCache || false;
		this.vCardFileWriter = new VCardFileWriter({ filePath: this.filePath, charset: this.charset});
		this.onlyPhoneNumber = false;
	},
	
	exportOne: function (personId, onlyPhoneNumber) {
		var filecacheFuture,
			future = new Future();
			
		future.now(this, function () {
			Assert.require(personId, "personId passed to export was not truthy. export requires a valid personId to export");
			this.onlyPhoneNumber = onlyPhoneNumber;
			future.nest(Person.getDisplayablePersonAndContactsById(personId));
		});
		
		future.then(this, function () {
			var person = future.result;
			Assert.require(person, "The personId passed into export was not a person that currently exists");
			
			this.vCardFileWriter.open();
			
			this._exportVCard(person);
			
			future.result = {size: this.vCardFileWriter.getSize()};
		});
		
		if (this.useFileCache) {			
			future.then(this, function () {
				var result = future.result,
					size = result.size;
				
				//make an entry in the file cache first
				filecacheFuture = PalmCall.call("palm://com.palm.filecache/", "InsertCacheObject", 
					{	typeName: "contactvcard",
						fileName: this.filePath,
						size: size,
						subscribe: true
					});
								
				return filecacheFuture;					
			});			
		}
		
		future.then(this, function () {
			var result = future.result,
				path = result.pathName || this.filePath;
			
			future.result = {
				success: this.vCardFileWriter.close(path),
				filePath: path
			};
		});
		
		if (this.useFileCache) {
			future.then(this, function () {
				var result = future.result;
				PalmCall.cancel(filecacheFuture);
				future.result = result; 
			});
		}
		
		return future;
	},
	
	exportAll: function (onlyPhoneNumber) {
		var future = new Future();
		
		
		future.now(this, function () {
			var dbFuture, 
				findParams = {
					query: {
						from: Person.kind,
						limit: 500
					}
				};
			
			this.onlyPhoneNumber = onlyPhoneNumber;
			
			this.vCardFileWriter.open();
			
			dbFuture = DB.execute("find", findParams);
			dbFuture.then(this, this._getNextPageForExportAll);
			future.nest(dbFuture);
		});
		
		return future;
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_getNextPageForExportAll: function (nestedFuture) {
		var innerNestedFuture,
			result = nestedFuture.result,
			currentPagePeople,
			nextPageKey = result.next,
			i,
			tempPerson,
			findParams = {
				query: {
					from: Person.kind,
					limit: 500
				}
			};
			
		try {
			currentPagePeople = result.results;
		
			for (i = 0; i < currentPagePeople.length; i += 1) {
				tempPerson = new Person(currentPagePeople[i]);
				this._exportVCard(tempPerson);
			}
		
			// Just in case this doesn't get GCed want to clear it so we don't
			// have tons of people sitting in memory when we are not using them.
			currentPagePeople = undefined;
		
			if (!nextPageKey) {
				nestedFuture.result = {
					success: this.vCardFileWriter.close(),
					filePath: this.filePath
				};
			} else {
				//else we got a page key, so we must do another query to get the next page
				findParams.query.page = nextPageKey;
				innerNestedFuture = DB.execute("find", findParams);

				innerNestedFuture.then(this, this._getNextPageForExportAll);

				nestedFuture.nest(innerNestedFuture);
			}
		} catch (e) {
			this.vCardFileWriter.close();
			throw e;
		}
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_exportVCard: function (person) {
		var phoneNumbers,
			emailAddresses,
			addresses,
			urls,
			ims,
			notes,
			nameToUse,
			i;
		
		if (!person) {
			console.warn("_exportVCard: encountered a false person. Skipping");
			return;
		}
		
		phoneNumbers = person.getPhoneNumbers().getArray();
		
		if (this.onlyPhoneNumber && phoneNumbers.length < 1) {
			console.warn("_exportVCard: encountered a person with no phone numbers where onlyPhoneNumber is true. Skipping that person.");
			return;
		}
		
		nameToUse = this._pickNameToUse(person);
		
		this.vCardFileWriter.writeLine(VCard.MARKERS.BEGIN + "\r");
		
		if (this.vCardVersion === VCard.VERSIONS.TWO_POINT_ONE) {
			this.vCardFileWriter.writeLine(VCard.MARKERS.VERSION + ":" + VCard.VERSIONS.TWO_POINT_ONE + "\r");
		} else {
			this.vCardFileWriter.writeLine(VCard.MARKERS.VERSION + ":" + VCard.VERSIONS.THREE + "\r");
		}
		
		this._writeNameToVCard(nameToUse);
		
		this._writeFullNameToVCard(person);
		
		if (!this.onlyPhoneNumber) {
			this._writeOrganizationToVCard(person.getOrganization());
			
			this._writeNicknameToVCard(person.getNickname());
		}
		
		for (i = 0; i < phoneNumbers.length; i += 1) {
			this._writePhoneNumberToVCard(phoneNumbers[i], this.onlyPhoneNumber);
		}
		
		if (!this.onlyPhoneNumber) {
			emailAddresses = person.getEmails().getArray();
			for (i = 0; i < emailAddresses.length; i += 1) {
				this._writeEmailAddressToVCard(emailAddresses[i]);
			}
			
			addresses = person.getAddresses().getArray();
			for (i = 0; i < addresses.length; i += 1) {
				this._writeAddressToVCard(addresses[i]);
			}
			
			urls = person.getUrls().getArray();
			for (i = 0; i < urls.length; i += 1) {
				this._writeUrlToVCard(urls[i]);
			}
			
			ims = person.getIms().getArray();
			for (i = 0; i < ims.length; i += 1) {
				this._writeIMAddressToVCard(ims[i]);
			}
			
			this._writeBirthdayToVCard(person.getBirthday());
			
			notes = person.getNotes().getArray();
			for (i = 0; i < notes.length; i += 1) {
				if (notes[i]) {
					this._writeNoteToVCard(notes[i]);
					break;
				}
			}
		}
		
		this.vCardFileWriter.writeLine(VCard.MARKERS.END + "\r\n\r");
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	// This method is kinda funky. Depending on if there is a first and 
	// last name it will either put the display name in the last name or
	// will return the whole name of the person. This is mostly for carkits
	// and displaying company names.
	_pickNameToUse: function (person) {
		var generateNameFromCompany = false,
			generateNameFromDisplayText = false,
			toReturn;
			
		if (!person || !person.getName()) {
			return new Name();
		}	
		
		if (!person.getName().getGivenName() && !person.getName().getFamilyName()) {
			toReturn = new Name();
			toReturn.setFamilyName(person.generateDisplayName());
		} else {
			toReturn = person.getName();
		}
		
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeNameToVCard: function (nameObject) {
		if (!nameObject) {
			return;
		}
		
		Assert.require(nameObject instanceof Name, "Object passed to _writeNameToVCard must be an instance of Name");
		var nameLine = "",
			nameValue = "";
		
		nameLine += VCard.MARKERS.NAME;
		
		if (this.charset === VCard.CHARSET.UTF8 && this.vCardVersion === VCard.VERSIONS.TWO_POINT_ONE) {
			nameLine += ";" + VCard.MARKERS.CHARSET_UTF8;
		}
		
		nameLine += ":";
		
		if (nameObject.getFamilyName()) {
			nameLine += nameObject.getFamilyName();
		}
		
		nameLine += ";";
		
		if (nameObject.getGivenName()) {
			nameLine += nameObject.getGivenName();
		}
		
		nameLine += ";";
		
		if (nameObject.getMiddleName()) {
			nameLine += nameObject.getMiddleName();
		}
		
		nameLine += ";";
		
		if (nameObject.getHonorificPrefix()) {
			nameLine += nameObject.getHonorificPrefix();
		}
		
		nameLine += ";";
		
		if (nameObject.getHonorificSuffix()) {
			nameLine += nameObject.getHonorificSuffix();
		}
		
		nameLine += "\r";
		
		this.vCardFileWriter.writeLine(nameLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeFullNameToVCard: function (personObject) {
		if (!personObject) {
			return;
		}
		
		Assert.require(personObject instanceof Person, "Object passed to _writeFullNameToVCard must be an instance of Person");
		
		var fullNameLine = "",
			displayValue = personObject.generateDisplayName();
			
		if ((!displayValue || displayValue.length < 1)) {
			console.warn("VCardExporter bad person passed into _writeFullNameToVCard");
			return;
		}
		
		fullNameLine += VCard.MARKERS.FULL_NAME;
		
		if (this.charset === VCard.CHARSET.UTF8 && this.vCardVersion === VCard.VERSIONS.TWO_POINT_ONE) {
			fullNameLine += ";" + VCard.MARKERS.CHARSET_UTF8;
		}
		
		fullNameLine += ":";
		
		fullNameLine += displayValue + "\r";
		
		this.vCardFileWriter.writeLine(fullNameLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeNicknameToVCard: function (nicknameObject) {
		if (!nicknameObject) {
			return;
		}
		
		Assert.require(nicknameObject instanceof Nickname, "Object passed to _writeNicknameToVCard must be an instance of Nickname");
		var nicknameLine = "",
			nicknameValue = nicknameObject.getValue();
			
		if (!nicknameValue || nicknameValue.length < 1) {
			console.warn("VCardExporter bad nickname passed into _writeNicknameToVCard. Not writing nickname.");
			return;
		}
		
		nicknameLine += VCard.MARKERS.NICKNAME + ":";
		
		nicknameLine += nicknameValue + "\r";
		
		this.vCardFileWriter.writeLine(nicknameLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeOrganizationToVCard: function (organizationObject) {
		if (!organizationObject) {
			return;
		}
		
		Assert.require(organizationObject instanceof Organization, "Object passed to _writeOrganizationToVCard must be an instance of Organization");
		var organizationLine = "",
			jobTitleLine = "",
			organizationValue = organizationObject.getName(),
			jobTitleValue = organizationObject.getTitle();
			
		if (!organizationValue && !jobTitleValue) {
			console.warn("VCardExporter bad organization passed into _writeOrganizationToVCard. Not writing organization.");
			return;
		}
		
		if (organizationValue) {
			organizationLine += VCard.MARKERS.COMPANY + ":";
		
			organizationLine += organizationValue + ";\r";
		
			this.vCardFileWriter.writeLine(organizationLine);
		}
		
		if (jobTitleValue) {
			jobTitleLine += VCard.MARKERS.JOBTITLE + ":";
		
			jobTitleLine += jobTitleValue + "\r";
		
			this.vCardFileWriter.writeLine(jobTitleLine);
		}
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writePhoneNumberToVCard: function (phoneNumber, stripFormatting) {
		if (!phoneNumber) {
			return;
		}
		
		Assert.require(phoneNumber instanceof PhoneNumber, "Object passed to _writePhoneNumberToVCard must be an instance of PhoneNumber");
		var phoneNumberValue = phoneNumber.getValue(),
			phoneNumberLine = "",
			label;
		
		if (stripFormatting) {
			phoneNumberValue = PhoneNumber.unformatForVCard(phoneNumberValue);
		}
		
		// In case the unformatter strip everything or the phoneNumber value is just bad, don't write it.
		if (!phoneNumberValue) {
			console.warn("VCardExporter bad phone number: number = " + phoneNumberValue + " type = " + phoneNumber.getType());
			return;
		}
		
		phoneNumberLine += VCard.MARKERS.PHONE;
		
		if (this.charset === VCard.CHARSET.UTF8 && this.vCardVersion === VCard.VERSIONS.TWO_POINT_ONE) {
			phoneNumberLine += ";" + VCard.MARKERS.CHARSET_UTF8;
		}
		
		label = VCardExporter._buildCorrectLabelBasedOnVersion(this.vCardVersion, VCardExporter._getPhoneLabels(phoneNumber.getType()));
		
		if (label.length > 0) {
			phoneNumberLine += ";" + label;
		}
		
		phoneNumberLine += ":" + phoneNumberValue + "\r";
		
		this.vCardFileWriter.writeLine(phoneNumberLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeEmailAddressToVCard: function (emailAddress) {
		if (!emailAddress) {
			return;
		}
		
		Assert.require(emailAddress instanceof EmailAddress, "Object passed to _writeEmailAddressToVCard must be an instance of EmailAddress");
		var emailAddressValue = emailAddress.getValue(),
			emailAddressLine = "",
			label;
		
		if (!emailAddressValue || emailAddressValue.length < 1) {
			console.warn("VCardExporter bad email address passed into _writeEmailAddressToVCard. Not writing email.");
			return;
		}
		
		emailAddressLine += VCard.MARKERS.EMAIL + ";";
		
		emailAddressLine += VCardExporter._buildCorrectLabelBasedOnVersion(this.vCardVersion, VCardExporter._getEmailLabels(emailAddress.getType()));
		
		emailAddressLine += ":" + emailAddressValue + "\r";
		
		this.vCardFileWriter.writeLine(emailAddressLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeIMAddressToVCard: function (imAddress) {
		if (!imAddress) {
			return;
		}
		
		Assert.require(imAddress instanceof IMAddress, "Object passed to _writeIMAddressToVCard must be an instance of IMAddress");
		var imAddressValue = imAddress.getValue(),
			imAddressLine = "";
			
		if (!imAddressValue || imAddressValue.length < 1) {
			console.warn("VCardExporter bad IM Address passed into _writeIMAddressToVCard. Not writing IM.");
			return;
		}
		
		imAddressLine += VCardExporter._getIMLabels(imAddress.getType()) + ":";
		
		imAddressLine += imAddressValue + "\r";
		
		this.vCardFileWriter.writeLine(imAddressLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeUrlToVCard: function (urlObject) {
		if (!urlObject) {
			return;
		}
		
		Assert.require(urlObject instanceof Url, "Object passed to _writeUrlToVCard must be an instance of Url");
		var urlValue = urlObject.getValue(),
			urlLine = "";
			
		if (!urlValue || urlValue.length < 1) {
			console.warn("VCardExporter bad Url passed into _writeUrlToVCard. Not writing URL.");
			return;
		}
		
		urlLine += VCardExporter._buildCorrectLabelBasedOnVersion(this.vCardVersion, VCardExporter._getUrlLabels(urlObject.getType())) + ":";
		
		urlLine += urlValue + "\r";
		
		this.vCardFileWriter.writeLine(urlLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeAddressToVCard: function (addressObject) {
		if (!addressObject) {
			return;
		}
		
		Assert.require(addressObject instanceof Address, "Object passed to _writeAddressToVCard must be an instance of Address");
		var addressLine = "",
			formattedAddressValue = VCardExporter._formatAddress(addressObject);
			
		if (!formattedAddressValue || formattedAddressValue.length < 1) {
			console.warn("VCardExporter bad address passed into _writeAddressToVCard. Not writing address.");
			return;
		}
		
		addressLine += VCard.MARKERS.ADDRESS + ";";
		
		addressLine += VCardExporter._buildCorrectLabelBasedOnVersion(this.vCardVersion, VCardExporter._getAddressLabels(addressObject.getType()));
		
		addressLine += ":;;";
		
		addressLine += formattedAddressValue + "\r";
		
		this.vCardFileWriter.writeLine(addressLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeNoteToVCard: function (noteObject) {
		if (!noteObject) {
			return;
		}
		
		Assert.require(noteObject instanceof Note, "Object passed to _writeNoteToVCard must be an instance of Note");
		var noteLine = "",
			noteValue = noteObject.getValue();
			
		if (!noteValue || noteValue.length < 1) {
			console.warn("VCardExporter bad note passed into _writeNoteToVCard. Not writing note.");
			return;
		}
		
		noteValue = noteValue.replace(/\n/g, "\\n");
		
		noteValue = noteValue.replace(/\r/g, "\\r");
		
		noteLine += VCard.MARKERS.NOTE + ":";
		
		noteLine += noteValue + "\r";
		
		this.vCardFileWriter.writeLine(noteLine);
	},
	
	/**
	 * PRIVATE
	 * 
	 *
	 */
	_writeBirthdayToVCard: function (birthdayObject) {
		if (!birthdayObject) {
			return;
		}
		
		Assert.require(birthdayObject instanceof Birthday, "Object passed to _writeBirthdayToVCard must be an instance of Birthday");
		var birthdayLine = "",
			birthdayValue = birthdayObject.getValue();
			
		if (!birthdayValue || birthdayValue.length < 1) {
			console.warn("VCardExporter bad birthday passed into _writeBirthdayToVCard. Not writing birthday.");
			return;
		}
		
		birthdayLine += VCard.MARKERS.BIRTHDAY + ":";
		
		birthdayLine += birthdayValue + "\r";
		
		this.vCardFileWriter.writeLine(birthdayLine);
	}
	
});

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._formatAddress = function (address) {
	Assert.require(address instanceof Address, "Object passed to VCardExporter._formatAddress must be an instance of Address");
	
	var toReturn = "";
	
	if (address.getStreetAddress()) {
		// Will probably have newlines if we are dealing
		// with an address that came from a freeform source
		toReturn += address.getStreetAddress().replace(/\n/g, " ");
	}
	
	toReturn += ";";
	
	if (address.getLocality()) {
		toReturn += address.getLocality();
	} 
	
	toReturn += ";";
	
	if (address.getRegion()) {
		toReturn += address.getRegion();
	}
	
	toReturn += ";";
	
	if (address.getPostalCode()) {
		toReturn += address.getPostalCode();
	}
	
	toReturn += ";";
	
	if (address.getCountry()) {
		toReturn += address.getCountry();
	}
	
	return toReturn;
};

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._buildCorrectLabelBasedOnVersion = function (vCardVersion, labels) {
	if (vCardVersion === VCard.VERSIONS.TWO_POINT_ONE) {
		return VCardExporter._build2_1TypeLabel(labels);
	} else {
		return VCardExporter._build3_0TypeLabel(labels);
	}
};

/**
 * PRIVATE
 * Given an array of labels, generate the 3.0 vCard type string
 * @param {array[string]} the labels to put together to make a type
 * @returns {string} the label portion for a 3.0 vCard line's label
 */
VCardExporter._build3_0TypeLabel = function (labels) {
	if (labels) {
		return VCardExporter._buildTypeLabelHelper(labels, ",", "TYPE=");
	} else {
		return "";
	}
};

/**
 * PRIVATE
 * Given an array of labels, generate the 2.1 vCard type string
 * @param {array[string]} the labels to put together to make a type
 * @returns {string} the label portion for a 2.1 vCard line's label
 */
VCardExporter._build2_1TypeLabel = function (labels) {
	if (labels) {
		return VCardExporter._buildTypeLabelHelper(labels, ";");
	} else {
		return "";
	}
};

/**
 * PRIVATE
 * Given an array of labels, a seperator, and a prefix build the type label
 * @param {array[string]} the labels to put together to make a type
 * @param {string} the seperator to put between each label
 * @param {string} the prefix to put at the beginning of the type label
 * @returns {string} the label portion for a 3.0 vCard line's label
 */
VCardExporter._buildTypeLabelHelper = function (labels, seperator, prefix) {
	var toReturn = prefix ? prefix : "",
		i;
	
	for (i = 0; i < labels.length; i += 1) {
		toReturn += labels[i];
		if (i < (labels.length - 1)) {
			toReturn += seperator;
		}
	}
	
	return toReturn;
};

/**
 * PRIVATE
 * Iterate through the customLabel passed in and remove any characters that are not
 * alphanumeric or a dash, and return the newly created label
 * @param {string} the custom label to sanitize.
 * @returns {string} the custom label without any illegal characters for the custom type
 */
VCardExporter._sanitizeCustomLabel = function (label) {
	// Take any character that is not a-z or A-Z or 0-9 or - and
	// replace it with empty string
	var toReturn = "";
	label.replace(/[a-zA-Z0-9\-]/g, function (substr) {
		toReturn += substr;
	});
	
	return toReturn;
};

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._getPhoneLabels = function (contactPointValue, customType) {
	return this._getLabelsHelper(VCard.PHONE_LABELS, contactPointValue, false, customType);
};

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._getEmailLabels = function (contactPointValue, customType) {
	return this._getLabelsHelper(VCard.EMAIL_LABELS, contactPointValue, false, customType, ["INTERNET"]);
};

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._getIMLabels = function (serviceName) {
	return this._getLabelsHelper(VCard.IM_SERVICES, serviceName, true);
};

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._getAddressLabels = function (contactPointValue, customType) {
	return this._getLabelsHelper(VCard.ADDRESS_LABELS, contactPointValue, false, customType);
};

/**
 * PRIVATE
 * 
 *
 */
VCardExporter._getUrlLabels = function (contactPointValue, customType) {
	return this._getLabelsHelper(VCard.URL_LABELS, contactPointValue, false, customType);
};

// TODO: We are not supporting custom types anymore. Will have to check if we are going to need to.
/**
 * PRIVATE
 * 
 *
 */
VCardExporter._getLabelsHelper = function (labelObjects, contactPointValue, isIMServiceName, customType, customTypeLabelsToAppend) {
	var toReturn,
		labelObject,
		otherObject,
		i;
	
	otherObject = labelObjects.OTHER ? labelObjects.OTHER.LABELS : [];
	
	if (!contactPointValue) {
		return otherObject;
	}
	
	for (labelObject in labelObjects) {
		if (labelObjects.hasOwnProperty(labelObject)) {
			labelObject = labelObjects[labelObject];
			
			if (isIMServiceName) {
				if (labelObject.SERVICE_NAME === contactPointValue) {
					return labelObject.LABELS;
				}
			} else {
				if (labelObject.CONTACT_POINT_VALUE === contactPointValue) {
					// We need to do special behavior if the type on the labelObject was other.
					// we could be dealing with a custom type
					if (labelObject.CONTACT_POINT_VALUE === labelObjects.OTHER.CONTACT_POINT_VALUE) {
						if (customType) {
							toReturn = [ "X-" + VCardExporter._sanitizeCustomLabel(customType) ];
							if (customTypeLabelsToAppend) {
								for (i = 0; i < customTypeLabelsToAppend.length; i += 1) {
									toReturn.push(customTypeLabelsToAppend[i]);
								}
							}
							return toReturn;
						}
						// If we are not dealing with a custom type, break out of the loop and return the OTHER labels
						break;
					} else {
						return labelObject.LABELS;
					}
				}
			}
		}
	}
	
	return otherObject;
};


//@ sourceURL=contacts/vCard/VCardFileReader.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, Assert, JSON, Utils, DB, PalmCall, ContactBackupHash, PropertyArray, DefaultPropertyHash, Contact, ContactLinkable, Foundations */

// This is here because file IO stuff is kinda in an unknown state right now
var VCardFileReader = Class.create({
	/** @lends vCardFileReader#*/
	
	/**
	 * 
	 * @constructs
	 * @param {Object}
	 * @example
	 * var favoriteBackup = new FavoriteBackup({
	 *                     contactBackupHash: 3XC8|local,
	 *                     defaultPropertyHashes: [{
	 *                          value: FEF89&wef,jfew9823,
	 *                          type: "PhoneNumber" }] 
	 *                });
	 * 
	 * var favoriteBackupContactHash = favoriteBackup.getContactBackupHash();
	 * var favoriteBackupDefaultPhoneNumber = favoriteBackup.getDefaultPhoneNumber();
	 */
	initialize: function (obj) {
		if (!obj || !obj.filePath) {
			throw new Error("Must create VCardFileReader with an object containing filePath");
		}
		
		this.fileName = obj.filePath;
		
		this.fileHandler = { currentLine: 0,
							lines: (Foundations.Comms.loadFile(this.fileName)).split("\n"),
							readLine: function () {
								if (this.currentLine < this.lines.length) {
									this.currentLine += 1;
									return this.lines[this.currentLine - 1];
								} else {
									return null;
								}
							},
							restartFile: function () {
								this.currentLine = 0;
							}
						};
						
		this.peekedLine = "";
	},
	
	/**
	 * Gets the contactId for this favorite backup from the contactBackupHash
	 * @returns {string} The id of the contact for this favorite backup
	 */
	readLine: function () {
		var toReturn;
		
		if (this.peekedLine) {
			toReturn = this.peekedLine;
			this.peekedLine = undefined;
		} else {
			toReturn = this.fileHandler.readLine();
		}
		
		return toReturn;
	},
	
	/**
	  * Performs a readLine but causes the next call to readline
	  * to return the peeked line. Multiple calls to peek will only
	  * return the last peeked line. This ensures that multiple peeks
	  * will not cause readLine to miss a line due to calls to peek.
	  * @returns {string} the next line from the file
	  */
	peek: function () {
		if (!this.peekedLine) {
			this.peekedLine = this.fileHandler.readLine();
		}
		
		return this.peekedLine;
	}
});

//@ sourceURL=contacts/vCard/VCardFileWriter.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, Assert, JSON, Utils, DB, PalmCall, console, palmPutResource, require, Foundations, ContactBackupHash, PropertyArray, DefaultPropertyHash, Contact, ContactLinkable, VCard */

// This is here because file IO stuff is kinda in an unknown state right now
var VCardFileWriter = Class.create({
	/** @lends vCardFileWriter#*/
	
	/**
	 * This defines a decorated FavoriteBackup.  This object hides the raw FavoriteBackup data and exposes methods for accessing decorated
	 * property objects for which getters/setters can be called.  These decorated properties also hide raw data, and can be passed 
	 * directly to framework widgets.
	 * @constructs
	 * @param {Object} rawFavoriteBackup - raw favoriteBackup object
	 * @example
	 * var favoriteBackup = new FavoriteBackup({
	 *                     contactBackupHash: 3XC8|local,
	 *                     defaultPropertyHashes: [{
	 *                          value: FEF89&wef,jfew9823,
	 *                          type: "PhoneNumber" }] 
	 *                });
	 * 
	 * var favoriteBackupContactHash = favoriteBackup.getContactBackupHash();
	 * var favoriteBackupDefaultPhoneNumber = favoriteBackup.getDefaultPhoneNumber();
	 */
	initialize: function (obj) {
		if (!obj || !obj.filePath) {
			throw new Error("Must create VCardFileWriter with an object containing filePath");
		}
		
		this.fileName = obj.filePath;
		
		this.fileHandler = { fileName: this.fileName, 
							fileOutput: "",
							charset: VCard.CHARSET.UTF8, 
							writeLine: function (line) {
								this.fileOutput += line + "\n";
							},
							close: function (path) {
								var usePath = path || this.fileName,
									fs;
									
								try {
									if (Foundations.EnvironmentUtils.isNode()) {
										fs = require('fs');
										fs.writeFileSync(usePath, this.fileOutput, 'utf8');
									} else {
										palmPutResource(usePath, this.fileOutput);
									}
									
									this.fileOutput = "";
									return true;
								} catch (e) {
									console.log("Writing file failed!");
									console.log(e.stack);
									throw e;
								}
							}
						};
	},

	/**
	 * Resets the output for the file
	 */
	open: function () {
		this.fileHandler.fileOutput = "";
	},

	/**
	 * Writes out a line to the file handler associated with this object
	 */
	writeLine: function (line) {
		this.fileHandler.writeLine(line);
	},
	
	getSize: function () {
		// If charset is not ascii then get the size in bytes
		if (this.charset !== VCard.CHARSET.ASCII) {
			return encodeURIComponent(this.fileHandler.fileOutput).replace(/%[A-F\d]{2}/g, 'U').length;
		} else {
			return this.fileHandler.fileOutput.length;
		}
	},

	/**
	  * Writes out the file and clears out the output
	  */
	close: function (path) {
		return this.fileHandler.close(path);
	}
});


//@ sourceURL=contacts/vCard/VCardImporter.js

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, Assert, JSON, VCard, Utils, DB, PalmCall, Future, console, Birthday, Name, IMAddress, Organization, Address, ContactBackupHash, VCardFileReader, Relation, PropertyArray, DefaultPropertyHash, Contact, ContactLinkable, Foundations, PhoneNumber, EmailAddress, Url, Nickname, StringUtils,Crypto, AppPrefs */

var VCardImporter = exports.vCardImporter = Class.create({
	/** @lends VCardImporter#*/
	
	/**
	 * This defines a decorated FavoriteBackup.  This object hides the raw FavoriteBackup data and exposes methods for accessing decorated
	 * property objects for which getters/setters can be called.  These decorated properties also hide raw data, and can be passed 
	 * directly to framework widgets.
	 * @constructs
	 * @param {Object} rawFavoriteBackup - raw favoriteBackup object
	 * @example
	 * var favoriteBackup = new FavoriteBackup({
	 *                     contactBackupHash: 3XC8|local,
	 *                     defaultPropertyHashes: [{
	 *                          value: FEF89&wef,jfew9823,
	 *                          type: "PhoneNumber" }] 
	 *                });
	 * 
	 * var favoriteBackupContactHash = favoriteBackup.getContactBackupHash();
	 * var favoriteBackupDefaultPhoneNumber = favoriteBackup.getDefaultPhoneNumber();
	 */
	initialize: function (obj) {
		if (!obj || !obj.filePath) {
			throw new Error("File path must be specified to make a VCardImporter");
		}
		
		this.filePath = obj.filePath;
		
		this.vCardVersion = obj.version ?  obj.version : VCard.VERSIONS.THREE;
		this.importToAccountId = obj.importToAccountId ? obj.importToAccountId : "";
		this.importToContactSetId = obj.importToContactSetId ? obj.importToContactSetId : 1;
		this.currentContact = null;
		this.vCardFileReader = null;
	},
	
	// Until foundations.IO support for reading ISO files is added, there is no support for ISO vCards. I.E. vCards from outlook
	
	readVCard: function (processedContactCallback) {
		return this._importVCard(processedContactCallback, false);
	},
	
	importVCard: function (processedContactCallback) {
		return this._setupImport(processedContactCallback, false);
	},

	importVCardNoDuplicates: function (processedContactCallback) {
		return this._setupImport(processedContactCallback, true);
	},

	/**
	 * PRIVATE
	 */
	_importVCard: function (processedContactCallback, saveToDB) {
		var currentLine,
			currentContact,
			processedContactCallbackValue,
			future = new Future(),
			contactProcessedFunction,
			savedProcessedContactFuture = new Future(),
			allContacts = [];
		
		future.now(this, function () {
			if (processedContactCallback && typeof(processedContactCallback) !== "function") {
				throw new Error("importVCard exception: cannot specify a processedContactCallback parameter that is not a function");
			}
			
			this.vCardFileReader = new VCardFileReader({filePath: this.filePath});
			
			future.result = true;
		});
		
		contactProcessedFunction = function (contactProcessedFuture) {
			var result = contactProcessedFuture.result;
		
			if (result.keepProcessing) {
				
				if (!saveToDB && result.processedContact) {
					allContacts.push(result.processedContact);
				}
				
				processedContactCallbackValue = processedContactCallback ? processedContactCallback(result.result) : true;
				if (processedContactCallbackValue) {
					savedProcessedContactFuture.then(this, contactProcessedFunction);
					savedProcessedContactFuture.nest(this._processOneContact(saveToDB));
				} else {
					// processedContactCallback returned false. This means cancel so stop processing vCards
					console.log("importVCard: Consumer cancelled processing of vCard!!");
					if (saveToDB) {
						future.result = true;
					} else {
						future.result = allContacts;
					}
					return;
				}
			} else {
				// Done processing vCard
				if (saveToDB) {
					future.result = true;
				} else {
					future.result = allContacts;
				}
				return;
			}
		};
		
		future.then(this, function () {
			var processOneContactReturnValue,
				result;
				
			savedProcessedContactFuture.then(this, contactProcessedFunction);
			savedProcessedContactFuture.nest(this._processOneContact(saveToDB));
		});
		
		return future;
	},
	
	
	_processOneContact: function (saveToDB) {
		var currentLine = this.vCardFileReader.readLine(),
			currentContact,
			duplicate,
			hash,
			onContactSaveFunction = function (future) {
				var result = future.result;
				future.result = { keepProcessing: true, result: result, processedContact: currentContact };
			};
		
		while (currentLine !== null) {
			if (VCardImporter._isLineBeginVCard(currentLine)) {
				this._setCurrentContact(new Contact());
				currentLine = this.vCardFileReader.readLine();
				continue;
			}

			if (VCardImporter._isLineEndVCard(currentLine)) {
				currentContact = this._getCurrentContact();
				
				if (saveToDB) {
					duplicate = false;
					if (this._hashes) {
						hash = this._generateHash(currentContact);
						duplicate = this._hashes[hash] ? true : false;
					}
					if (duplicate) {
						return new Future({ keepProcessing: true, result: true, processedContact: currentContact });
					} else {
						currentContact.setKind(this._importContactDBKind);
						currentContact.getAccountId().setValue(this.importToAccountId);
						return currentContact.save().then(onContactSaveFunction);
					}
				} else {
					return new Future({ keepProcessing: true, result: true, processedContact: currentContact });
				}
				
			} else {
				// Process the current line
				this._handleLine(currentLine, this.vCardFileReader);
			}
			
			currentLine = this.vCardFileReader.readLine();
		}
		
		return new Future({ keepProcessing: false });
	},
	
	/**
	 * Counts the number of vCards(contacts) contained in the vCard specified at the path.
	 * @param {string} filePath - the filePath of a vCard
	 * @returns {int} The number of contacts in the vCard
	 */
	countContacts: function () {
		return VCardImporter.countContacts(this.filePath);
	},
	
	// PRIVATE
	_getCurrentContact: function () {
		return this.currentContact;
	},
	
	_setCurrentContact: function (contactToAdd) {
		this.currentContact = contactToAdd;
	},
	//////////////////////////////////////
	
	/**
	 * PRIVATE
	 * Given a line from the vCard
	 * process the current line and add it to the current contact object
	 * @param {string}  line from vCard to process
	 * @param {VCardFileReader} a fileReader for a vCard
	 * @returns {} 
	 */
	_handleLine: function (line, fileReader) {
		var lineType = this._getVCardLinePrefixType(line),
			currentContact = this._getCurrentContact(),
			tempOrganization,
			tempLine2,
			endCardRegex;
		
		if (!currentContact) {
			currentContact = new Contact();
			this._setCurrentContact(currentContact);
		}
		
		if (!lineType) {
			return;
		}
		
		switch (lineType) {
		case VCard.MARKERS.NAME:
			currentContact.getName().set(this._handleName(line));
			break;
		case VCard.MARKERS.NICKNAME:
			currentContact.getNickname().setValue(this._handleNickname(line));
			break;
		case VCard.MARKERS.COMPANY:
			this._doOrganizationLine(currentContact, line, this._handleCompanyName);
			break;
		case VCard.MARKERS.JOBTITLE:
			this._doOrganizationLine(currentContact, line, this._handleJobTitle);
			break;
		case VCard.MARKERS.PHONE:
			currentContact.getPhoneNumbers().add(this._handlePhoneNumber(line));
			break;
		case VCard.MARKERS.EMAIL:
			currentContact.getEmails().add(this._handleEmail(line));
			break;
		case VCard.MARKERS.ADDRESS:
			currentContact.getAddresses().add(this._handleAddress(line));
			break;
		case VCard.MARKERS.BIRTHDAY:
			currentContact.getBirthday().setValue(this._handleBirthday(line));
			break;
		case VCard.MARKERS.URL:
			currentContact.getUrls().add(this._handleUrl(line));
			break;
		case VCard.MARKERS.RELATED:
			// Peek at the next line to make sure that it is not
			// an end:vcard line.
			tempLine2 = fileReader.peek();
			endCardRegex = new RegExp(VCard.MARKERS.END);
			if (endCardRegex.exec(VCardImporter._handleBadPeoplesImplementationOfvCardsFixupLine(tempLine2))) {
				console.warn("vCardImporter._handleLine ERROR: ran into a malformed vCard entry when handling related line");
				return;
			}
			// We do this since the next line is not an end:vCard marker and we don't want the next line to be
			// used again since it is going to be used for handleRelation
			tempLine2 = fileReader.readLine();
			currentContact.getRelations().add(this._handleRelation(line, tempLine2));
			break;
		case VCard.MARKERS.SPOUSE_ONE_LINE:
			currentContact.getRelations().add(this._handleRelation(line, VCard.TYPEMARKERS.SPOUSE_ONE_LINER));
			break;
		case VCard.MARKERS.CHILD_ONE_LINE:
			currentContact.getRelations().add(this._handleRelation(line, VCard.TYPEMARKERS.CHILD_ONE_LINER));
			break;
		case VCard.MARKERS.GTALK:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.GTALK.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.AIM:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.AIM.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.MSN:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.MSN.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.YAHOO:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.YAHOO.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.JABBER:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.JABBER.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.QQ:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.QQ.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.ICQ:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.ICQ.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.SKYPE:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.SKYPE.VCARD_VALUE, line));
			break;
		case VCard.MARKERS.IM:
			currentContact.getIms().add(this._handleIM(VCard.IM_SERVICES.OTHER.SERVICE_NAME, line));//falls to default
			break;
		case VCard.MARKERS.NOTE:
			currentContact.getNote().setValue(this._handleNote(line));
			break;
		}
		
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard and an array of accumulated multiLine object data
	 * process the current line and add it to this contact object
	 * @param {string}  line from vCard to process
	 */
	_doOrganizationLine: function (currentContact, line, handleOrganizationFunction) {
		var tempOrganization = currentContact.getOrganizations().getArray()[0];
		if (!tempOrganization) {
			tempOrganization = handleOrganizationFunction.apply(this, [line, tempOrganization]);
			currentContact.getOrganizations().add(tempOrganization);
		} else {
			handleOrganizationFunction.apply(this, [line, tempOrganization]);
		}
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates a PhoneNumber object and returns
	 * it.
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {PhoneNumber} the PhoneNumber object that represents the line from the vCard
	 */
	_handlePhoneNumber: function (line) {
		var toReturn = new PhoneNumber();
		toReturn.setValue(this._getLineValue(line));
		toReturn.setType(this._setThisTypeIfUndefined(this._mapVCardValueToContactPointType(this._extractLabel(line), VCard.TYPES.PHONE_NUMBER), VCard.TYPES.PHONE_NUMBER.OTHER.CONTACT_POINT_VALUE));
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates an EmailAddress object and returns
	 * it.
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {EmailAddress} the EmailAddress object that represents the line from the vCard
	 */
	_handleEmail: function (line) {
		var toReturn = new EmailAddress();
		toReturn.setValue(this._getLineValue(line));
		toReturn.setType(this._setThisTypeIfUndefined(this._mapVCardValueToContactPointType(this._extractLabel(line), VCard.TYPES.EMAIL), VCard.TYPES.EMAIL.OTHER.CONTACT_POINT_VALUE));
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates a Nickname object and returns
	 * it.
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {Nickname} the Nickname object that represents the line from the vCard
	 */
	_handleNickname: function (line) {
                return this._unescapeString(this._getLineValue(line));
            },
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates a Url object and returns
	 * it.
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {Url} the Url object that represents the line from the vCard
	 */
	_handleUrl: function (line) {
		var toReturn = new Url();
			//urlString = this._getLineValue(line);
		
		// Need to figure out what this was used for at some point and time
		//urlString = urlString.replace(/\\(.{1})/g, "$1");
		toReturn.setValue(this._getLineValue(line));
		toReturn.setType(this._setThisTypeIfUndefined(this._mapVCardValueToContactPointType(this._extractLabel(line), VCard.TYPES.URL), VCard.TYPES.URL.OTHER.CONTACT_POINT_VALUE));
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates a Birthday object and returns
	 * it.
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {Birthday} the Birthday object that represents the line from the vCard
	 */
	_handleBirthday: function (line) {
		var toReturn,
			bdayValue = this._getLineValue(line);
		
		if (bdayValue.length < 8) {
			console.log("Birthday for vCard contact is too short to parse");
			return undefined;
		}
		
		if (bdayValue.length === 8) {
			bdayValue = bdayValue.substring(0, 4) + "-" + bdayValue.substring(4, 6) + "-" + bdayValue.substring(6, 8);
		} else if (bdayValue.length > 10) {
			return undefined;
		}
		
		return bdayValue;
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates a Name object and returns
	 * it.
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {Name} the Name object that represents the line from the vCard
	 */
	_handleName: function (line) {
		var name = this._getLineValue(line),
			namePieces = this._splitValues(name),
			i = 0,
			namePiece,
			toReturn;
			
		toReturn = new Name();
		
		if (namePieces.length === 0) {
			return toReturn;
		}
		
		for (i = 0; i < namePieces.length; i += 1) {
			namePiece = namePieces[i];
			switch (i) {
			case 0:
				toReturn.setFamilyName(namePiece);
				break;
			case 1:
				toReturn.setGivenName(namePiece);
				break;
			case 2:
				toReturn.setMiddleName(namePiece);
				break;
			case 3:
				toReturn.setHonorificPrefix(namePiece);
				break;
			case 4:
				toReturn.setHonorificSuffix(namePiece);
				break;
			}
		}
		
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Given a line and im type from the vCard this creates an IMAddress object and returns
	 * it.
	 * @param {string} the type of the im address that is being processed
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {IMAddress} the IMAddress object that represents the line from the vCard
	 */
	_handleIM: function (type, line) {
		var im = new IMAddress();
		
		if (!type || !line) {
			return undefined;
		}
		
		switch (type) {
		case VCard.IM_SERVICES.GTALK.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.GTALK.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.AIM.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.AIM.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.MSN.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.MSN.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.JABBER.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.JABBER.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.YAHOO.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.YAHOO.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.ICQ.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.ICQ.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.QQ.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.QQ.SERVICE_NAME);
			break;
		case VCard.IM_SERVICES.SKYPE.VCARD_VALUE:
			im.setType(VCard.IM_SERVICES.SKYPE.SERVICE_NAME);
			break;
		default:
			im.setType(VCard.IM_SERVICES.OTHER.SERVICE_NAME);
			break;
		}
		
		im.setValue(this._getLineValue(line));
		//im.setType(VCard.TYPES.IM_ADDRESS.OTHER.CONTACT_POINT_VALUE);
		
		return im;
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates an organization object if the
	 * one passed in is not defined and sets the name.
	 * @param {string}  line that contains a contact point entry and a label
	 * @param {Organization} optional - organization object that was returned from a previous
	 *                                  vCard line that contained organization information
	 * @returns {Organization} an organization object with the name value set.
	 */
	_handleCompanyName: function (line, organization) {
		var companyString = this._getLineValue(line),
			splitCompany = this._splitValues(companyString),
			companyName = splitCompany[0];
		
		// splitCompany[1] has the department. We should add this someday
		
		organization = organization ? organization : new Organization();
		
		organization.setName(companyName ? companyName : "");
		
		return organization;
	},
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates an organization object if the
	 * one passed in is not defined and sets the job title.
	 * @param {string}  line that contains a contact point entry and a label
	 * @param {Organization} optional - organization object that was returned from a previous
	 *                                  vCard line that contained organization information
	 * @returns {Organization} an organization object with the jobTitle value set.
	 */
	_handleJobTitle: function (line, organization) {
		var jobTitle = this._unescapeString(this._getLineValue(line));
		
		organization = organization ? organization : new Organization();
		
		organization.setTitle(jobTitle ? jobTitle : "");
		
		return organization;
	},
	
	
	/**
	 * PRIVATE
	 * Given a line from the vCard this creates an address object and fills it with the line
	 * @param {string}  line that contains an address
	 * @returns {Address} an address object that represents the address from the vCard line
	 */
	_handleAddress: function (line) {
		var toReturn = new Address(),
			poBox = "",
			street = "",
			extended = "",
			addressValue = this._getLineValue(line),
			addressParts,
			addressPart,
			strippedAddress,
			i;
		
		addressParts = addressValue.split(";");
		
		for (i = 0; i < addressParts.length; i += 1) {
			addressPart = addressParts[i];
			
			switch (i) {
			case 0:
				// PO BOX
				poBox = addressPart;
				break;
			case 1:
				// Extended Address. For things like apartment numbers, suites.
				// Google shoves their addresses in here since they are freeform. Kinda annoying.
				strippedAddress = addressPart.replace(/\\n/g, "\n");
				strippedAddress = strippedAddress.replace(/\\\,/g, ",");
				extended = strippedAddress;
				break;
			case 2:
				// Street Address
				street = addressPart;
				break;
			case 3:
				// City
				toReturn.setLocality(addressPart);
				break;
			case 4:
				// State
				toReturn.setRegion(addressPart);
				break;
			case 5:
				// Zip code
				toReturn.setPostalCode(addressPart);
				break;
			case 6:
				// Country
				toReturn.setCountry(addressPart);
				break;
			}
		}
		
		
		// Fancy-shmancy street address handling of shoving PO Box, Street, and extended.
		// Only add commas to one of this if the address component to follow it
		// contains something. If it doesn't contain anything then no point in adding a
		// comma
		poBox = poBox && (street || extended) ? poBox + ", " : poBox;
		street = street && extended ? street + ", " : street;
		toReturn.setStreetAddress(poBox + street + extended);
		
		toReturn.setType(this._setThisTypeIfUndefined(this._mapVCardValueToContactPointType(this._extractLabel(line), VCard.TYPES.ADDRESS), VCard.TYPES.ADDRESS.OTHER.CONTACT_POINT_VALUE));
		
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Given two lines from the vCard this creates a Relation object
	 * @param {string} line that has a relation's name
	 * @param {string} line that holds the type of a relation
	 * @returns {Relation} a relation object from the two lines passed in.
	 */
	_handleRelation: function (relationNameLine, relationTypeLine) {
		var name = relationNameLine ? this._getLineValue(relationNameLine) : undefined,
			type = relationTypeLine ? this._setThisTypeIfUndefined(this._mapVCardValueToContactPointType(this._extractRelationLabel(relationTypeLine), VCard.TYPES.RELATION), VCard.TYPES.RELATION.OTHER.CONTACT_POINT_VALUE) : undefined;
		
		if (name && type) {
			return new Relation({ value: name, type: type, primary: false });
		}
	},
	
	/**
	 * PRIVATE
	 * Gets the type into a standard for for the extractLabel methods
	 * @param {string}  line that contains the label
	 * @returns {string} the label in a standard form
	 */
	_getTypeInfo: function (line) {
		var seperatorIndex = line.indexOf(VCard.MARKERS.SEPERATOR),
			typeInfo,
			toReturn = VCard.TYPEMARKERS.OTHER;
		
		// Do this so that if we don't find the marker we can at least
		// analyze some of the line
		seperatorIndex = seperatorIndex === -1 ? undefined : seperatorIndex;
		
		typeInfo = line.substring(0, seperatorIndex);
		
		typeInfo = VCardImporter._handleBadPeoplesImplementationOfvCardsFixupLine(typeInfo);
		
		return typeInfo;
	},
	
	/**
	 * PRIVATE
	 * Gets the label for a relation
	 * @param {string}  line that contains the relation label
	 * @returns {string} the relation TYPEMARKER that was found 
	 */
	_extractRelationLabel: function (line) {
		var typeInfo = this._getLineValue(line),
			toReturn = VCard.TYPEMARKERS.OTHER;
		
		typeInfo = typeInfo ? VCardImporter._handleBadPeoplesImplementationOfvCardsFixupLine(typeInfo) : "";
		
		if (typeInfo.indexOf(VCard.TYPEMARKERS.ASSISTANT) !== -1) {
			toReturn = VCard.TYPEMARKERS.ASSISTANT;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.BROTHER) !== -1) {
			toReturn = VCard.TYPEMARKERS.BROTHER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.CHILD) !== -1) {
			toReturn = VCard.TYPEMARKERS.CHILD;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.FATHER) !== -1) {
			toReturn = VCard.TYPEMARKERS.FATHER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.FRIEND) !== -1) {
			toReturn = VCard.TYPEMARKERS.FRIEND;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.MANAGER) !== -1) {
			toReturn = VCard.TYPEMARKERS.MANAGER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.MOTHER) !== -1) {
			toReturn = VCard.TYPEMARKERS.MOTHER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.PARENT) !== -1) {
			toReturn = VCard.TYPEMARKERS.PARENT;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.PARTNER) !== -1) {
			toReturn = VCard.TYPEMARKERS.PARTNER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.RELATIVE) !== -1) {
			toReturn = VCard.TYPEMARKERS.RELATIVE;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.SISTER) !== -1) {
			toReturn = VCard.TYPEMARKERS.SISTER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.SPOUSE) !== -1) {
			toReturn = VCard.TYPEMARKERS.SPOUSE;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.REFERRED_BY) !== -1) {
			toReturn = VCard.TYPEMARKERS.REFERRED_BY;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.DOMESTIC_PARTNER) !== -1) {
			toReturn = VCard.TYPEMARKERS.DOMESTIC_PARTNER;
		}
		
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Gets the label for a contact point entry in a line
	 * @param {string}  line that contains a contact point entry and a label
	 * @returns {string} the TYPEMARKER that was found 
	 */
	_extractLabel: function (line) {
		var typeInfo = this._getTypeInfo(line),
			toReturn = VCard.TYPEMARKERS.OTHER;
		
		if (typeInfo.indexOf(VCard.TYPEMARKERS.FAX) !== -1) {
			if (typeInfo.indexOf(VCard.TYPEMARKERS.HOME) !== -1) {
				toReturn = VCard.TYPEMARKERS.FAX_HOME;
			} else {
				toReturn = VCard.TYPEMARKERS.FAX_WORK;
			}
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.WORK) !== -1) {
			toReturn = VCard.TYPEMARKERS.WORK;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.HOME) !== -1) {
			toReturn = VCard.TYPEMARKERS.HOME;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.CELL) !== -1) {
			toReturn = VCard.TYPEMARKERS.CELL;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.PAGER) !== -1) {
			toReturn = VCard.TYPEMARKERS.PAGER;
		} else if (typeInfo.indexOf(VCard.TYPEMARKERS.MAIN) !== -1) {
			toReturn = VCard.TYPEMARKERS.MAIN;
		}
		
		return toReturn;
	},
	
	/**
	 * PRIVATE
	 * Gets the value for a line. With a vCard anything after the seperator
	 * is considered the value.
	 * @param {string}  line that you want the value from
	 * @returns {string} The part of the line after the seperator
	 */
	_getLineValue: function (line) {
		line = Foundations.StringUtils.escapeHTML(line);
		return line.substring(line.indexOf(VCard.MARKERS.SEPERATOR) + 1).replace(/\r$/, "");
	},
	
	/**
	 * PRIVATE
	 * Gets the vCard line's contact point type (TEL, ADR, ...)
	 * @param {string}  line that you want the type from
	 * @returns {string} The type of this line's contact point type
	 */
	_getVCardLinePrefixType: function (line) {
		var prefixMatcher = new RegExp(VCardImporter.PREFIX_REGEX, "i"),
			items = prefixMatcher.exec(line),
			prefixType,
			typeValues,
			tmpType;
			
		if (items && items.length > 2) {
			prefixType = items[2].toUpperCase();
			
			// In case of Yahoo VCard, for each of the entries we will have two lines for IM addresses:
			// One line will be of type X-YAHOO-ID, X-SKYPE-ID (each of the extensions will gain a "-ID")
			// The other line will be an X-IM line of form X-IM;YAHOO;.., X-IM;SKYPE; and so on. In this case we 
			// would need to rewrite the line type
			if (prefixType === VCard.MARKERS.IM) {
				typeValues = this._splitValues(line);
				if (typeValues.length > 1) {
					tmpType = typeValues[1];
                    if (tmpType && VCard.IM_SERVICES[tmpType] && VCard.MARKERS[tmpType]) {
						prefixType = VCard.MARKERS[tmpType];
					}
				}
			}
			return prefixType;
		}
		return undefined;
	},
	
	/**
	 * PRIVATE
	 * Given a vCard type map it into the specific contactPointType passed in
	 * @param {string}  the vCardType, probably returned from _extractLabel
	 * @param {object} an object containing objects with the attributes "VCARD_VALUE", and "CONTACT_POINT_VALUE".
	 *                 one of the objects in the containing objects should not have a VCARD_VALUE. This will be
	 *                 used as the default when the vCardType parameter is not contained in the contactPointTypeObjects
	 * @returns {string} The label for the type of contactPoint
	 */
	_mapVCardValueToContactPointType: function (vCardType, contactPointTypeObjects) {
		var contactPointType,
			contactPointTypeObject,
			defaultContactPointType;
			
		for (contactPointType in contactPointTypeObjects) {
			if (contactPointTypeObjects.hasOwnProperty(contactPointType)) {
				contactPointTypeObject = contactPointTypeObjects[contactPointType];
				
				if (contactPointTypeObject.VCARD_VALUE && contactPointTypeObject.VCARD_VALUE === vCardType) {
					return contactPointTypeObject.CONTACT_POINT_VALUE ? contactPointTypeObject.CONTACT_POINT_VALUE : undefined;
				} else if (!contactPointTypeObject.VCARD_VALUE && !defaultContactPointType) {
					defaultContactPointType = contactPointTypeObject.CONTACT_POINT_VALUE ? contactPointTypeObject.CONTACT_POINT_VALUE : undefined;
				}
			}
		}
		
		return defaultContactPointType;
	},
	
	/**
	 * PRIVATE
	 * Given the returnedContactPointType return it if it was defined, otherwise return this other type
	 * @param {string}  the contactPointType to see if it was undefined
	 * @param {string} the type to return if the returnedContactPointType is undefined
	 * @returns {string} The label for the type of contactPoint
	 */
	_setThisTypeIfUndefined: function (returnedContactPointType, typeToSetIfUndefined) {
		return returnedContactPointType ? returnedContactPointType : typeToSetIfUndefined;
	},

	/**
	 * PRIVATE
	 * Split a 'value string' of the form xxx;yyy;zzz paying attention to the fact that the string
	 * can have escaped (i.e. '\;') semicolons in it and we don't want to split on that. Generally
	 * speaking, we want to consider a valid semicolon to split on to be any one that is preceded by
	 * zero or an even number of backslashes. so, in a nutshell this is an implementation of a
	 * negative "look behind" that js doesn't support natively in its regex engine.
	 *
	 * Additionally, the values need to be un- escaped. Specifically, the following escape sequences
	 * are recognized: 
	 * 
	 * \\ ====> \
	 * \: ====> ;
	 * \; ====> ;
	 * \, ====> ,
	 * 
	 * @param {string}  the value string to split
	 * @returns {array} an array of unescaped values
	 */
	_splitValues: function (string) {
		var	values = [],
		value = "",
		ch,
		backslashes,
		i;
		
		// optimization: see if there are any '\;' in the string
		if (/\\;/.test(string)) {
			for (i = 0; i < string.length; i = i + 1) {
				ch = string.charAt(i);
				if (ch === ';') {
					// see how many backslashes preceed the semicolon
					backslashes = value.match(/[\\]+$/);
					if (backslashes) {
						if ((backslashes[0].length % 2) === 0) {
							values.push(value);
							value = "";
						} else {
							value += ch;
						}
					} else {
						values.push(value);
						value = "";
					}
				} else {
					value += ch;
				}
			}
		
			if (value) {
				values.push(value);
			}
		}
		else {
			values = string.split(';');
		}
		
		// unescape each text value per the vCard spec. Specificly:
		// \: is unescaped as :
		// \; is escaped as ;
		// \, is escaped as ,
		// \\ is escaped as \
		
		for (i = 0; i < values.length; i = i + 1) {
			values[i] = StringUtils.escapeCommon(values[i], /(\\\\)|(\\:)|(\\;)|(\\,)/g, {"\\\\": "\\", "\\:": ":", "\\;": ";", "\\,": ","});
		}
		
		return values;
	},

	/**
	 * PRIVATE
	 * Unescape a string according to the vCard specification. Specifically, the following escape
	 * sequences are recognized: 
	 * 
	 * \\ ====> \
	 * \: ====> ;
	 * \; ====> ;
	 * \, ====> ,
	 * \n ====> newline ('\n')
	 * \N ====> newline ('\n')
	 * 
	 * @param {string}  the string to split
	 * @returns {string} the unescaped string
	 */
	_unescapeString: function (string) {
		return StringUtils.escapeCommon(string, /(\\\\)|(\\:)|(\\;)|(\\,)|(\\N)|(\\n)/g, {"\\\\": "\\", "\\:": ":", "\\;": ";", "\\,": ",", "\\N": "\n", "\\n": "\n" });
	},

	/**
	 * PRIVATE
	 * handle the contact's notes
	 * @param {string} line that has the note
	 * @returns {Note} a note object
	 */
	_handleNote: function (line) {
		return this._unescapeString(this._getLineValue(line));
	},

	/**
	 * PRIVATE
	 * setup for a vacrd import when we need to save the contact to the db
	 * @param {function} the 'saved contact' call back function (can be null)
	 * @param {bool} 'true' to not allow duplicate contacts into the account.
	 * @returns {future} the import future.
	 */
	_setupImport: function (processedContactCallback, deduplicate) {
		var	future = new Future();

		future.now(this, function () {
			if (this.importToAccountId === "") {
				var appPrefs = new AppPrefs(future.callback(function () {
				        return appPrefs.get(AppPrefs.Pref.defaultAccountId);
			        }));
			} else {
				return this.importToAccountId;
			}
		});

		future.then(this, function () {
			this.importToAccountId = future.result;
			console.log("vcards imported to account:" + this.importToAccountId);

			// we need to get the db kind for saving the contact from the account passed in.
			PalmCall.call("palm://com.palm.service.accounts/", "getAccountInfo", {"accountId" : this.importToAccountId}).then(this, function (accountFuture) {
				var	account = accountFuture.result.result,
					provider,
					i,
					noDBKinds = false,
					hash,
					hashes = {},
					hasHashes = false,
					query = {};

				if (accountFuture.result && accountFuture.result.returnValue && (accountFuture.result.returnValue === true)) {

					for (i = 0; (i < account.capabilityProviders.length) && !this._importContactDBKind && !noDBKinds; i = i + 1) {

						provider = account.capabilityProviders[i];
						if (provider.capability === "CONTACTS") {

							if (provider.id === "com.palm.palmprofile.contacts") {
								this._importContactDBKind = "com.palm.contact.palmprofile:1";
							} else if (provider.dbkinds && provider.dbkinds.contact) {
								this._importContactDBKind = provider.dbkinds.contact;
							} else {
								noDBKinds = true;
							}
						}
					}

					if (this._importContactDBKind) {
						if (deduplicate) {
							// generate the hashes for the purpose of de-duplication.
							query.from = Contact.kind;
							query.where = [{ prop: "accountId", op: "=", val: this.importToAccountId}];
							DB.find(query, false, true).then(this, function processContacts(contactsFuture) {
								var	contacts,
									contact,
									count;

								if (contactsFuture.result && contactsFuture.result.returnValue && (contactsFuture.result.returnValue === true) && (contactsFuture.result.results.length > 0)) {
									contacts = contactsFuture.result.results;
									count = contactsFuture.result.results.length;
									for (i = 0; i < count; i = i + 1) {
										hash = this._generateHash(new Contact(contacts[i]));
										if (hash) {
											hashes[hash] = true;
											hasHashes = true;
										}
									}

									if (hasHashes) {
										this._hashes = hashes;
									}
								}

								if (contactsFuture.next) {
									query = {};
									query.from = Contact.kind;
									query.next = contactsFuture.next;
									DB.find(query, false, true).then(_.bind(processContacts, this));
								} else {
									this._importVCard(processedContactCallback, true).then(this, function () {
										future.result = true;
									});
								}
							});
						} else {
							this._importVCard(processedContactCallback, true).then(this, function () {
								future.result = true;
							});
						}
					} else {
						future.exception = {	"errorCode" : "NO_PROVIDER_FOR_CONTACTS",
												"errorText" : "no provider for contacts could be retrieved for account: \"" + this.importToAccountId + "\"" };
					}
				} else {
					future.exception = {	"errorCode" : "NO_ACCOUNT_INFO",
											"errorText" : "no account info could be retrieved for account: \"" + this.importToAccountId + "\"" };
				}
			});
		});

		return future;
	},

	/**
	 * PRIVATE
	 * generate a hash on an item for the purposes of deduplication
	 * @param {contact}  the contact
	 * @returns {string} the hash for the item or null if there are no non-empty properties
	 */

	_generateHash: function (contact) {
		var i,
			j,
			item,
			data = "",
			hash,
			ar;

		item = contact.getAnniversary().getValue();
		data += item ? item : "";

		item = contact.getBirthday().getValue();
		data += item ? item : "";

		item = contact.getGender().getValue();
		data += item ? item : "";

		item = contact.getNickname().getValue();
		data += item ? item : "";

		item = contact.getNote().getValue() ? contact.getNote().getNormalizedHashKey() : null;
		data += item ? item : "";

		item = contact.getName().getNormalizedHashKey();
		data += item ? item : "";

		ar = contact.getAddresses().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getNormalizedHashKey();
			data += item;
		}

		ar = contact.getEmails().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getNormalizedHashKey();
			data += item;
		}

		ar = contact.getIms().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getNormalizedHashKey();
			data += item;
		}

		ar = contact.getOrganizations().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getName();
			item += ar[i].getDepartment();
			item += ar[i].getTitle();
			item += ar[i].getType();
			item += ar[i].getStartDate();
			item += ar[i].getEndDate();
			if (ar[i].getLocation()) {
				item += ar[i].getLocation().getNormalizedHashKey();
			}
			data += item;
		}

		ar = contact.getPhoneNumbers().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getNormalizedHashKey();
			data += item;
		}

		ar = contact.getUrls().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getNormalizedHashKey();
			data += item;
		}

		ar = contact.getRelations().getArray();
		for (i = 0; i < ar.length; i = i + 1) {
			item = ar[i].getNormalizedHashKey();
			data += item;
		}

		hash = (data.length > 0) ? Crypto.MD5.b64_md5(data) : null;
		return hash;
	}
});

/**
 * PRIVATE
 * This method is here to illustrate how morons that don't follow a standard make
 * things more difficult for developers that are trying to consume the standard.
 * Yeah this means you some versions of outlook!!!!!
 */
VCardImporter._handleBadPeoplesImplementationOfvCardsFixupLine = function (line) {
	return line.toUpperCase();
};

VCardImporter._isLineBeginVCard = function (line) {
	var newCardRegex = new RegExp(VCard.MARKERS.BEGIN);
	return newCardRegex.exec(VCardImporter._handleBadPeoplesImplementationOfvCardsFixupLine(line));
};

VCardImporter._isLineEndVCard = function (line) {
	var newCardRegex = new RegExp(VCard.MARKERS.END);
	return newCardRegex.exec(VCardImporter._handleBadPeoplesImplementationOfvCardsFixupLine(line));
};

/**
 * Counts the number of vCards(contacts) contained in the vCard specified at the path.
 * @param {string} filePath - the filePath of a vCard
 * @returns {int} The number of contacts in the vCard
 */
VCardImporter.countContacts = function (filePath) {
	Assert.require(Foundations.Comms.loadFile(filePath), "File to count vCards does not exist");
	
	var vCardReader = new VCardFileReader({filePath: filePath}),
		currentLine = null,
		contactCount = 0;
		
	currentLine = vCardReader.readLine();
	
	while (currentLine !== null) {
		if (VCardImporter._isLineBeginVCard(currentLine)) {
			contactCount += 1;
		}
		currentLine = vCardReader.readLine();
	}
	
	return contactCount;
};

VCardImporter.PREFIX_REGEX = "^(item[0-9]*?.)?([A-Z-]+)[;|:].*";


//@ sourceURL=contacts/App.js

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

}