import { Room } from '../models/Room.js';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
class RoomService {
    constructor() {
        this.activeConnections = new Map(); // roomId -> Set of connection IDs
        this.userConnections = new Map(); // userId -> roomId
        this.roomLocks = new Map(); // roomId -> Promise (for preventing race conditions)

        // Clean up old rooms every hour
        setInterval(() => {
            this.cleanupOldRooms();
        }, 60 * 60 * 1000);
    }

    // Generate unique room ID
    generateRoomId() {
        const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    // Create a new room with proper concurrency control
    async createRoom(creatorId, userName = 'Anonymous') {
        let roomId;
        let attempts = 0;
        const maxAttempts = 20; // Increased attempts

        // Ensure unique room ID with database check
        do {
            roomId = this.generateRoomId();
            attempts++;

            // Check both database and active connections
            const existingRoom = await Room.findActiveRoom(roomId);
            const hasActiveConnections = this.activeConnections.has(roomId);

            if (!existingRoom && !hasActiveConnections) {
                // Double-check by trying to create the room
                try {
                    const room = new Room({
                        roomId,
                        createdBy: creatorId,
                        users: [{
                            userId: creatorId,
                            userName,
                            joinedAt: new Date(),
                            isActive: true
                        }],
                        isActive: true
                    });

                    await room.save();

                    // Track connection
                    this.activeConnections.set(roomId, new Set([creatorId]));
                    this.userConnections.set(creatorId, roomId);

                    console.log(`✅ Room created successfully: ${roomId} by ${creatorId}`);
                    return room;

                } catch (error) {
                    // If duplicate key error, try again
                    if (error.code === 11000) {
                        console.log(`⚠️ Duplicate room ID detected: ${roomId}, trying again...`);
                        continue;
                    }
                    throw error;
                }
            }
        } while (attempts < maxAttempts);

        throw new Error('Unable to generate unique room ID after multiple attempts');
    }

    // Join existing room with proper locking
    async joinRoom(roomId, userId, userName = 'Anonymous') {
        // Create a lock for this room to prevent race conditions
        const lockKey = `join_${roomId}`;
        if (this.roomLocks.has(lockKey)) {
            await this.roomLocks.get(lockKey);
        }

        const lockPromise = this._joinRoomInternal(roomId, userId, userName);
        this.roomLocks.set(lockKey, lockPromise);

        try {
            const result = await lockPromise;
            return result;
        } finally {
            this.roomLocks.delete(lockKey);
        }
    }

    async _joinRoomInternal(roomId, userId, userName) {
        try {
            // Check if room exists and is active
            const room = await Room.findActiveRoom(roomId);
            if (!room) {
                return {
                    success: false,
                    error: 'Room not found or inactive'
                };
            }

            // Check current active connections (real-time check)
            const currentConnections = this.activeConnections.get(roomId) || new Set();

            // Count active users in database
            const activeUsersInDb = room.users.filter(user => user.isActive).length;

            // Use the higher count for safety
            const maxActiveUsers = Math.max(currentConnections.size, activeUsersInDb);

            if (maxActiveUsers >= room.maxUsers && !currentConnections.has(userId)) {
                return {
                    success: false,
                    error: 'Room is full (maximum 2 users)'
                };
            }

            // Check if user is already in another room
            const existingRoom = this.userConnections.get(userId);
            if (existingRoom && existingRoom !== roomId) {
                await this.leaveRoom(existingRoom, userId);
            }

            // Add user to room in database
            const updatedRoom = await Room.addUserToRoom(roomId, userId, userName);

            // Track connection
            currentConnections.add(userId);
            this.activeConnections.set(roomId, currentConnections);
            this.userConnections.set(userId, roomId);

            console.log(`✅ User ${userId} joined room ${roomId}. Active users: ${currentConnections.size}/2`);

            return {
                success: true,
                room: updatedRoom,
                activeUsers: currentConnections.size
            };

        } catch (error) {
            console.error(`❌ Error joining room ${roomId}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Leave room
    async leaveRoom(roomId, userId) {
        try {
            // Remove from active connections
            const connections = this.activeConnections.get(roomId);
            if (connections) {
                connections.delete(userId);
                if (connections.size === 0) {
                    this.activeConnections.delete(roomId);
                    console.log(`🗑️ Room ${roomId} removed from active connections`);
                } else {
                    this.activeConnections.set(roomId, connections);
                }
            }
            this.userConnections.delete(userId);

            // Update database
            await Room.removeUserFromRoom(roomId, userId);

            console.log(`👋 User ${userId} left room ${roomId}`);
            return { success: true };
        } catch (error) {
            console.error('❌ Error leaving room:', error);
            return { success: false, error: error.message };
        }
    }

    // Get room info
    async getRoomInfo(roomId) {
        try {
            const room = await Room.findActiveRoom(roomId);
            if (!room) {
                return { success: false, error: 'Room not found' };
            }

            const activeConnections = this.activeConnections.get(roomId) || new Set();
            const activeUsers = room.users.filter(user =>
                user.isActive && (activeConnections.has(user.userId) || activeConnections.size === 0)
            );

            return {
                success: true,
                room: {
                    roomId: room.roomId,
                    createdBy: room.createdBy,
                    activeUsers: Math.max(activeConnections.size, activeUsers.length),
                    maxUsers: room.maxUsers,
                    users: activeUsers.map(user => ({
                        userId: user.userId,
                        userName: user.userName,
                        joinedAt: user.joinedAt
                    })),
                    // language: room.language,
                    lastActivity: room.lastActivity,
                    hasSpace: activeConnections.size < room.maxUsers
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Check if room is available for joining
    async isRoomAvailable(roomId) {
        try {
            const room = await Room.findActiveRoom(roomId);
            if (!room) {
                return { available: false, reason: 'Room not found' };
            }

            const currentConnections = this.activeConnections.get(roomId) || new Set();
            const activeUsersInDb = room.users.filter(user => user.isActive).length;
            const maxActiveUsers = Math.max(currentConnections.size, activeUsersInDb);

            if (maxActiveUsers >= room.maxUsers) {
                return { available: false, reason: 'Room is full' };
            }

            return {
                available: true,
                activeUsers: maxActiveUsers,
                maxUsers: room.maxUsers
            };
        } catch (error) {
            return { available: false, reason: 'Error checking room availability' };
        }
    }

    // Update room code content
    // async updateRoomCode(roomId, codeContent, language) {
    //     try {
    //         const room = await Room.findActiveRoom(roomId);
    //         if (!room) {
    //             throw new Error('Room not found');
    //         }

    //         room.codeContent = codeContent;
    //         room.language = language;
    //         room.lastActivity = new Date();
    //         await room.save();

    //         return { success: true };
    //     } catch (error) {
    //         return { success: false, error: error.message };
    //     }
    // }

    // Get active rooms count
    async getActiveRoomsCount() {
        return await Room.countDocuments({ isActive: true });
    }

    // Clean up old rooms
    async cleanupOldRooms() {
        try {
            const result = await Room.cleanupOldRooms();

            // Also clean up stale connections
            const staleRooms = [];
            for (const [roomId, connections] of this.activeConnections.entries()) {
                const room = await Room.findActiveRoom(roomId);
                if (!room) {
                    staleRooms.push(roomId);
                }
            }

            staleRooms.forEach(roomId => {
                this.activeConnections.delete(roomId);
            });

            if (result.deletedCount > 0 || staleRooms.length > 0) {
                console.log(`🧹 Cleaned up ${result.deletedCount} old rooms and ${staleRooms.length} stale connections`);
            }
        } catch (error) {
            console.error('❌ Error cleaning up old rooms:', error);
        }
    }

    // Handle connection disconnect
    async handleDisconnect(userId) {
        const roomId = this.userConnections.get(userId);
        if (roomId) {
            await this.leaveRoom(roomId, userId);
        }
    }

    // Get all active rooms (for admin purposes)
    async getAllActiveRooms() {
        try {
            const rooms = await Room.find({ isActive: true })
                .select('roomId createdBy users lastActivity')
                .sort({ lastActivity: -1 });

            return rooms.map(room => {
                const activeConnections = this.activeConnections.get(room.roomId) || new Set();
                const activeUsers = room.users.filter(u => u.isActive).length;

                return {
                    roomId: room.roomId,
                    createdBy: room.createdBy,
                    activeUsers: Math.max(activeConnections.size, activeUsers),
                    maxUsers: 2,
                    lastActivity: room.lastActivity,
                    hasSpace: activeConnections.size < 2
                };
            });
        } catch (error) {
            console.error('❌ Error getting active rooms:', error);
            return [];
        }
    }

    // Get connection status for a room
    getConnectionStatus(roomId) {
        const connections = this.activeConnections.get(roomId);
        return {
            connected: connections ? connections.size : 0,
            hasSpace: !connections || connections.size < 2
        };
    }
    async getUserRoom(userId) {
        // console.log("getUserRoom called for:", userId);

        const userrooms = await Room.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId)
                }
            }
        ]);

        // console.log("userrooms:", userrooms);
        return userrooms;
    }

    async deleteRoom(roomId) {
        console.log('Deleting room:', roomId);
        try {
            const room = await Room.findOneAndDelete(
                { roomId: roomId }
            );
            console.log('Room deleted:', room);
            if (!room) {
                return { success: false, message: 'Room not found' };
            }
            return { success: true, message: 'Room deleted successfully' };
        } catch (error) {
            console.error('Error deleting room:', error);
            return { success: false, message: 'Failed to delete room' };
        }
    }
}




export const roomService = new RoomService();