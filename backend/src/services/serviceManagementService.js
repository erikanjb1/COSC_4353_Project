'use strict';

const HttpError = require("../utils/httpError");
const serviceRepository = require("../data/serviceRepository");

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

function validateServiceId(serviceId) {
  const parsedId = Number(serviceId);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new HttpError(
      400,
      "Service ID must be a positive integer."
    );
  }

  return parsedId;
}

async function getService(
  serviceId,
  repository = serviceRepository
) {
  const id = validateServiceId(serviceId);
  const service = await repository.findById(id);

  if (!service) {
    throw new HttpError(
      404,
      "Service was not found."
    );
  }

  return service;
}

async function createService(
  {
    name,
    description,
    expectedDuration,
    priorityLevel,
    isOpen
  },
  repository = serviceRepository
) {
  validateServiceInput({
    name,
    description,
    expectedDuration,
    priorityLevel,
    isOpen
  });

  const duplicate = await repository.findByName(
    name.trim()
  );

  if (duplicate) {
    throw new HttpError(
      409,
      "A service with this name already exists."
    );
  }

  return repository.create({
    name: name.trim(),
    description: description.trim(),
    expectedDuration,
    priorityLevel,
    isOpen
  });
}

async function updateService(
  serviceId,
  {
    name,
    description,
    expectedDuration,
    priorityLevel,
    isOpen
  },
  repository = serviceRepository
) {
  const id = validateServiceId(serviceId);

  await getService(id, repository);

  validateServiceInput({
    name,
    description,
    expectedDuration,
    priorityLevel,
    isOpen
  });

  const duplicate = await repository.findByName(
    name.trim(),
    id
  );

  if (duplicate) {
    throw new HttpError(
      409,
      "A service with this name already exists."
    );
  }

  const updated = await repository.update(id, {
    name: name.trim(),
    description: description.trim(),
    expectedDuration,
    priorityLevel,
    isOpen
  });

  if (!updated) {
    throw new HttpError(
      404,
      "Service was not found."
    );
  }

  return updated;
}

async function deleteService(
  serviceId,
  repository = serviceRepository
) {
  const id = validateServiceId(serviceId);
  const service = await getService(id, repository);
  const deleted = await repository.remove(id);

  if (!deleted) {
    throw new HttpError(
      404,
      "Service was not found."
    );
  }

  return service;
}
async function listServices(
  repository = serviceRepository
) {
  return repository.findAll();
}

module.exports = {
  PRIORITY_WEIGHT,
  validateServiceInput,
  validateServiceId,
  getService,
  createService,
  updateService,
  deleteService,
  listServices
};