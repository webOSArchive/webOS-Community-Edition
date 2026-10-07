enyo.kind({
	name		: "calendar.FirstLaunchView",
	kind		: enyo.VFlexBox,
	className	: "enyo-bg",

	components: [
		{kind:"ApplicationEvents", onUnload: "unloadHandler"},
		{name: "firstLaunch", kind: "calendar.FirstLaunchAccounts", onAccountsFirstLaunchDone: "firstLaunchCompleted", capability: 'CALENDAR', 
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
		// webOS CE: the profile account's calendar is a plain on-device calendar (nothing
		// syncs it since HP's servers closed), so offer it as ready to use rather than as an
		// HP account to "get started with". localFileStorage is the accounts library's
		// built-in "use what's on the device" layout; calendar.FirstLaunchAccounts fixes up
		// its row below.
		var msgs = {
				pageTitle			: $L("Your calendars"),
				welcome				: $L("To get started, add a calendar account"),
				localFileStorage	: $L("Your calendar is ready to use. Events you add are kept on this device:")
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

// The accounts library labels the localFileStorage row with the profile account's alias
// and icon -- the signed-in member's name (or nothing) next to a pair of sync arrows.
// Show the on-device calendar's own name and a calendar icon instead.
enyo.kind({
	name		: "calendar.FirstLaunchAccounts",
	kind		: "firstLaunchView",

	onAccountsAvailable: function onAccountsAvailable () {
		this.inherited (arguments);
		var calMgr = enyo.application.calendarsManager;
		if (this.profileAccount) {
			this.$.localStorageImage.setSrc ("../images/header-icon-calendar.png");
			calMgr && this.$.localStorageName.setContent (calMgr.LOCAL_CALENDAR_NAME);
		}
	}
});
