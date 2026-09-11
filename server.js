const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Oggetto per memorizzare lo stato di ogni stanza (giocatore corrente, offerta, messaggi)
const rooms = {};

io.on('connection', (socket) => {

    socket.on('join_room', ({ username, roomCode }) => {
        if (!roomCode) return;
        
        // Pulizia del codice stanza (rimuove spazi e rende tutto minuscolo)
        const cleanRoom = roomCode.trim().toLowerCase();
        
        socket.join(cleanRoom);
        socket.currentRoom = cleanRoom; // Associa la stanza al socket

        // Inizializza la stanza se non esiste ancora
        if (!rooms[cleanRoom]) {
            rooms[cleanRoom] = {
                currentBid: null,
                messages: []
            };
        }

        // Avvisa la stanza del nuovo utente
        const sysMsg = { sender: 'Sistema', text: `${username} è entrato nella stanza!` };
        rooms[cleanRoom].messages.push(sysMsg);
        io.to(cleanRoom).emit('chat_message', sysMsg);

        // INVIO STATO ATTUALE AL NUOVO DISPOSITIVO CONNESSO:
        // Mandiamo l'ultima chiamata/offerta attiva se presente
        if (rooms[cleanRoom].currentBid) {
            socket.emit('update_bid', rooms[cleanRoom].currentBid);
        }
    });

    socket.on('place_bid', (data) => {
        const roomCode = (data.roomCode || socket.currentRoom || '').trim().toLowerCase();
        if (!roomCode) return;

        // Aggiorna e salva la chiamata corrente nello stato della stanza
        if (rooms[roomCode]) {
            rooms[roomCode].currentBid = data;
        }

        // Invia la chiamata/offerta a TUTTI i dispositivi nella stanza
        io.to(roomCode).emit('update_bid', data);
    });

    socket.on('send_message', (data) => {
        const roomCode = (data.roomCode || socket.currentRoom || '').trim().toLowerCase();
        if (!roomCode) return;

        if (rooms[roomCode]) {
            rooms[roomCode].messages.push(data);
        }

        io.to(roomCode).emit('chat_message', data);
    });

    socket.on('disconnect', () => {
        console.log('Un utente si è disconnesso:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server attivo sulla porta ${PORT}`));
