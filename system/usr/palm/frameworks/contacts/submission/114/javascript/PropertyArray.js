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
