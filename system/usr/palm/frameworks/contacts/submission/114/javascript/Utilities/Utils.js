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
