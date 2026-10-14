var http = require('http');
var fs = require('fs');
var io = require('socket.io').listen(80);
var reporter = require('./lib/reporter');
var bunker = require('./lib/bunker');

var app = http.createServer(function (req, res) {

  // wrapper for responses
  var response = function (statusCode, data) {
    res.writeHead(statusCode, {'Content-Type': 'text/javascript'});
    res.end(data + "\n");
  };

  // self executing function will grab the query strings
  var query = (function (query) {
    var queryString = {};

    query.replace(/([^?=&]+)(=([^&]*))?/g, function ($0, $1, $2, $3) {
      queryString[$1] = $3;
    });

    return queryString;
  }(req.url));

  // do we initialize the bunker functions?
  if (query.bunker) {

    // return the bunker functions
    response(200, bunker.getFunctions());
  } else {
    // check the cache, if it's not in there, call the file.
    if (!app.cache.hasOwnProperty(query.path)) {
      try {
        // stat the file
        fs.statSync(__dirname + "/" + query.path);

        // load into cache
        app.cache[query.path] = bunker.doCompile(query.path, fs.readFileSync(__dirname + "/" + query.path));
      } catch (e) {
        response(404, "Not Found.");
      }
    }

    // return the cached file
    response(200, app.cache[query.path]);
  }

});

app.cache = {};
app.listen(8080);

io.sockets.on('connection', function (socket) {
  socket.on('tests completed', function (data) {
    reporter(data.node, data.coverage);
  });
});
