import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { config } from "./config.js";
import statusRouter from "./routes/status.js";
import tradesRouter from "./routes/trades.js";
import chatRouter from "./routes/chat.js";
import { startMarketIngestionJob } from "./jobs/marketIngestion.js";
import { initAISession, scheduleDailyReset, sendToAI } from "./services/aiSession.js";
import { createAiAdvice } from "./db/ingestionRepository.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

app.use(express.json());

// Routes
app.use("/api", statusRouter);
app.use("/api", tradesRouter);
app.use("/api", chatRouter);

// Socket.io
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("chat:message", async (message: string) => {
    try {
      const response = await sendToAI(message);
      await createAiAdvice({ source: "user", prompt: message, response, provider: config.llm.provider });
      io.emit("chat:response", { source: "user", response });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[chat:message] error:", msg);
      socket.emit("chat:error", { message: msg });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(config.port, async () => {
  console.log(`Server running on http://localhost:${config.port}`);
  try {
    await initAISession();
  } catch (err) {
    console.error("[startup] AI session init failed, continuing without AI:", err);
  }
  scheduleDailyReset();
  startMarketIngestionJob(io);
});
