/*jslint white: true, onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, 
regexp: true, newcap: true, immed: true, nomen: false, maxerr: 500 */
/*global exports _*/

var FavoritablePersonField = {};

FavoritablePersonField.data = [{
		dbFieldName: "favoriteData",
		defaultValue: {},
		/**
		* @name FavoritablePersonField#setFavoriteData
		* @function
		* @param {object} favoriteData
		*/
		setterName: "setFavoriteData",
		/**
		* @name FavoritablePersonField#getFavoriteData
		* @function
		* @returns {object}
		*/
		getterName: "getFavoriteData"
	}
];

FavoritablePersonField.functions = {
	addFavoriteData: function (applicationId, favoriteData) {
		this.getFavoriteData()[applicationId] = favoriteData;
	},
	
	hasFavoriteDataForAnyApp: function () {
		return _.keys(this.getFavoriteData()).length ? true : false; 
	},
	
	getFavoriteDataForAppWithId: function (applicationId) {
		return this.getFavoriteData()[applicationId];
	},
	
	removeFavoriteDefaultForAppWithId: function (applicationId) {
		this.getFavoriteData()[applicationId] = undefined;
	},
	
	removeAllFavoriteData: function () {
		this.setFavoriteData({});
	}
};