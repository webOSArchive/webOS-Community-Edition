// ServiceInterface defines a placeholder interface to Node
// services required by Photos.  It will eventually be fleshed
// out, and will probably use whatever enyo provides as a
// service-interface.

enyo.kind({
	name: "ServiceInterface",
	kind: enyo.Component,
	events: {
		onAlbumsCreated: "serviceCreatedAlbums",  // publishes only the new albums
		onAlbumsDeleted: "serviceDeletedAlbums",  // publishes only the deleted albums
		onAlbumsDbUpdate: "updateAlbumsDbData"    // publishes the DB response returned by the DB query
	},
	sendPoke: function() {
		this.useConcreteSubclass("sendPoke");
	},
	sendCreateAlbums: function(albumSpecs) {
		this.useConcreteSubclass("sendCreateAlbums");
	},
	sendDeleteAlbums: function(albumGuids) {
		this.useConcreteSubclass("sendDeleteAlbums");
	},
	receiveCreateAlbums: function(albumSpecs) {
		// Signal event to owning component.
		this.doAlbumsCreated(albumSpecs);
	},
	receiveDeleteAlbums: function(albumGuids) {
		// Signal event to owning component.
		this.doAlbumsDeleted(albumGuids);
	},
	useConcreteSubclass: function(methodName) {
		throw "ServiceInterface." + methodName + "(): must use concrete subclass.";
	},
	receiveAlbumsDbResponse: function(dbResponse) {
		this.doAlbumsDbUpdate(dbResponse);
	}
});
