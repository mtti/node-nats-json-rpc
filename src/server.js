/*
Copyright 2018 Matti Hiltunen

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const EventEmitter = require('events');

class Server extends EventEmitter {
  constructor(natsClient, topic, methods) {
    super();

    this.natsClient = natsClient;
    this.methods = methods;

    const options = {
      queue: 'node-nats-json-rpc',
    };
    natsClient.subscribe(topic, options, (request, replyTo) => {
      this.handleRequest(request, replyTo);
    });
  }

  handleRequest(rawRequest, replyTo) {
    let isBatch = false;
    Server.parseRequest(rawRequest)
      .then(parsedRequest => Server.validateRequest(parsedRequest))
      .then((validRequest) => {
        let batch;
        if (Array.isArray(validRequest)) {
          batch = validRequest;
          isBatch = true;
        } else {
          batch = [validRequest];
        }
        return Promise.all(batch.map(request => this.handleOne(request)));
      })
      .then(results => results.filter(result => result !== null))
      .then((results) => {
        if (results.length === 1 && !isBatch) {
          this.natsClient.publish(replyTo, JSON.stringify(results[0]));
        } else if (results.length > 0) {
          this.natsClient.publish(replyTo, JSON.stringify(results));
        }
      })
      .catch((err) => {
        this.natsClient.publish(replyTo, JSON.stringify(this.createError(err, null)));
      });
  }

  handleOne(request) {
    if (!(request.method in this.methods)) {
      const err = new Error('Method not found');
      err.jsonRpcErrorCode = -32601;
      return Promise.reject(err);
    }

    let requestId;
    if (request.id !== undefined) {
      requestId = request.id;
    }

    return this.methods[request.method](request.params)
      .then(result => this.createResponse(result, requestId))
      .catch(err => this.createError(err, requestId));
  }

  static parseRequest(request) {
    return new Promise((resolve, reject) => {
      try {
        const parsedRequest = JSON.parse(request);
        resolve(parsedRequest);
      } catch (err) {
        const newErr = new Error('Parse error');
        newErr.jsonRpcErrorCode = -32700;
        reject(newErr);
      }
    });
  }

  static validateRequest(request) {
    // TODO: validate request schema

    return new Promise((resolve) => {
      resolve(request);
    });
  }

  createError(err, requestId) {
    this.emit('requestError', err);

    if (requestId === undefined) {
      return null;
    }
    return {
      jsonrpc: '2.0',
      error: {
        code: err.jsonRpcErrorCode || 0,
        message: err.message,
      },
      id: requestId,
    };
  }

  createResponse(result, requestId) {
    this.emit('requestSuccess', result);

    if (requestId === undefined) {
      return null;
    }
    return {
      jsonrpc: '2.0',
      result,
      id: requestId,
    };
  }
}

module.exports = Server;
