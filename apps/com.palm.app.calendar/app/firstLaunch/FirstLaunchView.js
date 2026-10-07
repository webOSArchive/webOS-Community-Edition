enyo.kind({
	name		: "calendar.FirstLaunchView",
	kind		: enyo.VFlexBox,
	className	: "enyo-bg",

	components: [
		{kind:"ApplicationEvents", onUnload: "unloadHandler"},
		{name: "firstLaunch", kind: "firstLaunchView", onAccountsFirstLaunchDone: "firstLaunchCompleted", capability: 'CALENDAR', 
						iconSmall: "../images/header-icon-calendar48x48.png", 
						iconLarge: "../images/icon-256x256.png"}
	],

	create: function create () {
		this.inherited (arguments);
	},

	destroy: function destroy () {
		this.inherited (arguments);
	},

	ready: function ready () {
		var msgs = {
				pageTitle	: $L("Your calendar accounts"),
				welcome		: $L("To get started, set up a Calendar account")
			};
		var exclude = undefined;
		this.$.firstLaunch.startFirstLaunch (exclude, msgs);
	},

	unloadHandler: function unloadHandler () {
		DEBUG && this.log ("======= UNLOADING...\t");
		this.destroy();
	},

	firstLaunchCompleted: function firstLaunchCompleted () {
		enyo.application.share ({firstLaunchDone: {data: true}});
	}

});
