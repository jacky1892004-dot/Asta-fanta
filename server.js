const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    socket.on('join_room', ({ username, roomCode }) => {
        socket.join(roomCode);
        io.to(roomCode).emit('chat_message', {
            sender: 'Sistema',
            text: `${username} è entrato nella stanza!`
        });
    });

    socket.on('place_bid', (data) => {
        io.to(data.roomCode).emit('update_bid', data);
    });

    socket.on('send_message', (data) => {
        io.to(data.roomCode).emit('chat_message', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server attivo sulla porta ${PORT}`));
