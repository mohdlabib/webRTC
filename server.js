import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Store connection information
let monitorSocket = null;
let latestClientSocket = null;
let monitorId = null;
let clientId = null;
let connectionState = {
  hasMonitor: false,
  hasClient: false,
  lastMonitorConnected: null,
  lastClientConnected: null,
};

// API endpoint to get connection status
app.get("/connection-status", (req, res) => {
  res.json(connectionState);
});

io.on("connection", (socket) => {
  console.log("🔌 New connection:", socket.id);

  socket.on("role", (role, previousId = null) => {
    if (role === "monitor") {
      monitorSocket = socket;
      monitorId = socket.id;
      connectionState.hasMonitor = true;
      connectionState.lastMonitorConnected = new Date().toISOString();
      console.log(
        "📺 Monitor connected:",
        socket.id,
        previousId ? "(reconnected)" : ""
      );

      // If this is a reconnection and there's a client, notify the monitor
      if (previousId && latestClientSocket) {
        console.log("🔄 Notifying reconnected monitor about existing client");
        socket.emit("new-client", latestClientSocket.id);
      }
    } else if (role === "client") {
      latestClientSocket = socket;
      clientId = socket.id;
      connectionState.hasClient = true;
      connectionState.lastClientConnected = new Date().toISOString();
      console.log(
        "📷 Client connected:",
        socket.id,
        previousId ? "(reconnected)" : ""
      );

      if (monitorSocket) {
        console.log("🔄 Notifying monitor about client", socket.id);
        monitorSocket.emit("new-client", socket.id);
      }
    }
  });

  socket.on("get-monitor", () => {
    console.log("🔍 Client requesting monitor:", socket.id);
    if (monitorSocket) {
      console.log("📡 Sending monitor-available to client");
      socket.emit("monitor-available", monitorSocket.id);
    } else {
      console.log("❌ No monitor available");
    }
  });

  socket.on("get-client", () => {
    console.log("🔍 Monitor requesting client:", socket.id);
    if (latestClientSocket) {
      console.log("📡 Sending new-client to monitor");
      socket.emit("new-client", latestClientSocket.id);
    } else {
      console.log("❌ No client available");
    }
  });

  socket.on("offer-request", ({ monitorSocketId }) => {
    if (latestClientSocket) {
      latestClientSocket.emit("offer-request", {
        monitorSocketId,
      });
    }
  });

  socket.on("offer", (data) => {
    console.log("📨 OFFER from", socket.id, "to", data.target);
    io.to(data.target).emit("offer", {
      sender: socket.id,
      offer: data.offer,
    });
  });

  socket.on("answer", (data) => {
    io.to(data.target).emit("answer", {
      answer: data.answer,
    });
  });

  socket.on("ice-candidate", (data) => {
    io.to(data.target).emit("ice-candidate", {
      candidate: data.candidate,
    });
  });

  socket.on("disconnect", () => {
    if (socket === monitorSocket) {
      console.log("❌ Monitor disconnected:", socket.id);
      // Don't set to null immediately to allow for refresh reconnection
      setTimeout(() => {
        if (monitorSocket === socket) {
          console.log("⏰ Monitor reconnection timeout expired");
          monitorSocket = null;
          connectionState.hasMonitor = false;
        }
      }, 5000); // 5 second grace period for refresh
    }

    if (socket === latestClientSocket) {
      console.log("❌ Client disconnected:", socket.id);
      // Don't set to null immediately to allow for refresh reconnection
      setTimeout(() => {
        if (latestClientSocket === socket) {
          console.log("⏰ Client reconnection timeout expired");
          latestClientSocket = null;
          connectionState.hasClient = false;
        }
      }, 5000); // 5 second grace period for refresh
    }

    console.log("❌ Disconnected:", socket.id);
  });
});

server.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
