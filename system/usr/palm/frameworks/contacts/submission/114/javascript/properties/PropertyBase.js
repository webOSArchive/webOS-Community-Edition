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
