
enyo.kind({
    name: "ScreenNailFactory",
    kind: enyo.Component,
    events: {
        onScreenNailUpdate: ""
    },
    components: [
        { name: "screenNailGenerator", kind: "PalmService", method: "facebookGenerateImgForBigView",
            service: "palm://com.palm.service.photos/", 
            onSuccess: "screenNailGenServiceResponseHandler",
            onFailure: "screenNailGenServiceFailHandler"
        },
        { name: "photoDbService", kind: "DbService", method: "find",
              dbKind: "com.palm.media.image.file:1",  // "com.palm.media.video.file:1",".media.image.album:1"
              onSuccess: "photoRegetResponseHandler",
              onFailure: "photoRegetFailHandler"
        }
    ],
    defaultMaxAttempts: 3,
    defaultPullTimeout: 800,

    create: function () {
        this.inherited(arguments);
        this.watchQueue = {};
        this.watchCount = 0;
    },

    reset: function () {
        this.removeAllPhotoRegetWatches();
    },

    requestToGenerateScreenNail: function (dbEntry) {
        if (this.isPhotoWatched(dbEntry._id)) {
//console.log("****@@@@@@><@@@@@@**** vidslide  ScreenNailFactory.requestToGenerateScreenNail("+dbEntry._id+"), but it has already been requested...");
            return;
        }

        var meta = { albumId: dbEntry.albumId, pictId: dbEntry._id };
        var req = this.$.screenNailGenerator.call(dbEntry);
        req.meta = meta;
    },

    screenNailGenServiceResponseHandler: function(palmService, resp, req) {
//console.log("****@@@@@@><@@@@@@**** vidslide  ScreenNailFactory.screenNailGenServiceResponseHandler(): req="+(req.meta.albumId+"/"+req.meta.pictId)+", resp="+enyo.json.stringify(resp));
        // the req is only queued by now...
        if (!req.meta) { return; }
        this.watchForScreenNailGen(req.meta);
    },

    screenNailGenServiceFailHandler: function(palmService, resp, req) {
//console.log("****@@@@@@><@@@@@@**** vidslide  ScreenNailFactory.screenNailGenServiceFailHandler(): Error="+enyo.json.stringify(resp));
        console.log("photos.ScreenNailFactory: failed to generate screennail.  Error: "+enyo.json.stringify(resp));
        if (!req.meta) { return; }
        this.removePhotoUpdateWatch(req.meta.pictId);
    },

    /**
     * @param watchItem It is an object { albumId, pictId }
     */
    watchForScreenNailGen: function (watchItem) {
        if (!watchItem) { return; }
        if (this.watchQueue[watchItem.pictId]) { return; }  // is already watched

        var thisInst = this;
        var watchId = watchItem.pictId;
        this.watchQueue[watchId] = {
            albumId: watchItem.albumId,
            pictId:  watchId,
            attemptCount: 0,
            pendingWatchId: undefined
        };
        this.watchCount++;
        this.schedulePhotoUpdateWatch(watchId);
    },

    isPhotoWatched: function (pictId) {
        return this.watchQueue[pictId] ? true : false;
    },

    removeAllPhotoRegetWatches: function () {
        var watchIds = [], watchId, i;
        for (watchId in this.watchQueue) if (this.watchQueue.hasOwnProperty(watchId)) {
            watchIds.push(watchId);
        }
        var len = watchIds.length;
        for (i = 0; i < len; i++) {
            this.removePhotoUpdateWatch(watchIds[i]);
        }
    },

    requestDbPhotoUpdate: function (watchId) {
        var watchMeta = this.watchQueue[watchId];
        if (!watchMeta) { return; }

//console.log("****@@@@@@><@@@@@@**** vidslide  ScreenNailFactory.requestDbPhotoUpdate(watchId="+watchId+")...");
        var qryParams = { query: { where: [ { prop: "_id", op: "=", val: watchMeta.pictId } ] } };
        var req = this.$.photoDbService.call(qryParams);
        req.meta = { watchId: watchId };
    },

    photoRegetResponseHandler: function (photoService, resp, req) {
        var reqMeta = req ? req.meta : null;
        if (reqMeta) { this.incrementPhotoRegetAttempt(reqMeta.watchId); }
        if (!resp || !resp.results || resp.results.length == 0) {
            if (reqMeta) { this.schedulePhotoUpdateWatch(reqMeta.watchId); }
            return;
        }

        var result = resp.results[0];
        var albumId = result.albumId;
        var pictId = result._id;
        var watchId = pictId;
        if (!result.appScreenNail || !result.appScreenNail.path) {
            this.schedulePhotoUpdateWatch(watchId);
        } else {
//console.log("****@@@@@@><@@@@@@**** vidslide  ScreenNailFactory.photoRegetResponseHandler(): got new update...");
            this.removePhotoUpdateWatch(watchId);
            this.doScreenNailUpdate(result);    // notify the observer
        }
    },

    photoRegetFailHandler: function (photoService, resp, req) {
        console.log("photos.ScreenNailFactory: failed to get DB photo.  Error: "+enyo.json.stringify(resp));
        if (!req.meta) { return; }
        this.removePhotoUpdateWatch(req.meta.watchId);
    },

    schedulePhotoUpdateWatch: function (watchId) {
        var watchMeta = this.watchQueue[watchId];
        if (!watchMeta) { return; }

        if (watchMeta.attemptCount > this.defaultMaxAttempts) {
            this.removePhotoUpdateWatch(watchId);
            return;
        }

        var thisInst = this;
        watchMeta.pendingWatchId = setTimeout(function () {
            thisInst.requestDbPhotoUpdate(watchId);
        }, this.defaultPullTimeout);
    },

    incrementPhotoRegetAttempt: function (watchId) {
        var watchMeta = this.watchQueue[watchId];
        if (!watchMeta) { return; }
        watchMeta.attemptCount++;
    },

    cancelPhotoUpdateWatch: function (watchId) {
        var watchMeta = this.watchQueue[watchId];
        if (!watchMeta) { return; }
        if (watchMeta.pendingWatchId) {
            clearTimeout(watchMeta.pendingWatchId);
            delete watchMeta.pendingWatchId;
        }
    },

    removePhotoUpdateWatch: function (watchId) {
        if (!this.watchQueue[watchId]) { return; }
//console.log("****@@@@@@><@@@@@@**** vidslide  ScreenNailFactory.removePhotoUpdateWatch("+watchId+")...");
        this.cancelPhotoUpdateWatch(watchId);
        delete this.watchQueue[watchId];
        this.watchCount--;
    }
});


enyo.kind({
    name: "SlideshowPlayList",
    kind: enyo.Component,
    published: {
    },
    events: {
        onScreenNailGenNotify: "",
        onPlayListChangeNotify: ""
    },
    components: [
        { name: "albumsDbService", kind: "AlbumLocalizationHackDbService", method: "find", 
            dbKind: "com.palm.media.image.album:1", 
            onSuccess: "albumsDataResponseHandler",
            onFailure: "albumsDbRequestFailHandler",
            subscribe: true, reCallWatches: true
        },
        { name: "photosDbService", kind: "DbService", method: "find",
              //dbKind: "com.palm.media.image.file:1",  // "...media.video.file:1","...media.types:1"
              dbKind: "com.palm.media.types:1",  // get both image + video just to match album grid
              onSuccess: "photosDataResponseHandler",
              onFailure: "photosDbRequestFailHandler"
        },
        { name: "screenNailFactory", kind: "ScreenNailFactory",
          onScreenNailUpdate: "updatePhotoScreenNailPath"
        },
        { name: "albumsDbUpdateService", kind: "PalmService", service: "palm://com.palm.db/",
              method: "merge", 
              onSuccess: "albumsDbUpdateResponseHandler",
              onFailure: "albumsDbUpdateFailureHandler"
        }
    ],

    constructor: function () {
        this.inherited(arguments);

        this.albums = undefined;  // { ids: [ <albumId1>, <albumId2>, ... ],
                                  //   meta: { <albumId1>: { albumId, title, photosCount, isSelected },
                                  //             ...
                                  //         }
                                  // }
        this.photos = undefined;  // { <albumId>: { <pictId>: { ... },
                                  //                ...
                                  //              },
                                  //   ...
                                  // }
                                  // Each picture object = {
                                  //                 pictId:         <_id>,
                                  //                 screenNailPath: <appScreenNail.path>|undefined
                                  //                 OriginalPath:   <appOriginal>|<path>
                                  //                 cached: <appCacheComplete> = "unattempted"|true|false
                                  //              }
                                  //   if !dbEntry.appScreenNail, then...
                                  //       this.$.screenNailGenerator.call(dbEntry)
        this.playList = undefined;  // [ { album, pict } , ... ]
                                    //     album = a reference to this.albums.meta[albumId]
                                    //     pict  = a reference to this.photos[pictId]

        this.selectedAlbumsList = undefined;   // [ albumId, ... ], [], undefined, null
                                        // - empty, select all (the default)
                                        // - one or more albumId's, selected albums
                                        // - undefined or null, take the albums selection from the DB entries

        this.rectificationJobsCount = 0;
        this.isActive = true;
    },

    activate: function () {
        var pendingJob = null;
        this.isActive = true;
        if (this.nextAssertAlbumsDataIntegrityJob) {
            pendingJob = this.nextAssertAlbumsDataIntegrityJob;
            delete this.nextAssertAlbumsDataIntegrityJob;
            this.doNextChain(pendingJob);
        }
    },

    deactivate: function () {
        this.isActive = false;
        this.isResetInProgress = false;
    },

    /**
     * It queues a request to change the albums seleciton.  The request does not take effect
     * immediately until a subsequent resetPlayList() or processAlbumsDbResponse() is called.
     * 
     * @param albumIds - (optional) It is an array of albumId's.  The possible values are:
     *                   - an array with one or more albumId's; to select albums
     *                   - empty array, select all albums
     *                   - undefined or null; to take the albums selection from the DB entries
     */
    requestToSelectAlbums: function (albumIds) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.requestToSelectAlbums(albumIds="+(albumIds ? "["+albumIds.length+"]" : "undefined")+"): queue a request to select albums...");
        if (!albumIds) {
            delete this.selectedAlbumsList; // will lead to taking the albums selection from the DB entries
        } if (albumIds.length == 0) {
            delete this.selectedAlbumsList;
            this.selectedAlbumsList = [];                  // will lead to selecting all albums
        } else {
            this.selectedAlbumsList = albumIds.slice(0);   // select albums from the albumIds array
        }
    },

    /**
     * It resets the play list by sync'ing itself with DB.
     *
     * @param firstAlbumReadyCallback (optional) if it is supplied, then the callback method supplied
     *            in it will be called when the photo dbEntries from the 1st album are received.
     *            The firstAlbumReadyCallback is an object of nextChain (@see doNextChain() for details.
     */
    reset: function (firstAlbumReadyCallback) {
        if (this.isResetInProgress) { return; }
        this.isResetInProgress = true;
        var thisInst = this;
        var earlyResponseCallback = {
            scope: thisInst,
            method: thisInst.earlyResponseWrapper,
            args: [ firstAlbumReadyCallback ]
        };

        var nextChain = {
            scope: thisInst,
            method: function (earlyNotify) {
                if (0 == this.getAlbumsCount()) {
                    this.isResetInProgress = false;
                    if (this.isDbAlbumsDataResponseHandlingInProgress) {
                        delete this.isDbAlbumsDataResponseHandlingInProgress;
                    }
                    if (earlyNotify) { thisInst.doNextChain(earlyNotify); }
                    return;
                }
                var firstNotify = earlyNotify;
                var secondNotify = {
                    method: function () {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.reset(): 2nd pass...");
                        // check, if not the last one, then no-op and return
                        var albumsCount = this.getAlbumsCount();
                        if (this.albumsOfPhotoReceived < albumsCount) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.reset(): 2nd pass, no-op because albumsOfPhotoReceived ("+this.albumsOfPhotoReceived+") < albumsCount ("+albumsCount+")");
                            return;
                        }
                        delete this.albumsOfPhotoReceived;
                        this.isResetInProgress = false;
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.reset(): is complete.  Starting 2nd pass resetPlayList()...");
                        if (this.abandPlayListReset !== undefined) {  // the 1st pass of resetPlayList() is
                            this.abandPlayListReset = true;           // still in-progress, aband it
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.reset(): 2nd pass, set abandPlayListReset=true, where isDbAlbumsDataResponseHandlingInProgress="+this.isDbAlbumsDataResponseHandlingInProgress+", pendingAlbumsDataResponse is "+(this.pendingAlbumsDataResponse ? "pending" : "clear"));
                        }
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.reset(): 2nd pass, about to call sustainPlayList()...");
                        this.sustainPlayList();
                    }
                };
                this.twoStepDbPhotosFetch(firstNotify, secondNotify);
            },
            args: [ earlyResponseCallback ]
        };
        this.getDbAlbums(nextChain);
    },

    earlyResponseWrapper: function (earlyResponse) {
        if (this.abandPlayListReset !== undefined) {  // a resetPlayList() is still in-progress,
            this.abandPlayListReset = true;           // then aband it
        }
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.earlyResponseWrapper(): about to call resetPlayList()...");
        this.resetPlayList();      // initiate the first pass on resetting playList
        if (earlyResponse) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.earlyResponseWrapper(): about to invoke earlyResponse...");
            this.doNextChain(earlyResponse);
        }
    },

    /**
     * 1. invokes resetPlayList(), based on whatever the albums/photos that are available.
     * 2. if there's new pendng albums DB data, then process them.
     * 3. invokes assertAlbumsDataIntegrity(), whcih repares dangling albums given by DB, if there's any.
     * 4. invokes resetPlayList() the 2nd time, based on the asserted albums/photos data.
     */
    sustainPlayList: function () {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.sustainPlayList(): about to call resetPlayList...");
        this.resetPlayList();

        if (this.isDbAlbumsDataResponseHandlingInProgress) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.sustainPlayList(): ends isDbAlbumsDataResponseHandlingInProgress");
            // it is set by the processAlbumsDbResponse()
            delete this.isDbAlbumsDataResponseHandlingInProgress;
        }

        var thisInst = this;
        var callback = {
            scope: thisInst,
            method: function () {
                if (this.isDbAlbumsDataResponseHandlingInProgress) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.sustainPlayList(): after assertion, ends isDbAlbumsDataResponseHandlingInProgress");
                    // it is set by the processAlbumsDbResponse()
                    delete this.isDbAlbumsDataResponseHandlingInProgress;
                }
                if (this.pendingAlbumsDataResponse) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.sustainPlayList(): after assertion, new pending albums data, call processPendingAlbumsDataResponse()...");
                    this.processPendingAlbumsDataResponse();  // should also trigger another assertAlbums...
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.sustainPlayList(): after assertion, processed pending albums data, about to invoke another round of assertAlbumsDataIntegrity(callback)...");
                    //this.assertAlbumsDataIntegrity(callback);
                } else {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.sustainPlayList(): after assertion, no new pending albums data, about to call resetPlayList()...");
                    this.resetPlayList();
                    this.doPlayListChangeNotify();
                }
            }
        };

        if (this.pendingAlbumsDataResponse) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.sustainPlayList(): has new pending albums data, call processPendingAlbumsDataResponse()...");
            this.processPendingAlbumsDataResponse();  // which should trigger an assertAlbumsDataIntegrity()
        } else {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.sustainPlayList(): about to call assertAlbumsDataIntegrity(callback)...");
            this.assertAlbumsDataIntegrity(callback);
        }
    },

    processPendingAlbumsDataResponse: function () {
        var dbService, resp, req;
        if (!this.pendingAlbumsDataResponse) { return; }
        dbService = this.pendingAlbumsDataResponse.dbService;
        resp = this.pendingAlbumsDataResponse.resp;
        req = this.pendingAlbumsDataResponse.req;
        delete this.pendingAlbumsDataResponse;
        this.processAlbumsDbResponse(dbService, resp, req);
    },

    getAlbumsCount: function () {
        return this.albums ? this.albums.ids.length : undefined;
    },

    /**
     * @return It returns a boolean whether or not the play list has enough photos from the requested
     *         albumIds.
     */
    isAlbumDataFulfilled: function (albumIds) {
        var isFulfilled = false;
        var albums = this.albums;
        if (!albums) { return isFulfilled; }
        var meta = albums.meta;
        if (!meta) { return isFulfilled; }
        var albumMeta, i, len;
        for (i = 0, len = albumIds.length; i < len && !isFulfilled; i++) {
            albumMeta = meta[albumIds[i]];
            if (!albumMeta) { continue; }
            if (albumMeta.fetchedCount >= albumMeta.photosCount) { isFulfilled = true; }
        }
        return isFulfilled;
    },

    /**
     * Get the album ID of an album indexed at the albums list managed by this play list.
     *
     * @param index It is the index to an album from the albums list.
     *
     * @return It returns an albumId, or returns undefiend if the index is out-of-bound.
     */
    getAlbumIdByIndex: function (index) {
        return (this.albums && index >= 0 && index < this.albums.ids.length) ?
               this.albums.ids[index] : undefined;
    },

    /**
     * @param index It is the index to the album list (which is maintained by this SlideshowPlayList)
     *              to which to get its album meta object.
     *
     * @return It returns a meta data object about an album, which has the following properties.
     *         { albumId, title, photosCount }
     */
    getAlbumMetaByIndex: function (index) {
        if (!this.albums || 0 == this.albums.ids.length) { return null; }
        if (index < 0 || index >= this.albums.ids.length) { return null; }
        return this.albums.meta[this.albums.ids[index]];
    },

    /**
     * @param albumId It is the ID to an album to which to get its album meta object.
     *
     * @return It returns a meta data object about an album, which has the following properties.
     *         { albumId, title, photosCount }
     */
    getAlbumMetaById: function (albumId) {
        if (!this.albums || 0 == this.albums.ids.length) { return null; }
        var meta = this.albums.meta[albumId];
        return meta ? meta : null;
    },

    /**
     * @return It returns an array of zero or more albumId's that are being selected in the play list.
     */
    getSelectedAlbumIds: function () {
        var albumIds = [], albums = this.albums;
        if (!albums) { return albumIds; }
        var ids = albums.ids;
        if (!ids) { return albumIds; }
        var i, len, albumId, meta;
        for (i = 0, len = ids.length; i < len; i++) {
            albumId = ids[i];
            meta = albums.meta[albumId];
            if (!meta) { continue; }
            if (!meta.isSelected) { continue; }
            albumIds.push(albumId.slice(0));
        }

        return albumIds;
    },

    /**
     * Initiate a DB request for albums list.
     *
     * @param nextChain It is an optional object, if supplied, the method supplied in it will be
     *                  invoked after receiving the DB response.  The nextChain object expects the
     *                  following parameters.
     *                  { scope,  (optional) it is the object scope to invoke the method, this instance
     *                            of SlideshowPlayList is assumed if it is not specified.
     *                    method, (required) it is the function to be invoked.
     *                    args    (optional) it is an array of parameters to be passed onto the method.
     *                  }
     * @param nextKey (optional) if present, then it is the DB key to fetch the next 500 albums.
     */
    getDbAlbums: function (nextChain, nextKey) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.getDbAlbums(): make DB request for albums list...");

		var q = {
			where: [{prop: "showAlbum", op: "=", val: true}],
			orderBy: "modifiedTime"
		};
		if (nextKey) { q.page = nextKey; }
		var req = this.$.albumsDbService.call({query: q});
		if (nextChain) { req.nextChain = nextChain; }
		if (nextKey) { req.append = true; }
    },

    getAbbreviatedAlbumsList: function () {
        var albums = this.albums;
        if (!albums) { return null; }
        var ids = albums.ids;
        var meta = albums.meta;
        if (!ids) { return null; }
        var len = ids.length;
        if (0 == len) { return null; }
        var i, albumMeta, abbreviatedAlbums = [];
        for (i = 0; i < len; i++) {
            albumMeta = meta[ids[i]];
            abbreviatedAlbums.push({
                albumId:     albumMeta.albumId,
                title:       albumMeta.title,
                photosCount: albumMeta.photosCount,
                isSelected:  albumMeta.isSelected
            });
        }

        return abbreviatedAlbums;
    },

    /**
     * This method assures the data integrity of the albums that there are as many photo DB entries
     * as it is said in the DB albums.  It takes the action to rectify if not.
     *
     * The assertAlbumsDataIntegrity() should be run only when the albums data are stablized.
     * However, the DB watch guard event can happen at any time, so that the
     * this.isDbAlbumsDataResponseHandlingInProgress is checked to aband the assertAlbumDataIntegrity()
     * execution.  The isDbAlbumsDataResponseHandlingInProgress is set by the processAlbumsDbResponse().
     *
     * Each assertAlbumsDataIntegrity() is atomic focusing on asserting only one album.  It first invokes
     * scrapeDanglingAlbums() if needed, and then invokes rectifyAlbumPhotos() if needed.  It does this
     * one dangling album at a time until no more dangling album, or is abanded on new
     * this.isDbAlbumsDataResponseHandlingInProgress.
     *
     * The assertAlbumsDataIntegrity() is first initiated by the reset(), and then subsequent
     * assertAlbumsDataIntegrity() calls are invoked following each rectifyAlbumPhotos() from each
     * assertAlbumsDataIntegrity(), or from a previous assertAlbumsDataIntegrity().
     *
     * @param callback (optional) (@see doNextChain())  If supplied, it is invoked at the end of
     *                            assertAlbumsDataIntegrity()
     */
    assertAlbumsDataIntegrity: function (callback) {
        var thisInst = this;
        if (!this.isActive) {
            this.nextAssertAlbumsDataIntegrityJob = {
                scope: thisInst,
                method: thisInst.assertAlbumsDataIntegrity,
                args: [ callback ]
            };
            return;
        }
        if (this.isDbAlbumsDataResponseHandlingInProgress || this.rectificationJobsCount > 0) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.assertAlbumsDataIntegrity(): no-op, because isDbAlbumsDataResponseHandlingInProgress="+this.isDbAlbumsDataResponseHandlingInProgress+" OR rectificationJobCount="+this.rectificationJobsCount);
            return;
        }
        var albums = this.albums;
        if (!albums) { return; }
        var meta = albums.meta;
        if (!meta) { return; }
        var ids = albums.ids;
        if (!ids || 0 == ids.length) { return; }
        var photos = this.photos;
        if (!photos) { return; }
        var i, albumMeta, idsCount = ids.length, album = undefined, danglingAlbums = [];
        var theLeastRetryCount = 0;
        for (i = 0; i < idsCount; i++) {
            albumMeta = meta[ids[i]];
            if (!albumMeta || albumMeta.fetchedCount >= albumMeta.photosCount) { continue; } // a good album
            if (albumMeta.rectificationJobId) { continue; }           // is being rectified
            if (albumMeta.retryAllowed <= 0) {
                if (!photos[ids[i]]) { danglingAlbums.push(ids[i]); } // a dangling album, collect its ID
            } else {
                if (albumMeta.retryAllowed > theLeastRetryCount) {
                    theLeastRetryCount = albumMeta.retryAllowed;
                    album = albumMeta;           // only targets on the 1st found the least retried album
                }
            }
        }

        if (danglingAlbums.length > 0) { this.scrapeDanglingAlbums(danglingAlbums); }

        var k, isNextAssertionNeeded = false;
        if (!album) {      // no more to assert
//var debugMsg = "["+idsCount+"]";
            for (k = 0; k < idsCount; k++) {
                albumMeta = meta[ids[k]];
//debugMsg += ' { "'+albumMeta.title+'", '+albumMeta.retryAllowed+':'+albumMeta.photosCount+'/'+albumMeta.fetchedCount+(albumMeta.rectificationJobId ? "(rectInProgress)" : "")+' }';
                if (albumMeta.fetchedCount >= albumMeta.photosCount ||
                    albumMeta.maxRetryAllowed <= 0) {
                    continue;
                }
        
                albumMeta.retryAllowed = 1;
                isNextAssertionNeeded = true;
            }
            if (isNextAssertionNeeded) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.assertAlbumsDataIntegrity(): end-of-assertion, "+debugMsg+", and schedule another round of assertion...");
                setTimeout(function () {
                    thisInst.assertAlbumsDataIntegrity(callback);
                }, 2700);
            }
//else {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.assertAlbumsDataIntegrity(): end-of-assertion, "+debugMsg);
//}
            if (callback) { this.doNextChain(callback); }
            return;
        }

        var nextChain = {
            scope: thisInst,
            method: function (albumId, callback) {
                // it is invoked after photos DB response for the albumId is processed
                var albums = this.albums;
                if (!albums) { return; }  // not likely to happen
                var meta = albums.meta;
                if (!meta) { return; }    // not likely to happen
                var albumMeta = meta[albumId];
                if (!albumMeta) { return; }    // not likely to happen
                if (albumMeta.rectificationJobId) {
                    clearTimeout(albumMeta.rectificationJobId);
                    delete albumMeta.rectificationJobId;
                    if (this.ectificationJobsCount > 0) { this.rectificationJobsCount--; } 
                }

                if (this.pendingAlbumsDataResponse) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.assertAlbumsDataIntegrity(): jump on new pending albums DB data...");
                    this.processPendingAlbumsDataResponse();   // should trigger another assertAlbums...
                } else {
//console.log('****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.assertAlbumsDataIntegrity(): assert next after tried rectifying album "'+albumMeta.title+'"');
                    this.assertAlbumsDataIntegrity(callback);
                }
            },
            args: [ album.albumId, callback ]
        };

        // calculate the time delay to launch the next rectification
        var sinceLast, now = new Date().getTime();
        var gracePeriod = Math.ceil(2100/album.retryAllowed);
        if (album.rectificationTimestamp) {
            sinceLast = now - album.rectificationTimestamp;
            gracePeriod = sinceLast >= gracePeriod ? 100 : gracePeriod - sinceLast;
        }
        album.rectificationTimestamp = now + gracePeriod;
        album.rectificationJobId = setTimeout(function () {
            thisInst.rectifyAlbumPhotos(album.albumId, nextChain);
        }, gracePeriod);
        this.rectificationJobsCount++;
    },

    /**
     * It makes a DB request fetching the photo entries for the given albumId.  After processing its
     * DB response, it invokes the nextChain supplied, if any.
     *
     * @param albumId It is the ID to an album to fetch the photo DB entries.
     * @param nextChain It is an object recognized by the doNextChain().
     */
    rectifyAlbumPhotos: function (albumId, nextChain) {
        var albums = this.albums;
        if (!albums) { return; }            // if no this.albums, then do not propagate the nextChain
        var meta = albums.meta;
        if (!meta) { return; }              // if no this.albums.meta, then do not propagate the nextChain
        var albumMeta = meta[albumId];
        if (!albumMeta) { return; }  // if no this.albums.meta[albumId], then do not propagate the nextChain
        if (albumMeta.rectificationJobId) {
            clearTimeout(albumMeta.rectificationJobId);
            delete albumMeta.rectificationJobId;
            this.rectificationJobsCount--;
        }
        albumMeta.retryAllowed--;
        albumMeta.maxRetryAllowed--;
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.rectifyAlbumPhotos("+albumMeta.title+"): "+(albumMeta.retryAllowed+1)+":"+albumMeta.photosCount+"/"+albumMeta.fetchedCount+", about to call getDbPhotos()...");
        var req = this.getDbPhotos(albumId);
        if (nextChain) { req.nextChain = nextChain; }
    },

   abandAllPendingRectificationJobs: function () {
        var albums = this.albums;
        if (!albums) { return; }
        var meta = albums.meta;
        if (!meta) { return; }
        var albumId = null, albumMeta = null;
        for (albumId in meta) if (meta.hasOwnProperty(albumId)) {
            albumMeta = meta[albumId];
            if (albumMeta.rectificationJobId) {
                clearTimeout(albumMeta.rectificationJobId);
                if (this.rectificationJobsCount > 0) { this.rectificationJobsCount--; } 
                delete albumMeta.rectificationJobId;
            }
        }
        if (this.rectificationJobsCount > 0) { this.rectificationJobsCount = 0; }  // should never happen
    },

    /**
     * It makes a DB request fetching the photo entries for the given albumId.  After processing its
     * DB response, it invokes the nextChain supplied, if any.
     *
     * @param albumIds It is an array of ID's to the albums to fetch the photo DB entries.
     * @param nextChain It is an object recognized by the doNextChain() which will be invoked upon
     *                 the first album being fetched.
     */
    resyncAlbumPhotos: function (albumIds, nextChain) {
        if (!albumIds || 0 == albumIds.length) {
            if (nextChain) { this.doNextChain(nextChain); }
            return;
        }
        var albums = this.albums;
        if (!albums) {
            if (nextChain) { this.doNextChain(nextChain); }
            return;
        }
        var meta = albums.meta;
        if (!meta) {
            if (nextChain) { this.doNextChain(nextChain); }
            return;
        }
        // filter out the albumId's that are stale
        var albumMeta = undefined, i, len, validAlbumIds = [];
        for (i = 0, len = albumIds.length; i < len; i++) {
            albumMeta = meta[albumIds[i]];
            if (!albumMeta) { continue; }
            validAlbumIds.push(albumIds[i].slice(0));
        }
        if (0 == validAlbumIds.length) {     // all albumId's are stale
            if (nextChain) { this.doNextChain(nextChain); }
            return;
        }

        var req;
        if (1 == validAlbumIds.length) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.resyncAlbumPhotos(albumIds="+(albumIds && albumIds.length > 0 ? "["+albumIds.length+"]" : "undefined")+(nextChain ? ",nextChain" : "")+"): about to call getDbPhotos(albumId="+validAlbumIds[0]+")...");
            req = this.getDbPhotos(validAlbumIds[0]);
            if (nextChain) { req.nextChain = nextChain; }
        } else {
            // Note that we're initiating a full sync here.  Not sure if it is necessary, though.
            // Alternatively, we may be able to call getDbPhotos() looping through the validAblumIds,
            // but would need a way to optimize it, so that it dose a two-step apporach similar to
            // the towStepDbPhotosFetch()...
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.resyncAlbumPhotos(albumIds="+(albumIds && albumIds.length > 0 ? "["+albumIds.length+"]" : "undefined")+(nextChain ? ",nextChain" : "")+"): about to initiate a twoStepDbPhotosFetch() sync'ing with MojoDB...");
            this.twoStepDbPhotosFetch(nextChain);
        }
    },

    /**
     * An album is dangled when it says it should have photos, but there's no photo supplied by DB.
     * This method removes such dangling albums from this.albums.
     *
     * @param scrapeIds It is an array of albumId's to be scraped off this.albums.
     */
    scrapeDanglingAlbums: function (scrapeIds) {
        if (!scrapeIds || 0 == scrapeIds.length) { return; }
        var scrapeCount = scrapeIds.length;
        var albums = this.albums;
        if (!albums) { return; }
        var ids = albums.ids;
        if (!ids || 0 == ids.length) { return; }
        var idsCount = ids.length;
        var i, j, isScrape, verifiedIds = [];
        for (i = 0; i < idsCount; i++) {
            for (j = 0, isScrape = false; j < scrapeCount && !isScrape; j++) {
                if (ids[i] == scrapeIds[j]) { isScrape = true; }
            }
            if (isScrape) {
//console.log('****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.scrapeDanglingAlbums() scraping off dangling album "'+albums.meta[ids[i]].title+'"');
                delete albums.meta[ids[i]];
            } else {
                verifiedIds.push(ids[i]);
            }
        }

        delete albums.ids;
        albums.ids = verifiedIds;
    },

    /**
     * It comapres the selectedAlbums array with this.albums.  If the selected albums from both
     * matches, the it returns true.  Otherwise it returns false.
     *
     * @param selectedAlbums It is an array of selected albumId's to be compared.
     *
     * @return It returns boolean.  A value of true means that the selection from the selectedAlbums
     *         matches with this.albums managed by the play list.  It returns false if they are do
     *         not match.
     */
    isAlbumsSelectionMatched: function (selectedAlbums) {
        var albums = this.albums;
        if (!albums) {
            if (!selectedAlbums || 0 == selectedAlbums.length) {
                return true;
            } else {
                return false;
            }
        }
        var ids = albums.ids;
        var len = ids.length;
        if (!ids || 0 == len) {
            if (!selectedAlbums || 0 == selectedAlbums.length) {
                return true;
            } else {
                return false;
            }
        }

        var meta = albums.meta;
        var i, albumMeta, sLen, comparedIds, albumId, isMatch = true;
        if (!selectedAlbums || 0 == selectedAlbums.length) {
            for (i = 0; i < len && isMatch; i++) {
                albumMeta = meta[ids[i]];
                if (!albumMeta.isSelected) { continue; }
                isMatch = false;
            }
        } else {
            sLen = selectedAlbums.length;
            comparedIds = {};
            for (i = 0; i < sLen && isMatch; i++) {
                albumId = selectedAlbums[i];
                comparedIds[albumId] = true;
                albumMeta = meta[albumId];
                if (albumMeta && albumMeta.isSelected) { continue; }
                isMatch = false;
            }
            for (i = 0; i < len && isMatch; i++) {
                albumId = ids[i];
                if (comparedIds[albumId]) { continue; }
                comparedIds[albumId] = true;
                albumMeta = meta[albumId];
                if (!albumMeta.isSelected) { continue; }
                isMatch = false;
            }
        }

        return isMatch;
    },

    /**
     * This function is called to handle the albums list DB request.  It can be called in two scenarios...
     * 1. to receive the response returned by a DB request to get albums list, or
     * 2. to receive the DB notification to re-fetch new albums list
     *
     * It reconstructs this.albums based on the resp.  The this.albums has the following construct...
     *     albums = {
     *          ids:  [ <albumId>, ... ],                                         // an array of albumId's
     *          meta: { <albumId>: { albumId, title, photosCount, isSelected },   // an object of album
     *                  ...                                                       // meta properties
     *                }
     *     }
     *
     * @param resp It is the response returned by the DB service expecting...
     *             { results: [ { _id, name, total: { images, videos }, type, ... },
     *                          ...
     *                        ],
     *               next: "<key>"    // If 'next' appeared, then there's more results to fetch.
     *             }
     *
     * @param req It is the request instance.  It may contain the following add-on properties relevant
     *             to us.
     *             { ...,
     *               nextChain: <nextChainObj>,   // if nextChain appeared, then pass it onto the
     *                                            // doNextChain() to process it.
     *               append: true                 // if append == true, then this response should be
     *             }                              // appended to the previous result
     */
    albumsDataResponseHandler: function (dbService, resp, req) {
        if (!resp) { return; }
        if (resp.fired) {  // got a notify from the watch guard to re-fetch the albums list
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.albumsDataResponseHandler(): need to re-fetch alubms list...");
            dbService.reCall(this.getDbAlbums);
            return;
        }
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.albumsDataResponseHandler(): got a response ["+resp.results.length+"]...");

        if (this.pendingAlbumsDataResponse) { delete this.pendingAlbumsDataResponse; }
        if (this.isDbAlbumsDataResponseHandlingInProgress) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.albumsDataResponseHandler(): queue a response having "+this.albumsDbResult2String(resp)+(req && req.nextChain ? ", req has nextChain" : ""));
            this.pendingAlbumsDataResponse = { dbService: dbService, resp: resp, req: req };
        } else {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.albumsDataResponseHandler(): process a response having "+this.albumsDbResult2String(resp)+(req && req.nextChain ? ", req has nextChain" : ""));
            this.processAlbumsDbResponse(dbService, resp, req);
        }
    },

    processAlbumsDbResponse: function (dbService, resp, req) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.processAlbumsDbResponse(): process a response having "+this.albumsDbResult2String(resp)+(req && req.nextChain ? ", req has nextChain" : "")+"...");
        this.isDbAlbumsDataResponseHandlingInProgress = true; // it is cleared by the 2nd notify from reset()
        // process resp containing the new albums list reconstructing this.albums
        var i, k, len, entry, count = -1, results = resp.results;
        if (!req.append) {
            this.$.screenNailFactory.reset();
            if (this.playList) { delete this.playList; }
            if (this.photos) { delete this.photos; }
            if (this.albums) {
                this.oldAlbums = this.albums;
                delete this.albums;
            }
            this.albums = { ids: [], meta: {} };
        }
        var albums = this.albums;
        for (i = 0, k = 0, len = results.length; i < len; i++) {
            entry = results[i];

            if (!entry.total || undefined == entry.total.images || entry.total.images == 0) { continue; }

            albums.ids[k++] = entry._id;
            albums.meta[entry._id] = {
                albumId:      entry._id,
                title:        entry.name,
                photosCount:  entry.total.images,
                fetchedCount: 0,
                retryAllowed: 3,
                maxRetryAllowed: 200,      // equivalent to 10 minutes, then give it up after
                isSelected:   undefined,   // it is a boolean
                dbEntry:      entry
            };
//console.log('****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.albumsDataResponseHandler(): album title="'+entry.name+'", count='+entry.total.images);
            switch (entry.path.toLowerCase()) {
                case "/media/internal/downloads":
                    albums.meta[entry._id].title = $L("Downloads");
                    break;
                case "/media/internal/messaging":
                    albums.meta[entry._id].title = $L("Messaging");
                    break;
                case "/media/internal/screencaptures":
                    albums.meta[entry._id].title = $L("Screen captures");
                    break;                    
                case "/media/internal/wallpapers":
                    albums.meta[entry._id].title = $L("Wallpapers");
                    break;
                default: 
                    break;
            }
        }

        if (resp.next) {
            this.getDbAlbums(req.nextChain, resp.next);
        } else {
            if (this.getAlbumsCount() > 0) {
                this.sortAlbumsMostRecentFirst();

                this.resetAlbumsSelection();

                if (this.oldAlbums) { delete this.oldAlbums; }
            }

            // if the request has a nextChain supplied, then invokes it.
            if (req.nextChain) { this.doNextChain(req.nextChain); }
        }
    },

    sortAlbumsMostRecentFirst: function () {
        var thisInst = this;
        var comparator = function (a, b) {
            return thisInst.albums.meta[b].dbEntry.modifiedTime-thisInst.albums.meta[a].dbEntry.modifiedTime;
        };
        this.albums.ids.sort(comparator);
    },

    /**
     * It resets the isSelected flag of each album meta object in this.albums.meta according to the
     * state of this.selectedAlbumsList.  (@see requestToSelectAlbums())
     *
     * this.selectedAlbumList is one of the following values.
     *     - not supplied, undefined, or null
     *       Take the albums selection from the DB entries
     *     - supplied but an empty array
     *       All albums are selected.
     *     - supplied with one or more album ID's
     *       Select those albums listed in the array and clears all others.
     */
    resetAlbumsSelection: function () {
        if (!this.albums || !this.albums.meta) { return; }
        var i, len, selectedCount = 0, albumId = null, albumMeta, albumsMeta = this.albums.meta;

        if (this.selectedAlbumsList && this.selectedAlbumsList.length > 0) {
            // take the albums selection from the selectedAlbumsList

            for (albumId in albumsMeta) if (albumsMeta.hasOwnProperty(albumId)) {
                albumsMeta[albumId].isSelected = false;
            }

            for (i = 0, len = this.selectedAlbumsList.length; i < len; i++) {
                albumMeta = albumsMeta[this.selectedAlbumsList[i]];
                if (!albumMeta) { continue; }
                albumMeta.isSelected = true;
                selectedCount++;
            }
        } else if (!this.selectedAlbumsList) {
            // take the albums selection from the DB entries

            for (albumId in albumsMeta) if (albumsMeta.hasOwnProperty(albumId)) {
                albumMeta = albumsMeta[albumId];
                if (albumMeta.dbEntry.isSlideshowSelected === true) {
                    albumMeta.isSelected = true;
                    selectedCount++;
                } else {
                    albumMeta.isSelected = false;
                }
            }
        }

        if (selectedCount == 0) {
            // no album is selected, including the case of selectedAlbumList being an empty array,
            // then, select all albums

            for (albumId in albumsMeta) if (albumsMeta.hasOwnProperty(albumId)) {
                albumsMeta[albumId].isSelected = true;
            }
        }
    },

    persistAlbumsSelection: function () {
        if (!this.albums || !this.albums.meta) { return; }
        var i, len, selectedCount = 0, albumId = null, albumMeta, albumsMeta = this.albums.meta;
        var params = { objects: [] };

        for (albumId in albumsMeta) if (albumsMeta.hasOwnProperty(albumId)) {
            params.objects.push(
                { _id: albumId,
                  isSlideshowSelected: albumsMeta[albumId].isSelected === true ? true : false
                });
        }

        this.$.albumsDbUpdateService.call(params);
    },

    albumsDbRequestFailHandler: function (dbService, resp, req) {
        console.log("photos.SlideshowPlayList: failed to get albums list, response="+enyo.json.stringify(resp));
    },

    getDbPhotos: function (albumId, next) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.getDbPhotos(): request for photos from album "+this.albums.meta[albumId].title+"...");

        // specify the same params as declared by the album grid to match the same content and same order
        var qryParams = {
            query: { where: [ { prop: "albumId", op: "=", val: albumId },
                              { prop: "appCacheComplete", op: "=", val: true }
                            ],
                     // MojoDb gives the ascending order, i.e. from smaller to larger
                     orderBy: "createdTime"
                   }
        };
        if (next) { qryParams.query.page = next; }

        var req = this.$.photosDbService.call(qryParams);
        if (next) { req.append = true; }
        return req;
    },

    /**
     * This method handles the response requested by getDbPhotos().
     *
     * @param resp It is the response from the getDbPhotos() request expecting { results[], next }
     * @param req  It is the request instance.  It may optionally have 'append' property.  If the
     *             'append' property appeared, then this resp is meant to be appended to one of the
     *             previous response, i.e. belongs to the same album.
     */
    photosDataResponseHandler: function (dbService, resp, req) {

//var debugMsg = "";
        if (!resp || !resp.results) {
//debugMsg = this.albums.meta[req.params.query.where[0].val] ? this.albums.meta[req.params.query.where[0].val].title : req.params.query.where[0].val;
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.photosDataResponseHandler(): empty resp from "+debugMsg);
            if (this.albumsOfPhotoReceived != undefined) { this.albumsOfPhotoReceived++; }
            if (req.nextChain) {
                this.doNextChain(req.nextChain);
            }
            return;
        }

        var results = resp.results, albumId = undefined;

        if (resp.next) {
            albumId = req.params.query.where[0].val;
//debugMsg = this.albums.meta[albumId] ? this.albums.meta[albumId].title : albumId;
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.photosDataResponseHandler(): get next for "+debugMsg);
            if (albumId) {
                var thisInst = this;
                setTimeout(function () {
                    var req2 = thisInst.getDbPhotos(albumId, resp.next);
                    if (req.nextChain) { req2.nextChain = req.nextChain; }
                }, 5);
            }
        } else {
            if (this.albumsOfPhotoReceived != undefined) { this.albumsOfPhotoReceived++; }
        }


        if (0 == results.length) {
//debugMsg = this.albums.meta[req.params.query.where[0].val] ? this.albums.meta[req.params.query.where[0].val].title : req.params.query.where[0].val;
//console.log('****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.photosDataResponseHandler(): album "'+debugMsg+'" respond.results[]=EMPTY');
            if (!resp.next && req.nextChain) {
                this.doNextChain(req.nextChain);
            }
            return;
        }

        this.addToPhotos(results, req.append);

        if (!resp.next && req.nextChain) {
            this.doNextChain(req.nextChain);
        }
    },

    photosDbRequestFailHandler: function (dbService, resp) {
        console.log("photos.SlideshowPlayList: failed to get photos data; Error: "+enyo.json.stringify(resp));
    },

    /**
     * Adds the elements from the results array to the photos object, which has the structure...
     *     this.photos = { <albumId>: { <pictId>: <pictMetaObj>,
     *                                  ...
     *                                },
     *                     ...
     *                   }
     *
     * Each picture meta object = {
     *     pictId:         <_id>,
     *     screenNailPath: <appScreenNail.path>|undefined
     *     originalPath:   <appOriginal>|<path>
     *     cached: <appCacheComplete> = "unattempted"|true|false
     *     dbEntry: <results[i]>  // needed for the screen nail generator service
     * }
     *
     * @param results It is an array, and each element is a dbEntry representing a picture.
     *                { _id: "<pictId>",
     *                  albumId: "<albumId>",
     *                  albumPath: "/media/internal/<folderName>",
     *                  mediaType: "image|video",
     *                  appCacheComplete: "unattempted"|true|false
     *                  path:        "/media/internal/<folderName>/<file>.jpg",
     *                  appOriginal: "/media/internal/<folderName>/<file>.jpg",
     *                  appScreenNail: {
     *                      path: "/media/internal/.photosApp/Generated/appScreenNail<name>.jpg",
     *                      cached: true
     *                  },
     *                  appFullScreen: {
     *                      path: "/media/internal/.photosApp/Generated/appBig<name>.jpg"
     *                      type: "cached"
     *                  },
     *                  thumbnails: [ ... ]
     *                  ...
     *                }
     *  
     */
    addToPhotos: function (results, isAppend) {
        if (!results || results.length == 0) { return; }
        if (!this.photos) { this.photos = {}; }
        var i, album, entry, len = results.length, albumId = results[0].albumId;
        var imgCount = 0;
        var meta = this.albums ? this.albums.meta[albumId] : undefined;
        var nextSeqId = meta ? meta.fetchedCount : 0;
//console.log('****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.addToPhotos(): album "'+meta.title+'" '+meta.photosCount+'~'+(meta.fetchedCount-len)+'+'+len);
        for (i = 0; i < len; i++) {
            entry = results[i];
            if (entry.mediaType != "image") { continue; }   // filters out non-image entires
            album = this.photos[entry.albumId];
            if (!album) { album = this.photos[entry.albumId] = {}; }
            album[entry._id] = {
                seqId:          nextSeqId++,
                pictId:         entry._id,
                originalPath:   entry.appOriginal ? entry.appOriginal : entry.path,
                screenNailPath: entry.appScreenNail && entry.appScreenNail.path ?
                                entry.appScreenNail.path : undefined,
                cached:         entry.appCacheComplete,  // "unattempted"|true|false
                createdTime:    entry.createdTime,
                dbEntry:        entry  // we still hold a reference b/c the screen nail generator needs it
            };
            imgCount++;
//console.log('****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.addToPhotos(): dbEntry="'+album[entry._id].screenNailPath+'"');
        }
        if (meta) { meta.fetchedCount = isAppend ? meta.fetchedCount + imgCount : imgCount; }
    },

    /**
     * This method, along with the addAlbumToPlayList() re-constructs the playList.  It does not
     * alter anything else, and it can be called in tandem.  When it is called in tandem, the second
     * pass re-constructs it from scratch.  If the second pass is launched before the first pass
     * completes, the first pass abands allowing the second pass to proceed.  It allows the construction
     * of the playList to begin when some of the initial photos data has arrived enabling the slideshow
     * to begin to render based on the initial data in the playList.  Then, after the last bit of DB
     * photos data has arrived, the second pass of of resetPlayList() would re-construct it with the
     * complete data set.
     *
     * The case of abandoning the first pass should rarely happen as webkit/V8 is single threaded.
     * However, as the DB responses are asynchronous, one large album may take longer to respond
     * than other smaller albums.  This tandem approach would make the slideshow more responsive
     * without waiting for all DB data to arrive.
     */
    resetPlayList: function () {
//console.dir("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.resetPlayList()...");
        if (!this.albums || !this.albums.meta || !this.photos) {
            if (this.playList) { delete this.playList; }
            delete this.abandPlayListReset;
            return;
        }

        this.resetAlbumsSelection();

        var oldPlayList = this.playList;
        var playList = this.playList = [];
        var albumsMeta = this.albums.meta;
        var albumId = undefined, ids = this.albums.ids;
        var i = 0, len = ids.length, album;
        this.abandPlayListReset = false;
        for (i = 0; i < len; i++) {
            if (this.abandPlayListReset) { break; }
            albumId = ids[i];
            album = albumsMeta[albumId];
            if (album.fetchedCount > 0 && album.isSelected) {
//console.log('****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.resetPlayList(): @'+i+' adding album "'+album.title+'" to the playList ('+album.fetchedCount+')+>'+(this.playList ? this.playList.length : 0));
                this.addAlbumToPlayList(albumId);
            }
        }
        delete this.abandPlayListReset;
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.resetPlayList(): completed with "+this.playList.length+" photos on the playList");
    },

    /**
     * Add pictures from the given album to the play list without checking if the same pictures are
     * already in the play list.
     */
    addAlbumToPlayList: function (albumId) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.addAlbumToPlayList("+albumId+")...");
        if (!this.albums || !this.albums.meta || !this.photos) { return; }
        var albumMeta = this.albums.meta[albumId];
        var album = this.photos[albumId];
        if (!albumMeta || !album) { return; }  // if the album's photos data had not arrived, then return

        if (!this.playList) { this.playList = []; }
        var playList = this.playList;
        var pictId = undefined;
        var plainList = [];
        for (pictId in album) if (album.hasOwnProperty(pictId)) {
            if (this.abandPlayListReset) { break; }
            plainList.push({
                album: albumMeta,
                pict:  album[pictId]
            });
        }

        var i = 0, len = plainList.length;
        if (0 == len) { return; }

        this.sortByMostRecentFirst(plainList);
        for (i = 0; i < len; i++) {
            this.playList.push(plainList[i]);
        }
    },

    sortByMostRecentFirst: function (list) {
        // custom matching the MojoDb sort, plus reversing its order given
        // 1. those have createdTime precede those missing createdTime or having createdTime of zero.
        // 2. larger createdTime preceeds smaller createdTime
        // 3. when both miss the createdTime, the later in the sequence given by MojoDb precedes the early's
        var comparator = function (a, b) {
            // guarding undefined create time
            var at = a.pict.createdTime != undefined ? a.pict.createdTime : 0;
            var bt = b.pict.createdTime != undefined ? b.pict.createdTime : 0;
            var result = 0;
            if (at != 0 && bt != 0) {
                result = bt - at;                        // the larger createdTime goes to the front
            } else if (at == 0 && bt == 0) {
                result = b.pict.seqId - a.pict.seqId;    // the later sequence goes to the front
            } else if (at == 0) {
                result = 1;
            } else if (bt == 0) {
                result = -1;
            } else {
                result = 0;
            }
            return result;
        };
        list.sort(comparator);
    },

    shufflePlayList: function () {
        if (!this.playList || this.playList.length < 2) { return; }
        this.playList = this.shuffle(this.playList);
    },

    /**
     * an in-place shuffle based on Fisher-Yates shuffle algorithm
     * @param arr It is an array of any elements
     *
     * @return It returns the same array with its elements randomly shuffled.
     */
    shuffle: function (arr) {
        if (!arr || arr.length <= 1) { return array; }
        var tmp, i, top = arr.length;
        while(--top) {
            i = Math.floor(Math.random()*(top+1));
            tmp = arr[i];
            arr[i] = arr[top];
            arr[top] = tmp;
        }
        return arr;
    },

    /**
     * Get the number of items in the play list.
     */
    getPlayListCount: function () {
        return this.playList ? this.playList.length : 0;
    },

    /**
     * It fetches album photos in two steps.  It fetches the photos for the first album, and then
     * fetches the photos for the remaining albums.  If the firstNotify is supplied, then it is
     * invoked when the DB response from the first album is received.  Then, if the secondNotify
     * is supplied, then it is invoked after all the remaining albums are received.
     *
     * @param firstNotify (optional) if supplied, it is a nextChain object (@see doNextChain for details.)
     * @param secondNotify (optional) if supplied, it is a nextChain object (@see doNextChain for details.)
     */
    twoStepDbPhotosFetch: function (firstNotify, secondNotify) {
        if (!this.albums || this.albums.ids.length == 0) {
            // not sure if both the firstNotify and the secondNotify shoud be notified if no albums???
            return;
        }
        
        this.albumsOfPhotoReceived = 0;       // to count how many getDbPhotos() received

        // construct a fetch list having the selected albums higher on the list and those non-selected
        // albums lower on the list.
        var highs = [], lows = [];
        var meta = null, albumId = null, albumsMeta = this.albums.meta;
        var i, len, ids = this.albums.ids;
        for (i = 0, len = ids.length; i < len; i++) {
            albumId = ids[i];
            if (albumsMeta[albumId].isSelected) {
                highs.push(albumId);
            } else {
                lows.push(albumId);
            }
        }
        var fetchList = highs.concat(lows);

        var nextChain = {
            method: function (fetchList, firstNotify, secondNotify) {
                var thisInst = this;
                if (firstNotify) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.twoStepDbPhotosFetch(): about to call earlyNotify...");
                    /*
                    setTimeout(function () {
                        thisInst.doNextChain(firstNotify);
                    }, 1);
                    */
                    this.doNextChain(firstNotify);
                }

                var i, aReq = undefined, len = fetchList ? fetchList.length : 0;
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.twoStepDbPhotosFetch(): "+(len > 0 ? "about to start the 2nd pass..." : "empty fetchList, no 2nd pass"));
                if (len < 2) {
                    if (secondNotify) {
                        this.doNextChain(secondNotify);
                    }
                } else {
                    for (i = 1; i < len; i++) {
                        aReq = this.getDbPhotos(fetchList[i]);
                        if (secondNotify) {
                            aReq.nextChain = secondNotify; // attach the secondNotify to every getDbPhotos();
                        }                                  // the albumsOfPhotoReceived count is used by the
                    }                                      // secondNotify to determine the last instance of
                }                                          // getDbPhotos(), and then it is the last instance
            },                                             // when the secondNotify is fully executed through
            args: [ fetchList, firstNotify, secondNotify ]
        };
        var req = this.getDbPhotos(fetchList[0]);
        req.nextChain = nextChain;
    },

    /**
     * Invokes the method supplied in the nextChain
     *
     * @param nextChain is an object containing the following properties.
     *        { scope,  (optional) it is an object to be used as the scope to invoke the method.
     *                             If it is omitted, then this instance of SlideshowPlayList is assumed.
     *          method, (required) it is the function to be invoked.
     *          args    (optional) it is an array of parameters to be passed onto the method.
     *        }
     */
    doNextChain: function (nextChain) {
        var args = undefined;
        if (!nextChain || !nextChain.method || typeof nextChain.method != "function") { return; }
        var scope = nextChain.scope ? nextChain.scope : this;
        if (nextChain.args) { args = nextChain.args; }
        nextChain.method.apply(scope, args);
    },

    /**
     * This methos is called when a requested appScreenNail is generated.  It first updates the playList,
     * then it notifies registered observers.
     */
    updatePhotoScreenNailPath: function (screenNailFactory, dbEntry) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList.updatePhotoScreenNailPath(): update photo "+dbEntry._id+" with "+dbEntry.appScreenNail.path);
        var albumId = dbEntry.albumId;
        var pictId = dbEntry._id;
        var screenNailPath = dbEntry.appScreenNail && dbEntry.appScreenNail.path ? dbEntry.appScreenNail.path : null;
        if (!screenNailPath) { return; }
        if (!this.photos || !this.photos[albumId] || !this.photos[albumId][pictId]) { return; }
        var pictMeta = this.photos[albumId][pictId];
        if (!pictMeta.dbEntry.appScreenNail) { pictMeta.dbEntry.appScreenNail = {}; }
        pictMeta.dbEntry.appScreenNail.path = screenNailPath.slice(0);
        pictMeta.screenNailPath = pictMeta.dbEntry.appScreenNail.path;
        pictMeta.cached = true;

        this.doScreenNailGenNotify(dbEntry);      // notify the observer that the screenNail is generated
    },

    /**
     * @protected
     * This method is private to getSrcByPlayListIndex() and getSrcByPictId().  It does not do
     * any validation nor checking.  It factories a source object representing an item in the
     * play list.
     *
     * @return It returns a source object { playListIndex, albumId, pictId, path } where the
     *         path can be the path to either the generated screen nail JPG or the original
     *         downloaded JPG.
     */
    _createSrcRepresentation: function (index) {
        var item = this.playList[index];
        var src = {
            playListIndex: index,
            albumId: item.album.albumId.slice(0),
            pictId:  item.pict.pictId.slice(0)
        };
        if (item.pict.screenNailPath) {
            src.path = item.pict.screenNailPath.slice(0);
        } else {
            src.path = item.pict.originalPath.slice(0);
//console.log('****@@@@@@><@@@@@@**** vidslide  SlideshowPlayList._createSrcRepresentation('+index+'): about to request screenNail for "'+src.path+'"...');
            this.$.screenNailFactory.requestToGenerateScreenNail(item.pict.dbEntry);
        }
        return src;
    },

    /**
     * It returns a source object representing an item from the play list identified by the index.
     *
     * @param index It is the index into the play list for a play list item.
     *
     * @retrun (@see _createSrcRepresentaiton() for details)
     */
    getSrcByPlayListIndex: function (index) {
        if (undefined == index || null == index || !this.playList) { return null; }
        var len = this.playList.length;
        if (len == 0 || index < 0 || index >= len) { return null; }
        return this._createSrcRepresentation(index);
    },

    /**
     * It returns a source object representing an item from the play list identified by a pictId.
     * This method is costly as it takes O(N) looping through the play list for the matching pictId.
     * Use this method only when the an index to the play list is not valid.  Otherwise, use the
     * getSrcByPlayListIndex() for better response.
     *
     * @param pictId It is the pictId for an item from the play list to get.
     *
     * @retrun (@see _createSrcRepresentaiton() for details)
     */
    getSrcByPictId: function (pictId) {
        if (!this.playList) { return null; }
        var len = this.playList.length;
        var i, item, src = null;
        for (i = 0; i < len; i++) {
            item = this.playList[i];
            if (item.pict.pictId != pictId) { continue; }
            src = this._createSrcRepresentation(i);
            break;
        }
        return src;
    },

    /**
     * It returns the play list index to the pictId, as well as its previous and next.  If the
     * pictId is the first, then its previous is the last in the play list.  If the pictId is
     * the last, then its next is the first in the play list.
     *
     * @return It returns null if the pictId is not found, or an object of...
     *         { previous: { index, pictId },
     *           center:   { index, pictId },
     *           next:     { index, pictId }
     *         }
     */
    getPlayListIndexByPictId: function (pictId) {
        if (!this.playList) { return null; }
        var i, len, triplet = null;
        for (i = 0, len = this.playList.length; i < len; i++) {
            if (this.playList[i].pict.pictId != pictId) { continue; }
            triplet = { center: { index: i, pictId: pictId } };
            triplet.next = i+1 == len ? { index: 0,     pictId: this.playList[0].pict.pictId.slice(0) } :
                                        { index: i+1,   pictId: this.playList[i+1].pict.pictId.slice(0) };
            triplet.previous = i == 0 ? { index: len-1, pictId: this.playList[len-1].pict.pictId.slice(0) } :
                                        { index: i-1,   pictId: this.playList[i-1].pict.pictId.slice(0) };
            break;
        }
        return triplet;
    },

    /**
     * A debugging helper method.
     *
     * @param resp expecting an object having { results: [ { _id, name, total: { images }, ... }, ... ] }
     */
    albumsDbResult2String: function (resp) {
        var len = resp && resp.results && resp.results.length > 0 ? resp.results.length : 0;
        var str = "["+len+"]";
        if (0 == len) { return str; }
        var i, arr = [ str ];
        for (i = 0; i < len; i++) {
            arr.push('{"'+resp.results[i].name+'", '+resp.results[i].total.images+'}');
        }
        return arr.join(" ");
    }
});
