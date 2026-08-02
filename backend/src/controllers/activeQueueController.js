'use strict';

const activeQueueService = require('../services/activeQueueService');

function createActiveQueueController(serviceLayer = activeQueueService) {
  return {
    async listQueues(req, res, next) {
      try {
        const queues = await serviceLayer.listQueues(req.query);
        res.status(200).json({ success: true, data: queues });
      } catch (error) {
        next(error);
      }
    },

    async getQueue(req, res, next) {
      try {
        const queue = await serviceLayer.getQueueById(req.params.queueId);
        res.status(200).json({ success: true, data: queue });
      } catch (error) {
        next(error);
      }
    },

    async getOpenQueueForService(req, res, next) {
      try {
        const queue = await serviceLayer.getOpenQueueByServiceId(
          req.params.serviceId
        );
        res.status(200).json({ success: true, data: queue });
      } catch (error) {
        next(error);
      }
    },

    async createQueue(req, res, next) {
      try {
        const queue = await serviceLayer.createQueue(req.body);
        res.status(201).json({ success: true, data: queue });
      } catch (error) {
        next(error);
      }
    },

    async updateQueueStatus(req, res, next) {
      try {
        const queue = await serviceLayer.updateQueueStatus(
          req.params.queueId,
          req.body
        );
        res.status(200).json({ success: true, data: queue });
      } catch (error) {
        next(error);
      }
    }
  };
}

module.exports = {
  ...createActiveQueueController(),
  createActiveQueueController
};