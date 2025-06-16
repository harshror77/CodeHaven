import { Server } from '@hocuspocus/server'
import mongoose from 'mongoose'
import { Room } from './src/models/Room.js'
import dotenv from 'dotenv'

dotenv.config()

// Track active connections per room
const roomConnections = new Map() // roomId -> Set of WebSocket objects

const server = new Server({
  port: 1234,
  name: 'collab-server',
  debounce: 200,

  // Uncomment and adapt if you need authentication
  // async onAuthenticate({ token }) {
  //   if (token !== 'dummy-token') {
  //     throw new Error('Invalid token')
  //   }
  // },

  async onConnect(data) {
    const roomId = data.documentName
    const ws = data.connection

    console.log(`📥 Connection attempt to room: ${roomId}`)

    try {
      // Verify room exists and is active
      const room = await Room.findActiveRoom(roomId)
      if (!room) {
        console.log(`❌ Room ${roomId} not found in database`)
        throw new Error('Room not found')
      }

      const currentConnections = roomConnections.get(roomId) || new Set()

      // Enforce max 2 users per room
      if (currentConnections.size >= 2) {
        console.log(`❌ Room ${roomId} is full (${currentConnections.size}/2 users)`)
        throw new Error('Room is full (max 2 users)')
      }

      // Track this WebSocket object
      currentConnections.add(ws)
      roomConnections.set(roomId, currentConnections)

      console.log(`✅ User connected to room ${roomId}. Active connections: ${currentConnections.size}/2`)

      // Update lastActivity timestamp in DB
      room.lastActivity = new Date()
      await room.save()

    } catch (error) {
      console.error(`❌ Connection rejected for room ${roomId}:`, error.message)
      throw error
    }
  },

  async onDisconnect(data) {
    const roomId = data.documentName
    const ws = data.connection

    console.log(`📤 Disconnection from room: ${roomId}`)

    try {
      const currentConnections = roomConnections.get(roomId)
      if (currentConnections) {
        currentConnections.delete(ws)

        if (currentConnections.size === 0) {
          // No one left, clean up
          roomConnections.delete(roomId)
          console.log(`🗑️ Room ${roomId} removed from active tracking`)

          // Optionally mark room inactive in DB
          const room = await Room.findActiveRoom(roomId)
          if (room) {
            const activeUsers = room.users.filter(u => u.isActive)
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

      // Always update lastActivity
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
      const room = await Room.findActiveRoom(roomId)
      if (room) {
        room.lastActivity = new Date()
        // Optionally store the latest code
        const content = data.document.getText('codemirror').toString()
        room.codeContent = content
        await room.save()
      }
    } catch (error) {
      console.error(`❌ Error updating room ${roomId} on change:`, error.message)
    }
  }
})

// Periodic cleanup of old rooms (e.g., expired or inactive)
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

// Utility helpers (if you need them elsewhere)
export const getRoomConnectionCount = (roomId) => {
  const connections = roomConnections.get(roomId)
  return connections ? connections.size : 0
}

export const hasRoomSpace = (roomId) => {
  const connections = roomConnections.get(roomId)
  return !connections || connections.size < 2
}


export default server