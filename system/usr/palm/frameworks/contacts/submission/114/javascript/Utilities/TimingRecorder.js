/* Copyright 2009 Palm, Inc.  All rights reserved. */
/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global _, console, process */

var TimingRecorder = function (turnOffTimings, process) {
	this.timings = {};
	this.turnOffTimings = turnOffTimings;
	this.process = process;
};

TimingRecorder.prototype.startTimingForJob = function (jobName) {
	if (!this.turnOffTimings || !this.process) {
		return;
	}
	
	var time = this.process.uptime();
	
	if (!this.timings[jobName]) {
		this.timings[jobName] = [];
	}
	
	this.timings[jobName].push({
		startTime: time
	});
};

TimingRecorder.prototype.stopTimingForJob = function (jobName) {
	var time,
		tempJobTimings;
	
	if (!this.turnOffTimings || !this.process) {
		return;
	}
	
	time = this.process.uptime();
	
	tempJobTimings = this.timings[jobName];

	if (!tempJobTimings) {
		console.log("Job '" + jobName + "' did not have a startTiming call!!!!!");
	}
	
	tempJobTimings[tempJobTimings.length - 1].endTime = time;
};

TimingRecorder.prototype.printTimings = function () {
	var tempTimingsForJob,
		jobAverage,
		that = this;
	
	if (!this.turnOffTimings) {
		return;
	}
	
	Object.keys(this.timings).forEach(function (key) {
		jobAverage = 0;
		console.log("Timings for job '" + key + "'");
		
		tempTimingsForJob = that.timings[key];
		console.log(tempTimingsForJob.length + " recordings where made");
		
		tempTimingsForJob.forEach(function (timing, index) {
			console.log((index + 1) + ": " + ((timing.endTime - timing.startTime) / 1000) + "s");
			jobAverage += (timing.endTime - timing.startTime);
		});
		
		console.log("For a total time spent of: " + jobAverage / 1000 + "s");

		jobAverage = jobAverage / tempTimingsForJob.length;
		
		console.log("For an average time spent of: " + jobAverage / 1000 + "s");
	});
};
