/*
	USES NEW JAVASCRIPT-WEBOSPROFILER HOOKS
	webosEvent.start(<args>);    // To Start the Logging
	webosEvent.stop(<args>);    // To Stop the logging
	webosEvent.event(<args>);  // To log an event at a particular instant

	format for the arguments : You need to specify three arguments in the given order - token_name, event_name, value
	token_name -- This could be NULL or empty string for now
	event_name -- This is the label which will appear on the Profiler. Please make sure you have the same name both in start and stop.
	value -- This is all the additional information that you would like to see when you profile
*/
var wrapMethod = function(target, methodName, config) {
	var count = 0;
	var orig = target[methodName];
	config = config || {};

	var eventTag = ['photos'];
	if (target.kindName) { eventTag.push(target.kindName); }
	eventTag.push(methodName);
	eventTag = eventTag.join('.');
	
	var func = function() {
		// If the filter returns true, just execute the function as usual.
		if (config.filter && config.filter.apply(this, arguments)) { 
			return orig.apply(this, arguments); 
		}
	
		var c = count++;
		var logText;
	
		// Log the start of the function however you want.
		logText = null;
		try { logText = config.preLogger && config.preLogger.apply(this, arguments); }
		catch(err) { logText = '<<error in preLogger: ' + err + '>>'; }
		
		if (window.PalmSystem) { webosEvent.start('', eventTag, logText || ''); }
		else if (logText) { console.log('STARTED ' + methodName + '() ' + c + '   ' + logText); }
				
		// Time the execution of the wrapped function
		var startTime = Date.now();
		var result = orig.apply(this, arguments);
		var elapsed = Date.now() - startTime;
		
		// Log the start of the function however you want.
		var logText = null;
		try { logText = config.postLogger && config.postLogger.apply(this, [result].concat(Array.prototype.slice.call(arguments,0))); }
		catch(err) { logText = '<<error in postLogger: ' + err + '>>'; }
		if (window.PalmSystem) { webosEvent.stop('', eventTag, logText || ''); }
		else if (logText) { console.log('FINISHED ' + methodName + '() ' + c + ' in ' + elapsed + 'ms   ' + logText); }
		
		return result;
	}
	
	func.getCount = function() { return count; }
	target[methodName] = func;
	return func;
}

