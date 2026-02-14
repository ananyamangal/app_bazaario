import dotenv from "dotenv";
dotenv.config();

console.log("PORT FROM ENV:", process.env.PORT);

import { createServer } from "http";
import app from "./app";
import "./config/db";
import { initializeSocketServer, emitToUser } from "./services/socket.service";
import { setNotificationSocketEmitter } from "./services/notification.service";

const PORT = process.env.PORT || 5000;

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.io
initializeSocketServer(httpServer);
setNotificationSocketEmitter(emitToUser);

httpServer.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Socket.io server ready`);
});
