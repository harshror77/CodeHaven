import express from 'express';
import {
    createRoom,
    checkRoom,
    joinRoom,
    leaveRoom,
    getRoomInfo,
    getAllActiveRooms,
    getUserRooms,
    deleteRoom
} from '../controllers/roomController.js';

const router = express.Router();

// Create a new room
router.post('/create', createRoom);

// Check if room exists and is available
router.get('/:roomId/check', checkRoom);

// Join a room
router.post('/:roomId/join', joinRoom);

// Leave a room
router.post('/:roomId/leave', leaveRoom);

// Get room information
router.get('/:roomId/info', getRoomInfo);

// Get rooms for a specific user
router.route('/getUserRoom/:userId').get(getUserRooms)

//delete a room
router.route('/:roomId/delete').delete(deleteRoom);
// Admin: Get all active rooms
router.get('/admin/active', getAllActiveRooms);

export default router;