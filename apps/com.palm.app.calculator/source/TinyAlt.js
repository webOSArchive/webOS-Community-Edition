/*global enyo, $L */ 

enyo.kind({
        name: "Calc.TinyAlt",  // A trivial four function calculator - not very usable without change sign!
        className: "calc-desktop",
        kind: "enyo.VFlexBox", pack: "center", align: "center", 
        displayLength: 9,
        components: [
            {kind: enyo.VFlexBox, className: "calc-tiny-body", components: [
                {kind: "HFlexBox", flex: 1, components: [
                        {name: "display", content: $L("0"),  flex: 5, className: "calc-display"},
                        {name: "b", kind: "Calc.bsp"}
                ]},
                {kind: "HFlexBox", flex: 1, defaultKind: "Calc.Button", components: [
                        {name: "M", caption: $L("mc"), operation: "memoryClear"},
                        {name: "a", caption: $L("m+"), operation: "memoryAdd"},
                        {name: "m", caption: $L("mr"), operation: "memoryRecall"},
                        {name: "A", caption: $L("m\u2013"), operation: "memorySubt"}
                ]},
                {kind: "HFlexBox", flex: 1, defaultKind: "Calc.Digit", components: [
                        {caption: $L("7")},
                        {caption: $L("8")},
                        {caption: $L("9")},
                        {kind: "Calc.%", name: "%"}
                ]},
                {kind: "HFlexBox", flex: 1, defaultKind: "Calc.Digit", components: [
                        {caption: $L("4")},
                        {caption: $L("5")},
                        {caption: $L("6")},
                        {kind: "Calc.q", name: "q"}
                ]},
                {kind: "HFlexBox", flex: 1, defaultKind: "Calc.Digit", components: [
                        {caption: $L("1")},
                        {caption: $L("2")},
                        {caption: $L("3")},
                        {kind: "Calc.g", name: "g"}
                ]},
                {kind: "HFlexBox", flex: 1, components: [
                        {kind: "Calc.c", name: "c"},
                        {kind: "Calc.Digit", caption: $L("0")},
                        {kind: "Calc.Digit", name: ".", caption: "."},     
                        {kind: "Calc.Button", caption: $L("="), operation: "totalOp"} 
                ]}
           ]}
        ],
        
        create: function () {
                        this.inherited(arguments);
                        var fmts = new enyo.g11n.Fmts();
                        this.$["."].setCaption(fmts.dateTimeFormatHash.numberDecimal);
                }
});