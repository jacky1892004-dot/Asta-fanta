const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" } 
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Stato in memoria per ogni stanza
const rooms = {};

io.on('connection', (socket) => {

    // 1. INGRESSO NELLA STANZA
    socket.on('join_room', ({ username, roomCode }) => {
        if (!roomCode || !username) return;
        
        const cleanRoom = roomCode.trim().toLowerCase();
        
        socket.join(cleanRoom);
        socket.currentRoom = cleanRoom;
        socket.username = username.trim();

        // Inizializza la stanza se non esiste ancora
        if (!rooms[cleanRoom]) {
            rooms[cleanRoom] = {
                currentBid: null,
                messages: []
            };
        }

        // INVIO STORICO CHAT AL SINGOLO UTENTE APPENA CONNESSO
        socket.emit('chat_history', rooms[cleanRoom].messages);

        // Notifica L'INGRESSO a tutti gli altri utenti
        const sysMsg = { sender: 'Sistema', text: `${socket.username} è entrato nella stanza!` };
        rooms[cleanRoom].messages.push(sysMsg);
        io.to(cleanRoom).emit('chat_message', sysMsg);

        // SINCRONIZZA L'ASTA CORRENTE SE PRESENTE
        if (rooms[cleanRoom].currentBid) {
            socket.emit('update_bid', rooms[cleanRoom].currentBid);
        }
    });

    // 2. CHIAMATA GIOCATORE O RILANCIO
    socket.on('place_bid', (data) => {
        // Garantisce di trovare sempre la stanza corretta
        const roomCode = (data.roomCode || socket.currentRoom || '').trim().toLowerCase();
        if (!roomCode) return;

        // Assicura l'esistenza della stanza
        if (!rooms[roomCode]) {
            rooms[roomCode] = { currentBid: null, messages: [] };
        }

        // Prepara l'oggetto bid assicurandosi che contenga chi ha rilanciato/chiamato
        const updatedData = {
            ...data,
            roomCode: roomCode,
            sender: data.sender || socket.username || 'Anonimo'
        };

        // Salva lo stato
        rooms[roomCode].currentBid = updatedData;

        // INVIA A TUTTI I UTENTI IN NELLA STANZA (compreso il mittente)
        io.to(roomCode).emit('update_bid', updatedData);
    });

    // 3. INVIO MESSAGGI CHAT
    socket.on('send_message', (data) => {
        const roomCode = (data.roomCode || socket.currentRoom || '').trim().toLowerCase();
        if (!roomCode) return;

        const chatData = {
            sender: data.sender || socket.username || 'Anonimo',
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (rooms[roomCode]) {
            rooms[roomCode].messages.push(chatData);
        }

        // INVIA A TUTTI NELLA STANZA
        io.to(roomCode).emit('chat_message', chatData);
    });

    // 4. GESTIONE DISCONNESSIONE
    socket.on('disconnect', () => {
        if (socket.currentRoom && socket.username) {
            const sysMsg = { sender: 'Sistema', text: `${socket.username} si è disconnesso.` };
            if (rooms[socket.currentRoom]) {
                rooms[socket.currentRoom].messages.push(sysMsg);
            }
            io.to(socket.currentRoom).emit('chat_message', sysMsg);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server attivo sulla porta ${PORT}`));
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server attivo sulla porta ${PORT}`));
