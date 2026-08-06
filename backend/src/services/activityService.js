'use strict';

const activityRepository = require('../data/activityRepository');
const HttpError = require('../utils/httpError');

const ACTIVITY_STATUSES = Object.freeze([
  'sent',
  'viewed'
]);

const HISTORY_OUTCOMES = Object.freeze([
  'joined',
  'served',
  'left'
]);

function validatePositiveInteger(value, fieldName) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new HttpError(
      400,
      `${fieldName} must be a positive integer.`
    );
  }

  return parsedValue;
}

function validateStatus(status, defaultStatus = 'sent') {
  const selectedStatus =
    typeof status === 'string'
      ? status.toLowerCase()
      : status ?? defaultStatus;

  if (!ACTIVITY_STATUSES.includes(selectedStatus)) {
    throw new HttpError(
      400,
      'Status must be sent or viewed.'
    );
  }

  return selectedStatus;
}

function validateMessage(message) {
  if (
    typeof message !== 'string' ||
    message.trim() === ''
  ) {
    throw new HttpError(
      400,
      'Message is required and must be a non-empty string.'
    );
  }

  if (message.trim().length > 255) {
    throw new HttpError(
      400,
      'Message must be 255 characters or fewer.'
    );
  }

  return message.trim();
}

function validateOptionalPositiveInteger(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return validatePositiveInteger(value, fieldName);
}

function validateText(value, fieldName, maxLength) {
  if (
    typeof value !== 'string' ||
    value.trim() === ''
  ) {
    throw new HttpError(
      400,
      `${fieldName} is required and must be a non-empty string.`
    );
  }

  if (value.trim().length > maxLength) {
    throw new HttpError(
      400,
      `${fieldName} must be ${maxLength} characters or fewer.`
    );
  }

  return value.trim();
}

function validateDate(value, fieldName) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    throw new HttpError(
      400,
      `${fieldName} must be a valid date.`
    );
  }

  return date;
}

function validateOutcome(outcome) {
  const selectedOutcome =
    typeof outcome === 'string'
      ? outcome.toLowerCase()
      : outcome;

  if (!HISTORY_OUTCOMES.includes(selectedOutcome)) {
    throw new HttpError(
      400,
      'Outcome must be joined, served, or left.'
    );
  }

  return selectedOutcome;
}

async function assertUserExists(userId, repository) {
  const exists = await repository.userExists(userId);

  if (!exists) {
    throw new HttpError(404, 'User was not found.');
  }
}

async function createNotification(input, repository = activityRepository) {
  const body =
    input && typeof input === 'object'
      ? input
      : {};

  const userId = validatePositiveInteger(
    body.userId,
    'User ID'
  );

  await assertUserExists(userId, repository);

  return repository.createNotification({
    userId,
    message: validateMessage(body.message),
    status: validateStatus(body.status)
  });
}

async function listNotificationsForUser(
  userId,
  repository = activityRepository
) {
  const selectedUserId = validatePositiveInteger(
    userId,
    'User ID'
  );

  return repository.findNotificationsByUserId(selectedUserId);
}

async function markNotificationViewed(
  notificationId,
  repository = activityRepository
) {
  const selectedNotificationId =
    validatePositiveInteger(
      notificationId,
      'Notification ID'
    );

  const notification =
    await repository.updateNotificationStatus(
      selectedNotificationId,
      'viewed'
    );

  if (!notification) {
    throw new HttpError(
      404,
      'Notification was not found.'
    );
  }

  return notification;
}

async function createHistory(input, repository = activityRepository) {
  const body =
    input && typeof input === 'object'
      ? input
      : {};

  const userId = validatePositiveInteger(
    body.userId,
    'User ID'
  );

  await assertUserExists(userId, repository);

  return repository.createHistory({
    queueEntryId: validatePositiveInteger(
      body.queueEntryId,
      'Queue Entry ID'
    ),
    userId,
    serviceId: validateOptionalPositiveInteger(
      body.serviceId,
      'Service ID'
    ),
    serviceName: validateText(
      body.serviceName,
      'Service name',
      100
    ),
    joinedAt: validateDate(
      body.joinedAt,
      'Joined at'
    ),
    completedAt: validateDate(
      body.completedAt,
      'Completed at'
    ),
    outcome: validateOutcome(body.outcome)
  });
}

async function listHistoryForUser(
  userId,
  repository = activityRepository
) {
  const selectedUserId = validatePositiveInteger(
    userId,
    'User ID'
  );

  return repository.findHistoryByUserId(selectedUserId);
}

module.exports = {
  ACTIVITY_STATUSES,
  HISTORY_OUTCOMES,
  validatePositiveInteger,
  validateStatus,
  validateMessage,
  validateOutcome,
  createNotification,
  listNotificationsForUser,
  markNotificationViewed,
  createHistory,
  listHistoryForUser
};
