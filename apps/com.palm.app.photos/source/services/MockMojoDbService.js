// Adds and overrides a few methods in MojoDbService so that we can 
// develop/test in a web-browser.

enyo.kind({
	name: "MockMojoDbService",
	kind: "MojoDbService",
	create: function() {
		this.inherited(arguments);
		
		// Allow mock data returned by DB calls to differ each time. 
		// This won't work without my changes to enyo/services/MockPalmService.js
		var that = this;
		this.$.albumDbService.mockDataProvider = function(req) { return that.nextMockRequestURL(req); };
		this.initMock();
	},
	initMock: function() {
		enyo.mock = enyo.mock || {};
		enyo.mock.photos = enyo.mock.photos || {
			albumsListUri: "mock/list-albums.json",
			albumUris: [
				"mock/list-photos.1.json",
				"mock/list-photos.2.json",
				"mock/list-photos.3.json",
				"mock/list-photos.4.json",
				"mock/list-photos.5.json",
 				"mock/list-photos.6.json",
 				"mock/list-photos.7.json",
 				"mock/list-photos.8.json"
			],
			// XXXXX Probably rename to differentiate from "albumIdToAlbumUri" (see below)
			albumIdToUri: {
				"++HLSdeoYRKhOpM_":    "mock/list-photos.1.json",
				"++HLSdeoFancy_":      "mock/list-photos.2.json",
				"++HLSdeoYiw_HNXu":    "mock/list-photos.3.json",
				"++HLSdeoYs_0p0Cf":    "mock/list-photos.4.json",
				"++HLSdeoYs_0p0Cf-FB": "mock/list-photos.5.json",
				"++HLSdeoYRKhOpM_-FB": "mock/list-photos.6.json",
				"++HLSdeoBurns_": "mock/list-photos.7.json",
				"++HLSdeoEmpty_": "mock/list-photos.8.json"
			},
			albumIdToAlbumUri: {
				"++HLSdeoYRKhOpM_":    "mock/list-albums.1.json",
				"++HLSdeoFancy_":      "mock/list-albums.2.json",
				"++HLSdeoYiw_HNXu":    "mock/list-albums.3.json",
				"++HLSdeoYs_0p0Cf":    "mock/list-albums.4.json",
				"++HLSdeoYs_0p0Cf-FB": "mock/list-albums.5.json",
				"++HLSdeoYRKhOpM_-FB": "mock/list-albums.6.json",				
				"++HLSdeoBurns_": "mock/list-albums.7.json",				
				"++HLSdeoEmpty_": "mock/list-albums.8.json"
			},
			albumIdToUriPhotosOnly: {
				"++HLSdeoYRKhOpM_":    "mock/list-photos.1.json",
				"++HLSdeoFancy_":      "mock/list-photos.2.photos-only.json",
				"++HLSdeoYiw_HNXu":    "mock/list-photos.3.json",
				"++HLSdeoYs_0p0Cf":    "mock/list-photos.4.json",
				"++HLSdeoYs_0p0Cf-FB": "mock/list-photos.5.json",
				"++HLSdeoYRKhOpM_-FB": "mock/list-photos.6.json",
				"++HLSdeoBurns_": "mock/list-photos.7.json",
				"++HLSdeoEmpty_": "mock/list-photos.8.json"				
			}
		};
	},
	nextMockRequestURL: function(req) {
	    if (req.owner === this.$.albumDbService) {
                return enyo.mock.photos.albumsListUri;
	    } else {
	        console.log("unknown service for mock request: " + req.owner.name);
	        throw new Error("unknown service for mock request: " + req.owner.name);
	    }
	},
	getExtractFsUrl: function(thumbnail){
		// When running in the web-browser, we don't have extractfs available, so
		// assume that thumbs are images with the same name, but in the .thumbs/
		// sub-directory.
		var p = thumbnail.path;
		var ind = p.lastIndexOf("\/");
		return p.slice(0,ind) + "\/.thumbs\/" + p.slice(ind+1);
	}
});
