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