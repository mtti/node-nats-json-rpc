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

const nats = require('nats');

class Client {
  constructor(natsClient, subject, options) {
    let opts = {};
    if (options) {
      opts = options;
    }

    this.options = {
      defaultTimeout: 1000,
    };
    if (opts.defaultTimeout !== undefined) {
      this.options.defaultTimeout = opts.defaultTimeout;
    }

    this.natsClient = natsClient;
    this.subject = subject;
  }

  request(methodName, params, options) {
    let opts = {};
    if (options) {
      opts = options;
    }
    const timeout = opts.timeout || this.options.defaultTimeout;

    const message = {
      jsonrpc: '2.0',
      method: methodName,
      params,
      id: null,
    };

    return new Promise((resolve, reject) => {
      this.natsClient.requestOne(this.subject, JSON.stringify(message), {}, timeout, (response) => {
        if (response instanceof nats.NatsError) {
          reject(response);
          return;
        }
        resolve(response);
      });
    });
  }
}

module.exports = Client;
