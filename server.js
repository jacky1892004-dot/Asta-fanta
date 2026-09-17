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

// Stato centralizzato salvato in memoria sul server
const rooms = {};

io.on('connection', (socket) => {

    socket.on('join_room', ({ username, roomCode }) => {
        if (!roomCode || !username) return;
        
        const cleanRoom = roomCode.trim().toLowerCase();
        const cleanUser = username.trim();
        
        socket.join(cleanRoom);
        socket.currentRoom = cleanRoom;
        socket.username = cleanUser;

        if (!rooms[cleanRoom]) {
            rooms[cleanRoom] = {
                users: {},       // { username: { credits: 500, team: { P:[], D:[], C:[], A:[] } } }
                currentBid: null,
                messages: []
            };
        }

        const room = rooms[cleanRoom];

        // Se l'utente non esisteva nella stanza, lo inizializziamo
        if (!room.users[cleanUser]) {
            room.users[cleanUser] = {
                credits: 500,
                team: { P: [], D: [], C: [], A: [] }
            };
        }

        const sysMsg = { sender: 'Sistema', text: `${cleanUser} è entrato nella stanza!`, isSystem: true };
        room.messages.push(sysMsg);

        // Sincronizza lo stato completo dell'utente che è appena (ri)entrato
        socket.emit('sync_user_state', {
            userData: room.users[cleanUser],
            currentBid: room.currentBid,
            messages: room.messages
        });

        // Notifica gli altri utenti dell'ingresso
        socket.to(cleanRoom).emit('chat_message', sysMsg);
    });

    socket.on('place_bid', (data) => {
        const roomCode = (data.roomCode || socket.currentRoom || '').trim().toLowerCase();
        if (!roomCode || !rooms[roomCode]) return;

        const room = rooms[roomCode];
        
        // Controlla validità crediti dell'utente
        const userState = room.users[data.bidder];
        if (userState && data.bid > userState.credits) {
            socket.emit('error_message', 'Non hai abbastanza fantacrediti per questa offerta!');
            return;
        }

        room.currentBid = {
            player: data.player,
            bid: data.bid,
            bidder: data.bidder
        };

        // 1. Notifica aggiornamento dell'asta a tutti i client
        io.to(roomCode).emit('update_bid', room.currentBid);

        // 2. Registra e invia in chat la notifica del rilancio/offerta
        const bidMsg = {
            sender: 'Sistema',
            text: `📢 ${data.bidder} ha offerto ${data.bid} FM per ${data.player.name} (${data.player.team})!`,
            isSystem: true
        };
        room.messages.push(bidMsg);
        io.to(roomCode).emit('chat_message', bidMsg);
    });

    socket.on('assign_player', () => {
        const roomCode = socket.currentRoom;
        if (!roomCode || !rooms[roomCode]) return;

        const room = rooms[roomCode];
        const bidData = room.currentBid;

        if (!bidData) return;

        // Sicurezza lato server: Solo l'ultimo offerente può aggiudicarsi il giocatore
        if (bidData.bidder !== socket.username) {
            socket.emit('error_message', 'Solo chi ha fatto l\'ultima offerta può aggiudicarsi il giocatore!');
            return;
        }

        const winner = room.users[socket.username];
        if (winner) {
            winner.credits -= bidData.bid;
            winner.team[bidData.player.role].push({
                name: bidData.player.name,
                price: bidData.bid,
                team: bidData.player.team
            });

            // Comunica l'assegnazione avvenuta
            io.to(roomCode).emit('player_assigned', {
                winner: socket.username,
                player: bidData.player,
                price: bidData.bid,
                userData: winner
            });

            // Registra e invia in chat la notifica dell'assegnazione ufficiale
            const assignMsg = {
                sender: 'Sistema',
                text: `🎉 UFFICIALE: ${socket.username} si aggiudica ${bidData.player.name} per ${bidData.bid} FM!`,
                isSystem: true
            };
            room.messages.push(assignMsg);
            io.to(roomCode).emit('chat_message', assignMsg);

            // Resetta l'asta corrente
            room.currentBid = null;
            io.to(roomCode).emit('update_bid', null);
        }
    });

    socket.on('send_message', (data) => {
        const roomCode = (data.roomCode || socket.currentRoom || '').trim().toLowerCase();
        if (!roomCode || !rooms[roomCode]) return;

        const chatData = {
            sender: socket.username || data.sender || 'Anonimo',
            text: data.text,
            isSystem: false
        };

        rooms[roomCode].messages.push(chatData);
        io.to(roomCode).emit('chat_message', chatData);
    });

    socket.on('disconnect', () => {
        if (socket.currentRoom && socket.username) {
            const sysMsg = { sender: 'Sistema', text: `${socket.username} si è disconnesso.`, isSystem: true };
            if (rooms[socket.currentRoom]) {
                rooms[socket.currentRoom].messages.push(sysMsg);
            }
            io.to(socket.currentRoom).emit('chat_message', sysMsg);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server attivo sulla porta ${PORT}`));
