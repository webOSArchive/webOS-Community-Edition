describe('OrderedRegistry', function() {
	var arrayCompare = function(a1, a2) {
		if (a1 === a2) return true;
		if (a1.length !== a2.length) return false;
		for (var i=0; i < a1.length; i++) {
			if (a1[i] !== a2[i]) return false;
		}
		return true;
	}

	var sortFn = function(a,b) { return a-b; }
	var reg = null;
	beforeEach(function() {
		reg = new OrderedRegistry(sortFn);
		reg.put('five', 5);
		reg.put('four', 4);
		reg.put('three', 3);
		reg.put('two', 2);
		reg.put('one', 1);
	});

	it('can sort', function() {
		// If we provide a sort function (default for the test suite), 
		// then whenever we access the array, it should be properly sorted.
		expect(arrayCompare(reg.array, [1,2,3,4,5])).toBeTruthy();

		// If we don't provide a sort function, then the array won't 
		// be sorted.
		reg = new OrderedRegistry();
		reg.put('five', 5);
		reg.put('four', 4);
		reg.put('three', 3);
		reg.put('two', 2);
		reg.put('one', 1);
		expect(arrayCompare(reg.array, [1,2,3,4,5])).toBeFalsy();
 	});

	it('can remove single items', function() {
		expect(reg.hasId('five')).toBeTruthy();
		reg.removeId('five');
		expect(reg.hasId('five')).toBeFalsy();
		expect(reg.hasId('three')).toBeTruthy();
		reg.removeId('three');
		expect(reg.hasId('three')).toBeFalsy();
		expect(reg.hasId('one')).toBeTruthy();
		reg.removeId('one');
		expect(reg.hasId('one')).toBeFalsy();				
	});
	
	it('can remove multiple items', function() {
		var removed = reg.removeAllIdsExcept(['one', 'four']);
		// Only 1 and 4 should remain (in that order, since reg is sorted)
		expect(arrayCompare(reg.array, [1,4])).toBeTruthy();
		expect(removed['one']).toEqual(undefined);
		expect(removed['two']).toEqual(2);
		expect(removed['three']).toEqual(3);
		expect(removed['five']).toEqual(5);
		expect(reg.hasId('one')).toBeTruthy();
		expect(reg.hasId('two')).toBeFalsy();
		expect(reg.get('four')).toEqual(4);
	});
});
