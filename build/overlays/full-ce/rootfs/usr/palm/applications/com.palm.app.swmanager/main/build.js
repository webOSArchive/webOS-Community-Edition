// view/SWManager.js

enyo.kind({
name: "swmanager.Main",
kind: "VFlexBox",
className: "swManager",
components: [ {
kind: "ApplicationEvents",
onWindowActivated: "windowActivatedHandler",
onWindowDeactivated: "windowDeactivatedHandler",
onWindowParamsChange: "windowParamsChangeHandler"
}, {
kind: "AppMenu",
components: [ {
kind: "HelpMenu",
target: "http://help.palm.com/softwaremgr/index.html"
} ]
}, {
kind: "Header",
pack: "center",
className: "page-header",
components: [ {
className: "header-icon"
}, {
content: $L("Software Manager"),
style: "padding-left:10px;"
} ]
}, {
name: "appLists",
kind: "findApps.AppLists"
}, {
kind: "Pane",
name: "pane",
flex: 1,
onSelectView: "viewSelected",
components: [ {
name: "main",
flex: 1,
className: "enyo-bg",
kind: "swmanager.MainPage"
}, {
name: "update_apps",
className: "enyo-bg",
kind: "swmanager.Updates",
onCancel: "backHandler",
onAppUpdateClick: "getAppDetails"
}, {
name: "app_details",
className: "enyo-bg",
kind: "swmanager.AppDetails",
onClose: "backHandler"
}, {
name: "report_a_problem",
className: "enyo-bg",
onCancel: "backHandler",
kind: "swmanager.ReportAProblem"
}, {
name: "review_app",
className: "enyo-bg",
onCancel: "backHandler",
kind: "swmanager.Review"
}, {
kind: "swmanager.FatalError",
name: "fatalError"
} ]
}, {
name: "errorDialog",
kind: "Dialog",
components: [ {
name: "errorName",
className: "enyo-item enyo-first",
style: "padding: 12px"
}, {
name: "errorMessage",
className: "enyo-item enyo-last",
style: "font-size: 14px;padding: 12px;"
}, {
kind: "Button",
caption: $L("OK"),
onclick: "toggleError"
} ]
}, {
kind: "Error",
name: "error",
onSubmit: "submitError",
onCancel: "cancelError"
} ],
create: function() {
enyo.application.connectionManager = new findApps.ConnectionManager, enyo.application.connectionManager.monitor(), enyo.application.appdownloadManager = new findApps.AppDownloadManager, enyo.application.appdownloadManager.init(), viewLibrary.setContainer(this), viewLibrary.init(), this.inherited(arguments);
},
destroy: function() {
viewLibrary.cleanup(), delete this.$.appLists, delete this.$.downloadMgr, this.inherited(arguments);
},
windowParamsChangeHandler: function(a, b) {
this.updateView(b.params);
},
windowDeactivatedHandler: function() {},
windowActivatedHandler: function() {},
openAppMenuHandler: function() {
this.$.appMenu.open();
},
closeAppMenuHandler: function() {
this.$.appMenu && this.$.appMenu.close();
},
updateView: function(a) {
a.launchType == "updates" ? viewLibrary.setView("UPDATES") : viewLibrary.getView("MAIN").refresh();
},
setView: function(a) {
this.$.pane.selectViewByName(a);
},
getView: function(a) {
return this.$[a];
},
backHandler: function(a, b) {
if (this.$.pane.getViewIndex() > 0) {
this.$.pane.back(b);
var c = this.$.pane.getView();
c.refresh();
}
b && b.preventDefault();
},
appUpdateDetails: function(a) {
this.$.pane && (this.$.scrim.hide(), this.$.app_update_details.setAppUpdateDetails(a.OutGetAppDetailV2), this.$.pane.selectViewByName("app_update_details"));
},
handleHelpClick: function(a, b) {
this.$.openHelp.call();
},
handleDeletePausedDownloads: function(a, b) {
this.$.update_apps.deletePausedDownload();
},
openAppMenuHandler: function() {
this.$.appMenu.open();
},
closeAppMenuHandler: function() {
this.$.appMenu.close();
},
showUpdates: function() {
this.$.pane && this.$.pane.selectViewByName("update_apps");
},
getAppDetails: function(a, b) {
findApps.ApplicationManager.getInstance().openApplication("com.palm.app.enyo-findapps", {
target: "http://developer.palm.com/appredirect/?packageid=" + b.publicApplicationId
}, !1, "", "");
},
isTopView: function(a) {
var b = !1, c = this.$.pane.view;
return a && (b = a === c), b;
}
});
;
// view/viewLibrary.js

viewLibrary = {
_container: null,
_views: null,
init: function() {
this._views = [], this._views.APPDETAIL = "app_details", this._views.MAIN = "main", this._views.UPDATES = "update_apps", this._views.REVIEW = "review_app", this._views.REPORTPROBLEM = "report_a_problem", this._views.ERROR = "fatalError";
},
setContainer: function(a) {
this._container = a;
},
getAppDownloadManager: function() {
return this._container.$.downloadMgr;
},
getAppLists: function() {
return this._container.$.appLists;
},
getConnectionManager: function() {
return this._container.$.connectionmanager;
},
setView: function(a) {
this._container.setView(this._views[a]), this.getView(a).refresh();
},
getView: function(a) {
return this._container.getView(this._views[a]);
},
popViewsFromHistory: function(a) {
this._container.popViewsFromHistory(a);
},
lauchACDetail: function(a) {
findApps.ApplicationManager.getInstance().openApplication("com.palm.app.enyo-findapps", {
target: "http://developer.palm.com/appredirect/?packageid=" + a
}, !1, "", "");
},
goBack: function() {
this._container.goBack();
},
cleanup: function() {
this._views = null, this._container = null;
}
};
;
// lib/services/systemproperties.js

enyo.kind({
name: "findApps.SystemProperties",
kind: "PalmService",
service: "palm://com.palm.preferences/systemProperties/",
getCarrier: function(a, b) {
var c = {
key: "com.palm.properties.DMCARRIER"
}, d = {
method: "Get",
onSuccess: a,
onFailure: b
};
this.call(c, d);
}
});
;
// lib/services/WebService.js

enyo.kind({
name: "findApps.WebService",
kind: enyo.WebService,
create: function() {
this.inherited(arguments), this.cacheUtil = findapps.CacheUtil.getInstance("com.hp.app.findApps.WebService.", AppCatalog.Config.CacheConfig.persistent), this.cacheUtil.setEnabled(AppCatalog.Config.CacheConfig.enabled);
},
dispatchResponse: function(a, b, c) {
a && a.scope ? this.dispatch(a.scope, a.handler, [ b.response, b, a.props, c ]) : this.dispatch(this.owner, a, [ b.response, b ]);
},
setRequestProps: function(a) {
this.setUrl(a.url), this.setMethod(a.method), this.setHandleAs(a.handleAs), this.setContentType(a.contentType), this.setSync(a.sync), this.setHeaders(a.headers), this.setUsername(a.username), this.setPassword(a.password);
},
sendRequest: function(a) {
this.setRequestProps(a), this.log("Service:", a.service, "URL:", a.url, "Method:", a.method, "Headers:", a.headers, "Body:", a.body, "Expires:", a.expires);
if (a.expires) {
var b = findApps.WebService._generateKey(a), c = this.cacheUtil.get(b);
if (c) {
if (a.scope && a.scope.corelationId) {
var d = c.inRequest.params;
d = d ? enyo.isString(d) ? JSON.parse(d) : d : {}, d.corelationId = a.scope.corelationId, c.inRequest.params = JSON.stringify(d);
}
c.inRequest.onSuccess = {
handler: a.onSuccess,
scope: a.scope,
props: a
}, this.log("RESPONSE OBTAINED FROM " + (AppCatalog.Config.CacheConfig.persistent ? "PERSISTENT" : "MEMORY") + " CACHE"), this.responseSuccess(c.inRequest, !0);
return;
}
this.cacheUtil.set(b, a.expires);
}
this.call(a.body, {
onSuccess: a.onSuccess ? {
handler: a.onSuccess,
scope: a.scope,
props: a
} : "",
onFailure: a.onFailure ? {
handler: a.onFailure,
scope: a.scope,
props: a
} : "",
onResponse: a.onResponse ? {
handler: a.onResponse,
scope: a.scope,
props: a
} : ""
});
},
responseSuccess: function(a, b) {
var c = a.response, d = a.onSuccess.props, e = [], f = findApps.WebService.parseStatusCode(c), g = findApps.WebService.parseServerException(c), h = findApps.WebService.parseXhrStatusCode(a);
g && (e.push(g), e.push("RESP0002")), h !== 200 && (this.error("xhrStatusCode:", h), e.push("RESP0001")), c === "" && (a.didTimeout ? e.push("RESP0003") : e.push("RESP0004")), f !== "OK" && f !== "" && (this.error("responseStatusCode: ", f), e.push("RESP0005")), findApps.WebService.local_testing(e, this, a);
var i = "";
b || (i = findApps.WebService._generateKey(d)), e.length === 0 ? (this.log("Service: ", d ? d.service : "", "URL: ", a.url, "response:", c, "responseStatusCode:", f, "xhrStatusCode:", h, "latency:", a.latency, "timeoutjob:", a.timeoutJob), i && this.cacheUtil.set(i, null, {
inRequest: {
response: c,
url: a.url,
method: a.method,
params: a.params,
xhr: {
status: findApps.WebService.parseXhrStatusCode(a)
}
}
}), this.dispatchResponse(a.onSuccess, a)) : (i && this.cacheUtil.clear(i), this.responseFailure(a, e));
},
responseFailure: function(a, b) {
var c = a.response, d = a.onFailure.props;
b = b || [];
var e = findApps.WebService.parseStatusCode(c), f = findApps.WebService.parseServerException(c), g = findApps.WebService.parseXhrStatusCode(a);
f && (b.push(f), b.push("RESP0009")), g !== 200 && (this.error("xhrStatusCode:", g), b.push("RESP0010")), c === "" && (a.didTimeout ? b.push("RESP0011") : b.push("RESP0012")), e !== "OK" && e !== "" && (this.error("responseStatusCode: ", e), b.push("RESP0013")), b.push("RESP0006"), this.error("Service: ", d ? d.service : "", "URL: ", a.url, "response: ", c, "serverException:", f, "responseStatusCode:", e, "xhrStatusCode:", g, "latency:", a.latency, "timeoutjob:", a.timeoutJob, "errors", b + ""), this.dispatchResponse(a.onFailure, a, b);
},
response: function(a) {
var b = a.response, c = a.onResponse.props, d = [], e = findApps.WebService.parseStatusCode(b), f = findApps.WebService.parseServerException(b), g = findApps.WebService.parseXhrStatusCode(a);
this.log("Service: ", c ? c.service : "", "URL: ", a.url, "statusCode", e, "response: ", b, "serverException", f, "xhrStatusCode", g), g !== 200 && d.push("RESP0007"), f && (d.push(f), d.push("RESP0008")), b === "" && a.didTimeout && d.push("RESP0011"), findApps.WebService.local_testing(d, this, a), this.dispatchResponse(a.onResponse, a, d);
}
}), enyo.mixin(findApps.WebService, {
parseServerException: function(a) {
var b = "";
return a && (a.results && a.results.body && a.results.body.error ? b = a.results.body.error : a.JSONException && (b = a.JSONException.errorCode || a.JSONException.errorCodes)), typeof b == "undefined" && (b = ""), b;
},
parseStatusCode: function(a) {
return a && (a.statusCode || a.results && a.results.statusCode) || "";
},
parseXhrStatusCode: function(a) {
return a && a.xhr && a.xhr.status || -1;
},
_generateKey: function(a) {
if (!a) return "";
var b = a.url, c = a.method, d = a.body, e = {};
d && (e = enyo.isString(d) ? JSON.parse(d) : d, a.scope && (a.scope.corelationId = e.corelationId), e.corelationId && (e.corelationId = ""));
var f = b + c + enyo.json.stringify(e);
return CommonUtil.getHashCode(f);
},
local_testing: function(a, b, c) {
if (localconfig.testServerErrors) {
var d = new XMLHttpRequest;
d.open("GET", "/tmp/service", !1), d.send();
var e = d.responseText.trim() || "", f = b && b.service ? b.service : c.id;
this.error("local_testing(): received response for:", f, ": but blocking only:", e), f === e && (a.push("TEST0001"), a.push("TEST0002"), a.push("TEST0003"), a.push("TEST0004"), a.push("TEST0005"), a.push("TEST0006"), a.push("TEST0007"), a.push("TEST0008"), a.push("TEST0009"), a.push("TEST0010"), a.push("TEST0011"), a.push("TEST0012"), a.push("TEST0013"), a.push("TEST0014"), a.push("TEST0015"));
}
},
getInstance: function() {
return findApps.WebService._singleton = findApps.WebService._singleton || new findApps.WebService, findApps.WebService._singleton;
}
});
;
// lib/services/PalmService.js

enyo.kind({
name: "findApps.PalmService",
kind: enyo.PalmService,
dispatchResponse: function(a, b) {
a && a.scope ? this.dispatch(a.scope, a.handler, [ b.response, b, a.props ]) : this.dispatch(this.owner, a, [ b.response, b ]);
},
sendRequest: function(a, b) {
this.call(a, enyo.mixin(b, {
onSuccess: b.onSuccess ? {
handler: b.onSuccess,
scope: b.scope,
props: b
} : "",
onFailure: b.onFailure ? {
handler: b.onFailure,
scope: b.scope,
props: b
} : "",
onResponse: b.onResponse ? {
handler: b.onResponse,
scope: b.scope,
props: b
} : ""
}));
}
}), findApps.PalmService.addCallbackProps = function(a, b, c, d) {
return enyo.mixin(a, {
onSuccess: d ? {
handler: b,
scope: d,
props: a
} : b,
onFailure: d ? {
handler: c,
scope: d,
props: a
} : c
});
};
;
// lib/services/BaseServer.js

enyo.kind({
name: "findApps.BaseServer",
kind: enyo.Object,
getAuthHeaders: function() {
return findApps.BaseServer._authHeaders == null && (findApps.BaseServer._authHeaders = findApps.BaseServer._token && findApps.BaseServer._deviceId && findApps.BaseServer._email ? {
Authorization: "PalmAuth token=" + findApps.BaseServer._token,
"X-Palm-Device-Id": findApps.BaseServer._deviceId,
"X-Palm-Profile-Email": findApps.BaseServer._email,
"X-Palm-AppCat-Caller-ID": "acc",
"X-Palm-AppCat-Caller-Version": findApps.BaseServer._callerVersion
} : null), findApps.BaseServer._authHeaders;
},
callServer: function(a, b) {
var c = a.url, d = a.body, e = a.service, f = a.expires;
this.log("ACS1 server call: URL: ", c, "Service: ", e, "Request: ", d), findApps.WebService.getInstance().sendRequest(enyo.mixin({
contentType: "application/json",
method: "POST",
handleAs: "json",
url: c,
body: enyo.json.stringify(d),
timeout: AppCatalog.Config.wsTimeout,
service: e,
expires: f
}, b));
},
callServer1: function(a, b) {
var c = a.url, d = a.body, e = a.service, f = a.expires, g = a.httpMethod;
this.log("ACS2 server call: URL: ", c, "Service: ", e, "Request: ", d);
var h = this.getAuthHeaders();
findApps.WebService.getInstance().sendRequest(enyo.mixin({
contentType: "application/json",
method: d ? g || "POST" : "GET",
handleAs: "json",
url: c,
headers: h,
body: d ? enyo.json.stringify(d) : null,
timeout: AppCatalog.Config.wsTimeout,
service: e,
expires: f
}, b));
},
callServer3: function(a, b) {
var c = a.url, d = a.service, e = a.wapProxy, f = a.headers;
this.log("server call through proxy: URL: ", c, "Service: ", d, "wapProxy: ", e, "headers: ", f), findApps.WebService.getInstance().sendRequest(enyo.mixin({
contentType: "application/xml",
method: "POST",
url: c,
headers: f,
timeout: AppCatalog.Config.wsTimeout,
service: d
}, b));
},
fetchAccountParams: function(a, b, c) {
var d = enyo.application.paramsFetcher = enyo.application.paramsFetcher || new findApps.AccountParamsFetcher, e = Array.prototype.slice.apply(b);
d.fetchAccountParams({
scope: a,
methodName: c,
params: e,
onError: "handleAccountParamsError",
onErrorParams: [ b.service, b.inProps ]
});
},
getMethodName: function(a) {
return a.split(".").pop().replace("()", "");
}
}), enyo.mixin(findApps.BaseServer, {
_categoriesMap: null,
_session: null,
_sessionError: !1,
_accountInfo: null,
_accountId: null,
_serverUrl: null,
_server2Url: null,
_deviceId: null,
_softwareBuildBranch: null,
_token: null,
_email: null,
_authHeaders: null,
_paymentServerUrl: null,
_paymentServerError: !1,
_callerVersion: null,
_accountToken: undefined,
getSession: function() {
return this._session;
},
getAccountInfo: function() {
return this._accountInfo;
},
setAccountInfo: function(a) {
this._accountInfo = a;
},
getActivationCountry: function() {
return localStorage.getItem("com.palm.app.findapps.country");
},
setActivationCountry: function(a) {
var b = this._session.deviceProperties;
b.country = a, findApps.BaseServer._activationCountrySet = !0, localStorage.setItem("com.palm.app.findapps.country", a);
},
isActivationCountrySet: function() {
var a = localStorage.getItem("com.palm.app.findapps.country");
return a ? !0 : !1;
},
getAccountToken: function() {
return this._accountToken || findApps.BaseServer._deviceId && findApps.BaseServer._token && findApps.BaseServer._email && (this._accountToken = {
token: findApps.BaseServer._token,
email: findApps.BaseServer._email,
deviceId: findApps.BaseServer._deviceId
}), this._accountToken;
},
isTermsAccepted: function() {
var a = localStorage.getItem("com.palm.app.findapps.terms");
return a ? !0 : !1;
},
setTermsAccepted: function() {
localStorage.setItem("com.palm.app.findapps.terms", this._TOSDate);
},
buildCategoriesMap: function() {
var a = findApps.BaseServer._session.categories, b = {};
for (var c in a) {
b[a[c].categoryId] = a[c];
var d = a[c].subcategories;
for (var e in d) b[d[e].categoryId] = d[e], b[d[e].categoryId].parentId = a[c].categoryId;
}
this._categoriesMap = b;
},
isPurchased: function(a) {
return findApps.BaseServer._session && findApps.BaseServer._session.purchasedApplications && findApps.BaseServer._session.purchasedApplications.apps ? findApps.BaseServer._session.purchasedApplications.apps.indexOf(a) == -1 ? !1 : !0 : !1;
},
getCategoryItem: function(a) {
return this._categoriesMap[a];
},
getCategoryInfo: function(a) {
if (a == "") return {
label: $L("All results"),
icon: ""
};
var b = this.getCategoryItem(a);
if (b) {
var c = this.getCategoryItem(b.parentId);
return c ? {
label: enyo.macroize("{$par} / {$item}", {
par: c.label,
item: b.label
}),
icon: "images/" + (b.iconLocation || c.iconLocation || "category-icons/home/") + "category-selector.png"
} : {
label: b.label,
icon: "images/" + (b.iconLocation || "category-icons/home/") + "category-selector.png"
};
}
return null;
},
getRelevantSearchCategories: function(a) {
var b = [];
for (var c in a) {
var d = this.getCategoryItem(a[c].id);
d && !d.parentId && b.unshift(a[c]);
}
return b;
},
getACServer: function() {
return findApps.BaseServer._ACServer = findApps.BaseServer._ACServer || new findApps.ACServer, findApps.BaseServer._ACServer;
}
});
;
// lib/services/ACServer.js

enyo.kind({
name: "findApps.ACServer",
kind: "findApps.BaseServer",
getSession: function(a, b) {
var c = "user/session";
if (!findApps.BaseServer.getSession()) {
var d = this.isAccountParamsAvail();
if (d) {
var e = {
url: findApps.BaseServer._server2Url + enyo.g11n.currentLocale().toISOString() + "/" + c,
service: "SessionService"
};
this.callServer1(e, b);
} else this.fetchAccountParams(this, arguments, this.getMethodName(arguments.callee.nom));
}
},
setCountryCode: function(a, b, c) {
var d = this.isAccountParamsAvail();
if (d) {
var e = "user/profile/devices/" + findApps.BaseServer._deviceId, f = {
url: findApps.BaseServer._server2Url + e,
body: a,
service: b
};
this.callServer1(f, c);
} else this.fetchAccountParams(this, arguments, this.getMethodName(arguments.callee.nom));
},
getCountryList: function(a, b) {
var c = this.isAccountParamsAvail();
if (c) {
var d = "support/firstUseCountryList", e = {
url: findApps.BaseServer._server2Url + d,
service: a
};
this.callServer1(e, b);
} else this.fetchAccountParams(this, arguments, this.getMethodName(arguments.callee.nom));
},
getApplicationDetails: function(a, b, c, d, e, f) {
var g = this.isAccountParamsAvail();
if (g) {
var h = "appDetail_ext2", i = {
InGetAppDetailV2: {
accountTokenInfo: findApps.BaseServer.getAccountToken(),
packageId: b,
locale: c,
appId: a ? a : undefined
}
}, j = new Date((new Date).getTime() + AppCatalog.Config.CacheConfig.longTermTTL), k = {
url: findApps.BaseServer._serverUrl + h,
body: i,
service: d,
expires: e ? undefined : j
};
this.callServer(k, f);
} else this.fetchAccountParams(this, arguments, this.getMethodName(arguments.callee.nom));
},
getMyRating: function(a, b, c, d) {
var e = this.isAccountParamsAvail();
if (e) {
var f = "getMyRating", g = {
InGetMyRating: {
accountTokenInfo: findApps.BaseServer.getAccountToken(),
publicApplicationId: b
}
}, h = {
url: findApps.BaseServer._serverUrl + f,
body: g,
service: c
};
this.callServer(h, d);
} else this.fetchAccountParams(this, arguments, this.getMethodName(arguments.callee.nom));
},
getAppReviewsList: function(a, b, c, d, e, f, g) {
var h = this.isAccountParamsAvail();
if (h) {
var i = "/apps/" + b + "/reviews/?sign=" + c + "&offset=" + d + "&count=" + e, j = new Date((new Date).getTime() + AppCatalog.Config.CacheConfig.shortTermTTL), k = {
url: findApps.BaseServer._server2Url + enyo.g11n.currentLocale().toISOString() + "/" + i,
service: f,
expires: j
};
this.callServer1(k, g);
} else this.fetchAccountParams(this, arguments, this.getMethodName(arguments.callee.nom));
},
updateReviewOfReview: function(a, b, c, d, e, f, g) {
var h = this.isAccountParamsAvail();
if (h) {
var i = "/apps/" + b + "/reviews/" + d, j = {
usefulToMe: e,
packageId: b,
version: c,
reviewId: d
}, k = {
url: findApps.BaseServer._server2Url + enyo.g11n.currentLocale().toISOString() + "/" + i,
body: j,
service: f
};
this.callServer1(k, g);
} else this.fetchAccountParams(this, arguments, this.getMethodName(arguments.callee.nom));
},
getAppList: function(a, b, c) {
var d = this.isAccountParamsAvail();
if (d) {
var e = "appList_ext2", f = {
InGetAppListV2: {
accountTokenInfo: findApps.BaseServer.getAccountToken(),
queryStr: a.queryStr || "",
queryFragment: a.queryFragment || "",
qid: a.qid || "",
listId: a.listId || "",
categoryid: a.categoryid || "",
tagName: a.tagName || "",
provides: a.provides || "",
startPosition: a.startPosition || 0,
count: a.count || AppCatalog.Config.defaultPageSize,
sort: a.sort || "DATE_DESC",
locale: a.locale || enyo.g11n.currentLocale().toISOString(),
includeImages: a.includeImages || "true",
includeCategoryBreakdown: a.includeCategoryBreakdown || "false",
packageIds: a.packageIds || [],
filterBadges: a.appFilterType || "all"
},
corelationId: a.corelationId || ""
};
a.developerId && a.developerId != 0 && (f.InGetAppListV2.developerId = a.developerId);
var g = new Date((new Date).getTime() + AppCatalog.Config.CacheConfig.longTermTTL), h = {
url: findApps.BaseServer._serverUrl + e,
body: f,
service: b,
expires: g
};
this.callServer(h, c);
} else this.fetchAccountParams(this, arguments, this.getMethodName(arguments.callee.nom));
},
addUserReview: function(a, b, c, d, e, f, g, h, i) {
var j = this.isAccountParamsAvail();
if (j) {
var k = {
packageId: b,
version: c,
locale: d,
creator: g,
comments: e,
rating: f
}, l = "/apps/" + b + "/reviews/", m = {
url: findApps.BaseServer._server2Url + enyo.g11n.currentLocale().toISOString() + "/" + l,
body: k,
service: h,
httpMethod: "PUT"
};
this.callServer1(m, i);
} else this.fetchAccountParams(this, arguments, this.getMethodName(arguments.callee.nom));
},
updateUserReview: function(a, b, c, d, e, f, g, h, i, j) {
var k = this.isAccountParamsAvail();
if (k) {
var l = {
id: e,
packageId: b,
version: c,
locale: d,
creator: h,
comments: f,
rating: g
}, m = "/apps/" + b + "/reviews/" + e, n = {
url: findApps.BaseServer._server2Url + enyo.g11n.currentLocale().toISOString() + "/" + m,
body: l,
service: i,
httpMethod: "PUT"
};
this.callServer1(n, j);
} else this.fetchAccountParams(this, arguments, this.getMethodName(arguments.callee.nom));
},
reportProblem: function(a, b, c, d, e, f, g, h, i, j, k) {
var l = this.isAccountParamsAvail();
if (l) {
var m = "addUserRating", n = {
InAddUserRating: {
userRatingItem: {
score: Math.round(d),
comment: c,
accountId: f || "",
locale: e,
isAnonymous: g,
isInappropriate: h,
appId: a,
publicApplicationId: b,
complaintType: i
},
accountTokenInfo: findApps.BaseServer.getAccountToken()
}
}, o = {
url: findApps.BaseServer._serverUrl + m,
body: n,
service: j
};
this.callServer(o, k);
} else this.fetchAccountParams(this, arguments, this.getMethodName(arguments.callee.nom));
},
getListOfUpdatableApps: function(a, b, c) {
var d = this.isAccountParamsAvail();
if (d) {
var e = "getListOfUpdatableApps", f = {
InGetUpdatableApps: {
accountTokenInfo: findApps.BaseServer.getAccountToken(),
packageIds: a
}
}, g = {
url: findApps.BaseServer._serverUrl + e,
body: f,
service: b
};
this.callServer(g, c);
} else this.fetchAccountParams(this, arguments, this.getMethodName(arguments.callee.nom));
},
handleAccountParamsError: function(a, b) {
this.error("handleAccountParamsError: Failed to fetch account parameters. Returning failure status for service ", a);
var c = [ "LOC07006" ], d = {
JSONException: {
errorCode: "LOC07006"
}
}, e = [ this, d, null, b, c ];
b.scope[b.onFailure].apply(b.scope, e);
},
isAccountParamsAvail: function() {
return findApps.BaseServer.getAccountToken() && findApps.BaseServer._serverUrl ? !0 : !1;
}
});
;
// lib/services/appinstallservice.js

enyo.kind({
name: "findApps.AppInstallService",
kind: "PalmService",
service: "palm://com.palm.appInstallService/",
install: function(a, b, c) {
this.subscribe = !1;
var d = (new Date).getTime(), e = {
catalogId: a.id,
id: a.publicApplicationId,
title: a.title,
version: a.serverVersion,
vendor: a.vendor,
vendorUrl: a.vendorUrl,
iconUrl: a.iconUrl,
ipkUrl: a.packageUrl,
authToken: findApps.BaseServer._token,
deviceId: findApps.BaseServer._deviceId,
email: findApps.BaseServer._email,
noApp: a.appType === "app" ? !1 : !0,
services: a.services,
accounts: a.accounts,
dockMode: a.dockMode,
universalSearch: a.universalSearch,
loc_name: a.title,
transactionId: "" + d
}, f = {
method: "install",
onSuccess: b,
onFailure: c
};
this.call(e, f);
},
status: function(a, b) {
this.subscribe = !0;
var c = {}, d = {
method: "status",
onSuccess: a,
onFailure: b
};
this.call(c, d);
},
pause: function(a, b, c) {
this.subscribe = !1;
var d = {
id: a
}, e = {
method: "pause",
onSuccess: b,
onFailure: c
};
this.call(d, e);
},
resume: function(a, b, c) {
this.subscribe = !1;
var d = {
id: a
}, e = {
method: "resume",
onSuccess: b,
onFailure: c
};
this.call(d, e);
},
cancel: function(a, b, c) {
this.subscribe = !1;
var d = {
id: a
}, e = {
method: "cancel",
onSuccess: b,
onFailure: c
};
this.call(d, e);
},
remove: function(a, b, c) {
this.subscribe = !1;
var d = {
id: a
}, e = {
method: "remove",
onSuccess: b,
onFailure: c
};
this.call(d, e);
},
installLocal: function(a, b, c) {
this.subscribe = !1;
var d = {
id: a.id,
version: a.version,
title: a.loc_name,
ipkUrl: a.ipkgUrl,
iconUrl: a.iconUrl,
vendor: a.vendor
}, e = {
method: "installLocal",
onSuccess: b,
onFailure: c
};
this.call(d, e);
}
});
;
// lib/services/applicationinstaller.js

enyo.kind({
name: "findApps.ApplicationInstaller",
kind: "PalmService",
service: "palm://com.palm.appinstaller/",
validateInstall: function(a, b, c, d, e) {
var c = c && c != 0 ? Math.ceil(c / 1024) : undefined, b = Math.ceil(b / 1024), f = {
appId: a,
size: b,
uncompressedSize: c
}, g = {
method: "queryInstallCapacity",
onSuccess: d,
onFailure: e
};
this.log("appinstaller: validateInstall: params ", f, " props: ", g), this.call(f, g);
}
});
;
// lib/services/applicationmanager.js

enyo.kind({
name: "findApps.ApplicationManager",
kind: findApps.PalmService,
service: "palm://com.palm.applicationManager/",
getInstalledApplications_V2: function(a, b, c) {
this.subscribe = !1;
var d = {}, e = {
method: "listPackages"
};
this.call(d, findApps.PalmService.addCallbackProps(e, a, b, c));
},
openApplication: function(a, b, c, d, e, f) {
this.subscribe = !1;
var g = b;
g || (g = {});
var h = {
id: a,
params: g
}, i = {
method: "open"
};
this.call(h, findApps.PalmService.addCallbackProps(i, d, e, f));
},
launchApplication: function(a, b, c, d, e) {
this.subscribe = !1;
var f = {
id: a,
params: b
}, g = {
method: "launch"
};
this.call(f, findApps.PalmService.addCallbackProps(g, c, d, e));
},
launchPointChanges: function(a, b, c) {
this.subscribe = !0;
var d = {}, e = {
method: "launchPointChanges",
subscribe: !0
};
this.call(d, findApps.PalmService.addCallbackProps(e, a, b, c));
},
openBrowserPage: function(a, b, c, d) {
this.subscribe = !1, this.openApplication("com.palm.app.browser", '{"target": "' + a + '"}', !0, b, c, d);
}
}), findApps.ApplicationManager.getInstance = function() {
return findApps.ApplicationManager._singleton = findApps.ApplicationManager._singleton || new findApps.ApplicationManager, findApps.ApplicationManager._singleton;
};
;
// lib/services/accountservices.js

enyo.kind({
name: "findApps.AccountServices",
kind: findApps.PalmService,
service: "palm://com.palm.accountservices/",
getServerUrl: function(a) {
var b = {};
a = enyo.mixin(a ? a : {}, {
service: this.service,
method: "getServerUrl"
}), this.sendRequest(b, a);
},
getPaymentServerUrl: function(a) {
if (findApps.BaseServer._paymentServerUrl == null) {
var b = {
appName: "PAYMENT"
};
a = enyo.mixin(a ? a : {}, {
service: this.service,
method: "getPreferences"
}), this.sendRequest(b, a);
}
},
getAccountToken: function(a) {
var b = {};
a = enyo.mixin(a ? a : {}, {
service: this.service,
method: "getAccountToken"
}), this.sendRequest(b, a);
},
getAccountInfo: function(a) {
if (findApps.BaseServer.getAccountInfo() != null) return findApps.BaseServer.getAccountInfo();
var b = {};
a = enyo.mixin(a ? a : {}, {
service: this.service,
method: "getAccountInfo"
}), this.sendRequest(b, a);
},
updateAccountInfo: function(a, b, c, d, e, f, g) {
var h = {
firstName: firstName,
lastName: b,
password: c,
email: d,
languageCode: e,
countryCode: f
};
g = enyo.mixin(g ? g : {}, {
service: this.service,
method: "updateAccountInfo"
}), this.sendRequest(h, g);
},
getGoogleAnalyticsWebPropertyID: function(a) {
var b = {
appName: [ "APP_DISCO" ]
};
a = enyo.mixin(a ? a : {}, {
service: this.service,
method: "getPreferences"
}), this.sendRequest(b, a);
},
notifyAuthenticationFailure: function(a) {
var b = {};
a = enyo.mixin(a ? a : {}, {
service: this.service,
method: "notifyAuthenticationFailure"
}), this.sendRequest(b, a);
},
isUserValid: function(a, b, c, d) {
var e = {
email: a,
password: b,
deviceId: c
};
d = enyo.mixin(d ? d : {}, {
service: this.service,
method: "isUserValid"
}), this.sendRequest(e, d);
},
getLocale: function(a) {
var b = {
keys: [ "locale" ]
};
a = enyo.mixin(a ? a : {}, {
service: this.service,
method: "getPreferences"
}), this.sendRequest(b, a);
},
getAllSecurityQuestions: function(a, b) {
var c = {
subscribe: !1,
locale: a
};
b = enyo.mixin(b ? b : {}, {
service: this.service,
method: "getAllSecurityQuestions"
}), this.sendRequest(c, b);
},
getAccountSecurityQuestions: function(a, b, c) {
var d = {
email: a,
locale: b
};
c = enyo.mixin(c ? c : {}, {
service: this.service,
method: "getAccountSecurityQuestion"
}), this.sendRequest(d, c);
},
resendVerificationEmail: function(a) {
var b = {};
a = enyo.mixin(a ? a : {}, {
service: this.service,
method: "requestResendVerificationEmail"
}), this.sendRequest(b, a);
},
requestPasswordResetEmail: function(a, b) {
var c = {
email: a,
subscribe: !1
};
b = enyo.mixin(b ? b : {}, {
service: this.service,
method: "requestPasswordResetEmail"
}), this.sendRequest(c, b);
},
authenticateAccountFromSecurityQuestion: function(a, b, c, d) {
var e = {
email: a,
questionId: b,
response: c
};
d = enyo.mixin(d ? d : {}, {
service: this.service,
method: "authenticateAccountFromSecurityQuestion"
}), this.sendRequest(e, d);
},
changeEmail: function(a, b) {
var c = {
email: a
};
b = enyo.mixin(b ? b : {}, {
service: this.service,
method: "changeEmail"
}), this.sendRequest(c, b);
},
changePassword: function(a, b, c, d, e, f) {
var g = {
newPassword: a,
questionId: b,
answer: c,
idToken: d,
isResetPassword: e
};
f = enyo.mixin(f ? f : {}, {
service: this.service,
method: "changePassword"
}), this.sendRequest(g, f);
},
authenticateAccount: function(a, b, c) {
var d = {
email: a,
password: b,
application: "ASClient"
};
c = enyo.mixin(c ? c : {}, {
service: this.service,
method: "authenticateAccount"
}), this.sendRequest(d, c);
}
}), enyo.mixin(findApps.AccountServices, {
getInstance: function() {
return findApps.AccountServices._singleton = findApps.AccountServices._singleton || new findApps.AccountServices, findApps.AccountServices._singleton;
}
});
;
// lib/services/connectionmanager.js

enyo.kind({
name: "findApps.ConnectionManager",
kind: enyo.Component,
events: {
onSuccess: "",
onError: ""
},
components: [ {
name: "connMan",
kind: "PalmService",
service: "palm://com.palm.connectionmanager/",
subscribe: !0
}, {
name: "massStorageMan",
kind: "PalmService",
service: "palm://com.palm.bus/signal/",
method: "addmatch",
onSuccess: "msmSuccess",
onFailure: "msmFailure"
} ],
_online: undefined,
_1x: undefined,
_waiting: [],
_started: !1,
gotStatus: function(a, b) {
this.log("connectionmanager: gotStatus: ", b), this._1x = b.wan.network == "1x" && b.wifi.state != "connected", this.wanInterface = b && b.wan && b.wan.interfaceName, this._stateChanged(b.isInternetConnectionAvailable == 1 ? !0 : !1), this.doSuccess(b);
},
handleError: function(a, b) {
this.error("connection manager error ", b);
if (AppCatalog.Config.useBrowser == 1) return;
this._stateChanged(!1), this.doError();
},
getStatus: function() {
var a = {
method: "getstatus",
onSuccess: "gotStatus",
onFailure: "handleError"
}, b = {
subscribe: !0
};
this.$.connMan.call(b, a);
},
_startup: function(a) {
this._started = !0;
var b = {
category: "/storaged",
method: "MSMProgress",
subscribe: !0
};
this.$.massStorageMan.call(b), this.getStatus();
},
msmSuccess: function(a, b) {
this.log("connectionmanager: msmSuccess: ", b), this._MSMnotification(b);
},
msmError: function(a, b) {
this.error("msm error ", b), this._MSMnotification(b);
},
_MSMnotification: function(a) {
if (!a) return;
a.stage == "attempting" && (this._MSMmodeActive = !0, viewLibrary._container.$.error.cancelOfflineDialog());
},
_stateChanged: function(a) {
if (this._online != a) {
this._online = a;
var b = this._waiting;
this._waiting = [];
for (var c = 0; c < b.length; c++) {
var d = b[c];
d.online === undefined || d.online === a ? b[c].callback(a) : this._waiting.push(d);
}
this._online && (this._MSMmodeActive = !1);
}
},
getDataService: function() {
findApps.DeviceProfile.getInstance().getCarrierIdentification({
onSuccess: "ConnectOnCarrierInfo",
onFailure: "ConnectOnCarrierFailure",
scope: this
});
},
ConnectOnCarrierInfo: function(a, b, c, d) {
this.log("getCarrierIdentification", b);
if (b.results[0] && b.results[0].mcc == 310 && b.results[0] && b.results[0].mnc == 410) {
this.gotDataService = function(a, b, c) {
b && (this.log("getDataService success response", b), undefined != b.returnValue ? b.returnValue || (this.isWanSvcConnected = !1, this.ipAddress = null) : b.status && ("connected" === b.status && b.ipAddress ? (this.isWanSvcConnected = !0, this.ipAddress = b.ipAddress) : "retrying" === b.status ? (this.isWanSvcConnected = !1, this.ipAddress = null) : "disconnected" === b.status && (this.isWanSvcConnected = !1, this.ipAddress = null)));
}, this.gotDataServiceError = function(a, b, c) {
this.error("Error getting proxy service", b), this.isWanSvcConnected = !1, this.ipAddress = null;
};
var e = {
method: "connectCellularDataService",
onSuccess: "gotDataService",
onFailure: "gotDataServiceError"
}, f = {
service: "proxy",
subscribe: !0
};
this.cellSvcConnectRequest = this.$.connMan.call(f, e);
}
},
ConnectOnCarrierFailure: function(a, b, c, d) {
this.error("No MCC/MNC: Either device is only wifi device or no wan connection available "), this.isWanSvcConnected = !1, this.ipAddress = null;
},
disconnectDataService: function() {
this.cellSvcConnectRequest ? (this.cellSvcConnectRequest.cancel(), this.cellSvcConnectRequest = null) : this.log("wanDisconnectServiceRequest already disconnected");
},
monitor: function() {
this._started || this._startup();
},
isOnline: function() {
if (AppCatalog.Config.useBrowser == 1) return !0;
if (this._online === undefined) throw new Error("ConnectionManager is not monitoring status");
return this._online;
},
isOn1x: function() {
return this._1x;
},
cleanup: function() {},
destroy: function() {
this.disconnectDataService(), this._waiting = null, this.inherited(arguments);
}
});
;
// lib/services/deviceprofile.js

enyo.kind({
name: "findApps.DeviceProfile",
kind: findApps.PalmService,
getDeviceId: function(a) {
var b = {};
a = enyo.mixin(a ? a : {}, {
service: "palm://com.palm.deviceprofile/",
method: "getDeviceId"
}), this.sendRequest(b, a);
},
getCarrierIdentification: function(a) {
var b = {
query: {
from: "com.palm.carrierdb.settings.current:1"
}
};
a = enyo.mixin(a ? a : {}, {
service: "palm://com.palm.db/",
method: "find"
}), this.sendRequest(b, a);
},
getDeviceProfile: function(a) {
var b = {};
a = enyo.mixin(a ? a : {}, {
service: "palm://com.palm.deviceprofile/",
method: "getDeviceProfile"
}), this.sendRequest(b, a);
}
}), findApps.DeviceProfile.getInstance = function() {
return findApps.DeviceProfile._singleton = findApps.DeviceProfile._singleton || new findApps.DeviceProfile, findApps.DeviceProfile._singleton;
};
;
// lib/services/accountparamsfetcher.js

var myProfile = {
email: "",
password: "",
firstName: "",
lastName: "",
questionId: -2,
response: "",
securityQuestions: []
};

enyo.kind({
name: "findApps.AccountParamsFetcher",
kind: enyo.Object,
constructor: function() {
this.fetchInProgress = !1, this._listeners = [], this.inherited(arguments);
},
addToListeners: function(a) {
this._listeners.push(a);
},
sendEventToListeners: function(a) {
if (this._listeners) for (var b in this._listeners) {
var c = this._listeners[b];
this.returnCall(c, a);
}
},
returnCall: function(a, b) {
b === !0 ? a.scope[a.methodName].apply(a.scope, a.params) : a.scope[a.onError].apply(a.scope, a.onErrorParams);
},
fetchAccountParams: function(a) {
if (this.fetchInProgress === !0) {
this.addToListeners(a);
return;
}
if (findApps.BaseServer._token && findApps.BaseServer._email && findApps.BaseServer._serverUrl && findApps.BaseServer._server2Url && findApps.BaseServer._deviceId) this.returnCall(a, !0); else {
this.fetchInProgress = !0, this.addToListeners(a), findApps.BaseServer._callerVersion = enyo.fetchAppInfo().version;
if (AppCatalog.Config.useDummyAccountParams === !0) {
findApps.BaseServer._token = temptoken._token, findApps.BaseServer._email = temptoken._email, myProfile.email = temptoken._email, findApps.BaseServer._deviceId = temptoken._deviceId, findApps.BaseServer._softwareBuildBranch = "HP webOS 3.0.0", findApps.BaseServer._serverUrl = temptoken._serverUrl;
var b = /([^&]*):\/\/([^&/]*)\/([^&]*)/.exec(findApps.BaseServer._serverUrl);
findApps.BaseServer._server2Url = b[1] + "://" + b[2] + "/appcatalog/2.0/", findApps.BaseServer._accountInfo = temptoken._accountInfo, findApps.BaseServer._paymentServerUrl = temptoken._paymentServerUrl, this.requiredParams = 0, this.sendParamsReady();
} else {
this.requiredParams = 3;
var c = this, d = function() {
!findApps.BaseServer._token || !findApps.BaseServer._email ? findApps.AccountServices.getInstance().getAccountToken({
onSuccess: "gotTokenAndEmail",
onFailure: "gotTokenAndEmailError",
scope: c
}) : (c.requiredParams--, c.sendParamsReady("tokenemail"));
}, e = function() {
!findApps.BaseServer._serverUrl || !findApps.BaseServer._server2Url ? findApps.AccountServices.getInstance().getServerUrl({
onSuccess: "gotUrl",
onFailure: "gotUrlError",
scope: c
}) : (c.requiredParams--, c.sendParamsReady("serverurl"));
}, f = function() {
findApps.BaseServer._deviceId ? (c.requiredParams--, c.sendParamsReady("deviceid")) : findApps.DeviceProfile.getInstance().getDeviceId({
onSuccess: "gotDeviceId",
onFailure: "gotDeviceIdError",
scope: c
});
};
d(), e(), f(), this.getDeviceProfile();
}
}
},
sendParamsReady: function() {
if (this.requiredParams > 0) return;
this.fetchInProgress = !1, findApps.BaseServer._token && findApps.BaseServer._email && findApps.BaseServer._serverUrl && findApps.BaseServer._server2Url && findApps.BaseServer._deviceId ? this.sendEventToListeners(!0) : this.sendEventToListeners(!1);
},
getDeviceProfile: function() {
findApps.BaseServer._softwareBuildBranch || findApps.DeviceProfile.getInstance().getDeviceProfile({
onSuccess: "gotDeviceProfile",
onFailure: "deviceprofileFailure",
scope: this
});
},
deviceprofileFailure: function(a, b) {
this.error("Device Profile command failed");
},
gotTokenAndEmail: function(a, b) {
findApps.BaseServer._token = b.token, findApps.BaseServer._email = b.accountAlias, myProfile.email = b.accountAlias, this.requiredParams--, this.sendParamsReady("tokenemail");
},
gotTokenAndEmailError: function(a, b) {
this.error("Could not fetch token and email"), this.requiredParams--, this.sendParamsReady("tokenemail");
},
gotUrl: function(a, b) {
findApps.BaseServer._serverUrl = b.serverUrl;
var c = /([^&]*):\/\/([^&/]*)\/([^&]*)/.exec(findApps.BaseServer._serverUrl);
findApps.BaseServer._server2Url = c[1] + "://" + c[2] + "/appcatalog/2.0/", this.requiredParams--, this.sendParamsReady("serverurl");
},
gotUrlError: function(a, b) {
this.error("Could not fetch server url"), this.requiredParams--, this.sendParamsReady("serverurl");
},
gotDeviceId: function(a, b) {
findApps.BaseServer._deviceId = b.deviceId, this.requiredParams--, this.sendParamsReady("deviceid");
},
gotDeviceIdError: function(a, b) {
this.error("Could not fetch device id"), this.requiredParams--, this.sendParamsReady("deviceid");
},
gotDeviceProfile: function(a, b) {
findApps.BaseServer._softwareBuildBranch = b.deviceInfo.softwareBuildBranch;
}
});
;
// lib/download/appdownload.js

enyo.kind({
name: "findApps.AppDownload",
kind: enyo.Component,
_defaultState: "dummy",
create: function() {
this.inherited(arguments), this._observers = [], this._progressPillModel = {}, this.enableSave = !0, this._setState(this._defaultState);
},
updateFromServer: function(a) {
var b;
a.attributes && !a.attributes.provides.noApp ? b = "app" : b = "other";
var c = {
id: a.id,
publicApplicationId: a.publicApplicationId,
title: a.title,
iconUrl: a.appIcon,
purchasedVersion: a.purchasedVersion,
serverVersion: a.version,
packageSize: a.appSize,
installSize: a.installSize,
isEncrypted: a.isEncrypted,
currency: a.currency,
priceType: a.priceType,
price: a.price,
sku: a.sku,
paymentCategory: a.paymentCategory,
vendor: a.creator,
vendorid: a.vendorid,
vendorUrl: a.homeURL,
vendorCity: a.vendorCity,
vendorRegion: a.vendorRegion,
vendorCountry: a.vendorCountry,
islocationbased: a.islocationbased,
packageUrl: a.appLocation,
appType: b,
services: a.attributes && a.attributes.provides.services,
dockMode: a.attributes && a.attributes.provides.dockMode,
universalSearch: a.attributes.provides.universalSearch,
accounts: a.attributes.provides.connectors
};
enyo.mixin(this, c), this._state.updateFromServer && this._state.updateFromServer(this);
},
updateFromInstalledAppsList: function(a) {
var b, c = !1, d = !1;
if (a.apps && a.apps.length > 0) {
b = "app";
for (var e = 0; e < a.apps.length; e++) a.apps[e].dockMode && (c = !0), a.apps[e].universalSearch && (d = !0);
} else b = "other";
var f = a.loc_name ? a.loc_name : a.apps.length > 0 ? a.apps[0].title : undefined, g = a.icon ? a.icon : a.apps.length > 0 ? a.apps[0].icon : undefined, h = a.vendor ? a.vendor : a.apps.length > 0 ? a.apps[0].vendor : undefined, i = {
publicApplicationId: a.id,
title: f,
installedVersion: a.version,
icon: g ? g : this.icon,
appType: b,
installSize: a.size,
vendor: h,
services: a.services,
accounts: a.accounts,
dockMode: c,
universalSearch: d
};
enyo.mixin(this, i), this._state.updateFromInstalledAppsList && this._state.updateFromInstalledAppsList(this);
},
updateFromServerUpdatesList: function(a) {
var b = {
id: a.id,
serverVersion: a.appVersion,
packageUrl: a.packageUrl,
vendor: a.vendor,
vendorUrl: a.homeURL,
iconUrl: a.appIcon,
packageSize: a.appSize,
installSize: a.installSize
};
enyo.mixin(this, b), this._state.updateFromServerUpdatesList && this._state.updateFromServerUpdatesList(this);
},
updateFromInstallNotification: function(a) {
if (a.change == "added" || a.change == "updated" && a.version && this.installedVersion != a.version) {
if (!this.installSize) var b = {
installSize: a.size
};
enyo.mixin(this, b), this.setState(this._state + "");
}
},
updateFromStatus: function(a, b) {
var c, d = b.state;
this.log("appdownload: updateFromStatus: new state and app id ", d, a);
if (d == "removing" || d == "unknown") return;
if (d == "installed") {
var e = {
publicApplicationId: a,
installedVersion: b.version
};
enyo.mixin(this, e), this.setState("installed");
} else if (d == "removed") {
this._state._remove && this._state._remove(this);
return;
}
if (d == "icon download complete" || d == "icon download current") b.progress = 0, d = "downloadprogress";
d == "ipk download complete" && (b.progress = 100);
if (d == "ipk download current" || d == "ipk download complete") d = "downloadprogress"; else if (d == "icon download paused" || d == "ipk download paused") d = "paused";
d == "install failed" ? (d = "installfailed", this.errorCode = b.reason) : d == "download failed" ? (d = "downloadfailed", this.errorCode = b.errorCode + "") : this.errorCode = b.errorCode, b.noApp && b.noApp === !0 ? c = "other" : c = "app";
var e = {
publicApplicationId: a,
title: b.title,
progress: b.progress,
serverVersion: b.version,
vendor: b.vendor,
vendorUrl: b.vendorUrl,
icon: this.icon ? this.icon : b.iconUrl,
appType: c,
dockMode: b.dockMode,
universalSearch: b.universalSearch,
services: b.services,
accounts: b.accounts
};
enyo.mixin(this, e);
if (d == "canceled" || d == "remove failed") this._state._reset && this._state._reset(this); else {
if (this._state._allowTransition && !this._state._allowTransition(d)) return;
this.setState(d);
}
},
setState: function(a, b) {
this._setState(a, b);
for (var c = 0; c < this._observers.length; c++) this._observers[c].updateDownloadState && this._observers[c].updateDownloadState(this);
},
_setState: function(a, b) {
this._state = this.owner.$["appStates_" + a], this._state.init(this, b);
},
getProgressPillModel: function() {
return this._progressPillModel;
},
getFormattedPrice: function() {
var a = this.price;
if (parseFloat(a) != a) return a;
var b = parseFloat(a), c = enyo.g11n.currentLocale(), d = new enyo.g11n.NumberFmt({
locale: c.locale,
fractionDigits: 2,
style: "currency"
}), e = d.currencyPrepend + d.format(b) + d.currencyAppend;
return b === 0 ? $L("free") : e;
},
attach: function(a) {
this._observers.push(a);
},
detach: function(a) {
for (var b = 0; b < this._observers.length; b++) this._observers[b] === a && this._observers.splice(b, 1);
},
install: function() {
this._state.install && this._state.install(this);
},
installUpdate: function() {
this._state.installUpdate && this._state.installUpdate(this);
},
canInstallUpdate: function() {
return this._state.installUpdate ? !0 : !1;
},
cancelDownload: function() {
this._state.cancelDownload && this._state.cancelDownload(this);
},
pauseDownload: function() {
this._state.pauseDownload && this._state.pauseDownload(this);
},
cancelPausedDownload: function() {
this._state.cancelPausedDownload && this._state.cancelPausedDownload(this);
},
resumeDownload: function() {
this._state.resumeDownload && this._state.resumeDownload(this);
},
launch: function() {
this._state.launch && this._state.launch(this);
},
uninstall: function() {
this._state.uninstall && this._state.uninstall(this);
},
defaultAction: function() {
this._state.defaultAction && this._state.defaultAction(this);
},
myAppsDefaultAction: function() {
this._state.myAppsDefaultAction && this._state.myAppsDefaultAction(this);
},
isInstalled: function() {
var a = this.owner.getInstalledApp(this.publicApplicationId);
return a ? !0 : !1;
},
stateToString: function() {
return this._state + "";
},
toString: function() {
return "id:" + this.id + "enableSave:" + this.enableSave + " publicApplicationId:" + this.publicApplicationId + ", state:" + this.stateToString() + ", title:" + this.title + ", serverVersion:" + this.serverVersion + ", installedVersion:" + this.installedVersion + ", purchasedVersion:" + this.purchasedVersion + ", errorCode:" + this.errorCode + ", icon:" + this.icon + ", updateClass:" + this.updateClass + ", activeClass:" + this.activeClass + ", resumeClass:" + this.resumeClass + ", pauseClass:" + this.pauseClass + " warningClass:" + this.warningClass + ", packageSize:" + this.packageSize + ",installSize: " + this.installSize + ",appType: " + this.appType + ",services:" + this.servcies + ",accounts:" + this.accounts + ",dockMode:" + this.dockMode + ",universalSearch:" + this.universalSearch;
},
saveToMyApps: function() {
return this._state.saveToMyApps ? this._state.saveToMyApps() : !1;
},
removeFromMyApps: function() {
return this._state.removeFromMyApps ? this._state.removeFromMyApps() : !1;
},
getAppDeleteDialogInfo: function() {
var a, b, c, d, e = [];
this.appType !== undefined && this.appType == "app" ? a = "application" : (b = $L("Delete this item"), a = "item");
if (this.owner.isRevertable(this.publicApplicationId) || this.removable === "false") d = !1, a === "application" ? c = $L("This application cannot be deleted from your device.") : c = $L("This item cannot be deleted from your device."); else {
this.accounts !== undefined && this.accounts instanceof Array && this.accounts.length > 0 && (e[e.length] = $L("Related accounts & data")), this.dockMode !== undefined && this.dockMode === !0 && (e[e.length] = $L("Dock components")), this.universalSearch !== undefined && this.universalSearch !== !1 && (this.universalSearch === !0 || this.universalSearch !== "") && (e[e.length] = $L("Universal Search plugins"));
if (e.length < 1) a === "application" ? c = $L("Are you sure you want to delete this application from your device?") : c = $L("Are you sure you want to delete this item from your device?"); else {
d = !0;
if (a === "application") {
c = $L("Deleting {$appName} also removes:"), c = enyo.macroize(c, {
appName: this.title
}), c += "<br>";
for (var f = 0; f < e.length; f++) c += e[f] + "<br>";
} else {
c = $L("Deleting this item removes:") + "<br>";
for (var f = 0; f < e.length; f++) c += e[f] + "<br>";
}
}
}
return {
deleteTitle: b,
deleteMessage: c,
removable: d
};
},
setPromoLink: function(a) {
this.promoLink = a;
}
});
;
// lib/download/appdownloadmanager.js

enyo.kind({
name: "findApps.AppDownloadManager",
kind: enyo.Component,
APP_ADDED: 0,
APP_DELETED: 1,
APP_UPDATED: 2,
MYAPPS_ALL: 3,
UPDATELIST_ALL: 4,
components: [ {
name: "registerServerStatus",
kind: "PalmService",
service: "palm://com.palm.bus/signal/"
}, {
name: "appinstallservice",
kind: "findApps.AppInstallService"
}, {
name: "download",
kind: "PalmService"
}, {
name: "appStates_dummy",
kind: "dummy"
}, {
name: "appStates_pausing",
kind: "pausing"
}, {
name: "appStates_fakeprogress",
kind: "fakeprogress"
}, {
name: "appStates_resuming",
kind: "resuming"
}, {
name: "appStates_removing",
kind: "removing"
}, {
name: "appStates_canceling",
kind: "canceling"
}, {
name: "appStates_download",
kind: "download"
}, {
name: "appStates_downloadprogress",
kind: "downloadprogress"
}, {
name: "appStates_paused",
kind: "paused"
}, {
name: "appStates_downloadfailed",
kind: "downloadfailed"
}, {
name: "appStates_purchasing",
kind: "purchasing"
}, {
name: "appStates_purchased",
kind: "purchased"
}, {
name: "appStates_purchase_failed",
kind: "purchase_failed"
}, {
name: "appStates_purchase_pending",
kind: "purchase_pending"
}, {
name: "appStates_installing",
kind: "installing"
}, {
name: "appStates_installed",
kind: "installed"
}, {
name: "appStates_installupdateavailable",
kind: "installupdateavailable"
}, {
name: "appStates_installfailed",
kind: "installfailed"
}, {
name: "appStates_appstatescommon",
kind: "appstatescommon"
} ],
create: function() {
this.inherited(arguments), this._myApps = new Object, this._revertableApps = new Object, this._activeQueue = new Object, this._observers = [], this._allow1xDownload = !1, this._myAppsListIsReady = 2;
},
destroy: function() {
this._myApps = null, this._revertableApps = null, this._activeQueue = null, this._observers = null, this.inherited(arguments);
},
init: function() {
this.$.registerServerStatus.call({
serviceName: "com.palm.appInstallService"
}, {
onSuccess: "_appInstallerServiceSignalCB",
onFailure: "genericFailure"
}), this.$.registerServerStatus.call({
serviceName: "com.palm.applicationManager"
}, {
onSuccess: "_appManagerServiceSignalCB",
onFailure: "genericFailure"
}), this.$.registerServerStatus.call({
serviceName: "com.palm.downloadmanager"
}, {
onSuccess: "_appDownloadServiceSignalCB",
onFailure: "genericFailure"
});
},
start: function() {
this._myApps = new Object, this._revertableApps = new Object, this._myAppsListIsReady = 2, findApps.ApplicationManager.getInstance().getInstalledApplications_V2("getInstalledApplicationsSuccess", "genericFailure", this);
},
_appInstallerServiceSignalCB: function(a, b) {
b.connected == 1 ? this.start() : b.connected != 0;
},
_appManagerServiceSignalCB: function(a, b) {
b.connected == 1 ? findApps.ApplicationManager.getInstance().launchPointChanges("launchPointChangesSuccess", "genericFailure", this) : b.connected != 0;
},
launchPointChangesSuccess: function(a, b) {
this._updateInstalledQueue(b);
},
genericFailure: function(a, b) {
this.error("appdownloadmanager: service failed: ", a, b);
},
_appDownloadServiceSignalCB: function(a, b) {
b.connected == 1 ? this._allow1xDownload && this.allow1xDownload(!0) : b.connected != 0;
},
getInstalledApplicationsSuccess: function(a, b) {
this.log("getInstalledApplicationsSuccess ", b);
var c = [], d = this;
this.$.appinstallservice.status("_appInstallServiceStatusCB", "genericFailure");
var e = b.packages;
e = e ? e instanceof Array ? e : [ e ] : [], this.createComponent({
kind: "WebService"
}), this.$.webService.call(null, {
url: "/usr/palm/ipkgs/manifest.json",
handleAs: "json",
onResponse: "manifestLoaded"
}), this.manifestLoaded = function(a, b) {
c = b || [], d.$.webService.destroy();
for (var f = 0; f < c.length; f++) d._revertableApps[c[f].id] = c[f];
for (var f = 0; f < e.length; f++) if (e[f].userInstalled || e[f].apps[0] && e[f].apps[0].userInstalled || d._revertableApps[e[f].id]) {
var g = d.getAppDownload(e[f].id);
g.updateFromInstalledAppsList(e[f]);
}
d._sendMyAppsListIsReady();
for (var f = 0; f < d._observers.length; f++) d._observers[f].updateInstalledApps && d._observers[f].updateInstalledApps();
};
},
myAppsListIsReady: function() {
return this._myAppsListIsReady == 0;
},
_sendMyAppsListIsReady: function() {
this._myAppsListIsReady--;
if (this._myAppsListIsReady == 0) for (var a = 0; a < this._observers.length; a++) this._observers[a].updateMyApps && this._observers[a].updateMyApps(null, this.MYAPPS_ALL);
},
getAppDownload: function(a, b) {
var c = this._myApps[a];
c || (c = this._activeQueue[a]);
if (!c) {
var c = this.createComponent({
kind: findApps.AppDownload,
owner: this,
publicApplicationId: a
});
c.attach(this), this._activeQueue[a] = c;
}
return b && c.attach(b), c;
},
releaseAppDownload: function(a, b) {
var c = this._myApps[a];
c || (c = this._activeQueue[a]), c.detach(b), c == this._activeQueue[a] && c._observers.length == 1 && delete this._activeQueue[a];
},
_updateInstalledQueue: function(a) {
if (a && (a.change == "added" || a.change == "removed" || a.change == "updated")) {
var b = this._myApps[a.packageId];
b && b.updateFromInstallNotification(a);
}
},
getInstalledApp: function(a) {
var b = this._myApps[a];
return b && b.installedVersion ? b : null;
},
getMyApps: function() {
return this._myApps;
},
attach: function(a) {
this._observers.push(a);
},
detach: function(a) {
for (var b = 0; b < this._observers.length; b++) this._observers[b] === a && this._observers.splice(b, 1);
},
updateDownloadState: function(a) {
var b = null;
a.saveToMyApps() && !this._myApps[a.publicApplicationId] ? (this._myApps[a.publicApplicationId] = a, b = this.APP_ADDED, delete this._activeQueue[a.publicApplicationId]) : a.removeFromMyApps() && this._myApps[a.publicApplicationId] ? (delete this._myApps[a.publicApplicationId], b = this.APP_DELETED, a._observers.length > 1 && (this._activeQueue[a.publicApplicationId] = a)) : this._myApps[a.publicApplicationId] && (b = this.APP_UPDATED);
if (b != null) for (var c = 0; c < this._observers.length; c++) this._observers[c].updateMyApps && this._observers[c].updateMyApps(a, b);
},
_appInstallServiceStatusCB: function(a, b) {
this.log("appdownloadmanager: _appInstallServiceStatusCB ", b);
var c = undefined, d = undefined, e = [];
b.status && b.status.apps ? (c = !0, d = !1, e = b.status.apps) : (c = !0, d = !0, e = [ b ]);
if (!c) return;
for (var f = 0; f < e.length; f++) {
var g = this.getAppDownload(e[f].id);
g.updateFromStatus(e[f].id, e[f].details);
}
d || this._sendMyAppsListIsReady();
},
belongToMyApp: function(a) {
return this._myApps[a];
},
isRevertable: function(a) {
return this._revertableApps[a] ? !0 : !1;
},
getDetailsRevertableApp: function(a) {
return this._revertableApps[a];
},
allow1xDownload: function(a, b) {
var c = this;
this.onSuccess = function(d, e) {
c._allow1xDownload = a, b && b(!0);
}, this.onFailure = function(a, c) {
this.error("AppDownloadManager.allow1xDownload failed ", c), b && b(!1);
}, this.$.download.setService("palm://com.palm.downloadmanager/"), this.$.download({
value: a
}, {
method: "allow1x",
OnSuccess: "onSuccess",
OnFailure: "onFailure"
});
},
canAllow1xDownload: function() {
return this._allow1xDownload;
},
cleanup: function() {
this._allow1xDownload && this.allow1xDownload(!1);
}
});
;
// lib/download/applists.js

enyo.kind({
name: "findApps.AppLists",
kind: enyo.Component,
ADDED: 0,
DELETED: 1,
UPDATED: 2,
MYAPPS_ALL: 3,
UPDATELIST_ALL: 4,
ERROR: 5,
create: function() {
this.inherited(arguments), this._apps = new Object, this._other = new Object, this._updates = new Object, this._myUpdates = new Object, this._observers = [], this.appdownloadmgr = enyo.application.appdownloadManager, this.appdownloadmgr.attach(this), this._allListsReady = 1, this._updateListReady = 1, this._updateListError = 1, this._initMyApps();
},
destroy: function() {
this.appdownloadmgr && this.appdownloadmgr.detach(this), this.appdownloadmgr = null, this._observers = null, this._apps = null, this._other = null, this._updates = null, this._myAppsHash = null, this._myUpdates = null, this.inherited(arguments);
},
_initMyApps: function() {
this._other.items = [], this._apps.items = [], this._myUpdates.items = [];
if (!this.appdownloadmgr.myAppsListIsReady()) return;
this._myAppsHash = this.appdownloadmgr.getMyApps();
for (var a in this._myAppsHash) this._myAppsHash[a].appType === "app" ? this._apps.items.push(this._myAppsHash[a]) : this._other.items.push(this._myAppsHash[a]);
this._apps.items.sort(function(a, b) {
return a.title.toLowerCase() == b.title.toLowerCase() ? 0 : a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
}), this._other.items.sort(function(a, b) {
return a.title.toLowerCase() == b.title.toLowerCase() ? 0 : a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
}), this._sendAllListsReady(), this._fetchUpdates();
},
allListsReady: function() {
return this._allListsReady == 0;
},
updateListReady: function() {
return this._updateListReady == 0;
},
updateListError: function() {
return this._updateListError == 0;
},
getAppsList: function() {
return this._apps;
},
getOtherList: function() {
return this._other;
},
getUpdatesList: function() {
return this._myUpdates;
},
_sendAllListsReady: function() {
this._allListsReady--;
if (this._allListsReady == 0) for (var a = 0; a < this._observers.length; a++) this._observers[a].updateLists && this._observers[a].updateLists(null, this.MYAPPS_ALL);
},
_sendUpdateListReady: function() {
this._updateListReady--;
if (this._updateListReady == 0) for (var a = 0; a < this._observers.length; a++) this._observers[a].updateLists && this._observers[a].updateLists("updates", this.UPDATELIST_ALL);
},
_sendError: function() {
this.error("Error in getting updates"), this._updateListError--;
if (this._updateListError == 0) for (var a = 0; a < this._observers.length; a++) this._observers[a].updateLists && this._observers[a].updateLists("updates", this.ERROR);
},
updatescb: function(a, b, c, d, e) {
if (!e || e.length == 0) {
var f = [];
if (b && b.OutUpdateInfoList) {
var g = b.OutUpdateInfoList.appSummaryForUpdates;
f = g ? g instanceof Array ? g : [ g ] : [];
}
for (var h = 0; h < f.length; h++) this._myAppsHash[f[h].publicApplicationId] && this._myAppsHash[f[h].publicApplicationId].updateFromServerUpdatesList(f[h]);
this._sendUpdateListReady();
} else this._sendError();
},
_fetchUpdates: function() {
var a = [];
for (var b in this._myAppsHash) this._myAppsHash[b].isInstalled() && a.push(b);
if (a.length == 0) return;
var c = {
onResponse: "updatescb",
scope: this
};
findApps.BaseServer.getACServer().getListOfUpdatableApps(a, "appupdatesService", c);
},
updateMyApps: function(a, b) {
if (!this.appdownloadmgr.myAppsListIsReady()) return;
b == this.appdownloadmgr.APP_ADDED ? a.appType == "app" ? this.addApp(a, this._apps, "app") : this.addApp(a, this._other, "other") : b == this.appdownloadmgr.APP_DELETED ? a.appType == "app" ? this.deleteApp(a, this._apps, "app") : this.deleteApp(a, this._other, "other") : b == this.appdownloadmgr.APP_UPDATED ? a.appType == "app" ? this.updateApp(a, this._apps, "app") : this.updateApp(a, this._other, "other") : b == this.appdownloadmgr.MYAPPS_ALL && this._initMyApps();
},
addApp: function(a, b, c) {
var d = this.binarySearch(b.items, a, !0);
if (d >= 0) if (b.items.length == d || b.items[d].publicApplicationId != a.publicApplicationId) {
b.items.splice(d, 0, a);
var e = this._observers.length;
for (var f = 0; f < e; f++) this._observers[f].updateLists && this._observers[f].updateLists(c, this.ADDED, a, d);
}
},
deleteApp: function(a, b, c) {
var d = this.binarySearch(b.items, a, !1);
if (d >= 0) {
b.items.splice(d, 1);
for (var e = 0; e < this._observers.length; e++) this._observers[e].updateLists && this._observers[e].updateLists(c, this.DELETED, a, d);
}
c != "updates" && this._updateMyUpdatesQueue(a);
},
updateApp: function(a, b, c) {
var d = this.binarySearch(b.items, a, !1);
if (d >= 0) {
for (var e = 0; e < this._observers.length; e++) this._observers[e].updateLists && this._observers[e].updateLists(c, this.UPDATED, a, d);
c != "updates" && this._updateMyUpdatesQueue(a);
}
},
binarySearch: function(a, b, c) {
if (b.title) {
var d = a.length - 1, e = 0, f, g = b.title.toLowerCase();
while (e <= d) {
f = e + d >> 1;
if (a[f].title.toLowerCase() < g) e = f + 1; else {
if (a[f].title.toLowerCase() == g) {
if (a[f].publicApplicationId == b.publicApplicationId) return f;
var h = f - 1;
while (h >= 0 && a[h].title == b.title) {
if (a[h].publicApplicationId == b.publicApplicationId) return h;
h--;
}
var h = f + 1;
while (h < a.length && a[h].title == b.title) {
if (a[h].publicApplicationId == b.publicApplicationId) return h;
h++;
}
return c ? f : -1;
}
d = f - 1;
}
}
return c ? e : -1;
}
return -1;
},
serialSearch: function(a, b) {
for (var c = 0; c < a.length; c++) if (a[c].publicApplicationId == b.publicApplicationId) return c;
},
_updateMyUpdatesQueue: function(a) {
var b = a.stateToString(), c = this.binarySearch(this._myUpdates.items, a, !1);
a.canInstallUpdate() && c < 0 ? this.addApp(a, this._myUpdates, "updates") : c < 0 || b != "installed" && b != "installfailed" && b != "downloadfailed" && b != "download" ? c >= 0 && this.updateApp(a, this._myUpdates, "updates") : this.deleteApp(a, this._myUpdates, "updates");
},
attach: function(a) {
this._observers.push(a);
},
detach: function(a) {
for (var b = 0; b < this._observers.length; b++) this._observers[b] === a && this._observers.splice(b, 1);
}
});
;
// lib/download/downloadstates.js

enyo.kind({
name: "appstatescommon",
kind: enyo.Control,
components: [ {
name: "appinstallservice",
kind: "findApps.AppInstallService"
}, {
name: "applicationinstaller",
kind: "findApps.ApplicationInstaller"
} ],
_1xCarrierDialog: function(a) {
var b = "";
return a ? a == "sprint" && (b = this._createPopup($L("No 3G Data Network"), $L("The app will download slowly because a high-speed network is not available. You can download later when you have a 3G or Wi-Fi data connection. If you paid for the app, you will not be charged again."), $L("Download Now"), $L("Download Later"))) : b = this._createPopup($L("No 3G Data Network"), $L("You will be unable to receive phone calls while the application is downloading. You can download later when you have a 3G or Wi-Fi data connection. If you paid for the app, you will not be charged again."), $L("Download Now"), $L("Download Later")), b;
},
_createPopup: function(a, b, c, d) {
var e = CommonUtil.getRandNumber();
return this.createComponent({
kind: "ModalDialog",
modal: !0,
scrim: !0,
name: "popupPrompt" + e,
components: [ {
className: "",
content: a,
className: "enyo-text-header",
style: "text-align:center;"
}, {
className: "",
content: b,
className: "enyo-paragraph"
}, {
kind: "VFlexBox",
style: "padding-top: 6px;",
components: [ {
kind: "Button",
className: "enyo-button-dark",
value: "submit",
caption: c,
onclick: "submit" + e
}, {
kind: "Button",
className: "enyo-button-light",
value: "cancel",
caption: d,
onclick: "submit" + e
} ]
} ],
owner: this
}), e;
},
_verifyPaymentSetupSuccess: function(a, b, c, d) {
myProfile.validPayment = b, d.callback(!0, b);
},
_verifyPaymentSetupFailure: function(a, b, c, d, e) {
d.callback(!1, b, e);
},
_verifyPaymentSetup: function(a) {
findApps.BaseServer.getPMTServer().verifyPaymentSetup("DsVerifyPaymentSvc", {
onSuccess: "_verifyPaymentSetupSuccess",
onFailure: "_verifyPaymentSetupFailure",
scope: this,
callback: a
});
},
_getPromoFromDBExt: function(a) {
a(!0, enyo.getCookie("findapps.promocode"));
},
_savePromoFromDBExt: function(a) {
enyo.setCookie("findapps.promocode", a);
},
_capturePaymentPromoSuccess: function(a, b, c, d) {
var e = d.app;
e.setState("purchased", {
version: e.serverVersion,
transitional: !0
}), b && b.OutCapturePayment && b.OutCapturePayment.promoCodeStatus == "R" && enyo.setCookie("findapps.promocode", ""), callback(!0);
},
_capturePaymentPromoFailure: function(a, b, c, d, e) {
var f = d.app;
f.setState("purchase_failed", {
errorStack: e
});
},
_purchaseWithPromoCode: function(a, b, c, d) {
var e = a, f = new Date, g = "" + f.getMilliseconds();
while (g.length < 3) g = "0" + g;
var h = Utilities.Formatter.serverTimeFormat(f) + g, i = {
timestamp: h,
currency: e.currency,
items: [ {
type: e.priceType,
promoCode: b,
quantity: "1",
sku: e.sku,
unitPrice: e.price
} ]
};
a.setState("purchasing"), findApps.BaseServer.getPMTServer().capturePayment(i, "DsCapturePaymentSvc", {
onSuccess: "_capturePaymentPromoSuccess",
onFailure: "_capturePaymentPromoFailure",
scope: this,
app: a
});
},
_gotoPromoCodeDialog: function(a, b, c, d, e, f) {
var g = this;
this.promoCodeConfirmed = function(b, c) {
c.promoCodeValid ? g.owner.$.appStates_appstatescommon._purchaseWithPromoCode(a, c.promoCode, d, f) : g.owner.$.appStates_appstatescommon._makePurchase(a, d, e, f), i.close(), i.destroy();
}, this.promoCodeCanceled = function() {
i.close(), i.destroy(), a.setState("download"), f(!1);
};
var h = {
appid: a.publicApplicationId,
version: a.serverVersion,
title: a.title,
promoCode: b,
errCode: c
};
this.$.promocodeeditor == undefined && this.createComponent({
lazy: !1,
name: "promocodeeditor",
kind: "enyo.FindApps.PromoCodePrompt",
onPromoCodeConfirmed: "promoCodeConfirmed",
onPromoCodeCanceled: "promoCodeCanceled",
owner: this
});
var i = this.$.promocodeeditor;
i.setParams(h), i.render(), i.openAtCenter(), i.focusPromoInput();
},
_checkPromoCodeStatusSuccess: function(a, b, c, d) {
var e = d.app, f = d.force, g = d.callback, h = d.promoCode, i = d.errorCode, j = d.gotoPromoCodeEditor, k = d.delPromoCode;
if (b && b.OutCheckPromoCodeStatus) if (b.OutCheckPromoCodeStatus.valid == "true") this.owner.$.appStates_appstatescommon._purchaseWithPromoCode(e, h, b, g); else if (b.OutCheckPromoCodeStatus.valid == "false") {
j = !0, i = b.OutCheckPromoCodeStatus.errorCode;
if (i == "PMTPROMO70101" || i == "PMTPROMO70102" || i == "PMTPROMO70103" || i == "PMTPROMO70104") k = !0;
}
j && this.owner.$.appStates_appstatescommon._gotoPromoCodeDialog(e, h, i, b, f, g), k && this.owner.$.appStates_appstatescommon._savePromoFromDBExt("");
},
_checkPromoCodeStatusFailure: function(a, b, c, d, e) {
var f = d.app, g = d.force, h = d.callback, i = d.promoCode, j = d.errorCode;
b.JSONException && b.JSONException.errorCode && (j = b.JSONException.errorCode), this.owner.$.appStates_appstatescommon._gotoPromoCodeDialog(f, i, j, b, g, h), this.owner.$.appStates_appstatescommon._savePromoFromDBExt("");
},
_verifyPromoCode: function(a, b, c, d) {
var e = this, f = !1, g = !1, h = "", i = "";
e.owner.$.appStates_appstatescommon._getPromoFromDBExt(function(j, k) {
i = k, i != undefined && i != "" ? findApps.BaseServer.getPMTServer().checkPromoCodeStatus(i, a.publicApplicationId, a.serverVersion, "DsCheckPromoCodeSvc", {
onSuccess: "_checkPromoCodeStatusSuccess",
onFailure: "_checkPromoCodeStatuscbFailure",
scope: this,
app: a,
force: c,
callback: d,
promoCode: i,
errorCode: h,
gotoPromoCodeEditor: f,
delPromoCode: g
}) : (i = "", h = "", e.owner.$.appStates_appstatescommon._gotoPromoCodeDialog(a, i, h, b, c, d));
});
},
_makePurchase: function(a, b, c, d) {
var e = this, f = b.OutGetPaymentInfos.ccPaymentInfos && b.OutGetPaymentInfos.ccPaymentInfos.length > 0 ? b.OutGetPaymentInfos.ccPaymentInfos[0] : null, g = b.OutGetPaymentInfos.obPaymentInfos && b.OutGetPaymentInfos.obPaymentInfos.length > 0 ? b.OutGetPaymentInfos.obPaymentInfos[0] : null;
c && (c == "cc" ? g = null : f = null), f && g && (f["default"] ? g = null : f = null);
if (f) a.paymentType = "cc"; else if (g) a.paymentType = "ob"; else {
a.setState("download"), d(!1);
return;
}
if (!enyo.application.connectionManager.isOnline()) {
a.setState("download"), d(!1);
return;
}
var h = f ? "credit card" : "carrier account", i = CommonUtil.getRandNumber();
this["confirmPurchase" + i] = function() {
e.$["purchaseconfirm" + i].close(), e.cleanupInMakePurchase(i), a.setState("purchasing"), g ? e._startOBPayment(a, g, d) : e._capturePayment(a, f, d);
}, this["confirmPromo" + i] = function() {
e.$["purchaseconfirm" + i].close(), e.cleanupInMakePurchase(i), e.owner.$.appStates_appstatescommon._verifyPromoCode(a, b, c, d);
}, this["cancelDialog" + i] = function() {
e.$["purchaseconfirm" + i].close(), e.cleanupInMakePurchase(i), a.setState("download"), d(!1);
}, this.cleanupInMakePurchase = function(a) {
e.$["purchaseconfirm" + a] && e.$["purchaseconfirm" + a].destroy(), CommonUtil.delFunc(e, "confirmPurchase", a), CommonUtil.delFunc(e, "confirmPromo", a), CommonUtil.delFunc(e, "cancelDialog", a);
}, this.createComponent({
lazy: !1,
name: "purchaseconfirm" + i,
kind: "enyo.FindApps.PurchaseConfirmPrompt",
account: h,
title: a.title,
onPurchase: "confirmPurchase" + i,
onPromo: "confirmPromo" + i,
onCancel: "cancelDialog" + i,
owner: this
}), this.$["purchaseconfirm" + i].render(), this.$["purchaseconfirm" + i].openAtCenter();
},
_initOBSessionSuccess: function(a, b, c, d) {
var e = d.app, f = d.ob, g = d.callback, h = d.obInfos;
this.log("xml", b);
var i = new DOMParser, j = i.parseFromString(b, "text/xml");
f.obSessionId = j.getElementsByTagName("session")[0].getAttribute("id"), f.devicePoll = h.devicePoll, this._capturePayment(e, f, g);
},
_initOBSessionFailure: function(a, b, c, d, e) {
var f = d.app, g, h;
b && b.getElementsByTagName && b.getElementsByTagName("error") && (g = b.getElementsByTagName("error")[0].getAttribute("code")), g && (e.push(g), g === 2045 || g === 2126 ? h = "PMT05213" : h = g ? "PMTINIT" + g : undefined, e.push("errCode:" + g), h && e.push(h)), f.setState("purchase_failed", {
errorStack: e
});
},
_getOBInfosSuccess: function(a, b, c, d) {
var e = d.app, f = d.ob, g = d.callback, h = b.OutGetOBInfos;
findApps.BaseServer.getPMTServer().initOBSession(h, "initOBSessioncb", {
onSuccess: "_initOBSessionSuccess",
onFailure: "_initOBSessionFailure",
scope: this,
app: e,
ob: f,
callback: g,
obInfos: h
});
},
_getOBInfosFailure: function(a, b, c, d, e) {
d.app.setState("purchase_failed", {
errorStack: e
});
},
_startOBPayment: function(a, b, c) {
findApps.BaseServer.getPMTServer().getOBInfos("", {
onSuccess: "_getOBInfosSuccess",
onFailure: "_getOBInfosFailure",
scope: this,
app: a,
ob: b,
callback: c
});
},
cleanupInCapturePayment: function(a) {
this.$["paymentserver" + a] && this.$["paymentserver" + a].destroy(), CommonUtil.delFunc(this, "capturePaymentFailure", a), CommonUtil.delFunc(this, "capturePaymentSuccess", a), this.$["temperror" + a] && this.$["temperror" + a].destroy(), CommonUtil.delFunc(this, "OnCancel", a);
},
_capturePaymentSuccess: function(a, b, c, d) {
var e = d.app, f = d.paymentInfo, g = d.callback;
if (f.devicePoll) {
var h = b.OutCapturePayment.orderNo, i = (new Date).getTime() + f.devicePoll.timeout * 1e3, j = f.devicePoll.period * 1e3;
this._pollForOrderStatus(e, h, i, j, g);
} else e.setState("purchased", {
version: e.serverVersion,
transitional: !0
}), g(!0);
},
_capturePaymentFailure: function(a, b, c, d, e) {
var f = d.app;
e = [ "LOC04007" ];
var g = b && b.JSONException && b.JSONException.errorCode ? b.JSONException.errorCode : b;
g !== "" && e.push(g);
if (g === "PMT03037") {
f.setState("purchased", {
version: f.serverVersion,
transitional: !0
}), f.install();
var h = CommonUtil.getRandNumber(), i = this;
this["OnCancel" + h] = function() {
i.cleanupInCapturePayment(h);
}, this.createComponent({
name: "temperror" + h,
kind: "Error",
onCancel: "OnCancel" + h,
owner: this
}).displayError(e);
} else f.setState("purchase_failed", {
errorStack: e
});
},
_capturePayment: function(a, b, c) {
var d = a, e = new Date, f = "" + e.getMilliseconds();
while (f.length < 3) f = "0" + f;
var g = Utilities.Formatter.serverTimeFormat(e) + f, h = {
paymentInfoId: b.paymentInfoId,
obSessionId: b.obSessionId,
timestamp: g,
currency: d.currency,
items: [ {
type: d.priceType,
quantity: "1",
sku: d.sku,
unitPrice: d.price
} ]
};
findApps.BaseServer.getPMTServer().capturePayment(h, "", {
onSuccess: "_capturePaymentSuccess",
onFailure: "_capturePaymentFailure",
scope: this,
app: a,
paymentInfo: b,
callback: c
});
},
cleanupPollForOrderStatus: function(a) {
this.$["paymentserver" + a] && this.$["paymentserver" + a].destroy(), CommonUtil.delFunc(this, "getOrderStatuscb", a), CommonUtil.delFunc(this, "getOrderStatuscbFailure", a);
},
_getOrderStatusSuccess: function(a, b, c, d) {
var e = d.app, f = d.orderNo, g = d.pollingEnds, h = d.pollingInterval, i = d.callback, j = [];
switch (b.OutGetOrderStatus.status) {
case "NEW":
case "RENEWED":
(new Date).getTime() < g ? setTimeout(this._pollForOrderStatus.bind(this, e, f, g, h, i), h) : (j.push("LOC04016"), e.setState("purchase_pending", {
errorStack: j
}), i(!1));
break;
case "CLOSED":
e.setState("purchased", {
version: e.serverVersion,
transitional: !0
}), i(!0);
break;
case "DECLINED":
j.push("LOC04017"), j.push(b.OutGetOrderStatus.code || b), e.setState("purchase_failed", {
errorStack: j
});
break;
default:
j.push("LOC04018"), e.setState("purchase_pending", {
errorStack: j
});
}
},
_getOrderStatusFailure: function(a, b, c, d, e) {
var f = d.app;
e.push("LOC04019"), f.setState("purchase_pending", {
errorStack: e
});
},
_pollForOrderStatus: function(a, b, c, d, e) {
findApps.BaseServer.getPMTServer().getOrderStatus(b, "", {
onSuccess: "_getOrderStatusSuccess",
onFailure: "_getOrderStatusFailure",
scope: this,
app: a,
orderNo: b,
pollingEnds: c,
pollingInterval: d,
callback: e
});
},
cleanupInHandleEmbargoAcc: function(a) {
this.$["temperror" + a] && this.$["temperror" + a].destroy(), CommonUtil.delFunc(this, "OnSubmit", a), CommonUtil.delFunc(this, "OnCancel", a);
},
_handleEmbargoAcc: function(a, b) {
var c = this, d = CommonUtil.getRandNumber();
if (myProfile.isEmbargoed) {
var e = [ "LOC04008" ];
c["OnSubmit" + d] = function() {
findApps.ApplicationManager.getInstance().openApplication("com.palm.app.help", {
target: enyo.application.connectionManager.isOnline() ? "http://help.palm.com/app_catalog/appcatalog_download_error.html" : "no-network"
}), c.cleanupInHandleEmbargoAcc(d);
}, c["OnCancel" + d] = function() {
c.cleanupInHandleEmbargoAcc(d);
}, c.createComponent({
name: "temperror" + d,
kind: "Error",
onSubmit: "OnSubmit" + d,
onCancel: "OnCancel" + d,
owner: c
}).displayError(e), b(!1);
} else b(!0);
},
cleanupInCheckNotEmbargoed: function(a) {
this.$["paymentserver" + a] && this.$["paymentserver" + a].destroy(), CommonUtil.delFunc(this, "embargolistcb", a), CommonUtil.delFunc(this, "embargolistcbFailure", a), this.$["temperror" + a] && this.$["temperror" + a].destroy(), CommonUtil.delFunc(this, "OnCancel", a);
},
_embargolistSuccess: function(a, b, c, d) {
var e = d.app, f = d.callback, g = d.ext;
findApps.AccountServices.embargoedList = b.OutGetEmbargoedEmailExtensions.embargoedEmailExtensions, myProfile.isEmbargoed = findApps.AccountServices.embargoedList.indexOf(g) !== -1, this._handleEmbargoAcc(e, f);
},
_embargolistFailure: function(a, b, c, d, e) {
e.push("LOC04005");
var f = CommonUtil.getRandNumber(), g = this;
this["OnCancel" + f] = function() {
g.cleanupInCheckNotEmbargoed(f);
}, this.createComponent({
name: "temperror" + f,
kind: "Error",
onCancel: "OnCancel" + f,
owner: this
}).displayError(e), d.callback(!1);
},
_checkNotEmbargoed: function(a, b) {
if (a.price > 0 || a.isEncrypted) if (myProfile.isEmbargoed !== undefined) this._handleEmbargoAcc(a, b); else {
var c = myProfile.email.substring(myProfile.email.lastIndexOf(".") + 1);
findApps.AccountServices.embargoedList ? (myProfile.isEmbargoed = findApps.AccountServices.embargoedList.indexOf(c) !== -1, this._handleEmbargoAcc(a, b)) : findApps.BaseServer.getPMTServer().getEmbargoedEmailExtensions("DSEmbargoedExtnsSvc", {
onSuccess: "_embargolistSuccess",
onFailure: "_embargolistFailure",
scope: this,
app: a,
callback: b,
ext: c
});
} else b(!0);
},
_forcePaymentType: function(a, b, c) {
var d = this, c = function(b) {
b ? d.owner.$.appStates_appstatescommon._install(a) : a.setState("download");
};
a.setState("download"), b == "cc" ? myProfile.validPayment.OutGetPaymentInfos.ccPaymentInfos && myProfile.validPayment.OutGetPaymentInfos.ccPaymentInfos.length > 0 ? d._makePurchase(a, myProfile.validPayment, "cc", c) : this.showPaymentSetup(a, c, "cc") : myProfile.validPayment.OutGetPaymentInfos.obPaymentInfos && myProfile.validPayment.OutGetPaymentInfos.obPaymentInfos.length > 0 ? d._makePurchase(a, myProfile.validPayment, "ob", c) : this.showPaymentSetup(a, c, "ob");
},
showPaymentSetup: function(a, b, c) {
var d = viewLibrary.getView("PREFERENCES");
d.setShowPaymentSetup(!0), d.setCallback(function(d) {
d.accountValid ? self.owner.$.appStates_appstatescommon._handleVerifyPayment(a, !0, c, b) : b(!1);
});
},
cleanupInLocationServices: function(a) {
this.$["popupPrompt" + a] && this.$["popupPrompt" + a].destroy(), CommonUtil.delFunc(this, "submit", a);
},
_handleLocationServices: function(a, b) {
var c = this;
if (a.islocationbased) {
var d = this._createPopup($L("Location Services"), $L("This application will request your current location for some functions."), $L("Continue"), $L("Cancel"));
this["submit" + d] = function(a, e) {
c.$["popupPrompt" + d].close(), a.value == "submit" ? b(!0) : a.value == "cancel" && b(!1), c.cleanupInLocationServices(d);
}, this.$["popupPrompt" + d].render(), this.$["popupPrompt" + d].openAtCenter();
} else b(!0);
},
cleanupInValidateInstallSpace: function(a) {
CommonUtil.delFunc(this, "validateInstallSuccess", a), CommonUtil.delFunc(this, "validateInstallFailure", a), this.$["temperror" + a] && this.$["temperror" + a].destroy(), CommonUtil.delFunc(this, "OnSubmit", a), CommonUtil.delFunc(this, "OnCancel", a);
},
validateInstallSpace: function(a, b, c) {
var d = this, e = CommonUtil.getRandNumber();
d["validateInstallSuccess" + e] = function(a, b) {
this.log("In validateInstallSuccess ", b.result), b.result == 0 || b.result == 4 || AppCatalog.Config.useBrowser == 1 ? (c(!0), d.cleanupInValidateInstallSpace(e)) : d["validateInstallFailure" + e](a, b);
}, d["validateInstallFailure" + e] = function(a, f) {
d.error("validInstallFailure ", f);
var g;
f && f.spaceNeededInKB ? (g = parseInt(f.spaceNeededInKB), g = g < 1024 ? g + " " + $L("KB") : Utilities.Formatter.formatRound2(g / 1024) + " " + $L("MB")) : g = $L("unknown MB"), d["OnSubmit" + e] = function() {
var a = enyo.application.connectionManager.isOnline();
findApps.ApplicationManager.getInstance().openApplication("com.palm.app.help", {
target: a ? "http://help.palm.com/basics/manage_applications/basics_delete_app_from_launcher.html" : "no-network"
}), d.cleanupInValidateInstallSpace(e);
}, d["OnCancel" + e] = function() {
d.cleanupInValidateInstallSpace(e);
};
var h = [];
h.push(b), d.createComponent({
name: "temperror" + e,
kind: "Error",
onSubmit: "OnSubmit" + e,
onCancel: "OnCancel" + e,
owner: d
}).displayError(h, {
installSize: g
}), c(!1);
}, d.$.applicationinstaller.validateInstall(a.publicApplicationId, a.packageSize, a.installSize, "validateInstallSuccess" + e, "validateInstallFailure" + e);
},
validateDownloadConnectionCleanup: function(a) {
this.$["popupPrompt" + a] && this.$["popupPrompt" + a].destroy(), CommonUtil.delFunc(this, "submit", a);
},
validateDownloadConnection: function(a) {
if (enyo.application.connectionManager.isOn1x()) if (this.owner.canAllow1xDownload()) a(!0); else {
var b = this, c = this._1xCarrierDialog(myProfile.carrier);
this["submit" + c] = function(d, e) {
b.$["popupPrompt" + c].close(), d.value == "submit" ? b.owner.allow1xDownload(!0, function(b) {
a(b);
}) : d.value == "cancel" && a(!1), b.validateDownloadConnectionCleanup(c);
}, this.$["popupPrompt" + c].render(), this.$["popupPrompt" + c].openAtCenter();
} else enyo.application.connectionManager.isOnline() ? a(!0) : a(!1);
},
_install: function(a) {
var b = this;
this.owner.$.appStates_appstatescommon.validateDownloadConnection(function(c) {
var d = a.stateToString();
c && (a.setState("fakeprogress"), b.installcb = function(a, b) {}, b.installfail = function(b, c) {
a.stateToString() == "fakeprogress" && a.setState(d);
}, b.$.appinstallservice.install(a, "installcb", "installfail"));
});
},
_revert: function(a, b) {
this.revertcb = function(a, b) {}, this.$.appinstallservice.installLocal(b, null, "revertcb");
},
_pause: function(a) {
var b = a.stateToString();
a.setState("pausing"), this.pausecb = function(c, d) {
a.stateToString() == "pausing" && a.setState(b);
}, this.$.appinstallservice.pause(a.publicApplicationId, null, "pausecb");
},
_resume: function(a) {
var b = this;
b.owner.$.appStates_appstatescommon.validateDownloadConnection(function(c) {
if (c) {
var d = a.stateToString();
a.setState("resuming"), b.resumecb = function(b, c) {
a.stateToString() == "resuming" && a.setState(d);
}, b.$.appinstallservice.resume(a.publicApplicationId, null, "resumecb");
}
});
},
_cancel: function(a) {
var b = this, c = a.stateToString();
a.setState("canceling"), this.cancelcb = function(b, d) {
a.stateToString() == "canceling" && a.setState(c);
}, this.$.appinstallservice.cancel(a.publicApplicationId, null, "cancelcb");
},
_uninstall: function(a) {
var b = this, c = a.stateToString();
a.setState("removing"), this.uninstallremovecb = function(b, d) {
a.stateToString() == "removing" && a.setState(c);
}, this.$.appinstallservice.remove(a.publicApplicationId, null, "uninstallremovecb");
},
_restore: function(a) {
var b = this;
if (a.errorCode == "FAILED_IPKG_INSTALL") {
var c = a.stateToString();
this.removecb = function(b, d) {
a.stateToString() == "installfailed" && a.setState(c);
}, b.$.appinstallservice.remove(a.publicApplicationId, null, "removecb");
} else b.owner.$.appStates_appstatescommon._cancel(a);
},
_reset: function(a) {
a.installedVersion ? a.serverVersion && Utilities.VersionCheck.compare(a.installedVersion, a.serverVersion) == -1 ? a.setState("installupdateavailable") : a.setState("installed") : a.price && a.price > 0 ? a.setState("purchased") : a.setState("download");
},
_remove: function(a) {
a.installedVersion = null, a.pendingRevert ? (a.pendingRevert = !1, a.setState("download"), this.owner.$.appStates_appstatescommon._revert(null, this.owner.getDetailsRevertableApp(a.publicApplicationId))) : a.price && a.price > 0 ? a.setState("purchased") : a.setState("download");
},
cleanupInFetchAppDetails: function(a) {
this.$["catalogServer" + a] && this.$["catalogServer" + a].destroy(), CommonUtil.delFunc(this, "detailscb", a), this.$["temperror" + a] && this.$["temperror" + a].destroy(), CommonUtil.delFunc(this, "OnCancel", a);
},
detailscb: function(a, b, c, d, e) {
if (e && e.length && e.length > 0) {
e.push("LOC04004");
var f = CommonUtil.getRandNumber(), g = this;
g["OnCancel" + f] = function() {
g.cleanupInFetchAppDetails(f);
}, g.createComponent({
kind: "Error",
name: "temperror" + f,
onCancel: "OnCancel" + f,
owner: g
}).displayError(e), d.callback(!1);
} else d.app.updateFromServer(b.OutGetAppDetailV2.appDetail), d.callback(!0);
},
_fetchAppDetails: function(a, b) {
findApps.BaseServer.getACServer().getApplicationDetails(null, a.publicApplicationId, enyo.g11n.currentLocale().toISOString(), "GDBAppDetailsSvc", !0, {
onResponse: "detailscb",
scope: this,
app: a,
callback: b
});
}
}), enyo.kind({
name: "dummy",
kind: enyo.Control,
init: function(a, b) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "none", a._progressPillModel.image = undefined, a._progressPillModel.value = undefined, a._progressPillModel.title = $L("Getting data..."), a.enableSave = !0, a.disabledClass = null, a.updateClass = null, a.activeClass = null, a.resumeClass = null, a.pauseClass = null, a.warningClass = null, a.completeClass = null;
},
updateFromServer: function(a) {
this._update(a);
},
updateFromInstalledAppsList: function(a) {
this._update(a);
},
_update: function(a) {
var b = "download";
a.purchasedVersion && (b = "purchased"), a.installedVersion && (b = "installed", a.serverVersion && Utilities.VersionCheck.compare(a.installedVersion, a.serverVersion) == -1 && (b = "installupdateavailable")), a.setState(b);
},
toString: function() {
return "dummy";
}
}), enyo.kind({
name: "fakeprogress",
kind: enyo.Control,
init: function(a) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "none", a._progressPillModel.image = "none", a._progressPillModel.title = $L("Downloading..."), a._progressPillModel.value = 0, a.enableSave = !1, a.disabledClass = "disabled", a.updateClass = null, a.activeClass = "active", a.resumeClass = null, a.pauseClass = null, a.warningClass = null, a.completeClass = null;
},
_reset: function(a) {
this.owner.$.appStates_appstatescommon._reset(a);
},
_remove: function(a) {
this.owner.$.appStates_appstatescommon._remove(a);
},
saveToMyApps: function() {
return !0;
},
toString: function() {
return "fakeprogress";
}
}), enyo.kind({
name: "pausing",
kind: enyo.Control,
init: function(a) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "none", a._progressPillModel.image = undefined, a._progressPillModel.title = $L("Pausing..."), a.enableSave = !1, a.disabledClass = "disabled";
},
_allowTransition: function(a) {
return a == "downloadprogress" ? !1 : !0;
},
_reset: function(a) {
this.owner.$.appStates_appstatescommon._reset(a);
},
_remove: function(a) {
this.owner.$.appStates_appstatescommon._remove(a);
},
saveToMyApps: function() {
return !0;
},
toString: function() {
return "pausing";
}
}), enyo.kind({
name: "resuming",
kind: enyo.Control,
init: function(a) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "none", a._progressPillModel.image = undefined, a._progressPillModel.title = $L("Resuming..."), a.enableSave = !1, a.disabledClass = "disabled";
},
_reset: function(a) {
this.owner.$.appStates_appstatescommon._reset(a);
},
_remove: function(a) {
this.owner.$.appStates_appstatescommon._remove(a);
},
saveToMyApps: function() {
return !0;
},
toString: function() {
return "resuming";
}
}), enyo.kind({
name: "removing",
kind: enyo.Control,
init: function(a) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "none", a._progressPillModel.image = undefined, a._progressPillModel.title = $L("Deleting..."), a._progressPillModel.value = 1, a.enableSave = !1, a.disabledClass = "disabled", a.updateClass = null, a.activeClass = null, a.resumeClass = null, a.pauseClass = null, a.warningClass = null;
},
_allowTransition: function(a) {
return a == "downloadprogress" ? !1 : !0;
},
_reset: function(a) {
this.owner.$.appStates_appstatescommon._reset(a);
},
_remove: function(a) {
this.owner.$.appStates_appstatescommon._remove(a);
},
saveToMyApps: function() {
return !0;
},
toString: function() {
return "removing";
}
}), enyo.kind({
name: "canceling",
kind: enyo.Control,
init: function(a) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "none", a._progressPillModel.image = undefined, a._progressPillModel.title = $L("Canceling..."), a.enableSave = !1, a.disabledClass = "disabled";
},
_allowTransition: function(a) {
return a == "downloadprogress" ? !1 : !0;
},
_reset: function(a) {
this.owner.$.appStates_appstatescommon._reset(a);
},
_remove: function(a) {
this.owner.$.appStates_appstatescommon._remove(a);
},
saveToMyApps: function() {
return !0;
},
toString: function() {
return "canceling";
}
}), enyo.kind({
name: "download",
kind: enyo.Control,
init: function(a, b) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "none", a._progressPillModel.image = undefined, a._progressPillModel.value = undefined, a._progressPillModel.title = a.getFormattedPrice(), a.enableSave = !0;
var c = enyo.getCookie("acpromocode");
a.promoLink && a.price != 0 && c && c.length > 0 && (a._progressPillModel.icon = "none", a._progressPillModel.image = undefined);
if (a.price == 0 || !a.price) a._progressPillModel.title = $L("Free");
a.progress = 0, a.disabledClass = null, a.updateClass = null, a.activeClass = null, a.resumeClass = null, a.pauseClass = null, a.warningClass = null, a.completeClass = "complete";
},
updateFromInstalledAppsList: function(a) {
a.installedVersion && (a.serverVersion && Utilities.VersionCheck.compare(a.installedVersion, a.serverVersion) == -1 ? a.setState("installupdateavailable") : a.setState("installed"));
},
updateFromServer: function(a) {
var b = "download";
a.purchasedVersion && (b = "purchased"), a.installedVersion && (b = "installed", Utilities.VersionCheck.compare(a.installedVersion, a.serverVersion) == -1 && (b = "installupdateavailable")), a.setState(b);
},
removeFromMyApps: function() {
return !0;
},
defaultAction: function(a) {
a.install();
},
install: function(a) {
var b = this;
b.owner.$.appStates_appstatescommon._checkNotEmbargoed(a, function(c) {
c ? b.owner.$.appStates_appstatescommon._handleLocationServices(a, function(c) {
c ? b.owner.$.appStates_appstatescommon.validateInstallSpace(a, "validate_space_default_single", function(c) {
c ? b.owner.$.appStates_appstatescommon.validateDownloadConnection(function(c) {
c ? a.price > 0 ? b.owner.$.appStates_appstatescommon._handleVerifyPayment(a, !Preferences.isLoginTimedOut(), null, function(c) {
c ? b.owner.$.appStates_appstatescommon._install(a) : a.setState("download");
}) : b.owner.$.appStates_appstatescommon._install(a) : a.setState("download");
}) : a.setState("download");
}) : a.setState("download");
}) : a.setState("download");
});
},
toString: function() {
return "download";
}
}), enyo.kind({
name: "downloadprogress",
kind: enyo.Control,
init: function(a, b) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "images/icn-pause.png", a._progressPillModel.image = "images/icn-pause.png", a._progressPillModel.title = $L("Downloading..."), a.enableSave = !1, a._progressPillModel.value = a.progress / 100, a.disabledClass = null, a.updateClass = null, a.activeClass = "active", a.resumeClass = null, a.pauseClass = "show", a.warningClass = null, a.completeClass = null;
},
updateFromServer: function(a) {
a.setState("downloadprogress");
},
updateFromInstalledAppsList: function(a) {
a.setState("downloadprogress");
},
defaultAction: function(a) {
this.pauseDownload(a);
},
myAppsDefaultAction: function(a) {
this.pauseDownload(a);
},
pauseDownload: function(a) {
this.owner.$.appStates_appstatescommon._pause(a);
},
cancelDownload: function(a) {
this.owner.$.appStates_appstatescommon._cancel(a);
},
uninstall: function(a) {
this.owner.$.appStates_appstatescommon._uninstall(a);
},
_reset: function(a) {
this.owner.$.appStates_appstatescommon._reset(a);
},
_remove: function(a) {
this.owner.$.appStates_appstatescommon._remove(a);
},
saveToMyApps: function() {
return !0;
},
toString: function() {
return "downloadprogress";
}
}), enyo.kind({
name: "paused",
kind: enyo.Control,
init: function(a, b) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "images/icn-resume.png", a._progressPillModel.value = a.progress / 100, a._progressPillModel.image = undefined, a._progressPillModel.title = $L("Resume Downloading..."), a.enableSave = !1, a.disabledClass = null, a.updateClass = null, a.activeClass = "active", a.resumeClass = "show", a.pauseClass = null, a.warningClass = null, a.completeClass = null;
},
updateFromServer: function(a) {
a.setState("paused");
},
updateFromInstalledAppsList: function(a) {
a.setState("paused");
},
myAppsDefaultAction: function(a) {
a.resumeDownload();
},
defaultAction: function(a) {
a.resumeDownload();
},
cleanupInResumeDownload: function(a) {
this.$["temperror" + a] && this.$["temperror" + a].destroy(), CommonUtil.delFunc(this, "OnCancel", a);
},
detailscb: function(a, b, c, d, e) {
var f = this, g = d.app;
if (e && e.length) {
var h = CommonUtil.getRandNumber();
f["OnCancel" + h] = function() {
f.cleanupInResumeDownload(h);
}, f.createComponent({
name: "temperror" + h,
kind: "Error",
onCancel: "OnCancel" + h,
owner: f
}).displayError(e);
} else g.updateFromServer(b.OutGetAppDetailV2.appDetail), f.owner.$.appStates_appstatescommon.validateInstallSpace(g, "validate_space_default_single", function(a) {
a && f.owner.$.appStates_appstatescommon._resume(g);
});
},
resumeDownload: function(a) {
var b = this;
a.packageSize != undefined && a.installSize != undefined ? b.owner.$.appStates_appstatescommon.validateInstallSpace(a, "validate_space_default_single", function(c) {
c && b.owner.$.appStates_appstatescommon._resume(a);
}) : findApps.BaseServer.getACServer().getApplicationDetails(a.id, a.publicApplicationId, enyo.g11n.currentLocale().toISOString(), null, null, {
onResponse: "detailscb",
scope: this,
app: a
});
},
cancelPausedDownload: function(a) {
this.owner.$.appStates_appstatescommon._cancel(a);
},
uninstall: function(a) {
this.owner.$.appStates_appstatescommon._uninstall(a);
},
_reset: function(a) {
this.owner.$.appStates_appstatescommon._reset(a);
},
_remove: function(a) {
this.owner.$.appStates_appstatescommon._remove(a);
},
saveToMyApps: function() {
return !0;
},
toString: function() {
return "paused";
}
}), enyo.kind({
name: "downloadfailed",
kind: enyo.Control,
components: [ {
name: "appinstallservice",
kind: "findApps.AppInstallService"
} ],
init: function(a) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "images/icn-error.png", a._progressPillModel.image = undefined, a._progressPillModel.value = undefined, a._progressPillModel.title = $L("Download failed"), a.enableSave = !0, a.progress = 0, a.disabledClass = null, a.updateClass = null, a.activeClass = "warning", a.resumeClass = null, a.pauseClass = null, a.warningClass = "show", a.completeClass = "complete";
},
updateFromServer: function(a) {
a.setState("downloadfailed");
},
updateFromInstalledAppsList: function(a) {
a.setState("downloadfailed");
},
defaultAction: function(a) {
this._defaultAction(a);
},
myAppsDefaultAction: function(a) {
this._defaultAction(a);
},
_defaultAction: function(a) {
var b = this;
this.OnSubmit = function() {
b.$.temperror.destroy(), a.install();
}, this.OnCancel = function() {
b.$.temperror.destroy(), b.owner.$.appStates_appstatescommon._cancel(a);
}, this.createComponent({
name: "temperror",
kind: "Error",
onSubmit: "OnSubmit",
onCancel: "OnCancel",
owner: this
}), this.$.temperror.displayError(a.errorCode, {
errCode: a.errorCode
}, "download_default", null, null);
},
cancelDownload: function(a) {
this.owner.$.appStates_appstatescommon._cancel(a);
},
uninstall: function(a) {
this.owner.$.appStates_appstatescommon._uninstall(a);
},
_reset: function(a) {
this.owner.$.appStates_appstatescommon._reset(a);
},
_remove: function(a) {
this.owner.$.appStates_appstatescommon._remove(a);
},
detailscb: function(a, b, c, d, e) {
var f = this, g = d.app, h = d.oldState;
if (e && e.length) {
var i = CommonUtil.getRandNumber();
d.app.setState(d.oldState), e.push("LOC04002"), f.createComponent({
name: "temperror" + i,
kind: "Error",
onCancel: "OnCancel" + i,
owner: f
}).displayError(e);
} else g.updateFromServer(b.OutGetAppDetailV2.appDetail), f.owner.$.appStates_appstatescommon.validateInstallSpace(g, "validate_space_default_single", function(a) {
a ? f.owner.$.appStates_appstatescommon.validateDownloadConnection(function(a) {
a ? (f.installcb = function(a, b) {}, f.failurecb = function(a, b) {
g.stateToString() == "fakeprogress" && g.setState(h);
}, f.$.appinstallservice.install(g, "installcb", "failurecb")) : g.setState(h);
}) : g.setState(h);
});
},
install: function(a) {
var b = a.stateToString();
a.setState("fakeprogress"), findApps.BaseServer.getACServer().getApplicationDetails(a.id, a.publicApplicationId, enyo.g11n.currentLocale().toISOString(), null, null, {
onResponse: "detailscb",
scope: this,
app: a,
oldState: b
});
},
saveToMyApps: function() {
return !0;
},
toString: function() {
return "downloadfailed";
}
}), enyo.kind({
name: "purchasing",
kind: enyo.Control,
init: function(a, b) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "none", a._progressPillModel.image = undefined, a._progressPillModel.value = undefined, a._progressPillModel.title = $L("Purchasing..."), a.enableSave = !1;
},
toString: function() {
return "purchasing";
}
}), enyo.kind({
name: "purchased",
kind: enyo.Control,
init: function(a, b) {
if (!b || b && !b.transitional) a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "none", a._progressPillModel.image = undefined, a._progressPillModel.value = undefined, a._progressPillModel.title = $L("Free"), a.enableSave = !0;
a.progress = 0, b && b.version && (a.purchasedVersion = b.version);
},
updateFromServer: function(a) {},
updateFromInstalledAppsList: function(a) {
a.installedVersion && (a.serverVersion && Utilities.VersionCheck.compare(a.installedVersion, a.serverVersion) == -1 ? a.setState("installupdateavailable") : a.setState("installed"));
},
removeFromMyApps: function() {
return !0;
},
defaultAction: function(a) {
a.install();
},
install: function(a) {
var b = this;
this.owner.$.appStates_appstatescommon.validateInstallSpace(a, "validate_space_default_single", function(c) {
c && b.owner.$.appStates_appstatescommon._install(a);
});
},
toString: function() {
return "purchased";
}
}), enyo.kind({
name: "purchase_failed",
kind: enyo.Control,
init: function(a, b) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "images/icn-error.png", a._progressPillModel.image = undefined, a._progressPillModel.value = undefined, a._progressPillModel.title = $L("Purchase failed"), a.enableSave = !0, b && (a.errorCode = b.errorCode + "");
},
updateFromServer: function(a) {},
defaultAction: function(a) {
var b = this, c;
a.paymentType == "cc" ? c = "ob" : a.paymentType == "ob" && (c = "cc"), this.OnSubmit = function() {
b.$.temperror.destroy(), c == "cc" ? b.owner.$.appStates_appstatescommon._forcePaymentType(a, "cc") : c == "ob" && b.owner.$.appStates_appstatescommon._forcePaymentType(a, "ob");
}, this.OnCancel = function() {
b.$.temperror.destroy(), b._reset(a);
}, this.createComponent({
name: "temperror",
kind: "Error",
onSubmit: "OnSubmit",
onCancel: "OnCancel",
owner: b
}), this.$.temperror.displayError(a.errorCode, {
errCode: a.errorCode,
failover: c
}, "PMT_purchase_default", null, null);
},
_reset: function(a) {
a.setState("download");
},
_remove: function(a) {
a.setState("download");
},
toString: function() {
return "purchase_failed";
}
}), enyo.kind({
name: "purchase_pending",
kind: "purchase_failed",
init: function(a, b) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "images/icn-error.png", a._progressPillModel.image = undefined, a._progressPillModel.value = undefined, a._progressPillModel.title = $L("Purchase Pending"), a.enableSave = !1, b && (a.errorCode = b.errorCode + ""), this.defaultAction(a);
},
defaultAction: function(a) {
var b = this;
this.OnClick = function() {
b.$.temperror.destroy();
}, this.createComponent({
name: "temperror",
kind: "Error",
onSubmit: "OnClick",
onCancel: "OnClick",
owner: this
}), this.$.temperror.displayError(a.errorCode);
},
toString: function() {
return "purchase_pending";
}
}), enyo.kind({
name: "installing",
kind: enyo.Control,
init: function(a, b) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "none", a._progressPillModel.image = undefined, a._progressPillModel.value = 1, a._progressPillModel.title = $L("Installing..."), a.progress = 100, a.enableSave = !1, a.disabledClass = null, a.updateClass = null, a.activeClass = "active", a.resumeClass = null, a.pauseClass = null, a.warningClass = null;
},
updateFromInstalledAppsList: function(a) {
a.setState("installing");
},
_reset: function(a) {
this.owner.$.appStates_appstatescommon._reset(a);
},
_remove: function(a) {
this.owner.$.appStates_appstatescommon._remove(a);
},
saveToMyApps: function() {
return !0;
},
toString: function() {
return "installing";
}
}), enyo.kind({
name: "installed",
kind: enyo.Control,
components: [ {
name: "applicationmanager",
kind: "findApps.ApplicationManager"
} ],
init: function(a, b) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "none", a._progressPillModel.image = undefined, a._progressPillModel.value = undefined, a._progressPillModel.title = $L("Tap to launch"), a.enableSave = !1, a.disabledClass = null, a.updateClass = null, a.activeClass = null, a.resumeClass = null, a.pauseClass = null, a.warningClass = null, a.completeClass = "complete";
},
updateFromServer: function(a) {
this._update(a);
},
updateFromServerUpdatesList: function(a) {
this._update(a);
},
_update: function(a) {
a.serverVersion && Utilities.VersionCheck.compare(a.installedVersion, a.serverVersion) == -1 ? a.setState("installupdateavailable") : a.setState("installed");
},
saveToMyApps: function() {
return !0;
},
defaultAction: function(a) {
a.launch();
},
launch: function(a) {
var b = this;
this.launchcb = function(a, b) {}, this.launchfailurecb = function(a, b) {}, findApps.ApplicationManager.getInstance().openApplication(a.publicApplicationId, undefined, !0, "launchcb", "launchfailurecb");
},
uninstall: function(a) {
this.owner.$.appStates_appstatescommon._uninstall(a);
},
_reset: function(a) {
this.owner.$.appStates_appstatescommon._reset(a);
},
_remove: function(a) {
this.owner.$.appStates_appstatescommon._remove(a);
},
toString: function() {
return "installed";
}
}), enyo.kind({
name: "installupdateavailable",
kind: enyo.Control,
components: [ {
name: "appinstallservice",
kind: "findApps.AppInstallService"
} ],
init: function(a, b) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "none", a._progressPillModel.image = undefined, a._progressPillModel.value = undefined, a._progressPillModel.title = $L("Update Available"), a.enableSave = !1, a.disabledClass = null, a.updateClass = "update", a.activeClass = null, a.resumeClass = null, a.pauseClass = null, a.warningClass = null, a.completeClass = "complete";
},
saveToMyApps: function() {
return !0;
},
defaultAction: function(a) {
a.install();
},
myAppsDefaultAction: function(a) {
a.install();
},
install: function(a) {
var b = this;
b.owner.$.appStates_appstatescommon.validateInstallSpace(a, "validate_space_default_single", function(c) {
c ? b.owner.$.appStates_appstatescommon._install(a) : a.setState("installupdateavailable");
});
},
installUpdate: function(a) {
var b = this, c = a.stateToString();
a.setState("fakeprogress"), b.installcb = function(a, b) {}, b.failurecb = function(b, d) {
a.stateToString() == "fakeprogress" && a.setState(c);
}, b.$.appinstallservice.install(a, "installcb", "failurecb");
},
updateFromInstalledAppsList: function(a) {
this._update(a);
},
updateFromServerUpdatesList: function(a) {
this._update(a);
},
_update: function(a) {
a.serverVersion && Utilities.VersionCheck.compare(a.installedVersion, a.serverVersion) == -1 ? a.setState("installupdateavailable") : a.setState("installed");
},
uninstall: function(a) {
this.owner.$.appStates_appstatescommon._uninstall(a);
},
_reset: function(a) {
this.owner.$.appStates_appstatescommon._reset(a);
},
_remove: function(a) {
this.owner.$.appStates_appstatescommon._remove(a);
},
toString: function() {
return "installupdateavailable";
}
}), enyo.kind({
name: "installfailed",
kind: enyo.Control,
components: [ {
name: "appinstallservice",
kind: "findApps.AppInstallService"
} ],
init: function(a) {
a._progressPillModel.titleRight = undefined, a._progressPillModel.icon = "images/icn-error.png", a._progressPillModel.image = undefined, a._progressPillModel.value = undefined, a._progressPillModel.title = $L("Install failed"), a.enableSave = !1, a.disabledClass = null, a.updateClass = null, a.activeClass = "warning", a.resumeClass = null, a.pauseClass = null, a.warningClass = "show", a.completeClass = "complete";
},
updateFromServer: function(a) {},
updateFromInstalledAppsList: function(a) {
a.setState("installfailed");
},
defaultAction: function(a) {
this._defaultAction(a);
},
myAppsDefaultAction: function(a) {
this._defaultAction(a);
},
_defaultAction: function(a) {
var b = this, c;
a.installSize ? (c = a.installSize / 1048576 + 1, c = Utilities.Formatter.formatRound2(c) + " " + $L("MB")) : c = $L("unknown MB");
var d = this.owner.getDetailsRevertableApp(a.publicApplicationId);
this.OnRevert = function() {
b.$.temperror.destroy(), a.pendingRevert = !0, b.owner.$.appStates_appstatescommon._restore(a);
}, this.OnCancel = function() {
b.$.temperror.destroy(), b.owner.$.appStates_appstatescommon._cancel(a);
}, this.OnRetry = function() {
b.$.temperror.destroy(), a.install();
}, d ? (this.createComponent({
name: "temperror",
kind: "Error",
onSubmit: "OnRevert",
owner: this
}), this.$.temperror.displayError(a.errorCode, {
installSize: c,
title: a.title
}, "install_revert_default", null, null)) : (this.createComponent({
name: "temperror",
kind: "Error",
onSubmit: "OnRetry",
onCancel: "OnCancel",
owner: this
}), this.$.temperror.displayError(a.errorCode, {
installSize: c
}, "install_default", null, null));
},
cancelDownload: function(a) {
this.owner.$.appStates_appstatescommon._cancel(a);
},
uninstall: function(a) {
this.owner.$.appStates_appstatescommon._uninstall(a);
},
_reset: function(a) {
this.owner.$.appStates_appstatescommon._reset(a);
},
_remove: function(a) {
this.owner.$.appStates_appstatescommon._remove(a);
},
detailscb: function(a, b, c, d, e) {
var f = this, g = d.app, h = d.oldState;
if (e && e.length) {
var i = CommonUtil.getRandNumber();
d.app.setState(d.oldState), e.push("LOC04003"), this["OnCancel" + i] = function() {
f.$["temperror" + i] && f.$["temperror" + i].destroy(), CommonUtil.delFunc(f, "OnCancel", i);
}, this.createComponent({
name: "temperror" + i,
kind: "Error",
onCancel: "OnCancel" + i,
owner: this
}).displayError(e);
} else g.updateFromServer(b.OutGetAppDetailV2.appDetail), f.owner.$.appStates_appstatescommon.validateInstallSpace(g, "validate_space_default_single", function(a) {
a ? f.owner.$.appStates_appstatescommon.validateDownloadConnection(function(a) {
a ? (f.installcb = function(a, b) {}, f.failurecb = function(a, b) {
g.stateToString() == "fakeprogress" && g.setState(h);
}, f.$.appinstallservice.install(g, "installcb", "failurecb")) : g.setState(h);
}) : g.setState(h);
});
},
install: function(a) {
var b = a.stateToString();
a.setState("fakeprogress"), findApps.BaseServer.getACServer().getApplicationDetails(null, a.publicApplicationId, enyo.g11n.currentLocale().toISOString(), null, null, {
onResponse: "detailscb",
scope: this,
app: a,
oldState: b
});
},
saveToMyApps: function() {
return !0;
},
toString: function() {
return "installfailed";
}
});
;
// lib/hacks.js

var HACKS = {
HACK_ENYO_DEFAULT_GUI_EVENT_HANDLER: function a(a) {
var b = enyo.master, c = a && b.getComponents(), d = c ? c.length : 0, e = -1;
while (++e < d && c[e] != a) b.removeComponent(c[e]), b.addComponent(c[e]);
}
};
;
// setup.js

temptoken = {
environment: {
sbdev: {
_serverUrl: "https://ps.sbdev.palm.com/palmcsext/services/deviceJ/",
_paymentServerUrl: "https://pmt.sbdev.palm.com/palmcspmtext/services/paymentJ/"
},
sbqa: {
_serverUrl: "https://ps.sbqa.palm.com/palmcsext/services/deviceJ/",
_paymentServerUrl: "https://pmt.sbqa.palm.com/palmcspmtext/services/paymentJ/"
},
csqa1: {
_serverUrl: "https://ps.csqa1.palmws.com/palmcsext/services/deviceJ/",
_paymentServerUrl: "https://pmt.csqa1.palmws.com/palmcspmtext/services/paymentJ/"
},
qa: {
_serverUrl: "https://ps.qa.palm.com/palmcsext/services/deviceJ/",
_paymentServerUrl: "https://pmt.qa.palm.com/palmcspmtext/services/paymentJ/"
},
prod: {
_serverUrl: "prod-https://ps.palmws.com/palmcsext/services/deviceJ/",
_paymentServerUrl: "prod-https://ps.pa.com/palmcspmtext/services/paymentJ/"
}
},
_accountInfo: {
firstName: "Tester",
lastName: "Tester"
}
}, localconfig = {
localBrowserTesting: enyo.application.localBrowserTesting,
testServerErrors: !1,
env: temptoken.environment.qa,
_token: "M81E632075DE1ADD08453A35B5553C84C",
_deviceId: "e12b364791ac2628b9b561cb7bdcea4e3994755c",
_email: "testing@testing.com"
}, temptoken._serverUrl = localconfig.env._serverUrl, temptoken._paymentServerUrl = localconfig.env._paymentServerUrl, temptoken._token = localconfig._token, temptoken._deviceId = localconfig._deviceId, temptoken._email = localconfig._email;

var AppCatalog = {
Config: {
useBrowser: localconfig.localBrowserTesting,
useDummyAccountParams: localconfig.localBrowserTesting,
wsTimeout: 6e4,
defaultPageSize: 50,
CacheConfig: {
enabled: !0,
persistent: !1,
longTermTTL: 36e5,
shortTermTTL: 9e5
}
}
};
;
// app/appupdates.js

enyo.kind({
kind: "VFlexBox",
name: "swmanager.UpdateApps",
published: {
apps: undefined
},
events: {
onRetry: ""
},
components: [ {
name: "noApps",
showing: !1,
style: "padding-left: 10px;",
flex: 2,
kind: "VFlexBox",
pack: "center",
align: "center",
components: [ {
kind: "Spacer"
}, {
name: "msgicon",
kind: "Image",
src: "../images/icon.png",
flex: 1,
showing: !1
}, {
name: "msg",
content: $L("You have no updates available."),
flex: 0,
height: "105px"
}, {
kind: "HFlexBox",
pack: "center",
align: "center",
name: "retryButton",
showing: !1,
components: [ {
kind: "Button",
caption: $L("Retry"),
onclick: "retryHandler",
flex: 0,
width: "244px"
} ]
}, {
kind: "Spacer"
} ]
}, {
name: "list",
kind: "VirtualList",
onSetupRow: "appSetupRow",
flex: 1,
className: "managerbox-outer",
components: [ {
kind: "SwipeableItem",
name: "swipeableItem",
className: "item-center",
swipeable: !1,
onConfirm: "deleteItem",
pack: "center",
align: "center",
style: "padding:0;border-right:1px solid silver;border-left:1px solid silver;",
confirmCaption: $L("Delete"),
onclick: "itemClick",
components: [ {
name: "progress",
kind: "ProgressBarItem",
style: "height:70px;",
components: [ {
kind: "Control",
width: "482px",
style: "padding:8px;",
components: [ {
kind: "HFlexBox",
components: [ {
name: "app_icon",
kind: "Image",
className: "appIcon"
}, {
kind: "VFlexBox",
flex: 10,
className: "appItemDetails",
components: [ {
name: "app_title",
className: "appTitle enyo-text-ellipsis"
}, {
name: "app_author",
className: "appVendor"
} ]
}, {
kind: "Spacer"
}, {
name: "updateButton",
kind: "Button",
onclick: "itemSubClick",
layoutKind: "HFlexLayout",
align: "center",
className: "enyo-button-light",
components: [ {
name: "update_version"
}, {
kind: "Image",
src: "../images/update-arrow.png",
style: "padding-left:0.7em"
} ]
}, {
name: "rightIcon",
kind: "CustomButton",
className: "action-states",
onclick: "itemSubClick"
} ]
} ]
} ]
} ]
} ]
}, {
kind: "Popup",
name: "deletePopup",
components: [ {
className: "enyo-item enyo-first",
style: "padding:12px",
content: $L("Delete Application")
}, {
className: "enyo-item enyo-last",
style: "padding:12px",
content: $L("Are you sure you want to delete this application from your device?")
}, {
kind: "Button",
caption: $L("DELETE"),
onclick: "handleDeleteApp",
className: "enyo-button-negative"
}, {
kind: "Button",
caption: $L("CANCEL"),
onclick: "closeDeletePopup"
} ]
} ],
create: function() {
this.apps = [], this.inherited(arguments);
},
retryHandler: function() {
this.doRetry(), viewLibrary.getAppLists()._fetchUpdates();
},
appsChanged: function() {
this.renderInstalledApps();
},
appSetupRow: function(a, b) {
var c = this.apps[b];
if (c) return this.$.app_icon.setSrc(c.icon), this.$.app_author.setContent(c.vendor), this.$.app_title.setContent(c.title), c.progress ? this.$.swipeableItem.setTapHighlight(!1) : this.$.swipeableItem.setTapHighlight(!0), this.$.progress.setPosition(c.progress), c.completeClass ? (this.$.progress.addClass(c.completeClass), this.$.swipeableItem.setTapHighlight(!0)) : this.$.progress.removeClass("complete"), c.canInstallUpdate() ? (this.$.update_version.setContent(c.serverVersion), this.$.rightIcon.hide(), this.$.updateButton.show()) : (c.resumeClass ? (this.$.rightIcon.applyStyle("background-image", "url(../images/resume-icon.png)"), this.$.rightIcon.show()) : c.pauseClass ? (this.$.rightIcon.applyStyle("background-image", "url(../images/pause-icon.png)"), this.$.rightIcon.show()) : c.warningClass ? (this.$.rightIcon.applyStyle("background-image", "url(../images/icon-warning.png)"), this.$.rightIcon.show()) : this.$.rightIcon.hide(), this.$.updateButton.hide()), !0;
},
renderInstalledApps: function() {
this.$.list.refresh();
},
listResize: function() {
this.$.list.punt(), this.$.list.resized();
},
itemClick: function(a, b) {
var c = this.apps[b.rowIndex];
this.clickHandled ? this.clickHandled = !1 : this.appDetails(c);
},
deleteApp: function() {
if (this.selectedAppIndex >= 0) {
var a = this.apps[this.selectedAppIndex];
a.uninstall();
}
},
updateApp: function(a) {
a >= 0 && this.$.list.updateRow(a);
},
deleteItem: function(a, b) {
this.selectedAppIndex = b, this.openDeletePopup();
},
openDeletePopup: function() {
this.$.deletePopup.openAtCenter();
},
closeDeletePopup: function() {
this.selectedAppIndex = -1, this.$.deletePopup.close();
},
handleDeleteApp: function() {
this.deleteApp(), this.closeDeletePopup();
},
itemSubClick: function(a, b) {
this.clickHandled = !0;
var c = this.apps[b.rowIndex];
c.myAppsDefaultAction();
},
genericFailure: function(a, b) {
this.error("appupdates: failure response: ", b);
},
appDetails: function(a) {
viewLibrary.lauchACDetail(a.publicApplicationId);
}
});
;
// app/apps.js

enyo.kind({
kind: "VFlexBox",
name: "swmanager.Apps",
published: {
apps: undefined
},
setNoAppsMsg: function(a) {
this.$.noAppsMsg.setContent(a);
},
components: [ {
name: "noApps",
showing: !1,
style: "padding-top: 5%",
flex: 1,
kind: "VFlexBox",
pack: "center",
align: "center",
components: [ {
name: "noAppsMsg",
content: ""
}, {
kind: "Spacer"
} ]
}, {
name: "list",
kind: "VirtualList",
onSetupRow: "appSetupRow",
flex: 1,
components: [ {
kind: "SwipeableItem",
name: "swipeableItem",
className: "item-center",
confirmRequired: !1,
onConfirm: "deleteItem",
style: "padding:0;border-right:1px solid silver;border-left:1px solid silver;",
confirmCaption: $L("Delete"),
onclick: "itemClick",
components: [ {
name: "progress",
kind: "ProgressBarItem",
style: "height:70px;",
components: [ {
kind: "Control",
width: "482px",
style: "padding:8px;",
components: [ {
kind: "HFlexBox",
components: [ {
name: "app_icon",
kind: "Image",
className: "appIcon"
}, {
kind: "VFlexBox",
flex: 10,
className: "appItemDetails",
components: [ {
name: "app_title",
className: "appTitle enyo-text-ellipsis"
}, {
name: "app_author",
className: "appVendor"
} ]
}, {
kind: "Spacer"
}, {
name: "rightIcon",
kind: "CustomButton",
className: "action-states",
onclick: "itemSubClick"
}, {
name: "app_version",
className: "appVersion enyo-text-ellipsis",
style: "text-align: right"
} ]
} ]
} ]
} ]
}, {
kind: "Scrim",
name: "scrim",
layoutKind: "VFlexLayout",
align: "center",
pack: "center",
components: [ {
kind: "SpinnerLarge",
name: "spinner",
showing: !1
} ]
} ]
}, {
kind: "ModalDialog",
name: "deletePopup",
components: [ {
name: "deleteTitle",
className: "enyo-text-header enyo-text-ellipsis ",
style: "padding: 0 10px; text-align: center;",
content: $L("Delete Application")
}, {
name: "deleteContent",
className: "enyo-paragraph",
style: "padding: 0 10px 6px 10px;",
allowHtml: !0,
content: $L("Are you sure you want to delete this application from your device?")
}, {
name: "confirmDelete",
kind: "Button",
caption: $L("Delete"),
onclick: "handleDeleteApp",
className: "enyo-button-negative"
}, {
name: "okDelete",
kind: "Button",
caption: $L("OK"),
onclick: "closeDeletePopup"
}, {
name: "cancelDelete",
kind: "Button",
caption: $L("Cancel"),
onclick: "closeDeletePopup"
} ]
} ],
create: function() {
this.apps = [], this.inherited(arguments);
},
listResize: function() {
this.$.list.punt(), this.$.list.resized();
},
appsChanged: function() {
this.renderInstalledApps(), this.$.list.resized();
},
appSetupRow: function(a, b) {
var c = this.apps[b];
if (c) return this.$.app_icon.setSrc(c.icon), this.$.app_author.setContent(c.vendor), this.$.app_title.setContent(c.title), c.progress ? this.$.swipeableItem.setTapHighlight(!1) : this.$.swipeableItem.setTapHighlight(!0), this.$.progress.setPosition(c.progress), c.completeClass ? (this.$.progress.addClass(c.completeClass), this.$.swipeableItem.setTapHighlight(!0)) : this.$.progress.removeClass("complete"), c._state == "installed" || (c._state + "").indexOf("update") != -1 ? (this.$.rightIcon.hide(), this.$.app_version.show(), this.$.app_version.setContent(c.installedVersion)) : (c.resumeClass ? (this.$.rightIcon.applyStyle("background-image", "url(../images/resume-icon.png)"), this.$.rightIcon.show()) : c.pauseClass ? (this.$.rightIcon.applyStyle("background-image", "url(../images/pause-icon.png)"), this.$.rightIcon.show()) : c.warningClass ? (this.$.rightIcon.applyStyle("background-image", "url(../images/icon-warning.png)"), this.$.rightIcon.show()) : this.$.rightIcon.hide(), this.$.app_version.hide()), !0;
},
renderInstalledApps: function() {
this.$.list.refresh();
},
itemClick: function(a, b) {
var c = this.apps[b.rowIndex];
this.clickHandled ? this.clickHandled = !1 : this.appDetails(c);
},
deleteApp: function() {
if (this.selectedAppIndex >= 0) {
var a = this.apps[this.selectedAppIndex];
a.uninstall();
}
},
updateApp: function(a) {
a >= 0 && this.$.list.updateRow(a);
},
deleteItem: function(a, b) {
this.selectedAppIndex = b, this.openDeletePopup();
},
openDeletePopup: function() {
var a = this.apps[this.selectedAppIndex], b = a.getAppDeleteDialogInfo();
this.$.deletePopup.openAtCenter(), b.deleteTitle !== undefined ? this.$.deleteTitle.setContent(b.deleteTitle) : this.$.deleteTitle.setContent($L("Delete") + " " + a.title), b.deleteMessage !== undefined && this.$.deleteContent.setContent(b.deleteMessage), b.removable === !1 ? (this.$.cancelDelete.setShowing(!1), this.$.confirmDelete.setShowing(!1), this.$.okDelete.setShowing(!0)) : (this.$.cancelDelete.setShowing(!0), this.$.confirmDelete.setShowing(!0), this.$.okDelete.setShowing(!1));
},
closeDeletePopup: function() {
this.selectedAppIndex = -1, this.$.deletePopup.close();
},
handleDeleteApp: function() {
this.deleteApp(), this.closeDeletePopup();
},
itemSubClick: function(a, b) {
this.clickHandled = !0;
var c = this.apps[b.rowIndex];
c.myAppsDefaultAction();
},
genericFailure: function(a, b) {
this.error("apps: failure response: ", b);
},
appDetails: function(a) {
a._state == "installed" || (a._state + "").indexOf("update") != -1 ? (viewLibrary.getView("APPDETAIL").setAppDetails(a), viewLibrary.setView("APPDETAIL")) : viewLibrary.lauchACDetail(a.publicApplicationId);
}
});
;
// app/main.js

enyo.kind({
name: "swmanager.MainPage",
kind: "VFlexBox",
components: [ {
layoutKind: "HFlexLayout",
pack: "center",
components: [ {
name: "top_tabs",
kind: "RadioToolButtonGroup",
style: "width:314px;padding:18px 0;",
onclick: "changed",
components: [ {
label: $L("Apps"),
value: "0"
}, {
label: $L("Other"),
value: "1"
} ]
} ]
}, {
className: "managerbox-outer",
style: "z-index:2;",
kind: "VFlexBox",
flex: 1,
components: [ {
className: "managerbox-inner",
kind: "VFlexBox",
flex: 1,
components: [ {
kind: "Pane",
flex: 1,
name: "main_pane",
style: "z-index:1;",
components: [ {
name: "installed_apps",
kind: "swmanager.Apps"
}, {
name: "other_apps",
kind: "swmanager.Apps"
} ]
} ]
} ]
}, {
name: "updatetoolbar",
kind: "Toolbar",
className: "enyo-toolbar-light",
showing: !1,
components: [ {
name: "updateButton",
kind: "Button",
caption: "",
showing: !0,
onclick: "showUpdates",
className: "enyo-button-dark single-wide-button"
} ]
}, {
kind: "Scrim",
name: "scrim",
layoutKind: "VFlexLayout",
align: "center",
pack: "center",
components: [ {
kind: "SpinnerLarge",
name: "spinner",
showing: !1
} ]
} ],
create: function() {
this.initCreate(), viewLibrary.getAppLists().attach(this), this.inherited(arguments), this.viewSelected(this._selectedTab);
},
initCreate: function() {
this._apps = [], this._other = [], this._updates = [], this._selectedTabData = enyo.getCookie("com.palm.app.swmanager.selectedTab"), this._selectedTabData ? this._selectedTabData.selectedTab === undefined || this._selectedTabData.selectedTab === "" ? this._selectedTab = "apps" : this._selectedTab = this._selectedTabData.selectedTab : this._selectedTab = "apps";
},
refresh: function() {
this._initMyApps(), this._selectedTab == "other" ? this.$.other.listResize() : this.$.installed_apps.listResize();
},
changed: function(a) {
this.$.top_tabs.getValue() == 0 ? (this._selectedTab = "apps", this.viewSelected("apps")) : (this._selectedTab = "other", this.viewSelected("other"));
},
viewSelected: function(a) {
a == "other" ? this.$.main_pane.selectViewByName("other_apps") : this.$.main_pane.selectViewByName("installed_apps"), this._updateNoAppsDiv();
},
hideScrim: function() {
this.$.scrim && (this.$.scrim.hide(), this.$.spinner.setShowing(!1));
},
showScrim: function() {
this.$.scrim && (this.$.scrim.show(), this.$.spinner.setShowing(!0));
},
_initMyApps: function() {
if (!viewLibrary.getAppLists().allListsReady()) {
this.showScrim();
return;
}
this._apps = viewLibrary.getAppLists().getAppsList().items, this._other = viewLibrary.getAppLists().getOtherList().items, this.$.installed_apps.setApps(this._apps), this.$.other_apps.setApps(this._other), this._updates = viewLibrary.getAppLists().getUpdatesList().items, this._updateNoAppsDiv(), this.updateCount(), this.hideScrim();
},
updateCount: function() {
var a = this._updates.length, b = new enyo.g11n.Template($L("1##{num} Update Available|##{num} Updates Available"));
if (this._updates.length == 0) {
this._showUpdatesMenu(!1);
return;
}
this.$.updateButton.setCaption(b.formatChoice(a, {
num: a
})), this.$.updateButton.render(), this._showUpdatesMenu(!0);
return;
},
_showUpdatesMenu: function(a) {
a === !1 ? this.$.updatetoolbar.hide() : this.$.updatetoolbar.show();
},
updateLists: function(a, b, c, d) {
if (!viewLibrary.getAppLists().allListsReady()) return;
b == viewLibrary.getAppLists().ADDED || b == viewLibrary.getAppLists().DELETED ? a == "app" ? (this.$.installed_apps.setApps(this._apps), this._updateNoAppsDiv()) : a == "other" ? (this.$.other_apps.setApps(this._other), this._updateNoAppsDiv()) : a == "updates" && this.updateCount() : b == viewLibrary.getAppLists().UPDATED ? a == "app" ? this.$.installed_apps.updateApp(d) : a == "other" && this.$.other_apps.updateApp(d) : b == viewLibrary.getAppLists().MYAPPS_ALL ? this._initMyApps() : b == viewLibrary.getAppLists().UPDATELIST_ALL && this.updateCount();
},
_updateNoAppsDiv: function() {
this._selectedTab === "apps" ? this._apps.length > 0 ? (this.$.installed_apps.$.noApps.setContent($L("")), this.$.installed_apps.$.noApps.hide()) : this._apps.length == 0 && viewLibrary.getAppLists().allListsReady() && (this.$.installed_apps.setNoAppsMsg($L("You have no apps installed.")), this.$.installed_apps.$.noApps.show()) : this._selectedTab === "other" && (this._other.length > 0 ? (this.$.other_apps.$.noApps.setContent($L("")), this.$.other_apps.$.noApps.hide()) : this._other.length == 0 && viewLibrary.getAppLists().allListsReady() && (this.$.other_apps.setNoAppsMsg($L("You have no services installed.")), this.$.other_apps.$.noApps.show()));
},
showUpdates: function() {
viewLibrary.setView("UPDATES"), enyo.application.dashboardManager.closeDashboard();
}
});
;
// app/Review.js

enyo.kind({
kind: "VFlexBox",
name: "swmanager.Review",
className: "review enyo-bg",
published: {
rating: 1,
app: null
},
myReviewDetails: null,
events: {
onCancel: ""
},
components: [ {
kind: "Scroller",
name: "scroller",
flex: 1,
components: [ {
kind: "VFlexBox",
className: "box-center",
components: [ {
kind: "HFlexBox",
pack: "center",
align: "center",
style: "padding-top: 1em;",
components: [ {
kind: "Image",
name: "app_icon",
style: "max-width: 64px; max-height: 64px;"
}, {
kind: "VFlexBox",
style: "padding-left: 1em",
components: [ {
name: "app_name",
className: "appTitle"
}, {
name: "app_vendor",
className: "appVendor"
} ]
} ]
}, {
kind: "RowGroup",
style: "width:25em",
caption: $L("Rate this App"),
components: [ {
kind: "HFlexBox",
components: [ {
kind: "Image",
name: "star_1",
src: "../images/star-large-single-gray.png",
onclick: "rate",
className: "star-image"
}, {
kind: "Image",
name: "star_2",
src: "../images/star-large-single-gray.png",
onclick: "rate",
className: "star-image"
}, {
kind: "Image",
name: "star_3",
src: "../images/star-large-single-gray.png",
onclick: "rate",
className: "star-image"
}, {
kind: "Image",
name: "star_4",
src: "../images/star-large-single-gray.png",
onclick: "rate",
className: "star-image"
}, {
kind: "Image",
name: "star_5",
src: "../images/star-large-single-gray.png",
onclick: "rate",
className: "star-image"
} ]
} ]
}, {
kind: "RowGroup",
caption: $L("Reviewer"),
style: "width:25em",
components: [ {
kind: "ListSelector",
name: "nameSelector",
className: "list-selector",
value: "Reviewer",
items: []
} ]
}, {
kind: "RowGroup",
name: "myReviewItemCommentBoxRow",
style: "width:25em",
showing: !1,
components: [ {
kind: "RichText",
richContent: !1,
name: "myReviewItemComment",
style: "min-height:240px;",
hint: $L("Tap here to begin typing")
} ]
} ]
} ]
}, {
kind: "Toolbar",
className: "enyo-toolbar-light",
style: "width: 100%",
pack: "center",
align: "center",
components: [ {
kind: "Button",
name: "cancelReviewButton",
caption: $L("Cancel"),
className: "enyo-button-light wide-button left",
onclick: "onClickCancelReview"
}, {
kind: "Button",
name: "submitAReviewButton",
caption: $L("Send"),
className: "enyo-button-dark wide-button right",
onclick: "onClickSubmitAReview"
} ]
}, {
kind: "Error",
onSubmit: "submitError",
onCancel: "cancelError"
}, {
kind: "Popup",
name: "alertPrompt",
components: [ {
name: "alertTitle",
content: ""
}, {
name: "alertMessage",
content: ""
}, {
kind: "Button",
className: "enyo-button-light",
value: "ok",
caption: $L("Close"),
onclick: "dismissAlertPopup"
} ]
} ],
create: function() {
this.inherited(arguments), this.myReviewDetails = null;
var a = findApps.AccountServices.getInstance().getAccountInfo({
onSuccess: "accountInfoSuccess",
onFailure: "accountInfoFailure",
scope: this
});
a && this.accountInfoSuccess(null, a);
},
refresh: function() {},
renderApp: function() {
this.$.app_icon.setSrc(this.app.icon), this.$.app_name.setContent(this.app.title), this.$.app_vendor.setContent(this.app.vendor);
},
appChanged: function(a) {
this.renderApp(), this.$.myReviewItemComment.setValue(""), this.getMyRatingFromServer();
},
updateDownloadState: function() {
this.renderReviewFromModel(this.myReviewDetails);
},
renderReviewFromModel: function(a) {
a && a.reviewed == 1 ? this.showMyReview(a.myRatingData) : this.showAddReview();
},
showAddReview: function() {
this.$.myReviewItemComment.setValue(""), this.renderRatingStars(0);
},
showMyReview: function(a) {
this.$.myReviewItemComment.setValue(a.comment), this.$.nameSelector.setValue(a.creator), this.renderRatingStars(a.score);
},
onClickSubmitAReview: function() {
var a = this.$.myReviewItemComment.value;
if (!this.score || this.score < 1) this.showAlertPopup($L("App Rating"), $L("Rate the application by tapping the stars.")); else {
a = enyo.string.trim(a);
var b = new Date, c = this.formatDate(b), d = !1, e = "";
this.$.nameSelector.getValue() == "firstinitial" ? e = this.firstInitial : this.$.nameSelector.getValue() == "fullname" && (e = this.fullName), this.myRatingData = {
comment: a,
isAnonymous: d,
creationtime: c,
score: this.score,
creator: d == 1 ? "" : e,
id: this.myReviewDetails.myRatingData && this.myReviewDetails.myRatingData.id ? this.myReviewDetails.myRatingData.id : ""
}, this.$.submitAReviewButton.disabled = !0, this.$.submitAReviewButton.addClass("enyo-button-disabled"), this.addUserRating(this.myRatingData);
}
},
onClickCancelReview: function(a, b) {
this.myReviewDetails = this.oldMyReviewDetails, this.doCancel(b);
},
formatDate: function(a) {
var b = new Date(a);
return b.getMonth() + 1 + "/" + b.getDate() + "/" + b.getFullYear();
},
renderRatingStars: function(a) {
this.score = a, a < 1 ? (this.$.star_1.setSrc("../images/star-large-single-gray.png"), this.$.myReviewItemCommentBoxRow.hide()) : this.$.star_1.setSrc("../images/star-large-single-orange.png"), a < 2 ? this.$.star_2.setSrc("../images/star-large-single-gray.png") : this.$.star_2.setSrc("../images/star-large-single-orange.png"), a < 3 ? this.$.star_3.setSrc("../images/star-large-single-gray.png") : this.$.star_3.setSrc("../images/star-large-single-orange.png"), a < 4 ? this.$.star_4.setSrc("../images/star-large-single-gray.png") : this.$.star_4.setSrc("../images/star-large-single-orange.png"), a < 5 ? this.$.star_5.setSrc("../images/star-large-single-gray.png") : this.$.star_5.setSrc("../images/star-large-single-orange.png");
},
displayError: function(a) {
this.$.error.displayError(a);
},
submitError: function() {
this.$.error.cancel();
},
cancelError: function() {
this.$.error.cancel();
},
getMyRatingFromServer: function() {
findApps.BaseServer.getACServer().getMyRating(null, this.app.publicApplicationId, "getMyRatingService", {
onSuccess: "handleServerResponse",
onFailure: "handleServerError",
scope: this
});
},
addUserRating: function(a) {
a.id && a.id != "" ? findApps.BaseServer.getACServer().updateUserReview(null, this.app.publicApplicationId, this.app.installedVersion, "en_US", a.id, a.comment, a.score, a.creator, "updateUserRatingService", {
onSuccess: "handleServerResponse",
onFailure: "handleServerError",
scope: this
}) : findApps.BaseServer.getACServer().addUserReview(null, this.app.publicApplicationId, this.app.installedVersion, "en_US", a.comment, a.score, a.creator, "addUserRatingService", {
onSuccess: "handleServerResponse",
onFailure: "handleServerError",
scope: this
});
},
setNameOptions: function() {
var a = findApps.BaseServer.getAccountInfo();
a != null ? (this.fullName = a.firstName + " " + a.lastName, this.firstInitial = a.firstName + " " + a.lastName.substring(0, 1)) : (this.fullName = "", this.firstInitial = ""), this.fullName.trim() == this.firstInitial.trim() ? this.$.nameSelector.setItems([ {
caption: this.firstInitial,
value: "firstinitial"
} ]) : this.$.nameSelector.setItems([ {
caption: this.firstInitial,
value: "firstinitial"
}, {
caption: this.fullName,
value: "fullname"
} ]), this.$.nameSelector.render();
},
accountInfoSuccess: function(a, b) {
findApps.BaseServer.getAccountInfo() == null && findApps.BaseServer.setAccountInfo(b), this.setNameOptions();
},
accountInfoFailure: function(a, b) {
this.error("SWM: Review Could not fetch accountinfo. getAccountInfo failure: ", b), this.setNameOptions();
},
handleServerResponse: function(a, b, c, d) {
this.$.submitAReviewButton.disabled = !1, this.$.submitAReviewButton.removeClass("enyo-button-disabled");
switch (d.service) {
case "getMyRatingService":
b.JSONException ? this.myReviewDetails = {
reviewed: !1,
appid: this.app.appid,
packageid: this.app.packageid
} : b.UserRating ? this.myReviewDetails = {
reviewed: !0,
myRatingData: b.UserRating,
appid: this.app.appid,
packageid: this.app.packageid
} : this.myReviewDetails = {
reviewed: !1,
appid: this.app.appid,
packageid: this.app.packageid
}, this.oldMyReviewDetails = this.myReviewDetails, this.renderReviewFromModel(this.myReviewDetails);
break;
case "addUserRatingService":
b.JSONException ? this.showAlertPopup($L("Error"), $L("Your feedback could not be submitted at this time. Please try again later.")) : (this.myReviewDetails.reviewed = !0, this.myReviewDetails.myRatingData = this.myRatingData, this.myReviewDetails.myRatingData.id = b.response.id, this.oldMyReviewDetails = this.myReviewDetails, this.showMyReview(this.myReviewDetails.myRatingData), this.showAlertPopup($L("Confirmation"), $L("Thank you for providing feedback for ") + this.app.title), this.addOrUpdateSuccess = !0);
break;
case "updateUserRatingService":
b.JSONException ? this.showAlertPopup($L("Error"), $L("Your feedback could not be submitted at this time. Please try again later.")) : (this.myReviewDetails.reviewed = !0, this.myReviewDetails.myRatingData = this.myRatingData, this.oldMyReviewDetails = this.myReviewDetails, this.showMyReview(this.myReviewDetails.myRatingData), this.showAlertPopup($L("Confirmation"), $L("Thank you for providing feedback for ") + this.app.title), this.addOrUpdateSuccess = !0);
}
},
handleServerError: function(a, b, c, d) {
switch (d.service) {
case "getMyRatingService":
this.myReviewDetails = {
reviewed: !1,
appid: this.app.appid,
packageid: this.app.packageid
}, this.oldMyReviewDetails = this.myReviewDetails, this.renderReviewFromModel(this.myReviewDetails);
break;
case "addUserRatingService":
case "updateUserRatingService":
this.$.submitAReviewButton.disabled = !1, this.$.submitAReviewButton.removeClass("enyo-button-disabled"), this.showAlertPopup($L("Error"), $L("Could not submit your review at this time. Try again later."));
}
},
showAlertPopup: function(a, b) {
this.$.alertPrompt.openAtCenter(), this.$.alertTitle.setContent(a), this.$.alertMessage.setContent(b);
},
dismissAlertPopup: function() {
this.$.alertPrompt.close(), this.addOrUpdateSuccess && (this.addOrUpdateSuccess = !1, this.doCancel());
},
rate: function(a, b) {
this.rating = parseInt(a.name[5]);
for (i = 1; i < 6; i++) this.rating < i ? this.$["star_" + i].setSrc("../images/star-empty.png") : this.$["star_" + i].setSrc("../images/star-full.png");
this.renderRatingStars(this.rating), this.rating > 0 && this.$.myReviewItemCommentBoxRow.show(), this.$.myReviewItemComment.hasFocus() || this.$.myReviewItemComment.forceFocus();
}
});
;
// app/ReportAProblem.js

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
components: [ {
kind: "Scroller",
name: "scroller",
flex: 1,
components: [ {
kind: "VFlexBox",
className: "box-center",
components: [ {
kind: "HFlexBox",
pack: "center",
align: "center",
style: "padding-top: 1em;",
components: [ {
kind: "Image",
name: "app_icon",
style: "max-width: 64px; max-height: 64px;"
}, {
kind: "VFlexBox",
style: "padding-left: 1em",
components: [ {
name: "app_name",
className: "appTitle"
}, {
name: "app_vendor",
className: "appVendor"
} ]
} ]
}, {
content: $L("Report a problem with this application. Describe how to reproduce the problem."),
className: "enyo-paragraph"
}, {
kind: "RowGroup",
caption: $L("Problem Type"),
width: "25em",
components: [ {
kind: "ListSelector",
name: "nameSelector",
width: "100%",
value: "1",
items: [ {
caption: $L("Bug"),
value: "1"
}, {
caption: $L("Offensive Content"),
value: "2"
}, {
caption: $L("Download"),
value: "5"
}, {
caption: $L("Installation"),
value: "6"
}, {
caption: $L("Payment"),
value: "7"
}, {
caption: $L("Legal Issue"),
value: "3"
}, {
caption: $L("Other"),
value: "4"
} ]
} ]
}, {
kind: "RowGroup",
width: "25em",
components: [ {
kind: "RichText",
richContent: !1,
name: "descriptionInput",
style: "min-height:240px;",
hint: $L("Tap here to begin typing")
} ]
} ]
} ]
}, {
kind: "Toolbar",
className: "enyo-toolbar-light",
style: "width: 100%",
pack: "center",
align: "center",
components: [ {
kind: "Button",
name: "sendReportButton",
caption: $L("Cancel"),
className: "enyo-button-light wide-button left",
onclick: "onClickCancel"
}, {
kind: "Button",
name: "cancelReportButton",
caption: $L("Send"),
className: "enyo-button-dark wide-button right",
onclick: "onClickSubmit"
} ]
}, {
kind: "Error",
onSubmit: "submitError",
onCancel: "cancelError"
}, {
kind: "Popup",
name: "alertPrompt",
components: [ {
name: "alertTitle",
content: ""
}, {
name: "alertMessage",
content: ""
}, {
kind: "Button",
className: "enyo-button-light",
value: "ok",
caption: $L("Close"),
onclick: "dismissAlertPopup"
} ]
} ],
create: function() {
this.inherited(arguments);
var a = findApps.AccountServices.getInstance().getAccountInfo({
onSuccess: "accountInfoSuccess",
onFailure: "accountInfoFailure",
scope: this
});
a && this.accountInfoSuccess(null, a);
},
refresh: function() {
this.$.descriptionInput.hasFocus() || this.$.descriptionInput.forceFocus();
},
renderApp: function() {
this.$.app_icon.setSrc(this.app.icon), this.$.app_name.setContent(this.app.title), this.$.app_vendor.setContent(this.app.vendor), this.$.nameSelector.setValue(1), this.$.descriptionInput.setValue(""), this.$.descriptionInput.hasFocus() || this.$.descriptionInput.forceFocus();
},
appChanged: function(a) {
this.renderApp();
},
onClickSubmit: function() {
this.problemDesc = this.$.descriptionInput.getValue(), this.problemType = this.$.nameSelector.getValue(), this.$.sendReportButton.disabled = !0, this.$.sendReportButton.addClass("enyo-button-disabled"), findApps.BaseServer.getACServer().reportProblem(null, this.app.publicApplicationId, this.problemDesc, 0, "en_US", this.name, !1, !0, this.problemType, "ReportProblemService", {
onSuccess: "handleServerResponse",
onFailure: "handleServerError",
scope: this
});
},
onClickCancel: function(a, b) {
this.doCancel(b);
},
formatDate: function(a) {
var b = new Date(a);
return b.getMonth() + 1 + "/" + b.getDate() + "/" + b.getFullYear();
},
displayError: function(a) {
this.$.error.displayError(a);
},
submitError: function() {
this.$.error.cancel();
},
cancelError: function() {
this.$.error.cancel();
},
accountInfoSuccess: function(a, b) {
findApps.BaseServer.getAccountInfo() == null && findApps.BaseServer.setAccountInfo(b);
},
accountInfoFailure: function(a, b) {
this.error("SWM: ReportAProblem Could not fetch accountinfo. getAccountInfo failure: ", b);
},
handleServerResponse: function(a, b, c, d) {
this.$.sendReportButton.disabled = !1, this.$.sendReportButton.removeClass("enyo-button-disabled"), c.JSONException ? this.showAlertPopup($L("Error"), $L("Could not submit your report at this time. Try again later.")) : this.doCancel();
},
handleServerError: function(a, b, c, d) {
this.$.sendReportButton.disabled = !1, this.$.sendReportButton.removeClass("enyo-button-disabled"), this.showAlertPopup($L("Error"), $L("Could not submit  at this time. Try again later."));
},
showAlertPopup: function(a, b) {
this.$.alertPrompt.openAtCenter(), this.$.alertTitle.setContent(a), this.$.alertMessage.setContent(b);
},
dismissAlertPopup: function() {
this.$.alertPrompt.close();
}
});
;
// app/AppDetails.js

enyo.kind({
kind: "VFlexBox",
align: "center",
name: "swmanager.AppDetails",
className: "appDetails",
published: {
appDetails: null
},
events: {
onClose: ""
},
components: [ {
kind: "HFlexBox",
align: "center",
pack: "center",
style: "padding-top: 1em;",
components: [ {
kind: "Image",
name: "app_icon",
style: "max-width: 64px; max-height: 64px;"
}, {
kind: "VFlexBox",
style: "padding-left: 1em;",
components: [ {
name: "app_name",
className: "appTitle"
}, {
name: "vendor",
className: "appVendor"
} ]
} ]
}, {
kind: "RowGroup",
caption: $L("Details"),
style: "width: 25em",
components: [ {
layoutKind: "HFlexLayout",
components: [ {
content: $L("Version"),
flex: 1,
className: "enyo-label"
}, {
name: "version",
className: "rowgroup-details-content"
} ]
}, {
layoutKind: "HFlexLayout",
components: [ {
content: $L("Size"),
flex: 1,
className: "enyo-label"
}, {
name: "size",
className: "rowgroup-details-content"
} ]
} ]
}, {
kind: "Button",
name: "reviewButton",
style: "margin-top:.25em,margin-bottom:.6em",
caption: $L("Review App"),
className: "enyo-button-light max-width-button",
onclick: "reviewClick"
}, {
kind: "Button",
caption: $L("Report a Problem"),
style: "margin-bottom:.6em",
className: "enyo-button-light max-width-button",
onclick: "reportAProblemClick"
}, {
kind: "Button",
name: "deleteButton",
caption: $L("Delete"),
name: "deleteButton",
className: "enyo-button-negative max-width-button",
onclick: "openDeletePopup"
}, {
kind: "Spacer"
}, {
kind: "ModalDialog",
name: "deletePopup",
components: [ {
name: "deleteTitle",
className: "enyo-text-header enyo-text-ellipsis ",
style: "padding: 0 10px; text-align: center;",
content: $L("Delete Application")
}, {
name: "deleteContent",
className: "enyo-paragraph",
style: "padding: 0 10px 6px 10px;",
allowHtml: !0,
content: $L("Are you sure you want to delete this application from your device?")
}, {
name: "confirmDelete",
kind: "Button",
caption: $L("Delete"),
onclick: "handleDeleteApp",
className: "enyo-button-negative"
}, {
name: "cancelDelete",
kind: "Button",
caption: $L("Cancel"),
onclick: "closeDeletePopup"
} ]
}, {
kind: "Toolbar",
className: "enyo-toolbar-light",
width: "100%",
components: [ {
kind: "Button",
className: "",
className: "single-wide-button",
caption: $L("Close"),
onclick: "close"
} ]
} ],
appDetailsChanged: function() {
this.renderAppDetails(), this.checkRevertable();
},
refresh: function() {},
renderAppDetails: function() {
this.$.app_icon.setSrc(this.appDetails.icon), this.$.app_name.setContent(this.appDetails.title), this.$.vendor.setContent(this.appDetails.vendor), this.$.version.setContent(this.appDetails.installedVersion);
var a = this.appDetails.installSize / 1048576 + 1, b = new enyo.g11n.NumberFmt({
fractionDigits: 2
});
a = b.format(a) + " " + $L("MB"), this.$.size.setContent(a);
},
checkRevertable: function() {
this._revertable = enyo.application.appdownloadManager.isRevertable(this.appDetails.publicApplicationId), this._revertable ? (this.$.reviewButton.setShowing(!1), this.$.deleteButton.setShowing(!1)) : (this.$.reviewButton.setShowing(!0), this.$.deleteButton.setShowing(!0));
},
reviewClick: function(a, b) {
viewLibrary.getView("REVIEW").setApp(this.appDetails), viewLibrary.setView("REVIEW");
},
reportAProblemClick: function(a, b) {
viewLibrary.getView("REPORTPROBLEM").setApp(this.appDetails), viewLibrary.setView("REPORTPROBLEM");
},
openDeletePopup: function() {
var a = this.appDetails.getAppDeleteDialogInfo();
this.$.deletePopup.openAtCenter(), a.deleteTitle !== undefined ? this.$.deleteTitle.setContent(a.deleteTitle) : this.$.deleteTitle.setContent($L("Delete ") + this.appDetails.title), a.deleteMessage !== undefined && this.$.deleteContent.setContent(a.deleteMessage);
},
closeDeletePopup: function() {
this.$.deletePopup.close();
},
close: function(a, b) {
this.doClose(b);
},
handleDeleteApp: function() {
this.appDetails.uninstall(), this.closeDeletePopup(), this.doClose();
}
});
;
// app/Updates.js

enyo.kind({
name: "swmanager.Updates",
kind: "VFlexBox",
events: {
onCancel: ""
},
components: [ {
kind: "HFlexBox",
pack: "center",
name: "title",
style: "padding:1.1em 0 0 0;",
content: $L("The following app updates are available.")
}, {
kind: "Pane",
flex: 1,
pack: "center",
align: "center",
components: [ {
name: "update_apps",
kind: "swmanager.UpdateApps",
onRetry: "retry"
} ]
}, {
kind: "Toolbar",
className: "enyo-toolbar-light",
style: "width: 100%",
pack: "center",
align: "center",
components: [ {
kind: "Button",
style: "width: 7.4em",
name: "myappsButton",
caption: $L("Back"),
className: "enyo-button-light",
onclick: "cancel"
}, {
kind: "Button",
style: "width: 7.4em",
name: "updateButton",
showing: !1,
caption: $L("Install All"),
className: "enyo-button-dark",
onclick: "updateClick"
}, {
kind: "Button",
style: "width: 7.4em",
name: "pauseButton",
showing: !1,
caption: $L("Pause All"),
className: "enyo-button-light",
onclick: "pauseClick"
} ]
}, {
kind: "Scrim",
name: "scrim",
layoutKind: "VFlexLayout",
align: "center",
pack: "center",
components: [ {
kind: "SpinnerLarge",
name: "spinner",
showing: !1
} ]
} ],
create: function() {
this._updates = [], viewLibrary.getAppLists().attach(this), this.inherited(arguments);
},
cancel: function(a, b) {
this.doCancel(b);
},
hideScrim: function() {
this.$.scrim && (this.$.scrim.hide(), this.$.spinner.setShowing(!1));
},
showScrim: function() {
this.$.scrim && (this.$.scrim.show(), this.$.spinner.setShowing(!0));
},
retry: function() {
this.$.update_apps.$.noApps.hide(), this.$.update_apps.$.retryButton.hide(), this.showScrim();
},
_initUpdates: function() {
this._updates = [];
if (!viewLibrary.getAppLists().updateListReady() && !viewLibrary.getAppLists().updateListError()) {
this.showScrim();
return;
}
this._updates = viewLibrary.getAppLists().getUpdatesList().items, this.$.update_apps.setApps(this._updates), this.hideScrim(), this._updateNoAppsDiv(), this._updateButton();
},
_updateNoAppsDiv: function() {
this._updates.length > 0 ? (this.$.update_apps.$.msg.setContent($L("")), this.$.title.show(), this.$.update_apps.$.noApps.hide()) : this._updates.length == 0 && viewLibrary.getAppLists().updateListReady() && (this.$.title.hide(), this.$.update_apps.$.msgicon.hide(), this.$.update_apps.$.msg.setContent($L("You have no updates available.")), this.$.update_apps.$.noApps.show());
},
refresh: function() {
this._initUpdates(), this.$.update_apps.listResize();
},
_updateButton: function() {
this.$.updateButton.hide(), this.$.pauseButton.hide();
var a = !1, b = !1;
for (var c = 0; c < this._updates.length; c++) if (this._updates[c].canInstallUpdate()) {
this.$.updateButton.show();
break;
}
for (var c = 0; c < this._updates.length; c++) if (this._updates[c]._state !== undefined && this._updates[c]._state + "" === "downloadprogress") {
this.$.pauseButton.show();
break;
}
},
pauseClick: function() {
this.$.pauseButton.hide();
for (var a = 0; a < this._updates.length; a++) this._updates[a].pauseDownload();
},
updateClick: function() {
this.$.updateButton.hide(), this.$.pauseButton.show();
var a = this, b = [], c = 0, d = 0;
for (var e = 0; e < this._updates.length; e++) this._updates[e].canInstallUpdate() && (b.push(this._updates[e]), c += this._updates[e].packageSize, d += this._updates[e].installSize);
if (b.length == 0) return;
var f = {
publicApplicationId: "dummy",
packageSize: c,
installSize: d
}, g = b.length == 1 ? "validate_space_default_single" : "validate_space_default_mult", h = enyo.application.appdownloadManager;
h.$.appStates_appstatescommon.validateInstallSpace(f, g, function(a) {
a && h.$.appStates_appstatescommon.validateDownloadConnection(function(a) {
if (a) for (var c = 0; c < b.length; c++) b[c].installUpdate();
});
});
},
updateLists: function(a, b, c, d) {
if (!viewLibrary.getAppLists().updateListReady() && !viewLibrary.getAppLists().updateListError) return;
a == "updates" && (b == viewLibrary.getAppLists().DELETED || b == viewLibrary.getAppLists().ADDED ? (this.$.update_apps.setApps(this._updates), this._updateNoAppsDiv(), this._updateButton()) : b == viewLibrary.getAppLists().UPDATED ? (this.$.update_apps.updateApp(d), this._updateNoAppsDiv(), this._updateButton()) : b == viewLibrary.getAppLists().UPDATELIST_ALL ? this._initUpdates() : b == viewLibrary.getAppLists().ERROR && (this.hideScrim(), this.showError()));
},
showError: function() {
this.$.title.hide(), this.$.update_apps.$.msgicon.show(), this.$.update_apps.$.msgicon.setSrc("../images/misc-connection-error-triangle.png"), this.$.update_apps.$.msg.setContent($L("This action cannot be completed. Try later.")), this.$.update_apps.$.noApps.show(), this.$.update_apps.$.retryButton.show();
}
});
;
// app/AppUpdateDetails.js

enyo.kind({
kind: "Scroller",
name: "swmanager.AppUpdateDetails",
className: "appUpdateDetails",
published: {
appUpdateDetails: null
},
components: [ {
name: "header",
kind: "PageHeader",
components: [ {
name: "app_icon",
kind: "Image",
className: "appIcon"
}, {
kind: "VFlexBox",
components: [ {
name: "app_title",
className: "appUpdateTitle"
}, {
name: "app_home_url",
className: "appHomeUrl"
} ]
} ]
}, {
kind: "HFlexBox",
pack: "center",
align: "center",
components: [ {
name: "app_screenshot",
flex: 1,
width: "400px",
kind: "Image"
}, {
kind: "VFlexBox",
flex: 1,
components: [ {
name: "app_media",
kind: "Image"
}, {
name: "app_ratings",
kind: "Image"
}, {
kind: "Button",
caption: $L("Reviews")
}, {
kind: "Button",
caption: $L("Share")
} ]
} ]
}, {
name: "app_description"
}, {
kind: "Button",
caption: $L("Download For Free")
} ],
appUpdateDetailsChanged: function() {
this.renderAppUpdateDetails();
},
listResize: function() {},
setUserRatings: function(a) {
var b = "../images/stars-big-" + a + ".png";
this.$.app_ratings.setSrc(b);
},
renderAppUpdateDetails: function() {
this.setUserRatings(this.appUpdateDetails.userRating.score), this.$.app_icon.setSrc(this.appUpdateDetails.appDetail.appIcon), this.$.app_screenshot.setSrc(this.appUpdateDetails.appDetail.appImage), this.$.app_title.setContent(this.appUpdateDetails.appDetail.title), this.$.app_home_url.setContent(this.appUpdateDetails.appDetail.homeURL), this.appUpdateDetails.appDetail.mediaIcon && this.$.app_media.setSrc(this.appUpdateDetails.appDetail.mediaIcon), this.$.app_description.setContent(this.appUpdateDetails.appDetail.description);
}
});
;
// utilities/CacheUtil.js

enyo.kind({
name: "findapps.CacheUtil",
kind: enyo.Object,
published: {
enabled: !1
}
}), enyo.kind({
name: "findapps.TransientCache",
kind: findapps.CacheUtil,
cache: [],
clear: function(a) {
if (!this.enabled) return;
a ? this.cache[a] = undefined : this.cache = [];
},
isExpired: function(a) {
if (!this.enabled) return;
var b = this.cache[a];
if (b) {
if ((new Date).getTime() < b.expires.getTime()) return !1;
this.clear(a);
}
return !0;
},
set: function(a, b, c) {
if (!this.enabled) return;
if (this.isExpired(a)) b && b.getTime && (this.cache[a] = {
expires: b,
value: c
}); else {
var d = this.cache[a];
d.expires = b ? b : d.expires, d.value = c ? c : d.value;
}
},
get: function(a) {
if (!this.enabled) return;
if (!this.isExpired(a)) return this.cache[a].value;
}
}), enyo.kind({
name: "findapps.PersistentCache",
kind: findapps.CacheUtil,
constructor: function(a) {
this.inherited(arguments), this.storageUtil = findapps.StorageUtil.getInstance(a);
},
clear: function(a) {
if (!this.enabled) return;
a ? this.storageUtil.remove(a) : this.storageUtil.clear();
},
isExpired: function(a) {
if (!this.enabled) return;
var b = this.storageUtil.get(a);
if (b && b.expires) {
b.expires = new Date(b.expires);
if ((new Date).getTime() < b.expires.getTime()) return !1;
this.clear(a);
}
return !0;
},
set: function(a, b, c) {
if (!this.enabled) return;
if (this.isExpired(a)) b && b.getTime && this.storageUtil.set(a, {
expires: b,
value: c
}); else {
var d = this.storageUtil.get(a);
d.expires = new Date(d.expires), d.expires = b ? b : d.expires, d.value = c ? c : d.value, this.storageUtil.set(a, d);
}
},
get: function(a) {
if (!this.enabled) return;
if (!this.isExpired(a)) return this.storageUtil.get(a).value;
}
}), findapps.CacheUtil.getInstance = function(a, b) {
return a = a || "_singleton", findapps.CacheUtil._pool = findapps.CacheUtil._pool || [], findapps.CacheUtil._pool[a] = findapps.CacheUtil._pool[a] || (b ? new findapps.PersistentCache(a) : new findapps.TransientCache), findapps.CacheUtil._pool[a];
};
;
// utilities/StorageUtil.js

enyo.kind({
name: "findapps.StorageUtil",
kind: enyo.Object,
keyPrefix: "findapps.StorageUtil.",
constructor: function(a) {
this.inherited(arguments), this.keyPrefix = a;
},
set: function(a, b) {
typeof b == "object" && (b = JSON.stringify(b)), localStorage.setItem(this.keyPrefix + a, b);
},
get: function(a) {
var b = localStorage.getItem(this.keyPrefix + a);
return b && b.charAt(0) === "{" ? JSON.parse(b) : b;
},
remove: function(a) {
localStorage.removeItem(this.keyPrefix + a);
},
clear: function() {
for (var a in localStorage) findapps.StorageUtil.startsWith(a, this.keyPrefix) && localStorage.removeItem(a);
}
}), findapps.StorageUtil.startsWith = function(a, b) {
return enyo.isString(a) && enyo.isString(b) && a.substr(0, b.length) === b ? !0 : !1;
}, findapps.StorageUtil.getInstance = function(a) {
return a = a || "_singleton", findapps.StorageUtil._pool = findapps.StorageUtil._pool || [], findapps.StorageUtil._pool[a] = findapps.StorageUtil._pool[a] || new findapps.StorageUtil(a), findapps.StorageUtil._pool[a];
};
;
// utilities/common.js

enyo.kind({
name: "commonHandler",
kind: enyo.Component,
handleCommand: function(a, b) {
var c = this._generateAppURL(b);
if (c) switch (a) {
case "email":
var d = {
summary: $L("Check out this webOS app"),
text: this._generateEmailMessageText(b, c)
};
findApps.ApplicationManager.getInstance().launchApplication("com.palm.app.email", d, "emailLaunchSuccess", "emailLaunchFailure");
break;
case "text":
var d = {
messageText: this._generateSMSMessageText(b, c)
};
findApps.ApplicationManager.getInstance().launchApplication("com.palm.app.enyo-messaging", d, "smsLaunchSuccess", "smsLaunchFailure");
}
},
smsLaunchSuccess: function() {},
smsLaunchFailure: function() {},
emailLaunchSuccess: function() {},
emailLaunchFailure: function() {},
_generateAppURL: function(a) {
return a && a.publicApplicationId && a.id ? "http://developer.palm.com/appredirect/?packageid=" + a.publicApplicationId + "&applicationid=" + a.id : null;
},
_generateEmailMessageText: function(a, b) {
var c = {
appURL: b
};
return a && a.title ? c.title = a.title : c.title = b, enyo.macroize($L("Here's an app I think you'll like:  <a href=\"{$appURL}\"> {$title}"), {
appURL: b,
title: a.title
});
},
_generateSMSMessageText: function(a, b) {
var c = b;
return a && a.title && (c = a.title), enyo.macroize($L("Check out {$title}: {$url}"), {
title: c,
url: b
});
},
_handleEmbargoAcc: function(a, b) {
var c = this;
!a && myProfile.isEmbargoed ? (c.OnSubmit = function() {
c.$.error.cancel(), c.$.error.destroy(), findApps.ApplicationManager.getInstance().openApplication("com.palm.app.help", {
target: online ? "http://help.palm.com/app_catalog/appcatalog_download_error.html" : "no-network"
});
}, c.OnCancel = function() {
c.$.error.cancel(), c.$.error.destroy();
}, c.createComponent({
name: "error",
kind: "Error",
onSubmit: "OnSubmit",
owner: c
}), c.$.error.displayError("PMT_cant_download", {}, "PMT_cant_download", null, null)) : b(a);
},
capWords: function(a) {
var b = a.split(" ");
for (var c = 0; c < b.length; c++) b[c] = b[c].capitalize();
return b.join(" ");
},
filterSpace: function(a) {
return a === Mojo.Char.spaceBar ? !1 : !0;
},
isEmpty: function(a) {
for (prop in a) return !1;
return !0;
},
formatDateStr: function(a) {
if (!a || a.length < 8) return "";
var b = a.substr(0, 4), c = a.substr(4, 2), d = a.substr(6, 2), e = a.substr(8, 2), f = a.substr(10, 2), g = a.substr(12, 2), h = new Date(b, c - 1, d, e, f, g), i = h.getTime(), j = new Date;
localOffset = j.getTimezoneOffset() * 6e4;
var k = new Date(i - localOffset);
return enyo.date.format(k, "MMM d, yyyy");
}
});

var Utilities = Utilities || {};

Utilities.CommonHandler = Utilities.CommonHandler || new commonHandler, Utilities.Formatter = {
formatCurrency: function(a, b) {
if (typeof Utilities.Formatter._currencyFmt == "undefined" || b !== Utilities.Formatter.purchasingLocale) Utilities.Formatter._currencyFmt = new enyo.g11n.NumberFmt({
locale: b,
fractionDigits: 2,
style: "currency"
}), Utilities.Formatter.purchasingLocale = b;
return Utilities.Formatter._currencyFmt.format(a, {
style: "currency"
});
},
formatLongDate: function(a) {
return typeof Utilities.Formatter._longDateFmt == "undefined" && (Utilities.Formatter._longDateFmt = new enyo.g11n.DateFmt({
date: "long"
})), Utilities.Formatter._longDateFmt.format(a);
},
formatShortDate: function(a) {
return typeof Utilities.Formatter._shortDateFmt == "undefined" && (Utilities.Formatter._shortDateFmt = new enyo.g11n.DateFmt({
date: "short"
})), Utilities.Formatter._shortDateFmt.format(a);
},
formatRound: function(a) {
return typeof Utilities.Formatter._roundFmt == "undefined" && (Utilities.Formatter._roundFmt = new enyo.g11n.NumberFmt({
fractionDigits: 1
})), Utilities.Formatter._roundFmt.format(a);
},
formatRound2: function(a) {
return typeof Utilities.Formatter._roundFmt == "undefined" && (Utilities.Formatter._roundFmt = new enyo.g11n.NumberFmt({
fractionDigits: 2
})), Utilities.Formatter._roundFmt.format(a);
},
formatPercent: function(a) {
typeof Utilities.Formatter._percentFmt == "undefined" && (Utilities.Formatter._percentFmt = new enyo.g11n.NumberFmt({
style: "percent"
}));
if (!a || a == undefined) a = 0;
return Utilities.Formatter._percentFmt.format(a, {
style: "percent"
});
},
serverTimeFormat: function(a) {
return typeof Utilities.Formatter._serverFmt == "undefined" && (Utilities.Formatter._percentFmt = new enyo.g11n.DateFmt("yyyyMMddHHmmss")), Utilities.Formatter._percentFmt.format(a);
},
getFullYear: function(a) {
return typeof Utilities.Formatter._dateFullYear == "undefined" && (Utilities.Formatter._dateFullYear = new enyo.g11n.DateFmt("yyyy")), Utilities.Formatter._dateFullYear.format(a);
},
getLongMonth: function(a) {
return typeof Utilities.Formatter._dateMonth == "undefined" && (Utilities.Formatter._dateMonth = new enyo.g11n.DateFmt("MMM")), Utilities.Formatter._dateMonth.format(a);
},
formatPhoneNumber: function(a) {
return typeof Utilities.Formatter._phoneFmt == "undefined" && (Utilities.Formatter._phoneFmt = new enyo.g11n.PhoneFmt), Utilities.Formatter._phoneFmt.format(a);
},
getShortMonth: function(a, b) {
return typeof Utilities.Formatter._dateShortMonth == "undefined" && (Utilities.Formatter._dateShortMonth = new enyo.g11n.DateFmt("MM")), Utilities.Formatter._dateShortMonth.format(a);
}
}, CommonUtil = {
oneSecond: 1e3,
oneMinute: 6e4,
oneHour: 36e5,
oneDay: 864e5,
formatStar: function(a, b) {
return a -= 2 * b, a > 0 ? a > 1 ? "full" : "half" : "empty";
},
contains: function(a, b) {
for (var c = 0; c < a.length; c++) if (a[c] == b) return !0;
return !1;
},
array2Map: function(a, b) {
var c = [];
if (a && a.length) for (var d = 0; d < a.length; d++) {
var e = a[d];
c[e[b]] = e;
}
return c;
},
findFirstMatch: function(a, b) {
var c, d = b.length;
for (var e = 0; e < d && !c; e++) c = a[b[e]];
return c;
},
getUUID: function() {
return (new Date).getTime() + Math.floor(Math.random() * 16777216);
},
getUUID2: function() {
var a = [], b = "0123456789ABCDEF";
for (var c = 0; c < 32; c++) a[c] = b.substr(Math.floor(Math.random() * 16), 1);
a[12] = "4", a[16] = b.substr(a[16] & 3 | 8, 1);
var d = a.join("");
return d;
},
getUUID3: function() {
return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(a) {
var b = Math.random() * 16 | 0, c = a == "x" ? b : b & 3 | 8;
return c.toString(16);
});
},
getHashCode: function(a) {
var b = 0;
if (a.length == 0) return b;
for (var c = 0; c < a.length; c++) {
var d = a.charCodeAt(c);
b = (b << 5) - b + d, b &= b;
}
return b;
},
getRandNumber: function() {
return this.getUUID();
},
delFunc: function(a, b, c) {
typeof a[b + c] == "function" && delete a[b + c];
}
};
;
// utilities/errorDialog.js

enyo.kind({
name: "enyo.FindApps.ErrorDialog",
kind: enyo.Control,
published: {
params: "",
returnValue: ""
},
events: {
onSubmit: "",
onCancel: ""
},
components: [ {
name: "errorTitle",
content: $L("Error"),
style: "font-size: 26px; padding: 6px;"
}, {
name: "errorBody",
style: "padding: 6px;",
content: ""
}, {
layoutKind: "VFlexLayout",
style: "padding-top: 6px;",
components: [ {
name: "button1",
kind: "Button",
caption: $L("Submit"),
onclick: "submit"
}, {
name: "button2",
kind: "Button",
caption: $L("Cancel"),
onclick: "cancel"
} ]
} ],
create: function() {
this.inherited(arguments);
},
paramsChanged: function() {
this.$.errorTitle.setContent(this.params.title), this.$.errorBody.setContent(this.params.message), this.$.button1.setCaption(this.params.choices[0].label), this.params.choices[1] ? this.$.button2.setCaption(this.params.choices[1].label) : this.$.button2.setStyle("display:none");
},
getReturnValue: function() {
return this.returnValue;
},
submit: function() {
this.returnValue = this.params.choices[0].value, this.doSubmit();
},
cancel: function() {
this.returnValue = this.params.choices[1].value, this.doSubmit();
}
});
;
// utilities/errormessages.js

var Utilities = Utilities || {};

Utilities.ErrorChoices = {
tryCCChoices: [ {
label: $L("Use Credit Card"),
value: "cc",
type: "default"
}, {
label: $L("Cancel"),
value: !0,
type: "dismiss"
} ],
tryOBChoices: [ {
label: $L("Use Carrier Account"),
value: "ob",
type: "default"
}, {
label: $L("Cancel"),
value: !0,
type: "dismiss"
} ],
simpleOKChoices: [ {
label: $L("OK"),
value: !0,
type: "dismiss"
} ],
simpleRetryChoices: [ {
label: $L("Retry")
} ]
}, enyo.kind({
name: "CommonErrors",
kind: enyo.Component,
components: [],
_PMTGroupErrors: {
PMT_0: {
dialog: !0,
title: $L("Payment Type"),
message: $L("You can only pay with a credit card. Update your account information in Preferences & Accounts and try again. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_1: {
dialog: !0,
title: $L("Payment Failed"),
message: $L("We cannot process your payment. Contact your financial institution. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_2: {
dialog: !0,
title: $L("Payment Failed"),
message: $L("Update the payment information in your account and try again. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_3: {
dialog: !0,
title: $L("Payment Failed"),
message: $L("CyberSource refused your payment. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_4: {
dialog: !0,
title: $L("Payment Failed"),
message: $L("You are not permitted to purchase items in the App Catalog. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_5: {
dialog: !0,
title: $L("Transaction Error"),
message: $L("The credit card you are using may be fraudulent. Enter a different credit card in Preferences & Accounts and try again. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_6: {
dialog: !0,
title: $L("Can't Purchase"),
message: $L("The United States Government prohibits HP from allowing you to purchase applications."),
choices: [ {
label: $L("OK"),
value: "quit",
type: "primary"
}, {
label: $L("Help"),
value: "help",
type: "secondary"
} ]
},
PMT_7: {
dialog: !0,
title: $L("Invalid Address"),
message: $L("The address you entered cannot be found. Verify that the address you entered is correct, and is in the Billing Country you have chosen."),
choices: [ {
label: $L("OK"),
value: "ok",
type: "dismiss"
} ]
}
},
OBCarrierNotSupported: {
dialog: !0,
title: $L("Operator Billing is not supported for this carrier"),
message: $L("{$carrierName} does not support payments. Please pay with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
catchAllDialog: {
dialog: !0,
title: $L("Unexpected problem"),
message: $L("App Catalog could not complete the last action you performed. Please try again later."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
catchAllFullPage: {
page: !0,
title: $L("Unexpected problem"),
message: $L("The action could not be completed.<br/>Try again later."),
choices: Utilities.ErrorChoices.simpleRetryChoices
}
}), Utilities.CommonErrors = new CommonErrors, Utilities._dialogErrors = {
offline: {
page: !0,
message: $L("You must connect to a network to use this application.")
},
invalidtoken: {
page: !0,
message: $L("We could not find a valid webOS Account.<br/>You need a valid account to use App Catalog.")
},
failure: {
page: !0
},
badformat: {
page: !0
},
timeout: {
page: !0
},
jsonexception: {
page: !0
},
downformaintenance: {
page: !0
},
appunavailable: {
page: !0,
message: $L("No applications found.")
},
dplfailed: {
page: !0,
message: $L("You can't set up an account. The United States Government prohibits HP from allowing you to purchase applications.")
},
noPaymentTypeSupported: {
page: !0,
message: $L("There are no payment types available for this profile")
},
PMT01002: {
page: !0
},
APPCAT0065: {
page: !0,
message: $L("Your first wifi-only device has not yet setup Application Catalog country, please do so before proceeding.")
},
DISC0025: {
incompatible_page: !0,
message: $L("This is not a valid webOS application.")
},
DISC0056: {
incompatible_page: !0,
message: $L("This is not a valid webOS application.")
},
DISC0124: {
incompatible_page: !0,
message: $L("This application is not available for your model.")
},
DISC0125: {
incompatible_page: !0,
message: $L("This application is not available for your carrier.")
},
DISC0201: {
incompatible_page: !0,
message: $L("This application is not available in your country.")
},
DISC0202: {
incompatible_page: !0,
message: $L("This application is not available for your model.")
},
DISC0203: {
incompatible_page: !0,
message: $L("This application cannot run on your current operating system. Use the Updates app to install the system update and try again.")
},
catchAllDialog: Utilities.CommonErrors.catchAllDialog,
noNetwork: {
page: !0,
title: $L("No Internet Connection"),
message: $L("You must connect to a network to use this application."),
choices: Utilities.ErrorChoices.simpleRetryChoices
},
RESP0001: {
dialog: !0,
title: $L("Server Exception"),
message: $L("XHR Status Code is not 200"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
RESP0002: {
dialog: !0,
title: $L("Server Exception"),
message: $L("Exception thrown by the server"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
RESP0003: {
dialog: !0,
title: $L("Server Exception"),
message: $L("Empty Response. Connection timed out"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
RESP0004: {
dialog: !0,
title: $L("Server Exception"),
message: $L("Empty Response. Connection did not time out"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
RESP0005: {
dialog: !0,
title: $L("Server Exception"),
message: $L("Response Status code was not OK"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
RESP0006: {
dialog: !0,
title: $L("Server Exception"),
message: $L("General server exception thrown"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
RESP0007: {
dialog: !0,
title: $L("Server Exception"),
message: $L("Response xhr status code was non-200"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
RESP0008: {
dialog: !0,
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
PMT_catchAll: {
dialog: !0,
title: $L("Unexpected problem"),
message: $L("App Catalog could not complete the last action you performed. Try again later. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_addCC_default: {
dialog: !0,
title: $L("Couldn't Add Credit Card"),
message: $L("A problem occurred when adding your credit card information. Try again later. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_modifyCC_default: {
dialog: !0,
title: $L("Couldn't Update"),
message: $L("The credit card information could not be updated. Try again later. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_removeCC_default: {
dialog: !0,
title: $L("Couldn't Remove"),
message: $L("The credit card was not removed from your account. Try again later. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_purchase_default: {
dialog: !0,
title: $L("Couldn't Purchase"),
message: $L("The item could not be purchased. Try again later. {$errCode}"),
choices: Utilities.ErrorChoices.tryCCChoices
},
PMT_cant_download: Utilities.CommonErrors._PMTGroupErrors.PMT_6,
PMT_cant_download_encrypted: {
dialog: !0,
title: $L("Can't Download"),
message: $L("The United States Government prohibits HP from allowing you to download this application."),
choices: [ {
label: $L("Help"),
value: "help",
type: "primary"
}, {
label: $L("OK"),
value: !0,
type: "dismiss"
} ]
},
PMT_cant_purchase: Utilities.CommonErrors._PMTGroupErrors.PMT_6,
PMT02000: {
dialog: !0,
title: $L("Error"),
message: $L("You cannot purchase items via your Carrier Account. Please use a credit card instead."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02002: {
dialog: !0,
title: $L("Data Entry"),
message: $L("This card type is not supported"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02003: {
dialog: !0,
title: $L("Data Entry"),
message: $L("This order type is not supported"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02005: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The State code is incorrect. Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02006: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The Country code is incorrect. Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02008: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The Currency code is incorrect. Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02010: {
dialog: !0,
title: $L("Data Entry"),
message: $L("You must enter valid information in every field."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02011: {
dialog: !0,
title: $L("Data Entry"),
message: $L("You must enter a number in the Credit Card field."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02012: {
dialog: !0,
title: $L("Data Entry"),
message: $L("You must enter a number in the Payment Info ID field."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02013: {
dialog: !0,
title: $L("Data Entry"),
message: $L("You must enter a number in the Quantity field."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02014: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The date in the Expiration Date field must be in the format mmyyyy"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02015: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The value in the Item Unit Price field is not valid. Enter a number instead."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02016: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The date in the Order Date field must be in the format yyyyMMddHHmmss"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02017: {
dialog: !0,
title: $L("Data Entry"),
message: $L("Update the Expiration Date information in your account and try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02018: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The Zip code is incorrect. Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT03000: {
dialog: !0,
title: $L("Transaction Error"),
message: $L("Update your credit card information in Preferences & Accounts and try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT03001: Utilities.CommonErrors._PMTGroupErrors.PMT_0,
PMT03002: {
dialog: !0,
title: $L("Payment Failed"),
message: $L("We cannot perform financial transactions in your country."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT03003: Utilities.CommonErrors._PMTGroupErrors.PMT_0,
PMT03006: {
dialog: !0,
title: $L("Payment Failed"),
message: $L("The last transaction failed. Update the payment information in your account and try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT03007: {
dialog: !0,
title: $L("Couldn't Update"),
message: $L("Credit card information can only be updated after all pending purchases have cleared. Try again after you received receipts for all recent purchases."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04000: {
dialog: !0,
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
dialog: !0,
title: $L("Payment Failed"),
message: $L("Update the security number and try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04008: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
PMT04009: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
PMT04010: {
dialog: !0,
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
dialog: !0,
title: $L("Payment Failed"),
message: $L("There is no payment information associated with your webOS Account. Tap Preferences in the App Menu to set it up."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04018: Utilities.CommonErrors._PMTGroupErrors.PMT_5,
PMT04019: Utilities.CommonErrors._PMTGroupErrors.PMT_5,
PMT04020: Utilities.CommonErrors._PMTGroupErrors.PMT_5,
PMT04021: {
dialog: !0,
title: $L("Transaction Error"),
message: $L("A transaction problem has occurred. Update your credit card information in Preferences & Accounts and try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04200: {
dialog: !0,
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
dialog: !0,
title: $L("Transaction Error"),
message: $L("There is a problem with the credit card. Enter a different credit card in Preferences & Accounts and try again. PMT04415"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04416: {
dialog: !0,
title: $L("Transaction Error"),
message: $L("There may be a problem with the credit card. Enter a different credit card in Preferences & Accounts and try again. PMT04416"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04417: {
dialog: !0,
title: $L("Transaction Error"),
message: $L("There is a problem with the credit card. Enter a different credit card in Preferences & Accounts and try again. PMT04417"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
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
PMTPROMO70010: {
dialog: !0,
title: $L("Promo Code"),
message: $L("Invalid, unavailable or expired promo code, try to use previous saved code or manually input valid code."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04800: Utilities.CommonErrors._PMTGroupErrors.PMT_6,
PMT03027: {
dialog: !0,
title: $L("Updating or removing account is not allowed because there are still pending orders using this account"),
message: $L("Your account cannot be updated at this time. Please try again later."),
choices: Utilities.ErrorChoices.simpleOKChoices,
failoverNotAllowed: !0
},
PMT03028: Utilities.CommonErrors.OBCarrierNotSupported,
PMT03031: {
dialog: !0,
title: $L("Order not accepted because there is a pending order for the same item"),
message: $L("This item is already in the process of being purchased. Please wait for the transaction to complete."),
choices: Utilities.ErrorChoices.simpleOKChoices,
failoverNotAllowed: !0
},
PMT03037: {
dialog: !0,
title: $L("Item already purchased"),
message: $L("This item has already been purchased. Your account won't be charged again."),
choices: Utilities.ErrorChoices.simpleOKChoices,
failoverNotAllowed: !0
},
PMT04022: {
dialog: !0,
title: $L("Invalid Information"),
message: $L("Your credit card Security Code is incorrect. Please enter it, as it appears on your credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04023: {
dialog: !0,
title: $L("Invalid Information"),
message: $L("Your First Name is incorrect. Please enter it, as it appears on your credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04024: {
dialog: !0,
title: $L("Invalid Information"),
message: $L("Your Last Name is incorrect. Please enter it, as it appears on your credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04025: {
dialog: !0,
title: $L("Invalid Information"),
message: $L("Please enter a valid phone number."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04026: {
dialog: !0,
title: $L("Invalid Information"),
message: $L("The City listed in your Billing Address is invalid. Please check it and try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05205: {
dialog: !0,
title: $L("Transaction failed"),
message: $L("This item's price exceeds your spending limit. Please pay with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05206: {
dialog: !0,
title: $L("Transaction failed"),
message: $L("Your {$carrierName} account's settings do not allow you to purchase items with your {$carrierName} account. Please pay with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05208: {
dialog: !0,
title: $L("Transaction failed"),
message: $L("You do not have an active account with {$carrierName}. Try paying with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05210: {
dialog: !0,
title: $L("Wireless subscriber has run out of prepaid credits"),
message: $L("This item's price exceeds your carrier account balance. Please pay with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05213: {
dialog: !0,
title: $L("Carrier not supported"),
message: $L("{$carrierName} does not support payments. Please pay with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05215: Utilities.CommonErrors.OBCarrierNotSupported,
PMT05216: {
dialog: !0,
title: $L("Transaction failed"),
message: $L("You do not have an active account with {$carrierName}. Try paying with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05217: Utilities.CommonErrors.OBCarrierNotSupported,
PMT05204: {
dialog: !0,
title: $L("Transaction failed"),
message: $L("You do not have an active account with {$carrierName}. Try paying with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05211: {
dialog: !0,
title: $L("Wireless subscriber not eligible for premium billing"),
message: $L("{$carrierName} does not allow you to purchase items using with your {$carrierName} account. Please pay with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05212: {
dialog: !0,
title: $L("Transaction failed"),
message: $L("You do not have an active account with {$carrierName}. Try paying with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
inprogress: {
dialog: !0,
title: $L("Transaction in Progress"),
message: $L("The transaction is still being processed. Try to download the app in a few minutes. You will not be charged again."),
choices: Utilities.ErrorChoices.simpleOKChoices,
failoverNotAllowed: !0
},
nowan: {
dialog: !0,
title: $L("No Carrier Data Connection"),
message: $L("You must be connected to {$carrierName} to pay with your carrier account. Connect and try again. Or, pay with credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02019: {
dialog: !0,
title: $L("Card validation"),
message: $L("Please verify that the credit card number and payment type are set correctly."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT51004: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
PMT51005: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
LOCL0001: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The address is incomplete. Verify that you've entered your complete address."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0002: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The payment information is incomplete. Verify that you've entered your payment information completely."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0003: {
dialog: !0,
title: $L("Data Entry"),
message: $L("Please only enter numbers (0-9) in the account number."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0004: {
dialog: !0,
title: $L("Data Entry"),
message: $L("Choose a card type."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0005: {
dialog: !0,
title: $L("Data Entry"),
message: $L("You must enter a phone number in the Phone Number field."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0006: {
dialog: !0,
title: $L("Data Entry"),
message: $L("Verify your billing information. It is incomplete."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0007: {
dialog: !0,
title: $L("Data Entry"),
message: $L("Verify your account information. It is incomplete or incorrect."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0008: {
dialog: !0,
title: $L("Data Entry"),
message: $L("Please enter your full name, as it appears on your credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0009: {
dialog: !0,
title: $L("Data Entry"),
message: $L("You must enter data in the correct format in these fields: {$fields}."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0010: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The Postcode is incorrect. Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOC02018: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The Zip code is incorrect. Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOC02019: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The Postal code is incorrect. Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOC02020: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The first name is too long (must be less than 60 characters). Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOC02021: {
dialog: !0,
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
page: !0,
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
dialog: !0,
title: $L("Error"),
message: $L("Fail to get country list from server."),
choices: [ {
label: $L("Try Again"),
value: "tryGetCountryList"
} ]
},
LOC03007: Utilities.CommonErrors.catchAllDialog,
LOC03008: Utilities.CommonErrors.catchAllFullPage,
LOC03009: Utilities.CommonErrors.catchAllFullPage,
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
dialog: !0,
title: $L("Couldn't Purchase"),
message: $L("The item could not be purchased. Try again later. {$errCode}"),
choices: Utilities.ErrorChoices.tryCCChoices
},
LOC04013: {
dialog: !0,
title: $L("Couldn't Purchase"),
message: $L("The item could not be purchased. Try again later. {$errCode}"),
choices: Utilities.ErrorChoices.tryOBChoices
},
LOC04014: {
dialog: !0,
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
page: !0,
title: $L("Error"),
message: $L("Could not fetch reviews for the Application."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOC07003: {
dialog: !0,
title: $L("Error"),
message: $L("Could not fetch reviews for the Application."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOC07004: Utilities.CommonErrors.catchAllFullPage,
LOC07005: Utilities.CommonErrors.catchAllFullPage,
LOC07006: Utilities.CommonErrors.catchAllFullPage,
LOC07007: Utilities.CommonErrors.catchAllFullPage,
LOC07100: {
dialog: !0,
title: $L("Error"),
message: $L("Could not submit your report at this time. Try again later."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOC07101: {
reuseDefinition: "LOC07100"
},
LOC07102: {
dialog: !0,
title: $L("Image is missing"),
message: $L("The full-size image cannot be displayed because it cannot be found."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOC07200: Utilities.CommonErrors.catchAllDialog,
LOC08000: Utilities.CommonErrors.catchAllFullPage,
LOC08001: Utilities.CommonErrors.catchAllFullPage,
LOC08002: {
dialog: !0,
title: $L("Error"),
message: $L("Search was unsuccessful"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOC09000: {
page: !0,
title: $L("Error"),
message: $L("Error in saved apps"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
validate_space_default_single: {
dialog: !0,
title: $L("Cannot Install"),
message: $L("This app requires {$installSize}. You must delete some apps or files before you can install it. Click Help for more information."),
choices: [ {
label: $L("Help"),
value: "help",
type: "primary"
}, {
label: $L("OK"),
value: "ok",
type: "dismiss"
} ]
},
validate_space_default_mult: {
dialog: !0,
title: $L("Cannot Install"),
message: $L("{$installSize} is required to install everything. You can install apps one at a time, or delete apps or files to make room. Click Help for more information."),
choices: [ {
label: $L("Help"),
value: "help",
type: "primary"
}, {
label: $L("OK"),
value: "ok",
type: "dismiss"
} ]
},
install_revert_failed: {
dialog: !0,
title: $L("Can't Restore"),
message: $L("The original version couldn't be installed because there is not enough space. Delete some apps or files and try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
install_revert_default: {
dialog: !0,
title: $L("Couldn'ttInstall"),
message: $L("The {$title} update can not be installed and current version is unusable. Please restore the original version."),
choices: [ {
label: $L("Restore Now"),
value: "revert",
type: "primary"
} ]
},
install_default: {
dialog: !0,
title: $L("Couldn't Install"),
message: $L("There was a problem installing the application"),
choices: [ {
label: $L("Try Again"),
value: "retry",
type: "primary"
}, {
label: $L("Don't Install"),
value: "cancel",
type: "dismiss"
} ]
},
FAILED_NOT_ENOUGH_TEMP_SPACE: {
dialog: !0,
title: $L("Couldn't Install"),
message: $L("This app requires {$installSize}. You must delete some apps or files before you can install it. Click Help for more information."),
choices: [ {
label: $L("Help"),
value: "help",
type: "primary"
}, {
label: $L("OK"),
value: "cancel",
type: "dismiss"
} ]
},
FAILED_NOT_ENOUGH_INSTALL_SPACE: {
dialog: !0,
title: $L("Couldn't Install"),
message: $L("This app requires {$installSize}. You must delete some apps or files before you can install it. Click Help for more information."),
choices: [ {
label: $L("Help"),
value: "help",
type: "primary"
}, {
label: $L("OK"),
value: "cancel",
type: "dismiss"
} ]
},
download_default: {
dialog: !0,
title: $L("Download Error"),
message: $L("There was a problem downloading the application."),
choices: [ {
label: $L("Cancel"),
value: "cancel",
type: "dismiss"
}, {
label: $L("Try Again"),
value: "retry",
type: "primary"
} ]
},
"-3": {
dialog: !0,
title: $L("Download Error"),
message: $L("The download file is missing or damaged."),
choices: [ {
label: $L("Try Again"),
value: "retry",
type: "primary"
}, {
label: $L("Cancel"),
value: "cancel",
type: "dismiss"
} ]
},
"-2": {
dialog: !0,
title: $L("Download Error"),
message: $L("The download file is missing or damaged."),
choices: [ {
label: $L("Try Again"),
value: "retry",
type: "primary"
}, {
label: $L("Cancel"),
value: "cancel",
type: "dismiss"
} ]
}
};
;
// utilities/errors.js

var Utilities = Utilities || {};

Utilities.ErrorChoices = {
tryCCChoices: [ {
label: $L("Use Credit Card"),
value: "cc",
type: "default"
}, {
label: $L("Cancel"),
value: !0,
type: "dismiss"
} ],
tryOBChoices: [ {
label: $L("Use Carrier Account"),
value: "ob",
type: "default"
}, {
label: $L("Cancel"),
value: !0,
type: "dismiss"
} ],
simpleOKChoices: [ {
label: $L("OK"),
value: !0,
type: "dismiss"
} ]
}, enyo.kind({
name: "CommonErrors",
kind: enyo.Component,
components: [],
_PMTGroupErrors: {
PMT_0: {
dialog: !0,
title: $L("Payment Type"),
message: $L("You can only pay with a credit card. Update your account information in Preferences & Accounts and try again. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_1: {
dialog: !0,
title: $L("Payment Failed"),
message: $L("We cannot process your payment. Contact your financial institution. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_2: {
dialog: !0,
title: $L("Payment Failed"),
message: $L("Update the payment information in your account and try again. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_3: {
dialog: !0,
title: $L("Payment Failed"),
message: $L("CyberSource refused your payment. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_4: {
dialog: !0,
title: $L("Payment Failed"),
message: $L("You are not permitted to purchase items in the App Catalog. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_5: {
dialog: !0,
title: $L("Transaction Error"),
message: $L("The credit card you are using may be fraudulent. Enter a different credit card in Preferences & Accounts and try again. {$errCode}"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT_6: {
dialog: !0,
title: $L("Can't Purchase"),
message: $L("The United States Government prohibits Palm from allowing you to purchase applications."),
choices: [ {
label: $L("OK"),
value: "quit",
type: "primary"
}, {
label: $L("Help"),
value: "help",
type: "secondary"
} ]
},
PMT_7: {
dialog: !0,
title: $L("Invalid Address"),
message: $L("The address you entered cannot be found. Verify that the address you entered is correct, and is in the Billing Country you have chosen."),
choices: [ {
label: $L("OK"),
value: "ok",
type: "dismiss"
} ]
}
},
OBCarrierNotSupported: {
dialog: !0,
title: $L("Operator Billing is not supported for this carrier"),
message: $L("{$carrierName} does not support payments. Please pay with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
}
}), Utilities.CommonErrors = new CommonErrors, enyo.kind({
name: "Error",
kind: "Control",
events: {
onSubmit: "",
onCancel: ""
},
published: {
session: null
},
components: [ {
kind: "Popup",
name: "popup",
scrim: !0,
modal: !0,
width: "400px",
components: [ {
name: "popup_error_title",
className: "enyo-item enyo-first",
style: "padding: 12px",
allowHtml: !0
}, {
name: "popup_error_message",
className: "enyo-item enyo-last",
style: "padding: 12px; font-size: 14px",
allowHtml: !0
}, {
kind: "HFlexBox",
name: "popup_choices",
style: "padding-top: 6px;"
} ]
}, {
kind: "Dialog",
name: "dialog",
components: [ {
name: "dialog_error_title",
className: "enyo-item enyo-first",
style: "padding: 12px",
allowHtml: !0
}, {
name: "dialog_error_message",
className: "enyo-item enyo-last",
style: "padding: 12px; font-size: 14px",
allowHtml: !0
}, {
kind: "HFlexBox",
name: "dialog_choices",
style: "padding-top: 6px;"
} ]
} ],
destroyChoices: function() {
components = this.getComponents();
for (i in components) components[i].name.search(/button/) >= 0 && components[i].destroy();
},
showPopup: function(a) {
this.$.popup.openAtCenter(), this.$.popup_error_title.setContent(a.title), this.$.popup_error_message.setContent(a.formattedMessage ? a.formattedMessage : a.message);
if (!a.choices || a.choices.length == 0) this.$.popup_choices.createComponent({
kind: "Button",
flex: 1,
caption: $L("OK"),
onclick: "cancelPopup",
owner: this
}); else for (i in a.choices) clickAction = a.choices[i].type == "dismiss" ? "cancelPopup" : "submitPopup", this.$.popup_choices.createComponent({
kind: "Button",
flex: 1,
value: a.choices[i].value,
caption: a.choices[i].label,
onclick: clickAction,
owner: this
});
this.$.popup.render();
},
submitPopup: function(a) {
this.$.popup.close(), this.doSubmit(a.value);
},
cancelPopup: function(a) {
this.$.popup.close(), this.doCancel(a.value);
},
showDialog: function(a) {
this.$.dialog_error_title.setContent(a.title), this.$.dialog_error_message.setContent(a.formattedMessage);
if (!a.choices || a.choices.length == 0) this.$.popup_choices.createComponent({
kind: "Button",
flex: 1,
value: "ok",
caption: $L("OK"),
onclick: "cancelDialog",
owner: this
}); else for (i in a.choices) clickAction = a.choices[i].type == "dismiss" ? "cancelDialog" : "submitDialog", this.$.dialog_choices.createComponent({
kind: "Button",
flex: 1,
value: a.choices[i].value,
caption: a.choices[i].label,
onclick: clickAction,
owner: this
});
this.$.dialog.render(), this.$.dialog.open();
},
submitDialog: function(a) {
this.$.dialog.close(), this.doSubmit(a.value);
},
cancelDialog: function(a) {
this.$.dialog.close(), this.doCancel(a.value);
},
showFatalError: function(a) {
a.message || (a.message = $L("The action could not be completed.<br/>Try again later."));
var b = viewLibrary.getView("FULLSCREENERROR");
b.setParams({
errorTitle: a.title,
errorMessage: a.message
});
},
cancel: function() {
this.$.dialog.close(), this.$.popup.close();
},
showPalmProfileError: function() {
this.showFatalError(this._dialogErrors.invalidtoken);
},
_displayErrorPage: function(a) {
a == "invalidtoken" ? findApps.AccountServices.getInstance().notifyAuthenticationFailure({
onSuccess: "showPalmProfileError",
onFailure: "showPalmProfileError",
scope: this
}) : this.showFatalError(this._dialogErrors[a]);
},
_displayIncompatibleErrorPage: function(a) {
this.showDialog(a);
},
_displayErrorDialog: function(a) {
this.showPopup(a);
},
displayPromoErrorDialog: function(a, b) {
var c = "Promo Code", d = "Unknown error.";
switch (a) {
case "invalid":
d = "Invalid, unavailable or expired promo code, try to use previous saved code or manually input valid code.";
break;
case "fail":
d = "Sorry, fail to get promo code information from server.";
}
this.showDialog({
title: c,
message: $L(d),
choices: [ {
label: $L("OK"),
type: "dismiss"
} ]
});
},
displayError: function(a, b, c, d, e) {
this.destroyChoices(), (a == "failure" || a == "badresponse") && c && c.indexOf("PMT_") && (a = c);
var f = this._dialogErrors[a] || this._dialogErrors[c];
f ? !this._dialogErrors[a] && c && (a = c) : (a + "").indexOf("PMT") < 0 ? f = {
dialog: !0,
title: d || $L("Unknown Error"),
message: e || a
} : (f = this._dialogErrors.PMT_catchAll, a = "PMT_catchAll");
if (f.page) this._displayErrorPage(a); else if (f.incompatible_page) this._displayIncompatibleErrorPage(a); else if (f.dialog) {
b || (b = {
errCode: a
});
var g = f.message;
f.formattedMessage = enyo.macroize(g, b), a && a.indexOf("PROMO") && (f.promoTag = !0, f.promoErrorCode = a), b && b.failover && (b.failover == "cc" ? f.choices = Utilities.ErrorChoices.tryCCChoices : b.failover == "ob" ? f.choices = Utilities.ErrorChoices.tryOBChoices : f.choices = Utilities.ErrorChoices.simpleOKChoices), this._displayErrorDialog(f);
}
},
_dialogErrors: {
offline: {
page: !0,
message: $L("You must connect to a network to use this application.")
},
invalidtoken: {
page: !0,
message: $L("We could not find a valid webOS Account.<br/>You need a valid account to use App Catalog.")
},
failure: {
page: !0
},
failureRetry: {
dialog: !0,
title: $L("Error"),
message: $L("App Catalog could not complete the last action you performed. Try again later."),
choices: [ {
label: $L("Try Again"),
value: "retry"
} ]
},
badformat: {
page: !0
},
timeout: {
page: !0
},
jsonexception: {
page: !0
},
downformaintenance: {
page: !0
},
appunavailable: {
page: !0,
message: $L("No applications found.")
},
dplfailed: {
page: !0,
message: $L("You can't set up an account. The United States Government prohibits Palm from allowing you to purchase applications.")
},
PMT01002: {
page: !0
},
APPCAT0065: {
page: !0,
message: $L("Your first wifi-only device has not yet setup Application Catalog country, please do so before proceeding.")
},
DISC0025: {
incompatible_page: !0
},
DISC0124: {
incompatible_page: !0
},
DISC0125: {
incompatible_page: !0
},
DISC0201: {
incompatible_page: !0
},
DISC0202: {
incompatible_page: !0
},
DISC0203: {
incompatible_page: !0
},
PMT_catchAll: {
dialog: !0,
title: $L("Unexpected problem"),
message: $L("App Catalog could not complete the last action you performed. Try again later. {$errCode}"),
choices: [ {
label: $L("OK"),
value: !0,
type: "dismiss"
} ]
},
PMT_addCC_default: {
dialog: !0,
title: $L("Couldn't Add Credit Card"),
message: $L("A problem occurred when adding your credit card information. Try again later. {$errCode}"),
choices: [ {
label: $L("OK"),
value: !0,
type: "dismiss"
} ]
},
PMT_modifyCC_default: {
dialog: !0,
title: $L("Couldn't Update"),
message: $L("The credit card information could not be updated. Try again later. {$errCode}"),
choices: [ {
label: $L("OK"),
value: !0,
type: "dismiss"
} ]
},
PMT_removeCC_default: {
dialog: !0,
title: $L("Couldn't Remove"),
message: $L("The credit card was not removed from your account. Try again later. {$errCode}"),
choices: [ {
label: $L("OK"),
value: !0,
type: "dismiss"
} ]
},
PMT_purchase_default: {
dialog: !0,
title: $L("Couldn't Purchase"),
message: $L("The item could not be purchased. Try again later. {$errCode}"),
choices: Utilities.CommonErrors.tryCCChoices
},
PMT_cant_download: Utilities.CommonErrors._PMTGroupErrors.PMT_6,
PMT_cant_download_encrypted: {
dialog: !0,
title: $L("Can't Download"),
message: $L("The United States Government prohibits Palm from allowing you to download this application."),
choices: [ {
label: $L("OK"),
value: !0,
type: "dismiss"
} ]
},
PMT_cant_purchase: Utilities.CommonErrors._PMTGroupErrors.PMT_6,
PMT02000: {
dialog: !0,
title: $L("Data Entry"),
message: $L("A required field does not exist or is empty"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02002: {
dialog: !0,
title: $L("Data Entry"),
message: $L("This card type is not supported"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02003: {
dialog: !0,
title: $L("Data Entry"),
message: $L("This order type is not supported"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02005: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The State code is incorrect. Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02006: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The Country code is incorrect. Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02008: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The Currency code is incorrect. Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02010: {
dialog: !0,
title: $L("Data Entry"),
message: $L("You must enter valid information in every field."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02011: {
dialog: !0,
title: $L("Data Entry"),
message: $L("You must enter a number in the Credit Card field."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02012: {
dialog: !0,
title: $L("Data Entry"),
message: $L("You must enter a number in the Payment Info ID field."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02013: {
dialog: !0,
title: $L("Data Entry"),
message: $L("You must enter a number in the Quantity field."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02014: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The date in the Expiration Date field must be in the format mmyyyy"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02015: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The value in the Item Unit Price field is not valid. Enter a number instead."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02016: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The date in the Order Date field must be in the format yyyyMMddHHmmss"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02017: {
dialog: !0,
title: $L("Data Entry"),
message: $L("Update the Expiration Date information in your account and try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02018: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The Zip code is incorrect. Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT03000: {
dialog: !0,
title: $L("Transaction Error"),
message: $L("Update your credit card information in Preferences & Accounts and try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT03001: Utilities.CommonErrors._PMTGroupErrors.PMT_0,
PMT03002: {
dialog: !0,
title: $L("Payment Failed"),
message: $L("We cannot perform financial transactions in your country."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT03003: Utilities.CommonErrors._PMTGroupErrors.PMT_0,
PMT03006: {
dialog: !0,
title: $L("Payment Failed"),
message: $L("The last transaction failed. Update the payment information in your account and try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT03007: {
dialog: !0,
title: $L("Couldn't Update"),
message: $L("Credit card information can only be updated after all pending purchases have cleared. Try again after you received receipts for all recent purchases."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04000: {
dialog: !0,
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
dialog: !0,
title: $L("Payment Failed"),
message: $L("Update the security number and try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04008: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
PMT04009: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
PMT04010: {
dialog: !0,
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
dialog: !0,
title: $L("Payment Failed"),
message: $L("There is no payment information associated with your webOS Account. Tap Preferences in the App Menu to set it up."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04018: Utilities.CommonErrors._PMTGroupErrors.PMT_5,
PMT04019: Utilities.CommonErrors._PMTGroupErrors.PMT_5,
PMT04020: Utilities.CommonErrors._PMTGroupErrors.PMT_5,
PMT04021: {
dialog: !0,
title: $L("Transaction Error"),
message: $L("A transaction problem has occurred. Update your credit card information in Preferences & Accounts and try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04200: {
dialog: !0,
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
dialog: !0,
title: $L("Transaction Error"),
message: $L("There is a problem with the credit card. Enter a different credit card in Preferences & Accounts and try again. PMT04415"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04416: {
dialog: !0,
title: $L("Transaction Error"),
message: $L("There may be a problem with the credit card. Enter a different credit card in Preferences & Accounts and try again. PMT04416"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT04417: {
dialog: !0,
title: $L("Transaction Error"),
message: $L("There is a problem with the credit card. Enter a different credit card in Preferences & Accounts and try again. PMT04417"),
choices: Utilities.ErrorChoices.simpleOKChoices
},
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
PMTPROMO70010: {
dialog: !0,
title: $L("Promo Code"),
message: $L("Invalid, unavailable or expired promo code, try to use previous saved code or manually input valid code."),
choices: [ {
label: $L("OK"),
value: !0,
type: "dismiss"
} ]
},
PMT04800: Utilities.CommonErrors._PMTGroupErrors.PMT_6,
PMT03027: {
dialog: !0,
title: $L("Updating or removing account is not allowed because there are still pending orders using this account"),
message: $L("Your account cannot be updated at this time. Please try again later."),
choices: Utilities.ErrorChoices.simpleOKChoices,
failoverNotAllowed: !0
},
PMT03028: Utilities.CommonErrors.OBCarrierNotSupported,
PMT03031: {
dialog: !0,
title: $L("Order not accepted because there is a pending order for the same item"),
message: $L("This item is already in the process of being purchased. Please wait for the transaction to complete."),
choices: Utilities.ErrorChoices.simpleOKChoices,
failoverNotAllowed: !0
},
PMT03037: {
dialog: !0,
title: $L("Item already purchased"),
message: $L("This item has already been purchased. Your account won't be charged again."),
choices: Utilities.ErrorChoices.simpleOKChoices,
failoverNotAllowed: !0
},
PMT05205: {
dialog: !0,
title: $L("Transaction failed"),
message: $L("This item's price exceeds your spending limit. Please pay with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05206: {
dialog: !0,
title: $L("Transaction failed"),
message: $L("Your {$carrierName} account's settings do not allow you to purchase items with your {$carrierName} account. Please pay with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05208: {
dialog: !0,
title: $L("Transaction failed"),
message: $L("You do not have an active account with {$carrierName}. Try paying with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05210: {
dialog: !0,
title: $L("Wireless subscriber has run out of prepaid credits"),
message: $L("This item's price exceeds your carrier account balance. Please pay with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05213: {
dialog: !0,
title: $L("Carrier not supported"),
message: $L("{$carrierName} does not support payments. Please pay with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05215: Utilities.CommonErrors.OBCarrierNotSupported,
PMT05216: {
dialog: !0,
title: $L("Transaction failed"),
message: $L("You do not have an active account with {$carrierName}. Try paying with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05217: Utilities.CommonErrors.OBCarrierNotSupported,
PMT05204: {
dialog: !0,
title: $L("Transaction failed"),
message: $L("You do not have an active account with {$carrierName}. Try paying with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05211: {
dialog: !0,
title: $L("Wireless subscriber not eligible for premium billing"),
message: $L("{$carrierName} does not allow you to purchase items using with your {$carrierName} account. Please pay with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT05212: {
dialog: !0,
title: $L("Transaction failed"),
message: $L("You do not have an active account with {$carrierName}. Try paying with a credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
inprogress: {
dialog: !0,
title: $L("Transaction in Progress"),
message: $L("The transaction is still being processed. Try to download the app in a few minutes. You will not be charged again."),
choices: Utilities.ErrorChoices.simpleOKChoices,
failoverNotAllowed: !0
},
nowan: {
dialog: !0,
title: $L("No Carrier Data Connection"),
message: $L("You must be connected to {$carrierName} to pay with your carrier account. Connect and try again. Or, pay with credit card."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT02019: {
dialog: !0,
title: $L("Card validation"),
message: $L("Please verify that the credit card number and payment type are set correctly."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
PMT51004: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
PMT51005: Utilities.CommonErrors._PMTGroupErrors.PMT_1,
LOCL0001: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The address is incomplete. Verify that you've entered your complete address."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0002: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The payment information is incomplete. Verify that you've entered your payment information completely."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0003: {
dialog: !0,
title: $L("Data Entry"),
message: $L("Please only enter numbers (0-9) in the account number."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0004: {
dialog: !0,
title: $L("Data Entry"),
message: $L("Choose a card type."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0005: {
dialog: !0,
title: $L("Data Entry"),
message: $L("You must enter a phone number in the Phone Number field."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0006: {
dialog: !0,
title: $L("Data Entry"),
message: $L("Verify your billing information. It is incomplete."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOCL0007: {
dialog: !0,
title: $L("Data Entry"),
message: $L("Verify your account information. It is incomplete or incorrect."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOC02020: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The first name is too long (must be less than 60 characters). Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOC02021: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The last name is too long (must be less than 60 characters). Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOC02018: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The Zip code is incorrect. Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
LOC02019: {
dialog: !0,
title: $L("Data Entry"),
message: $L("The Postal code is incorrect. Try again."),
choices: Utilities.ErrorChoices.simpleOKChoices
},
validate_space_default_single: {
dialog: !0,
title: $L("Cannot Install"),
message: $L("This app requires {$installSize}. You must delete some apps or files before you can install it. Click Help for more information."),
choices: [ {
label: $L("Help"),
value: "help",
type: "primary"
}, {
label: $L("OK"),
value: "ok",
type: "secondary"
} ]
},
validate_space_default_mult: {
dialog: !0,
title: $L("Cannot Install"),
message: $L("{$installSize} is required to install everything. You can install apps one at a time, or delete apps or files to make room. Click Help for more information."),
choices: [ {
label: $L("Help"),
value: "help",
type: "primary"
}, {
label: $L("OK"),
value: "ok",
type: "secondary"
} ]
},
install_revert_failed: {
dialog: !0,
title: $L("Can't Restore"),
message: $L("The original version couldn't be installed because there is not enough space. Delete some apps or files and try again."),
choices: [ {
label: $L("OK"),
value: !0,
type: "dismiss"
} ]
},
install_revert_default: {
dialog: !0,
title: $L("Couldn'ttInstall"),
message: $L("The {$title} update can not be installed and current version is unusable. Please restore the original version."),
choices: [ {
label: $L("Restore Now"),
value: "revert",
type: "primary"
} ]
},
install_default: {
dialog: !0,
title: $L("Couldn't Install"),
message: $L("There was a problem installing the application"),
choices: [ {
label: $L("Try Again"),
value: "retry",
type: "primary"
}, {
label: $L("Don't Install"),
value: "cancel",
type: "dismiss"
} ]
},
FAILED_NOT_ENOUGH_TEMP_SPACE: {
dialog: !0,
title: $L("Couldn't Install"),
message: $L("This app requires {$installSize}. You must delete some apps or files before you can install it. Click Help for more information."),
choices: [ {
label: $L("Help"),
value: "help",
type: "primary"
}, {
label: $L("OK"),
value: "cancel",
type: "secondary"
} ]
},
FAILED_NOT_ENOUGH_INSTALL_SPACE: {
dialog: !0,
title: $L("Couldn't Install"),
message: $L("This app requires {$installSize}. You must delete some apps or files before you can install it. Click Help for more information."),
choices: [ {
label: $L("Help"),
value: "help",
type: "primary"
}, {
label: $L("OK"),
value: "cancel",
type: "secondary"
} ]
},
download_default: {
dialog: !0,
title: $L("Download Error"),
message: $L("There was a problem downloading the application."),
choices: [ {
label: $L("Try Again"),
value: "retry",
type: "primary"
}, {
label: $L("Don't Download"),
value: "cancel",
type: "dismiss"
} ]
},
"-3": {
dialog: !0,
title: $L("Download Error"),
message: $L("The download file is missing or damaged."),
choices: [ {
label: $L("Try Again"),
value: "retry",
type: "primary"
}, {
label: $L("Don't Download"),
value: "cancel",
type: "secondary"
} ]
},
"-2": {
dialog: !0,
title: $L("Download Error"),
message: $L("The download file is missing or damaged."),
choices: [ {
label: $L("Try Again"),
value: "retry",
type: "primary"
}, {
label: $L("Don't Download"),
value: "cancel",
type: "secondary"
} ]
}
}
});
;
// utilities/FatalError.js

enyo.kind({
name: "swmanager.FatalError",
kind: "VFlexBox",
pack: "center",
align: "center",
className: "box-center",
components: [ {
kind: "Spacer"
}, {
name: "fullscreen_error_message",
allowHtml: !0,
style: "margin:11px 24px;"
}, {
kind: "Spacer"
} ],
published: {
params: {}
},
create: function(a) {
this.inherited(arguments);
},
paramsChanged: function() {
this.$.fullscreen_error_message.setContent(this.params.errorMessage);
},
backButtonClick: function() {
viewLibrary.popViewsFromHistory(1), viewLibrary.goBack();
}
});
;
// utilities/versioncheck.js

var Utilities = Utilities || {};

enyo.kind({
name: "VersionCheck",
kind: enyo.Control,
components: [],
compare: function(a, b) {
if (a == null && b == null) return 0;
if (a == null) return -1;
if (b == null) return 1;
var c = ("" + a).split(/[^a-zA-Z0-9]+/), d = ("" + b).split(/[^a-zA-Z0-9]+/), e = Math.min(c.length, d.length);
for (var f = 0; f <= e; f++) {
if (f == c.length) return f == d.length ? 0 : -1;
if (f == d.length) return 1;
var g = this._parseInt(c[f]), h = this._parseInt(d[f]);
if (g != h) {
var i = g - h;
return i < 0 ? -1 : i > 0 ? 1 : 0;
}
g = c[f].toLowerCase(), h = d[f].toLowerCase();
if (g < h) return -1;
if (g > h) return 1;
}
return 0;
},
_parseInt: function(a) {
return a.search(/[^\D]/) ? null : parseInt(a, 10);
}
}), Utilities.VersionCheck = Utilities.VersionCheck || new VersionCheck;
