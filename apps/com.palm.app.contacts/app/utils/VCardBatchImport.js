// webOS CE: App Menu > Import vCards. Picks a .vcf file and adds every contact in it to the
// on-device account, with its photo.
//
// Always the on-device account, never the default account: the default can be set to Exchange,
// and a contact written to a synced account's kind is uploaded by that account's sync. A file
// of cards must not reach a server unasked. If there is no on-device account the import stops.
//
// VCardParser.js says why this does not call the contacts service's importVCard. A contact
// already in the account is skipped, so importing a file twice, or again after stopping
// part way, adds nothing. One bad card or photo is counted and the import carries on.
//
// A web app cannot write files, so a contact's photo goes through
// org.webosarchive.photos.service (part of Photos 3.2.0) into /media/internal/.contactphotos.
// Without that service the contacts are imported without photos and the summary says so.

/*global enyo, $L, ContactsLib, AccountsList, PalmCall, Future, VCardParser, XMLHttpRequest, Image */

enyo.kind({
    name      : "VCardImportProgressDialog",
    kind      : "ModalDialog",
    caption   : $L("Import vCards"),
    events    : {
        onStop: ""
    },
    components: [
        {name: "progressLbl", style: "padding: 6px 0px 12px 0px; text-align: center;"},
        {name: "progressBar", kind: "ProgressBar", style: "margin-bottom: 12px;"},
        {name: "stopBtn", kind: "Button", caption: $L("Stop"), onclick: "stopClick"}
    ],
    openAtStart : function () {
        this.validateComponents();
        this.$.stopBtn.setDisabled(false);
        this.showProgress(0, 0);
        this.openAtCenter();
    },
    showProgress: function (inDone, inTotal) {
        var template = new enyo.g11n.Template($L("Importing #{done} of #{total}"));
        this.$.progressLbl.setContent(template.evaluate({done: inDone, total: inTotal}));
        this.$.progressBar.setPosition(inTotal ? (100 * inDone / inTotal) : 0);
    },
    stopClick   : function () {
        this.$.stopBtn.setDisabled(true);
        this.doStop();
    }
});

enyo.kind({
    name      : "VCardBatchImport",
    kind      : enyo.Component,
    statics   : {
        PHOTO_SERVICE : "palm://org.webosarchive.photos.service/",
        PHOTO_FOLDER  : "/media/internal/.contactphotos/",
        // Base64 comes in fours, so a chunk of this size always decodes on its own.
        PHOTO_CHUNK   : 65536,
        FIND_PAGE_SIZE: 500
    },
    components: [
        {name: "filePicker", kind: "FilePicker", fileType: "document", extensions: ["vcf", "VCF"], onPickFile: "filePicked"},
        {name: "confirmDialog", kind: "OKCancelDialog", caption: $L("Import vCards"), onBeforeOpen: "renderConfirmDialog", onOK: "confirmed"},
        {name: "resultDialog", kind: "OKCancelDialog", caption: $L("Import vCards"), showCancelBtn: false, onBeforeOpen: "renderResultDialog"},
        {name: "progressDialog", kind: "VCardImportProgressDialog", onStop: "stopImport"}
    ],

    pickFile           : function () {
        if (!this.running) {
            this.$.filePicker.pickFile();
        }
    },
    filePicked         : function (inSender, inFiles) {
        var path = inFiles && inFiles[0] && inFiles[0].fullPath;
        if (path) {
            this.filePath = path;
            this.readFile("utf-8");
        }
    },
    readFile           : function (inCharset) {
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
    fileRead           : function (inCharset, inText) {
        if (!inText) {
            this.showResult($L("This file could not be read."));
            return;
        }
        // Old exports from Windows are Latin-1, which does not survive reading as UTF-8.
        if (inCharset === "utf-8" && inText.indexOf("�") !== -1) {
            this.readFile("iso-8859-1");
            return;
        }

        this.cards = VCardParser.splitCards(inText);
        if (this.cards.length === 0) {
            this.showResult($L("There are no contacts in this file."));
            return;
        }
        var template = new enyo.g11n.Template($L("1#Import 1 contact from #{file} to this device?|#Import #{count} contacts from #{file} to this device?"));
        this.confirmMessage = template.formatChoice(this.cards.length, {
            count: this.cards.length,
            file : this.filePath.substring(this.filePath.lastIndexOf("/") + 1)
        });
        this.$.confirmDialog.openDialog(this.confirmMessage);
    },
    renderConfirmDialog: function () {
        this.$.confirmDialog.renderMessage();
    },
    renderResultDialog : function () {
        this.$.resultDialog.renderMessage();
    },
    showResult         : function (inMessage) {
        this.$.resultDialog.openDialog(inMessage);
    },

    // The dialog closes after this returns, and a closing popup releases the event capture.
    // The progress dialog has to open after that, or its Stop button never hears a tap.
    confirmed          : function () {
        enyo.asyncMethod(this, "startImport");
    },
    startImport        : function () {
        var accounts = AccountsList.getAccountsByTemplateId("com.palm.palmprofile");
        if (!accounts || !accounts[0] || !accounts[0]._id) {
            this.showResult($L("There is no on-device account to import contacts into."));
            return;
        }
        this.accountId = accounts[0]._id;
        this.contactKind = "com.palm.contact.palmprofile:1";

        this.running = true;
        this.stopped = false;
        this.photoServiceFailed = false;
        this.counts = {imported: 0, skipped: 0, failed: 0, photosFailed: 0};
        this.nextCard = 0;
        this.keys = {};
        this.$.progressDialog.openAtStart();
        this.$.progressDialog.showProgress(0, this.cards.length);
        this.loadExistingKeys();
    },
    stopImport         : function () {
        this.stopped = true;
    },
    // Reads the account's contacts a page at a time, for the duplicate check.
    loadExistingKeys   : function (inNext) {
        var query = {
            from  : "com.palm.contact:1",
            where : [{prop: "accountId", op: "=", val: this.accountId}],
            select: ["name", "organizations", "phoneNumbers", "emails"],
            limit : VCardBatchImport.FIND_PAGE_SIZE
        };
        if (inNext) {
            query.page = inNext;
        }
        PalmCall.call("palm://com.palm.db/", "find", {query: query}).then(this, function (future) {
            var response, i, key;
            try {
                response = future.result;
            } catch (e) {
                // Not fatal: all that is lost is spotting contacts added by an earlier import.
                enyo.warn("VCardBatchImport: could not read existing contacts: " + e);
                this.importNext();
                return;
            }
            for (i = 0; i < response.results.length; i += 1) {
                key = VCardParser.duplicateKey(response.results[i]);
                if (key) {
                    this.keys[key] = true;
                }
            }
            if (response.next) {
                this.loadExistingKeys(response.next);
            } else {
                this.importNext();
            }
        });
    },
    importNext         : function () {
        var card, parsed, key;

        if (this.stopped || this.nextCard >= this.cards.length) {
            this.finishImport();
            return;
        }
        card = this.nextCard;
        this.nextCard += 1;
        this.$.progressDialog.showProgress(this.nextCard, this.cards.length);

        try {
            parsed = VCardParser.parseCard(this.cards[card]);
            this.cards[card] = null;
        } catch (e) {
            enyo.warn("VCardBatchImport: card " + card + " would not parse: " + e);
            this.counts.failed += 1;
            enyo.asyncMethod(this, "importNext");
            return;
        }

        key = VCardParser.duplicateKey(parsed.contact);
        if (!VCardParser.hasContent(parsed.contact) || (key && this.keys[key])) {
            this.counts.skipped += 1;
            enyo.asyncMethod(this, "importNext");
            return;
        }
        if (key) {
            this.keys[key] = true;
        }
        this.saveContact(parsed, card);
    },
    saveContact        : function (inParsed, inCard) {
        var contact = ContactsLib.ContactFactory.createContactEditable(inParsed.contact),
            future = new Future();

        contact.setKind(this.contactKind);
        contact.getAccountId().setValue(this.accountId);

        future.now(this, function () {
            return inParsed.photo ? this.addPhoto(contact, inParsed.photo, inCard) : true;
        });
        future.then(this, function () {
            var dummy;
            try {
                dummy = future.result;
            } catch (e) {
                // The contact matters more than its picture.
                enyo.warn("VCardBatchImport: card " + inCard + " lost its photo: " + e);
                this.counts.photosFailed += 1;
            }
            return contact.save();
        });
        future.then(this, function () {
            try {
                var dummy = future.result;
                this.counts.imported += 1;
            } catch (e) {
                enyo.warn("VCardBatchImport: card " + inCard + " would not save: " + e);
                this.counts.failed += 1;
            }
            enyo.asyncMethod(this, "importNext");
            future.result = true;
        });
    },
    // Writes the file's photo out, then has the contacts library cut the contact's two sizes
    // from it, as it does for a photo chosen in Edit, centred. The library's copies are what
    // the contact keeps, so the source goes when they are done.
    addPhoto           : function (inContact, inBase64, inCard) {
        var extension = VCardParser.photoExtension(inBase64),
            path = VCardBatchImport.PHOTO_FOLDER + "vcard-" + Date.now() + "-" + inCard + "." + extension,
            future = new Future(),
            cropInfo;

        if (this.photoServiceFailed) {
            throw new Error("the photo service is not available");
        }
        if (!extension) {
            throw new Error("not a JPEG or PNG");
        }

        future.now(this, function () {
            return this.measurePhoto(inBase64, extension);
        });
        future.then(this, function () {
            var size = future.result;
            cropInfo = {focusX: 0.5, focusY: 0.5, suggestedXsize: Math.min(size.width, size.height)};
            return this.writePhoto(path, inBase64);
        });
        future.then(this, function () {
            path = future.result;
            return inContact.setCroppedContactPhoto(path, cropInfo, ContactsLib.ContactPhoto.TYPE.BIG);
        });
        future.then(this, function () {
            var dummy = future.result;
            return inContact.setCroppedContactPhoto(path, cropInfo, ContactsLib.ContactPhoto.TYPE.SQUARE);
        });
        future.then(this, function () {
            var dummy = future.result;
            return PalmCall.call(VCardBatchImport.PHOTO_SERVICE, "remove", {path: path});
        });
        return future;
    },
    measurePhoto       : function (inBase64, inExtension) {
        var future = new Future(),
            image = new Image();
        image.onload = function () {
            future.result = {width: image.width, height: image.height};
        };
        image.onerror = function () {
            future.exception = new Error("the image would not decode");
        };
        image.src = "data:image/" + (inExtension === "png" ? "png" : "jpeg") + ";base64," + inBase64;
        return future;
    },
    // Answers the path the service used.
    writePhoto         : function (inPath, inBase64) {
        var future = new Future(),
            size = VCardBatchImport.PHOTO_CHUNK,
            service = VCardBatchImport.PHOTO_SERVICE,
            self = this;

        function serviceFailed(e) {
            // Probably not installed. Don't wait for it once for every remaining photo.
            self.photoServiceFailed = true;
            future.exception = e;
        }
        function writeFrom(inOffset) {
            PalmCall.call(service, "writeChunk", {
                path  : inPath,
                data  : inBase64.substring(inOffset, inOffset + size),
                append: inOffset > 0
            }).then(function (chunkFuture) {
                try {
                    var dummy = chunkFuture.result;
                } catch (e) {
                    serviceFailed(e);
                    return;
                }
                if (inOffset + size < inBase64.length) {
                    writeFrom(inOffset + size);
                    return;
                }
                PalmCall.call(service, "commit", {path: inPath}).then(function (commitFuture) {
                    try {
                        future.result = commitFuture.result.path;
                    } catch (e) {
                        serviceFailed(e);
                    }
                });
            });
        }

        writeFrom(0);
        return future;
    },
    finishImport       : function () {
        var counts = this.counts,
            parts = [],
            add = function (inMessage, inCount) {
                if (inCount) {
                    parts.push(new enyo.g11n.Template(inMessage).formatChoice(inCount, {count: inCount}));
                }
            };

        this.running = false;
        this.cards = null;
        this.keys = null;
        this.$.progressDialog.close();

        add($L("1#1 contact imported.|##{count} contacts imported."), counts.imported);
        add($L("1#1 was already in Contacts or empty.|##{count} were already in Contacts or empty."), counts.skipped);
        add($L("1#1 could not be saved.|##{count} could not be saved."), counts.failed);
        add($L("1#1 photo could not be added.|##{count} photos could not be added."), counts.photosFailed);
        if (this.stopped) {
            parts.unshift($L("Import stopped."));
        }
        this.showResult(parts.join(" ") || $L("No contacts were imported."));
    }
});
