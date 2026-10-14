(function () {
window.jasmineSlideshow = true;

var getMockData = function (filename) {
    return enyo.g11n.Utils.getJsonFile({ path: 'source/mock', locale: filename });
};

var MockedAlbumsDbService = function (cfg) {
    //this.mocked = cfg.mocked;
    this.playList = cfg.playList;
    this.onSuccess = "albumsDataResponseHandler";    //this.mocked.onSuccess;
    this.onFailure = "albumsDbRequestFailHandler";   //this.mocked.onFailure;
};
MockedAlbumsDbService.prototype = {
    setUseCase: function (caseName) {
        this.dataFilenamePrefix = caseName;
    },
    call: function (params) {
        var req = {};
        var thisInst = this;
        var playList = this.playList;
        setTimeout(function () {
            var resp = getMockData(thisInst.dataFilenamePrefix);
            playList[thisInst.onSuccess](thisInst, resp, req);
        }, 300);
        return req;
    }
};

var MockedPhotosDbService = function (cfg) {
    //this.mocked = cfg.mocked;
    this.playList = cfg.playList;
    this.onSuccess = "photosDataResponseHandler";    //this.mocked.onSuccess;
    this.onFailure = "photosDbRequestFailHandler";   //this.mocked.onFailure;
};
MockedPhotosDbService.prototype = {
    call: function (params) {
        var req = {};
        var albumId = params.query.where[0].val;
        var thisInst = this;
        var playList = this.playList;
        setTimeout(function () {
            var resp = getMockData(albumId);
            playList[thisInst.onSuccess](thisInst, resp, req);
        }, 300);
        return req;
    }
};

describe("SlideshowPlayList", function() {
    // create slideshowMode as the owner to the playList
    var slideshowMode = new SlideshowMode({ name: "slideshow", exhibitionMode: true });

    // the playList is the primary interest for this Suite
    var playList = slideshowMode.$.playList;

    // replace the albumsDbService with a mock object
    playList.$.albumsDbService = new MockedAlbumsDbService({
        mocked: playList.$.albumsDbService, playList: playList
    });

    // replace the photosDbService with a mock object
    playList.$.photosDbService = new MockedPhotosDbService({
        mocked: playList.$.photosDbService, playList: playList
    });
    
    var isNoAlbumUseCaseComplete = false;
    it("should handle no album", function() {
        playList.$.albumsDbService.setUseCase("noAlbum");
        var onReady = function () {
            var count = this.$.playList.getAlbumsCount();
console.log("no album: count="+count);
            expect(count).toEqual(0);
            isNoAlbumUseCaseComplete = true;
        };
        var callback = {
            scope: slideshowMode,
            method: onReady
        };
        
        playList.reset(callback);
    });

    var is10AlbumsUseCaseComplete = false;
    it("should handle 10 albums", function() {
        waitsFor(function() {
            return isNoAlbumUseCaseComplete;
        }, "No album use case", 1000);

        runs(function () {
            playList.$.albumsDbService.setUseCase("10_Albums");
            var onReady = function () {
                var count = this.$.playList.getAlbumsCount();
console.log("10 albums: count="+count);
                expect(count).toEqual(10);
                is10AlbumsUseCaseComplete = true;
            };
            var callback = {
                scope: slideshowMode,
                method: onReady
            };
        
            playList.reset(callback);
        });
    });


    var isDelAlbumsUseCaseComplete = false;
    it("should handle after albums deletion", function() {
        waitsFor(function() {
            return is10AlbumsUseCaseComplete;
        }, "10 albums use case", 1000);

        runs(function () {
            playList.$.albumsDbService.setUseCase("7_Albums");
            var onReady = function () {
                var count = this.$.playList.getAlbumsCount();
console.log("7 albums: count="+count);
                expect(count).toEqual(7);
                isDelAlbumsUseCaseComplete = true;
            };
            var callback = {
                scope: slideshowMode,
                method: onReady
            };
        
            playList.reset(callback);
        });
    });
});

})();
