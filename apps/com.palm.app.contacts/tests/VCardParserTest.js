// Run with: node apps/com.palm.app.contacts/tests/VCardParserTest.js
// (scripts/contacts-app.sh feed runs it too.) All the names and numbers here are made up.

var assert = require("assert"),
    path = require("path"),
    Parser = require(path.join(__dirname, "../app/utils/VCardParser.js"));

function card(lines) {
    return Parser.parseCard(Parser.splitCards("BEGIN:VCARD\r\n" + lines.join("\r\n") + "\r\nEND:VCARD\r\n")[0]);
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

test("splits a file into its cards, however it is capitalised or ends", function () {
    var text = "﻿BEGIN:VCARD\nN:One;;;;\nEND:VCARD\n\nbegin:vcard\r\nN:Two;;;;\r\nend:vcard\r\nBEGIN:VCARD\nN:Three;;;;";
    assert.equal(Parser.splitCards(text).length, 3);
    assert.equal(Parser.parseCard(Parser.splitCards(text)[2]).contact.name.familyName, "Three");
    assert.equal(Parser.splitCards("not a vcard").length, 0);
});

test("name parts, and escapes in them", function () {
    assert.deepEqual(card(["N:O\\,Brien;Pat;Q;Dr.;Jr."]).contact.name, {
        familyName: "O,Brien", givenName: "Pat", middleName: "Q", honorificPrefix: "Dr.", honorificSuffix: "Jr."
    });
});

test("FN stands in for a blank N", function () {
    assert.deepEqual(card(["N:;;;;", "FN:Pat Q Doe"]).contact.name, {givenName: "Pat Q", familyName: "Doe"});
    assert.deepEqual(card(["FN:Madonna"]).contact.name, {givenName: "Madonna"});
});

test("a company's card has no person's name", function () {
    var result = card(["N:;;;;", "FN:Acme Rockets", "ORG:Acme Rockets;", "X-ABShowAs:COMPANY"]);
    assert.deepEqual(result.contact.name, {});
    assert.equal(result.contact.organizations[0].name, "Acme Rockets");
    assert.ok(Parser.hasContent(result.contact));
});

test("unfolds long lines, in the middle of a word", function () {
    assert.equal(card(["N:Doe;Pat;;;", "NOTE:The first li", " ne and\\nthe sec", "\tond"]).contact.note, "The first line and\nthe second");
});

test("values are not HTML-escaped", function () {
    assert.equal(card(["ORG:AT&T <Labs>;Research"]).contact.organizations[0].name, "AT&T <Labs>");
});

test("phone types, including Apple's and vCard 2.1's", function () {
    var phones = card([
        "TEL;type=CELL;type=VOICE;type=pref:555-0100",
        "TEL;TYPE=WORK,VOICE:555-0101",
        "TEL;HOME;VOICE:555-0102",
        "TEL;TYPE=HOME;TYPE=FAX:555-0103",
        "TEL;TYPE=FAX:555-0104",
        "TEL;TYPE=PAGER:555-0105",
        "TEL;TYPE=IPHONE:555-0106",
        "TEL;TYPE=MAIN:555-0107",
        "TEL:555-0108",
        "TEL;VALUE=uri;TYPE=home:tel:+1-555-0109"
    ]).contact.phoneNumbers;
    assert.deepEqual(phones.map(function (p) { return p.type; }), [
        "type_mobile", "type_work", "type_home", "type_personal_fax", "type_work_fax",
        "type_pager", "type_mobile", "type_main", "type_other", "type_home"
    ]);
    assert.equal(phones[0].primary, true);
    assert.equal(phones[9].value, "+1-555-0109");
});

test("only the first PREF is primary", function () {
    var emails = card(["EMAIL;TYPE=INTERNET;TYPE=WORK;TYPE=PREF:a@example.com", "EMAIL;TYPE=HOME;TYPE=PREF:b@example.com"]).contact.emails;
    assert.equal(emails[0].primary, true);
    assert.equal(emails[0].type, "type_work");
    assert.equal(emails[1].primary, undefined);
});

test("addresses keep commas and line breaks and lose the escapes", function () {
    assert.deepEqual(card(["item1.ADR;TYPE=HOME;TYPE=PREF:;Apt 4;1 Main St\\nBack Door;Town\\, North;CA;90000;USA", "item1.X-ABADR:us"]).contact.addresses, [{
        type: "type_home", streetAddress: "1 Main St\nBack Door\nApt 4", locality: "Town, North",
        region: "CA", postalCode: "90000", country: "USA", primary: true
    }]);
    assert.equal(card(["ADR;TYPE=WORK:;;;;;;"]).contact.addresses, undefined);
});

test("a quoted parameter may hold colons and semicolons", function () {
    assert.equal(card(['ADR;LABEL="1 Main St: back;door";TYPE=HOME:;;1 Main St;Town;;;']).contact.addresses[0].locality, "Town");
});

test("birthdays, with and without a year", function () {
    assert.equal(card(["BDAY:1980-02-03"]).contact.birthday, "1980-02-03");
    assert.equal(card(["BDAY;VALUE=date:19800203"]).contact.birthday, "1980-02-03");
    assert.equal(card(["BDAY:1980-02-03T00:00:00Z"]).contact.birthday, "1980-02-03");
    assert.equal(card(["BDAY;X-APPLE-OMIT-YEAR=1604:1604-03-15"]).contact.birthday, "1900-03-15");
    assert.equal(card(["BDAY:--0315"]).contact.birthday, "1900-03-15");
    assert.equal(card(["BDAY:someday"]).contact.birthday, undefined);
});

test("job title joins the company", function () {
    assert.deepEqual(card(["ORG:Acme;Rockets", "TITLE:Chief\\, Engineer"]).contact.organizations, [
        {name: "Acme", department: "Rockets", title: "Chief, Engineer"}
    ]);
});

test("instant messaging", function () {
    var ims = card([
        "IMPP;X-SERVICE-TYPE=Skype;TYPE=HOME:skype:pat.doe",
        "IMPP:xmpp:pat%40example.com",
        "X-AIM:patdoe",
        "IMPP;X-SERVICE-TYPE=Matrix:matrix:pat"
    ]).contact.ims;
    assert.deepEqual(ims.map(function (i) { return [i.value, i.type]; }), [
        ["pat.doe", "type_skype"], ["pat@example.com", "type_jabber"], ["patdoe", "type_aim"], ["pat", "type_default"]
    ]);
});

test("a related name takes its type from the label in its group", function () {
    assert.deepEqual(card(["item1.X-ABRELATEDNAMES:Sam Doe", "item1.X-ABLabel:_$!<Spouse>!$_", "item2.X-ABRELATEDNAMES:Al", "item2.X-ABLabel:Golf"]).contact.relations, [
        {value: "Sam Doe", type: "type_spouse"}, {value: "Al", type: "type_other"}
    ]);
});

test("URLs and social profiles", function () {
    assert.deepEqual(card(["item1.URL;type=pref:http\\://example.com", "X-SOCIALPROFILE;type=twitter:https://example.com/pat"]).contact.urls.map(function (u) { return u.value; }), [
        "http://example.com", "https://example.com/pat"
    ]);
});

test("unknown properties are ignored", function () {
    var result = card(["N:Doe;Pat;;;", "X-ABShowAs:PERSON", "VND-63-SENSITIVE-CONTENT-CONFIG:abc", " def", "PRODID:-//Apple Inc.//iPhone//EN"]);
    assert.deepEqual(Object.keys(result.contact), ["name"]);
});

test("vCard 2.1 quoted-printable, in UTF-8 and Latin-1, across lines", function () {
    assert.equal(card(["N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:M=C3=BCller;Jos=C3=A9;;;"]).contact.name.familyName, "Müller");
    assert.equal(card(["N;CHARSET=ISO-8859-1;ENCODING=QUOTED-PRINTABLE:M=FCller;Pat;;;"]).contact.name.familyName, "Müller");
    assert.equal(card(["NOTE;ENCODING=QUOTED-PRINTABLE:one=", "two"]).contact.note, "onetwo");
});

test("photos: folded base64, 2.1 base64, data URIs; URLs are not photos", function () {
    assert.equal(card(["PHOTO;ENCODING=b;TYPE=JPEG:/9j/4A", " AQSk", " ZJRg=="]).photo, "/9j/4AAQSkZJRg==");
    assert.equal(card(["PHOTO;JPEG;ENCODING=BASE64:", "/9j/4AAQ", "SkZJRg==", "", "NOTE:after"]).photo, "/9j/4AAQSkZJRg==");
    assert.equal(card(["PHOTO:data:image/png;base64,iVBORw0KGgo="]).photo, "iVBORw0KGgo=");
    assert.equal(card(["PHOTO;VALUE=uri:http://example.com/a.jpg"]).photo, undefined);
    assert.equal(Parser.photoExtension("/9j/4AAQ"), "jpg");
    assert.equal(Parser.photoExtension("iVBORw0KGgo="), "png");
    assert.equal(Parser.photoExtension("AAAAIGZ0eXBoZWlj"), null);
});

test("a card with no data has no content", function () {
    assert.equal(Parser.hasContent(card(["VERSION:3.0", "N:;;;;"]).contact), false);
    assert.equal(Parser.hasContent(card(["N:;;;;", "TEL:555-0100"]).contact), true);
});

test("the duplicate key ignores formatting and order", function () {
    var one = card(["N:Doe;Pat;;;", "TEL:(555) 010-0000", "TEL:555-010-0001", "EMAIL:Pat@Example.com"]).contact,
        two = {name: {familyName: "DOE", givenName: "pat"}, phoneNumbers: [{value: "5550100001"}, {value: "5550100000"}], emails: [{value: "pat@example.com"}]},
        other = card(["N:Doe;Pat;;;", "TEL:555-010-0002"]).contact;
    assert.equal(Parser.duplicateKey(one), Parser.duplicateKey(two));
    assert.notEqual(Parser.duplicateKey(one), Parser.duplicateKey(other));
    assert.equal(Parser.duplicateKey({name: {}}), null);
});
