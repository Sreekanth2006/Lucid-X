/**
 * Audio Emotion Recognition Module
 * Captures and analyzes audio emotion from microphone input
 * Extracts audio features and predicts emotion from speech
 * 
 * @module audioEmotionRecognizer
 * @requires Web Audio API
 */

class AudioEmotionRecognizer {
    constructor(config = {}) {
        this.config = {
            sampleRate: config.sampleRate || 16000,
            fftSize: config.fftSize || 2048,
            windowSize: config.windowSize || 512,
            minDecibels: config.minDecibels || -100,
            maxDecibels: config.maxDecibels || -10,
            smoothingTimeConstant: config.smoothingTimeConstant || 0.8,
            ...config
        };

        this.audioContext = null;
        this.analyser = null;
        this.mediaStream = null;
        this.isInitialized = false;
        this.audioBuffer = [];
        this.featureHistory = [];
        this.emotionPredictions = [];

        // Audio feature ranges (for normalization)
        this.featureRanges = {
            energy: { min: 0, max: 1 },
            pitch: { min: 50, max: 400 },
            mfcc: { min: 0, max: 100 },
            spectralCentroid: { min: 0, max: 8000 },
            zeroCrossingRate: { min: 0, max: 1 }
        };
    }

    /**
     * Initialize audio capture from microphone
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        try {
            console.log('🎤 Initializing audio capture...');

            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.config.sampleRate
            });

            // Create analyser node
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.config.fftSize;
            this.analyser.minDecibels = this.config.minDecibels;
            this.analyser.maxDecibels = this.config.maxDecibels;
            this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;

            source.connect(this.analyser);

            this.isInitialized = true;
            console.log('✅ Audio capture initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize audio capture:', error);
            return false;
        }
    }

    /**
     * Extract audio features from current frame
     * @returns {Object} Audio features
     */
    extractFeatures() {
        if (!this.isInitialized || !this.analyser) {
            return null;
        }

        try {
            // Get frequency data
            const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(frequencyData);

            // Calculate features
            const energy = this._calculateEnergy(frequencyData);
            const pitch = this._estimatePitch(frequencyData);
            const spectralCentroid = this._calculateSpectralCentroid(frequencyData);
            const zcr = this._calculateZeroCrossingRate();
            const mfcc = this._calculateMFCC(frequencyData);

            const features = {
                energy,
                pitch,
                mfcc,
                spectralCentroid,
                zeroCrossingRate: zcr,
                timestamp: Date.now(),
                frequencyData: Array.from(frequencyData)
            };

            // Store in history
            this.featureHistory.push(features);
            if (this.featureHistory.length > 30) { // Keep 30 frames
                this.featureHistory.shift();
            }

            return features;
        } catch (error) {
            console.error('❌ Error extracting audio features:', error);
            return null;
        }
    }

    /**
     * Calculate energy from frequency spectrum
     * @private
     */
    _calculateEnergy(frequencyData) {
        let energy = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            energy += frequencyData[i] * frequencyData[i];
        }
        // Normalize
        const normalizedEnergy = Math.sqrt(energy / frequencyData.length) / 255;
        return Math.min(1, normalizedEnergy);
    }

    /**
     * Estimate fundamental frequency (pitch)
     * Using autocorrelation method
     * @private
     */
    _estimatePitch(frequencyData) {
        // Simplified pitch estimation using peak frequency
        let maxValue = 0;
        let maxIndex = 0;

        for (let i = 0; i < frequencyData.length; i++) {
            if (frequencyData[i] > maxValue) {
                maxValue = frequencyData[i];
                maxIndex = i;
            }
        }

        // Convert bin to Hz
        const nyquist = this.audioContext.sampleRate / 2;
        const binWidth = nyquist / frequencyData.length;
        const frequency = maxIndex * binWidth;

        return Math.min(400, Math.max(50, frequency)); // Clamp to voice range
    }

    /**
     * Calculate spectral centroid
     * Indicates brightness of spectrum
     * @private
     */
    _calculateSpectralCentroid(frequencyData) {
        let numerator = 0;
        let denominator = 0;
        const nyquist = this.audioContext.sampleRate / 2;
        const binWidth = nyquist / frequencyData.length;

        for (let i = 0; i < frequencyData.length; i++) {
            numerator += (i * binWidth) * frequencyData[i];
            denominator += frequencyData[i];
        }

        if (denominator === 0) return 0;
        return numerator / denominator;
    }

    /**
     * Calculate zero-crossing rate
     * Indicates voicing (higher = more noise/unvoiced)
     * @private
     */
    _calculateZeroCrossingRate() {
        // Simplified: using frequency domain
        // In real implementation, calculate on time-domain waveform
        if (this.featureHistory.length < 2) return 0;

        const recentEnergy = this.featureHistory.slice(-10)
            .map(f => f.energy);
        
        let crossings = 0;
        for (let i = 1; i < recentEnergy.length; i++) {
            if ((recentEnergy[i - 1] - 0.5) * (recentEnergy[i] - 0.5) < 0) {
                crossings++;
            }
        }

        return crossings / (recentEnergy.length - 1);
    }

    /**
     * Calculate MFCC (Mel-Frequency Cepstral Coefficients)
     * Simplified calculation
     * @private
     */
    _calculateMFCC(frequencyData) {
        // Simplified MFCC: average frequencies in mel-bands
        const melBands = [];
        const bandSize = Math.floor(frequencyData.length / 13); // 13 mel bands

        for (let i = 0; i < 13; i++) {
            const start = i * bandSize;
            const end = (i + 1) * bandSize;
            const bandData = frequencyData.slice(start, end);
            
            const avg = bandData.reduce((a, b) => a + b, 0) / bandData.length;
            melBands.push(avg / 255); // Normalize
        }

        return melBands;
    }

    /**
     * Predict emotion from audio features
     * Uses simple rule-based system (can be replaced with ML model)
     * @returns {Object} Emotion prediction
     */
    predictEmotion() {
        if (this.featureHistory.length === 0) {
            return null;
        }

        // Calculate average features over last 10 frames
        const window = this.featureHistory.slice(-10);
        const avgEnergy = window.reduce((sum, f) => sum + f.energy, 0) / window.length;
        const avgPitch = window.reduce((sum, f) => sum + f.pitch, 0) / window.length;
        const avgCentroid = window.reduce((sum, f) => sum + f.spectralCentroid, 0) / window.length;

        // Simple rule-based emotion classification
        let emotion = 'neutral';
        let confidence = 0;

        if (avgEnergy > 0.7 && avgPitch > 200) {
            emotion = 'happy';
            confidence = Math.min(100, Math.round((avgEnergy + (avgPitch / 400)) * 100 / 2));
        } else if (avgEnergy < 0.3 && avgPitch < 150) {
            emotion = 'sad';
            confidence = Math.min(100, Math.round((0.6 - avgEnergy + (150 / avgPitch)) * 100 / 2));
        } else if (avgEnergy > 0.6 && avgPitch > 150) {
            emotion = 'angry';
            confidence = Math.min(100, Math.round(avgEnergy * 100));
        } else if (avgEnergy > 0.7 && avgCentroid > 4000) {
            emotion = 'surprised';
            confidence = Math.min(100, Math.round((avgEnergy * 100 + (avgCentroid / 8000) * 100) / 2));
        } else {
            emotion = 'neutral';
            confidence = Math.min(100, Math.round(avgEnergy * 50));
        }

        const prediction = {
            emotion,
            confidence,
            timestamp: Date.now(),
            features: {
                energy: Math.round(avgEnergy * 100),
                pitch: Math.round(avgPitch),
                spectralCentroid: Math.round(avgCentroid)
            }
        };

        this.emotionPredictions.push(prediction);
        if (this.emotionPredictions.length > 100) {
            this.emotionPredictions.shift();
        }

        return prediction;
    }

    /**
     * Get audio statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        if (this.featureHistory.length === 0) {
            return null;
        }

        const energies = this.featureHistory.map(f => f.energy);
        const pitches = this.featureHistory.map(f => f.pitch);

        return {
            averageEnergy: Math.round((energies.reduce((a, b) => a + b, 0) / energies.length) * 100),
            averagePitch: Math.round(pitches.reduce((a, b) => a + b, 0) / pitches.length),
            frameCount: this.featureHistory.length,
            predictionCount: this.emotionPredictions.length
        };
    }

    /**
     * Stop audio capture
     */
    stop() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.isInitialized = false;
        console.log('🛑 Audio capture stopped');
    }

    /**
     * Clear history
     */
    reset() {
        this.featureHistory = [];
        this.emotionPredictions = [];
    }

    /**
     * Get recent emotion predictions
     * @returns {Array} Recent predictions
     */
    getRecentPredictions(count = 10) {
        return this.emotionPredictions.slice(-count);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioEmotionRecognizer;
}
