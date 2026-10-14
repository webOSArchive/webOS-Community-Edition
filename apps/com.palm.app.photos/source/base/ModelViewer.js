// The kinds "Model" and "ModelViewer" work together to provide a model-view 
// mechanism that integrates cleanly with Enyo.  This can also be seen as an
// implementation of the Observer pattern.
//
// It is common in GUI apps to have an object (the "model") that is viewed and
// interacted-with in several ways in the application.  The objects that implement
// these display and interaction strategies are called "viewers".  By design, this
// pattern is not directly supported by Enyo, but my code would be much uglier
// without it, so I'm adding support that I hope is consistent with the Enyo Way.
//
// The "Model" and "ModelViewer" kinds are used as "mix-ins"... any Enyo Component
// can become a model/viewer by adding a Model/ModelViewer as a sub-component.
//
// See Test_ModelViewer.js for comprehensive usage examples. 

enyo.kind({
	name: "ObserverBase",
	kind: "Component",
	_links: null,
	_linkCount: 0,
	create: function() {
		this._links = {};
		this.inherited(arguments);
		
		// Use existing guid if provided, otherwise generate one.
		Object.defineProperty(this, "guid", {value: this.guid || this.guidMaker.next(), writable: false});
		Object.defineProperty(this, "logName", {value: [this.kindName, "[", this.guid, "]"].join("")});
	},
	destroy: function() {
		this.removeAllLinks();
		this.inherited(arguments);
	},
	// add a bidirectional link between the two ObserverBases.
	addLink: function(observerBase) {
		this._addLink(observerBase);
		observerBase._addLink(this);
	},
	// add link in one direction
	_addLink: function(observerBase) {
		if (this.destroyed) { throw new Error(this.logName + " already destroyed before add-link"); }
		if (this._links.hasOwnProperty(observerBase.guid)) {
			console.warn(observerBase.logName + " already registered with " + this.logName + " before add-link");
			return;
		}		
		this._linkCount++;
		this._links[observerBase.guid] = observerBase;
	},
	// remove bidirectional link between the two ObserverBases.
	removeLink: function(observerBase) {
		this._removeLink(observerBase);
		observerBase._removeLink(this);
	},
	// remove link in one direction
	_removeLink: function(observerBase) {
		if (this.destroyed) { throw new Error(this.logName + " already destroyed before remove-link"); }
		
		var o = this._links[observerBase.guid];
		if (!o) {
			console.warn(observerBase.logName + " not registered with " + this.logName + " before remove-link");
		}
		else if (o !== observerBase) {
			// This should not happen!!
			throw new Error("found different object with same guid: " + o.logName);
		}
		else {
			// Really unregister.
			this._linkCount--;
			delete this._links[observerBase.guid];
		}
	},
	removeAllLinks: function() {
		for (var guid in this._links) {
			this._links[guid]._removeLink(this);
		}
		this._linkCount = 0;
		this._links = {};
	}
});


enyo.kind({
	name: "ModelViewer",
	kind: "ObserverBase",
	guidMaker: new QuickGuidMaker("-ModelViewer"),  // shared by all instances
	create: function() {		
		// I couldn't figure out how to define this on the prototype... shouldn't "this"
		// refer to the object that you're trying to retrieve the property from?
		Object.defineProperty(this, "modelCount", {get: function() { 	return this._linkCount; }});
		Object.defineProperty(this, "models", {get: function() { return this._links; }});
		
		this.inherited(arguments);
		if (this.model) { 
			this.addModel(this.model); 
			delete this.model; // don't need it after initialization
		}
	},
	addModel: function(model) {
		this.addLink(model);
	},
	removeModel: function(model) {
		this.removeLink(model);
	},
	removeAllModels: function() {
		this.removeAllLinks();
	}
});


enyo.kind({
	name: "Model",
	kind: "ObserverBase",
	guidMaker: new QuickGuidMaker("-Model"), // shared by all
	create: function() {
		// I couldn't figure out how to define this on the prototype... shouldn't "this"
		// refer to the object that you're trying to retrieve the property from?
		Object.defineProperty(this, "viewerCount", {get: function() { return this._linkCount; }});
		Object.defineProperty(this, "viewers", {get: function() { return this._links; }});

		this.inherited(arguments);	
	},
	registerViewer: function(viewer) {
		this.addLink(viewer);
	},
	unregisterViewer: function(viewer) {
		this.removeLink(viewer);
	},
	// There are two ways to specify a method-invocation on the viewers,
	// viewersApply() and viewersCall().  It will probably be more common
	// to use the latter.
	viewersApply: function(methodName, args) {
		for (guid in this._links) {
			var target = this._links[guid].owner;
			var method = target[methodName];
			if (target && method) { method.apply(target, args); }
		}
	},	
	// See comment for viewersApply().  Assume the first argument is
	// the method-name; slice it off.
	viewersCall: function(argArray) {
		var methodName = argArray[0];
		var args = Array.prototype.slice.call(argArray, 1);
		this.viewersApply(methodName, args);
	}
});

