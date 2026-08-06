'use strict';

let defaultDatabase = null;

function getDefaultDatabase() {
  if (!defaultDatabase) {
    defaultDatabase = require('./db');
  }

  return defaultDatabase;
}

function resolveDatabase(database) {
  const rawDatabase = database || getDefaultDatabase();
  const selectedDatabase = rawDatabase.pool || rawDatabase;

  if (typeof selectedDatabase.promise === 'function') {
    return selectedDatabase.promise();
  }

  return selectedDatabase;
}

async function execute(database, sql, parameters = []) {
  const selectedDatabase = resolveDatabase(database);

  if (typeof selectedDatabase.execute === 'function') {
    return selectedDatabase.execute(sql, parameters);
  }

  if (typeof selectedDatabase.query === 'function') {
    return selectedDatabase.query(sql, parameters);
  }

  throw new Error(
    'src/data/db.js must export a mysql2 pool or connection with execute(), query(), or promise().'
  );
}

function mapNotification(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    userId: Number(row.userId),
    message: row.message,
    timestamp: row.timestamp,
    status: row.status
  };
}

function mapHistory(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    queueEntryId: Number(row.queueEntryId),
    userId: Number(row.userId),
    serviceId: row.serviceId === null ? null : Number(row.serviceId),
    serviceName: row.serviceName,
    joinedAt: row.joinedAt,
    completedAt: row.completedAt,
    outcome: row.outcome
  };
}

function createActivityRepository(database = null) {
  const repository = {
    async userExists(userId) {
      const [rows] = await execute(
        database,
        `
          SELECT User_ID
          FROM UserCredentials
          WHERE User_ID = ?
          LIMIT 1
        `,
        [userId]
      );

      return rows.length > 0;
    },

    async createNotification(activity) {
      const [result] = await execute(
        database,
        `
          INSERT INTO Notification (User_ID, Message, Status)
          VALUES (?, ?, ?)
        `,
        [
          activity.userId,
          activity.message,
          activity.status
        ]
      );

      return repository.findNotificationById(result.insertId);
    },

    async findNotificationById(notificationId) {
      const [rows] = await execute(
        database,
        `
          SELECT
            Notification_ID AS id,
            User_ID AS userId,
            Message AS message,
            \`Timestamp\` AS timestamp,
            Status AS status
          FROM Notification
          WHERE Notification_ID = ?
          LIMIT 1
        `,
        [notificationId]
      );

      return mapNotification(rows[0]);
    },

    async findNotificationsByUserId(userId) {
      const [rows] = await execute(
        database,
        `
          SELECT
            Notification_ID AS id,
            User_ID AS userId,
            Message AS message,
            \`Timestamp\` AS timestamp,
            Status AS status
          FROM Notification
          WHERE User_ID = ?
          ORDER BY \`Timestamp\` DESC, Notification_ID DESC
        `,
        [userId]
      );

      return rows.map(mapNotification);
    },

    async updateNotificationStatus(notificationId, status) {
      const [result] = await execute(
        database,
        `
          UPDATE Notification
          SET Status = ?
          WHERE Notification_ID = ?
        `,
        [status, notificationId]
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return repository.findNotificationById(notificationId);
    },

    async createHistory(activity) {
      const [result] = await execute(
        database,
        `
          INSERT INTO History
            (QueueEntry_ID, User_ID, Service_ID, Service_Name, Joined_At, Completed_At, Outcome)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          activity.queueEntryId,
          activity.userId,
          activity.serviceId,
          activity.serviceName,
          activity.joinedAt,
          activity.completedAt,
          activity.outcome
        ]
      );

      return repository.findHistoryById(result.insertId);
    },

    async findHistoryById(historyId) {
      const [rows] = await execute(
        database,
        `
          SELECT
            History_ID AS id,
            QueueEntry_ID AS queueEntryId,
            User_ID AS userId,
            Service_ID AS serviceId,
            Service_Name AS serviceName,
            Joined_At AS joinedAt,
            Completed_At AS completedAt,
            Outcome AS outcome
          FROM History
          WHERE History_ID = ?
          LIMIT 1
        `,
        [historyId]
      );

      return mapHistory(rows[0]);
    },

    async findHistoryByUserId(userId) {
      const [rows] = await execute(
        database,
        `
          SELECT
            History_ID AS id,
            QueueEntry_ID AS queueEntryId,
            User_ID AS userId,
            Service_ID AS serviceId,
            Service_Name AS serviceName,
            Joined_At AS joinedAt,
            Completed_At AS completedAt,
            Outcome AS outcome
          FROM History
          WHERE User_ID = ?
          ORDER BY Completed_At DESC, History_ID DESC
        `,
        [userId]
      );

      return rows.map(mapHistory);
    }
  };

  return repository;
}

const activityRepository = createActivityRepository();

module.exports = {
  ...activityRepository,
  createActivityRepository,
  mapNotification,
  mapHistory
};
