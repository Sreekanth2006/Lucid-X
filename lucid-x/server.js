const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Temp directory for audio files
const tempDir = path.join(__dirname, '..', 'temp_audio');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Multer for audio upload
const upload = multer({ dest: tempDir });

// Routes for different interfaces
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/patient', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'patient.html'));
});

app.get('/therapist', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'therapist.html'));
});

app.get('/realtime', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'realtime.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 🎤 API Endpoint for Real-Time Audio Emotion Detection
app.post('/api/emotion/audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const audioPath = req.file.path;
        
        // Call Python emotion recognizer with UTF-8 encoding
        const pythonScript = path.join(__dirname, '..', 'train.py');
        const result = execSync(`python "${pythonScript}" --audio "${audioPath}"`, {
            encoding: 'utf-8',
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        // Parse result - extract JSON from output (last line)
        const lines = result.trim().split('\n');
        const jsonLine = lines.find(line => line.startsWith('{'));
        
        if (!jsonLine) {
            return res.json({
                success: false,
                emotion: 'ERROR',
                confidence: 0,
                error: 'No JSON output from emotion analyzer'
            });
        }
        
        const emotionData = JSON.parse(jsonLine);

        // Clean up temp file
        if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
        }

        res.json({
            success: true,
            emotion: emotionData.emotion,
            confidence: emotionData.confidence,
            allScores: emotionData.all_scores,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ Emotion detection error:', error);
        // Clean up temp file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.json({
            success: false,
            emotion: 'ERROR',
            confidence: 0,
            error: error.message
        });
    }
});

// Room management
const rooms = new Map();

// Emotion data storage for analytics
const emotionDataStore = new Map(); // sessionId -> array of emotion data

io.on('connection', (socket) => {
    console.log('✅ A user connected with Socket ID:', socket.id);

    // Join room logic
    socket.on('join-room', (roomId) => {
        console.log(`🚪 User ${socket.id} joining room: ${roomId}`);
        socket.join(roomId);
        
        // Track room participants
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(socket.id);
        
        // Broadcast to everyone else in the room
        socket.to(roomId).emit('user-connected', socket.id);
        
        console.log(`📊 Room ${roomId} now has ${rooms.get(roomId).size} participants`);
    });

    // Route Call Offer
    socket.on('send-offer', ({ offer, receiverId }) => {
        console.log(`📞 Routing offer from ${socket.id} to ${receiverId}`);
        socket.to(receiverId).emit('receive-offer', { offer, callerId: socket.id });
    });

    // Route Call Answer
    socket.on('send-answer', ({ answer, callerId }) => {
        console.log(`✅ Routing answer from ${socket.id} to ${callerId}`);
        socket.to(callerId).emit('receive-answer', answer);
    });

    // Route Network Data
    socket.on('send-ice-candidate', ({ candidate, targetUserId }) => {
        socket.to(targetUserId).emit('receive-ice-candidate', candidate);
    });

    // Handle Emotion Data from Patient
    socket.on('emotion-data', (emotionData) => {
        console.log(`😊 Received emotion data from ${socket.id}:`, emotionData.emotion, `${emotionData.confidence}%`);
        
        // Store emotion data for analytics
        if (emotionData.sessionId) {
            if (!emotionDataStore.has(emotionData.sessionId)) {
                emotionDataStore.set(emotionData.sessionId, []);
            }
            emotionDataStore.get(emotionData.sessionId).push({
                ...emotionData,
                timestamp: Date.now(),
                socketId: socket.id
            });
            
            // Keep only last 1000 emotion records to prevent memory issues
            const sessionData = emotionDataStore.get(emotionData.sessionId);
            if (sessionData.length > 1000) {
                sessionData.splice(0, sessionData.length - 1000);
            }
        }
        
        // Forward emotion data to therapist in the same room
        // Find which room the patient is in
        for (const [roomId, participants] of rooms.entries()) {
            if (participants.has(socket.id)) {
                // Send to all other participants in the room (therapist)
                socket.to(roomId).emit('patient-emotion-update', emotionData);
                console.log(`📤 Forwarded emotion data to room ${roomId}`);
                break;
            }
        }
    });

    // Get emotion analytics endpoint
    socket.on('get-emotion-analytics', (sessionId) => {
        if (emotionDataStore.has(sessionId)) {
            const data = emotionDataStore.get(sessionId);
            socket.emit('emotion-analytics-response', {
                sessionId,
                data,
                totalRecords: data.length
            });
        } else {
            socket.emit('emotion-analytics-response', {
                sessionId,
                data: [],
                totalRecords: 0
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
        
        // Find and remove user from all rooms
        for (const [roomId, participants] of rooms.entries()) {
            if (participants.has(socket.id)) {
                participants.delete(socket.id);
                socket.to(roomId).emit('user-disconnected', socket.id);
                console.log(`📊 User ${socket.id} left room ${roomId}. ${participants.size} participants remaining`);
                
                // Clean up empty rooms
                if (participants.size === 0) {
                    rooms.delete(roomId);
                    console.log(`🧹 Cleaned up empty room: ${roomId}`);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Lucid-X Server running on http://localhost:${PORT}`);
});