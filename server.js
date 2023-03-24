const http = require('http');
const path = require('path');
const express = require('express');
const ws = require('ws');


const port = process.env.PORT || 5000;


function uniqueId() {
    return Math.random().toString(16).slice(2);
}

const logger = {
    log: (...args) => console.log((new Date).toJSON(), ...args),
};

const app = express();
const httpServer = http.Server(app);
const wss = new ws.Server({server: httpServer});

const state = {
    rooms: {},
    allClients: [],
}

function socketSend(socket, event, data = {}) {
    socket.send(JSON.stringify({
        event,
        ...data,
    }));
}

function updateRoom(room) {
    const roomParties = room.parties.map(party => party.name);
    room.parties.forEach(party => {
        socketSend(party.socket, 'room:update', {
            id: room.id,
            parties: roomParties,
            bandwidth: room.bandwidth,
        });
    });
}

function updateRoomsList() {
    const rooms = Object.values(state.rooms).map(room => ({
        id: room.id,
        name: room.name,
    }));
    state.allClients.forEach(socket => {
        socketSend(socket, 'room:list', {rooms})
    });
}

wss.on('connection', (socket) => {

    state.allClients.push(socket);

    socket.on('message', message => {

        let data
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.error('unable to parse incoming message:', message);
            return;
        }
        switch (data.event) {
            case 'room:list': {
                updateRoomsList();
                break;
            }
            case 'room:create': {
                const id = uniqueId();
                const roomName = data.name;
                logger.log(`Create room ${id}`);
                state.rooms[id] = {
                    id,
                    name: roomName,
                    parties: [],
                    bandwidth: 300,
                };
                updateRoomsList();
                break;
            }
            case 'room:join': {
                const roomId = data.id;
                const partyName = data.name;
                if (roomId in state.rooms) {
                    logger.log(`"${partyName}" joins room ${roomId}`);
                    state.rooms[roomId].parties.push({
                        name: partyName,
                        socket: socket,
                    });
                    updateRoom(state.rooms[roomId]);
                    socketSend(socket, 'room:joined', {id: roomId});
                } else {
                    logger.log(`No room with id ${roomId}`);
                }
                break;
            }
            case 'room:set-bandwidth': {
                const roomId = data.id;
                const bandwidth = data.bandwidth;
                if (roomId in state.rooms) {
                    logger.log(`Set bandwidth to ${bandwidth} Kb/s for room "${state.rooms[roomId].name}"`);
                    state.rooms[roomId].bandwidth = Number(bandwidth);
                    updateRoom(state.rooms[roomId]);
                } else {
                    logger.log(`room:set-bandwidth - No room with id ${roomId}`);
                }
                break;
            }
            case 'webrtc:offer': {
                const roomId = data.id;
                if (roomId in state.rooms) {
                    logger.log(`Send webrtc:offer`);
                    state.rooms[roomId].parties.forEach(party => {
                        if (party.socket !== socket) {
                            socketSend(party.socket, 'webrtc:offer', data);
                        }
                    });
                } else {
                    logger.log(`webrtc:offer - No room with id ${roomId}`);
                }
                break;
            }
            case 'webrtc:answer': {
                const roomId = data.id;
                if (roomId in state.rooms) {
                    logger.log(`Send webrtc:answer`);
                    state.rooms[roomId].parties.forEach(party => {
                        if (party.socket !== socket) {
                            socketSend(party.socket, 'webrtc:answer', data);
                        }
                    });
                } else {
                    logger.log(`webrtc:answer - No room with id ${roomId}`);
                }
                break;
            }
            case 'webrtc:ice-candidate': {
                const roomId = data.id;
                if (roomId in state.rooms) {
                    logger.log(`Send webrtc:ice-candidate`);
                    state.rooms[roomId].parties.forEach(party => {
                        if (party.socket !== socket) {
                            socketSend(party.socket, 'webrtc:ice-candidate', data);
                        }
                    });
                } else {
                    logger.log(`webrtc:ice-candidate - No room with id ${roomId}`);
                }
                break;
            }
        }
    });

    socket.on('close', () => {
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
