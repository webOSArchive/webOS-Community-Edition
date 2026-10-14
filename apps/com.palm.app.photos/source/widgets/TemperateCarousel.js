/**
 * DeltaAwaredScrollStrategy tracks the delta distance between the dragstart position and the current
 * drag position.
 */
enyo.kind({
    name: "DeltaAwaredScrollStrategy",
    kind: enyo.ScrollStrategy,
    drag: function (e) {
        this.dx = e.pageX - this.mx;
        this.dy = e.pageY - this.my;
        this.log(" ENYO PERF: TRANSITION START time: "+ Date.now());
        return this.inherited(arguments);
    }
});

/**
 * TemperateCarousel relaxes the triggering of swipe on tapping.  The enyo.Carousel is too sensitive
 * that a gentle tap often triggers a swipe.  The TemperateCarousel introduces a tappingTolerance that
 * when the dragging distance is less than the tappingTolerance, no swipe would occur.  The default
 * tappingTolerance is 40.
 */
enyo.kind({
    name: "TemperateCarousel",
    kind: enyo.Carousel,
    tappingTolerance: 40,
    tools: [ { name: "scroll", kind: "DeltaAwaredScrollStrategy" } ],
    snap: function () {     // conditionally override SnapScroller
        var scroll = this.$.scroll;
        if (!this.dragging && undefined != scroll.dx && Math.abs(scroll.dx) < this.tappingTolerance) {
            this.snapTo(this.index);
        } else {
            this.inherited(arguments);
        }
    }
});

