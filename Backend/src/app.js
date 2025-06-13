import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server as SocketServer } from 'socket.io'
import cookieParser from 'cookie-parser';

import dotenv from 'dotenv'
dotenv.config({ path: './.env' })

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: "16kb" }));

app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use(express.static("public"));

app.use(cookieParser());

const server = http.createServer(app)

//Routes
import roomRoutes from './routes/roomRoutes.js';
app.use('/api/rooms', roomRoutes);
const io = new SocketServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})
io.on('connection', (socket) => {
  console.log("Socket.io connected ", socket.id)

  socket.on('disconnect', () => {
    console.log('Socket.io disconnected', socket.id)
  })
})

export { server }

