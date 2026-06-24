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

let waitingUser = null;
const warnings = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  warnings[socket.id] = 0;

  if (waitingUser) {
    const partner = waitingUser;
    waitingUser = null;

    const room = socket.id + '#' + partner.id;
    socket.join(room);
    partner.join(room);

    socket.room = room;
    partner.room = room;
    socket.partner = partner;
    partner.partner = socket;

    socket.emit('matched', { message: 'Stranger found! Say hello 👋' });
    partner.emit('matched', { message: 'Stranger found! Say hello 👋' });
  } else {
    waitingUser = socket;
    socket.emit('waiting', { message: 'Looking for a stranger...' });
  }

  socket.on('message', (data) => {
    if (containsBadWord(data.text)) {
      warnings[socket.id]++;
      socket.emit('warning', {
        message: `⚠️ Warning ${warnings[socket.id]}/3: Vulgar language not allowed!`
      });
      if (warnings[socket.id] >= 3) {
        socket.emit('banned', { message: '🚫 You have been disconnected for violating rules!' });
        socket.disconnect();
      }
      return;
    }
    if (socket.room) {
      socket.to(socket.room).emit('message', { text: data.text });
    }
  });

  socket.on('next', () => {
    if (socket.partner) {
      socket.partner.emit('disconnected', { message: 'Stranger disconnected. Finding new...' });
      socket.partner.partner = null;
      socket.partner.room = null;
    }
    socket.partner = null;
    socket.room = null;

    if (waitingUser) {
      const partner = waitingUser;
      waitingUser = null;

      const room = socket.id + '#' + partner.id;
      socket.join(room);
      partner.join(room);

      socket.room = room;
      partner.room = room;
      socket.partner = partner;
      partner.partner = socket;

      socket.emit('matched', { message: 'Stranger found! Say hello 👋' });
      partner.emit('matched', { message: 'Stranger found! Say hello 👋' });
    } else {
      waitingUser = socket;
      socket.emit('waiting', { message: 'Looking for a stranger...' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete warnings[socket.id];

    if (socket.partner) {
      socket.partner.emit('disconnected', { message: 'Stranger disconnected. Finding new...' });
      socket.partner.partner = null;
      socket.partner.room = null;
    }

    if (waitingUser === socket) {
      waitingUser = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});