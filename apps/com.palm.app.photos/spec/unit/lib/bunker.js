var bunker = require("bunker")("");
var fs = require('fs');

bunker.doCompile = function (filename, src) {
  this.sources = [];
  this.counter = this.nodes.length;
  this.include(src);

  var addEE = function () {
    var nodes = "";

    this.nodes.slice(this.counter).forEach(function (n) {
      nodes += "EventEmitter.nodes[" + n.id + "] = {";
      nodes += "id: '" + n.id + "'";
      nodes += ", fileName: '" + filename + "'";
      nodes += ", start: " + JSON.stringify(n.start);
      nodes += ", end: " + JSON.stringify(n.end);
      nodes += "};\n";
    });

    return nodes;
  }.bind(this);

  var addAmt = function () {
    return "EventEmitter.stack.coverage['" + filename + "'] = " + (this.nodes.length - this.counter) + ";\n";
  }.bind(this);

  var code = this.compile();

  return addEE() + addAmt() + code;
};

bunker.getFunctions = function () {
  var context = this.assign({});

  var str = "";
  Object.keys(context).forEach(function (key) {
    str += "global['" + key + "'] = " + context[key].toString() + ";\n";
  });

  function useEE() {
    return fs.readFileSync(__dirname + '/EventEmitter.js').toString();
  }

  function wrap(src) {
    return "(function (global) {\nvar self = EventEmitter;\nvar stack = [];\n\n" + src + "\n}(this));";
  }

  return useEE() + wrap(str);
};

module.exports = bunker;
