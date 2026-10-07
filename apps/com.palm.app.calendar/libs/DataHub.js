/**
NOTES:
-	DataHub provides [a]synchronous data sharing between objects without
	requiring either to have direct access to or knowledge of the other.
	Objects using DataHub to watch data need only know the property used
	to share that data then implement a setter for that property i.e.:

	All of DataHub's functionality can be added to any object by using its
	enhance method as follows:

		DataHub.enhance (myObject); ). 
		myObject.share ({ something: { data:This is fun!" }});


	WATCHING	:	DataHub.watch	({ something: myObject });

	SHARING		:	DataHub.share	({ something: { data: { some: dataToShare }}}, [optionalWatcherArray]);

	+	KEEPING	:	var objectToKeepSharing		= { something: { data: dataToKeepSharing, keep: true }};
					DataHub.share	(objectToKeepSharing);

					var arrayToKeepSharing	= { data: myDataArray, keep: true };
					DataHub.share	({ something: arrayToKeepSharing });

	+	FREEING	:	DataHub.free	({ something: 1 })
					DataHub.free	({ something: true })

	IGNORING	:	DataHub.ignore	({ something: myObject });

	CLEARING	:	DataHub.clearHub();

	All DataHub actions can be linked i.e.:
		DataHub.share ({things:{data:some}}).watch ({things:this}).ignore ({things:this}).clearHub()

TODOs:
	- Write test cases to exercise this module.
	- ...
**/
var DataHub = (function defineDataHub (global) {

	var DEBUG = !!this.DEBUG || !true;		// Inherit any globally defined DEBUG state.

	function clearWatches () {
		normalizeDataHubEnvironment();

		var	keys
		,	watcher
		,	watchers
		,	watches	= thisHub.watches
		;
		for (var property in watches) {
			if (watches.hasOwnProperty (property)) {
				if (!(watchers = watches [property])) continue;
				delete watchers.data;
				ids = Object.keys (watchers);
				for (var i=ids.length, id; i--; delete (watchers [id])) {
					id		= ids[i];
					watcher	= watchers [id];
					DEBUG && log.log ("\tCLEAR\t"+ (watcher.name || "dhId:"+watcher.dataHubId) +" <--- "+ property +"\t");
				}
				delete watches [property];
			}
		}
		return this;
	}

	function free (keepMap) {
		normalizeDataHubEnvironment();

		var	watchers
		,	watches	= thisHub.watches
		;
		for (var property in keepMap) {
			if (keepMap.hasOwnProperty (property)) {
				watchers = watches [property];
				if (watchers) {
					delete (watchers.data) && DEBUG && log.log ("\n\tFREE\t"+ property +"\n\t");
					delete watchers.keep;
				}
			}
		}
		return this;
	}

	function ignore (watchMap) {
		/*	Used to ignore data sharing (i.e. is24Hr).
		\	watchMap: {property:watcher} where watcher was previously added via DataHub.watch ({ property: watcher }). 
		*/
		normalizeDataHubEnvironment();

		if (!watchMap) {
			log.error ("\tDataHub: At least one property:watcher pair is required (i.e. { is24Hr: dayView }\t");
			return this;
		}
		if (!thisHub.watches) { return this; }		// If they're no watches there's nothing to ignore so quickly return.

		var	count
		,	ids
		,	watcher
		,	watchers
		,	watches	= thisHub.watches
		;
		for (var property in watchMap) {
			if (watchMap.hasOwnProperty (property)) {
				watcher		= watchMap [property];
				watchers	= watches  [property];

				if (!watcher || !watchers) { continue };	// If no property watchers exist go to the next property.

				if (DEBUG) {
					ids		= Object.keys (watchers);
					count	= ids.length + ("data" in watchers && -1) + ("keep" in watchers && -1) + ("wait" in watchers && -1);
				}
				if (watcher == watchers [watcher.dataHubId]) {
					DEBUG && log.log ("\n\tIGNORE\t"+ property +" FOUND "+ count + (count > 1 ? " watchers" : " watcher")+"\t");

					watcher.sharing && delete (watcher.sharing [property]);
					delete (watchers [watcher.dataHubId]) && DEBUG && --count;

					if (DEBUG) {
						log.log ("\tIGNORE\t"+ property +" DELETE "+ (watcher.name || "dhId:"+watcher.dataHubId) +"\t");

						for (var i=0, j=ids.length; i < j; ++i) {
							watcher = watchers [ids [i]];
							watcher
							?	(ids [i] = watcher.name || (watcher.dataHubId ? ("dhId:"+watcher.dataHubId) : ""))
							:	delete ids [i]
							;
						}
						log.log ("\tIGNORE\t"+ property +" KEPT  "+ count +" watchers"+ (count ? (" : "+ ids.join (" | ")) : "") +"\n\n");
					}
				}
			}//END:hasOwnProperty
		}
		return this;
	}//END:ignore(...)

	function share (shareMap, targetWatchers) {
		/*	Used to share data via known property names (i.e. is24Hr).
		\	shareMap		: {property:[data], ...} where data is received via watcher.setProperty (data).
		/	targetWatchers	: [watcher,...] An array of watchers with whom this data should be shared.
		*/
		normalizeDataHubEnvironment();

		if (!shareMap) {
			log.error ("\tDataHub: At least one property:data pair is required (i.e. { is24Hr: [true] })\t");
			return this;
		}

		var	data
		,	method
		,	sharer		= share.caller
		,	watchers
		,	watches		= thisHub.watches || (thisHub.watches = {})
		;

		sharer && (sharer = sharer.name || "unknown");
		isArray (targetWatchers) ? (watchers = targetWatchers) : (targetWatchers = null);

		for (var property in shareMap) {
			if (!shareMap.hasOwnProperty (property)) {
				continue;
			}

			!targetWatchers && !(watchers = watches [property]) && (watchers = watches [property] = {});

			data = shareMap [property];

			(data && data.keep || data.keep !== false && ("data" in watchers))	// Is there data and should it be kept?
			?	(watchers.data = data)											//	Yes, so add it to the watch map.
			:	delete (watchers.data)											//	No, but remove any previously kept data if keep:false was used.
			;

			method = "set"+ property.charAt(0).toUpperCase() + property.substring (1);		// Auto-camel-case for setters i.e. is24Hr -> setIs24Hr.

			for (var id in watchers) {
				watcher	= watchers [id];
				if (watcher && typeof watcher [method] === "function") {		// If the watcher still exists and can receive this data:
					shareData (property, method, watcher, data, sharer);		//	Share the data with it.
				}
			}
		}//END:for-in shareMap
		return this;
	}//END:share(...)

	function shareData (property, method, watcher, data, sharer) {
		var	value	= data && data.data											// Package the data for sharing and get its state.
		,	wait	= (typeof setTimeout == "undefined") || !!(data && data.wait)	// Check if the sharer wants to wait for all watchers to receive its data.
		,	keep	= data ? !!data.keep : false
		;
		function sharing () {
			if (!wait && watcher.sharing && !watcher.sharing [property]) {	// Cancel async sharing if the watcher is now ignoring this property.
				return;
			}
			watcher.sharing && delete (watcher.sharing [property]);
			DEBUG && log.log ("\tSHARE\t"+ sharer +"() ---> "+ property +" ---> "+ (watcher.name || "dhId:"+watcher.dataHubId) +"   "+ [(!wait ? "ASYNC":""), (keep ? "KEEP":"")].join("___") +"]\t");
			watcher [method] .apply (watcher, [value]);
		}
		if (wait) {
			sharing();										// Share change notifications synchronously.
		} else {
			!watcher.sharing && (watcher.sharing = {});		// Create a map of properties currently being shared.
			watcher.sharing [property] = true;
			setTimeout (sharing, 15.625);					// Share change notifications asynchronously.
		}
	}

	var nextId = 0;

	function watch (watchMap) {
		/*	Used to watch for change notifications via shared properties (i.e. is24Hr).
			watchMap: {property:watcher} 
		 */
		normalizeDataHubEnvironment();

		if (!watchMap) {
			log.error ("\tDataHub: At least one property:watcher pair is required (i.e. { is24Hr: dayView })\t");
			return this;
		}

		var	existing
		,	shareMap
		,	watcher
		,	watcherId
		,	watchers
		,	watches	= thisHub.watches || (thisHub.watches = {})
		;
		for (var property in watchMap) {
			if (watchMap.hasOwnProperty (property)) {
				watcher = watchMap [property];

				if (!watcher) {
					log.error ("\tDataHub: Invalid watcher specified: .watch ({"+property+":"+watcher+"});\t");
					continue;
				}

				if (!watcher.dataHubId) {									// This is a new watcher so:
					nextId == Number.MAX_VALUE ? (nextId = 1) : ++nextId;	//	Ensure that a valid id is available.
					watcher.dataHubId = nextId;								//	Then assign it to the watcher.
				}

				watchers = watches [property] || (watches [property] = {});
				existing = watchers [watcher.dataHubId];

				if (watcher == existing) { continue; }						// This watcher already exists so skip adding it.

				if (existing && watcher != existing) {						// Another watcher exists using this watcher's id so:
					watcher.dataHubId += String (Date.now());				//	Append a timestamp to this watcher's id to make it unique.
				}

				watchers [watcher.dataHubId] = watcher;

				DEBUG && log.log ("\tWATCH\t"+ (watcher.name || "dhId:"+watcher.dataHubId) +" <--- "+ property +"\t");

				if (watchers.data) {
					shareMap = {};
					shareMap [property] = watchers.data;
					share (shareMap, [watcher]);		// Immediately share changes with this specific watcher. 
				}
			}//END:hasOwnProperty
		}
		return this;
	}//END:watch(...)


	function enhance (object) {
		!object && (object = this);
		thisHub = object;
		normalizeDataHubEnvironment (object);

		for (var api in DataHub) {
			if (!DataHub.hasOwnProperty (api)) {
				continue;
			}
			!(api in object)
			?	(object [api]	=	DataHub [api])
			:	(object [api]	!=	DataHub [api])
				&&	log.warn ("!!!\tYour object couldn't be enhanced with DataHub."+api+" because it contains a similarly named property.")
				;
		}//END:for
	}//END: enhance

	var isArray, log, thisHub;

	function normalizeDataHubEnvironment (scope) {
		!scope && (scope = thisHub || this);
		if (scope.enhance == enhance) { return; }

		(scope.error && scope.log && scope.warn && (log = scope))									// If a logger exists within scope map it locally
		||	(global.console && console.error && console.log && console.warn && (log = console));	// otherwise locally map to console.

		var	a;
		isArray = Array.isArray
		||	(global.enyo
			?	enyo.isArray
			:	function isArray (item) {
					return (item instanceof Array) || !!(item && (a=item.constructor) && (a=a.prototype) && (a=a.unshift));
			});
	}//END:normalizeDataHubEnvironment

	return (
	{	clearHub	: clearWatches
	,	enhance		: enhance
	,	free		: free
	,	ignore		: ignore
	,	share		: share
	,	watch		: watch
	});

})(this);//END:(function defineDataHub(){
