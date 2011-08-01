var redis = require('redis-node');

var RedisQ = function(config)
{
    this.pattern = config.pattern;
    this.host = config.host || RedisQ.host;
    this.port = config.port || RedisQ.port;
    this.cull_frequency = config.cull_frequency || 5*60*1000; // default 5 minutes
    
    this.queue = {};
    this.subscribers = {};
    this.client = null;
};

RedisQ.init = function(port, host)
{
    RedisQ.port = port;
    RedisQ.host = host;
};

RedisQ.prototype.start = function()
{
    this._initRedis();
    this._cull();
};

RedisQ.prototype._initRedis = function()
{
    // console.log('Init Redis');
    
    var self = this;
    
    if(this.client)
    {
        // console.log('Already existing Redis client. Killing.');
        try {
            this.client.punsubscribe(channel);
            this.client.end();
        }catch(e){}
        // console.log('Killed.');
    }
    
    // console.log('Creating new Redis connection on '+this.host+':'+this.port);
    client = redis.createClient(this.port, this.host);
    client.subscribeTo(this.pattern, function(channel, message, pattern){
        self._onpmessage(channel, message, pattern);
    });
    // console.log('Subscribed to pattern: '+this.pattern);
};

RedisQ.prototype._onpmessage = function(channel, message, pattern)
{
    // console.log('Message received!');
    // console.log('\tChannel:\t'+channel);
    // console.log('\tMessage:\t'+message);
    // console.log('\tPattern:\t'+pattern);
    
    try {
        message = JSON.parse(message);
    }
    catch(e)
    {
        // invalid JSON
        //return;
    }
    
    // check if there is a queue for this channel yet
    if(!this.queue[channel]) this.queue[channel] = [];
    
    var m = new Message(message);
    this.queue[channel].push(m);
    
    if(this.subscribers[channel])
    {
        // console.log('There are subscribers on this channel!');
        var c;
        while(c = this.subscribers[channel].pop())
        {
            // console.log('\tSending to subscriber...');
            clearTimeout(c.interval);
            try{ c.callback(m); }catch(e){}
        }
        
        delete this.subscribers[channel];
    }
};

RedisQ.prototype.subscribe = function(channel, callback)
{
    // console.log('New subscriber on channel: '+channel);
    channel = this.pattern.replace('*', channel);
    if(!this.subscribers[channel]) this.subscribers[channel] = [];
    
    var i = setTimeout(function()
    {
        // console.log('Subscriber timeout on channel: '+channel);
        try{ callback(false); }catch(e){}
        // console.log('callback called!');
    }, 25000);
    
    this.subscribers[channel].push({interval: i, callback: callback});
};

RedisQ.prototype.since = function(channel, timestamp)
{
    // console.log('Since: '+timestamp);
    if(!this.queue[channel] || this.queue[channel].length === 0) return [];
    
    for(var i=this.queue[channel].length-1; i>=0; i--)
    {
        if(this.queue[channel][i].timestamp <= timestamp) return this.queue[channel].slice(i+1);
    }
    
    return this.queue[channel];
}

RedisQ.prototype._cull = function()
{
    var self = this;
    
    // console.log('Culling queue...');
    if(Object.keys(this.queue).length)
    {
        var now = new Date().getTime();
        
        // loop over every channel in the queue
        for(var channel in this.queue)
        {
            // loop over every message in the channel in reverse
            var i = this.queue[channel].length;
            while(this.queue[channel][--i])
            {
                // if the message is expired, remove it
                if(this.queue[channel][i].timestamp+this.cull_frequency < now)
                {
                    this.queue[channel].splice(0, i+1);
                    break;
                }
            }
            
            if(this.queue[channel].length === 0) delete this.queue[channel];
        }
    }
    else
    {
        // console.log('Nothing to cull.');
    }
    
    setTimeout(self._cull, this.cull_frequency);
};


var Message = function(m)
{
    this.timestamp = new Date().getTime();
    this.message = m;
};

exports.RedisQ = RedisQ;