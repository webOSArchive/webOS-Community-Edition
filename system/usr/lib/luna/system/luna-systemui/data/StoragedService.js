/* Copyright 2009 Palm, Inc.  All rights reserved. */

enyo.kind({
	name: "StoragedService",
	kind: enyo.Component,
	published: {
		isUSBConnected: false
	},
	
	components: [
		{kind:"ApplicationEvents", onApplicationRelaunch:"handleRelaunch"},
		{kind:"PalmService", name:"msmAvail", service:"palm://com.palm.bus/signal/", method:"addmatch", subscribe:true, onResponse:"storageHandleNotifications"},
		{kind:"PalmService", name:"partitionAvail", service:"palm://com.palm.bus/signal/", method:"addmatch", subscribe:true, onResponse:"storageHandleErrorNotifications"},
		{
			kind:enyo.PalmService, name:"hostIsConnected", service:"palm://com.palm.storage/diskmode/", method:"hostIsConnected", onResponse:"handleHostIsConnected"
		},
		
	],
	
	create: function() {
		this.inherited(arguments);
		this.subscribeToNotifications();
		this.isUSBCableConnected();
	},
	
	subscribeToNotifications: function() {
		this.$.msmAvail.call({"category": "/storaged", "method": "MSMAvail"});
		this.$.partitionAvail.call({"category": "/storaged", "method": "PartitionAvail"});
	},
	
	/*
	 * Handle storage(mode-avail) notifications
	 */
	storageHandleNotifications: function(inSender, inResponse) {	
	    if (!inResponse || inResponse["mode-avail"] === undefined)
	        return;
	   
	    if (inResponse["mode-avail"]) {
			this.isUSBConnected = true;
			// webOS CE: a banner and the dashboard, not a popup that stays up until dismissed.
			if (this.canUSBAlertDisplayed()) 
				this.showUSBBanner();
			this.createUSBDashboard();
		}
	    else {
			this.isUSBConnected = false;
			this.closeUSBAlerts();
	    }
	},
	
	/*
	 * Show the USB banner. Tapping it relaunches this app with these params.
	 */
	showUSBBanner: function() {
		enyo.windows.addBannerMessage($L("USB Connected, tap for options"), enyo.json.stringify({action:"usbOptions"}), "/usr/lib/luna/system/luna-systemui/images/notification-small-usb.png");
	},
	
	handleRelaunch: function(inSender, inEvent) {
		if (inEvent.params && inEvent.params.action == "usbOptions" && this.isUSBConnected)
			this.showStorageModeAlert();
	},
	
	/*
	 * Show Storage Mode Alert. webOS CE: only when the banner is tapped.
	 */
	showStorageModeAlert: function() {
		var wCard = enyo.windows.fetchWindow("StorageModeAlert");
		var windowHeight =  (enyo.g11n.currentLocale().locale == "en_us") ? 200 : 220;
		if(!wCard)
			enyo.windows.openPopup("app/StoragedAlerts/storagedalerts.html", "StorageModeAlert", {}, undefined, windowHeight);
	},
	
	createUSBDashboard: function() {
		var wCard = enyo.windows.fetchWindow("USBDashboard");
		if(!wCard) {
			enyo.windows.openDashboard("app/StoragedAlerts/storagedalerts.html", "USBDashboard", {}, {
				"icon": "/usr/lib/luna/system/luna-systemui/images/notification-small-usb.png"
			});
		} 
	},
	
	/*
	 * Handler for Storaged MSM Error Notification
	 */
	storageHandleErrorNotifications: function(inSender, inResponse) {	
		 if (!inResponse)
	        return;
		
		if(inResponse.reformatted) {
			this.showMSMErrorAlert(true);
		}
		else if(inResponse.fscked) {
			this.showMSMErrorAlert(false);
		}
		
	},
	
	showMSMErrorAlert: function(showFormatError) {
		var payload = {};
		if(showFormatError)
			payload.formatError = true;
		else
			payload.fsckError = true;
		var windowHeight =  (enyo.g11n.currentLocale().locale == "en_us") ? 165 : 195;
		var wCard = enyo.windows.fetchWindow("StorageErrorAlert");
		if(!wCard)
			enyo.windows.openPopup("app/StoragedAlerts/storagedalerts.html", "StorageErrorAlert", payload, undefined, windowHeight);
	},
	
	/*
	 * Check to see if USB is connected. If so, put a dashboard usb icon.
	 */
	isUSBCableConnected: function() {
		this.$.hostIsConnected.call();
	},
	
	handleHostIsConnected: function(inSender, inResponse) {
		if(inResponse.result == true && inResponse.hostIsConnected) {
			this.isUSBConnected = true;
			// webOS CE: already plugged in when this started, so there is no news to announce.
			if (!enyo.application.getTelephonyService().getOnActiveCall()) {
				this.createUSBDashboard();
			}			
		}
	},
	
	/*
	 * Check the conditions and make sure USB Alert can be displayed
	 */
	canUSBAlertDisplayed: function() {
		if (enyo.application.getTelephonyService().getOnActiveCall())
			return false;
		if (enyo.application.getSysUpdateService().getUpdateAvailable()) 
			return false;
		else if(enyo.windows.fetchWindow("PowerOffAlert"))
			return false;
		else if(enyo.windows.fetchWindow("ResetAlert"))
			return false;
		else
			return true;
	},
	
	/* 
	 * Close the USB Dashboard and Storage Alert
	 */
	closeUSBAlerts: function() {
		var wCard = enyo.windows.fetchWindow("StorageModeAlert");
		if(wCard)
			wCard.close();
		
		wCard = enyo.windows.fetchWindow("USBDashboard")
		if(wCard)
			wCard.close();
			
		wCard = enyo.windows.fetchWindow("USBModeWarningAlert")
		if(wCard)
			wCard.close();
	},
	
});