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

        // Invia lo storico dei messaggi al nuovo utente connesso
        socket.emit('chat_history', rooms[cleanRoom].messages);

        // Notifica l'ingresso del nuovo utente
        const sysMsg = { sender: 'Sistema', text: `${socket.username} è entrato nella stanza!` };
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

        // Assicura l'esistenza della stanza
        if (!rooms[roomCode]) {
            rooms[roomCode] = { currentBid: null, messages: [] };
        }

        // Recupera nome utente, nome giocatore e importo offerta
        const senderName = data.sender || socket.username || 'Anonimo';
        const playerName = typeof data.player === 'object' ? (data.player.name || 'un giocatore') : (data.player || 'un giocatore');
        const bidPrice = data.price || data.bid || 1;

        const updatedData = {
            ...data,
            roomCode: roomCode,
            sender: senderName
        };

        // Salva lo stato corrente dell'asta
        rooms[roomCode].currentBid = updatedData;

        // 1. Aggiorna la schermata dell'asta su tutti i client
        io.to(roomCode).emit('update_bid', updatedData);

        // 2. Genera il messaggio per la chat e invialo a tutti i dispositivi
        const bidChatMessage = {
            sender: 'Sistema',
            text: `💰 ${senderName} ha offerto ${bidPrice} crediti per ${playerName}!`
        };

        rooms[roomCode].messages.push(bidChatMessage);
        io.to(roomCode).emit('chat_message', bidChatMessage);
    });

    // Invio messaggi di chat manuali
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
            if (rooms[socket.currentRoom]) {
                rooms[socket.currentRoom].messages.push(sysMsg);
            }
            io.to(socket.currentRoom).emit('chat_message', sysMsg);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server attivo sulla porta ${PORT}`));
