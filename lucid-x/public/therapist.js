// Therapist Dashboard JavaScript
const socket = io();
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const localVideoOverlay = document.getElementById('local-video-overlay');
const remoteVideoOverlay = document.getElementById('remote-video-overlay');

const connectionStatus = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');
const sessionId = document.getElementById('session-id');
const sessionDuration = document.getElementById('session-duration');
const connectionQuality = document.getElementById('connection-quality');

// AI Analysis elements
const aiStatus = document.getElementById('ai-status');
const emotionData = document.getElementById('emotion-data');
const dominantEmotion = document.getElementById('dominant-emotion');
const confidenceValue = document.getElementById('confidence-value');
const confidenceFill = document.getElementById('confidence-fill');

// Session elements
const sessionNotes = document.getElementById('session-notes');
const saveNotesBtn = document.getElementById('save-notes');

let localStream;
let peerConnection;
let sessionStartTime;
let durationInterval;
let emotionDetectionInterval;

const configuration = {
    'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }]
};

// AI Model setup
let modelsLoaded = false;

// Load face-api models
async function loadTherapistModels() {
    try {
        console.log('🧠 Therapist: Loading emotion recognition models...');
        aiStatus.textContent = 'Loading AI Models...';
        
        const modelUri = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
        
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(modelUri),
            faceapi.nets.faceExpressionNet.loadFromUri(modelUri)
        ]);
        
        console.log("🧠 Therapist: ML Models loaded successfully.");
        aiStatus.textContent = "AI Models Active. Ready for analysis.";
        modelsLoaded = true;
    } catch (err) {
        console.error("❌ Failed to load ML models:", err);
        aiStatus.textContent = "Error loading AI models";
        aiStatus.style.color = "var(--danger-color)";
        modelsLoaded = false;
    }
}

// Load models on startup
loadTherapistModels();

// Update connection status
function updateConnectionStatus(connected, text) {
    connectionStatus.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
    statusText.textContent = text;
}

// Generate session ID
function generateSessionId() {
    return 'THRAP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Update session duration
function updateDuration() {
    if (sessionStartTime) {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        sessionDuration.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Emotion detection function
function startEmotionDetection(videoElement) {
    if (!modelsLoaded) return;
    
    aiStatus.style.display = 'none';
    emotionData.style.display = 'block';

    emotionDetectionInterval = setInterval(async () => {
        // Skip detection if patient video is not available
        if (!videoElement.srcObject || videoElement.paused || videoElement.ended) {
            dominantEmotion.textContent = "No Video";
            confidenceValue.textContent = "0%";
            confidenceFill.style.width = "0%";
            return;
        }

        try {
            // Use optimized detection options for better accuracy
            const options = new faceapi.TinyFaceDetectorOptions({
                inputSize: 416,
                scoreThreshold: 0.5
            });

            const detections = await faceapi
                .detectSingleFace(videoElement, options)
                .withFaceExpressions();
            
            if (detections && detections.expressions) {
                const expressions = detections.expressions;
                const dominantEmotionKey = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
                const confidence = Math.round(expressions[dominantEmotionKey] * 100);
                
                // Update UI
                dominantEmotion.textContent = dominantEmotionKey.charAt(0).toUpperCase() + dominantEmotionKey.slice(1);
                confidenceValue.textContent = `${confidence}%`;
                confidenceFill.style.width = `${confidence}%`;
            
                // Color code emotions
                const positiveEmotions = ['happy', 'surprised'];
                const negativeEmotions = ['sad', 'angry', 'fearful', 'disgusted'];
                
                if (positiveEmotions.includes(dominantEmotionKey)) {
                    dominantEmotion.style.color = "#34d399";
                    confidenceFill.style.backgroundColor = "#34d399";
                } else if (negativeEmotions.includes(dominantEmotionKey)) {
                    dominantEmotion.style.color = "var(--danger-color)";
                    confidenceFill.style.backgroundColor = "var(--danger-color)";
                } else {
                    dominantEmotion.style.color = "var(--text-primary)";
                    confidenceFill.style.backgroundColor = "var(--accent-color)";
                }
            } else {
                dominantEmotion.textContent = "No Face Detected";
                confidenceValue.textContent = "0%";
                confidenceFill.style.width = "0%";
            }
        } catch (error) {
            console.error('Error in emotion detection:', error);
            // Continue silently on detection errors
        }
    }, 1000);
}

// Initialize therapist dashboard
socket.on('connect', () => {
    console.log('🔌 Therapist connected to signaling server. ID:', socket.id);
    updateConnectionStatus(true, 'Connected');
    
    sessionId.textContent = generateSessionId();
    connectionQuality.textContent = 'Good';
    
    navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    }).then(stream => {
        console.log("🎥 Therapist webcam accessed successfully.");
        localStream = stream;
        localVideo.srcObject = stream;
        
        // Hide overlay when video starts
        localVideo.addEventListener('loadedmetadata', () => {
            localVideoOverlay.style.display = 'none';
        });

        // Join therapist room
        socket.emit('join-room', 'lucid-x-room');
    }).catch(err => {
        console.error("❌ Failed to get therapist local stream.", err);
        updateConnectionStatus(false, 'Camera/Mic Error');
    });
});

// Handle patient connection
socket.on('user-connected', userId => {
    console.log('👋 Patient connected. Starting call with:', userId);
    connectionQuality.textContent = 'Connected';
    sessionStartTime = Date.now();
    durationInterval = setInterval(updateDuration, 1000);
    callUser(userId);
});

// Handle patient disconnection
socket.on('user-disconnected', () => {
    console.log('👋 Patient disconnected');
    connectionQuality.textContent = 'Patient disconnected';
    remoteVideoOverlay.style.display = 'flex';
    if (durationInterval) {
        clearInterval(durationInterval);
    }
    if (emotionDetectionInterval) {
        clearInterval(emotionDetectionInterval);
    }
});

// WebRTC signaling handlers
socket.on('receive-offer', async ({ offer, callerId }) => {
    console.log('📥 Received call offer from patient:', callerId);
    peerConnection = createPeerConnection(callerId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    console.log('📤 Sending answer to patient:', callerId);
    socket.emit('send-answer', { answer, callerId });
});

socket.on('receive-answer', async answer => {
    console.log('✅ Received call answer from patient!');
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

// WebRTC functions
function callUser(userId) {
    peerConnection = createPeerConnection(userId);
    peerConnection.createOffer().then(offer => {
        peerConnection.setLocalDescription(offer);
        console.log('📤 Sending offer to patient:', userId);
        socket.emit('send-offer', { offer, receiverId: userId });
    });
}

function createPeerConnection(targetUserId) {
    console.log('🔗 Creating Peer Connection for therapist with patient:', targetUserId);
    const pc = new RTCPeerConnection(configuration);

    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    pc.ontrack = event => {
        console.log(`📺 Remote track received from patient (${event.track.kind})`);
        remoteVideo.srcObject = event.streams[0];
        remoteVideoOverlay.style.display = 'none';
        
        // Start emotion detection when patient video is available
        if (modelsLoaded && !emotionDetectionInterval) {
            startEmotionDetection(remoteVideo);
        }
    };

    pc.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('send-ice-candidate', { candidate: event.candidate, targetUserId });
        }
    };

    // Monitor connection quality
    pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log('Connection state:', state);
        switch(state) {
            case 'connected':
                connectionQuality.textContent = 'Excellent';
                break;
            case 'disconnected':
                connectionQuality.textContent = 'Poor';
                break;
            case 'failed':
                connectionQuality.textContent = 'Failed';
                break;
            default:
                connectionQuality.textContent = 'Good';
        }
    };

    return pc;
}

// UI Controls
const toggleMicBtn = document.getElementById('toggle-mic');
const toggleCamBtn = document.getElementById('toggle-cam');
const endCallBtn = document.getElementById('end-call');

let isMicEnabled = true;
let isCamEnabled = true;

// Toggle Microphone
toggleMicBtn.addEventListener('click', () => {
    if (localStream) {
        isMicEnabled = !isMicEnabled;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = isMicEnabled;
        });
        
        toggleMicBtn.innerHTML = `<span class="material-symbols-outlined">${isMicEnabled ? 'mic' : 'mic_off'}</span>`;
        toggleMicBtn.classList.toggle('off', !isMicEnabled);
    }
});

// Toggle Camera
toggleCamBtn.addEventListener('click', () => {
    if (localStream) {
        isCamEnabled = !isCamEnabled;
        localStream.getVideoTracks().forEach(track => {
            track.enabled = isCamEnabled;
        });
        
        toggleCamBtn.innerHTML = `<span class="material-symbols-outlined">${isCamEnabled ? 'videocam' : 'videocam_off'}</span>`;
        toggleCamBtn.classList.toggle('off', !isCamEnabled);
        
        // Show/hide video overlay
        localVideoOverlay.style.display = isCamEnabled ? 'none' : 'flex';
    }
});

// End Call
endCallBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to end the consultation?")) {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (peerConnection) {
            peerConnection.close();
        }
        if (durationInterval) {
            clearInterval(durationInterval);
        }
        if (emotionDetectionInterval) {
            clearInterval(emotionDetectionInterval);
        }
        socket.disconnect();
        
        // Show end screen
        document.body.innerHTML = `
            <div class="end-screen">
                <div class="end-content">
                    <h2>Session Ended</h2>
                    <p>Thank you for using Lucid-X Teleconsultation</p>
                    <button onclick="location.reload()" class="btn-primary">Start New Session</button>
                </div>
            </div>
        `;
    }
});

// Save session notes
saveNotesBtn.addEventListener('click', () => {
    const notes = sessionNotes.value.trim();
    if (notes) {
        // In a real application, this would save to a database
        console.log('Saving session notes:', notes);
        
        // Show success feedback
        const originalText = saveNotesBtn.textContent;
        saveNotesBtn.textContent = 'Saved!';
        saveNotesBtn.style.backgroundColor = '#34d399';
        
        setTimeout(() => {
            saveNotesBtn.textContent = originalText;
            saveNotesBtn.style.backgroundColor = '';
        }, 2000);
    }
});

// Handle disconnection
socket.on('disconnect', () => {
    console.log('❌ Therapist disconnected from server');
    updateConnectionStatus(false, 'Disconnected');
    connectionQuality.textContent = 'Connection lost';
});
