import dotenv from 'dotenv'
import { server } from './app.js'
import connectDB from './db/index.js'
import './execution/index.js'  // starts execution service
import yjsServer from '../yjs-server.js'

dotenv.config({ path: './.env' })

connectDB()
  .then(() => {
    const PORT = process.env.PORT || 3000

    // Start the main Express backend
    server.listen(PORT, () => {
      console.log(`🚀 Express server running on port ${PORT}`)
    })

    // Start the Hocuspocus WebSocket server
    yjsServer.listen().then(() => {
      console.log('✅ Yjs WebSocket server running on ws://localhost:1234')
    })
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error)
  })
