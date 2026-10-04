/*global enyo */ 
enyo.depends(
	// The "depends.js" at top level in the app directory is ready when enyo is sourced.
	// We list here the .js and .css files used by the app.
	"source/Buttons.js",		// Contains some simple button classes for reuse.
	"source/Simple.js",             // A simple full screen layout.
	"source/Small.js",              // Small, but all the basic buttons.
	"source/Tiny.js",               // Trivial four-function layout.
	"source/TinyAlt.js",               // Trivial four-function alternatelayout.
	"source/Calculator.js",		// The top level calculating machinery (and button layout for now).
	"css/Calculator.css"
);