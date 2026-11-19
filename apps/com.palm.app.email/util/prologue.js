// Stuff that needs to be loaded before everything else

(function() {
	if (window._prologueLoaded) { return; }

	// If there's a getMailAppRoot() function, we need to load resources from an alternate location
	if (!window.rb && window.getMailAppRoot) {
		var appPath = window.getMailAppRoot();
		
		window.rb = new enyo.g11n.Resources({root: appPath});
		window.$L = function(s) { return (rb.$L)(s); }
	}
	
	window._prologueLoaded = true;
})();
