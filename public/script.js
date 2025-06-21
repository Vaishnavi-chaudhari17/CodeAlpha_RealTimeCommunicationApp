// script.js

const socket = io("http://localhost:5000"); 
socket.connected  // should be true// Connect to socket server


const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

let localStream; 
let peerConnection;
// Get video elements
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

// Start call
async function startCall() {
  try {
    const roomIdInput = document.getElementById("roomIdInput");
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
      alert("Please enter a room ID");
      return;
    }

    // Get user's media
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    // Create peer connection
    peerConnection = new RTCPeerConnection(servers);

    // Add tracks
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Handle remote stream
    peerConnection.ontrack = event => {
      remoteVideo.srcObject = event.streams[0];
    };

    // ICE candidates
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit("ice-candidate", event.candidate);
      }
    };

    // Join room
    socket.emit("join-room", roomId);

    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", offer);
    
  } catch (err) {
    console.error("Error accessing media devices:", err);
  }
}

// Answer received
socket.on("offer", async (offer) => {
  peerConnection = new RTCPeerConnection(servers);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", event.candidate);
    }
  };

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", answer);
});

// Handle answer
socket.on("answer", async (answer) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

// ICE candidate handler
socket.on("ice-candidate", async (candidate) => {
  try {
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (e) {
    console.error("Error adding received ICE candidate", e);
  }
});

// Button click event
document.getElementById("startCall").addEventListener("click", startCall);

// ---------- SCREEN SHARING ----------
async function startScreenShare() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getTracks()[0];

    const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
    if (sender) sender.replaceTrack(screenTrack);

    screenTrack.onended = () => {
      sender.replaceTrack(localStream.getVideoTracks()[0]);
    };
  } catch (err) {
    alert("Screen share error: " + err.message);
  }
}

// ---------- FILE SHARING ----------
const fileInput = document.getElementById("fileInput");
const fileStatus = document.getElementById("fileStatus") || document.createElement("div");

function sendFile() {
  const file = fileInput.files[0];
  if (!file) return alert("Select a file to send.");

  const reader = new FileReader();
  reader.onload = () => {
    socket.emit("file", {
      name: file.name,
      buffer: reader.result
    });
    fileStatus.textContent = "File sent: " + file.name;
  };
  reader.readAsArrayBuffer(file);
}

socket.on("file", (file) => {
  const blob = new Blob([file.buffer]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  fileStatus.textContent = "File received: " + file.name;
});

// ---------- WHITEBOARD ----------
const canvas = document.getElementById("whiteboard") || document.getElementById("canvas");
const ctx = canvas?.getContext("2d");
let drawing = false;

if (canvas) {
  canvas.addEventListener("mousedown", () => drawing = true);
  canvas.addEventListener("mouseup", () => {
    drawing = false;
    ctx.beginPath();
  });
  canvas.addEventListener("mousemove", draw);
}

function draw(e) {
  if (!drawing) return;

  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#000";

  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);

  socket.emit("draw", { x: e.offsetX, y: e.offsetY });
}

socket.on("draw", (data) => {
  ctx.lineTo(data.x, data.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(data.x, data.y);
});

// ---------- LOGOUT ----------
function logout() {
  fetch("http://localhost:5000/api/auth/logout", {
    method: "POST",
    credentials: "include"
  }).then(() => {
    window.location.href = "/index.html";
  });
}

// ---------- FETCH USER INFO ----------
async function fetchUser() {
  try {
    const res = await fetch("http://localhost:5000/api/protected", {
      method: "GET",
      credentials: "include"
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById("username").textContent = data.userId;
    } else {
      window.location.href = "/index.html";
    }
  } catch {
    window.location.href = "/index.html";
  }
}

fetchUser();
