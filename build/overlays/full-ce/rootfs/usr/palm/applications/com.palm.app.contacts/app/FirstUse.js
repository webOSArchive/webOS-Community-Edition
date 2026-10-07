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
/*global enyo, console, $L, window */

enyo.kind({
    name     : "contactsFirstUse",
    kind     : enyo.VFlexBox,
    className: "enyo-bg",

    components: [
        {name        : "firstLaunch", kind: "contactsFirstLaunchAccounts", onAccountsFirstLaunchDone: "openMainAppView", capability: 'CONTACTS',
            iconSmall: "images/header-icon-contacts-48x48.png",
            iconLarge: "images/first-launch-contacts.png"}
    ],

    create: function create() {
        this.inherited(arguments);
    },

    ready: function ready() {
        if (true) {
            // webOS CE: the profile account's contacts are plain on-device contacts
            // (nothing syncs them since HP's servers closed), so offer them as ready to
            // use rather than as an HP account to "get started with". localFileStorage
            // is the accounts library's built-in "use what's on the device" layout;
            // contactsFirstLaunchAccounts fixes up its row below.
            var msgs = {
                    pageTitle       : $L("Your contacts"),
                    welcome         : $L("To get started, add a contacts account"),
                    localFileStorage: $L("Your contacts are ready to use. Contacts you add are kept on this device:")
                },
                exclude;
            this.$.firstLaunch.startFirstLaunch(exclude, msgs);
        }
    },

    destroy: function () {
        this.inherited(arguments);
    },

    openMainAppView: function openMainAppView() {
        window.startTheApp();
    }

});

// webOS CE: the accounts library labels the localFileStorage row with the profile
// account's alias and icon -- the signed-in member's name (or nothing) next to a pair
// of sync arrows. Show what the row stands for instead. Same fix as the Calendar's.
enyo.kind({
    name: "contactsFirstLaunchAccounts",
    kind: "firstLaunchView",

    onAccountsAvailable: function onAccountsAvailable() {
        this.inherited(arguments);
        if (this.profileAccount) {
            this.$.localStorageImage.setSrc("images/header-icon-contacts.png");
            this.$.localStorageName.setContent($L("On This Device"));
        }
    }
});
