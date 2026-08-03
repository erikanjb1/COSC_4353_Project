'use strict';

const serviceManagementService = require(
  "../services/serviceManagementService"
);

async function listServices(_req, res, next) {
  try {
    const services = await serviceManagementService.listServices();

    res.status(200).json({
      success: true,
      data: services
    });
  } catch (error) {
    next(error);
  }
}

async function createService(req, res, next) {
  try {
    const result = await serviceManagementService.createService({
      name: req.body.name,
      description: req.body.description,
      expectedDuration: req.body.expectedDuration,
      priorityLevel: req.body.priorityLevel,
      isOpen: req.body.isOpen
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function updateService(req, res, next) {
  try {
    const result = await serviceManagementService.updateService(
      req.params.serviceId,
      {
        name: req.body.name,
        description: req.body.description,
        expectedDuration: req.body.expectedDuration,
        priorityLevel: req.body.priorityLevel,
        isOpen: req.body.isOpen
      }
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function deleteService(req, res, next) {
  try {
    const result = await serviceManagementService.deleteService(
      req.params.serviceId
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listServices,
  createService,
  updateService,
  deleteService
};