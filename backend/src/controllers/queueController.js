const queueService = require(
    "../services/queueService"
  );
  
  async function joinQueue(req, res, next) {
    try {
      const result = await queueService.joinQueue({
        userId: req.user.id,
        userName: req.body.userName,
        serviceId: req.body.serviceId,
        priority: req.body.priority
      });
  
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async function leaveQueue(req, res, next) {
    try {
      const result = await queueService.leaveQueue({
        userId: req.user.id,
        serviceId: req.params.serviceId
      });
  
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async function viewQueue(req, res, next) {
    try {
      const result = await queueService.viewQueue(
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
  
  async function serveNext(req, res, next) {
    try {
      const result = await queueService.serveNext(
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
  
  async function getStatus(req, res, next) {
    try {
      const result =
        await queueService.getUserStatus({
          userId: req.user.id,
          serviceId: req.params.serviceId
        });
  
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async function listServices(_req, res, next) {
    try {
      res.status(200).json({
        success: true,
        data: await queueService.listServices()
      });
    } catch (error) {
      next(error);
    }
  }
  
  function getNotifications(req, res, next) {
    try {
      res.status(200).json({
        success: true,
        data:
          queueService.getUserNotifications(
            req.user.id
          )
      });
    } catch (error) {
      next(error);
    }
  }
  
  function getHistory(req, res, next) {
    try {
      res.status(200).json({
        success: true,
        data:
          queueService.getUserHistory(
            req.user.id
          )
      });
    } catch (error) {
      next(error);
    }
  }
  
  module.exports = {
    joinQueue,
    leaveQueue,
    viewQueue,
    serveNext,
    getStatus,
    listServices,
    getNotifications,
    getHistory
  };
