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

class Server {
  constructor(natsClient, topic, methods) {
    this.natsClient = natsClient;
    this.methods = methods;

    natsClient.subscribe(topic, (request, replyTo) => {
      this.handleRequest(request, replyTo);
    });
  }

  handleRequest(request, replyTo) {
    var isBatch = false;
    this.parseRequest(request)
      .then(parsedRequest => this.validateRequest(parsedRequest))
      .then((validRequest) => {
        var batch;
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
        if (results.length == 1 && !isBatch) {
          this.natsClient.publish(replyTo, JSON.stringify(results[0]));
        } else if (results.length > 0) {
          this.natsClient.publish(replyTo, JSON.stringify(results));
        }
      })
      .catch((err) => {
        this.natsClient.publish(replyTo, JSON.stringify(createError(err, null)));
      });
  }

  handleOne(request) {
    if (!(request.method in this.methods)) {
      const err = new Error('Method not found');
      err.jsonRpcErrorCode = -32601;
      return Promise.reject(err);
    }

    var requestId = undefined;
    if (request.id !== undefined) {
      requestId = request.id;
    }

    return this.methods[request.method](request.params)
      .then((result) => {
        return Server.createResponse(result, requestId);
      })
      .catch((err) => {
        return Server.createError(err, requestId);
      });
  }

  parseRequest(request) {
    return new Promise((resolve, reject) => {
      try {
        const parsedRequest = JSON.parse(request);
        resolve(parsedRequest);
      } catch (err) {
        const newErr = new Error('Parse error');
        newErr.jsonRpcErrorCode = -32700;
        reject(newErr);
        return;
      }
    });
  }

  validateRequest(request) {
    // TODO: validate request schema

    return new Promise((resolve, reject) => {
      resolve(request);
      return;
    });
  }

  static createError(err, requestId) {
    if (requestId === undefined) {
      return null;
    }
    return {
      jsonrpc: '2.0',
      error: {
        code: err.jsonRpcErrorCode || 0,
        message: err.message
      },
      id: requestId,
    };
  }

  static createResponse(result, requestId) {
    if (requestId === undefined) {
      return null;
    }
    return {
      jsonrpc: '2.0',
      result: result,
      id: requestId
    };
  }
}

module.exports = Server;
