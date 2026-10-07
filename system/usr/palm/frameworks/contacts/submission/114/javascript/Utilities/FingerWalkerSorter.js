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