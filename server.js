{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const express = require('express');\
const http = require('http');\
const \{ Server \} = require('socket.io');\
const path = require('path');\
\
const app = express();\
const server = http.createServer(app);\
const io = new Server(server, \{ cors: \{ origin: "*" \} \});\
\
// Serve la cartella public dove c'\'e8 il file index.html\
app.use(express.static(path.join(__dirname, 'public')));\
\
io.on('connection', (socket) => \{\
    socket.on('join_room', (\{ username, roomCode \}) => \{\
        socket.join(roomCode);\
        io.to(roomCode).emit('chat_message', \{\
            sender: 'Sistema',\
            text: `$\{username\} \'e8 entrato nella stanza!`\
        \});\
    \});\
\
    socket.on('place_bid', (data) => \{\
        io.to(data.roomCode).emit('update_bid', data);\
    \});\
\
    socket.on('send_message', (data) => \{\
        io.to(data.roomCode).emit('chat_message', data);\
    \});\
\});\
\
const PORT = process.env.PORT || 3000;\
server.listen(PORT, () => console.log(`Server attivo sulla porta $\{PORT\}`));}
