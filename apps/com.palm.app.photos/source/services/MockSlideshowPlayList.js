
enyo.kind({
    name: "MockSlideshowPlayList",
    kind: "SlideshowPlayList",
    components: [],

    constructor: function () {
        this.inherited(arguments);
        this.albums = this.mockAlbums;
        this.photos = this.mockPhotos;
        this.playList = undefined;
    },

    reset: function (selAlbumIds, firstAlbumReadyCallback) {
        if (window.PalmSystem) { return; }  // should never be run from the device

        this.resetAlbumsSelection(selAlbumIds);
        this.resetPlayList();
        this.doNextChain(firstAlbumReadyCallback);

/*
        var thisInst = this;
        if (firstAlbumReadyCallback) {
            setTimeout(function () {
                thisInst.doNextChain(firstAlbumReadyCallback);
            }, 400);
        }
*/
    },

    /**
     * @see SlideshowPlayList._createSrcRepresentation()
     */
    _createSrcRepresentation: function (index) {
        var item = this.playList[index];
        var src = {
            playListIndex: index,
            albumId: item.album.albumId,
            pictId:  item.pict.pictId,
            path:    item.pict.screenNailPath
        };
        return src;
    },

    mockAlbums: {
        ids: [
            "++HLSdeoYRKhOpM_",
            "++HLSdeoFancy_",
            "++HLSdeoBurns_"
        ],
        meta: {
            "++HLSdeoYRKhOpM_": {
                albumId:     "++HLSdeoYRKhOpM_",
                title:       "Peeps",
                photosCount: 33,
                fetchedCount: 33,
                isSelected:  true
            },
            "++HLSdeoFancy_": {
                albumId:     "++HLSdeoFancy_",
                title:       "Fancy",
                photosCount: 22,
                fetchedCount: 22,
                isSelected:  true
            },
            "++HLSdeoBurns_": {
                albumId:     "++HLSdeoBurns_",
                title:       "Burns",
                photosCount: 3,
                fetchedCount: 3,
                isSelected:  true
            }
        }
    },
    mockPhotos: {
        "++HLSdeoYRKhOpM_": {
            "++HQ9UtxxYhPmTFf": {
                pictId:         "++HQ9UtxxYhPmTFf",
                screenNailPath: "mock/images/Peeps/126-2626_IMG.jpg",
                originalPath:   "mock/images/Peeps/126-2626_IMG.jpg",
                cached:         true
            },
            "++HQ9Utxyg3EjM17": {
                pictId:         "++HQ9Utxyg3EjM17",
                screenNailPath: "mock/images/Peeps/126-2636_IMG.jpg",
                originalPath:   "mock/images/Peeps/126-2636_IMG.jpg",
                cached:         true
            },
            "++HQ9UtxzqOx7ccW": {
                pictId:         "++HQ9UtxzqOx7ccW",
                screenNailPath: "mock/images/Peeps/DSCN0127.jpg",
                originalPath:   "mock/images/Peeps/DSCN0127.jpg",
                cached:         true
            },
            "++HQ9Uty0W33JFt5": {
                pictId:         "++HQ9Uty0W33JFt5",
                screenNailPath: "mock/images/Peeps/DSCN0140.jpg",
                originalPath:   "mock/images/Peeps/DSCN0140.jpg",
                cached:         true
            },
            "++HQ9Uty1n0O+8V6": {
                pictId:         "++HQ9Uty1n0O+8V6",
                screenNailPath: "mock/images/Peeps/DSCN0239.jpg",
                originalPath:   "mock/images/Peeps/DSCN0239.jpg",
                cached:         true
            },
            "++HQ9Uty2rdjzFoo": {
                pictId:         "++HQ9Uty2rdjzFoo",
                screenNailPath: "mock/images/Peeps/DSCN0605.jpg",
                originalPath:   "mock/images/Peeps/DSCN0605.jpg",
                cached:         true
            },
            "++HQ9Uty3uJmz9SS": {
                pictId:         "++HQ9Uty3uJmz9SS",
                screenNailPath: "mock/images/Peeps/DSCN0786.jpg",
                originalPath:   "mock/images/Peeps/DSCN0786.jpg",
                cached:         true
            },
            "++HQ9Uty4ywzUwYH": {
                pictId:         "++HQ9Uty4ywzUwYH",
                screenNailPath: "mock/images/Peeps/IMG_0684.jpg",
                originalPath:   "mock/images/Peeps/IMG_0684.jpg",
                cached:         true
            },
            "++HQ9Uty60cS09qY": {
                pictId:         "++HQ9Uty60cS09qY",
                screenNailPath: "mock/images/Peeps/IMG_0703.jpg",
                originalPath:   "mock/images/Peeps/IMG_0703.jpg",
                cached:         true
            },
            "++HQ9Uty73KqxwXV": {
                pictId:         "++HQ9Uty73KqxwXV",
                screenNailPath: "mock/images/Peeps/IMG_0947.jpg",
                originalPath:   "mock/images/Peeps/IMG_0947.jpg",
                cached:         true
            },
            "++HQ9Uty860mNKlO": {
                pictId:         "++HQ9Uty860mNKlO",
                screenNailPath: "mock/images/Peeps/IMG_2083.jpg",
                originalPath:   "mock/images/Peeps/IMG_2083.jpg",
                cached:         true
            },
            "++HQ9Uty9vGYQP+T": {
                pictId:         "++HQ9Uty9vGYQP+T",
                screenNailPath: "mock/images/Peeps/IMG_2143.jpg",
                originalPath:   "mock/images/Peeps/IMG_2143.jpg",
                cached:         true
            },
            "++HQ9UtyB4Zlec2z": {
                pictId:         "++HQ9UtyB4Zlec2z",
                screenNailPath: "mock/images/Peeps/IMG_2148.jpg",
                originalPath:   "mock/images/Peeps/IMG_2148.jpg",
                cached:         true
            },
            "++HQ9UtyC7FS7BvB": {
                pictId:         "++HQ9UtyC7FS7BvB",
                screenNailPath: "mock/images/Peeps/IMG_2182.jpg",
                originalPath:   "mock/images/Peeps/IMG_2182.jpg",
                cached:         true
            },
            "++HQ9UtyD9wYkaJK": {
                pictId:         "++HQ9UtyD9wYkaJK",
                screenNailPath: "mock/images/Peeps/IMG_2186.jpg",
                originalPath:   "mock/images/Peeps/IMG_2186.jpg",
                cached:         true
            },
            "++HQ9UtyECdrnu+e": {
                pictId:         "++HQ9UtyECdrnu+e",
                screenNailPath: "mock/images/Peeps/IMG_2189.jpg",
                originalPath:   "mock/images/Peeps/IMG_2189.jpg",
                cached:         true
            },
            "++HQ9UtyFipFg1sQ": {
                pictId:         "++HQ9UtyFipFg1sQ",
                screenNailPath: "mock/images/Peeps/IMG_2195.jpg",
                originalPath:   "mock/images/Peeps/IMG_2195.jpg",
                cached:         true
            },
            "++HQ9UtyH+kBwVis": {
                pictId:         "++HQ9UtyH+kBwVis",
                screenNailPath: "mock\/images\/Peeps\/IMG_2861.jpg",
                originalPath:   "mock\/images\/Peeps\/IMG_2861.jpg",
                cached:         true
            },
            "++HQ9UtyI4J9wIqG": {
                pictId:         "++HQ9UtyI4J9wIqG",
                screenNailPath: "mock/images/Peeps/IMG_3341.jpg",
                originalPath:   "mock/images/Peeps/IMG_3341.jpg",
                cached:         true
            },
            "++HQ9UtyJtZNbtIq": {
                pictId:         "++HQ9UtyJtZNbtIq",
                screenNailPath: "mock/images/Peeps/IMG_3393.jpg",
                originalPath:   "mock/images/Peeps/IMG_3393.jpg",
                cached:         true
            },
            "++HQ9UtyL4l6aO2r": {
                pictId:         "++HQ9UtyL4l6aO2r",
                screenNailPath: "mock/images/Peeps/IMG_3448.jpg",
                originalPath:   "mock/images/Peeps/IMG_3448.jpg",
                cached:         true
            },
            "++HQ9UtyM9NRa1hZ": {
                pictId:         "++HQ9UtyM9NRa1hZ",
                screenNailPath: "mock/images/Peeps/IMG_3504.jpg",
                originalPath:   "mock/images/Peeps/IMG_3504.jpg",
                cached:         true
            },
            "++HQ9UtyNE0xLm6C": {
                pictId:         "++HQ9UtyNE0xLm6C",
                screenNailPath: "mock/images/Peeps/IMG_3508.jpg",
                originalPath:   "mock/images/Peeps/IMG_3508.jpg",
                cached:         true
            },
            "++HQ9UtyOnxKe+e1": {
                pictId:         "++HQ9UtyOnxKe+e1",
                screenNailPath: "mock/images/Peeps/IMG_3541.jpg",
                originalPath:   "mock/images/Peeps/IMG_3541.jpg",
                cached:         true
            },
            "++HQ9UtyQAdDI3LI": {
                pictId:         "++HQ9UtyQAdDI3LI",
                screenNailPath: "mock/images/Peeps/IMG_3542.jpg",
                originalPath:   "mock/images/Peeps/IMG_3542.jpg",
                cached:         true
            },
            "++HQ9UtyRH7qMdbF": {
                pictId:         "++HQ9UtyRH7qMdbF",
                screenNailPath: "mock/images/Peeps/IMG_3545.jpg",
                originalPath:   "mock/images/Peeps/IMG_3545.jpg",
                cached:         true
            },
            "++HQ9UtySLl+0Fr8": {
                pictId:         "++HQ9UtySLl+0Fr8",
                screenNailPath: "mock/images/Peeps/IMG_3772.jpg",
                originalPath:   "mock/images/Peeps/IMG_3772.jpg",
                cached:         true
            },
            "++HQ9UtyTcdyo3nD": {
                pictId:         "++HQ9UtyTcdyo3nD",
                screenNailPath: "mock/images/Peeps/IMG_4262.jpg",
                originalPath:   "mock/images/Peeps/IMG_4262.jpg",
                cached:         true
            },
            "++HQ9UtyVVgfPuUj": {
                pictId:         "++HQ9UtyVVgfPuUj",
                screenNailPath: "mock/images/Peeps/IMG_4288.jpg",
                originalPath:   "mock/images/Peeps/IMG_4288.jpg",
                cached:         true
            },
            "++HQ9UtyWd8QqsAw": {
                pictId:         "++HQ9UtyWd8QqsAw",
                screenNailPath: "mock/images/Peeps/IMG_4515.jpg",
                originalPath:   "mock/images/Peeps/IMG_4515.jpg",
                cached:         true
            },
            "++HQ9UtyXrG8Gvq4": {
                pictId:         "++HQ9UtyXrG8Gvq4",
                screenNailPath: "mock/images/Peeps/IMG_4516.jpg",
                originalPath:   "mock/images/Peeps/IMG_4516.jpg",
                cached:         true
            },
            "++HQ9UtyYvpd95UP": {
                pictId:         "++HQ9UtyYvpd95UP",
                screenNailPath: "mock/images/Peeps/IMG_4521.jpg",
                originalPath:   "mock/images/Peeps/IMG_4521.jpg",
                cached:         true
            },
            "++HQ9Uty_1K1SCFA": {
                pictId:         "++HQ9Uty_1K1SCFA",
                screenNailPath: "mock/images/Peeps/IMG_4917.jpg",
                originalPath:   "mock/images/Peeps/IMG_4917.jpg",
                cached:         true
            }
        },
        "++HLSdeoFancy_": {
            "++HQ9UtxxYhPmX02": {
                pictId:         "++HQ9UtxxYhPmX02",
                screenNailPath: "mock/images/Fancy/P001.jpg",
                originalPath:   "mock/images/Fancy/P001.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX04": {
                pictId:         "++HQ9UtxxYhPmX04",
                screenNailPath: "mock/images/Fancy/P002.jpg",
                originalPath:   "mock/images/Fancy/P002.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX05": {
                pictId:         "++HQ9UtxxYhPmX05",
                screenNailPath: "mock/images/Fancy/P003.jpg",
                originalPath:   "mock/images/Fancy/P003.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX06": {
                pictId:         "++HQ9UtxxYhPmX06",
                screenNailPath: "mock/images/Fancy/P004.jpg",
                originalPath:   "mock/images/Fancy/P004.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX08": {
                pictId:         "++HQ9UtxxYhPmX08",
                screenNailPath: "mock/images/Fancy/P005.jpg",
                originalPath:   "mock/images/Fancy/P005.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX09": {
                pictId:         "++HQ9UtxxYhPmX09",
                screenNailPath: "mock/images/Fancy/P006.jpg",
                originalPath:   "mock/images/Fancy/P006.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX10": {
                pictId:         "++HQ9UtxxYhPmX10",
                screenNailPath: "mock/images/Fancy/P007.jpg",
                originalPath:   "mock/images/Fancy/P007.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX11": {
                pictId:         "++HQ9UtxxYhPmX11",
                screenNailPath: "mock/images/Fancy/P008.jpg",
                originalPath:   "mock/images/Fancy/P008.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX12": {
                pictId:         "++HQ9UtxxYhPmX12",
                screenNailPath: "mock/images/Fancy/P009.jpg",
                originalPath:   "mock/images/Fancy/P009.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX17": {
                pictId:         "++HQ9UtxxYhPmX17",
                screenNailPath: "mock/images/Fancy/P010.jpg",
                originalPath:   "mock/images/Fancy/P010.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX18": {
                pictId:         "++HQ9UtxxYhPmX18",
                screenNailPath: "mock/images/Fancy/P011.jpg",
                originalPath:   "mock/images/Fancy/P011.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX19": {
                pictId:         "++HQ9UtxxYhPmX19",
                screenNailPath: "mock/images/Fancy/P012.jpg",
                originalPath:   "mock/images/Fancy/P012.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX20": {
                pictId:         "++HQ9UtxxYhPmX20",
                screenNailPath: "mock/images/Fancy/P013.jpg",
                originalPath:   "mock/images/Fancy/P013.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX21": {
                pictId:         "++HQ9UtxxYhPmX21",
                screenNailPath: "mock/images/Fancy/P014.jpg",
                originalPath:   "mock/images/Fancy/P014.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX22": {
                pictId:         "++HQ9UtxxYhPmX22",
                screenNailPath: "mock/images/Fancy/P015.jpg",
                originalPath:   "mock/images/Fancy/P015.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX23": {
                pictId:         "++HQ9UtxxYhPmX23",
                screenNailPath: "mock/images/Fancy/P016.jpg",
                originalPath:   "mock/images/Fancy/P016.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX24": {
                pictId:         "++HQ9UtxxYhPmX24",
                screenNailPath: "mock/images/Fancy/P017.jpg",
                originalPath:   "mock/images/Fancy/P017.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX25": {
                pictId:         "++HQ9UtxxYhPmX25",
                screenNailPath: "mock/images/Fancy/P018.jpg",
                originalPath:   "mock/images/Fancy/P018.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX26": {
                pictId:         "++HQ9UtxxYhPmX26",
                screenNailPath: "mock/images/Fancy/P019.jpg",
                originalPath:   "mock/images/Fancy/P019.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX27": {
                pictId:         "++HQ9UtxxYhPmX27",
                screenNailPath: "mock/images/Fancy/P020.jpg",
                originalPath:   "mock/images/Fancy/P020.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX28": {
                pictId:         "++HQ9UtxxYhPmX28",
                screenNailPath: "mock/images/Fancy/P021.jpg",
                originalPath:   "mock/images/Fancy/P021.jpg",
                cached:         true
            },
            "++HQ9UtxxYhPmX29": {
                pictId:         "++HQ9UtxxYhPmX29",
                screenNailPath: "mock/images/Fancy/P022.jpg",
                originalPath:   "mock/images/Fancy/P022.jpg",
                cached:         true
            }
        },
        "++HLSdeoBurns_": {
			"++HLSdeoBurn_photo1": {
			    pictId:         "++HLSdeoBurn_photo1",
			    screenNailPath: "mock/images/Burns/Laser.jpg",
			    originalPath:   "mock/images/Burns/Laser.jpg",
                cached:         true
		    },
			"++HLSdeoBurn_photo2": {
			    pictId:         "++HLSdeoBurn_photo2",
			    screenNailPath: "mock/images/Burns/Sunrise.jpg",
			    originalPath:   "mock/images/Burns/Sunrise.jpg",
                cached:         true
		    },
			"++HLSdeoBurn_photo3": {
			    pictId:         "++HLSdeoBurn_photo3",
			    screenNailPath: "mock/images/Burns/TempleOfGravity.jpg",
			    originalPath:   "mock/images/Burns/TempleOfGravity.jpg",
                cached:         true
		    }
        }
    }
});
