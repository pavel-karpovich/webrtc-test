import {io} from 'socket.io-client';
import {uniqueNamesGenerator, adjectives, animals} from 'unique-names-generator';

console.log('@@@ Socket.IO: ', io);

const userName = uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    length: 2,
    separator: ' ',
    style: 'capital',
});
let userRoomId = null;

const userNameSpan = document.getElementById('user_name');
const roomNameSpan = document.getElementById('room_name');
const currentBandwidthSpan = document.getElementById('current_bandwidth');
const inRoomSection = document.getElementById('in_room_section');
const bandwithSection = document.getElementById('bandwith_section');
userNameSpan.textContent = userName;

const roomsListElement = document.getElementById('rooms_list');
const roomPartiesListElement = document.getElementById('room_parties_list');
const newRoomNameInput = document.getElementById('new_room_name');
const createRoomButton = document.getElementById('create_room');
const joinRoomButton = document.getElementById('join_room');
const setBandwidthButton = document.getElementById('set_bandwidth');
const bandwidthInput = document.getElementById('bandwidth');

const socket = io('wss://web-rtc-test.herokuapp.com', {
    autoConnect: true,
});

socket.emit('room:list');

function updateBandwidth(bandwidth) {
    currentBandwidthSpan.textContent = bandwidth;
}

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

roomsListElement.addEventListener('change', () => {
    joinRoomButton.removeAttribute('disabled');
});

joinRoomButton.addEventListener('click', () => {
    if (!roomsListElement.selectedOptions.length) {
        alert('Room is not selected');
        return;
    }
    const selectedRoomId = roomsListElement.selectedOptions[0].value;
    socket.emit('room:join', {
        id: selectedRoomId,
        name: userName,
    });
    userRoomId = selectedRoomId;
});

setBandwidthButton.addEventListener('button', () => {
    if (!bandwidthInput.value) {
        alert('Bandwith is empty');
        return;
    }
    const bandwidth = Number(bandwidthInput.value);
    if (isNaN(bandwidth)) {
        alert('Randwith is not a number');
        return;
    }
    socket.emit('room:set-bandwidth', {
        id: userRoomId,
        bandwidth,
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

socket.on('room:joined', data => {

    const roomOption = [].find.call(roomsListElement.children, optionElement => optionElement.value === data.id);
    if (!roomOption) {
        console.error('Room:join for id', data.id, 'but there is no known room with such id');
        return;
    }
    roomNameSpan.textContent = roomOption.textContent;

    roomPartiesListElement.innerHTML = '';
    const yourPartyOption = document.createElement('optgroup');
    yourPartyOption.setAttribute('label', userName);
    roomPartiesListElement.appendChild(yourPartyOption);

    inRoomSection.style.display = 'block';
    bandwithSection.style.display = 'block';
});

socket.on('room:update', data => {
    if (userRoomId !== data.id) {
        console.error('The client thinks we are in a room', userRoomId, 'but server sends update for room', data.id);
        return;
    }
    roomPartiesListElement.innerHTML = '';
    data.parties.forEach(partyName => {
        const partyOption = document.createElement('optgroup');
        partyOption.setAttribute('label', partyName);
        roomPartiesListElement.appendChild(partyOption);
    });
    updateBandwidth(data.bandwidth);
});
