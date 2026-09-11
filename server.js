const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve i file dalla directory corrente (stessa cartella di server.js)
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Stato in memoria per ogni stanza
const rooms = {};

io.on('connection', (socket) => {

    // Ingresso in una stanza
    socket.on('join_room', ({ username, roomCode }) => {
        if (!roomCode) return;
        
        const cleanRoom = roomCode.trim().toLowerCase();
        
        socket.join(cleanRoom);
        socket.currentRoom = cleanRoom;
        socket.username = username;

        // Inizializza la stanza se non esiste ancora
        if (!rooms[cleanRoom]) {
            rooms[cleanRoom] = {
                currentBid: null,
                messages: []
            };
        }

        // Notifica l'ingresso del nuovo utente
        const sysMsg = { sender: 'Sistema', text: `${username} è entrato nella stanza!` };
        rooms[cleanRoom].messages.push(sysMsg);
        io.to(cleanRoom).emit('chat_message', sysMsg);

        // Sincronizza lo stato corrente dell'asta se c'è un'offerta attiva
        if (rooms[cleanRoom].currentBid) {
            socket.emit('update_bid', rooms[cleanRoom].currentBid);
        }
    });

    // Chiamata giocatore o rilancio offerta
    socket.on('place_bid', (data) => {
        const roomCode = (data.roomCode || socket.currentRoom || '').trim().toLowerCase();
        if (!roomCode) return;

        // Salva lo stato corrente
        if (rooms[roomCode]) {
            rooms[roomCode].currentBid = data;
        }

        // Invia l'offerta/chiamata aggiornata a tutti i client della stanza
        io.to(roomCode).emit('update_bid', data);
    });

    // Invio messaggi di chat
    socket.on('send_message', (data) => {
        const roomCode = (data.roomCode || socket.currentRoom || '').trim().toLowerCase();
        if (!roomCode) return;

        const chatData = {
            sender: data.sender || socket.username || 'Anonimo',
            text: data.text
        };

        if (rooms[roomCode]) {
            rooms[roomCode].messages.push(chatData);
        }

        io.to(roomCode).emit('chat_message', chatData);
    });

    socket.on('disconnect', () => {
        if (socket.currentRoom && socket.username) {
            const sysMsg = { sender: 'Sistema', text: `${socket.username} si è disconnesso.` };
            io.to(socket.currentRoom).emit('chat_message', sysMsg);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server attivo sulla porta ${PORT}`));
