const crypto = require("node:crypto");

const {
  notifications,
  history
} = require("../data/store");

const queueEntryRepository = require(
  "../data/queueEntryRepository"
);

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

function validatePositiveInteger(
  value,
  fieldName
) {
  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    throw new HttpError(
      400,
      `${fieldName} must be a positive integer.`
    );
  }

  return parsedValue;
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

  const parsedServiceId = Number(
    input.serviceId
  );

  if (
    !Number.isInteger(parsedServiceId) ||
    parsedServiceId <= 0
  ) {
    errors.push(
      "serviceId is required and must be a positive integer."
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

async function getService(
  serviceId,
  repository = queueEntryRepository
) {
  const id = validatePositiveInteger(
    serviceId,
    "Service ID"
  );

  const service =
    await repository.findServiceById(id);

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

async function activeQueueForService(
  serviceId,
  repository = queueEntryRepository
) {
  const id = validatePositiveInteger(
    serviceId,
    "Service ID"
  );

  return repository.findWaitingEntriesByServiceId(
    id
  );
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

async function estimateWait(
  serviceId,
  queueEntryId,
  repository = queueEntryRepository
) {
  const service = await getService(
    serviceId,
    repository
  );
  const queue =
    await activeQueueForService(
      serviceId,
      repository
    );

  const index = queue.findIndex(
    function (entry) {
      return String(entry.id) ===
        String(queueEntryId);
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

async function notifyUsersCloseToService(
  serviceId,
  repository = queueEntryRepository
) {
  const queue =
    await activeQueueForService(
      serviceId,
      repository
    );

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

async function joinQueue({
  userId,
  userName,
  serviceId,
  priority
}, repository = queueEntryRepository) {
  validateJoinInput({
    userName,
    serviceId,
    priority
  });

  const selectedUserId =
    validatePositiveInteger(
      userId,
      "User ID"
    );

  const selectedServiceId =
    validatePositiveInteger(
      serviceId,
      "Service ID"
    );

  const service = await getService(
    selectedServiceId,
    repository
  );

  if (!service.isOpen) {
    throw new HttpError(
      409,
      "This service queue is closed."
    );
  }

  const userExists =
    await repository.userExists(
      selectedUserId
    );

  if (!userExists) {
    throw new HttpError(
      404,
      "User was not found."
    );
  }

  const alreadyInAnyQueue =
    await repository.findWaitingEntryForUser(
      selectedUserId
    );

  if (alreadyInAnyQueue) {
    throw new HttpError(
      409,
      "User is already waiting in a queue."
    );
  }

  let queue =
    await repository.findOpenQueueByServiceId(
      selectedServiceId
    );

  if (!queue) {
    queue =
      await repository.createOpenQueue(
        selectedServiceId
      );
  }

  const position =
    await repository.countWaitingEntries(
      queue.queueId
    ) + 1;

  const createdEntry =
    await repository.createEntry({
      queueId: queue.queueId,
      userId: selectedUserId,
      userName: userName.trim(),
      priority:
        priority ??
        service.priorityLevel ??
        "normal",
      position
    });

  await repository.resequenceQueue(
    queue.queueId
  );

  const entry =
    await repository.findEntryById(
      createdEntry.queueEntryId
    );

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
    selectedUserId,
    "QUEUE_JOINED",
    `You joined the ${service.name} queue.`,
    entry.id
  );

  await notifyUsersCloseToService(
    selectedServiceId,
    repository
  );

  const wait = await estimateWait(
    selectedServiceId,
    entry.id,
    repository
  );

  return {
    entry: entry,
    position: wait.position,
    estimatedWaitMinutes:
      wait.estimatedWaitMinutes,
    notification: notification
  };
}

async function leaveQueue({
  userId,
  serviceId
}, repository = queueEntryRepository) {
  const selectedUserId =
    validatePositiveInteger(
      userId,
      "User ID"
    );

  const selectedServiceId =
    validatePositiveInteger(
      serviceId,
      "Service ID"
    );

  const service = await getService(
    selectedServiceId,
    repository
  );

  const entry =
    await repository
      .findWaitingEntryForUserAndService(
        selectedUserId,
        selectedServiceId
      );

  if (!entry) {
    throw new HttpError(
      404,
      "No active queue entry was found for this user."
    );
  }

  const updatedEntry =
    await repository.updateEntryStatus(
      entry.queueEntryId,
      "canceled"
    );

  await repository.resequenceQueue(
    entry.queueId
  );

  if (!updatedEntry) {
    throw new HttpError(
      404,
      "No active queue entry was found for this user."
    );
  }

  history.unshift({
    id: crypto.randomUUID(),
    queueEntryId: updatedEntry.id,
    userId: updatedEntry.userId,
    serviceId: updatedEntry.serviceId,
    serviceName: service.name,
    joinedAt: updatedEntry.joinedAt,
    completedAt: updatedEntry.leftAt,
    outcome: "Left Queue"
  });

  addNotification(
    selectedUserId,
    "QUEUE_LEFT",
    `You left the ${service.name} queue.`,
    updatedEntry.id
  );

  await notifyUsersCloseToService(
    selectedServiceId,
    repository
  );

  return updatedEntry;
}

async function viewQueue(
  serviceId,
  repository = queueEntryRepository
) {
  const selectedServiceId =
    validatePositiveInteger(
      serviceId,
      "Service ID"
    );

  const service = await getService(
    selectedServiceId,
    repository
  );

  const queue =
    (
      await activeQueueForService(
        selectedServiceId,
        repository
      )
    ).map(
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

async function serveNext(
  serviceId,
  repository = queueEntryRepository
) {
  const selectedServiceId =
    validatePositiveInteger(
      serviceId,
      "Service ID"
    );

  const service = await getService(
    selectedServiceId,
    repository
  );

  const queue =
    await activeQueueForService(
      selectedServiceId,
      repository
    );

  if (queue.length === 0) {
    throw new HttpError(
      404,
      "There are no users waiting in this queue."
    );
  }

  const entry = queue[0];

  const updatedEntry =
    await repository.updateEntryStatus(
      entry.queueEntryId,
      "served"
    );

  await repository.resequenceQueue(
    entry.queueId
  );

  history.unshift({
    id: crypto.randomUUID(),
    queueEntryId: updatedEntry.id,
    userId: updatedEntry.userId,
    serviceId: updatedEntry.serviceId,
    serviceName: service.name,
    joinedAt: updatedEntry.joinedAt,
    completedAt: updatedEntry.servedAt,
    outcome: "Served"
  });

  const notification = addNotification(
    updatedEntry.userId,
    "SERVED",
    `You are now being served for ${service.name}.`,
    updatedEntry.id
  );

  await notifyUsersCloseToService(
    selectedServiceId,
    repository
  );

  return {
    entry: updatedEntry,
    notification: notification
  };
}

async function getUserStatus({
  userId,
  serviceId
}, repository = queueEntryRepository) {
  const selectedUserId =
    validatePositiveInteger(
      userId,
      "User ID"
    );

  const selectedServiceId =
    validatePositiveInteger(
      serviceId,
      "Service ID"
    );

  const entry =
    await repository
      .findWaitingEntryForUserAndService(
        selectedUserId,
        selectedServiceId
      );

  if (!entry) {
    throw new HttpError(
      404,
      "No active queue entry was found for this user."
    );
  }

  const service = await getService(
    selectedServiceId,
    repository
  );

  const wait = await estimateWait(
    selectedServiceId,
    entry.id,
    repository
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

async function listServices(
  repository = queueEntryRepository
) {
  const services =
    await repository.findServicesWithQueueLengths();

  return services.map(
    function (service) {
      return {
        ...service,
        estimatedWaitMinutes:
          calculateEstimatedWaitMinutes(
            service.queueLength + 1,
            service.expectedDuration
          )
      };
    }
  );
}

function getUserNotifications(userId) {
  return notifications.filter(
    function (item) {
      return String(item.userId) ===
        String(userId);
    }
  );
}

function getUserHistory(userId) {
  return history.filter(
    function (item) {
      return String(item.userId) ===
        String(userId);
    }
  );
}

module.exports = {
  PRIORITY_WEIGHT,
  calculateEstimatedWaitMinutes,
  validatePositiveInteger,
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
