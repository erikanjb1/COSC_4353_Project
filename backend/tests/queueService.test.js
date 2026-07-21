const test = require("node:test");
const assert = require(
  "node:assert/strict"
);

const {
  queueEntries,
  notifications,
  history,
  resetStore
} = require("../src/data/store");

const {
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

function join(
  userId,
  userName,
  serviceId = "service-1",
  priority = "normal"
) {
  return joinQueue({
    userId,
    userName,
    serviceId,
    priority
  });
}

test.beforeEach(function () {
  resetStore();
});

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
  "joins a queue and creates notifications",
  function () {
    const result = join(
      "user-1",
      "first user"
    );

    assert.equal(
      result.entry.status,
      "waiting"
    );

    assert.equal(result.position, 1);

    assert.equal(
      result.estimatedWaitMinutes,
      0
    );

    assert.equal(
      queueEntries.length,
      1
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
  function () {
    join(
      "user-1",
      "first user"
    );

    assert.throws(
      function () {
        join(
          "user-1",
          "first user",
          "service-2"
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
  function () {
    join(
      "user-1",
      "First User"
    );

    const second = join(
      "user-2",
      "Second User"
    );

    assert.equal(
      second.position,
      2
    );

    assert.equal(
      second.estimatedWaitMinutes,
      20
    );

    const status =
      getUserStatus({
        userId: "user-2",
        serviceId: "service-1"
      });

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
  function () {
    join(
      "user-1",
      "First User"
    );

    const result = leaveQueue({
      userId: "user-1",
      serviceId: "service-1"
    });

    assert.equal(
      result.status,
      "left"
    );

    assert.equal(
      history[0].outcome,
      "Left Queue"
    );
  }
);

test(
  "administrator can view the current queue",
  function () {
    join(
      "user-1",
      "First User"
    );

    join(
      "user-2",
      "Second User"
    );

    const result =
      viewQueue("service-1");

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
      20
    );
  }
);

test(
  "serves the highest-priority next user",
  function () {
    join(
      "user-1",
      "Normal User",
      "service-1",
      "normal"
    );

    join(
      "user-2",
      "Priority User",
      "service-1",
      "high"
    );

    const result =
      serveNext("service-1");

    assert.equal(
      result.entry.userId,
      "user-2"
    );

    assert.equal(
      result.entry.status,
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
  function () {
    join(
      "user-1",
      "First User"
    );

    const result =
      listServices();

    const service = result.find(
      function (item) {
        return (
          item.id === "service-1"
        );
      }
    );

    assert.equal(
      service.queueLength,
      1
    );
  }
);

test(
  "returns notifications and history for only the selected user",
  function () {
    join(
      "user-1",
      "First User"
    );

    join(
      "user-2",
      "Second User",
      "service-2"
    );

    leaveQueue({
      userId: "user-1",
      serviceId: "service-1"
    });

    assert.ok(
      getUserNotifications(
        "user-1"
      ).length > 0
    );

    assert.equal(
      getUserHistory(
        "user-1"
      ).length,
      1
    );

    assert.equal(
      getUserHistory(
        "user-2"
      ).length,
      0
    );
  }
);

test(
  "returns not found when serving an empty queue",
  function () {
    assert.throws(
      function () {
        serveNext("service-1");
      },
      function (error) {
        return error.status === 404;
      }
    );
  }
);