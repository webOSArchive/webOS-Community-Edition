// Run with: node apps/com.palm.app.contacts/tests/VCardAccountTest.js
// (scripts/contacts-app.sh feed runs it too.) Loads the real VCardBatchImport.js with a stub
// Enyo: however the default account is set, an import must only touch the on-device account.

var assert = require("assert"),
    fs = require("fs"),
    path = require("path"),
    vm = require("vm"),
    source = fs.readFileSync(path.join(__dirname, "../app/utils/VCardBatchImport.js"), "utf8");

function makeImporter(profileAccounts) {
    var kinds = {},
        sandbox = {
            $L: function (s) { return s; },
            enyo: {kind: function (k) { kinds[k.name] = k; }},
            ContactsLib: {AppPrefs: {Pref: {defaultAccountId: "defaultAccountId"}}},
            AppPrefs: {get: function () { return "eas-account"; }},
            AccountsList: {
                getAccountsByTemplateId: function (id) { return id === "com.palm.palmprofile" ? profileAccounts : []; },
                getProvider: function () { return {dbkinds: {contact: "com.palm.contact.eas:1"}}; }
            }
        },
        importer;
    vm.runInNewContext(source, sandbox);
    importer = Object.create(kinds.VCardBatchImport);
    importer.cards = ["a card"];
    importer.results = [];
    importer.loaded = 0;
    importer.showResult = function (m) { this.results.push(m); };
    importer.loadExistingKeys = function () { this.loaded += 1; };
    importer.$ = {progressDialog: {openAtStart: function () {}, showProgress: function () {}}};
    return importer;
}

function test(name, body) {
    try {
        body();
        console.log("ok   " + name);
    } catch (e) {
        console.log("FAIL " + name + ": " + e.message);
        process.exitCode = 1;
    }
}

test("a default of Exchange still imports to the on-device account", function () {
    var importer = makeImporter([{_id: "local-account"}]);
    importer.startImport();
    assert.equal(importer.accountId, "local-account");
    assert.equal(importer.contactKind, "com.palm.contact.palmprofile:1");
    assert.equal(importer.loaded, 1);
});

test("no on-device account stops the import instead of using the default", function () {
    [[], null, undefined, [{}]].forEach(function (accounts) {
        var importer = makeImporter(accounts);
        importer.startImport();
        assert.equal(importer.loaded, 0);
        assert.equal(importer.running, undefined);
        assert.equal(importer.results.length, 1);
        assert.equal(importer.accountId, undefined);
    });
});
