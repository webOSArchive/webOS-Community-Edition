/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, Assert, Mojo, _, console, Person, PhoneNumber, EmailAddress, IMAddress, Utils, 
Future, MojoLoader, PalmCall, Foundations */

var ListWidget = exports.ListWidget = (function () {
	
	var rcsAccounts, queryKeepAlive;
		
	// returns a future that will contain the list of rcs contacts accounts
	function getRcsAccounts() {
		var future, collect;
		
		// CASE: not initialized yet
		if (rcsAccounts === undefined) {
			future = new Future();
			
			collect = function (accounts) {
				var firstResponse = (rcsAccounts === undefined); // collect is called on each subscription update
				rcsAccounts = [];
				accounts.forEach(function (account) {
					account.capabilityProviders.forEach(function (capabilityProvider) {
						if (capabilityProvider.capability === "REMOTECONTACTS") {
							rcsAccounts.push(capabilityProvider);
							capabilityProvider.accountId = account._id;
							//console.log("adding remote contacts account: " + JSON.stringify(capabilityProvider)); // todo remove
						}
					});
				});
				if (firstResponse) {
					future.result = rcsAccounts;
				}
			};
			
			future.now(function () {
				var AccountsLib = MojoLoader.require({name: "accounts.ui", version: "1.0"})["accounts.ui"];
				queryKeepAlive = AccountsLib.AccountsList.listAccounts(collect, {
					filterBy: {
						capability: "REMOTECONTACTS"
					},
					subscribe: true
				});
			});
			
			return future;
			
		// CASE: accounts initialized
		} else {
			return new Future(rcsAccounts);
		}
	}
	
	return {
		
		/**
		 * Returns a configured DBDataSourceAssistant.  This function can only be called from inside a mojo app
		 * that has access to the Mojo framework
		 * @param {Object} params	{
		 *								selectFn: {Function}
		 *								favoritesOnly: {boolean},
		 *								excludeFavorites: {boolean}
		 *					}
		 */
		getTypedownDBDataSourceAssistant: function (params) {
			Assert.requireDefined(Mojo, "ListWidget.getTypedownDBDataSourceAssistant requires the mojo framework to be loaded");
			
			params = params || {};
			
			var dsaParams = {
					kind: "com.palm.person:1",
					select: params.select || undefined, //TODO: replace undefined with the correct array for the app list
					makeWhere: function (filterString) {
						var requirements = [],
							favoriteQueryValue;
						
						//set up favoriteQueryValue as a three-valued variable: { true, false, undefined }
						if (params.favoritesOnly) {
							favoriteQueryValue = true;
						} else if (params.excludeFavorites) {
							favoriteQueryValue = false;
						}
						
						if (filterString) {
							//add the typedown search
							requirements.push({
								prop: "searchProperty",
								op: "?",
								val: filterString,
								collate: "primary"
							});
							
							//when doing a search, we use both items in an array so we can use the same index for 
							//normal list view and favorites list view
							if (favoriteQueryValue === undefined) {
								favoriteQueryValue = [true, false];
							}
						}
						
						if (favoriteQueryValue !== undefined) {
							requirements.push({
								prop: "favorite",
								op: "=",
								val: favoriteQueryValue
							});
						}
						
						return requirements;
					},
					watch: true,
					orderBy: "sortKey"
				},
				dataSourceAssistant = new Mojo.DataSource.TypedownDBDataSourceAssistant(dsaParams, {
					select: params.selectFn
				});
			dataSourceAssistant.watchDelay = 1000;
			
			return dataSourceAssistant;
		},
	
		/**
		 * This function can only be called from inside a mojo app.
		 * @param {Object} params	{
		 *								includeEmails: {boolean},
		 *								includePhones: {boolean},
		 *								includeIMs: {boolean},
		 *								imAddressTypes: {array of strings corresponding to IMAddress.TYPE constants}
		 *												This parameter is optional.  If not included, we include all types of IM Addresses.
		 *								favoritesOnly: {boolean},
		 *								excludeFavorites: {boolean}
		 *					}
		 * @return {TypedownDBDataSourceAssistant}
		 */
		getAddressingWidgetDataSourceAssistant: function (params) {
			Assert.requireDefined(Mojo, "ListWidget.getAddressingWidgetDataSourceAssistant requires the mojo framework to be loaded");
			Assert.requireObject(params, "getAddressingWidgetDataSourceAssistant requires a params object to be passed");
		
			var selectFn,
				dataSourceAssistant,
				getItemsToRenderOriginal;
		
			selectFn = function (person) {
				return (
					(params.includePhones && person.phoneNumbers && _.isArray(person.phoneNumbers)) ||
					(params.includeEmails && person.emails && _.isArray(person.emails)) ||
					(params.includeIMs && person.ims && _.isArray(person.ims))
				);
			};
			
			params.selectFn = selectFn;
			//warning!!!  when Person.generateDisplayNameFromRawPerson() changes to require more fields, those have to be added to this list!!
			params.select = ["_id", "favorite", "phoneNumbers", "emails", "ims", "name", "names", "nickname", "organization"];
			dataSourceAssistant = ListWidget.getTypedownDBDataSourceAssistant(params);
			
			// Wrap DSA.getItemsToRender() so we can format the data before it gets to the list
			// this belongs in the list widget code
			getItemsToRenderOriginal = dataSourceAssistant.getItemsToRender.bind(dataSourceAssistant);
			
			dataSourceAssistant.getItemsToRender = function (response, callback) {
				getItemsToRenderOriginal(response, function (items) {
					var i,
						newItems = [];
					
					if (items) {
						for (i = 0; i < items.length; i += 1) {
							newItems = newItems.concat(ListWidget.addressingWidgetRawPersonFormatter(items[i], params));
						}
					}
					//console.log("\n\n\n\nItems for addressing widget: " + JSON.stringify(newItems));
					callback(newItems);
				});
			};
	
			return dataSourceAssistant;
		},
	
		/*
		 * Every item passed to the addressing widget is an object of the following form:
		 *		{
		 *			personId: the id of the person that this item is attached to
		 *			type: the string "IM", "EMAIL", or "PHONE"
		 *			value: the actual email address, phone number, etc. for the item
		 *			label: the type or servicename of the item, suitable for display
		 *			displayName: the name of the person that this item is part of, suitable for display
		 *			serviceName: (IM address items only) the servicename of the item, suitable for use in reverse lookup
		 *		}
		 */
		addressingWidgetRawPersonFormatter: function (rawPerson, params) {
			Assert.requireDefined(Mojo, "ListWidget.addressingWidgetRawPersonFormatter requires the mojo framework to be loaded");
			if (!params) {
				params = {};
				console.warn("ListWidget.addressingWidgetFormatter was not passed a params arg");
			}
			var items = [],
				displayName,
				imAddressTypesToInclude = params.imAddressTypes,
				includeAllIMTypes;
			
			// gal
			if (rawPerson.displayName) {
				displayName = rawPerson.displayName;
			// db
			} else {
				displayName = Person.generateDisplayNameFromRawPerson(rawPerson);
			}
			
			if (params.includePhones && rawPerson.phoneNumbers && _.isArray(rawPerson.phoneNumbers)) {
				rawPerson.phoneNumbers.forEach(function (phoneNumber) {
					items.push({
						personId: rawPerson._id,
						favorite: rawPerson.favorite,
						type: "PHONE",
						value: phoneNumber.value,
						label: PhoneNumber.getDisplayType(phoneNumber.type),
						displayName: displayName
					});
				});
			}
		
			if (params.includeEmails && rawPerson.emails && _.isArray(rawPerson.emails)) {
				rawPerson.emails.forEach(function (email) {
					items.push({
						personId: rawPerson._id,
						favorite: rawPerson.favorite,
						type: "EMAIL",
						value: email.value,
						label: EmailAddress.getDisplayType(email.type),
						displayName: displayName
					});
				});
			}
		
			if (params.includeIMs && rawPerson.ims && _.isArray(rawPerson.ims)) {
				//if we didn't get an array param for imAddressTypesToInclude, then we're including all types of IMs
				includeAllIMTypes = !imAddressTypesToInclude || !_.isArray(imAddressTypesToInclude);
				rawPerson.ims.forEach(function (im) {
					//if we're including everything or if the array we got contains the type of 
					//the current im address, then we include this im address
					if (includeAllIMTypes || imAddressTypesToInclude.indexOf(im.type) !== -1) {
						//TODO: can we remove serviceName and just pass the label?
						items.push({
							personId: rawPerson._id,
							favorite: rawPerson.favorite,
							type: "IM",
							value: im.value,
							label: IMAddress.getDisplayType(im.type),
							displayName: displayName,
							serviceName: im.type
						});
					}
				});
			}
		
			return items;
		},
		
		/**
		 * Returns a configured data source assistant for remote contacts.  This function can only be called from inside a mojo app
		 * that has access to the Mojo framework
		 * @param {Object} params	{
		 *								callback: {Function}  - called when remote contacts are returned, passed the count
		 *					}
		 */
		getTypedownRcsDataSourceAssistant: function (params) {
			Assert.requireDefined(Mojo, "ListWidget.getTypedownRcsDataSourceAssistant requires the mojo framework to be loaded");
			
			var assistant, originalFetchData, remoteContactsAccounts, callback;
			
			callback = params && params.callback;
			
			// assistant setup
			assistant = new Mojo.DataSource.LocalDataSourceAssistant([], {});
			
			originalFetchData = assistant.fetchData;
			assistant.fetchData = function (info, done) {
				// this function touches the following internal attributes in LocalDataSourceAssistant:
				// - this.filterString
				// - this.itemsArray
				var search, future;
				
				// we don't handle this
				if (!this.filterString) {
					return;
				}
				
				search = function (rcsAccount) {
					var future = PalmCall.call(rcsAccount.query, "", {
						accountId: rcsAccount.accountId,
						query: this.filterString,
						limit: 100
					});
					
					future.then(function () {
						var result = future.result.results;
						PalmCall.cancel(future);
						future.result = result;
					});
					
					return future;
				}.bind(this);
				
				future = Foundations.Control.mapReduce({map: search}, rcsAccounts);
				future.then(this, function () {
					var results = [];
					future.result.forEach(function (r) {
						results = results.concat(r.result);
					});
					results.sort(function (left, right) {
						return left && right && left.displayName.localeCompare(right.displayName);
				    });
					this.itemsArray = results;
					if (callback) {
						callback(results.length);
					}
					originalFetchData(info, done);
				});
			};
						
			return assistant;
		},
			
		/**
		 * Returns a configured DBDataSourceAssistant for GAL lookups.  This function can only be called from inside a mojo app
		 * that has access to the Mojo framework
		 * @param {Object} params	{
		 *								selectFn: {Function}
		 *								favoritesOnly: {boolean},
		 *								excludeFavorites: {boolean}
		 *					}
		 */
		getAddressingWidgetRcsDataSourceAssistant: function (params) {		
			Assert.requireDefined(Mojo, "ListWidget.getAddressingWidgetDataSourceAssistant requires the mojo framework to be loaded");
			Assert.requireObject(params, "getAddressingWidgetDataSourceAssistant requires a params object to be passed");
			
			var dataSourceAssistant, getItemsToRenderOriginal;
			
			dataSourceAssistant = ListWidget.getTypedownRcsDataSourceAssistant(params);
			
			// Wrap DSA.getItemsToRender() so we can format the data before it gets to the list
			// this belongs in the list widget code
			getItemsToRenderOriginal = dataSourceAssistant.getItemsToRender.bind(dataSourceAssistant);
			dataSourceAssistant.getItemsToRender = function (response, callback) {
				getItemsToRenderOriginal(response, function (items) {
					var i, newItems = [];
					
					if (items) {
						for (i = 0; i < items.length; i += 1) {
							newItems = newItems.concat(ListWidget.addressingWidgetRawPersonFormatter(items[i], params));
						}
					}
					//console.log("\n\n\n\nItems for addressing widget: " + JSON.stringify(newItems));
					callback(newItems);
				});
			};
			
			return dataSourceAssistant;
		},
		
		isRcsAvailable: function () {
			var future = getRcsAccounts();
			future.then(function () {
				return future.result.length > 0;
			});
			return future;
		},
		
		SortOrder: Utils.defineConstants({
			defaultSortOrder: "LAST_FIRST",
			lastFirst: "LAST_FIRST",
			firstLast: "FIRST_LAST",
			companyLastFirst: "COMPANY_LAST_FIRST",
			companyFirstLast: "COMPANY_FIRST_LAST"
		})
	};
}());
