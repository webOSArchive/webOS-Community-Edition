// More concise versions of enyo G11N facilities.  Shorter to create, shorter to use.

var G11N = {
	template: function(templateString) {
		var t = new enyo.g11n.Template(templateString);
		var argNames = Array.prototype.slice.call(arguments, 1);
		return function() { 
			var argObj = {};
			for (var i=0; i < argNames.length; i++) {
				argObj[argNames[i]] = arguments[i];
			}
			return t.evaluate(argObj); 
		}
	}
}