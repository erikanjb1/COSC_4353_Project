'use strict';

const queueRepository = require('../data/queueRepository');

const QUEUE_STATUSES = ['open', 'closed'];

function createHttpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.status = statusCode;
  error.statusCode = statusCode;

  if (details) {
    error.details = details;
  }

  return error;
}

function validatePositiveInteger(value, fieldName) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw createHttpError(400, `${fieldName} must be a positive integer.`);
  }

  return parsedValue;
}

function validateQueueStatus(status, defaultStatus = null) {
  const selectedStatus = status ?? defaultStatus;
  const normalizedStatus =
    typeof selectedStatus === 'string'
      ? selectedStatus.toLowerCase()
      : selectedStatus;

  if (!QUEUE_STATUSES.includes(normalizedStatus)) {
    throw createHttpError(400, 'Queue status must be open or closed.');
  }

  return normalizedStatus;
}

async function listQueues(query = {}, repository = queueRepository) {
  const status = query.status
    ? validateQueueStatus(query.status)
    : null;

  return repository.findAll(status);
}

async function getQueueById(queueId, repository = queueRepository) {
  const id = validatePositiveInteger(queueId, 'Queue ID');
  const queue = await repository.findById(id);

  if (!queue) {
    throw createHttpError(404, 'Queue was not found.');
  }

  return queue;
}

async function getOpenQueueByServiceId(
  serviceId,
  repository = queueRepository
) {
  const id = validatePositiveInteger(serviceId, 'Service ID');
  const queue = await repository.findOpenByServiceId(id);

  if (!queue) {
    throw createHttpError(404, 'No open queue exists for this service.');
  }

  return queue;
}

async function createQueue(input, repository = queueRepository) {
  const body = input && typeof input === 'object' ? input : {};
  const serviceId = validatePositiveInteger(body.serviceId, 'Service ID');
  const status = validateQueueStatus(body.status, 'open');

  const serviceExists = await repository.serviceExists(serviceId);

  if (!serviceExists) {
    throw createHttpError(404, 'The selected service does not exist.');
  }

  if (status === 'open') {
    const existingOpenQueue = await repository.findOpenByServiceId(serviceId);

    if (existingOpenQueue) {
      throw createHttpError(
        409,
        'An open queue already exists for this service.'
      );
    }
  }

  try {
    return await repository.create({ serviceId, status });
  } catch (error) {
    if (error?.code === 'ER_NO_REFERENCED_ROW_2') {
      throw createHttpError(404, 'The selected service does not exist.');
    }

    throw error;
  }
}

async function updateQueueStatus(
  queueId,
  input,
  repository = queueRepository
) {
  const id = validatePositiveInteger(queueId, 'Queue ID');
  const body = input && typeof input === 'object' ? input : {};
  const status = validateQueueStatus(body.status);
  const currentQueue = await repository.findById(id);

  if (!currentQueue) {
    throw createHttpError(404, 'Queue was not found.');
  }

  
  if (status === 'open' && currentQueue.serviceId === null) {
    throw createHttpError(
      409,
      'This queue cannot be opened because its service no longer exists.'
    );
  }

  if (status === 'open' && currentQueue.status !== 'open') {
    const existingOpenQueue = await repository.findOpenByServiceId(
      currentQueue.serviceId
    );

    if (existingOpenQueue && existingOpenQueue.queueId !== id) {
      throw createHttpError(
        409,
        'Another open queue already exists for this service.'
      );
    }
  }

  const updatedQueue = await repository.updateStatus(id, status);

  if (!updatedQueue) {
    throw createHttpError(404, 'Queue was not found.');
  }

  return updatedQueue;
}

module.exports = {
  QUEUE_STATUSES,
  createHttpError,
  validatePositiveInteger,
  validateQueueStatus,
  listQueues,
  getQueueById,
  getOpenQueueByServiceId,
  createQueue,
  updateQueueStatus
};