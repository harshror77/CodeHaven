import dotenv from "dotenv"
import { server } from './app.js'
import connectDB from './db/index.js'
import './execution/index.js' // Add this line to start execution service

dotenv.config({ path: './.env' })

connectDB()
  .then(() => {
    const PORT = process.env.PORT || 3000
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`)
    })
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error)
  })