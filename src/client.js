import {io} from 'socket.io-client';
import {uniqueNamesGenerator, adjectives, animals} from 'unique-names-generator';

console.log('@@@ Socket.IO: ', io);

const userName = uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    length: 2,
    separator: ' ',
    style: 'capital',
});

const userNameElement = document.getElementById('user_name');
userNameElement.textContent = userName;

const roomsListElement = document.getElementById('rooms_list');
const newRoomNameInput = document.getElementById('new_room_name');
const createRoomButton = document.getElementById('create_room');
const joinRoomButton = document.getElementById('join_room');

const socket = io('wss://web-rtc-test.herokuapp.com', {
    autoConnect: true,
});

socket.emit('room:list');

createRoomButton.addEventListener('click', () => {
    if (!newRoomNameInput.value) {
        alert('New room name is empty');
        return;
    }
    if ([].find.call(roomsListElement.children, optionElement => optionElement.textContent === newRoomNameInput.value)) {
        alert('The room with such name already exists');
        return;
    }
    socket.emit('room:create', {
        name: newRoomNameInput.value,
    });
});

socket.on('room:list', data => {
    data.rooms.forEach(room => {
        const option = document.createElement('option');
        option.setAttribute('value', room.id);
        option.textContent = room.name;
        roomsListElement.innerHTML = '';
        roomsListElement.appendChild(option);
    });
});
