'use strict';
let defaultDatabase = null;
function getDefaultDatabase() {
  if (!defaultDatabase) {
    defaultDatabase = require('./db');
  }

  return defaultDatabase;
}

function resolveDatabase(database) {
  const rawDatabase =
    database || getDefaultDatabase();

  
  const selectedDatabase =
    rawDatabase.pool || rawDatabase;

  if (
    typeof selectedDatabase.promise === "function"
  ) {
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

const QUEUE_SELECT = `
  SELECT
    q.Queue_ID AS queueId,
    q.Service_ID AS serviceId,
    s.Service_Name AS serviceName,
    q.Status AS status,
    q.Created_Date AS createdDate
  FROM \`Queue\` q
  LEFT JOIN Service s ON s.Service_ID = q.Service_ID
`;

function mapQueue(row) {
  if (!row) {
    return null;
  }

  return {
    queueId: Number(row.queueId),
    serviceId: row.serviceId === null ? null : Number(row.serviceId),
    serviceName: row.serviceName || null,
    status: row.status,
    createdDate: row.createdDate
  };
}

function createQueueRepository(database = null) {
  const repository = {
    async findAll(status = null) {
      const parameters = [];
      let sql = QUEUE_SELECT;

      if (status) {
        sql += ' WHERE q.Status = ?';
        parameters.push(status);
      }

      sql += ' ORDER BY q.Created_Date DESC, q.Queue_ID DESC';

      const [rows] = await execute(database, sql, parameters);
      return rows.map(mapQueue);
    },

    async findById(queueId) {
      const [rows] = await execute(
        database,
        `${QUEUE_SELECT} WHERE q.Queue_ID = ?`,
        [queueId]
      );

      return mapQueue(rows[0]);
    },

    async findOpenByServiceId(serviceId) {
      const [rows] = await execute(
        database,
        `${QUEUE_SELECT}
         WHERE q.Service_ID = ? AND q.Status = 'open'
         ORDER BY q.Created_Date DESC
         LIMIT 1`,
        [serviceId]
      );

      return mapQueue(rows[0]);
    },

    async serviceExists(serviceId) {
      const [rows] = await execute(
        database,
        'SELECT Service_ID FROM Service WHERE Service_ID = ? LIMIT 1',
        [serviceId]
      );

      return rows.length > 0;
    },

    async create(queue) {
      const [result] = await execute(
        database,
        `INSERT INTO \`Queue\` (Service_ID, Status)
         VALUES (?, ?)`,
        [queue.serviceId, queue.status]
      );

      return repository.findById(result.insertId);
    },

    async updateStatus(queueId, status) {
      const [result] = await execute(
        database,
        `UPDATE \`Queue\`
         SET Status = ?
         WHERE Queue_ID = ?`,
        [status, queueId]
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return repository.findById(queueId);
    }
  };

  return repository;
}

const queueRepository = createQueueRepository();

module.exports = {
  ...queueRepository,
  createQueueRepository,
  mapQueue
};