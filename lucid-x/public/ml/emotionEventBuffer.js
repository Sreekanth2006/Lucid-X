/**
 * Synchronized Emotion Event Buffer
 * Maintains temporal alignment between facial and audio emotion predictions
 * 
 * Data structure:
 * {
 *   timestamp: milliseconds since epoch,
 *   frameIndex: frame number,
 *   faceEmotion: {emotion, confidence, allEmotions},
 *   audioEmotion: {emotion, confidence, allEmotions},
 *   fused: {emotion, confidence, agreement},
 *   audioTimestamp: Web Audio API currentTime,
 *   videoTimestamp: requestAnimationFrame timestamp
 * }
 * 
 * Purpose:
 * - Buffer predictions for 3-second temporal analysis
 * - Align audio (asynchronous) with video (synchronous) streams
 * - Prepare data for Bi-LSTM temporal modeling
 * - Enable multimodal fusion with timestamp-based matching
 * 
 * @module emotionEventBuffer
 */

class EmotionEventBuffer {
    constructor(config = {}) {
        this.config = {
            maxBufferSize: config.maxBufferSize || 300, // ~10 seconds at 30 FPS
            temporalWindow: config.temporalWindow || 3000, // milliseconds
            syncTolerance: config.syncTolerance || 100, // ms tolerance for matching
            enableAutoCleanup: config.enableAutoCleanup !== false,
            ...config
        };

        // Main buffer
        this.emotionBuffer = [];

        // Timing information
        this.timingStats = {
            videoFPS: 0,
            audioLatency: 0,
            lastVideoTime: 0,
            lastAudioTime: 0
        };

        // Event callbacks
        this.onEmotionEvent = config.onEmotionEvent || (() => {});
        this.onSyncIssue = config.onSyncIssue || (() => {});

        // Frame counter
        this.frameCount = 0;
        this.audioSampleCount = 0;
    }

    /**
     * Record a video frame with facial emotion
     * @param {Object} faceEmotion - Facial emotion result from emotionDetector
     * @param {number} videoTimestamp - requestAnimationFrame timestamp
     * @returns {Object} Buffered event
     */
    recordFaceEmotion(faceEmotion, videoTimestamp) {
        const timestamp = Date.now();
        const frameIndex = this.frameCount++;

        // Find or create event at this timestamp
        let event = this._findOrCreateEvent(timestamp);

        event.frameIndex = frameIndex;
        event.videoTimestamp = videoTimestamp;
        event.faceEmotion = {
            emotion: faceEmotion.dominantEmotion || 'neutral',
            confidence: faceEmotion.confidence || 0,
            allEmotions: faceEmotion.allExpressions || {},
            landmarks: faceEmotion.landmarks || null,
            box: faceEmotion.box || null
        };

        // Update timing
        const timeDiff = timestamp - this.timingStats.lastVideoTime;
        if (timeDiff > 0) {
            this.timingStats.videoFPS = 1000 / timeDiff;
        }
        this.timingStats.lastVideoTime = timestamp;

        // Try to fuse if we have audio
        if (event.audioEmotion) {
            event.fused = this._performFusion(event.faceEmotion, event.audioEmotion);
        }

        this._enforceBufferSize();
        this.onEmotionEvent(event);

        return event;
    }

    /**
     * Record audio emotion prediction
     * @param {Object} audioEmotion - Audio emotion result from audioEmotionPredictor
     * @param {number} audioTimestamp - Web Audio API currentTime
     * @returns {Object} Buffered event
     */
    recordAudioEmotion(audioEmotion, audioTimestamp = null) {
        const timestamp = Date.now();
        this.audioSampleCount++;

        // Audio predictions are async, so find nearest video frame
        let event = this._findNearestEvent(timestamp);

        if (!event) {
            // Create new event if no nearby video frame
            event = this._findOrCreateEvent(timestamp);
        }

        event.audioEmotion = {
            emotion: audioEmotion.emotion || 'neutral',
            confidence: audioEmotion.confidence || 0,
            allEmotions: audioEmotion.allEmotions || {},
            energy: audioEmotion.energy || 0,
            pitch: audioEmotion.pitch || 0,
            features: audioEmotion.features || {}
        };

        if (audioTimestamp !== null) {
            event.audioTimestamp = audioTimestamp;
        }

        // Check synchronization
        const syncDiff = Math.abs(timestamp - event.timestamp);
        if (syncDiff > this.config.syncTolerance) {
            this.onSyncIssue({
                type: 'audio-video-mismatch',
                offset: syncDiff,
                audioTS: timestamp,
                eventTS: event.timestamp
            });
        }

        // Try to fuse if we have face
        if (event.faceEmotion) {
            event.fused = this._performFusion(event.faceEmotion, event.audioEmotion);
        }

        this._enforceBufferSize();
        this.onEmotionEvent(event);

        return event;
    }

    /**
     * Get last N buffered events
     * @param {number} n - Number of events
     * @returns {Array} Last n events
     */
    getRecentEvents(n = 10) {
        return this.emotionBuffer.slice(Math.max(0, this.emotionBuffer.length - n));
    }

    /**
     * Get events within temporal window (milliseconds)
     * @param {number} windowMs - Window size in milliseconds
     * @returns {Array} Events within window
     */
    getTemporalWindow(windowMs = null) {
        const window = windowMs || this.config.temporalWindow;
        const now = Date.now();

        return this.emotionBuffer.filter(event => {
            return (now - event.timestamp) <= window;
        });
    }

    /**
     * Get emotion statistics for temporal window
     * @returns {Object} Statistics
     */
    getWindowStatistics() {
        const events = this.getTemporalWindow();

        if (events.length === 0) {
            return this._createEmptyStats();
        }

        const stats = {
            windowSize: events.length,
            duration: events[events.length - 1].timestamp - events[0].timestamp,
            videoEvents: events.filter(e => e.faceEmotion).length,
            audioEvents: events.filter(e => e.audioEmotion).length,
            fusedEvents: events.filter(e => e.fused).length
        };

        // Emotion distribution
        stats.faceEmotionDist = this._getEmotionDistribution(
            events.map(e => e.faceEmotion)
        );
        stats.audioEmotionDist = this._getEmotionDistribution(
            events.map(e => e.audioEmotion)
        );
        stats.fusedEmotionDist = this._getEmotionDistribution(
            events.map(e => e.fused)
        );

        // Agreement metrics
        stats.multimodalAgreement = this._calculateAgreement(events);

        return stats;
    }

    /**
     * Get data for Bi-LSTM temporal modeling
     * Prepares sequences of emotion features
     * @param {number} sequenceLength - Number of frames per sequence
     * @returns {Array} Sequences ready for LSTM
     */
    getTemporalSequences(sequenceLength = 15) {
        const sequences = [];
        const windowEvents = this.getTemporalWindow();

        if (windowEvents.length < sequenceLength) {
            return [];
        }

        // Create sliding window of sequences
        for (let i = 0; i <= windowEvents.length - sequenceLength; i++) {
            const sequence = windowEvents.slice(i, i + sequenceLength);

            sequences.push({
                startIdx: i,
                events: sequence,
                features: sequence.map(event => this._eventToFeatureVector(event)),
                labels: sequence.map(event => event.fused?.emotion || 'neutral'),
                timestamps: sequence.map(event => event.timestamp)
            });
        }

        return sequences;
    }

    /**
     * Search buffer by emotion
     * @param {string} emotion - Emotion type
     * @param {number} withinMs - Search within recent N milliseconds
     * @returns {Array} Matching events
     */
    findEmotionOccurrences(emotion, withinMs = 3000) {
        const now = Date.now();
        return this.emotionBuffer.filter(event => {
            const inWindow = (now - event.timestamp) <= withinMs;
            const hasFused = event.fused && event.fused.emotion === emotion;
            const hasFace = event.faceEmotion && event.faceEmotion.emotion === emotion;
            const hasAudio = event.audioEmotion && event.audioEmotion.emotion === emotion;

            return inWindow && (hasFused || hasFace || hasAudio);
        });
    }

    /**
     * Export buffer for analysis
     * @param {string} format - 'json', 'array', or 'csv'
     * @returns {Object|string}
     */
    exportBuffer(format = 'json') {
        switch (format) {
            case 'array':
                return this.emotionBuffer;
            
            case 'csv':
                return this._formatAsCSV();
            
            case 'json':
            default:
                return {
                    metadata: {
                        bufferSize: this.emotionBuffer.length,
                        duration: this._calculateBufferDuration(),
                        averageFPS: this.timingStats.videoFPS,
                        audioLatency: this.timingStats.audioLatency
                    },
                    events: this.emotionBuffer,
                    statistics: this.getWindowStatistics()
                };
        }
    }

    /**
     * Clear buffer
     */
    clear() {
        this.emotionBuffer = [];
        this.frameCount = 0;
        this.audioSampleCount = 0;
    }

    // =============================================
    // PRIVATE METHODS
    // =============================================

    /**
     * Find or create event at timestamp
     * @private
     */
    _findOrCreateEvent(timestamp) {
        const existing = this.emotionBuffer.find(
            e => Math.abs(e.timestamp - timestamp) < 50
        );

        if (existing) {
            return existing;
        }

        const newEvent = {
            timestamp,
            frameIndex: null,
            videoTimestamp: null,
            audioTimestamp: null,
            faceEmotion: null,
            audioEmotion: null,
            fused: null
        };

        this.emotionBuffer.push(newEvent);
        return newEvent;
    }

    /**
     * Find nearest event to timestamp
     * @private
     */
    _findNearestEvent(timestamp) {
        if (this.emotionBuffer.length === 0) return null;

        let nearest = this.emotionBuffer[0];
        let minDiff = Math.abs(nearest.timestamp - timestamp);

        for (let event of this.emotionBuffer) {
            const diff = Math.abs(event.timestamp - timestamp);
            if (diff < minDiff) {
                minDiff = diff;
                nearest = event;
            }
        }

        // Only return if within tolerance
        return minDiff <= this.config.syncTolerance ? nearest : null;
    }

    /**
     * Simple fusion logic
     * @private
     */
    _performFusion(faceEmotion, audioEmotion) {
        if (!faceEmotion || !audioEmotion) return null;

        // Weighted combination (60% face, 40% audio)
        const faceEmotions = faceEmotion.allEmotions || {};
        const audioEmotions = audioEmotion.allEmotions || {};

        const emotionList = ['happy', 'sad', 'angry', 'fearful', 'surprised', 'disgusted', 'neutral'];
        const fusedScores = {};

        emotionList.forEach(emotion => {
            const faceScore = faceEmotions[emotion] || 0;
            const audioScore = audioEmotions[emotion] || 0;
            fusedScores[emotion] = faceScore * 0.6 + audioScore * 0.4;
        });

        // Find max
        let maxEmotion = 'neutral';
        let maxScore = 0;
        Object.entries(fusedScores).forEach(([emotion, score]) => {
            if (score > maxScore) {
                maxScore = score;
                maxEmotion = emotion;
            }
        });

        // Check agreement
        const agreement = faceEmotion.emotion === audioEmotion.emotion
            ? 'high'
            : 'low';

        return {
            emotion: maxEmotion,
            confidence: maxScore,
            faceEmotion: faceEmotion.emotion,
            audioEmotion: audioEmotion.emotion,
            agreement,
            consensusScore: agreement === 'high' ? 0.9 : 0.3
        };
    }

    /**
     * Get emotion distribution from events
     * @private
     */
    _getEmotionDistribution(emotionList) {
        const dist = {};
        let validCount = 0;

        emotionList.forEach(emotion => {
            if (emotion) {
                const emotionType = emotion.emotion || 'neutral';
                dist[emotionType] = (dist[emotionType] || 0) + 1;
                validCount++;
            }
        });

        // Normalize
        Object.keys(dist).forEach(emotion => {
            dist[emotion] = validCount > 0 ? dist[emotion] / validCount : 0;
        });

        return dist;
    }

    /**
     * Calculate multimodal agreement
     * @private
     */
    _calculateAgreement(events) {
        let agreements = 0;
        let comparisons = 0;

        events.forEach(event => {
            if (event.faceEmotion && event.audioEmotion) {
                comparisons++;
                if (event.faceEmotion.emotion === event.audioEmotion.emotion) {
                    agreements++;
                }
            }
        });

        return {
            agreementRate: comparisons > 0 ? agreements / comparisons : 0,
            totalComparisons: comparisons,
            agreementCount: agreements
        };
    }

    /**
     * Convert event to feature vector for ML
     * @private
     */
    _eventToFeatureVector(event) {
        const emotions = ['happy', 'sad', 'angry', 'fearful', 'surprised', 'disgusted', 'neutral'];
        const features = [];

        // Face emotion probabilities
        if (event.faceEmotion) {
            emotions.forEach(emotion => {
                features.push(event.faceEmotion.allEmotions[emotion] || 0);
            });
            features.push(event.faceEmotion.confidence);
        } else {
            for (let i = 0; i < emotions.length + 1; i++) features.push(0);
        }

        // Audio emotion probabilities
        if (event.audioEmotion) {
            emotions.forEach(emotion => {
                features.push(event.audioEmotion.allEmotions[emotion] || 0);
            });
            features.push(event.audioEmotion.confidence);
            features.push(event.audioEmotion.energy || 0);
        } else {
            for (let i = 0; i < emotions.length + 2; i++) features.push(0);
        }

        return features;
    }

    /**
     * Format buffer as CSV
     * @private
     */
    _formatAsCSV() {
        const lines = ['timestamp,frame,face_emotion,face_conf,audio_emotion,audio_conf,fused_emotion,fused_conf'];

        this.emotionBuffer.forEach(event => {
            const face = event.faceEmotion || {};
            const audio = event.audioEmotion || {};
            const fused = event.fused || {};

            lines.push(
                `${event.timestamp},` +
                `${event.frameIndex || ''},` +
                `${face.emotion || ''},${(face.confidence || 0).toFixed(3)},` +
                `${audio.emotion || ''},${(audio.confidence || 0).toFixed(3)},` +
                `${fused.emotion || ''},${(fused.confidence || 0).toFixed(3)}`
            );
        });

        return lines.join('\n');
    }

    /**
     * Enforce maximum buffer size
     * @private
     */
    _enforceBufferSize() {
        if (this.config.enableAutoCleanup && this.emotionBuffer.length > this.config.maxBufferSize) {
            const toRemove = this.emotionBuffer.length - this.config.maxBufferSize;
            this.emotionBuffer.splice(0, toRemove);
        }
    }

    /**
     * Calculate buffer duration in ms
     * @private
     */
    _calculateBufferDuration() {
        if (this.emotionBuffer.length < 2) return 0;
        const first = this.emotionBuffer[0].timestamp;
        const last = this.emotionBuffer[this.emotionBuffer.length - 1].timestamp;
        return last - first;
    }

    /**
     * Create empty statistics object
     * @private
     */
    _createEmptyStats() {
        return {
            windowSize: 0,
            duration: 0,
            videoEvents: 0,
            audioEvents: 0,
            fusedEvents: 0,
            faceEmotionDist: {},
            audioEmotionDist: {},
            fusedEmotionDist: {},
            multimodalAgreement: { agreementRate: 0, totalComparisons: 0 }
        };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmotionEventBuffer;
}
