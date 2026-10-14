describe('Test MojoDbService', function() {

	var testee;
	
	beforeEach(function() {
		testee = enyo.create({kind: "MojoDbService"});
	});

	
	it('verifying implementation of gotAlbumData() for valid data set', function() {
			var testData={"results": [
				{
					"_id": "++HLSdeoYRKhOpM_",
					"_kind": "com.palm.media.image.album:1",
					"name": "Peeps",
					"path": "mock\/images\/Peeps",
					"total": {
						"images": 29,
						"videos": 7
					}
				},
				{
					"_id": "++BLASkfgjkfl_",
					"_kind": "com.palm.media.image.album:1",
					"name": "Non Peeps",
					"path": "mock\/images\/NonPeeps",
		        	"total": {
						"images": 2,
						"videos": 3
					}
				}	
			]};
				
			spyOn(testee,'receiveCreateAlbums');
			testee.gotAlbumData({},testData);
					           
			expect(testee.receiveCreateAlbums).toHaveBeenCalledWith([{title:'Peeps',description:"Collection from device",guid:"++HLSdeoYRKhOpM_",type:"local",photoCount:29, videoCount: 7,dbEntry:testData.results[0]},
				 							                         {title:'Non Peeps',description:"Collection from device",guid:"++BLASkfgjkfl_",type:"local",photoCount:2, videoCount: 3, dbEntry: testData.results[1]} ]);
 		});
		it('verifying implementation of gotAlbumData() for empty data set', function() {
			
			var testData={"results":[]};
				
			spyOn(testee,'receiveCreateAlbums');
			testee.gotAlbumData({},testData);
					           
			expect(testee.receiveCreateAlbums).not.toHaveBeenCalled();
		});

		it('verifying valid album guid is being sent ', function() {
			
			
			var albumid=testee.getAlbumGuid('1234');
			expect(albumid).toEqual('album-1234');
			
		});
});
