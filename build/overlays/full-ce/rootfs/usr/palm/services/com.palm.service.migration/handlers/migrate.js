var scriptsPath = "resources/migration.json";
var scriptKind = "com.palm.migration.script:1";
var runScriptPath = "/usr/palm/services/com.palm.service.migration/util/run_script.js"; // MigrationUtils.runScript;
var invokeNode = "/usr/palm/nodejs/node";

var fbProgress = "/usr/bin/fbprogress"; // Path to fbprogress binary which is used to display progress during OTA
var TOTAL_PROGRESS_STEPS = 5; // Total number of steps (characters) to write to the progress file
var writtenProgress = 0; // The number of characters actually written to the progress file.
var currentProgress = 0; // Out of TOTAL_PROGRESS steps, how much is complete (floating point)
var progressIncrement = 0; // amount to increment progress after each script completes (floating point)

// When TEST_MODE is true, a failure in any individual script will not fail the migration and will not 
// prevent subsequent scripts from being run.
var TEST_MODE = true; // webOS CE: a failing script never strands an update

function failCallback(future) {
	logger.log("DATA MIGRATION FAILURE CALLBACK: got exception: " + JSON.stringify(future.exception));
	// webOS CE: log and go on with the next step; exiting here strands the device
	logger.error("CE: continuing the migration past this error");
	future.result = { ceContinued: true };
}

function handleScript(script) {
	var future = new Future();
	var putKind = false;
	var skipScript = false;
	if (script && script.path) {
		future.now(function(){
			// check if we've already run this script.  If not, execute it
			var query = {
				from: scriptKind,
				where: [{prop:"path",op:"=",val:script.path}]
			}
			logger.log("Have we run this script before: " + script.path + "?");
			future.nest(DB.find(query));
		});
		future.then(function() {
			var result = future.result;
			if (result.results === undefined || result.results.length == 0) {
				logger.log("No, run it now");
				var path = script.path;
				if ("/" !== path.charAt(0)) {
					path = "scripts/" + path;
				}
				future.nest(execFuture(script.path, invokeNode, ["--notimeout_script_execution", runScriptPath, path, locale]));
			} else {
				logger.log("Yes, skip it");
				skipScript = true;
				future.result = {};
			}
		});
		future.then(this, function(f) {
			if (future.exception) {
				var err = future.exception;
				logger.error("BLAME: " + script.path);
				if (TEST_MODE) {
					logger.error("Error occurred while running script " + script.path + ": " + JSON.stringify(err));
					logger.error("Continuing migration since we're in test mode");
					skipScript = true;
					f.result = {};
				} else {
					f.exception = err;
				}
			} else {
				var result = f.result;
				f.result = result;
			}
		});
		future.then(function(){
			//TODO: if the script had an error and we quit triton with a non-zero error code, make sure we throw an
			//exception at this point when we read the result so that we don't mark in the dB that this script has 
			//already run
			var result = future.result;
			if (skipScript) {
				future.result = {};
			} else {
				incrementProgress();
				future.nest(DB.put([{
					_kind: scriptKind,
					path: script.path
				}]));
			}
		});
	} else {
		future.now(function(){
			logger.log("Script is undefined or script path is undefined!");
			future.result = {};
		});
	}
	return future;
}

// Calls the given command at the given URL with the given args, logging the call and the response
function palmcall(serviceId, cmd, args) {
    var url = "palm://" + serviceId
    var fullUrl = url + "/" + cmd
    logger.log("Calling", fullUrl, "with args", JSON.stringify(args));
    var future = PalmCall.call(url, cmd, args);
    future.then(this, function(f) {
        try {
            var result = f.result;
            logger.log("Call to", fullUrl, "returned", JSON.stringify(result));
            f.result = result;
        } catch (err) {
            logger.log("Error in call to " + fullUrl + ": " + JSON.stringify(err));
            err.serviceId = serviceId;
            throw err;
        }
    });
    return future;
}

function runConfigurator(types) {
    // webOS CE: a configuration the configurator refuses (an owner's homebrew
    // kind, permission, activity) is logged, never fatal: it is only a log
    // line at every normal boot too.
    var future = palmcall("com.palm.configurator", "run", { types: types });
    future.then(function(f) {
        try {
            f.result = f.result;
        } catch (e) {
            logger.error("CE: configurator " + JSON.stringify(types) + " did not fully succeed, continuing: " + JSON.stringify(e));
            f.result = { returnValue: false, ceTolerated: true };
        }
    });
    return future;
}

function runConfiguratorAllTypes() {
    var future = new Future();
    future.now(function() {
        future.nest(runConfigurator([ "filecache", "dbkinds" ]));
    });
    future.then(function() {
        var result = future.result;
        future.nest(runConfigurator([ "dbpermissions" ]));
    });
    future.then(function() {
        var result = future.result;
        future.nest(runConfigurator([ "activities" ]));
    });
    return future;
}
    
function performDataMigration() {
	logger.log("STARTING DATA MIGRATION");
	
	var future = new Future();
	future.onError(failCallback);
	var scripts;
	
	future.now(function() {
		logger.log("Calling Configurator to load dbkinds");
		future.nest(runConfigurator(["dbkinds"]));
	});
	future.then(function() {
		var result = future.result;
		logger.log("Reading scripts file");
		scripts = JSON.parse(fs.readFileSync(scriptsPath, "utf8"));
		future.nest(getNumberOfScriptsToRun(scripts));
	});
	future.then(function() {
		var result = future.result;
		progressIncrement = result === 0 ? 0 : TOTAL_PROGRESS_STEPS / result;
		if (scripts && scripts.imports) {
			//we have import scripts to run, so execute them
			logger.log("Scanning import scripts");
			future.nest(MigrationUtils.iterate(handleScript, scripts.imports));
		} else {
			//no import scripts - skip to the next then
			future.result = {};
		}
	});
	future.then(function() {
	    var result = future.result;
	    // wipe the configurator's cache directory, so that we can be sure the dbkinds get reloaded
	    future.nest(rmTree("/var/cache/configurator/*"));
	});
	future.then(function() {
		var result = future.result;
		logger.log("Finished loading records into DB8, calling configurator");
		future.nest(runConfiguratorAllTypes());
	});
	
	future.then(function(){
		try {
			var result = future.result;
			logger.log("Result of registering activities, filecache types and dbkinds: " + JSON.stringify(result));
		} catch (e) {
			// just for now, catch the configurator exception and keep going.
			logger.warn("CAUGHT EXCEPTION AFTER CONFIGURATOR RUN " + JSON.stringify(e));
		}
		
		if (scripts && scripts.migrations) {
			//we have migration scripts to run, so execute them
			logger.log("Scanning migration scripts");
			future.nest(MigrationUtils.iterate(handleScript, scripts.migrations));
		} else {
			//no migration scripts - skip to the next then
			logger.log("No migration scripts");
			future.result = {};
		}		
	});
	
	future.then(function() {
		var result = future.result;
		logger.log("Result of running migrations: " + JSON.stringify(result));
		future.result = {};
		if (writtenProgress < TOTAL_PROGRESS_STEPS - 1) {
			progressIncrement = TOTAL_PROGRESS_STEPS - writtenProgress;
			incrementProgress();
		}
	});
	return future;
}

/**
 * Returns the number of scripts that will actually need to be run to complete the migration.
 */
var getNumberOfScriptsToRun = function(scripts) {
    if (!scripts) return 0;
    
    var availableScripts = [];
    var alreadyRunScripts = {};

    if (scripts.imports) {
        scripts.imports.forEach(function(script) {
            availableScripts.push(script.path);
        });
    }

    if (scripts.migrations) {
        scripts.migrations.forEach(function(script) {
            availableScripts.push(script.path);
        });
    }
    
    // TODO: This query will stop working properly once there are > 500 migration scripts
    var future = DB.find({ from: scriptKind });
    future.then(this, function(f) {
        var result = f.result;
        var scriptResults = result.results;
        
        var toRunScriptCount = 0;
        if (scriptResults === undefined) {
            scriptResults = [];
        }

        scriptResults.forEach(function(script) {
            alreadyRunScripts[script.path] = true;
        });
        
        availableScripts.forEach(function(path) {
           if (!alreadyRunScripts[path]) {
               toRunScriptCount++;
           }
        });
        f.result = toRunScriptCount;
    });
    return future;
}

var incrementProgress = function() {
    if (fbProgress)
    {
       currentProgress += progressIncrement;
       logger.info("Incrementing progress to " + currentProgress);
       var currentProgressInt = Math.floor(currentProgress);
       if (currentProgressInt > writtenProgress) {
           while (currentProgressInt > writtenProgress) {
               var progress = spawn(fbProgress, ['-s', '+', '&']);
               progress.stderr.on('data', function (data) {
                   logger.error("Error updating progress: " + data);
               });
               writtenProgress++;
           }
       }
    }
}

var unlinkIgnoreExceptions = function(path) {
    try { 
        fs.unlinkSync(path);
    } catch (err) {
        logger.warn("Unable to remove " + path);
    }
};

/**
 * Checks if any of the scripts have set the accountsChanged flag. If so, then call accountsChanged() on the
 * Account Service to make sure the proper activities are started.
 */
var handleAccountsChanged = function() {
    var path = require('path');
    var skipFlagSet = false;
    var flagSet = false;
    
    var future = new Future();
    path.exists(SKIP_FLAG_PATH, function(exists) {
        future.result = exists;
    });
    future.then(this, function(f) {
        skipFlagSet = f.result;
        if (skipFlagSet) {
            logger.log("skipAccountsChanged flag is set, will not call accountsChanged");
        }
        path.exists(FLAG_PATH, function(exists) {
            f.result = exists;
        });
    });
    future.then(this, function(f) {
        flagSet = f.result;
        if (flagSet && !skipFlagSet) {
            logger.log("accountsChanged flag is set, calling accountsChanged");
            f.result = PalmCall.call("palm://com.palm.service.accounts", "accountsChanged", {});
        } else {
            f.result = {};
        }
    });
    future.then(this, function(f) {
        var result = f.result;
        if (skipFlagSet) {
            unlinkIgnoreExceptions(SKIP_FLAG_PATH);
        }
        if (flagSet) {
            unlinkIgnoreExceptions(FLAG_PATH);
        }
        logger.log("Result of handleAccountsChanged: " + JSON.stringify(result));
        future.result = {};
    });
    return future;
};

function MigrateAssistant() {
	// Migrates data from previous versions of webOS to the current version.
	this.run = function(future) {
		logger.log("Inside migrate()");
		if (!this.controller.args || !this.controller.args.progress || this.controller.args.progress != true) {
			fbProgress = undefined;
		}
		future.nest(performDataMigration());
		future.then(this, function(f) {
			var result = f.result;
			f.nest(handleAccountsChanged());
		});
	};
}
