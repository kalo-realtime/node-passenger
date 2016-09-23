var WebSocketServer = require('ws').Server
  , config = require('config')
  , util = require('util')
  , restConfig = config.get('driver-api')
  , restOpts = {username: restConfig.api_key, password: ''}
  , restclient = require('restler')
  , apiUrl = util.format('http://%s:%s/users/', restConfig.host, restConfig.port)
  , sockets = require('./zmq.js')
  , common = require('./common.js')
  , zmqHandlers = require('./zmq_handlers')
  , jwt = require('jsonwebtoken');

//web socket connection
function wsConnection(server){
    // setup websocket
    var wss = new WebSocketServer({ server: server });

    // listeners for subscribers and dealer sockets
    sockets.sub.on('message', zmqHandlers.subscriptionHandler(wss, sockets));
    sockets.dealer.on('message', zmqHandlers.dealerHandler(wss, sockets));

    //FIXME: Use a separate child process
    wss.broadcast = function(data) {
      for (var i in this.clients)
        this.clients[i].send(data);
    };

    wss.filteredBroadcast = function(userType, data, driver_id){
      cons = common.userConnections(userType);

      if (userType == 1){
        for (var k in cons){
          broadcast(k);
        }
      }else if (userType == 2){
        if (driver_id in common.driverSubscriptions){
          broadcast(common.driverSubscriptions[driver_id]);
        }
      }

      function broadcast(key){
        console.log(userType + ' ' + driver_id + ' '  + key);
        try{ cons[key].send(data.toString());}
        catch(e){ console.log(e); }
      }
    }

    // websocket callbacks
    wss.on('connection', function connection(ws) {
      var apiUrl, slug, queryStr; 
      var query = require('url').parse('http://abc.com' + ws.upgradeReq.url, true).query;
      queryStr = '';

      var errorHandler = function(msg){
        return function(data){
          ws.send( JSON.stringify({error: msg}) );
          console.log(msg + ' Error:' + JSON.stringify(data));
          ws.close();
          return;
        }
      }

      if ( !(query && (query.jwt || query.auth_token) )){
        errorHandler('JWT not provided or Auth token')(query);
        return;
      }

      if(query.auth_token){
        apiUrl  = util.format('http://%s:%s/passengers/', restConfig.host, restConfig.port);
        slug    = query.auth_token;
        queryStr = '?id_type=token';
      }else if(query.jwt){
        var data = jwt.decode(query.jwt);

        if (!(data && data.user_id)){
          errorHandler('Authentication failed')(data);
          return;
        }

        if (data.role == 'passenger'){
          apiUrl  = util.format('http://%s:%s/passengers/', restConfig.host, restConfig.port);
        }else{
          apiUrl  = util.format('http://%s:%s/users/', restConfig.host, restConfig.port);
        }

        slug    = data.user_id;
      }

      // authenticate with driver backend
      restclient.get(apiUrl + slug + queryStr, restOpts)
      .on('2XX', function(user){
        var role_id;

        if (query.jwt){
          jwt.verify(query.jwt, user.authentication_token, {iss: "VGO.lk"}, function(err, decoded) {
            if (err) {
              errorHandler(err.message)(user);
              return;
            }else if(!decoded){
              errorHandler('Authentication failed')(user);
              return;
            }else if(!user || !user.id){
              errorHandler('Invalid authentication response')(user);
              return;
            }

            if (data.role == 'passenger'){
              role_id = 2;
            }else{
              role_id = 1;
            }

            authenticationSuccess(role_id, user.id);
          });
        }else if (query.auth_token){
          authenticationSuccess(2, user.id);
        }else{
          errorHandler('Unsupported authentication mechanism')(query);
          return;
        }

        // user_type: 1 = user, 2 - passenger
        function authenticationSuccess(userType, id){
          console.log("Authenciation success...")
          console.log('websocket authenticating ...' + user.email);

          // incoming message from websocket
          ws.on('message', function(message) {
            console.log('received: %s', message);
            var msgObj, msgId;

            try{
              msgObj = JSON.parse(message);
              if (msgObj.event && /SEARCH/i.test(msgObj.event)){
                msgId = sockets.messageId();
                sockets.dealer.messages[msgId] = ws;
                sockets.dealer.send([msgObj.event, id, msgId, message]);
              }
            }catch(e){
              console.log(e);
              return;
            }
          });

          ws.on('close', function() {
            if (ws.userId && ws.userId in common.userConnections(ws.userType)){
              delete common.userConnections(ws.userType)[ws.userId];
            }

            console.log('stopping client');
          });

          ws.userId = id;
          ws.userType = userType;
          common.userConnections(userType)[ws.userId] = ws;

          console.log('web socket connection established');
        }
      })
      .on('4XX', errorHandler('Authentication failed'))
      .on('5XX', errorHandler('Server error'))
      .on('error', errorHandler('Error'));
    });
};
 
module.exports = {
  connection: wsConnection
}
