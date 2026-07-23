const crypto = require("node:crypto");

const {
  services,
  queueEntries,
  notifications,
  history
} = require("../data/store");

const HttpError = require(
  "../utils/httpError"
);

const PRIORITY_WEIGHT = Object.freeze({
  low: 1,
  normal: 2,
  high: 3
});

function calculateEstimatedWaitMinutes(
  position,
  expectedDuration
) {
  return Math.max(position, 0) *
    expectedDuration;
}

function validateJoinInput(input) {
  const errors = [];

  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new HttpError(
      400,
      "Request body must be a JSON object."
    );
  }

  if (
    typeof input.serviceId !== "string" ||
    input.serviceId.trim() === ""
  ) {
    errors.push(
      "serviceId is required and must be a non-empty string."
    );
  } else if (
    input.serviceId.length > 50
  ) {
    errors.push(
      "serviceId must not exceed 50 characters."
    );
  }

  if (
    typeof input.userName !== "string" ||
    input.userName.trim() === ""
  ) {
    errors.push(
      "userName is required and must be a non-empty string."
    );
  } else if (
    input.userName.trim().length < 2 ||
    input.userName.trim().length > 60
  ) {
    errors.push(
      "userName must contain between 2 and 60 characters."
    );
  }

  if (
    input.priority !== undefined &&
    (
      typeof input.priority !== "string" ||
      !Object.hasOwn(
        PRIORITY_WEIGHT,
        input.priority
      )
    )
  ) {
    errors.push(
      "priority must be low, normal, or high."
    );
  }

  if (errors.length > 0) {
    throw new HttpError(
      400,
      "Validation failed.",
      errors
    );
  }
}

function getService(serviceId) {
  const service = services.find(
    function (item) {
      return item.id === serviceId;
    }
  );

  if (!service) {
    throw new HttpError(
      404,
      "Service was not found."
    );
  }

  return service;
}

function sortQueue(entries) {
  return [...entries].sort(
    function (a, b) {
      const priorityDifference =
        PRIORITY_WEIGHT[b.priority] -
        PRIORITY_WEIGHT[a.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        new Date(a.joinedAt).getTime() -
        new Date(b.joinedAt).getTime()
      );
    }
  );
}

function activeQueueForService(serviceId) {
  const entries = queueEntries.filter(
    function (entry) {
      return (
        entry.serviceId === serviceId &&
        entry.status === "waiting"
      );
    }
  );

  return sortQueue(entries);
}

function addNotification(
  userId,
  type,
  message,
  queueEntryId
) {
  const notification = {
    id: crypto.randomUUID(),
    userId: userId,
    queueEntryId: queueEntryId,
    type: type,
    message: message,
    createdAt: new Date().toISOString(),
    read: false
  };

  notifications.unshift(notification);

  return notification;
}

function estimateWait(
  serviceId,
  queueEntryId
) {
  const service = getService(serviceId);
  const queue =
    activeQueueForService(serviceId);

  const index = queue.findIndex(
    function (entry) {
      return entry.id === queueEntryId;
    }
  );

  if (index === -1) {
    throw new HttpError(
      404,
      "Active queue entry was not found."
    );
  }

  const position = index + 1;

  return {
    position: position,
    estimatedWaitMinutes:
      calculateEstimatedWaitMinutes(
        position,
        service.expectedDuration
      )
  };
}

function notifyUsersCloseToService(
  serviceId
) {
  const queue =
    activeQueueForService(serviceId);

  queue.slice(0, 2).forEach(
    function (entry, index) {
      const alreadyNotified =
        notifications.some(
          function (notification) {
            return (
              notification.queueEntryId ===
                entry.id &&
              notification.type ===
                "ALMOST_READY"
            );
          }
        );

      if (!alreadyNotified) {
        addNotification(
          entry.userId,
          "ALMOST_READY",
          index === 0
            ? "You are next in line."
            : "You are close to being served.",
          entry.id
        );
      }
    }
  );
}

function joinQueue({
  userId,
  userName,
  serviceId,
  priority
}) {
  validateJoinInput({
    userName,
    serviceId,
    priority
  });

  const service = getService(serviceId);

  if (!service.isOpen) {
    throw new HttpError(
      409,
      "This service queue is closed."
    );
  }

  const alreadyInAnyQueue =
    queueEntries.find(
      function (entry) {
        return (
          entry.userId === userId &&
          entry.status === "waiting"
        );
      }
    );

  if (alreadyInAnyQueue) {
    throw new HttpError(
      409,
      "User is already waiting in a queue."
    );
  }

  const entry = {
    id: crypto.randomUUID(),
    userId: userId,
    userName: userName.trim(),
    serviceId: serviceId,
    priority:
      priority ??
      service.priorityLevel ??
      "normal",
    joinedAt: new Date().toISOString(),
    status: "waiting",
    servedAt: null,
    leftAt: null
  };

  queueEntries.push(entry);

  history.unshift({
    id: crypto.randomUUID(),
    queueEntryId: entry.id,
    userId: entry.userId,
    serviceId: entry.serviceId,
    serviceName: service.name,
    joinedAt: entry.joinedAt,
    completedAt: entry.joinedAt,
    outcome: "Joined Queue"
  });

  const notification = addNotification(
    userId,
    "QUEUE_JOINED",
    `You joined the ${service.name} queue.`,
    entry.id
  );

  notifyUsersCloseToService(serviceId);

  const wait = estimateWait(
    serviceId,
    entry.id
  );

  return {
    entry: entry,
    position: wait.position,
    estimatedWaitMinutes:
      wait.estimatedWaitMinutes,
    notification: notification
  };
}

function leaveQueue({
  userId,
  serviceId
}) {
  const service = getService(serviceId);

  const entry = queueEntries.find(
    function (item) {
      return (
        item.userId === userId &&
        item.serviceId === serviceId &&
        item.status === "waiting"
      );
    }
  );

  if (!entry) {
    throw new HttpError(
      404,
      "No active queue entry was found for this user."
    );
  }

  entry.status = "left";
  entry.leftAt =
    new Date().toISOString();

  history.unshift({
    id: crypto.randomUUID(),
    queueEntryId: entry.id,
    userId: entry.userId,
    serviceId: entry.serviceId,
    serviceName: service.name,
    joinedAt: entry.joinedAt,
    completedAt: entry.leftAt,
    outcome: "Left Queue"
  });

  addNotification(
    userId,
    "QUEUE_LEFT",
    `You left the ${service.name} queue.`,
    entry.id
  );

  notifyUsersCloseToService(serviceId);

  return entry;
}

function viewQueue(serviceId) {
  const service = getService(serviceId);

  const queue =
    activeQueueForService(serviceId).map(
      function (entry, index) {
        const position = index + 1;

        return {
          ...entry,
          position: position,
          estimatedWaitMinutes:
            calculateEstimatedWaitMinutes(
              position,
              service.expectedDuration
            )
        };
      }
    );

  return {
    service: service,
    totalWaiting: queue.length,
    queue: queue
  };
}

function serveNext(serviceId) {
  const service = getService(serviceId);
  const queue =
    activeQueueForService(serviceId);

  if (queue.length === 0) {
    throw new HttpError(
      404,
      "There are no users waiting in this queue."
    );
  }

  const entry = queue[0];

  entry.status = "served";
  entry.servedAt =
    new Date().toISOString();

  history.unshift({
    id: crypto.randomUUID(),
    queueEntryId: entry.id,
    userId: entry.userId,
    serviceId: entry.serviceId,
    serviceName: service.name,
    joinedAt: entry.joinedAt,
    completedAt: entry.servedAt,
    outcome: "Served"
  });

  const notification = addNotification(
    entry.userId,
    "SERVED",
    `You are now being served for ${service.name}.`,
    entry.id
  );

  notifyUsersCloseToService(serviceId);

  return {
    entry: entry,
    notification: notification
  };
}

function getUserStatus({
  userId,
  serviceId
}) {
  const entry = queueEntries.find(
    function (item) {
      return (
        item.userId === userId &&
        item.serviceId === serviceId &&
        item.status === "waiting"
      );
    }
  );

  if (!entry) {
    throw new HttpError(
      404,
      "No active queue entry was found for this user."
    );
  }

  const service = getService(serviceId);

  const wait = estimateWait(
    serviceId,
    entry.id
  );

  let displayStatus = "Waiting";

  if (wait.position <= 2) {
    displayStatus = "Almost Ready";
  }

  return {
    entry: entry,
    service: service,
    position: wait.position,
    estimatedWaitMinutes:
      wait.estimatedWaitMinutes,
    displayStatus: displayStatus
  };
}

function listServices() {
  return services.map(
    function (service) {
      const queueLength =
        activeQueueForService(
          service.id
        ).length;

      return {
        ...service,
        queueLength: queueLength,
        estimatedWaitMinutes:
          calculateEstimatedWaitMinutes(
            queueLength + 1,
            service.expectedDuration
          )
      };
    }
  );
}

function getUserNotifications(userId) {
  return notifications.filter(
    function (item) {
      return item.userId === userId;
    }
  );
}

function getUserHistory(userId) {
  return history.filter(
    function (item) {
      return item.userId === userId;
    }
  );
}

module.exports = {
  PRIORITY_WEIGHT,
  calculateEstimatedWaitMinutes,
  validateJoinInput,
  sortQueue,
  joinQueue,
  leaveQueue,
  viewQueue,
  serveNext,
  estimateWait,
  getUserStatus,
  listServices,
  getUserNotifications,
  getUserHistory
};
