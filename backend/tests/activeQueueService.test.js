'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/activeQueueService');

function sampleQueue(overrides = {}) {
  return {
    queueId: 1,
    serviceId: 2,
    serviceName: 'Academic Advising',
    status: 'open',
    createdDate: '2026-08-01T12:00:00.000Z',
    ...overrides
  };
}

test('createQueue creates an open queue for an existing service', async () => {
  const expectedQueue = sampleQueue();
  const repository = {
    serviceExists: async () => true,
    findOpenByServiceId: async () => null,
    create: async (queue) => {
      assert.deepEqual(queue, { serviceId: 2, status: 'open' });
      return expectedQueue;
    }
  };

  const result = await service.createQueue({ serviceId: 2 }, repository);
  assert.deepEqual(result, expectedQueue);
});

test('createQueue normalizes uppercase status', async () => {
  const repository = {
    serviceExists: async () => true,
    findOpenByServiceId: async () => null,
    create: async (queue) => queue
  };

  const result = await service.createQueue(
    { serviceId: 2, status: 'OPEN' },
    repository
  );

  assert.deepEqual(result, { serviceId: 2, status: 'open' });
});

test('createQueue rejects a service that does not exist', async () => {
  const repository = {
    serviceExists: async () => false
  };

  await assert.rejects(
    () => service.createQueue({ serviceId: 99 }, repository),
    (error) => error.statusCode === 404
  );
});

test('createQueue rejects a second open queue for the same service', async () => {
  const repository = {
    serviceExists: async () => true,
    findOpenByServiceId: async () => sampleQueue()
  };

  await assert.rejects(
    () => service.createQueue({ serviceId: 2, status: 'open' }, repository),
    (error) => error.statusCode === 409
  );
});

test('createQueue validates service ID and status', async () => {
  await assert.rejects(
    () => service.createQueue({ serviceId: 0 }),
    (error) => error.statusCode === 400
  );

  await assert.rejects(
    () => service.createQueue({ serviceId: 1, status: 'paused' }),
    (error) => error.statusCode === 400
  );
});

test('getQueueById returns a queue', async () => {
  const expectedQueue = sampleQueue();
  const repository = {
    findById: async (queueId) => {
      assert.equal(queueId, 1);
      return expectedQueue;
    }
  };

  const result = await service.getQueueById('1', repository);
  assert.deepEqual(result, expectedQueue);
});

test('getQueueById returns 404 when the queue does not exist', async () => {
  const repository = {
    findById: async () => null
  };

  await assert.rejects(
    () => service.getQueueById(9, repository),
    (error) => error.statusCode === 404
  );
});

test('updateQueueStatus closes an existing queue', async () => {
  const currentQueue = sampleQueue();
  const closedQueue = sampleQueue({ status: 'closed' });
  const repository = {
    findById: async () => currentQueue,
    updateStatus: async (queueId, status) => {
      assert.equal(queueId, 1);
      assert.equal(status, 'closed');
      return closedQueue;
    }
  };

  const result = await service.updateQueueStatus(
    1,
    { status: 'closed' },
    repository
  );

  assert.equal(result.status, 'closed');
});

test('updateQueueStatus does not reopen a queue whose service was deleted', async () => {
  const repository = {
    findById: async () => sampleQueue({
      serviceId: null,
      serviceName: null,
      status: 'closed'
    })
  };

  await assert.rejects(
    () => service.updateQueueStatus(1, { status: 'open' }, repository),
    (error) => error.statusCode === 409
  );
});

test('listQueues validates the optional status filter', async () => {
  const repository = {
    findAll: async (status) => {
      assert.equal(status, 'open');
      return [sampleQueue()];
    }
  };

  const queues = await service.listQueues({ status: 'OPEN' }, repository);
  assert.equal(queues.length, 1);

  await assert.rejects(
    () => service.listQueues({ status: 'waiting' }, repository),
    (error) => error.statusCode === 400
  );
});