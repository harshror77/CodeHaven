import { saveMessage } from '../controllers/chatController.js';

// Store active users in rooms
const activeRooms = new Map();

export const handleChatSocket = (io) => {

    io.on('connection', (socket) => {
        console.log("Socket.io connected ", socket.id);

        // User joins a room
        socket.on('join-room', async ({ roomId, userId, username }) => {
            try {
                // Leave any previous rooms
                const previousRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
                previousRooms.forEach(room => {
                    socket.leave(room);
                    updateRoomUsers(room, socket.id, 'leave');
                });

                // Join the new room
                socket.join(roomId);
                socket.roomId = roomId;
                socket.userId = userId;
                socket.username = username;

                // Update active users in room
                updateRoomUsers(roomId, socket.id, 'join', { userId, username });

                // Get current users in room
                const roomUsers = getRoomUsers(roomId);

                // Send current room info to the user
                socket.emit('room-joined', {
                    roomId,
                    roomUsers: roomUsers.length,
                    users: roomUsers
                });

                // No join notifications or system messages
                console.log(`User ${username} joined room ${roomId}`);
            } catch (error) {
                console.error('Error joining room:', error);
                socket.emit('error', { message: 'Failed to join room' });
            }
        });

        // Handle sending messages
        socket.on('send-message', async ({ roomId, userId, message }) => {
            try {
                if (!roomId || !userId || !message.trim()) {
                    socket.emit('error', { message: 'Invalid message data' });
                    return;
                }

                // Check if user is in the room
                if (!socket.rooms.has(roomId)) {
                    socket.emit('error', { message: 'You are not in this room' });
                    return;
                }

                // Save message to database
                const savedMessage = await saveMessage(roomId, userId, message.trim());

                // Broadcast message to all users in the room
                io.to(roomId).emit('new-message', savedMessage);

                console.log(`Message sent in room ${roomId} by user ${userId}`);
            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Handle typing indicators
        socket.on('typing-start', ({ roomId, userId, username }) => {
            socket.to(roomId).emit('user-typing', { userId, username, isTyping: true });
        });

        socket.on('typing-stop', ({ roomId, userId, username }) => {
            socket.to(roomId).emit('user-typing', { userId, username, isTyping: false });
        });

        // Handle user leaving room
        socket.on('leave-room', ({ roomId, userId, username }) => {
            handleUserLeaving(socket, roomId, userId, username);
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log('Socket.io disconnected', socket.id);

            if (socket.roomId && socket.userId && socket.username) {
                handleUserLeaving(socket, socket.roomId, socket.userId, socket.username);
            }
        });
    });
};

// Helper function to handle user leaving
const handleUserLeaving = async (socket, roomId, userId, username) => {
    try {
        // Update active users
        updateRoomUsers(roomId, socket.id, 'leave');

        // Get remaining users
        const roomUsers = getRoomUsers(roomId);

        // Notify others in room about user count change
        socket.to(roomId).emit('user-left', {
            userId,
            username,
            roomUsers: roomUsers.length
        });

        // No leave system messages

        // Leave the room
        socket.leave(roomId);

        console.log(`User ${username} left room ${roomId}`);
    } catch (error) {
        console.error('Error handling user leaving:', error);
    }
};

// Helper function to update room users
const updateRoomUsers = (roomId, socketId, action, userInfo = null) => {
    if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Map());
    }

    const roomUsers = activeRooms.get(roomId);

    if (action === 'join' && userInfo) {
        roomUsers.set(socketId, userInfo);
    } else if (action === 'leave') {
        roomUsers.delete(socketId);

        // Clean up empty rooms
        if (roomUsers.size === 0) {
            activeRooms.delete(roomId);
        }
    }
};

// Helper function to get room users
const getRoomUsers = (roomId) => {
    if (!activeRooms.has(roomId)) {
        return [];
    }

    return Array.from(activeRooms.get(roomId).values());
};