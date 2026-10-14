describe('PhotoSelection', function() {
	it('should work perfectly', function() {
		var sel = new PhotoSelection();
		var entries = [
			{_id: 0, mediaType: 'image'},
			{_id: 1, mediaType: 'image'},
			{_id: 2, mediaType: 'image'},
			{_id: 3, mediaType: 'image'},
			{_id: 4, mediaType: 'image'},
			{_id: 5, mediaType: 'image'},
			{_id: 6, mediaType: 'video'},
			{_id: 7, mediaType: 'video'},
			{_id: 8, mediaType: 'video'},
			{_id: 9, mediaType: 'video'}
		];
		
		// Freshly initialized.
		expect(sel.imageCount()).toEqual(0);
		expect(sel.videoCount()).toEqual(0);
		
		// Pretend that 6 of images were added to the DB (no videos).
		sel.setTotalImageAndVideoCount(6, 0);
		expect(sel.imageCount()).toEqual(0);
		expect(sel.videoCount()).toEqual(0);
		expect(sel.totalCount()).toEqual(0);
		
		// Nothing should be selected yet.
		entries.slice(0,6).forEach(function(e) {
			expect(sel.isSelected(e)).toEqual(false);
		});
		
		// Add some to the selection.
		entries.slice(0,3).forEach(function(e) {
			expect(sel.isSelected(e)).toEqual(false);
			sel.select(e);
			expect(sel.isSelected(e)).toEqual(true);
		});
		expect(sel.imageCount()).toEqual(3);
		expect(sel.videoCount()).toEqual(0);
		expect(sel.totalCount()).toEqual(3);

		expect(sel.areAllSelected()).toEqual(false);
		
		// Add the same ones to the selection; nothing should change.
		entries.slice(0,3).forEach(function(e) {
			sel.select(e);
			expect(sel.isSelected(e)).toEqual(true);
		});
		expect(sel.imageCount()).toEqual(3);
		expect(sel.videoCount()).toEqual(0);
		expect(sel.totalCount()).toEqual(3);
		expect(sel.areAllSelected()).toEqual(false);
		
		// Select everything.
		sel.selectAll();
		entries.slice(0,6).forEach(function(e) {
			expect(sel.isSelected(e)).toEqual(true);
		});
		expect(sel.imageCount()).toEqual(6);
		expect(sel.videoCount()).toEqual(0);
		expect(sel.totalCount()).toEqual(6);
		expect(sel.areAllSelected()).toEqual(true);
		
		// Pretend that the first 2 videos are now added to the DB.
		sel.setTotalImageAndVideoCount(6,2);
		expect(sel.imageCount()).toEqual(6);
		expect(sel.videoCount()).toEqual(2);
		expect(sel.totalCount()).toEqual(8);
		expect(sel.areAllSelected()).toEqual(true);
		
		// Deselect one video.
		sel.deselect(entries[7]);
		expect(sel.imageCount()).toEqual(6);
		expect(sel.videoCount()).toEqual(1);
		expect(sel.totalCount()).toEqual(7);
		expect(sel.isSelected(entries[6])).toEqual(true);
		expect(sel.isSelected(entries[7])).toEqual(false);	
		expect(sel.areAllSelected()).toEqual(false);
		
		// Add the video back.
		
		//sel.toggle(entries[7]);
		sel.select(entries[7]);
		expect(sel.videoCount()).toEqual(2);
		expect(sel.totalCount()).toEqual(8);
		expect(sel.isSelected(entries[7])).toEqual(true);
		expect(sel.areAllSelected()).toEqual(true);
		
		// done
		sel.destroy();
	});
	
if (enyo.args.test_limitations) {	
	it('has some known limitations, documented here', function() {
		var sel = new PhotoSelection();
		var entries = [
			{_id: 0, mediaType: 'image'},
			{_id: 1, mediaType: 'image'},
			{_id: 2, mediaType: 'image'},
			{_id: 3, mediaType: 'image'},
			{_id: 4, mediaType: 'image'},
			{_id: 5, mediaType: 'image'},
			{_id: 6, mediaType: 'video'},
			{_id: 7, mediaType: 'video'},
			{_id: 8, mediaType: 'video'},
			{_id: 9, mediaType: 'video'}
		];
		
		// Pretend that all 6 images and 4 videos are added.
		// This works OK...
		sel.setTotalImageAndVideoCount(6,4);
		sel.selectAll();
		expect(sel.imageCount()).toEqual(6);
		expect(sel.videoCount()).toEqual(4);
		entries.forEach(function(e) {
			expect(sel.isSelected(e)).toEqual(true);
		});
		
		// .. however, now assume that two videos have been removed from the DB
		// (let's say the first two).  It breaks!  Since we did selectAll(), we
		// inverted the selection, and therefore everything not explicitly identified
		// as unselected is considered to be selected.
		sel.setTotalImageAndVideoCount(6,2);
		expect(sel.imageCount()).toEqual(6);
		expect(sel.videoCount()).toEqual(2);
		expect(sel.isSelected(entries[6])).toEqual(false);
		expect(sel.isSelected(entries[7])).toEqual(false);
		// To illustrate this even more clearly, consider entry 9, which
		// we never pretended was added to the DB.
		expect(sel.isSelected(entries[9])).toEqual(false);
		// We could go on and on.  
	});
}
	
});