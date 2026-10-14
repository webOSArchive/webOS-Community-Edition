enyo.kind({
    name: "VideoControlbarControl",
    kind: enyo.Control,
    rendered: function () {
        this.inherited(arguments);
//console.log('****@@@@@@><@@@@@@**** vidslide  VideoControlbarControl.rendered(): on "'+this.owner.dbEntry.path+'"');
        var dispWidth, left;
        if (window.innerWidth < 667) {
            dispWidth = window.innerWidth - 20;
        } else {
            dispWidth = 647;
        }
        left = Math.floor((window.innerWidth - dispWidth)/2);
        this.applyStyle("left", left+"px");
        this.applyStyle("width", dispWidth+"px");
    }
});

enyo.kind({
    name: "DbViewVideoSlider",
    kind: enyo.ProgressSlider,
    offsetLeft: 0,
    events: {
        onTapped: ""
    },
    chrome: [
        { name: "animator", kind: enyo.Animator, duration: 80, tick: 80, onBegin: "beginAnimation",
          onAnimate: "stepAnimation", onEnd: "endAnimation", onStop: "stopAnimation"},
        { name: "progressSlider", className: "", 
          components: [
              { name: "bar", kind: enyo.ProgressBar,
                className: 'enyo-progress-slider',
                components: [
                    { name: "button", kind: "CustomButton", className: "enyo-slider-button video-scrubber",
                      caption: " ", toggling: true, allowDrag: true }
                ]
              }
          ]
        },
        {name: "client"}
    ],
    rendered: function () {
        this.inherited(arguments);
        this.resize();
    },
    /**
     * overriding enyo.slider.clickHandler() catching the true coordinate before enyo.Slider
     * losing it after playing its animation.
     */
    clickHandler: function (inSender, ev) {
        //var p = this.calcEventPosition(ev.pageX);
        if (this.offsetLeft == 0) {
            this.offsetLeft = this.calcOffsetLeft(this.$.bar.$.bar.node);
        }
        var p = this.calcTappedPosition(ev.pageX);
        this.doTapped(p, ev);
        // this.inherited(arguments);  // silent out the enyo.Slider clickHandler b/c we've notified
                                       // the owner about the click delegating the action to the owner
                                       // which may choose to veto the click action.
    },
    calcOffsetLeft: function (el) {
        var offsetLeft = 0;
        var domNode = el;
        while(domNode) {
            offsetLeft += domNode.offsetLeft + domNode.clientLeft -
                          (domNode.offsetParent ? domNode.offsetParent.scrollLeft : 0);
            domNode = domNode.offsetParent;
        }
        return offsetLeft;
    },

    calcTappedPosition: function (eventPageX) {
        var w = 0, node = this.$.bar.$.bar.node;
        if (node) {
            // The next line is not very intuitive, but is needed on a situation when entering into
            // video1, swipping to next video2, tapping on the seeker slider, and then the scrubber
            // would go off the display because the offsetLeft has a very large negative value.  It is
            // caused by deep inside of the enyo.Carousel that the client to the enyo.BasicScroller is
            // yet to be initialized having a -2048 offsetLeft skewing the calculation to obtain the
            // offsetLeft.  However, when the calcTappedPosition() is called responding to the tapping
            // of the slider rail, the client to the BasicScroler would have been initialized, and then
            // calling the resize() again would produce a valid offsetLeft.
            if (this.offsetLeft < 0) { this.resize(); }

            w = node.clientWidth;
            if (w == 0) { w = node.parentNode.clientWidth; }
            if (w == 0) {
                return w;
            } else {
                return Math.floor((eventPageX - this.offsetLeft)/w*100);
            }
        } else {
            return w;
        }
    },

    /**
     * replacing enyo.Slider.calcEventPosition() because not only it computes incorrectly but is also
     * very inefficient.
     */
    calcEventPosition: function (eventPageX) {
        return this.calcTappedPosition(eventPageX);
    },

    getSliderWidth: function () {
        var node = this.$.bar.$.bar.hasNode();
        var w = node ? node.clientWidth : 0;
        if (w != 0) { return w; }
        var parentNode = node ? node.parentNode : undefined;
        return parentNode ? parentNode.clientWidth : 0;
    },

    resize: function () {
        var barBarNode = this.$.bar.$.bar.node;
        if (!barBarNode) { barBarNode = this.$.bar.$.bar.hasNode(); }
        if (barBarNode) {
            this.offsetLeft = this.calcOffsetLeft(barBarNode);
        }
    },

    onWindowResize: function () {
        this.resize();
    },

    /**
     * overriding enyo.ProgressBar.applyPosition() and enyo.ProgressSlider.positionChanged()...
     */
    positionChanged: function (oldPos) {
        // from the enyo.Progress.positionChanged(), commenting out calcNormalizedPosition()...
        //this.position = this.calcNormalizedPosition(this.position);
        if (this.lastPosition != this.position) {
            this.applyPosition();
            this.lastPosition = this.position;
        }

        // there's also enyo.ProgressSilder.positionChanged() but is irrelevant, therefore is ignored
    },

    /**
     * overriding enyo.ProgressBar.applyPosition()...
     */
    applyPosition: function() {
        if ((this.lastPosition >= 0) && this.animatePosition && !this.$.animator.isAnimating() &&
            this.canAnimate()) {
            this.$.animator.play(this.lastPosition, this.position);
        } else {
            this.renderPosition(this.position);
        }
    },

    /**
     * Implement the flickHander() to stop the flick event propagation to the enyo.Carousel.
     */
    flickHandler: function () {
        //this.inherited(arguments);
        return true;
    },

    /**
     * overriding enyo.slider.dragHandler() as its calculation does not consider the boundary resulting
     * dragging the scrubber outside of the slider rail.
     *
     * @param ev - It is an enyo drag event object
     */
    dragHandler: function (inSender, ev) {
        if (!this.handlingDrag) { return; }
        if (ev.stopPropagation) { ev.stopPropagation(); }

        // @also see comments in calcTappedPosition() about why the offsetLeft may be negative, and
        //       when it happens, a resize is needed.
        if (this.offsetLeft < 0) { this.resize(); }
        var pos = ev.pageX - this.offsetLeft;
        var w = this.getSliderWidth();
        pos = pos < 0 ? 0 : pos > w ? w : pos;
        this.setPositionImmediate((pos/w)*100);
        this.doChanging(this.position);
    }
});



enyo.kind({
    name: "DbViewVideo",
    kind: "DbViewImage",
    components: [
        { name: "video", kind: "enyo.Control", className: "video-default", showControls: "" },
        { name: "headerBar", kind: "HFlexBox", className: "vid-header-bar show-vid-header-bar",
          components: [
              { name: "videoTitle", className: "vid-title", flex: 1 }
          ]
        },
        //{ name: "controlBar", kind: "Control", className: "vid-ctrl-bar show-vid-ctrl-bar",
        { name: "controlBar", kind: "VideoControlbarControl", className: "vid-ctrl-bar show-vid-ctrl-bar",
          onclick: "noControlBarClicked",
          components: [
              { name: "playButton", kind: "Control", onclick: "onPlayClicked", className: "play-button" },
              /*
              { name: "volumeButton", kind: "Button", className: "photos button", caption: " ",
                onclick: "showVolumeSelector", components: [
                    { kind: "Image", src: "images/button_slideshow_play.png" },
                    { name: "volumeButton", kind: "PopupMenu",
                      components: [
                          { caption: "L" },
                          { caption: "M" },
                          { caption: "S" }
                      ]}
                ]},
              */
              { name: "timePlayed", className: "play-time-tally-left" },
              { name: "resizeButton", kind: "Control", onclick: "onResizeClicked",
                    className: "zoom-larger-button" },
              { name: "timeRemain", className: "play-time-tally-right" },
              { name: "seeker", kind: "DbViewVideoSlider", className: "seeker-wide",
                minimum: 0, maximum: 100,
                onChanging: "onSeeking", onChange: "onSeeked", onTapped: "onSeekerTapped" }
          ]
        },
        /*
        { name: "videoIcon", kind: "Button", caption: " ", className: "enyo-button-dark video-icon show-video-icon", style: 'top: 50%; left:50%; margin-left:-30px;width:30px !important;height:33px; overflow:hidden',
            onclick: "onVideoIconClicked", components: [
            { name: "vidPlayIcon", kind: "Image", src: "images/icn-play.png" }
          ]
        },
        */
        { name: "dispService", kind: "PalmService", service: "palm://com.palm.display/control/",
            onFailure: "displayRequestFailureHandler"
        },
        { name: "headsetService", kind: "PalmService", service: "palm://com.palm.keys/headset/",
              method: "status", subscribe: true,
              onSuccess: "headsetStatusResponseHandler", onFailure: "headsetStatusFailHandler"
        },
        { name: "mediaserver", kind: "PalmService", onFailure: "mediaserverRequestFailHandler" },
        { name: "msgDialog", kind: "MessageDialog" },
        { name: "videoDbService", kind: "PalmService", service: "palm://com.palm.db/", method: "merge",
              onSuccess: "videoDbUpdateAckSuccessHandler", onFailure: "videoDbUpdateAckFailureHandler"
        }
    ],
    className: "video-view",
    // currently only local videos are supported
    type: "local",
    mediaType: "video",
    dragSession: undefined,     // { clientX, clientY }
    showControlsGroup: undefined,
    hideControlsGroup: undefined,
    defaultHideControlTimeout: 6000,
    viewSizeCode: 1,       // 1:FIT, 2:FILL  (a class scoped property)
    playedStates: { },
    IS_NOT_LOADED: 1,
    IS_LOADING: 2,
    IS_LOADED: 3,
    create: function () {
        this.inherited(arguments);
        this.instanceId = new Date().getTime();
        //this.setSrc(this.dbEntry.path);
        this.isControlBarShown = true;
        this.isPlaying = false;
        this.playMonitorId = null;
        this.nativeWidth = undefined;
        this.nativeHeight = undefined;
        this.aspectRatio = undefined;
        this.autoSize = false;
        this.video = undefined;
        this.isCarded = false;
        this.loadState = this.IS_NOT_LOADED;
		this.seekedEventObservers = {};
        this.playTimeMeta = {               // the meta data helping the updateSeeker() to animate
            isMonitorInProgress: false,
            tDuration: this.dbEntry.duration,
            tLastSeeked: 0,
            tScrubberLastUpdate: 0
        };
        var lastPlayTimeRecorded = this.getLastPlayTimeRecorded(this.dbEntry._id);
        if (undefined != lastPlayTimeRecorded && !isNaN(lastPlayTimeRecorded)) {
            this.playTimeMeta.tLastSeeked = lastPlayTimeRecorded;
        }

        if (window.PalmSystem) {
            this.adjustVideoSize = this.adjustVideoSizeDeviceMode;
            this.subscribeHeadsetState();
        } else {
            this.adjustVideoSize = this.adjustVideoSizeDesktopMode;
        }

        this.updateViewSizeButton();

        //this.clickHandler = null; // HACK - this would eliminate the extra click event dispatch
                                     //     well, cann't do it just yet, b/c we need the click event
                                     //     anywhere from the view, but also suffers the tailgating
                                     //     event.  (@see isTailgatingEvent() method for details.)

        this.dblclickHandler = null; // HACK - this would eliminate the extra click event dispatch

        var tokens = this.dbEntry.path.split(/\//);
        var basename = tokens[tokens.length-1];
        this.$.videoTitle.setContent(enyo.string.escapeHtml(basename));

        this.updateControlbarToLastPlayTime();

        this.discoverControlbarsGroup();
        this.joinShowHideControlsGroups();

        // disable the secondary scroller from scrolling on video.  This does not impact to the
        // scrolling by the Carousel.  DFISH-28100
        this.$.scroller.setAutoHorizontal(false);
        this.$.scroller.setAutoVertical(false);
        this.$.scroller.setHorizontal(false);
        this.$.scroller.setVertical(false);

        var thisInst = this;
        var handlers = this.windowEventHandlers = {
            blur: function (ev) {
                thisInst.onWindowBlurHandler();
            },
            beforeunload: function (ev) {
                thisInst.onWindowCloseHandler();
            },
            focus: function (ev) {
                thisInst.onWindowFocusHandler();
            }
        };
        var type;
        for (type in handlers) if (handlers.hasOwnProperty(type)) {
            window.addEventListener(type, handlers[type], false);
        }
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.create(): instance='+this.instanceId+' on "'+this.dbEntry.path+'"');
    },

    rendered: function () {
        this.inherited(arguments);
        if (this.loadState == this.IS_NOT_LOADED && this.$.image.hasNode()) {
            this.adjustPosterSize();
        }
    },

    /**
     * @param pictId - It is the pictId to which to get its last play time recorded.
     *
     * @return It returns the last play time recorded for the pictId, if there's any.  Otherwise,
     *         it returns undefined.
     */
    getLastPlayTimeRecorded: function (pictId) {
        var lastPlayTimeRecorded = undefined;
        var playedStates = this.playedStates;
        var state = playedStates[pictId];
        if (state && undefined != state.lastPlayTime) {
            lastPlayTimeRecorded = state.lastPlayTime;
        } else if (undefined != this.dbEntry.lastPlayTime) {
            lastPlayTimeRecorded = this.dbEntry.lastPlayTime;
        }
        return lastPlayTimeRecorded;
    },

    /**
     * It updates the controlbar reflecting the last played time, if there's any.
     */
    updateControlbarToLastPlayTime: function () {
        var duration = this.dbEntry.duration;
        var timeRemain = duration;
        var timePlayed = this.getLastPlayTimeRecorded(this.dbEntry._id);
        if (undefined != timePlayed && timePlayed > 0 && timePlayed < duration) {
            timeRemain = duration - timePlayed;
        } else {
            timePlayed = 0.0;
        }

        this.updateSeeker((timePlayed/duration)*100);
        this.updateTimePlayedTally(timePlayed);
        this.updateTimeRemainTally(timeRemain);
    },

    /**
     * This method gets the showControlsGroup/hideControlsGroup instances from the PictureMode.
     * It takes an intrinsic approach to discover the PictureMode instance via the owners' chain
     * and then to get the show/hide controls groups.  This intrinsic approach is not very OOP,
     * but it appears more effective and reliable comparing to having the DbImageView to push
     * them down on each video instance (which is cumbersome and error-prone.)
     */
    discoverControlbarsGroup: function () {
        var pictMode = this.owner;      // expecting it to be the Carousel
        while (pictMode && pictMode.name != "pictureMode") {
            pictMode = pictMode.owner;  // should iterate no more than twice
        }                               // the 1st=DbImageView, the 2nd=PictureMode (both have the ref.)
        if (!pictMode) { return; }
        this.showControlsGroup = pictMode.getShowControlsGroup();
        this.hideControlsGroup = pictMode.getHideControlsGroup();
    },

    getMediaType: function () {
        return this.mediaType;
    },
    getType: function () {
        return this.type;
    },

    registerToShowControlsGroup: function () {
        if (!this.showControlsGroup) { return; }
        var thisInst = this;
        this.showControlsGroupTaskId = this.showControlsGroup.addTask({
            method: thisInst.showControlbars,
            scope: thisInst
        });
    },

    registerToHideControlsGroup: function () {
        if (!this.hideControlsGroup) { return; }
        var thisInst = this;
        this.hideControlsGroupTaskId = this.hideControlsGroup.addTask({
            method: thisInst.hideControlbars,
            scope: thisInst
        });
    },

    initVideo: function (postProcess) {
        var thisInst = this;
        var handlers = this.videoInstanceEventHandlers = {
            progress: function (ev) {
                thisInst.updateOnLoadProgress(ev);
            },
            canplaythrough: function (ev) {
                thisInst.updateOnLoadProgress(ev);
            },
            loadedmetadata: function (ev) {
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.loadedmetadata(): on "'+thisInst.dbEntry.path+'", videoWidth='+this.videoWidth+', videoHeight='+this.videoHeight);
                thisInst.loadState = thisInst.IS_LOADED;
                thisInst.onVideoLoad(ev);
                thisInst.adjustVideoSize();
                postProcess && postProcess();
            },
            seeked: function (ev) {
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.seeked(): seek ACK, '+thisInst.$.video.node.currentTime+', instanceId='+thisInst.instanceId+' on "'+thisInst.dbEntry.path+'"');
                if (!thisInst.isInFocused) { delete thisInst.seekToPosition; }
                thisInst.onVideoSeeked(ev);
                thisInst.isInFocused && thisInst.onVideoSeekedEventNotify(ev);
            },
            ended: function (ev) {
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.ended(): video end ACK, instanceId='+thisInst.instanceId+' on "'+thisInst.dbEntry.path+'"');
                delete thisInst.seekToPosition;   // to avoid a retract due to slow seeking from mediaserver
                thisInst.setPlayButtonState(false);
                thisInst.pauseVideo();
                thisInst.$.video.node.currentTime = 0;
                thisInst.updateTimePlayedTally();
                thisInst.updateTimeRemainTally();
                thisInst.updateSeeker();
                thisInst.showControlsGroup.schedule(100);
                // or, to show only the video controlbar and not both, then use...
                // setTimeout(function() { thisInst.showVideoControlBar(); }, 100);

                // DFISH-28625 cancel the control bar hiding after the playback finishes to the end.
                // The canceled hiding is scheduled by the showing of control bar from the PictureMode.
                setTimeout(function () {
                    thisInst.hideControlsGroup && thisInst.hideControlsGroup.cancel();
                }, 1000);
            },
            pause: function (ev) {
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.pause(): pause ACK, instanceId='+thisInst.instanceId+'/'+thisInst.mediadService+' on "'+thisInst.dbEntry.path+'", node.paused='+thisInst.$.video.node.paused);
                thisInst.mediaplayerInitiatedPauseHandler();
            },
            play: function (ev) {
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.play(): play ACK, instanceId='+thisInst.instanceId+'/'+thisInst.mediadService+' on "'+thisInst.dbEntry.path+'", node.paused='+thisInst.$.video.node.paused+' at '+thisInst.$.video.node.currentTime);
                if (thisInst.isInFocused && !thisInst.isCarded) { return; }
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.play(): play ACK, instanceId='+thisInst.instanceId+'/'+thisInst.mediadService+' on "'+thisInst.dbEntry.path+'", isInFocused='+thisInst.isInFocused+', isCarded='+thisInst.isCarded+', node.paused='+thisInst.$.video.node.paused+' at '+thisInst.$.video.node.currentTime+', prepare to pause...');
                thisInst.pauseVideo();
            },
            error: function (ev) {
                thisInst.onVideoError();
            }
        };
        var videoSrc = this.dbEntry.path;

        var containerEl = this.$.image.hasNode().parentNode; //hasNode() should never return null in this case
        var left = containerEl.clientWidth > this.bufferImage.width ?
                   Math.floor((containerEl.clientWidth - this.bufferImage.width)/2) : 0;
        // overwrite this.$.video.node <div> with <video>
        var node = this.$.video.node = document.createElement("video");
        //var node = this.$.video.hasNode();
        //node.setAttribute("poster", this.bufferImage.src);
        node.setAttribute("x-palm-media-audio-class", "media");
        node.setAttribute("x-palm-media-extended-overlay-playback", "true");
        node.style = "left:"+left+"px;";
        var type;
        for (type in handlers) if (handlers.hasOwnProperty(type)) {
            node.addEventListener(type, handlers[type], false);
        }

        this.vidDomId = new Date().getTime();
        this.vidDomId = "vid"+this.vidDomId;
        node.setAttribute("id", this.vidDomId);

        node.setAttribute("src", videoSrc);
        this.loadState = this.IS_LOADING;
        containerEl.removeChild(this.$.image.node);
        containerEl.appendChild(node);
    },

    lockWindowOrientation: function () {
        if (this.isOrientationLocked || !window.PalmSystem) { return; }
        this.isOrientationLocked = true;
                                               // orientation "up" position is having the camera on the top
                                               // using window.PalmSystem.videoOrientation|screenOrientation
                                               // expecting videoOrientation to be either "right" or "down"
        var orientation = window.PalmSystem.videoOrientation;
        //enyo.setAllowedOrientation(orientation);    // set window.PalmSystem.windowOrientation // RELEASE ROTATION LOCKING (1 of 2)
                                              // enyo.getWindowOrientation() returns "up|down|left|right"
    },

    unlockWindowOrientation: function () {
        if (!this.isOrientationLocked || !window.PalmSystem) { return; }
        this.isOrientationLocked = false;
        //enyo.setAllowedOrientation("free");  // RELEASE ROTATION LOCKING (2 of 2)
    },

    onSwipeOutHandler: function () {
        this.setInFocus(false);
        this.unlockWindowOrientation();
        this.pauseVideo();
        this.showControlsGroup && this.showControlsGroup.execute();
        this.stopMonitor();
        this.recordVideoState();
        //this.inherited(arguments);

        // Note: probably should also depart from the show/hide controls groups?  To do so, we'd also
        // need to manage the swipe-in/swipe-out.  No sure if all that are worthy?
    },

    onSwipeInHandler: function () {
        this.setInFocus(true);
        this.updateViewSizeButton();

        var old = this.$.seeker.offsetLeft;
        this.$.seeker.resize();

        this.updateControlbarToLastPlayTime();
        this.hideControlsGroup && this.hideControlsGroup.cancel();
        if (!this.isControlBarShown) {
            this.showControlsGroup && this.showControlsGroup.execute();
        }
    },

    clickHandler: function (inSender, ev) {
        if (ev.eventPhase == 0) {
            this.stopEvent(ev);
            return;
        }

        if (!this.isControlBarShown) {
            this.showControlsGroup && this.showControlsGroup.execute();
        } else {
            this.hideControlsGroup && this.hideControlsGroup.execute();
        }

        //this.inherited(arguments);
        this.stopEvent(ev);       // stops the event propagation preventing the PectureMode from
    },                            // cancelling the show/hide of the control bars

    captureDomEvent: function (ev) {
        var dx, dy;
        if (ev.type != "mousedown" && ev.type != "mousemove" && ev.type != "mouseup" &&
            ev.type != "windowActivated" && ev.type != "windowDeactivated") { return; }

        if (ev.type == "windowDeactivated") {
            this.windowDeactivatedHandler();
        } else if (ev.type == "windowActivated") {
            this.windowActivatedHandler();
        } else {
            switch (ev.type) {
                case "mousemove":
                    if (this.dragSession) {
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.captureDomEvent(): a mousemove with drag session...');
                        // introduce a temperate zone that...
                        // 1. [0..3]   It is a tapping zone
                        // 2. [4..100] don't interfere the video playback, and swallow it so enyo won't get it
                        // 3. [101..~) pass it along letting enyo to dispatch it
                        dx = Math.abs(ev.clientX - this.dragSession.clientX);
                        dy = Math.abs(ev.clientY - this.dragSession.clientY);
                        if (dx > 100 || dy > 100) {
                            if (this.isPlaying) {
                                this.pauseVideo();
                                this.hideControlsGroup && this.hideControlsGroup.cancel();
                            }
                            if (!this.isControlBarShown) {
                                this.showControlsGroup && this.showControlsGroup.execute();
                            }
                        } else if (dx > 3 || dy > 3) {
                            this.stopEvent(ev);
                            return true;
                        }
                    } else if (ev.clientY <= this.barsDim.headerBar.height ||
                               (ev.clientY >= this.barsDim.controlBar.top &&
                                ev.clientY <= this.barsDim.controlBar.top + this.barsDim.controlBar.height &&
                                ev.clientX >= this.barsDim.controlBar.left &&
                                ev.clientX <= this.barsDim.controlBar.left + this.barsDim.controlBar.width)) {
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.captureDomEvent(): a mousemove on controlbar...');
                        this.stopEvent(ev);
                        return true;
                    }
                    break;
                case "mousedown":
                    if (!this.barsDim) { return; }
                    if (ev.clientY <= this.barsDim.headerBar.height) { return; }
                    if (ev.clientY >= this.barsDim.controlBar.top &&
                        ev.clientY <= this.barsDim.controlBar.top + this.barsDim.controlBar.height &&
                        ev.clientX >= this.barsDim.controlBar.left &&
                        ev.clientX <= this.barsDim.controlBar.left + this.barsDim.controlBar.width) {
                        if (/_dbViewVideo_controlBar$/.test(ev.target.id)) {
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.captureDomEvent(): a mousedown on controlbar and swallow it...');
                            this.stopEvent(ev);
                            return true;
                        } else {
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.captureDomEvent(): a mousedown on controlbar from "'+ev.target.id+'"');
                            return;
                        }
                    }
                    this.dragSession = { clientX: ev.clientX, clientY: ev.clientY };
                    break;
                case "mouseup":
                    delete this.dragSession;
                    if (this.isPlaying && this.isControlBarShown) {
                        //this.startMonitor();
                        this.hideControlsGroup && this.hideControlsGroup.schedule(this.defaultHideControlTimeout);
                    }
                    break;
                default:
                    break;
            }
        }
    },

    showVideoHeaderBar: function () {
        var bar = this.$.headerBar;
        if (bar) {
            bar.removeClass("hide-vid-header-bar");
            bar.addClass("show-vid-header-bar");
        }
    },

    hideVideoHeaderBar: function () {
        var bar = this.$.headerBar;
        if (bar) {
            bar.removeClass("show-vid-header-bar");
            bar.addClass("hide-vid-header-bar");
        }
    },

    showVideoControlBar: function (isAutoHide) {
        if (!this.$.controlBar) { return; }

        // before showing the controlbar, sync-up the scrubber and reactivate the scrubber monitor
        this.updateSeeker();
        this.updateTimePlayedTally();
        this.updateTimeRemainTally();

        // delay the showing of controlbar by 250ms allowing enyo scrubber to complete its animation
        var thisInst = this;
        setTimeout(function () {
            thisInst.isControlBarShown = true;
            if (thisInst.$.controlBar) { // if not, then it must have been destroyed due to been swipped away
                thisInst.$.controlBar.removeClass("hide-vid-ctrl-bar");
                thisInst.$.controlBar.addClass("show-vid-ctrl-bar");
            }

            if (thisInst.isPlaying) { thisInst.startMonitor(); }
        }, 250);
    },

    hideVideoControlBar: function () {
        this.isControlBarShown = false;

        // stops the scrubber monitor when the controlbar is hidden to conserve CPU consumption
        this.stopMonitor();

        if (this.$.controlBar) {
            this.$.controlBar.removeClass("show-vid-ctrl-bar");
            this.$.controlBar.addClass("hide-vid-ctrl-bar");
        }
    },

    showControlbars: function () {
        this.showVideoHeaderBar();
        this.showVideoControlBar();
    },

    hideControlbars: function () {
        this.hideVideoHeaderBar();
        this.hideVideoControlBar();
    },

    stopEvent: function (ev) {
        if (ev.stopPropagation) { ev.stopPropagation(); } else { ev.cancelBubble = true; }
        if (ev.preventDefault) { ev.preventDefault(); } else { ev.returnValue = false; }
    },

    /**
     * called when window is resized, e.g. changing the orientation
     */
    adjustSize: function () {
        if (window.PalmSystem) {
            // enyo or LunaSysMgr does not update PalmSystem.windowOrientation, so it is useless
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.adjustSize(): windowOrientation = "'+window.PalmSystem.windowOrientation+'"');
        }

        var dispWidth = window.innerWidth - 20;
        var ctrlbar = this.$.controlBar;
        var seeker = this.$.seeker;
        if (seeker) {
            if (window.innerWidth < 667) {
                if (ctrlbar.node) {
                    ctrlbar.node.style.left = "0px";
                    ctrlbar.node.style.width = dispWidth+"px";
                }
                seeker.removeClass("seeker-wide");
                seeker.addClass("seeker-narrow");
                if (seeker.node) { seeker.node.style.width = (dispWidth-20)+"px"; }
            } else {
                if (ctrlbar.node) {
                    ctrlbar.node.style.left = (Math.floor((window.innerWidth-667)/2))+"px";
                    ctrlbar.node.style.width = "647px";
                }
                if (seeker.node) { seeker.node.style.width = "430px"; }
                seeker.removeClass("seeker-narrow");
                seeker.addClass("seeker-wide");
            }
        }

        this.$.seeker.onWindowResize();   // makes the seeker to set its slider size
        this.updateBarsDim();

        var aspectRatio = 1, nearestAncestor = null, containerNode = null;
        if (!this.$.video.node) {
            if (this.bufferImage && this.parent) {
                nearestAncestor = this.parent;
                while (nearestAncestor && !nearestAncestor.node) {
                    nearestAncestor = nearestAncestor.parent;
                }
                if (nearestAncestor && nearestAncestor.node) {
                    containerNode = nearestAncestor.node;
                    aspectRatio = this.bufferImage.width/this.bufferImage.height;
                    if (aspectRatio >= 1.0) {   // landscape
                        this.bufferImage.width = containerNode.clientWidth;
                        this.bufferImage.height = Math.floor(this.bufferImage.width/aspectRatio);
                    } else {                    // portrait
                        this.bufferImage.height = containerNode.clientHeight;
                        this.bufferImage.width = Math.floor(this.bufferImage.height*aspectRatio);
                    }
                }
            }
            this.inherited(arguments);  // call the enyo.SizeableImage.adjustSize()
            return;
        }

        this.adjustVideoSize();

        if (this.loadState == this.IS_LOADED) { return; }
        this.$.image.hasNode() && this.adjustPosterSize();
    },

    adjustPosterSize: function () {
        var naturalWidth = this.bufferImage.naturalWidth;
        var naturalHeight = this.bufferImage.naturalHeight;
        var src = this.bufferImage.src;
        var aspectRatio = naturalWidth/naturalHeight;
        var displayWidth = window.innerWidth;
        var displayHeight = window.innerHeight;
        var width = displayWidth;
        var height = Math.floor(width/aspectRatio);
        if (height > displayHeight) {
            height = displayHeight;
            width = Math.floor(height*aspectRatio);
        }
        if (/blank-video.png/.test(src)) {
            if (displayWidth/displayHeight > 1.0 && displayHeight - height < 81) {
                height = displayHeight - 80;
                width = Math.floor(height*aspectRatio);
            }
        }

        this.$.image.node.src = src;
        //var x = Math.floor((displayWidth - width)/2);
        //var y = Math.floor((displayHeight - height)/2);
        //this.$.image.node.style.left = x+"px";
        //this.$.image.node.style.top = y+"px";
        this.$.image.node.style.width = width+"px";
        this.$.image.node.style.height = height+"px";
    },

    updateBarsDim: function () {
        var hBar = this.$.headerBar.node || this.$.headerBar.hasNode();
        var cBar = this.$.controlBar.node || this.$.controlBar.hasNode();
        this.barsDim = {
            headerBar: { left: hBar.offsetLeft, top: hBar.offsetTop,
                         width: hBar.offsetWidth, height: hBar.offsetHeight
                       },
            controlBar: { left: cBar.offsetLeft, top: cBar.offsetTop,
                          width: cBar.offsetWidth, height: cBar.offsetHeight
                        }
        };
    },

    onVideoLoad: function (ev) {
        if (!this.$.video || !this.$.video.node) { return; }  // should never happen

        // remove the poster image
        var posterParent = null;
        if (this.$.image.node) {
            posterParent = this.$.image.node.parentNode;
            if (posterParent) {
                posterParent.removeChild(this.$.image.node);
            }
        }

        // may also get other meta data about the video now
        var node = this.$.video.node;
        this.nativeWidth = node.videoWidth;
        this.nativeHeight = node.videoHeight;
        this.aspectRatio = this.nativeWidth/this.nativeHeight;
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.onVideoLoad(): "'+this.dbEntry.path+'" w:'+node.videoWidth+', h:'+node.videoHeight);

        var duration = node.duration;
        duration = (undefined != duration && !isNaN(duration)) ? duration : this.dbEntry.duration;
        this.duration = duration;
        this.playTimeMeta.tDuration = duration;

        this.mediadService = node.getAttribute("x-palm-media-control");

        this.adjustPlayStartTime();
    },

    /*
    onVideoIconClicked: function (inSender, ev) {
        this.onPlayClicked(inSender, ev);
    },
    */

    /**
     * @param isPlay - boolean, if true, then show the pause icon; if false, then show the play icon.
     */
    setPlayButtonState: function (isPlay) {
        var button = this.$.playButton;
        if (isPlay) {
            button.removeClass("play-button");
            button.addClass("pause-button");
        } else {
            button.removeClass("pause-button");
            button.addClass("play-button");
        }
    },

    onPlayClicked: function (inSender, ev) {
        this.stopEvent(ev);
        if (this.isTailgatingEvent()) { return; }  // swallow this tailgating event

        //this.isInFocused = true;   // this is a hack to get around the double loading issue from DbPages
                                   // When loading the same video again, the isInFocused setting is lost

        var toggleToPlay = false;
        if (this.loadState == this.IS_LOADED) {
            if (!this.isPlaying) { toggleToPlay = true; }
        } else {
            if (!this.isAutoStart) { toggleToPlay = true; }
        }

        if (toggleToPlay) {
            this.hideControlsGroup && this.hideControlsGroup.schedule(this.defaultHideControlTimeout);
            this.playVideo();
        } else {
            this.hideControlsGroup && this.hideControlsGroup.cancel();
            this.pauseVideo();
        }
    },

    /**
     * This method sets the time played and the time remain tallies reflecting the newPos given.
     * It is often called whenever the requestVideoSeek() is called, and it can be called regardless
     * whether the video has been loaded or not.
     *
     * @param newPos - It is the new seek-to position.  It is a number [0..100] representing the
     *                 percentage of how far into the total video duration to seek to.
     */
    updateTimeTallies: function (newPos) {
        var duration = this.dbEntry.duration;
        var timeToSeek = duration*(newPos/100);
        this.updateTimePlayedTally(timeToSeek);
        this.updateTimeRemainTally(duration - timeToSeek);
    },

    /**
     * This method sets the play time to the video node triggering the seek request to the mediaserver.
     * It throttles the seeking requests to reduce the hits to the mediaserver.
     *
     * @param newPos - It is the new seek-to position.  It is a number [0..100] representing the
     *                 percentage of how far into the total video duration to seek to.
     */
    requestVideoSeek: function (newPos) {
        if (!this.$.video || !this.$.video.node) { return; }
        var thisInst = this;
        var node = this.$.video.node;
        var timeSeekTo = newPos/100*node.duration;
        //if (this.lastSeekToRequested == timeSeekTo) { return; }  // b/c mediaserver ignores the same seek req

        if (this.videoSeekingRequestPending) {
//console.log("****@@@@@@><@@@@@@**** vidslide  DbViewVideo.requestVideoSeek(newPos="+newPos+"): PENDING seek to: "+newPos/100*this.$.video.node.duration);
            this.seekToPosition = newPos;
            return;
        }

        //delete this.seekToPosition;
        try {
//console.log("****@@@@@@><@@@@@@**** vidslide  DbViewVideo.requestVideoSeek(newPos="+newPos+"): seek REQ to: T("+timeSeekTo+")");
            this.videoSeekingRequestPending = true;
            node.currentTime = timeSeekTo;
            this.lastSeekToRequested = timeSeekTo;

            // schedule the 2nd attempt, as mediaserver some times just ignores it
            if (!this.secondSeekRequestAttemptId) {
                this.secondSeekRequestAttemptId = setTimeout(function () {
                    thisInst.secondSeekRequestAttempt();
                }, 3400);
//console.log("****@@@@@@><@@@@@@**** vidslide  DbViewVideo.requestVideoSeek(): scheduled a 2nd attempt on T("+this.lastSeekToRequested+")");
            }

            if (this.isPlaying) {
                if (this.isControlBarShown) {
                    this.stopMonitor();
                }
            }
        } catch (ex) {
            // most likely that the mediaserver is crashed causing the video node not usable
            console.log("vidslide Unable to seek on video playpack.");
        }
    },

    secondSeekRequestAttempt: function () {
        delete this.secondSeekRequestAttemptId;
        var pos2ndAttempt = undefined, shouldRetry = true;

        // 2nd attempt takes the seekToPosition first, than the lastSeekToRequested
        if (undefined != this.seekToPosition) {
            pos2ndAttempt = this.seekToPosition;
            delete this.seekToPosition;
            if (undefined != this.seekRequestRetryCount) { delete this.seekRequestRetryCount; }
        } else if (undefined != this.lastSeekToRequested) {
            pos2ndAttempt = this.lastSeekToRequested/this.dbEntry.duration*100;   // this.$.video.node.duration *100
            delete this.lastSeekToRequested;
            if (undefined == this.seekRequestRetryCount) {
                this.seekRequestRetryCount = 1;
            } else if (this.seekRequestRetryCount >= 3) {
                shouldRetry = false;
//console.log("****@@@@@@><@@@@@@**** vidslide  DbViewVideo.secondSeekRequestAttempt(): stop retry to newPos="+pos2ndAttempt+" after "+this.seekRequestRetryCount+" attempts");
            } else {
                this.seekRequestRetryCount++;
            }
        } else {
            if (undefined != this.seekRequestRetryCount) { delete this.seekRequestRetryCount; }
        }

        delete this.videoSeekingRequestPending;
        if (undefined != pos2ndAttempt && shouldRetry) {
//console.log("****@@@@@@><@@@@@@**** vidslide  DbViewVideo.secondSeekRequestAttempt(): 2nd attempt newPos="+pos2ndAttempt+"...");
            this.requestVideoSeek(pos2ndAttempt);
        }
    },

    /**
     * This method is called when the video completes a seek request.
     *
     */
    onVideoSeeked: function (ev) {
        if (this.secondSeekRequestAttemptId) {
            // cancels any pending 2nd attempt
            clearTimeout(this.secondSeekRequestAttemptId);
            delete this.secondSeekRequestAttemptId;
            delete this.lastSeekToRequested;
//console.log("****@@@@@@><@@@@@@**** vidslide  DbViewVideo.onVideoSeeked(): canceled the 2nd attempt");
        }

        delete this.videoSeekingRequestPending;
        var newPos = this.seekToPosition;

        if (undefined != newPos) {
//console.log("****@@@@@@><@@@@@@**** vidslide  DbViewVideo.onVideoSeeked(): lastRequested="+this.lastSeekToRequested+", node.currentTime="+this.$.video.node.currentTime+", do pendingPos="+this.seekToPosition+", newPos="+newPos);
            delete this.seekToPosition;
            this.requestVideoSeek(newPos);
            return;
        }

        if (this.isPlaying) {
            if (this.isControlBarShown) {
                this.startMonitor();
                this.hideControlsGroup.schedule(this.defaultHideControlTimeout);
            }
        }
    },

    /**
     * @param observer - It is an object containing the following properties.
     *        { method, (required) it is the function to be invoked.
     *          args    (optional) it is an array of parameters to be passed onto the method
     *                  starting from the 2nd argument.  For example: the method should expect...
     *                      function (currentTime, arg0, arg1, arg2, ...)
     *                  where the currentTime is the current play time publised by the seeked
     *                  event from the mediaserver.  The method invoked has a scope of this
     *                  DbViewVideo instance.
     *        }
     */
    addVideoSeekedEventObserver: function (observer) {
        var observerId = new Date().getTime();
		this.seekedEventObservers[observerId] = observer;
        return observerId;
    },

    /**
     * @param observerId - It is an ID returned by the addVideoSeekedEventObserver()
     */
    removeVideoSeekedEventObserver: function (observerId) {
		delete this.seekedEventObservers[observerId];
    },

    onVideoSeekedEventNotify: function (ev) {
        var currentTime = ev.target.currentTime;    // ev.target == a video DOM element
		var observers = this.seekedEventObservers;
        if (!observers) { return; }
        var obsId, observer, args, thisInst = this;
        for (obsId in observers) if (observers.hasOwnProperty(obsId)) {
            observer = observers[obsId];
            if (observer.args && observer.args.length > 0) {
                args = [ currentTime ].concat(observer.args);
            } else {
                args = [ currentTime ];
            }
            observer.method.apply(thisInst, args);
        }
    },

    /**
     * This method is called rapidly while the scrubber is being dragged.  The scrubber itself
     * has already been repositioned to the new position before this method is called.  What is
     * left to do are:
     * 1. if the playback is in progress, then interrupt it temporarily allowing the mediaserver
     *    to seek without the playback overhead.
     * 2. update the time tallies.
     * 3. request mediaserver to seek.
     *
     * @param newPos - It is a number [0..100] representing the new position percentage along the
     *                 slider rail.
     */
    onSeeking: function (inSender, newPos) {
//console.log("****@@@@@@><@@@@@@**** vidslide  DbViewVideo.onSeeking(newPos="+newPos+"): scrubber drag...");
        this.hideControlsGroup && this.hideControlsGroup.cancel();
        this.isScrubberSeeking = true;

        this.updateTimeTallies(newPos);
        if (this.loadState != this.IS_LOADED || !this.$.video || !this.$.video.node) { return; }

        this.requestVideoSeek(newPos);
    },

    onSeekerTapped: function (inSender, pos, ev) {
        this.hideControlsGroup && this.hideControlsGroup.schedule(this.defaultHideControlTimeout);
        this.stopEvent(ev);

        var duration = this.dbEntry.duration;
        var seekToTime = duration*(pos/100);
        this.updateSeeker((seekToTime/duration)*100);
        this.updateTimePlayedTally(seekToTime);
        this.updateTimeRemainTally(duration - seekToTime);

        if (this.loadState == this.IS_LOADED && this.$.video && this.$.video.node) {
            this.requestVideoSeek(pos);
        } else {
            this.timeSeekToBeforeLoaded = seekToTime;
            this.recordVideoState();
        }
    },

    /**
     * This method is called when mouseup on the scrubber.
     */
    onSeeked: function (inSender, newPos) {
        if (undefined != this.lastOnSeekedPosition && this.lastOnSeekedPosition == newPos && newPos > 0) {
//console.log("****@@@@@@><@@@@@@**** vidslide  DbViewVideo.onSeeked(newPos="+newPos+"): mis-fire, ignore...");
             // some times enyo.ProgressSlider may publish duplicate newPos
             return;
        }
        this.lastOnSeekedPosition = newPos;
//console.log("****@@@@@@><@@@@@@**** vidslide  DbViewVideo.onSeeked(newPos="+newPos+"): scrubber mouseup...");

        delete this.isScrubberSeeking;

        this.updateTimeTallies(newPos);

        if (this.loadState == this.IS_LOADED && this.$.video && this.$.video.node) {
            this.requestVideoSeek(newPos);
        } else {
            this.timeSeekToBeforeLoaded = this.dbEntry.duration*(newPos/100);
            this.recordVideoState();
        }
    },

    onVideoError: function () {
        if (!this.$.video) { return; }
        var msg = null;
        switch (this.$.video.error.code) {
            case 1:  // MEDIA_ERR_ABORTED
                break;
            case 2:  // MEDIA_ERR_NETWORK
                break;
            case 3:  // MEDIA_ERR_DECODE
                msg = $L("Video is corrupted");
                if (this.isPlaying) { this.pauseVideo(); }
                break;
            case 4:  // MEDIA_ERR_SRC_NOT_SUPPORTED
                break;
            default:
                break;
        }
        if (!msg) { return; }
        this.$.msgDialog.setMessage(msg);
    },

    setInFocus: function (isInFocused) {
        this.isInFocused = isInFocused;
    },

    /**
     * This method is meant to be called when tapping on a video from the albums grid intended to start
     * the tapped video as soon as it is loaded.  Calling this method is not the same as setting the
     * vidoe.autoplay.  
     */
    autoStartOnLoad: function () {
        this.setInFocus(true);
        if (!this.$.video) { return; }

        this.showVideoControlBar(true);
        this.playVideo();
    },

    playVideo: function (param) {
        if (!this.$.video) { return; }

        var thisInst = this;
        var doVideoPlay = function () {
            if (!thisInst.$.video.node) { return; }  // should never happen
            if (!thisInst.isInFocused || thisInst.isCarded) { return; }
            if (!thisInst.isAutoStart && !thisInst.isPlaying) { return; }
            if (thisInst.isAutoStart) {
                delete thisInst.isAutoStart;
                thisInst.isPlaying = true;
            }

            thisInst.getDisplayState();
            thisInst.lockWindowOrientation();
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.playVideo(): instanceId='+thisInst.instanceId+' ('+thisInst.mediadService+'), REQ to play "'+thisInst.dbEntry.path+'"...');
            thisInst.$.video.node.play();
            if (thisInst.isControlBarShown) { thisInst.startMonitor(); }
            thisInst.requestVideoFillFitMode();  // effective only when the video is being played
            window.PalmSystem && window.PalmSystem.setWindowProperties({ blockScreenTimeout: true });
        };

        this.setPlayButtonState(true);

        switch (this.loadState) {
            case this.IS_LOADED:
                this.isPlaying = true;
                doVideoPlay();
                break;
            case this.IS_NOT_LOADED:
                this.isAutoStart = true;
                this.initVideo(doVideoPlay);
                break;
            case this.IS_LOADEDING:
                this.isAutoStart = true;
                break;
            default:
                break;  // should never get here
        }
    },

    pauseVideo: function () {
        if (!this.$.video.node) { return; }

        this.setPlayButtonState(false);
        this.isPlaying = false;
        if (undefined != this.isAutoStart) { delete this.isAutoStart; }
        this.stopMonitor();

        switch (this.loadState) {
            case this.IS_LOADED:
                if (!this.$.video.node.paused) {
                    this.isPauseRequestPending = true;
                    this.doPause();
                }
                window.PalmSystem && window.PalmSystem.setWindowProperties({ blockScreenTimeout: false });
                //this.unlockWindowOrientation();
                break;
            case this.IS_NOT_LOADED:
            case this.IS_LOADEDING:
                // no-op
                break;
            default:
                break;    // should never get here
        }

    },

    doPause: function () {
        if (!this.isPauseRequestPending) { return; }
        if (this.isPlaying || !this.$.video) { return; }

//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.doPause(): instanceId='+this.instanceId+' ('+this.mediadService+'), REQ to pause "'+this.dbEntry.path+'"...');
        this.$.video.node.pause();
        var thisInst = this;
        setTimeout(function () {
            thisInst.doPause();
        }, 250);
    },

    mediaplayerInitiatedPauseHandler: function () {
        if (undefined != this.isPauseRequestPending) { delete this.isPauseRequestPending; }
        if (!this.isPlaying) { return; }
        this.isPlaying = false;
        this.stopMonitor();
        this.$.playButton.removeClass("pause-button");
        this.$.playButton.addClass("play-button");
        this.updateTimePlayedTally();
        this.updateTimeRemainTally();
        window.PalmSystem && window.PalmSystem.setWindowProperties({ blockScreenTimeout: false });
    },

    /**
     * Because enyo.sizeableImage.clickHandler fires an extra event causing our event handler been
     * called twice in a row.  It's not good.  This function detects such tailgating events and
     * enables the caller to determine whether or not to swallow it.
     */
    isTailgatingEvent: function () {
        var now = new Date(), isTailgating = false;
        if (this.lastClickTime) {
            if ((now.getTime()-this.lastClickTime.getTime()) < 700) {
                isTailgating = true;
//console.log("****@@@@@@><@@@@@@**** vidslide  DbViewVideo.isTailgatingEvent(): "+(now.getTime()-this.lastClickTime.getTime())+"ms from last");
            }
        }
        this.lastClickTime = now;
        return isTailgating;
    },

    onResizeClicked: function (inSender, ev) {
        this.stopEvent(ev);
        if (this.isTailgatingEvent()) { return; }  // swallow this tailgating event

        // because mediaserver's fit/fill mode does not work when it is paused, so do nothing in that case
        if (!this.isPlaying) { return; }

        if (!this.$.video.node) {
            var thisInst = this;
            var toggleViewSize = function () { thisInst.toggleViewSize(); };
            this.initVideo(toggleViewSize);
        } else {
            this.toggleViewSize();
        }

        this.hideControlsGroup && this.hideControlsGroup.schedule(4000);  // this.defaultHideControlTimeout
    },

    adjustVideoSizeDesktopMode: function () {
        var vpNode, width, height, containerWidth, containerHeight;
        if (!this.$.video || !this.$.video.node) {
            containerWidth = window.innerWidth;
            containerHeight = window.innerHeight;
        } else {
            vpNode = this.$.video.node.parentNode;
            containerWidth = vpNode ? vpNode.clientWidth : window.innerWidth;
            containerHeight = vpNode ? vpNode.clientHeight: window.innerHeight;
        }
        var containerAr = containerWidth/containerHeight;
        if (this.viewSizeCode == 2) {
            width = containerWidth;
        } else {
            width = this.nativeWidth <= containerWidth ? this.nativeWidth : containerWidth;
        }
        height = Math.floor(width/this.aspectRatio);
        if (height > containerHeight) {
            height = containerHeight;
            width = Math.floor(height*this.aspectRatio);
        }

        var top = containerHeight > height ? Math.floor((containerHeight-height)/2) : 0;
        var left = containerWidth > width ? Math.floor((containerWidth-width)/2) : 0;
        /*
        this.$.video.applyStyle("position", "absolute");
        this.$.video.applyStyle("left", left+"px");
        this.$.video.applyStyle("top", top+"px");
        this.$.video.applyStyle("width", width+"px");
        this.$.video.applyStyle("height", height+"px");
        */
        var node = this.$.video.node;
        if (!node) { return; }
        node.style.position = "absolute";
        node.style.left = left+"px";
        node.style.top = top+"px";
        node.style.width = width+"px";
        node.style.height = height+"px";
    },

    adjustVideoSizeDeviceMode: function () {
        var vpNode, width, height, containerWidth, containerHeight;
        if (!this.$.video || !this.$.video.node) {
            containerWidth = window.innerWidth;
            containerHeight = window.innerHeight;
        } else {
            // note that the fall back width/height taken from window.innerWidth/innerHeight 
            // takes the adventage of the inability of mediaserver not be able to support arbitrary
            // size other than the device screen size.  However, once the mediaserver is able to
            // support it in the future, then the resize calculation code block commented out below
            // can be re-applied, but needs to be revised matching whatever the mediaserver can support.
            vpNode = this.$.video.node.parentNode;
            containerWidth = vpNode ? vpNode.clientWidth : window.innerWidth;
            containerHeight = vpNode ? vpNode.clientHeight: window.innerHeight;
// videoWidth and videoHeight may be zero
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.adjustVideoSizeDeviceMode(): on "'+this.dbEntry.path+'", videoWidth='+this.$.video.node.videoWidth+', videoHeight='+this.$.video.node.videoHeight);
        }
        var containerAr = containerWidth/containerHeight;
        var nativeAr = this.aspectRatio;

        /* NOTE: viewSizeCode is - 1:FIT, 2:FILL */
        /*
        if (nativeAr >= 1.0) {         // landscape video
            if (containerAr >= 1.0) {      // orientation up|down, i.e. landscape orientation
                if (this.viewSizeCode == 2) {
                    // TODO should enter the fill mode (waiting for mediaserver to supply this API)
                    height = containerHeight;
                    width = Math.floor(height*nativeAr);
                } else {
                    // TODO should enter the fit mode (waiting for mediaserver to supply this API)
                    width = containerWidth;
                    height = Math.floor(width/nativeAr);
                }
            } else {                       // orientation left|right, i.e. portrait orientation
                if (this.viewSizeCode == 2) {
                    // TODO should enter the fill mode (waiting for mediaserver to supply this API)
                    height = containerHeight;
                    width = Math.floor(height*nativeAr);
//console.log("><><><><><><><>< photos.video: orientation:portrait, fill, "+width+"X"+height+", Topaz:"+containerWidth+"X"+containerHeight);
                } else {
                    // containerWidth = 768, containerHeight = 1024
                    // TODO should enter the fit mode (waiting for mediaserver to supply this API)
                    height = containerHeight;
                    width = Math.floor(height*nativeAr);
                    // if (height > containerWidth) {
                    //     height = containerWidth;
                    //     width = Math.floor(height*nativeAr);
                    // }
//console.log("**@@@@@**@@@@@**@@@@@** vidslide photos.DbViewVideo.adjustVideoSizeDeviceMode: orientation:portrait, fit, "+width+"X"+height+", Topaz:"+containerWidth+"X"+containerHeight);
                }
            }
        } else {                       // portrait video
            if (containerAr >= 1.0) {      // orientation up|down, i.e. landscape orientation
                if (this.viewSizeCode == 2) {
                    // TODO should enter the fill mode (waiting for mediaserver to supply this API)
                    width = containerWidth;
                    height = Math.floor(width/nativeAr);
                } else {
                    // TODO should enter the fit mode (waiting for mediaserver to supply this API)
                    height = containerHeight;
                    width = Math.floor(height*nativeAr);
                }
            } else {                       // orientation left|right, i.e. portrait orientation
                if (this.viewSizeCode == 2) {
                    // TODO should enter the fill mode (waiting for mediaserver to supply this API)
                    height = containerHeight;
                    width = Math.floor(height*nativeAr);
                } else {
                    // TODO should enter the fit mode (waiting for mediaserver to supply this API)
                }
            }
        }
        */

        // NOTE: At this time, the mediaserver does not respect the HTML5 video spec.  For example,
        //       both the videoWidth and videoHeight are not set, does not respond to the width/height,
        //       nor does it honer the top/left, it just fits and centers it to the display.  For now,
        //       we'll just keep the containing DIV wide open letting the mediaserver plays within.
        width = containerWidth;
        height = containerHeight;

        var top = containerHeight > height ? Math.floor((containerHeight-height)/2) : 0;
        var left = containerWidth > width ? Math.floor((containerWidth-width)/2) : 0;
        /*
        this.$.video.applyStyle("position", "absolute");
        this.$.video.applyStyle("left", left+"px");
        this.$.video.applyStyle("top", top+"px");
        this.$.video.applyStyle("width", width+"px");
        this.$.video.applyStyle("height", height+"px");
        */

        var node = this.$.video.node;
        if (!node) { return; }
        node.style.position = "absolute";
        node.style.left = left+"px";
        node.style.top = top+"px";
        node.style.width = width+"px";
        node.style.height = height+"px";

        this.requestVideoFillFitMode();
    },

    requestVideoFillFitMode: function () {
        var serviceParam, requestParam;
        // implementation to the mediaserver's fit/fill interface,  it works only when it is playing
        if (this.mediadService && this.isPlaying) {
            /* DFISH-28057 -
               switch from mediaserver async call
               to setting mediad extension attribute via HTML video node
               so that WebKit gets notified sooner.
            serviceParam = { service: this.mediadService, method: "setFitMode" };
            requestParam = this.viewSizeCode == 2 ? { args: [ "VIDEO_FILL" ] } : { args: [ "VIDEO_FIT" ] };
            this.$.mediaserver.call(requestParam, serviceParam);
            */
            this.$.video.node.setAttribute("x-palm-media-extended-fitmode",
                                           this.viewSizeCode == 2 ? "VIDEO_FILL" : "VIDEO_FIT");
        }
    },

    updateViewSizeButton: function () {
		switch (this.viewSizeCode) {
            case 2:              // FILL
                this.$.resizeButton.removeClass("zoom-larger-button");
                this.$.resizeButton.addClass("zoom-smaller-button");
                break;
            case 1:              // FIT
            default:
                this.$.resizeButton.removeClass("zoom-smaller-button");
                this.$.resizeButton.addClass("zoom-larger-button");
                break;
        }
    },

    toggleViewSize: function (isReset) {
        if (!this.$.video.node) { return; }

        this.ctor.prototype.viewSizeCode = this.viewSizeCode == 1 ? 2 : 1;
        this.updateViewSizeButton();

        this.adjustVideoSize();
    },

    startMonitor: function () {
        if (this.playMonitorId) { return; }
        var node = this.$.video.node;
        var currentTime = undefined;
        if (node && undefined != node.currentTime && !isNaN(node.currentTime)) {
            currentTime = node.currentTime;
        } else {
            currentTime = this.getLastPlayTimeRecorded(this.dbEntry._id);
            if (undefined == currentTime || isNaN(currentTime)) { currentTime = 0; }
        }

        this.playTimeMeta.isMonitorInProgress = true;
        this.playTimeMeta.tLastSeeked = currentTime;
        this.playTimeMeta.tScrubberLastUpdate = new Date().getTime();

        var thisInst = this;
        this.playMonitorId = setInterval(function () {
            thisInst.updateTimePlayedTally();
            thisInst.updateTimeRemainTally();
        }, 1000);

        // It appears that mediaserver updates the time every 200ms
        // To animate the scrubber, 80ms interval on video longer than 30sec, 10ms on less than 30sec
        this.updateSeekerByStartMonitor = true;
        this.updateSeekerId = setInterval(function () {
            thisInst.updateSeeker();
        }, this.playTimeMeta.tDuration < 30 ? 10 : 80);
    },

    stopMonitor: function () {
        if (this.playMonitorId) {
            clearInterval(this.playMonitorId);
            this.playMonitorId = null;
            clearInterval(this.updateSeekerId);
            this.updateSeekerId = null;

            this.playTimeMeta.isMonitorInProgress = false;
            this.playTimeMeta.tScrubberLastUpdate = 0;
        }
    },

    suspend: function () {
        if (this.isPlaying) {
            this.pauseVideo();
        }
    },

    /**
     * @param newValue - (optional) if it is specified, then it is a number in miliseconds representing
     *                   the played time to display.
     */
    updateTimePlayedTally: function (newValue) {
        var tPassed = 0.0, currTime = undefined;
        if (newValue !== undefined) {
            tPassed = newValue;
        } else if (this.loadState == this.IS_LOADED) {
            currTime = this.$.video.node.currentTime;
            if (undefined != currTime && null != currTime) {
                tPassed = this.$.video.node.currentTime;
            }
        } else {
            tPassed = this.getLastPlayTimeRecorded(this.dbEntry._id);
            if (undefined == tPassed || tPassed < 0 || tPassed >= this.dbEntry.duration) { tPassed = 0.0; }
        }
        this.$.timePlayed && this.$.timePlayed.setContent(this.secondsToTimeString(tPassed));
    },

    /**
     * @param newValue - (optional) if it is specified, then it is a number in miliseconds representing
     *                   the time remain to play.
     */
    updateTimeRemainTally: function (newValue) {
        var tPassed = 0, tRemain = this.dbEntry.duration;
        if (newValue !== undefined) {
            tRemain = newValue;
        } else if (this.loadState == this.IS_LOADED) {
            tPassed = this.$.video.node.currentTime;
            tRemain = tRemain - tPassed;
        } else {
            tPassed = this.getLastPlayTimeRecorded(this.dbEntry._id);
            if (undefined != tPassed && tPassed >= 0 && tPassed < this.dbEntry.duration) {
                tRemain = tRemain - tPassed;
            }
        }
        this.$.timeRemain && this.$.timeRemain.setContent("-"+this.secondsToTimeString(tRemain));
    },

    updateSeeker: function (newValue) {
        var now = new Date().getTime();
        var percentage = 0.0;
        var tMeta = this.playTimeMeta;
        var node, currentTime, duration, lastPlayTime = undefined;
        if (newValue != undefined && !isNaN(newValue)) {
            percentage = newValue;
            if (tMeta.isMonitorInProgress) {
                tMeta.tLastSeeked = percentage/100*tMeta.tDuration;
                tMeta.tScrubberLastUpdate = now;
            }
        } else if (this.loadState != this.IS_LOADED || !this.$.video || !this.$.video.node) {
            lastPlayTime = this.getLastPlayTimeRecorded();
            if (undefined == lastPlayTime) { return; }
            percentage = lastPlayTime/this.dbEntry.duration*100;
        } else {
            // takes the numbers from node, falls back onto dbEntry if needed
            node = this.$.video.node;
            currentTime = node.currentTime;

            // guard against an incorrect reset to the currentTime by the mediaserver (DFISH-27433)
            if (this.updateSeekerByStartMonitor) {
                delete this.updateSeekerByStartMonitor;
                if (0 == currentTime) {
                    this.updateSeekerByZero = true;
                    return;
                }
            } else if (this.updateSeekerByZero) {
                if (0 == currentTime) {
                    return;
                } else {
                    delete this.updateSeekerByZero;
                }
            }

            if (undefined == currentTime || isNaN(currentTime)) { return; }

            duration = tMeta.tDuration;

            if (tMeta.isMonitorInProgress) {
                // on monitor initiated update, use this.playTimeMeta to calc and animate the seeker position
                if (currentTime <= tMeta.tLastSeeked) {
                    currentTime = tMeta.tLastSeeked + (now - tMeta.tScrubberLastUpdate)/1000;
                }
                tMeta.tLastSeeked = currentTime;
                tMeta.tScrubberLastUpdate = now;
            }
            percentage = currentTime/duration*100;
        }

        percentage = percentage > 100.0 ? 100.0 : percentage < 0.0 ? 0.0 : percentage;
        this.$.seeker.setPosition(percentage);
    },

    updateOnLoadProgress: function (ev) {
        var buf = ev.target.buffered;
        if (0 == buf.length) { return; }
        var tBuf = buf.end(buf.length-1);
        var bufPos = Math.floor((tBuf/ev.target.duration)*100);
        this.$.seeker.setBarPosition(bufPos);
    },

    secondsToTimeString: function (seconds) {
        var iSeconds = Math.round(seconds);
        var sec = iSeconds%60;
        var iMinutes = Math.floor((iSeconds-sec)/60);
        var min = iMinutes%60;
        var hr = Math.floor((iMinutes-min)/60);
        var strArr = [];
        if (hr > 0) { strArr.push(hr.toString()); }
        if (min > 0) {
            strArr.push(min > 9 ? min.toString() : ("0"+min));
        } else {
            strArr.push("00");
        }
        if (sec > 0) {
            strArr.push(sec > 9 ? sec.toString() : ("0"+sec));
        } else {
            strArr.push("00");
        }
        return strArr.join(":");
    },

    showVolumeSelector: function (inSender, ev) {
        //this.$.volumeButton.openAtControl(inSender. { top: -100 });
    },

    /**
     * If the current video has been viewed previously, then set its start time to where it is left
     * from the last view.
     */
    adjustPlayStartTime: function () {
        if (!this.$.video || !this.$.video.node) { return; }
        var node = this.$.video.node;
        var lastPlayTime = this.getLastPlayTimeRecorded(this.dbEntry._id);
        if (!lastPlayTime) { return; }
        if (lastPlayTime >= node.duration) { return; }

        // register a handler listening to the mediaserver's response on setting the starting play time.
        // It is in the handler that the monitor is started avoiding a race condition of bouncing scrubber
        // due to the starting of the monitor too soon.
        this.videoSeekedObserverId = this.addVideoSeekedEventObserver({
            method: this.videoStartPositionReadinessHandler,
            args: [ lastPlayTime ]
        });
//console.log("****@@@@@@><@@@@@@**** vidslide  DbViewVideo.adjustPlayStartTime(): instanceId="+this.instanceId+" ("+this.mediadService+"), node.paused="+this.$.video.node.paused+", seek to "+lastPlayTime);
        node.currentTime = lastPlayTime;
        this.updateSeeker((lastPlayTime/node.duration)*100);
    },

    videoStartPositionReadinessHandler: function (actualTime, expectedStartTime) {
        if (Math.abs(actualTime - expectedStartTime) > 3.0) { return; }

        if (this.isPlaying || this.isAutoStart) { this.startMonitor(); }
        if (this.videoSeekedObserverId) {
            this.removeVideoSeekedEventObserver(this.videoSeekedObserverId);
            delete this.videoSeekedObserverId;
        }
    },

    recordVideoState: function () {
        var pictId = this.dbEntry._id;
        var playedStates = this.playedStates;
        var state = playedStates[pictId];
        var node;
        if (this.loadState != this.IS_LOADED || !this.$.video || !this.$.video.node) {
            if (undefined != this.timeSeekToBeforeLoaded &&
                this.timeSeekToBeforeLoaded >= 0 &&
                this.timeSeekToBeforeLoaded < this.dbEntry.duration) {
                if (!state) { this.ctor.prototype.playedStates[pictId] = state = {}; }
                state.lastPlayTime = this.timeSeekToBeforeLoaded;
                this.persistVideoState(pictId, state);
            }
            return;
        } else {
            node = this.$.video.node;
            if (!state) { this.ctor.prototype.playedStates[pictId] = state = {}; }
            state.lastPlayTime = node.currentTime;
            this.persistVideoState(pictId, state);
        }
    },

    /**
     * Write the video state to MojoDB.
     *
     * @param pictId It is the pictId to which the state is associated with.
     * @param state It is the state to persist.
     */
    persistVideoState: function (pictId, state) {
        if (!pictId || !state || undefined == state.lastPlayTime || null == state.lastPlayTime) { return; }
        var params = {
            props: { lastPlayTime: state.lastPlayTime },
            query: { from:  "com.palm.media.video.file:1",
                     where: [{ prop: "_id", op: "=", val: pictId }]
                   }
        };
        this.$.videoDbService.call(params);
    },

    videoDbUpdateAckSuccessHandler: function (videoDbService, resp, req) {
        // expect resp = {returnValue:true, count:1}
    },

    videoDbUpdateAckFailureHandler: function (videoDbService, resp, req) {
        // expect resp = {returnValue:true, count:0}
    },

    onLeaveView: function () {
        this.onSwipeOutHandler();
        this.destroy();
    },

    pauseAndShowControls: function () {
        if (this.isPlaying || (this.loadState == this.IS_LOADING && this.isAutoStart)) {
            this.pauseVideo();
        }
        this.hideControlsGroup && this.hideControlsGroup.cancel();
        if (!this.isControlBarShown) {
            this.showControlsGroup && this.showControlsGroup.execute();
        }
    },

    onWindowBlurHandler: function () {
        this.isCarded = true;
        this.pauseAndShowControls();
        this.recordVideoState();
    },

    onWindowCloseHandler: function () {
        this.onWindowBlurHandler();
    },

    onWindowFocusHandler: function () {
        this.isCarded = false;
        if (!this.isPlaying && !this.isControlBarShown) {
            this.showControlsGroup && this.showControlsGroup.execute();
        }
        this.hideControlsGroup && this.hideControlsGroup.cancel();
    },

    windowDeactivatedHandler: function () {
        this.onWindowBlurHandler();
    },

    windowActivatedHandler: function () {
        this.onWindowFocusHandler();
    },

    unloadHandler: function () {
        this.onWindowCloseHandler();
        this.destroy();
    },

    joinShowHideControlsGroups: function () {
        if (this.showControlsGroup && !this.showControlsGroupTaskId) { this.registerToShowControlsGroup(); }
        if (this.hideControlsGroup && !this.hideControlsGroupTaskId) { this.registerToHideControlsGroup(); }
    },

    departFromShowHideControlsGroups: function () {
        if (this.showControlsGroup && this.showControlsGroupTaskId) {
            this.showControlsGroup.removeTask(this.showControlsGroupTaskId);
        }
        delete this.showControlsGroupTaskId;

        if (this.hideControlsGroup && this.hideControlsGroupTaskId) {
            this.hideControlsGroup.removeTask(this.hideControlsGroupTaskId);
        }
        delete this.hideControlsGroupTaskId;
    },

    destroy: function () {
//console.log('****@@@@@@><@@@@@@**** vidslide  DbViewVideo.destroy(): instance='+this.instanceId+', loadState='+this.loadState+' on "'+this.dbEntry.path+'"');
        var type;
        var node = this.$.video.node;
        var handlers = this.videoInstanceEventHandlers;
        var removedCount = 0;
        if (node && handlers) {
            for (type in handlers) if (handlers.hasOwnProperty(type)) {
                node.removeEventListener(type, handlers[type], false);
                removedCount++;
            }
            delete this.videoInstanceEventHandlers;
        }
        var windlers = this.windowEventHandlers;
        if (windlers) {
            for (type in windlers) if (windlers.hasOwnProperty(type)) {
                window.removeEventListener(type, windlers[type], false);
                removedCount++;
            }
            delete this.windowEventHandlers;
        }

        this.pauseVideo();
        var parentNode;
        if (this.$.video.node) {
            parentNode = this.$.video.node.parentNode;
            if (parentNode) {
                parentNode.removeChild(this.$.video.node);
            }
            delete this.$.video.node;
        }
        this.departFromShowHideControlsGroups();

        this.$.image.destroy();
        this.$.controlBar.destroy();

        this.inherited(arguments);
        this.unlockWindowOrientation();
        if (this.barsDim) { delete this.barsDim; }
    },

    getDisplayState: function () {
        if (!window.PalmSystem) {
            return;
        }
        this.$.dispService.call(
            { properties: [ "onWhenConnected", "timeout", "requestBlock", "powerKeyBlock" ] },
            { method: "getProperty", onSuccess: "getDisplayStateResponseHandler" }
        );
    },

    getDisplayStateResponseHandler: function (dispService, resp) {
        /*
        resp.onWhenConnected = false
        resp.timeout = 60
        resp.requestBlock = false
        resp.powerKeyBlock = false
        */
    },

    displayRequestFailureHandler: function (dispService, resp) {
        console.log("photos.DbViewVideo: displayRequestFailure  Error: "+enyo.json.stringify(resp));
    },

    subscribeHeadsetState: function () {
        if (!window.PalmSystem) { return; }
        this.$.headsetService.call({});
    },

    headsetStatusResponseHandler: function (headsetService, resp) {
        if (!resp || resp.key !== "headset") { return; }
        switch (resp.state) {
            case "down":    // the headset is plugged in
                break;
            case "up":      // the headset is unplugged
                this.pauseAndShowControls();
                break;
            default:
                break;
        }
    },

    headsetStatusFailHandler: function (headsetService, resp) {
        console.log("photos.DbViewVideo: headsetRequestFailure  Error: "+enyo.json.stringify(resp));
    },

    mediaserverRequestFailHandler: function (mediaserverService, resp) {
        console.log("photos.DbViewVideo: mediaserverRequestFailure  Error: "+enyo.json.stringify(resp));
    },

    gesturestartHandler: function(inSender, ev) {
    },
    gesturechangeHandler: function(inSender, ev) {
    },
    gestureendHandler: function(inSender, ev) {
    }
});
