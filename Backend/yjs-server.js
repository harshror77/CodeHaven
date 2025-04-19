import { Server } from '@hocuspocus/server'

const server = Server.configure({
  port: 1234,
  name: 'collab-server',
  debounce: 200,
})

server.listen().then(() => {
  console.log('✅ Hocuspocus (Yjs) WebSocket server running on ws://localhost:1234')
})
