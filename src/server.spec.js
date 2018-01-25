const Server = require('./server');

function createFakeNatsClient() {
  return {
    subscribe: sinon.spy(),
  };
}

describe('Server', () => {
  describe('handleOne()', () => {
    let request;
    let natsClient;
    let methods;
    let server;
    let createError;
    let createResponse;

    beforeEach(() => {
      request = {
        jsonrpc: '2.0',
        method: 'dummyMethod',
        params: {
          dummyParam: 'dummyValue',
        },
        id: null,
      };
      natsClient = createFakeNatsClient();
      methods = {
        dummyMethod: sinon.stub().resolves('dummy result'),
      };
      server = new Server(natsClient, 'dummyTopic', methods);
      createError = sandbox.spy(Server, 'createError');
      createResponse = sandbox.spy(Server, 'createResponse');
    });

    it('raises error when method is not found', () => {
      request.method = 'nonExistentMethod';
      return server.handleOne(request)
        .then((result) => {
          assert.fail(result, null, 'Promise should not resolve');
        })
        .catch((err) => {
          assert(err.jsonRpcErrorCode === -32601);
        });
    });

    it('when method resolves', () => server.handleOne(request)
      .then((actual) => {
        assert(createResponse.called, 'Should call createResponse');
      })
      .catch((err) => {
        assert.fail(err, null, 'Promise should not reject');
      }));

    it('when method rejects', () => {
      methods.dummyMethod = sinon.stub().rejects(new Error('Dummy error'));
      return server.handleOne(request)
        .then((result) => {
          assert(createError.called, 'Should call createError');
        })
        .catch((err) => {
          assert.fail(err, null, 'Promise should not reject');
        });
    });
  });

  describe('createError()', () => {
    let err;
    let expected;

    beforeEach(() => {
      err = new Error('Dummy error');

      expected = {
        jsonrpc: '2.0',
        error: {
          code: 0,
          message: 'Dummy error',
        },
        id: null,
      };
    });

    it('returns null when requestId is undefined', () => {
      const actual = Server.createError(err);
      assert.isNull(actual);
    });

    it('when requestId is null', () => {
      const actual = Server.createError(err, null);
      assert.deepEqual(actual, expected);
    });

    it('when requestId is a string', () => {
      expected.id = 'abcd';
      const actual = Server.createError(err, 'abcd');
      assert.deepEqual(actual, expected);
    });

    it('when requestId is a number', () => {
      expected.id = 1234;
      const actual = Server.createError(err, 1234);
      assert.deepEqual(actual, expected);
    });

    it('honors jsonRpcErrorCode', () => {
      expected.error.code = 1234;
      err.jsonRpcErrorCode = 1234;
      const actual = Server.createError(err, null);
      assert.deepEqual(actual, expected);
    });
  });

  describe('createResponse()', () => {
    it('returns null when requestId is undefined', () => {
      const actual = Server.createResponse('foo');
      assert.isNull(actual);
    });

    it('when requestId is null', () => {
      const expected = {
        jsonrpc: '2.0',
        result: 'foo',
        id: null,
      };
      const actual = Server.createResponse('foo', null);
      assert.deepEqual(actual, expected);
    });

    it('when requestId is a string', () => {
      const expected = {
        jsonrpc: '2.0',
        result: 'foo',
        id: 'abcdefg',
      };
      const actual = Server.createResponse('foo', 'abcdefg');
      assert.deepEqual(actual, expected);
    });

    it('when requestId is a number', () => {
      const expected = {
        jsonrpc: '2.0',
        result: 'foo',
        id: 1234,
      };
      const actual = Server.createResponse('foo', 1234);
      assert.deepEqual(actual, expected);
    });
  });
});
