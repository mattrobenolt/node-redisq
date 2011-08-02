var redis = require('redis'),
    client = redis.createClient(6379, '127.0.0.1');

client.publish('queue:a', 'hello, queue:a');
client.publish('queue:b', 'hello, queue:b');