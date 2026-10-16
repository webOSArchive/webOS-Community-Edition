/* Backup Diagnostic: a front end for org.webosarchive.backupdiag.service.
 *
 * Runs the service's read-only scan, shows the report, then asks the Backup
 * service itself what Restore would list and adds its answers to the report.
 * That second step comes AFTER the scan on purpose: getRestoreDevices and
 * listBackups refresh the Backup service's manifest cache, which is part of
 * the evidence the scan records.
 */
enyo.kind({
	name: "DiagApp",
	kind: enyo.VFlexBox,

	components: [
		{ name: "diag", kind: "PalmService", service: "palm://org.webosarchive.backupdiag.service/" },
		{ name: "backup", kind: "PalmService", service: "palm://com.palm.app.backup.service/" },

		{ kind: "PageHeader", content: "Backup Diagnostic" },
		{ className: "diag-intro", content: "Works out why Restore does not offer a backup. " +
			"Reads only; nothing in your backups is changed. The report is saved as " +
			"backup-diagnosis.txt on the USB drive, so it can be copied off and sent." },
		{ layoutKind: "HFlexLayout", style: "padding: 8px 16px;", components: [
			{ name: "quickButton", kind: "Button", flex: 1, caption: "Quick Check",
			  className: "enyo-button-affirmative", onclick: "runQuick", style: "margin-right: 8px;" },
			{ name: "deepButton", kind: "Button", flex: 1, caption: "Full Check (verify every file)",
			  onclick: "runDeep" }
		]},
		{ name: "status", className: "diag-status", content: "" },
		{ kind: "Scroller", flex: 1, components: [
			{ name: "report", className: "diag-report", content: "" }
		]}
	],

	runQuick: function () { this.run(false); },
	runDeep: function () { this.run(true); },

	run: function (deep) {
		this.setBusy(true);
		this.$.report.setContent("");
		this.$.status.setContent("Starting...");
		this.$.diag.call({ deep: deep }, { method: "scan", onSuccess: "scanDone", onFailure: "scanFailed" });
		this.poll = window.setInterval(enyo.bind(this, "askStatus"), 1000);
	},

	setBusy: function (busy) {
		this.$.quickButton.setDisabled(busy);
		this.$.deepButton.setDisabled(busy);
		if (!busy && this.poll) {
			window.clearInterval(this.poll);
			this.poll = null;
		}
	},

	askStatus: function () {
		this.$.diag.call({}, { method: "status", onSuccess: "gotStatus" });
	},

	gotStatus: function (inSender, inResponse) {
		if (!this.poll || inResponse.state !== "running") {
			return;
		}
		var text = inResponse.phase || "Working";
		if (inResponse.total) {
			text += " (" + inResponse.done + " of " + inResponse.total + ")";
		}
		this.$.status.setContent(text + "...");
	},

	scanDone: function (inSender, inResponse) {
		this.setBusy(false);
		this.showReport(inResponse.report || "(empty report)");
		this.$.status.setContent("Asking the Backup service what Restore sees...");
		this.liveChecks = [
			{ method: "getRestoreDevices", title: "What the Backup service's Restore list returns (getRestoreDevices)" },
			{ method: "listBackups", title: "What the Backup service's Manage Backups list returns (listBackups)" }
		];
		this.nextLiveCheck();
	},

	scanFailed: function (inSender, inResponse) {
		this.setBusy(false);
		this.$.status.setContent("The diagnostic service did not answer.");
		this.showReport(JSON.stringify(inResponse, null, 2));
	},

	// One at a time, each with its own deadline: a wedged Backup service never
	// answers at all, and that is itself worth recording.
	nextLiveCheck: function () {
		this.check = this.liveChecks.shift();
		if (!this.check) {
			this.$.status.setContent("Done. Saved as backup-diagnosis.txt on the USB drive.");
			return;
		}
		this.checkTimer = window.setTimeout(enyo.bind(this, "liveTimedOut"), 60000);
		this.$.backup.call({}, { method: this.check.method, onSuccess: "liveSuccess", onFailure: "liveFailure" });
	},

	liveSuccess: function (inSender, inResponse) {
		this.liveAnswer(JSON.stringify(inResponse, null, 2));
	},

	liveFailure: function (inSender, inResponse) {
		this.liveAnswer("FAILED: " + JSON.stringify(inResponse, null, 2));
	},

	liveTimedOut: function () {
		this.liveAnswer("NO ANSWER within 60 seconds -- the Backup service is not responding.");
	},

	// First of answer/timeout wins; the other finds no check pending.
	liveAnswer: function (text) {
		var check = this.check;
		if (!check || check.answered) {
			return;
		}
		check.answered = true;
		window.clearTimeout(this.checkTimer);
		this.$.diag.call({ title: check.title, text: text },
			{ method: "append", onSuccess: "appended", onFailure: "appended" });
	},

	appended: function (inSender, inResponse) {
		if (inResponse && inResponse.report) {
			this.showReport(inResponse.report);
		}
		this.nextLiveCheck();
	},

	showReport: function (text) {
		this.$.report.setContent(String(text)
			.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
	}
});
