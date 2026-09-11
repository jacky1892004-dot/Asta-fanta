const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve i file statici (HTML, CSS, JS) dalla cartella 'public'
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('Un utente si è connesso:', socket.id);

    // Entra in una stanza
    socket.on('join_room', (data) => {
        socket.join(data.roomCode);
        console.log(`${data.username} è entrato nella stanza: ${data.roomCode}`);
        
        // Notifica agli altri membri della stanza
        socket.to(data.roomCode).emit('chat_message', {
            sender: 'SISTEMA',
            text: `${data.username} si è unito alla stanza!`
        });
    });

    // Sincronizzazione Rilanci / Offerte
    socket.on('place_bid', (data) => {
        // Invia l'offerta aggiornata a TUTTI i dispositivi nella stessa stanza (incluso chi l'ha inviata)
        io.to(data.roomCode).emit('update_bid', {
            player: data.player,
            bid: data.bid,
            user: data.user
        });
    });

    // Sincronizzazione Chat
    socket.on('send_message', (data) => {
        // Invia il messaggio a TUTTI nella stessa stanza
        io.to(data.roomCode).emit('chat_message', {
            sender: data.sender,
            text: data.text
        });
    });

    socket.on('disconnect', () => {
        console.log('Utente disconnesso:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server avviato sulla porta ${PORT}`);
});
