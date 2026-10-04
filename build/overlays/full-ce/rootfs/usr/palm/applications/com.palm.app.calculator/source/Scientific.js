/*global enyo, $L, Calc */

// Math for the landscape (scientific) layout. The webOS 3 WebKit predates
// ES2015, so Math.cbrt, Math.sinh, Math.log10 and friends don't exist here.

Calc.Sci = {
	degrees: true,	// Angle unit for trig. Persisted by Calc.App.

	clean: function (r) {
		// sin(180) is 1.2e-16, not 0. Anything that small is roundoff.
		return Math.abs(r) < 1e-15 ? 0 : r;
	},
	toRadians: function (x) {
		return Calc.Sci.degrees ? x * Math.PI / 180 : x;
	},
	fromRadians: function (x) {
		return Calc.Sci.degrees ? x * 180 / Math.PI : x;
	},
	trig: function (fn) {
		return function (x) {
			if (Calc.Sci.degrees) {
				// Exact answers at the angles people actually type.
				var d = ((x % 360) + 360) % 360;
				if (fn === Math.sin && d % 180 === 0) {return 0;}
				if (fn === Math.cos && d % 180 === 90) {return 0;}
				if (fn === Math.tan) {
					if (d % 180 === 0) {return 0;}
					if (d % 180 === 90) {return NaN;}
				}
			}
			return Calc.Sci.clean(fn(Calc.Sci.toRadians(x)));
		};
	},
	inverseTrig: function (fn) {
		return function (x) {
			return Calc.Sci.fromRadians(fn(x));
		};
	},
	sinh: function (x) { return (Math.exp(x) - Math.exp(-x)) / 2; },
	cosh: function (x) { return (Math.exp(x) + Math.exp(-x)) / 2; },
	tanh: function (x) {
		if (x > 20) {return 1;}
		if (x < -20) {return -1;}
		var a = Math.exp(2 * x);
		return (a - 1) / (a + 1);
	},
	asinh: function (x) { return Math.log(x + Math.sqrt(x * x + 1)); },
	acosh: function (x) { return Math.log(x + Math.sqrt(x * x - 1)); },
	atanh: function (x) { return Math.log((1 + x) / (1 - x)) / 2; },
	root: function (x, n) {
		// The nth root, including odd roots of negative numbers.
		if (x < 0 && Math.abs(n % 2) === 1) {return -Math.pow(-x, 1 / n);}
		return Math.pow(x, 1 / n);
	},
	gamma: function (z) {
		// Lanczos approximation, good to ~15 digits.
		var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
			771.32342877765313, -176.61502916214059, 12.507343278686905,
			-0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
		if (z < 0.5) {return Math.PI / (Math.sin(Math.PI * z) * Calc.Sci.gamma(1 - z));}
		z -= 1;
		var x = c[0];
		for (var i = 1; i < g + 2; i++) {x += c[i] / (z + i);}
		var t = z + g + 0.5;
		return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
	},
	factorial: function (x) {
		if (x === Math.floor(x)) {
			if (x < 0) {return NaN;}
			if (x > 170) {return Infinity;}
			var r = 1;
			for (var i = 2; i <= x; i++) {r *= i;}
			return r;
		}
		return Calc.Sci.gamma(x + 1);	// Like the iPhone: 0.5! = 0.886...
	},

	// Wraps an operand's label in parentheses unless it is a plain number.
	paren: function (t) {
		return /^-?[\d.,]+(e[+\-]\d+)?$/.test(t) ? t : "(" + t + ")";
	}
};

// The scientific keys. "unary" replaces the entry, "binary" is an infix
// operator (see Calc.App.OPS), "constant" replaces the entry with a value.
// label() renders the operation for the expression line above the readout, as HTML:
// the device fonts have no superscript minus or subscripts, so use <sup>/<sub>.
Calc.Sci.FUNCS = (function () {
	var S = Calc.Sci, p = S.paren;
	var fn = function (f, label) { return {kind: "unary", f: f, label: label}; };
	var named = function (name) { return function (t) { return name + "(" + t + ")"; }; };
	return {
		x2: fn(function (x) { return x * x; }, function (t) { return p(t) + "\u00B2"; }),
		x3: fn(function (x) { return x * x * x; }, function (t) { return p(t) + "\u00B3"; }),
		inv: fn(function (x) { return 1 / x; }, function (t) { return "1/" + p(t); }),
		cbrt: fn(function (x) { return S.root(x, 3); }, function (t) { return "<sup>3</sup>\u221A" + p(t); }),
		exp: fn(Math.exp, function (t) { return "e^" + p(t); }),
		pow10: fn(function (x) { return Math.pow(10, x); }, function (t) { return "10^" + p(t); }),
		pow2: fn(function (x) { return Math.pow(2, x); }, function (t) { return "2^" + p(t); }),
		ln: fn(Math.log, named("ln")),
		log10: fn(function (x) { return Math.log(x) / Math.LN10; }, named("log")),
		log2: fn(function (x) { return Math.log(x) / Math.LN2; }, named("log<sub>2</sub>")),
		fact: fn(S.factorial, function (t) { return p(t) + "!"; }),
		sin: fn(S.trig(Math.sin), named("sin")),
		cos: fn(S.trig(Math.cos), named("cos")),
		tan: fn(S.trig(Math.tan), named("tan")),
		asin: fn(S.inverseTrig(Math.asin), named("sin<sup>-1</sup>")),
		acos: fn(S.inverseTrig(Math.acos), named("cos<sup>-1</sup>")),
		atan: fn(S.inverseTrig(Math.atan), named("tan<sup>-1</sup>")),
		sinh: fn(S.sinh, named("sinh")),
		cosh: fn(S.cosh, named("cosh")),
		tanh: fn(S.tanh, named("tanh")),
		asinh: fn(S.asinh, named("sinh<sup>-1</sup>")),
		acosh: fn(S.acosh, named("cosh<sup>-1</sup>")),
		atanh: fn(S.atanh, named("tanh<sup>-1</sup>")),
		pi: {kind: "constant", value: function () { return Math.PI; }, label: "\u03C0"},
		e: {kind: "constant", value: function () { return Math.E; }, label: "e"},
		rand: {kind: "constant", value: function () { return Math.random(); }},
		pow: {kind: "binary"},
		root: {kind: "binary"},
		logy: {kind: "binary"}
	};
}());
