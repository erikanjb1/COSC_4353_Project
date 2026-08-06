'use strict';

const activityService = require('../services/activityService');

function createActivityController(serviceLayer = activityService) {
  return {
    async listNotifications(req, res, next) {
      try {
        const notifications =
          await serviceLayer.listNotificationsForUser(
            req.user.id
          );

        res.status(200).json({
          success: true,
          data: notifications
        });
      } catch (error) {
        next(error);
      }
    },

    async createNotification(req, res, next) {
      try {
        const notification =
          await serviceLayer.createNotification({
            userId: req.body.userId,
            message: req.body.message,
            status: req.body.status
          });

        res.status(201).json({
          success: true,
          data: notification
        });
      } catch (error) {
        next(error);
      }
    },

    async markNotificationViewed(req, res, next) {
      try {
        const notification =
          await serviceLayer.markNotificationViewed(
            req.params.notificationId
          );

        res.status(200).json({
          success: true,
          data: notification
        });
      } catch (error) {
        next(error);
      }
    },

    async listHistory(req, res, next) {
      try {
        const history =
          await serviceLayer.listHistoryForUser(
            req.user.id
          );

        res.status(200).json({
          success: true,
          data: history
        });
      } catch (error) {
        next(error);
      }
    },

    async createHistory(req, res, next) {
      try {
        const history =
          await serviceLayer.createHistory({
            queueEntryId: req.body.queueEntryId,
            userId: req.body.userId,
            serviceId: req.body.serviceId,
            serviceName: req.body.serviceName,
            joinedAt: req.body.joinedAt,
            completedAt: req.body.completedAt,
            outcome: req.body.outcome
          });

        res.status(201).json({
          success: true,
          data: history
        });
      } catch (error) {
        next(error);
      }
    }
  };
}

module.exports = {
  ...createActivityController(),
  createActivityController
};
