const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require('cors');
const { Server } = require("socket.io");
const http = require("http");
const path = require("path");
const { router: authRouter, authMiddleware } = require("./auth");

const app = express();
const server = http.createServer(app); 

app.use(express.static(path.join(__dirname, '..', 'public')));


app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:5500','http://localhost:5000'], // allowed origins
  credentials: true,   // <-- important for cookies to be sent/received
}));

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:5500','http://127.0.0.1:5000'], // or wherever your frontend is running
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(express.json());
app.use(cookieParser());

// Use auth router once only
app.use("/api/auth", authRouter);

mongoose.connect("mongodb://localhost:27017/mydatabase")
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Protected route example
app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({ message: "Protected content", userId: req.user.id });
});

// 7) Direct HTML file routes (in case you hit these in browser)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));

});

// 8) Socket.io setup
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("offer", (data) => {
    socket.broadcast.emit("offer", data);
  });

  socket.on("answer", (data) => {
    socket.broadcast.emit("answer", data);
  });

  socket.on("ice-candidate", (data) => {
    socket.broadcast.emit("ice-candidate", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// 9) Start the server
server.listen(5000, () => {
  console.log("✅ Server running on port 5000");
});
