'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createQueueEntryRepository,
  mapEntry,
  mapQueue,
  mapService
} = require('../src/data/queueEntryRepository');

const serviceRow = {
  id: '1',
  name: 'Academic Advising',
  description: 'Meet with an academic advisor',
  expectedDuration: '20',
  priorityLevel: 'normal',
  isOpen: 1
};

const queueRow = {
  queueId: '7',
  serviceId: '1',
  status: 'open'
};

const entryRow = {
  id: '10',
  queueEntryId: '10',
  queueId: '7',
  serviceId: '1',
  serviceName: 'Academic Advising',
  userId: '4',
  userName: 'Test User',
  priority: 'normal',
  position: '1',
  joinedAt: '2026-08-06 12:00:00',
  servedAt: null,
  leftAt: null,
  status: 'waiting'
};

function createFakeDatabase(methodName, ...responses) {
  const calls = [];

  const database = {
    calls
  };

  database[methodName] = async function (sql, parameters = []) {
    calls.push({
      sql,
      parameters
    });

    if (responses.length === 0) {
      throw new Error('The fake database has no response remaining.');
    }

    return responses.shift();
  };

  return database;
}

function createExecuteDatabase(...responses) {
  return createFakeDatabase('execute', ...responses);
}


test('mapService maps a service row and handles a missing row', function () {
  assert.equal(mapService(null), null);

  assert.deepEqual(mapService(serviceRow), {
    id: 1,
    name: 'Academic Advising',
    description: 'Meet with an academic advisor',
    expectedDuration: 20,
    priorityLevel: 'normal',
    isOpen: true
  });
});

test('mapQueue maps a queue row and handles a missing row', function () {
  assert.equal(mapQueue(null), null);

  assert.deepEqual(mapQueue(queueRow), {
    queueId: 7,
    serviceId: 1,
    status: 'open'
  });
});

test('mapEntry maps queue entries and handles a null service ID', function () {
  assert.equal(mapEntry(null), null);

  assert.deepEqual(mapEntry(entryRow), {
    id: '10',
    queueEntryId: 10,
    queueId: 7,
    serviceId: 1,
    serviceName: 'Academic Advising',
    userId: 4,
    userName: 'Test User',
    priority: 'normal',
    position: 1,
    joinedAt: '2026-08-06 12:00:00',
    servedAt: null,
    leftAt: null,
    status: 'waiting'
  });

  const entryWithoutService = mapEntry({
    ...entryRow,
    serviceId: null
  });

  assert.equal(entryWithoutService.serviceId, null);
});



test('repository supports an execute database', async function () {
  const database = createExecuteDatabase([[serviceRow]]);
  const repository = createQueueEntryRepository(database);

  const service = await repository.findServiceById(1);

  assert.equal(service.id, 1);
  assert.equal(database.calls.length, 1);
  assert.deepEqual(database.calls[0].parameters, [1]);
});

test('repository supports a database pool', async function () {
  const pool = createExecuteDatabase([[serviceRow]]);
  const repository = createQueueEntryRepository({ pool });

  const service = await repository.findServiceById(1);

  assert.equal(service.id, 1);
  assert.equal(pool.calls.length, 1);
});

test('repository supports promise databases', async function () {
  const promisedDatabase = createExecuteDatabase([[serviceRow]]);
  let promiseCalls = 0;

  const database = {
    promise() {
      promiseCalls += 1;
      return promisedDatabase;
    }
  };

  const repository = createQueueEntryRepository(database);
  const service = await repository.findServiceById(1);

  assert.equal(service.id, 1);
  assert.equal(promiseCalls, 1);
});

test('repository uses query when execute is unavailable', async function () {
  const database = createFakeDatabase('query', [[serviceRow]]);
  const repository = createQueueEntryRepository(database);

  const service = await repository.findServiceById(1);

  assert.equal(service.id, 1);
  assert.equal(database.calls.length, 1);
});

test('repository throws when the database has no query method', async function () {
  const repository = createQueueEntryRepository({});

  await assert.rejects(
    repository.findServiceById(1),
    /must export a mysql2 pool or connection/
  );
});



test('findServicesWithQueueLengths returns mapped services', async function () {
  const database = createExecuteDatabase([
    [
      {
        ...serviceRow,
        queueLength: '4'
      }
    ]
  ]);

  const repository = createQueueEntryRepository(database);
  const services = await repository.findServicesWithQueueLengths();

  assert.equal(services.length, 1);
  assert.equal(services[0].id, 1);
  assert.equal(services[0].queueLength, 4);
});

test('findOpenQueueByServiceId returns the open queue', async function () {
  const database = createExecuteDatabase([[queueRow]]);
  const repository = createQueueEntryRepository(database);

  const queue = await repository.findOpenQueueByServiceId(1);

  assert.deepEqual(queue, {
    queueId: 7,
    serviceId: 1,
    status: 'open'
  });

  assert.deepEqual(database.calls[0].parameters, [1]);
});

test('createOpenQueue inserts and returns the new queue', async function () {
  const database = createExecuteDatabase(
    [{ insertId: 7 }],
    [[queueRow]]
  );

  const repository = createQueueEntryRepository(database);
  const queue = await repository.createOpenQueue(1);

  assert.equal(queue.queueId, 7);
  assert.equal(queue.serviceId, 1);
  assert.equal(database.calls.length, 2);

  assert.deepEqual(database.calls[0].parameters, [1]);
  assert.deepEqual(database.calls[1].parameters, [7]);
});


test('userExists returns true and false correctly', async function () {
  const database = createExecuteDatabase(
    [[{ User_ID: 4 }]],
    [[]]
  );

  const repository = createQueueEntryRepository(database);

  assert.equal(await repository.userExists(4), true);
  assert.equal(await repository.userExists(999), false);
});

test('findWaitingEntryForUser returns the waiting entry', async function () {
  const database = createExecuteDatabase([[entryRow]]);
  const repository = createQueueEntryRepository(database);

  const entry = await repository.findWaitingEntryForUser(4);

  assert.equal(entry.queueEntryId, 10);
  assert.equal(entry.userId, 4);
  assert.deepEqual(database.calls[0].parameters, [4]);
});

test('findWaitingEntryForUserAndService returns the matching entry', async function () {
  const database = createExecuteDatabase([[entryRow]]);
  const repository = createQueueEntryRepository(database);

  const entry =
    await repository.findWaitingEntryForUserAndService(4, 1);

  assert.equal(entry.queueEntryId, 10);
  assert.deepEqual(database.calls[0].parameters, [4, 1]);
});

test('findWaitingEntriesByServiceId returns mapped entries', async function () {
  const database = createExecuteDatabase([
    [
      entryRow,
      {
        ...entryRow,
        id: '11',
        queueEntryId: '11',
        userId: '5',
        userName: 'Second User',
        position: '2'
      }
    ]
  ]);

  const repository = createQueueEntryRepository(database);
  const entries = await repository.findWaitingEntriesByServiceId(1);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].queueEntryId, 10);
  assert.equal(entries[1].queueEntryId, 11);

  assert.match(
    database.calls[0].sql,
    /FIELD\(qe\.Priority, 'high', 'normal', 'low'\)/
  );
});

test('countWaitingEntries returns a numeric total', async function () {
  const database = createExecuteDatabase([
    [{ total: '3' }]
  ]);

  const repository = createQueueEntryRepository(database);
  const total = await repository.countWaitingEntries(7);

  assert.equal(total, 3);
  assert.deepEqual(database.calls[0].parameters, [7]);
});



test('createEntry inserts and returns the created entry', async function () {
  const database = createExecuteDatabase(
    [{ insertId: 10 }],
    [[entryRow]]
  );

  const repository = createQueueEntryRepository(database);

  const createdEntry = await repository.createEntry({
    queueId: 7,
    userId: 4,
    userName: 'Test User',
    priority: 'normal',
    position: 1
  });

  assert.equal(createdEntry.queueEntryId, 10);
  assert.equal(database.calls.length, 2);

  assert.deepEqual(database.calls[0].parameters, [
    7,
    4,
    'Test User',
    'normal',
    1
  ]);

  assert.deepEqual(database.calls[1].parameters, [10]);
});

test('findEntryById returns the requested entry', async function () {
  const database = createExecuteDatabase([[entryRow]]);
  const repository = createQueueEntryRepository(database);

  const entry = await repository.findEntryById(10);

  assert.equal(entry.queueEntryId, 10);
  assert.deepEqual(database.calls[0].parameters, [10]);
});


test('updateEntryStatus sets Served_At for a served entry', async function () {
  const database = createExecuteDatabase(
    [{ affectedRows: 1 }],
    [
      [
        {
          ...entryRow,
          status: 'served',
          servedAt: '2026-08-06 12:30:00'
        }
      ]
    ]
  );

  const repository = createQueueEntryRepository(database);
  const entry = await repository.updateEntryStatus(10, 'served');

  assert.equal(entry.status, 'served');
  assert.match(database.calls[0].sql, /Served_At/);
  assert.match(database.calls[0].sql, /CURRENT_TIMESTAMP/);
  assert.deepEqual(database.calls[0].parameters, ['served', 10]);
});

test('updateEntryStatus sets Left_At for a canceled entry', async function () {
  const database = createExecuteDatabase(
    [{ affectedRows: 1 }],
    [
      [
        {
          ...entryRow,
          status: 'canceled',
          leftAt: '2026-08-06 12:20:00'
        }
      ]
    ]
  );

  const repository = createQueueEntryRepository(database);
  const entry = await repository.updateEntryStatus(10, 'canceled');

  assert.equal(entry.status, 'canceled');
  assert.match(database.calls[0].sql, /Left_At/);
  assert.match(database.calls[0].sql, /CURRENT_TIMESTAMP/);
});

test('updateEntryStatus handles statuses without a timestamp column', async function () {
  const database = createExecuteDatabase(
    [{ affectedRows: 1 }],
    [[entryRow]]
  );

  const repository = createQueueEntryRepository(database);
  const entry = await repository.updateEntryStatus(10, 'waiting');

  assert.equal(entry.status, 'waiting');
  assert.doesNotMatch(database.calls[0].sql, /CURRENT_TIMESTAMP/);
  assert.deepEqual(database.calls[0].parameters, ['waiting', 10]);
});

test('updateEntryStatus returns null when no entry was updated', async function () {
  const database = createExecuteDatabase([
    { affectedRows: 0 }
  ]);

  const repository = createQueueEntryRepository(database);
  const result = await repository.updateEntryStatus(999, 'served');

  assert.equal(result, null);
  assert.equal(database.calls.length, 1);
});



test('resequenceQueue assigns positions in priority order', async function () {
  const database = createExecuteDatabase(
    [
      [
        { queueEntryId: 10 },
        { queueEntryId: 11 }
      ]
    ],
    [{ affectedRows: 1 }],
    [{ affectedRows: 1 }]
  );

  const repository = createQueueEntryRepository(database);

  await repository.resequenceQueue(7);

  assert.equal(database.calls.length, 3);

  assert.deepEqual(database.calls[0].parameters, [7]);
  assert.deepEqual(database.calls[1].parameters, [1, 10]);
  assert.deepEqual(database.calls[2].parameters, [2, 11]);
});

test('resequenceQueue handles an empty queue', async function () {
  const database = createExecuteDatabase([[]]);
  const repository = createQueueEntryRepository(database);

  await repository.resequenceQueue(7);

  assert.equal(database.calls.length, 1);
});