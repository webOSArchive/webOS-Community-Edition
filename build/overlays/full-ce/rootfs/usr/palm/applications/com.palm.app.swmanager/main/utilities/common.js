enyo.kind ({
    name: "commonHandler",
    kind:enyo.Component,
    handleCommand: function(event, app)
    {
        var url = this._generateAppURL(app);
        if (url) {
            switch(event) {
                case "email":
                    var params = 
                    {
                        summary: $L("Check out this webOS app"),
                        text: this._generateEmailMessageText(app, url)
                    }
                    findApps.ApplicationManager.getInstance().launchApplication("com.palm.app.email", params, "emailLaunchSuccess", "emailLaunchFailure");
                    break;
                case "text":
                    var params = 
                    {
					
                        messageText: this._generateSMSMessageText(app, url)
                    }
                    findApps.ApplicationManager.getInstance().launchApplication("com.palm.app.enyo-messaging", params, "smsLaunchSuccess", "smsLaunchFailure");
                    break;
            }
        }
 		
    },
    smsLaunchSuccess: function() {
    }
    ,
    smsLaunchFailure: function() {
    }
    ,
    emailLaunchSuccess: function() {
    }
    ,
    emailLaunchFailure: function() {
    }
    ,
    _generateAppURL: function(appDetail) 
    {
        if (appDetail && appDetail.publicApplicationId && appDetail.id) 
        {
            return "http://developer.palm.com/appredirect/?packageid=" + appDetail.publicApplicationId + "&applicationid=" + appDetail.id;
        }
        else 
        {
            return null;
        }
    },
	
    _generateEmailMessageText: function(appDetail, url) 
    {
		
        var shareData = {
            appURL: url
        };
        if (appDetail && appDetail.title)
        {
            shareData.title = appDetail.title;
        } 
        else
        {
            shareData.title = url;
        }
		
		
        return(enyo.macroize($L("Here's an app I think you'll like:  <a href=\"{$appURL}\"> {$title}"),
        {
            appURL:url,
            title:appDetail.title
        }));
    },
	
    _generateSMSMessageText: function(appDetail, url)
    {
        var appTitle = url;
		
        if (appDetail && appDetail.title)
        {
            appTitle = appDetail.title;
        }
		
        //return $L("Check out #{title}: #{url}").interpolate({title: appTitle, url: url});
        return enyo.macroize($L("Check out {$title}: {$url}"),{
            title: appTitle, 
            url: url
        });
    },
	
    _handleEmbargoAcc: function(edit, callback)
    {
        var self = this;
		
		
        if (!edit && myProfile.isEmbargoed) {
            self.OnSubmit = function(){
                self.$.error.cancel();
                self.$.error.destroy();
                findApps.ApplicationManager.getInstance().openApplication('com.palm.app.help', {
                    target: online ? 'http://help.palm.com/app_catalog/appcatalog_download_error.html' : 'no-network'
                });
            }
            self.OnCancel = function(){
                self.$.error.cancel();
                self.$.error.destroy();
				
				
            };
            self.createComponent({
                name: "error",
                kind: "Error",
                onSubmit: "OnSubmit",
                owner: self
            });
			
			
            self.$.error.displayError("PMT_cant_download", {}, "PMT_cant_download", null, null);
			
			
        }
        else {
            callback(edit);
        }
			
			
		
    },
	
    capWords: function(word){
        var words = word.split(" "); 
        for (var i=0 ; i < words.length ; i++){ 
            words[i] = words[i].capitalize(); 
        } 
        return words.join(" "); 
    },
	
    filterSpace: function(value) {
        if(value === Mojo.Char.spaceBar) {
            return false;
        }			
        return true;
    },
	
    //check whether JSON object is empty
    isEmpty: function(jsonObj){
        for(prop in jsonObj){
            return false;
        }
        return true;
    },
	
    // Date formatter and timezone localization, for example: "20101230122331" --> "Dec 30, 2010"
    formatDateStr: function(dateRawStr) {
        if(!dateRawStr || dateRawStr.length<8) {
            return "";
        }
		
        var year = dateRawStr.substr(0,4);
        var month = dateRawStr.substr(4,2);
        var day = dateRawStr.substr(6,2);
        var hour = dateRawStr.substr(8,2);
        var min = dateRawStr.substr(10,2);
        var sec = dateRawStr.substr(12,2)
        var dateObj = new Date(year, month-1, day, hour, min, sec);
        var dateObjTime = dateObj.getTime();
		
        // change to local timezone
        var clDate = new Date();
        localOffset = clDate.getTimezoneOffset() * 60000;
        var ld = new Date(dateObjTime - localOffset);
		
        return enyo.date.format(ld, "MMM d, yyyy");
    }
	
});

var Utilities = Utilities || {};
Utilities.CommonHandler = Utilities.CommonHandler || new commonHandler();

Utilities.Formatter = {

    formatCurrency: function(amount, locale){
        if (typeof(Utilities.Formatter._currencyFmt) === 'undefined' || locale !== Utilities.Formatter.purchasingLocale){
            Utilities.Formatter._currencyFmt = new enyo.g11n.NumberFmt({
                locale: locale, 
                fractionDigits: 2, 
                style: "currency"
            });
            Utilities.Formatter.purchasingLocale = locale;
        }
        return Utilities.Formatter._currencyFmt.format(amount, {
            style: "currency"
        });
    },
		
    formatLongDate: function(date){
        if (typeof(Utilities.Formatter._longDateFmt) === 'undefined'){
            Utilities.Formatter._longDateFmt = new enyo.g11n.DateFmt({
                date: "long"
            });
        }
        return Utilities.Formatter._longDateFmt.format(date);
    },
		
    formatShortDate: function(date){
        if (typeof(Utilities.Formatter._shortDateFmt) === 'undefined'){
            Utilities.Formatter._shortDateFmt = new enyo.g11n.DateFmt({
                date: "short"
            });
        }
        return Utilities.Formatter._shortDateFmt.format(date);
    },
		
    formatRound: function(number){
        if(typeof(Utilities.Formatter._roundFmt) === 'undefined'){
            Utilities.Formatter._roundFmt = new enyo.g11n.NumberFmt({
                fractionDigits: 1
            });
        }
        return Utilities.Formatter._roundFmt.format(number);
    },
		
    formatRound2: function(number){
        if(typeof(Utilities.Formatter._roundFmt) === 'undefined'){
            Utilities.Formatter._roundFmt = new enyo.g11n.NumberFmt({
                fractionDigits: 2
            });
        }
        return Utilities.Formatter._roundFmt.format(number);
    },
		
    formatPercent: function(number){
        if(typeof(Utilities.Formatter._percentFmt) === 'undefined'){
            Utilities.Formatter._percentFmt = new enyo.g11n.NumberFmt({
                style: "percent"
            });
        }
        if(!number || number==undefined)
            number = 0;
        return Utilities.Formatter._percentFmt.format(number, {
            style: "percent"
        });
    },
		
    serverTimeFormat: function(date){
        if(typeof(Utilities.Formatter._serverFmt) === 'undefined'){
            Utilities.Formatter._percentFmt = new enyo.g11n.DateFmt("yyyyMMddHHmmss");
        }
        return Utilities.Formatter._percentFmt.format(date);
    }
    ,
    getFullYear: function(date) {
        if(typeof(Utilities.Formatter._dateFullYear) === 'undefined'){
            Utilities.Formatter._dateFullYear = new enyo.g11n.DateFmt("yyyy");
        }
        return Utilities.Formatter._dateFullYear.format(date);
    }
    ,
    getLongMonth: function(date) {
        if(typeof(Utilities.Formatter._dateMonth) === 'undefined'){
            Utilities.Formatter._dateMonth = new enyo.g11n.DateFmt("MMM");
        }
        return Utilities.Formatter._dateMonth.format(date);
    },
    formatPhoneNumber: function(phoneNumber) {
        if(typeof(Utilities.Formatter._phoneFmt) === 'undefined'){
            Utilities.Formatter._phoneFmt = new enyo.g11n.PhoneFmt();
        }
        return Utilities.Formatter._phoneFmt.format(phoneNumber);
			
    },
    getShortMonth: function(date, format) {
        if(typeof(Utilities.Formatter._dateShortMonth) === 'undefined'){
            Utilities.Formatter._dateShortMonth = new enyo.g11n.DateFmt("MM");
        }
        return Utilities.Formatter._dateShortMonth.format(date);
    }
		
};

CommonUtil = {
    oneSecond: 1000,
    oneMinute: 1000 * 60,
    oneHour: 1000 * 60 * 60,
    oneDay: 1000 * 60 * 60 * 24,
    
    formatStar: function(halfstars, idx) {
        halfstars -= 2 * idx;
        if (halfstars > 0) {
            if (halfstars > 1) {
                return 'full';
            } else {
                return 'half';
            }
        } else {
            return 'empty';
        }
    },
    contains: function(arr, val) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] == val) return true;
        }
        return false;
    },
    //this function is convert array of objects to a Map (associative array)
    array2Map: function(arr, mapKey) {
        var map = [];
        if (arr && arr.length) {
            for (var i=0;i<arr.length;i++) {
                var obj = arr[i];
                map[obj[mapKey]] = obj;
            }
        }
        return map;
    },
    findFirstMatch: function(map, keyArr){
        var match;
        var l = keyArr.length;
        for(var i=0;((i<l)&&!match);i++){
            match = map[keyArr[i]];
        }
        return match;
    },
    
    /**
     * best performance, collisions are likely to occure
     */
    getUUID: function(){
        return new Date().getTime() + Math.floor(Math.random()*0x1000000);
    },
    
    /**
     * moderate performance, very few collisions
     */
    getUUID2: function(){
        var s = [];
        var hexDigits = "0123456789ABCDEF";
        for (var i = 0; i < 32; i++) {
            s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }
        s[12] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
        s[16] = hexDigits.substr((s[16] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
        var uuid = s.join("");
        return uuid;
    },
    
    /**
     * poor performance, collision chance is 1 in 2^^122
     */
    getUUID3: function(){
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    },
    
    getHashCode: function(str){
        var hash = 0;
        if (str.length == 0) return hash;
        for (var i=0;i<str.length;i++) {
            var ch = str.charCodeAt(i);
            hash = ((hash<<5)-hash)+ch;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    },
    getRandNumber: function() {
        return this.getUUID();
    },
    delFunc: function(scope, name, rand) {
        if (typeof scope[name + rand] === 'function') {
            delete scope[name + rand];
        }
    }
};