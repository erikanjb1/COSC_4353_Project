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

const SERVICE_SELECT = `
  SELECT
    Service_ID AS id,
    Service_Name AS name,
    Description AS description,
    Expected_Duration AS expectedDuration,
    Priority_Level AS priorityLevel,
    Is_Open AS isOpen
  FROM Service
`;

const ENTRY_SELECT = `
  SELECT
    qe.QueueEntry_ID AS queueEntryId,
    qe.QueueEntry_ID AS id,
    qe.Queue_ID AS queueId,
    q.Service_ID AS serviceId,
    s.Service_Name AS serviceName,
    qe.User_ID AS userId,
    qe.User_Name AS userName,
    qe.Priority AS priority,
    qe.Position AS position,
    qe.Join_Time AS joinedAt,
    qe.Served_At AS servedAt,
    qe.Left_At AS leftAt,
    qe.Status AS status
  FROM QueueEntry qe
  INNER JOIN \`Queue\` q ON q.Queue_ID = qe.Queue_ID
  LEFT JOIN Service s ON s.Service_ID = q.Service_ID
`;

function mapService(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    expectedDuration: Number(row.expectedDuration),
    priorityLevel: row.priorityLevel,
    isOpen: Boolean(row.isOpen)
  };
}

function mapQueue(row) {
  if (!row) {
    return null;
  }

  return {
    queueId: Number(row.queueId),
    serviceId: Number(row.serviceId),
    status: row.status
  };
}

function mapEntry(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    queueEntryId: Number(row.queueEntryId),
    queueId: Number(row.queueId),
    serviceId: row.serviceId === null ? null : Number(row.serviceId),
    serviceName: row.serviceName,
    userId: Number(row.userId),
    userName: row.userName,
    priority: row.priority,
    position: Number(row.position),
    joinedAt: row.joinedAt,
    servedAt: row.servedAt,
    leftAt: row.leftAt,
    status: row.status
  };
}

function createQueueEntryRepository(database = null) {
  const repository = {
    async findServiceById(serviceId) {
      const [rows] = await execute(
        database,
        `${SERVICE_SELECT} WHERE Service_ID = ?`,
        [serviceId]
      );

      return mapService(rows[0]);
    },

    async findServicesWithQueueLengths() {
      const [rows] = await execute(
        database,
        `
          SELECT
            s.Service_ID AS id,
            s.Service_Name AS name,
            s.Description AS description,
            s.Expected_Duration AS expectedDuration,
            s.Priority_Level AS priorityLevel,
            s.Is_Open AS isOpen,
            COUNT(qe.QueueEntry_ID) AS queueLength
          FROM Service s
          LEFT JOIN \`Queue\` q
            ON q.Service_ID = s.Service_ID
            AND q.Status = 'open'
          LEFT JOIN QueueEntry qe
            ON qe.Queue_ID = q.Queue_ID
            AND qe.Status = 'waiting'
          GROUP BY
            s.Service_ID,
            s.Service_Name,
            s.Description,
            s.Expected_Duration,
            s.Priority_Level,
            s.Is_Open
          ORDER BY s.Service_Name ASC
        `
      );

      return rows.map(function (row) {
        return {
          ...mapService(row),
          queueLength: Number(row.queueLength)
        };
      });
    },

    async findOpenQueueByServiceId(serviceId) {
      const [rows] = await execute(
        database,
        `
          SELECT
            Queue_ID AS queueId,
            Service_ID AS serviceId,
            Status AS status
          FROM \`Queue\`
          WHERE Service_ID = ? AND Status = 'open'
          ORDER BY Created_Date DESC, Queue_ID DESC
          LIMIT 1
        `,
        [serviceId]
      );

      return mapQueue(rows[0]);
    },

    async createOpenQueue(serviceId) {
      const [result] = await execute(
        database,
        `
          INSERT INTO \`Queue\` (Service_ID, Status)
          VALUES (?, 'open')
        `,
        [serviceId]
      );

      const [rows] = await execute(
        database,
        `
          SELECT
            Queue_ID AS queueId,
            Service_ID AS serviceId,
            Status AS status
          FROM \`Queue\`
          WHERE Queue_ID = ?
        `,
        [result.insertId]
      );

      return mapQueue(rows[0]);
    },

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

    async findWaitingEntryForUser(userId) {
      const [rows] = await execute(
        database,
        `${ENTRY_SELECT}
         WHERE qe.User_ID = ? AND qe.Status = 'waiting'
         LIMIT 1`,
        [userId]
      );

      return mapEntry(rows[0]);
    },

    async findWaitingEntryForUserAndService(userId, serviceId) {
      const [rows] = await execute(
        database,
        `${ENTRY_SELECT}
         WHERE
           qe.User_ID = ?
           AND q.Service_ID = ?
           AND qe.Status = 'waiting'
         LIMIT 1`,
        [userId, serviceId]
      );

      return mapEntry(rows[0]);
    },

    async findWaitingEntriesByServiceId(serviceId) {
      const [rows] = await execute(
        database,
        `${ENTRY_SELECT}
         WHERE q.Service_ID = ? AND qe.Status = 'waiting'
         ORDER BY
           FIELD(qe.Priority, 'high', 'normal', 'low'),
           qe.Join_Time ASC,
           qe.QueueEntry_ID ASC`,
        [serviceId]
      );

      return rows.map(mapEntry);
    },

    async countWaitingEntries(queueId) {
      const [rows] = await execute(
        database,
        `
          SELECT COUNT(*) AS total
          FROM QueueEntry
          WHERE Queue_ID = ? AND Status = 'waiting'
        `,
        [queueId]
      );

      return Number(rows[0].total);
    },

    async createEntry(entry) {
      const [result] = await execute(
        database,
        `
          INSERT INTO QueueEntry
            (Queue_ID, User_ID, User_Name, Priority, Position, Status)
          VALUES (?, ?, ?, ?, ?, 'waiting')
        `,
        [
          entry.queueId,
          entry.userId,
          entry.userName,
          entry.priority,
          entry.position
        ]
      );

      return repository.findEntryById(result.insertId);
    },

    async findEntryById(entryId) {
      const [rows] = await execute(
        database,
        `${ENTRY_SELECT}
         WHERE qe.QueueEntry_ID = ?
         LIMIT 1`,
        [entryId]
      );

      return mapEntry(rows[0]);
    },

    async updateEntryStatus(entryId, status) {
      const timestampColumn =
        status === 'served'
          ? 'Served_At'
          : status === 'canceled'
            ? 'Left_At'
            : null;

      const sql = timestampColumn
        ? `
            UPDATE QueueEntry
            SET Status = ?, ${timestampColumn} = CURRENT_TIMESTAMP
            WHERE QueueEntry_ID = ?
          `
        : `
            UPDATE QueueEntry
            SET Status = ?
            WHERE QueueEntry_ID = ?
          `;

      const [result] = await execute(database, sql, [status, entryId]);

      if (result.affectedRows === 0) {
        return null;
      }

      return repository.findEntryById(entryId);
    },

    async resequenceQueue(queueId) {
      const [rows] = await execute(
        database,
        `
          SELECT QueueEntry_ID AS queueEntryId
          FROM QueueEntry
          WHERE Queue_ID = ? AND Status = 'waiting'
          ORDER BY
            FIELD(Priority, 'high', 'normal', 'low'),
            Join_Time ASC,
            QueueEntry_ID ASC
        `,
        [queueId]
      );

      for (const [index, row] of rows.entries()) {
        await execute(
          database,
          `
            UPDATE QueueEntry
            SET Position = ?
            WHERE QueueEntry_ID = ?
          `,
          [index + 1, row.queueEntryId]
        );
      }
    }
  };

  return repository;
}

const queueEntryRepository = createQueueEntryRepository();

module.exports = {
  ...queueEntryRepository,
  createQueueEntryRepository,
  mapEntry,
  mapQueue,
  mapService
};
