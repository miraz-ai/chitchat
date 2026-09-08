import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { ConnectionService } from '../services/connectionService.js';

export const createConnectionRouter = (io) => {
  const router = Router();

  /**
   * POST /api/connections/request
   */
  router.post('/request', authenticateToken, async (req, res, next) => {
    try {
      const { receiverId } = req.body;
      const connection = await ConnectionService.sendRequest(req.user.id, receiverId);

      // Emit real-time notification to recipient room if online
      if (io) {
        io.to(`user:${connection.receiver_id}`).emit('connection:new_request', {
          id: connection.id,
          requester_id: req.user.id
        });
      }

      res.status(201).json(connection);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/connections/requests
   * Pending incoming & outgoing requests
   */
  router.get('/requests', authenticateToken, async (req, res, next) => {
    try {
      const requests = await ConnectionService.getRequests(req.user.id);
      res.json(requests);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/connections
   * Accepted active connections list
   */
  router.get('/', authenticateToken, async (req, res, next) => {
    try {
      const connections = await ConnectionService.getConnections(req.user.id);
      res.json(connections);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/connections/:id/accept
   */
  router.post('/:id/accept', authenticateToken, async (req, res, next) => {
    try {
      const connection = await ConnectionService.acceptRequest(req.params.id, req.user.id);

      // Emit real-time notification to requester
      if (io) {
        io.to(`user:${connection.requester_id}`).emit('connection:accepted', {
          connectionId: connection.id,
          receiver_id: req.user.id
        });
      }

      res.json({ success: true, connection });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/connections/:id/reject
   */
  router.post('/:id/reject', authenticateToken, async (req, res, next) => {
    try {
      const result = await ConnectionService.rejectRequest(req.params.id, req.user.id);
      if (io) {
        io.emit('connection:update', { connectionId: req.params.id, status: 'rejected' });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/connections/:id/cancel
   * Cancel outgoing pending request
   */
  router.post('/:id/cancel', authenticateToken, async (req, res, next) => {
    try {
      const result = await ConnectionService.cancelRequest(req.params.id, req.user.id);
      if (io) {
        io.emit('connection:update', { connectionId: req.params.id, status: 'cancelled' });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /**
   * DELETE /api/connections/:id
   * Remove connection or cancel request
   */
  router.delete('/:id', authenticateToken, async (req, res, next) => {
    try {
      const result = await ConnectionService.deleteConnection(req.params.id, req.user.id);
      if (io) {
        io.emit('connection:update', { connectionId: req.params.id, status: 'removed' });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
};

export default createConnectionRouter;
