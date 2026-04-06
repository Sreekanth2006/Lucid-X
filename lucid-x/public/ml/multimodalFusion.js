/**
 * Multimodal Emotion Fusion Engine
 * Combines facial and audio emotion predictions into unified scores
 * Implements late fusion strategy with weighted fusion
 * 
 * @module multimodalFusion
 */

class MultimodalFusionEngine {
    constructor(config = {}) {
        this.config = {
            facialWeight: config.facialWeight || 0.6,  // 60% weight for facial
            audioWeight: config.audioWeight || 0.4,     // 40% weight for audio
            consensusThreshold: config.consensusThreshold || 0.7,
            emotionLabels: config.emotionLabels || [
                'angry', 'disgusted', 'fearful', 'happy', 'neutral', 'sad', 'surprised'
            ],
            ...config
        };

        this.fusionHistory = [];
        this.consensusCount = 0;
        this.fusionMetrics = {
            totalFusions: 0,
            consensusAchieved: 0,
            averageConfidence: 0,
            agreementRate: 0
        };
    }

    /**
     * Fuse facial and audio emotion predictions
     * @param {Object} facialPrediction - Facial emotion data
     * @param {Object} audioPrediction - Audio emotion data
     * @param {Object} context - Additional context (optional)
     * @returns {Object} Fused multimodal emotion prediction
     */
    fuseEmotions(facialPrediction, audioPrediction, context = {}) {
        if (!facialPrediction || !audioPrediction) {
            return null;
        }

        // Calculate fused probabilities
        const fusedProbabilities = this._calculateFusedProbabilities(
            facialPrediction,
            audioPrediction
        );

        // Determine dominant fused emotion
        const dominantEmotion = Object.entries(fusedProbabilities)
            .sort((a, b) => b[1] - a[1])[0][0];

        // Check consensus between modalities
        const consensus = this._checkConsensus(facialPrediction, audioPrediction);

        // Calculate overall confidence
        const overallConfidence = Math.round(
            (facialPrediction.confidence * this.config.facialWeight + 
             audioPrediction.confidence * this.config.audioWeight)
        );

        // Create modality agreement score
        const agreement = this._calculateModalityAgreement(
            facialPrediction.emotion,
            audioPrediction.emotion
        );

        const fusion = {
            timestamp: Date.now(),
            dominantEmotion,
            confidence: overallConfidence,
            fusedProbabilities,
            
            // Modality details
            facial: {
                emotion: facialPrediction.emotion,
                confidence: facialPrediction.confidence,
                weight: this.config.facialWeight
            },
            audio: {
                emotion: audioPrediction.emotion,
                confidence: audioPrediction.confidence,
                weight: this.config.audioWeight
            },

            // Fusion metrics
            consensus,
            agreement: agreement,
            reliabilityScore: this._calculateReliability(
                overallConfidence,
                consensus,
                agreement
            ),

            // Context
            context
        };

        // Store in history
        this.fusionHistory.push(fusion);
        if (this.fusionHistory.length > 300) { // Keep 5 minutes at 10Hz
            this.fusionHistory.shift();
        }

        // Update metrics
        this._updateMetrics(fusion);

        return fusion;
    }

    /**
     * Calculate fused probability distributions
     * Using weighted linear combination
     * @private
     */
    _calculateFusedProbabilities(facialPred, audioPred) {
        const fused = {};

        this.config.emotionLabels.forEach(emotion => {
            // Get probabilities from each modality
            const facialProb = facialPred.allExpressions
                ? this._getEmotionProbability(facialPred.allExpressions, emotion)
                : (facialPred.emotion === emotion ? facialPred.confidence / 100 : 0);

            const audioProb = audioPred.confidence > 0 && audioPred.emotion === emotion
                ? audioPred.confidence / 100
                : (audioPred.emotion === emotion ? 0.3 : 0.05); // Baseline for audio

            // Weighted fusion
            fused[emotion] = Math.round((
                facialProb * this.config.facialWeight +
                audioProb * this.config.audioWeight
            ) * 100);
        });

        return fused;
    }

    /**
     * Get probability for specific emotion
     * @private
     */
    _getEmotionProbability(allExpressions, targetEmotion) {
        if (Array.isArray(allExpressions)) {
            const found = allExpressions.find(e => e.emotion === targetEmotion);
            return found ? (found.score / 100) : 0;
        }
        return allExpressions[targetEmotion] || 0;
    }

    /**
     * Check if facial and audio emotions are in consensus
     * @private
     */
    _checkConsensus(facialPred, audioPred) {
        const facialEmotion = facialPred.emotion;
        const audioEmotion = audioPred.emotion;

        // Direct match
        if (facialEmotion === audioEmotion) {
            return {
                achieved: true,
                type: 'direct_match',
                confidence: Math.min(facialPred.confidence, audioPred.confidence)
            };
        }

        // Check emotional valence agreement (pos/neg)
        const emotionValence = {
            'happy': 'positive',
            'surprised': 'positive',
            'sad': 'negative',
            'angry': 'negative',
            'disgusted': 'negative',
            'fearful': 'negative',
            'neutral': 'neutral'
        };

        const facialValence = emotionValence[facialEmotion] || 'unknown';
        const audioValence = emotionValence[audioEmotion] || 'unknown';

        if (facialValence === audioValence && facialValence !== 'neutral') {
            return {
                achieved: true,
                type: 'valence_match',
                confidence: Math.round(
                    (facialPred.confidence + audioPred.confidence) / 2
                )
            };
        }

        return {
            achieved: false,
            type: 'disagreement',
            confidence: 0
        };
    }

    /**
     * Calculate how much modalities agree (0-100)
     * @private
     */
    _calculateModalityAgreement(facialEmotion, audioEmotion) {
        if (facialEmotion === audioEmotion) {
            return 100;
        }

        // Emotion similarity matrix (simplified)
        const similarityMap = {
            'happy': { 'surprised': 80, 'angry': 20 },
            'sad': { 'neutral': 40, 'fearful': 60 },
            'angry': { 'disgusted': 70, 'fearful': 50 },
            'fearful': { 'sad': 60, 'surprised': 40 },
            'disgusted': { 'angry': 70, 'sad': 50 },
            'neutral': { 'sad': 40, 'happy': 30 },
            'surprised': { 'happy': 80, 'fearful': 40 }
        };

        if (similarityMap[facialEmotion]?.[audioEmotion]) {
            return similarityMap[facialEmotion][audioEmotion];
        }
        if (similarityMap[audioEmotion]?.[facialEmotion]) {
            return similarityMap[audioEmotion][facialEmotion];
        }

        return 20; // Low similarity
    }

    /**
     * Calculate overall reliability of fusion
     * Combines confidence, consensus, and agreement
     * @private
     */
    _calculateReliability(confidence, consensus, agreement) {
        // Confidence is already weighted
        const confidenceScore = confidence;

        // Consensus bonus
        const consensusScore = consensus.achieved ? consensus.confidence : 0;

        // Agreement score
        const agreementScore = agreement;

        // Combined reliability (0-100)
        const reliability = Math.round((
            confidenceScore * 0.5 +
            consensusScore * 0.3 +
            agreementScore * 0.2
        ));

        return Math.max(0, Math.min(100, reliability));
    }

    /**
     * Update fusion operation metrics
     * @private
     */
    _updateMetrics(fusion) {
        this.fusionMetrics.totalFusions++;

        if (fusion.consensus.achieved) {
            this.fusionMetrics.consensusAchieved++;
        }

        // Update agreement rate
        this.fusionMetrics.agreementRate = Math.round(
            (this.fusionMetrics.consensusAchieved / this.fusionMetrics.totalFusions) * 100
        );

        // Update average confidence
        const allConfidences = this.fusionHistory.map(f => f.confidence);
        this.fusionMetrics.averageConfidence = Math.round(
            allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
        );
    }

    /**
     * Get fusion metrics
     * @returns {Object} Current metrics
     */
    getMetrics() {
        return { ...this.fusionMetrics };
    }

    /**
     * Analyze fusion agreement over time
     * @returns {Object} Agreement analysis
     */
    analyzeAgreement() {
        if (this.fusionHistory.length === 0) {
            return null;
        }

        const recentFusions = this.fusionHistory.slice(-50); // Last 5 seconds
        const consensusFusions = recentFusions.filter(f => f.consensus.achieved).length;
        const highAgreementFusions = recentFusions.filter(f => f.agreement > 70).length;

        return {
            totalFusions: recentFusions.length,
            consensusFusions,
            consensusRate: Math.round((consensusFusions / recentFusions.length) * 100),
            highAgreementRate: Math.round((highAgreementFusions / recentFusions.length) * 100),
            averageAgreement: Math.round(
                recentFusions.reduce((sum, f) => sum + f.agreement, 0) / recentFusions.length
            ),
            timeWindow: '5 seconds'
        };
    }

    /**
     * Get emotion timeline from fusion history
     * @returns {Array} Timeline data
     */
    getTimeline() {
        return this.fusionHistory.map(f => ({
            timestamp: f.timestamp,
            emotion: f.dominantEmotion,
            confidence: f.confidence,
            consensus: f.consensus.achieved,
            agreement: f.agreement
        }));
    }

    /**
     * Get dominant emotion over time window
     * @param {number} windowSeconds - Time window in seconds
     * @returns {Object} Dominant emotion statistics
     */
    getDominantEmotionTrend(windowSeconds = 5) {
        const cutoffTime = Date.now() - (windowSeconds * 1000);
        const recentFusions = this.fusionHistory.filter(f => f.timestamp > cutoffTime);

        if (recentFusions.length === 0) {
            return null;
        }

        const emotionCounts = {};
        let totalConfidence = 0;

        recentFusions.forEach(f => {
            emotionCounts[f.dominantEmotion] = (emotionCounts[f.dominantEmotion] || 0) + 1;
            totalConfidence += f.confidence;
        });

        const dominantEmotion = Object.entries(emotionCounts)
            .sort((a, b) => b[1] - a[1])[0][0];

        return {
            emotion: dominantEmotion,
            duration: windowSeconds,
            frameCount: recentFusions.length,
            averageConfidence: Math.round(totalConfidence / recentFusions.length),
            distribution: emotionCounts
        };
    }

    /**
     * Reset fusion engine
     */
    reset() {
        this.fusionHistory = [];
        this.fusionMetrics = {
            totalFusions: 0,
            consensusAchieved: 0,
            averageConfidence: 0,
            agreementRate: 0
        };
    }

    /**
     * Adjust modality weights
     * @param {number} facialWeight - New facial weight (0-1)
     * @param {number} audioWeight - New audio weight (0-1)
     */
    adjustWeights(facialWeight, audioWeight) {
        if (facialWeight + audioWeight !== 1) {
            console.warn('⚠️  Weights should sum to 1, normalizing...');
            const total = facialWeight + audioWeight;
            facialWeight /= total;
            audioWeight /= total;
        }

        this.config.facialWeight = facialWeight;
        this.config.audioWeight = audioWeight;
        console.log(`✅ Weights updated: Facial=${facialWeight}, Audio=${audioWeight}`);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultimodalFusionEngine;
}
