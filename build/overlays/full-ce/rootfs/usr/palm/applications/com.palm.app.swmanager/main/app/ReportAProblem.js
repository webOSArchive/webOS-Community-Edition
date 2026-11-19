enyo.kind({
    kind: "VFlexBox",
    name: "swmanager.ReportAProblem",
    published: {
        app: null
    },
    className: "enyo-bg",
    events: {
        onCancel: ""
    },
    components: [
    {
        kind: "Scroller", 
        name: "scroller", 
        flex: 1, 
        components: [

        {
            kind:"VFlexBox", 
            className:"box-center", 
            components: [

            {
                kind: "HFlexBox", 
                pack: "center", 
                align: "center", 
                style: "padding-top: 1em;", 
                components: [

                {
                    kind: "Image", 
                    name: "app_icon", 
                    style: "max-width: 64px; max-height: 64px;"
                }, 

                {
                    kind: "VFlexBox", 
                    style: "padding-left: 1em", 
                    components: [

                    {
                        name: "app_name", 
                        className: "appTitle"
                    }, 

                    {
                        name: "app_vendor", 
                        className: "appVendor"
                    }
                    ]
                }
                ]
            }, 

            {
                content: $L("Report a problem with this application. Describe how to reproduce the problem."), 
                className: "enyo-paragraph"
            },

            {
                kind: "RowGroup", 
                caption: $L("Problem Type"), 
                width: "25em", 
                components: [

                {
                    kind: "ListSelector", 
                    name: "nameSelector", 
                    width: "100%", 
                    value: "1", 
                    items: [

                    {
                        caption: $L("Bug"), 
                        value: "1"
                    },

                    {
                        caption: $L("Offensive Content"), 
                        value: "2"
                    },

                    {
                        caption: $L("Download"), 
                        value: "5"
                    },

                    {
                        caption: $L("Installation"), 
                        value: "6"
                    },

                    {
                        caption: $L("Payment"), 
                        value: "7"
                    },

                    {
                        caption: $L("Legal Issue"), 
                        value: "3"
                    },

                    {
                        caption: $L("Other"), 
                        value: "4"
                    }
                    ]
                }
                ]
            },

            {
                kind: "RowGroup", 
                width: "25em", 
                components: [{
                    kind: "RichText",
                    richContent: false,
                    name: "descriptionInput", 
                    style: "min-height:240px;", 
                    hint: $L("Tap here to begin typing")
                }
                ]
            },
            ]
        },
        ]
    },

    {
        kind: "Toolbar", 
        className:"enyo-toolbar-light", 
        style: "width: 100%", 
        pack: "center", 
        align: "center", 
        components: [

        {
            kind: "Button", 
            name: "sendReportButton", 
            caption: $L("Cancel"), 
            className: "enyo-button-light wide-button left", 
            onclick: "onClickCancel"
        },

        {
            kind: "Button", 
            name: "cancelReportButton", 
            caption: $L("Send"), 
            className: "enyo-button-dark wide-button right", 
            onclick: "onClickSubmit"
        }
        ]
    },

    //Error dialog

    {
        kind: "Error", 
        onSubmit: "submitError", 
        onCancel: "cancelError"
    }, 

    {
        kind: "Popup", 
        name: "alertPrompt", 
        components: [

        {
            name: "alertTitle", 
            content: ""
        },

        {
            name: "alertMessage", 
            content: ""
        },

        {
            kind: "Button", 
            className: "enyo-button-light", 
            value: "ok", 
            caption: $L("Close"), 
            onclick: "dismissAlertPopup"
        }
        ]
    }],
    
    create: function(){
        this.inherited(arguments);
        var accntInfo = findApps.AccountServices.getInstance().getAccountInfo({
            onSuccess: "accountInfoSuccess", 
            onFailure: "accountInfoFailure", 
            scope: this
        });
        if (accntInfo) {
            this.accountInfoSuccess(null, accntInfo);
        }
    },
    refresh: function(){
        // Set auto focus
        if(!this.$.descriptionInput.hasFocus()) {
            this.$.descriptionInput.forceFocus();
        }
    },
    renderApp: function(){
        this.$.app_icon.setSrc(this.app.icon);
        this.$.app_name.setContent(this.app.title);
        this.$.app_vendor.setContent(this.app.vendor);
        
        // Select the default problem type: Bug
        this.$.nameSelector.setValue(1);
        // Show empty text
        this.$.descriptionInput.setValue("");
        // Set auto focus
        if(!this.$.descriptionInput.hasFocus()) {
            this.$.descriptionInput.forceFocus();
        }
    },
    
    appChanged: function(oldData){
        this.renderApp();
    },
    
    onClickSubmit: function(){
        this.problemDesc = this.$.descriptionInput.getValue();
        this.problemType = this.$.nameSelector.getValue();
        this.$.sendReportButton.disabled = true;
        this.$.sendReportButton.addClass('enyo-button-disabled');
        findApps.BaseServer.getACServer().reportProblem(null, this.app.publicApplicationId, this.problemDesc, 0, "en_US", this.name, false, true, this.problemType, "ReportProblemService", {
            onSuccess: "handleServerResponse",
            onFailure: "handleServerError",
            scope: this
        });
    },
    onClickCancel: function(inSender, inEvent){
        this.doCancel(inEvent);
    },
    formatDate: function(dateString){
        var dateObj = new Date(dateString);
        return (dateObj.getMonth() + 1) + "/" + dateObj.getDate() + "/" + dateObj.getFullYear();
    },
    
    
    displayError: function(msg){
        this.$.error.displayError(msg);
    },
    // Error dialog methods
    submitError: function(){
        this.$.error.cancel();
    },
    cancelError: function(){
        this.$.error.cancel();
    },
    
    // Server callback methods
    accountInfoSuccess: function(inSender, accountInfo){
        // Store the account info in the global object
        if (findApps.BaseServer.getAccountInfo() == null) 
            findApps.BaseServer.setAccountInfo(accountInfo);
    // this.setNameOptions();
    },
    accountInfoFailure: function(inSender, inResponse){
        // this.setNameOptions();
        this.error("SWM: ReportAProblem Could not fetch accountinfo. getAccountInfo failure: ", inResponse);
    },
    handleServerResponse: function(inSender, inItem, inResponse, inRequest){
        this.$.sendReportButton.disabled = false;
        this.$.sendReportButton.removeClass('enyo-button-disabled');
        if (inResponse.JSONException) {
            this.showAlertPopup($L("Error"), $L("Could not submit your report at this time. Try again later."));
        }
        else {
            this.doCancel();
        }
        
    },
    handleServerError: function(inSender, inItem, inResponse, inRequest){
        this.$.sendReportButton.disabled = false;
        this.$.sendReportButton.removeClass('enyo-button-disabled');
        this.showAlertPopup($L("Error"), $L("Could not submit  at this time. Try again later."));
    },
    showAlertPopup: function(title, message){
        // From enyo 0.10, the Popup was created lazily by default, so run open() first, so sub-components were created,
        // then we can set the content for the sub-components.
        this.$.alertPrompt.openAtCenter();
        this.$.alertTitle.setContent(title);
        this.$.alertMessage.setContent(message);
    },
    dismissAlertPopup: function(){
        this.$.alertPrompt.close();
    }
    
})
