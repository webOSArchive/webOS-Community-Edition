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
