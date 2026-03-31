// public/app.js
const socket = io();
const videoGrid = document.getElementById('video-grid');

const myVideo = document.createElement('video');
myVideo.muted = true; 
myVideo.autoplay = true; 
myVideo.playsInline = true;

let localStream;
let peerConnection;
let isMicEnabled = true;
let isCamEnabled = true;

const configuration = {
    'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }]
};

// --- ML: FACE-API.JS SETUP ---
const aiStatus = document.getElementById('ai-status');
const emotionDataContainer = document.getElementById('emotion-data');
const dominantEmotionText = document.getElementById('dominant-emotion');

let modelsLoaded = false;

// Load the neural network models from our local folder
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/models')
]).then(() => {
    console.log("🧠 ML Models loaded successfully.");
    aiStatus.innerText = "ML Models Active. Waiting for video...";
    modelsLoaded = true;
}).catch(err => {
    console.error("❌ Failed to load ML models:", err);
    aiStatus.innerText = "Error loading ML models. Check console.";
    aiStatus.style.color = "var(--danger-color)";
});

// Function to start analyzing the video feed
function startEmotionDetection(videoElement) {
    if (!modelsLoaded) return;
    
    aiStatus.style.display = 'none';
    emotionDataContainer.style.display = 'flex';

    // Run inference every 500ms
    setInterval(async () => {
        // If camera is turned off by user, skip detection
        if (!isCamEnabled) {
            dominantEmotionText.innerText = "Camera Off";
            dominantEmotionText.style.color = "var(--text-secondary)";
            return;
        }

        const detections = await faceapi.detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
        
        if (detections) {
            // Extract the highest probability emotion
            const expressions = detections.expressions;
            const dominantEmotion = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
            
            // Update the UI
            dominantEmotionText.innerText = dominantEmotion;
            
            // Optional: Color code the emotions based on the paper's categories
            const positiveEmotions = ['happy', 'surprised'];
            const negativeEmotions = ['sad', 'angry', 'fearful', 'disgusted'];
            
            if (positiveEmotions.includes(dominantEmotion)) {
                dominantEmotionText.style.color = "#34d399"; // Green
            } else if (negativeEmotions.includes(dominantEmotion)) {
                dominantEmotionText.style.color = "var(--danger-color)"; // Red
            } else {
                dominantEmotionText.style.color = "var(--text-primary)"; // Neutral White
            }
        } else {
            dominantEmotionText.innerText = "No Face Detected";
            dominantEmotionText.style.color = "var(--text-secondary)";
        }
    }, 500);
}

// --- WEBRTC & SOCKET LOGIC ---
socket.on('connect', () => {
    console.log('🔌 Connected to signaling server. My ID:', socket.id);
    
    navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    }).then(stream => {
        console.log("🎥 Webcam accessed successfully.");
        localStream = stream;
        addVideoStream(myVideo, stream);

        // Start the ML analysis on our local video feed!
        myVideo.addEventListener('play', () => {
            startEmotionDetection(myVideo);
        });

        console.log("🚪 Joining room 'lucid-x-room'...");
        socket.emit('join-room', 'lucid-x-room');
    }).catch(err => {
        console.error("❌ Failed to get local stream.", err);
    });
});

socket.on('user-connected', userId => {
    console.log('👋 New user connected. Initiating call to:', userId);
    callUser(userId);
});

socket.on('receive-offer', async ({ offer, callerId }) => {
    console.log('📥 Received call offer from:', callerId);
    peerConnection = createPeerConnection(callerId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    console.log('📤 Sending answer back to:', callerId);
    socket.emit('send-answer', { answer, callerId });
});

socket.on('receive-answer', async answer => {
    console.log('✅ Received call answer!');
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
});

socket.on('receive-ice-candidate', async candidate => {
    try {
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (e) {
        console.error('❌ Error adding received ice candidate', e);
    }
});

// --- HELPER FUNCTIONS ---

function callUser(userId) {
    peerConnection = createPeerConnection(userId);
    peerConnection.createOffer().then(offer => {
        peerConnection.setLocalDescription(offer);
        console.log('📤 Sending offer to:', userId);
        socket.emit('send-offer', { offer, receiverId: userId });
    });
}

function createPeerConnection(targetUserId) {
    console.log('🔗 Creating Peer Connection for:', targetUserId);
    const pc = new RTCPeerConnection(configuration);

    // Create an empty stream to catch incoming tracks
    const remoteStream = new MediaStream();

    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    pc.ontrack = event => {
        console.log(`📺 Remote track received (${event.track.kind})`);
        
        // Add the incoming raw track (audio or video) to our custom stream
        remoteStream.addTrack(event.track);

        let remoteVideo = document.getElementById('remote-video');
        
        if (!remoteVideo) {
            remoteVideo = document.createElement('video');
            remoteVideo.id = 'remote-video';
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            
            // Feed our custom stream to the video player
            addVideoStream(remoteVideo, remoteStream);
        }
    };

    pc.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('send-ice-candidate', { candidate: event.candidate, targetUserId });
        }
    };

    return pc;
}

function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.error("Browser blocked autoplay:", e));
    });
    videoGrid.append(video);
}

// --- UI CONTROLS LOGIC ---

const toggleMicBtn = document.getElementById('toggle-mic');
const toggleCamBtn = document.getElementById('toggle-cam');
const endCallBtn = document.getElementById('end-call');

// Toggle Microphone
toggleMicBtn.addEventListener('click', () => {
    if (localStream) {
        isMicEnabled = !isMicEnabled;
        // FIXED: Added to correctly target all audio tracks
        localStream.getAudioTracks().forEach(track => {
            track.enabled = isMicEnabled;
        });
        
        toggleMicBtn.innerHTML = `<span class="material-symbols-outlined">${isMicEnabled ? 'mic' : 'mic_off'}</span>`;
        if (isMicEnabled) {
            toggleMicBtn.classList.remove('off');
        } else {
            toggleMicBtn.classList.add('off');
        }
    }
});

// Toggle Camera
toggleCamBtn.addEventListener('click', () => {
    if (localStream) {
        isCamEnabled = !isCamEnabled;
        // FIXED: Added to correctly target all video tracks
        localStream.getVideoTracks().forEach(track => {
            track.enabled = isCamEnabled;
        });
        
        toggleCamBtn.innerHTML = `<span class="material-symbols-outlined">${isCamEnabled ? 'videocam' : 'videocam_off'}</span>`;
        if (isCamEnabled) {
            toggleCamBtn.classList.remove('off');
            myVideo.classList.remove('camera-off'); // Make video visible again
        } else {
            toggleCamBtn.classList.add('off');
            myVideo.classList.add('camera-off');    // Dim the local video so user knows it's off
        }
    }
});

// End Call
endCallBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to end the consultation?")) {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        socket.disconnect();
        // Clear the screen and show a clean exit message
        document.body.innerHTML = `
            <div style="display: flex; height: 100vh; justify-content: center; align-items: center; background-color: #0b1120; color: #f8fafc; font-family: sans-serif;">
                <h2>Consultation Ended. Thank you.</h2>
            </div>
        `;
    }
});