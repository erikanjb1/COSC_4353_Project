'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateMessage,
  validateStatus,
  validateOutcome,
  createNotification,
  listNotificationsForUser,
  markNotificationViewed,
  createHistory,
  listHistoryForUser
} = require('../src/services/activityService');

function createFakeRepository() {
  const notifications = [];
  const history = [];
  let nextNotificationId = 1;
  let nextHistoryId = 1;

  return {
    async userExists(userId) {
      return Number(userId) === 1;
    },

    async createNotification(activity) {
      const notification = {
        id: nextNotificationId++,
        userId: activity.userId,
        message: activity.message,
        timestamp: '2026-08-05T12:00:00.000Z',
        status: activity.status
      };

      notifications.unshift(notification);
      return notification;
    },

    async findNotificationsByUserId(userId) {
      return notifications.filter(
        function (notification) {
          return notification.userId === Number(userId);
        }
      );
    },

    async updateNotificationStatus(notificationId, status) {
      const notification = notifications.find(
        function (item) {
          return item.id === Number(notificationId);
        }
      );

      if (!notification) {
        return null;
      }

      notification.status = status;
      return notification;
    },

    async createHistory(activity) {
      const record = {
        id: nextHistoryId++,
        queueEntryId: activity.queueEntryId,
        userId: activity.userId,
        serviceId: activity.serviceId,
        serviceName: activity.serviceName,
        joinedAt: activity.joinedAt,
        completedAt: activity.completedAt,
        outcome: activity.outcome
      };

      history.unshift(record);
      return record;
    },

    async findHistoryByUserId(userId) {
      return history.filter(
        function (record) {
          return record.userId === Number(userId);
        }
      );
    }
  };
}

test(
  'validates activity message and status values',
  function () {
    assert.equal(
      validateMessage('  Queue joined.  '),
      'Queue joined.'
    );

    assert.equal(validateStatus('VIEWED'), 'viewed');
    assert.equal(validateOutcome('SERVED'), 'served');

    assert.throws(
      function () {
        validateMessage('');
      },
      function (error) {
        return error.status === 400;
      }
    );

    assert.throws(
      function () {
        validateStatus('queued');
      },
      function (error) {
        return error.status === 400;
      }
    );
  }
);

test(
  'creates and lists notifications for a user',
  async function () {
    const repository = createFakeRepository();

    const notification =
      await createNotification(
        {
          userId: 1,
          message: 'You joined the queue.'
        },
        repository
      );

    assert.equal(notification.status, 'sent');

    const notifications =
      await listNotificationsForUser(1, repository);

    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0].message,
      'You joined the queue.'
    );
  }
);

test(
  'marks a notification as viewed',
  async function () {
    const repository = createFakeRepository();

    const notification =
      await createNotification(
        {
          userId: 1,
          message: 'You are next.'
        },
        repository
      );

    const viewed =
      await markNotificationViewed(
        notification.id,
        repository
      );

    assert.equal(viewed.status, 'viewed');
  }
);

test(
  'creates and lists history records for a user',
  async function () {
    const repository = createFakeRepository();

    const record = await createHistory(
      {
        queueEntryId: 1,
        userId: 1,
        serviceId: 1,
        serviceName: 'Academic Advising',
        joinedAt: '2026-08-05T12:00:00.000Z',
        completedAt: '2026-08-05T12:30:00.000Z',
        outcome: 'served'
      },
      repository
    );

    assert.equal(record.serviceName, 'Academic Advising');
    assert.equal(record.outcome, 'served');

    const history =
      await listHistoryForUser(1, repository);

    assert.deepEqual(history, [record]);
  }
);

test(
  'rejects activity for an unknown user',
  async function () {
    const repository = createFakeRepository();

    await assert.rejects(
      function () {
        return createNotification(
          {
            userId: 99,
            message: 'Nope.'
          },
          repository
        );
      },
      function (error) {
        return error.status === 404;
      }
    );
  }
);
