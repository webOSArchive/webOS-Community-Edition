// LICENSE@@@
//
//      Copyright (c) 2010-2013 LG Electronics, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// @@@LICENSE

/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true,
 regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global enyo, console, $L */

/* This file includes functions that should be included in the framework */

if (enyo.application.localeOverride) {
    $L._resources = new enyo.g11n.Resources({locale: enyo.application.localeOverride});
}

enyo.require = function (assertion, message) {
    if (!assertion) {
        enyo.error(message);
        throw message;
    }
};

enyo.assert = function (assertion, message) {
    if (!assertion) {
        enyo.error(message);
    }
};

/* webOS Synergy Revival: search Contacts by IM service (Telegram, WhatsApp, Facebook, ...).
 *
 * The person search index (com.palm.person:1, index "favorite_searchProperty*_sortKey") is patched
 * to also tokenize ims.type. Those values are opaque service tokens - "type_telegram",
 * "type_whatsapp", "type_facebook", ... - and db8's tokenizer keeps the "type_" prefix as a single
 * token, so a bare "telegram" typed into the search box never matches it (verified on device). When
 * the user types a known service name, rewrite the search term to the stored ims.type token so the
 * existing full-text query returns every contact on that service. Matching is on the whole typed
 * word, so ordinary name searches are unaffected until the complete service name is entered.
 *
 * The search term is applied in PersonList.setSearchString, a framework kind from the contactsui
 * library. NOTE: this file (app/patches.js) loads BEFORE contactsui in depends.js, so PersonList
 * does not exist yet and enyo.constructorForKind would throw. Instead we wrap enyo.kind and patch
 * PersonList's prototype the moment the library defines it, then restore enyo.kind. */
(function () {
    var SERVICE_TERMS = {
        telegram: "type_telegram",
        whatsapp: "type_whatsapp",
        facebook: "type_facebook",
        signal:   "type_signal",
        discord:  "type_discord",
        teams:    "type_teams",
        xmpp:     "type_xmpp",
        jabber:   "type_jabber",
        aim:      "type_aim",
        irc:      "type_irc"
    };

    function patchPersonListProto(proto) {
        if (!proto || proto.hasOwnProperty("__svcSearchPatched")) { return; }
        var original = proto.setSearchString;
        if (typeof original !== "function") { return; }
        proto.setSearchString = function (searchString, dontResetGalStates) {
            var term;
            if (searchString) {
                term = SERVICE_TERMS[("" + searchString).toLowerCase()];
                if (term) { searchString = term; }
            }
            return original.call(this, searchString, dontResetGalStates);
        };
        proto.__svcSearchPatched = true;
    }

    // Defensive: if PersonList is somehow already defined, patch it directly.
    if (typeof window !== "undefined" && window.PersonList && window.PersonList.prototype) {
        patchPersonListProto(window.PersonList.prototype);
        return;
    }

    if (!enyo || typeof enyo.kind !== "function") { return; }

    // Wrap enyo.kind to catch PersonList's definition (contactsui loads after this file).
    var originalKind = enyo.kind;
    enyo.kind = function (inProps) {
        var name = inProps && inProps.name;    // captured before enyo.kind deletes inProps.name
        var ctor = originalKind.apply(this, arguments);
        if (name === "PersonList" && ctor && ctor.prototype) {
            patchPersonListProto(ctor.prototype);
            enyo.kind = originalKind;           // done intercepting; restore the original
        }
        return ctor;
    };
    // Preserve enyo.kind's static members (makeCtor, features, inherited, statics, defaultNamespace).
    var key;
    for (key in originalKind) {
        if (originalKind.hasOwnProperty(key)) { enyo.kind[key] = originalKind[key]; }
    }
}());
