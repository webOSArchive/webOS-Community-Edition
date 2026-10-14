enyo.kind({
	name: "PictureComments",
	kind: enyo.Popup,
	lazy: false,
	// XXXXX workaround for DFISH-17731.  Downside: must tap to dismiss comments before 
	// swiping to next/previous picture
	modal: true,
	events: {onCommentSubmit: ""},
	className: "PictureComments",
	openClassName: "PictureCommentsFadeIn",
	showHideMode: "transition",
	published: {
		maxHeight: 100
	},
	components: [
		{kind: "BasicScroller", autoHorizontal: false, horizontal: false, components: [
			{name: "listComments", kind: "VirtualRepeater", className: "listComments", onSetupRow: "listSetupRow", components: [
				{kind: "Item", layoutKind: "VFlexLayout", className: "comment-item", components: [
					{kind: "HFlexBox", components: [		
							{name: "imgProfilePic", kind: "Image", className: "profile-pic"},
							{kind: "VFlexBox" , components: [
								{kind: "HFlexBox", components: [
									{name: "lblName", className: "comment-name"},
									{name: "lblTimeStamp", className: "comment-timestamp"}
								]}, 							 
								{name: "lblComment", className: "comment-comment"}							 
							]},
					]}
				]}
			]}
		]},
		{kind: "Control", className: "comment-container",  components: [
			{ name: "inputField", 
				kind: "RichText",
				richContent: false,
				hint: $L("Tap here to add comment"),
				onkeydown: "inputFieldKeydown", 
				className: "comment-input", 
				components: [{kind: "Image", src:"images/commentSubmit.jpg", onclick: "addComment", style: "margin-top: 7px;"}]
			}			
		]}
	],
	g11nMinRelative: new enyo.g11n.Template($L("1#1 minute ago|##{min} minutes ago")),
	g11nHourRelative: new enyo.g11n.Template($L("1#1 hour ago|##{hour} hours ago")),
	g11nDayRelative: new enyo.g11n.Template($L("1#1 day ago|##{day} days ago")),
	create: function() {
		this.inherited(arguments);
		this.arCommentsList = [];
		this.maxHeightChanged();
	},
	setCommentList: function(newComments)
	{		
		var same = true;
		if (this.arCommentsList.length !== newComments.length) same = false;
		else {
			for (var i=0; i < newComments.length; i++) {
				// Assume comments are immutable
				if (this.arCommentsList[i].cid !== newComments[i].cid) same = false;
			}
		}
		if (same) return;  // no change in the comments
		
		this.arCommentsList = newComments.slice(0);
		this.$.listComments.render();
		
		// XXXXX I'd like to just immediately call scrollToBottom.  However, if we do this in the
		// current tick, then the scroll won't happen because the scroller-client's node-boundaries
		// have not yet been set by the upcoming frame-layout.  So, I wait for the next tick before
		// animating a scroll to the desired position (if I dont animate, there is a one-frame flash
		// of the content scrolled to the wrong position).
		// XXXXX Sometimes the animation doesn't even happen... because even after a tick the 
		// boundaries haven't yet been computed?!?
		enyo.asyncMethod(this, 'animateScrollToBottom');
	},
	// Hack used by setCommentList(); see the comment there.
	animateScrollToBottom: function() {
		var b = this.$.basicScroller.getBoundaries();
		this.$.basicScroller.scrollTo(b.bottom, 0);
	},
	scrollToTop: function() {
		this.$.basicScroller.scrollTo(0,0);
	},
	maxHeightChanged: function() {
		this.$.basicScroller.applyStyle("max-height", this.maxHeight + "px");
	},
	// Clear the input field.
	clearInput: function() {
		this.$.inputField.setValue("");
	},
	listSetupRow: function(inSender, inIndex) {
		
		/* EXAMPLE COMMENT FORMAT
			{ "_id" : "213d",
				"cid" : "10100200111541747_20988865",
				"profilePic" : "http://profile.ak.fbcdn.net/hprofile-ak-snc4/41758_680917323_5025_s.jpg",
				"text" : "Oh man, that's worse than I thought.  Where's the top of it?  Maybe it'll grow back?",
				"time" : 1294273518,
				"uid" : "680917323",
				"user" : "Sharon Mah-Gargus"
			},
		*/
		
			var item = this.arCommentsList[inIndex];
			if (item) {
				this.$.lblComment.setContent(item.text);
				this.$.lblName.setContent(item.user);
				this.$.lblTimeStamp.setContent(this.formatTimeStamp(item.time));
				
				this.$.imgProfilePic.setSrc(item.profilePic);
				
				return true;
			}
	},	
	inputFieldKeydown: function(sender, event) {
		if(event.keyCode === 13) {
			this.addComment();
			this.$.inputField.forceBlur();
		}
	},
	addComment: function() {
		var text = this.$.inputField.getValue();
		if (text !== '') {
			console.log('submitting cloud-picture comment: ' + text);
			this.doCommentSubmit(text);
			this.$.inputField.setValue('');
		}
	},
	removeComment: function() {
		this.arCommentsList.pop();
		this.$.listComments.render();
		this.$.basicScroller.scrollToBottom();
	},
	formatTimeStamp: function (intTicks) {
		// XXXXX: hack for demo... if the number is < 100 treat it
		// as the number of days ago.
		if (intTicks < 100) {
			return "" + intTicks + " days ago";
		}
		
		var dateNow = new Date();
		var decTimeDiff = (dateNow.getTime() - (intTicks*1000))/60000 ;
		
		switch(true)
		{
			
			case decTimeDiff < 1 :  
				return $L("Just now");
				break;
			
			case (decTimeDiff >=1 && decTimeDiff < 60):
				var iMinutes = Math.floor(decTimeDiff);
				return this.g11nMinRelative.formatChoice(iMinutes,{min: iMinutes});
				break;
			
			case (decTimeDiff >=60 && decTimeDiff < 1440):
				var iHours = Math.floor(decTimeDiff/60);
				return this.g11nHourRelative.formatChoice(iHours,{hour: iHours});
				break;
			case (decTimeDiff >= 1440):
				var iDay = Math.floor(decTimeDiff/1440);
				return this.g11nDayRelative.formatChoice(iDay,{day: iDay});
			
				break;			
		
		}
		
		return "";		
	},
	close: function() {
		this.$.inputField.forceBlur(); 
		this.inherited(arguments);
	}
	
	
	
});