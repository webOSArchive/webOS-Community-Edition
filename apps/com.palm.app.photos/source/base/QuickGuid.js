// Hacky GUID generation.

function QuickGuid(guidString) {
	Object.defineProperty(this, "guid", {value: guidString, writable: false});
}
// For comparison and printing.
QuickGuid.prototype.valueOf = function() { return this.guid; }
QuickGuid.prototype.toString = function() { return this.guid; }

function QuickGuidMaker(suffix) { 
	var cur = (new Date).getTime(); 
	this.next = function(prefix) { 
		return new QuickGuid((prefix || "") + (++cur) + suffix); 
	};
}

