// zmq setup
var config = require('config')
  , zmq    = require('zmq')
  , sub  = zmq.socket('sub')
  , dealer = zmq.socket('dealer')
  , sockets = {};

var driverConfig = config.get('driver')
  , driverApiConfig = config.get('driver-api')
  , mainApp = config.get('main_app')
  , mainAppUrl = mainApp.host + ':' + mainApp.port
  , backendRouter = driverApiConfig.host + ':' + driverApiConfig.router_port;

console.log("ZMQ: Driver nodes: " + driverConfig.nodes.length);

// connect to all driver nodes (publishers)
for (var i = 0, len = driverConfig.nodes.length; i < len; i++) {
  var driverUrl = driverConfig.nodes[i].host + ':' + driverConfig.nodes[i].port;
  sub.connect('tcp://' + driverUrl);
  console.log('ZMQ(Sub): Subscribed to driver: ' + driverUrl);
}

sub.connect('tcp://' + mainAppUrl);
console.log("ZMQ(Sub): Subscribed to Main app: " + mainAppUrl);

sub.subscribe('event');
sub.subscribe('gps');
sockets.sub = sub;

dealer.connect('tcp://'+ backendRouter);
dealer.messages = {};
sockets.dealer = dealer;

/* generate a random number to identify the outgoing message */
sockets.messageId = function(){
  return Math.floor((Math.random() * 10000000000) + 1);
}

//monitor(sub, 30000);

function monitor(socket, interval){
  socket.on('connect', function(fd, ep) {console.log('connect, endpoint:', ep);});
  socket.on('connect_delay', function(fd, ep) {console.log('connect_delay, endpoint:', ep);});
  socket.on('connect_retry', function(fd, ep) {console.log('connect_retry, endpoint:', ep);});
  socket.on('listen', function(fd, ep) {console.log('listen, endpoint:', ep);});
  socket.on('bind_error', function(fd, ep) {console.log('bind_error, endpoint:', ep);});
  socket.on('accept', function(fd, ep) {console.log('accept, endpoint:', ep);});
  socket.on('accept_error', function(fd, ep) {console.log('accept_error, endpoint:', ep);});
  socket.on('close', function(fd, ep) {console.log('close, endpoint:', ep);});
  socket.on('close_error', function(fd, ep) {console.log('close_error, endpoint:', ep);});
  socket.on('disconnect', function(fd, ep) {console.log('disconnect, endpoint:', ep);});

  // Call monitor, check for events every 500ms and get all available events.
  console.log('Start monitoring...');
  socket.monitor(interval, 0);
}

module.exports = sockets;
