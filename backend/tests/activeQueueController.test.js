"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createActiveQueueController
} = require(
  "../src/controllers/activeQueueController"
);

function createResponse() {
  return {
    statusCode: null,
    payload: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test(
  "listQueues controller returns HTTP 200",
  async () => {
    const queues = [
      {
        queueId: 1,
        serviceId: 1,
        serviceName: "Academic Advising",
        status: "open"
      }
    ];

    const controller =
      createActiveQueueController({
        listQueues: async (query) => {
          assert.deepEqual(query, {
            status: "open"
          });

          return queues;
        }
      });

    const response = createResponse();

    await controller.listQueues(
      {
        query: {
          status: "open"
        }
      },
      response,
      assert.fail
    );

    assert.equal(
      response.statusCode,
      200
    );

    assert.deepEqual(
      response.payload,
      {
        success: true,
        data: queues
      }
    );
  }
);

test(
  "listQueues passes errors to next",
  async () => {
    const expectedError =
      new Error("Database unavailable.");

    const controller =
      createActiveQueueController({
        listQueues: async () => {
          throw expectedError;
        }
      });

    const response = createResponse();
    let receivedError = null;

    await controller.listQueues(
      {
        query: {}
      },
      response,
      function (error) {
        receivedError = error;
      }
    );

    assert.equal(
      receivedError,
      expectedError
    );

    assert.equal(
      response.statusCode,
      null
    );
  }
);

test(
  "getQueue controller returns HTTP 200",
  async () => {
    const expectedQueue = {
      queueId: 1,
      serviceId: 1,
      serviceName: "Academic Advising",
      status: "open"
    };

    const controller =
      createActiveQueueController({
        getQueueById: async (
          queueId
        ) => {
          assert.equal(
            queueId,
            "1"
          );

          return expectedQueue;
        }
      });

    const response = createResponse();

    await controller.getQueue(
      {
        params: {
          queueId: "1"
        }
      },
      response,
      assert.fail
    );

    assert.equal(
      response.statusCode,
      200
    );

    assert.deepEqual(
      response.payload,
      {
        success: true,
        data: expectedQueue
      }
    );
  }
);

test(
  "getQueue passes errors to next",
  async () => {
    const expectedError =
      new Error(
        "Queue was not found."
      );

    const controller =
      createActiveQueueController({
        getQueueById: async () => {
          throw expectedError;
        }
      });

    const response = createResponse();
    let receivedError = null;

    await controller.getQueue(
      {
        params: {
          queueId: "99"
        }
      },
      response,
      function (error) {
        receivedError = error;
      }
    );

    assert.equal(
      receivedError,
      expectedError
    );

    assert.equal(
      response.statusCode,
      null
    );
  }
);

test(
  "getOpenQueueForService controller returns HTTP 200",
  async () => {
    const expectedQueue = {
      queueId: 1,
      serviceId: 1,
      serviceName: "Academic Advising",
      status: "open"
    };

    const controller =
      createActiveQueueController({
        getOpenQueueByServiceId:
          async function (
            serviceId
          ) {
            assert.equal(
              serviceId,
              "1"
            );

            return expectedQueue;
          }
      });

    const response = createResponse();

    await controller
      .getOpenQueueForService(
        {
          params: {
            serviceId: "1"
          }
        },
        response,
        assert.fail
      );

    assert.equal(
      response.statusCode,
      200
    );

    assert.deepEqual(
      response.payload,
      {
        success: true,
        data: expectedQueue
      }
    );
  }
);

test(
  "getOpenQueueForService passes errors to next",
  async () => {
    const expectedError =
      new Error(
        "Open queue was not found."
      );

    const controller =
      createActiveQueueController({
        getOpenQueueByServiceId:
          async function () {
            throw expectedError;
          }
      });

    const response = createResponse();
    let receivedError = null;

    await controller
      .getOpenQueueForService(
        {
          params: {
            serviceId: "99"
          }
        },
        response,
        function (error) {
          receivedError = error;
        }
      );

    assert.equal(
      receivedError,
      expectedError
    );

    assert.equal(
      response.statusCode,
      null
    );
  }
);

test(
  "createQueue controller returns HTTP 201",
  async () => {
    const queue = {
      queueId: 1,
      serviceId: 1,
      serviceName: "Academic Advising",
      status: "open"
    };

    const controller =
      createActiveQueueController({
        createQueue: async (
          body
        ) => {
          assert.deepEqual(
            body,
            {
              serviceId: 1,
              status: "open"
            }
          );

          return queue;
        }
      });

    const response = createResponse();

    await controller.createQueue(
      {
        body: {
          serviceId: 1,
          status: "open"
        }
      },
      response,
      assert.fail
    );

    assert.equal(
      response.statusCode,
      201
    );

    assert.deepEqual(
      response.payload,
      {
        success: true,
        data: queue
      }
    );
  }
);

test(
  "createQueue passes errors to next",
  async () => {
    const expectedError =
      new Error(
        "Service was not found."
      );

    const controller =
      createActiveQueueController({
        createQueue: async () => {
          throw expectedError;
        }
      });

    const response = createResponse();
    let receivedError = null;

    await controller.createQueue(
      {
        body: {
          serviceId: 99,
          status: "open"
        }
      },
      response,
      function (error) {
        receivedError = error;
      }
    );

    assert.equal(
      receivedError,
      expectedError
    );

    assert.equal(
      response.statusCode,
      null
    );
  }
);

test(
  "updateQueueStatus controller returns HTTP 200",
  async () => {
    const updatedQueue = {
      queueId: 1,
      serviceId: 1,
      serviceName: "Academic Advising",
      status: "closed"
    };

    const controller =
      createActiveQueueController({
        updateQueueStatus:
          async function (
            queueId,
            body
          ) {
            assert.equal(
              queueId,
              "1"
            );

            assert.deepEqual(
              body,
              {
                status: "closed"
              }
            );

            return updatedQueue;
          }
      });

    const response = createResponse();

    await controller
      .updateQueueStatus(
        {
          params: {
            queueId: "1"
          },
          body: {
            status: "closed"
          }
        },
        response,
        assert.fail
      );

    assert.equal(
      response.statusCode,
      200
    );

    assert.deepEqual(
      response.payload,
      {
        success: true,
        data: updatedQueue
      }
    );
  }
);

test(
  "updateQueueStatus passes errors to next",
  async () => {
    const expectedError =
      new Error(
        "Queue was not found."
      );

    const controller =
      createActiveQueueController({
        updateQueueStatus:
          async function () {
            throw expectedError;
          }
      });

    const response = createResponse();
    let receivedError = null;

    await controller
      .updateQueueStatus(
        {
          params: {
            queueId: "99"
          },
          body: {
            status: "closed"
          }
        },
        response,
        function (error) {
          receivedError = error;
        }
      );

    assert.equal(
      receivedError,
      expectedError
    );

    assert.equal(
      response.statusCode,
      null
    );
  }
);
