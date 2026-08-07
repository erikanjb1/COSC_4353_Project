'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createActivityRepository,
  mapNotification,
  mapHistory
} = require('../src/data/activityRepository');

const notificationRow = {
  id: '12',
  userId: '4',
  message: 'You are next in line.',
  timestamp: '2026-08-06 12:00:00',
  status: 'unread'
};

const historyRow = {
  id: '9',
  queueEntryId: '20',
  userId: '4',
  serviceId: '2',
  serviceName: 'Academic Advising',
  joinedAt: '2026-08-06 11:00:00',
  completedAt: '2026-08-06 11:20:00',
  outcome: 'Served'
};

function createFakeDatabase(method, responses) {
  const calls = [];

  return {
    calls,

    [method]: async function (sql, parameters = []) {
      calls.push({
        sql,
        parameters
      });

      if (responses.length === 0) {
        throw new Error(
          'No fake database response was configured for this call.'
        );
      }

      return responses.shift();
    }
  };
}

function createExecuteDatabase(responses) {
  return createFakeDatabase('execute', responses);
}

/*
 * Mapper tests
 */

test('mapNotification handles a missing row', function () {
  assert.equal(mapNotification(null), null);
});

test('mapNotification maps and converts notification values', function () {
  assert.deepEqual(mapNotification(notificationRow), {
    id: 12,
    userId: 4,
    message: 'You are next in line.',
    timestamp: '2026-08-06 12:00:00',
    status: 'unread'
  });
});

test('mapHistory handles a missing row', function () {
  assert.equal(mapHistory(null), null);
});

test('mapHistory maps history and converts numeric values', function () {
  assert.deepEqual(mapHistory(historyRow), {
    id: 9,
    queueEntryId: 20,
    userId: 4,
    serviceId: 2,
    serviceName: 'Academic Advising',
    joinedAt: '2026-08-06 11:00:00',
    completedAt: '2026-08-06 11:20:00',
    outcome: 'Served'
  });
});

test('mapHistory keeps a null service ID', function () {
  const row = {
    ...historyRow,
    serviceId: null
  };

  assert.deepEqual(mapHistory(row), {
    id: 9,
    queueEntryId: 20,
    userId: 4,
    serviceId: null,
    serviceName: 'Academic Advising',
    joinedAt: '2026-08-06 11:00:00',
    completedAt: '2026-08-06 11:20:00',
    outcome: 'Served'
  });
});

/*
 * Database connection tests
 */

test('repository supports a database with execute()', async function () {
  const database = createExecuteDatabase([
    [[{ User_ID: 4 }]]
  ]);

  const repository = createActivityRepository(database);

  const exists = await repository.userExists(4);

  assert.equal(exists, true);
  assert.equal(database.calls.length, 1);
  assert.deepEqual(database.calls[0].parameters, [4]);
  assert.match(
    database.calls[0].sql,
    /FROM UserCredentials/
  );
});

test('userExists returns false when the user is not found', async function () {
  const database = createExecuteDatabase([
    [[]]
  ]);

  const repository = createActivityRepository(database);

  const exists = await repository.userExists(999);

  assert.equal(exists, false);
});

test('repository supports a database pool', async function () {
  const pool = createExecuteDatabase([
    [[{ User_ID: 5 }]]
  ]);

  const repository = createActivityRepository({
    pool
  });

  const exists = await repository.userExists(5);

  assert.equal(exists, true);
  assert.equal(pool.calls.length, 1);
});

test('repository supports a promise database', async function () {
  const promisedDatabase = createExecuteDatabase([
    [[{ User_ID: 6 }]]
  ]);

  let promiseCalls = 0;

  const database = {
    promise() {
      promiseCalls += 1;
      return promisedDatabase;
    }
  };

  const repository = createActivityRepository(database);

  const exists = await repository.userExists(6);

  assert.equal(exists, true);
  assert.equal(promiseCalls, 1);
  assert.equal(promisedDatabase.calls.length, 1);
});

test('repository uses query() when execute() is unavailable', async function () {
  const database = createFakeDatabase('query', [
    [[{ User_ID: 7 }]]
  ]);

  const repository = createActivityRepository(database);

  const exists = await repository.userExists(7);

  assert.equal(exists, true);
  assert.equal(database.calls.length, 1);
  assert.deepEqual(database.calls[0].parameters, [7]);
});

test('repository throws when database methods are unavailable', async function () {
  const repository = createActivityRepository({});

  await assert.rejects(
    repository.userExists(1),
    /must export a mysql2 pool or connection/
  );
});

/*
 * Notification tests
 */

test('createNotification inserts and returns the created notification', async function () {
  const database = createExecuteDatabase([
    [{ insertId: 12 }],
    [[notificationRow]]
  ]);

  const repository = createActivityRepository(database);

  const notification =
    await repository.createNotification({
      userId: 4,
      message: 'You are next in line.',
      status: 'unread'
    });

  assert.deepEqual(notification, {
    id: 12,
    userId: 4,
    message: 'You are next in line.',
    timestamp: '2026-08-06 12:00:00',
    status: 'unread'
  });

  assert.equal(database.calls.length, 2);

  assert.match(
    database.calls[0].sql,
    /INSERT INTO Notification/
  );

  assert.deepEqual(
    database.calls[0].parameters,
    [
      4,
      'You are next in line.',
      'unread'
    ]
  );

  assert.deepEqual(
    database.calls[1].parameters,
    [12]
  );
});

test('findNotificationById returns a mapped notification', async function () {
  const database = createExecuteDatabase([
    [[notificationRow]]
  ]);

  const repository = createActivityRepository(database);

  const notification =
    await repository.findNotificationById(12);

  assert.equal(notification.id, 12);
  assert.equal(notification.userId, 4);
  assert.equal(notification.status, 'unread');

  assert.deepEqual(
    database.calls[0].parameters,
    [12]
  );
});

test('findNotificationById returns null when not found', async function () {
  const database = createExecuteDatabase([
    [[]]
  ]);

  const repository = createActivityRepository(database);

  const notification =
    await repository.findNotificationById(999);

  assert.equal(notification, null);
});

test('findNotificationsByUserId returns mapped notifications', async function () {
  const secondNotification = {
    id: '13',
    userId: '4',
    message: 'You joined the queue.',
    timestamp: '2026-08-06 11:00:00',
    status: 'read'
  };

  const database = createExecuteDatabase([
    [[notificationRow, secondNotification]]
  ]);

  const repository = createActivityRepository(database);

  const notifications =
    await repository.findNotificationsByUserId(4);

  assert.equal(notifications.length, 2);

  assert.deepEqual(notifications[0], {
    id: 12,
    userId: 4,
    message: 'You are next in line.',
    timestamp: '2026-08-06 12:00:00',
    status: 'unread'
  });

  assert.deepEqual(notifications[1], {
    id: 13,
    userId: 4,
    message: 'You joined the queue.',
    timestamp: '2026-08-06 11:00:00',
    status: 'read'
  });

  assert.deepEqual(
    database.calls[0].parameters,
    [4]
  );
});

test('updateNotificationStatus returns null when nothing was updated', async function () {
  const database = createExecuteDatabase([
    [{ affectedRows: 0 }]
  ]);

  const repository = createActivityRepository(database);

  const notification =
    await repository.updateNotificationStatus(
      999,
      'read'
    );

  assert.equal(notification, null);
  assert.equal(database.calls.length, 1);

  assert.deepEqual(
    database.calls[0].parameters,
    ['read', 999]
  );
});

test('updateNotificationStatus returns the updated notification', async function () {
  const updatedRow = {
    ...notificationRow,
    status: 'read'
  };

  const database = createExecuteDatabase([
    [{ affectedRows: 1 }],
    [[updatedRow]]
  ]);

  const repository = createActivityRepository(database);

  const notification =
    await repository.updateNotificationStatus(
      12,
      'read'
    );

  assert.deepEqual(notification, {
    id: 12,
    userId: 4,
    message: 'You are next in line.',
    timestamp: '2026-08-06 12:00:00',
    status: 'read'
  });

  assert.equal(database.calls.length, 2);

  assert.deepEqual(
    database.calls[0].parameters,
    ['read', 12]
  );

  assert.deepEqual(
    database.calls[1].parameters,
    [12]
  );
});

/*
 * History tests
 */

test('createHistory inserts and returns the created history record', async function () {
  const database = createExecuteDatabase([
    [{ insertId: 9 }],
    [[historyRow]]
  ]);

  const repository = createActivityRepository(database);

  const history = await repository.createHistory({
    queueEntryId: 20,
    userId: 4,
    serviceId: 2,
    serviceName: 'Academic Advising',
    joinedAt: '2026-08-06 11:00:00',
    completedAt: '2026-08-06 11:20:00',
    outcome: 'Served'
  });

  assert.deepEqual(history, {
    id: 9,
    queueEntryId: 20,
    userId: 4,
    serviceId: 2,
    serviceName: 'Academic Advising',
    joinedAt: '2026-08-06 11:00:00',
    completedAt: '2026-08-06 11:20:00',
    outcome: 'Served'
  });

  assert.equal(database.calls.length, 2);

  assert.match(
    database.calls[0].sql,
    /INSERT INTO History/
  );

  assert.deepEqual(
    database.calls[0].parameters,
    [
      20,
      4,
      2,
      'Academic Advising',
      '2026-08-06 11:00:00',
      '2026-08-06 11:20:00',
      'Served'
    ]
  );

  assert.deepEqual(
    database.calls[1].parameters,
    [9]
  );
});

test('findHistoryById returns a mapped history record', async function () {
  const database = createExecuteDatabase([
    [[historyRow]]
  ]);

  const repository = createActivityRepository(database);

  const history =
    await repository.findHistoryById(9);

  assert.equal(history.id, 9);
  assert.equal(history.queueEntryId, 20);
  assert.equal(history.serviceId, 2);
  assert.equal(history.outcome, 'Served');

  assert.deepEqual(
    database.calls[0].parameters,
    [9]
  );
});

test('findHistoryById returns null when not found', async function () {
  const database = createExecuteDatabase([
    [[]]
  ]);

  const repository = createActivityRepository(database);

  const history =
    await repository.findHistoryById(999);

  assert.equal(history, null);
});

test('findHistoryByUserId returns mapped history records', async function () {
  const historyWithoutService = {
    ...historyRow,
    id: '10',
    serviceId: null,
    serviceName: 'Deleted Service',
    outcome: 'Left Queue'
  };

  const database = createExecuteDatabase([
    [[historyRow, historyWithoutService]]
  ]);

  const repository = createActivityRepository(database);

  const history =
    await repository.findHistoryByUserId(4);

  assert.equal(history.length, 2);

  assert.deepEqual(history[0], {
    id: 9,
    queueEntryId: 20,
    userId: 4,
    serviceId: 2,
    serviceName: 'Academic Advising',
    joinedAt: '2026-08-06 11:00:00',
    completedAt: '2026-08-06 11:20:00',
    outcome: 'Served'
  });

  assert.deepEqual(history[1], {
    id: 10,
    queueEntryId: 20,
    userId: 4,
    serviceId: null,
    serviceName: 'Deleted Service',
    joinedAt: '2026-08-06 11:00:00',
    completedAt: '2026-08-06 11:20:00',
    outcome: 'Left Queue'
  });

  assert.deepEqual(
    database.calls[0].parameters,
    [4]
  );
});