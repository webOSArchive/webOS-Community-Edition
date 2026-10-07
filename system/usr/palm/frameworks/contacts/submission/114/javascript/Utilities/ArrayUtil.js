/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global */

var ArrayUtil = {
	pushAll: function (dst, src) {
		var i;
		for (i = 0; i < src.length; i += 1) {
			dst.push(src[i]);
		}
		return dst;
	},

	// Remove the first occurance of toRemove from
	// the src array.
	removeValue: function (src, toRemove) {
		var i,
			found = false;
		for (i = 0; i < src.length; i += 1) {
			if (src[i] === toRemove) {
				src.splice(i, 1);
				found = true;
				return found;
			}
		}
	
		return found;
	},

	copyOfArray: function (src) {
		var toReturn = [],
			i;
	
		if (src) {
	
			for (i = 0; i < src.length; i += 1) {
				toReturn[i] = src[i];
			}
		}
	
		return toReturn;
	}
};
