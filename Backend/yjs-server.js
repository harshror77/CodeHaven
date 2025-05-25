import { Server } from '@hocuspocus/server'

const server = Server.configure({
  port: 1234,
  name: 'collab-server',
  debounce: 200,
  async onConnect(data) {
    // Limit to 2 users per room
    const connections = await server.getConnectionsCount(data.documentName)
    if (connections >= 2) {
      throw new Error('Room is full (max 2 users)')
    }
  }
})

server.listen().then(() => {
  console.log('✅ Hocuspocus (Yjs) WebSocket server running on ws://localhost:1234')
})