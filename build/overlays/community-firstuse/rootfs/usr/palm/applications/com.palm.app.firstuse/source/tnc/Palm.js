label_dialog_palmTnc = rb.$L("Terms of Service");
label_popup_palm_header = rb.$L("Do you accept?");
label_popup_palm_body = rb.$L("To set up a webOS Account, you must accept the Terms. Or tap Skip Account Setup to finish without an account.");

label_button_accept = rb.$L("Accept");
label_button_decline = rb.$L("Decline");
label_button_continue = rb.$L("Continue");
// webOS Archive: account setup must stay optional under OOBE too — there is no
// separate "skip" chrome there like a standalone launch gets from the card/window
// system, so the card itself needs an explicit way out.
label_button_skip = rb.$L("Skip Account Setup");

// webOS Archive: this popup doubles as the HTTPS-readiness gate. The account flow
// requires the community update's modern TLS (the service reaches our origin via
// the OTA's /usr/bin/curl); without it, the very first secure fetch (terms) fails.
label_popup_palm_error_header = rb.$L("Connection Problem");
label_popup_palm_error_body = rb.$L("Your TouchPad couldn't reach the webOS Account server. Check your Wi-Fi and try again, or skip account setup and finish setting up your TouchPad without an account.");
label_popup_palm_error_button = rb.$L("Try Again");


enyo.kind({
	name: "Palm",
	kind: enyo.VFlexBox,
	align:"center",
	pack:"justify",
	className: "terms",
	events: {onFinish: ""},
	components: [
		{
			kind: "WiFiService",
			onFailure: "handleWiFiResetDone",
			onSuccess: "handleWiFiResetDone",
			components: [{
				name: "getStatus",
				method: "getstatus",
				onSuccess: "handleWiFiGetStatus",
				onFailure: "handleWiFiResetDone"
			}, {
				name: "deleteProfile",
				method: "deleteprofile",
				onSuccess: "handleWiFiResetDone",
				onFailure: "handleWiFiResetDone"
			}, ]
		},
	
		{name:"PalmTCs", kind: enyo.VFlexBox,	className: 'section', height:"100%", components: [
			{kind: enyo.Control, name: "PalmTCs.title", className: 'title', content: label_dialog_palmTnc},
				{name: "palmScroller", kind: "Scroller", className: 'box', flex: 1, components: [
					{name: "palm", allowHtml: true, kind: "HtmlContent"}
				]},
			{kind: enyo.Control, layoutKind: "HFlexLayout", align: 'start', pack: 'justify', components: [
				{kind: enyo.Control, layoutKind: "HFlexLayout", align:'center', components: [
					{name: "palmCheckBox", kind: enyo.CheckBox, checked: false},
						{content: rb.$L("I accept the terms and conditions"), style:"margin:0 0 0 10px"}
					]},
				{name: "continueBtn", kind: enyo.Button, className: "enyo-button-affirmative", onclick: "continueButton", caption: label_button_continue, disabled: true}
			]},
			{kind: "Control", className: "link-button skip-setup", content: label_button_skip, onclick: "skipSetup"}
		]},
				
		{kind: "Scrim", layoutKind: "VFlexLayout", align: "center", pack: "center", components: [
			{kind: "SpinnerLarge", name: 'spinner', showing: false}
		]},
	
		{name: "palmPopup", kind: "ModalDialog", lazy: false,
		 className: "popup",
		 caption: label_popup_palm_header,
		 components: [
			{content: label_popup_palm_body, className: 'enyo-text-body'}, 
			{kind: "Button", className: "enyo-button-affirmative", caption: label_button_accept, style:"margin-bottom:10px", onclick: "palmAccepted"},
			{kind: "Button", className: "enyo-button-negative", caption: label_button_decline, onclick: "palmDeclined"},
		]},
	
		{name: "palmErrorPopup", kind: "ModalDialog", lazy: false,
		 className: "popup",
  	     caption: label_popup_palm_error_header,
		 components: [
			{content: label_popup_palm_error_body, className: "enyo-text-body", ondblclick:"label_popup_palm_error_DoubleClk"}, 
			{name: "popup_palm_error_body_error_code", content: "", className: "errorcode3"}, 
			{kind: "Button", caption: label_popup_palm_error_button, onclick: "palmError", style: "margin-bottom:10px"},
			// webOS CE: this popup is modal and covers the card's own skip link, so
			// with the server unreachable "Try Again" was the only way out of it.
			{kind: "Button", caption: label_button_skip, onclick: "palmErrorSkip"},
		]},
		{kind: "AccountServicesService", onFailure: "handleGenericFailure", onSuccess: "handleGenericSuccess", components:[
			{name: "getServerURL", method: "getURLForTerms", onSuccess: "getTerms", onFailure: "getServerURLFailure"},
			{name:"getTermsAndConditions", method:"getTermsAndConditions", onResponse:"getTermsAndConditionsResponse"},
		]},
		{kind: "StartOver"}
	],
	
	initialCallMade: false,
	
	
	create: function(){
        this.inherited(arguments);
	   	this.getTermsResponseCalled = false;
		this.retryCount = 0;
		
		//HACK: becuse the embedded html can't scroll itself directly and I don't want enyo code in it. 
		//This is a case where i'd really like some jquery like funtionality to bind all DOM objects with a sepcial class
		//to some code with one line of code. Currently the external HTML like this:
		//    <a class="table-of-contents" onclick="if(window.scrollPalmTermsToName) {scrollPalmTermsToName('requirements')}" href="#requirements">2.  Requirements<br><br></a>
		window.scrollPalmTermsToName = enyo.bind(this, function(name){
			var obj = document.getElementsByName(name)[0];
			this.$.palmScroller.scrollIntoView(obj.offsetTop, 0);
		});
		
		this.startDownload();
    },
	

	startDownload: function() {
		if(enyo.application.FirstUse.getDataConnectionInitialized()) {
			this.getURL();
		} else {
			window.setTimeout(enyo.bind(this, function () {
				this.startDownload()}
			, 1000)); // poll until the network is setup.
		}
	},
    
    dataRestored: function(){
		if(!this.initialCallMade) return;
		
    	console.info("Data restored called by Parent...");
    	if (!this.getTermsResponseCalled) {
			// 4/19/2011 - russ - We are seeing this being call multiple times (DFISH-9980)!
			// What is happening is that if we are successfull, but the connect drops and restarts 
			// the dataRestored gets called which starts the process off!
			
			this.getURL();
		} else {
    		console.info("Already did the deed...1");
		}
    },
    
    getURL: function(){
		this.initialCallMade = true;
		if (this.termsAreSet) {
    		console.info("Already did the deed...2");
		} else {
	  	    this.getTermsResponseCalled = false;

	   	    this.$.scrim.show();
	    	this.$.spinner.setShowing(true);
	    	// webOS Archive: skip the dead LCN location-server lookup
	    	// (getURLForTerms retries forever against lcn.palmws.com) and
	    	// fetch the terms straight from our backend.
	    	console.info("WOSA: skipping getURLForTerms — fetching terms from catalog backend.");
	    	this.getTerms();
		}
    },
    
    getServerURLFailure: function(inSender, inResponse){
    	console.info("Error getting server URL: " + JSON.stringify(inResponse));
		
		this.retryCount ++;
		if (this.retryCount > 2) {
			if (!this.poppedError) {
				this.poppedError = true;
				this.getTermsResponseCalled = true; // this means just stop retrying once we show the dialog!
				enyo.application.FirstUse.closeAllPopups(); // if I don't do this can get into case where the UI locks up because of a bug.
				this.$.scrim.hide();
				this.$.spinner.setShowing(false);
				this.$.popup_palm_error_body_error_code.hide();
				this.$.popup_palm_error_body_error_code.setContent("");
				try {
					this.$.popup_palm_error_body_error_code.setContent(inResponse.errorCode + " : " + inResponse.errorText); //this does not get localized..it is hidden in the UI for support.
				} 
				catch (e) {
				}
				this.$.palmErrorPopup.openAtCenter();
			}
		}
		
		if(enyo.application.FirstUse.getDataConnection()){
			//if we fail with a good connection which can happen we need to force the retry here.	
			//otherwise we will retry. Even if the popup is showing we continue to retry!
			setTimeout(enyo.bind(this, function() {
				this.getURL();
			}), 250)
		}
    },
    
	getTerms: function(inSender, inResponse){
		// webOS Archive: terms come from our catalog backend — same base the
		// patched palmprofile service uses. HTTPS: the service routes this POST
		// through the OTA's modern /usr/bin/curl (see PalmProfileUtil.curlPost).
		var url = "https://appcatalog.webosarchive.org/WebService/device.php?m=";
    	enyo.application.FirstUse.setServerURL(url);
		var lang = enyo.g11n.currentLocale().getLanguage();
		console.info("Getting terms from: " + url);
		this.$.getTermsAndConditions.call({"language": lang, "serverURL":url});
		// webOS CE: the service's curl gives up after 30 s, but a wedged
		// accountservices never answers at all, leaving the spinner up for good.
		// Treat 45 s of silence as a failure; a late answer is still accepted.
		if (this.wosaTermsTimer) { clearTimeout(this.wosaTermsTimer); }
		this.wosaTermsTimer = setTimeout(enyo.bind(this, function(){
			this.wosaTermsTimer = null;
			if (this.termsAreSet) { return; }
			console.info("WOSA: terms request timed out");
			this.getTermsAndConditionsResponse(this, {returnValue: false, errorCode: -1, errorText: "timeout"});
		}), 45000);
	},
	
    getTermsAndConditionsResponse: function(inSender, inResponse){
		console.info("Get terms response: " + inResponse.returnValue);
		this.getTermsResponseCalled = true;
		if (inSender !== this && this.wosaTermsTimer) { clearTimeout(this.wosaTermsTimer); this.wosaTermsTimer = null; }

		if(inResponse.returnValue) {
			this.$.palmErrorPopup.close();

			this.$.palm.setContent(inResponse.GetTermsAndConditions.PALM);
			enyo.application.FirstUse.setGoogleTerms(inResponse.GetTermsAndConditions.GOOGLE);
			this.termsAreSet = true;
			// webOS Archive: secure fetch succeeded -> device is https-ready; allow proceeding.
			this.$.continueBtn.setDisabled(false);
		}
		else {
			// webOS Archive: the first secure fetch failed -> not https-ready (or offline).
			// Keep Continue disabled so the flow cannot proceed, and show the update gate.
			this.termsAreSet = false;
			this.$.continueBtn.setDisabled(true);
			enyo.application.FirstUse.closeAllPopups(); // if I don't do this can get into case where the UI locks up because of a bug.
			this.$.popup_palm_error_body_error_code.hide(false);
			try {this.$.popup_palm_error_body_error_code.setContent(inResponse.errorCode + " : " + inResponse.errorText);} catch (e) {}
			this.$.palmErrorPopup.openAtCenter();
		}
		this.$.scrim.hide();
		this.$.spinner.setShowing(false);

	},

	continueButton: function(){
		// webOS Archive: hard gate — never proceed unless the secure terms fetch worked.
		if (!this.termsAreSet) {
			this.$.palmErrorPopup.openAtCenter();
			return;
		}
		if (this.$.palmCheckBox.getChecked()) {
			this.doFinish();
		} else {
			this.$.palmPopup.openAtCenter();
		}
    },
    
    palmAccepted: function(){
		this.$.palmCheckBox.setChecked(true);
		this.$.palmPopup.close();
		this.doFinish();
	},
	
	palmDeclined: function(){
		this.$.palmPopup.close();
	},

	// webOS Archive: account setup is optional, both standalone and under OOBE.
	// Reuses the same safe-close path as a completed setup — no erase, no reset,
	// no shutdown — so this behaves identically to skipping OOBE steps that have
	// their own skip button.
	skipSetup: function(){
		enyo.application.FirstUse.wosaSkipSetup();
	},

	palmErrorSkip: function(){
		this.$.palmErrorPopup.close();
		this.skipSetup();
	},

	destroy: function(){
		if (this.wosaTermsTimer) { clearTimeout(this.wosaTermsTimer); this.wosaTermsTimer = null; }
		this.inherited(arguments);
	},

	palmError: function(){
		this.$.palmErrorPopup.close();
		this.$.palmPopup.close();
		enyo.application.FirstUse.currentServiceCall = "";
		// webOS Archive: stock deleted the saved Wi-Fi profile and restarted the
		// whole flow here — on an already-set-up device that's destructive.
		// Just retry the terms fetch.
		this.poppedError = false;
		this.getTermsResponseCalled = false;
		this.$.scrim.show();
		this.$.spinner.setShowing(true);
		this.getTerms();
	},
	
	handleWiFiGetStatus:  function(inSource, inResponse) {
		if (inResponse.returnValue && inResponse.networkInfo && inResponse.networkInfo.profileId) {
			console.log("getWifiProfile: " + inResponse.networkInfo.profileId);
			this.$.deleteProfile.call({profileId: inResponse.networkInfo.profileId});
		} else {
			this.handleWiFiResetDone();	
		}
	}, 
	
	handleWiFiResetDone: function() {
		console.log("restart firstuse...");
        enyo.application.FirstUse.startAllOver();
	},
	
	label_popup_palm_error_DoubleClk: function() {
			this.$.popup_palm_error_body_error_code.show();
	}

});