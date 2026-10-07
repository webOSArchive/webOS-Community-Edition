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
