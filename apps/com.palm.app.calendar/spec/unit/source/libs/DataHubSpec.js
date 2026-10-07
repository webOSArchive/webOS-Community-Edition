/*
NOTES:
	- Test suite for the DataHub object.
	- tests/libs/DataHubSpecs.js

TODOs:
	- Implement DataHub.reset (enhancedObject) to remove DataHub from the enhanced object.
	- Create tests for DataHub.reset().
	- Create tests for DataHub.share ({data: withDataNotArrayWrapped}).
*/

describe ("DataHub", function defineDataHubTests () {
	var app = enyo.application;

	DataHub.enhance (app);

	beforeEach (function beforeEach () {
		// /*Uncomment to see DataHub-enhanced object's state after each test.*/ console.info (app);
	});

	afterEach (function afterEach () {
		app.clearHub();
	});

	function Watcher () {
		this.data = null;

		this.setData = function setData (data) {
			this.data = data;
		};
	}

	it (".clearHub(): Clears all watches and kept data.", function testDataHub_clearHub () {

		var	watcher	= new Watcher();

		app.watch ({data: watcher});
		app.share ({data: {data: "magic token", wait: true}});

		app.clearHub();
		expect (app.watches.data).not.toBeDefined();

		app.share ({data: {data:"HOW DID I GET SET?!", wait:true}});

		expect (watcher.data).toEqual ("magic token");
	});

	it (".watch ({data: watcher}): Watches for data shared asynchronously.", function testDataHub_watchAsyncShare () {

		var watcher = new Watcher();

		app.watch ({data: watcher});
		app.share ({data: {data: 42}});

		waitsFor (function() {
			return watcher.data !== null;
		}, 1000);

		runs (function() {
			expect (watcher.data).toEqual (42);
		});
	});

	it (".watch ({data: watcher}): Watches for data shared synchronously.", function testDataHub_watchSynchShare () {

		var	watcher = new Watcher();

		app.watch ({data: watcher});
		app.share ({data: {data: 42, wait:true}});

		expect (watcher.data).toEqual (42);
	});

	it (".share ({data: ...}): Shares all JS data types synchronously.", function testDataHub_shareAnythingSynchronously () {

		this.addMatchers ({
			toBeNaN: function() { return isNaN (this.actual); }
		});

		var	data = {wait: true}
		,	watcher	= new Watcher()
		;

		app.watch ({data: watcher});

		//test sending numbers
		data.data = 1;
		app.share({data: data});
		expect(watcher.data).toEqual(1);

		data.data = -1;
		app.share({data: data});
		expect(watcher.data).toEqual(-1);

		data.data = 0;
		app.share({data: data});
		expect(watcher.data).toEqual(0);

		//test sending bare strings
		data.data = "";
		app.share({data: data});
		expect(watcher.data).toEqual("");

		data.data = "nonempty";
		app.share({data: data});
		expect(watcher.data).toEqual("nonempty");

		//test sending garbage
		data.data = Number.NaN;
		app.share({data: data});
		expect(watcher.data).toBeNaN();

		data.data = null;
		app.share({data: data});
		expect(watcher.data).toBeNull();

		data.data = undefined;
		app.share({data: data});
		expect(watcher.data).not.toBeDefined();

		//test sending arrays
		data.data = [];
		app.share({data: data});
		expect(watcher.data).toEqual([]);	//should return an empty array back

		data.data = [1];
		app.share({data: data});
		expect(watcher.data).toEqual([1]);	//should return [1]

		data.data = [[]];
		app.share({data: data});
		expect(watcher.data).toEqual([[]]);

		data.data = [[1,2,3],[4,5,6]];
		app.share({data: data});
		expect(watcher.data).toEqual([[1,2,3],[4,5,6]]);

		//test sending attributed arrays through
		data.data = [];
		data.data.anAttribute = "present";
		app.share({data: data});
		expect(watcher.data.anAttribute).toEqual("present");

		//test sending an object through
		data.data = {data: "present"};
		app.share({data: data});
		expect(watcher.data).toEqual(data.data);

		//test sending a regex through
		data.data = /foo/
		app.share({data: data});
		expect(watcher.data).toEqual(data.data);
		expect(watcher.data.exec("foo").length).not.toEqual(0);

		//test sending a function through (possibly as a callback)
		data.data = function() { return "hello"};
		app.share({data: data});
		expect(watcher.data).toEqual(data.data);
		expect(watcher.data()).toEqual("hello");

		//that more or less handles the cases it shouldn't have a problem with
		//lets get to the ones that might cause it to blow up.

		//pass through the browser-native JSON object;

		if(typeof JSON != "undefined") {
			data.data = JSON;
			app.share({data: data});
			expect(watcher.data).toEqual(JSON);
		}

		//pass through window
		data.data = window;
		app.share({data: data});
		expect(watcher.data).toEqual(window);

		//pass through enyo
		data.data = enyo;
		app.share({data: data});
		expect(watcher.data).toEqual(enyo);
	});

	it (".share ({data: ...}): Shares all JS data types asynchronously.", function testDataHub_shareAnythingAsynchronously () {

		this.addMatchers ({
			toBeNaN: function() { return isNaN (this.actual); }
		});

		var	data	= {}
		,	watcher	= new Watcher()
		;

		spyOn(watcher, "setData").andCallThrough();

		app.watch({data: watcher});
		app.share({data: {data:1}});						//test sending numbers

		waitsFor (function() {
			return watcher.setData.callCount == 1;
		});

		runs (function () {
			expect(watcher.data).toEqual(1);
			app.share({data: {data:-1}});
		});

		waitsFor (function() {
			return watcher.setData.callCount == 2;
		});

		runs (function () {
			expect(watcher.data).toEqual(-1);
			app.share({data: {data:0}});
		})

		waitsFor (function() {
			return watcher.setData.callCount == 3;
		});

		runs (function () {
			expect(watcher.data).toEqual(0);
			app.share({data: {data:""}});					//test sending strings
		});

		waitsFor (function() {
			return watcher.setData.callCount == 4;
		});

		runs (function () {
			expect(watcher.data).toEqual("");
			app.share({data: {data:"nonempty"}});
		});

		waitsFor (function() {
			return watcher.setData.callCount == 5;
		});

		runs (function () {
			expect(watcher.data).toEqual("nonempty");
			app.share({data: {data:Number.NaN}});			//test sending garbage
		});

		waitsFor (function() {
			return watcher.setData.callCount == 6;
		});

		runs (function () {
			expect(watcher.data).toBeNaN();
			app.share({data: {data:null}});
		});

		waitsFor (function() {
			return watcher.setData.callCount == 7;
		});

		runs (function () {
			expect(watcher.data).toBeNull();
			app.share({data: {data:undefined}});
		});

		waitsFor (function() {
			return watcher.setData.callCount == 8;
		});

		runs (function () {
			expect(watcher.data).not.toBeDefined();
			app.share({data: {data:[]}});					//test sending arrays
		});

		waitsFor (function() {
			return watcher.setData.callCount == 9;
		});

		runs (function () {
			expect(watcher.data).toEqual([]);
			app.share({data: {data:[1]}});
		});

		waitsFor (function() {
			return watcher.setData.callCount == 10;
		});

		runs (function () {
			expect(watcher.data).toEqual([1]);
			app.share({data: {data:[[]]}});
		})

		waitsFor (function() {
			return watcher.setData.callCount == 11;
		});

		runs (function () {
			expect(watcher.data).toEqual([[]]);
			app.share({data: {data:[[1,2,3],[4,5,6]]}});
		});

		waitsFor (function() {
			return watcher.setData.callCount == 12;
		});

		runs (function () {
			expect(watcher.data).toEqual([[1,2,3],[4,5,6]]);

			data = [];
			data.anAttribute = "array attribute";
			app.share({data: {data:data}});				//test sending attributed arrays
		});

		waitsFor (function() {
			return watcher.setData.callCount == 13;
		});

		runs (function () {
			expect(watcher.data.anAttribute).toEqual("array attribute");
			app.share({data: {data: {aProperty: "object property"}}});	//test sending an object
		});

		waitsFor (function() {
			return watcher.setData.callCount == 14;
		});

		runs (function () {
			expect(watcher.data.aProperty).toEqual("object property");
			data = /foo/;
			app.share({data: {data: data}});				//test sending a regex
		});

		waitsFor (function() {
			return watcher.setData.callCount == 15;
		});

		runs (function () {
			expect(watcher.data).toEqual(data);
			expect(watcher.data.exec("foo").length).not.toEqual(0);

			data = function() { return "hello"};
			app.share({data: {data: data}});				//test sending a function
		});

		waitsFor (function() {
			return watcher.setData.callCount == 16;
		});

		runs (function () {
			expect(watcher.data).toEqual(data);
			expect(watcher.data()).toEqual("hello");

												//that more or less handles the cases it shouldn't have a problem with
												//lets get to the ones that might cause it to blow up.
			app.share({data: {data: window}});				//test sending window
		});

		waitsFor (function () {
			return watcher.setData.callCount == 17;
		});

		runs (function () {
			expect(watcher.data).toEqual(window);
			app.share({data: {data: enyo}});				//test sending enyo
		});

		waitsFor (function () {
			return watcher.setData.callCount == 18;
		});

		runs (function () {
			expect(watcher.data).toEqual(enyo);
		});

		if (typeof JSON != "undefined") {
			runs (function () {
				app.share({data: {data: JSON}});			//test sending browser-native JSON object
			});

			waitsFor (function () {
				return watcher.setData.callCount == 19;
			});

			runs (function () {
				expect(watcher.data).toEqual(JSON);
			});
		}
	});

	it ('.share ({data: {keep:true}}): Keeps data marked as "keep" for future watchers.', function testDataHub_keepSyncShare () {
		var	watcher	= new Watcher();

		var	data	=
		{	data	: "retained value"
		,	wait	: true	// Request to wait for sharing to complete before executing next statement.
		,	keep	: true	// Request to keep the data being shared after sharing completes.
		};

		app.share ({data: data});			// Share something before any watchers are set.
		app.watch ({data: watcher});		// Watch something that was already shared.

		expect (watcher.data).toBe ("retained value");
	});

	it (".ignore ({data: watcher}): Ignores data shared synchronously.", function testDataHub_ignoreSynchronously () {

		var	data	= {wait: true}
		,	watcher	= new Watcher()
		;

		app.watch ({data: watcher});
		data.data = "magic cookie";
		app.share ({data: data});

		app.ignore ({data: watcher});

		data.data = "cookie monster";
		app.share ({data: data});

		expect (watcher.data).toEqual ("magic cookie");

		app.watch ({data: watcher});
		data.data = "success";
		app.share ({data: data });

		expect (watcher.data).toBe ("success");
	});

	it (".ignore ({data: watcher}): Ignores data shared asynchronously, preventing the share from occurring if it hasn't occurred yet.", function testDataHub_ignoreSynchronously () {

		var	watcher	= new Watcher();

		app.watch ({data: watcher});
		app.share ({data: {data:"magic cookie"}});

		waitsFor (function() {
			return watcher.data !== null;
		});

		runs (function() {
			expect (watcher.data).toEqual ("magic cookie");
			app.share ({data: {data:"cookie monster"}});

			app.ignore ({data: watcher});	// We tell the watcher to ignore, next.  Because this operation is synchronous, the watcher should never get the new data.
		});

		waits (1000);						// INFO: Waits is deprecated, we need a better way of doing this.

		runs (function() {
			expect (watcher.data).toEqual ("magic cookie");
		});
	});

	it (".free ({data: true}): Frees the specified kept data.", function testDataHub_free () {

		var	watcher		= new Watcher()
		,	watcher2	= new Watcher()
		,	watcher3	= new Watcher()
		;

		var	data	=
		{	value	: "long-term retained value"
		,	wait	: true
		,	keep	: true
		};

		app.watch ({data: watcher});
		app.share ({data: data});

		//watcher should now have the retained value.

		app.watch ({data: watcher2});
		//watcher2 should now have the retained value

		app.free  ({data: true});
		app.watch ({data: watcher3});

		expect (watcher.data).toBe (data.data);
		expect (watcher2.data).toBe (data.data);
		expect (watcher3.data).not.toBe (data.data);

		data.data = "a new value"
		app.share ({data: data});

		//all 3 should get the new value
		expect (watcher.data).toBe (data.data);
		expect (watcher2.data).toBe (data.data);
		expect (watcher3.data).toBe (data.data);
	});
});
