/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, _, Class, Assert, JSON, Utils, DB, PalmCall, console, palmPutResource, require, Foundations, ContactBackupHash, PropertyArray, DefaultPropertyHash, Contact, ContactLinkable, VCard */

// This is here because file IO stuff is kinda in an unknown state right now
var VCardFileWriter = Class.create({
	/** @lends vCardFileWriter#*/
	
	/**
	 * This defines a decorated FavoriteBackup.  This object hides the raw FavoriteBackup data and exposes methods for accessing decorated
	 * property objects for which getters/setters can be called.  These decorated properties also hide raw data, and can be passed 
	 * directly to framework widgets.
	 * @constructs
	 * @param {Object} rawFavoriteBackup - raw favoriteBackup object
	 * @example
	 * var favoriteBackup = new FavoriteBackup({
	 *                     contactBackupHash: 3XC8|local,
	 *                     defaultPropertyHashes: [{
	 *                          value: FEF89&wef,jfew9823,
	 *                          type: "PhoneNumber" }] 
	 *                });
	 * 
	 * var favoriteBackupContactHash = favoriteBackup.getContactBackupHash();
	 * var favoriteBackupDefaultPhoneNumber = favoriteBackup.getDefaultPhoneNumber();
	 */
	initialize: function (obj) {
		if (!obj || !obj.filePath) {
			throw new Error("Must create VCardFileWriter with an object containing filePath");
		}
		
		this.fileName = obj.filePath;
		
		this.fileHandler = { fileName: this.fileName, 
							fileOutput: "",
							charset: VCard.CHARSET.UTF8, 
							writeLine: function (line) {
								this.fileOutput += line + "\n";
							},
							close: function (path) {
								var usePath = path || this.fileName,
									fs;
									
								try {
									if (Foundations.EnvironmentUtils.isNode()) {
										fs = require('fs');
										fs.writeFileSync(usePath, this.fileOutput, 'utf8');
									} else {
										palmPutResource(usePath, this.fileOutput);
									}
									
									this.fileOutput = "";
									return true;
								} catch (e) {
									console.log("Writing file failed!");
									console.log(e.stack);
									throw e;
								}
							}
						};
	},

	/**
	 * Resets the output for the file
	 */
	open: function () {
		this.fileHandler.fileOutput = "";
	},

	/**
	 * Writes out a line to the file handler associated with this object
	 */
	writeLine: function (line) {
		this.fileHandler.writeLine(line);
	},
	
	getSize: function () {
		// If charset is not ascii then get the size in bytes
		if (this.charset !== VCard.CHARSET.ASCII) {
			return encodeURIComponent(this.fileHandler.fileOutput).replace(/%[A-F\d]{2}/g, 'U').length;
		} else {
			return this.fileHandler.fileOutput.length;
		}
	},

	/**
	  * Writes out the file and clears out the output
	  */
	close: function (path) {
		return this.fileHandler.close(path);
	}
});
