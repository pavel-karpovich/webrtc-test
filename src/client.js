import {uniqueNamesGenerator, adjectives, animals} from 'unique-names-generator';


const userName = uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    length: 2,
    separator: ' ',
    style: 'capital',
});
let userRoomId = null;
let bandwidth = 300;
let hasSDP = false;
let storedICECandidates = [];

const webRtcICEServers = [
    {urls: 'stun:stun.l.google.com:19302'},
    {urls: 'turn:oceanturn1.brightpattern.com:443', username: 'turnserver', credential: 'turnserverturnserver'},
];

const userNameSpan = document.getElementById('user_name');
const roomNameSpan = document.getElementById('room_name');
const currentBandwidthSpan = document.getElementById('current_bandwidth');
const inRoomSection = document.getElementById('in_room_section');
const bandwithSection = document.getElementById('bandwith_section');
const videoSection = document.getElementById('video_section');
userNameSpan.textContent = userName;

const roomsListElement = document.getElementById('rooms_list');
const roomPartiesListElement = document.getElementById('room_parties_list');
const newRoomNameInput = document.getElementById('new_room_name');
const createRoomButton = document.getElementById('create_room');
const joinRoomButton = document.getElementById('join_room');
const setBandwidthButton = document.getElementById('set_bandwidth');
const bandwidthInput = document.getElementById('bandwidth');
const shareScreenButton = document.getElementById('share_screen');
const videoElement = document.getElementById('video');

const socket = new WebSocket('wss://web-rtc-test.herokuapp.com');

function socketSend(event, data = {}) {
    socket.send(JSON.stringify({
        event,
        ...{},
    }));
}

socket.onopen = () => {
    socketSend('room:list');
};


const peerConnection = new RTCPeerConnection({iceServers: webRtcICEServers});
peerConnection.onicecandidate = function (event) {
    if (event.candidate) {
        socketSend('webrtc:ice-candidate', {
            id: userRoomId,
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
    }
};
peerConnection.ontrack = function (event) {
    if (event.streams && event.streams[0]) {
        console.log('peerConnection.ontrack set video stream');
        videoElement.srcObject = event.streams[0];
    }
};
let localStream = null;

function addICECandidate(iceCandidateData) {
    if (peerConnection.localDescription) {
        peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidateData)).then(() => {

        });
    } else {
        storedICECandidates.push(iceCandidateData);
    }
}

function setMediaBitrate(sdp, media, bitrate) {
    var lines = sdp.split('\n');
    var line = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('m=' + media) === 0) {
        line = i;
        break;
      }
    }
    if (line === -1) {
      console.debug('Could not find the m line for', media);
      return sdp;
    }
    console.debug('Found the m line for', media, 'at line', line);
  
    // Pass the m line
    line++;
  
    // Skip i and c lines
    while(lines[line].indexOf('i=') === 0 || lines[line].indexOf('c=') === 0) {
      line++;
    }
  
    // If we're on a b line, replace it
    if (lines[line].indexOf('b') === 0) {
      console.debug('Replaced b line at line', line);
      lines[line] = 'b=AS:' + bitrate;
      return lines.join('\n');
    }
    
    // Add a new b line
    console.debug('Adding new b line before line', line);
    var newLines = lines.slice(0, line);
    newLines.push('b=AS:' + bitrate);
    newLines = newLines.concat(lines.slice(line, lines.length));
    return newLines.join('\n');
}


function updateBandwidth(newBandwidth) {

    if (bandwidth !== newBandwidth && localStream) {
        console.log('Re-create WebRTC offer');
        peerConnection.createOffer({iceRestart: true}).then(data => {
            peerConnection.setLocalDescription(data).then(() => {
                const newSdp = setMediaBitrate(data.sdp, 'video', newBandwidth);
                socketSend('webrtc:offer', {
                    id: userRoomId,
                    sdp: newSdp,
                });
            });
        });
    }

    currentBandwidthSpan.textContent = newBandwidth;
    bandwidth = newBandwidth;
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
    socketSend('room:create', {
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
    socketSend('room:join', {
        id: selectedRoomId,
        name: userName,
    });
    userRoomId = selectedRoomId;
});

setBandwidthButton.addEventListener('click', () => {
    if (!bandwidthInput.value) {
        alert('Bandwith is empty');
        return;
    }
    const bandwidth = Number(bandwidthInput.value);
    if (isNaN(bandwidth)) {
        alert('Randwith is not a number');
        return;
    }
    socketSend('room:set-bandwidth', {
        id: userRoomId,
        bandwidth,
    });
});

shareScreenButton.addEventListener('click', () => {
    navigator.mediaDevices.getDisplayMedia().then(mediaStream => {
        localStream = mediaStream;
        mediaStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, mediaStream);
        })
        console.log('set local video stream');
        videoElement.srcObject = mediaStream;
        console.log('Create WebRTC offer');
        peerConnection.createOffer().then(data => {
            peerConnection.setLocalDescription(data).then(() => {
                const newSdp = setMediaBitrate(data.sdp, 'video', bandwidth);
                socketSend('webrtc:offer', {
                    id: userRoomId,
                    sdp: newSdp,
                });
            });
        });
    });
});

socket.onmessage = ({data: message}) => {
    let data
    try {
        data = JSON.parse(message);
    } catch (e) {
        console.error('Parsing incoming message error:', message);
        return;
    }
    switch (data.event) {
        case 'webrtc:offer':
            onWebRtcOffer(data);
            break;
        case 'webrtc:answer':
            onWebRtcAnswer(data);
            break;
        case 'webrtc:ice-candidate':
            onWebRtcIceCandidate(data);
            break;
        case 'room:list':
            onRoomList(data);
            break;
        case 'room:joined':
            onRoomJoined(data);
            break;
        case 'room:update':
            onRoomUpdate(data);
            break;
    }
};

function onWebRtcOffer(offerData) {
    if (offerData.id !== userRoomId) {
        alert('Get webRTC offer for a wrong room:', offerData.id);
        return;
    }
    peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: offerData.sdp,
    })).then(() => {
        console.log('Create WebRTC anaswer');
        peerConnection.createAnswer().then(data => {
            peerConnection.setLocalDescription(data).then(() => {
                const newSdp = setMediaBitrate(data.sdp, 'video', bandwidth);
                storedICECandidates.forEach(addICECandidate);
                storedICECandidates = [];
                socketSend('webrtc:answer', {
                    id: offerData.id,
                    sdp: newSdp,
                });
            });
        });
    });
}

function onWebRtcAnswer(answerData) {
    if (answerData.id !== userRoomId) {
        console.error('Get webRTC answer for a wrong room:', answerData.id);
        return;
    }
    peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: answerData.sdp,
    })).then(() => {

    });
}

function onWebRtcIceCandidate(iceCandidateData) {
    if (iceCandidateData.id !== userRoomId) {
        console.error('Get ICE Candidate for a wrong room:', iceCandidateData.id);
        return;
    }
    addICECandidate(iceCandidateData);
}

function onRoomList(data) {
    data.rooms.forEach(room => {
        const option = document.createElement('option');
        option.setAttribute('value', room.id);
        option.textContent = room.name;
        roomsListElement.innerHTML = '';
        roomsListElement.appendChild(option);
    });
}

function onRoomJoined(data) {

    const roomOption = [].find.call(roomsListElement.children, optionElement => optionElement.value === data.id);
    if (!roomOption) {
        console.error('Room:join for id', data.id, 'but there is no known room with such id');
        return;
    }
    roomNameSpan.textContent = roomOption.textContent;

    inRoomSection.style.display = 'block';
    bandwithSection.style.display = 'block';
    videoSection.style.display = 'block';
}

function onRoomUpdate(data) {
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
}
