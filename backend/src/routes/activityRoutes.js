'use strict';

const express = require('express');
const controller = require('../controllers/activityController');
const {
  requireAuth,
  requireAdministrator
} = require('../middleware/auth');

const router = express.Router();

router.get(
  '/notifications',
  requireAuth,
  controller.listNotifications
);

router.post(
  '/notifications',
  requireAuth,
  requireAdministrator,
  controller.createNotification
);

router.patch(
  '/notifications/:notificationId/viewed',
  requireAuth,
  controller.markNotificationViewed
);

router.get(
  '/history',
  requireAuth,
  controller.listHistory
);

router.post(
  '/history',
  requireAuth,
  requireAdministrator,
  controller.createHistory
);

module.exports = router;
