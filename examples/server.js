var redis = require('redis-node'),
    client = redis.createClient(6379, '10.0.30.3');

client.publish('queue:a', 'hello, queue:a');
client.publish('queue:b', 'hello, queue:b');