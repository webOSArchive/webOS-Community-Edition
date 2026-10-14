var fs = require('fs');

var Files = {};

var File = function (name, coverage) {
  this.name = name;
  this.coverage = coverage;

  if (!File.coverage.hasOwnProperty(this.name)) {
    File.coverage[this.name] = {};
  }

  if (!Files.hasOwnProperty(this.name)) {
    Files[this.name] = this;
  }

  return Files[this.name];
};

File.prototype.addCoverage = function (id) {
  File.coverage[this.name][id] = true;
};

File.prototype.getCoverage = function () {
 return Object.keys(File.coverage[this.name]);
};

File.prototype.getPercentage = function () {
  var available = this.coverage;
  var covered = this.getCoverage().length;

  return Math.round((covered / available) * 100);
};

File.getFiles = function () {
  return {
    forEach: function (callback) {
      Object.keys(Files).forEach(function (k, i) {
        callback(Files[k], i);
      });
    },
    length: Object.keys(Files).length
  };
};

File.coverage = {};

module.exports = function (nodes, coverage) {

  var tally = 0;

  nodes.forEach(function (node) {
    var file = new File(node.fileName, coverage[node.fileName]);
    file.addCoverage(node.id);
  });

  console.log();

  File.getFiles().forEach(function (file) {
    tally += file.getPercentage();
    console.log(file.name + " has " + file.getPercentage() + "% code coverage.");
  });

  console.log();
  console.log();

  console.log("Total coverage: " + Math.round(tally / File.getFiles().length) + "%");
  console.log();
};
