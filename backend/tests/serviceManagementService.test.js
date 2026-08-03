'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/serviceManagementService');

function sampleService(overrides = {}) {
  return {
    id: 1,
    name: 'Academic Advising',
    description: 'Plan classes and discuss degree requirements.',
    expectedDuration: 20,
    priorityLevel: 'normal',
    isOpen: true,
    ...overrides
  };
}

function validPayload(overrides = {}) {
  return {
    name: 'Academic Advising',
    description: 'Plan classes and discuss degree requirements.',
    expectedDuration: 20,
    priorityLevel: 'normal',
    isOpen: true,
    ...overrides
  };
}

test('validateServiceInput collects every field error at once', () => {
  assert.throws(
    () => {
      service.validateServiceInput({
        name: '',
        description: 'hi',
        expectedDuration: 0,
        priorityLevel: 'urgent',
        isOpen: 'yes'
      });
    },
    (error) => error.status === 400 && error.details.length === 5
  );
});

test('validateServiceId rejects non-positive-integer IDs', () => {
  assert.throws(
    () => service.validateServiceId('not-a-number'),
    (error) => error.status === 400
  );

  assert.throws(
    () => service.validateServiceId(-1),
    (error) => error.status === 400
  );
});

test('getService returns the mapped service for a valid ID', async () => {
  const expected = sampleService();
  const repository = {
    findById: async (id) => {
      assert.equal(id, 1);
      return expected;
    }
  };

  const result = await service.getService(1, repository);
  assert.deepEqual(result, expected);
});

test('getService 404s when the repository finds nothing', async () => {
  const repository = { findById: async () => null };

  await assert.rejects(
    () => service.getService(99, repository),
    (error) => error.status === 404
  );
});

test('createService rejects invalid input before touching the repository', async () => {
  const repository = {
    findByName: async () => {
      throw new Error('should not be called');
    },
    create: async () => {
      throw new Error('should not be called');
    }
  };

  await assert.rejects(
    () =>
      service.createService(
        validPayload({ name: '' }),
        repository
      ),
    (error) => error.status === 400
  );
});

test('createService rejects a duplicate name', async () => {
  const repository = {
    findByName: async (name) => {
      assert.equal(name, 'Academic Advising');
      return sampleService();
    }
  };

  await assert.rejects(
    () => service.createService(validPayload(), repository),
    (error) => error.status === 409
  );
});

test('createService trims strings and creates the service', async () => {
  const repository = {
    findByName: async () => null,
    create: async (input) => {
      assert.deepEqual(input, {
        name: 'Academic Advising',
        description: 'Plan classes and discuss degree requirements.',
        expectedDuration: 20,
        priorityLevel: 'normal',
        isOpen: true
      });
      return sampleService();
    }
  };

  const result = await service.createService(
    validPayload({
      name: '  Academic Advising  ',
      description: '  Plan classes and discuss degree requirements.  '
    }),
    repository
  );

  assert.deepEqual(result, sampleService());
});

test('updateService 404s when the service does not exist', async () => {
  const repository = { findById: async () => null };

  await assert.rejects(
    () => service.updateService(1, validPayload(), repository),
    (error) => error.status === 404
  );
});

test('updateService rejects a name already used by a different service', async () => {
  const repository = {
    findById: async () => sampleService(),
    findByName: async (name, excludeId) => {
      assert.equal(excludeId, 1);
      return sampleService({ id: 2 });
    }
  };

  await assert.rejects(
    () => service.updateService(1, validPayload(), repository),
    (error) => error.status === 409
  );
});

test('updateService writes the update and returns the result', async () => {
  const updated = sampleService({ priorityLevel: 'high' });
  const repository = {
    findById: async () => sampleService(),
    findByName: async () => null,
    update: async (id, input) => {
      assert.equal(id, 1);
      assert.equal(input.priorityLevel, 'high');
      return updated;
    }
  };

  const result = await service.updateService(
    1,
    validPayload({ priorityLevel: 'high' }),
    repository
  );

  assert.deepEqual(result, updated);
});

test('deleteService 404s when the service does not exist', async () => {
  const repository = { findById: async () => null };

  await assert.rejects(
    () => service.deleteService(1, repository),
    (error) => error.status === 404
  );
});

test('deleteService removes an existing service and returns it', async () => {
  const existing = sampleService();
  const repository = {
    findById: async () => existing,
    remove: async (id) => {
      assert.equal(id, 1);
      return true;
    }
  };

  const result = await service.deleteService(1, repository);
  assert.deepEqual(result, existing);
});

test('listServices returns whatever the repository provides', async () => {
  const services = [sampleService(), sampleService({ id: 2 })];
  const repository = { findAll: async () => services };

  const result = await service.listServices(repository);
  assert.deepEqual(result, services);
});