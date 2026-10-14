var cover = {};

(function() {
	cover.sheet = function(s) {
		document.write('<link href="' + s + '" media="screen" rel="stylesheet" type="text/css" />');
	};

	cover.script = function(s) {
		document.write('<script src="http://localhost:8080?path=' + s + '" type="text/javascript" onerror="console.error(\'Error loading script ' + s + '\')"></script>');
	}

	cover.path = {
		// match $name
		pattern: /\$([^\/\\]*)(\/)?/g,
		// replace macros of the form $pathname with the mapped value of paths.pathname
		rewrite: function (inPath) {
			var working, result = inPath;
			var fn = function (macro, name) {
				working = true;
				var path = cover.path.paths[name];
				return path ? (path.charAt(path.length - 1) == "/" ? path : path + "/") : "";
			};
			do {
				working = false;
				result = result.replace(this.pattern, fn);
			} while (working);
			return result;
		},
		paths: {
			cover: cover.coverPath
		}
	};

	cover.paths = function (inPaths) {
		if (inPaths) {
			for (var n in inPaths) {
				cover.path.paths[n] = inPaths[n];
			}
		}
	};

	// Modules information used by build tools
	var modules = cover.modules = [];
	// Sheets information used by build tools
	var sheets = cover.sheets = [];
	var stack = [];
	var package = "";
	var packageFolder = "";

	cover.depends = function(inDepends) {
		// begin processing dependencies
		more({
			index: 0,
			depends: arguments || []
		});
	};

	var more = function(inBlock) {
		if (inBlock) {
			while (inBlock.index < inBlock.depends.length) {
				var d = inBlock.depends[inBlock.index++];
				if (typeof d == "string") {
					if (d && require(d, inBlock)) {
						return;
					}
				} else if ("paths" in d) {
					cover.paths(d.paths);
				}
			}
		}
		// if there are no further dependencies, we are done with this package
		var block = stack.pop();
		if (block) {
			//console.log("||  Finished package (" + block.package + ")", block.folder);
			// restore interrupted path to current
			packageFolder = block.folder;
			more(block);
		}
	};

	var require = function(inPath, inBlock) {
		// process aliases
		var path = cover.path.rewrite(inPath);
		var delim = inPath.slice(0, 1);
		if (packageFolder && delim != "/" && delim != "\\" && delim != "$" && inPath.slice(0, 5) != "http:") {
			// require() method below guarantees that packageFolder has proper delimiter (i.e. '/')
			path = packageFolder + path;
			//console.log("+ dependency: [" + packageFolder + "][" + inPath + "]");
		} else {
			//console.log("- dependency: [" + inPath + "]");
		}
		// process path
		if (path.slice(-3) == "css") {
			sheets.push(path);
			cover.sheet(path);
		} else if (path.slice(-2) == "js") {
			modules.push({
				package: package,
				rawPath: inPath,
				path: path
			});
			cover.script(path);
		} else {
			requirePackage(path, inBlock);
			// return true to indicate a package was located
			// and we need to interrupt further processing until it's completed
			return true;
		}
	};

	var requirePackage = function(inPath, inBlock) {
		// package can encoded in two ways:
		//
		//	[folder]/[name of package without extension]
		//	[folder which will be name of package]
		//
		// examples:
		//	"foo/"
		//
		// the package name is 'foo', $foo points to "foo/",
		// and the dependency file is "foo/depends.js"
		//
		//	"foo/foo"
		//
		// the package name is 'foo', $foo points to "foo/",
		// and the dependency file is "foo/foo-depends.js"
		//
		var parts = inPath.split("/");
		var name = parts.pop();
		var folder = parts.join("/") + (parts.length ? "/" : "");
		var delim = !name  ? "" : "-";
		var manifest = inPath + delim + 'depends.js';
		// cache the interrupted packageFolder
		inBlock.folder = packageFolder;
		// finish resolving package name for aliasing
		if (!name) {
			//name = parts.pop();
			name = folder.slice(cover.path.paths.cover.length, -1).replace(/[\/]/g, "-");
		}
		// update current folder, create a path alias for this package
		packageFolder = cover.path.paths[name] = folder;
		// cache current package name
		inBlock.package = package = name;
		//console.log("aliased package [" + package + "] to folder [" + packageFolder + "]");
		//console.log("--> Interrupting for package (" + inBlock.package + ")");
		stack.push(inBlock);
		cover.script(manifest);
	};
})();
