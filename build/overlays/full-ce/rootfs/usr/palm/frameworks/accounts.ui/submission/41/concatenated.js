this._root["__MojoFramework_accounts.ui"] = function(MojoLoader, exports, root) {


//@ sourceURL=accounts.ui/prologue.js

/*global exports root console MojoLoader palmGetResource */
if (typeof root.Mojo === "undefined") {
	throw new Error("Mojo not loaded!");
}

var IMPORTS = MojoLoader.require({
	name: "globalization",
	version: "1.0"
});

var Mojo = root.Mojo;
var _ = root._;  // Mojo2 provides _
var Foundations = root.Foundations;
var Globalization = IMPORTS.globalization.Globalization;

var PalmCall = Foundations.Comms.PalmCall;
var Assert = Foundations.Assert;
var ACCOUNT_KIND = "com.palm.account:1";

var RBfactory = new Globalization.ResourceBundleFactory(MojoLoader.root);
var RB = RBfactory.getResourceBundle();

exports.getLibraryRoot = function () {
	return MojoLoader.root;
};
	
// some global utility functions

var Util = (function () {
	
	var capabilityMetadata;
	
	function whereEquals(prop, val) {
		return {
			prop: prop,
			op: "=",
			val: val
		};
	}

	function getTemplateById(templates, id) {
		return _.detect(templates, function (t) {
			return (t.templateId === id);
		});
	}

	function matchCapabilities(t) {
		var matches = true;
		var matchingCps;

		// Format the sought capability consistently (in an array)
		var capabilities;
		if (typeof this.capability === "string") {
			capabilities = [this.capability];
		} else if (this.capability) {
			capabilities = this.capability;
		}

		// First find out which of the asked-for capabilities match.
		// reject if no matches are found.  not every capability has to be
		// supported.
		if (capabilities) {
			matchingCps = t.capabilityProviders.filter(function(cp) {
				return _.include(capabilities, cp.capability);
			});
			
			if (matchingCps.length === 0) {
				matches = false;
			}
		} else {
			matchingCps = t.capabilityProviders;
		}
		
		// Now make sure all the required capabilities are not read-only
		if (matches && this.dataWritable) {
			matches = matchingCps.every(function(cp) {
				return !cp.readOnlyData;
			});
		}

		return matches;
	}

	return {
		getTemplateById: getTemplateById,
	
		filterTemplates: function (templates, filterBy) {
			var selectedTemplates = templates, tmpl;

			if (filterBy) {
				if (filterBy.templateId) {
					tmpl = getTemplateById(templates, filterBy.templateId);
					Mojo.require(tmpl, "Requested account template not found: " + filterBy.templateId);
					selectedTemplates = [tmpl];

				} else if (filterBy.capability || filterBy.dataWritable) {
					selectedTemplates = templates.filter(matchCapabilities, filterBy);
				}
				
				if (filterBy.exclude) {
					selectedTemplates = selectedTemplates.filter(function(t) {
						return !_.include(filterBy.exclude, t.templateId);
					});
				}
			}
			
			// only return templates for creatable accounts (they all have validators)
			// also filter out templates marked 'hidden'
			selectedTemplates = selectedTemplates.filter(function (t) {
				return !!t.validator && !t.hidden;
			});

			return selectedTemplates;
		},
		
		createWhere: function (filterBy) {
			var where = [];

			if (filterBy) {
				if (filterBy.templateId) {
					where.push(whereEquals("templateId", filterBy.templateId));
				} else if (filterBy.capability) {
					where.push(whereEquals("capabilityProviders.capability", filterBy.capability));
				}
			}
			if (!(filterBy && filterBy.showDeleted)) {
				where.push(whereEquals("beingDeleted", false));
			}

			return (where.length > 0) ? where : undefined;
		},
	
		annotateAccount: function (account, templates) {
			// net effect is totally stitched together acct+template obj,
			// where template props override acct props at both the top level
			// and per-capability
			// (but extra acct props are still present in case accounts need to store supplemental data)

			if (this.templates) {
				templates = this.templates;
			}
			var result,
				phoneNumber,
				usernameTemplate,
			//     subset,
			    template = _.detect(templates, function (t) {
				return (t.templateId === account.templateId);
			});

			result = _.clone(account);

			if (!template) {
				console.warn("template not found: " + account.templateId);
				return result;
			}

			_.extend(result, template);

			result.capabilityProviders = account.capabilityProviders.map(function (c) {
				var clone = _.clone(c), tmplCap;
				    
				tmplCap = _.detect(template.capabilityProviders, function (tc) {
					return (tc.id === c.id);
				});

				if (!tmplCap) {
					console.warn("capability not found: " + c.id + " for template: " + template.templateId);
					return clone;
				}

				return _.extend(clone, tmplCap);
			});
			
			// FIXME: The username can be either the IMSI or the phone number so we shouldn't format it
			if (account.templateId === "com.palm.sim" && result.username && result.username.indexOf("SIMREMOVED ") === 0) {
				phoneNumber = result.username.substring(11);
				if (phoneNumber) {
					result.rawUsername = phoneNumber; // So we don't have to re-clean the SIM removed text...
					usernameTemplate = new Globalization.Format.Template(RB.$L("#{phoneNumber} - SIM Removed"));
					result.username = usernameTemplate.evaluate({ phoneNumber: phoneNumber });
					result.disableRemove = false; // Now we can delete removed SIM accounts
				}
			}

			return result;
		},
		
		getCapabilityText: function (rawName) {
			var c, json, text, i;
			
			if (!capabilityMetadata) {
				json = RB.getLocalizedResource("javascript/capabilities.json");
				if (json) {
					capabilityMetadata = JSON.parse(json);
				} else {
					console.warn("Util.getCapabilityText: could not load capabilities.json");
					return "";	// why can't we find it?
				}
			}
			
			text = rawName;
			for (i = 0; i < capabilityMetadata.length; i += 1) {
				c = capabilityMetadata[i];
				if (c.capability === rawName) {
					text = c.loc_name;
				}
			}
			return text;
		},
		
		dedupeByProperty: function (items, idProp) {
			var i, item, len,
			    hash = {};
			
			for (i = 0, len = items.length; i < len; i += 1) {
				item = items[i];
				hash[item[idProp]] = item;
			}
			return _.values(hash);
		}
		
	};
}());



//@ sourceURL=accounts.ui/errors.js

/*global RB $L*/
/*jslint sub:true*/
var AccountError = function() {};

AccountError._errorStrings = {
	"UNKNOWN_ERROR":				RB.$L("Unknown error"),

	"401_UNAUTHORIZED":				RB.$L("The account credentials you entered are incorrect. Try again."),
	"408_TIMEOUT":					RB.$L("Request timeout"),
	"500_SERVER_ERROR":				RB.$L("Server error"),
	"503_SERVICE_UNAVAILABLE":		RB.$L("Server unavailable"),
	"412_PRECONDITION_FAILED":		RB.$L("The request is not suitable for the current configuration"),
	"400_BAD_REQUEST":				RB.$L("Bad request"),
	"HOST_NOT_FOUND":				RB.$L("Host not found"),
	"CONNECTION_TIMEOUT":			RB.$L("Connection timeout"),
	"CONNECTION_FAILED":			RB.$L("Connection failed"),
	"NO_CONNECTIVITY":				RB.$L("No connectivity"),
	"SSL_CERT_EXPIRED":				RB.$L("SSL certificate expired"),
	"SSL_CERT_UNTRUSTED":			RB.$L("SSL certificate untrusted"),
	"SSL_CERT_INVALID":				RB.$L("SSL certificate invalid"),
	"SSL_CERT_HOSTNAME_MISMATCH":	RB.$L("SSL certificate hostname mismatch"),

	"DUPLICATE_ACCOUNT":			RB.$L("Duplicate account"),
	"UNSUPPORTED_CAPABILITY":		RB.$L("Your account is not configured for this service."),
	"INVALID_EMAIL_ADDRESS":		RB.$L("Please enter a valid email address.")
};

AccountError._numericErrorCodes = {
	"-3141601": "UNKNOWN_ERROR",
	"-3141602": "401_UNAUTHORIZED",
	"-3141603": "408_TIMEOUT",
	"-3141604": "500_SERVER_ERROR",
	"-3141605": "503_SERVICE_UNAVAILABLE",
	"-3141606": "412_PRECONDITION_FAILED",
	"-3141607": "400_BAD_REQUEST",
	"-3141608": "HOST_NOT_FOUND",
	"-3141609": "CONNECTION_TIMEOUT",
	"-3141610": "CONNECTION_FAILED",
	"-3141611": "NO_CONNECTIVITY",
	"-3141612": "SSL_CERT_EXPIRED",
	"-3141613": "SSL_CERT_UNTRUSTED",
	"-3141614": "SSL_CERT_INVALID",
	"-3141615": "SSL_CERT_HOSTNAME_MISMATCH",
	"-3141616": "DUPLICATE_ACCOUNT",
	"-3141617": "UNSUPPORTED_CAPABILITY"
};

AccountError.getErrorText = function(error) {
	var text = this._errorStrings["UNKNOWN_ERROR"];
	var code;
	
	if (error.errorCode) {
		code = error.errorCode;
		
		if (this._numericErrorCodes[code]) {
			code = this._numericErrorCodes[code];
		}
		
		if (this._errorStrings[code]) {
			text = this._errorStrings[code];
		}
	}
	return RB.$L(text);
};


//@ sourceURL=accounts.ui/accounts-list.js

/*global _ exports RB RBfactory ACCOUNT_KIND PalmCall Util Foundations Mojo */
// filterBy param is either undefined for no filtering, or:
// { capability: "MAIL", -or-
//   templateId: "com.palm.facebook"
// }

var AccountsList = exports.AccountsList = {
	
	//Refetch the correct resource bundle. Should only be used by firstuse
	refreshLocale: function(locale){
		if (locale && locale.length !== 5){
			console.error("Invalid locale passed to accounts.ui: " + locale);
			return;
		}
		Globalization.Locale.setCurrentLocale(locale);
		RB = RBfactory.getResourceBundle();
		return;
	},
	
	// returns a request object
	// request object can be disabled, enabled, and canceled
	// 'callback' is called with the results when they change
	// options include: 'filterBy'(obj) and 'subscribe'(boolean)
	// LIMITED TO 500 ACCOUNTS.  Beyond that, do the watch yourself.
	listAccounts: function(callback, options) {
		var filterBy = (options && options.filterBy) || undefined;
		var subscribe = (options && options.subscribe) || undefined;
		var params = {
			query: {
				from: ACCOUNT_KIND,
				where: Util.createWhere(filterBy)
			},
			watch: subscribe
		};
		var templates;
		var future;
		var makeRequest, handleResponse;
		var dedupe = filterBy && filterBy.capability && _.isArray(filterBy.capability);

		function wrapped(response) {
			var results = response;
			var unique;
			if (response && response.results) {
				if (dedupe) {
					unique = Util.dedupeByProperty(response.results, "_id");
				} else {
					unique = response.results;
				}
				results = unique.map(Util.annotateAccount, { templates: templates });
			}
			callback(results);
		}

		makeRequest = function() {
			var f = PalmCall.call("palm://com.palm.db/", "find", params);
			f.then(handleResponse);
			f.onError(callback);
			return f;
		};

		handleResponse = function(f) {
			var response = f.result;

			if (response.fired) {
				PalmCall.cancel(future);  // @@ may be unnecessary.  does this send a cancel message over the new bus?
				future = makeRequest();  // make a new future and start over
			} else {
                var templatesFuture = PalmCall.call("palm://com.palm.service.accounts/", "listAccountTemplates", {});
		        templatesFuture.onError(callback);
		        templatesFuture.then(function() {
			        templates = templatesFuture.result.results;
			        wrapped(response);
		        });
				
				f.then(handleResponse);
			}
		};

		future = makeRequest();

		return {
			setEnabled: function(enabled) {
				// @@ Suppressing updates not yet implemented.
			},

			cancel: function() {
				PalmCall.cancel(future);
				future.cancel();
			}
		};
	},
	
	/* One-shot request to list all accounts that expect credentials but are missing them.
	 */
	listAccountsMissingCredentials: function(onSuccess, onFailure) {
		
		function hasCredentials(account) {
			return PalmCall.call("palm://com.palm.service.accounts/", "hasCredentials", {
				accountId: account._id
			});
		}
		
		function collect(results) {
			var filtered = [];
			var result;
			for (var i=0; i < results.length; i++) {
				result = results[i].result;
				if (result) {
					if (!result.value) {
						filtered.push(results[i].item);
					}
				} else {
					Mojo.Log.logException("Error getting credentials for an account: ", results[i].exception);
				}
			}
			return new Foundations.Control.Future(filtered);
		}
		
		AccountsList.listAccounts(function(accounts) {
			
			// ignore accounts that lack a validator (i.e. do not require credentials)
			accounts = accounts.filter(function(a) {
				return a.validator && (typeof a.validator === "string" || a.validator.address);
			});
			
			var future = Foundations.Control.mapReduce({
				map: hasCredentials,
				reduce: collect
			}, accounts);
			
			future.onError(function() {
				onFailure(future.exception);
			});
			
			future.then(function() {
				var accounts = future.result;
				onSuccess(accounts);
			});
		});
	}
	
};


//@ sourceURL=accounts.ui/login-utils.js

/*global exports PalmCall Foundations _ LoginAssistant MojoLoader */
// returns a future which will be done after validating the login against an
// array of validator service methods.  The final result looks like:
// 
// { defaultResult: <SINGLE_RESULT>, otherResults: [ SINGLE_RESULT, ... ] }
// 
// (where SINGLE_RESULT=
// { id: <validator id>, result: <Validator Response> -OR- exception: <Validator Error> }
// )
//
// If the default validator fails, the Future will error out. Other failures are
// individually reported in 'otherResults'.
var multiLogin = exports.multiLogin = function (username, password, template, config, options) {
	var accountId, validators;
	
	function getValidatorAddress(parent) {
		if (parent.validator && typeof parent.validator === "object") {
			return parent.validator.address;
		} else {
			return parent.validator;
		}
	}
	
	accountId = options && options.accountId;
	
	validators = [{
		id: template.templateId,
		validator: getValidatorAddress(template),
		config: template.config
	}];
	
	function login(obj) {
		var future, addr, method, combinedConfig;
		var v = obj.validator;
	    var pos = v.lastIndexOf('/');
		
		if (pos === -1) {
			throw new Error("invalid validator: " + v);
		}
		
		addr = v.substring(0, pos + 1);
		method = v.substring(pos + 1);
		
		// combine passed-in config and validator config from template
		// passed-in (if any) takes priority over template config
		if (obj.config || config) {
			combinedConfig = {};
			_.extend(combinedConfig, obj.config);
			_.extend(combinedConfig, config);
		}
		
		future = PalmCall.call(addr, method, {
			username: username,
			password: password,
			templateId: template.templateId,
			config: combinedConfig,
			accountId: accountId
		});
		return future;
	}
	
	function isDefault(r) {
		return r.item.id === template.templateId;
	}
	
	function collect(results) {
		var dv, f = new Foundations.Control.Future();
		
		// split out default validator result from the rest
		dv = _.detect(results, isDefault);
		
		if (dv.exception) {
			f.exception = dv.exception;
		} else {
			f.result = {
				defaultResult: dv,
				otherResults: _.reject(results, isDefault)
			};
		}
		
		return f;
	}
	
	template.capabilityProviders.forEach(function (c) {
		if (c.validator) {
			validators.push({
				id: c.id,
				validator: getValidatorAddress(c),
				config: c.config
			});
		}
	});
	
	// console.log("MULTI-LOGIN, validators are: " + JSON.stringify(validators));
	
	return Foundations.Control.mapReduce({
		map: login,
		reduce: collect
	}, validators);
	
};

var LoginUtil = {
	pushLoginScene: function (stage, template, allTemplates, capability) {
		
		if (_.isString(template.validator)) {
			
			stage.pushScene({
				name: "login",
				assistantConstructor: LoginAssistant,
				templateRoot: MojoLoader.root,
				sceneTemplate: "templates/login-scene",
				templateModel: template
			}, template, capability);
			
		} else if (typeof template.validator === "object") {
			
			stage.pushScene(template.validator.customUI, {
				initialTemplate: template,
				templateRoot: MojoLoader.root,
				allTemplates: allTemplates
			});
			
		} else {
			throw new Error("Template is missing default validator: " + JSON.stringify(template));
		}
	}
	
};


//@ sourceURL=accounts.ui/post-login.js

/*global ModifyAssistant MojoLoader _ Assert Util console RB AccountError */
// Utility functions to handle account creation after login (or custom validation UI)

var PostLogin = (function () {
	
	return {
		
		// processes login results and creates an account.
		// assumes you've already popped off the validation scene
		//
		// 'selectedCapabilities' is an array of capability IDs the created account should enable.
		createAccount: function (scene, result, requestedCapability, toSave, existingAccounts) {
			var allCreds = {};
			var allConfigs = {};
			var stage = scene.stageController;
			var capabilityProviders = [];
			var match;
			var selectedCapabilities = toSave.capabilityProviders;
			
			function handleCreateFailure(response) {
				console.log("**** create account failed: " + JSON.stringify(response, undefined, 2));
				scene.showAlertDialog({
					title: RB.$L("Error"),
					message: AccountError.getErrorText(response),
					choices: [{ label: RB.$L("OK"), value: "ok", type: "dismiss" }],
					onChoose: function () {
						stage.popScene();
					},
					preventCancel: true
				});
			}

			function handleCreateSuccess(response) {
				console.log("**** account created! " + JSON.stringify(response, undefined, 2));
				
				stage.popScene();
			}
			
			function isValidatorMatch(r) {
				return this.validator === r.item.validator;
			}
			
			// Combine all credentials and config objects
			
			_.extend(allCreds, result.defaultResult.result.credentials);
			
			// for config, start with template configs, then custom UI config, then validator configs
			if (result.template.config) {
				_.extend(allConfigs, result.template.config);
			}
			result.template.capabilityProviders.forEach(function(cp) {
				if (cp.config) {
					_.extend(allConfigs, cp.config);
				}
			});
			_.extend(allConfigs, result.config);
			_.extend(allConfigs, result.defaultResult.result.config);
			
			if (result.otherResults && _.isArray(result.otherResults)) {
				result.otherResults.forEach(function (other) {
					if (other.result) {
						_.extend(allCreds, other.result.credentials);
						_.extend(allConfigs, other.result.config);
					}
				});
			}
			
			// create a new account OR modify an existing an account if one exists
			// where the requested capability is disabled
			match = _.detect(existingAccounts, function(account) {
				var caps = _.pluck(account.capabilityProviders, "capability");
				return requestedCapability &&
					account.username === result.username &&
					account.templateId === result.template.templateId &&
					!_.include(caps, requestedCapability);
			});
			
			if (match) {
				// do not attempt to enable any capabilities that failed validation
				result.template.capabilityProviders.forEach(function(cp) {
					var matchingResult;
					if (cp.validator) {
						matchingResult = _.detect(result.otherResults, isValidatorMatch, cp);
						if (matchingResult && matchingResult.result) {
							capabilityProviders.push({ id: cp.id });
						}
					} else {
						capabilityProviders.push({ id: cp.id });
					}
				});

				scene.serviceRequest("palm://com.palm.service.accounts", {
					method: "modifyAccount",
					parameters: {
						accountId: match._id,
						object: {
							capabilityProviders: capabilityProviders
						}
					},
					onSuccess: handleCreateSuccess,
					onFailure: handleCreateFailure
				});
			} else {
				scene.serviceRequest("palm://com.palm.service.accounts", {
					method: "createAccount",
					parameters: {
						templateId: result.template.templateId,
						alias: toSave.alias,
						capabilityProviders: selectedCapabilities || [],
						username: result.username,
						credentials: allCreds,
						config: allConfigs
					},
					onSuccess: handleCreateSuccess,
					onFailure: handleCreateFailure
				});
			}
		}
		
	};
})();


//@ sourceURL=accounts.ui/accountslist-widget.js

/*global Mojo _ MojoLoader ModifyAssistant LoginUtil TemplateListAssistant ACCOUNT_KIND PalmCall Util RB ChangeLoginAssistant */

var AccountsListWidget = (function () {
	
	var stylesheets = ["stylesheets/accounts-list.css"];
	
	function styleop(op, div, relativePath) {
		var fn;
		if (op === 'load') {
			fn = Mojo.loadStylesheet;
		} else if (op === 'unload') {
			fn = Mojo.unloadStylesheet;
		}
		if (fn) {
			fn(div.ownerDocument, relativePath, MojoLoader.root);
		}
	}
	
	function toggleAppStylesheets(doc, enable) {
		var links = doc.querySelectorAll('link[type="text/css"]');
		var href;
		var libPrefix = "file://" + MojoLoader.root;
		
		// Mojo.Log.error("toggleAppStylesheets len=%d to %s", links.length, !!enable);
		
		for (var i = 0; i < links.length; i++) {
			href = links[i].href;
			if (!(href.indexOf(libPrefix) === 0 || href.match(/\/usr\/palm\/frameworks\/mojo/))) {
				// Mojo.Log.error("toggling %s to %s", href, !!enable);
				links[i].disabled = !enable;
			}
		}
	}
	
	function handleListTap(e) {
		var template, account = _.clone(e.item);
		account.capabilityProviders = account.capabilityProviders.map(_.clone);
		template = Util.getTemplateById(this.templates, account.templateId);
		
		if (this.attrs.handleListTap) {
			this.attrs.handleListTap(account, template);
		} else if (account.templateId === "com.palm.sim") {
			// Push SIM scene
			this.stage.pushScene({
				name: "sim",
				assistantConstructor: SimAssistant,
				templateRoot: MojoLoader.root,
				sceneTemplate: "templates/sim-scene",
				templateModel: account
			}, {
				account: account,
				onSetup: this.disableAppStyles,
				onCleanup: this.enableAppStyles
			});
		} else {			
			this.stage.pushScene({
				name: "modify",
				assistantConstructor: ModifyAssistant,
				templateRoot: MojoLoader.root,
				sceneTemplate: "templates/modify-scene",
				templateModel: account
			}, {
				template: template,
				account: account,
				onSetup: this.disableAppStyles,
				onCleanup: this.enableAppStyles
			});
		}
	}
	
	function handleListAdd(options) {
		var sceneTemplate;
		var selectedTemplates = Util.filterTemplates(this.templates, this.filterBy);
		var capability = this.filterBy && this.filterBy.capability;
		
		if (selectedTemplates.length === 0) {
			
			// TODO: localize this error?  It's more of an invalid software configuration than a user-facing condition
			Mojo.Controller.errorDialog("No services implement this functionality: " + this.filterBy.capability);
			
		} else if (false && selectedTemplates.length === 1) {  // disabled until I can figure out how this works in First Launch
			
			LoginUtil.pushLoginScene(this.stage, selectedTemplates[0], this.templates, capability);
			
		} else {
			sceneTemplate = "templates/";
			if (this.filterBy) {
				sceneTemplate += "template-list-firstlaunch-scene";
			} else {
				sceneTemplate += "template-list-scene";
			}
			
			if (!options) {
				options = {};
			}
			options.filterBy = this.filterBy;
			this.stage.pushScene({
				name: "template-list",
				assistantConstructor: TemplateListAssistant,
				templateRoot: MojoLoader.root,
				sceneTemplate: sceneTemplate
			}, selectedTemplates, this.templates, options, this.disableAppStyles, this.enableAppStyles);
			
		}
	}
	
	function decorateItem(item) {
		var selected, 
		    iconPath,
		    displayText,
		    match,
		    annotated = Util.annotateAccount(item, this.templates);
		_.extend(item, annotated);
		
		if (annotated.icon) {
			iconPath = annotated.icon.loc_32x32;
		}
		
		// displayText is either alias, capability-specific name, or general name
		displayText = annotated.loc_name;
		if (this.filterBy && this.filterBy.capability) {
			selected = this.filterBy.capability;
			match = _.detect(annotated.capabilityProviders, function (cp) {
				return cp.capability === selected;
			});
			if (match) {
				if (match.loc_name) {
					displayText = match.loc_name;
				}
				if (match.icon && match.icon.loc_32x32) {
					iconPath = match.icon.loc_32x32;
				}
			}
		}
		
		if (item.alias) {
			displayText = item.alias;
		}
		
		return {
			displayText: displayText,
			icon_32x32: iconPath
		};
	}
	
	function setupList(that) {
		var ctrl = that.controller,
		    scene = ctrl.scene,
		    div = ctrl.element,
		    listAttrs,
		    listModel;
		
		listAttrs = {
			templates: {
				item: "templates/accounts-list-item",
				empty: "templates/accounts-list-empty"
			},
			templateRoot: MojoLoader.root,
			uniquenessProperty: "_id",
			dataSource: that.dataSource,
			decorator: decorateItem.bind(that)
		};
		
		listModel = {
			listTitle: that.attrs.listTitle
		};
		
		if (listModel.listTitle !== "disabled") {
			listAttrs.templates.container = Mojo.Widget.ListTemplate.GROUP_CONTAINER_TITLE;
			if (!listModel.listTitle) {
				listModel.listTitle = RB.$L("Accounts");
			}
		}
		
		scene.setupWidget(that.listId, listAttrs, listModel);
		ctrl.instantiateChildWidgets(div);
	}
	
	function onServiceFailure(response) {
		Mojo.Controller.errorDialog(JSON.stringify(response));
	}
	
	// wraps 'fetchData' so it doesn't respond to fetch requests until
	// the given future is complete
	function wrapFetch(that, future, dsa) {
		var origFetchData = dsa.fetchData;
		
		dsa.fetchData = function () {
			var fetchArgs = arguments;
			
			future.then(function () {
				var r;
				r = future.result;

				origFetchData.apply(dsa, fetchArgs);

				// set the result again to ensure that future invocations
				// pass through
				future.result = r;
			});
		};
		
		return dsa;
	}
	
	function wrapGetItems(dsa) {
		var origGetItems = dsa.getItemsToRender;
		
		dsa.getItemsToRender = function (memo, callback) {
			function dedupe(items) {
				callback(Util.dedupeByProperty(items, "_id"));
			}
			return origGetItems.call(dsa, memo, dedupe);
		};
		
		return dsa;
	}
	
	function createDataSource(that) {
		var templatesFuture,
			mojodbDsa,
			wrappedDsa,
			result;
		
		mojodbDsa = new Mojo.DataSource.DBDataSourceAssistant({
			kind: ACCOUNT_KIND,
			// orderBy: "alias",
			watch: true,
			makeWhere: Util.createWhere.bind(undefined, that.filterBy)
		});
		
		templatesFuture = PalmCall.call("palm://com.palm.service.accounts/", "listAccountTemplates", {});
		templatesFuture.onError(function (f) {
			onServiceFailure(f.exception);
		});
		templatesFuture.then(function (f) {
			result = f.result;
			that.templates = result.results;
			PalmCall.cancel(f);
			f.result = result;
		});
		
		that.templatesFuture = templatesFuture;
		
		wrappedDsa = wrapFetch(that, templatesFuture, mojodbDsa);
		
		// Specifying an array of capabilities means we have to de-dupe on the JS side.
		// De-duping does not work beyond account list lengths of 500 (one db8 window).
		if (that.filterBy && that.filterBy.capability && _.isArray(that.filterBy.capability)) {
			wrappedDsa = wrapGetItems(wrappedDsa);
		}
		return new Mojo.DataSource(wrappedDsa);
	}
	
	function Widget() {
		this.handleListTap = handleListTap.bind(this);
		this.handleListAdd = handleListAdd.bind(this);
	}
	
	Widget.prototype = {
		setup: function () {
			var ctrl, div, prefix;
			var that = this;
			
			ctrl = this.controller;
			this.attrs = ctrl.attributes || {};
			// var model = ctrl.model;
			div = ctrl.element;
			
			this.scene = ctrl.scene;
			this.stage = ctrl.stageController;
			this.doc = ctrl.document;
			
			// var prefix = scene.makeUniqueElementId();
			prefix = Mojo.View.makeUniqueId() + this.scene.sceneId + div.id;
			
			this.listId = prefix + "-accountslist";
			this.filterBy = this.attrs.filterBy;
			
			div.innerHTML = Mojo.View.render({
				object: {
					prefix: prefix
				},
				templateRoot: MojoLoader.root,
				template: "templates/accounts-list"
			});
				
			this.dataSource = createDataSource(this);
			setupList(this);
			
			stylesheets.forEach(styleop.bind(undefined, 'load', div));
			
			this.controller.exposeMethods(['addAccount']);
			
			this.disableAppStyles = function() {
				toggleAppStylesheets(that.doc, false);
			};
			this.enableAppStyles = function() {
				toggleAppStylesheets(that.doc, true);
			};
			
			if (!this.attrs.disableListTap) {
				this.scene.listen(this.listId, Mojo.Event.listTap, this.handleListTap);
			}
		},
		
		cleanup: function () {
			stylesheets.forEach(styleop.bind(undefined, 'unload', this.controller.element));
			
			if (!this.attrs.disableListTap) {
				this.scene.stopListening(this.listId, Mojo.Event.listTap, this.handleListTap);
			}
		},
		
		addAccount: function () {
			var that = this,
			    args = arguments;
			
			// add requests may come in while waiting for templates
			// enqueue and de-bounce the requests
			if (this.templatesFuture.addPending) {
				return;
			}
			this.templatesFuture.addPending = true;
			this.templatesFuture.then(function (f) {
				var r;
				r = f.result;
				
				that.handleListAdd.apply(that, args);
				f.addPending = undefined;
				f.result = r;
			});
		}
	};

	return Widget;
})();


//@ sourceURL=accounts.ui/changelogin-widget.js

/*global Mojo MojoLoader _ PalmCall multiLogin RB console Foundations AccountError */

var ChangeLoginWidget = (function () {
	
	function Widget() {
		this.password = {};
	}
	
	Widget.prototype = {
		setup: function () {
			var div, prefix;
			
			this.ctrl = this.controller;
			this.attrs = this.ctrl.attributes;
			this.scene = this.ctrl.scene;
			this.stage = this.ctrl.stageController;
			
			this.account = this.attrs.account;
			this.template = this.attrs.template;
			this.done = this.attrs.done;
			
			div = this.ctrl.element;
			prefix = Mojo.View.makeUniqueId() + this.scene.sceneId + div.id;
			
			this.formId = prefix + "-form";
			this.usernameId = prefix + "-username";
			this.passwordId = prefix + "-password";
			this.usernameLabelId = prefix + "-username-label";
			
			div.innerHTML = Mojo.View.render({
				object: {
					prefix: prefix
				},
				templateRoot: MojoLoader.root,
				template: "templates/changelogin"
			});
			
			if (this.template.loc_usernameLabel) {
				this.scene.get(this.usernameLabelId).innerHTML = Foundations.StringUtils.escapeHTML(this.template.loc_usernameLabel);
			}
			
			this.username = {
				value: this.account.username,
				disabled: true
			};
			
			this.scene.setupWidget(this.formId, {
				submitLabel: RB.$L("Sign In"),
				assistant: this
			}, {
				requiredItems: [ this.usernameId, this.passwordId ]
			});

			this.scene.setupWidget(this.usernameId, {}, this.username);
			this.scene.setupWidget(this.passwordId, {}, this.password);
			
			this.ctrl.instantiateChildWidgets(div);
		},
		
		cleanup: function () {
			
		},
		
		validate: function (items, callback) {
			// do any quick validation here for anything beyond simple presence of text
			// (in this case of a simple login, do nothing)
			callback();
		},
		
		defaultAction: function (callback) {
			var that = this, future;
			var options;
			// do the actual login here
			
			this.password.disabled = true;
			this.scene.modelChanged(this.password);
			
			options = {
				accountId: this.account._id
			};
			
			// MapReduce all validators and collect results.
			// If all fail, prevent continuing.
			future = multiLogin(this.account.username, this.password.value, this.template, undefined, options);
			
			future.then(function () {
				var loginResults, toSave, defaultConfig;
				toSave = {
					config: {},
					credentials: {}
				};
				
				loginResults = future.result;
				
				// loginResults has: defaultResult, otherResults
				
				// save the new credentials and configs
				// using modifyAccount with only creds/config passed in
				
				// (but in this case there is no global config from custom UI)
				
				// console.log("success! loginResults=" + JSON.stringify(loginResults, undefined, 2));
				
				// combine credentials and configs
				defaultConfig = loginResults.defaultResult.result.config;
				if (defaultConfig) {
					_.extend(toSave.config, defaultConfig);
				}

				toSave.credentials = loginResults.defaultResult.result.credentials;

				loginResults.otherResults.forEach(function (r) {
					if (r.result) {
						_.extend(toSave.credentials, r.result.credentials);
						_.extend(toSave.config, r.result.config);
					}
				});

				future.nest(PalmCall.call("palm://com.palm.service.accounts/", "modifyAccount", {
					accountId: that.account._id,
					object: toSave,
					suppressNotifications: that.attrs.suppressNotifications
				}));
			});
			
			future.then(function () {
				var result;
				
				try {
					result = future.result;
					callback();
					if (that.done) {
						that.done();
					}
				} catch (e) {
					console.log("**** exception is: " + JSON.stringify(e, undefined, 2));

					that.password.disabled = false;
					that.scene.modelChanged(that.password);
					
					callback({
						globalError: AccountError.getErrorText(e)
					});
				}
			});
		}
	};
	
	return Widget;
})();


//@ sourceURL=accounts.ui/template-list-assistant.js

/*global _ LoginAssistant MojoLoader Mojo LoginUtil Util RB Assert ModifyAssistant */
// Scene to show a list of templates
// INPUT: capability [optional]
var TemplateListAssistant = function (templates, allTemplates, options, onSetup, onCleanup) {
	var scene, stage, listDiv, filterBy, publicMethods, creatingAccount, showDoneButton, swapping;
	var self = this;  // this is about all you can do in the assistant constructor
	
	filterBy = options && options.filterBy;
	showDoneButton = options && options.firstLaunch && !options.requiresAnAccount;

	function handleTap(e) {
		var template = e.item;
		// console.log("got tap on item: " + JSON.stringify(template));
		LoginUtil.pushLoginScene(stage, template, allTemplates, filterBy && filterBy.capability);
	}
	
	function handleDone() {
		// need to pop this scene and the 'existing accounts' scene underneath
		// to exit the first launch flow
		stage.popScene();
		stage.popScene();
		if (options.done) {
			options.done();
		}
	}
	
	function handleFindMore() {
		var findMoreOptions,
		    titleTemplate,
		    types,
		    titleModel;
		
		if (filterBy && filterBy.capability) {
			types = filterBy.capability;
			if (!_.isArray(types)) {
				types = [types];
			}
		} else {
			// default synergy types when none specified (e.g. Accounts app)
			types = ["CALENDAR", "CONTACTS", "MESSAGING", "MAIL"];
		}
		
		findMoreOptions = {
			sublaunch: true,
			type: "connector",
			connectorInfo: {
				types: types,
				searchBarIcon: Mojo.appPath + Mojo.appInfo.icon
			}
		};
		
		if (options && options.findMoreDisplayText) {
			findMoreOptions.connectorInfo.searchBarTitle = options.findMoreDisplayText;
		} else {
			titleTemplate = new Mojo.Format.Template(RB.$L("#{capability} Synergy Services"));
			titleModel = {};
			if (filterBy && filterBy.capability) {
				titleModel.capability = Util.getCapabilityText(filterBy.capability);
			}
			findMoreOptions.connectorInfo.searchBarTitle = titleTemplate.evaluate(titleModel);
		}
		
		stage.pushScene({
			appId: "com.palm.app.findapps",
			name: "search"
		}, findMoreOptions);
	}
	
	function decorateItem(item) {
		var displayText = item.loc_name,
		    iconPath;
		
		if (item.icon) {
			iconPath = item.icon.loc_32x32;
		}
		
		return {
			displayText: displayText,
			icon_32x32: iconPath
		};
	}
	
	publicMethods = {
		setup: function () {
			var titleText;
			
			scene = self.controller;
			stage = scene.stageController;
			

			// Hide the spinner
			Mojo.Dom.hide(scene.get("spinner-container"));

			listDiv = scene.get("templates-list");
			
			if (filterBy) {
				if (options && options.displayText) {
					titleText = options.displayText;
				} else {
					var titleTemplate = new Mojo.Format.Template(RB.$L("New #{capability} Account"));
					titleText = titleTemplate.evaluate({
						"capability": Util.getCapabilityText(filterBy.capability)
					});
				}
				
				scene.get("templates-firstlaunch-header").innerHTML = Mojo.View.render({
					templateRoot: MojoLoader.root,
					template: "templates/header",
					object: {
						title: titleText,
						iconPath: Mojo.Controller.appInfo.icon
					}
				});
				
				// This logic decides when to hide the 'Find More' button. It's a
				// little bit complicated:
				//
				// 1. If a templateId is provided, always hide the 'Find More'
				//    button (such as in Facebook).
				// 2. Otherwise, hide the button when the 'showFindMore' flag is
				//    not passed and the requested capability does not match the
				//    whitelist.
				var whitelisted = _.include(["CALENDAR", "CONTACTS", "MESSAGING", undefined],
					filterBy.capability);
				if (filterBy.templateId || !(filterBy.showFindMore || whitelisted)) {
					Mojo.Dom.hide(scene.get("findmore"));
				}
				
				if (showDoneButton) {
					scene.setupWidget("templates-done-button", {
						label: RB.$L("Done")
					}, {
						buttonClass: "affirmative"
					});
					
					if (scene.document.getElementsByClassName("no-button")[0]) {
						scene.get("templates-container").className = "";
					}
				}
			}
			
			scene.setupWidget("templates-list", {
				templates: {
					item: "templates/template-list-item"
				},
				templateRoot: MojoLoader.root,
				uniquenessProperty: "templateId",
				dataSource: new Mojo.DataSource(new Mojo.DataSource.LocalDataSourceAssistant(templates)),
				decorator: decorateItem
			});
			
			if (onSetup) {
				onSetup();
			}
			
		},
		
		handleCommand: function (e) {
			if (e.type === Mojo.Event.back) {
				if (creatingAccount) {
					Mojo.Event.stop(e);
				} else if (options && options.requiresAnAccount) {
					Mojo.Event.stop(e);
					stage.deactivate();
				}
			}
		},
		
		cleanup: function() {
			if (onCleanup && !swapping) {
				onCleanup();
			}
		},
		
		activate: function (result) {
			scene.listen(listDiv, Mojo.Event.listTap, handleTap);
			if (showDoneButton) {
				scene.listen("templates-done-button", Mojo.Event.tap, handleDone);
			}
			scene.listen("findmore", Mojo.Event.tap, handleFindMore);

			if (result) {
				if (result.publicApplicationId) {
					
					Mojo.Dom.show(scene.get("templates-container"));
					
					// TODO: need to refresh templates.  Calling scene should not pass a list of templates
					// directly... should be a handle that allows refetch for both caller and this scene.
					
				} else {
					// console.log("****** got validator result: " + JSON.stringify(result, undefined, 2));

					Mojo.Dom.show(scene.get("spinner-container"));
					creatingAccount = true;
					
					// Validator MUST ONLY return valid results (i.e. defaultResult must be populated)
					// In failure cases, the validator should not return at all. The user can still
					// 'back' out.

					// result has: template, username, defaultResult [, otherResults] [, config]

					// prereq: validator must return (template, username, defaultResult [, otherResults] [,config])
					// 1. possibly finish validation by running through other validators
					// 2. glue all resultObj{item{id}, returnValue, errorCode, credentials, config}.
					// 3. createAccount(templateId, username, [no capability providers], credentials, config)
					// 4. to send to modify scene: (accountId, defaultResult, otherResults)

					Assert.require(result.template && result.template.templateId, "missing template/templateId");
					Assert.require(result.defaultResult, "missing defaultResult object");
					Assert.require(result.defaultResult.result, "missing defaultResult's valid result");
					Assert.require(result.defaultResult.result.returnValue, "defaultResult returned false");
					Assert.require(result.username, "missing username");
					
					swapping = true;
					stage.swapScene({
						// transition: Mojo.Transition.none,
						name: "modify",
						assistantConstructor: ModifyAssistant,
						templateRoot: MojoLoader.root,
						sceneTemplate: "templates/modify-scene",
						templateModel: result.template
					}, {
						template: result.template,
						postCreate: result,
						requestedCapability: (filterBy && filterBy.capability),
						onCleanup: onCleanup
					});
					
				}
			} else {
				Mojo.Dom.show(scene.get("templates-container"));
				creatingAccount = false;
			}
		},
		
		deactivate: function () {
			scene.stopListening(listDiv, Mojo.Event.listTap, handleTap);
			if (showDoneButton) {
				scene.stopListening("templates-done-button", Mojo.Event.tap, handleDone);
			}
			scene.stopListening("findmore", Mojo.Event.tap, handleFindMore);
			
			Mojo.Dom.hide(scene.get("templates-container"));
			Mojo.Dom.hide(scene.get("spinner-container"));
		}
	};
	
	_.extend(this, publicMethods);
};


//@ sourceURL=accounts.ui/login-assistant.js

/*global Mojo multiLogin _ RB AccountError console Foundations */
// Default scene to prompt for and validate credentials
// INPUT: template
// OUTPUT: template, username, resultsMap (validatorId->result), config
// If all validators fail, error out and prevent continuing the flow.
// Otherwise, pass the validator results over in resultsMap (each result
// should include returnValue, credentials, config)
var LoginAssistant = function (template, capability) {
	var scene;
	var stage;
	var login = {};
	var formHandler;
	var formModel;
	var defaultSubmitLabel = RB.$L("Sign in");
	var self = this;  // this is about all you can do in the assistant constructor
	
	function setup() {
		scene = self.controller;
		stage = scene.stageController;
		
		if (template.loc_usernameLabel) {
			scene.get("login-username-label").innerHTML = Foundations.StringUtils.escapeHTML(template.loc_usernameLabel);
		}
		
		formModel = {
			submitLabel: defaultSubmitLabel,
			requiredItems: [ "login-username", "login-password" ]
		};
		
		scene.setupWidget("login-form", {
			assistant: formHandler
		}, formModel);
		
		["username", "password"].forEach(function (s) {
			scene.setupWidget("login-" + s, {
				autoReplace: false,
				modelProperty: s,
				textCase: Mojo.Widget.steModeLowerCase
			}, login);
		});
	}
	
	function onButtonActivate() {
		formModel.submitLabel = RB.$L("Signing in...");
		scene.modelChanged(formModel);
		
		login.disabled = true;
		scene.modelChanged(login);
	}
	
	function onButtonDeactivate() {
		formModel.submitLabel = defaultSubmitLabel;
		scene.modelChanged(formModel);
		
		login.disabled = false;
		scene.modelChanged(login);
	}
	
	formHandler = {
		validate: function (items, callback) {
			// console.log("validator got values: " + JSON.stringify(items));
			// console.log("but internally, my model is: " + JSON.stringify(login));
			
			// do any quick validation here for anything beyond simple presence of text
			// (in this case of a simple login, do nothing)
			callback();
		},
		
		defaultAction: function (callback) {
			// do the actual login here
			var future;
			
			onButtonActivate();
			
			// MapReduce all validators and collect results.
			// If all fail, prevent continuing.
			future = multiLogin(login.username, login.password, template);
			
			future.then(function () {
				var loginResults;
				var username;
				var alias;
				var r;
				var matchingProvider;
				var matchingResult;
				
				try {
					loginResults = future.result;
					
					// reject any logins where the asked-for capability would not work because its validator failed.
					if (capability) {
						matchingProvider = _.detect(template.capabilityProviders, function(cp) {
							return capability === cp.capability;
						});
						if (matchingProvider && matchingProvider.validator) {
							matchingResult = _.detect(loginResults.otherResults, function(result) {
								return matchingProvider.validator === result.item.validator;
							});
							if (matchingResult) {
								if (matchingResult.exception) {
									throw matchingResult.exception;
								} else {
									// there was a validator, and it passed!
								}
							} else {
								// missing a matching result is a problem
								// (although mapReduce ensures this should never happen...)
								throw { errorCode: "UNSUPPORTED_CAPABILITY" };
							}
						}
					}
					
					callback();
					
					// allow default validator to normalize username and supply an alias
					username = login.username;
					if (loginResults.defaultResult && loginResults.defaultResult.result) {
						r = loginResults.defaultResult.result;
						if (r.returnValue) {
							if (r.username) {
								username = r.username;
							}
							if (r.alias) {
								alias = r.alias;
							}
						}
					}
					stage.popScene({
						template: template,
						username: username,
						alias: alias,
						defaultResult: loginResults.defaultResult,
						otherResults: loginResults.otherResults
					});
				} catch (e) {
					console.log("**** account login exception is: " + JSON.stringify(e, undefined, 2));

					onButtonDeactivate();
					callback({
						globalError: AccountError.getErrorText(e)
					});
				}
			});
		}
	};
	
	_.extend(this, {
		setup: setup
	});
};


//@ sourceURL=accounts.ui/modify-assistant.js

/*global MojoLoader Mojo ChangeLoginAssistant _ PalmCall Foundations Util RB console exports $L PostLogin */

// when modifying an existing account, the providers list consists of ALL template
// providers with the currently-enabled subset enabled.
// 'postCreate' is a special flag the create flow would pass in to select all providers
// by default and show a 'Done' button
var ModifyAssistant = exports.ModifyAssistant = function (params) {
	var scene, stage, providersModel;
	var listAccountsFuture;
	var unsupportedDialog;
	var doneModel, removeModel;
	var saving = false, saved = false;
	var self = this;
	var template = params.template;
	var account = params.account;
	var postCreate = params.postCreate;
	var requestedCapability = params.requestedCapability;
	var allDisabled = (template && template.templateId === "com.palm.palmprofile");  // don't touch Palm Profile accounts
	
	function isValidatorMatch(result) {
		return this.validator === result.item.validator;
	}
	
	function processPostCreateResults(providersModel) {
		var brokenCapabilities = [];
		var message, messageTemplate;
		
		providersModel.forEach(function (p) {
			var match;
			if (p.validator) {
				match = _.detect(postCreate.otherResults, isValidatorMatch, p);
				if (match && match.result) {
					p.selected = true;
				} else {
					p.selected = false;
					p.disabled = true;
					brokenCapabilities.push(Util.getCapabilityText(p.capability));
				}
			} else {
				p.selected = true;
			}
		});
		
		if (brokenCapabilities.length > 0) {
			if (brokenCapabilities.length === 1) {
				messageTemplate = new Mojo.Format.Template(RB.$L("Your account is not configured for #{capability}."));
				message = messageTemplate.evaluate({
					capability: brokenCapabilities[0]
				});
			} else {
				brokenCapabilities = brokenCapabilities.map(function(line) {
					return ["<li>", line, "</li>"].join("");
				});
				brokenCapabilities.unshift(RB.$L("Your account is not configured for the following kinds of service:"), "<ul>");
				brokenCapabilities.push("</ul>");
				message = brokenCapabilities.join("");
			}
			
			unsupportedDialog = {
				title: RB.$L("Service Not Supported"),
				allowHTMLMessage: true,
				message: message,
				choices: [{ label: RB.$L("OK"), value: "ok", type: "dismiss" }],
				onChoose: function() {
					
				},
				preventCancel: true
			};
		}
	}
	
	function setup() {
		var validator;
		var hasValidatorService;
		
		scene = self.controller;
		stage = scene.stageController;
		
		if (postCreate) {
			// stub account.  the real thing is created upon exit from this scene in the 'postCreate' case.
			account = {
				capabilityProviders: []
			};

			// fetch a list of all accounts early so PostLogin has something to go by immediately.
			// (PostLogin has to work in one pass because it can be called as the app is swiped closed)
			// PostLogin will fail if called before this returns, so chain them up.
			listAccountsFuture = PalmCall.call("palm://com.palm.service.accounts/", "listAccounts", {});
		}
		
		// Account template is not available on this device - let user delete the account
		if(_.isUndefined(template)) {
			// Hide info
			Mojo.Dom.hide(scene.get('account-info'));
			
			removeModel = {
				buttonClass: "negative",
				disabled: false
			};
			scene.setupWidget("modify-remove", {
				label: RB.$L("Remove account"),
				type: Mojo.Widget.activityButton
			}, removeModel);
						
			scene.setupWidget("modify-changelogin", {
				label: RB.$L("Change login settings")
			}, {
				disabled: true
			});
			
			scene.setupWidget("modify-alias", { }, {
				value: account.alias || "",
				disabled: true
			});
			
		} else {
			// Hide missing template
			Mojo.Dom.hide(scene.get('missing-template'));
			
			providersModel = self.setupProviders(template, account);
			if (postCreate) {
				processPostCreateResults(providersModel);
			}
			providersModel.forEach(function (p) {
				if (allDisabled || p.alwaysOn || p.capability === requestedCapability) {
					p.disabled = true;
				}
			});
			
			// prevent a singleton capability on accounts with only one possible capability from being turned off
			if (providersModel.length === 1 && providersModel[0].selected) {
				providersModel[0].disabled = true;
			}
			
			account.originalAlias = account.alias;
			
			if (!account.alias) {
				if (postCreate && postCreate.alias) {
					account.alias = postCreate.alias;
				} else {
					account.alias = template.loc_name;
				}
			}
			
			account.disabled = allDisabled;
			scene.setupWidget("modify-alias", {
				autoReplace: false,
				modelProperty: "alias"
			}, account);
			
			scene.setupWidget("provider-listtoggle", {
				modelProperty: "selected"
			});
			
			scene.setupWidget("modify-providers", {
				templateRoot: MojoLoader.root,
				itemTemplate: "templates/provider-listitem"
			}, {
				items: providersModel
			});
			
			if (postCreate) {
				doneModel = {
					buttonClass: "affirmative",
					disabled: allDisabled
				};
				scene.setupWidget("modify-done", {
					label: RB.$L("Create"),
					type: Mojo.Widget.activityButton
				}, doneModel);
				
				//removing 'with-2-buttons' class
				var scrollerDiv = scene.get('add-account-scroller-div');
				var shadowDiv = scene.get('modify-account-shadow-div');
				scrollerDiv.className = 'account-scroller'; 
				shadowDiv.className = 'modify-account-scroller-shadow';
			} else {
				removeModel = {
					buttonClass: "negative",
					disabled: allDisabled || template.disableRemove
				};
				scene.setupWidget("modify-remove", {
					label: RB.$L("Remove account"),
					type: Mojo.Widget.activityButton
				}, removeModel);
				
				validator = template.validator;
				hasValidatorService = validator && (typeof validator === "string" || validator.address);
				
				scene.setupWidget("modify-changelogin", {
					label: RB.$L("Change login settings")
				}, {
					// disable change login button if there is no validator service call to make
					disabled: allDisabled || !hasValidatorService
				});
			}
		}
		if (params.onSetup) {
			params.onSetup();
		}
	}
	
	function handleModifyFail(e) {
		return new Foundations.Control.Future().now(function (f) {
			console.log("**** modify account failed: " + JSON.stringify(e.innerError, undefined, 2));
			scene.showAlertDialog({
				title: RB.$L("Error"),
				message: [e.errorCode, "(", e.message, ")"].join(' '),  // FIXME: need to localize this, service should return error code, not text
				choices: [{ label: RB.$L("OK"), value: "ok", type: "dismiss" }],
				onChoose: function () {
					f.result = undefined;
				},
				preventCancel: true
			});
		});
	}
	
	function handleModifySuccess() {
		console.log("**** account modified!");
	}
	
	function handleSave(done) {
		saving = true;

		var toSave = {},
		    providers = [],
		    providersDirty = false,
		    future;
		
		// console.log("account model: " + JSON.stringify(account, undefined, 2));
		// console.log("providers model: " + JSON.stringify(providersModel, undefined, 2));
		
		providersModel.forEach(function (p) {
			if (p.selected) {
				providers.push({ id: p.id });
			}
			if (!providersDirty && p.selected !== p.enabled) {
				providersDirty = true;
			}
		});
		
		if (account.alias !== account.originalAlias) {
			toSave.alias = account.alias;
		}
		
		if (providersDirty) {
			toSave.capabilityProviders = providers;
		}
		
		if (!postCreate && _.isEmpty(toSave)) {
			done();
			return;
		}
		
		saved = true;
		
		// console.log("SAVING: " + JSON.stringify(toSave, undefined, 2));
		if (postCreate) {
			
			listAccountsFuture.then(function(f) {
				PostLogin.createAccount(scene, postCreate, requestedCapability, toSave, f.result.results);
			});
			
		} else {
			future = PalmCall.call("palm://com.palm.service.accounts/", "modifyAccount", {
				accountId: account._id,
				object: toSave
			});

			future.then(function () {
				var result;

				try {
					result = future.result;
					handleModifySuccess();
					future.result = undefined;
				} catch (e) {
					future.nest(handleModifyFail(e));
				}
				future.then(done);
			});
		}
	}

	function providerToggled(event) {
		// The `enabled' property corresponds with the original value of the
		// toggle button. The `selected' property represents the new value
		// after toggling the button.
		//
		// We want the alert when the button was initially enabled, but it is
		// being disabled.
		if (event.model.enabled && !event.model.selected) {
			scene.showBanner({
				messageText: RB.$L("This data will be deleted"),
				icon: MojoLoader.root + "images/banner-warning-icon.png"
			});
		}
	}
	
	function done() {
		// Only disable the 'Done' button if it exists.
		if (doneModel) {
			doneModel.disabled = true;
			scene.modelChanged(doneModel);
			scene.get("modify-done").mojo.activate();
		}

		if (!saving) {
			handleSave(function() {
				stage.popScene();
			});
		}
	}
	
	function handleRemoveComplete() {
		scene.get("modify-remove").mojo.deactivate();
	}
	
	function handleRemoveFail(response) {
		console.log("**** delete account failed: " + JSON.stringify(response, undefined, 2));
		stage.popScene();
	}
	
	function handleRemoveSuccess() {
		console.log("**** account removed!");
		stage.popScene();
	}

	function handleDeleteConfirmation(value) {
		if (value !== "remove") {
			scene.get("modify-remove").mojo.deactivate();
		} else {
			removeModel.disabled = true;
			scene.modelChanged(removeModel);
			
			scene.serviceRequest("palm://com.palm.service.accounts", {
				method: "deleteAccount",
				parameters: {
					accountId: account._id
				},
				onSuccess: handleRemoveSuccess,
				onFailure: handleRemoveFail,
				onComplete: handleRemoveComplete
			});
		}
	}
	
	function handleRemove() {
		scene.showAlertDialog({
			onChoose: handleDeleteConfirmation,
			title: RB.$L("Remove account"),
			preventCancel: true,
			message: RB.$L("Are you sure you want to remove this account and all associated data from your device?"),
			choices: [
				{label: RB.$L("Remove Account"), value: "remove",  type: 'negative'},
				{label: RB.$L("Keep Account"),   value: "keep", type: 'color'}
			]
		});
	}
	
	function handleChangeLogin() {
		stage.pushScene({
			name: "changelogin",
			assistantConstructor: ChangeLoginAssistant,
			templateRoot: MojoLoader.root,
			sceneTemplate: "templates/changelogin-scene",
			templateModel: account
		}, template, account);
	}
	
	function activate() {
		scene.listen("modify-providers", Mojo.Event.propertyChange, providerToggled);

		scene.listen("modify-done", Mojo.Event.tap, done);
		scene.listen("modify-remove", Mojo.Event.tap, handleRemove);
		scene.listen("modify-changelogin", Mojo.Event.tap, handleChangeLogin);
		
		if (unsupportedDialog) {
			scene.showAlertDialog(unsupportedDialog);
			unsupportedDialog = undefined;
		}
	}
	
	function deactivate() {
		scene.stopListening("modify-providers", Mojo.Event.propertyChange, providerToggled);

		scene.stopListening("modify-done", Mojo.Event.tap, done);
		scene.stopListening("modify-remove", Mojo.Event.tap, handleRemove);
		scene.stopListening("modify-changelogin", Mojo.Event.tap, handleChangeLogin);
	}
	
	function cleanup() {
		if (template && !saving && !saved) {
			// probably won't get a chance to do anything upon service request completion
			// if the card is being closed
			handleSave(Mojo.doNothing);
		}
		
		if (params.onCleanup) {
			params.onCleanup();
		}
	}
	
	function handleCommand(e) {
		if (e.type === Mojo.Event.back) {
			Mojo.Event.stop(e);

			if(_.isUndefined(template)) {
				stage.popScene();
			} else if (!saving) {
				done();
			}
		}
	}
	
	_.extend(this, {
		setup: setup,
		activate: activate,
		deactivate: deactivate,
		cleanup: cleanup,
		handleCommand: handleCommand
	});
};

// model is an array of providers. 'selected' for display toggle model.  'enabled' for current
// model state.  on submit, overwrite account with the new selected subset.

ModifyAssistant.prototype.setupProviders = function (template, account) {
	return template.capabilityProviders.map(function (cp) {
		var result = _.clone(cp);
		result.displayText = Util.getCapabilityText(result.capability);
		result.enabled = ((_.pluck(account.capabilityProviders, "id")).indexOf(cp.id) !== -1);
		result.selected = result.enabled;
		return result;
	});
};


//@ sourceURL=accounts.ui/sim-assistant.js

/*global Future MojoLoader Mojo ChangeLoginAssistant _ PalmCall Foundations Util RB console exports $L PostLogin */

// New Sim Scene UI
// Display the Phone Number if available or the IMSI/username otherwise
// Show Special text for Removed Sim accounts and the "Remove Sim Account" button
var SimAssistant = exports.SimAssistant = function (params) {
	var scene, stage,
		self = this, 
		account = params.account;
	
	function getSimContactCount() {
		
		var future = PalmCall.call("palm://com.palm.db", "find", {
			query: {
				from: "com.palm.contact:1",
				where: [ { prop: "accountId", op: "=", val: account._id } ]
			}, 
			count: true
		});
		future.then(self, function() {
			var result = future.result;
			if(result && (result.count || result.count === 0)) {
				var template = RB.$L("0#No Contacts|1#1 Contact|2>##{count} Contacts");
				var message = Mojo.Format.formatChoice(result.count, template, {count: result.count});
				
				scene.get('simContactCount').innerText = message;
				Mojo.Dom.show(scene.get('simContactGroup'));
			}
		});
	}
	
	function getPhoneNumber() {
		
		var future = PalmCall.call("palm://com.palm.service.contacts.sim", "getSimInfo", {
			accountId: account._id
		});
		future.then(self, function () {
			var result = future.result;
			Mojo.Dom.hide(scene.get('pleaseWait'));
			if(result.phoneNumber && result.phoneNumber.length > 0) {
				scene.get('phoneIdLabel').innerText = RB.$L("phone number");
				scene.get('phoneId').innerText = Globalization.Format.formatPhoneNumber(Globalization.Phone.parsePhoneNumber(result.phoneNumber));
			} else {
				scene.get('phoneIdLabel').innerText = RB.$L("SIM ID");
				scene.get('phoneId').innerText = account.rawUsername || account.username;
			}
		});
	}
	
	function setup() {
		scene = self.controller;
		stage = scene.stageController;
		
		// Please wait - Getting info
		scene.setupWidget('pleaseWait', { spinnerSize: "small" }, { spinning: true });
		scene.get('phoneIdLabel').innerText = "";
		scene.get('phoneId').innerText = RB.$L("Getting info...");
		
		// Setup the REMOVED SIM text info
		scene.get('simTitle').innerText = RB.$L("SIM is removed");
		scene.get('simText').innerText = RB.$L("The data is still in your phone, but can't be edited. You can edit data and add new contacts after you re-insert the SIM.");

		// Setup the Remove Account button
		scene.setupWidget('removeAccountButton', {
			type: Mojo.Widget.activityButton
		}, self.removeModel = {
			label : RB.$L('Remove account'),
			disabled: false,
			buttonClass: "negative"
		});
		
		// If the SIM account cannot be removed, hide text and button
		if (account.disableRemove) {
			Mojo.Dom.hide(scene.get('sim'));
			Mojo.Dom.hide(scene.get('removeAccountButton'));
		}
		
		getPhoneNumber();
		getSimContactCount();
	}
	
	function handleRemoveComplete() {
		scene.get("removeAccountButton").mojo.deactivate();
	}
	
	function handleRemoveFail(response) {
		console.log("**** Delete SIM account failed: " + JSON.stringify(response, undefined, 2));
		stage.popScene();
	}
	
	function handleRemoveSuccess() {
		console.log("**** SIM account removed!");
		stage.popScene();
	}

	function handleDeleteConfirmation(value) {
		if (value !== "remove") {
			scene.get("removeAccountButton").mojo.deactivate();
		} else {
			self.removeModel.disabled = true;
			scene.modelChanged(self.removeModel);
			
			scene.serviceRequest("palm://com.palm.service.accounts", {
				method: "deleteAccount",
				parameters: {
					accountId: account._id
				},
				onSuccess: handleRemoveSuccess,
				onFailure: handleRemoveFail,
				onComplete: handleRemoveComplete
			});
		}
	}
	
	function handleRemove() {
		scene.showAlertDialog({
			onChoose: handleDeleteConfirmation,
			title: RB.$L("Remove account"),
			preventCancel: true,
			message: RB.$L("Are you sure you want to remove this account and all associated data from your device?"),
			choices: [
				{label: RB.$L("Remove Account"), value: "remove",  type: 'negative'},
				{label: RB.$L("Keep Account"),   value: "keep", type: 'color'}
			]
		});
	}
	
	function activate() {
		scene.listen("removeAccountButton", Mojo.Event.tap, handleRemove);
	}
	
	function deactivate() {
		scene.stopListening("removeAccountButton", Mojo.Event.tap, handleRemove);
	}
	
	function cleanup() {
		if (params.onCleanup) {
			params.onCleanup();
		}
	}
	
	_.extend(this, {
		setup: setup,
		activate: activate,
		deactivate: deactivate,
		cleanup: cleanup
	});
};


//@ sourceURL=accounts.ui/changelogin-assistant.js

/*global Mojo MojoLoader _ exports */
var ChangeLoginAssistant = exports.ChangeLoginAssistant = function (template, account, finishHandler) {
	var scene, stage, self = this;
	
	function formComplete() {
		if (finishHandler) {
			finishHandler();
		} else {
			stage.popScene();
		}
	}
	
	var publicMethods = {
		setup: function() {
			scene = self.controller;
			stage = scene.stageController;
			
			// console.log("change login scene got template: " + JSON.stringify(template, undefined, 2));
			// console.log("change login scene got acct: " + JSON.stringify(account, undefined, 2));
			
			scene.setupWidget("changelogin-form", {
				account: account,
				template: template,
				templateRoot: MojoLoader.root,
				done: formComplete
			});
		},

		handleCommand: function(e) {
			if (e.type === Mojo.Event.back && finishHandler) {
				finishHandler();
				Mojo.Event.stop(e);
			}
		}
	};
	
	_.extend(this, publicMethods);
};


//@ sourceURL=accounts.ui/firstlaunch-assistant.js

/*global _ Mojo MojoLoader exports PalmCall TemplateListAssistant Util RB */

function FirstLaunchAssistant(options) {
	
	var scene, stage, accountsList, publicMethods;
	
	function handleAdd() {
		if (accountsList && accountsList.mojo) {
			accountsList.mojo.addAccount(options);
		}
	}
	
	function handleDone() {
		stage.popScene();
		if (options.done) {
			options.done();
		}
	}
	
	publicMethods = {
		setup: function () {
			scene = this.controller;
			stage = scene.stageController;
			
			Mojo.require(Mojo.Widget.AccountsList, "Error: AccountsList widget missing; client app has not yet called lib.enableExtensions()");
			
			accountsList = scene.get("firstlaunch-list");
			
			var titleText,
			    model = {},
			    titleTemplate = new Mojo.Format.Template(RB.$L("Your #{capability} Accounts"));
			
			if (options.displayText) {
				model.capability = options.displayText;
				titleText = options.displayText;
			} else {
				model.capability = Util.getCapabilityText(options.filterBy.capability);
				titleText = titleTemplate.evaluate(model);
			}
			
			
			scene.get("firstlaunch-header").innerHTML = Mojo.View.render({
				templateRoot: MojoLoader.root,
				template: "templates/header",
				object: {
					title: titleText,
					iconPath: Mojo.Controller.appInfo.icon
				}
			});

			scene.setupWidget("firstlaunch-list", {
				filterBy: options.filterBy,
				listTitle: "disabled",
				disableListTap: true
				// TODO: set more options to customize appearance and behavior
				// disable tap handling
				// custom item template and decorator
			});
			
			scene.setupWidget("firstlaunch-add-button", {
				label: RB.$L("Add An Account")
			});
			scene.setupWidget("firstlaunch-done-button", {
				label: RB.$L("Done")
			}, {
				buttonClass: "affirmative"
			});
		},
		
		activate: function () {
			scene.listen("firstlaunch-add-button", Mojo.Event.tap, handleAdd);
			scene.listen("firstlaunch-done-button", Mojo.Event.tap, handleDone);
		},
		
		deactivate: function () {
			scene.stopListening("firstlaunch-add-button", Mojo.Event.tap, handleAdd);
			scene.stopListening("firstlaunch-done-button", Mojo.Event.tap, handleDone);
		}
	};
	
	_.extend(this, publicMethods);
}

exports.FirstLaunch = {
	pushFirstLaunch: function (stage, options) {
		var allTemplates, future;
		
		Mojo.require(options && options.filterBy, "FirstLaunch requires a filterBy object");
		
		// first query for matching accounts before deciding
		// whether to push two scenes or just one
		future = PalmCall.call("palm://com.palm.service.accounts/", "listAccountTemplates", {});
		future.then(function () {
			allTemplates = future.result.results;
			future.nest(PalmCall.call("palm://com.palm.service.accounts/", "listAccounts", options.filterBy));
		});
		future.then(function () {
			var accounts = future.result.results,
			    selectedTemplates;
			
			options.firstLaunch = true;
			
			stage.pushScene({
				name: "firstlaunch",
				assistantConstructor: FirstLaunchAssistant,
				templateRoot: MojoLoader.root,
				sceneTemplate: "templates/firstlaunch-scene"
			}, options);
			
			// TODO: ignore accounts with template=LOCAL
			if (accounts.length === 0) {
				selectedTemplates = Util.filterTemplates(allTemplates, options.filterBy);
				
				stage.pushScene({
					name: "template-list",
					assistantConstructor: TemplateListAssistant,
					templateRoot: MojoLoader.root,
					sceneTemplate: "templates/template-list-firstlaunch-scene"
				}, selectedTemplates, allTemplates, options);
			}
		});
	}
};


//@ sourceURL=accounts.ui/epilogue.js

/*global exports root AccountsListWidget ChangeLoginWidget */
exports.enableExtensions = function() {
	var widgets = {
		AccountsList: AccountsListWidget,
		ChangeLoginForm: ChangeLoginWidget
	};
	
	root._.extend(root.Mojo.Widget, widgets);
};


//@ sourceURL=accounts.ui/capabilities.json

[
	{
		"capability": "MAIL",
		"loc_name": "Email"
	},
	{
		"capability": "CALENDAR",
		"loc_name": "Calendar"
	},
	{
		"capability": "CONTACTS",
		"loc_name": "Contacts"
	},
	{
		"capability": "REMOTECONTACTS",
		"loc_name": "Address Lookup"
	},
	{
		"capability": "TASKS",
		"loc_name": "Tasks"
	},
	{
		"capability": "MEMOS",
		"loc_name": "Memos"
	},
	{
		"capability": "MESSAGING",
		"loc_name": "Messaging"
	},
	{
		"capability": "VOICE",
		"loc_name": "Phone"
	},
	{
		"capability": "SMS",
		"loc_name": "Text Messaging"
	},
	{
		"capability": "IM",
		"loc_name": "Instant Messaging"
	},
	{
		"capability": "PHOTO.UPLOAD",
		"loc_name": "Photo Upload"
	},
	{
		"capability": "VIDEO.UPLOAD",
		"loc_name": "Video Upload"
	},
	{
		"capability": "DOCUMENTS",
		"loc_name": "Documents"
	}
]

}