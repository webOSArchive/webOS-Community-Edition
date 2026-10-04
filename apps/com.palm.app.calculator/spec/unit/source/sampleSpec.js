describe("Javascript", function () {
	it("should know that one equals one", function() {
	  expect(1).toEqual(1);
	});
});


describe("Enyo", function () {
	it("should be present", function() {
	  var component = new enyo.Component({ name: "testComponent" });
		expect(component.name).toEqual("testComponent");
	});
});