/**
NOTES:
	-	calendar.day.DayCarousel allows interacting with Calendar's Day View as
		either a horizontal or vertical carousel.

TODOs:
	- BUG	: enyo.DomNode.showingChanged() should be called on destroy() as it is on create()!
	- BUG	: enyo.Carousel.fetchView ("center") returns left view after 1st scroll!
	- PLAN	: Change "events" watch type to "cache" since we're watching cache changes.
	- PLAN	: Create base component for Day, Week, and month Carousels to inherit from.
	- ...
**/

enyo.kind({
	name: "calendar.day.DayCarousel",
	kind: enyo.VFlexBox,

	published:
	{	currentDate	: null	// Date		: For watching when the current date changes.
	,	events		: null	// Object	: For watching Calendar Events (aka cache updates).
	},

	components: [
		{name: "dayCarousel", kind: enyo.VirtualCarousel, flex:1, onSetupView:"setupView", onSnap:"snap", onSnapFinish:"snapFinish", viewControl: {kind: calendar.day.DayView}}
	],

	create: function create () {
		this.inherited (arguments);
		enyo.application.watch ({ events:this });
	},

	destroy: function destroy () {
		enyo.application.ignore ({ currentDate:this, events:this });	// !!! Ignore currentDate here b/c DomNode.showingChanged() is only called on create() not on destroy() !!!
		this.inherited (arguments);
	},

	currentDateChanged: function currentDateChanged (oldDate) {
		if (!(this.generated && this.showing)) { return; }				// Avoid GUI updates if not rendered or showing. !!!this.generated is a protected enyo property!!!

		var	currentDate = enyo.application.currentDate;

		DEBUG && this.log ("\tCurrentDay: [",this.currentDay,"]\tCurrentDate: [",currentDate,"]\t");

		if (!this.currentDay	||	(+this.currentDay != +currentDate)) {		// If the current day isn't already being displayed:
			!this.currentDay	&&	(this.currentDay = new Date());				//	Create the current day if it doesn't exist.
			currentDate			&&	(this.currentDay.setTime (+currentDate));	//	Update the current day to the actual current date if it exists.
			this.currentDay.clearTime();										//	Reset the current day's time to midnight. 

			DEBUG && this.log ("\n\n============ DAY:",String (this.currentDay),"============\n\n");
			this.viewsReady = false;			// VirtualCarousel doesn't allow you to pass through any additional parameters to setupView so we have to do this.
			this.$.dayCarousel.renderViews(0);
			this.viewsReady = true;
		}
		this.eventsChanged();	// Fetch a full range of events.
	},

	eventsChanged: function eventsChanged (oldEvents) {
		if (!this.showing || !this.currentDay) { return; }						// Avoid updating the GUI if it's not visible or currentDay doesn't exist.
		var	date	= new Date (this.currentDay).clearTime()
		,	expand	= 1
		;
		enyo.application.cacheManager.getDays ({ date:date, expand:expand });	// Center-out querying requerys carousel's left & right views' events.
	},

	showingChanged: function showingChanged (wasShowing) {
		this.inherited (arguments);

		var showing = this.showing;
		if (!this.generated) { return; }							// Avoid GUI updates if not rendered or if already showing. !!!this.generated is a protected enyo property!!!

		var enyoApp = enyo.application;

		this.broadcastMessage ("isActive", [showing]);				// Activate carousel views so they watch/ignore events as needed.
		enyoApp [showing ? "watch" : "ignore"] ({currentDate: this});

		if (!showing && this.currentDay && enyoApp.autoDate) {				// PERF: Only when leaving this view:
			enyoApp.shareCurrentDate ({date:this.currentDay, wait: true});		//		Share the currentDay as the current date.
		}

		enyoApp.autoDate = true;	// Reset autoDate mode.
	},

// BEGIN :-------: Custom Handlers :--------------------------------------------------------------------------------------------------------------------------//
	
	viewSwitchedHandler: function viewSwitchedHandler (viewName) {
		this.broadcastMessage("becameCurrentPane", [(viewName == "dayCarousel")]); 
	},

// BEGIN :-------: Custom Methods :---------------------------------------------------------------------------------------------------------------------------//

	setupView: function setupView (inSender, inView, inViewIndex) {
		var viewDate = (new Date(this.currentDay)).addDays(inViewIndex);

		if (this.viewsReady) {

			// Update currentDay to the center view.
			this.currentDay.addDays (inViewIndex > this.$.dayCarousel.viewIndex ? 1 : -1);

			DEBUG && this.log ("\n\n============ DAY:",String (this.currentDay),"============\n\n");

			// Immediately update the app's current date to the current day's date.
			enyo.application.currentDate.setTime (+this.currentDay);

			// Reset the view index.
			this.$.dayCarousel.viewIndex = 0;
			enyo.application.cacheManager.getDays ({date:viewDate, expand:0});	// We may need to do this after setting the date on the view if we switch to synchronous Days shares.
		}

		inView.setDate (viewDate);
		//this.log("Current View index",inViewIndex, "Carousel view index",this.$.dayCarousel.viewIndex,"Center index",this.$.dayCarousel.centerIndex,"SnapScroll index",this.$.dayCarousel.index);
		return true;
	},

	snap: function snap (carousel) {
	},

	snapFinish: function snapFinish (carousel) {
	}
});
