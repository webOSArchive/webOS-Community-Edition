// webOS CE: reads vCard 2.1, 3.0 and 4.0 text into raw com.palm.contact objects.
//
// The stock importer (the contacts library's VCardImporter, reached through
// com.palm.service.contacts) predates what phones export today: it does not unfold long
// lines, so a folded note is cut short; it leaves the escapes in addresses and HTML-escapes
// every value, so "A&B" is stored as "A&amp;B"; and it drops photos and IMPP. Parsing here
// keeps the fix in the app, so it needs no change to the rootfs libraries.
//
// No dependencies, so that it runs under plain node: tests/VCardParserTest.js.

/*global module */

var VCardParser = (function () {
    var IM_TYPES = {
        aim: "type_aim", yahoo: "type_yahoo", gtalk: "type_gtalk", googletalk: "type_gtalk",
        google: "type_gtalk", msn: "type_msn", jabber: "type_jabber", xmpp: "type_jabber",
        icq: "type_icq", skype: "type_skype", qq: "type_qq"
    };
    var RELATION_TYPES = {
        assistant: "type_assistant", brother: "type_brother", child: "type_child", father: "type_father",
        friend: "type_friend", manager: "type_manager", mother: "type_mother", parent: "type_parent",
        partner: "type_partner", relative: "type_relative", sister: "type_sister", spouse: "type_spouse"
    };

    // Splits a file into the text of each card. Cheap: a card is parsed only when needed.
    function splitCards(text) {
        var begin = /^[ \t]*BEGIN:VCARD[ \t]*\r?$/gim,
            end = /^[ \t]*END:VCARD[ \t]*\r?$/gim,
            cards = [],
            open,
            close;

        text = text.replace(/^﻿/, "");
        open = begin.exec(text);
        while (open) {
            end.lastIndex = open.index + open[0].length;
            close = end.exec(text);
            cards.push(text.substring(open.index + open[0].length, close ? close.index : text.length));
            if (!close) {
                break;
            }
            begin.lastIndex = close.index + close[0].length;
            open = begin.exec(text);
        }
        return cards;
    }

    // Finds the colon ending a property's name and parameters; one in quotes is part of a value.
    function findValueStart(line) {
        var quoted = false, i, ch;
        for (i = 0; i < line.length; i += 1) {
            ch = line.charAt(i);
            if (ch === '"') {
                quoted = !quoted;
            } else if (ch === ":" && !quoted) {
                return i;
            }
        }
        return -1;
    }

    function splitOutsideQuotes(string, separator) {
        var parts = [], current = "", quoted = false, i, ch;
        for (i = 0; i < string.length; i += 1) {
            ch = string.charAt(i);
            if (ch === '"') {
                quoted = !quoted;
            }
            if (ch === separator && !quoted) {
                parts.push(current);
                current = "";
            } else {
                current += ch;
            }
        }
        parts.push(current);
        return parts;
    }

    // "TEL;TYPE=HOME,VOICE;PREF:555" -> {group, name: "TEL", value: "555", types: ["HOME", "VOICE", "PREF"], params}
    function parseProperty(line) {
        var colon = findValueStart(line),
            head,
            pieces,
            name,
            dot,
            property,
            i,
            param,
            equals,
            key,
            values,
            j;

        if (colon < 1) {
            return null;
        }
        head = line.substring(0, colon);
        pieces = splitOutsideQuotes(head, ";");
        name = pieces[0];
        property = {group: "", name: "", value: line.substring(colon + 1), types: [], params: {}};
        dot = name.lastIndexOf(".");
        if (dot !== -1) {
            property.group = name.substring(0, dot).toUpperCase();
            name = name.substring(dot + 1);
        }
        property.name = name.toUpperCase();

        for (i = 1; i < pieces.length; i += 1) {
            param = pieces[i];
            equals = param.indexOf("=");
            if (equals === -1) {
                // vCard 2.1: a bare value is a TYPE, unless it names an encoding.
                key = param.toUpperCase();
                if (key === "BASE64" || key === "B" || key === "QUOTED-PRINTABLE") {
                    property.params.ENCODING = key;
                } else {
                    property.types.push(key);
                }
            } else {
                key = param.substring(0, equals).toUpperCase();
                values = param.substring(equals + 1).replace(/^"|"$/g, "");
                if (key === "TYPE") {
                    values = values.split(",");
                    for (j = 0; j < values.length; j += 1) {
                        property.types.push(values[j].toUpperCase());
                    }
                } else if (key === "PREF") {
                    property.types.push("PREF");
                } else {
                    property.params[key] = values;
                }
            }
        }
        return property;
    }

    // RFC 2425 folding: a line starting with a space or tab continues the one before it.
    // vCard 2.1's quoted-printable continues with a trailing "=" instead, and its base64 runs
    // on until a blank line, with or without indenting.
    function unfold(cardText) {
        var rawLines = cardText.split(/\r\n|\n|\r/),
            lines = [],
            pieces = null, // The logical line so far. A photo runs to thousands of pieces.
            isQP = false,
            isBase64 = false,
            i,
            line;

        function finish() {
            if (pieces) {
                lines.push(pieces.join(""));
            }
            pieces = null;
        }

        for (i = 0; i < rawLines.length; i += 1) {
            line = rawLines[i];

            if (pieces && isQP && /=$/.test(pieces[pieces.length - 1])) {
                pieces[pieces.length - 1] = pieces[pieces.length - 1].slice(0, -1);
                pieces.push(line);
            } else if (pieces && /^[ \t]/.test(line)) {
                pieces.push(line.substring(1));
            } else if (pieces && isBase64 && /^[A-Za-z0-9+\/=]+$/.test(line)) {
                pieces.push(line);
            } else {
                finish();
                if (line.length) {
                    pieces = [line];
                    isQP = /^[^:]*QUOTED-PRINTABLE/i.test(line);
                    isBase64 = /^[^:]*(ENCODING=(BASE64|B)\b|;BASE64\b)/i.test(line);
                }
            }
        }
        finish();
        return lines;
    }

    function utf8ToString(bytes) {
        var result = "", i = 0, b, extra, code;
        while (i < bytes.length) {
            b = bytes[i];
            i += 1;
            if (b < 0x80) {
                result += String.fromCharCode(b);
                continue;
            }
            if (b >= 0xF0) {
                extra = 3;
                code = b & 0x07;
            } else if (b >= 0xE0) {
                extra = 2;
                code = b & 0x0F;
            } else if (b >= 0xC0) {
                extra = 1;
                code = b & 0x1F;
            } else {
                return null; // A stray continuation byte: not UTF-8.
            }
            if (i + extra > bytes.length) {
                return null;
            }
            while (extra > 0) {
                b = bytes[i];
                i += 1;
                extra -= 1;
                if ((b & 0xC0) !== 0x80) {
                    return null;
                }
                code = (code << 6) | (b & 0x3F);
            }
            if (code > 0xFFFF) {
                code -= 0x10000;
                result += String.fromCharCode(0xD800 + (code >> 10), 0xDC00 + (code & 0x3FF));
            } else {
                result += String.fromCharCode(code);
            }
        }
        return result;
    }

    function decodeQuotedPrintable(value, charset) {
        var bytes = [], i = 0, ch, hex, latin1 = "", decoded;
        while (i < value.length) {
            ch = value.charAt(i);
            hex = value.substring(i + 1, i + 3);
            if (ch === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
                bytes.push(parseInt(hex, 16));
                i += 3;
            } else {
                bytes.push(value.charCodeAt(i) & 0xFF);
                i += 1;
            }
        }
        if (!charset || /utf-?8/i.test(charset)) {
            decoded = utf8ToString(bytes);
            if (decoded !== null) {
                return decoded;
            }
        }
        for (i = 0; i < bytes.length; i += 1) {
            latin1 += String.fromCharCode(bytes[i]);
        }
        return latin1;
    }

    // Applies a property's encoding. Base64 is left alone: only photos use it, as bytes.
    function textValue(property) {
        if (String(property.params.ENCODING).toUpperCase() === "QUOTED-PRINTABLE") {
            return decodeQuotedPrintable(property.value, property.params.CHARSET);
        }
        return property.value;
    }

    function unescapeText(value) {
        return value.replace(/\\([\\;,:nN])/g, function (all, ch) {
            return (ch === "n" || ch === "N") ? "\n" : ch;
        });
    }

    // Splits on a separator a backslash does not escape, then unescapes each part.
    function splitEscaped(value, separator) {
        var parts = [], current = "", i, ch;
        for (i = 0; i < value.length; i += 1) {
            ch = value.charAt(i);
            if (ch === "\\" && i + 1 < value.length) {
                current += ch + value.charAt(i + 1);
                i += 1;
            } else if (ch === separator) {
                parts.push(unescapeText(current));
                current = "";
            } else {
                current += ch;
            }
        }
        parts.push(unescapeText(current));
        return parts;
    }

    function hasType(property, type) {
        return property.types.indexOf(type) !== -1;
    }

    function phoneType(property) {
        var work = hasType(property, "WORK"), home = hasType(property, "HOME");
        if (hasType(property, "FAX")) {
            return home ? "type_personal_fax" : "type_work_fax";
        }
        if (hasType(property, "CELL") || hasType(property, "IPHONE") || hasType(property, "MOBILE")) {
            return "type_mobile";
        }
        if (hasType(property, "PAGER")) {
            return "type_pager";
        }
        if (work) {
            return "type_work";
        }
        if (home) {
            return "type_home";
        }
        if (hasType(property, "MAIN")) {
            return "type_main";
        }
        return "type_other";
    }

    function homeWorkOtherType(property) {
        if (hasType(property, "WORK")) {
            return "type_work";
        }
        return hasType(property, "HOME") ? "type_home" : "type_other";
    }

    function setPrimary(list, property, entry) {
        var i;
        if (hasType(property, "PREF")) {
            for (i = 0; i < list.length; i += 1) {
                if (list[i].primary) {
                    return;
                }
            }
            entry.primary = true;
        }
    }

    function addTo(raw, field, entry, property) {
        raw[field] = raw[field] || [];
        setPrimary(raw[field], property, entry);
        raw[field].push(entry);
    }

    function parseName(raw, value) {
        var pieces = splitEscaped(value, ";"),
            name = {},
            fields = ["familyName", "givenName", "middleName", "honorificPrefix", "honorificSuffix"],
            i,
            part;
        for (i = 0; i < fields.length; i += 1) {
            part = (pieces[i] || "").replace(/^\s+|\s+$/g, "");
            if (part) {
                name[fields[i]] = part;
            }
        }
        raw.name = name;
    }

    // Only when a card has no N. A one-word name goes in givenName, as webOS does.
    function nameFromFullName(fullName) {
        var words = fullName.replace(/^\s+|\s+$/g, "").split(/\s+/), name = {};
        if (!words[0]) {
            return name;
        }
        if (words.length > 1) {
            name.familyName = words.pop();
        }
        name.givenName = words.join(" ");
        return name;
    }

    function addAddress(raw, property, value) {
        var pieces = splitEscaped(value, ";"),
            street = [],
            entry = {type: homeWorkOtherType(property)};

        if (pieces[0]) {
            street.push(pieces[0]);
        }
        if (pieces[2]) {
            street.push(pieces[2]);
        }
        if (pieces[1]) {
            street.push(pieces[1]);
        }
        if (street.length) {
            entry.streetAddress = street.join("\n");
        }
        if (pieces[3]) {
            entry.locality = pieces[3];
        }
        if (pieces[4]) {
            entry.region = pieces[4];
        }
        if (pieces[5]) {
            entry.postalCode = pieces[5];
        }
        if (pieces[6]) {
            entry.country = pieces[6];
        }
        if (street.length || pieces[3] || pieces[4] || pieces[5] || pieces[6]) {
            addTo(raw, "addresses", entry, property);
        }
    }

    // webOS wants YYYY-MM-DD, and takes the year 1900 as "no year" (Birthday.getDisplayValue).
    // Without a year, vCard 3 writes --MMDD or --MM-DD; Apple writes the year 1604 and says so
    // in X-APPLE-OMIT-YEAR.
    function parseBirthday(property, value) {
        var match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(value),
            noYear = /^--(\d{2})-?(\d{2})/.exec(value);
        if (noYear) {
            return "1900-" + noYear[1] + "-" + noYear[2];
        }
        if (!match) {
            return undefined;
        }
        if (property.params["X-APPLE-OMIT-YEAR"] === match[1] || match[1] === "1604") {
            return "1900-" + match[2] + "-" + match[3];
        }
        return match[1] + "-" + match[2] + "-" + match[3];
    }

    // IMPP;X-SERVICE-TYPE=Skype:skype:someone -> {value: "someone", type: "type_skype"}
    function parseImpp(property, value) {
        var scheme = /^([a-z0-9+.\-]+):(.*)$/i.exec(value),
            service = String(property.params["X-SERVICE-TYPE"] || (scheme && scheme[1]) || "").toLowerCase().replace(/\s/g, ""),
            address = scheme ? scheme[2] : value;
        return {value: decodeURIComponentSafe(address), type: IM_TYPES[service] || "type_default"};
    }

    function decodeURIComponentSafe(value) {
        try {
            return decodeURIComponent(value);
        } catch (e) {
            return value;
        }
    }

    function imProperty(raw, property, value, service) {
        if (value) {
            addTo(raw, "ims", {value: value, type: IM_TYPES[service] || "type_default"}, property);
        }
    }

    // Apple's labels: "_$!<Spouse>!$_", or free text.
    function appleLabel(label) {
        var match = /^_\$!<(.*)>!\$_$/.exec(label);
        return (match ? match[1] : label).toLowerCase();
    }

    // The image data of a PHOTO, or null when it has none (a remote URL, for one).
    function parsePhoto(property) {
        var value = property.value,
            encoding = String(property.params.ENCODING || "").toUpperCase(),
            dataUri = /^data:image\/[a-z.+\-]+;base64,(.*)$/i.exec(value);

        if (dataUri) {
            return dataUri[1].replace(/\s/g, "");
        }
        if (encoding === "B" || encoding === "BASE64") {
            return value.replace(/\s/g, "");
        }
        return null;
    }

    // The file extension for a photo's base64, from its first bytes; null when it is a format
    // com.palm.image cannot read.
    function photoExtension(base64) {
        if (base64.substring(0, 4) === "/9j/") {
            return "jpg";
        }
        if (base64.substring(0, 8) === "iVBORw0K") {
            return "png";
        }
        return null;
    }

    function trimText(value) {
        return value.replace(/^\s+|\s+$/g, "");
    }

    function parseValueProperty(raw, property, groupLabels) {
        var value = textValue(property), text, label, relation;

        switch (property.name) {
        case "N":
            parseName(raw, value);
            break;
        case "NICKNAME":
            text = trimText(splitEscaped(value, ",")[0]);
            if (text) {
                raw.nickname = text;
            }
            break;
        case "TEL":
            text = trimText(unescapeText(value).replace(/^tel:/i, ""));
            if (text) {
                addTo(raw, "phoneNumbers", {value: text, type: phoneType(property)}, property);
            }
            break;
        case "EMAIL":
            text = trimText(unescapeText(value));
            if (text) {
                addTo(raw, "emails", {value: text, type: homeWorkOtherType(property)}, property);
            }
            break;
        case "ADR":
            addAddress(raw, property, value);
            break;
        case "BDAY":
            text = parseBirthday(property, trimText(value));
            if (text) {
                raw.birthday = text;
            }
            break;
        case "URL":
        case "X-SOCIALPROFILE":
            text = trimText(unescapeText(value));
            if (text) {
                addTo(raw, "urls", {value: text, type: homeWorkOtherType(property)}, property);
            }
            break;
        case "NOTE":
            text = trimText(unescapeText(value));
            if (text) {
                raw.note = raw.note ? raw.note + "\n" + text : text;
            }
            break;
        case "IMPP":
            text = parseImpp(property, trimText(unescapeText(value)));
            if (text.value) {
                addTo(raw, "ims", text, property);
            }
            break;
        case "X-AIM":
        case "X-YAHOO":
        case "X-MSN":
        case "X-JABBER":
        case "X-ICQ":
        case "X-SKYPE":
        case "X-QQ":
            imProperty(raw, property, trimText(unescapeText(value)), property.name.substring(2).toLowerCase());
            break;
        case "X-GTALK":
            imProperty(raw, property, trimText(unescapeText(value)), "gtalk");
            break;
        case "X-ABRELATEDNAMES":
            text = trimText(unescapeText(value));
            label = appleLabel(groupLabels[property.group] || "");
            relation = RELATION_TYPES[label] || "type_other";
            if (text) {
                addTo(raw, "relations", {value: text, type: relation}, property);
            }
            break;
        case "X-SPOUSE":
            text = trimText(unescapeText(value));
            if (text) {
                addTo(raw, "relations", {value: text, type: "type_spouse"}, property);
            }
            break;
        }
    }

    function parseOrganization(raw, properties) {
        var organization = {}, i, property, pieces, value;
        for (i = 0; i < properties.length; i += 1) {
            property = properties[i];
            if (property.name === "ORG") {
                pieces = splitEscaped(textValue(property), ";");
                if (trimText(pieces[0])) {
                    organization.name = trimText(pieces[0]);
                }
                if (pieces[1] && trimText(pieces[1])) {
                    organization.department = trimText(pieces[1]);
                }
            } else if (property.name === "TITLE") {
                value = trimText(unescapeText(textValue(property)));
                if (value) {
                    organization.title = value;
                }
            }
        }
        if (organization.name || organization.department || organization.title) {
            raw.organizations = [organization];
        }
    }

    function isBlankName(name) {
        var field;
        for (field in name) {
            if (name.hasOwnProperty(field) && name[field]) {
                return false;
            }
        }
        return true;
    }

    // One card's text -> {contact: raw contact, photo: base64 or undefined}.
    function parseCard(cardText) {
        var lines = unfold(cardText),
            raw = {},
            result = {contact: raw},
            properties = [],
            groupLabels = {},
            fullName = "",
            i,
            property;

        for (i = 0; i < lines.length; i += 1) {
            property = parseProperty(lines[i]);
            if (property) {
                properties.push(property);
                if (property.name === "X-ABLABEL" && property.group) {
                    groupLabels[property.group] = property.value;
                }
            }
        }

        for (i = 0; i < properties.length; i += 1) {
            property = properties[i];
            if (property.name === "FN") {
                fullName = unescapeText(textValue(property));
            } else if (property.name === "PHOTO") {
                if (!result.photo) {
                    result.photo = parsePhoto(property) || undefined;
                }
            } else {
                parseValueProperty(raw, property, groupLabels);
            }
        }
        parseOrganization(raw, properties);

        if (!raw.name || isBlankName(raw.name)) {
            raw.name = nameFromFullName(raw.organizations && raw.organizations[0].name === fullName ? "" : fullName);
        }
        return result;
    }

    function hasContent(raw) {
        var field;
        for (field in raw) {
            if (raw.hasOwnProperty(field) && field !== "name") {
                return true;
            }
        }
        return !isBlankName(raw.name);
    }

    function normalized(value) {
        return String(value || "").toLowerCase().replace(/\s+/g, " ").replace(/^ | $/g, "");
    }

    function sortedValues(list, clean) {
        var values = [], i;
        for (i = 0; list && i < list.length; i += 1) {
            values.push(clean(list[i].value));
        }
        return values.sort().join(",");
    }

    function digitsOnly(value) {
        return String(value || "").replace(/[^0-9]/g, "");
    }

    // Two contacts with the same key are the same contact: importing a file twice adds nothing.
    // Null for a contact with nothing to compare.
    function duplicateKey(raw) {
        var name = raw.name || {},
            organization = (raw.organizations && raw.organizations[0]) || {},
            key = [
                normalized(name.familyName), normalized(name.givenName), normalized(name.middleName),
                normalized(organization.name),
                sortedValues(raw.phoneNumbers, digitsOnly),
                sortedValues(raw.emails, normalized)
            ].join("|");
        return key === "|||||" ? null : key;
    }

    return {
        splitCards    : splitCards,
        parseCard     : parseCard,
        hasContent    : hasContent,
        duplicateKey  : duplicateKey,
        photoExtension: photoExtension
    };
}());

if (typeof module !== "undefined") {
    module.exports = VCardParser;
}
