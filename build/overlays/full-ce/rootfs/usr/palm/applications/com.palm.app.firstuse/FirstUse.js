function gup( name )
{
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp( regexS );
  var results = regex.exec( window.location.href );
  if( results == null )
    return null;
  else
    return results[1];
}

var inLocale = gup("locale");
var inCountry = gup("country");
var g11nLocale;

if (typeof(inLocale) === 'undefined'){
	rb = new enyo.g11n.Resources();
} else {
	rb = new enyo.g11n.Resources({locale: inLocale});
	enyo.g11n.setLocale({
		uiLocale: inLocale, 
		formatLocale: inCountry, 
		phoneLocale: inCountry
	});
}

enyo.kind({
	name: "FirstUse",
	published: {
		keyState: [],
		valueState: [],
		locale: "",
		languageCode: "",
		serverURL: "",
		googleTerms: "",
		// webOS CE OOBE: stock values — run the real Wi-Fi join popup.
		dataConnection: false,
		dataConnectionType: "",
		dataConnectionInitialized: false,
		first: true,
		createProfile: false,
		firstName: "",
		acctToken: "",
		acctAlias: "",
		deviceId:"",
		nduId:"",
		powerDownMethod: "",
		chargerConnected: false,
		machineName: "",
		currentServiceCall: "",
		
		checkForUpdatesResponsePayload: {},
		isOTAAvailable: false,
        otaSkipped: false,
		
		isBackupAvailable: false,
		isBackupAvailableFailed: false,
		noOfOtherDevices: 0,
		restoreDevicesResponsePayload: {},
		softwareUpdateAvailable: false,
		forceSwUpdate: false
		
	},
	
	sameHardware: undefined,
	userSkippedRestore: undefined,
	okToStartNetworking: false,
	
	kind: "VFlexBox", components: [
		{name: "pane", kind: "Pane", flex:1, transitionKind: "enyo.transitions.Fade", components: [
	        {name: "complete", showing: false, kind: "VFlexBox", align: 'center',lazy: false, components: [
				{kind: "VFlexBox", align: "center", components: [
					{kind: "Control", layoutKind: "VFlexLayout", align:'center', className:"contentDefaults", pack: 'justify', components: [
						{name: "completeSetup", content: rb.$L("Thanks!"), className: "title"},
						{name: "completeSubtitle", content: rb.$L("Your webOS Account is ready to use."), className: "subtitle"},
						// webOS Archive: this card is reached both at the end of sign-in and on
						// a relaunch that finds an account already set up, so it points at the
						// place that can actually do something with the account either way.
						// webOS CE OOBE: completion marks first-use done and shows a
						// "finishing" state; the ce-finish-firstuse job reboots once
						// app-install is done (firstuse must NOT reboot — it kills the
						// concurrent staged-app install).
						{name: "wosaManageHint", content: rb.$L("Tap Done to finish setting up your TouchPad."), className: "subtitle", style: "margin-top: 12px;"},
						{kind: "SpinnerLarge", name: "spinner", showing: false},
						{name: "completeDone", kind: "Button", caption: rb.$L("Done"), className: "enyo-button", style: "width: 220px; margin-top: 24px;", onclick: "completeDoneTap"},
					]}
				]}
			]}
        ]},

		{kind: "MyApps.FirstUse.SpinnerOverlayPopup", name: "spinnerOverlay"},

		// webOS Archive: closing this app under OOBE (via Skip or the Done button)
		// is what triggers the device reboot that finishes setup. No buttons — it's
		// just shown for a moment before wosaSafeClose closes the app out from
		// under it.
		{name: "wosaSkipRestartPopup", kind: "ModalDialog", lazy: false, scrim: true, className: "popup",
		 caption: rb.$L("Just a Moment"),
		 components: [
			{content: rb.$L("Your device may need to restart to complete setup."), className: "enyo-text-body"},
		]},

		// webOS CE OOBE: no Museum self-updater — this in-ROM copy is updated by
		// the CE OTA, and Preware does not exist during first use.
		
		{name: "SimStatusQuery", kind: "TelephonyService", method: "simStatusQuery",subscribe: true, onSuccess: "handleSimStatusQuery"},
		{name: "PlatformQuery", kind: "TelephonyService", method: "platformQuery",subscribe: false, onSuccess: "handlePlatformQuery", onFailure: "handlePlatformQueryFail"},

        {kind: "MyApps.FirstUse.SimCheck", name: "MyCheckSim", show: false, onSimCheckSuccess: "onSimCheckSuccess", onSimCheckFailure: "onSimCheckFailure", onStartOver: "onSimCheckStartOver"},
		{name: "SimCheck_SimLock", kind: "ModalDialog", lazy: true, scrim:true, className: "popup",
		 caption: rb.$L("PIN is Incorrect"),
		 components: [
		 	{content: rb.$L("You have entered the PIN incorrectly twice. To avoid locking your SIM, you should use Wi-Fi now."), className: "enyo-text-body"}, 
			{kind: "Button", caption: rb.$L("OK"), className: 'enyo-button', flex: 1, onclick: "simLockWarningConfirm"},
		]
		},
		{name: "SimCheck_SimLock2", kind: "ModalDialog", lazy: false, scrim:true, className: "popup",
		 caption: rb.$L("PUK Locked"), 
		 components: [
		 	{name: "PUKLockContent", content: "", className: "enyo-text-body"}, 
			{kind: "Button", caption: rb.$L("Use Wi-Fi"), className: 'enyo-button', flex: 1, onclick: "simLockWarningConfirm2"},
		]
		},
		{name: "SimCheck_SimLock3", kind: "ModalDialog", lazy: false, scrim:true, className: "popup", // keep lazy false!
		 caption: rb.$L("MEP Locked"),
		 components: [
		 	{name: "MepLockContent", content: "", className: "enyo-text-body"}, 
			{kind: "Button", caption: rb.$L("Use Wi-Fi"), className: 'enyo-button', flex: 1, onclick: "simLockWarningConfirm3"},
		]
		},

		{name: "wifiPopup", kind: "MyApps.FirstUse.WiFiPopup", lazy: false, onCancel: "wifiCancel", className: "popup", onLabel: rb.$L("On"), offLabel: rb.$L("Off")},
    	{name: "captivePortalPopup", kind: "ModalDialog", lazy: true, onBeforeOpen: "initCaptivePortalPopup", onCancel: "captivePortalCancel", className: "popup", width: "100%", height:"100%",
			components: [
				{
					 name : "capPortalCtrl",
					 kind : "CaptivePortalControl",
					 captivePortalNwInterface : "eth0",
					 onNetworkStatusChanged : "onCaptivePortalNetworkStatusChanged",
					 onChooseNewNetwork : "onCaptivePortalChooseNewNetwork",
					 captivePortalSuppressPopups:true,
					 captivePortalShowChooseNetworkButton:true
				}
			]
		},
		{name: "wifiPopupCancelDialog", kind: "ModalDialog", lazy: true, scrim:true, className: "popup",
		 caption: rb.$L("Setup Options"),
		 components: [
		 	// webOS CE: a network is only needed for a webOS Account. Without one (no
		 	// Wi-Fi in range, no internet, or our server down) setup must still be
		 	// able to finish, so this dialog offers the same way out as the cards.
		 	{content: rb.$L("You need a network to set up a webOS Account. You can also finish setting up your TouchPad without one."), className: "enyo-text-body"}, 
			{kind: "Button", caption: rb.$L("Find Network"), className: 'enyo-button-affirmative', flex: 1, onclick: "wifiPopupCancelDialogFindNetwork", style: "margin-bottom:10px"},
			{kind: "Button", caption: rb.$L("Skip Account Setup"), className: 'enyo-button', flex: 1, onclick: "wifiPopupCancelDialogSkip", style: "margin-bottom:10px"},
			{kind: "Button", caption: rb.$L("Start Over"), className: 'enyo-button', flex: 1, onclick: "wifiPopupCancelDialogStartOver"},
		]
		},
		{name: "StartOverFU", kind: "StartOver", showing: false},

		{name: "appMenu", kind: "AppMenu", lazy: false, components: [
				{name: "deviceIdMenu", caption: rb.$L("Device Info"), onclick: "openDeviceId"}, 
				{name: "diagnostics", caption: rb.$L("Diagnostics"), onclick: "runDiagnostics"}, 
				{caption: rb.$L("Collect logs"), onclick: "collectLogs"}
		]},
		
		{name: "DeviceInfoDialog", kind: "MyApps.FirstUse.DeviceInfoDialog"},


		{name: "powerPopup", kind: "Power", onFinish: "closePowerpopup", onPowerOff: "powerDownNow"},
		{name: "collectLogPopup", kind: "ModalDialog", lazy: false, 
		 className: "popup",
		 caption: rb.$L("Collect Logs"),
		 components: [
			{name: "collectLogMessage", allowHtml: true, content: "", className: "enyo-text-body"},
			]
		}, 
		
        { name: "launchApplicationService",
          kind: "PalmService",
          service: enyo.palmServices.application,
          method: "open",
          onSuccess: "launchAppSuccess",
          onFailure: "launchAppFailure"
        },		
		{kind: "ConManService", onFailure: "handleGenericFailure", onSuccess: "handleGenericSuccess", 
			components: [
				{name: "getConnectionStatus", method: "getstatus", subscribe: true, resubscribe: true, onSuccess: "conManCallback", onFailure: "connFailure"},	
			]
		},
		{kind: "DisplayService", onFailure: "handleGenericFailure", onSuccess: "handleGenericSuccess", 
			components: [
				{name: "requestBlock", method: "setProperty", params: {"requestBlock": true, "client":"com.palm.app.firstuse"}, subscribe: true, onFailure: "dispSetPropertyFailure", onSuccess: "dispCallback"}
			]
		},
		
		{kind: "BusService", onFailure: "handleGenericFailure", onSuccess: "handleGenericSuccess", 
			components: [
				{name: "monitorPluggedInStatus", method: "addmatch", subscribe: true, onResponse: "pluggedInStatusChanged"},
				{name: "powerKeyPress", method: "addmatch", subscribe: true, onResponse: "powerKeyPressOnResponse"}
			]
		},
		{kind: "PalmService", 
			name: "monitorPluggedInit", 
			method: "chargerStatusQuery", 
			service: "palm://com.palm.power/com/palm/power/",
			onResponse: "pluggedInStatusInit"
		},
		{kind: "PowerService", onResponse: "handlePowerServiceResponse",
			components: [
				{name: "powerDown", method: "machineOff", onResponse: "powerDownResponse"}
			]
		},
		{kind: "CollectLogService", onResponse: "handleCollectLogsServiceResponse", 
			components: [
				{name: "collectLogs", method: "collectall", onResponse: "collectLogsResponse"}
			]
		},
		{kind: "AccountServicesService", onFailure: "handleGenericFailure",
			components:[
			
			    {name: "postLoginSettings", method: "postLoginSettings", onResponse:"postLoginSettingsResponse"},
			    {name: "setTimeZoneFromIP", method: "setTimeZoneFromIP", onResponse:"postTimeZoneResponse"},
			    {name: "assignDeviceName", method: "assignDeviceName", onSuccess: "assignDeviceNameSuccess", onFailure: "assignDeviceNameFailure"},
			    {name: "getToken", method: "getAccountToken", onResponse: "getTokenResponse"},
			    // webOS Archive: launch-time "is there already an account?" probe. Separate
			    // from getToken above, whose handler drives the completion page.
			    {name: "wosaExistingAccount", method: "getAccountToken", onResponse: "wosaExistingAccountResponse"},
			]	
		},
		
		{name: "wosaLaunchApp", kind: "PalmService", service: "palm://com.palm.applicationManager/", method: "launch"},

		{kind: "DeviceProfileService", onFailure: "handleGenericFailure", onSuccess: "handleGenericSuccess",
			components:[
				{name: "getDevice", method: "getDeviceProfile", onResponse: "getDeviceResponse"},
			]	
		},
		
		{kind: "SystemPropertiesService", onFailure: "handleGenericFailure", onSuccess: "handleGenericSuccess",
			components:[
				{name: "getMachineName", method: "Get", onResponse: "getMachineNameResponse"},
			]	
		},
		
		{
	        kind: "PalmService",
	        name: "getRestoreWasInProgress",
	        service: "palm://com.palm.accountservices/",
	        method: "getLocalProfileProperties",
	        onSuccess: "getRestoreInProgressSuccess",
	        onFailure: "getRestoreInProgressFailure"
    	},
    	
    	{
    	    kind: "PalmService",
    	    name: "eraseVar",
    	    service: "palm://com.palm.storage/erase/",
    	    method: "EraseVar",
    	    onSuccess: "handleGenericSuccess",
    	    onFailure: "handleGenericFailur"
    	},		
		{
	        kind: "PalmService",
	        name: "setPalmProfile",
	        service: "palm://com.palm.accountservices/",
	        method: "setLocalProfileProperties",
	        onSuccess: "updateProfileSuccess",
	        onFailure: "updateProfileFailure"
	    },
	    
	    {
	      kind: "WiFiService",
	      components: [{
	        name: "deleteWiFiProfile",
	        method: "getstatus",
	        onSuccess: "handleDeleteWiFiProfile",
	        onFailure: "handleDeleteWiFiProfile"
	      }, {
	        name: "deleteProfile",
	        method: "deleteprofile",
			onSuccess: "finishDeleteWiFiProfile",
			onSuccess: "finishDeleteWiFiProfile"
	      }]
	    },
	      
        {kind: "UpdateService",
            components:[
                {name: "installUpdate", method: "InstallNow", onResponse: "handleInstallUpdate"}
            ]   
        },
        {
        	kind: "BackupService",
        	name: "removeRestoreFailedFile", 
        	onResponse: "removeRestoreFailedFileResponse"
        },
		
		{kind: "CustomizationService",
			components:[
				{name:"setCustomization", method: "populateDefaults", onResponse:"postCustomizationResponse"}
			]	
		},

		{
	        kind: "PalmService",
	        name: "registerForSMS",
	        service: "palm://com.palm.messagingrouter/sms/",
	        method: "registerFirstUse",
	        onSuccess: "updateSMSRegisterSuccess",
	        onFailure: "updateSMSRegisterFailure"
	    },
		
		{kind: enyo.ApplicationEvents, onApplicationRelaunch: "relaunchHandler"},
		
		{kind: "DbService", components: [
			{dbKind: "com.palm.carrierdb.settings.current:1", components: [
				{name: "carrierFinder", method: "find", onFailure: "gotCarriersFailure", onSuccess: "gotCarriersSucess", subscribe: true, resubscribe: true, reCallWatches: true}
			]}
		]},
	],
	
	step: -1,
	checkTheSimStatus: true,
	
	create: function() {
	    
		this.wosaStarted = false;
		this.wosaStartTimer = null;
		this.assignDeviceNameRetry = false;
		this.pluggedInStatusChangedInited = false;
		// webOS CE: which launch is this? PalmSystem.isMinimal is true only while
		// LunaSysMgr is running this app AS first use (-u minimal -a
		// com.palm.app.firstuse). It is the only honest signal available: the
		// locale/country URL params read below are set by the language card's own
		// redirect (source/language/Language.js), so they show up in BOTH flows and
		// cannot tell them apart. A LunaSysMgr without the property is treated as
		// OOBE, because skipping first use is far worse than replaying it.
		this.wosaIsOobe = true;
		try {
			if (window.PalmSystem && typeof(PalmSystem.isMinimal) === "boolean") {
				this.wosaIsOobe = PalmSystem.isMinimal;
			}
		} catch (e) { console.info("WOSA: isMinimal probe failed: " + e); }
		console.info("WOSA: launch mode = " + (this.wosaIsOobe ? "OOBE" : "standalone"));
		this.log(typeof(inLocale));
		if (typeof(inLocale) === "string" || !this.wosaIsOobe){
			// Start past the language card. Under OOBE it has already run — it is
			// what put locale on the URL. On a launcher launch it must never run at
			// all: its constructor deletes the device's palm profile, and the
			// language it would ask for was already chosen during setup.
			this.step = 0;
		}
		if (typeof(inLocale) === "string"){
			this.languageCode = rb.locale.getLanguage();
			this.locale = rb.locale.getLocale();
		}
		if (typeof(inCountry) === "string") {
			this.countryCode = inCountry;
		}
		
		this.inherited(arguments);
		
		if (enyo.application.FirstUse === undefined)
		{
			enyo.application.FirstUse = this;
		}
		// webOS Archive: once an account exists this app has nothing left to offer —
		// walking the user back through terms + sign-in is just confusing. Probe for
		// an account first and hand off to the Accounts app if there is one.
		this.wosaCheckForExistingAccount();
	},

	// Decide whether to run the setup flow at all. Launch with {"forceSignIn":true}
	// to skip the check — that is how you sign in as a DIFFERENT account, since the
	// sign-in flow is the only thing that can replace the device's account.
	wosaCheckForExistingAccount: function() {
		var params = null;
		try {
			params = (window.PalmSystem && PalmSystem.launchParams)
				? enyo.json.parse(PalmSystem.launchParams) : null;
		} catch (e) {
			console.info("WOSA: launchParams parse error: " + e);
		}
		if (params && params.forceSignIn) {
			console.info("WOSA: forceSignIn — running setup even though an account may exist.");
			this.wosaStartSetup();
			return;
		}
		// Never leave the app showing nothing: if the probe does not answer, run
		// setup anyway. getAccountToken is a local db8 read, so this should not fire.
		this.wosaStartTimer = setTimeout(enyo.bind(this, "wosaStartSetup"), 4000);
		this.$.wosaExistingAccount.call({});
	},

	wosaExistingAccountResponse: function(inSender, inResponse) {
		if (inResponse && inResponse.returnValue && inResponse.token) {
			console.info("WOSA: account already set up — showing the signed-in card.");
			this.wosaStarted = true;   // suppress the timer fallback
			this.wosaShowAlreadySignedIn(inResponse);
			return;
		}
		console.info("WOSA: no account yet — running setup.");
		this.wosaStartSetup();
	},

	// Land on the completion card rather than running the setup flow: there is
	// nothing to set up, and walking the user through terms + sign-in again is the
	// whole problem. Deliberately does NOT call start(), which would kick off the
	// scene machinery and select the terms card out from under this one.
	//
	// Same card, same copy as the end of sign-in — the only difference is how you
	// got here, which is not something the user needs told twice.
	wosaShowAlreadySignedIn: function(inResponse) {
		// Seed what updateCompletePage() reads, so the card can name the account on
		// this path too; after sign-in these are already set.
		this.setAcctAlias(inResponse.accountAlias);
		this.setAcctToken(inResponse.token);
		this.updateCompletePage();

		// selectViewByName alone is not enough: the card is declared showing:false,
		// so it also has to be shown explicitly. Both of the paths that already
		// reach this card (completeFirstUse, performSoftwareUpdate) do exactly
		// this pair — without the show() you get the background and nothing else.
		this.$.pane.selectViewByName("complete");
		this.$.complete.show();

		// The update check lives in start(), which we just skipped — run it here so
		// this app can still find its own updates from the path most people hit.
		this.wosaCheckForUpdates();
	},

	wosaLaunchAccountsTap: function() {
		this.$.wosaLaunchApp.call({id: "com.palm.app.accounts"});
		this.closeApp();
	},

	// Runs at most once, from whichever of the two paths gets here first.
	wosaStartSetup: function() {
		if (this.wosaStarted) { return; }
		this.wosaStarted = true;
		if (this.wosaStartTimer) { clearTimeout(this.wosaStartTimer); this.wosaStartTimer = null; }

		this.start();
		this.wosaCheckForUpdates();
	},

	// webOS Archive: check the App Museum for a newer build of this app.
	// webOS CE OOBE: no-op (this ROM copy is updated by the CE OTA).
	wosaCheckForUpdates: function() {
	},
	
	start: function() {
	    
		enyo.keyboard.setResizesWindow(false);
		
		// webOS CE: OOBE owns the whole screen, so it hosts its own power-key
		// dialog (whose "Turn Off" calls machineOff). Standalone this is just a
		// launcher app: LunaSysMgr already owns the power button, and a second
		// power-off dialog appearing over an app card is both confusing and a
		// way to switch the device off from a screen that has no business doing
		// it. Only arm it under OOBE.
		if (this.wosaIsOobe) {
			console.info("Registering to power key press...");
			this.$.powerKeyPress.call({"category":"/com/palm/display","method":"powerKeyPressed"});
		}
		console.info("Registering to plugged in status changes...");
		this.$.monitorPluggedInStatus.call({"category":"/com/palm/power","method":"USBDockStatus"});
		console.info("Setting timeout to powerdown, 1 minute...");
		this.powerDownMethod = setTimeout(enyo.bind(this,"powerDownDevice"), 1000*60*5);//5 minute countdown
		
		if (this.step !=-1) { //need to have a better test, but this AFTER the language screen.
			this.$.PlatformQuery.call({});
		}
		
		// webOS CE: blocking dimming is right for OOBE (the setup screen must not
		// sleep mid-flow) and wrong for a launcher app — left open in a bag it
		// holds the screen awake and flattens the battery.
		if (this.wosaIsOobe) {
			console.info("Requesting blocking of display dimming...");
			this.$.requestBlock.call();
		}
		
		this.$.getMachineName.call({"key":"com.palm.properties.deviceName"});
		
		this.$.carrierFinder.call();

		//this should be last.
		this.$.getRestoreWasInProgress.call();
	},
	
	closeAllPopups: function() {
	    console.info("Close All Popups ... ");
		try {
			this.$.powerPopup.close();
			this.$.wifiPopup.close();
			this.$.MyCheckSim.close();
			this.$.captivePortalPopup.close();
			this.SMSDialogCloseAll();
		} catch (e) {
		}
	},
	
	startAllOver: function() {
	    this.closeAllPopups();
		window.location.href = "index.html";
	},
	
	handlePlatformQueryFail: function(inSender, inResponse, inRequest) {
		console.info("handlePlatformQueryFail");
		this.handlePlatformQuery(inSender, inResponse, inRequest);
	},
	handlePlatformQuery: function(inSender, inResponse, inRequest){
		console.info("handlePlatformQuery: " + JSON.stringify(inResponse));

		var _3GDevice = inResponse.returnValue && inResponse.extended && inResponse.extended.platformType != "none";   
		
		if (!_3GDevice) {
			console.info("Subscribing to ConMan...");
			this.setDataConnection(true);
			this.okToStartNetworking = true;
			this.$.getConnectionStatus.call();
		} else {
			this.okToStartNetworking = false;
			this.$.MyCheckSim.openAtCenter(inLocale);
		}
	},

	
	getRestoreInProgressSuccess: function(inSender, inResponse) {
		// webOS Archive: NEVER erase the device. The stock path here calls
		// eraseVar (wipe /media/cryptofs/apps) + reboot to "clean up a partial
		// restore" — that is exactly what wiped a dev device. We do restore
		// nothing, so just advance.
		this.nextStep();
	},
	
	getRestoreInProgressFailure: function() {
		console.log("getRestoreInProgressFailure");
		this.$.setPalmProfile.call({FIRSTUSE_RESTORE_IN_PROGRESS : false});
		this.nextStep();
	},
	handleInstallUpdate:function(inSender, inResponse) {
		console.log("handleInstallUpdate: response: " + JSON.stringify(inResponse));
	},
	
	nextStep: function() {
		this.stopRequirementTracking();
		var lastView = this.view;
		this.view = null;
		this.log(this.step);
		this.config = FirstUse.config[++this.step];
		console.info("Creating kind : " + JSON.stringify(this.config));
		if (this.config) {
			this.log(this.config.name);
			var n = this.config.name;
			var kind = this.config.kind || enyo.cap(n); //wtf? come-on, code so this is readable.
			if (kind) {
				this.signin = null;
				console.info("Creating kind : " + kind);
				if(kind == "RestoreComponent")
					this.view = this.$.pane.createComponent({kind: kind, devices: this.restoreDevicesResponsePayload,softwareUpdateAvailable:this.softwareUpdateAvailable, owner: this, onRestoreStarted: "onRestoreStarted" , onFinish: "onRestoreFinish"});
				else
					this.view = this.$.pane.createComponent({kind: kind, owner: this,forceSwUpdate: this.forceSwUpdate, onFinish: "stepFinished"});
				}	
				this.signin = (kind == "Signin") ? this.view : null;
			    this.$.pane.flow();
				this.view.render();
				this.$.pane.selectView(this.view);
				this.startRequirementTracking();
				if (this.step) { // only show on the language selection screen.
					this.$.diagnostics.hide();
                    this.$.deviceIdMenu.hide();
				}
			
			if (this.registeredForSMS === undefined) {
				this.$.registerForSMS.call({"register":true});
				this.registeredForSMS = true;
		}
		
		}        
		
		if (lastView) {
			lastView.destroy();
		}

		return Boolean(this.view);
	},
	
	stepFinished: function(inSender, inResponse) {
		if (inSender && inSender.kind == "Signin") {
            this.$.getToken.call();
            if (this.createProfile) {
                this.step++; //Skip restore and go to google
            } else if (inSender && inSender.kind == "Signin" && this.isBackupAvailable) {
            //Do nothing, restore is the next component
            
            
            } else if (inSender && inSender.kind == "Signin" && !this.isBackupAvailable) {
                this.step++; //Skip restore and go to google
            } else {
            
            }
 			
			this.checkTheSimStatus = false; /* 3GWR  */ //If they get off this page we don't want to restart if the remove the sim, be better if they try to connect to wifi....
        } else if (inSender && inSender.kind == "RestoreComponent") {
          console.info("IN RestoreComponent:"+ inSender+ ": " + JSON.stringify(inResponse)+" current step:"+this.step);
		    this.forceSwUpdate= inResponse.swupdate;
            this.userSkippedRestore = inResponse.skipped;
            this.restoredOnSameDevice = inResponse.sameDevice;
			console.info(inSender.kind + ": " + this.userSkippedRestore + ": " + this.restoredOnSameDevice + ": " + this.isOTAAvailable);
			if(this.forceSwUpdate){
				this.step++;//Skip google
				this.step++;//Skip name device
			}
			else if (!this.userSkippedRestore) {
                this.step++; //Skip google
                if (this.restoredOnSameDevice) {
                     console.info("Skipping name device 1...");
                   this.step++;//Skip name device
                    if (!this.isOTAAvailable) this.step++;//Skip OTA
                } else {
                    console.info("Restored on a different device. So name device");
                }
            }
        } else if (inSender && inSender.kind == "Google") {//If you were at google screen, this is a new profile OR there was no restore(Either user skipped restore or there were no backups to restore from)
            if (this.createProfile) {
               console.info("Skipping name device 2...");
               this.assignDeviceName(); //default name in case of account creation
                this.step++; //Skip device name
                if (!this.isOTAAvailable) {
                    console.info("Skipping OTA 1...");
                    this.step++;
                }
                
            } else if ((this.noOfOtherDevices < 2 && !this.userSkippedRestore && this.isBackupAvailable) || this.restoredOnSameDevice) {
               console.info("Skipping name device 3...");
               this.step++; //skip device name
                if (!this.isOTAAvailable) {
                    console.info("Skipping OTA 2...");
                    this.step++;
                }
            } else {
                console.info("Naming device because: " + this.noOfOtherDevices + " " + this.isBackupAvailable + " " + this.userSkippedRestore + " " + this.restoredOnSameDevice);
            }
            
        } else if (inSender && inSender.kind == "Namedevice") {
            if (!this.isOTAAvailable) {
                console.info("Skipping OTA 3...");
                this.step++;
            }
        } else if (inSender) {
            console.info("No special handling from component: " + inSender.kind);            
            if(inResponse && inResponse.status){
                console.info("No special handling from component: " + JSON.stringify(inResponse));
                if (inResponse.status == "uptodate") {
                    
                } else if (inResponse.status == "background") {
                    this.otaSkipped = true;
                } else if (inResponse.status == "complete") {
                        
                }
            }
        }
		
		if (!this.nextStep()) {
			if (this.forceSwUpdate) {
				console.info("this.forceSwUpdate-"+this.forceSwUpdate);
				this.setForceSwUpdate(false);
			    this.performSoftwareUpdate();				
			}
			else {
				this.completeFirstUse();
			}
		   }
	},
	
	onRestoreStarted: function() {
		console.log("onRestoreStarted");
		this.$.setPalmProfile.call({FIRSTUSE_RESTORE_IN_PROGRESS : true});
	},
	
	onRestoreFinish: function(inSender, inResponse) {
		console.log("onRestoreFinish");
		this.$.setPalmProfile.call({FIRSTUSE_RESTORE_IN_PROGRESS : false});
		//Russ: bug? seems like we should wait for the above call to finish before doing the step below.
		this.stepFinished(inSender, inResponse);
	}, 

	
	updateProfileSuccess: function() {
		console.log("updateProfileSuccess");
	},
	
	updateProfileFailure: function() {
		console.log("updateProfileFailure");
	},
	
	startRequirementTracking: function() {
		//If data required and we dont have it, call wifi
		if (this.config.requires["data"]) {
			if(!this.getDataConnection()){
				this.requirementLost("data");
			}else{
				console.info(this.config.name + " requires data and is available");
			}
		} else {
			console.info(this.config.name + " does not require data");
		}
	},
	
	requirementLost: function(inInfo) {
		if (!this.okToStartNetworking) return;
		
		console.info("Requirement lost: " + inInfo);
		if (this.config && this.config.requires && this.config.requires[inInfo]) {
			if (this.wifiNotFirstTime) {
				this.$.wifiPopup.setHeaderTitle(rb.$L("No Wi-Fi Connection"));
				this.$.wifiPopup.setHeaderInfo(rb.$L("Your device no longer has a Wi-Fi connection. Connect to a new network.")); 	
			}
			this.wifiNotFirstTime = true;
			this.requirement = inInfo;
			var wifi = this.$.wifiPopup;
			wifi.reloadResources(inLocale);
			wifi.openAtCenter();
			wifi.start();
			this.wifiDialogIsOpen = true;
			enyo.call(this.view, "requirementLost", [inInfo]);
		}
	},
	
	requirementRestored: function(inInfo) {
		console.info("Requirement restored: " + inInfo);
		if (this.wifiDialogIsOpen) { //just unconditionally close if we had it open: CWS-3185
			this.wifiRestored();
		}
		if (this.config && this.config.requires && this.config.requires[inInfo]) {
			enyo.call(this.view, "requirementRestored", [inInfo]);
			this.$.wifiPopup.close();
			this.wifiDialogIsOpen = false;
			enyo.call(this.view, "dataRestored", []);
		}
		if (this.wifiDialogIsOpen) { //just unconditionally close if we had it open: CWS-3185
			this.wifiDialogIsOpen = false;
			this.$.wifiPopup.close();
		}
		if(this.currentServiceCall != ""){
    		console.info("Found a pending call: " + this.currentServiceCall);
    		this.currentServiceCall();
    	}
		
	},
	
	initCaptivePortalPopup: function() {
        this.$.capPortalCtrl.reloadResources(inLocale);
	},
	
	onCaptivePortalNetworkStatusChanged: function(networkStatus) {
	    if ("captivePortal" !== networkStatus) {
	      //todo: doSomething
	    }
	},
	
	onCaptivePortalChooseNewNetwork: function() {
     	console.info("onCaptivePortalChooseNewNetwork reseting WiFi");
   		this.$.deleteWiFiProfile.call({});
  	},
	
  	 handleDeleteWiFiProfile:  function(inSource, inResponse) {
     	console.info("handleDeleteWiFiProfile");
  	    if (inResponse.returnValue && inResponse.networkInfo && inResponse.networkInfo.profileId) {
  	      console.log("getWifiProfile: " + inResponse.networkInfo.profileId);
  	      this.$.deleteProfile.call({profileId: inResponse.networkInfo.profileId});
  	    }
		this.finishDeleteWiFiProfile();
  	 }, 
	 
	 finishDeleteWiFiProfile: function() {
     	console.info("finishDeleteWiFiProfile");
		this.$.captivePortalPopup.close();
		this.isCaptivePortalOpen = false;
		this.$.wifiPopup.openAtCenter();
		this.wifiDialogIsOpen = true;
		this.$.wifiPopup.start();
	 },
  	
	conManCallback: function(inSender, inResponse){
		//Con Man will always trigger requirement for data lost/restored
		//Up to the requirement lost/restored method to figure out if the current component needs data and to act accordingly
		this.connectedWithWiFi = (inResponse.isInternetConnectionAvailable && inResponse.wifi.state === "connected");
		
		if (!inResponse.isInternetConnectionAvailable && inResponse.wifi.state === "disconnected") { // per Craig H (on 5/2/11), do not look at the want state here.
			console.info("ConMan reporting internet connection: disconnected");
			this.setDataConnection(false);
			this.setDataConnectionType("");
			this.requirementLost("data");
	    } else if(!inResponse.isInternetConnectionAvailable && inResponse.wifi.state === "connected" && inResponse.wan.state !== "connected" && inResponse.wifi.onInternet==="captivePortal") {
			if(this.wifiDialogIsOpen) {
				this.wifiDialogIsOpen = false;
				this.$.wifiPopup.close();
			}
			if(!this.isCaptivePortalOpen) {
				this.$.captivePortalPopup.openAt({width: 0, height: 0, top: 0, left: 0});
				this.isCaptivePortalOpen = true;
			}
		} else if(inResponse.isInternetConnectionAvailable && (inResponse.wifi.state === "connected" || inResponse.wan.state === "connected")) {
			console.info("ConMan reporting internet connection: connected");
			if(this.isCaptivePortalOpen) {
				this.$.captivePortalPopup.close();
			}
			this.setDataConnection(true);
			this.setDataConnectionType(inResponse.wifi.state === "connected") ? "wifi" : "wan";
			this.requirementRestored("data");
			
			this.setDataConnectionInitialized(true);
		} else {
			console.info("Ignoring ConMan report");
		}	
	},
	
	wifiRestored: function(){
		console.log("wifiRestored");
		//Do nothing, wait for ConMan to report connection available
		this.$.powerPopup.close(); // fix to CWS-4033, if it was open the user gets stuff forever.
		if (this.signin) {
			console.log("cancelIfWifiCameAndWent");
			this.signin.cancelIfWifiCameAndWent();
		}
		this.SMSDialogCloseAll();
	},
	
	wifiCancel:function(){
		console.log("wifi dilog cancelled");
		//Do nothing, wait for ConMan to report connection available

		this.$.wifiPopupCancelDialog.openAtCenter();
		//window.setTimeout(enyo.bind(this, function () {this.$.wifiPopupCancelDialog.openAtCenter()}, 1000)); // this is here becuase if I just call the function I can't select anything in the dialog?
		
	},
	wifiPopupCancelDialogStartOver:function(){
		console.log("wifi dilog startover");
		this.$.StartOverFU.restartFirstUse();
	},
	// webOS CE: finish setup without a network. Close both network dialogs and
	// stop requirement tracking first, so a ConMan report arriving during the
	// close cannot reopen the Wi-Fi popup over the restart notice.
	wifiPopupCancelDialogSkip:function(){
		console.info("WOSA: skip account setup from the network dialog");
		this.$.wifiPopupCancelDialog.close();
		this.$.wifiPopup.close();
		this.wifiDialogIsOpen = false;
		this.okToStartNetworking = false;
		this.wosaSkipSetup();
	},
	wifiPopupCancelDialogFindNetwork:function(){
		console.log("wifi dilog findnetwork");
		this.$.wifiPopupCancelDialog.close();
		this.$.wifiPopup.reloadResources(inLocale);
		this.$.wifiPopup.openAtCenter();
		this.$.wifiPopup.start();
	},
	
	onSimCheckSuccess:function(){
		console.log("onSimCheckSuccess");
		this.$.MyCheckSim.close();
		this.$.powerPopup.close(); // fix to CWS-4033
		this.SMSDialogCloseAll();
		this.onSimCheckClose();
	  
	},
	
	  
	onSimCheckFailure:function(insender, inresponse) {
		console.log("onSimCheckFailure: " + inresponse);
		this.$.MyCheckSim.close();
		this.$.powerPopup.close(); // fix to CWS-4033
		this.SMSDialogCloseAll();
		
		if ((inresponse + "").toLowerCase() == "maxretries") {
			this.$.SimCheck_SimLock.openAtCenter();	
		} else if ((inresponse + "").toLowerCase() == "simlockpuk" || (inresponse + "").toLowerCase() == "simlocked") {
			if (this.carrierName) {
				var template = new enyo.g11n.Template(rb.$L("Your SIM is PUK locked. Please contact #{carrier} to unlock it. To set up your device, insert a valid SIM with active data service or use Wi-Fi instead."));
				this.$.PUKLockContent.setContent(template.evaluate({carrier: this.carrierName}));
			} else {
				this.$.PUKLockContent.setContent(rb.$L("Your SIM is PUK locked. Please contact your carrier to unlock it. To set up your device, insert a valid SIM with active data service or use Wi-Fi instead."))
			}
			this.$.SimCheck_SimLock2.openAtCenter();
		} else if ((inresponse + "").toLowerCase() == "simlockmep" || (inresponse + "").toLowerCase() == "simlockperm") {
			if (this.carrierName) {
				var template = new enyo.g11n.Template(rb.$L("The current SIM cannot be used in this device. To continue setup, insert a valid SIM with active data service from #{carrier} or use Wi-Fi instead"));
				this.$.MepLockContent.setContent(template.evaluate({carrier: this.carrierName}));
			} else {
				this.$.MepLockContent.setContent(rb.$L("The current SIM cannot be used in this device. To continue setup, insert a valid SIM with active data service from your carrier or use Wi-Fi instead."))
			}
			this.$.SimCheck_SimLock3.openAtCenter();
		} else {
			this.onSimCheckClose();
		}
	},
	
	simLockWarningConfirm:function(insender, inresponse) {
			this.$.SimCheck_SimLock.close();	
			this.onSimCheckClose();
	},
	simLockWarningConfirm2:function(insender, inresponse) {
			this.$.SimCheck_SimLock2.close();	
			this.onSimCheckClose();
	},
	simLockWarningConfirm3:function(insender, inresponse) {
			this.$.SimCheck_SimLock3.close();	
			this.onSimCheckClose();
	},
	
	onSimCheckClose :function(){
		this.setDataConnection(true);
		this.okToStartNetworking = true;
		this.$.getConnectionStatus.call(); // start the connection manager up.....
		this.ignoreInitialSimAStatusCall = true;
		this.$.SimStatusQuery.call({"subscribe":true}); // start checks to see if someone opens the SIM drawer for a restart.
	},
	
	onSimCheckStartOver:function() {
		console.log("onSimCheckStartOver");
		this.$.MyCheckSim.close();
		this.$.spinnerOverlay.openAtCenter();
		this.$.StartOverFU.restartFirstUse();
	},
	
	handleSimStatusQuery: function(inSender, inResponse, inRequest) {
		this.log("handleSimStatusQuery: " + JSON.stringify(inResponse));
		if (this.ignoreInitialSimAStatusCall) { 
			if (inResponse.extended && inResponse.extended.state != "simnotready") {
				//if we initally get a simnotready ready then we want to ignore
				this.ignoreInitialSimAStatusCall = false;
			}
		} else if (this.checkTheSimStatus) {
			if (inResponse.extended) {
				if (inResponse.extended.state == 'simnotfound' || inResponse.extended.state == 'siminvalid') {
					this.log("handleSimStatusQuery - SIM drawer opened");
					this.onSimCheckStartOver();
				}
			}
		}
		
	},

	
	setState: function(key, value){
		var keys = this.getKeyState();
		keys.push(key);
		this.setKeyState(keys);
		var values = this.getValueState();
		values.push(value);
		this.setValueState(values);
	},
	
	getState: function(key){
		var value = [this.getValueState()];
		return value[0];
	},
	
	stopRequirementTracking: function() {
		clearTimeout(this.job);
	},
	
	connFailure: function(inSender, inResponse){
		console.info("Con Man returned error, so not subscribed. Need to subscribe somehow!" + JSON.stringify(inResponse));
	},
	
	dispCallback: function(inSender, inResponse){
		console.info("dispCallBack: " + JSON.stringify(inResponse));
	},
	
	dispSetPropertyFailure: function(inSender, inResponse){
		console.info("Display service returned error trying to block dimming" + JSON.stringify(inResponse));
	},
	
	completeFirstUse: function() {
		this.$.pane.selectViewByName("complete");
		this.$.complete.show();
		this.done();
	},
	
	done: function(){
		// webOS Archive: safe completion. The account + device token are already
		// written by accountservices (createNovaAccount/authenticateAccount). Do NOT
		// call the dead HP postLogin services, do NOT reset, do NOT shut down —
		// leave the confirmation page up; the user dismisses it with Done.
		if (this.wosaIsOobe && this.languageCode) {
			console.info("WOSA CE OOBE: account setup complete — applying customization.");
			console.log("Set Customizations: " + this.countryCode + " : " + this.languageCode);
			this.$.setCustomization.call({"language":this.languageCode,"country":this.countryCode});
		} else {
			// Standalone: the language card never ran, so languageCode/countryCode
			// are empty — handing those to setCustomization would blank the
			// device's real customization instead of leaving it alone.
			console.info("WOSA: standalone completion — leaving customization alone.");
		}
		this.updateCompletePage();
	},

	updateCompletePage: function(){
		// getAccountToken is async — this runs from done() and again from
		// getTokenResponse, whichever lands last wins with the alias filled in.
		var alias = this.getAcctAlias();
		if (alias) {
			this.$.completeSubtitle.setContent("Signed in as " + alias + ". Your webOS Account is ready to use.");
		} else {
			this.$.completeSubtitle.setContent("Your webOS Account is ready to use.");
		}
	},

	// webOS Archive: under OOBE, closing this app is what triggers the device
	// reboot that finishes setup — an 8-10s freeze with no window chrome to hint
	// anything is happening. Without a warning shown BEFORE that freeze starts, a
	// tap here reads as "did nothing", which is exactly what Done looked like:
	// completeDoneTap used to call closeApp() straight from the click handler.
	completeDoneTap: function(){
		this.wosaSafeClose();
	},

	closeApp: function(){
		// webOS Archive: only finish OOBE (mark done + hand off) when LunaSysMgr
		// actually launched us as the OOBE bootstrap app. A normal relaunch
		// (Settings > Accounts, the app's own launcher icon) should just close
		// like any other app.
		//
		// webOS CE: this used to test inLocale, on the belief that only the OOBE
		// launcher passes locale/country on the URL. That is not true — the
		// language card sets those params itself when it redirects, so ANY launch
		// that reaches the language card ends up looking like OOBE here, and Done
		// would then POWER THE DEVICE OFF from the launcher icon. Ask LunaSysMgr
		// what mode it is in instead (see create()).
		if (this.wosaIsOobe) {
			// webOS Archive: this is exactly what real stock HP firstuse called
			// to finish OOBE in the common (no pending OTA) case — proven on
			// real hardware, unlike our own markFirstUseDone()+machineReboot()
			// attempt, which hung indefinitely (5+ minutes, no response) on a
			// genuinely fresh device's first real OOBE completion. Stock's
			// shutdown branch called ONLY PalmSystem.shutdown() and nothing
			// else — no window.close() — trusting the OS to tear the window
			// down itself as part of powering off. Calling window.close() here
			// too raced ahead of that (shutdown() is async) and killed the card
			// before the OS did anything, leaving LunaSysMgr with nothing to
			// show (the stuck black screen). Match stock exactly: shutdown()
			// alone, full stop.
			console.info("WOSA: closeApp (OOBE) calling PalmSystem.shutdown()");
			try {
				if (window.PalmSystem && PalmSystem.shutdown) {
					PalmSystem.shutdown();
				}
			} catch (e) { console.info("WOSA shutdown err: " + e); }
			return;
		}
		console.info("WOSA: closeApp (standalone) calling window.close()");
		try { window.close(); } catch (e) { console.info("WOSA close err: " + e); }
		console.info("WOSA: closeApp window.close() call returned");
	},

	// webOS Archive: shared by the Done button and both cards' "Skip Account
	// Setup" link. Shows the restart warning for a moment so the UI doesn't just
	// freeze with no explanation, then closes.
	wosaSafeClose: function(){
		if (!this.wosaIsOobe) {
			// Standalone: nothing is about to restart, so do not say so — just close.
			console.info("WOSA: wosaSafeClose (standalone) closing immediately");
			this.closeApp();
			return;
		}
		console.info("WOSA: wosaSafeClose opening restart popup");
		this.$.wosaSkipRestartPopup.openAtCenter();
		setTimeout(enyo.bind(this, function(){
			console.info("WOSA: wosaSafeClose timer fired");
			this.closeApp();
		}), 900);
	},

	// webOS CE: skipping must still finish OOBE properly. done() applies the
	// language card's customization (populateDefaults) on the account path; the
	// skip path used to close without it. Apply it here too, then close once it
	// answers -- or after 5 s, so a stuck service can never hold setup open.
	wosaSkipSetup: function(){
		if (this.wosaSkipping) { return; }
		this.wosaSkipping = true;
		if (!(this.wosaIsOobe && this.languageCode)) {
			this.wosaSafeClose();
			return;
		}
		console.info("WOSA CE OOBE: skipping account setup — applying customization first.");
		var closeOnce = enyo.bind(this, function(why){
			if (this.wosaSkipClosed) { return; }
			this.wosaSkipClosed = true;
			console.info("WOSA: skip close (" + why + ")");
			this.wosaSafeClose();
		});
		setTimeout(function(){ closeOnce("customization timeout"); }, 5000);
		this.wosaSkipCloseOnce = closeOnce;
		this.$.setCustomization.call({"language":this.languageCode,"country":this.countryCode});
	},
	
	postTimeZoneResponse: function(inSender, inResponse){
        console.info("postTimeZoneResponse Call Returned");
		if (!inResponse.returnValue) {
            console.info("Post login failure: " + JSON.stringify(inResponse));
        }
		this.postTimeZoneResponseReturned = true;
		this.restartIfDone();
   },
   
   postCustomizationResponse: function(inSender, inResponse) {
        console.info("postCustomizationResponse Call Returned");
		if (this.wosaSkipCloseOnce) { this.wosaSkipCloseOnce("customization applied"); }
		if (!inResponse.returnValue) {
            console.info("Post login failure: " + JSON.stringify(inResponse));
		}
 
 		this.postCustomizationResponseReturned = true;
		this.restartIfDone();
   },

	
	postLoginSettingsResponse: function(inSender, inResponse){
        console.info("postLoginSettingsResponse Call Returned");
		if (!inResponse.returnValue) {
            console.info("Post login failure: " + JSON.stringify(inResponse));
        }
		this.postLoginSettingsResponseReturned = true;
		this.restartIfDone();

	},
	
	removeRestoreFailedFileResponse: function(inSender, inResponse) {
		console.log("removeRestoreFailedFileRespones Call Returned");
		if (!inResponse.returnValue) {
            console.info("Post login failure: " + JSON.stringify(inResponse));
        }
		this.removeRestoreFailedFileResponeseReturned = true;
		this.restartIfDone();
	},
	
	restartIfDone: function() {
		if (this.postLoginSettingsResponseReturned && 
			this.postTimeZoneResponseReturned && 
			this.removeRestoreFailedFileResponeseReturned &&
			this.postCustomizationResponseReturned) {
				
			this.firstUseComplete();
		}
	},
	
	firstUseComplete: function() {
		// webOS Archive: never shut down / reset / mark-first-use / install updates.
		// (belt-and-suspenders — done() closes directly and shouldn't reach here.)
		console.info("WOSA firstrun complete — safe close.");
		this.closeApp();
	},
	
	performSoftwareUpdate: function() {
			console.info("There is an update to install as backup forcing update..FIRST USE NOT COMPLETED YET");
		    this.$.pane.selectViewByName("complete");			
			this.$.completeSetup.setContent(rb.$L("Software Update In Progress"));
			this.$.complete.show();
			this.$.installUpdate.call();		
	},
	
	
		
	genericFailure: function(inSender, inResponse){
        console.info("Generic failure " + JSON.stringify(inResponse));
    },
	
    
    powerDownDevice: function () {
		// webOS Archive: disabled the stock 5-minute inactivity auto-powerdown.
		console.info("WOSA firstrun: powerDownDevice disabled (no auto-poweroff).");
	},
	
	powerDownResponse:function(inSender, inResponse){
		console.info("powerDownResponse: " + JSON.stringify(inResponse));
	},                                                                                                                                            
	                                                                                                                                              
	pluggedInStatusChanged: function(inSender, inResponse){
		console.info("pluggedInStatusChanged: " + JSON.stringify(inResponse));
		if (!this.pluggedInStatusChangedInited) {
			this.pluggedInStatusChangedInited = true; 
			this.$.monitorPluggedInit.call({}); //Will callback this routine with the right value.
			return;	
		};

		if (inResponse && (inResponse.DockConnected || inResponse.USBConnected)) {
			console.info("POWER CONNECTED");
			if (this.powerDownMethod) clearTimeout(this.powerDownMethod);
			this.chargerConnected = true;
		} else if (inResponse && (!inResponse.DockConnected && !inResponse.USBConnected)) {
			console.info("POWER UNCONNECTED");
			if (this.chargerConnected) { // if it was connected, not it is unconnected
				console.info("Ignore unplug/undock: " + JSON.stringify(inResponse));
				if (this.powerDownMethod) 
				clearTimeout(this.powerDownMethod);
				this.chargerConnected = false;
				this.powerDownMethod = setTimeout(enyo.bind(this, "powerDownDevice"), 1000 * 60 * 5);//5 minute countdown
			}
		} 
	},
	
	powerKeyPressOnResponse: function(inSender, inResponse){
		console.info("powerKeyPressOnResponse: " + JSON.stringify(inResponse));
		if(inResponse && inResponse.showDialog)
			this.$.powerPopup.openAtCenter();
	},
	
	powerDownNow: function() {
		this.$.spinnerOverlay.openAtCenter();
		//give a 1/4 second for the spinner to show like we are actually doing something. ;-)
		window.setTimeout(enyo.bind(this, "powerDownNowForReal"), 250);
	},
	powerDownNowForReal: function(){
		this.$.powerDown.call({"reason": "power key press"});
	},
	
	closePowerpopup: function(inSender, inResponse){
		this.$.powerPopup.close();
	},
	
	openAppMenuHandler: function() {
	    this.$.appMenu.open();
	},
	closeAppMenuHandler: function() {
	    this.$.appMenu.close();
	},
	
	collectLogs: function(inSender, inResponse){
		console.info("collect logs on click");
		var d=new Date();
		var fileName=d.getTime();

		var template = new enyo.g11n.Template(rb.$L("Creating log Dump #{filename}.ssl.tar in /media/internal/logs <p> This can take 10-20 seconds"));
		this.$.collectLogMessage.setContent(template.evaluate({filename: fileName}));

		this.$.collectLogPopup.openAtCenter();
		this.$.collectLogs.call({"filename" :fileName});
	},
	
	collectLogsResponse:function(inSender, inResponse){
		if(inResponse && !inResponse.returnValue)
			console.info("Error Collecting logs: "+JSON.stringify(inResponse));
			
		this.$.powerPopup.close(); // fix to CWS-4033, DFISH-20188, if it was open the user gets stuck forever.
		this.$.collectLogPopup.close();
		this.SMSDialogCloseAll();
	},
	
    runDiagnostics: function () {                                                                                  
            this.$.launchApplicationService.call({id: "com.palm.app.crotest"});                          
        },                                                                                                    
	openDeviceId: function () {   
			this.$.DeviceInfoDialog.openDeviceInfoDialog();                                                                              
            //this.$.launchApplicationService.call({id: "com.palm.app.deviceinfo"});                          
        },  
	                                                                                                  
    launchAppSuccess: function(inSender, inResponse) {
            console.info("launchAppSuccess: " + JSON.stringify(inResponse));
        },
    launchAppFailure: function(inSender, inResponse) {
            console.info("launchAppSuccess: " + JSON.stringify(inResponse));
        },
	
	getTokenResponse: function(inSender, inResponse){
		console.info("getToken Response");
		this.$.getDevice.call();
		if(inResponse.returnValue){
			this.setAcctAlias(inResponse.accountAlias);
			this.setAcctToken(inResponse.token);
			this.updateCompletePage();
			if (this.assignDeviceNameRetry) {
				this.assignDeviceName();
			}
		} else {
			console.info("Could not get token info");
		}
	},
	
	getDeviceResponse: function(inSender, inResponse){
		console.info("getDevice Response");
		if(inResponse.returnValue){
			this.setDeviceId(inResponse.deviceInfo.deviceId);
			this.setNduId(inResponse.deviceInfo.nduId);
			if (this.assignDeviceNameRetry) {
				this.assignDeviceName();	
			}
		} else {
			console.info("Could not get device info");
		}
	},
	
	assignDeviceName: function(){
		if(this.getAcctAlias() != "" && this.getAcctToken() != "" && this.getNduId() != ""){
			console.info("We have all token and device data to name the device");
			if(enyo.application.FirstUse.getDataConnection()){
				console.info("Data available...");
				var locale = enyo.g11n.currentLocale();
				var language = locale.language;
				var region = locale.region;

				this.$.assignDeviceName.call({"alias":this.getAcctAlias(), "token":this.getAcctToken(),	"nduId":this.getNduId(), "name":this.firstName,"language": language, "country": region, "userChosen": false});
				this.currentServiceCall = "";
			} else {
				this.currentServiceCall = enyo.hitch(this, "assignDeviceName");
				console.info("Data not available. Registered " + this.currentServiceCall + "to be called after data restored");
			}
		} else {
			this.assignDeviceNameRetry = true;
			console.info("ERROR: We may not have all info yet to name device...will try latter.");
		}
	},
	
	assignDeviceNameSuccess: function(inSender, inResponse){
		this.currentServiceCall = "";
	},
	
	assignDeviceNameFailure: function(inSender, inResponse){
		this.currentServiceCall = "";
	},
	
	getMachineNameResponse: function(inSender, inResponse){
		console.info("getMachineNameResponse: " + JSON.stringify(inResponse));
		if(inResponse && inResponse.returnValue)
			this.machineName = inResponse['com.palm.properties.deviceName'];
		else
			this.machineName = "HP Touchpad";
	},
	
	
	updateSMSRegisterSuccess: function() {
		console.log("updateSMSRegisterSuccess");
	},
	
	updateSMSRegisterFailure: function() {
		console.log("updateSMSRegisterFailure");
	},
	
	// SMS SUPPORT
	gotCarriersFailure: function(inSender, inResponse) {
		console.info("gotCarriersFailure");
		this.carrierName = undefined;	
	},
	gotCarriersSucess: function(inSender, inResponse) {
		console.info("gotCarriersSucess: " + JSON.stringify(inResponse));
		if (inResponse.results && inResponse.results.length > 0) {
			var carrierSettings = inResponse.results[0];
			this.carrierName = carrierSettings.qOperatorLongName;	
		} else {
			this.carrierName = undefined;	
	}
	},
	
	
	SMSNameCt: 0,
	SMSNameDict: {},
	SMSDialogCloseAll: function() {
		for (var key in this.SMSNameDict) {
			if ((key+"").indexOf("SMSClose") == 0) { //check the key
				var value = this.SMSNameDict[key];
		    	value.close(); //act on the dialog
		    	value.destroy();
				delete this[key];
			}
	    }
		this.SMSNameDict = {};
	},
	SMSNameDictCount: function() {
		var ct = 0;
		for (var key in this.SMSNameDict) {
			if ((key+"").indexOf("SMSClose") == 0) { 
				ct++;
			}
	    }
		return ct;
	},
	SMSCreate: function() {
			if (this.SMSNameDictCount() > 20) {
				//if we have 20 open SMS just give up; why show more.
				return;
			}
			
			var templ = new enyo.g11n.Template(rb.$L("Message From #{smsPhoneNumber}")); 
			var fmt = new enyo.g11n.PhoneFmt(); 
			var pn = (enyo.windowParams.SMSData.callbackNumber) ?  fmt.format(new enyo.g11n.PhoneNumber(enyo.windowParams.SMSData.callbackNumber)) : undefined; 
			if (enyo.windowParams.SMSData.callbackNumber && !pn) {
				pn = enyo.windowParams.SMSData.callbackNumber;
			};
			var fromStr = (this.carrierName) ? this.carrierName : (pn ? pn : undefined);

			var smsname  = "SMSNAME_" + this.SMSNameCt;
			var smsclose = "SMSClose_" + this.SMSNameCt++;
			
			
			var c = this.createComponent(
				//{kind: "FIRSTUSE_SMSModalDialog"} I tried making a seperate kind but something with styles got @#$%-up.
				{
					name: smsname, kind: "ModalDialog", lazy: false, className: "popup",
					caption: (fromStr) ? templ.evaluate({smsPhoneNumber: fromStr}) : rb.$L("Message"), 
				 	components: [
				 		{content: enyo.windowParams.SMSData.body, className: "enyo-text-body"}, 
						{kind: "Button", caption: rb.$L("Close"), className: 'enyo-button', onclick: smsclose}
				 	]
				}
			);
			this[smsclose] = function() {
				c.close();
				c.destroy();
				delete this.SMSNameDict[smsclose];
				delete this[smsclose];
			};
			this.SMSNameDict[smsclose] = c;
			c.openAtCenter();
	},

    relaunchHandler: function(inSender, inEvent) {
        console.info("## firstuse relaunched ##");
        console.info(JSON.stringify(enyo.windowParams));
				
		// luna-send -n 1 palm://com.palm.applicationManager/open '{"id":"com.palm.app.firstuse", "params": {"SMSData": {"priority":"class0", "body": "hi mom", "callbackNumber": "dad"}}}'
		if (enyo.windowParams.SMSData && enyo.windowParams.SMSData.priority == "class0" && enyo.windowParams.SMSData.body) {
			this.SMSCreate();
		}
    }


});