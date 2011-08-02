var RedisQ = require('../lib/redisq').RedisQ,
    redis = require('redis'),
    client = redis.createClient(6379, '127.0.0.1');

RedisQ.init(6379, '127.0.0.1');

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