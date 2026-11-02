// webOS CE: App Menu > Import Calendar. Picks an .ics file and adds its events to the on-device
// calendar. Importing again adds only what is new. ICalEvents.js has the rules.
//
// An event that won't parse or save is counted, and the rest carry on. Most launches never
// import, so the parser's files are fetched and evaluated here, when an import starts.
//
// This runs in the card, app/calendar.html, so paths are relative to app/. MojoLoader and the
// Calendar library are only in the headless window, index.html.

/*global enyo, $L, ICalEvents, CalendarEvent, XMLHttpRequest */

enyo.kind({
    name      : "calendar.ImportDialog",
    kind      : enyo.ModalDialog,
    caption   : $L("Import Calendar"),
    scrim     : true,
    published : {
        showCancelBtn: true
    },
    events    : {
        onOK: ""
    },
    components: [
        {name: "messageLbl", style: "padding: 6px 0px 12px 0px;"},
        {kind: enyo.Control, layoutKind: "HFlexLayout", pack: "justify", components: [
            {name: "cancelBtn", kind: enyo.Button, caption: $L("Cancel"), onclick: "close", flex: 1},
            {name: "okBtn", kind: enyo.Button, caption: $L("OK"), onclick: "okClick", flex: 1, className: "enyo-button-affirmative"}
        ]}
    ],
    openWith  : function (inMessage) {
        this.validateComponents();
        this.$.messageLbl.setContent(inMessage);
        this.$.cancelBtn.setShowing(this.showCancelBtn);
        this.openAtCenter();
    },
    okClick   : function () {
        this.doOK();
        this.close();
    }
});

enyo.kind({
    name      : "calendar.ImportProgressDialog",
    kind      : enyo.ModalDialog,
    caption   : $L("Import Calendar"),
    scrim     : true,
    events    : {
        onStop: ""
    },
    components: [
        {name: "progressLbl", style: "padding: 6px 0px 12px 0px; text-align: center;"},
        {name: "progressBar", kind: enyo.ProgressBar, style: "margin-bottom: 12px;"},
        {name: "stopBtn", kind: enyo.Button, caption: $L("Stop"), onclick: "stopClick"}
    ],
    // The label is set once. Changing it while the dialog is up leaves the top half of the text
    // frozen on a TouchPad: WebKit repaints only the bottom half. The bar repaints properly.
    openAtStart : function (inCount) {
        this.validateComponents();
        this.$.stopBtn.setDisabled(false);
        this.$.progressLbl.setContent(new enyo.g11n.Template($L("1#Importing 1 event...|#Importing #{count} events...")).formatChoice(inCount, {count: inCount}));
        this.$.progressBar.setPosition(0);
        this.openAtCenter();
    },
    showProgress: function (inDone, inTotal) {
        this.$.progressBar.setPosition(inTotal ? (100 * inDone / inTotal) : 0);
    },
    stopClick   : function () {
        this.$.stopBtn.setDisabled(true);
        this.doStop();
    }
});

enyo.kind({
    name      : "calendar.ICalImport",
    kind      : enyo.Component,
    statics   : {
        PARSER_PATH   : "import/webcal/",
        FIND_PAGE_SIZE: 500,
        SAVE_BATCH    : 50
    },
    components: [
        {name: "filePicker", kind: "FilePicker", fileType: "document", extensions: ["ics", "ICS"], onPickFile: "filePicked"},
        {name: "confirmDialog", kind: "calendar.ImportDialog", onOK: "confirmed"},
        {name: "resultDialog", kind: "calendar.ImportDialog", showCancelBtn: false},
        {name: "progressDialog", kind: "calendar.ImportProgressDialog", onStop: "stopImport"}
    ],

    pickFile       : function () {
        if (!this.running) {
            this.$.filePicker.pickFile();
        }
    },
    filePicked     : function (inSender, inFiles) {
        var path = inFiles && inFiles[0] && inFiles[0].fullPath;
        if (path) {
            this.filePath = path;
            this.readFile("utf-8");
        }
    },
    readFile       : function (inCharset) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "file://" + encodeURI(this.filePath).replace(/#/g, "%23").replace(/\?/g, "%3F"), true);
        xhr.overrideMimeType("text/plain; charset=" + inCharset);
        xhr.onreadystatechange = enyo.bind(this, function () {
            if (xhr.readyState === 4) {
                xhr.onreadystatechange = null;
                this.fileRead(inCharset, xhr.responseText);
            }
        });
        xhr.send();
    },
    fileRead       : function (inCharset, inText) {
        var count;
        if (!inText) {
            this.showResult($L("This file could not be read."));
            return;
        }
        // Old exports from Windows are Latin-1, which does not survive reading as UTF-8.
        if (inCharset === "utf-8" && inText.indexOf("�") !== -1) {
            this.readFile("iso-8859-1");
            return;
        }
        count = ICalEvents.countEvents(inText);
        if (count === 0) {
            this.showResult($L("There are no events in this file."));
            return;
        }
        this.text = inText;
        this.eventCount = count;
        this.$.confirmDialog.openWith(new enyo.g11n.Template($L("1#Import 1 event from #{file} to this device?|#Import #{count} events from #{file} to this device?")).formatChoice(count, {
            count: count,
            file : this.filePath.substring(this.filePath.lastIndexOf("/") + 1)
        }));
    },
    showResult     : function (inMessage) {
        this.$.resultDialog.openWith(inMessage);
    },

    // The dialog closes after this returns, and a closing popup releases the event capture.
    // The progress dialog has to open after that, or its Stop button never hears a tap.
    confirmed      : function () {
        enyo.asyncMethod(this, "startImport");
    },
    startImport    : function () {
        var manager = enyo.application.calendarsManager;

        this.target = ICalEvents.target(manager.getLocalCalendar());
        if (!this.target) {
            this.text = null;
            this.showResult($L("There is no on-device calendar to import events into."));
            return;
        }
        this.running = true;
        this.stopped = false;
        this.counts = {imported: 0, skipped: 0, failed: 0, unreadable: 0, repeatsLost: 0, zonesLost: 0};
        this.groups = null;
        this.nextGroup = 0;
        this.known = ICalEvents.newKnown();
        this.$.progressDialog.openAtStart(this.eventCount);
        // Let the dialog paint first: the parse holds the page until it is done.
        enyo.asyncMethod(this, "loadParser");
    },
    stopImport     : function () {
        this.stopped = true;
    },
    importFailed   : function (inError) {
        enyo.warn("ICalImport: " + inError);
        this.text = null;
        this.running = false;
        this.$.progressDialog.close();
        this.showResult($L("This file could not be read."));
    },
    foundations    : function () {
        return enyo.windows.getRootWindow().MojoLoader.require({name: "foundations", version: "1.0"}).foundations;
    },
    // Reads the parser's files, one after another, then builds it.
    loadParser     : function () {
        var files = ICalEvents.FILES,
            sources = {},
            self = this;

        function fetch(inIndex) {
            var xhr;
            if (inIndex >= files.length) {
                self.parserLoaded(sources);
                return;
            }
            xhr = new XMLHttpRequest();
            xhr.open("GET", calendar.ICalImport.PARSER_PATH + files[inIndex], true);
            xhr.overrideMimeType("text/plain; charset=utf-8");
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    xhr.onreadystatechange = null;
                    if (xhr.responseText) {
                        sources[files[inIndex]] = xhr.responseText;
                        fetch(inIndex + 1);
                    } else {
                        self.importFailed("could not read " + files[inIndex]);
                    }
                }
            };
            xhr.send();
        }

        if (this.parser) {
            this.parse();
        } else {
            fetch(0);
        }
    },
    parserLoaded   : function (inSources) {
        var foundations = this.foundations(),
            note = function () {
                enyo.log("ICalImport: " + Array.prototype.join.call(arguments, " "));
            },
            quiet = function () {};

        try {
            this.parser = ICalEvents.instantiate(inSources, {
                Log        : {log: note, log_icalDebug: quiet, debug: quiet},
                Future     : foundations.Control.Future,
                Calendar   : enyo.windows.getRootWindow().Calendar,
                checkResult: function (inFuture) {
                    return inFuture.exception ? {returnValue: false, exception: inFuture.exception} : inFuture.result;
                }
            });
        } catch (e) {
            this.importFailed("the parser would not load: " + e);
            return;
        }
        this.parse();
    },
    parse          : function () {
        var text = this.text,
            future;

        this.text = null;
        try {
            future = this.parser.initialize();
        } catch (e) {
            this.importFailed("the parser would not start: " + e);
            return;
        }
        future.then(this, function () {
            var parsing;
            try {
                var dummy = future.result;
                parsing = this.parser.parseWebCalICal(text);
            } catch (e) {
                this.importFailed(e);
                future.result = true;
                return;
            }
            parsing.then(this, function () {
                var result;
                try {
                    result = parsing.result;
                } catch (e) {
                    this.importFailed(e);
                    parsing.result = true;
                    return;
                }
                this.parsed(result);
                parsing.result = true;
            });
            future.result = true;
        });
    },
    parsed         : function (inResult) {
        var i;

        this.counts.unreadable = inResult.unreadable || 0;
        this.counts.zonesLost = inResult.unknownTimezones ? inResult.unknownTimezones.length : 0;
        this.groups = inResult.events || [];
        for (i = 0; i < this.groups.length; i += 1) {
            if (this.groups[i].result.rruleDropped) {
                this.counts.repeatsLost += 1;
            }
        }
        this.$.progressDialog.showProgress(0, this.groups.length);
        this.loadExisting();
    },

    palmCall       : function (inMethod, inParams) {
        return this.foundations().Comms.PalmCall.call("palm://com.palm.db/", inMethod, inParams);
    },
    // Reads the calendar a page at a time, for the duplicate check.
    loadExisting   : function (inNext) {
        var query = {
            from  : ICalEvents.KIND,
            where : [{prop: "calendarId", op: "=", val: this.target.calendarId}],
            select: ["remoteId", "subject", "dtstart", "dtend", "parentId"],
            limit : calendar.ICalImport.FIND_PAGE_SIZE
        };
        if (inNext) {
            query.page = inNext;
        }
        this.palmCall("find", {query: query}).then(this, function (future) {
            var response, i;
            try {
                response = future.result;
            } catch (e) {
                // Without this list an import could double everything, so don't guess.
                this.importFailed("could not read the calendar: " + e);
                return;
            }
            for (i = 0; i < response.results.length; i += 1) {
                ICalEvents.rememberExisting(this.known, response.results[i]);
            }
            if (response.next) {
                this.loadExisting(response.next);
            } else {
                this.importNext();
            }
        });
    },
    // Saves plain events together. A series saves alone, as its exceptions need the parent's id.
    importNext     : function () {
        var batch = [],
            group;

        while (!this.stopped && this.nextGroup < this.groups.length && batch.length < calendar.ICalImport.SAVE_BATCH) {
            group = this.groups[this.nextGroup];
            if (ICalEvents.isKnown(this.known, group)) {
                this.counts.skipped += 1;
                this.nextGroup += 1;
            } else if (group.exceptions.length) {
                if (batch.length === 0) {
                    this.nextGroup += 1;
                    ICalEvents.remember(this.known, group);
                    this.saveSeries(group);
                    return;
                }
                break;
            } else {
                ICalEvents.remember(this.known, group);
                batch.push(group);
                this.nextGroup += 1;
            }
        }

        if (batch.length) {
            this.saveBatch(batch);
        } else if (this.stopped || this.nextGroup >= this.groups.length) {
            this.finishImport();
        } else {
            enyo.asyncMethod(this, "importNext");
        }
    },
    makeEvent      : function (inParsed) {
        return ICalEvents.makeEvent(inParsed, this.target, CalendarEvent);
    },
    saved          : function () {
        this.$.progressDialog.showProgress(this.nextGroup, this.groups.length);
        enyo.asyncMethod(this, "importNext");
    },
    saveBatch      : function (inBatch) {
        var objects = inBatch.map(function (inGroup) {
            return this.makeEvent(inGroup.result);
        }, this);

        this.palmCall("put", {objects: objects}).then(this, function (future) {
            try {
                var dummy = future.result;
                this.counts.imported += inBatch.length;
            } catch (e) {
                enyo.warn("ICalImport: " + inBatch.length + " events would not save: " + e);
                this.counts.failed += inBatch.length;
            }
            this.saved();
        });
    },
    saveSeries     : function (inGroup) {
        var parent = this.makeEvent(inGroup.result);

        this.palmCall("put", {objects: [parent]}).then(this, function (future) {
            var parentId, children;
            try {
                parentId = future.result.results[0].id;
            } catch (e) {
                enyo.warn("ICalImport: a series would not save: " + e);
                this.counts.failed += 1;
                this.saved();
                return;
            }
            children = inGroup.exceptions.map(function (inChild) {
                var child = this.makeEvent(inChild);
                child.parentId = parentId;
                delete child.remoteId;
                return child;
            }, this);
            this.palmCall("put", {objects: children}).then(this, function (childFuture) {
                try {
                    var dummy = childFuture.result;
                } catch (e) {
                    // The series itself is in, without its changed dates.
                    enyo.warn("ICalImport: a series lost its exceptions: " + e);
                }
                this.counts.imported += 1;
                this.saved();
            });
        });
    },
    finishImport   : function () {
        var counts = this.counts,
            parts = [],
            add = function (inMessage, inCount) {
                if (inCount) {
                    parts.push(new enyo.g11n.Template(inMessage).formatChoice(inCount, {count: inCount}));
                }
            };

        this.running = false;
        this.groups = null;
        this.known = null;
        this.$.progressDialog.close();

        add($L("1#1 event imported.|##{count} events imported."), counts.imported);
        add($L("1#1 was already in Calendar.|##{count} were already in Calendar."), counts.skipped);
        add($L("1#1 could not be saved.|##{count} could not be saved."), counts.failed);
        add($L("1#1 could not be read.|##{count} could not be read."), counts.unreadable);
        add($L("1#1 repeating event has too complex a pattern, so only its first date was kept.|##{count} repeating events have too complex a pattern, so only their first dates were kept."), counts.repeatsLost);
        add($L("1#1 time zone was not recognized, so its times were kept as written.|##{count} time zones were not recognized, so their times were kept as written."), counts.zonesLost);
        if (this.stopped) {
            parts.unshift($L("Import stopped."));
        }
        this.showResult(parts.join(" ") || $L("No events were imported."));
    }
});
