// Patient Portal JavaScript
const socket = io();
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const localVideoOverlay = document.getElementById('local-video-overlay');
const remoteVideoOverlay = document.getElementById('remote-video-overlay');

const connectionStatus = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');
const sessionId = document.getElementById('session-id');
const sessionStatus = document.getElementById('session-status');
const sessionDuration = document.getElementById('session-duration');

// Emotion Recognition Elements
const emotionStatus = document.getElementById('emotion-status');
const emotionDisplay = document.getElementById('emotion-display');
const patientEmotion = document.getElementById('patient-emotion');
const emotionConfidenceFill = document.getElementById('emotion-confidence-fill');
const emotionConfidenceValue = document.getElementById('emotion-confidence-value');

let localStream;
let peerConnection;
let sessionStartTime;
let durationInterval;
let emotionDetectionInterval;
let modelsLoaded = false;
let isCamEnabled = true;
let isMicEnabled = true;

const configuration = {
    'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }]
};

// Update connection status
function updateConnectionStatus(connected, text) {
    connectionStatus.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
    statusText.textContent = text;
}

// Generate session ID
function generateSessionId() {
    return 'PAT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
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

// Emotion Recognition Setup
async function loadEmotionModels() {
    try {
        console.log('🧠 Loading emotion recognition models...');
        emotionStatus.textContent = 'Loading AI Models...';
        
        // Use vladmandic face-api CDN - most reliable source
        const modelUri = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
        
        console.log(`🔄 Loading models from: ${modelUri}`);
        
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(modelUri),
            faceapi.nets.faceExpressionNet.loadFromUri(modelUri)
        ]);
        
        console.log('✅ Emotion recognition models loaded successfully');
        modelsLoaded = true;
        emotionStatus.textContent = 'AI Models Ready';
        emotionStatus.style.color = '#34d399';
        
        // Start emotion detection when video is ready
        if (localVideo.srcObject) {
            startEmotionDetection();
        }
    } catch (error) {
        console.error('❌ Failed to load emotion models:', error);
        emotionStatus.textContent = 'Error loading AI models';
        emotionStatus.style.color = 'var(--danger-color)';
        
        // Show more detailed error in console
        console.error('Model loading error details:', {
            message: error.message,
            stack: error.stack,
            faceApiVersion: faceapi.version || 'unknown'
        });
        
        // Fallback: Show manual emotion selection
        emotionStatus.textContent = 'AI Models Failed - Manual Mode';
        emotionStatus.style.color = '#f59e0b';
        showManualEmotionSelector();
    }
}

// Fallback manual emotion selector
function showManualEmotionSelector() {
    const emotionDisplay = document.getElementById('emotion-display');
    emotionDisplay.style.display = 'block';
    
    // Replace emotion display with manual selector
    emotionDisplay.innerHTML = `
        <div class="manual-emotion-selector">
            <h4>Manual Emotion Selection</h4>
            <p>AI models failed to load. Please select your current emotion:</p>
            <div class="emotion-buttons">
                <button class="emotion-btn" data-emotion="happy">😊 Happy</button>
                <button class="emotion-btn" data-emotion="sad">😢 Sad</button>
                <button class="emotion-btn" data-emotion="angry">😠 Angry</button>
                <button class="emotion-btn" data-emotion="disgusted">🤢 Disgusted</button>
                <button class="emotion-btn" data-emotion="fearful">😨 Fearful</button>
                <button class="emotion-btn" data-emotion="neutral">😐 Neutral</button>
                <button class="emotion-btn" data-emotion="surprised">😲 Surprised</button>
            </div>
            <div class="selected-emotion-display">
                <span class="label">Selected:</span>
                <span id="manual-emotion" class="emotion-value">None</span>
            </div>
        </div>
    `;
    
    // Add event listeners to emotion buttons
    const emotionButtons = emotionDisplay.querySelectorAll('.emotion-btn');
    emotionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const emotion = e.target.dataset.emotion;
            selectManualEmotion(emotion);
        });
    });
}

// Handle manual emotion selection
function selectManualEmotion(emotion) {
    const manualEmotionDisplay = document.getElementById('manual-emotion');
    manualEmotionDisplay.textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);
    
    // Update color
    const positiveEmotions = ['happy', 'surprised'];
    const negativeEmotions = ['sad', 'angry', 'disgusted', 'fearful'];
    
    let color;
    if (positiveEmotions.includes(emotion)) {
        color = '#34d399';
    } else if (negativeEmotions.includes(emotion)) {
        color = 'var(--danger-color)';
    } else {
        color = 'var(--accent-color)';
    }
    
    manualEmotionDisplay.style.color = color;
    
    // Send to server
    const emotionData = {
        emotion: emotion,
        confidence: 100, // Manual selection = 100% confidence
        timestamp: Date.now(),
        sessionId: sessionId.textContent,
        manual: true
    };
    
    socket.emit('emotion-data', emotionData);
    console.log(`📤 Manual emotion sent: ${emotion}`);
}

// Emotion Detection Function
async function startEmotionDetection() {
    if (!modelsLoaded || !localVideo.srcObject) {
        console.log('⏳ Waiting for models and video stream...', { modelsLoaded, hasVideo: !!localVideo.srcObject });
        return;
    }
    
    console.log('🎯 Starting emotion detection...');
    emotionStatus.style.display = 'none';
    emotionDisplay.style.display = 'block';
    
    // Clear any existing interval
    if (emotionDetectionInterval) {
        clearInterval(emotionDetectionInterval);
    }
    
    emotionDetectionInterval = setInterval(async () => {
        // Skip detection if camera is off or video is paused
        if (!isCamEnabled || localVideo.paused || localVideo.ended) {
            patientEmotion.textContent = 'Camera Off';
            emotionConfidenceValue.textContent = '0%';
            emotionConfidenceFill.style.width = '0%';
            return;
        }
        
        try {
            // Use optimized detection options for better accuracy
            const options = new faceapi.TinyFaceDetectorOptions({
                inputSize: 416,           // Higher resolution for better detection
                scoreThreshold: 0.5       // Confidence threshold for face detection
            });
            
            const detections = await faceapi
                .detectSingleFace(localVideo, options)
                .withFaceExpressions();
            
            if (detections && detections.expressions) {
                const expressions = detections.expressions;
                
                // Find the emotion with highest confidence
                const emotionEntries = Object.entries(expressions);
                const dominantEmotion = emotionEntries.reduce((a, b) => a[1] > b[1] ? a : b);
                const emotionName = dominantEmotion[0];
                const confidence = dominantEmotion[1];
                
                // Map to the seven required categories
                const mappedEmotion = mapToSevenEmotions(emotionName);
                const confidencePercentage = Math.round(confidence * 100);
                
                console.log(`🎭 Dominant emotion: ${mappedEmotion} (${confidencePercentage}%)`);
                
                // Update UI
                patientEmotion.textContent = mappedEmotion.charAt(0).toUpperCase() + mappedEmotion.slice(1);
                emotionConfidenceValue.textContent = `${confidencePercentage}%`;
                emotionConfidenceFill.style.width = `${confidencePercentage}%`;
                
                // Color code emotions
                updateEmotionColor(mappedEmotion, confidencePercentage);
                
                // Send emotion data to server
                const emotionData = {
                    emotion: mappedEmotion,
                    confidence: confidencePercentage,
                    timestamp: Date.now(),
                    sessionId: sessionId.textContent,
                    allExpressions: expressions
                };
                
                socket.emit('emotion-data', emotionData);
                
                console.log(`� Emotion data sent: ${mappedEmotion} (${confidencePercentage}%)`);
            } else {
                console.log('😔 No face or expressions detected');
                // No face detected
                patientEmotion.textContent = 'No Face Detected';
                emotionConfidenceValue.textContent = '0%';
                emotionConfidenceFill.style.width = '0%';
                
                // Send no-face detection to server
                socket.emit('emotion-data', {
                    emotion: 'no_face',
                    confidence: 0,
                    timestamp: Date.now(),
                    sessionId: sessionId.textContent
                });
            }
        } catch (error) {
            console.error('❌ Error during emotion detection:', error);
            patientEmotion.textContent = 'Detection Error';
            emotionConfidenceValue.textContent = '0%';
            emotionConfidenceFill.style.width = '0%';
        }
    }, 500); // Analyze every 500ms as requested
}

// Map face-api emotions to the seven required categories
function mapToSevenEmotions(emotion) {
    const emotionMap = {
        'happy': 'happy',
        'sad': 'sad',
        'angry': 'angry',
        'disgusted': 'disgusted',
        'fearful': 'fearful',
        'neutral': 'neutral',
        'surprised': 'surprised'
    };
    
    return emotionMap[emotion] || 'neutral';
}

// Update emotion color based on type and confidence
function updateEmotionColor(emotion, confidence) {
    const positiveEmotions = ['happy', 'surprised'];
    const negativeEmotions = ['sad', 'angry', 'disgusted', 'fearful'];
    
    let color;
    if (positiveEmotions.includes(emotion)) {
        color = '#34d399'; // Green
    } else if (negativeEmotions.includes(emotion)) {
        color = 'var(--danger-color)'; // Red
    } else {
        color = 'var(--accent-color)'; // Blue for neutral
    }
    
    patientEmotion.style.color = color;
    emotionConfidenceFill.style.backgroundColor = color;
}

// Initialize patient portal
socket.on('connect', () => {
    console.log('🔌 Patient connected to signaling server. ID:', socket.id);
    updateConnectionStatus(true, 'Connected');
    
    sessionId.textContent = generateSessionId();
    sessionStatus.textContent = 'Waiting for therapist';
    
    navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    }).then(stream => {
        console.log("🎥 Patient webcam accessed successfully.");
        localStream = stream;
        localVideo.srcObject = stream;
        
        // Hide overlay when video starts
        localVideo.addEventListener('loadedmetadata', () => {
            localVideoOverlay.style.display = 'none';
        });
        
        // Start emotion detection when video starts playing
        localVideo.addEventListener('play', () => {
            if (modelsLoaded) {
                startEmotionDetection();
            }
        });

        // Join patient room
        socket.emit('join-room', 'lucid-x-room');
        sessionStatus.textContent = 'Ready for consultation';
        
        // Load emotion recognition models
        loadEmotionModels();
    }).catch(err => {
        console.error("❌ Failed to get patient local stream.", err);
        updateConnectionStatus(false, 'Camera/Mic Error');
    });
});

// Handle therapist connection
socket.on('user-connected', userId => {
    console.log('👋 Therapist connected. Starting call with:', userId);
    sessionStatus.textContent = 'Connected to therapist';
    sessionStartTime = Date.now();
    durationInterval = setInterval(updateDuration, 1000);
    callUser(userId);
});

// Handle therapist disconnection
socket.on('user-disconnected', () => {
    console.log('👋 Therapist disconnected');
    sessionStatus.textContent = 'Therapist disconnected';
    remoteVideoOverlay.style.display = 'flex';
    if (durationInterval) {
        clearInterval(durationInterval);
    }
});

// WebRTC signaling handlers
socket.on('receive-offer', async ({ offer, callerId }) => {
    console.log('📥 Received call offer from therapist:', callerId);
    peerConnection = createPeerConnection(callerId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    console.log('📤 Sending answer to therapist:', callerId);
    socket.emit('send-answer', { answer, callerId });
});

socket.on('receive-answer', async answer => {
    console.log('✅ Received call answer from therapist!');
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
        console.log('📤 Sending offer to therapist:', userId);
        socket.emit('send-offer', { offer, receiverId: userId });
    });
}

function createPeerConnection(targetUserId) {
    console.log('🔗 Creating Peer Connection for patient with therapist:', targetUserId);
    const pc = new RTCPeerConnection(configuration);

    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    pc.ontrack = event => {
        console.log(`📺 Remote track received from therapist (${event.track.kind})`);
        remoteVideo.srcObject = event.streams[0];
        remoteVideoOverlay.style.display = 'none';
    };

    pc.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('send-ice-candidate', { candidate: event.candidate, targetUserId });
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
                    <h2>Consultation Ended</h2>
                    <p>Thank you for using Lucid-X Teleconsultation</p>
                    <button onclick="location.reload()" class="btn-primary">Start New Session</button>
                </div>
            </div>
        `;
    }
});

// Handle disconnection
socket.on('disconnect', () => {
    console.log('❌ Patient disconnected from server');
    updateConnectionStatus(false, 'Disconnected');
    sessionStatus.textContent = 'Connection lost';
    
    // Clean up emotion detection
    if (emotionDetectionInterval) {
        clearInterval(emotionDetectionInterval);
    }
});

// Start loading models when page loads
window.addEventListener('load', () => {
    console.log('🚀 Patient portal loaded, starting emotion model initialization...');
    // Models will be loaded after video stream is established
    
    // Add manual trigger for debugging (press 'e' key)
    document.addEventListener('keydown', (event) => {
        if (event.key === 'e' || event.key === 'E') {
            console.log('🔘 Manual emotion detection trigger');
            if (modelsLoaded && localVideo.srcObject) {
                startEmotionDetection();
            } else {
                console.log('❌ Cannot start detection - models not loaded or video not ready');
                console.log('Models loaded:', modelsLoaded);
                console.log('Video ready:', !!localVideo.srcObject);
            }
        }
    });
});
