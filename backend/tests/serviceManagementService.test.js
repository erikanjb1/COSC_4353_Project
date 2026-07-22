const test = require("node:test");
const assert = require(
  "node:assert/strict"
);

const {
  validateServiceInput,
  createService,
  updateService,
  deleteService,
  listServices
} = require(
  "../src/services/serviceManagementService"
);

const {
  queueEntries
} = require("../src/data/store");

test(
  "validates required fields and field limits when creating a service",
  function () {
    assert.throws(
      function () {
        validateServiceInput({
          name: "",
          description: "hi",
          expectedDuration: 0,
          priorityLevel: "urgent",
          isOpen: "yes"
        });
      },
      function (error) {
        return (
          error.status === 400 &&
          error.details.length === 5
        );
      }
    );
  }
);

test(
  "creates a new service with valid input",
  function () {
    const service = createService({
      name: "Library Help Desk",
      description:
        "Assistance with borrowing and returning books.",
      expectedDuration: 12,
      priorityLevel: "normal",
      isOpen: true
    });

    assert.ok(
      service.id.startsWith("service-")
    );

    assert.equal(
      service.name,
      "Library Help Desk"
    );

    assert.equal(service.isOpen, true);

    const found = listServices().find(
      function (item) {
        return item.id === service.id;
      }
    );

    assert.ok(found);
  }
);

test(
  "rejects creating a service with a duplicate name",
  function () {
    createService({
      name: "Financial Aid Office",
      description:
        "Help with tuition and scholarships.",
      expectedDuration: 18,
      priorityLevel: "high",
      isOpen: true
    });

    assert.throws(
      function () {
        createService({
          name: "Financial Aid Office",
          description:
            "Duplicate service attempt.",
          expectedDuration: 20,
          priorityLevel: "normal",
          isOpen: true
        });
      },
      function (error) {
        return error.status === 409;
      }
    );
  }
);

test(
  "updates an existing service",
  function () {
    const created = createService({
      name: "Parking Permits",
      description:
        "Issue and renew parking permits.",
      expectedDuration: 10,
      priorityLevel: "low",
      isOpen: true
    });

    const updated = updateService(
      created.id,
      {
        name: "Parking Permits",
        description:
          "Issue, renew, and dispute parking permits.",
        expectedDuration: 15,
        priorityLevel: "normal",
        isOpen: false
      }
    );

    assert.equal(
      updated.description,
      "Issue, renew, and dispute parking permits."
    );

    assert.equal(
      updated.expectedDuration,
      15
    );

    assert.equal(updated.isOpen, false);
  }
);

test(
  "returns not found when updating a service that does not exist",
  function () {
    assert.throws(
      function () {
        updateService(
          "service-does-not-exist",
          {
            name: "Ghost Service",
            description: "Should not exist.",
            expectedDuration: 5,
            priorityLevel: "low",
            isOpen: true
          }
        );
      },
      function (error) {
        return error.status === 404;
      }
    );
  }
);

test(
  "deletes a service with no users waiting",
  function () {
    const service = createService({
      name: "Mailroom Pickup",
      description:
        "Pick up packages and mail.",
      expectedDuration: 5,
      priorityLevel: "low",
      isOpen: true
    });

    const deleted = deleteService(service.id);

    assert.equal(deleted.id, service.id);

    const stillExists = listServices().some(
      function (item) {
        return item.id === service.id;
      }
    );

    assert.equal(stillExists, false);
  }
);

test(
  "returns not found when deleting a service that does not exist",
  function () {
    assert.throws(
      function () {
        deleteService(
          "service-does-not-exist"
        );
      },
      function (error) {
        return error.status === 404;
      }
    );
  }
);

test(
  "rejects deleting a service that has users waiting",
  function () {
    const service = createService({
      name: "Study Room Booking",
      description:
        "Reserve a study room for group work.",
      expectedDuration: 30,
      priorityLevel: "low",
      isOpen: true
    });

    queueEntries.push({
      id: "test-waiting-entry",
      userId: "user-test",
      userName: "Test User",
      serviceId: service.id,
      priority: "low",
      joinedAt: new Date().toISOString(),
      status: "waiting",
      servedAt: null,
      leftAt: null
    });

    assert.throws(
      function () {
        deleteService(service.id);
      },
      function (error) {
        return error.status === 409;
      }
    );

    const stillExists = listServices().some(
      function (item) {
        return item.id === service.id;
      }
    );

    assert.equal(stillExists, true);
  }
);