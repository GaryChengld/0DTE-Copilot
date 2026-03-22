import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { config } from "./config.js";
import statusRouter from "./routes/status.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

app.use(express.json());

// Routes
app.use("/api", statusRouter);

// Socket.io
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
