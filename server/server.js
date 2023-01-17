const {Server} = require('socket.io');


const port = process.env.PORT || 5000;


function uniqueId() {
    return Math.random().toString(16).slice(2);
}

const logger = {
    log: (...args) => console.log((new Date).toJSON(), ...args),
};

const io = new Server(port, {
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
        party.socket.emit('room:update', {id: roomId, parties: roomParties});
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
        const delIndex = allClients.indexOf(socket);
        if (delIndex !== -1) {
            state.allClients.splice(delIndex, 1);
        }
        const emptyRooms = Object.keys(state.rooms).find(id => state.rooms[id].parties.length === 1 && state.rooms[id].parties[0].socket === socket);
        if (emptyRooms.length) {
            emptyRooms.forEach(id => {
                logger.log(`Delete room ${id}`);
                delete state.emptyRooms[id];
            });
            updateRoomsList();
        }
    });
});

logger.log(`Server started on port ${port}`);
