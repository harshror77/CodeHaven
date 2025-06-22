import express from 'express';
import { getChatMessages, getMessageCount } from '../controllers/chatController.js';

const router = express.Router();

// Get chat messages for a room
router.get('/:roomId/messages', getChatMessages);

// Get message count for a room
router.get('/:roomId/count', getMessageCount);

export default router;