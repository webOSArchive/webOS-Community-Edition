
enyo.kind({
    name: "SwipeTransition",
    kind: "Component",
    events: {
        onTap: "",
        onAbort: "",          // when the SwipeTransition detects no slide to fetch
        onNoPhotoToPlay: "",  // in respond to play() but the playList is empty
        onTransitionEnd: ""   // at the end of each transition
    },
    slidingIntervalMilliseconds: 10000,  // default 10 seconds

    constructor: function () {
        this.inherited(arguments);
                                         // each slide is an object with the following...
        this.prevSlide = undefined;      // { src: { playListIndex, albumId, pictId, path },
        this.focusedSlide = undefined;   //   dom: { div, img }                  @see createSlide()
        this.nextSlide = undefined;      //   dim: { top, left, width, height }  @see calcFitDimension()
                                         // }
        this.isPaused = true;
    },

    /**
     * It factories an inner kind.
     *
     * @param el It is a DOM element to which to shield.  It is the viewPortEl in the case of slideshow.
     *
     * @return It returns an object { el, mousedownHandler, div }
     */
    createShield: function (el) {
        if (!el) { return; }
        var thisInst = this;
        var shield = {
            el: el,
            div: document.createElement("div"),
            init: function () {
                var el = this.el, div = this.div;
                el.addEventListener("mousedown", this.mousedownHandler, false);
                div.addEventListener("mouseup", this.mouseupHandler, false);
                div.addEventListener("mousemove", this.mousemoveHandler, false);
                div.addEventListener("mouseout", this.mouseupHandler, false);

                div.style.position = "absolute";
                div.style.top = "0px";
                div.style.left = "0px";
                this.resize(el, div);
            },
            mousedownCoord: undefined,
            mousedownHandler: function (ev) {
                var evTelId = ev.target.id;
                var evCelId = ev.currentTarget.id;
                if (evTelId != evCelId) {
                    if (!/^img-/.test(evTelId) || (evCelId != "slideshow" && evCelId != "ui_slideshowMode")) {
//console.log("****XXXXXX><XXXXXX**** vidslide  SwipeTransition.shield.mousedown(): target='"+evTelId+"' != currentTarget='"+evCelId+"', skip");
                        return;
                    }
                } else if (evTelId != "slideshow" && evTelId != "ui_slideshowMode") {
//console.log("****XXXXXX><XXXXXX**** vidslide  SwipeTransition.shield.mousedown(): target='"+evTelId+"' is neither 'slideshow' nor 'ui_slideshow', skip");
                    return;
                }

                var shield = thisInst.shield;
                if (!shield.isShieldingPermitted(ev)) { 
//console.log("****@@@@@@><@@@@@@**** vidslide  SwipeTransition.shield.mousedown(): target='"+evTelId+"', currentTarget='"+evCelId+"', not permitted at this time.");
                    return;
                }
//console.log("****@@@@@@><@@@@@@**** vidslide  SwipeTransition.shield.mousedown(): target='"+evTelId+"', currentTarget='"+evCelId+"'");
                shield.mousedownCoord = { x: ev.pageX, y: ev.pageY, t: ev.timeStamp, ev: ev };
                shield.el.appendChild(shield.div);

                thisInst.stopEvent(ev);
            },
            mouseupHandler: function (ev) {
                var shield = thisInst.shield;
                if (!shield || !shield.mousedownCoord) { return; }
                if (thisInst.isTailgatingEvent(ev)) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SwipeTransition.shield.mouseup(): tailgating event, target='"+ev.target.id+"', currentTarget='"+ev.currentTarget.id+"', ignore");
                    thisInst.stopEvent(ev);
                    return;
                }
//console.log("****@@@@@@><@@@@@@**** vidslide  SwipeTransition.shield.mouseup(): target='"+ev.target.id+"', currentTarget='"+ev.currentTarget.id+"'");
                if (shield.div.parentNode) {
                    shield.div.parentNode.removeChild(shield.div);
                }

                var m = shield.mousedownCoord;
                var tapObserver = shield.onTapObserver;
                var dragEndObserver = shield.onDragEndObserver;
                if (!shield.isDragIntent) {
                    if (tapObserver) {
                        tapObserver.method.apply(tapObserver.scope, [ev].concat(tapObserver.args));
                    }
                } else {
                    delete shield.isDragIntent;
                    delete shield.mousedownCoord;
                    if (dragEndObserver) {
                       dragEndObserver.method.apply(dragEndObserver.scope, [ev].concat(dragEndObserver.args));
                    }
                }
                thisInst.stopEvent(ev);  // may need to let the observer to stop the event, will see...
            },
            mousemoveHandler: function (ev) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SwipeTransition.shield.mousemoveHandler()...");
                var shield = thisInst.shield;
                var m = shield.mousedownCoord;
                if (!m) { return; }
                var dx = ev.pageX - m.x;
                var dy = ev.pageY - m.y;
                var dragStartObserver = shield.onDragStartObserver;
                var dragObserver = shield.onDragObserver;
                if (!shield.isDragIntent) {
                    if (dx > -5 && dx < 5 && dy > -5 && dy < 5) { return; }
                    shield.isDragIntent = true;
                    if (dragStartObserver) {
                        dragStartObserver.method.apply(
                            dragStartObserver.scope, [m.ev].concat(dragStartObserver.args));
                    }
                } else {
                    if (dragObserver) {
                        dragObserver.method.apply(dragObserver.scope, [ev].concat(dragObserver.args));
                    }
                }
                thisInst.stopEvent(ev);  // may need to let the observer to stop the event, will see...
            },
            resize: function () {
                if (this.el && this.div) {
                    this.div.style.width = this.el.clientWidth+"px";
                    this.div.style.height = this.el.clientHeight+"px";
                }
            },
            /**
             * @param callback = { method, scope, args }, where args is optional and is an array.
             *        The method will be invoked with a mousedown event as its 1st argument.
             *        The method must respond quickly, and it should return a boolean whether
             *        or not to veto a shielding session.
             */
            addShieldingVetoCallback: function (callback) {
                this.veto = this.hitchObserverObject(callback);
            },
            isShieldingPermitted: function (ev) {
                if (!this.veto) { return true; }
                var veto = this.veto;
                return veto.method.apply(veto.scope, [ev].concat(veto.args));
            },
            /**
             * Register an observer to be notified.  The registered observer method will be
             * invoked with the 1st argument an event of the following type depending on the
             * type of observer registered.
             * - "onTapObserver",       the 1st argument to the observer method is a mouseup event
             * - "onDragStartObserver", the 1st argument to the observer method is a mousedown event
             * - "onDragObserver",      the 1st argument to the observer method is a mousemove event
             * - "onDragEndObserver",   the 1st argument to the observer method is a mouse up event
             *
             * @param type - one of "onTapObserver", "onDragStartObserver", "onDragObserver",
             *               "onDragEndObserver"
             * @param observer = { method, scope, args }, where args is optional and is an array.
             */
            addObserver: function (type, observer) {
                var t = this.observerTypes[type];
                if (t) { this[t] = this.hitchObserverObject(observer); }
            },
            observerTypes: {
                onTapObserver:       "onTapObserver",
                onDragStartObserver: "onDragStartObserver",
                onDragObserver:      "onDragObserver",
                onDragEndObserver:   "onDragEndObserver"
            },
            hitchObserverObject: function (observer) {
                return {
                    method: observer.method,
                    scope:  observer.scope ? observer.scope : window,
                    args:   observer.args ? observer.args : []
                };
            },
            destroy: function () {
                if (this.el && this.mousedownHandler) {
                    this.el.removeEventListener("mousedown", this.mousedownHandler, false);
                    delete this.mousedownHandler;
                }
                if (this.div) {
                    if (this.mousemoveHandler) {
                        this.div.removeEventListener("mousemove", this.mousemoveHandler, false);
                        delete this.mousemoveHandler;
                    }
                    if (this.mouseupHandler) {
                        this.div.removeEventListener("mouseup", this.mouseupHandler, false);
                        this.div.removeEventListener("mouseout", this.mouseupHandler, false);
                        delete this.mouseupHandler;
                    }
                    if (this.div.parentNode) { this.div.parentNode.removeChild(this.div); }
                    delete this.div;
                }
                var t;
                for (t in this.observerTypes) if (this.observerTypes.hasOwnProperty(t)) {
                    if (this[t]) { delete this[t]; }
                }
                if (this.mousedownCoord) { delete this.mousedownCoord; }
                if (this.el) { this.el = undefined; }
            }
        };

        return shield;
    },

    activate: function (viewPortEl) {
        var type, observers = this.observers, thisInst = this;
        this.viewPortEl = viewPortEl;
        var shield = this.shield = this.createShield(this.viewPortEl);
        shield.addObserver("onTapObserver",
                          { scope: thisInst, method: thisInst.onTapHandler });
        shield.addObserver("onDragStartObserver",
                          { scope: thisInst, method: thisInst.onDragStartHandler });
        shield.addObserver("onDragObserver",
                          { scope: thisInst, method: thisInst.onDragHandler });
        shield.addObserver("onDragEndObserver",
                          { scope: thisInst, method: thisInst.onDragEndHandler });
        shield.addShieldingVetoCallback({ scope: thisInst, method: thisInst.isInterventionPermitted });
        shield.init();
    },

    deactivate: function () {
        if (this.shield) {
            this.shield.destroy();
            delete this.shield;
        }

        this.reset();
        delete this.viewPortEl;
    },

    deleteAllSlides: function () {
        var slides = [ this.nextSlide, this.prevSlide, this.focusedSlide ];
        var i, slide, len = slides.length;
        for (i = 0; i < len; i++) {
            slide = slides[i];
            if (!slide || !slide.dom.div) { continue; }
            if (slide.dom.div.parentNode == this.viewPortEl) {
                this.viewPortEl.removeChild(slide.dom.div);
            }
        }

        if (this.prevSlide) { delete this.prevSlide; }
        if (this.focusedSlide) { delete this.focusedSlide; }
        if (this.nextSlide) { delete this.nextSlide; }
    },

    reset: function () {
        this.pause();
        this.deleteAllSlides();
        delete this.playList;
    },

    resyncPlayList: function () {
        if (!this.playList) { return; }

        var slide, thisInst = this;
        var triplet = this.playList.getPlayListIndexByPictId(this.focusedSlide.src.pictId);
        if (triplet) {
            // sync the focused slide
            if (triplet.center.index != this.focusedSlide.src.playListIndex) {
                this.focusedSlide.src.playListIndex = triplet.center.index;
            }

            // sync the next slide
            if (triplet.next.pictId != this.nextSlide.src.pictId) {
                slide = this.nextSlide;
                if (slide.dom.div && slide.dom.div.parentNode == this.viewPortEl) {
                    this.viewPortEl.removeChild(slide.dom.div);
                }
                delete this.nextSlide;
                this.nextSlide = this.newNextSlide();
            } else if (triplet.next.index != this.nextSlide.src.playListIndex) {
                this.nextSlide.src.playListIndex = triplet.next.index;
            }

            // sync the previous slide
            if (triplet.previous.pictId != this.prevSlide.src.pictId) {
                slide = this.prevSlide;
                if (slide.dom.div && slide.dom.div.parentNode == this.viewPortEl) {
                    this.viewPortEl.removeChild(slide.dom.div);
                }
                delete this.prevSlide;
                this.prevSlide = this.newPreviousSlide();
            } else if (triplet.previous.index != this.prevSlide.src.playListIndex) {
                this.prevSlide.src.playListIndex = triplet.previous.index;
            }
        } else {
            // the focused slide is gone
            triplet = this.playList.getPlayListIndexByPictId(this.nextSlide.src.pictId);
            if (triplet) {
                // the next slide is still there, let's transition to next
                this.transitionPostProcess = function () {
                    delete thisInst.transitionPostProcess;

                    // at the end of transition, replace the stale previous slide with the valid one
                    delete thisInst.prevSlide;
                    thisInst.prevSlide = thisInst.newPreviousSlide();
                };
                // update the next slide's play list index, which is most likely also changed.
                this.nextSlide.src.playListIndex = triplet.center.index;
                this.startTransition();
            } else {
                // the next slide is also gone
                this.pause();
                if (0 != this.playList.getPlayListCount()) {
                    // there're other photos in the play list, we can start with them from the beginning
                    this.deleteAllSlides();
                    this.play(this.playList);
                } else {
                    // the play list is empty
                    if (0 != this.playList.getAlbumsCount()) {
                        // there're other albums in the play list, we can start with them from the beginning
                        this.playList.requestToSelectAlbums([]);
                        this.playList.resetPlayList();
                        this.deleteAllSlides();
                        this.play(this.playList);
                    } else {
                        // no album in the play list
                        this.doNoPhotoToPlay();   // notify the slideshow that there's no photo to play
                        return;
                    }
                }
            }
        }
    },

    updateSrcPath: function (pictId, path) {
        if (!pictId || !path || 0 == path.length) { return; }
        var slides = [ this.focusedSlide, this.nextSlide, this.prevSlide ];
        var i, slide, img, len = slides.length;
        for (i = 0; i < len; i++) {
            slide = slides[i];
            if (!slide) { continue; }
            if (slide.src.pictId != pictId) { continue; }
            slide.src.path = path.slice(0);
            img = this.createImage(slide.src.path);
            slide.dom.div.removeChild(slide.dom.img);
            slide.dom.div.appendChild(img);
            delete slide.dom.img;
            slide.dom.img = img;
            // do not break the loop even the pictId is found b/c it may have another match
        }
    },

    /**
     * Starts a new play using the playList given having the pictId as the 1st photo.
     *
     * @param playList It is the playList to play the slideshow.
     * @param pictId (optional) If supplied, it is the pictId to start the slideshow.  If it is omitted,
     *               then it starts from the 1st photo from the playList.
     */
    play: function (playList, pictId) {
        if (!playList || !this.viewPortEl) {
            return;
        }
        this.playList = playList;
        var count = this.playList.getPlayListCount();
        if (0 == count) {
            this.pause();
            this.doNoPhotoToPlay();  // notify the slideshow that there's no photo to play
            return;
        }

        this.clearSlidesFromViewPortExcept();   // remove possible slide left in the view port while the
                                                // slideshow is interrupted externally by album being removed

                                       // expecting src = { playListIndex, albumId, pictId, path }
        var src = undefined;           // @see SlideshowPlayList._createSrcRepresentation()
        if (pictId) {
            src = this.playList.getSrcByPictId(pictId);
            if (!src) { src = this.playList.getSrcByPlayListIndex(0); }
        } else {
            src = this.playList.getSrcByPlayListIndex(0);
        }
        if (!src) {
            return;
        }

        var callback = function (img) {
            var slide = this.focusedSlide;
            slide.dim = this.calcFitDimension(img);
            this.applyDimToSlide(slide.dim, slide);
        };
        this.focusedSlide = { src: src, dom: this.createSlide(src.path, callback) };
        this.viewPortEl.appendChild(this.focusedSlide.dom.div);

        this.nextSlide = this.newNextSlide();
        this.prevSlide = this.newPreviousSlide();

        this.start();
    },

    newNextSlide: function () {
        var count = this.playList.getPlayListCount();
        var focusedSlide = this.focusedSlide;
        if (0 == count) {
            return;
        }
        var nextIndex = focusedSlide ?
            ((focusedSlide.src.playListIndex >= count - 1) ? 0 : focusedSlide.src.playListIndex + 1) : 0;
        var nextSlide = { src: this.playList.getSrcByPlayListIndex(nextIndex) };
        var callback = function (img) {
            nextSlide.dim = this.calcFitDimension(img);
            this.applyDimToSlide(nextSlide.dim, nextSlide);
        };
        nextSlide.dom = this.createSlide(nextSlide.src.path, callback);

        return nextSlide;
    },

    newPreviousSlide: function () {
        var count = this.playList.getPlayListCount();
        var focusedSlide = this.focusedSlide;
        if (0 == count) {
            return;
        }
        var prevIndex = focusedSlide ?
            (focusedSlide.src.playListIndex <= 0 ? count - 1 : focusedSlide.src.playListIndex - 1) : 0;
        var prevSlide = { src: this.playList.getSrcByPlayListIndex(prevIndex) };
        var callback = function (img) {
            prevSlide.dim = this.calcFitDimension(img);
            this.applyDimToSlide(prevSlide.dim, prevSlide);
        };
        prevSlide.dom = this.createSlide(prevSlide.src.path, callback);

        return prevSlide;
    },

    /**
     * @param imgUrl It is an URL path to an image.
     * @param imgOnload (optional) if it is supplied, then it is a function to be invoked at the image's
     *                  onload.  The img DOM instance will be passed to the function as the only parameter.
     *
     * @return It returns an object of { div, img } representing a slide.  Both the div and the img are
     *         DOM element with the DIV wrapping around the IMG.
     */
    createSlide: function (imgUrl, imgOnload) {
        if (!imgUrl || 0 == imgUrl.length) { return null; }
        var slide = {
            div: document.createElement("div"),
            img: this.createImage(imgUrl, imgOnload)
        };
        var ifId = new Date().getTime();
        slide.div.setAttribute("id", "imgFrame-"+ifId);
        slide.div.style.position = "absolute";
        slide.div.appendChild(slide.img);
        return slide;
    },

    /**
     * removes all DOM nodes having id matching "imgFrame..." from the viewPortEl except those listed
     * in the excepts array.
     *
     * @param excepts - (optional) if it is supplied, it is an array of DOM nodes also having id
     *                  matching "imgFrame..." that should not be removed.
     */
    clearSlidesFromViewPortExcept: function (excepts) {
        var vpEl = this.viewPortEl;
        if (!vpEl) { return; }
        var isKeep, keepCount = excepts ? excepts.length : 0;
        var i, node, id, outs = [], len = vpEl.childNodes.length;
        for (i = 0; i < len; i++) {
            node = vpEl.childNodes[i];
            id = node.id;
            if (!id) { continue; }
            if (/^imgFrame/.test(id)) {
                isKeep = false;
                if (keepCount > 0) {
                    for (k = 0; k < keepCount && !isKeep; k++) {
                        if (id == excepts[k].id) { isKeep = true; }
                    }
                }
                if (!isKeep) { outs.push(node); }
            }
        }
        len = outs.length;
        for (i = 0; i < len; i++) {
            vpEl.removeChild(outs[i]);
        }
    },

    /**
     * It creates an img DOM element.
     *
     * @param imgUrl It is a path to a photo image.
     * @param callback (optional) if it is supplied, then it is a function to be invoked when the
     *               image is loaded.  The img DOM element will be passed to the callback function
     *               as its only parameter.
     */
    createImage: function (imgUrl, callback) {
        var thisInst = this;
        var img = new Image();
        var imgId = new Date().getTime();
        img.setAttribute("id", "img-"+imgId);
        img.onload = function () {
            img.ar = img.naturalWidth/img.naturalHeight;
            if (!callback) { return; }
            callback.call(thisInst, img);
        };
        img.src = imgUrl;
        return img;
    },

    resize: function () {
        if (this.shield && this.shield.el && this.shield.div) {
            this.shield.resize(this.shield.el, this.shield.div);
        }
        var i, slide, slides = [ this.focusedSlide, this.nextSlide, this.prevSlide ];
        for (i = 0; i < 3; i++) {
            slide = slides[i];
            if (slide && slide.dom) {
                this.applyDimToSlide(this.calcFitDimension(slide.dom.img), slide);
            }
        }
    },

    /**
     * Calculate the dimension that can position the given slide relative to the view port.
     *
     * @param img It is an img DOM element.
     *
     * @return It returns an object having { top, left, width, height }, or it returns null if the
     *         viewPortEl or the slide is null, or if the image of the slide had not been loaded.
     */
    calcFitDimension: function (img) {
        if (!this.viewPortEl || !img) { return null; }
        var ar = img.ar;
        if (undefined == ar) {
            // webkit may have run the calcFitDimension() prior to the img's onload, so calc the ar here...
            ar = img.ar = img.naturalWidth/img.naturalHeight;
        }

        var w, h;
        var vpWidth = this.viewPortEl.clientWidth;
        var vpHeight = this.viewPortEl.clientHeight;
        if (vpWidth == 0 || vpHeight == 0) {
            vpWidth = window.innerWidth;
            vpHeight = window.innerHeight;
        }

        var vpAr = vpWidth/vpHeight;
        if (vpAr > 1.0) {
            if (ar > 1.0) {           // landscape photo on landscape orientation
                w = vpWidth;
                h = Math.round(w/ar);
                if (h > vpHeight) {
                    h = vpHeight;
                    w = Math.round(h*ar);
                }
            } else if (ar < 1.0) {    // porait photo on landscape orientation
                h = vpHeight;
                w = Math.round(h*ar);
            } else {                  // square photo on landscape orientation
                h = vpHeight;
                w = h;
            }
        } else if (vpAr < 1.0) {
            if (ar > 1.0) {           // landscape photo on portait orientation
                w = vpWidth;
                h = Math.round(w/ar);
            } else if (ar < 1.0) {    // porait photo on portait orientation
                h = vpHeight;
                w = Math.round(h*ar);
                if (w > vpWidth) {
                    w = vpWidth;
                    h = Math.round(w/ar);
                }
            } else {                  // square photo on portait orientation
                w = vpWidth;
                h = w;
            }
        } else {
            return null; // a square view port.  It is unlikely to have a square display
        }

        return { top: Math.floor((vpHeight-h)/2), left: Math.floor((vpWidth-w)/2), width: w, height: h };
    },

    applyDimToSlide: function (dim, slide) {
        if (!dim || !slide) { return; }
        var dom = slide.dom;
        dom.div.style.left = dim.left+"px";
        dom.div.style.top = dim.top+"px";
        dom.div.style.width = dim.width+"px";
        dom.div.style.height = dim.height+"px";
        dom.img.style.width = dim.width+"px";
        dom.img.style.height = dim.height+"px";
    },

    isInterventionPermitted: function (ev) {
        //return (this.transitionJob || 0 == this.playList.getPlayListCount()) ? false : true;
        return this.transitionJob ? false : true;
        
    },

    startTransition: function () {
        if (this.nextTransitionJob) {
            clearTimeout(this.nextTransitionJob);
            delete this.nextTransitionJob;
        }

        if (this.transitionJob) { return; }  // a transition is in progress, do not disturb
        
        var slide = this.nextSlide;
        if (!slide) { return; }
        var dim = this.calcFitDimension(slide.dom.img);
        if (!dim) { return; }
        this.applyDimToSlide(dim, slide);
//console.log("****@@@@@@><@@@@@@**** vidslide  SwipeTransition.startTransition()...");

        this.transitionJob = this.createTransitionJob();
        this.doScene();
    },

    endTransition: function () {
        if (this.transitionJob) {
            if (this.transitionJob.sceneJob) {
                clearTimeout(this.transitionJob.sceneJob);
                delete this.transitionJob.sceneJob;
            }
            delete this.transitionJob;
        }
        //this.bindEventsToSlide(this.nextSlide);

        delete this.prevSlide;
        this.prevSlide = this.focusedSlide;
        this.focusedSlide = this.nextSlide;
        this.nextSlide = this.newNextSlide();
        if (!this.nextSlide) {
            this.notifyTransitionEnd();
            this.doAbort();
            return;
        }

        if (this.isPaused) {
            this.notifyTransitionEnd();
            return;
        }

        // schedule the next transition
        var thisInst = this;
        this.nextTransitionJob = setTimeout(function () {
            thisInst.startTransition();
        }, this.slidingIntervalMilliseconds);

        this.notifyTransitionEnd();
    },

    notifyTransitionEnd: function () {
        this.transitionPostProcess && this.transitionPostProcess();
        this.doTransitionEnd();
    },

    createTransitionJob: function () {
        var viewPortEl = this.viewPortEl;
        var vpWidth = viewPortEl.clientWidth;
        var vpHeight = viewPortEl.clientHeight;
        if (vpWidth == 0 || vpHeight == 0) {
            vpWidth = window.innerWidth;
            vpHeight = window.innerHeight;
        }
        var thisInst = this;
        var job = {
            scope: thisInst,
            desc: { viewPortEl:     viewPortEl,
                    viewPortWidth:  vpWidth,
                    viewPortHeight: vpHeight,
                    interval:       1,   // 1ms
                    delta:          vpWidth > 500 ? 90 : 18,
                    marginLeft:     vpWidth,
                    inDiv:          this.nextSlide.dom.div,
                    outDiv:         this.focusedSlide.dom.div
                  },
            end: thisInst.endTransition
        };
        return job;
    },

    doScene: function () {
        var job = this.transitionJob;
        if (!job) { return; }
        var isLastScene = false, thisInst = this;
        var desc =  job.desc;
        var vpEl =  desc.viewPortEl;
        var inDiv = desc.inDiv;
        var outDiv = desc.outDiv;
        var marginLeft = 0;
        if (!job.sceneJob) {  // the 1st scene
            marginLeft = desc.marginLeft = desc.marginLeft - (desc.viewPortWidth%desc.delta) - desc.delta;
            inDiv.style.marginLeft = marginLeft+"px";
            outDiv.style.opacity = marginLeft/desc.viewPortWidth+0.05;
            vpEl.appendChild(inDiv);
        } else if (job.desc.marginLeft > 0) {  // a scene in-progress
            marginLeft = desc.marginLeft - desc.delta;
            desc.marginLeft = marginLeft = marginLeft < 0 ? 0 : marginLeft;
            inDiv.style.marginLeft = marginLeft+"px";
            outDiv.style.opacity = marginLeft/desc.viewPortWidth+0.05;
        } else {  // the last scene
            delete job.sceneJob;
            inDiv.style.marginLeft = "0px";
            if (outDiv.parentNode) { outDiv.parentNode.removeChild(outDiv); }
            outDiv.style.opacity = 1.0;
            isLastScene = true;
        }
        if (isLastScene) {
            this.clearSlidesFromViewPortExcept([inDiv]);
            job.end.call(thisInst);
        } else {
            job.sceneJob = setTimeout(function () {
                thisInst.doScene();
            }, desc.interval);
        }
    },

    /**
     * Animate the sliding motion of all three slides, i.e. the focused, the next and the previous slide
     * from its current position to its original.
     *
     * @param callback (optional) if it is supplied, it is { method, sceop, args }
     */
    retract: function (callback) {
        var f = this.focusedSlide;
        var p = this.prevSlide;
        var n = this.nextSlide;
        if (!f || !n || !p || !this.viewPortEl) { return; }
        var w = this.viewPortEl.clientWidth;

        var delta, traction, i, animate, steps, nextToLast;
        var fDiv = f.dom.div;
        var nDiv = n.dom.div;
        var pDiv = p.dom.div;
        var animateStep = function (d) {
            fDiv.style.marginLeft = d+"px";
            nDiv.style.left = (w+n.dim.left+d)+"px";
            pDiv.style.left = (p.dim.left-w+d)+"px";
        };
        //var distance = parseInt(fDiv.style.marginLeft.match(/(\S+)px/)[1]);
        var fMarginStrArr = fDiv.style.marginLeft.match(/(\S+)px/);
        if (!fMarginStrArr || fMarginStrArr.length < 2) {
            if (callback) { callback.method.apply(callback.scope, callback.args); }
            return;
        }
        var distance = parseInt(fMarginStrArr[1], 10);
        if (distance >= -50 && distance <= 50) {
            fDiv.style.marginLeft = "0px";
            nDiv.style.left = w+"px";
            pDiv.style.left = (-w)+"px";
            if (callback) { callback.method.apply(callback.scope, callback.args); }
        } else {
            steps = 8;
            delta = Math.floor(distance/steps);
            traction = [ distance - (delta+(distance%Math.abs(delta))) ];
            for (i = 1, nextToLast = steps - 1; i < nextToLast; i++) {
                traction.push(traction[i-1] - delta);
            }
            traction.push(0);
            i = 0;
            animateStep(traction[i++]);
            animate = function () {
                if (i < steps) {
                    animateStep(traction[i++]);
                    setTimeout(animate, 10);
                } else if (callback) {
                    callback.method.apply(callback.scope, callback.args);
                }
            };
            setTimeout(animate, 10);
        }
    },

    /**
     * Animate the swiping motion from the focused slide to either the next or the previous depending on
     * the direciton of the force.
     *
     * @param force It is a floating number.  A positive value swipes to the previous, and a negative
     *              value swipes to the next slide.
     * @param callback (optional) if it is supplied, it is { method, sceop, args }
     */
    swipe: function (force, callback) {
        var increment, normalIncrement = 70, hurryIncrement = 180, edgeZone = 50;
        var f = this.focusedSlide;
        var p = this.prevSlide;
        var n = this.nextSlide;
        if (!f || !n || !p || !this.viewPortEl) { return; }
        var w = this.viewPortEl.clientWidth;

        var delta, traction, i, animate, steps, nextToLast, nextIncrement;
        var fDiv = f.dom.div;
        var nDiv = n.dom.div;
        var pDiv = p.dom.div;
        var animateToNext = function (d) {
            fDiv.style.marginLeft = d+"px";
            nDiv.style.left = (w+n.dim.left+d)+"px";
            pDiv.style.left = (p.dim.left-w+d)+"px";
        };
        var animateToPrevious = function (d) {
            fDiv.style.marginLeft = d+"px";
            pDiv.style.left = (p.dim.left-w+d)+"px";
            nDiv.style.left = (w+n.dim.left+d)+"px";
        };
        var fMarginStrArr = fDiv.style.marginLeft.match(/(\S+)px/);
        if (!fMarginStrArr || fMarginStrArr.length < 2) {
            if (callback) { callback.method.apply(callback.scope, callback.args); }
            return;
        }
        var fMargin = fMarginStrArr[1];
        var distance = 0;
        if (force < 0.0) {           // swipe to next
            distance = w - fMargin;
            if (distance <= edgeZone) {
                fDiv.style.marginLeft = (-w)+"px";
                nDiv.style.left = "0px";
                pDiv.style.left = -(2*w)+"px";
                if (callback) { callback.method.apply(callback.scope, callback.args); }
                return;
            } else {
                increment = -force >= 2.5 ? hurryIncrement : normalIncrement;
                traction = [ fMargin - (distance > increment ? increment+(distance%increment) : distance) ];
                i = 0;
                while (traction[i] > -w) {
                    nextIncrement = traction[i] - increment;
                    if (nextIncrement <= -w) { nextIncrement = -w; }
                    traction.push(nextIncrement);
                    i += 1;
                }
                i = 0;
                animateToNext(traction[i++]);
                animate = function () {
                    if (i < traction.length) {
                        animateToNext(traction[i++]);
                        setTimeout(animate, 1);
                    } else if (callback) {
                        callback.method.apply(callback.scope, callback.args);
                    }
                };
                setTimeout(animate, 1);
            }
        } else if (force > 0.0) {    // swipe to previous
            distance = w + fMargin;
            if (distance <= edgeZone) {
                fDiv.style.marginLeft = w+"px";
                nDiv.style.left = (2*w)+"px";
                pDiv.style.left = "0px";
                if (callback) { callback.method.apply(callback.scope, callback.args); }
                return;
            } else {
                increment = force >= 2.5 ? hurryIncrement : normalIncrement;
                traction = [ fMargin - (distance > increment ? increment+(distance%increment) : distance) ];
                i = 0;
                while (traction[i] < w) {
                    nextIncrement = traction[i] + increment;
                    if (nextIncrement >= w) { nextIncrement = w; }
                    traction.push(nextIncrement);
                    i += 1;
                }
                i = 0;
                animateToPrevious(traction[i++]);
                animate = function () {
                    if (i < traction.length) {
                        animateToPrevious(traction[i++]);
                        setTimeout(animate, 1);
                    } else if (callback) {
                        callback.method.apply(callback.scope, callback.args);
                    }
                };
                setTimeout(animate, 1);
            }
        } else {
            if (callback) { callback.method.apply(callback.scope, callback.args); }
            return;
        }
    },

    resetSlidingInterval: function (ms) {
        this.slidingIntervalMilliseconds = ms;
        if (this.nextTransitionJob) {
            this.pause();
            this.resume();
        }
    },

    start: function () {
        this.isPaused = false;
        if (this.nextTransitionJob) { return; }
        var thisInst = this;
        this.nextTransitionJob = setTimeout(function () {
            thisInst.startTransition();
        }, this.slidingIntervalMilliseconds);
    },

    resume: function () {
        this.start();
    },

    pause: function () {
        this.isPaused = true;

        if (this.shouldTransitionJobResume) { delete this.shouldTransitionJobResume; }

        if (this.nextTransitionJob) {
            clearTimeout(this.nextTransitionJob);
            delete this.nextTransitionJob;
        }
    },

    end: function () {
        this.pause();
        //this.reset();
    },

    getFocusedSrcMeta: function () {
        var slide = this.focusedSlide;
        if (!slide) { return null; }
        return { albumId: slide.src.albumId.slice(0), pictId: slide.src.pictId.slice(0) };
    },

    attachAdjacentSlides: function () {
        var vpEl = this.viewPortEl;
        if (!vpEl) { return; }
        var ps = this.prevSlide;
        var ns = this.nextSlide;
        if (!ps || !ns) { return; }
        var psEl = ps.dom.div;
        var nsEl = ns.dom.div;
        var w = vpEl.clientWidth;
        if (ns.dim) {
            nsEl.style.left = (ns.dim.left+w)+"px";
            vpEl.appendChild(nsEl);
        }
        if (ps.dim) {
            psEl.style.left = (ps.dim.left-w)+"px";
            vpEl.appendChild(psEl);
        }
    },

    detachAdjacentSlides: function () {
        var vpEl = this.viewPortEl;
        if (!vpEl) { return; }
        var ps = this.prevSlide;
        var ns = this.nextSlide;
        var psEl, nsEl;
        if (ns) {
            nsEl = ns.dom.div;
            if (nsEl) {
                if (nsEl.parentNode) { nsEl.parentNode.removeChild(nsEl); }
                nsEl.style.left = ns.dim.left+"px";
            }
        }
        if (ps) {
            psEl = ps.dom.div;
            if (psEl) {
                if (psEl.parentNode) { psEl.parentNode.removeChild(psEl); }
                psEl.style.left = ps.dim.left+"px";
            }
        }
    },

    onTapHandler: function (ev) {
        this.doTap(ev);
    },

    onDragStartHandler: function (ev) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SwipeTransition.onDragStartHandler(): x="+ev.pageX);
        if (this.nextTransitionJob) {
            this.pause();
            this.shouldTransitionJobResume = true;
        }
        this.attachAdjacentSlides();
        this.dragSession = { x: ev.pageX, t: ev.timeStamp, i: 0, trace: [{ x: ev.pageX, t: ev.timeStamp }] };
    },

    onDragHandler: function (ev) {
        if (!this.dragSession) { return; }
        var i = this.dragSession.i;
        var dx = ev.pageX - this.dragSession.x;
        i = i >= 2 ? 0 : i+1;
        this.dragSession.i = i;
        this.dragSession.trace[i] = { x: ev.pageX, t: ev.timeStamp };

        var vpEl = this.viewPortEl;
        if (!vpEl) { return; }
        var w = vpEl.clientWidth;
        var f = this.focusedSlide;
        var p = this.prevSlide;
        var n = this.nextSlide;

        if (f) { f.dom.div.style.marginLeft = dx+"px"; }

        if (n) {
            if (!n.dim) {
                if (n.dom && n.dom.img) { return; }
                n.dim = this.calcFitDimension(n.dom.img);
                if (n.dim) { this.applyDimToSlide(n.dim, n); }
            }
            if (n.dim) { n.dom.div.style.left = (w+n.dim.left+dx)+"px"; }
        }

        if (p) {
            if (!p.dim) {
                if (!p.dom || !p.dom.img) { return; }
                p.dim = this.calcFitDimension(p.dom.img);
                if (p.dim) { this.applyDimToSlide(p.dim, p); }
            }
            if (p.dim) { p.dom.div.style.left = (p.dim.left-w+dx)+"px"; }
        }
//console.log("****@@@@@@><@@@@@@**** vidslide  SwipeTransition.onDragHandler(): prev left="+(p.dim.left-w+dx)+", w="+w);
    },

    onDragEndHandler: function (ev) {
        if (!this.dragSession) { return; }
        var force = this.calcForce(ev);
//console.log("****@@@@@@><@@@@@@**** vidslide  SwipeTransition.onDragEndHandler(): force="+force);
        var callback;
        var thisInst = this;

        if (Math.abs(force) <= 1.0 || 0 == this.playList.getPlayListCount()) {
            callback = {
                scope: thisInst,
                method: function () {
                    this.detachAdjacentSlides();
                    delete this.dragSession;

                    if (this.shouldTransitionJobResume) {
                        delete this.shouldTransitionJobResume;
                        this.resume();
                    }
                }
            };
            this.retract(callback);
        } else {
            callback = {
                scope: thisInst,
                method: thisInst.endManualSwipeTransition,
                args: [ force ]
            };
            this.swipe(force, callback);
        }
    },

    endManualSwipeTransition: function (force) {
        var vpEl = this.viewPortEl;
        var f = this.focusedSlide;
        var p = this.prevSlide;
        var n = this.nextSlide;
        var fEl = f.dom.div;
        var pEl = p.dom.div;
        var nEl = n.dom.div;

        if (force < 0.0) {          // swipe next
            vpEl.removeChild(pEl);
            delete this.prevSlide;
            if (fEl.parentNode) { fEl.parentNode.removeChild(fEl); }
            nEl.style.left = n.dim.left+"px";
            fEl.style.marginLeft = "0px";
            this.prevSlide = this.focusedSlide;
            this.focusedSlide = this.nextSlide;
            this.nextSlide = this.newNextSlide();
            if (!this.nextSlide) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SwipeTransition.endManualSwipeTransition(): newNextSlide() returns null, about to abort...");
                this.doAbort();
                return;
            }
        } else if (force > 0.0) {   // swipe previous
            vpEl.removeChild(nEl);
            delete this.nextSlide;
            if (fEl.parentNode) { fEl.parentNode.removeChild(fEl); }
            pEl.style.left = p.dim.left+"px";
            fEl.style.marginLeft = "0px";
            this.nextSlide = this.focusedSlide;
            this.focusedSlide = this.prevSlide;
            this.prevSlide = this.newPreviousSlide();
            if (!this.prevSlide) {
//console.log("****@@@@@@><@@@@@@**** vidslide  SwipeTransition.endManualSwipeTransition(): newPreviousSlide() returns null, about to abort...");
                this.doAbort();
                return;
            }
        } else {
            this.detachAdjacentSlides();
        }
                    
        delete this.dragSession;

        if (this.shouldTransitionJobResume) {
            delete this.shouldTransitionJobResume;
            this.resume();
        }
    },

    /**
     * @return It returns a floating number.
     *         1. A negative value representing a motion force from right-to-left.
     *         2. A positive value representing a motion force from left-to-right.
     */
    calcForce: function (ev) {
        var x = ev.pageX;
        var trace = this.dragSession.trace;
        var k = 0;
        var d, longest = Math.abs(x - trace[k].x);
        var i, len = trace.length;
        for (i = 1; i < len; i++) {
            d = Math.abs(x - trace[i].x);
            if (d > longest) {
                longest = d;
                k = i;
            }
        }
        d = x - trace[k].x;
        var t = ev.timeStamp - trace[k].t;
        return d/t;
    },

    stopEvent: function (ev) {
        if (ev.stopPropagation) { ev.stopPropagation(); } else { ev.cancelBubble = true; }
        if (ev.preventDefault) { ev.preventDefault(); } else { ev.returnValue = false; }
    },

    /**
     * Somewhere between the webkit and the enyo framework fires a tailgating event on click
     * causing us to respond twice on each tap with <100ms apart or so.  This method is meant
     * to help us to filter it out.
     */
    isTailgatingEvent: function (ev) {
        var now = new Date(), isTailgating = false;
        if (this.lastClickTime) {
            if ((now.getTime()-this.lastClickTime.getTime()) < 400) {
                isTailgating = true;
            }
        }
        this.lastClickTime = now;
        return isTailgating;
    },

    destroy: function () {
        this.deactivate();
        this.inherited(arguments);
    }
});
