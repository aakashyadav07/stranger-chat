const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const badWords = [
  'sex', 'nude', 'nudes', 'porn', 'vulgar',
  'fuck', 'shit', 'dick', 'pussy', 'boobs',
  'lund', 'chut', 'choot', 'gand', 'fuddi', 'mc', 'bc'
];

function containsBadWord(message) {
  const lowerMsg = message.toLowerCase();
  return badWords.some(word => lowerMsg.includes(word));
}

app.use(express.static('public'));

let waitingUsers = [];
const warnings = {};

function matchUsers(socket) {
  const interests = socket.interests || [];

  // Interest based matching
  let matchIndex = -1;
  if (interests.length > 0) {
    matchIndex = waitingUsers.findIndex(u =>
      u.interests && u.interests.some(i => interests.includes(i))
    );
  }

  if (matchIndex === -1 && waitingUsers.length > 0) {
    matchIndex = 0;
  }

  if (matchIndex !== -1) {
    const partner = waitingUsers.splice(matchIndex, 1)[0];

    const room = socket.id + '#' + partner.id;
    socket.join(room);
    partner.join(room);

    socket.room = room;
    partner.room = room;
    socket.partner = partner;
    partner.partner = socket;

    socket.emit('matched', { message: '✅ Stranger found! Say hello 👋' });
    partner.emit('matched', { message: '✅ Stranger found! Say hello 👋' });
  } else {
    waitingUsers.push(socket);
    socket.emit('waiting', { message: '🔍 Looking for a stranger...' });
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  warnings[socket.id] = 0;

  socket.on('join', (data) => {
    socket.username = data.username || 'Anonymous';
    socket.interests = data.interests || [];
    matchUsers(socket);
  });

  socket.on('message', (data) => {
    if (containsBadWord(data.text)) {
      warnings[socket.id]++;
      socket.emit('warning', {
        message: `⚠️ Warning ${warnings[socket.id]}/3: Vulgar language not allowed!`
      });
      if (warnings[socket.id] >= 3) {
        socket.emit('banned', { message: '🚫 Disconnected for violating rules!' });
        socket.disconnect();
      }
      return;
    }
    if (socket.room) {
      socket.to(socket.room).emit('message', { text: data.text });
    }
  });

  socket.on('typing', () => {
    if (socket.room) {
      socket.to(socket.room).emit('typing');
    }
  });

  socket.on('report', () => {
    if (socket.partner) {
      warnings[socket.partner.id] = (warnings[socket.partner.id] || 0) + 2;
      socket.emit('reported', { message: '🚩 Stranger reported!' });
    }
  });

  socket.on('next', () => {
    if (socket.partner) {
      socket.partner.emit('disconnected', { message: '👋 Stranger left. Finding new...' });
      socket.partner.partner = null;
      socket.partner.room = null;
      matchUsers(socket.partner);
    }
    socket.partner = null;
    socket.room = null;
    matchUsers(socket);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete warnings[socket.id];

    if (socket.partner) {
      socket.partner.emit('disconnected', { message: '👋 Stranger disconnected. Finding new...' });
      socket.partner.partner = null;
      socket.partner.room = null;
      matchUsers(socket.partner);
    }

    waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});