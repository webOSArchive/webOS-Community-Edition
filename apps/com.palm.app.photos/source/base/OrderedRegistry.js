OrderedRegistry = function(sortFn) {
	this._array = [];
	this._dict = {};
	this._sortFn = sortFn;
	this._dirtySort = false;
	Object.defineProperty(this, "array", { get : function() { 
		// If the array isn't sorted and is supposed to be,
		// sort it before anybody sees the mess it's in.
		if (this._sortFn && this._dirtySort) {
			this._array.sort(this._sortFn);
			this._dirtySort = false;  // is now sorted, until it isn't
		}
		return this._array; 
	}});
	Object.defineProperty(this, "length", 
		{ get : function() { return this._array.length; }}
	);
};
OrderedRegistry.prototype.hasId = function(idString) {
	return this._dict.hasOwnProperty(idString);
};
OrderedRegistry.prototype.put = function(idString, registeredValue) {
	if (registeredValue === undefined) { 
		throw new Error("cannot register undefined value"); 
	}
	if (this.hasId(idString)) { this.removeId(idString); }
	this._array.push(registeredValue);
	this._dict[idString] = registeredValue;
	this._dirtySort = true;
};
OrderedRegistry.prototype.get = function(idString) {
	return this._dict[idString];
};
OrderedRegistry.prototype.removeId = function(idString) {
	var ded = this._dict[idString]; 
	if (ded === undefined) return;  // nothing is registered under "idString"

	// Remove from 'dict'
	delete this._dict[idString];

	// Linear search, because we don't know the index of the object in the array.
	var i, a;
	a = this._array;
	for (i=0; i<a.length; i++) {
		if (a[i] === ded) { 
			return a.splice(i,1); 
		}
	}
};
// Remove all entries whose IDs are not in the provided list,
// and return a key-value mapping of all removed entries.
OrderedRegistry.prototype.removeAllIdsExcept = function(idList) {
	var newDict = {};
	var newArray = [];
	var oldDict = this._dict;
	
	// Create replacement _dict and _array that contain only
	// the desired objects.
	var fn = function(id) {
		var reg = oldDict[id];
		delete oldDict[id];
		if (reg !== undefined) { 
			newDict[id] = reg; 
			newArray.push(reg);
		}
	}
	idList.forEach(fn);
	
	// Replace the old dict/array with the new ones, and return the
	this._array = newArray;
	this._dict = newDict;
	this._dirtySort = true;
	return oldDict;
};

// Answer a list of all registry 
OrderedRegistry.prototype.allIds = function() {
	return Object.keys(this._dict);
};

