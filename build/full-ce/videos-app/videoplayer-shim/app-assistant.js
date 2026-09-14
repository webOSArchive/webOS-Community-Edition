/* webOS CE: com.palm.app.videoplayer is the mimetype handler Browser, Email and
 * Messaging hand video files and URLs to. The stock Mojo player behind it is
 * retired; this shim forwards every launch to the standalone Videos app
 * (org.webosarchive.videos) with the same parameters, translated to its names.
 * The app id, appinfo and icon stay: Messaging and Device Info reference them.
 */

/*globals Mojo*/

function AppAssistant(appController, params) {
	this.appController = appController;
}

AppAssistant.prototype.handleLaunch = function(params) {
	params = params || {};
	var forward = {
		target: params.target || (params.video && params.video.path),
		videoTitle: params.videoTitle || params.title || (params.video && params.video.title),
		initialPos: params.initialPos || 0,
		thumbUrl: params.thumbUrl,
		launchedFrom: "com.palm.app.videoplayer"
	};
	Mojo.Log.info("videoplayer shim forwarding to org.webosarchive.videos: " + JSON.stringify(forward));
	new Mojo.Service.Request("palm://com.palm.applicationManager", {
		method: "launch",
		parameters: {id: "org.webosarchive.videos", params: forward}
	});
};

AppAssistant.prototype.cleanup = function() {};
