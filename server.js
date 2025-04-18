const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

let monitorSocket = null;
let latestClientSocket = null;

io.on('connection', (socket) => {
    console.log('🔌 New connection:', socket.id);

    socket.on('role', (role) => {
        if (role === 'monitor') {
            monitorSocket = socket;
            console.log('📺 Monitor connected:', socket.id);
        } else if (role === 'client') {
            latestClientSocket = socket;
            console.log('📷 Client connected:', socket.id);

            if (monitorSocket) {
                monitorSocket.emit('new-client', socket.id);
            }
        }
    });

    socket.on('offer-request', ({
        monitorSocketId
    }) => {
        if (latestClientSocket) {
            latestClientSocket.emit('offer-request', {
                monitorSocketId
            });
        }
    });

    socket.on('offer', (data) => {
        console.log('📨 OFFER from', socket.id, 'to', data.target);
        io.to(data.target).emit('offer', {
            sender: socket.id,
            offer: data.offer
        });
    });

    socket.on('answer', (data) => {
        io.to(data.target).emit('answer', {
            answer: data.answer
        });
    });

    socket.on('ice-candidate', (data) => {
        io.to(data.target).emit('ice-candidate', {
            candidate: data.candidate
        });
    });

    socket.on('disconnect', () => {
        if (socket === monitorSocket) monitorSocket = null;
        if (socket === latestClientSocket) latestClientSocket = null;
        console.log('❌ Disconnected:', socket.id);
    });
});

server.listen(3000, () => {
    console.log('🚀 Server running on http://localhost:3000');
});
