/* Unit tests for the landscape (scientific) keys and the precedence stack.
 * Same harness as CalculatorSpec.js; multi-character key names go through press(),
 * e.g. press('2', 'pow', '1', '0', '=') for 2^10. The app must be showing Calc.Wide
 * (a landscape window) for the scientific keys to exist.
 */
/*global describe, beforeEach, expect, it, Calc */

describe('Scientific calculator', function () {
  var app = new Calc.App();
  app.renderInto(document.body);
  app.displayLength = 18;

  var press = function () {
        for (var i = 0; i < arguments.length; i++) {
                var name = arguments[i];
                if (name.length > 1 || app.buttons[name]) {
                        app.clickHandler(app.buttons[name]);
                } else {
                        throw new Error("no key " + name);
                }
        }
  };
  var keys = function (s) { press.apply(this, s.split('')); };
  var shows = function () { return app.buttons.display.getContent(); };
  var expr = function () { return app.buttons.exprText.getContent(); };

  beforeEach(function () {
        app.ac();
        if (app.second) {app.toggleSecond();}
        Calc.Sci.degrees = true;
        app.angleChanged();
        this.addMatchers({
                toShow: function (expected) { this.actual = shows(); return this.actual === expected; },
                toBe: function (expected) { return this.actual === expected; }
        });
  });

  it('is in the wide layout', function () {
        expect(app.getView().name).toBe('wide');
  });

  it('squares, cubes and roots', function () {
        keys('7'); press('x2'); expect().toShow('49');
        app.ac(); keys('3'); press('x3'); expect().toShow('27');
        app.ac(); keys('27'); press('cbrt'); expect().toShow('3');
        app.ac(); keys('8g'); press('cbrt'); expect().toShow('-2');
        app.ac(); keys('81'); press('root'); keys('4='); expect().toShow('3');
        app.ac(); keys('32g'); press('root'); keys('5='); expect().toShow('-2');
        app.ac(); keys('4'); press('inv'); expect().toShow('0.25');
  });

  it('raises to powers with precedence', function () {
        keys('2'); press('pow'); keys('10='); expect().toShow('1024');
        keys('2+3'); press('pow'); keys('2='); expect().toShow('11');
        keys('2*3'); press('pow'); keys('2='); expect().toShow('18');
        keys('2'); press('pow'); keys('3'); press('pow'); keys('2='); expect().toShow('512'); // right associative
        keys('3'); press('pow10'); expect().toShow('1000');
        keys('1'); press('exp'); expect().toShow('2.71828182845905');
  });

  it('does logarithms', function () {
        keys('1000'); press('log10'); expect().toShow('3');
        keys('100'); press('ln'); expect().toShow('4.60517018598809');
        press('second');
        keys('1024'); press('log10'); expect().toShow('10'); // log2 while 2nd is on
        keys('81'); press('ln'); keys('3='); expect().toShow('4'); // log base 3 of 81
        keys('5'); press('pow10'); expect().toShow('32'); // 2^x
  });

  it('does trig in degrees and radians', function () {
        keys('30'); press('sin'); expect().toShow('0.5');
        keys('180'); press('sin'); expect().toShow('0');
        keys('90'); press('cos'); expect().toShow('0');
        keys('45'); press('tan'); expect().toShow('1');
        keys('90'); press('tan'); expect().toShow('Error');
        press('second'); keys('1'); press('sin'); expect().toShow('90');
        press('second');
        press('angle'); press('pi'); press('cos'); expect().toShow('-1');
        press('pi'); press('sin'); expect().toShow('0');
        press('angle');
  });

  it('does hyperbolics', function () {
        keys('0'); press('cosh'); expect().toShow('1');
        keys('1'); press('sinh'); expect().toShow('1.1752011936438');
        press('second'); press('sinh'); expect().toShow('1');
  });

  it('does factorials', function () {
        keys('5'); press('fact'); expect().toShow('120');
        keys('0'); press('fact'); expect().toShow('1');
        keys('3g'); press('fact'); expect().toShow('Error');
        keys('.5'); press('fact'); expect(Math.abs(parseFloat(shows()) - 0.886226925452758) < 1e-12).toBe(true);
  });

  it('has constants', function () {
        press('pi'); expect().toShow('3.14159265358979');
        press('e'); expect().toShow('2.71828182845905');
        keys('2*'); press('pi'); keys('='); expect().toShow('6.28318530717959');
        press('rand'); var r = parseFloat(shows()); expect(r >= 0 && r < 1).toBe(true);
        keys('5'); expect().toShow('5'); // a digit after a constant starts a new entry
  });

  it('does parentheses', function () {
        keys('(2+3)*4='); expect().toShow('20');
        keys('2*(3+4)='); expect().toShow('14');
        keys('2(3+4)='); expect().toShow('14'); // implicit multiply
        keys('(1+2)(3+4)='); expect().toShow('21');
        keys('((2+3)*(4-1))/5='); expect().toShow('3');
        keys('2*(3+4='); expect().toShow('14'); // = closes open parentheses
        keys('(2+3)'); expect().toShow('5');
        keys(')'); expect().toShow('5'); // stray ) is ignored
  });

  it('shows the expression above the result', function () {
        keys('12+3*('); expect(expr()).toBe('12+3×(');
        keys('4'); press('x2'); expect(expr()).toBe('12+3×(4²');
        keys(')='); expect(expr()).toBe('12+3×(4²)'); expect().toShow('60');
        keys('5'); expect(expr()).toBe(' '); // a new entry clears it
        app.ac(); keys('30'); press('sin'); keys('='); expect(expr()).toBe('sin(30)');
        app.ac(); press('second'); keys('1'); press('sin'); keys('='); expect(expr()).toBe('sin<sup>-1</sup>(1)');
        app.ac(); keys('81'); press('root'); keys('4='); expect(expr()).toBe('<sup>4</sup>\u221A81');
  });

  it('keeps stock behaviors through the stack', function () {
        keys('3-+2='); expect().toShow('5'); // operator replacement
        keys('3*='); expect().toShow('9'); // default second operand
        keys('12+25%='); expect().toShow('15');
        keys('1+2=+4c5='); expect().toShow('8');
        keys('(2+'); press('pow'); keys('3)='); expect().toShow('8'); // replacement inside a group
  });

  it('keeps state across rotation', function () {
        keys('12+3');
        app.selectView(app.$.small); app.viewSelected(app, app.$.small);
        app.adjustHeightsAndUpdateDisplays();
        expect().toShow('3');
        keys('=');
        expect().toShow('15');
        app.chooseView();
  });
});
