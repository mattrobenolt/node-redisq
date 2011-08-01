var RedisQ = require('../lib/redisq').RedisQ,
    redis = require('redis-node'),
    client = redis.createClient(6379, '10.0.30.3');

RedisQ.init(6379, '10.0.30.3');

var queue = new RedisQ({
    pattern: "queue:*"
});
queue.start();

queue.subscribe('a', function(message)
{
    console.log('a', message);
});

queue.subscribe('b', function(message)
{
    console.log('b', message);
});

