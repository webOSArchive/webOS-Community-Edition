/*global enyo, console, window, webosEvent */
enyo.kind({
	name: 'DbImageViewIndexFinder',
	kind: 'Component',
	events: {
		onQuery: '',
		onIndexFound: '',
		onError: ''
	},
	create: function() {
		this.inherited(arguments);
    this.log(" ENYO PERF: TRANSITION START time: "+ Date.now());
		if (!this.pictureId) { throw new Error('no picture-ID specified'); }
		if (!this.albumId) { throw new Error('no album-ID specified'); }

		this.startTime = Date.now();
		this.index = 0;

		console.log('******@@@@@@@@@  CREATED PictureIndexFinder for album: ' + this.albumId + '  picture: ' + this.pictureId);

		// Because otherwise this fires before we the assignment to "this.finder" happens,
		// which causes the initial query to go awry.
		enyo.asyncMethod(this, 'doQuery', this.queryParams(), {subscribe: false});
//		this.doQuery(this.queryParams());
	},
	profileStart: function() {
		if (!window.PalmSystem) return;
		webosEvent.start('', 'photos.ImageView.indexFinder', Array.prototype.splice.call(arguments,0).join(''));
	},
	profileStop: function() {
		if (!window.PalmSystem) return;
		webosEvent.stop('', 'photos.ImageView.indexFinder', Array.prototype.splice.call(arguments,0).join(''));
	},
	queryParams: function() {
		return {
			select: ['_id'],
			limit: 100
		};
	},
	queryResponse: function(inResponse, inRequest) {
		var results = inResponse.results;
		this.profileStart('count: ', results.length, '   next: ', inResponse.next);

		// This shouldn't be necessary, since we explicitly avoided setting up a
		// watch on this query (by adding the extra property of {subscribe: false}).
		// But it is.
		inRequest.destroy();

		var i;
		for (i=0; i < results.length; i++) {
			if (results[i]._id === this.pictureId) {
				this.index += i;
				var elapsed = Date.now() - this.startTime;
				this.profileStop('Found index: ', this.index, ' in: ', elapsed, 'ms');
				this.doIndexFound(this.index, results[i], inRequest.handle, inResponse.next);
				return;
			}
		}
		this.index += results.length;
		if (inResponse.next) {
			console.log('Doing another query...');
			var query = this.queryParams();
			query.page = inResponse.next;
			var req = this.doQuery(query, {subscribe: false});
			// Stash the handle so that we can later use it to initialize the
			// DbImageView's DbPages, thereby avoiding an extra DB traversal.
			req.handle = inResponse.next;
		}
		else {
			this.doError('looked through entire DB without success');
		}
		this.profileStop();
	},
	_queryFail: function() {
		console.log('******@@@@@@@@@  QUERY FAILED');
		this.doError('query failed');
	}
});


enyo.kind({
	name: 'DbViewImage',
	kind: 'enyo.ViewImage',
	// required field to be populated
	mediaType: undefined,
	// IMPORTANT IMPORTANT IMPORTANT: don't change this file without talking to Josh.
	// Do not think about substituting it for one with different dimensions.
	videoStubSrc: 'images/blank-video.png',
	create: function(spec) {
		this.type = spec.dbEntry.type;
		this.owner = spec.owner; // _srcFromDbEntry() needs this to already be set, uugh!
		this.src = this._srcFromDbEntry(spec.dbEntry);
		this.inherited(arguments);  // this will call srcChanged()
	},
	getMediaType: function () {
		return this.mediaType;
	},
	getType: function () {
		return this.type;
	},
	updateFromSpec: function(newSpec) {
		if (newSpec.kind !== this.kind) {
			// The new spec specifies a different view-kind,
			// so is incompatible.
			return false;
		} else if ("DbViewVideo" == newSpec.kind) {
			// if both are videos, then further check if they are different videos.  This happens after
			// deleting a video, and the next slide is also a video, but a different one.
			if (this.dbEntry._id != newSpec.dbEntry._id) {
				return false;
			}
		}
		this.dbEntry = newSpec.dbEntry;
		var newSrc = this._srcFromDbEntry(newSpec.dbEntry);
		if (newSrc !== this.src) {
			this.setSrc(newSrc);
		}
		return true;
	},
	_srcFromDbEntry: function(dbEntry) {
		// Use screennail if we have one, otherwise fall back to lower-quality image.
		if (dbEntry.appScreenNail) { return dbEntry.appScreenNail.path; }
		var entry = null;
		if (dbEntry.mediaType === 'video' && !dbEntry.appGridThumbnail) {
			entry = this.mockVideoDbEntry(dbEntry);
		} else {
			entry = dbEntry;
		}
		var path;
		if (entry.appGridThumbnail) { path = entry.appGridThumbnail.path; }
		else {
			console.warn('falling back to full-resolution image (will be slow)');
			path = entry.path;
		}

		// Request screennail generation.  We may have already requested one;
		// that's OK because the requests are idempotent, and we always want
		// the currently-viewed picture to have its request on top of the task-stack.
		// Note that although we don't currently generate video screennails,
		// it can't hurt to ask.
		this.owner.makeScreenNailRequest(entry);

		return path;
	},
	mockVideoDbEntry: function (dbEntry) {
		var mock = {}, p;
		for (p in dbEntry) {
			if (dbEntry.hasOwnProperty(p)) { mock[p] = dbEntry[p]; }
		}
		mock.appGridThumbnail = {
			cached: true,
			path: this.videoStubSrc
		};
		mock.appStripThumbnail = {
			cached: true,
			path: this.videoStubSrc
		};
		return mock;
	}
});


enyo.kind({
	name: 'DbImageView',
	kind: 'VFlexBox',
	published: {
		pageSize: 5,
		albumId: null,
		debugging: true
	},
	events: {
		onChangePicture: '',  // think of a better name
		onSwipe: '',
		onLeave: ''
	},
	imageIndex: 0,
	left: null,
	center: null,
	right: null,
	components: [
		{kind: 'DbService',
			method: 'find',
			dbKind: 'com.palm.media.types:1',
			subscribe: true,
			resubscribe: true,
			onSuccess: '_queryResponse',
			onFailure: '_queryFail',
			reCallWatches: true
		},
		{kind: 'PalmService',
			name: 'screenNailGenerator',
			service: 'palm://com.palm.service.photos/',
			method: 'facebookGenerateImgForBigView',
			subscribe: false,
			onSuccess: '_photosServiceResponse',
			onFailure: '_photosServiceFailure'
		},
		{kind: 'DbPages', desc: true, onQuery: '_queryService'},
		{kind: 'Buffer', overbuffer: 0, margin: 0, onAcquirePage: '_acquirePage', onDiscardPage: '_discardPage'},
		{kind: 'BufferView'},  // debugging
		{kind: 'TemperateCarousel',
			name: 'imageView',
			flex: 1,
			accelerated: false,
			onGetRight: '_getRight',
			onGetLeft: '_getLeft',
			onSnapFinish: '_handleSnapFinish'
		}
	],
	create: function() {
		if (!window.PalmSystem) {
			// Set up to use mock data.
			this.pageSize = 50;
		}

		this.inherited(arguments);

		if (enyo.mock) {
			this.$.dbService.mockDataProvider = function (req) {
				return enyo.mock.photos.albumIdToUri[req.params.query.where[0].val];
			};
		}

		this.pageSizeChanged();
		this.debuggingChanged();
	},
	setLibrary: function (lib) {
		this.library = lib;
	},
	debuggingChanged: function() {
		this.$.bufferView && this.$.bufferView.setShowing(this.debugging);
	},
	albumIdChanged: function(oldId) {
		if (oldId === this.albumId) { return; } // no change
		console.log('Set albumId to ' + this.albumId);
		this._resetDbPages();
		this.$.buffer.flush();
	},
	setShowControlsGroup: function (controlsGroup) {
		this.showControlsGroup = controlsGroup;
	},
	setHideControlsGroup: function (controlsGroup) {
		this.hideControlsGroup = controlsGroup;
	},
	viewPicture: function(pictureId) {
		if (this.finder) {
			console.log('cancelling previous find-picture-index request');
			this.finder.destroy();
		}
		this.finder = this.createComponent({
			kind: 'DbImageViewIndexFinder',
			name: 'dbImageViewIndexFinder',
			pictureId: pictureId,
			albumId: this.albumId,
			onQuery: '_queryService',
			onIndexFound: 'foundPictureIndex',
			onError: 'failedToFindPictureIndex'
		});
	},

	reset: function() {
		var iv = this.$.imageView;

		// XXXXX not sure why this is the right place for this.
		var currView = iv.fetchView('center');
		if (currView && currView.onSwipeHandler) { currView.onSwipeHandler(); }

		iv.$.left.destroyControls();
		iv.$.center.destroyControls();
		iv.$.right.destroyControls();

		this.left = null;
		this.center = null;
		this.right = null;

		this.imageIndex = null;
	},
	foundPictureIndex: function(finder, index, dbEntry, handle, next) {
		console.log('found index ' + index + ' for entry ' + dbEntry._id);

		this.firstShownPictId = dbEntry._id;
		var centerView = null;

		this.finder.destroy();
		this.finder = null;

		// Always show the middle image first.  Don't show
		// anything until we are sure that there is something
		// to display there; see _updateLeftCenterRight().
		this.waitingForInitialPages = true;
		this.imageIndex = index;
		this.updateAfterSnap = false;

		// Figure out the range of pages to query for.  For the top page,
		// use the same query-response-handle used by the index-finder,
		// so that we don't have to traverse the DB from the beginning again.
		var hundredMarker = this._rowToPage(100 * Math.floor(index/100));
		var topPage = hundredMarker-2;
		var bottomPage = this._rowToPage(index) + 2 ;

		// We don't use _adjustBufferBoundaries(), because that will
		// lead to querying all of the pages between the old and new
		// positions.
		this._resetDbPages();
		this.$.buffer.top = topPage;
		this.$.buffer.bottom = bottomPage;
		// Poke the buffer, so that it tells the DbPages about the
		// new pages of interest.
		this.$.buffer.refresh();

		// This one query will cause the rest of the region-of-interest
		// to be queried for... once the response comes into the DbPages,
		// any adjacent desired pages can be queried for, eg: via the
		// next-page handle.
		this.$.dbPages.setHandle(hundredMarker, handle);

		// XXXXX Now that we also call this in _queryResponse(), we
		// probably don't need it here.  However, I'm not taking any
		// unnecessary risks during code lockdown.
		this.doChangePicture();  // notify any observers
	},
	failedToFindPictureIndex: function(finder, origin, msg) {
		console.log('Failed to find index of picture because: ' + msg);
		this.finder.destroy();
		this.finder = null;

		this.doChangePicture();  // notify any observers
	},
	pageSizeChanged: function() {
		this.$.dbPages.size = this.pageSize;
	},
	doSwipeNotify: function (arg) {
		// arg = { direction: "next|previous", suspendingView, activatingView }
		this.onSwipeHandler(arg);
		this.doSwipe(arg);         // notify the observers
    },
	onSwipeHandler: function (arg) {
		// arg = { direction: 'next|previous', suspendingView, activatingView }
		this.onSwipeOutHandler(arg);
		this.onSwipeInHandler(arg);
	},
	onSwipeOutHandler: function (arg) {
		// arg = { direction: "next|previous", suspendingView, activatingView }
		if (arg.suspendingView && arg.suspendingView.onSwipeOutHandler) { arg.suspendingView.onSwipeOutHandler(); }
	},
	onSwipeInHandler: function (arg) {
		// arg = { direction: "next|previous", suspendingView, activatingView }
		if (arg.activatingView && arg.activatingView.onSwipeInHandler) { arg.activatingView.onSwipeInHandler(); }
	},
	_adjustBufferBoundaries: function() {
		// Manually manage buffer-margin.
		var topPage = this._rowToPage(this.imageIndex) - 2;
		var bottomPage = this._rowToPage(this.imageIndex) + 2;

		this.$.buffer.adjustTop(topPage);
		this.$.buffer.adjustBottom(bottomPage);

		if (this.debugging) {
			this.$.bufferView.update(this.$.buffer);
		}
	},
	_getLeft: function(inSender, isTransition) {
		var suspendingView = null, activatingView = null;
		// If the imageIndex is null, we're not displaying anything.
		if (this.imageIndex === null) { return null; }

		if (isTransition) {
			// Update the index and the DB range that we're interested in.
			this.imageIndex--;
			this._adjustBufferBoundaries();

			suspendingView = this.$.imageView.fetchView('right');
			if (suspendingView && suspendingView.suspend) {
				suspendingView.suspend();
			}

			// Slide existing view-specs over and create new spec for the open space.
			this.right = this.center;
			this.center = this.left;
			this.left = this._createViewSpec(this.imageIndex - 1);

			activatingView = this.$.imageView.fetchView('center');
			this.doSwipeNotify(
				{ direction: 'previous', suspendingView: suspendingView, activatingView: activatingView });

			// Notify observers.
			this.doChangePicture();
		}
//		console.log('Request for LEFT: ' + JSON.stringify(this.left.spec));
		return this.left;
	},
	_getRight: function(inSender, isTransition) {
		var suspendingView = null, activatingView = null;
		// If the imageIndex is null, we're not displaying anything.
		if (this.imageIndex === null) { return null; }

		if (isTransition) {
			// Update the index and the DB range that we're interested in.
			this.imageIndex++;
			this._adjustBufferBoundaries();

			suspendingView = this.$.imageView.fetchView('left');
			if (suspendingView && suspendingView.suspend) {
				suspendingView.suspend();
			}

			// Slide existing view-specs over and create new spec for the open space.
			this.left = this.center;
			this.center = this.right;
			this.right = this._createViewSpec(this.imageIndex + 1);

			activatingView = this.$.imageView.fetchView('center');
			this.doSwipeNotify(
				{ direction: 'next', suspendingView: suspendingView, activatingView: activatingView });

			// Notify observers.
			this.doChangePicture();
		}

//		console.log('Request for RIGHT: ' + JSON.stringify(this.right.spec));
		return this.right;
	},
	_queryResponse: function(inSender, inResponse, inRequest) {
		// If we have a DbImageViewIndexFinder, then the response should go to it.
		if (this.finder) {
			this.finder.queryResponse(inResponse, inRequest);
			return;
		}

//		console.log('&& queryResponse()     count: ' + inResponse.results.length + '   next: ' + inResponse.next);

		// Update the DB pages with the new data.
		var pages = this.$.dbPages;
		pages.queryResponse(inResponse, inRequest);

		// Typical case.. go ahead and update views.
		if (!this.waitingForInitialPages) {
			// guard against unnecessary calls to the _updateLeftCenterRight() on exiting picture mode
			// it appears that _queryResponse() is also got called on exiting picture mode, not sure why
			if (this.owner.isPictureMode()) {
				this._updateLeftCenterRight();
				this.log(" ENYO.PERF: TRANSITION DONE time: " + Date.now());
			}
		}
		// If we reach here, we were recently told to "seek" to a particular picture in a particular
		// album.  The goal is to not update the view until all of the necessary/available information
		// has arrived from the DB.  We know that this has occurred if:
		//   - the DbPages has data for the center and right views (not the left... think about it), or
		//   - there is no "next" property in the DB-response (and we're heading in the "query direction")
		else if ( (!inResponse.next && (inRequest.params.query.desc === this.$.dbPages.desc) ) || (pages.fetch(this.imageIndex) && pages.fetch(this.imageIndex+1))) {
			console.log('finished waiting for initial pages');
			this.waitingForInitialPages = false;  // our long wait is over!
			this._updateLeftCenterRight();
			this.doChangePicture();
		}
		// Keep on waiting for the next page of data.
		else { }

		this.profileStop('photos.ImageView.queryResponse');
	},
	_handleSnapFinish: function() {
		if (this.updateAfterSnap) {
			this.updateAfterSnap = false;
			this._updateLeftCenterRight();
			this.log(" ENYO.PERF: TRANSITION DONE time: " + Date.now());
		}
	},
	_updateLeftCenterRight: function() {
		// console.log('_updateLeftCenterRight .....   called from: ' + arguments.callee.caller);
		console.log('_updateLeftCenterRight');
		this.profileStart('photos.ImageView.updateLeftCenterRight');
		var iv = this.$.imageView;
		if (iv.snapping && iv.index !== 1) {
			// XXXXX For some reason, the carousel can be in a state where the index isn't 1
			// (i.e. the center view-image).  This might be expected for the first or last
			// picture in an albume, but there is also a race-condition that can provoke it
			// in the middle of an album.  If I chould characterize it better, I would write
			// a JIRA bug, but instead I try to work around it here.  The workaround is simply
			// to wait for the snap to finish before updating.
			console.log('deferring update until snap-finish');
			this.profileStop('photos.ImageView.updateLeftCenterRight', 'deferring update until snap-finish');
			this.updateAfterSnap = true;
			return;
		}

		// If the imageIndex is null, we're not displaying anything.
		if (this.imageIndex === null) {
			this.profileStop('photos.ImageView.updateLeftCenterRight', 'imageIndex is null');
			return null;
		}

		// Check whether the desired image is available, and take action if it isn't.
		var pages = this.$.dbPages;
		if (!pages.fetch(this.imageIndex)) {
			// If the previous image exists, then view it instead.
			// (this handles the case where the user deletes the last image)
			if (pages.fetch(this.imageIndex-1)) {
				--this.imageIndex;
			}
			// There's no image to view, so leave fullscreen view.
			else {
				// Stop profiling first, because it's not part of the left/center/right update.
				this.profileStop('photos.ImageView.updateLeftCenterRight', 'imageIndex is null');
				console.log("failed to fetch center image... leaving full-screen mode");
				this.doLeave();
				return null;
			}
		}

		// Update the left, center, and right views.  For each view (left/right/center)...
		var viewNames = ['center', 'left', 'right']; // do it in this order for smart screennail generation
		var viewIndices = [0, -1, 1];
		var totalReset = false;
		var i;
		for (i=0; i <= 2; i++) {
			// Stash the old spec and generate a new one.
			var nm = viewNames[i];
			var oldSpec = this[nm];
			var newSpec = this[nm] = this._createViewSpec(this.imageIndex+viewIndices[i]);

			// If one is null and the other isn't, then just do a total reset...
			if (!!oldSpec !== !!newSpec) {
				totalReset = true;
			}
			// ... otherwise, try to update the existing view, and do a total reset if we can't.
			else if (newSpec && oldSpec) {
				var existingView = iv.fetchView(nm);
				if (totalReset) {
					// Nothing to do... don't bother updating the existing view since
					// we're just going to tear it down anyway.
				}
				else if (!existingView) {
					// Hmmm, that's freakin' weird.  This is unexpected and represents a bug in
					// our code (or in enyo's Carousel)... let's try to cope as best we can.
					console.warn('No ' + nm + '-view exists for spec: ' + enyo.json.stringify(newSpec));
					totalReset = true;
				}
				// Attempt to update the existing view using the new spec.  If this can't happen
				// for whatever reason (eg: due to the removal of a DB entry, index 42 used to be
				// a photo and now it's a video), then tear everything down and rebuild from scratch.
				else if (!existingView.updateFromSpec(newSpec)) {
					console.log('Resetting ' + nm + '-view; could not update from spec: ' + enyo.json.stringify(newSpec));
					totalReset = true;
				}
				else {
					// Successfully updated existing view.  Yay!
				}
			}
			// ... otherwise, both old and new are null.  Nothing has changed, so do nothing.
		}

		// After all that, we may have decided that we need to tear down the existing
		// views and rebuild them from scratch.  However, if we're in the middle of snapping,
		// defer the update until the snap is finished... this should be less visually jarring.
		if (totalReset) {
			if (!iv.snapping) {
				this.profileStart('photos.ImageView.totalReset');

				// Make a screennail-generation request in advance so that,
				// if the service task-stack is empty, it begins processing
				// the request immediately (if we don't do this, setCenterView()
				// will cause the left view to have its screennail to be
				// generated first.
				this.makeScreenNailRequest(this.center && this.center.dbEntry);

				iv.setCenterView(this.center);

				// Make another screennail-generation request afterward,
				// so that if there was already a task in progress, the
				// next task will be to process the screennail of the
				// currently-viewed image.
				this.makeScreenNailRequest(this.center && this.center.dbEntry);

				this.profileStop('photos.ImageView.totalReset');
				this.profileStop('photos.ImageView.updateLeftCenterRight', 'finished total reset');
			}
			else {
				// XXXXX We have a test for 'snapping' at the top of the function,
				// but we're also testing the index.  Ideally we can collapse this
				// into a single test, but I don't have time for that now.
				console.log('deferring total reset until snap-finish');
				this.updateAfterSnap = true;
				this.profileStop('photos.ImageView.updateLeftCenterRight', 'deferred total reset until snap finish');
			}
		}
		else {
			// Re-request the screennail for the middle view.  The intent is to, whenever we
			// change the currently-viewed image, to request screennails in the order
			// center-left-right-center.  This way, if there is nothing in the photos-service
			// task-stack, we'll process the screennail immediately, but if there is we'll also
			// push a task on top.
			// Only do this if we're not tearing everything down.
			this.makeScreenNailRequest(this.center && this.center.dbEntry);
			this.profileStop('photos.ImageView.updateLeftCenterRight', 'finished normally');
		}

		// XXXXX Simon's video stuff... can we delegate this to the DbViewVideo somehow?
		var centerView = iv.fetchView('center');
		if (centerView && centerView.dbEntry) {
			if ('video' === centerView.dbEntry.mediaType) {
				centerView.setInFocus && centerView.setInFocus(true);
				if (this.firstShownPictId) {
					if (this.firstShownPictId === centerView.dbEntry._id) {
						delete this.firstShownPictId;
						centerView.autoStartOnLoad && centerView.autoStartOnLoad();
					}
				}
			}
		}

	},
	_createViewSpec: function(dbIndex) {
		var dbEntry = this.$.dbPages.fetch(dbIndex);
		if (!dbEntry) {
			// Cannot create a spec if there is no dbEntry
			return null;
		}
		switch(dbEntry.mediaType) {
			case 'video':
				return {
					kind: 'DbViewVideo',
					dbEntry: dbEntry
				};
			case 'image':
			case null:
			case undefined:
				return {
					kind: 'DbViewImage',
					dbEntry: dbEntry
				};
			default:
				console.warn('Unknown media type: ' + dbEntry.mediaType);
				return null;
		}
	},

	/**
	 * If the center view is among the changed, and it has a null spec, then it is an invalid change.
	 *
	 * @param viewChanges It is an array of views to be changed (see updateCarouselViews for details.)
	 *
	 * @return It returns a boolean for the validity of the views changed.
	 */
	validateViewChanges: function (viewChanges) {
		if (!viewChanges || 0 === viewChanges.length) {
			return true;    // assuming that there's no change, which is valid
		}
		var i, def, view, albumInfo, count, isValid = true, len = viewChanges.length;

		for (i = 0; i < len && isValid; i++) {
			def = viewChanges[i];
			// may check def.spec, def.spec.dbEntry.path, etc...
			switch (def.viewName) {
				case "center":
					if (!def.spec) {
						// when the center view has a null spec, it could either be caught across the
						// DbPages boundary or is at the last slide being deleted.  If the imageIndex
						// is not at the last slide, then it is most likely being caught across the
						// DbPages boundary, then let's assume there's more to come and not to invalidate
						// it.  However, if the imageIndex is at the last slide, then we cannot be certain,
						// so to invalidate it letting the callee to handle it.
						albumInfo = this.library.getAlbum(this.albumId);
						count = albumInfo.photoCount + albumInfo.videoCount;
						if (this.imageIndex >= count - 1) {
							isValid = false;
						}
					}
					break;
				case "left":
					break;
				case "right":
					break;
				default:
					break;
			}
		}

		return isValid;
	},

	suspend: function () {
		var view = this.$.imageView.fetchView("center");
		if (view && view.suspend) {
			view.suspend();
		}
	},

	_queryFail: function(inSender, inResponse) {
		console.log('&& queryFailure():   ' + enyo.json.stringify(inResponse));
	},
	_rowToPage: function(inRow) {
		return Math.floor(inRow / this.pageSize);
	},
	// Query the DB when the DbPages sez to.
	_queryService: function(inSender, inQuery, extraProps) {
		console.log('&& _queryService()  ' + JSON.stringify(inQuery));
		inQuery.where = [{prop: 'albumId', op: '=', val: this.albumId}, {prop: 'appCacheComplete', op: '=', val: true}];
		inQuery.orderBy = 'createdTime';
		if (this.finder) {
			// So that query also works for pointer-index-finder.  Note that
			// this relies on an enyo.asyncMethod in DbImageViewIndexFinder.create()
			inQuery.desc = this.$.dbPages.desc;
		}
		return this.$.dbService.call({query: inQuery}, extraProps);
	},
	_acquirePage: function(inSender, inPage) {
//		console.log('&& _acquirePage() ' + inPage);
		this.$.dbPages.require(inPage);
	},
	_discardPage: function(inSender, inPage) {
//		console.log('&& _discardPage() ' + inPage);
		this.$.dbPages.dispose(inPage);
	},
	// XXXXX: it appears that DbPages has no way to clear itself out,
	// so I'll do it myself.  Probably should communicate this need
	// to Scott, and figure out with him what to do.
	_resetDbPages: function() {
		console.log('starting reset of DbPages');
		var dbp = this.$.dbPages;
		dbp.pages.forEach(function(p) {
			if (p.request) { p.request.destroy(); }
		});
		dbp.min = 9999;
		dbp.max = 0;
		dbp.pages = [];
		dbp.handles = [];
		console.log('finished reset of DbPages');
	},

	resize: function() {
		this.$.imageView.resize();
	},


	// ----------------------- Window / View management ----------------------------------

	onLeaveView: function () {
		var currView = this.$.imageView.fetchView('center');
		if (currView && currView.onLeaveView) { currView.onLeaveView(); }
    },
	windowDeactivatedHandler: function () {
		var currView = this.$.imageView.fetchView('center');
		if (currView && currView.windowDeactivatedHandler) { currView.windowDeactivatedHandler(); }
	},
	windowActivatedHandler: function () {
		var currView = this.$.imageView.fetchView('center');
		if (currView && currView.windowActivatedHandler) { currView.windowActivatedHandler(); }
	},
	unloadHandler: function () {
		// app exit, i.e. the card gets swipped away
		var currView = this.$.imageView.fetchView('center');
		if (currView && currView.unloadHandler) { currView.unloadHandler(); }
	},
	windowTossedHandler: function () {
		// the card gets tossed away but the app is still running in the keep-alive mode
		var views = [ 'left', 'right', 'center' ];
		var i, view, len = views.length;
		for (i = 0; i < len; i++) {
			view = this.$.imageView.fetchView(views[i]);
			if (view && view.unloadHandler) { view.unloadHandler(); }
		}
},


	// ----------------------- Performance profiling -------------------------------------

	profileStart: function(label, restOfArgs) {
		if (!window.PalmSystem) return;
		webosEvent.start('', label, Array.prototype.splice.call(arguments,1).join(''));
	},
	profileStop: function(label, restOfArgs) {
		if (!window.PalmSystem) return;
		webosEvent.stop('', label, Array.prototype.splice.call(arguments,1).join(''));
	},


	// ----------------------- Screennail Generation -------------------------------------

	makeScreenNailRequest: function(dbEntry) {
		if (dbEntry && !dbEntry.appScreenNail) {
			this.$.screenNailGenerator.call(dbEntry);
		}
	},
	_photosServiceResponse: function(inSender, inResponse) {
		console.log('&& _photosServiceResponse(): ' + enyo.json.stringify(inResponse));
	},
	_photosServiceFailure: function(inSender, inResponse) {
		console.log('&& _photosServiceFailure(): ' + enyo.json.stringify(inResponse));
	}
});
