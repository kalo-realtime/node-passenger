// common resources for the app
var redis = require('redis')
  , config = require('config')
  , redisConfig = config.get('redis')
  , redisClient = redis.createClient(redisConfig.port, redisConfig.host, {});

common = {
  passengerExpiry: 24 * 60 * 60 * 1000,
  passengerCons: {},
  userCons: {},
  driverSubscriptions: {},
  bookingActiveStates: ['confirmed', 'pickingup', 'arrived', 'enroute'],
  bookingCancelledStates: ['pending', 'canceled', 'payment_pending', 'completed'],
  gpsPattern: /^gps_(\w+)/,
  bookingPattern: /^event_booking_(\w+)_(\w+)/,

  // return the connections hash depending on the user type
  userConnections: function(userType){
    if (userType == 1){
      return common.userCons;
    }else if (userType == 2){
      return common.passengerCons;
    }else{
      return {};
    }
  },

  storeDriverSubscription: function(driverId, passengerId){
    //TODO: Support multiple passengers 
    common.driverSubscriptions[driverId] = passengerId;
    redisClient.hset('driver-passenger', driverId, passengerId);
    redisClient.hset('passenger-expiry', driverId, Date.now() + common.passengerExpiry);
  },

  removeDriverSubscription: function(driverId){
    if (driverId in common.driverSubscriptions){
      delete common.driverSubscriptions[driverId];
    }

    redisClient.hdel('driver-passenger', driverId);
    redisClient.hdel('passenger-expiry', driverId);
  }
};

// crash recovery
(function loadDriverSubscriptions(){
  console.log('loading driver subscriptions...');
  redisClient.hgetall('driver-passenger', function(err, results) {
    for(k in results){
      redisClient.hget('passenger-expiry', k, function(err, expiry){
        if (expiry < Date.now()){
          redisClient.hdel('driver-passenger', k);
          redisClient.hdel('passenger-expiry', k);
        }else{
          common.driverSubscriptions[k] = results[k];
        }
      });
    }

    console.log(results);
  });
})();

// passenger is mapped to a driver max. 1 day
module.exports = common;
