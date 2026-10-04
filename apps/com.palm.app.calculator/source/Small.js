/*global enyo, $L */ 

enyo.kind({
        name: "Calc.Small",  // A simple full screen layout
        className: "calc-desktop",
        kind: "enyo.VFlexBox", pack: "center", align: "center", 
        displayLength: 12,    // Max digits displayable, including sign, leading zero, and exponent. Don't overflow this.
        components: [
                     {kind: enyo.VFlexBox, className: "calc-small-body", components: [
                {kind: "HFlexBox", flex: 1, className: "calc-display", components: [
                        {name: "display", content: $L("0"),  flex: 5 },
                                                {kind: "HFlexBox", flex:1, align:"center", pack:"center", components: [ 
                        {name: "b", kind: "Calc.bsp"} ]}
                ]},
                {kind: "HFlexBox", defaultKind: "Calc.Button", flex: 1, components: [
                        {name: "M", caption: $L("MC"), operation: "memoryClear"},
                        {name: "a", caption: $L("M+"), operation: "memoryAdd"},
                        {name: "A", caption: $L("M\u2013"), operation: "memorySubt"},
                        {name: "m", caption: $L("MR"), operation: "memoryRecall"}
                ]},
                {kind: "HFlexBox", flex: 1, components: [
                        {kind: "Calc.%", name: "%"},
                        {kind: "Calc.q", name: "q"},
                        // {kind: "Calc.Button", caption: $L("AC"), operation: "ac"}, //Not needed with double-ce behavior.
                        {kind: "Calc.g", name: "g"},
                        {kind: "Calc.BinaryOp", name: "/", caption: $L("\u00F7")}
                ]},
                {kind: "HFlexBox", defaultKind: "Calc.Digit", flex: 1, components: [
                        {caption: $L("7")},
                        {caption: $L("8")},
                        {caption: $L("9")},
                        {kind: "Calc.BinaryOp", name: "*", caption: $L("\u00D7")}
                ]},
                {kind: "HFlexBox", defaultKind: "Calc.Digit", flex: 1, components: [
                        {caption: $L("4")},
                        {caption: $L("5")},
                        {caption: $L("6")},
                        {kind: "Calc.BinaryOp", name: "-", caption: $L("\u2013")}
                ]},
                {kind: "HFlexBox", defaultKind: "Calc.Digit", flex: 1, components: [
                        {caption: $L("1")},
                        {caption: $L("2")},
                        {caption: $L("3")},
                        {kind: "Calc.BinaryOp", caption: $L("+")}
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