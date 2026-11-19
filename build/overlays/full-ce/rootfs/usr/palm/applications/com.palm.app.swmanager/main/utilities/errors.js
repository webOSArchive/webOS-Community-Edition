/* Copyright 2009 Palm, Inc.  All rights reserved. */

var Utilities = Utilities || {};

Utilities.ErrorChoices = {
    tryCCChoices: [{
        label: $L("Use Credit Card"), 
        value: "cc", 
        type: 'default'
    }, {
        label: $L("Cancel"), 
        value: true, 
        type: 'dismiss'
    }],
    tryOBChoices: [{
        label: $L("Use Carrier Account"), 
        value: "ob", 
        type: 'default'
    }, {
        label: $L("Cancel"), 
        value: true, 
        type: 'dismiss'
    }],
    simpleOKChoices: [{
        label: $L("OK"), 
        value: true, 
        type: 'dismiss'
    }]
}

enyo.kind ({
    name: "CommonErrors",
    kind: enyo.Component,
    components: [],
    _PMTGroupErrors:
    {
        PMT_0: {
            dialog: true, 
            title: $L("Payment Type"), 
            message: $L("You can only pay with a credit card. Update your account information in Preferences & Accounts and try again. {$errCode}") , 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT_1: {
            dialog: true, 
            title: $L("Payment Failed"), 
            message: $L("We cannot process your payment. Contact your financial institution. {$errCode}"), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT_2: {
            dialog: true, 
            title: $L("Payment Failed"), 
            message: $L("Update the payment information in your account and try again. {$errCode}"), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT_3: {
            dialog: true, 
            title: $L("Payment Failed"), 
            message: $L("CyberSource refused your payment. {$errCode}") , 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT_4: {
            dialog: true, 
            title: $L("Payment Failed"), 
            message: $L("You are not permitted to purchase items in the App Catalog. {$errCode}") , 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT_5: {
            dialog: true, 
            title: $L("Transaction Error"), 
            message: $L("The credit card you are using may be fraudulent. Enter a different credit card in Preferences & Accounts and try again. {$errCode}") , 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT_6: {
            dialog: true, 
            title: $L("Can't Purchase"), 
            message: $L("The United States Government prohibits Palm from allowing you to purchase applications.") , 
            choices: [{
                label: $L("OK"), 
                value: "quit", 
                type: 'primary'
            }, {
                label: $L("Help"), 
                value: "help", 
                type: 'secondary'
            }]
        },
        PMT_7: {
            dialog: true, 
            title: $L("Invalid Address"), 
            message: $L("The address you entered cannot be found. Verify that the address you entered is correct, and is in the Billing Country you have chosen.") , 
            choices: [{
                label: $L("OK"), 
                value: "ok", 
                type: 'dismiss'
            }]
        }

    },
    OBCarrierNotSupported: {
        dialog: true, 
        title: $L("Operator Billing is not supported for this carrier"), 
        message: $L("{$carrierName} does not support payments. Please pay with a credit card."), 
        choices: Utilities.ErrorChoices.simpleOKChoices
    }
});

Utilities.CommonErrors = new CommonErrors();


enyo.kind ({
    name: "Error",
    kind: "Control",
    events: {
        onSubmit: "",
        onCancel: ""
    },
    published: {
        session: null
    },
    components: [
    {
        kind: "Popup", 
        name: "popup", 
        scrim: true, 
        modal: true, 
        width: "400px", 
        components: [

        {
            name: "popup_error_title", 
            className: "enyo-item enyo-first", 
            style: "padding: 12px", 
            allowHtml:true
        },

        {
            name: "popup_error_message", 
            className: "enyo-item enyo-last", 
            style: "padding: 12px; font-size: 14px", 
            allowHtml:true
        },

        {
            kind: "HFlexBox", 
            name: "popup_choices", 
            style: "padding-top: 6px;"
        }
        ]
    },

    {
        kind: "Dialog", 
        name: "dialog", 
        components: [

        {
            name: "dialog_error_title", 
            className: "enyo-item enyo-first", 
            style: "padding: 12px", 
            allowHtml:true
        },

        {
            name: "dialog_error_message", 
            className: "enyo-item enyo-last", 
            style: "padding: 12px; font-size: 14px", 
            allowHtml:true
        },

        {
            kind: "HFlexBox", 
            name: "dialog_choices", 
            style: "padding-top: 6px;"
        }
        ]
    }
    ],
    destroyChoices: function() {
        components = this.getComponents();
        for(i in components) {
            if(components[i].name.search(/button/) >= 0) {
                components[i].destroy();
            }
        }
    },
    showPopup: function(error) {
        // From enyo 0.10, the Popup was created lazily by default, so run open() first, so sub-components were created,
        // then we can set the content for the sub-components.
        this.$.popup.openAtCenter();
        this.$.popup_error_title.setContent(error.title);
        this.$.popup_error_message.setContent(error.formattedMessage ? error.formattedMessage : error.message);
        if(!error.choices || error.choices.length == 0) {
            // Add a default "OK" button
            this.$.popup_choices.createComponent(
            {
                kind: "Button", 
                flex: 1, 
                caption: $L("OK"), 
                onclick: "cancelPopup", 
                owner: this
            }
            );
        }
        else {
            for(i in error.choices) {
                clickAction = error.choices[i].type == "dismiss" ? "cancelPopup" : "submitPopup";
                this.$.popup_choices.createComponent(
                {
                    kind: "Button", 
                    flex: 1, 
                    value: error.choices[i].value, 
                    caption: error.choices[i].label, 
                    onclick: clickAction, 
                    owner: this
                }
                );
            }
        }
        this.$.popup.render();
    
    },
 
    submitPopup: function(inSender) {
        this.$.popup.close();
        this.doSubmit(inSender.value);
    }
    ,
    cancelPopup: function(inSender) {
        this.$.popup.close();
        this.doCancel(inSender.value);
    }
    ,
	
    showDialog: function(error) {
        this.$.dialog_error_title.setContent(error.title);
        this.$.dialog_error_message.setContent(error.formattedMessage);
        if(!error.choices || error.choices.length == 0) {
            // Add a default "OK" button
            this.$.popup_choices.createComponent(
            {
                kind: "Button", 
                flex: 1, 
                value: "ok", 
                caption: $L("OK"), 
                onclick: "cancelDialog", 
                owner: this
            }
            );
        }
        else {
            for(i in error.choices) {
                clickAction = error.choices[i].type == "dismiss" ? "cancelDialog" : "submitDialog";
                this.$.dialog_choices.createComponent(
                {
                    kind: "Button", 
                    flex: 1, 
                    value: error.choices[i].value, 
                    caption: error.choices[i].label, 
                    onclick: clickAction, 
                    owner: this
                }
                );
            }
        }
        this.$.dialog.render();
        this.$.dialog.open();
    },
    submitDialog: function(inSender) {
        this.$.dialog.close();
        this.doSubmit(inSender.value);
    }
    ,
    cancelDialog: function(inSender) {
        this.$.dialog.close();
        this.doCancel(inSender.value);
    }
    ,
    showFatalError: function(error) {
        //new FindApps.FatalError(error).renderInto(document.body);
        if(!error.message)
            // Show default error message
            error.message = $L("The action could not be completed.<br/>Try again later.");
        var errorView = viewLibrary.getView("FULLSCREENERROR");
        errorView.setParams({
            "errorTitle": error.title, 
            "errorMessage": error.message
        });
    },
    cancel: function() {
        this.$.dialog.close();
        this.$.popup.close();
    },
    showPalmProfileError: function() {
        this.showFatalError(this._dialogErrors["invalidtoken"]);
    },
    // This is an entry point to showing error scene
    _displayErrorPage: function(errorCode)
    {
        if (errorCode == "invalidtoken")
        {
            // If we receive a bad authentication token we must inform the system and popup a dialog (not pop to an error screen)
            // Always felt the error screen was better.
            findApps.AccountServices.getInstance().notifyAuthenticationFailure({
                onSuccess: "showPalmProfileError", 
                onFailure: "showPalmProfileError", 
                scope: this
            });
        }else{
            this.showFatalError(this._dialogErrors[errorCode]);
        }
    },
	
    _displayIncompatibleErrorPage: function(error)
    {
        this.showDialog(error);
    },
	
    _displayErrorDialog: function(error)
    {
        this.showPopup(error);
    },
	
    displayPromoErrorDialog: function(errorTag, error) {
        var promoTitle = "Promo Code";
        var promoMessage = "Unknown error.";
        switch(errorTag) {
            case "invalid":
                promoMessage = "Invalid, unavailable or expired promo code, try to use previous saved code or manually input valid code.";
                break;
            case "fail":
                promoMessage = "Sorry, fail to get promo code information from server.";
                break;
        }
        this.showDialog({
            title: promoTitle, 
            message: $L(promoMessage), 
            choices: [{
                label: $L("OK"), 
                type: "dismiss"
            }]
        });
    },
	
    displayError: function(errorCode, args, defaultError, defaultTitle, defaultMessage)
    {
        // delete all the current options
        this.destroyChoices();
        if ((errorCode == "failure" || errorCode == "badresponse") && defaultError && defaultError.indexOf('PMT_'))
        {
            errorCode = defaultError;
        }
		
        var error = this._dialogErrors[errorCode] || this._dialogErrors[defaultError];
		
        if (!error)
        {
            // if PMT error default to catch_all message 
            if (errorCode.toString().indexOf("PMT") >= 0) {
                error = this._dialogErrors["PMT_catchAll"];
                errorCode = "PMT_catchAll";
            }
            else {
                error = {
                    dialog: true, 
                    title: defaultTitle || $L("Unknown Error"), 
                    message: defaultMessage || errorCode
                };
            }
        }
        else {
            // Use the corret error code
            if (!this._dialogErrors[errorCode] && defaultError)
                errorCode = defaultError;
        }
		
        if (error.page) 
        {
            this._displayErrorPage(errorCode);
        }
        else if (error.incompatible_page)
        {
            this._displayIncompatibleErrorPage(errorCode);
        }
        else if (error.dialog)
        {
            if (!args) {
                args = {
                    "errCode": errorCode
                };
            }
            // FIXME: need to get carrier from service of some sort
            //args.carrierName = (carrier && carrier.qOperatorShortName) || "your carrier";

            var msg = error.message;
            error.formattedMessage = enyo.macroize(msg, args);

            // promo line
            if(errorCode && errorCode.indexOf('PROMO')) {
                error.promoTag = true;
                error.promoErrorCode = errorCode;
            }

            if (args && args.failover) {
                if (args.failover == "cc") {
                    error.choices = Utilities.ErrorChoices.tryCCChoices;
                } else if (args.failover == "ob") {
                    error.choices = Utilities.ErrorChoices.tryOBChoices;
                }
                else  // default case: This will be the case for Topaz wifi device
                    error.choices = Utilities.ErrorChoices.simpleOKChoices;
            }

            this._displayErrorDialog(error);
        }
    }
    ,
	
	
    _dialogErrors:
    {
        // terminal errors
        offline: {
            page: true, 
            message: $L("You must connect to a network to use this application.")
        },
        invalidtoken: {
            page: true, 
            message: $L("We could not find a valid webOS Account.<br/>You need a valid account to use App Catalog.")
        },
        failure: {
            page: true
        },
        failureRetry: {
            dialog: true, 
            title: $L("Error"), 
            message: $L("App Catalog could not complete the last action you performed. Try again later."), 
            choices: [{
                label: $L("Try Again"), 
                value: "retry"
            } ]
        },
        badformat: {
            page: true
        },
        timeout: {
            page: true
        },
        jsonexception: {
            page: true
        },
        downformaintenance: {
            page: true
        },
        appunavailable: {
            page: true, 
            message: $L("No applications found.")
        },
        dplfailed: {
            page: true, 
            message: $L("You can't set up an account. The United States Government prohibits Palm from allowing you to purchase applications.")
        },
        PMT01002: {
            page: true
        },
        APPCAT0065: {
            page: true, 
            message: $L("Your first wifi-only device has not yet setup Application Catalog country, please do so before proceeding.")
        },
		
        // incompatible app errors
        DISC0025: {
            incompatible_page: true
        },
        DISC0124: {
            incompatible_page: true
        },
        DISC0125: {
            incompatible_page: true
        },
        DISC0201: {
            incompatible_page: true
        },
        DISC0202: {
            incompatible_page: true
        },
        DISC0203: {
            incompatible_page: true
        },
		
        // payment errors
        PMT_catchAll: {
            dialog: true, 
            title: $L("Unexpected problem"), 
            message: $L("App Catalog could not complete the last action you performed. Try again later. {$errCode}"), 
            choices: [{
                label: $L("OK"), 
                value: true, 
                type: 'dismiss'
            }]
        },
        PMT_addCC_default: {
            dialog: true, 
            title: $L("Couldn't Add Credit Card"), 
            message: $L("A problem occurred when adding your credit card information. Try again later. {$errCode}"), 
            choices: [{
                label: $L("OK"), 
                value: true, 
                type: 'dismiss'
            }]
        },
        PMT_modifyCC_default: {
            dialog: true, 
            title: $L("Couldn't Update"), 
            message: $L("The credit card information could not be updated. Try again later. {$errCode}"), 
            choices: [{
                label: $L("OK"), 
                value: true, 
                type: 'dismiss'
            }]
        },
        PMT_removeCC_default: {
            dialog: true, 
            title: $L("Couldn't Remove"), 
            message: $L("The credit card was not removed from your account. Try again later. {$errCode}"), 
            choices: [{
                label: $L("OK"), 
                value: true, 
                type: 'dismiss'
            }]
        },
        PMT_purchase_default: {
            dialog: true, 
            title: $L("Couldn't Purchase"), 
            message: $L("The item could not be purchased. Try again later. {$errCode}"), 
            choices: Utilities.CommonErrors.tryCCChoices
        },
        PMT_cant_download: Utilities.CommonErrors._PMTGroupErrors.PMT_6,
        PMT_cant_download_encrypted:  {
            dialog: true, 
            title: $L("Can't Download"), 
            message: $L("The United States Government prohibits Palm from allowing you to download this application."), 
            choices: [{
                label: $L("OK"), 
                value: true, 
                type: 'dismiss'
            }]
        },
        PMT_cant_purchase: Utilities.CommonErrors._PMTGroupErrors.PMT_6,			
        PMT02000: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("A required field does not exist or is empty"), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02002: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("This card type is not supported"), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02003: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("This order type is not supported"), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02005: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("The State code is incorrect. Try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02006: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("The Country code is incorrect. Try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02008: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("The Currency code is incorrect. Try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02010: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("You must enter valid information in every field."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02011: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("You must enter a number in the Credit Card field."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02012: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("You must enter a number in the Payment Info ID field."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02013: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("You must enter a number in the Quantity field."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02014: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("The date in the Expiration Date field must be in the format mmyyyy"), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02015: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("The value in the Item Unit Price field is not valid. Enter a number instead."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02016: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("The date in the Order Date field must be in the format yyyyMMddHHmmss"), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02017: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("Update the Expiration Date information in your account and try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT02018: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("The Zip code is incorrect. Try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
		
		
        PMT03000: {
            dialog: true, 
            title: $L("Transaction Error"), 
            message: $L("Update your credit card information in Preferences & Accounts and try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT03001: Utilities.CommonErrors._PMTGroupErrors.PMT_0,
        PMT03002: {
            dialog: true, 
            title: $L("Payment Failed"), 
            message: $L("We cannot perform financial transactions in your country."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT03003: Utilities.CommonErrors._PMTGroupErrors.PMT_0,
        PMT03006: {
            dialog: true, 
            title: $L("Payment Failed"), 
            message: $L("The last transaction failed. Update the payment information in your account and try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT03007: {
            dialog: true, 
            title: $L("Couldn't Update"), 
            message: $L("Credit card information can only be updated after all pending purchases have cleared. Try again after you received receipts for all recent purchases."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
		
        PMT04000: {
            dialog: true, 
            title: $L("Payment Failed"), 
            message: $L("Update the Expiration Date information in your account and try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT04001: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04002: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04004: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04005: Utilities.CommonErrors._PMTGroupErrors.PMT_2,
        PMT04006: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04007: {
            dialog: true, 
            title: $L("Payment Failed"), 
            message: $L("Update the security number and try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT04008: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04009: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        // Per Thieu, PMT04010 is only returned as "data entry" and is not associated with the payment
        PMT04010: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("Update the payment information in your account and try again. {$errCode}"), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT04011: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04012: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04013: Utilities.CommonErrors._PMTGroupErrors.PMT_3,
        PMT04014: Utilities.CommonErrors._PMTGroupErrors.PMT_3,
        PMT04015: Utilities.CommonErrors._PMTGroupErrors.PMT_4,
        PMT04016: Utilities.CommonErrors._PMTGroupErrors.PMT_2,
        PMT04017: {
            dialog: true, 
            title: $L("Payment Failed"), 
            message: $L("There is no payment information associated with your webOS Account. Tap Preferences in the App Menu to set it up.") , 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
		
        PMT04018: Utilities.CommonErrors._PMTGroupErrors.PMT_5,
        PMT04019: Utilities.CommonErrors._PMTGroupErrors.PMT_5,
        PMT04020: Utilities.CommonErrors._PMTGroupErrors.PMT_5,
        PMT04021: {
            dialog: true, 
            title: $L("Transaction Error"), 
            message: $L("A transaction problem has occurred. Update your credit card information in Preferences & Accounts and try again.") , 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
		
        PMT04200: {
            dialog: true, 
            title: $L("Payment Failed"), 
            message: $L("Update your credit card address information and try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT04400: Utilities.CommonErrors._PMTGroupErrors.PMT_3,
        PMT04401: Utilities.CommonErrors._PMTGroupErrors.PMT_3,
        PMT04402: Utilities.CommonErrors._PMTGroupErrors.PMT_4,
        PMT04403: Utilities.CommonErrors._PMTGroupErrors.PMT_2,
        PMT04404: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04405: Utilities.CommonErrors._PMTGroupErrors.PMT_2,
        PMT04406: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04407: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04408: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04409: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04410: Utilities.CommonErrors._PMTGroupErrors.PMT_2,
        PMT04411: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04412: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04413: Utilities.CommonErrors._PMTGroupErrors.PMT_2,
        PMT04414: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT04415: {
            dialog: true, 
            title: $L("Transaction Error"), 
            message: $L("There is a problem with the credit card. Enter a different credit card in Preferences & Accounts and try again. PMT04415") , 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT04416: {
            dialog: true, 
            title: $L("Transaction Error"), 
            message: $L("There may be a problem with the credit card. Enter a different credit card in Preferences & Accounts and try again. PMT04416") , 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT04417: {
            dialog: true, 
            title: $L("Transaction Error"), 
            message: $L("There is a problem with the credit card. Enter a different credit card in Preferences & Accounts and try again. PMT04417") , 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
		
        //DAV failures
        PMT04600: Utilities.CommonErrors._PMTGroupErrors.PMT_7,
        PMT04601: Utilities.CommonErrors._PMTGroupErrors.PMT_7,
        PMT04602: Utilities.CommonErrors._PMTGroupErrors.PMT_7,
        PMT04603: Utilities.CommonErrors._PMTGroupErrors.PMT_7,
        PMT04604: Utilities.CommonErrors._PMTGroupErrors.PMT_7,
        PMT04605: Utilities.CommonErrors._PMTGroupErrors.PMT_7,
        PMT04606: Utilities.CommonErrors._PMTGroupErrors.PMT_7,
        PMT04607: Utilities.CommonErrors._PMTGroupErrors.PMT_7,
        PMT04608: Utilities.CommonErrors._PMTGroupErrors.PMT_7,
        PMT04609: Utilities.CommonErrors._PMTGroupErrors.PMT_7,
        PMT04610: Utilities.CommonErrors._PMTGroupErrors.PMT_7,
        PMT04611: Utilities.CommonErrors._PMTGroupErrors.PMT_7,
        PMT04612: Utilities.CommonErrors._PMTGroupErrors.PMT_7,
		
        // Payment Promo Code failure
        PMTPROMO70010: {
            dialog: true, 
            title: $L("Promo Code"), 
            message: $L("Invalid, unavailable or expired promo code, try to use previous saved code or manually input valid code."), 
            choices: [{
                label: $L("OK"), 
                value: true, 
                type: 'dismiss'
            }]
        },
        
        //DPL failure
        PMT04800: Utilities.CommonErrors._PMTGroupErrors.PMT_6,
		
        // Operator Billing
		
        PMT03027: {
            dialog: true, 
            title: $L("Updating or removing account is not allowed because there are still pending orders using this account"), 
            message: $L("Your account cannot be updated at this time. Please try again later."), 
            choices: Utilities.ErrorChoices.simpleOKChoices, 
            failoverNotAllowed: true
        },
		
        PMT03028: Utilities.CommonErrors.OBCarrierNotSupported,

        PMT03031: {
            dialog: true, 
            title: $L("Order not accepted because there is a pending order for the same item"), 
            message: $L("This item is already in the process of being purchased. Please wait for the transaction to complete."), 
            choices: Utilities.ErrorChoices.simpleOKChoices, 
            failoverNotAllowed: true
        },

        PMT03037: {
            dialog: true, 
            title: $L("Item already purchased"), 
            message: $L("This item has already been purchased. Your account won't be charged again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices, 
            failoverNotAllowed: true
        },
	
        PMT05205: {
            dialog: true, 
            title: $L("Transaction failed"), 
            message: $L("This item's price exceeds your spending limit. Please pay with a credit card."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT05206: {
            dialog: true, 
            title: $L("Transaction failed"), 
            message: $L("Your {$carrierName} account's settings do not allow you to purchase items with your {$carrierName} account. Please pay with a credit card."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT05208: {
            dialog: true, 
            title: $L("Transaction failed"), 
            message: $L("You do not have an active account with {$carrierName}. Try paying with a credit card."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT05210: {
            dialog: true, 
            title: $L("Wireless subscriber has run out of prepaid credits"), 
            message: $L("This item's price exceeds your carrier account balance. Please pay with a credit card."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT05213: {
            dialog: true, 
            title: $L("Carrier not supported"), 
            message: $L("{$carrierName} does not support payments. Please pay with a credit card."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT05215: Utilities.CommonErrors.OBCarrierNotSupported,
        PMT05216: {
            dialog: true, 
            title: $L("Transaction failed"), 
            message: $L("You do not have an active account with {$carrierName}. Try paying with a credit card."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT05217: Utilities.CommonErrors.OBCarrierNotSupported,
        PMT05204: {
            dialog: true, 
            title: $L("Transaction failed"), 
            message: $L("You do not have an active account with {$carrierName}. Try paying with a credit card."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT05211: {
            dialog: true, 
            title: $L("Wireless subscriber not eligible for premium billing"), 
            message: $L("{$carrierName} does not allow you to purchase items using with your {$carrierName} account. Please pay with a credit card."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT05212: {
            dialog: true, 
            title: $L("Transaction failed"), 
            message: $L("You do not have an active account with {$carrierName}. Try paying with a credit card."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
		
        "inprogress": {
            dialog: true, 
            title: $L("Transaction in Progress"), 
            message: $L("The transaction is still being processed. Try to download the app in a few minutes. You will not be charged again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices, 
            failoverNotAllowed: true
        },

        "nowan": {
            dialog: true, 
            title: $L("No Carrier Data Connection"), 
            message: $L("You must be connected to {$carrierName} to pay with your carrier account. Connect and try again. Or, pay with credit card."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },

		
        //Mod10 failure
        PMT02019: {
            dialog: true, 
            title: $L("Card validation"), 
            message: $L("Please verify that the credit card number and payment type are set correctly."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
		
        PMT51004: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
        PMT51005: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
		
        LOCL0001: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("The address is incomplete. Verify that you've entered your complete address."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        LOCL0002: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("The payment information is incomplete. Verify that you've entered your payment information completely.") , 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        LOCL0003: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("Please only enter numbers (0-9) in the account number."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        LOCL0004: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("Choose a card type."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        LOCL0005: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("You must enter a phone number in the Phone Number field."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        LOCL0006: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("Verify your billing information. It is incomplete."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        LOCL0007: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("Verify your account information. It is incomplete or incorrect."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        LOC02020: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("The first name is too long (must be less than 60 characters). Try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        LOC02021: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("The last name is too long (must be less than 60 characters). Try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        LOC02018: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("The Zip code is incorrect. Try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        LOC02019: {
            dialog: true, 
            title: $L("Data Entry"), 
            message: $L("The Postal code is incorrect. Try again."), 
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        // ValidateInstallSpace errors
        //
        // only one - "catch all" case for one and multiple apps case
        "validate_space_default_single": {
            dialog: true, 
            title: $L("Cannot Install"), 
            message: $L("This app requires {$installSize}. You must delete some apps or files before you can install it. Click Help for more information.") , 
            choices:[{
                label: $L("Help"), 
                value: "help", 
                type: 'primary'
            }, {
                label: $L("OK"), 
                value: "ok", 
                type: 'secondary'
            }]
        },
        "validate_space_default_mult": {
            dialog: true, 
            title: $L("Cannot Install"), 
            message: $L("{$installSize} is required to install everything. You can install apps one at a time, or delete apps or files to make room. Click Help for more information.") , 
            choices:[{
                label: $L("Help"), 
                value: "help", 
                type: 'primary'
            }, {
                label: $L("OK"), 
                value: "ok", 
                type: 'secondary'
            }]
        },
		
		
        // install errors
        //
        "install_revert_failed" : {
            dialog: true, 
            title: $L("Can't Restore"), 
            message: $L("The original version couldn't be installed because there is not enough space. Delete some apps or files and try again."), 
            choices: [{
                label: $L("OK"), 
                value: true, 
                type: 'dismiss'
            }]
        },
        "install_revert_default": {
            dialog: true, 
            title: $L("Couldn'ttInstall"), 
            message: $L("The {$title} update can not be installed and current version is unusable. Please restore the original version."), 
            choices:[{
                label: $L("Restore Now"), 
                value: "revert", 
                type: 'primary'
            }]
        },
        "install_default": {
            dialog: true, 
            title: $L("Couldn't Install"), 
            message: $L("There was a problem installing the application"), 
            choices:[{
                label: $L("Try Again"), 
                value: "retry", 
                type: 'primary'
            }, {
                label: $L("Don't Install"), 
                value: "cancel", 
                type: 'dismiss'
            }]
        },
        "FAILED_NOT_ENOUGH_TEMP_SPACE": {
            dialog: true, 
            title: $L("Couldn't Install"), 
            message: $L("This app requires {$installSize}. You must delete some apps or files before you can install it. Click Help for more information.") , 
            choices:[{
                label: $L("Help"), 
                value: "help", 
                type: 'primary'
            }, {
                label: $L("OK"), 
                value: "cancel", 
                type: 'secondary'
            }]
        },
        "FAILED_NOT_ENOUGH_INSTALL_SPACE": {
            dialog: true, 
            title: $L("Couldn't Install"), 
            message: $L("This app requires {$installSize}. You must delete some apps or files before you can install it. Click Help for more information.") , 
            choices:[{
                label: $L("Help"), 
                value: "help", 
                type: 'primary'
            }, {
                label: $L("OK"), 
                value: "cancel", 
                type: 'secondary'
            }]
        },
		
        // below errors fall into default case
        // FAILED_PACKAGEFILE_NOT_FOUND, FAILED_PACKAGEFILE_CORRUPT, FAILED_CREATE_TMP, FAILED_VERIFY, FAILED_IPKG_INSTALL
	
	
        // Download errors that can be returned when response.completed == false
        // contains a lot of HTTP errors as well like 404
        //
        "download_default": {
            dialog: true, 
            title: $L("Download Error"), 
            message: $L("There was a problem downloading the application."), 
            choices:[{
                label: $L("Try Again"), 
                value: "retry", 
                type: 'primary'
            }, {
                label: $L("Don't Download"), 
                value: "cancel", 
                type: 'dismiss'
            }]
        },
        "-3": {
            dialog: true, 
            title: $L("Download Error"), 
            message: $L("The download file is missing or damaged."), 
            choices:[{
                label: $L("Try Again"), 
                value: "retry", 
                type: 'primary'
            }, {
                label: $L("Don't Download"), 
                value: "cancel", 
                type: 'secondary'
            }]
        },
        "-2": {
            dialog: true, 
            title: $L("Download Error"), 
            message: $L("The download file is missing or damaged."), 
            choices:[{
                label: $L("Try Again"), 
                value: "retry", 
                type: 'primary'
            }, {
                label: $L("Don't Download"), 
                value: "cancel", 
                type: 'secondary'
            }]
        }
    }
});


