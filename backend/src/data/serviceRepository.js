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

function createServiceRepository(database = null) {
  const repository = {
    async findAll() {
      const [rows] = await execute(
        database,
        `${SERVICE_SELECT} ORDER BY Service_Name ASC`
      );

      return rows.map(mapService);
    },

    async findById(serviceId) {
      const [rows] = await execute(
        database,
        `${SERVICE_SELECT} WHERE Service_ID = ?`,
        [serviceId]
      );

      return mapService(rows[0]);
    },

    async findByName(name, excludeServiceId = null) {
      let sql = `${SERVICE_SELECT} WHERE Service_Name = ?`;
      const parameters = [name];

      if (excludeServiceId !== null) {
        sql += ' AND Service_ID <> ?';
        parameters.push(excludeServiceId);
      }

      sql += ' LIMIT 1';

      const [rows] = await execute(database, sql, parameters);
      return mapService(rows[0]);
    },

    async create(service) {
      const [result] = await execute(
        database,
        `INSERT INTO Service
           (Service_Name, Description, Expected_Duration, Priority_Level, Is_Open)
         VALUES (?, ?, ?, ?, ?)`,
        [
          service.name,
          service.description,
          service.expectedDuration,
          service.priorityLevel,
          service.isOpen
        ]
      );

      return repository.findById(result.insertId);
    },

    async update(serviceId, service) {
      const [result] = await execute(
        database,
        `UPDATE Service
         SET Service_Name = ?, Description = ?, Expected_Duration = ?, Priority_Level = ?, Is_Open = ?
         WHERE Service_ID = ?`,
        [
          service.name,
          service.description,
          service.expectedDuration,
          service.priorityLevel,
          service.isOpen,
          serviceId
        ]
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return repository.findById(serviceId);
    },

    async remove(serviceId) {
      const [result] = await execute(
        database,
        'DELETE FROM Service WHERE Service_ID = ?',
        [serviceId]
      );

      return result.affectedRows > 0;
    }
  };

  return repository;
}

const serviceRepository = createServiceRepository();

module.exports = {
  ...serviceRepository,
  createServiceRepository,
  mapService
};
