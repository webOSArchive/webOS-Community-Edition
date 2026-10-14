// LunaServiceInterface talks to com.palm.photos.service 

enyo.kind({
	name: "PhotosService",
	kind: "Component",
	components: [
		{name: "PhotosHelloService", kind: "PalmService", service: "palm://com.palm.service.photos/", method: "hello", subscribe: true, onSuccess: "helloResponse",onFailure:"genericFailure"},
// XXXXX: temporarily support the old method-name until the service supports both... then migrate.
//		{name: "facebookSyncAlbums", kind: "PalmService", service: "palm://com.palm.service.photos/", method: "facebookSyncAlbums", subscribe: true, onSuccess: "facebookAlbumSyncResponse",onFailure:"genericFailure"},
		{name: "facebookSyncAlbums", kind: "PalmService", service: "palm://com.palm.service.photos/", method: "facebookSyncAlbums", subscribe: true, onSuccess: "facebookSyncAlbumsResponse",onFailure:"genericFailure"},
		{name: "facebookClearCache", kind: "PalmService", service: "palm://com.palm.service.photos/", method: "facebookClearCache", subscribe: false, onSuccess: "facebookClearCacheResponse",onFailure:"genericFailure"},
		{name: "generateThumbnails", kind: "PalmService", service: "palm://com.palm.service.photos/", method: "generateThumbnails", subscribe: false, onSuccess: "generateThumbnailsResponse",onFailure:"genericFailure"}
	],
	          
	create: function() {
		console.info("********** Creating PhotosService interface");
		this.inherited(arguments);
	},
	facebookSyncAlbums: function(){
		console.info("\n\n\n\n\n\n ************PhotosService: requesting Facebook album sync");
		
		// We need to compute the desired thumbnail dimensions to match the size
		// that they will be displayed on-screen.
		var height, width, req;
		var params = [];
		
		height = NonCssParams.AlbumStripThumb_height;
		width = Math.ceil(height * 4 / 3);
		params.push({
			thumbType: 'appStripThumbnail',
			width: width,
			height: height
		});
		
		height = NonCssParams.AlbumGridThumb_height;
		width = Math.ceil(height * 4 / 3);
		params.push({
			thumbType: 'appGridThumbnail',
			width: width,
			height: height
		});
		
		this.$.facebookSyncAlbums.call(params);
	},
	facebookClearCache: function() {
		this.$.facebookClearCache.call();
	},
	helloResponse: function(inSender, inResponse) {
		//@todo remove this 
		console.log("******************PhotosService response: hello "+JSON.stringify(inResponse));
	},
	facebookSyncAlbumsResponse: function(inSender, inResponse) {
		console.log("******************PhotosService response: Facebook album sync: "+JSON.stringify(inResponse));
	},
	facebookClearCacheResponse: function(inSender, inResponse) {
		console.log("******************PhotosService response: Facebook clear cache: "+JSON.stringify(inResponse));
	},
	facebookClearCache: function() {
		this.$.facebookClearCache.call();
	},
	generateThumbnails: function() {
		// Generate all necessary thumbnails in one go.
		req = this.$.generateThumbnails.call({});
		console.log("REQUESTED THUMBNAIL GENERATION: " + req);
	},
	genericFailure: function(inSender, inResponse) {
		console.log("******************PhotosService: failed request " + JSON.stringify(inResponse));
	},
	generateThumbnailsResponse:function(inSender,inResponse){
		console.log("******************PhotosService response: GenerateThumbnail: "+JSON.stringify(inResponse));
	}
	
});

		



