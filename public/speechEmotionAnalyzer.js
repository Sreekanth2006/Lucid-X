/**
 * Speech Emotion Analyzer
 * Captures audio from patient microphone and sends to Python backend for emotion analysis
 * 
 * How it works:
 * 1. Captures audio chunks every 2 seconds (2000ms)
 * 2. Converts audio to WAV format
 * 3. Sends to Python Flask backend for wav2vec2 analysis
 * 4. Receives emotion scores (happy, sad, angry, neutral, etc.)
 * 5. Emits emotion-speech-data via Socket.io to therapist
 */

class SpeechEmotionAnalyzer {
    constructor(audioStream, socket) {
        this.socket = socket;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.chunkDuration = 2000; // 2 seconds
        this.recordingInterval = null;
        this.sessionId = null;
        
        // Initialize recorder
        try {
            this.mediaRecorder = new MediaRecorder(audioStream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processAudioChunk();
            };
            
            console.log('🎤 Speech Emotion Analyzer initialized');
        } catch (error) {
            console.error('❌ Failed to initialize MediaRecorder:', error);
        }
    }
    
    /**
     * Start capturing and analyzing speech emotion
     */
    startAnalysis(sessionId) {
        if (!this.mediaRecorder) {
            console.error('❌ MediaRecorder not initialized');
            return;
        }
        
        this.sessionId = sessionId;
        this.isRecording = true;
        console.log('🎤 Starting speech emotion analysis for session:', sessionId);
        
        // Start recording
        this.mediaRecorder.start();
        
        // Every 2 seconds, stop recording and process the chunk
        this.recordingInterval = setInterval(() => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
                // After processing, start a new recording
                setTimeout(() => {
                    if (this.isRecording && this.mediaRecorder) {
                        this.audioChunks = [];
                        this.mediaRecorder.start();
                    }
                }, 100);
            }
        }, this.chunkDuration);
    }
    
    /**
     * Stop analyzing speech emotion
     */
    stopAnalysis() {
        console.log('🎤 Stopping speech emotion analysis');
        this.isRecording = false;
        
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
        }
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        
        this.audioChunks = [];
    }
    
    /**
     * Process audio chunk: convert to WAV and send to backend
     */
    async processAudioChunk() {
        if (this.audioChunks.length === 0) {
            console.log('⏭️  No audio data to process');
            return;
        }
        
        try {
            // Create blob from audio chunks
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
            
            // Check if audio is silent (very small file size usually means no speech)
            if (audioBlob.size < 1000) {
                console.log('🔇 Audio chunk too small (silent), skipping analysis');
                return;
            }
            
            console.log(`🎤 Processing audio chunk (${audioBlob.size} bytes)...`);
            
            // Send to Python backend for analysis
            this.sendToBackend(audioBlob);
        } catch (error) {
            console.error('❌ Error processing audio chunk:', error);
        }
    }
    
    /**
     * Send audio blob to Python Flask backend for emotion analysis
     */
    sendToBackend(audioBlob) {
        // Create FormData to send audio file
        const formData = new FormData();
        formData.append('audio', audioBlob, 'speech.webm');
        formData.append('sessionId', this.sessionId);
        formData.append('timestamp', Date.now());
        
        // Send to Python backend
        // Backend URL will be http://localhost:5000/analyze-speech
        fetch('http://localhost:5000/analyze-speech', {
            method: 'POST',
            body: formData,
            mode: 'cors'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('✅ Speech emotion analysis result:', data);
            
            // Emit emotion data via Socket.io
            if (data.emotion && data.confidence !== undefined) {
                const emotionData = {
                    source: 'speech',
                    emotion: data.emotion,
                    confidence: data.confidence,
                    timestamp: Date.now(),
                    sessionId: this.sessionId,
                    allEmotions: data.allEmotions || {}
                };
                
                this.socket.emit('emotion-data', emotionData);
                console.log(`🎤 Speech emotion emitted: ${data.emotion} (${Math.round(data.confidence * 100)}%)`);
            }
        })
        .catch(error => {
            console.warn('⚠️  Speech analysis failed (backend may not be running):', error.message);
            // Silently fail - this is optional for Phase 2
            // In production, you might want to implement fallback logic
        });
    }
}

/**
 * Export for use in patient.js
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpeechEmotionAnalyzer;
}
