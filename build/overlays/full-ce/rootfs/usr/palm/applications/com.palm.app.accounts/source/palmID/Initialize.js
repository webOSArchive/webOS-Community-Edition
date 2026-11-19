// @@@LICENSE
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
// LICENSE@@@

var INITIALIZE_ERRORTEXT = $L("Must be connected to a network to communicate with Cloud Services. Check your network connection, or try again later.")

enyo.kind({
	name: "MyApps.PalmID.Initialize",
	kind: enyo.VFlexBox,
	scrim: true,
	style: "margin: 30px",
	published : {
		initialize: function(parms) {
			this.accountInfoRequested = false;
			this.$.spinner.show();
			this.$.getDeviceInfo.call({});
			
			enyo.keyboard.setResizesWindow(false);
			this.backToViewCallback = function(){
				if (enyo.keyboard.isManualMode()) {
					enyo.keyboard.hide();
					enyo.keyboard.setManualMode(false);
				}

				parms.backToViewCallback();
				};
			this.palmProfileAccount = parms.palmProfileAccount;
		},	
	},
	components: [
		{
			kind: "PalmService",
			name: "getAccountInfo",
			service: "palm://com.palm.accountservices/",
			method: "getAggregatedAccountInfo",
			onSuccess: "gotAccount",
			onFailure: "accountFailure"
		},
		{
			kind: "PalmService",
			name: "getDeviceInfo",
			service: "palm://com.palm.deviceprofile/",
			method: "getDeviceProfile",
			onSuccess: "gotDeviceProfile",
			onFailure: "deviceInfoFailure"
		},
		// Push this device's current name up on every open, so a device renamed in
		// Settings shows its new name here. Read-only on the local name, and the
		// server upserts by nduid, so repeat calls are cheap. Fire-and-forget: the
		// profile must still load if this fails.
		{
			kind: "PalmService",
			name: "syncDeviceName",
			service: "palm://com.palm.accountservices/",
			method: "syncDeviceName",
			onSuccess: "syncDeviceNameDone",
			onFailure: "syncDeviceNameFailure"
		},
		
		
		{flex: 1, content:""},
		{layoutKind: "HFlexLayout",
			components: [
				{flex: 1, content:""},
				{name: "spinner", style: "text-align: center", kind: "enyo.SpinnerLarge"},
				{flex: 1, content:""},
				]
		},
		{flex: 1, content:""},

		{
			name: "errorPopup", 
			kind: "ModalDialog", lazy: false, 
			caption: $L("Error"), 
			scrim: true,
			dismissWithClick: false,
			modal: true,
			components: [
				{name: "serverIssue", className: "enyo-paragraph", content: INITIALIZE_ERRORTEXT},
				{kind:"HFlexBox", components:[
					{kind: "Button", caption: $L("Close"), flex:1, onclick: "back"},
					{kind: "Button", caption: $L("Try Again"), flex:1, onclick: "retry"}
				]},
			],
		},		
	],

	
	create: function()
	{
		this.inherited(arguments);
	},
	
	//rendered: function () {
	//},
	
	
	
	gotDeviceProfile: function(inSender, inResponse) {
		// The pane holds this now; backToViewCallback and palmProfileAccount were
		// already on it, so only the device profile needed rehoming.
		this.owner.deviceProfile = inResponse;
		this.$.spinner.show();
		// Push this device's current name up BEFORE fetching the profile, so the
		// device list we are about to render already reflects a rename done in
		// Settings rather than showing it one visit late. Both outcomes continue
		// to fetchAccountInfo — a stale name is cosmetic, an empty profile is not.
		this.$.syncDeviceName.call({});
	},

	// Both the success and failure paths land here; the sync is best-effort.
	syncDeviceNameDone: function(inSender, inResponse) {
		this.fetchAccountInfo();
	},

	syncDeviceNameFailure: function(inSender, inResponse) {
		console.log("Accounts app: device name sync failed: " + enyo.json.stringify(inResponse));
		this.fetchAccountInfo();
	},

	fetchAccountInfo: function() {
		if (this.accountInfoRequested) {
			return;   // guard: only ever one aggregate fetch per open
		}
		this.accountInfoRequested = true;
		this.$.getAccountInfo.call({locale: enyo.g11n.currentLocale().locale});
	},
	retry: function()
	{
		this.$.errorPopup.close();
		this.$.spinner.show();
		this.$.getAccountInfo.call({});
	},
	
	gotAccount: function(inSender, inResponse)
	{
		this.$.spinner.hide();
		// Straight into the profile. The original re-prompted for the account
		// password here; the device already holds a per-device token that every
		// profile call authenticates with, so a second challenge proves nothing
		// the token has not already established.
		this.owner.loadAccount(inResponse);
	},
	
	
	setErrorMessage: function(inResponse) {
		//var msg = INITIALIZE_ERRORTEXT;						
		console.log("error:" + enyo.json.stringify(inResponse));
		
		var errorText = (inResponse.errorCode) ? PALMIDUTILS_ERROR_CODES[inResponse.errorCode] : undefined;
		if (errorText == undefined) errorText = INITIALIZE_ERRORTEXT;

		this.$.serverIssue.setContent(errorText);
	},

	
	accountFailure: function(inSource, inResponse)
	{
		this.$.spinner.hide();
		this.setErrorMessage(inResponse);
		this.$.errorPopup.openAtCenter();
	},
	deviceInfoFailure: function(inSource, inResponse) {
		this.$.spinner.hide();
		this.setErrorMessage(inResponse);
		this.$.errorPopup.openAtCenter();
	},
	
	back: function(inSource, inResponse) {
		this.$.spinner.show();
		this.$.errorPopup.close();
		this.backToViewCallback();
	}

})
