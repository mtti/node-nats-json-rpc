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

const Client = require('./client');

const okResponse = {
  jsonrpc: '2.0',
  result: {
    resultKey: 'resultValue',
  },
  id: null,
};

describe('Client', () => {
  let params;
  let natsClient;
  let client;

  beforeEach(() => {
    params = {
      foo: 'bar',
    };

    natsClient = {
      requestOne: sinon.stub().callsArgWith(4, okResponse),
    };

    client = new Client(natsClient, 'dummy-subject');
  });

  describe('request()', () => {
    it('should resolve with result when there is no error', () => {
      const expected = {
        resultKey: 'resultValue',
      };

      return client.request('dummyMethod', params)
        .then((actual) => {
          assert.deepEqual(actual, expected);
        })
        .catch((err) => {
          assert.fail(err, null, 'Promise should not reject');
        });
    });

    it('should reject when an error response is received', () => {
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: 0,
          message: 'Dummy error',
        },
        id: null,
      };
      natsClient.requestOne = sinon.stub().callsArgWith(4, errorResponse);

      return client.request('dummyMethod', params)
        .then((actual) => {
          assert.fail(actual, null, 'Promise should have rejected');
        })
        .catch((err) => {
          assert.equal(err.message, 'RPC error: Dummy error');
        });
    });
  });
});
