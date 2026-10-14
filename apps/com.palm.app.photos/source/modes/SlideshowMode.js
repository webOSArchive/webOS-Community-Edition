enyo.kind({
    name: "SlideshowMode",
    kind: "Control",
    className: "slideshow",
    events: { onLeave: '' },
    isCarded: false,
    slidingIntervals: {
        currentPrefix: undefined,
        t5:      5000,
        t10:    10000,
        t30:    30000,
        t1m:    60000,
        t5m:   300000,
        t30m: 1800000,
        t1hr: 3600000,
        defaultPrefix: "t10"
    },
    components: [
        { name: "swipeTransition", kind: "SwipeTransition",
              onTap: "onTapHandler", onAbort: "attemptToRecover", onNoPhotoToPlay: "onNoPhotoToPlayHandler" },
        { name: "displayStats", kind: "PalmService", service: "palm://com.palm.display/",
          method: "control/status", subscribe: true,
          onSuccess: "onDisplayStatusHandler", onFailure: "onDisplayStatusFailureHandler"
        },
        { name: "playList", kind: "SlideshowPlayList",
          onScreenNailGenNotify: "screenNailGenNotify", onPlayListChangeNotify: "playListChangeNotify" },
        { name: "msgDialog", kind: "MessageDialog",
              message: $L("Please download more photos to play slideshow.")
        }
    ],

    exhibitionModeComponents: [
        { name: "toolbar", kind: "HFlexBox", className: "toolbar hide-toolbar",
          components: [
              { name: "toolbarCaption", content: $L("Slideshow") },
              { name: "spacer", flex: 1},
              { name: "selAlbumDrpDwnBtn", 
                  kind: "Button", 
                  className: "enyo-button-dark", 
                  onclick: 'toggleSelAlbumMenu',
                  components: [
                      { name: "btnPane", kind: "HFlexBox",
                        components: [
                            { name: "dropBtnCaption", content: $L("Select Album") },
                            { name: "dropdownImage", kind: "Image", className: "enyo-menuitem-arrow",
                                  style: "width:22px;height:20px"
                            }
                        ]
                      }
                  ]
              }
          ]
        },
        { name: "dropdown", kind: "AlbumSelectionDrawer",
          className: "album-select-pane first-use", onSelectionDone: "onAlbumSelectionDoneHandler"
        },
        { name: "commandbar", kind: "HFlexBox", className: "commandbar hide-commandbar",
          components: [
              { name: "spacerLeft", flex: 1 },
              { name: "shuffleButton", kind: "Button", className: "enyo-button-dark", style:"overflow:hidden",
                    onclick: "onShuffleClicked",
                    components: [
                        { name: "shuffleBtnImg", kind: "Image", className: "shuffle",
                          src: "images/icn-shuffle.png" }
                    ]
              },
              { name: "spacer1", style: "width:60px" },
              { name: "playButton", kind: "Button", className: "enyo-button-dark", style:"overflow:hidden",
                    onclick: "onPlayClicked",
                    components: [
                        { name: "playBtnImg", kind: "Image", className: "pause",
                          src: "images/icn-pause.png" }
                    ]
              },
              { name: "spacerCenter", style: "width:60px" },
              { name: "timingButton", kind: "Button", className: "enyo-button-dark",
                    style: "overflow:hidden", onclick: "onTimingClicked",
                    components: [
                        { name: "timingBtnImg", kind: "Image", className: "timer",
                          src: "images/icn-time.png" }
                    ]
              },
              { name: "spacerRight", flex: 1 }
          ]
        },
        { name: "slideup", kind: "enyo.BasicDrawer", className: "timing-menu hide",
          components: [
              { name: "t5sec", kind: "Control", className: "timing-menu-item",
                    prefix: "t5", onclick: "setTimerHandler",
                    components: [ { name: "t5Check", kind: "Control", className: "tCheckBox tUnchecked" },
                                  { name: "t5Label", content: $L("5 seconds"), className:"timing-menu-label"}
                                ]
              },
              { name: "t10sec", kind: "Control", className: "timing-menu-item",
                    prefix: "t10", onclick: "setTimerHandler",
                    components: [ { name: "t10Check", kind: "Control", className: "tCheckBox tUnchecked" },
                                  { name: "t10Label", content: $L("10 seconds"),className:"timing-menu-label"}
                                ]
              },
              { name: "t30sec", kind: "Control", className: "timing-menu-item",
                    prefix: "t30", onclick: "setTimerHandler",
                    components: [ { name: "t30Check", kind: "Control", className: "tCheckBox tUnchecked" },
                                  { name: "t30Label", content: $L("30 seconds"),className:"timing-menu-label"}
                                ]
              },
              { name: "t1min", kind: "Control", className: "timing-menu-item",
                    prefix: "t1m", onclick: "setTimerHandler",
                    components: [ { name: "t1mCheck", kind: "Control", className: "tCheckBox tUnchecked" },
                                  { name: "t1mLabel", content: $L("1 minute"), className:"timing-menu-label"}
                                ]
              },
              { name: "t5min", kind: "Control", className: "timing-menu-item",
                    prefix: "t5m", onclick: "setTimerHandler",
                    components: [ { name: "t5mCheck", kind: "Control", className: "tCheckBox tUnchecked" },
                                  { name: "t5mLabel", content: $L("5 minutes"), className:"timing-menu-label"}
                                ]
              },
              { name: "t30m", kind: "Control", className: "timing-menu-item",
                    prefix: "t30m", onclick: "setTimerHandler",
                    components: [ { name: "t30mCheck", kind: "Control", className: "tCheckBox tUnchecked" },
                                  { name: "t30mLabel",content: $L("30 minutes"),className:"timing-menu-label"}
                                ]
              },
              { name: "t1hr", kind: "Control", className: "timing-menu-item",
                    prefix: "t1hr", onclick: "setTimerHandler",
                    components: [ { name: "t1hrCheck", kind: "Control", className: "tCheckBox tUnchecked" },
                                  { name: "t1hrLabel", content: $L("1 hour"), className:"timing-menu-label"}
                                ]
              }
          ]
        },
        { name: "appEvent", kind: "ApplicationEvents",
              onWindowActivated: "windowActivatedHandler", onWindowDeactivated: "windowDeactivatedHandler"
        }
    ],

    constructor: function (cfg) {
        var i = 0, len = 0;

        if (!window.PalmSystem && !window.jasmineSlideshow) {
            for (i = 0, len = this.kindComponents.length; i < len; i++) {
                if ("playList" != this.kindComponents[i].name) { continue; }
                this.kindComponents[i].kind = "MockSlideshowPlayList";
                break;
            }
        }

        this.onSlideClicked = cfg.exhibitionMode ?
                              this.onDockModeSlideshowClicked : this.onRegularModeSlideshowClicked;
        this.inherited(arguments);
    },
/*
    windowRotatedHandler: function () {
console.log("**@@@@@**@@@@@**@@@@@** vidslide  photos.SlideshowMode.windowRotatedHandler()...");
    },
*/

    create: function (cfg) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.create() "+(cfg.exhibitionMode ? " (exhibition) " : " "));
        this.isSlideshowEntered = false;
        this.isDisplayOn = true;  // also see onDisplayStatusHandler()
        var thisInst = this;
        this.inherited(arguments);

        if (cfg.exhibitionMode) {
            this.isToolbarShown = false;
            this.isAlbumSelMenuShown = false;
            this.isAlbumSelMenuFirstUse = true;
            this.isCommandbarShown = false;
            this.isTimingSelMenuShown = false;
            this.isTimingSelMenuFirstUse = true;
            this.isPlayInterrupted = false;
            this.createContainedComponents(this.exhibitionModeComponents);
            this.setTimingMenuSelection(this.slidingIntervals.defaultPrefix);
        }

        window.addEventListener("blur", function () {
            thisInst.onWindowBlurHandler();
        }, false);
        window.addEventListener("beforeunload", function () {
            thisInst.onWindowCloseHandler();
        }, false);
        window.addEventListener("focus", function () {
            thisInst.onWindowFocusHandler();
        }, false);

        this.$.displayStats.call();
    },

    onTapHandler: function (inSender, ev) {
        if (this.isTailgatingEvent(ev)) {
//console.log("****@@@@@@><@@@@@@**** vidslideM  SlideshowMode.onTapHandler(): tailgating event '"+ev.target.id+"'");
            this.stopEvent(ev);
            return;
        }
        var id = ev.target.id;
        if (id != "slideshow" && id != "ui_slideshowMode" && 0 != id.length) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.onTapHandler(): got a tap from '"+id+"', skipping it...");
            return;
        }

//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.onTapHandler(): got a tap from '"+id+"'");
        var meta = this.$.swipeTransition.getFocusedSrcMeta();
        var albumId = meta ? meta.albumId : undefined;
        var pictId = meta ? meta.pictId : undefined;
        this.onSlideClicked(this, pictId, albumId, ev);

        this.stopEvent(ev);
    },

    onRegularModeSlideshowClicked: function (inSender, pictId, albumId, ev) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.clicked()");
        this.$.swipeTransition.deactivate();
        this.isSlideshowInProgress = false;
        this.leaveSlideshowMode(pictId, albumId);
    },

    onDockModeSlideshowClicked: function (inSender, pictId, albumId, ev) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.clicked()");
        //if (this.isSlideshowInProgress) { this.toggleSlideshowPlay(); }
        this.toggleControls();
        /*
        this.destroy();
        if (window.PalmSystem) {
            enyo.windows.getActiveWindow().close();   // window.close();
        }
        */
    },

    /**
     * @param isExhibitionMode can be either a true or undefined
     */
    setExhibitionMode: function (isExhibitionMode) {
        this.exhibitionMode = (isExhibitionMode === true) ? true : false;
        if (this.isToolbarShown) { this.hideControls(); }
    },

    setFullScreen: function (boolFullScreen) {
        if (window.PalmSystem) {
            window.PalmSystem.enableFullScreenMode(boolFullScreen);
        }
    },

    /*
    debugCommandbarPosition: function (token) {
        var commandbar = this.$.commandbar.hasNode();
        var slideshow = commandbar.offsetParent;
        var body = slideshow.offsetParent;
        console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode."+token+
                    "(): bar(top="+commandbar.offsetTop+",h="+commandbar.clientHeight+
                    "), slideshow(top="+slideshow.offsetTop+",h="+slideshow.clientHeight+
                    "), body(top="+body.offsetTop+",h="+body.clientHeight+
                    "), body.parent="+body.parentNode.tagName+", window(h="+window.innerHeight+")");
    },
    */

    resizeHandler: function () {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.resizeHandler(): calling resize()...");
        // TODO this resizeHandler() appears not reliably called when the slideshow runs in the app mode
        //      May consider to remove it once I figure out if it has value in the headless mode or not.
        this.resize();
    },

    resize: function () {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.resize(): calling resizeViewPort()...");
        this.resizeViewPort();

        if (this.exhibitionMode) {
            this.$.dropdown.resize(this.viewPortEl);
            this.realignTimingSelMenu();
        }

        // notify the transition style to resize as well...
        this.$.swipeTransition.resize();
    },

    resizeViewPort: function () {
        if (!this.viewPortEl) {
            this.viewPortEl = this.hasNode();
        }

        // we need to all the following viewPort dimension changes manually because the exhibition
        // mode's dashboard does not watch for the device rotation to refect its height to the window's
        // dimension affecting our dimension.
        var offsetParent = this.viewPortEl.offsetParent;  // the offsetParent should be the body in this case
        var w = 0, h = 0;
        if (offsetParent) {
            w = offsetParent.clientWidth;
            h = offsetParent.clientHeight;
        }
        if (w == 0 || h == 0) {
            w = window.innerWidth;
            h = window.innerHeight;
        }


//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.resizeViewPort(): launchParams="+(window.PalmSystem.launchParams ? enyo.json.parse(window.PalmSystem.launchParams) : "undefined")+", exhibitionMode="+this.exhibitionMode);
        // NOTE: when running in exhibition mode, after rotating the device, the exhibition mode's
        //       dashboard height is no longer reflected in the window's dimension.
        //       Here is a very-very-very bad special hack to deduct the dashboard height (28px) from
        //       a hard-coded height because we don't know the true height to refer to.
        if (this.exhibitionMode && window.PalmSystem) {
            h = w/h > 1.0 ? (768-28) : (1024-28);
        }

        // making an enyo's domStylesChanged() is necessary to trigger all other observing enyo's components
        // such as the commandbar
        this.domStyles.width = w+"px";
        this.domStyles.height = h+"px";
        this.domStylesChanged();

        // it appears that enyo.Control does not flush the style to the DOM node by reliably unless
        // some changes to the style made by the app that forces a flush to happen; here is another push.
        this.viewPortEl.style.width = w+"px";
        this.viewPortEl.style.height = h+"px";
    },

    onNoPhotoToPlayHandler: function () {
        this.$.msgDialog.openAtCenter();
        //this.onSlideClicked();
        var thisInst = this;
        if (!this.exhibitionMode) {
            setTimeout(function () {
                thisInst.onRegularModeSlideshowClicked();  // inSender, pictId, albumId, ev
            }, 2000);
        }
    },

    /**
     * It attempts to recover from losing slide during the slideshow play session usually caused
     * by external interruption such as deleting photos by the user.
     */
    attemptToRecover: function () {
console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.attemptToRecover(): an external user action may have caused an interruption to the slideshow, such as removing albums.");
        var thisInst = this;
        var callback = {
            scope: thisInst,
            method: thisInst.playSlideshow
        };
        this.$.playList.reset(callback);
    },

    /**
     * Enters into the slideshow mode and plays slideshow.
     * 1. If the albumIds array is supplied, then the slideshow plays those albums listed on that
     *    albumIds array.  If no albumIds is supplied, then the pictId is ignore regardless if one
     *    is supplied.
     * 2. If a pictId is supplied in addition to the albumIds array, then the slideshow will start from
     *    that pictId.  If no pictId is supplied, then it starts from the first picture among the albums
     *    listed in the albumIds array.
     * 3. If both the pictId and the albumIds array are omitted, then the slideshow will play all
     *    albums.
     *
     * @param pictId (optional) If supplied, then starts the slideshow from the pictId.  If a pictId
     *               is supplied, then the albumIds must also be supplied and cannot be empty.
     * @param albumIds (optional) If supplied, it is an array of albumIds, and the slideshow will
     *               play those albums listed on that albumIds array.  If an albumIds array is not
     *               supplied, then the slideshow will play all albums.  An empty albumIds array is
     *               treated the same as no albumIds supplied.
     * @param nextTodo (optional) If supplied, then the method supplied in the nextTodo will be invoked as
     *               soon as at least one album is accessible from the playList and is invoked before the
     *               1st slide is rendered.  The nextTodo is an object containing { method, args, scope }
     *               @see doNextChain() for details.
     */
    enterSlideshowMode: function(pictId, albumIds, nextTodo) {
        this.isSlideshowEntered = true;
        this.setFullScreen(true);
        if (!this.viewPortEl) {
            this.viewPortEl = this.hasNode();
        }
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.enterSlideshowMode(pictId="+pictId+", albumIds="+(albumIds && albumIds.length > 0 ? "["+albumIds.length+"]" : "undefined")+(nextTodo ? ", nextTodo" : "")+"):"+(this.exhibitionMode ? " exhibitionMode="+this.exhibitionMode+"," : "")+" activating swipeTransition...");
        this.$.swipeTransition.activate(this.viewPortEl);

        var albumsCount = this.$.playList.getAlbumsCount();
        var callback = undefined, thisInst = this;
        var onReadyAction = function (pictId, nextTodo) {
            var albumsCount = this.$.playList.getAlbumsCount();
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.enterSlideshowMode EARLY ACCESS: (pictId="+pictId+(nextTodo ? ", nextTodo" : "")+"): "+(this.exhibitionMode ? "exhibitionMode " : "")+(albumsCount > 0 ? "early access begins, about to playSlideshow()..." : "has no album to play"));
            if (0 == albumsCount) { this.$.msgDialog.openAtCenter(); }

            if (nextTodo) { this.doNextChain(nextTodo); }

            if (!this.isCarded && albumsCount > 0) { this.playSlideshow(pictId); }

            if (!this.exhibitionMode) { return; }

            this.$.dropdown && this.$.dropdown.resetPanel(this.$.playList.getAbbreviatedAlbumsList());

            if (albumsCount > 1) {
                this.$.selAlbumDrpDwnBtn.removeClass("hide");
                this.$.selAlbumDrpDwnBtn.addClass("show");
            } else {
                this.$.selAlbumDrpDwnBtn.removeClass("show");
                this.$.selAlbumDrpDwnBtn.addClass("hide");
            }
        };

        if (0 == albumsCount || undefined == albumsCount) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.enterSlideshowMode(pictId="+pictId+", albumIds="+(albumIds && albumIds.length > 0 ? "["+albumIds.length+"]" : "undefined")+(nextTodo ? ", nextTodo" : "")+"):"+(this.exhibitionMode ? " exhibitionMode="+this.exhibitionMode+"," : "")+" playList has no album, about to call"+(albumIds && albumIds.length > 0 ? " playList.requestToSelectAlbums() and then" : "")+" playList.reset()...");
            callback = {
                scope: thisInst,
                method: onReadyAction,
                args: [ pictId, nextTodo ]
            };
            if (albumIds && albumIds.length > 0) { this.$.playList.requestToSelectAlbums(albumIds); }
            this.$.playList.reset(callback);
        } else {
            callback = {
                scope: thisInst,
                method: function (albumIds, pictId, nextTodo, onReadyAction) {
                    var thisInst = this;
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.enterSlideshowMode(pictId="+pictId+", albumIds="+(albumIds && albumIds.length > 0 ? "["+albumIds.length+"]" : "undefined")+(nextTodo ? ", nextTodo" : "")+"):"+(this.exhibitionMode ? " exhibitionMode="+this.exhibitionMode+"," : "")+(albumIds && albumIds.length > 0 ? " about to call playList.requestToSelectAlbums(albumIds=["+albumIds.length+"]), and" : "")+" call playList.resetPlayList(), and then invoke the early access...");
                    if (albumIds && albumIds.length > 0) { this.$.playList.requestToSelectAlbums(albumIds); }
                    this.$.playList.resetPlayList();
                    onReadyAction.call(thisInst, pictId, nextTodo);
                },
                args: [ albumIds, pictId, nextTodo, onReadyAction ]
            };
            if (albumIds && albumIds.length > 0) {
                if (!this.$.playList.isAlbumDataFulfilled(albumIds)) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.enterSlideshowMode(pictId="+pictId+", albumIds="+(albumIds && albumIds.length > 0 ? "["+albumIds.length+"]" : "undefined")+(nextTodo ? ", nextTodo" : "")+"):"+(this.exhibitionMode ? " exhibitionMode="+this.exhibitionMode+"," : "")+" playList does not have enough photos from the albumIds, about to call playList.resyncAlbumPhotos()...");
                    this.$.playList.resyncAlbumPhotos(albumIds, callback);
                } else {
                    this.doNextChain(callback);
                }
            } else {
                this.doNextChain(callback);
            }
        }
    },

    leaveSlideshowMode: function(pictId, albumId) {
        this.setFullScreen(false);
        window.PalmSystem && window.PalmSystem.setWindowProperties({ blockScreenTimeout: false });
        this.doLeave(pictId, albumId);
    },

    /**
     * It prepares the playList to include the photos from the albums listed in the albumIds array.
     *
     * @param albumIds (optional) if it is supplied, then the playList is reset to include the photos
     *                 from the albums listed from the albumIds array.  If it is omitted, than the
     *                 playList is reset to include all photos from all albums.
     */
    /*
    preparePlayList: function (albumIds) {
        var albumsCount = this.$.playList.getAlbumsCount();
        if (undefined == albumsCount || 0 == albumsCount) { return; }

        //this.$.playList.setAlbumsSelectionByList(albumIds);
        this.$.playList.resetPlayList(albumIds);
    },
    */

    /**
     * It plays the slideshow starting from the pictId from the playList.
     *
     * @param pictId (optional) if supplied, it refers to a photo from the current playList to start
     *               a slideshow.  If omitted, then it starts from the 1st photo from the playList.
     *               It does nothing if the playList does not exist or is empty.
     */
    playSlideshow: function (pictId) {
        var albumsCount = this.$.playList.getAlbumsCount();
        if (undefined == albumsCount || 0 == albumsCount) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.playSlideshow(): no albums to play");
            this.$.msgDialog.openAtCenter();
            if (!this.exhibitionMode) {
                this.doLeave();
            //} else {
            //    this.unloadHandler();  // ??? what would it cause when the app is run in keep-alive-mode ???
            }
            return;
        }
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.playSlideshow(): has "+albumsCount+" albums");

        var thisInst = this;

        if (this.exhibitionMode) {
            if (albumsCount > 1) {
                this.$.selAlbumDrpDwnBtn.removeClass("hide");
                this.$.selAlbumDrpDwnBtn.addClass("show");
            } else {
                this.$.selAlbumDrpDwnBtn.removeClass("show");
                this.$.selAlbumDrpDwnBtn.addClass("hide");
            }
        }

//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.playSlideshow(): has "+this.$.playList.getPlayListCount()+" in playList, about to $.swipeTransition.play(pictId="+pictId+")...");
        this.isSlideshowInProgress = true;
        this.$.swipeTransition.play(this.$.playList, pictId);
        window.PalmSystem && window.PalmSystem.setWindowProperties({ blockScreenTimeout: true });
    },

    screenNailGenNotify: function (inSender, dbEntry) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.screenNailGenNotify(path="+(dbEntry.appScreenNail && dbEntry.appScreenNail.path ? dbEntry.appScreenNail.path : "undefined")+")...");
        if (!dbEntry.appScreenNail || !dbEntry.appScreenNail.path) { return; }
        // TODO future feature - the next line could be the current transition style among many styles
        this.$.swipeTransition.updateSrcPath(dbEntry._id, dbEntry.appScreenNail.path);
    },

    playListChangeNotify: function () {
        this.$.swipeTransition.resyncPlayList();
    },

    toggleControls: function () {
        if (this.isToolbarShown) {
            this.hideControls();
        } else {
            this.showControls();
        }
    },

    showControls: function () {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.showControls()...");
        this.teardownHideControlsIntent();

        if (this.isAlbumSelMenuShown) { this.toggleSelAlbumMenu(); }
        if (this.isTimingSelMenuShown) { this.toggleTimingSelMenu(); }
        if (!this.isToolbarShown) { this.toggleToolbar(); }

        this.hideControlsIntent();
    },

    hideControlsIntent: function () {
        this.teardownHideControlsIntent();

        var thisInst = this;
        this.hideControlJobId = setTimeout(function () {
            thisInst.hideControls();
        }, 5000);
    },

    teardownHideControlsIntent: function () {
        if (this.hideControlJobId) {
            clearTimeout(this.hideControlJobId);
            delete this.hideControlJobId;
        }
    },

    hideControls: function () {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.hideControls()...");
        var selectedAlbums = this.$.dropdown.getSelectionState();  // get an array of zero or more elements

        if (this.hideControlJobId) { delete this.hideControlJobId; }
        if (this.isAlbumSelMenuShown) { this.toggleSelAlbumMenu(); }
        if (this.isTimingSelMenuShown) { this.toggleTimingSelMenu(); }
        if (this.isToolbarShown) { this.toggleToolbar(); }

        // check that if no album is selected; if so, then select them all
        if (0 == selectedAlbums.length) {
            this.$.dropdown.selectAllAlbums();
            selectedAlbums = this.$.dropdown.getSelectionState();
        }

        if (!this.$.playList.isAlbumsSelectionMatched(selectedAlbums)) {
//console.dir("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.hideControls(): albums selection is changed to "+(selectedAlbums.length > 0 ? selectedAlbums : "select all"));
            this.$.playList.requestToSelectAlbums(selectedAlbums);
            this.$.playList.resetPlayList();
            this.$.swipeTransition.reset();
            this.isSlideshowInProgress = true;
            this.$.swipeTransition.play(this.$.playList);
            this.$.playList.persistAlbumsSelection();
        }
    },

    toggleToolbar: function () {
        if (this.isToolbarShown) {
            this.isToolbarShown = false;
            this.$.toolbar.removeClass("show-toolbar");
            this.$.toolbar.addClass("hide-toolbar");
            this.$.commandbar.removeClass("show-commandbar");
            this.$.commandbar.addClass("hide-commandbar");
        } else {
            this.realignTimingSelMenu();
            this.isToolbarShown = true;
            this.$.toolbar.removeClass("hide-toolbar");
            this.$.toolbar.addClass("show-toolbar");
            this.$.commandbar.removeClass("hide-commandbar");
            this.$.commandbar.addClass("show-commandbar");
        }
    },

    realignTimingSelMenu: function () {
        var timingBtnEl = undefined;
        if (this.$.timingButton && this.$.timingButton.id) {
            timingBtnEl = document.getElementById(this.$.timingButton.id);
        }
        var styleText = null;
        if (timingBtnEl) {
            // 44 = 15(commandbar padding) + 1(button border top) + 28(dashboard height)
            styleText = "left:"+(timingBtnEl.offsetLeft)+"px;bottom:"+(timingBtnEl.clientHeight+16)+"px;";
            this.$.slideup.addStyles(styleText);
        }
    },

    toggleSelAlbumMenu: function (inSender, ev) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.toggleSelAlbumMenu()...");
        if (this.isAlbumSelMenuFirstUse) {
            this.isAlbumSelMenuFirstUse = false;
            this.$.dropdown.removeClass("first-use");
        }
        var imgSrc = null, selectedIds = null;
        if (this.isAlbumSelMenuShown) {
            this.isAlbumSelMenuShown = false;
			// imgSrc = "images/triangle-down.png";
            this.hideControlsIntent();
            selectedIds = this.$.playList.getSelectedAlbumIds();
        } else {
            this.isAlbumSelMenuShown = true;
			// imgSrc = "images/triangle-up.png";
            this.teardownHideControlsIntent();
            if (this.isTimingSelMenuShown) { this.toggleTimingSelMenu(); }
        }
        //this.$.dropdownImage.setSrc(imgSrc);
        this.$.dropdown.setOpen(this.isAlbumSelMenuShown);

        if (selectedIds && selectedIds.length > 0) {
            this.$.dropdown.restoreAlbumsSelectionTo(selectedIds);
        }
    },

    onAlbumSelectionDoneHandler: function () {
        this.isAlbumSelMenuShown = false;
        this.$.dropdown.setOpen(this.isAlbumSelMenuShown);
        this.teardownHideControlsIntent();
        this.hideControls();
    },

    /*
    onAlbumSelected: function (inSender, ev, index) {
        var albumMeta = this.$.playList.getAlbumMetaByIndex(index);
        if (!albumMeta) { return; }

        this.$.swipeTransition.pause();
        this.isSlideshowInProgress = false;

        this.$.playList.resetPlayList([albumMeta.albumId]);
        this.$.swipeTransition.reset();
        this.isSlideshowInProgress = true;
        this.$.swipeTransition.play(this.$.playList);

        var thisInst = this;
        setTimeout(function () {
            thisInst.hideControls();
        }, 600);
        //this.$.dropBtnCaption.setContent(albumMeta.title);
    },
    */

    onPlayClicked: function () {
        if (0 == this.$.playList.getPlayListCount()) {
            if (this.isSlideshowInProgress) { this.toggleSlideshowPlay(); }
            this.$.playList.reset();
            this.$.msgDialog.openAtCenter();
            return;
        }

        this.toggleSlideshowPlay();
        var thisInst = this;
        setTimeout(function () {
            thisInst.hideControls();
        }, 600);
    },

    onShuffleClicked: function () {
        if (0 == this.$.playList.getPlayListCount()) { return; }
        this.$.playList.shufflePlayList();
        this.$.swipeTransition.reset();
        //this.isSlideshowInProgress = true;  // DFISH-29062 - this line, plus the pause below
        this.$.swipeTransition.play(this.$.playList);
        if (!this.isSlideshowInProgress) {
            this.$.swipeTransition.pause();
        }
    },

    toggleSlideshowPlay: function () {
        if (this.isSlideshowInProgress) {
            this.isSlideshowInProgress = false;
            this.$.swipeTransition.pause();

            if (this.exhibitionMode) {
                this.$.playBtnImg.setSrc("images/icn-play.png");
                window.PalmSystem && window.PalmSystem.setWindowProperties({ blockScreenTimeout: false });
            }

        } else {
            this.isSlideshowInProgress = true;
            this.$.swipeTransition.resume();

            if (this.exhibitionMode) {
                this.$.playBtnImg.setSrc("images/icn-pause.png");
                window.PalmSystem && window.PalmSystem.setWindowProperties({ blockScreenTimeout: true });
            }
        }
    },

    onTimingClicked: function () {
        this.teardownHideControlsIntent();
        this.toggleTimingSelMenu();
    },

    toggleTimingSelMenu: function () {
        if (this.isTimingSelMenuFirstUse ) {
            this.isTimingSelMenuFirstUse = false;
            this.$.slideup.removeClass("hide");
        }
        if (this.isTimingSelMenuShown) {
            this.isTimingSelMenuShown = false;
        } else {
            this.isTimingSelMenuShown = true;
            this.teardownHideControlsIntent();
            if (this.isAlbumSelMenuShown) { this.toggleSelAlbumMenu(); }
        }
        this.$.slideup.setOpen(this.isTimingSelMenuShown);
    },

    resetSlidingTimeInterval: function (ms) {
        this.$.swipeTransition.resetSlidingInterval(ms);
        if (!this.isSlideshowInProgress) { this.toggleSlideshowPlay(); }

        var thisInst = this;
        setTimeout(function () {
            thisInst.hideControls();
        }, 600);
    },

    setTimingMenuSelection: function (prefix) {
        var currPrefix = this.slidingIntervals.currentPrefix;
        var newPrefix = (prefix && undefined != this.slidingIntervals[prefix] &&
                         prefix != "defaultPrefix" && prefix != "currentPrefix") ? prefix :
                        this.slidingIntervals.defaultPrefix;
        if (newPrefix == currPrefix) {
            return;
        }
        var name = null;
        if (currPrefix) {
            name = currPrefix+"Check";
            this.$[name].removeClass("tChecked");
            this.$[name].addClass("tUnchecked");
        }
        this.slidingIntervals.currentPrefix = newPrefix;
        name = newPrefix+"Check";
        this.$[name].removeClass("tUnchecked");
        this.$[name].addClass("tChecked");
    },

    setTimerHandler: function (inSender, ev) {
        var prefix = inSender.prefix;
        this.setTimingMenuSelection(prefix);
        if (this.isTimingSelMenuShown) { this.toggleTimingSelMenu(); }
        var millSec = this.slidingIntervals[prefix];
        if (!millSec) { millSec = this.slidingIntervals[this.slidingIntervals.defaultPrefix]; }
        this.resetSlidingTimeInterval(millSec);
    },

    onWindowBlurHandler: function () {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.onWindowBlurHandler(): playList deactivate()...  ");
        this.$.playList.deactivate();
        if (this.isSlideshowInProgress) {
            this.toggleSlideshowPlay();
            this.isPlayInterrupted = true;
        }
    },

    onWindowCloseHandler: function () {
        if (this.isSlideshowInProgress) {
//console.log("><><><><><><><  photos.slideshow: onWindowCloseHandler() pause  ><><><><><><><><><><");
            this.toggleSlideshowPlay();
            this.isPlayInterrupted = true;
        }
//else {console.log("><><><><><><><  photos.slideshow: onWindowCloseHandler()...  ><><><><><><><><><><");}
    },

    onWindowFocusHandler: function () {
        if (!this.$.playList || !this.isSlideshowEntered) { return; }

        var thisInst = this;
        var callback = {
            scope: thisInst,
            method: function () {
                if (0 == this.$.playList.getAlbumsCount()) {
                    if (this.isSlideshowInProgress) { this.toggleSlideshowPlay(); }
                    this.$.msgDialog.openAtCenter();
                    return;
                }

                if (!this.isSlideshowInProgress) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.onWindowFocusHandler() after playList reset, about to toggleSlideshowPlay()...");
                    this.toggleSlideshowPlay();
                    this.isPlayInterrupted = false;
                }

                this.$.dropdown && this.$.dropdown.resetPanel(this.$.playList.getAbbreviatedAlbumsList());
            }
        };

//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.onWindowFocusHandler() playList activate and reset...");
        this.$.playList.activate();
        this.$.playList.reset(callback);
    },

    windowDeactivatedHandler: function () {
//console.log("****@@@@@@><@@@@@@**** vidslide"+(this.exhibitionMode ? " (exhibition)" : "")+"  photos.SlideshowMode.windowDeactivatedHandler(), "+this.verboseAppContext());
        this.onWindowBlurHandler();
        this.isCarded = true;
    },

    windowActivatedHandler: function () {
//console.log("****@@@@@@><@@@@@@**** vidslide"+(this.exhibitionMode ? " (exhibition)" : "")+"  SlideshowMode.windowActivatedHandler()...");

        this.isCarded = false;
        this.onWindowFocusHandler();
    },

    unloadHandler: function () {
//console.log("****@@@@@@><@@@@@@**** vidslide"+(this.exhibitionMode ? " (exhibition)" : "")+"  photos.SlideshowMode: unloadHandler(), "+this.verboseAppContext());

        // app exit, i.e. the card gets swipped away
        this.onWindowCloseHandler();
        //if (this.exhibitionMode) { window.close(); }
        this.destroy();
    },

    verboseAppContext: function () {
       var desc = "";
		if (window.PalmSystem) {
			if (window.PalmSystem.launchParams) {
                // available only at relaunch
                // expect { windowType: "dockModeWindow", dockMode: true }
				desc = "PalmSystem.launchParams = "+window.PalmSystem.launchParams;
			} else {
				desc = "no PalmSystem.launchParams";
			}
		} else {
			desc = "no PalmSystem";
		}
        return desc;
    },

    backToCaptionChanged: function () {
        // do-not-remove, it stubs out the backToCaptionChanged() method from the PictureMode
    },

    onDisplayStatusHandler: function (dispService, resp) {
//console.log("****@@@@@@><@@@@@@**** vidslide"+(this.exhibitionMode ? " (exhibition)" : "")+"  photos.SlideshowMode.onDisplayStatusHandler(): display.event = "+resp.event);
        if (this.isCarded) { return;}
        // event: "request"
        // state: "on"
        // timeout: 60
        // blockDisplay: "false"
        // active: true
        // subscribed: true
        //
        // event: "request"   ... "displayDimmed" -> "displayOff" -> "displayInactive"
        //        "displayOn" ... "displayDimmed" -> "displayOff" -> "displayInactive"
        // blockScreenTimeout=true  -> "blockedDisplay"
        // blockScreenTimeout=false -> "unblockedDisplay"
        //
        // Because LunaSysMgr could fire unexpected displayOn event even when the display is already "on",
        // the isDisplayOn is used to guard on that faulty event.
        switch(resp.event) {
            case "displayOn":
                if (!this.isDisplayOn) {
                    this.isDisplayOn = true;
                    this.onWindowFocusHandler();
                }
                break;
            case "displayOff":
                if (this.isDisplayOn) {
                    this.isDisplayOn = false;
                    this.onWindowBlurHandler();
                }
                break;
            default:
                break;
        }
    },

    onDisplayStatusFailureHandler: function (dispService, resp) {
        console.log("photos.SlideshowMode: display service failure - "+enyo.json.stringify(resp));
    },

    stopEvent: function (ev) {
        if (ev.stopPropagation) { ev.stopPropagation(); } else { ev.cancelBubble = true; }
        if (ev.preventDefault) { ev.preventDefault(); } else { ev.returnValue = false; }
    },

    /**
     * Some where fires a tailgating event on click causing us to respond twice on each tap with
     * <100ms apart or so.  This method is meant to help us to filter it out.
     */
    isTailgatingEvent: function (ev) {
        var now = new Date(), isTailgating = false;
        if (this.lastClickTime) {
            if ((now.getTime()-this.lastClickTime.getTime()) < 400) {
                isTailgating = true;
            }
        }
        this.lastClickTime = now;
//console.log("****@@@@@@><@@@@@@**** vidslide  SlideshowMode.isTailgatingEvent(): "+isTailgating+", "+now.getTime());
        return isTailgating;
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
    }
});


