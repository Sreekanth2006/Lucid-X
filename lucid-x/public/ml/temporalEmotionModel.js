/**
 * Temporal Emotion Modeling Module
 * Smooths emotion predictions using sliding window and temporal analysis
 * Implements rolling statistics and trend detection
 * 
 * @module temporalEmotionModel
 */

class TemporalEmotionModel {
    constructor(config = {}) {
        this.windowSize = config.windowSize || 15; // ~3 seconds at 30fps (15 frames)
        this.smoothingFactor = config.smoothingFactor || 0.7; // EMA smoothing
        this.stabilityThreshold = config.stabilityThreshold || 0.8;
        this.trendWindow = config.trendWindow || 5; // Frames for trend detection

        this.emotionHistory = [];
        this.confidenceHistory = [];
        this.smoothedEmotion = null;
        this.emotionTrends = {};
        this.stabilityScore = 0;
    }

    /**
     * Add new emotion detection to temporal model
     * @param {string} emotion - Dominant emotion
     * @param {number} confidence - Confidence score (0-100)
     * @param {Object} allExpressions - All emotion probabilities
     * @returns {Object} Processed emotion with temporal context
     */
    addEmotionFrame(emotion, confidence, allExpressions) {
        const timestamp = Date.now();

        // Add to history
        this.emotionHistory.push({
            emotion,
            timestamp,
            index: this.emotionHistory.length
        });

        this.confidenceHistory.push(confidence);

        // Keep only recent history (sliding window)
        if (this.emotionHistory.length > this.windowSize) {
            this.emotionHistory.shift();
            this.confidenceHistory.shift();
        }

        // Calculate smoothed results
        const smoothed = this._smoothEmotion(emotion, confidence, allExpressions);
        const stability = this._calculateStability();
        const trend = this._detectTrend();

        return {
            rawEmotion: emotion,
            rawConfidence: confidence,
            smoothedEmotion: smoothed.emotion,
            smoothedConfidence: smoothed.confidence,
            stabilityScore: stability,
            trend: trend,
            windowFull: this.emotionHistory.length === this.windowSize,
            timestamp,
            allExpressions
        };
    }

    /**
     * Apply exponential moving average smoothing
     * @private
     */
    _smoothEmotion(currentEmotion, currentConfidence, allExpressions) {
        if (this.emotionHistory.length === 0) {
            return { emotion: currentEmotion, confidence: currentConfidence };
        }

        // EMA for confidence
        const previousSmoothed = this.smoothedEmotion;
        const smoothedConf = previousSmoothed 
            ? Math.round(
                currentConfidence * (1 - this.smoothingFactor) + 
                previousSmoothed.confidence * this.smoothingFactor
            )
            : currentConfidence;

        // Majority voting for emotion changes
        const recentEmotions = this.emotionHistory
            .slice(-5)
            .map(e => e.emotion);
        
        const emotionCounts = {};
        recentEmotions.forEach(e => {
            emotionCounts[e] = (emotionCounts[e] || 0) + 1;
        });

        const majorityEmotion = Object.entries(emotionCounts)
            .sort((a, b) => b[1] - a[1])[0][0];

        this.smoothedEmotion = {
            emotion: majorityEmotion,
            confidence: smoothedConf,
            timestamp: Date.now()
        };

        return this.smoothedEmotion;
    }

    /**
     * Calculate emotion stability (consistency)
     * Range: 0-100 (higher = more stable)
     * @private
     */
    _calculateStability() {
        if (this.emotionHistory.length < 2) return 0;

        // Check how consistent emotions are
        const recentEmotions = this.emotionHistory.slice(-this.trendWindow);
        const uniqueEmotions = new Set(recentEmotions.map(e => e.emotion)).size;
        
        const emotionStability = ((this.trendWindow - uniqueEmotions) / this.trendWindow) * 100;
        
        // Check confidence stability
        const recentConfidences = this.confidenceHistory.slice(-this.trendWindow);
        const avgConfidence = recentConfidences.reduce((a, b) => a + b, 0) / recentConfidences.length;
        const variance = recentConfidences.reduce((sum, c) => 
            sum + Math.pow(c - avgConfidence, 2), 0
        ) / recentConfidences.length;
        const stdDev = Math.sqrt(variance);
        const confidenceStability = Math.max(0, 100 - (stdDev * 2)); // Normalize

        // Combined stability score
        this.stabilityScore = Math.round((emotionStability * 0.6 + confidenceStability * 0.4));
        return this.stabilityScore;
    }

    /**
     * Detect emotion trend (increasing/decreasing confidence)
     * @private
     */
    _detectTrend() {
        if (this.confidenceHistory.length < this.trendWindow) {
            return 'insufficient_data';
        }

        const recent = this.confidenceHistory.slice(-this.trendWindow);
        const older = this.confidenceHistory.slice(-this.trendWindow * 2, -this.trendWindow);

        if (older.length === 0) return 'insufficient_data';

        const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b) / older.length;

        const change = recentAvg - olderAvg;
        const changePercent = (change / olderAvg) * 100;

        if (Math.abs(changePercent) < 5) return 'stable';
        if (changePercent > 0) return 'increasing';
        return 'decreasing';
    }

    /**
     * Get emotion history with temporal data
     * @returns {Array} History array
     */
    getHistory() {
        return this.emotionHistory.map((entry, idx) => ({
            ...entry,
            confidence: this.confidenceHistory[idx],
            frameIndex: idx
        }));
    }

    /**
     * Get emotion distribution over time window
     * @returns {Object} Emotion percentages
     */
    getEmotionDistribution() {
        const distribution = {};
        
        this.emotionHistory.forEach(entry => {
            distribution[entry.emotion] = (distribution[entry.emotion] || 0) + 1;
        });

        // Convert to percentages
        Object.keys(distribution).forEach(emotion => {
            distribution[emotion] = Math.round(
                (distribution[emotion] / this.emotionHistory.length) * 100
            );
        });

        return distribution;
    }

    /**
     * Detect emotional spikes (sudden confidence changes)
     * @returns {Array} Array of spike events
     */
    detectSpikes(spikeThreshold = 20) {
        if (this.confidenceHistory.length < 2) return [];

        const spikes = [];

        for (let i = 1; i < this.confidenceHistory.length; i++) {
            const change = Math.abs(
                this.confidenceHistory[i] - this.confidenceHistory[i - 1]
            );

            if (change > spikeThreshold) {
                spikes.push({
                    index: i,
                    timestamp: this.emotionHistory[i].timestamp,
                    emotion: this.emotionHistory[i].emotion,
                    confidenceChange: change,
                    from: this.confidenceHistory[i - 1],
                    to: this.confidenceHistory[i],
                    type: this.confidenceHistory[i] > this.confidenceHistory[i - 1] 
                        ? 'increase' 
                        : 'decrease'
                });
            }
        }

        return spikes;
    }

    /**
     * Get emotion statistics
     * @returns {Object} Summary statistics
     */
    getStatistics() {
        if (this.emotionHistory.length === 0) {
            return null;
        }

        const confidences = this.confidenceHistory;
        const avgConfidence = Math.round(
            confidences.reduce((a, b) => a + b) / confidences.length
        );

        return {
            windowSize: this.emotionHistory.length,
            averageConfidence: avgConfidence,
            maxConfidence: Math.max(...confidences),
            minConfidence: Math.min(...confidences),
            stability: this.stabilityScore,
            distribution: this.getEmotionDistribution(),
            dominantEmotion: this.smoothedEmotion?.emotion || 'unknown',
            spikes: this.detectSpikes()
        };
    }

    /**
     * Reset temporal model
     */
    reset() {
        this.emotionHistory = [];
        this.confidenceHistory = [];
        this.smoothedEmotion = null;
        this.stabilityScore = 0;
    }

    /**
     * Check if emotion has stabilized
     * @returns {boolean} True if stability > threshold
     */
    isStable() {
        return this.stabilityScore > this.stabilityThreshold * 100;
    }

    /**
     * Get prediction confidence (how to report)
     * High confidence: stable + high smoothed confidence
     * @returns {string} 'high', 'medium', 'low'
     */
    getPredictionConfidenceLevel() {
        if (this.emotionHistory.length < this.windowSize) {
            return 'building'; // Still gathering data
        }

        const stability = this.stabilityScore;
        const confidence = this.smoothedEmotion?.confidence || 0;

        if (stability > 80 && confidence > 70) {
            return 'high';
        } else if (stability > 50 && confidence > 50) {
            return 'medium';
        }
        return 'low';
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TemporalEmotionModel;
}
