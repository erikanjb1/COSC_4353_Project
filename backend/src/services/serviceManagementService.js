const crypto = require("node:crypto");

const {
  services,
  queueEntries
} = require("../data/store");

const HttpError = require(
  "../utils/httpError"
);

const PRIORITY_WEIGHT = Object.freeze({
  low: 1,
  normal: 2,
  high: 3
});

const SERVICE_NAME_MIN_LENGTH = 2;
const SERVICE_NAME_MAX_LENGTH = 100;
const SERVICE_DESCRIPTION_MIN_LENGTH = 5;
const SERVICE_DESCRIPTION_MAX_LENGTH = 300;
const SERVICE_EXPECTED_DURATION_MIN = 1;
const SERVICE_EXPECTED_DURATION_MAX = 240;

function validateServiceInput(input) {
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
    typeof input.name !== "string" ||
    input.name.trim() === ""
  ) {
    errors.push(
      "name is required and must be a non-empty string."
    );
  } else if (
    input.name.trim().length <
      SERVICE_NAME_MIN_LENGTH ||
    input.name.trim().length >
      SERVICE_NAME_MAX_LENGTH
  ) {
    errors.push(
      `name must contain between ${SERVICE_NAME_MIN_LENGTH} and ${SERVICE_NAME_MAX_LENGTH} characters.`
    );
  }

  if (
    typeof input.description !== "string" ||
    input.description.trim() === ""
  ) {
    errors.push(
      "description is required and must be a non-empty string."
    );
  } else if (
    input.description.trim().length <
      SERVICE_DESCRIPTION_MIN_LENGTH ||
    input.description.trim().length >
      SERVICE_DESCRIPTION_MAX_LENGTH
  ) {
    errors.push(
      `description must contain between ${SERVICE_DESCRIPTION_MIN_LENGTH} and ${SERVICE_DESCRIPTION_MAX_LENGTH} characters.`
    );
  }

  if (
    typeof input.expectedDuration !== "number" ||
    !Number.isInteger(input.expectedDuration)
  ) {
    errors.push(
      "expectedDuration is required and must be an integer."
    );
  } else if (
    input.expectedDuration <
      SERVICE_EXPECTED_DURATION_MIN ||
    input.expectedDuration >
      SERVICE_EXPECTED_DURATION_MAX
  ) {
    errors.push(
      `expectedDuration must be between ${SERVICE_EXPECTED_DURATION_MIN} and ${SERVICE_EXPECTED_DURATION_MAX} minutes.`
    );
  }

  if (
    typeof input.priorityLevel !== "string" ||
    !Object.hasOwn(
      PRIORITY_WEIGHT,
      input.priorityLevel
    )
  ) {
    errors.push(
      "priorityLevel must be low, normal, or high."
    );
  }

  if (typeof input.isOpen !== "boolean") {
    errors.push(
      "isOpen is required and must be a boolean."
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

function findServiceByName(
  name,
  excludeServiceId
) {
  const normalizedName =
    name.trim().toLowerCase();

  return services.find(function (service) {
    return (
      service.id !== excludeServiceId &&
      service.name.trim().toLowerCase() ===
        normalizedName
    );
  });
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

function countWaiting(serviceId) {
  return queueEntries.filter(
    function (entry) {
      return (
        entry.serviceId === serviceId &&
        entry.status === "waiting"
      );
    }
  ).length;
}

function createService({
  name,
  description,
  expectedDuration,
  priorityLevel,
  isOpen
}) {
  validateServiceInput({
    name,
    description,
    expectedDuration,
    priorityLevel,
    isOpen
  });

  if (findServiceByName(name)) {
    throw new HttpError(
      409,
      "A service with this name already exists."
    );
  }

  const service = {
    id: `service-${crypto.randomUUID()}`,
    name: name.trim(),
    description: description.trim(),
    expectedDuration: expectedDuration,
    priorityLevel: priorityLevel,
    isOpen: isOpen
  };

  services.push(service);

  return service;
}

function updateService(
  serviceId,
  {
    name,
    description,
    expectedDuration,
    priorityLevel,
    isOpen
  }
) {
  const service = getService(serviceId);

  validateServiceInput({
    name,
    description,
    expectedDuration,
    priorityLevel,
    isOpen
  });

  if (findServiceByName(name, serviceId)) {
    throw new HttpError(
      409,
      "A service with this name already exists."
    );
  }

  service.name = name.trim();
  service.description = description.trim();
  service.expectedDuration = expectedDuration;
  service.priorityLevel = priorityLevel;
  service.isOpen = isOpen;

  return service;
}

function deleteService(serviceId) {
  const service = getService(serviceId);

  const hasWaitingUsers = queueEntries.some(
    function (entry) {
      return (
        entry.serviceId === serviceId &&
        entry.status === "waiting"
      );
    }
  );

  if (hasWaitingUsers) {
    throw new HttpError(
      409,
      "This service cannot be deleted while users are waiting in its queue."
    );
  }

  const index = services.findIndex(
    function (item) {
      return item.id === serviceId;
    }
  );

  services.splice(index, 1);

  return service;
}

function listServices() {
  return services.map(
    function (service) {
      return {
        ...service,
        queueLength: countWaiting(
          service.id
        )
      };
    }
  );
}

module.exports = {
  PRIORITY_WEIGHT,
  validateServiceInput,
  getService,
  createService,
  updateService,
  deleteService,
  listServices
};