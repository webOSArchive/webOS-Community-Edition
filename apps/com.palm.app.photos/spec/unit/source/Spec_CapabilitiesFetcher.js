describe('Test Capabilities Fetcher', function() {

	var testee;
	
	beforeEach(function() {
		testee = enyo.create({kind: "CapabilitiesFetcher"});
	});

	it("sanity test", function(){
		expect(42).toEqual(42);
  	});

	it("test call", function(){
		spyOn(testee.$.capabilitiesService, 'call');
		testee.fetchCapabilities("someid", function(){});
				
		expect(testee.$.capabilitiesService.call).toHaveBeenCalledWith();
  	});

	it("test call", function(){
		spyOn(testee.$.capabilitiesService, 'call');
		
		// preconditions
		expect(testee.pendingCallbacks.length).toEqual(0);
		expect(testee.fetchedCapabilities).toEqual({});
		
		// test code
		testee.fetchCapabilities("someid", function(){});		
		
		// postconditions
		expect(testee.pendingCallbacks.length).toEqual(1);
		expect(typeof testee.pendingCallbacks[0].callback).toEqual("function");
		expect(testee.$.capabilitiesService.call).toHaveBeenCalledWith();
  	});

	it("test multiple calls", function(){
		var spy = spyOn(testee.$.capabilitiesService, 'call');
		
		// first call
		testee.fetchCapabilities("someid", function(){});
		expect(testee.$.capabilitiesService.call).toHaveBeenCalledWith();
		expect(spy.callCount).toEqual(1);

		// second call
		testee.fetchCapabilities("someotherid", function(){});
		expect(spy.callCount).toEqual(1);

		expect(testee.pendingCallbacks.length).toEqual(2);		
		
  	});

	it("test callback", function(){
		var callbackHit = false;
		
		var spy = spyOn(testee.$.capabilitiesService, 'call').andCallFake(function(){
			var response = {
			   "returnValue": true,
			   "AccountsCapability": {
			       "com.palm.facebook": {
			           "getAlbums": true,
			           "getPhotos": true,
			           "getCaptions": true,
			           "addCaption": true,
			           "updateCaption": false,
			           "getComments": true,
			           "updateComments": true,
			           "photoUpload": true,
			           "videoDownload": false,
			           "getUserInfo": true,
			           "videoUpload": false,
			           "createAlbum": false,
			           "deleteAlbum": false,
			           "deletePhoto": false,
			           "computeNumFiles": false,
			           "serviceName": "com.palm.service.photos.facebook"
			       },
			       "com.palm.photobucket": {
			           "getAlbums": true,
			           "getPhotos": true,
			           "getCaptions": true,
			           "addCaption": true,
			           "updateCaption": false,
			           "getComments": false,
			           "updateComments": false,
			           "photoUpload": true,
			           "videoDownload": true,
			           "getUserInfo": false,
			           "videoUpload": false,
			           "createAlbum": false,
			           "deleteAlbum": false,
			           "deletePhoto": false,
			           "computeNumFiles": false,
			           "serviceName": "com.palm.service.photos.photobucket"
			       }
			   }
			};
			
			setTimeout(function(){
				testee._getCapabilitiesSuccess(testee, response, undefined);
			}, 10);
		});
		
		
		testee.fetchCapabilities("com.palm.facebook", function(){
			callbackHit = true;
		});
		
		waitsFor(function() {
	      return callbackHit;
	    }, "Callback not hit", 1000);
		
  	});

	it("test multiple callbacks", function(){
		var callback1Hit = false;
		var callback2Hit = false;
		
		var spy = spyOn(testee.$.capabilitiesService, 'call').andCallFake(function(){
			var response = {
			   "returnValue": true,
			   "AccountsCapability": {
			       "com.palm.facebook": {
			           "getAlbums": true,
			           "getPhotos": true,
			           "getCaptions": true,
			           "addCaption": true,
			           "updateCaption": false,
			           "getComments": true,
			           "updateComments": true,
			           "photoUpload": true,
			           "videoDownload": false,
			           "getUserInfo": true,
			           "videoUpload": false,
			           "createAlbum": false,
			           "deleteAlbum": false,
			           "deletePhoto": false,
			           "computeNumFiles": false,
			           "serviceName": "com.palm.service.photos.facebook"
			       },
			       "com.palm.photobucket": {
			           "getAlbums": true,
			           "getPhotos": true,
			           "getCaptions": true,
			           "addCaption": true,
			           "updateCaption": false,
			           "getComments": false,
			           "updateComments": false,
			           "photoUpload": true,
			           "videoDownload": true,
			           "getUserInfo": false,
			           "videoUpload": false,
			           "createAlbum": false,
			           "deleteAlbum": false,
			           "deletePhoto": false,
			           "computeNumFiles": false,
			           "serviceName": "com.palm.service.photos.photobucket"
			       }
			   }
			};
			
			setTimeout(function(){
				testee._getCapabilitiesSuccess(testee, response, undefined);
			}, 10);
		});
		
		
		testee.fetchCapabilities("com.palm.facebook", function(capability){
			callback1Hit = true;
			expect(capability.getComments).toEqual(true);
		});
		
		testee.fetchCapabilities("com.palm.photobucket", function(capability){
			callback2Hit = true;
			expect(capability.getComments).toEqual(false);
		});
		
		
		waitsFor(function() {
	      return callback1Hit;
	    }, "Callback1 not hit", 1000);
		
		waitsFor(function() {
	      return callback2Hit;
	    }, "Callback2 not hit", 1000)
	
		runs(function(){
			expect(testee.pendingCallbacks.length).toEqual(0);
		});	
		
  	});

	it("test service error", function(){
		var callback1Hit = false;
		var callback2Hit = false;
		
		var spy = spyOn(testee.$.capabilitiesService, 'call').andCallFake(function(){
			setTimeout(function(){
				testee._getCapabilitiesFailure();
			}, 10);
		});
		
		
		testee.fetchCapabilities("com.palm.facebook", function(capability){
			callback1Hit = true;
			expect(capability).toEqual({});
		});
		
		testee.fetchCapabilities("com.palm.photobucket", function(capability){
			callback2Hit = true;
			expect(capability).toEqual({});
		});
		
		
		waitsFor(function() {
	      return callback1Hit;
	    }, "Callback1 not hit", 1000);
		
		waitsFor(function() {
	      return callback2Hit;
	    }, "Callback2 not hit", 1000)
	
		runs(function(){
			expect(testee.pendingCallbacks.length).toEqual(0);
		});	
		
  	});


});
