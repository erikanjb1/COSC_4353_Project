const queueService = require(
    "../services/queueService"
  );
  
  function joinQueue(req, res, next) {
    try {
      const result = queueService.joinQueue({
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
  
  function leaveQueue(req, res, next) {
    try {
      const result = queueService.leaveQueue({
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
  
  function viewQueue(req, res, next) {
    try {
      const result = queueService.viewQueue(
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
  
  function serveNext(req, res, next) {
    try {
      const result = queueService.serveNext(
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
  
  function getStatus(req, res, next) {
    try {
      const result =
        queueService.getUserStatus({
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
  
  function listServices(_req, res, next) {
    try {
      res.status(200).json({
        success: true,
        data: queueService.listServices()
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