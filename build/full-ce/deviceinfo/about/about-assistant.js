/* webOS Community Edition — Device Info "About" scene.
 *
 * NOT a stock Palm file. Added to com.palm.app.deviceinfo by the CE Doctor
 * (build/full-ce/bake.py, the deviceinfo tier), reachable from the app menu on
 * the main Device Info scene.
 *
 * The page dedicates the release to the community and credits it by name. Names
 * are listed in the order given below (alphabetical); a name wrapped in
 * *asterisks* is a code contributor and renders in bold — which is the
 * distinction the dedication text itself calls out.
 */

/* ------------------------------------------------------------------------ *
 * The credits. Alphabetical. Wrap a name in *asterisks* to mark it a code
 * contributor (rendered bold). This and CE_DEDICATION are the only blocks to
 * edit when the list changes — bake.py copies this file into the app verbatim.
 * ------------------------------------------------------------------------ */
var CE_CREDITS = [
	"*achunt*",
	"catx",
	"*codepoet*",
	"dkirker",
	"EricBlade",
	"eva",
	"Grabber5.0",
	"*Herrie*",
	"incidentist",
	"ILovePeaches",
	"jlamb",
	"LegoBatman",
	"mazzinia",
	"misj",
	"Mustacheboyo",
	"nomad84",
	"NotAlexNoyle",
	"Preemptive",
	"Rad",
	"Starkka15",
	"*Tofe*",
	"uweh"
];

/* The dedication, one array entry per paragraph. Plain text; escaped before it
 * reaches the DOM. "{version} " becomes the release number the image reports
 * (the 3.2.0 of "webOS CE 3.2.0"), so the text follows the release; it is left
 * out until the number is known, and for good if it never arrives. */
var CE_DEDICATION = [
	"webOS {version} Community Edition is dedicated to everyone who helped keep the " +
	"dream alive. All of the community members of webOS Archive, the former " +
	"members of webOS Nation, the developers of LuneOS, and the original " +
	"developers at Palm and HP, deserve credit for creating, maintaining and " +
	"believing in something special. However, the following names have been most " +
	"active in recent years, with those in bold having contributed new code " +
	"directly used in this release."
];

var AboutAssistant = Class.create({

	initialize: function(params){
		this.params = params || {};
	},

	setup: function(){
		// Bottom command bar with Back, same shape the 'more' scene uses.
		this.cmdMenuModel = {
			visible: true,
			items: [{label: $L('Back'), command: 'back'}, {}]
		};
		this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.cmdMenuModel);

		this.controller.get('ce-about-dedication').innerHTML = this.dedicationHtml();
		this.controller.get('ce-about-credits').innerHTML = this.creditsHtml();

		// Version line: the CE product string plus the date this image was baked
		// (yyyy-mm-dd). Both come from /etc/palm-build-info by way of the system
		// properties service — buildDate is sliced out of BUILDTIME at bake time
		// and published as /etc/prefs/properties/buildDate.
		this.propertyGet = [];
		var props = ["com.palm.properties.version",
					 "com.palm.properties.buildDate"];
		$A(props).each(function(key, index){
			this.propertyGet[index] = AppAssistant.propertiesService.get(
				{key: key}, this.takeProperties.bind(this), this.controller);
		}.bind(this));

		this.controller.setInitialFocusedElement(null);
	},

	/* Render one credit per cell. "*Name*" -> code contributor (bold). */
	creditsHtml: function(){
		var out = [];
		for (var i = 0; i < CE_CREDITS.length; i++) {
			var name = CE_CREDITS[i];
			var isCode = (name.length > 1 &&
						  name.charAt(0) === '*' &&
						  name.charAt(name.length - 1) === '*');
			if (isCode) {
				name = name.substring(1, name.length - 1);
			}
			out.push('<div class="ce-credit' + (isCode ? ' ce-credit-code' : '') +
					 '">' + name.escapeHTML() + '</div>');
		}
		return out.join('');
	},

	dedicationHtml: function(){
		// "webOS CE 3.2.0" -> "3.2.0"
		var m = /\d+(\.\d+)+/.exec(this.version || '');
		var number = m ? m[0] + ' ' : '';
		var out = [];
		for (var i = 0; i < CE_DEDICATION.length; i++) {
			out.push('<p class="ce-about-p">' +
					 CE_DEDICATION[i].split('{version} ').join(number).escapeHTML() + '</p>');
		}
		return out.join('');
	},

	takeProperties: function(payload){
		Mojo.Log.info("about takeProperties " + Object.toJSON(payload));
		if (!payload)
			return;

		if ("com.palm.properties.version" in payload) {
			this.version = payload["com.palm.properties.version"];
			this.controller.get('ce-about-dedication').innerHTML = this.dedicationHtml();
		}

		if ("com.palm.properties.buildDate" in payload)
			this.buildDate = payload["com.palm.properties.buildDate"];

		// An image without a buildDate just shows the version on its own.
		var line = this.version || '';
		if (this.buildDate)
			line += (line ? ' · ' : '') + $L('Built') + ' ' + this.buildDate;

		if (line)
			this.controller.get('ce-about-version').innerHTML = line.escapeHTML();
	},

	handleCommand: function(event){
		if (event.type == Mojo.Event.command && event.command == 'back') {
			this.controller.stageController.popScene();
		}
	},

	deactivate: function(){
	},

	cleanup: function(){
	}

});
