/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global console, _, Class, EmailAddress, PropertyBase, FavoritablePersonField*/

var FavoritableEmailAddress = PropertyBase.create({
	superClass: EmailAddress,
	data: FavoritablePersonField.data
});

// Add our functions for handling the favoriteData
//_.extend(FavoritableEmailAddress.prototype, FavoritablePersonField.functions);
FavoritableEmailAddress.prototype.addFavoriteData = FavoritablePersonField.functions.addFavoriteData;
FavoritableEmailAddress.prototype.hasFavoriteDataForAnyApp = FavoritablePersonField.functions.hasFavoriteDataForAnyApp;
FavoritableEmailAddress.prototype.getFavoriteDataForAppWithId = FavoritablePersonField.functions.getFavoriteDataForAppWithId;
FavoritableEmailAddress.prototype.removeFavoriteDefaultForAppWithId = FavoritablePersonField.functions.removeFavoriteDefaultForAppWithId;
FavoritableEmailAddress.prototype.removeAllFavoriteData = FavoritablePersonField.functions.removeAllFavoriteData;