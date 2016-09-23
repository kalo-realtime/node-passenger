var util = require('util')
  , config = require('config')
  , common = require('./common.js');

var redis = require('redis')
  , redisConfig = config.get('redis')
  , redisClient = redis.createClient(redisConfig.port, redisConfig.host, {});

function subscriptionHandler(wss, sockets){
  return function(topic, message) {
    if (!topic || !message) return;

    console.log('Broadcasting message topic:', topic.toString(), 'with message:', message.toString());
    var msg, booking;

    if (args = topic && topic.toString().match(common.gpsPattern)){
      msg = '{"gps":' + message + '}'

      if (args[1] in common.driverSubscriptions){
        wss.filteredBroadcast(2, message, args[1]);
      } 
    }else{
      msg = '{"' + topic.toString() + '":' + message + '}'
      
      if (args = topic && topic.toString().match(common.bookingPattern)){
        state = args[2];

        try{
          booking = JSON.parse(message.toString());
        }catch(e){
          console.log(e);console.log(message.toString());
          return;
        }

        if (booking.driver && booking.passenger_id){
          // subscribe/unsubscribe passenger to the driver
          if (common.bookingActiveStates.indexOf(state) >= 0){
            console.log('Adding driver ' + booking.driver.hash_key + ' to the booking ' +
                        booking.hash_key);
            common.storeDriverSubscription(booking.driver.hash_key, booking.passenger_id);

          }else if (common.bookingCancelledStates.indexOf(state) >= 0){
            common.removeDriverSubscription(booking.driver.hash_key);
          }

          eventMsg = '{"event": "STATE_CHANGE", "object": "booking", "booking":' + 
                                message + ', "state":' + '"' + state + '"}';
          wss.filteredBroadcast(2, eventMsg, booking.driver.hash_key);
        }
      }
    }

    // broadcast to all users (operators)
    wss.filteredBroadcast(1, msg);
    //wss.broadcast(msg);
  }
}

function dealerHandler(wss, sockets){
  return function(event, id, code, msg) {
    console.log('Dealer receivved ' + event + ' ' + id + ' ' + code + ' ' + msg);

    try{
      if (/SEARCH/i.test('search')){
        if (id in sockets.dealer.messages){
          sockets.dealer.messages[id].send(msg.toString());
          delete(sockets.dealer.messages[id]);
        }
      }
    }catch(e){
      console.log(e);
    }
  }
}

module.exports = {
  subscriptionHandler: subscriptionHandler,
  dealerHandler: dealerHandler
}
