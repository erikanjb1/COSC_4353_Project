const test = require("node:test");
const assert = require(
  "node:assert/strict"
);

const {
  notifications,
  history,
  resetStore
} = require("../src/data/store");

const {
  calculateEstimatedWaitMinutes,
  validateJoinInput,
  sortQueue,
  joinQueue,
  leaveQueue,
  viewQueue,
  serveNext,
  getUserStatus,
  listServices,
  getUserNotifications,
  getUserHistory
} = require(
  "../src/services/queueService"
);

const SERVICES = [
  {
    id: 1,
    name: "Academic Advising",
    description:
      "Students can meet with an advisor to plan classes and discuss degree requirements.",
    expectedDuration: 20,
    priorityLevel: "normal",
    isOpen: true
  },
  {
    id: 2,
    name: "Clinic Check-In",
    description:
      "Patients can check in for clinic services and receive wait-time updates.",
    expectedDuration: 15,
    priorityLevel: "high",
    isOpen: true
  }
];

function clone(value) {
  return value ? { ...value } : null;
}

function createFakeRepository() {
  const services = SERVICES.map(clone);
  const queues = [];
  const entries = [];
  let nextQueueId = 1;
  let nextEntryId = 1;

  function findQueue(queueId) {
    return queues.find(
      function (queue) {
        return queue.queueId === Number(queueId);
      }
    );
  }

  function findOpenQueue(serviceId) {
    return queues.find(
      function (queue) {
        return (
          queue.serviceId === Number(serviceId) &&
          queue.status === "open"
        );
      }
    );
  }

  function entryService(entry) {
    const queue = findQueue(entry.queueId);

    return services.find(
      function (service) {
        return service.id === queue.serviceId;
      }
    );
  }

  function cloneEntry(entry) {
    if (!entry) {
      return null;
    }

    const service = entryService(entry);

    return {
      ...entry,
      serviceId: service.id,
      serviceName: service.name
    };
  }

  function sortedWaitingEntries(queueId) {
    return sortQueue(
      entries.filter(
        function (entry) {
          return (
            entry.queueId === Number(queueId) &&
            entry.status === "waiting"
          );
        }
      )
    );
  }

  return {
    services,
    queues,
    entries,

    async findServiceById(serviceId) {
      return clone(
        services.find(
          function (service) {
            return service.id === Number(serviceId);
          }
        )
      );
    },

    async findServicesWithQueueLengths() {
      return services.map(
        function (service) {
          const queue = findOpenQueue(service.id);
          const queueLength = queue
            ? sortedWaitingEntries(queue.queueId).length
            : 0;

          return {
            ...service,
            queueLength
          };
        }
      );
    },

    async findOpenQueueByServiceId(serviceId) {
      return clone(findOpenQueue(serviceId));
    },

    async createOpenQueue(serviceId) {
      const queue = {
        queueId: nextQueueId++,
        serviceId: Number(serviceId),
        status: "open"
      };

      queues.push(queue);

      return clone(queue);
    },

    async userExists() {
      return true;
    },

    async findWaitingEntryForUser(userId) {
      return cloneEntry(
        entries.find(
          function (entry) {
            return (
              entry.userId === Number(userId) &&
              entry.status === "waiting"
            );
          }
        )
      );
    },

    async findWaitingEntryForUserAndService(
      userId,
      serviceId
    ) {
      return cloneEntry(
        entries.find(
          function (entry) {
            const queue = findQueue(entry.queueId);

            return (
              entry.userId === Number(userId) &&
              queue.serviceId ===
                Number(serviceId) &&
              entry.status === "waiting"
            );
          }
        )
      );
    },

    async findWaitingEntriesByServiceId(serviceId) {
      const queue = findOpenQueue(serviceId);

      if (!queue) {
        return [];
      }

      return sortedWaitingEntries(
        queue.queueId
      ).map(cloneEntry);
    },

    async countWaitingEntries(queueId) {
      return sortedWaitingEntries(queueId).length;
    },

    async createEntry(entry) {
      const queue = findQueue(entry.queueId);
      const service = services.find(
        function (item) {
          return item.id === queue.serviceId;
        }
      );

      const savedEntry = {
        id: String(nextEntryId),
        queueEntryId: nextEntryId,
        queueId: entry.queueId,
        serviceId: service.id,
        serviceName: service.name,
        userId: entry.userId,
        userName: entry.userName,
        priority: entry.priority,
        position: entry.position,
        joinedAt: new Date(
          Date.UTC(2026, 7, 1, 12, 0, nextEntryId)
        ).toISOString(),
        servedAt: null,
        leftAt: null,
        status: "waiting"
      };

      nextEntryId += 1;
      entries.push(savedEntry);

      return clone(savedEntry);
    },

    async findEntryById(entryId) {
      return cloneEntry(
        entries.find(
          function (entry) {
            return entry.queueEntryId ===
              Number(entryId);
          }
        )
      );
    },

    async updateEntryStatus(entryId, status) {
      const entry = entries.find(
        function (item) {
          return item.queueEntryId ===
            Number(entryId);
        }
      );

      if (!entry) {
        return null;
      }

      entry.status = status;

      if (status === "served") {
        entry.servedAt =
          "2026-08-01T12:30:00.000Z";
      }

      if (status === "canceled") {
        entry.leftAt =
          "2026-08-01T12:15:00.000Z";
      }

      return cloneEntry(entry);
    },

    async resequenceQueue(queueId) {
      sortedWaitingEntries(queueId).forEach(
        function (entry, index) {
          entry.position = index + 1;
        }
      );
    }
  };
}

async function join(
  repository,
  userId,
  userName,
  serviceId = 1,
  priority = "normal"
) {
  return joinQueue(
    {
      userId,
      userName,
      serviceId,
      priority
    },
    repository
  );
}

test.beforeEach(function () {
  resetStore();
});

test(
  "calculates estimated wait from queue position and service duration",
  function () {
    assert.equal(
      calculateEstimatedWaitMinutes(
        1,
        20
      ),
      20
    );

    assert.equal(
      calculateEstimatedWaitMinutes(
        4,
        20
      ),
      80
    );
  }
);

test(
  "validates required fields and field limits",
  function () {
    assert.throws(
      function () {
        validateJoinInput({
          serviceId: "",
          userName: "A",
          priority: "urgent"
        });
      },
      function (error) {
        return (
          error.status === 400 &&
          error.details.length === 3
        );
      }
    );
  }
);

test(
  "joins a queue and persists the entry through the repository",
  async function () {
    const repository = createFakeRepository();

    const result = await join(
      repository,
      1,
      "first user"
    );

    assert.equal(
      result.entry.status,
      "waiting"
    );

    assert.equal(result.position, 1);

    assert.equal(
      result.estimatedWaitMinutes,
      20
    );

    assert.equal(
      repository.entries.length,
      1
    );

    assert.equal(
      history[0].outcome,
      "Joined Queue"
    );

    assert.ok(
      notifications.some(
        function (item) {
          return (
            item.type ===
            "QUEUE_JOINED"
          );
        }
      )
    );
  }
);

test(
  "prevents a user from joining more than one active queue",
  async function () {
    const repository = createFakeRepository();

    await join(
      repository,
      1,
      "first user"
    );

    await assert.rejects(
      function () {
        return join(
          repository,
          1,
          "first user",
          2
        );
      },
      function (error) {
        return error.status === 409;
      }
    );
  }
);

test(
  "orders by priority and then arrival time",
  function () {
    const earlier =
      new Date().toISOString();

    const later =
      new Date(
        Date.now() + 1000
      ).toISOString();

    const sorted = sortQueue([
      {
        id: "2",
        priority: "normal",
        joinedAt: later
      },
      {
        id: "3",
        priority: "high",
        joinedAt: later
      },
      {
        id: "1",
        priority: "normal",
        joinedAt: earlier
      }
    ]);

    assert.deepEqual(
      sorted.map(function (item) {
        return item.id;
      }),
      ["3", "1", "2"]
    );
  }
);

test(
  "calculates queue position and wait time",
  async function () {
    const repository = createFakeRepository();

    await join(
      repository,
      1,
      "First User"
    );

    const second = await join(
      repository,
      2,
      "Second User"
    );

    assert.equal(
      second.position,
      2
    );

    assert.equal(
      second.estimatedWaitMinutes,
      40
    );

    const status =
      await getUserStatus(
        {
          userId: 2,
          serviceId: 1
        },
        repository
      );

    assert.equal(
      status.position,
      2
    );

    assert.equal(
      status.displayStatus,
      "Almost Ready"
    );
  }
);

test(
  "allows a user to leave and records history",
  async function () {
    const repository = createFakeRepository();

    await join(
      repository,
      1,
      "First User"
    );

    const result = await leaveQueue(
      {
        userId: 1,
        serviceId: 1
      },
      repository
    );

    assert.equal(
      result.status,
      "canceled"
    );

    assert.equal(
      repository.entries[0].status,
      "canceled"
    );

    assert.equal(
      history[0].outcome,
      "Left Queue"
    );
  }
);

test(
  "administrator can view the current queue",
  async function () {
    const repository = createFakeRepository();

    await join(
      repository,
      1,
      "First User"
    );

    await join(
      repository,
      2,
      "Second User"
    );

    const result =
      await viewQueue(1, repository);

    assert.equal(
      result.totalWaiting,
      2
    );

    assert.equal(
      result.queue[0].position,
      1
    );

    assert.equal(
      result.queue[1]
        .estimatedWaitMinutes,
      40
    );
  }
);

test(
  "administrator action marks the next user served",
  async function () {
    const repository = createFakeRepository();

    await join(
      repository,
      1,
      "Normal User",
      1,
      "normal"
    );

    await join(
      repository,
      2,
      "Priority User",
      1,
      "high"
    );

    const result =
      await serveNext(1, repository);

    assert.equal(
      result.entry.userId,
      2
    );

    assert.equal(
      result.entry.status,
      "served"
    );

    assert.equal(
      repository.entries.find(
        function (entry) {
          return entry.userId === 2;
        }
      ).status,
      "served"
    );

    assert.equal(
      history[0].outcome,
      "Served"
    );
  }
);

test(
  "lists services with current queue lengths",
  async function () {
    const repository = createFakeRepository();

    await join(
      repository,
      1,
      "First User"
    );

    const result =
      await listServices(repository);

    const service = result.find(
      function (item) {
        return item.id === 1;
      }
    );

    assert.equal(
      service.queueLength,
      1
    );

    assert.equal(
      service.estimatedWaitMinutes,
      40
    );
  }
);

test(
  "returns notifications and history for only the selected user",
  async function () {
    const repository = createFakeRepository();

    await join(
      repository,
      1,
      "First User"
    );

    await join(
      repository,
      2,
      "Second User",
      2
    );

    await leaveQueue(
      {
        userId: 1,
        serviceId: 1
      },
      repository
    );

    assert.ok(
      getUserNotifications(
        1
      ).length > 0
    );

    assert.equal(
      getUserHistory(
        1
      ).length,
      2
    );

    assert.equal(
      getUserHistory(
        2
      ).length,
      1
    );
  }
);

test(
  "returns not found when serving an empty queue",
  async function () {
    const repository = createFakeRepository();

    await assert.rejects(
      function () {
        return serveNext(1, repository);
      },
      function (error) {
        return error.status === 404;
      }
    );
  }
);
