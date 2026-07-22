const express = require("express");

const controller = require(
  "../controllers/serviceManagementController"
);

const {
  requireAuth,
  requireAdministrator
} = require("../middleware/auth");

const router = express.Router();

router.post(
  "/services",
  requireAuth,
  requireAdministrator,
  controller.createService
);

router.put(
  "/services/:serviceId",
  requireAuth,
  requireAdministrator,
  controller.updateService
);

router.delete(
  "/services/:serviceId",
  requireAuth,
  requireAdministrator,
  controller.deleteService
);

module.exports = router;