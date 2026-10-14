enyo.depends(
	"$enyo-lib/printdialog/",
	"$enyo-lib/accounts/",
	
	"source/hacks/MonkeyPatching.js",
	
	"css/NonCssParams.js",
	
	"source/base/MethodWrapper.js",
	"source/base/G11N.js",
	"source/base/QuickGuid.js",	
	"source/base/ModelViewer.js",
	"source/base/ThrottledTimeout.js",
	"source/base/OrderedRegistry.js",

	"source/services/AlbumLocalizationHackDbService.js", 	
	"source/services/CloudAccounts.js",
	"source/services/PhotoAccounts.js",
	"source/services/CapabilitiesFetcher.js",
	"source/services/PhotosAndVideosService.js",
	"source/services/WallpaperManager.js",
	
	"source/widgets/PhotoSelection.js",
	"source/widgets/TaskGroup.js",
	"source/widgets/PanelHeader.js", "css/PanelHeader.css",
	"source/widgets/LibraryNavigationPanel.js", "css/LibraryNavigationPanel.css",
	"source/widgets/UnifiedGrid.js",
	"source/widgets/AlbumPickerPopup.js",
	"source/widgets/LocalAlbumPickerPopup.js",
	"source/widgets/AlbumCreationPopup.js",
	"source/widgets/MessageDialog.js", "css/MessageDialog.css",
	"source/widgets/VideoSymbolBar.js", "css/VideoSymbolBar.css",
	"source/widgets/SwipeTransition.js",
	"source/widgets/SlideshowPlayList.js",
	"source/widgets/AlbumSelectionDrawer.js",
	"source/widgets/PanePlusPlus.js",
	"source/widgets/TemperateCarousel.js",
	
	"css/Photos.css",
	"source/Library.js",
	"source/Album.js",
	
	"source/AlbumView.js",
	"source/AlbumGridView.js",
	"source/DbImageView.js",

	"source/DbViewVideo.js", "css/VideoControl.css",
	
	"source/modes/LibraryMode.js", "css/LibraryMode.css",
	"source/AlbumModeMultiselectControls.js",
	"source/modes/AlbumMode.js", "css/AlbumMode.css",
	"source/modes/PictureMode.js", "css/PictureMode.css",
	"source/modes/SlideshowMode.js", "css/SlideshowMode.css",
	
	"source/form-factors/TabletUI.js",
	"source/form-factors/PhotoAppLauncher.js",
	
	"source/services/ServiceInterface.js",
	"source/services/MojoDbService.js",
	"source/services/LunaServiceInterface.js",

	
	"source/widgets/PictureComments.js", "css/PictureComments.css",
	
	"source/services/MockMojoDbService.js",
	"source/services/MockSlideshowPlayList.js"
);
