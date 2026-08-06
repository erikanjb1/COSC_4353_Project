const queueEntryRepository = require(
  "../data/queueEntryRepository"
);

const activityRepository = require(
  "../data/activityRepository"
);

const HttpError = require(
  "../utils/httpError"
);

const PRIORITY_WEIGHT = Object.freeze({
  low: 1,
  normal: 2,
  high: 3
});

const testActivityStore = new WeakMap();

function getTestActivity(repository) {
  if (!testActivityStore.has(repository)) {
    testActivityStore.set(repository, {
      notifications: [],
      history: []
    });
  }

  return testActivityStore.get(repository);
}

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

function shouldUseDatabaseActivity(repository) {
  return repository === queueEntryRepository;
}

async function addNotification(
  userId,
  type,
  message,
  queueEntryId,
  repository
) {
  if (!shouldUseDatabaseActivity(repository)) {
    const notification = {
      id: String(Date.now()),
      userId: userId,
      queueEntryId: queueEntryId,
      type: type,
      message: message,
      timestamp: new Date().toISOString(),
      status: "sent"
    };

    getTestActivity(repository)
      .notifications
      .unshift(notification);

    return notification;
  }

  const notification =
    await activityRepository.createNotification({
      userId: userId,
      status: "sent",
      message: message
    });

  return {
    ...notification,
    type: type,
    queueEntryId: queueEntryId
  };
}

async function addHistory(
  entry,
  service,
  outcome,
  completedAt,
  repository
) {
  const record = {
    queueEntryId: entry.id,
    userId: entry.userId,
    serviceId: entry.serviceId,
    serviceName: service.name,
    joinedAt: entry.joinedAt,
    completedAt: completedAt,
    outcome: outcome
  };

  if (!shouldUseDatabaseActivity(repository)) {
    getTestActivity(repository)
      .history
      .unshift(record);

    return record;
  }

  const savedRecord =
    await activityRepository.createHistory({
      queueEntryId: entry.queueEntryId,
      userId: entry.userId,
      serviceId: entry.serviceId,
      serviceName: service.name,
      joinedAt: entry.joinedAt,
      completedAt: completedAt,
      outcome: outcome
    });

  return savedRecord;
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

  for (const [index, entry] of queue.slice(0, 2).entries()) {
    const userNotifications =
      shouldUseDatabaseActivity(repository)
        ? await activityRepository
            .findNotificationsByUserId(entry.userId)
        : [];

    const message =
      index === 0
        ? "You are next in line."
        : "You are close to being served.";

    const alreadyNotified =
      userNotifications.some(
        function (notification) {
          return (
            notification.message === message
          );
        }
      );

    if (!alreadyNotified) {
      await addNotification(
        entry.userId,
        "ALMOST_READY",
        message,
        entry.id,
        repository
      );
    }
  }
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

  await addHistory(
    entry,
    service,
    "joined",
    entry.joinedAt,
    repository
  );

  const notification = await addNotification(
    selectedUserId,
    "QUEUE_JOINED",
    `You joined the ${service.name} queue.`,
    entry.id,
    repository
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

  await addHistory(
    updatedEntry,
    service,
    "left",
    updatedEntry.leftAt,
    repository
  );

  await addNotification(
    selectedUserId,
    "QUEUE_LEFT",
    `You left the ${service.name} queue.`,
    updatedEntry.id,
    repository
  );

  await notifyUsersCloseToService(
    selectedServiceId,
    repository
  );

  return updatedEntry;
}

async function moveQueueEntry({
  serviceId,
  entryId,
  direction
}, repository = queueEntryRepository) {
  const selectedServiceId = validatePositiveInteger(
    serviceId,
    "Service ID"
  );

  if (direction !== "up" && direction !== "down") {
    throw new HttpError(
      400,
      "direction must be 'up' or 'down'."
    );
  }

  await getService(selectedServiceId, repository);

  const queue = await activeQueueForService(
    selectedServiceId,
    repository
  );

  const index = queue.findIndex(function (entry) {
    return String(entry.id) === String(entryId);
  });

  if (index === -1) {
    throw new HttpError(
      404,
      "Active queue entry was not found."
    );
  }

  const targetIndex =
    direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= queue.length) {
    throw new HttpError(
      409,
      "Entry cannot move further in that direction."
    );
  }

  const current = queue[index];
  const target = queue[targetIndex];

  await repository.swapEntryPositions(
    current.queueEntryId,
    current.position,
    target.queueEntryId,
    target.position
  );

  return viewQueue(selectedServiceId, repository);
}

async function adminRemoveEntry({
  serviceId,
  entryId
}, repository = queueEntryRepository) {
  const selectedServiceId = validatePositiveInteger(
    serviceId,
    "Service ID"
  );

  const service = await getService(
    selectedServiceId,
    repository
  );

  const queue = await activeQueueForService(
    selectedServiceId,
    repository
  );

  const entry = queue.find(function (item) {
    return String(item.id) === String(entryId);
  });

  if (!entry) {
    throw new HttpError(
      404,
      "Active queue entry was not found."
    );
  }

  const updatedEntry = await repository.updateEntryStatus(
    entry.queueEntryId,
    "canceled"
  );

  await repository.resequenceQueue(entry.queueId);

  await addHistory(
    updatedEntry,
    service,
    "left",
    updatedEntry.leftAt,
    repository
  );

  await addNotification(
    updatedEntry.userId,
    "QUEUE_LEFT",
    `You were removed from the ${service.name} queue by an administrator.`,
    updatedEntry.id,
    repository
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

  await addHistory(
    updatedEntry,
    service,
    "served",
    updatedEntry.servedAt,
    repository
  );

  const notification = await addNotification(
    updatedEntry.userId,
    "SERVED",
    `You are now being served for ${service.name}.`,
    updatedEntry.id,
    repository
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

async function getUserNotifications(
  userId,
  repository = queueEntryRepository
) {
  const selectedUserId =
    validatePositiveInteger(
      userId,
      "User ID"
    );

  if (!shouldUseDatabaseActivity(repository)) {
    return getTestActivity(repository)
      .notifications
      .filter(
        function (item) {
          return item.userId === selectedUserId;
        }
      );
  }

  const records =
    await activityRepository
      .findNotificationsByUserId(selectedUserId);

  return records;
}

async function getUserHistory(
  userId,
  repository = queueEntryRepository
) {
  const selectedUserId =
    validatePositiveInteger(
      userId,
      "User ID"
    );

  if (!shouldUseDatabaseActivity(repository)) {
    return getTestActivity(repository)
      .history
      .filter(
        function (item) {
          return item.userId === selectedUserId;
        }
      );
  }

  const records =
    await activityRepository
      .findHistoryByUserId(selectedUserId);

  return records;
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
  moveQueueEntry,
  adminRemoveEntry,
  estimateWait,
  getUserStatus,
  listServices,
  getUserNotifications,
  getUserHistory
};
