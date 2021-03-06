var _ = require('underscore'),
headersToRequestFormat = function(headers){
  var newHeaders = {};
  if (_.isObject(headers) && !_.isArray(headers)){
    return headers;
  }
  if (!headers || headers.length === 0){
    return newHeaders;
  }
  headers.forEach(function(h){
    newHeaders[h.key] = h.value;
  });
  return newHeaders;
};

module.exports = function(requestObject, debug, cb){
  var request = require('request'),
  method = requestObject.method && requestObject.method.toLowerCase(),
  headers = headersToRequestFormat(requestObject.headers),
  rawHttpRequest, rawHttpResponse, r;
  
  if (_.isFunction(debug)){
    cb = debug;
    debug = false;
  }
  
  if (!requestObject.url || !method){
    return cb({ code : 400, message : 'All requests must contain a URL and Method' });
  }
  
  if (!request.hasOwnProperty(method)){
    return cb({code : 405, message : 'Method ' + method + ' is not supported'});
  }
  
  if (requestObject.body && _.isObject(requestObject.body)){
    requestObject.body = JSON.stringify(requestObject.body);
  }
  
  r = request[method]({
    url : requestObject.url,
    headers : headers,
    body : requestObject.body
  }, function(error, response, body){
    if (error){
      error.code = 400;
      return cb(error);
    }
    
    return cb(null, {
      request : {
        headers : headers,
        raw : rawHttpRequest
      },
      response : {
        statusCode : response.statusCode,
        headers : response.headers,
        body : body,
        raw : rawHttpResponse
      }
    });
  });
  
  // For all real requests, don't listen for request debug information
  if (!debug){
    return;
  }
  
  // If we're "try"ing a request, get the raw request and response
  rawHttpRequest = '';
  rawHttpResponse = '';
  
  // Listen to all request body write events
  var oldWriteFunction = request.Request.prototype.write;
  request.Request.prototype.write = function(data){
    rawHttpRequest += data.toString();
    oldWriteFunction.apply(this, arguments);
  };
  
  r.once('socket', function(socket){
    // Once the socket is assigned, prepend the headers
    rawHttpRequest = socket._httpMessage._header + rawHttpRequest;
    
    
    var oldOnDataFunction = socket.ondata;
    // Every ondata event, append to our raw request buffer
    // NB this can't be achieved by socket.on('data')..
    socket.ondata = function(buf, start, end) {
      rawHttpResponse += buf.slice(start, end).toString();
      return oldOnDataFunction.apply(this, arguments);
    };
  });
};
