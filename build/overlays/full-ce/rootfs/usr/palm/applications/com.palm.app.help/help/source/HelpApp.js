/**
 * Help application
 * 
 * The application is composed of a fixed width left panel that contains
 * the search input, the table of content (tips/clips/featured) and live
 * chat button. The right panel is a special stack container with swipe-able
 * panes. The video panel is stacked with the main view for an easier switch
 * to full-screen. The application menu reflects the table of content from 
 * the application.
 * 
 * Copyright 2011 HP, Inc.  All rights reserved.
 */
enyo.kind({
	name: "HelpApp",
	kind: "VFlexBox",
	chrome: [
		{kind: "Control", name: "client", className: "enyo-bg", layoutKind: "VFlexLayout", flex: 1},
		{kind: "AppMenu", name: "appMenu", components: [
			{caption: $L("Diagnostics..."), onclick: "diagnosticsClick"}
		]},
		{kind: "WebService", name: "getChatJson"},
		{kind: "help.UrlManager", name: "urlManager"},
		{kind: "help.ConnectionManager", name: "connectionManager", onConnectionChange: "onConnectionChange"},
		{kind: "help.CarePackManager", name: "carePackManager", onCarePackAvailable: "onCarePackAvailable", onCarePackInstalled: "onCarePackInstalled", onCarePackRemoved: "onCarePackRemoved"},
		{kind: "PalmService", service: "palm://com.palm.applicationManager/", name: "openResource", method: "open", onResponse: "onOpenResource"},
		{kind: "help.Preferences", name: "preferences", cookieName: "HelpAppPreferences"},
		{kind: "ApplicationEvents", onWindowActivated: "windowActivatedHandler", onWindowDeactivated: "windowDeactivatedHandler",
			onWindowParamsChange: "windowParamsChangeHandler", onResize: "resizeHandler"
		}
	],
	create: function() {
		this.currentSection = "none";
		this.inherited(arguments);
		// Disable keyboard window resize
		enyo.keyboard.setResizesWindow(false);
		// Set the URL device info
		this.$.urlManager.setModel(enyo.application.deviceModel);
		this.$.urlManager.setDeviceId(enyo.application.deviceId);
		this.$.urlManager.setCarrier(enyo.application.xPalmCarrier);
		this.$.urlManager.setLocale(enyo.application.locale);
		// Check debug info
		this.loadUrlOverride();
		this.online = enyo.application.online;
		// webOS CE: no check for HP's Care Pack app, so its page is never offered
		// Show the Live Chat button if in prefs and matching locale
		if (this.$.preferences.get("chat") === "yes" && this.$.preferences.get("locale") === enyo.application.locale) {
			this.setChatEnabled(false);
			this.$.chat.show();
		}
		// Show the main page
		this.goToMainView();
	},
	/**
	 * Show the care pack button!
	 */
	onCarePackAvailable: function () {
		this.log();
		this.$.featured.removeClass("enyo-last");
		this.$.carepack.show();
	},
	/**
	 * Care pack was just installed!
	 */
	onCarePackInstalled: function () {
		this.log();
		this.$.stack.sendInfo({"carepack": "installed"});
	},
	/**
	 * Care pack was removed :(
	 */
	onCarePackRemoved: function () {
		this.log();
		this.$.stack.sendInfo({"carepack": "removed"});
	},
	/**
	 * Check if we should change the Help URL (for testing only)
	 */
	loadUrlOverride: function () {
		try {
			var debugInfo = (window.palmGetResource && window.palmGetResource('/media/internal/hprvw.txt', true)) ||  '{}';
			if (debugInfo) {
				debugInfo = enyo.json.parse(debugInfo);
				if (debugInfo) {
					if (debugInfo.review_site) {
						this.$.urlManager.setHelpUrl(debugInfo.review_site);
					}
					if (debugInfo.channelId) {
						this.channelIdOverride = debugInfo.channelId;
					}
					this.debugInfo = !!debugInfo.copy_info_menu;
				}
			}
		} catch (e) {
			this.warn(e.message);
		}
	},
	/**
	 * Called when the Help Application is launched/re-launched
	 */
	windowParamsChangeHandler: function(inSender, event) {
		console.log("windowParamsChangeHandler: " + enyo.json.stringify(event.params));
		if (event.params.target) {
			this.switchSection("external", true);
			this.loadUrl(this, event.params.target);
			return true;
		}
		return false; // Important
	},
	
	/**
	 * Handle window minimized/deactivated
	 */
	windowDeactivatedHandler: function(inSender) {
		this.minimized = true;
		this.$.videoView.deactivate();
	},
	
	/**
	 * Handle window maximized/activated
	 */
	windowActivatedHandler: function(inSender) {
		this.minimized = false;
	},
	/**
	 * Handle resize window event
	 */
	resizeHandler: function() {
		this.inherited(arguments);
		this.$.videoView.resize();
		this.$.stack.resize();
	},
	/**
	 * Switch to the Main View
	 */
	goToMainView: function() {
		window.PalmSystem.enableFullScreenMode(false);
		this.$.outerPane.setTransitionKind("enyo.transitions.Simple");
		this.$.outerPane.selectView(this.$.mainView);
	},
	/**
	 * Switch to the Video View
	 */
	goToVideoView: function(inUrl, inTitle) {
		window.PalmSystem.enableFullScreenMode(true);
		this.$.outerPane.setTransitionKind("enyo.transitions.Simple"); 
		this.$.outerPane.selectView(this.$.videoView);
		// Delay playback because selectView is async
		enyo.asyncMethod(this.$.videoView, "startVideoPlayback", inUrl, inTitle);
	},
	/**
	 * Switch the current section
	 */
	switchSection: function(newSection, ignoreCurrent) {
		// Don't switch if we are already in the same section - search and external always switch
		if (newSection === this.currentSection && !ignoreCurrent) {
			return false;
		}
		// Pop all the views on the stack (doesn't generate an empty event)
		this.$.stack.popAllViews();
		// Remove previous highlight
		if (this.currentSection === "tips" || this.currentSection === "external") {
			this.$.tips.setHighlight(false);
		} else if (this.currentSection === "clips") {
			this.$.clips.setHighlight(false);
		} else if (this.currentSection === "featured") {
			this.$.featured.setHighlight(false);
		} else if (this.currentSection === "carepack") {
			this.$.carepack.setHighlight(false);
		}
		// Set the new section
		this.currentSection = newSection;
		// Highlight the new section
		if (this.currentSection === "tips" || this.currentSection === "external") {
			this.$.tips.setHighlight(true);
		} else if (this.currentSection === "clips") {
			this.$.clips.setHighlight(true);
		} else if (this.currentSection === "featured") {
			this.$.featured.setHighlight(true);
		} else if (this.currentSection === "carepack") {
			this.$.carepack.setHighlight(true);
		}
		return true;
	},
	/**
	 * Handle empty stack events
	 */
	stackEmpty: function() {
		this.switchSection("none");
	},
	/**
	 * Handle StackView close events 
	 */
	closeView: function(inSender, inPane) {
		this.$.stack.popView(inPane);
	},
	/**
	 * Handle Home button events
	 */
	goToHome: function() {
		if (this.currentSection === "search") {
			this.$.searchField.forceFocus();
		} else {
			this.$.stack.popAllViewsButOne();
		}
	},
	/**
	 * Strip URL
	 */
	stripUrl: function(url) {
		var urlStripped = url;
		if (urlStripped.indexOf( "#" ) !== -1) {
			urlStripped = urlStripped.split( /#/ );
			urlStripped = urlStripped[0];
		}
		if (urlStripped.indexOf( "?" ) !== -1) {
			urlStripped = urlStripped.split( /\?/ );
			urlStripped = urlStripped[0];
		}
		return urlStripped;
	},
	/**
	 * Load a URL in a new StackView or in the VideoView
	 */
	loadUrl: function(inSender, inUrl, inMime) {
		this.log("loadUrl: " + inUrl);
		if (!this.online || inUrl === "no-network") {
			this.loadView("help.NoNetworkView", inUrl);
		} else if (inUrl && inUrl.length > 0) {
			// Extract the host
			var hostMatch = inUrl.match( /^http[sS]?:\/\/([^\/:?]+)/ ),
				palmDomain = (hostMatch && hostMatch.length >= 2 && hostMatch[1].endsWith("webosarchive.org"));
		
			// Don't allow external URL launch to be outside the palm domain
			if (this.currentSection === "external" && !palmDomain) {
				this.log("External URL is not in palm.com domain");
				inUrl = "";
			} else {
				// Redirect pages with "index.html" to new "index.json" files
				inUrl = inUrl.replace( /index\.html/, 'index.json' );
				// Redirect pages from base URL to correct locale/carrier/device to avoid extra redirecting
				if (inUrl.match( /^http[sS]?:\/\/help\.palm\.com(:\d+)?\/\w+\/index.json/ )) {
					inUrl = inUrl.replace( /^http[sS]?:\/\/help\.palm\.com/, this.$.urlManager.getBaseUrl() );
				}
			}
			
			// Check for chat links (example: http://stage-help.palm.com/chat/chat.html?eID=607132582&category=Other&title=6%20Connect%20your%20phone%20to%20your%20computer%20and%20reinstall%20webOS%20software)
			if (inUrl.match( /^http[sS]?:\/\/.*help\.palm\.com(:\d+)?\/(.+\/)?chat\/.+\.html/ )) {
				var chatInfo = enyo.clone(this.defaultChatInfo),					
					queryInfo = inUrl.parseQueryString();
				
				// Convert query info
				if (queryInfo.eID) { 
					chatInfo.channelId = queryInfo.eID; 
				}
				if (queryInfo.category) {
					chatInfo.category = queryInfo.category;
				}
				if (queryInfo.title) {
					chatInfo.problem = queryInfo.title;
				}
				
				enyo.application.openChatApp({chatParams: chatInfo});
				return;
			}
			
			// Decide what to do with the URL
			var urlStripped = this.stripUrl(inUrl);
			if (urlStripped.lastIndexOf(".") === -1) {
				// No file extension
				this.$.openResource.call({target: inUrl, mime: inMime});
			} else if (urlStripped.toLowerCase().endsWith(".html")) {
				// ARTICLE file
				if (enyo.application.username && enyo.application.password) {
					var urlStart = "//" + enyo.application.username + ":" + enyo.application.password + "@";
                    inUrl = inUrl.replace( /\/\//, urlStart );
				}
				this.loadView("help.ArticleView", inUrl, $L("Home"));
			} else if (urlStripped.toLowerCase().endsWith(".json")) {
				// JSON file
				this.loadView("help.JsonView", inUrl, $L("Home"));
			} else if (urlStripped.toLowerCase().endsWith( ".mp4")) {
				// VIDEO file
				this.loadVideo(inUrl, inMime);
			} else {
				// Can the system handle it?
				this.$.openResource.call({target: inUrl, mime: inMime});
			}
		}
	},
	/**
	 * Handle Open Resource result
	 */
	onOpenResource: function(inSender, inResponse, inRequest) {
		if (inResponse.returnValue) {
			this.log("Open resource successful");
		} else {
			this.log("Open resource failure");
		}
	},
	/**
	 * Load a StackView (kind could be ArticleView or JsonView)
	 */
	loadView: function(inKind, inUrl, inHomeLabel) {
		this.log("loadView kind: " + inKind + " url: "+ inUrl + " home: " + inHomeLabel);
		var view = this.$.stack.createComponent({
			kind: inKind, flex: 1, fileUrl: inUrl, homeLabel: inHomeLabel,
			onHome: "goToHome", onClose: "closeView", onLoadUrl: "loadUrl"
		}, { owner: this });
		// Push immediate if launched by an external app (TBD)
		this.$.stack.pushView(view, this.currentSection === "external");
	},
	/**
	 * Load a URL in the VideoView
	 */
	loadVideo: function(inUrl, inTitle) {
		this.log("LoadVideo " + inUrl);
		this.goToVideoView(inUrl, inTitle);
	},
	/**
	 * Handle "Enter" key on the search text field
	 */
	searchFieldKeydown: function(inSender, inEvent) {
		if (inEvent.keyCode === 13) {
			inEvent.preventDefault();
			this.searchClick();
		}
	},
	/**
	 * Handle search click events
	 */
	searchClick: function (inSender, inEvent) {
		var searchTerms = this.$.searchField.getValue().trim();
		this.$.searchField.forceBlur();
		if (searchTerms.length > 0) {
			if (this.funWithSearchBox(searchTerms)) {
				return true;
			}
			
			this.switchSection("search", true);
			if (this.online) {
				this.loadView("help.ArticleView", this.$.urlManager.getSearchUrl(this.$.searchField.getValue()), $L("Start Over"));
			} else {
				this.loadView("help.NoNetworkView");
			}
			return true;
		}
	},
	/**
	 * Help for internal usage (testing)
	 */
	funWithSearchBox: function (searchTerms) {
		if (searchTerms === "gimmechat") {
			if (this.channelIdOverride) {
				// Set temp chat info
				this.onGetDefaultChatInfo(null, {
					"enabled": true,
					"device": "TouchPad",
					"carrier": "AT&T",
					"region": "NA",
					"language": "en",
					"channelId": this.channelIdOverride,
					"problem": "Unknown",
					"category": "Other",
					"terms": "http://www.palm.com/xtra_domains/mobile/mchat/terms/ver1/en.html"
				}, { xhr: { status: 200 } });
			}
			return true;
		} else if (searchTerms === "gimmewizzz") {
			this.$.emptyView.wizzz();
			return true;
		} else if (searchTerms === "gimmeua") {
			this.loadView("help.ArticleView", "http://help.webosarchive.org/HelpSiteViewer/device.do");
			return true;
		} else if (searchTerms === "gimmeua2") {
			this.loadView("help.ArticleView", "https://myproxylists.com/my-http-headers");
			return true;
		}
		return false;
	},
	/**
	 * Handle Tips
	 */
	tipsClick: function (inSender, inEvent) {
		if (this.switchSection("tips")) {
			this.loadUrl(this, this.$.urlManager.getTipsUrl());
			return true;
		}
	},
	/**
	 * Handle Clips
	 */
	clipsClick: function () {
		if (this.switchSection("clips")) {
			this.loadUrl(this, this.$.urlManager.getClipsUrl());
			return true;
		}
	},
	/**
	 * Handle Featured articles
	 */
	featuredClick: function () {
		if (this.switchSection("featured")) {
			this.loadUrl(this, this.$.urlManager.getFeaturedUrl());
			return true;
		}
	},
	/**
	 * Handle Diagnostics application
	 */
	diagnosticsClick: function () {
		this.$.openResource.call({id: "com.palm.app.crotest"});
	},
	/**
	 * Handle CarePack
	 */
	carepackClick: function () {
		if (this.switchSection("carepack")) {
			this.loadView("help.CarePackView", this.$.carePackManager.isCarePackInstalled());
			return true;
		}
	},
	/**
	 * Handle Chat Launch
	 * We query the top pane for extra info that will override the default
	 * chat parameters (eg channelId, problem, ...)
	 */
	chatClick: function () {
		var chatInfo = enyo.clone(this.defaultChatInfo),
			viewInfo = this.$.stack.getChatInfo();
		
		if (viewInfo.extraInfo && viewInfo.extraInfo.jsonApplication) {
			viewInfo.extraInfo.jsonUrl = this.$.urlManager.getChatInfoUrl(viewInfo.extraInfo.jsonApplication); 
		}
		
		chatInfo.debugInfo = this.debugInfo;
		chatInfo = enyo.mixin(chatInfo, viewInfo);
		enyo.application.openChatApp({chatParams: chatInfo});
	},
	/**
	 * Handle Network Connection changes
	 */
	onConnectionChange: function(sender, online) {
		this.log(online);
		this.online = online;
		if (this.defaultChatInfo) {
			this.setChatEnabled(online);
		} else if (online) {
			this.getDefaultChatInfo();
		}
	},	
	/**
	 * Retrieve the default chat info
	 */
	getDefaultChatInfo: function() {
		if (this.online && !this.defaultChatInfo) {
			this.log("Getting chat.do: " + this.$.urlManager.getChatInfoUrl());
			var customRequestHeaders = {
				"X-Palm-Carrier": enyo.application.xPalmCarrier,
				"X-Palm-Locale": enyo.application.locale,
				"X-Palm-Device": enyo.application.deviceId,
				"X-Palm-Device-Model": enyo.application.deviceModel,
				"X-Palm-Carrier-Name": enyo.application.deviceInfo.carrierName,
				"X-Palm-Device-Name": window.escape(enyo.application.deviceInfo.modelName)
			};
			
			this.$.getChatJson.setUsername(enyo.application.username);
			this.$.getChatJson.setPassword(enyo.application.password);		
			this.$.getChatJson.setHeaders(customRequestHeaders);
			this.$.getChatJson.setUrl(this.$.urlManager.getChatInfoUrl());
			this.$.getChatJson.call({}, { onResponse: "onGetDefaultChatInfo" });
		}
	},
	/**
	 * Handle default chat info
	 */
	onGetDefaultChatInfo: function(inSender, inResponse, inRequest) {
		this.log(inResponse);
		if (typeof inResponse === "object" && inRequest.xhr.status === 200) {
			this.log(enyo.json.stringify(inResponse));
			this.defaultChatInfo = inResponse;
			if (this.defaultChatInfo.enabled) {
				this.$.preferences.set({"chat": "yes", "locale": enyo.application.locale});
				this.setChatEnabled(this.online);
				this.$.chat.show();
			}
			// Set the hours of operation URL
			this.defaultChatInfo.hoursOfOperationUrl = this.$.urlManager.getChatHoursUrl();
		}
	},
	/**
	 * Enable/Disable chat button
	 */
	setChatEnabled: function(enabled) {
		this.$.chat.setDisabled(!enabled);
		this.$.chat.addRemoveClass("enyo-button-blue", enabled);
	}
});
