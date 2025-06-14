import { Server } from '@hocuspocus/server'
import mongoose from 'mongoose'
import { Room } from './src/models/Room.js' // Adjust path as needed
import dotenv from 'dotenv'

dotenv.config()

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}CodeHaven`)
    console.log('✅ MongoDB connected for Hocuspocus server')
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    process.exit(1)
  }
}

// Track active connections per room
const roomConnections = new Map() // roomId -> Set of connection IDs

const server = Server.configure({
  port: 1234,
  name: 'collab-server',
  debounce: 200,

  async onConnect(data) {
    const roomId = data.documentName
    const connectionId = data.connection.id || data.connection.readyState

    console.log(`📥 Connection attempt to room: ${roomId}`)

    try {
      // Check if room exists in database
      const room = await Room.findActiveRoom(roomId)
      if (!room) {
        console.log(`❌ Room ${roomId} not found in database`)
        throw new Error('Room not found')
      }

      // Get current active connections for this room
      const currentConnections = roomConnections.get(roomId) || new Set()

      // Check if room is full (max 2 users)
      if (currentConnections.size >= 2) {
        console.log(`❌ Room ${roomId} is full (${currentConnections.size}/2 users)`)
        throw new Error('Room is full (max 2 users)')
      }

      // Add this connection to the room
      currentConnections.add(connectionId)
      roomConnections.set(roomId, currentConnections)

      console.log(`✅ User connected to room ${roomId}. Active connections: ${currentConnections.size}/2`)

      // Update room activity
      room.lastActivity = new Date()
      await room.save()

    } catch (error) {
      console.error(`❌ Connection rejected for room ${roomId}:`, error.message)
      throw error
    }
  },

  async onDisconnect(data) {
    const roomId = data.documentName
    const connectionId = data.connection.id || data.connection.readyState

    console.log(`📤 Disconnection from room: ${roomId}`)

    try {
      // Remove connection from tracking
      const currentConnections = roomConnections.get(roomId)
      if (currentConnections) {
        currentConnections.delete(connectionId)

        if (currentConnections.size === 0) {
          // No more connections, remove room from tracking
          roomConnections.delete(roomId)
          console.log(`🗑️ Room ${roomId} removed from active tracking`)

          // Optional: Mark room as inactive if no connections
          const room = await Room.findActiveRoom(roomId)
          if (room) {
            const activeUsers = room.users.filter(user => user.isActive)
            if (activeUsers.length === 0) {
              room.isActive = false
              await room.save()
              console.log(`🔒 Room ${roomId} marked as inactive`)
            }
          }
        } else {
          roomConnections.set(roomId, currentConnections)
          console.log(`👋 User disconnected from room ${roomId}. Remaining connections: ${currentConnections.size}/2`)
        }
      }

      // Update room activity
      const room = await Room.findActiveRoom(roomId)
      if (room) {
        room.lastActivity = new Date()
        await room.save()
      }

    } catch (error) {
      console.error(`❌ Error handling disconnection for room ${roomId}:`, error.message)
    }
  },

  async onChange(data) {
    const roomId = data.documentName

    try {
      // Update room activity on content change
      const room = await Room.findActiveRoom(roomId)
      if (room) {
        room.lastActivity = new Date()
        // Optionally store the content
        if (data.document) {
          const content = data.document.getText('codemirror').toString()
          room.codeContent = content
        }
        await room.save()
      }
    } catch (error) {
      console.error(`❌ Error updating room ${roomId} on change:`, error.message)
    }
  }
})

// Helper function to get room connection count
export const getRoomConnectionCount = (roomId) => {
  const connections = roomConnections.get(roomId)
  return connections ? connections.size : 0
}

// Helper function to check if room has space
export const hasRoomSpace = (roomId) => {
  const connections = roomConnections.get(roomId)
  return !connections || connections.size < 2
}

// Clean up old rooms periodically
setInterval(async () => {
  try {
    const result = await Room.cleanupOldRooms()
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} old rooms`)
    }
  } catch (error) {
    console.error('❌ Error cleaning up old rooms:', error)
  }
}, 60 * 60 * 1000) // Every hour

// Start the server
const startServer = async () => {
  await connectDB()

  server.listen().then(() => {
    console.log('✅ Hocuspocus (Yjs) WebSocket server running on ws://localhost:1234')
    console.log('🔧 Room management and connection tracking enabled')
  }).catch((error) => {
    console.error('❌ Failed to start Hocuspocus server:', error)
    process.exit(1)
  })
}

startServer()