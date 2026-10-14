enyo.kind({
	name: "VideoSymbolBar",
	kind: enyo.Control,
	events: {
		onBarClick: ""
	},
	className: "video-symbol video-symbol-bar-bottom",
	components: [
		{ name: "barLeft", kind: enyo.Control, className: "bar-left",
			  components: [ { name: "barLabel", className: "bar-label" } ]
		},
		{ name: "barRight", className: "bar-right", components: [ { name: "duration" } ] }
	],
	g11nDurationFmt: new enyo.g11n.DurationFmt({style: 'short'}),
	clickHandler: function (inSender, ev) {
		this.doBarClick(ev);
	},
	calcWidths: function (labels) {
		var outer = document.createElement("div");
		outer.setAttribute("class", "video-symbol");
		outer.style.top = "-4000px";
		outer.style.left = "-2000px";

		var label = document.createElement("div");
		label.setAttribute("class", "bar-label");
		outer.appendChild(label);

		document.body.appendChild(outer);

		var i, len, widths = [];
		for (i = 0, len = labels.length; i < len; i++) {
			label.innerHTML = labels[i];
			widths.push(label.offsetWidth);
		}

		document.body.removeChild(outer);
		outer.removeChild(label);

		return widths;
	},
	updateFromDbEntry: function(dbEntry) {
		if (!dbEntry) { return; }

		var tokens = dbEntry.path.split(/\//);
		var basename = tokens[tokens.length-1];
		var videoName = enyo.string.escapeHtml(basename);
		var videoDuration = this.secondsToTimeString(dbEntry.duration);
		this.$.barLabel.setContent(videoName);
		this.$.duration.setContent(videoDuration);

		var bottom, left, width;
		var dimensions = (dbEntry.appGridThumbnail && dbEntry.appGridThumbnail.dimensions) ?
							dbEntry.appGridThumbnail.dimensions :
							{ "output-width": 144, "output-height": 144 };  // @see images/blank-video.png

		bottom = Math.floor((240 - dimensions["output-height"]) / 2);
		left = Math.floor((240 - dimensions["output-width"]) / 2);
		width = dimensions["output-width"];
		
		this.applyStyle("bottom", "" + bottom + "px");
		this.applyStyle("left", "" + left + "px");
		this.applyStyle("width", "" + width + "px");

		var widths = this.calcWidths([ videoName, videoDuration ]);
		var widthAllowed = width - widths[1] - 20;  // 20=10+10
		var labelWidth = widthAllowed < widths[0] ? widthAllowed : widths[0];
		this.$.barLabel.applyStyle("width", ""+labelWidth+"px");
	},
	secondsToTimeString: function (seconds) {
		var iSeconds = Math.floor(seconds);
		var sec = iSeconds%60;
		var iMinutes = Math.floor((iSeconds-sec)/60);
		var min = iMinutes%60;
		var hr = Math.floor((iMinutes-min)/60);
		
		/*
		var strArr = [];
		if (hr > 0) { strArr.push(hr.toString()); }
		if (min > 0) {
			strArr.push(min > 9 ? min.toString() : ("0"+min));
		} else {
			strArr.push("00");
		}
		if (sec > 0) {
			strArr.push(sec > 9 ? sec.toString() : ("0"+sec));
		} else {
			strArr.push("00");
		}
		return strArr.join(":");
		*/
		return this.g11nDurationFmt.format({'hours': hr, 'minutes': min, 'seconds': sec});
	}
});
