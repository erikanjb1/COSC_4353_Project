'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createQueueRepository,
  mapQueue
} = require('../src/data/queueRepository');

function createFakeDatabase(responses) {
  const calls = [];

  return {
    calls,
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      const response = responses.shift();

      if (!response) {
        throw new Error('No fake database response was provided.');
      }

      return response;
    }
  };
}

test('mapQueue converts MySQL aliases to API fields', () => {
  const result = mapQueue({
    queueId: '4',
    serviceId: '7',
    serviceName: 'IT Help Desk',
    status: 'open',
    createdDate: '2026-08-01 12:00:00'
  });

  assert.deepEqual(result, {
    queueId: 4,
    serviceId: 7,
    serviceName: 'IT Help Desk',
    status: 'open',
    createdDate: '2026-08-01 12:00:00'
  });
});

test('mapQueue preserves a null service after ON DELETE SET NULL', () => {
  const result = mapQueue({
    queueId: '4',
    serviceId: null,
    serviceName: null,
    status: 'closed',
    createdDate: '2026-08-01 12:00:00'
  });

  assert.equal(result.serviceId, null);
  assert.equal(result.serviceName, null);
});

test('findAll uses Created_Date and supports a status filter', async () => {
  const database = createFakeDatabase([
    [[{
      queueId: 1,
      serviceId: 2,
      serviceName: 'Advising',
      status: 'open',
      createdDate: '2026-08-01'
    }], []]
  ]);
  const repository = createQueueRepository(database);

  const result = await repository.findAll('open');

  assert.equal(result.length, 1);
  assert.match(database.calls[0].sql, /q\.Status = \?/);
  assert.match(database.calls[0].sql, /q\.Created_Date/);
  assert.match(database.calls[0].sql, /LEFT JOIN Service/);
  assert.deepEqual(database.calls[0].parameters, ['open']);
});

test('create inserts a queue and then retrieves it', async () => {
  const database = createFakeDatabase([
    [{ insertId: 12, affectedRows: 1 }, []],
    [[{
      queueId: 12,
      serviceId: 3,
      serviceName: 'Financial Aid',
      status: 'open',
      createdDate: '2026-08-01'
    }], []]
  ]);
  const repository = createQueueRepository(database);

  const result = await repository.create({ serviceId: 3, status: 'open' });

  assert.equal(result.queueId, 12);
  assert.match(database.calls[0].sql, /INSERT INTO `Queue`/);
  assert.deepEqual(database.calls[0].parameters, [3, 'open']);
});

test('updateStatus returns null when no queue is updated', async () => {
  const database = createFakeDatabase([
    [{ affectedRows: 0 }, []]
  ]);
  const repository = createQueueRepository(database);

  const result = await repository.updateStatus(100, 'closed');
  assert.equal(result, null);
});

test('serviceExists returns true when MySQL returns a service row', async () => {
  const database = createFakeDatabase([
    [[{ Service_ID: 2 }], []]
  ]);
  const repository = createQueueRepository(database);

  assert.equal(await repository.serviceExists(2), true);
});