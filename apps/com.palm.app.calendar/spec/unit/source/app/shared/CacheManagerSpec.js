function EventManager() {
	//clone the results, because some of the tests do modify this.
	this.queryResults = EventManager.prototype.queryResults.slice(0);	
}
EventManager.prototype = {
	getEvents: function() {
		return true;
	},
	utils: {
		formatResponse: function(events,days,whocares,hidden) {
			return [];	
		}
	},
	getEventsInRange: function () {		
		return {
			'days': [
				{
					date: 1292659200000,
					events: [
						{	
						"_id"	: "++HVowZQy5WRusag",
						"_kind": "com.palm.calendarevent:1", 
						"accountId": "++HM6sJVRCK4_5D7", 
						"calendarId": "++HM6sN4VPZ3aGzr", 
						"dtend": 1292695200000, 
						"dtstart": 1292691600000, 
						"currentLocalEnd": 1292695200000, 
						"currentLocalStart": 1292691600000, 
						"renderEndTime": 1292695200000, 
						"renderStartTime": 1292691600000, 
						"location": "", 
						"note": "", 
						"subject": "Test 1", 
						"tzId": "America/Los_Angeles",
						"eventDisplayRevset": 1
						},
						{	
						"_id"	: "++HVowZQy5WRusah",
						"_kind": "com.palm.calendarevent:1", 
						"accountId": "++HM6sJVRCK4_5D7", 
						"calendarId": "++HM6sN4VPZ3aGzr", 
						"dtend": 1292695800000, 
						"dtstart": 1292692200000, 
						"currentLocalEnd": 1292695800000, 
						"currentLocalStart": 1292692200000, 
						"renderEndTime": 1292695800000, 
						"renderStartTime": 1292692200000, 
						"location": "", 
						"note": "", 
						"subject": "Test 2", 
						"tzId": "America/Los_Angeles",
						"eventDisplayRevset": 2
						},
						{	
						"_id"	: "++HVowZQy5WRusai",
						"_kind": "com.palm.calendarevent:1", 
						"accountId": "++HM6sJVRCK4_5D7", 
						"calendarId": "++HM6sN4VPZ3aGzr", 
						"dtend": 1292696400000, 
						"dtstart": 1292692800000, 
						"currentLocalEnd": 1292696400000, 
						"currentLocalStart": 1292692800000, 
						"renderEndTime": 1292696400000, 
						"renderStartTime": 1292692800000, 
						"location": "", 
						"note": "", 
						"subject": "Test 3", 
						"tzId": "America/Los_Angeles",
						"eventDisplayRevset": 3
						}
					],
					allDayEvents: [],
					hiddenEvents: [],
					hiddenAllDay: []
				}	
			]
		}
	},
	observeDatabaseChanges: function() {
		return;
	},
	stopObservingDatabaseChanges: function() {
		return;
	},
	cancelGetEventsInRange: function() {},
	queryResults: [
		{	
			"_id"	: "++HVowZQy5WRusag",
			"_kind": "com.palm.calendarevent:1", 
			"accountId": "++HM6sJVRCK4_5D7", 
			"calendarId": "++HM6sN4VPZ3aGzr", 
			"dtend": 1292695200000, 
			"dtstart": 1292691600000, 
			"location": "", 
			"note": "", 
			"subject": "Test 1", 
			"tzId": "America/Los_Angeles",
			"eventDisplayRevset": 1
		},
		{	
			"_id"	: "++HVowZQy5WRusah",
			"_kind": "com.palm.calendarevent:1", 
			"accountId": "++HM6sJVRCK4_5D7", 
			"calendarId": "++HM6sN4VPZ3aGzr", 
			"dtend": 1292695800000, 
			"dtstart": 1292692200000, 
			"location": "", 
			"note": "", 
			"subject": "Test 2", 
			"tzId": "America/Los_Angeles",
			"eventDisplayRevset": 2
		},
		{	
			"_id"	: "++HVowZQy5WRusai",
			"_kind": "com.palm.calendarevent:1", 
			"accountId": "++HM6sJVRCK4_5D7", 
			"calendarId": "++HM6sN4VPZ3aGzr", 
			"dtend": 1292696400000, 
			"dtstart": 1292692800000, 
			"location": "", 
			"note": "", 
			"subject": "Test 3", 
			"tzId": "America/Los_Angeles",
			"eventDisplayRevset": 3
		}
	]
}

describe("CacheManager", function() {
	var cm = calendar.CacheManager;

	//Scaffold Test 1 sets up the cache with only the events in the mock harness above
	function setupScaffoldTest1(instance) {
		instance.eventCache = {
			"++HVowZQy5WRusag": {
				instances: []
			},
			"++HVowZQy5WRusah": {
				instances: []
			},
			"++HVowZQy5WRusai": {
				instances: []
			}
		}
		var em = new EventManager();
		var days = em.getEventsInRange(); //this will get us a days array that should look correct.
		var args = days.days;
		instance.populateTimestampCache(args, function() {});
	}

	var defaultExpectedECache =  {
				"++HVowZQy5WRusag": {
					"instances":[],
					"index":0,
					"id":"++HVowZQy5WRusag",
					"revSet":1,
					"dtstart":1292691600000,
					"dtend":1292695200000
				},
				"++HVowZQy5WRusah":{
					"instances":[],
					"index":1,
					"id":"++HVowZQy5WRusah",
					"revSet":2,
					"dtstart":1292692200000,
					"dtend":1292695800000
				},
				"++HVowZQy5WRusai":{
					"instances":[],
					"index":2,
					"id":"++HVowZQy5WRusai",
					"revSet":3,
					"dtstart":1292692800000,
					"dtend":1292696400000
				}
			};
	//scaffold test 2 looks a lot like 1, but with the last event missing
	function setupScaffoldTest2(instance) {
		instance.eventCache = {
			"++HVowZQy5WRusag": {
				instances: []
			},
			"++HVowZQy5WRusah": {
				instances: []
			}
		}
		var em = new EventManager();
		em.queryResults = em.queryResults.slice(0,-1);
		var days = em.getEventsInRange(); //this will get us a days array that should look correct.
		days.days[0].events = days.days[0].events.slice(0,-1);
		var args = days.days;
		instance.populateTimestampCache(args, function() {});
	}

	describe("buildRangesForDays(): Test Suite", function() {
		var instance = new cm();
		it('Should return an empty list when argument range is empty', function() {
			var testRange = [];
			var expected = [];
			var result = instance.buildRangesForDays(testRange);
			expect(result).toEqual(expected);
		});

		it("When given a single day in its argument array, should return a single range covering only that day", function() {
			var testRange = [1315897200000];
			var expected = [[1315897200000, 1315983599999]];
			var result = instance.buildRangesForDays(testRange);
			expect(result).toEqual(expected);
		});
		it('When multiple days are given for the argument, all of which are contiguous, should return a single range covering all days', function() {
			var testRange =  [1315897200000, 1315983600000, 1316070000000, 1316156400000, 1316242800000, 1316329200000];
			var expected = [[1315897200000, 1316415599999]];
			var result = instance.buildRangesForDays(testRange);
			expect(result).toEqual(expected);
		});

		it("When multiple days are given for the argument, at least one of which is non-contiguous, should return a list of correct ranges for the given days", function() {
			//2011-9-13 at 0:00, 9-14, 9-15, 9-17. 9-18
			var testRange = [1315897200000, 1315983600000, 1316070000000, 1316242800000, 1316329200000];
			//[2011-9-13 at 0:00 to 2011-9-15 at 23:59:59], [2011-9-17 at 0:00 to 2011-9-18 at 23:59:59]
			var expected = [[1315897200000, 1316156399999], [1316242800000, 1316415599999]];
			var result = instance.buildRangesForDays(testRange);
			expect(result).toEqual(expected);
		});
		it("Should be able to handle its arguments not being in ascending order", function() {
			//test backwards arrays
			var testRange = [1315897200000, 1315983600000, 1316070000000, 1316242800000, 1316329200000];
			testRange.reverse();
			var expected = [[1315897200000, 1316156399999], [1316242800000, 1316415599999]];
			var result = instance.buildRangesForDays(testRange);
			expect(result).toEqual(expected);
		});	
	});
	
	describe("calculateRanges(): Test Suite", function() {
		it("Should return all ranges in the current timestampCache", function() {
			var instance = new cm();
			instance.timestampCache = {
				1315897200000: [],
				1315983600000: [],
				1316070000000: [],
				1316242800000: [],
				1316329200000: []
			}
			var expected = [[1315897200000, 1316156399999], [1316242800000, 1316415599999]];
			var result = instance.calculateRanges();
			expect(result).toEqual(expected);

			//other tests on this function are covered by buildRangesForDays as this function simply calls buildRangesForDays
		});	
	});

	describe("getMissingDays(): Test Suite", function() {
		var instance = new cm();
		var defaultCache = {
				1315897200000: [],
				1315983600000: [],
				1316070000000: [],
				1316242800000: [],
				1316329200000: []
			};
		it("For a range covering multiple midnights, at least one of which is not in the cache, "+
		 "the function should return an array containing every midnight not in the cache.", function() {
			instance.timestampCache = defaultCache;
			var expected = [1316156400000];
			var result = instance.getMissingDays(1315897200000, 1316329200000-1, instance.timestampCache);
			expect(result).toEqual(expected);
		});
		it("For a range containing only a single midnight, the function should return an array "+
		"containing that day if it is not currently in the timestamp cache.", function() {
			instance.timestampCache = defaultCache;
			var expected = [];
			var result = instance.getMissingDays(1315897200000, 1315983600000-1, instance.timestampCache);
			expect(result).toEqual(expected);
			expected = [1316156400000];
			var result = instance.getMissingDays(1316156400000, 1316242800000-1, instance.timestampCache);
			expect(result).toEqual(expected);
		});
		it("For a range covering multiple midnights, all of which are in the cache, "+
		"the function should return an empty array.", function() {
			instance.timestampCache = defaultCache;
			var expected = [];
			var result = instance.getMissingDays(1315897200000, 1316156400000-1, instance.timestampCache);
			expect(result).toEqual(expected);
		});
		it("For any range covering at least one midnight timestamp, if the timestamp cache is "+
		"completely empty, every midnight in the input range should be returned.", function() {
			instance.timestampCache = {};
			var expected = [1315897200000, 1315983600000, 1316070000000, 1316156400000, 1316242800000];
			var result = instance.getMissingDays(1315897200000, 1316329200000-1, instance.timestampCache);
			expect(result).toEqual(expected);
		})
	});
	
	describe("populateTimestampCache(): Test Suite", function() {
		it('For a days array containing new events, the new event instances should be in the '+
		'timestamp cache, and those instances should be noted in the event cache instances list '+
		'for the new events.', function() {
			var instance = new cm();
			
			setupScaffoldTest1(instance);
			var result = instance.timestampCache;
			var expectedTSCache = {
				1292659200000: [
					["++HVowZQy5WRusag", 1292691600000, 1292695200000, 1292691600000, 1292695200000, 1],
					["++HVowZQy5WRusah", 1292692200000, 1292695800000, 1292692200000, 1292695800000, 2],
					["++HVowZQy5WRusai", 1292692800000, 1292696400000, 1292692800000, 1292696400000, 3]
				]
			}
			//expect the timestampCache to look exactly like the above
			expect(result).toEqual(expectedTSCache);

			//expect the instances entries for each of the events to contain 1292659200000
			expect(instance.eventCache["++HVowZQy5WRusag"].instances).toEqual([1292659200000]);
			expect(instance.eventCache["++HVowZQy5WRusah"].instances).toEqual([1292659200000]);
			expect(instance.eventCache["++HVowZQy5WRusai"].instances).toEqual([1292659200000]);
		});	
	});
	
	describe("discardTimestampCache(): Test Suite", function() {
		it("timestampCache should be empty after run", function() {
			var instance = new cm();
			instance.timestampCache.garbage = "HELLO GARBAGE DATA";
			instance.discardTimestampCache();

			expect(instance.timestampCache).toEqual({});
		});	
	});
	
	describe("discardEvent(): Test Suite", function() {
		it('For an event in both caches, if the delete argument is false, the event should be '+
		'removed only from the timestamp cache', function() {
			var instance = new cm();
			setupScaffoldTest1(instance); //work with the scaffold 1 setup for CacheManager state.

			//test soft deletion (do not unlink from eventCache)
			instance.discardEvent("++HVowZQy5WRusag", false);
			
			var expectedTSCache = {
				1292659200000: [
					["++HVowZQy5WRusah", 1292692200000, 1292695800000, 1292692200000, 1292695800000, 2],
					["++HVowZQy5WRusai", 1292692800000, 1292696400000, 1292692800000, 1292696400000, 3]
				]
			}

			expect(instance.timestampCache).toEqual(expectedTSCache);
			expect(instance.eventCache["++HVowZQy5WRusag"].instances).toEqual([]);
		});
		it('For an event in both caches, if the delete argument is true, the event should be '+
		'removed from both the timestamp and event caches', function() {
			var instance = new cm();
			setupScaffoldTest1(instance); //work with the scaffold 1 setup for CacheManager state.

			//test hard deletion (delete from eventCache too)
			instance.discardEvent("++HVowZQy5WRusag", true);

			var expectedTSCache = {
				1292659200000: [
					["++HVowZQy5WRusah", 1292692200000, 1292695800000, 1292692200000, 1292695800000, 2],
					["++HVowZQy5WRusai", 1292692800000, 1292696400000, 1292692800000, 1292696400000, 3]
				]
			}
			expect(instance.timestampCache).toEqual(expectedTSCache);
			expect(instance.eventCache["++HVowZQy5WRusag"]).toBeUndefined();
		});	
		it('For an event not in either the timestamp nor event caches, both caches '+
		'should be unchanged.', function() {
			var instance = new cm();
			setupScaffoldTest1(instance); //work with the scaffold 1 setup for CacheManager state.
			var oldECache = JSON.parse(JSON.stringify(instance.eventCache));
			instance.discardEvent("++HVowZQy5WRusaj", true);	//event doesn't exist

			var expectedTSCache = {
				1292659200000: [
					["++HVowZQy5WRusag", 1292691600000, 1292695200000, 1292691600000, 1292695200000, 1],
					["++HVowZQy5WRusah", 1292692200000, 1292695800000, 1292692200000, 1292695800000, 2],
					["++HVowZQy5WRusai", 1292692800000, 1292696400000, 1292692800000, 1292696400000, 3]
				]
			}
			expect(instance.timestampCache).toEqual(expectedTSCache);
			expect(instance.eventCache).toEqual(oldECache);
		});
		it('For an event in the event cache but not in the timestamp cache, the event cache should '+
		'be modified and the timestamp cache left alone.', function() {
			var instance = new cm();
			setupScaffoldTest2(instance);
			instance.eventCache = JSON.parse(JSON.stringify(defaultExpectedECache)); //insert the missing event from test 1 back into the ecache

			var oldTSCache = JSON.parse(JSON.stringify(instance.timestampCache));

			instance.discardEvent("++HVowZQy5WRusai", true);

			expect(instance.eventCache['++HVowZQy5WRusai']).toBeUndefined();
			expect(instance.timestampCache).toEqual(oldTSCache);
		});
	});

	

	describe("buildEventCache(): Test Suite", function() {
		var instance = new cm();
		var ev = instance.eventManager;
		spyOn(instance, 'updateTimestampCache').andReturn(false);
		it('simple test with default data', function() {
			instance.databaseChanged();

			expect(instance.eventCache).toEqual(defaultExpectedECache);
		});
		it("drop event from cache", function() {
			var savedEvent = ev.queryResults.pop();
			instance.databaseChanged();

			var expectedEvCache =  {
				"++HVowZQy5WRusag": {
					"instances":[],
					"index":0,
					"id":"++HVowZQy5WRusag",
					"revSet":1,
					"dtstart":1292691600000,
					"dtend":1292695200000
				},
				"++HVowZQy5WRusah":{
					"instances":[],
					"index":1,
					"id":"++HVowZQy5WRusah",
					"revSet":2,
					"dtstart":1292692200000,
					"dtend":1292695800000
				}
			};
			expect(instance.eventCache).toEqual(expectedEvCache);
			//reset for the next test
			ev.queryResults.push(savedEvent);
		});
		it('detect a change to revSet and update event objects', function() {
			var target = ev.queryResults.pop();
			var orig = JSON.parse(JSON.stringify(target));

			target.eventDisplayRevset = 4;
			target.dtend = 1292698800000;
			target.dtstart = 1292695200000;
			ev.queryResults.push(target);

			instance.databaseChanged();

			var expectedEvCache =  {
				"++HVowZQy5WRusag": {
					"instances":[],
					"index":0,
					"id":"++HVowZQy5WRusag",
					"revSet":1,
					"dtstart":1292691600000,
					"dtend":1292695200000
				},
				"++HVowZQy5WRusah":{
					"instances":[],
					"index":1,
					"id":"++HVowZQy5WRusah",
					"revSet":2,
					"dtstart":1292692200000,
					"dtend":1292695800000
				},
				"++HVowZQy5WRusai":{
					"instances":[],
					"index":2,
					"id":"++HVowZQy5WRusai",
					"revSet":4,
					"dtstart":1292695200000,
					"dtend":1292698800000
				}
			};
			expect(instance.eventCache).toEqual(expectedEvCache);
			ev.queryResults.pop();
			ev.queryResults.push(orig);
			instance.eventCache = {};
		});
		it('add a new event to cache', function() {
			var newEv = JSON.parse(JSON.stringify(ev.queryResults[0]));
			newEv._id = "ANEWEVENT";
			newEv.eventDisplayRevset = 4;
			ev.queryResults.push(newEv);

			instance.databaseChanged();

			var expectedEvCache =  {
				"++HVowZQy5WRusag": {
					"instances":[],
					"index":0,
					"id":"++HVowZQy5WRusag",
					"revSet":1,
					"dtstart":1292691600000,
					"dtend":1292695200000
				},
				"++HVowZQy5WRusah":{
					"instances":[],
					"index":1,
					"id":"++HVowZQy5WRusah",
					"revSet":2,
					"dtstart":1292692200000,
					"dtend":1292695800000
				},
				"++HVowZQy5WRusai":{
					"instances":[],
					"index":2,
					"id":"++HVowZQy5WRusai",
					"revSet":3,
					"dtstart":1292692800000,
					"dtend":1292696400000
				},
				"ANEWEVENT": {
					"instances":[],
					"index":3,
					"id":"ANEWEVENT",
					"revSet":4,
					"dtstart":1292691600000,
					"dtend":1292695200000
				},
			};
			expect(instance.eventCache).toEqual(expectedEvCache);
		});
	});

	describe('compareEventCache(): Test Suite', function() {
		var instance = new cm();
		var qr = instance.eventManager.queryResults;
		
		spyOn(instance, 'updateTimestampCache').andReturn(false);

		it('empty cache with empty results comparison', function() {
			instance.eventCache = {};
			var emptyQR = [];
			var results = instance.compareEventCache(emptyQR);
			var expected = {
				'updated': [],
				'deleted': []
			}
			expect(results).toEqual(expected);
		});

		it('populated cache with identical events (no change)', function() {
			//populate the cache with the default events now
			instance.databaseChanged();
			var results = instance.compareEventCache(qr);
			var expected = {
				updated: [],
				deleted: []
			}
			expect(results).toEqual(expected);
		});

		//the next 3 tests run in sequence, do not rearrange this code without taking
		//this into account.
		var eventToAdd = {	
			"_id"	: "NEWTESTEVENT",
			"_kind": "com.palm.calendarevent:1", 
			"accountId": "++HM6sJVRCK4_5D7", 
			"calendarId": "++HM6sN4VPZ3aGzr", 
			"dtend": 1292695200000, 
			"dtstart": 1292691600000, 
			"location": "", 
			"note": "", 
			"subject": "Additional Test Event", 
			"tzId": "America/Los_Angeles",
			"eventDisplayRevset": 9
		};

		it('populated cache with new event added', function() {
			//cache will have the default events in the cache when we start this.
			qr.push(eventToAdd);
			var results = instance.compareEventCache(qr);
			//we expect that the only update is to index 3 in the list
			var expected = {
				updated: [3],
				deleted: []
			};
			expect(results).toEqual(expected);
			//add to the database cache so we can remove eventToAdd in the next test
			instance.databaseChanged();
		});

		it('populated cache with event removed', function() {
			qr.pop();
			var results = instance.compareEventCache(qr);
			var expected = {
				updated: [],
				deleted: ['NEWTESTEVENT']
			};
			expect(results).toEqual(expected);
			//retain the event because we're going to modify it in the next test
		});

		it('populated cache with event modified', function() {
			qr.push(eventToAdd);
			eventToAdd.eventDisplayRevset = 10;

			var results = instance.compareEventCache(qr);
			var expected = {
				updated: [3],
				deleted: []
			};
			expect(results).toEqual(expected);
			//now remove the additional event and reset so that subsequent tests 
			//have a normal database cache to work with.
			instance.databaseChanged();
		});
		//end sequential tests
	});

	describe('updateTimestampCache(): Test Suite', function() {

		//function used to build the timestamp cache in its default state
		//after the first run of updateTimestampCache. Used in the empty cache tests
		//as calculateRange() will cause the timestampCache to look like this
		function generateBlankDays() {
			var start = (Date.today()).addDays(-46).getTime();
			var end = (Date.today()).addDays(46).addSeconds(-1).getTime();
			var outputMap = {};
			var timeMachine = new Date();
			for(timeMachine.setTime(start); +timeMachine < end; timeMachine.addDays(1)) {
				var ts = +timeMachine;
				outputMap[ts] = [];
			}
			return outputMap;
		}

		it('Empty update list with an empty eventCache should result in no changes.', function() {
			var instance = new cm();
			spyOn(instance, 'doAsyncTimestampUpdate').andReturn(false);

			instance.eventCache = {};
			instance.timestampCache = {};

			var ul = {
				updated: [],
				deleted: []
			};
			var expectedTSCache = generateBlankDays();
			instance.updateTimestampCache(ul);
			expect(instance.eventCache).toEqual({});
			expect(instance.timestampCache).toEqual(expectedTSCache);
		});
		it('Empty update list with a populated eventCache should result in no changes.', 
		function() {
			var instance = new cm();
			setupScaffoldTest1(instance);
			//at this point, there should now be a 92-day blank coverage with some
			//additional events inserted around 
			spyOn(instance, 'doAsyncTimestampUpdate').andReturn(false);
			var ul = {
				updated: [],
				deleted: []
			};
			var beforeTS = JSON.parse(JSON.stringify(instance.timestampCache)), 
				beforeE = JSON.parse(JSON.stringify(instance.eventCache));
			instance.updateTimestampCache(ul);
			expect(instance.timestampCache).toEqual(beforeTS);
			expect(instance.eventCache).toEqual(beforeE);
		})
		it('Update list with new events should have the new events added to list to invoke '+
		'getEventsInRange on.', function() {
			var instance = new cm();
			setupScaffoldTest2(instance);
			var spy = spyOn(instance, 'doAsyncTimestampUpdate').andReturn(false);
			var ev = instance.eventManager;
			ev.queryResults = EventManager.prototype.queryResults.slice(0); //re-insert the missing event

			var ul = {
				updated: ["++HVowZQy5WRusai"],
				deleted: []
			};
			instance.eventCache["++HVowZQy5WRusai"] = {
				instances: ["Canary in a coal-mine, I should be deleted"]
			}
			instance.updateTimestampCache(ul);
			expect(instance.eventCache["++HVowZQy5WRusai"].instances).toEqual([]);
			expect(instance.doAsyncTimestampUpdate).toHaveBeenCalled();

			var args = spy.mostRecentCall.args;
			expect(args[0]).toEqual(ul);
		});
		it('Update list with modified events should first drop any existing instances of the events'+
		' from the timestamp cache, then add those events to the list to invoke getEventsInRange on.',
		function() {
			var instance = new cm();
			setupScaffoldTest1(instance);
			var spy = spyOn(instance, 'doAsyncTimestampUpdate').andReturn(false);
			
			var ul = {
				updated: ["++HVowZQy5WRusai"],
				deleted: []
			};
			instance.updateTimestampCache(ul);

			expect(instance.timestampCache[1292659200000].length).toEqual(2); //the ++HVowZQy5WRusai event should be gone
			var idsInCache = instance.timestampCache[1292659200000].map(function(e) { return e[0];});
			expect(idsInCache).not.toContain('++HVowZQy5WRusai');

			expect(instance.doAsyncTimestampUpdate).toHaveBeenCalled();

			expect(spy.mostRecentCall.args[0]).toEqual(ul);
		});
		it('Update list with events deleted should remove instances of those events from the'+
		'timestampCache, then remove those events from the eventCache.', function() {
			var instance = new cm();
			setupScaffoldTest1(instance);
			var spy = spyOn(instance, 'doAsyncTimestampUpdate').andReturn(false);
			var ul = {
				updated: [],
				deleted: ["++HVowZQy5WRusai"]
			};
			instance.updateTimestampCache(ul);

			expect(instance.timestampCache[1292659200000].length).toEqual(2); //event should be removed from TS Cache
			expect(instance.eventCache["++HVowZQy5WRusai"]).toBeUndefined();

			expect(instance.doAsyncTimestampUpdate).toHaveBeenCalled();

			expect(spy.mostRecentCall.args[0]).toEqual(ul);
		});
	});

	describe('_getKeys(): Test Suite', function() {
		var testObj = {
			foo: "bar",
			"12345": "aNumber"
		};
		var instance = new cm();
		it("Should return all keys in a given object", function() {
			var ret = instance._getKeys(testObj);
			var expected = Object.keys(testObj);

			expect(ret).toEqual(expected);
		});
		it("Should apply an optional input function to all keys, if supplied", function() {
			function toNumber(e) {
				if(isNaN(+e))
					return e;
				return +e;
			}
			var expected = ['foo', 12345];
			var ret = instance._getKeys(testObj, toNumber);
			//sorting them because the order may be different between _getKeys and expected depending on how the browser
			//evaluates Array.map
			ret.sort();
			expected.sort();

			expect(ret).toEqual(expected);
		});
	});

	describe('doAsyncTimestampUpdate(): Test Suite', function() {

		//note: insertQuery is UNDEFINED most of the time. It's only used in one test
		var instance, emSpy, ptcSpy, timeRanges, insertQuery;
		function fakeGetEventsInRange(range, callback, eventSet, limit) {
			console.info("getEventsInRange called with ", range, callback, eventSet, limit);
			//insertQuery is a grotesque hack needed to insert a query while in the middle
			//of the worker running. It's used in the activeQueries test below.
			if(!!insertQuery) {
				instance.activeQueries.push(insertQuery);
				insertQuery = undefined;
			}
			callback({days: [{aFake: true}]});
		}
		beforeEach(function() {
			instance = new cm();
			setupScaffoldTest1(instance);
			instance.eventCache = JSON.parse(JSON.stringify(defaultExpectedECache));
			emSpy = spyOn(instance.eventManager, 'getEventsInRange').andCallFake(fakeGetEventsInRange);
			ptcSpy = spyOn(instance, 'populateTimestampCache').andReturn(false);
			timeRanges = [[1292659200000, 1293263999999]];
		});
		it("Should populate the updateList with all current events if none supplied", function() {
			instance.doAsyncTimestampUpdate(null, timeRanges);
			var expectedUpdateList = {
				updated: instance.eventManager.queryResults.slice(0),
				deleted: []
			};
			
			expect(emSpy).toHaveBeenCalled();
			var args = emSpy.mostRecentCall.args;
			expect(args[2]).toEqual(expectedUpdateList.updated);
			expect(ptcSpy).toHaveBeenCalled();
		});
		it("Should use shareEvents() as the finishFunction if no function is supplied", function() {
			var expectedUpdateList = {
				updated: ['++HVowZQy5WRusag', '++HVowZQy5WRusah', '++HVowZQy5WRusai'],
				deleted: []
			};
			var seSpy = spyOn(instance, 'shareEvents').andReturn(false);
		
			instance.doAsyncTimestampUpdate(expectedUpdateList, timeRanges);
			expect(emSpy).toHaveBeenCalled();
			expect(ptcSpy).toHaveBeenCalled();
			var args = ptcSpy.mostRecentCall.args;
			console.info(args);
			expect(typeof(args[1])).toEqual("function");
			args[1]();
			expect(seSpy).toHaveBeenCalled();
		});
		it("Should correctly getEventsInRange for a single range input (base case)", function() {
			instance.doAsyncTimestampUpdate(null, timeRanges);
			expect(emSpy).toHaveBeenCalled();
			expect(ptcSpy).toHaveBeenCalled();
			var args = ptcSpy.argsForCall;
			expect(args[0][0]).toEqual([{aFake: true}]);
		});
		it("Should correctly getEventsInRange for multiple range inputs (recursive case)", function() {
			timeRanges.push([+Date.today().clearTime(), +Date.today().addDays(1).clearTime() -1]);
			var originalRanges = timeRanges.slice(0);
			instance.doAsyncTimestampUpdate(null, timeRanges);
			expect(emSpy).toHaveBeenCalled();
			var calls = emSpy.argsForCall;
			expect(calls.length).toEqual(2);
			for(var i = calls.length -1; i >= 0; i--) {
				var args = calls[i];
				var inRange = args[0];
				var range = [inRange.start, inRange.end];
				expect(originalRanges).toContain(range);
			}
			expect(ptcSpy).toHaveBeenCalled();
		});
		it("Should setTimeout to start any waiting query when the current query is finished", 
		function() {
			var activeQueryWasCalled = false;
			function nextQuery() {
				activeQueryWasCalled = true;
			}
			//This setup is really hackish. What it does is hook an additional function in as insertQuery,
			//which is a test-unit scope parameter. If insertQuery is defined, when fakeGetEventsInRange
			//is called by doAsyncTimestampUpdate, it will add the given function to the instance's
			//activeQueries parameter. This simulates what happens when a query is inserted
			//while a long-running query is executing.

			//The reason such a hackish route was taken for inserting the query is that
			//in this testing scenario where fakes are being called constantly, there's no way
			//to insert a query into the instance while an asyncTimestampUpdate function is
			//presently completing a query. It cannot be inserted before the call to doAsyncTimestampUpdate
			//because if so, doAsyncTimestampUpdate will not start the query process, expecting
			//that the previous query will kick off the next one when it's complete.
			insertQuery = nextQuery;
			instance.doAsyncTimestampUpdate(null, timeRanges);
			expect(emSpy).toHaveBeenCalled();
			expect(ptcSpy).toHaveBeenCalled();
			waitsFor(function() {
				return activeQueryWasCalled;
			});
		});
		it("Should pass the finish function through to populateTimestampCache, if provided", function() {
			var finished = false;
			function finishFunction() {
				finished = true;
			}
			instance.doAsyncTimestampUpdate(null, timeRanges, finishFunction);
			expect(emSpy).toHaveBeenCalled();
			expect(ptcSpy).toHaveBeenCalled();
			expect(ptcSpy.mostRecentCall.args[1]).toEqual(finishFunction);
			ptcSpy.mostRecentCall.args[1]();
			waitsFor(function() {
				return finished;
			});
		});
	});
	describe("Cross-functional Test Suite", function() {
		it('Event Cache indices should be correct after deletions/updates', function() {
			var instance = new cm();
			setupScaffoldTest1(instance);

			spyOn(instance, 'updateTimestampCache').andReturn(false); //cut off the call through the update process at the timestamp cache

			instance.databaseChanged();
			expect(instance._getKeys(instance.eventCache).length).toEqual(3);

			//should have all 3 events in the cache at this point. let's delete the first one.
			instance.eventManager.queryResults.splice(0,1);
			instance.databaseChanged();
			for(var i=0; i < instance.eventManager.queryResults.length; i++) {
				var ev = instance.eventManager.queryResults[i];
				var target = instance.eventCache[ev._id];
				expect(target.id).toEqual(ev._id);
				expect(target.index).toEqual(i);
			}
		});
	});
	
});