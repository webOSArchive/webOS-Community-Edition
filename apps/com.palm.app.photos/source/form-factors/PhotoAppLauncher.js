/*global  window, console, enyo */

enyo.kind({
    name: "PhotoAppLauncher",
    kind: "enyo.Object",
    faces: {
        photosVideos: {
            windowName: "com.palm.app.photos",
            path: "photosVideos.html",
            state: "unknown",
            params: { landingView: "library" }
        },
        slideshow: {
            windowName: "com.palm.app.slideshow",
            path: "slideshow.html",
            state: "unknown",
            params: { landingView: "slideshow" },
            attrs: { window: "dockmode" }
        }
    },

    /**
     * This method starts the app.
     */
    startup: function() {
        this.activateApp(this.appSelect());
    },

    /**
     * This is the callback handler responding to the enyo's application relaunch event.
     */
    applicationRelaunchHandler: function () {
        this.activateApp(this.appSelect());
    },

    /**
     * If it is running on desktop, then this is a helper method examining the URL query string
     * determining whether or not running a slideshow is requested.
     *
     * @return It returns a boolean true or false whether or not a slideshow is requested.
     */
    isSlideshow: function () {
        var search = window.location.search;
        if (!search) { return false; }
        var pairs = search.slice(1).split("&");
        for (var i = 0; i < pairs.length; i++) {
            if ("slideshow" == pairs[i].split("=")[0]) {
                return true;
            }
        }
        return false;
    },

    /**
     * It determines a colleciton of the parameters required to activate a window by examining
     * the environment.
     *
     * @retrun It returns an object containing a collection of the parameters required to activate
     *         a window.
     */
    appSelect: function () {
        var launchParams = {}, app = undefined;
        if (window.PalmSystem) {
            if (window.PalmSystem.launchParams) {
                launchParams = enyo.json.parse(window.PalmSystem.launchParams);
                if (launchParams.windowType == "dockModeWindow" && launchParams.dockMode) {
                    app = this.faces.slideshow;
                } else {
                    app = this.faces.photosVideos;
                }
            } else {
                app = this.faces.photosVideos;
            }
        } else {
            app = this.isSlideshow() ? this.faces.slideshow : this.faces.photosVideos;
        }

        app = enyo.clone(app);
        app.params = enyo.mixin(enyo.clone(app.params), launchParams);
		
        return app;
    },

    /**
     * Activate a window identified by name.  If the identified window already existed, then the enyo
     * window manager will bring it to focus, otherwise it will be created.
     *
     * @param app is an object containing the relevant parameters to activate a window.  This app
     *            is one of the parameters objects defined by the faces property of this kind.
     */
    activateApp: function (app) {
        if (!app) { return; }
        if (!window.PalmSystem) {           // (desktop only): add this extra artifact so that
            window.name = app.windowName;   //          enyo.windows.browserAgent will not hide the window
        }                                   //          hosting our app
        enyo.windows.activate(app.path, app.windowName, app.params, app.attrs);
    },

    /**
     * A debugging helper method.
     *
     * @return It returns a debugging message.
     */
    verboseAppContext: function () {
        var desc = "no PalmSystem";
        if (window.PalmSystem) {
            if (window.PalmSystem.launchParams) {
                // available only at relaunch
                // expect { windowType: "dockModeWindow", dockMode: true }
                desc = "PalmSystem.launchParams = "+window.PalmSystem.launchParams;
            } else {
                desc = "no PalmSystem.launchParams";
            }
        }
        return desc;
    }
});
