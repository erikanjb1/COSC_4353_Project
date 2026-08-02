'use strict';

const express = require('express');
const controller = require('../controllers/activeQueueController');
const auth = require('../middleware/auth');

const router = express.Router();

function missingMiddleware(exportName) {
  return (_req, _res, next) => {
    const error = new Error(
      `The authentication middleware must export ${exportName}.`
    );
    error.status = 500;
    error.statusCode = 500;
    next(error);
  };
}

const requireAuth =
  auth.requireAuth ||
  auth.authenticate ||
  auth.authenticateToken ||
  missingMiddleware('requireAuth');

const requireAdministrator =
  auth.requireAdministrator ||
  auth.requireAdmin ||
  auth.isAdmin ||
  missingMiddleware('requireAdministrator');

// Users and administrators may retrieve queue information.
router.get('/', requireAuth, controller.listQueues);
router.get(
  '/service/:serviceId/open',
  requireAuth,
  controller.getOpenQueueForService
);
router.get('/:queueId', requireAuth, controller.getQueue);

// Only administrators may create a queue or change its status.
router.post(
  '/',
  requireAuth,
  requireAdministrator,
  controller.createQueue
);
router.patch(
  '/:queueId/status',
  requireAuth,
  requireAdministrator,
  controller.updateQueueStatus
);

module.exports = router;