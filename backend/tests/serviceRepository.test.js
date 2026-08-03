'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createServiceRepository,
  mapService
} = require('../src/data/serviceRepository');

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

test('mapService converts MySQL aliases to API fields', () => {
  const result = mapService({
    id: '3',
    name: 'IT Help Desk',
    description: 'Help with login, Wi-Fi, and accounts.',
    expectedDuration: '10',
    priorityLevel: 'low',
    isOpen: 1
  });

  assert.deepEqual(result, {
    id: 3,
    name: 'IT Help Desk',
    description: 'Help with login, Wi-Fi, and accounts.',
    expectedDuration: 10,
    priorityLevel: 'low',
    isOpen: true
  });
});

test('mapService returns null for a missing row', () => {
  assert.equal(mapService(undefined), null);
});

test('findAll orders by Service_Name', async () => {
  const database = createFakeDatabase([
    [[{
      id: 1,
      name: 'Academic Advising',
      description: 'Plan classes.',
      expectedDuration: 20,
      priorityLevel: 'normal',
      isOpen: 1
    }], []]
  ]);
  const repository = createServiceRepository(database);

  const result = await repository.findAll();

  assert.equal(result.length, 1);
  assert.match(database.calls[0].sql, /ORDER BY Service_Name ASC/);
});

test('findByName excludes the given service ID when checking for a duplicate', async () => {
  const database = createFakeDatabase([
    [[], []]
  ]);
  const repository = createServiceRepository(database);

  await repository.findByName('Academic Advising', 5);

  assert.match(database.calls[0].sql, /Service_ID <> \?/);
  assert.deepEqual(database.calls[0].parameters, ['Academic Advising', 5]);
});

test('findByName omits the exclusion clause when no ID is given', async () => {
  const database = createFakeDatabase([
    [[], []]
  ]);
  const repository = createServiceRepository(database);

  await repository.findByName('Academic Advising');

  assert.doesNotMatch(database.calls[0].sql, /Service_ID <> \?/);
  assert.deepEqual(database.calls[0].parameters, ['Academic Advising']);
});

test('create inserts a service and then retrieves it', async () => {
  const database = createFakeDatabase([
    [{ insertId: 9, affectedRows: 1 }, []],
    [[{
      id: 9,
      name: 'Career Center',
      description: 'Resume review.',
      expectedDuration: 20,
      priorityLevel: 'normal',
      isOpen: 1
    }], []]
  ]);
  const repository = createServiceRepository(database);

  const result = await repository.create({
    name: 'Career Center',
    description: 'Resume review.',
    expectedDuration: 20,
    priorityLevel: 'normal',
    isOpen: true
  });

  assert.equal(result.id, 9);
  assert.match(database.calls[0].sql, /INSERT INTO Service/);
  assert.deepEqual(database.calls[0].parameters, [
    'Career Center',
    'Resume review.',
    20,
    'normal',
    true
  ]);
});

test('update returns null when no service was affected', async () => {
  const database = createFakeDatabase([
    [{ affectedRows: 0 }, []]
  ]);
  const repository = createServiceRepository(database);

  const result = await repository.update(100, {
    name: 'Ghost Service',
    description: 'Does not exist.',
    expectedDuration: 5,
    priorityLevel: 'low',
    isOpen: true
  });

  assert.equal(result, null);
});

test('update writes every field and then retrieves the row', async () => {
  const database = createFakeDatabase([
    [{ affectedRows: 1 }, []],
    [[{
      id: 4,
      name: 'Updated Name',
      description: 'Updated description.',
      expectedDuration: 15,
      priorityLevel: 'high',
      isOpen: 0
    }], []]
  ]);
  const repository = createServiceRepository(database);

  const result = await repository.update(4, {
    name: 'Updated Name',
    description: 'Updated description.',
    expectedDuration: 15,
    priorityLevel: 'high',
    isOpen: false
  });

  assert.equal(result.name, 'Updated Name');
  assert.equal(result.isOpen, false);
  assert.match(database.calls[0].sql, /UPDATE Service/);
  assert.deepEqual(database.calls[0].parameters, [
    'Updated Name',
    'Updated description.',
    15,
    'high',
    false,
    4
  ]);
});

test('remove returns true when a row was deleted', async () => {
  const database = createFakeDatabase([
    [{ affectedRows: 1 }, []]
  ]);
  const repository = createServiceRepository(database);

  assert.equal(await repository.remove(4), true);
  assert.match(database.calls[0].sql, /DELETE FROM Service/);
});

test('remove returns false when no row matched', async () => {
  const database = createFakeDatabase([
    [{ affectedRows: 0 }, []]
  ]);
  const repository = createServiceRepository(database);

  assert.equal(await repository.remove(999), false);
});
