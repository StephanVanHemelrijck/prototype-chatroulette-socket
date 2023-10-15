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

const rooms = []; // {roomId, users: [{username, socketId, uuidv4}], limit: 2}
const users = []; // {username, socketId, uuidv4, state: "looking | in-call | out-of-call", roomId: uuidv4}
io.on("connection", (socket) => {
  console.log(`User with socket ID: ${socket.id} connected`);

  // Add user to users array
  let user = {
    socketId: socket.id,
    userId: uuidv4(),
    username: "",
    state: "out-of-call",
    roomId: "",
  };

  socket.on("start-call", (username) => {
    user.username = username;

    /**
     * Change user state to "looking"
     * Check if there are any rooms at all
     * If there are no rooms, create a new room
     * If there are rooms, check if there are any rooms with less than 2 users
     * If there are rooms with less than 2 users, add user to that room
     * If there are no rooms with less than 2 users, create a new room
     * TODO: If there are multiple rooms with 1 user, combine them into 1 room
     *
     */

    // Change user state to "looking"
    user.state = "looking";

    let room = {};
    // Check if there are any rooms at all
    if (rooms.length === 0) {
      // If there are no rooms, create a new room
      room = {
        roomId: uuidv4(),
        users: [user],
        limit: 2,
      };

      user.roomId = room.roomId;

      rooms.push(room);
    } else {
      // If there are rooms, check if there are any rooms with less than 2 users
      const roomIndex = rooms.findIndex((r) => r.users.length < r.limit);

      if (roomIndex !== -1) {
        // If there are rooms with less than 2 users, add user to that room
        // Update user room id
        user.roomId = rooms[roomIndex].roomId;
        // Add user to room
        rooms[roomIndex].users.push(user);

        // Room to return
        room = rooms[roomIndex];
      } else {
        // If there are no rooms with less than 2 users, create a new room
        room = {
          roomId: uuidv4(),
          users: [user],
          limit: 2,
        };

        user.roomId = room.roomId;

        rooms.push(room);
      }
    }

    socket.join(user.roomId);

    // Add user to users array
    users.push(user);

    console.log("Room before started-call", room);

    socket.emit("started-call", room);
    // Users online
    io.emit("users-online", users.length);

    // Send room to user
    io.to(user.roomId).emit("room", room);
  });

  socket.on("get-room", (roomId) => {
    const room = rooms.find((r) => r.roomId === roomId);
    if (!room) return;
    io.to(room.roomId).emit("room", room);
  });

  socket.on("disconnect", () => {
    // Leave room if in a room
    if (user.roomId !== "") {
      const roomId = user.roomId;
      user = leaveRoom(user);
      io.to(roomId).emit("user-left", user);
    }

    // Emit to all users in room that user left

    // Remove user from users array
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

/**
 * Lets a user leave the room he's in
 *
 * @param {*} user - The user that needs to leave the room
 *
 * @returns {Object} user - The user that left the room
 */
function leaveRoom(user) {
  // Remove user from room
  const room = rooms.find((r) => r.roomId === user.roomId);
  const index = room.users.findIndex((u) => u.userId === user.userId);

  if (index !== -1) {
    room.users.splice(index, 1);
  }

  // Change user state to "looking" & remove roomId
  user.state = "looking";
  user.roomId = "";

  // Delete room if room is empty
  if (room.users.length === 0) {
    const roomIndex = rooms.findIndex((r) => r.roomId === room.roomId);

    if (roomIndex !== -1) {
      rooms.splice(roomIndex, 1);
    }
  }

  return user;
}
