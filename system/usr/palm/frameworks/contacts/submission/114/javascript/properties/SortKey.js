/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports, PropertyBase, Future, Assert, Person, AppPrefs, ListWidget, Utils, PalmCall, console, Globalization, RB */

/**
 * @class
 * @augments PropertyBase
 * @param {string} obj the raw database object
 * @example
 * var key = new SortKey("aaaabbbccdde1234");
 * 
 * var keyString = key.getValue();
 * var keyStringAgain = key.x_value; // This is for use in widgets. Code should always call the getter rather than accessing the property.
 */
var SortKey = exports.SortKey = PropertyBase.create({
	/**
	* @lends SortKey#
	* @property {string} x_value
	*/
	data: [
		{
			dbFieldName: "",
			defaultValue: "",
			/**
			* @name SortKey#setValue
			* @function
			* @param {string} value
			*/
			setterName: "setValue",
			/**
			* @name SortKey#getValue
			* @function
			* @returns {string}
			*/
			getterName: "getValue"
		}
	]
});


/**
 * Generates the sort key for the passed person (either wrapped or raw), first fetching the necessary params (if not passed in).  Does not store it on the person.
 * Returns a future, the result of which is also the sort key.
 */
SortKey.generateSortKey = function (person, optionalConfigParams) {
	var future = new Future(),
		configParams;
	
	//first, we get the list sort order if we weren't passed it
	future.now(function () {
		Assert.require(person, "SortKey.generateSortKey requires a person that is truthy");
		
		configParams = optionalConfigParams || {};
		
		if (configParams.listSortOrder) {
			return true;
		} else {
			var appPrefs = new AppPrefs(future.callback(function () {
				var dummy = future.result;
				
				//store away the listSortOrder
				configParams.listSortOrder = appPrefs.get(AppPrefs.Pref.listSortOrder);
				
				future.result = true;
			}));
		}
	});
	
	/*
	//then, we determine the correct value for shouldConvertToPinyin param, if we weren't passed it
	future.then(function () {
		var dummy = future.result,
			innerFuture;
		
		if (configParams.shouldConvertToPinyin !== undefined) {
			return true;
		} else {
			//fetch the value of shouldConvertToPinyin
			innerFuture = PalmCall.call("palm://com.palm.systemservice/", "getPreferences", {
				"keys": ["contactSort"]
			});
			//TODO: can this be put back in?  It causes things to not work properly if put in place...
			//innerFuture.then(function () {
			//	var result = innerFuture.result;
			//	PalmCall.cancel(innerFuture);
			//	innerFuture.result = result;
			//});
			return innerFuture;
		}
	});
	
	future.then(function () {
		var result = future.result;
				
		if (result && result.contactSort === "pinyin") {
			configParams.shouldConvertToPinyin = true;
		} else {
			//if we didn't make the request or it failed for some reason, we just assume false if we're not passed anything
			if (configParams.shouldConvertToPinyin === undefined) {
				configParams.shouldConvertToPinyin = false;
			}
		}
	});
	*/
	
	future.then(function () {
		var dummy = future.result;
		
		return SortKey._generateSortKeyFromSortOrder(person, configParams);
	});
	
	return future;
};

/**
 * Generates the sort key for the passed person (either wrapped or raw) according to the passed configParams.  Does not store it on the person.
 * Params:
 *     - listSortOrder: a string, one of the values at ListWidget.SortOrder (required)
 *     - shouldConvertToPinyin: true if the IME service exists on device and should be used to translate names from Chinese characters to pinyin, false otherwise (optional)
 * Returns a future, the result of which is the sort key.
 */
//TODO: combine this with the one above?
SortKey._generateSortKeyFromSortOrder = function (person, configParams) {
	var future = new Future(),
		givenName = "",
		familyName = "",
		companyName = "",
		displayName = "";
	
	future.now(function () {
		var name,
			company;
		
		Assert.require(person, "SortKey.generateSortKey requires a person that is truthy");
		Assert.requireObject(configParams, "SortKey.generateSortKey requires an object as the configParams");
		Assert.requireString(configParams.listSortOrder, "SortKey.generateSortKey requires a listSortOrder that is a string");
		//Assert.requireDefined(configParams.shouldConvertToPinyin, "SortKey.generateSortKey requires a shouldConvertToPinyin argument");
		
		if (person instanceof Person) {
			name = person.getName();
			if (name) {
				givenName = name.getGivenName() || "";
				familyName = name.getFamilyName() || "";
			}
			
			company = person.getOrganization();
			if (company) {
				companyName = company.getName() || "";
			}
			
			displayName = person.generateDisplayName() || "";
		} else {
			name = person.name;
			if (name) {
				givenName = name.givenName || "";
				familyName = name.familyName || "";
			}
			
			company = person.organization;
			if (company) {
				companyName = company.name || "";
			}
			
			displayName = Person.generateDisplayNameFromRawPerson(person) || "";
		}
		
		/*
		//if configParams.shouldConvertToPinyin, convert the sortkey fields from Chinese characters to pinyin
		if (configParams.shouldConvertToPinyin) {
			return SortKey._convertToPinyin(familyName, givenName, companyName, displayName);
		} else {
			return true;
		}
	});
	
	future.then(function () {
		var input = future.result,
			startRetrieveCandidateIndex, endRetrieveCandidateIndex;
		
		if (configParams.shouldConvertToPinyin) {
			// Go through each part of the result candidates array and pull out the section of the 
			// candidates array that should hold the given name part and
			// run that through our retrieveCandidateStringFromPinyinConversion function and get
			// the resulting string in pinyin.
			
			//testing, comment me out later
			//console.log(Utils.stringify(input));
			startRetrieveCandidateIndex = 0;
			endRetrieveCandidateIndex = familyName.length;
			familyName = SortKey._retrieveCandidateStringFromPinyinConversion(input.candidates.slice(startRetrieveCandidateIndex, endRetrieveCandidateIndex)); 
			
			startRetrieveCandidateIndex = endRetrieveCandidateIndex;
			endRetrieveCandidateIndex += givenName.length;
			givenName = SortKey._retrieveCandidateStringFromPinyinConversion(input.candidates.slice(startRetrieveCandidateIndex, endRetrieveCandidateIndex));
			
			startRetrieveCandidateIndex = endRetrieveCandidateIndex;
			endRetrieveCandidateIndex += companyName.length;
			companyName = SortKey._retrieveCandidateStringFromPinyinConversion(input.candidates.slice(startRetrieveCandidateIndex, endRetrieveCandidateIndex));
			
			startRetrieveCandidateIndex = endRetrieveCandidateIndex;
			endRetrieveCandidateIndex += displayName.length;
			displayName = SortKey._retrieveCandidateStringFromPinyinConversion(input.candidates.slice(startRetrieveCandidateIndex, endRetrieveCandidateIndex)); 
		}
		*/
		
		familyName = Globalization.Name.getSortName(familyName); //to sort "van der Muellen" under 'M'
		
		//TODO: get and use the basedOnField from Person.generateDisplayNameFromRawPerson and person.generateDisplayName 
		//		so that we don't use the display name if it's just the company name for persons with no first/last name
		//		(for persons that are just a company)
		return SortKey._generateSortKeyHelper(configParams, givenName, familyName, companyName, displayName);
	});
	return future;
};

/*
SortKey._retrieveCandidateStringFromPinyinConversion = function (candidates) {
	var toReturn = "";
	
	candidates.forEach(function (candidate) {
		if ("<unknown>" !== candidate) {
			toReturn = toReturn.concat(candidate);
		}
	});
	
	return toReturn;
};

//convert the unicode string to its pinyin value, input should be like "\u6885" for single character
//or "\u6885", "\u6778" for words.
SortKey._convertToPinyin = function (familyName, givenName, companyName, displayName) {
	var convertedCharacterArray = [],
		innerFuture;
	
	//familyName
	convertedCharacterArray = convertedCharacterArray.concat(SortKey._convertToPinyinHelper(familyName));
	
	//givenName	
	convertedCharacterArray = convertedCharacterArray.concat(SortKey._convertToPinyinHelper(givenName));
	
	//companyName
	convertedCharacterArray = convertedCharacterArray.concat(SortKey._convertToPinyinHelper(companyName));
	
	//displayName
	convertedCharacterArray = convertedCharacterArray.concat(SortKey._convertToPinyinHelper(displayName));
	
	//console.log("rui: the uniString to convert is" + arrayChar.toString());
	if (convertedCharacterArray.length > 0) {
		innerFuture = PalmCall.call("palm://com.palm.ime/", "lookupWords", {
			"unicode": convertedCharacterArray
		});
		innerFuture.then(function () {
			var result = innerFuture.result;
			PalmCall.cancel(innerFuture);
			innerFuture.result = result;
		});
		return innerFuture;
	} 
	
	return true;

};

SortKey._convertToPinyinHelper = function (stringToConvert) {
	var charArray = stringToConvert.split(""),
		toReturn = [],
		hexString = "\\u";
	
	charArray.forEach(function (character) {
		var charToPush = character;
		//if it's ASCII character, we don't use unicode string presentation, just
		//pass as is and expect IME to return as is
		
		if (character.charCodeAt(0) > 128) {
			charToPush = hexString.concat(character.charCodeAt(0).toString(16));
		} else {
			if (character === '"') {
				var charSpecial = "\\";
				charToPush = charSpecial.concat(character);
			}			
		}
		
		toReturn.push(charToPush);
	});
	
	return toReturn;
};
*/

/**
 * PRIVATE
 * Contains the actual logic for generating a sort key from various strings according to the passed list sort order.
 * Returns the sort key as a string.
 */
SortKey._generateSortKeyHelper = function (configParams, givenName, familyName, companyName, displayName) {
	var listSortOrder = configParams.listSortOrder,
		sortKey = "",
		sortKeyDefaultItem = SortKey.DEFAULT_CHAR + SortKey.DEFAULT_CHAR,
		sortKeyDelimiter = "\t",
		firstChar;
	
	givenName = givenName || "";
	familyName = familyName || "";
	companyName = companyName || "";
	displayName = displayName || "";
	
	givenName = givenName.trim();
	familyName = familyName.trim();
	companyName = companyName.trim();
	displayName = displayName.trim();
	
	//first, if the list order says to, append the company name
	if (listSortOrder === ListWidget.SortOrder.companyLastFirst || listSortOrder === ListWidget.SortOrder.companyFirstLast) {
		sortKey += companyName || sortKeyDefaultItem; //if they don't have a company name, sort them to the bottom using the sortKeyDefaultItem
		sortKey += sortKeyDelimiter;
	}
	
	//append either first/last (in the correct order) or the display name
	if (givenName || familyName) {
		if (listSortOrder === ListWidget.SortOrder.companyFirstLast || listSortOrder === ListWidget.SortOrder.firstLast) {
			if (givenName) {
				sortKey += givenName + sortKeyDelimiter;
			}
			if (familyName) {
				sortKey += familyName + sortKeyDelimiter;
			}
		} else {
			//if (listSortOrder === ListWidget.SortOrder.companyLastFirst || listSortOrder === ListWidget.SortOrder.lastFirst)
			//this is the default (ListWidget.SortOrder.lastFirst)
			if (familyName) {
				sortKey += familyName + sortKeyDelimiter;
			}
			if (givenName) {
				sortKey += givenName + sortKeyDelimiter;
			}
		}
	} else {
		sortKey += displayName + sortKeyDelimiter;
	}
	
	sortKey = sortKey.trim();
	//if we have a sortKey at this point, see if we need to prepend the SortKey.DEFAULT_CHAR so that numbered items fall to the bottom.
	//else, generate a default sortKey
	if (sortKey) {
		firstChar = sortKey.charAt(0);
		if (firstChar !== SortKey.DEFAULT_CHAR && firstChar !== sortKeyDelimiter && !Globalization.Character.isLetter(firstChar)) {
			sortKey = SortKey.DEFAULT_CHAR + sortKey;
		}
	} else {
		sortKey = sortKeyDefaultItem;
	}
	
	return sortKey.toLocaleLowerCase().trim();
};

Utils.defineConstant("DEFAULT_CHAR", "\uFAD7", SortKey);
Utils.defineConstant("DEFAULT_NAME_DIVIDER_TEXT", "#", SortKey);
Utils.defineConstant("DEFAULT_COMPANY_DIVIDER_TEXT", RB.$L("None"), SortKey);
