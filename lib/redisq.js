var redis = require('redis');

var RedisQ = function(config)
{
    // optionally pass in just the pattern string as a shortcut
    if(typeof config === 'string')
    {
        config = {pattern: config};
    }

    this.pattern = config.pattern;
    this.host = config.host || RedisQ.host;
    this.port = config.port || RedisQ.port;
    this.cull_frequency = config.cull_frequency || 5*60*1000; // default 5 minutes
    
    this.queue = {};
    this.subscribers = {};
    this.client = null;
};

// defaults
RedisQ.port = 6379;
RedisQ.host = '127.0.0.1';

/*
 * Globally declare a port and host to be used across all connections.
 */
RedisQ.init = function(port, host)
{
    RedisQ.port = port;
    RedisQ.host = host;
};

/*
 * Get things started. Must be called to begin listening for messages.
 */
RedisQ.prototype.start = function()
{
    this._initRedis();

    // kick off the culling
    this._cull();
};

/*
 * Interally start initialize the connection.
 *
 * @private
 */
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
    this.client = redis.createClient(this.port, this.host);
    this.client.on("pmessage", function(pattern, channel, message){
        self._onpmessage(pattern, channel, message);
    });
    this.client.psubscribe(this.pattern);
    // console.log('Subscribed to pattern: '+this.pattern);
};

RedisQ.prototype._onpmessage = function(pattern, channel, message)
{
    // console.log('Message received!');
    // console.log('\tChannel:\t'+channel);
    // console.log('\tMessage:\t'+message);
    // console.log('\tPattern:\t'+pattern);
    
    try {
        // try to parse the message as JSON first
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
    
    // check if there are any subscribers to the channel currently
    if(this.subscribers[channel])
    {
        // console.log('There are subscribers on this channel!');
        // loop through subscribers backwards and call their callbacks
        var c;
        while(c = this.subscribers[channel].pop())
        {
            // console.log('\tSending to subscriber...');

            // clean up their interval
            clearTimeout(c.interval);
            try{ c.callback(m); }catch(e){}
        }
        
        delete this.subscribers[channel];
    }
};

/*
 * Subscribe to a channel.
 * 
 * q.subscribe('myid', ...);
 */
RedisQ.prototype.subscribe = function(channel, callback)
{
    // console.log('New subscriber on channel: '+channel);

    // replace the '*' in the pattern with your channel for simplicity.
    channel = this.pattern.replace('*', channel);
    if(!this.subscribers[channel]) this.subscribers[channel] = [];
    
    // only hold a connection for a max of 25 seconds.
    var i = setTimeout(function()
    {
        // console.log('Subscriber timeout on channel: '+channel);
        // call the callback passing false
        try{ callback(false); }catch(e){}
        // console.log('callback called!');
    }, 25000);
    
    // append to subscribers list
    this.subscribers[channel].push({interval: i, callback: callback});
};

/*
 * Retrieve messages in the queue after the timestamp as an array.
 *
 * var messages = q.since('channel', new Date().getTime()-5000);
 */
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

/*
 * Internal method to cull the message queue.
 *
 * @private
 */
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
    
    setTimeout(function(){ self._cull(); }, this.cull_frequency);
};

/*
 * Message object with automatic timestamp.
 *
 * @private
 */
var Message = function(m)
{
    this.timestamp = new Date().getTime();
    this.message = m;
};

module.exports = RedisQ;