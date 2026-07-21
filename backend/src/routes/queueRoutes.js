const express = require("express");

const controller = require(
  "../controllers/queueController"
);

const {
  requireAuth,
  requireAdministrator
} = require("../middleware/auth");

const router = express.Router();

router.get(
  "/services",
  requireAuth,
  controller.listServices
);

router.get(
  "/notifications",
  requireAuth,
  controller.getNotifications
);

router.get(
  "/history",
  requireAuth,
  controller.getHistory
);

router.post(
  "/join",
  requireAuth,
  controller.joinQueue
);

router.delete(
  "/:serviceId/leave",
  requireAuth,
  controller.leaveQueue
);

router.get(
  "/:serviceId/status",
  requireAuth,
  controller.getStatus
);

router.get(
  "/:serviceId",
  requireAuth,
  requireAdministrator,
  controller.viewQueue
);

router.post(
  "/:serviceId/serve-next",
  requireAuth,
  requireAdministrator,
  controller.serveNext
);

module.exports = router;