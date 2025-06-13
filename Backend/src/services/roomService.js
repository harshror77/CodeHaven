import { Room } from '../models/Room.js';
import { v4 as uuidv4 } from 'uuid';

class RoomService {
    constructor() {
        this.activeConnections = new Map(); // roomId -> Set of connection IDs
        this.userConnections = new Map(); // userId -> connectionId

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

    // Create a new room
    async createRoom(creatorId, userName = 'Anonymous') {
        let roomId;
        let attempts = 0;
        const maxAttempts = 10;

        // Ensure unique room ID
        do {
            roomId = this.generateRoomId();
            attempts++;
        } while (await Room.findActiveRoom(roomId) && attempts < maxAttempts);

        if (attempts >= maxAttempts) {
            throw new Error('Unable to generate unique room ID');
        }

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

        return room;
    }

    // Join existing room
    async joinRoom(roomId, userId, userName = 'Anonymous') {
        try {
            // Check if room exists and is active
            const room = await Room.findActiveRoom(roomId);
            if (!room) {
                throw new Error('Room not found or inactive');
            }

            // Check current active connections (real-time check)
            const currentConnections = this.activeConnections.get(roomId) || new Set();
            if (currentConnections.size >= room.maxUsers) {
                throw new Error('Room is full (maximum 2 users)');
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

            return {
                success: true,
                room: updatedRoom,
                activeUsers: Array.from(currentConnections).length
            };

        } catch (error) {
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
                }
            }
            this.userConnections.delete(userId);

            // Update database
            await Room.removeUserFromRoom(roomId, userId);

            return { success: true };
        } catch (error) {
            console.error('Error leaving room:', error);
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
                activeConnections.has(user.userId) && user.isActive
            );

            return {
                success: true,
                room: {
                    roomId: room.roomId,
                    createdBy: room.createdBy,
                    activeUsers: activeUsers.length,
                    maxUsers: room.maxUsers,
                    users: activeUsers.map(user => ({
                        userId: user.userId,
                        userName: user.userName,
                        joinedAt: user.joinedAt
                    })),
                    language: room.language,
                    lastActivity: room.lastActivity
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Check if room is available for joining
    async isRoomAvailable(roomId) {
        const room = await Room.findActiveRoom(roomId);
        if (!room) {
            return { available: false, reason: 'Room not found' };
        }

        const currentConnections = this.activeConnections.get(roomId) || new Set();
        if (currentConnections.size >= room.maxUsers) {
            return { available: false, reason: 'Room is full' };
        }

        return { available: true };
    }

    // Update room code content
    async updateRoomCode(roomId, codeContent, language) {
        try {
            const room = await Room.findActiveRoom(roomId);
            if (!room) {
                throw new Error('Room not found');
            }

            room.codeContent = codeContent;
            room.language = language;
            await room.save();

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get active rooms count
    async getActiveRoomsCount() {
        return await Room.countDocuments({ isActive: true });
    }

    // Clean up old rooms
    async cleanupOldRooms() {
        try {
            const result = await Room.cleanupOldRooms();
            if (result.deletedCount > 0) {
                console.log(`Cleaned up ${result.deletedCount} old rooms`);
            }
        } catch (error) {
            console.error('Error cleaning up old rooms:', error);
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
                .select('roomId createdBy users.length lastActivity')
                .sort({ lastActivity: -1 });

            return rooms.map(room => ({
                roomId: room.roomId,
                createdBy: room.createdBy,
                activeUsers: room.users.filter(u => u.isActive).length,
                lastActivity: room.lastActivity
            }));
        } catch (error) {
            console.error('Error getting active rooms:', error);
            return [];
        }
    }
}

export const roomService = new RoomService();