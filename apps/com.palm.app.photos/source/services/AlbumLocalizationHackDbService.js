// I'm a DBService that localizes the names of some special albums.

enyo.kind({
	name: "AlbumLocalizationHackDbService",
	kind: "DbService",
	method: "find",
	dbKind: "com.palm.media.image.album:1", 
	subscribe: true, 
	reCallWatches: true,
	mockDataProvider: function(req) { return "mock/list-albums.json"; },
	responseSuccess: function(inRequest) {
		// Modify displayed names of well-known directories.
		inRequest.response.results.forEach(function(dbEntry) {
			//console.log("|||||||||||||||| the dbEntry is " + JSON.stringify(dbEntry));
			switch(dbEntry.path.toLowerCase()) {
				case "/media/internal/downloads":
					dbEntry.name = $L("Downloads");
					break;
				case "/media/internal/messaging":
					dbEntry.name = $L("Messaging");
					break;
				case "/media/internal/screencaptures":
					dbEntry.name = $L("Screen captures");
					break;					
				case "/media/internal/wallpapers":
					dbEntry.name = $L("Wallpapers");
					break;
				default: 
//					dbEntry.name = "MODIFIED " + dbEntry.name;
			}

			switch (dbEntry.name) {
				case "Miscellaneous":
					dbEntry.name = $L("Miscellaneous");
					break;
				case "Photo roll":
					dbEntry.name = $L("Photo roll");
					break;
				case "Photos":
					dbEntry.name = $L("Photos");
					break;
				case "Downloads":
					dbEntry.name = $L("Downloads");
					break;
				case "Messaging":
					dbEntry.name = $L("Messaging");
					break;
				case "Screen captures":
					dbEntry.name = $L("Screen captures");
					break;					
				case "Wallpapers":
					dbEntry.name = $L("Wallpapers");
					break;
				case "Profile Pictures":
					dbEntry.name = $L("Profile Pictures");
					break;
				default:
			}
			
			// DFISH-20847: Guard against unexplained case where one HP salesguy's
			// Snapfish account had a couple of albums without "total".
			if (!dbEntry.total) {
				dbEntry.total = {images: 0, photos: 0};
			}
		});
		this.inherited(arguments);
	}
});

