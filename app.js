// driver app start script
var http = require('http') 
  , express = require('express')
  , logger = require('morgan')
  , path = require('path')
  , config = require('config')
  , ws = require('./lib/ws.js');

var serverConfig = config.get('server')
  , app = express()
  , server = http.createServer(app);

// routes
var routes = require('./routes/index');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.static(path.join(__dirname, 'public')));
app.use(logger('dev'));

app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

//start server
server.listen(serverConfig.port);
console.log('Server started on port', serverConfig.port);

//initiate web socket service 
ws.connection(server);

console.log("Passenger node server started...");
