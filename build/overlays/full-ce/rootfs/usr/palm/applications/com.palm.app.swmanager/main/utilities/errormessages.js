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
    }],
    simpleRetryChoices: [{
        label: $L("Retry")
    }]
};
enyo.kind({
    name: "CommonErrors",
    kind: enyo.Component,
    components: [],
    _PMTGroupErrors: {
        PMT_0: {
            dialog: true,
            title: $L("Payment Type"),
            message: $L("You can only pay with a credit card. Update your account information in Preferences & Accounts and try again. {$errCode}"),
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
            message: $L("CyberSource refused your payment. {$errCode}"),
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT_4: {
            dialog: true,
            title: $L("Payment Failed"),
            message: $L("You are not permitted to purchase items in the App Catalog. {$errCode}"),
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT_5: {
            dialog: true,
            title: $L("Transaction Error"),
            message: $L("The credit card you are using may be fraudulent. Enter a different credit card in Preferences & Accounts and try again. {$errCode}"),
            choices: Utilities.ErrorChoices.simpleOKChoices
        },
        PMT_6: {
            dialog: true,
            title: $L("Can't Purchase"),
            message: $L("The United States Government prohibits HP from allowing you to purchase applications."),
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
            message: $L("The address you entered cannot be found. Verify that the address you entered is correct, and is in the Billing Country you have chosen."),
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
    },
    catchAllDialog: {
        dialog: true,
        title: $L("Unexpected problem"),
        message: $L("App Catalog could not complete the last action you performed. Please try again later."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    catchAllFullPage: {
        page: true,
        title: $L("Unexpected problem"),
        message: $L("The action could not be completed.<br/>Try again later."),
        choices: Utilities.ErrorChoices.simpleRetryChoices
    }
});
Utilities.CommonErrors = new CommonErrors();
Utilities._dialogErrors = {
    //ErrorCodes are listed at the bottom of this wiki page
    //ACS 1.0
    //https://subversion.palm.com/websvn/filedetails.php?repname=services&path=%2FPalmWebServices%2Ftrunk%2FAppCatalog%2FAppCatalogServiceCore%2Fsrc%2Fmain%2Fjava%2Fad_applicationContext.xml
    //ACS 2.0
    //https://ps.qa.palm.com/appcatalog/2.0/support/errorCodes
    //PMT - Promo
    //https://subversion.palm.com/websvn/filedetails.php?repname=services&path=%2FPalmCommerceServices%2Ftrunk%2FCommercePromo%2Fsrc%2Fmain%2Fresources%2Ferrorcode.properties
    //PMT - Core
    //https://subversion.palm.com/websvn/filedetails.php?repname=services&path=%2FPalmCommerceServices%2Ftrunk%2FCommerceCore%2Fsrc%2Fmain%2Fresources%2Ferrorcode.properties
    //In App
    //https://subversion.palm.com/websvn/filedetails.php?repname=services&path=%2FItemCatalogServices%2Ftrunk%2FItemCatalogCore%2Fsrc%2Fmain%2Fresources%2Ferrorcode.properties
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
        message: $L("You can't set up an account. The United States Government prohibits HP from allowing you to purchase applications.")
    },
    // TODO get the final text from product/marketing
    noPaymentTypeSupported: {
        page: true,
        message: $L("There are no payment types available for this profile")
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
        incompatible_page: true,
        message: $L("This is not a valid webOS application.")
    },
    DISC0056: {
        incompatible_page: true,
        message: $L("This is not a valid webOS application.")
    },
    DISC0124: {
        incompatible_page: true,
        message: $L("This application is not available for your model.")
    },
    DISC0125: {
        incompatible_page: true,
        message: $L("This application is not available for your carrier.")
    },
    DISC0201: {
        incompatible_page: true,
        message: $L("This application is not available in your country.")
    },
    DISC0202: {
        incompatible_page: true,
        message: $L("This application is not available for your model.")
    },
    DISC0203: {
        incompatible_page: true,
        message: $L("This application cannot run on your current operating system. Use the Updates app to install the system update and try again.")
    },
    // Catch all dialog error
    catchAllDialog: Utilities.CommonErrors.catchAllDialog,
    // no network dialog
    noNetwork: {
        page: true,
        title: $L("No Internet Connection"),
        message: $L("You must connect to a network to use this application."),
        choices: Utilities.ErrorChoices.simpleRetryChoices
    },
    // exceptions thrown when getting server response
    RESP0001: {
        dialog: true,
        title: $L("Server Exception"),
        message: $L("XHR Status Code is not 200"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    RESP0002: {
        dialog: true,
        title: $L("Server Exception"),
        message: $L("Exception thrown by the server"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    RESP0003: {
        dialog: true,
        title: $L("Server Exception"),
        message: $L("Empty Response. Connection timed out"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    RESP0004: {
        dialog: true,
        title: $L("Server Exception"),
        message: $L("Empty Response. Connection did not time out"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    RESP0005: {
        dialog: true,
        title: $L("Server Exception"),
        message: $L("Response Status code was not OK"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    RESP0006: {
        dialog: true,
        title: $L("Server Exception"),
        message: $L("General server exception thrown"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    RESP0007: {
        dialog: true,
        title: $L("Server Exception"),
        message: $L("Response xhr status code was non-200"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    RESP0008: {
        dialog: true,
        title: $L("Server Exception"),
        message: $L("General server exception thrown"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    RESP0009: {
        reuseDefinition: "RESP0002"
    },
    RESP0010: {
        reuseDefinition: "RESP0001"
    },
    RESP0011: {
        reuseDefinition: "RESP0003"
    },
    RESP0012: {
        reuseDefinition: "RESP0004"
    },
    RESP0013: {
        reuseDefinition: "RESP0005"
    },
    // payment errors
    PMT_catchAll: {
        dialog: true,
        title: $L("Unexpected problem"),
        message: $L("App Catalog could not complete the last action you performed. Try again later. {$errCode}"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    PMT_addCC_default: {
        dialog: true,
        title: $L("Couldn't Add Credit Card"),
        message: $L("A problem occurred when adding your credit card information. Try again later. {$errCode}"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    PMT_modifyCC_default: {
        dialog: true,
        title: $L("Couldn't Update"),
        message: $L("The credit card information could not be updated. Try again later. {$errCode}"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    PMT_removeCC_default: {
        dialog: true,
        title: $L("Couldn't Remove"),
        message: $L("The credit card was not removed from your account. Try again later. {$errCode}"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    PMT_purchase_default: {
        dialog: true,
        title: $L("Couldn't Purchase"),
        message: $L("The item could not be purchased. Try again later. {$errCode}"),
        choices: Utilities.ErrorChoices.tryCCChoices
    },
    PMT_cant_download: Utilities.CommonErrors._PMTGroupErrors.PMT_6,
    PMT_cant_download_encrypted: {
        dialog: true,
        title: $L("Can't Download"),
        message: $L("The United States Government prohibits HP from allowing you to download this application."),
        choices: [{
            label: $L("Help"),
            value: "help",
            type: 'primary'
        }, {
            label: $L("OK"),
            value: true,
            type: 'dismiss'
        }]
    },
    PMT_cant_purchase: Utilities.CommonErrors._PMTGroupErrors.PMT_6,
    PMT02000: {
        dialog: true,
        title: $L("Error"),
        message: $L("You cannot purchase items via your Carrier Account. Please use a credit card instead."),
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
        message: $L("There is no payment information associated with your webOS Account. Tap Preferences in the App Menu to set it up."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    PMT04018: Utilities.CommonErrors._PMTGroupErrors.PMT_5,
    PMT04019: Utilities.CommonErrors._PMTGroupErrors.PMT_5,
    PMT04020: Utilities.CommonErrors._PMTGroupErrors.PMT_5,
    PMT04021: {
        dialog: true,
        title: $L("Transaction Error"),
        message: $L("A transaction problem has occurred. Update your credit card information in Preferences & Accounts and try again."),
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
        message: $L("There is a problem with the credit card. Enter a different credit card in Preferences & Accounts and try again. PMT04415"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    PMT04416: {
        dialog: true,
        title: $L("Transaction Error"),
        message: $L("There may be a problem with the credit card. Enter a different credit card in Preferences & Accounts and try again. PMT04416"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    PMT04417: {
        dialog: true,
        title: $L("Transaction Error"),
        message: $L("There is a problem with the credit card. Enter a different credit card in Preferences & Accounts and try again. PMT04417"),
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
        choices: Utilities.ErrorChoices.simpleOKChoices
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
    PMT04022: {
        dialog: true,
        title: $L("Invalid Information"),
        message: $L("Your credit card Security Code is incorrect. Please enter it, as it appears on your credit card."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    PMT04023: {
        dialog: true,
        title: $L("Invalid Information"),
        message: $L("Your First Name is incorrect. Please enter it, as it appears on your credit card."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    PMT04024: {
        dialog: true,
        title: $L("Invalid Information"),
        message: $L("Your Last Name is incorrect. Please enter it, as it appears on your credit card."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    PMT04025: {
        dialog: true,
        title: $L("Invalid Information"),
        message: $L("Please enter a valid phone number."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    PMT04026: {
        dialog: true,
        title: $L("Invalid Information"),
        message: $L("The City listed in your Billing Address is invalid. Please check it and try again."),
        choices: Utilities.ErrorChoices.simpleOKChoices
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
    //LOC01xxx - errors
    //LOC02xxx - PreferencesView, Payment
    //LOC03xxx - AppCatalogLauncher
    //LOC04xxx - downloadstates / genericdownloadbutton
    //LOC05xxx - Magazine
    //LOC06xxx - Browser
    //LOC07xxx - Details
    //LOC08xxx - Search
    //LOC09xxx - Bookmarks
    LOCL0001: {
        dialog: true,
        title: $L("Data Entry"),
        message: $L("The address is incomplete. Verify that you’ve entered your complete address."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    LOCL0002: {
        dialog: true,
        title: $L("Data Entry"),
        message: $L("The payment information is incomplete. Verify that you’ve entered your payment information completely."),
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
    LOCL0008: {
        dialog: true,
        title: $L("Data Entry"),
        message: $L("Please enter your full name, as it appears on your credit card."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    LOCL0009: {
        dialog: true,
        title: $L("Data Entry"),
        message: $L("You must enter data in the correct format in these fields: {$fields}."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    LOCL0010: {
        dialog: true,
        title: $L("Data Entry"),
        message: $L("The Postcode is incorrect. Try again."),
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
    LOC02022: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02023: {
        reuseDefinition: "dplfailed"
    },
    LOC02024: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02025: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02026: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02027: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02028: Utilities.CommonErrors.catchAllFullPage,
    LOC02029: {
        reuseDefinition: "PMT_addCC_default"
    },
    LOC02030: {
        reuseDefinition: "PMT_modifyCC_default"
    },
    LOC02031: {
        reuseDefinition: "PMT_removeCC_default"
    },
    LOC02032: Utilities.CommonErrors.catchAllFullPage,
    LOC02033: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02034: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02035: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02036: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02037: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02038: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02039: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02040: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02041: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02042: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02043: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02044: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02045: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02046: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02047: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02048: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02049: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02050: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02051: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02052: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02053: {
        reuseDefinition: "dplfailed"
    },
    LOC02054: Utilities.CommonErrors.catchAllFullPage,
    LOC02055: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02056: Utilities.CommonErrors.catchAllFullPage,
    LOC02057: {
        reuseDefinition: "PMT_addCC_default"
    },
    LOC02058: {
        reuseDefinition: "PMT_modifyCC_default"
    },
    LOC02059: {
        reuseDefinition: "PMT_removeCC_default"
    },
    LOC02060: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02061: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02062: {
        reuseDefinition: "noPaymentTypeSupported"
    },
    LOC02063: {
        reuseDefinition: "noPaymentTypeSupported"
    },
    LOC02064: {
        reuseDefinition: "failure"
    },
    LOC02065: {
        reuseDefinition: "PMT_cant_download"
    },
    LOC02066: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02067: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02068: Utilities.CommonErrors.catchAllFullPage,
    LOC02069: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02070: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC02071: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC01000: Utilities.CommonErrors.catchAllFullPage,
    LOC01001: Utilities.CommonErrors.catchAllFullPage,
    LOC01002: {
        page: true,
        message: $L("Unknown Error")
    },
    LOC01003: {
        reuseDefinition: "LOC01002"
    },
    LOC03001: Utilities.CommonErrors.catchAllFullPage,
    LOC03002: Utilities.CommonErrors.catchAllFullPage,
    LOC03003: Utilities.CommonErrors.catchAllFullPage,
    LOC03004: Utilities.CommonErrors.catchAllFullPage,
    LOC03005: {
        reuseDefinition: "invalidtoken"
    },
    LOC03006: {
        dialog: true,
        title: $L("Error"),
        message: $L("Fail to get country list from server."),
        choices: [{
            label: $L("Try Again"),
            value: "tryGetCountryList"
        }]
    },
    LOC03007: Utilities.CommonErrors.catchAllDialog,
    // This error is thrown by CountryPicker.js when user/session call fails. Needs to be full page, so that the retry option can be shown
    LOC03008:Utilities.CommonErrors.catchAllFullPage,
    // Full page because this error code is used by PreferenceAccount view when paymenttypes cannot be fetched. Need to be a full page
    // with retry option
    LOC03009:Utilities.CommonErrors.catchAllFullPage,
    LOC04001: Utilities.CommonErrors.catchAllDialog,
    LOC04002: Utilities.CommonErrors.catchAllDialog,
    LOC04003: Utilities.CommonErrors.catchAllDialog,
    LOC04004: Utilities.CommonErrors.catchAllDialog,
    LOC04005: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC04006: {
        reuseDefinition: "PMT_catchAll"
    },
    LOC04007: Utilities.CommonErrors.catchAllDialog,
    LOC04008: {
        reuseDefinition: "PMT_cant_download_encrypted"
    },
    LOC04009: {
        reuseDefinition: "install_revert_default"
    },
    LOC04010: {
        reuseDefinition: "install_default"
    },
    LOC04011: Utilities.CommonErrors.catchAllDialog,
    LOC04012: {
        dialog: true,
        title: $L("Couldn't Purchase"),
        message: $L("The item could not be purchased. Try again later. {$errCode}"),
        choices: Utilities.ErrorChoices.tryCCChoices
    },
    LOC04013: {
        dialog: true,
        title: $L("Couldn't Purchase"),
        message: $L("The item could not be purchased. Try again later. {$errCode}"),
        choices: Utilities.ErrorChoices.tryOBChoices
    },
    LOC04014: {
        dialog: true,
        title: $L("Couldn't Purchase"),
        message: $L("The item could not be purchased. Try again later. {$errCode}"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    LOC04015: {
        reuseDefinition: "download_default"
    },
    LOC04016: {
        reuseDefinition: "inprogress"
    },
    LOC04017: {
        reuseDefinition: "inprogress"
    },
    LOC04018: {
        reuseDefinition: "inprogress"
    },
    LOC04019: {
        reuseDefinition: "inprogress"
    },
    LOC04020: {
        reuseDefinition: "inprogress"
    },
    LOC06001: Utilities.CommonErrors.catchAllDialog,
    LOC06002: Utilities.CommonErrors.catchAllDialog,
    LOC06003: Utilities.CommonErrors.catchAllDialog,
    LOC06004: Utilities.CommonErrors.catchAllDialog,
    LOC06005: Utilities.CommonErrors.catchAllFullPage,
    LOC06006: Utilities.CommonErrors.catchAllFullPage,
    LOC06007: Utilities.CommonErrors.catchAllFullPage,
    LOC06008: Utilities.CommonErrors.catchAllFullPage,
    LOC06009: {
        reuseDefinition: "LOC06004"
    },
    LOC07001: Utilities.CommonErrors.catchAllFullPage,
    LOC07002: {
        page: true,
        title: $L("Error"),
        message: $L("Could not fetch reviews for the Application."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    LOC07003: {
        dialog: true,
        title: $L("Error"),
        message: $L("Could not fetch reviews for the Application."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    LOC07004: Utilities.CommonErrors.catchAllFullPage,
    LOC07005: Utilities.CommonErrors.catchAllFullPage,
    LOC07006: Utilities.CommonErrors.catchAllFullPage,
    LOC07007: Utilities.CommonErrors.catchAllFullPage,
    LOC07100: {
        dialog: true,
        title: $L("Error"),
        message: $L("Could not submit your report at this time. Try again later."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    LOC07101: {
        reuseDefinition: "LOC07100"
    },
    LOC07102: {
        dialog: true,
        title: $L("Image is missing"),
        message: $L("The full-size image cannot be displayed because it cannot be found."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    LOC07200: Utilities.CommonErrors.catchAllDialog,
    LOC08000: Utilities.CommonErrors.catchAllFullPage,
    LOC08001: Utilities.CommonErrors.catchAllFullPage,
    LOC08002: {
        dialog: true,
        title: $L("Error"),
        message: $L("Search was unsuccessful"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    LOC09000: {
        page: true,
        title: $L("Error"),
        message: $L("Error in saved apps"),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    // ValidateInstallSpace errors
    //
    // only one - "catch all" case for one and multiple apps case
    "validate_space_default_single": {
        dialog: true,
        title: $L("Cannot Install"),
        message: $L("This app requires {$installSize}. You must delete some apps or files before you can install it. Click Help for more information."),
        choices: [{
            label: $L("Help"),
            value: "help",
            type: 'primary'
        }, {
            label: $L("OK"),
            value: "ok",
            type: 'dismiss'
        }]
    },
    "validate_space_default_mult": {
        dialog: true,
        title: $L("Cannot Install"),
        message: $L("{$installSize} is required to install everything. You can install apps one at a time, or delete apps or files to make room. Click Help for more information."),
        choices: [{
            label: $L("Help"),
            value: "help",
            type: 'primary'
        }, {
            label: $L("OK"),
            value: "ok",
            type: 'dismiss'
        }]
    },
    // install errors
    //
    "install_revert_failed": {
        dialog: true,
        title: $L("Can't Restore"),
        message: $L("The original version couldn't be installed because there is not enough space. Delete some apps or files and try again."),
        choices: Utilities.ErrorChoices.simpleOKChoices
    },
    "install_revert_default": {
        dialog: true,
        title: $L("Couldn'ttInstall"),
        message: $L("The {$title} update can not be installed and current version is unusable. Please restore the original version."),
        choices: [{
            label: $L("Restore Now"),
            value: "revert",
            type: 'primary'
        }]
    },
    "install_default": {
        dialog: true,
        title: $L("Couldn't Install"),
        message: $L("There was a problem installing the application"),
        choices: [{
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
        message: $L("This app requires {$installSize}. You must delete some apps or files before you can install it. Click Help for more information."),
        choices: [{
            label: $L("Help"),
            value: "help",
            type: 'primary'
        }, {
            label: $L("OK"),
            value: "cancel",
            type: 'dismiss'
        }]
    },
    "FAILED_NOT_ENOUGH_INSTALL_SPACE": {
        dialog: true,
        title: $L("Couldn't Install"),
        message: $L("This app requires {$installSize}. You must delete some apps or files before you can install it. Click Help for more information."),
        choices: [{
            label: $L("Help"),
            value: "help",
            type: 'primary'
        }, {
            label: $L("OK"),
            value: "cancel",
            type: 'dismiss'
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
        choices: [{
            label: $L("Cancel"),
            value: "cancel",
            type: 'dismiss'
        }, {
            label: $L("Try Again"),
            value: "retry",
            type: 'primary'
        }]
    },
    "-3": {
        dialog: true,
        title: $L("Download Error"),
        message: $L("The download file is missing or damaged."),
        choices: [{
            label: $L("Try Again"),
            value: "retry",
            type: 'primary'
        }, {
            label: $L("Cancel"),
            value: "cancel",
            type: 'dismiss'
        }]
    },
    "-2": {
        dialog: true,
        title: $L("Download Error"),
        message: $L("The download file is missing or damaged."),
        choices: [{
            label: $L("Try Again"),
            value: "retry",
            type: 'primary'
        }, {
            label: $L("Cancel"),
            value: "cancel",
            type: 'dismiss'
        }]
    }
};
