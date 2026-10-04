/*global enyo, $L */

// Landscape layout: the portrait calculator on the right, unchanged, so the keys
// stay where your fingers expect them across a rotation; scientific keys on the left.
enyo.kind({
        name: "Calc.Wide",
        className: "calc-desktop",
        kind: "enyo.VFlexBox", pack: "center", align: "center",
        displayLength: 16,
        displayScale: 1.25,   // The readout is wider here, so it can be bigger.
        components: [
           {kind: enyo.VFlexBox, className: "calc-wide-body", components: [
                {kind: "HFlexBox", flex: 1.3, className: "calc-display", components: [
                        {kind: "VFlexBox", flex: 1, components: [
                                {name: "auxDisplay", kind: "HFlexBox", className: "calc-wide-aux", components: [
                                        {name: "angleDisplay", className: "calc-indicator"},
                                        {name: "memoryDisplay", className: "calc-indicator"},
                                        {name: "exprDisplay", flex: 1, className: "calc-expr", components: [
                                                {name: "exprText", className: "calc-expr-text", allowHtml: true}
                                        ]}
                                ]},
                                {name: "display", content: $L("0"), flex: 1, className: "calc-wide-readout"}
                        ]},
                        {kind: "HFlexBox", className: "calc-wide-bsp", align: "center", pack: "center", components: [
                                {name: "b", kind: "Calc.bsp"}
                        ]}
                ]},
                {kind: "HFlexBox", flex: 1, components: [
                        {kind: "Calc.Fn", name: "second", fn: "second", caption: "2<sup>nd</sup>", operation: "toggleSecond", className: "calc-function-key calc-second-key"},
                        {kind: "Calc.Fn", name: "(", fn: "(", caption: "(", operation: "openParen"},
                        {kind: "Calc.Fn", name: ")", fn: ")", caption: ")", operation: "closeParen"},
                        {kind: "Calc.Fn", name: "angle", fn: "angle", caption: "Rad", operation: "toggleAngle"},
                        {className: "calc-wide-gap"},
                        {kind: "Calc.Button", name: "M", caption: $L("MC"), operation: "memoryClear"},
                        {kind: "Calc.Button", name: "a", caption: $L("M+"), operation: "memoryAdd"},
                        {kind: "Calc.Button", name: "A", caption: $L("M–"), operation: "memorySubt"},
                        {kind: "Calc.Button", name: "m", caption: $L("MR"), operation: "memoryRecall"}
                ]},
                {kind: "HFlexBox", flex: 1, components: [
                        {kind: "Calc.Fn", fn: "x2", caption: "x<sup>2</sup>"},
                        {kind: "Calc.Fn", fn: "x3", caption: "x<sup>3</sup>"},
                        {kind: "Calc.Fn", fn: "pow", caption: "x<sup>y</sup>"},
                        {kind: "Calc.Fn", fn: "pow10", caption: "10<sup>x</sup>", fn2: "pow2", caption2: "2<sup>x</sup>"},
                        {className: "calc-wide-gap"},
                        {kind: "Calc.%", name: "%"},
                        {kind: "Calc.q", name: "q"},
                        {kind: "Calc.g", name: "g"},
                        {kind: "Calc.BinaryOp", name: "/", caption: $L("÷")}
                ]},
                {kind: "HFlexBox", flex: 1, components: [
                        {kind: "Calc.Fn", fn: "inv", caption: "<sup>1</sup>/<sub>x</sub>"},
                        {kind: "Calc.Fn", fn: "cbrt", caption: "<sup>3</sup>√x"},
                        {kind: "Calc.Fn", fn: "root", caption: "<sup>y</sup>√x"},
                        {kind: "Calc.Fn", fn: "exp", caption: "<i>e</i><sup>x</sup>"},
                        {className: "calc-wide-gap"},
                        {kind: "Calc.Digit", caption: $L("7")},
                        {kind: "Calc.Digit", caption: $L("8")},
                        {kind: "Calc.Digit", caption: $L("9")},
                        {kind: "Calc.BinaryOp", name: "*", caption: $L("×")}
                ]},
                {kind: "HFlexBox", flex: 1, components: [
                        {kind: "Calc.Fn", fn: "fact", caption: "x!"},
                        {kind: "Calc.Fn", fn: "ln", caption: "ln", fn2: "logy", caption2: "log<sub>y</sub>"},
                        {kind: "Calc.Fn", fn: "log10", caption: "log<sub>10</sub>", fn2: "log2", caption2: "log<sub>2</sub>"},
                        {kind: "Calc.Fn", fn: "e", caption: "<i>e</i>"},
                        {className: "calc-wide-gap"},
                        {kind: "Calc.Digit", caption: $L("4")},
                        {kind: "Calc.Digit", caption: $L("5")},
                        {kind: "Calc.Digit", caption: $L("6")},
                        {kind: "Calc.BinaryOp", name: "-", caption: $L("–")}
                ]},
                {kind: "HFlexBox", flex: 1, components: [
                        {kind: "Calc.Fn", fn: "sin", caption: "sin", fn2: "asin", caption2: "sin<sup>-1</sup>"},
                        {kind: "Calc.Fn", fn: "cos", caption: "cos", fn2: "acos", caption2: "cos<sup>-1</sup>"},
                        {kind: "Calc.Fn", fn: "tan", caption: "tan", fn2: "atan", caption2: "tan<sup>-1</sup>"},
                        {kind: "Calc.Fn", fn: "pi", caption: "π"},
                        {className: "calc-wide-gap"},
                        {kind: "Calc.Digit", caption: $L("1")},
                        {kind: "Calc.Digit", caption: $L("2")},
                        {kind: "Calc.Digit", caption: $L("3")},
                        {kind: "Calc.BinaryOp", caption: $L("+")}
                ]},
                {kind: "HFlexBox", flex: 1, components: [
                        {kind: "Calc.Fn", fn: "sinh", caption: "sinh", fn2: "asinh", caption2: "sinh<sup>-1</sup>"},
                        {kind: "Calc.Fn", fn: "cosh", caption: "cosh", fn2: "acosh", caption2: "cosh<sup>-1</sup>"},
                        {kind: "Calc.Fn", fn: "tanh", caption: "tanh", fn2: "atanh", caption2: "tanh<sup>-1</sup>"},
                        {kind: "Calc.Fn", fn: "rand", caption: "Rand"},
                        {className: "calc-wide-gap"},
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
