// These test-cases also demonstrate the use of the Model/ModelViewer
// framework by integrating them into a simplified pair of classes:
// Album and AlbumView.

// Simplified Album object
enyo.kind({
	name: "Dummy_Album",
	kind: "Component",
	pictures: null,
	memory: 0,
	title: "",
	// Add mixins for two Models, one for UI events, and one for tracking memory-use.
	// A graphical view of the Album doesn't care about the amount of memory being 
	// used, but the MemoryManager (or whoever) might.  The point is that you can register
	// for distinct sets of events originating from a single object.
	components: [
// Instantiate these in create(), so that we can specify our own guid.
//		{ kind: "Model", name: "uiModel" },
//		{ kind: "Model", name: "memModel" }
	],
	create: function() {
		this.inherited(arguments);
		this.createComponents([
			// It's OK if this.guid is undefined.
			{ kind: "Model", name: "uiModel", guid: this.guid && (this.guid + "__uiModel") },
			{ kind: "Model", name: "memModel", guid: this.guid && (this.guid + "__memModel") }
		]);
		this.pictures = [];
	},
	// Not required, just syntactic-sugar.
	uiEvent: function(methodName, etc) {
		this.$.uiModel.viewersCall(arguments);
	},
	// Not required, just syntactic-sugar.
	memEvent: function(methodName, etc) {
		this.$.memModel.viewersCall(arguments);
	},
	// Add a picture to the album.
	addPicture: function(picture) {
		this.pictures.push(picture);
		
		// equivalently:  
		//   this.$.uiModel.viewersCall("pictureAdded", picture);
		//   this.$.memModel.viewersCall("memoryAllocated", 4 * picture.width * picture.height);
		this.uiEvent("pictureAdded", picture);
		var pictSize = 4 * picture.width * picture.height; // area * 4 bytes/pixel
		this.memEvent("memoryAllocated", pictSize);
	},
	// Set the album's title.
	setTitle: function(newTitle) {
		var oldTitle = this.title;
		this.title = newTitle;
		
		// equivalently:  this.$.uiModel.viewersCall("titleChanged", oldTitle, newTitle);
		this.uiEvent("titleChanged", newTitle, oldTitle);
	}
});

// Simplified AlbumView object that reacts to changes in its Album.
enyo.kind({
	name: "Dummy_AlbumView",
	kind: "Component",
	pictures: null,
	title: "",
	create: function() {
		this.inherited(arguments);
		this.pictures = [];
		
		// Since this is a simplified example, we don't bother
		// adding all of the existing pictures from the Album, nor
		// initially setting the title.
		
		// There is some coupling between Album and AlbumViewer here, since we
		// need to know the name of the model in the Album.  However, this also
		// a source of flexibility, since the Album can have multiple Models
		// (in this example, the "uiModel" and the "memModel"... see Dummy_MemManager)
		this.createComponent({ kind: "ModelViewer", model: this.album.$.uiModel });
	},
	// React when a picture is added to the Album.
	pictureAdded: function(picture) {
		this.pictures.push({ type: "thumbnail", picture: picture });
	},
	// React then the Album's title changes.
	titleChanged: function(newTitle) {
		this.title = newTitle;
	}
});

// Simplified MemManager object to demonstrate multiple sets of events from
// the same Album.  Also, demonstrates that we can receive events from multiple
// Albums.  The comments in Dummy_AlbumView all apply here.  
enyo.kind({
	name: "Dummy_MemManager",
	kind: "Component",
	totalMemoryUsed: 0,
	albums: null,
	create: function() {
		this.inherited(arguments);
		this.albums = [];
	},
	// Whenever an album is added, we want to track its memory use, too.
	addAlbum: function(album) {
		this.albums.push(album);
		this.createComponent({ kind: "ModelViewer", model: album.$.memModel });
	},
	// React when extra memory is used by any Album that we're watching.
	memoryAllocated: function(amount) {
		this.totalMemoryUsed += amount;
	}
});


describe('Model and ModelViewer (tests and tutorial)', function() {

	it('multiple viewers can register with the same model', function() {
		// Create the Album and a single viewer.
		var album = new Dummy_Album();
		var view1 = new Dummy_AlbumView({ album: album });
		
		// Add the first picture to the Album.
		album.addPicture({ width: 640, height: 480 });
		expect(album.pictures.length).toEqual(1); // sanity-check the Dummy_Album
		expect(view1.pictures.length).toEqual(1); // ensure that view observed the change
		
		// Add another AlbumView.
		var view2 = new Dummy_AlbumView({ album: album });
		expect(view2.pictures.length).toEqual(0); // no photos added since view-creation
		
		// Add the second picture to the Album
		album.addPicture({ width: 800, height: 600});
		expect(view1.pictures.length).toEqual(2); // 2 pictures added since this view was added
		expect(view2.pictures.length).toEqual(1); // 1 picture added since this view was added
		
		// Destroying the ModelViewer automatically unregisters it.
		view1.destroy();
		album.addPicture({ width: 320, height: 240});
		expect(view1.pictures.length).toEqual(2); // destroyed, so didn't notice most recent picture addition
		expect(view2.pictures.length).toEqual(2); // not destroyed, so did notice picture addition
		
		// Can also just destroy the ModelViewer component without
		// destroying its owner.
		view2.$.modelViewer.destroy();
		delete view2.$.modelViewer;
		album.addPicture({ width: 1600, height: 1200});
		expect(view2.pictures.length).toEqual(2); // no picture-add noticed.
		expect(view2.destroyed).toBeFalsy();      // owner not yet destroyed.
		
		// Clean-up.
		view2.destroy();
		album.destroy();
 	});

 	it('a single viewer can register with multiple models', function(){
 		var album1 = new Dummy_Album();
 		var album2 = new Dummy_Album();
 		var memMgr = new Dummy_MemManager();
 		
		// Albums not yet registered, so memMgr doesn't watch them.
		album1.addPicture({ width: 10, height: 10 });
		album2.addPicture({ width: 10, height: 10 });
		expect(memMgr.totalMemoryUsed).toEqual(0);
		
		// Add one Album, but not the other.
		memMgr.addAlbum(album1);
 		album1.addPicture({ width: 10, height: 10 });
		album2.addPicture({ width: 10, height: 10 });
		expect(memMgr.totalMemoryUsed).toEqual(400);
		
		// Add the other Album.
		memMgr.addAlbum(album2);
		album1.addPicture({ width: 10, height: 10 });
		album2.addPicture({ width: 10, height: 10 });
		expect(memMgr.totalMemoryUsed).toEqual(1200);
		
		// Destroy the memMgr... it stops listening.
		memMgr.destroy();
		album1.addPicture({ width: 10, height: 10 });
		album2.addPicture({ width: 10, height: 10 });
		expect(memMgr.totalMemoryUsed).toEqual(1200);
		// (verify that we can still add memory directly)
		memMgr.memoryAllocated(400);
		expect(memMgr.totalMemoryUsed).toEqual(1600);
 	});

	it('can instantiate models and viewers with arbitrary guids', function() {
		
		var album1 = new Dummy_Album({ guid: 'albumID-1' });
		var album2 = new Dummy_Album({ guid: 'albumID-2' });
		var memModel1 = album1.$.memModel;
		var memModel2 = album2.$.memModel;
		var uiModel1 = album1.$.uiModel;
		var uiModel2 = album2.$.uiModel;		
		
		expect(uiModel1.guid).toEqual('albumID-1__uiModel');
		expect(memModel2.guid).toEqual('albumID-2__memModel');

		var viewer = enyo.create({ kind: 'ModelViewer', guid: 'fooboozoo' });
		viewer.addModel(uiModel1);
		viewer.addModel(uiModel2);
		viewer.addModel(memModel2);
		expect(viewer.modelCount).toEqual(3);
		
		// Try to remove a model that wasn't added.
		viewer.removeModel(memModel1);
		expect(viewer.modelCount).toEqual(3);
		expect(uiModel1.viewerCount).toEqual(1);
		expect(uiModel2.viewerCount).toEqual(1);
		expect(memModel1.viewerCount).toEqual(0);
		expect(memModel2.viewerCount).toEqual(1);	
		
		// Try to remove a model that was added.
		viewer.removeModel(uiModel1);
		expect(viewer.modelCount).toEqual(2);	
		expect(uiModel1.viewerCount).toEqual(0);
		expect(uiModel2.viewerCount).toEqual(1);
		expect(memModel1.viewerCount).toEqual(0);
		expect(memModel2.viewerCount).toEqual(1);	
				
		// Try to remove the same model again.
		viewer.removeModel(uiModel1);
		expect(viewer.modelCount).toEqual(2);
		expect(uiModel1.viewerCount).toEqual(0);
		expect(uiModel2.viewerCount).toEqual(1);
		expect(memModel1.viewerCount).toEqual(0);
		expect(memModel2.viewerCount).toEqual(1);		
		
		// Try to remove the rest.
		viewer.removeAllModels();
		expect(viewer.modelCount).toEqual(0);
		expect(uiModel1.viewerCount).toEqual(0);
		expect(uiModel2.viewerCount).toEqual(0);
		expect(memModel1.viewerCount).toEqual(0);
		expect(memModel2.viewerCount).toEqual(0);	
	});
});
