// Test interaction between DbImageViewIndexFinder and DbImageView's DbPages.

enyo.kind({
	name: "DbImageViewIndexFinderTester",
	kind: "Component",
	finder: null,
	targetId: null, // for debugging the test
	components: [
		{ kind: "DbPages", onQuery: "_query", size: 5 },
		{ kind: "Buffer", overbuffer: 2, margin: 3, onAcquirePage: "_acquirePage", onDiscardPage: "_discardPage" }, 
	],
	testIndexSearch: function(pictureId) {
		if (this.finder) throw new Error("already looking for an index");

		this.targetId = pictureId;
		
		this.finder = this.createComponent({
			kind: "DbImageViewIndexFinder",
			name: "dbImageViewIndexFinder",
			pictureId: pictureId,
			albumId: "bogus-album-ID",
			onQuery: "_query",
			onIndexFound: "foundPictureIndex",
			onError: "failedToFindPictureIndex"
		});
	},
	
	foundPictureIndex: function(finder, index, dbEntry, handle, next) {
		console.log("found index " + index + " for entry " + dbEntry._id);

		this.finder.destroy();
		this.finder = null;

		this.imageIndex = index;

		// Figure out the range of pages to query for.  For the top page,
		// use the same query-response-handle used by the index-finder,
		// so that we don't have to traverse the DB from the beginning again.
		var topPage = this._rowToPage(100 * Math.floor(index/100)) - 2;

		//		var bottomPage = topPage;
		var bottomPage = this._rowToPage(index) + 2 ;

		// We don't use _adjustBufferBoundaries(), because that will
		// lead to querying all of the pages between the old and new
		// positions.  
		this._resetDbPages();
		// The top and bottom pages, as computed above, demarcate the page-range
		// that we actually need to initialize our carousel.  However, they don't 
		// include any lookahead-margin.  As described above, we're not using 
		// _adjustBufferBoundaries()/adjustTop()/adjustBottom(), so we add the
		// margin manually here.	
		this.$.buffer.top = topPage;
		this.$.buffer.bottom = bottomPage;

		// Poke the buffer, so that it tells the DbPages about the 
		// new pages of interest.
		this.$.buffer.refresh();

		// This one query will cause the rest of the region-of-interest
		// to be queried for... once the response comes into the DbPages,
		// any adjacent desired pages can be queried for, eg: via the 
		// next-page handle.
		this.$.dbPages.setHandle(topPage+2, handle* (100/5));
	},
		
	failedToFindPictureIndex: function(finder, origin, msg) {
		console.log("failed to find index of picture because: " + msg);
	},
	
	_query: function(inSender, inRequest) {
		// This is like the one that would result from enyo.DbService.call()
		var enyoRequest = {
			params: { query: inRequest},
			destroy: this._noop
		}
		
		var startIndex, endIndex, next, results = [];
		if (inRequest.desc) {
			startIndex = (inRequest.page || 0) * inRequest.limit - 1;
			endIndex = startIndex - inRequest.limit + 1;
			for (var i=startIndex; i >= endIndex; i--) {
				results.push({
					_id: "_"+i,
					foo: "foo "+i,
					value: i
				});
			}
			next = (endIndex / this.$.dbPages.size);
		}
		else {
			startIndex = (inRequest.page || 0) * inRequest.limit;
			endIndex = startIndex + inRequest.limit - 1;
			for (var i=startIndex; i <= endIndex; i++) {
				results.push({
					_id: "_"+i,
					foo: "foo "+i,
					value: i
				});
			}
			next = (startIndex / this.$.dbPages.size) + 1;
		}		
		
		var response = {
			returnValue: true,
			results: results,
			next: next,
			__timestamp: Date.now()
		};

		// Wait a moment, so that the assignment to this.finder in create() 
		// has a chance to finish.
		window.setTimeout(enyo.bind(this, this._queryResponse, inSender, response, enyoRequest), 1);
//		window.setTimeout(this._queryResponse.bind(this, inSender, response, enyoRequest), 0);
		
		return enyoRequest;
	},
	
	_queryResponse: function(inSender, inResponse, inRequest) {
		var now = Date.now();
		var elapsed = now - inResponse.__timestamp;
		
		// If we have a DbImageViewIndexFinder, then the response should go to it.
		if (this.finder) {
			var results = inResponse.results.map(function(v) { return v._id; });
//			console.log("LOOKING FOR NEXT 100: " + now + " elapsed: " + elapsed + "  RESULTS: " + results);
			this.finder.queryResponse(inResponse, inRequest);
		}
		else {
			var results = inResponse.results.map(function(v) { return v._id; });
//			console.log("TIME: " + now + " elapsed: " + elapsed + "  RESULTS: " + results);
			this.$.dbPages.queryResponse(inResponse, inRequest);
		}
	},
	
	_rowToPage: function(inRow) {
		return Math.floor(inRow / this.$.dbPages.size);
	},
	
	_resetDbPages: function() {
		console.log("starting reset of DbPages");
		var dbp = this.$.dbPages;
		var pos = dbp.min;
		var end = dbp.max;
		while (pos <= end) {
			dbp.dispose(pos);
			pos++;
		}
		dbp.min = 9999;
		dbp.max = 0;
		dbp.pages = [];
		dbp.handles = [];
		console.log("finished reset of DbPages");
	},
	
	_acquirePage: function(inSender, inPage) {
		this.$.dbPages.require(inPage);
	},

	_discardPage: function(inSender, inPage) {
		this.$.dbPages.dispose(inPage);
	},
	_noop: function() {
		// it's a no-op!
	}
		
});


describe("DbImageView", function() {
	var imv = null;
	beforeEach(function() {
		imv = enyo.create({kind: "DbImageViewIndexFinderTester"});
	});
	afterEach(function() {
		imv.destroy();
		imv = null;
	});

	it("should be able to find picture with a specified id", function() {
		oneIteration(17);
		oneIteration(34);
		oneIteration(51);
		
// XXXXX want to test a number of iterations, but something goes wrong.	
/*		
		for (var i = 17; i < 500; i+=17) {
			oneIteration(i);
			oneIteration(1000-i);
		}
*/
		waits(200);
 	});
	// Used above.  Otherwise, since runs() is async, the value of the 
	// loop-variable "i" would not be what we intended.
	var oneIteration = function(i) {
		runs(function() { 
//			console.log("TESTING FOR i: " + i);
			imv.testIndexSearch("_" + i); 
		});
		waits(200);
		runs(function() {
			var range;
			for (range = -5; range <= 5; range++) {
				var dbEntry = imv.$.dbPages.fetch(i+range);
//				console.log("LOOKING AT at: " + (i+range) + "  TIME: " + Date.now() );
				if (!dbEntry) {
//					debugger
				}
				expect(dbEntry).toBeTruthy();
				expect(dbEntry._id).toEqual("_" + (i+range));
			}
		});
	}

});
