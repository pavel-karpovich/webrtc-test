const http = require('http');
const path = require('path');
const express = require('express');
const socketIO = require('socket.io');


const port = process.env.PORT || 5000;


function uniqueId() {
    return Math.random().toString(16).slice(2);
}

const logger = {
    log: (...args) => console.log((new Date).toJSON(), ...args),
};

const app = express();
const httpServer = http.Server(app);
const io = socketIO(httpServer, {
    cors: {
      origin: [
        'http://localhost:5001',
        'https://localhost:5001',
    ],
    },
});

const state = {
    rooms: {},
    allClients: [],
}

function updateRoom(room) {
    const roomParties = room.parties.map(party => party.name);
    room.parties.forEach(party => {
        party.socket.emit('room:update', {id: room.id, parties: roomParties});
    });
}

function updateRoomsList() {
    const rooms = Object.values(state.rooms).map(room => ({
        id: room.id,
        name: room.name,
    }));
    state.allClients.forEach(socket => {
        socket.emit('room:list', {rooms})
    });
}

io.on('connection', (socket) => {

    state.allClients.push(socket);

    socket.on('room:list', () => {
        updateRoomsList();
    });

    socket.on('room:create', data => {
        const id = uniqueId();
        const roomName = data.name;
        logger.log(`Create room ${id}`);
        state.rooms[id] = {
            id,
            name: roomName,
            parties: [],
        };
        updateRoomsList();
    });

    socket.on('room:join', payload => {
        const roomId = payload.id;
        const partyName = payload.name;
        if (roomId in state.rooms) {
            logger.log(`"${partyName}" joins room ${roomId}`);
            state.rooms[roomId].parties.push({
                name: partyName,
                socket: socket,
            });
            updateRoom(state.rooms[roomId]);
            socket.emit('room:joined', {id: roomId});
        } else {
            logger.log(`No room with id ${roomId}`);
        }
    });

    socket.on('disconnect', () => {
        const delIndex = state.allClients.indexOf(socket);
        if (delIndex !== -1) {
            state.allClients.splice(delIndex, 1);
        }
        const roomsWithClient = Object.keys(state.rooms).filter(id => state.rooms[id].parties.find(party => party.socket === socket));
        let roomWasDeleted = false;
        roomsWithClient.forEach(id => {
            const delIndex = state.rooms[id].parties.findIndex(party => party.socket === socket);
            state.rooms[id].parties.splice(delIndex, 1);
            if (state.rooms[id].parties.length) {
                updateRoom(state.rooms[id]);
            } else {
                logger.log(`Delete room ${id}`);
                delete state.rooms[id];
                roomWasDeleted = true;
            }
        });
        if (roomWasDeleted) {
            updateRoomsList();
        }
    });
});

app.use(express.static(path.resolve(__dirname, 'dist')));

httpServer.listen(port, () => {
    logger.log(`Server started on port ${port}`);
});
