const serviceManagementService = require(
  "../services/serviceManagementService"
);

function listServices(_req, res, next) {
  try {
    res.status(200).json({
      success: true,
      data:
        serviceManagementService.listServices()
    });
  } catch (error) {
    next(error);
  }
}

function createService(req, res, next) {
  try {
    const result =
      serviceManagementService.createService({
        name: req.body.name,
        description: req.body.description,
        expectedDuration:
          req.body.expectedDuration,
        priorityLevel:
          req.body.priorityLevel,
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

function updateService(req, res, next) {
  try {
    const result =
      serviceManagementService.updateService(
        req.params.serviceId,
        {
          name: req.body.name,
          description: req.body.description,
          expectedDuration:
            req.body.expectedDuration,
          priorityLevel:
            req.body.priorityLevel,
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

function deleteService(req, res, next) {
  try {
    const result =
      serviceManagementService.deleteService(
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