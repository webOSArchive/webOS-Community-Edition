var EventEmitter = {};

EventEmitter.stack = { node: [], coverage: {} };

EventEmitter.nodes = [];

EventEmitter.emit = function (name, node) {
  if (node) {
    this.stack['node'].push(node);
  } else {
    throw "Node not found :(";
  }
};
