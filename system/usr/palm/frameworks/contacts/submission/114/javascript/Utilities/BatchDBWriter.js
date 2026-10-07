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
