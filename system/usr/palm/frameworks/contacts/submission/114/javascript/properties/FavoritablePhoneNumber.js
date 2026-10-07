/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global console, _, Class, PhoneNumber, PropertyBase, FavoritablePersonField */

var FavoritablePhoneNumber = PropertyBase.create({
	superClass: PhoneNumber,
	data: FavoritablePersonField.data
});

// Add our functions for handling the favoriteData
//_.extend(FavoritablePhoneNumber.prototype, FavoritablePersonField.functions);
FavoritablePhoneNumber.prototype.addFavoriteData = FavoritablePersonField.functions.addFavoriteData;
FavoritablePhoneNumber.prototype.hasFavoriteDataForAnyApp = FavoritablePersonField.functions.hasFavoriteDataForAnyApp;
FavoritablePhoneNumber.prototype.getFavoriteDataForAppWithId = FavoritablePersonField.functions.getFavoriteDataForAppWithId;
FavoritablePhoneNumber.prototype.removeFavoriteDefaultForAppWithId = FavoritablePersonField.functions.removeFavoriteDefaultForAppWithId;
FavoritablePhoneNumber.prototype.removeAllFavoriteData = FavoritablePersonField.functions.removeAllFavoriteData;
