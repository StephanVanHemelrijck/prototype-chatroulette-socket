const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

// App
const app = express();
const httpServer = require("http").createServer(app);

// Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Listening on
const PORT = process.env.PORT || 5000;

const users = []; // {username, socketId, uuidv4}
io.on("connection", (socket) => {
  console.log(`User with socket ID: ${socket.id} connected`);

  // Add user to users array
  const user = {
    socketId: socket.id,
    userId: uuidv4(),
  };

  users.push(user);

  // Send current user to client
  //   socket.emit("currentUser", user);

  // Users online
  io.emit("users-online", users.length);

  socket.on("disconnect", () => {
    const index = users.findIndex((u) => u.socketId === socket.id);

    if (index !== -1) {
      users.splice(index, 1);
    }

    console.log(`User with socket ID: ${socket.id} disconnected`);

    // Repeated actions
    io.emit("users-online", users.length);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
