/*global enyo $L console  */ 
/*jslint evil: true */

enyo.kind({
        name: "Calc.App",// A desktop calculator.
        published: {        // Operating registers, independent of display:
                result: 0,              // Current display, as a number rather than a string.
                memory: null,    // For m+, m-, mc, mr operators.
                entryCleared: false
        },
        // The pending calculation: one level per open parenthesis. Each level is an
        // operator-precedence stack, vals[0] ops[0] vals[1] ops[1] ..., reduced as
        // operators arrive. A val is {v: number, t: label for the expression line}.
        levels: null,
        lastWasOp: false,       // The last key was a binary operator, so another one replaces it.
        entryLabel: null,       // How to show the current entry if it isn't just the number, e.g. "sin(30)".
        lastExpression: "",     // What was just totalled, shown above the result.
        second: false,          // The 2nd key is on.
        activeOp: null,         // The highlighted operator button.
        clearDisplayOnEntry: false,
        memoryRecalled: false,
        precision: 15,          // Max precision that is meaningful. Don't allow input or display to imply more.
        displayLength: null,    // Max digits displayable, including sign, leading zero, and exponent. Don't overflow this.
        buttons: null,   // We expect buttons.display and buttons.c (clear button) to be defined. buttons.{pending | operator | memory}Display are optional.
        parsableEnglishDisplayString: "0",
        
        kind: "enyo.Pane",
        transitionKind: "enyo.transitions.Simple",  // Rotation swaps layouts instantly.
        components: [
                     {name: "small", kind: "Calc.Small"},
                     {name: "wide", kind: "Calc.Wide"},
                     {kind: "ApplicationEvents", onApplicationRelaunch: "relaunched"},
                     {kind: "AppMenu",
                      // 1. Why is this necessary? Bug? 2. Should be in style sheet (if needed at all), but that's in production now.
                      style: "width: 210px; height: 160px",  //height needs 200 w/toggle. 210 is the min-width specified in the inherited styling
                      components: [
                                   // {caption: $L("Toggle Size"), onclick: "toggleSize"}, // Not for Duval release.
                                   {caption: $L("Copy"), onclick: "copyFromDisplay"},
                                   {caption: $L("Paste"), onclick: "pasteToDisplay"},
                                   {kind: "HelpMenu", target: "http://help.palm.com/calculator/index.html"}
                                  ]}
                     ],
        statics: {
                MEMORY_VALUE: new enyo.g11n.Template($L("M: #{value}")),
                // Binary operators. prec: higher binds tighter. right: right-associative (2^3^2 = 2^9).
                OPS: {
                        "+": {prec: 1, sym: "+", f: function (a, b) { return a + b; }},
                        "-": {prec: 1, sym: "\u2013", f: function (a, b) { return a - b; }},
                        "*": {prec: 2, sym: "\u00D7", f: function (a, b) { return a * b; }},
                        "/": {prec: 2, sym: "\u00F7", f: function (a, b) { return a / b; }},
                        "pow": {prec: 3, right: true, sym: "^", f: Math.pow},
                        "root": {prec: 3, right: true, sym: " <sup>y</sup>\u221A ", f: function (a, b) { return Calc.Sci.root(a, b); },
                                 label: function (a, b) { return "<sup>" + b + "</sup>\u221A" + Calc.Sci.paren(a); }},
                        "logy": {prec: 3, sym: " log<sub>y</sub> ", f: function (a, b) { return Math.log(a) / Math.log(b); },
                                 label: function (a, b) { return "log<sub>" + b + "</sub>" + Calc.Sci.paren(a); }}
                }
        },
        // Portrait gets the stock layout; landscape gets the scientific one.
        chooseView: function() {
            var wide = window.innerWidth > window.innerHeight && window.innerWidth >= 900;
            var v = wide ? this.$.wide : this.$.small;
            if (v === this.getView()) {return false;}
            this.selectView(v);
            this.viewSelected(this, v);
            return true;
        },
        viewSelected: function (inSender, inView) {
            if (this.activeOp) {this.activeOp.setState("active", false); this.activeOp = null;}
            this.buttons = inView.$;
            this.displayLength = inView.displayLength;
            this.secondChanged();
            this.angleChanged();
            enyo.asyncMethod(this, "adjustHeightsAndUpdateDisplays");
        },
        relaunched: function() {
            // Test hook, so the keypad can be driven without a finger:
            //   luna-send -n 1 palm://com.palm.applicationManager/launch
            //     '{"id":"com.palm.calculator","params":{"keys":["2","pow","1","0","="]}}'
            // "orientation" ("up", "left", "free", ...) pins the window, to try both layouts.
            var p = enyo.windowParams || {};
            if (p.orientation) {enyo.setAllowedOrientation(p.orientation);}
            var keys = p.keys || [];
            for (var i = 0; i < keys.length; i++) {
                if (this.buttons[keys[i]]) {this.clickHandler(this.buttons[keys[i]]);}
            }
        },
        copyFromDisplay: function() {
            var txt = this.buttons.display.getContent();
            enyo.dom.setClipboard(txt);
        },
        pasteToDisplay: function() { 
                var that = this;
                enyo.dom.getClipboard(function(txt) {
                        that.textEntry(txt);
                    });
        },
        textEntry: function(text) { // Enter the given text as instructions.
            // Finds the button named for that character and fires it.
            // Stop if no such button.
            var len = text.length;
            for (var index=0; index<len; index++) {
                var name = text.charAt(index);
                if (name === this._decimal) {name = ".";}
                var aButton = this.findButtonByNameOrCaption(name);
                if (!aButton) {return;}
                this.clickHandler(aButton);  
            }
        },
        findButtonByNameOrCaption: function(aString) {
            // The app owns Calc.Buttons that are named using their caption. e.g, this.buttons['button name']
            var aButton = this.buttons[aString];
            if (aButton) {return aButton;}
            // Try looking it up by caption, in case the text was internationalized.
            for (var bi in this.buttons) {
                if (this.buttons.hasOwnProperty(bi)) {
                    aButton = this.buttons[bi];
		    // aButton.getCaption() is (unecessary?) defensive programming.
		    // But if used, it must be garded by aButton.caption (buttons has layout objects).
                    if (aButton.caption && aButton.getCaption() === aString) {return aButton;} 
                }
            }
            return undefined; //Just to make it clear that it was not found.
        },

        create: function() {
                this.inherited(arguments);
                try { Calc.Sci.degrees = window.localStorage.getItem("calc.angle") !== "rad"; } catch (e) {}
                var fmts = new enyo.g11n.Fmts();
                this._decimal = fmts.dateTimeFormatHash.numberDecimal;
                if (!this.chooseView()) {this.viewSelected(this, this.getView());}
                this.ac();  // Comment out this line to make any dummy display values visible on launch.
                this.memoryClear();
        },
        trim: function(n, size) { // Prepares a number for textual display, limiting displayLength and internationalizing.
                size = size || this.displayLength;
                if (typeof(n) === 'string') {
                        console.log('Attempt to trim a string.');
                        n = parseFloat(n);
                }
                if (isNaN(n)) {return $L("Error");}
                // the infinity symbol is already international, so it doesn't need localization
                if (n === Infinity) {return "\u221E";} 
                if (n === -Infinity) {return "-\u221E";} 

                // First try to display with the given precision, as a floating point number:
                if (n < 0) {size--;} // A space for the sign.
                var size2 = this.precision < size ? this.precision : size;
                // For fixed precision numbers with leading zeros, toPrecision() would not count the zeros
                // and so would imply more precision than we really have. (e.g., 10-9.9) Use toFixed() in that case.
                var trimmed = Math.abs(n) < 1 ? n.toFixed(size2) : n.toPrecision(size2);

                // Get rid of any trailing zeros:
                trimmed = parseFloat(trimmed).toString();

                // In general, if trimmed.length > this.displayLength, then use scientific notation with toExponential()
                // and trim off trailing decimals in order to make the whole string fit. e.g.:
                //  12345678901234567       => 1.234568e+16
                // -12345678901234567       => -1.23457e+16
                //  0.000000123456789012345 => 1.2345679e-7
                // However, what should we do about numbers like:
                // 0.3333333333333333
                // 3.3333333333333333
                // 333.33333333333333
                // 0.0003333333333333
                // People tend to prefer trimming these floating point numbers, even with loss of precision, 
                // rather than switching to scientific notation.
                // The heuristic we use is such that if the number can be printed in floating point such that 
                // after trimming to length, there are still SEVEN significant digits remaining after the decimal, 
                // then don't go to scientific notation. e.g.:
                // 3333.3333333
                // -333.3333333
                // 0.0003333333
                // The number seven is not arbitrary. In addition to generally being considered "enough" precision,
                // it is the most that can be shown to the right of the decimal while still fitting in
                // a 12-digit scientific notation display. 12 digits is our minimum goal, so keeping that
                // same precision in fixed point will avoid awkward jumps from one format to the other.
                if (trimmed.length > this.displayLength) {
                    var leadingParts =  !trimmed.match('e') && // i.e., not scientific notation
						(/^\-?0\.0*/.exec(trimmed) || // Leading zeros 0.000..., -0.00...
                         /^\-?\d+\./.exec(trimmed)); // Leading whole numbers and decimal
                    if (leadingParts && (leadingParts[0].length + 7 <= this.displayLength)) {
                        trimmed = trimmed.slice(0, this.displayLength);
                    } else { // Now go to scientific notation. Alternative is to answer Error, but that's not very helpful.
                        size -= 5; // e, + or -, at least one exponent digit, the leading digit and decimal point
                        trimmed = n.toExponential(size);
                        var exponentLength = trimmed.length - trimmed.indexOf('e') - 2; // -2 for e+ or e-
                        if (exponentLength > 1) { // Gotta trim some more.
                            trimmed = n.toExponential(size + 1 - exponentLength);
                        }
                    }
                }
                return trimmed.replace(".", this._decimal);
        },
        // Change methods, keeping aux displays (if any) consistent with registers.
        resultChanged: function(old) {
                // We keep results as full precision floats to reduce roundoff accumulation, 
                //     (e.g., so that 1 / 9 * 9 is as close to 1 as we can keep)
                // but display is trimmed 
                //     (e.g., so that 0.1 + 0.2 displays a 0.3)
                var disp = this.buttons.display;
                this.parsableEnglishDisplayString = ""+this.result;
                disp.setContent(this.trim(this.result));
        },
        // The pending stack changed: keep the operator highlight, the C key and
        // the expression line consistent with it.
        pendingChanged: function() {
            var name = this.topOp();
            var b = name ? this.findOpButton(name) : null;
            if (b !== this.activeOp) {
                if (this.activeOp) {this.activeOp.setState("active", false);}
                if (b) {b.setState("active", true);}
                this.activeOp = b;
            }
            this.entryClearedChanged();
            var disp = this.buttons.exprText;
            if (!disp) {return;}
            var text = this.hasPending() ? this.expressionText() + (this.lastWasOp ? "" : this.entryLabel || "") : this.lastExpression;
            disp.setContent(text || "\u00A0");
        },
        findOpButton: function(name) {
            if (this.buttons[name] && this.buttons[name].operation === "binaryOp") {return this.buttons[name];}
            for (var bi in this.buttons) {  // e.g., log_y lives on the ln key.
                if (this.buttons.hasOwnProperty(bi) && this.buttons[bi].fn2 === name) {return this.buttons[bi];}
            }
            return this.buttons[name] || null;
        },
        expressionText: function() {
            var ops = Calc.App.OPS, parts = [];
            for (var i = 0; i < this.levels.length; i++) {
                var level = this.levels[i], s = i ? "(" : "";
                for (var j = 0; j < level.vals.length; j++) {
                    s += level.vals[j].t;
                    if (j < level.ops.length) {s += ops[level.ops[j]].sym;}
                }
                parts.push(s);
            }
            return parts.join("");
        },
        memoryChanged: function() {
                var disp = this.buttons.memoryDisplay;
                var mem = this.memory;
                var m = this.buttons.m;
                m.setState("active", mem !== null);
                if (!disp) {return;}
                if (mem !== null) {mem = Calc.App.MEMORY_VALUE.evaluate({value: this.trim(mem)}); }
                disp.setContent(mem);
        },
       entryClearedChanged: function() {
            this.buttons.c.setState("active", this.entryCleared && this.hasPending());
        },
        secondChanged: function() {
            for (var bi in this.buttons) {
                if (this.buttons.hasOwnProperty(bi) && this.buttons[bi].setSecond) {this.buttons[bi].setSecond(this.second);}
            }
            if (this.buttons.second) {this.buttons.second.setState("active", this.second);}
        },
        angleChanged: function() {
            var deg = Calc.Sci.degrees;
            if (this.buttons.angleDisplay) {this.buttons.angleDisplay.setContent(deg ? $L("Deg") : $L("Rad"));}
            if (this.buttons.angle) {this.buttons.angle.setCaption(deg ? $L("Rad") : $L("Deg"));}
        },
        adjustHeightsAndUpdateDisplays: function() {
            this.adjustHeights();
            // Redisplay the entry without disturbing it (e.g., a half-typed number survives rotation).
            var disp = this.buttons.display;
            if (this.clearDisplayOnEntry || this.memoryRecalled) {disp.setContent(this.trim(this.result));}
            else {disp.setContent(this.parsableEnglishDisplayString.replace(".", this._decimal));}
            this.pendingChanged();
            this.setMemory(this.getMemory());
        },
        adjustHeights: function() {
                // It would be cool if we could style fontSize and lineHeight as a percentage of the container.
                // Alas, we have to set that up manually.
                var container = this.hasNode();
                var keynode =  this.buttons.c.hasNode();
                if (!keynode) {return;} // e.g., in jasmine test harness
                var displaynode = this.buttons.display.hasNode();
                var aux = this.buttons.auxDisplay;
                var h = keynode.clientHeight;
                var w = keynode.clientWidth;
                var v = this.getView();
                
                // yeah in the odd case where we have tall buttons, best keep them contained
                var s = (h < w) ? h : w;
                
                container.style.fontSize = Math.floor(s * 0.9) + "px";
                if (aux) {aux.hasNode().style.fontSize = Math.floor(s * 0.5) + "px";}
                
                displaynode.style.fontSize = Math.floor(s * 0.9 * (v.displayScale || 1)) + "px";
                displaynode.style.lineHeight = displaynode.clientHeight + "px"; // Why doesn't a static relative style (e.g., 1 or 100%) work?

                if (v.name === "small") {return;} // Hack. This layout is independent of width. There could be other such layouts.
                this.displayLength = v.displayLength;  // A chance to get wide on rotation/resize. Otherwise just set on view selection.
                if (container.clientWidth < 1024) { 
                    this.displayLength = Math.min(12, this.displayLength); // best we can do in portrait mode or on smaller devices. 
                }
        },
        // The next two cause us to adjust heights on resize and when first rendered.
        resizeHandler: function() {
                if (!this.chooseView()) {this.adjustHeightsAndUpdateDisplays();}
        },
        rendered: function() {
                this.inherited(arguments);
                enyo.asyncMethod(this, "adjustHeightsAndUpdateDisplays");
        },
        clickHandler: function(inSender, inEvent) { // Trampoline to invoke the operation defined by the inSender (button), in our context
            var op = this[inSender.operation];
            if (!op) {return;} // e.g., a click that is not on a button.
            // ... as if the button were defined here instead of some layout kind.
            // An operation that answers false changed nothing; a binary operator answers true.
            var r = op.call(this, inSender, inEvent);
            if (r !== false && !this.neutralOps[inSender.operation]) {this.lastWasOp = r === true;}
            this.pendingChanged();
        },
        // Keys that don't count as an entry, so an operator before them can still be replaced.
        neutralOps: {memoryClear: true, memoryAdd: true, memorySubt: true, toggleSecond: true, toggleAngle: true},


        // Editing events.
        // The display is maintained as a string, not a number. It is never empty, but
        // rather always has 0 or the previous results (if any since All Clear).
        bsp: function() {
                // Remove last digit from current display entry, but leave a 0 rather than empty or -.
                var d = this.buttons.display;
                var c = this.parsableEnglishDisplayString;
                c = c.substring(0, c.length-1);
                if (c==="" || c==="-" || this.clearDisplayOnEntry) {c = "0";}
                this.clearDisplayOnEntry = false;
                this.memoryRecalled = false;
                this.entryLabel = null;
                this.parsableEnglishDisplayString = c;
                d.setContent(c.replace(".", this._decimal));
        },
        ce: function() {
                // clear the current display entry, but not pending results, ops, or memory
                // Two ce's in a row do ac.
                if (this.getEntryCleared()) {this.ac(); return;}
                this.setEntryCleared(true);
                this.entryLabel = null;
                this.setResult(0); // which changes display and parsableEnglishDisplayString
        },
        ac: function() {
                // reset everything, i.e., All Clear
                this.levels = [{vals: [], ops: []}];
                this.lastWasOp = false;
                this.entryLabel = null;
                this.lastExpression = "";
                this.setResult(0);   // which changes display
                this.clearDisplayOnEntry = false;
                this.setEntryCleared(false);
                this.pendingChanged();
        },
        hasPending: function() {
                return !!this.levels && (this.levels.length > 1 || this.levels[0].vals.length > 0);
        },
        topLevel: function() {
                return this.levels[this.levels.length - 1];
        },
        topOp: function() {
                if (!this.levels) {return null;}
                var ops = this.topLevel().ops;
                return ops.length ? ops[ops.length - 1] : null;
        },
        currentLabel: function() {
                // The current entry as the expression line should show it. Call before getCurrentEntry().
                return this.entryLabel || this.buttons.display.getContent();
        },
        reduceOnce: function(level) {
                var b = level.vals.pop(), a = level.vals.pop(), op = Calc.App.OPS[level.ops.pop()];
                var t = op.label ? op.label(a.t, b.t) : a.t + op.sym + b.t;
                level.vals.push({v: op.f(a.v, b.v), t: t});
        },
        reduceLevel: function(level) {
                // Push the current entry and collapse the level to one value.
                var t = this.currentLabel();
                level.vals.push({v: this.getCurrentEntry(), t: t});
                while (level.ops.length) {this.reduceOnce(level);}
                return level.vals.pop();
        },
        
        getCurrentEntry: function() {
                // Answer the value to use as the current entry.
                // Might be from a register or from the display itself.
                // try to be good about preserving precision
                var stale = this.clearDisplayOnEntry;
                var fromMemory = this.memoryRecalled;
                this.clearDisplayOnEntry = true;
                this.setEntryCleared(false);
                this.memoryRecalled = false;
                if (fromMemory) {return this.getMemory();}
                if (stale) {
                    return this.getResult();
                }
                return parseFloat(this.parsableEnglishDisplayString); 
        },      // Generic entry and operators, independently of how things are displayed.
        entry: function(inSender) {
                // Append sender's caption to the display. But:
                // No leading zeros (unless fractional);
                // No additional decimal points after the first;
                // When an operator is entered, the old value is left in the display
                // until a new digit is entered. 
                var d = this.buttons.display;
                var c = this.parsableEnglishDisplayString;
                var adding = inSender.getCaption();
                var allowedDigits = this.precision;
                this.memoryRecalled = false;
                this.entryLabel = null;
                if (!this.hasPending()) {this.lastExpression = "";}
                if (adding === this._decimal) {
                        // do everything in scientific format, then convert back to locale-specific formatting again later
                        adding = ".";
                }
                this.setEntryCleared(false);
                // Defensive programming against potential future use with keyboard input:
                if (!/\.|\d/.test(adding)) {return;}  // See use of eval() in totalOp.
                
                if (this.clearDisplayOnEntry) {
                        c=""; 
                        this.clearDisplayOnEntry = false;
                }
                if (adding === ".") {
                        if (-1 !== c.indexOf(".")) {} // Do nothing, so that we don't have multiple decimals
                        else if (c === "") {c = "0.";}
                        else {c += adding;}
                } else {
                        if (c === "0") {c="";}
                        c += adding;
                }
                if (c.length > this.displayLength) {return;}
                // Don't add/show precision we can't use.
                if (c.indexOf("-0.") === 0) {allowedDigits += 3;}
                else if (c.indexOf("0.") === 0) {allowedDigits += 2;}
                else {
                        if (c.charAt(0) === '-') {allowedDigits += 1;}
                        if (c.indexOf(".") !== -1) {allowedDigits += 1;}
                }
                if (c.length <= allowedDigits) {
                        this.parsableEnglishDisplayString = c;
                        d.setContent(c.replace(".", this._decimal));
                }
        },
        unaryOp: function(inSender) {
                // Replace the result with the result of applying sender's operator to display.
                this.applyUnary(inSender.op, inSender.label);
        },
        applyUnary: function(f, label) {
                var t = this.currentLabel();
                var c = this.getCurrentEntry();
                // There are two ways for the op to be specified in the components configuration:
                // either as a function literal, or as a string. In the later case, function is defined in app.
                c = typeof f === 'function' ? f(c) : this[f](c);
                this.setResult(c);
                this.entryLabel = label ? label(t) : null;
        },
        fn: function(inSender) {
                // A scientific key: dispatch on what it does (see Calc.Sci.FUNCS).
                var name = inSender.currentFn(this.second);
                var def = Calc.Sci.FUNCS[name];
                switch (def.kind) {
                case "unary":
                        return this.applyUnary(def.f, def.label);
                case "binary":
                        return this.pushOperator(name);
                case "constant":
                        this.getCurrentEntry();  // Housekeeping: a new entry starts after this.
                        this.setEntryCleared(false);
                        this.setResult(def.value());
                        this.entryLabel = def.label || null;
                        return;
                }
        },
        toggleSecond: function() {
                this.second = !this.second;
                this.secondChanged();
        },
        toggleAngle: function() {
                Calc.Sci.degrees = !Calc.Sci.degrees;
                try { window.localStorage.setItem("calc.angle", Calc.Sci.degrees ? "deg" : "rad"); } catch (e) {}
                this.angleChanged();
        },
        openParen: function() {
                // A number (or a closed group) right before "(" multiplies it, as written on paper: 2(3+4).
                var implicit = this.entryLabel || (!this.clearDisplayOnEntry && this.parsableEnglishDisplayString !== "0");
                if (implicit && !this.lastWasOp) {this.pushOperator("*");}
                else if (!this.hasPending()) {this.lastExpression = "";}
                this.levels.push({vals: [], ops: []});
                this.entryLabel = null;
                this.setEntryCleared(false);
                this.setResult(0);
                this.clearDisplayOnEntry = true;
        },
        closeParen: function() {
                if (this.levels.length < 2) {return false;}
                var e = this.reduceLevel(this.levels.pop());
                this.setResult(e.v);
                this.clearDisplayOnEntry = true;  // The group's value is the entry now.
                this.entryLabel = "(" + e.t + ")";
        },
        binaryOp: function(inSender) {
                return this.pushOperator(inSender.getName());
        },
        pushOperator: function(name) {
                // It is not clear if user expect entry, op1, op2, =  to be:
                //    entry op2 entry
                // or
                //    entry op1 entry op2 entry
                // Here we implement the first behavior: a second operator in a row replaces the first.
                var level = this.topLevel(), v, t;
                if (this.lastWasOp) {
                        level.ops.pop();
                        var prev = level.vals.pop();
                        v = prev.v; t = prev.t;
                } else {
                        t = this.currentLabel();
                        v = this.getCurrentEntry();
                }
                // Algebraic precedence: settle everything on the stack that binds at least as tightly.
                var ops = Calc.App.OPS, def = ops[name];
                level.vals.push({v: v, t: t});
                while (level.ops.length) {
                        var top = ops[level.ops[level.ops.length - 1]];
                        if (top.prec > def.prec || (top.prec === def.prec && !def.right)) {this.reduceOnce(level);}
                        else {break;}
                }
                level.ops.push(name);
                // Show the subtotal (or the operand), left as stale data until a new digit is entered.
                // This allows the usage: entry, op, = (meaning entry op entry =)
                this.setResult(level.vals[level.vals.length - 1].v);
                this.clearDisplayOnEntry = true;
                this.entryLabel = null;
                this.setEntryCleared(false);
                return true;
        },
        totalOp: function() {
                // Close any open parentheses and settle the whole stack.
                if (!this.hasPending()) {
                        // Nothing pending: = just settles the entry (and shows e.g. "sin(30)" above it).
                        this.lastExpression = this.entryLabel || "";
                        this.setResult(this.getCurrentEntry());
                        this.entryLabel = null;
                        return;
                }
                var e;
                while (this.levels.length) {
                        e = this.reduceLevel(this.levels.pop());
                        if (this.levels.length) {
                                this.setResult(e.v);
                                this.clearDisplayOnEntry = true;
                                this.entryLabel = "(" + e.t + ")";
                        }
                }
                this.levels = [{vals: [], ops: []}];
                this.lastExpression = e.t;
                this.entryLabel = null;
                this.setResult(e.v);
        },
        
        // Other operations. These cannot be in the components configuration literals
        // if they are to make use of 'this'.
        changeSign: function (v) {
                var d = this.buttons.display;
                var dString = d.getContent();
                var c = this.getCurrentEntry();
                c = 0 - c;
                this.entryLabel = null;
                this.setResult(c);  // Right value, but possibly wrong precision.
                this.clearDisplayOnEntry = false; 
                // Now fix precision display. (Does not effect registers.)
                if (!c) {return d.setContent(dString);} // restore trailing decimals
                if (dString.charAt(0) === '-') {return d.setContent(dString.substring(1));}
                dString = "-" + dString;
                if (dString.length > this.displayLength) {return;} // display will already be in scientific notation
                d.setContent(dString);            
        },
        
        // Memory operations
        memoryClear: function () {
                this.setMemory(null);
                this.memoryRecalled = false;
        },
        memoryAdd: function () {
                var m = this.getMemory();
                if (m===null) {m=0;}
                // Should we refuse to store NaN into memory? For now we allow it, on the grounds that if
                // someone isn't paying attention and memorizes a bad intermediate result, we want them
                // to eventually see an error result when they finally look at the answer. (NaN is infectious.)
                // We don't want them to get a wrong answer by having the calculator silently use a previously
                // memorized number that doesn't have anything to do with the current computation.
                // Of course, infinity should unequivocally be allowed.
                // Same issue with memorySubt, below.
                m += this.getCurrentEntry();  
                this.setMemory(m);
        },
        memorySubt: function () {
                var m = this.getMemory();
                if (m===null) {m=0;}
                m -= this.getCurrentEntry();  // See comment about NaN in memoryAdd, above.
                this.setMemory(m);
        },
        memoryRecall: function () {
                var m = this.getMemory();
                if (m===null) {return;}   // Or we could do m += 0, but that's probably not the right DWIM
                this.clearDisplayOnEntry = true;       
                this.setResult(m);
                this.entryLabel = null;
                this.memoryRecalled = true;  // Prevents string roundoff
        },

        // Small unary ops. Not a button operation, but a function invoked by unaryOp.
        pendingDependentPercent: function (v) { 
            switch (this.topOp()) {
            case "+": // Either + or -
            case "-":  
                // Do the pending op, but not as a total -- keep the pending data around without clearing it.
                var vals = this.topLevel().vals;
                return vals[vals.length - 1].v * (v / 100);
            default:
                return v / 100;
            }
        } 
});