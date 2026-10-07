/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global console, _, Class, IMAddress, PropertyBase, FavoritablePersonField*/

var FavoritableIMAddress = PropertyBase.create({
	superClass: IMAddress,
	data: FavoritablePersonField.data
});

// Add our functions for handling the favoriteData
//_.extend(FavoritableIMAddress.prototype, FavoritablePersonField.functions);
FavoritableIMAddress.prototype.addFavoriteData = FavoritablePersonField.functions.addFavoriteData;
FavoritableIMAddress.prototype.hasFavoriteDataForAnyApp = FavoritablePersonField.functions.hasFavoriteDataForAnyApp;
FavoritableIMAddress.prototype.getFavoriteDataForAppWithId = FavoritablePersonField.functions.getFavoriteDataForAppWithId;
FavoritableIMAddress.prototype.removeFavoriteDefaultForAppWithId = FavoritablePersonField.functions.removeFavoriteDefaultForAppWithId;
FavoritableIMAddress.prototype.removeAllFavoriteData = FavoritablePersonField.functions.removeAllFavoriteData;