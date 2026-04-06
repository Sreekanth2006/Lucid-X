/**
 * Audio Emotion Prediction Module
 * Converts extracted audio features into emotion predictions
 * 
 * Supports:
 * 1. Rule-based prediction (lightweight, fast)
 * 2. Simple classifier (linear combination of features)
 * 3. ML model integration hooks (for future wav2vec2/WavLM integration)
 * 
 * Emotion classifications:
 * - HAPPY: High energy, high pitch, bright spectrum
 * - SAD: Low energy, low pitch, minimal variation
 * - ANGRY: High energy, fast speech, harsh spectrum
 * - FEARFUL: High-mid energy, rapid pitch changes
 * - SURPRISED: Sudden energy bursts
 * - DISGUSTED: Creaky voice, specific pitch patterns
 * - NEUTRAL: Moderate, stable energy
 * 
 * @module audioEmotionPredictor
 */

class AudioEmotionPredictor {
    constructor(config = {}) {
        this.config = {
            predictionMethod: config.predictionMethod || 'rule-based', // 'rule-based', 'simplified-classifier', 'ml-model'
            smoothingWindow: config.smoothingWindow || 5, // predictions to average
            confidenceThreshold: config.confidenceThreshold || 0.5,
            ...config
        };

        this.predictionHistory = [];
        this.featureHistory = [];
        this.modelWeights = this._initializeModelWeights();

        // Emotion mapping
        this.emotions = ['happy', 'sad', 'angry', 'fearful', 'surprised', 'disgusted', 'neutral'];
        
        // ML model (if provided)
        this.mlModel = config.mlModel || null;
    }

    /**
     * Predict emotion from extracted features
     * @param {Object} features - Extracted audio features from AudioFeatureExtractor
     * @returns {Object} Emotion prediction with confidence
     */
    predictEmotion(features) {
        if (!features) {
            return this._createEmptyPrediction();
        }

        let prediction;

        // Choose prediction method
        switch (this.config.predictionMethod) {
            case 'ml-model':
                prediction = this._predictWithMLModel(features);
                break;
            case 'simplified-classifier':
                prediction = this._predictWithClassifier(features);
                break;
            case 'rule-based':
            default:
                prediction = this._predictWithRules(features);
        }

        // Apply smoothing
        prediction = this._applySmoothingWindow(prediction);

        // Store in history
        this.predictionHistory.push(prediction);
        this.featureHistory.push(features);
        
        if (this.predictionHistory.length > 50) {
            this.predictionHistory.shift();
            this.featureHistory.shift();
        }

        return prediction;
    }

    /**
     * Rule-based emotion prediction
     * Uses feature thresholds and heuristics
     * @private
     */
    _predictWithRules(features) {
        const confidences = {};
        
        // Normalize feature values
        const energy = features.energy || 0;
        const centroid = (features.spectralCentroid || 0) / 8000; // Normalize to [0, 1]
        const zcr = features.zeroCrossingRate || 0;
        const mfcc = features.mfcc || [];

        // Calculate average MFCC energy
        const mfccMean = mfcc.length > 0 
            ? mfcc.reduce((a, b) => a + b) / mfcc.length 
            : 0;

        // HAPPY: High energy, bright spectrum, stable structure
        // High energy, high centroid, low variance
        confidences.happy = 0;
        if (energy > 0.6) confidences.happy += 0.3;
        if (centroid > 0.6) confidences.happy += 0.3;
        if (mfcc.length > 0 && mfccMean > 0.5) confidences.happy += 0.2;
        if (zcr < 0.3) confidences.happy += 0.2; // Stable voicing

        // SAD: Low energy, low spectral content, slow changes
        confidences.sad = 0;
        if (energy < 0.4) confidences.sad += 0.4;
        if (centroid < 0.4) confidences.sad += 0.3;
        if (zcr < 0.2) confidences.sad += 0.3; // Very stable/monotone

        // ANGRY: High energy, high frequency peaks, fast changes
        confidences.angry = 0;
        if (energy > 0.7) confidences.angry += 0.2;
        if (centroid > 0.65) confidences.angry += 0.2;
        if (zcr > 0.4) confidences.angry += 0.3; // Rapid variations
        // Check for energy in higher MFCC bands (harsh quality)
        if (mfcc.length > 8) {
            const highMfcc = mfcc.slice(8).reduce((a, b) => a + b) / 5;
            if (highMfcc > 0.6) confidences.angry += 0.2;
        }

        // FEARFUL: Rapid pitch changes, moderate-high energy
        confidences.fearful = 0;
        if (energy > 0.5 && energy < 0.8) confidences.fearful += 0.2;
        if (zcr > 0.35) confidences.fearful += 0.3; // Fast changes
        // Look for MFCC dynamic range
        if (mfcc.length > 0) {
            const mfccMax = Math.max(...mfcc);
            const mfccMin = Math.min(...mfcc);
            if ((mfccMax - mfccMin) > 1.5) confidences.fearful += 0.3; // Large variation
        }

        // SURPRISED: Sudden energy/pitch changes
        confidences.surprised = 0;
        if (this.featureHistory.length > 1) {
            const prevEnergy = this.featureHistory[this.featureHistory.length - 1].energy || 0;
            const energyChange = Math.abs(energy - prevEnergy);
            if (energyChange > 0.3) confidences.surprised += 0.4; // Sudden change
        }
        if (zcr > 0.3) confidences.surprised += 0.2;

        // DISGUSTED: Specific articulatory features
        // Often characterized by particular spectral shape
        confidences.disgusted = 0;
        if (energy > 0.45 && energy < 0.65) confidences.disgusted += 0.2;
        if (centroid > 0.35 && centroid < 0.55) confidences.disgusted += 0.2;
        if (zcr > 0.25 && zcr < 0.4) confidences.disgusted += 0.2;

        // NEUTRAL: Balanced, moderate features
        confidences.neutral = 0;
        if (energy > 0.35 && energy < 0.65) confidences.neutral += 0.3;
        if (centroid > 0.3 && centroid < 0.7) confidences.neutral += 0.25;
        if (zcr > 0.1 && zcr < 0.4) confidences.neutral += 0.25;

        // Normalize confidences to [0, 1]
        const maxConf = Math.max(...Object.values(confidences));
        if (maxConf > 0) {
            Object.keys(confidences).forEach(emotion => {
                confidences[emotion] /= maxConf;
            });
        } else {
            // Default to neutral if no confidence
            confidences.neutral = 1;
        }

        // Find dominant emotion
        let dominantEmotion = 'neutral';
        let maxConfidence = 0;
        Object.entries(confidences).forEach(([emotion, conf]) => {
            if (conf > maxConfidence) {
                maxConfidence = conf;
                dominantEmotion = emotion;
            }
        });

        return {
            emotion: dominantEmotion,
            confidence: maxConfidence,
            allEmotions: confidences,
            method: 'rule-based',
            timestamp: Date.now(),
            features: {
                energy: energy,
                spectralCentroid: centroid,
                zeroCrossingRate: zcr,
                mfccMean: mfccMean
            }
        };
    }

    /**
     * Simplified classifier using weighted feature combination
     * @private
     */
    _predictWithClassifier(features) {
        const weights = this.modelWeights;
        const scores = {};

        // Calculate emotion scores as weighted combinations
        this.emotions.forEach(emotion => {
            let score = weights[emotion].bias;
            
            // Weight energy
            if (features.energy !== undefined) {
                score += weights[emotion].energy * features.energy;
            }

            // Weight spectral centroid
            if (features.spectralCentroid !== undefined) {
                const normCentroid = Math.min(1, features.spectralCentroid / 8000);
                score += weights[emotion].spectralCentroid * normCentroid;
            }

            // Weight zero-crossing rate
            if (features.zeroCrossingRate !== undefined) {
                score += weights[emotion].zeroCrossingRate * features.zeroCrossingRate;
            }

            // Weight MFCC
            if (features.mfcc && Array.isArray(features.mfcc)) {
                const mfccMean = features.mfcc.reduce((a, b) => a + b) / features.mfcc.length;
                score += weights[emotion].mfccMean * mfccMean;
            }

            scores[emotion] = Math.max(0, Math.min(1, score));
        });

        // Softmax normalization
        const sum = Object.values(scores).reduce((a, b) => a + b, 0);
        Object.keys(scores).forEach(emotion => {
            scores[emotion] = sum > 0 ? scores[emotion] / sum : 1 / this.emotions.length;
        });

        // Find dominant
        let dominantEmotion = 'neutral';
        let maxScore = 0;
        Object.entries(scores).forEach(([emotion, score]) => {
            if (score > maxScore) {
                maxScore = score;
                dominantEmotion = emotion;
            }
        });

        return {
            emotion: dominantEmotion,
            confidence: maxScore,
            allEmotions: scores,
            method: 'simplified-classifier',
            timestamp: Date.now(),
            features: {
                energy: features.energy || 0,
                spectralCentroid: features.spectralCentroid || 0,
                zeroCrossingRate: features.zeroCrossingRate || 0
            }
        };
    }

    /**
     * Use ML model for prediction (hook for external model)
     * Requires model to be trained and provided in config
     * @private
     */
    async _predictWithMLModel(features) {
        if (!this.mlModel) {
            console.warn('ML model not provided, falling back to rule-based');
            return this._predictWithRules(features);
        }

        try {
            // Model input format: [energy, spectralCentroid, zcr, ...mfcc]
            const input = this._prepareModelInput(features);
            
            // Call model (async)
            const output = await this._callExternalModel(input);

            // Parse output
            const confidences = {};
            this.emotions.forEach((emotion, idx) => {
                confidences[emotion] = output[idx] || 0;
            });

            const dominantIdx = output.indexOf(Math.max(...output));
            const dominantEmotion = this.emotions[dominantIdx] || 'neutral';

            return {
                emotion: dominantEmotion,
                confidence: output[dominantIdx],
                allEmotions: confidences,
                method: 'ml-model',
                timestamp: Date.now(),
                features: {
                    energy: features.energy || 0,
                    spectralCentroid: features.spectralCentroid || 0,
                    zeroCrossingRate: features.zeroCrossingRate || 0
                }
            };
        } catch (error) {
            console.error('ML model prediction failed:', error);
            return this._predictWithRules(features);
        }
    }

    /**
     * Prepare features for ML model input
     * @private
     */
    _prepareModelInput(features) {
        const input = [];

        // Add individual features
        input.push(features.energy || 0);
        input.push((features.spectralCentroid || 0) / 8000);
        input.push(features.zeroCrossingRate || 0);

        // Add MFCC (standardized to 13 bands)
        if (features.mfcc && Array.isArray(features.mfcc)) {
            for (let i = 0; i < 13; i++) {
                input.push(features.mfcc[i] || 0);
            }
        } else {
            for (let i = 0; i < 13; i++) {
                input.push(0);
            }
        }

        return input; // Total: 17 features
    }

    /**
     * Call external ML model (stub for implementation)
     * This would connect to a backend or WASM module
     * @private
     */
    async _callExternalModel(input) {
        // Stub: Return random for now
        // In real implementation:
        // - Send to backend API: POST /api/predict with input
        // - Or use WASM module: model.predict(input)
        // - Or use TensorFlow.js: model.predict(tf.tensor2d([input]))
        
        return new Promise((resolve) => {
            setTimeout(() => {
                const output = new Array(7).fill(1/7); // Uniform distribution
                resolve(output);
            }, 10);
        });
    }

    /**
     * Apply temporal smoothing to predictions
     * Average recent predictions to reduce noise
     * @private
     */
    _applySmoothingWindow(prediction) {
        this.predictionHistory.push(prediction);

        if (this.predictionHistory.length < this.config.smoothingWindow) {
            return prediction;
        }

        // Average recent predictions
        const windowStart = Math.max(0, this.predictionHistory.length - this.config.smoothingWindow);
        const window = this.predictionHistory.slice(windowStart);

        // Weighted moving average (more recent = higher weight)
        const smoothedConfidences = {};
        this.emotions.forEach(emotion => {
            let weighted = 0;
            let weightSum = 0;

            window.forEach((pred, idx) => {
                const weight = idx + 1; // Linear increasing weight
                const conf = pred.allEmotions[emotion] || 0;
                weighted += conf * weight;
                weightSum += weight;
            });

            smoothedConfidences[emotion] = weightSum > 0 ? weighted / weightSum : 0;
        });

        // Find dominant smoothed emotion
        let dominantEmotion = 'neutral';
        let maxConfidence = 0;
        Object.entries(smoothedConfidences).forEach(([emotion, conf]) => {
            if (conf > maxConfidence) {
                maxConfidence = conf;
                dominantEmotion = emotion;
            }
        });

        return {
            emotion: dominantEmotion,
            confidence: maxConfidence,
            allEmotions: smoothedConfidences,
            method: prediction.method + '-smoothed',
            timestamp: prediction.timestamp,
            features: prediction.features,
            isSmoothed: true
        };
    }

    /**
     * Initialize model weights for simplified classifier
     * These are pre-tuned based on speech emotion characteristics
     * @private
     */
    _initializeModelWeights() {
        return {
            happy: {
                bias: 0.1,
                energy: 0.4,
                spectralCentroid: 0.3,
                zeroCrossingRate: -0.2,
                mfccMean: 0.2
            },
            sad: {
                bias: 0.05,
                energy: -0.4,
                spectralCentroid: -0.3,
                zeroCrossingRate: -0.3,
                mfccMean: -0.2
            },
            angry: {
                bias: 0.15,
                energy: 0.35,
                spectralCentroid: 0.25,
                zeroCrossingRate: 0.4,
                mfccMean: 0.15
            },
            fearful: {
                bias: 0.1,
                energy: 0.2,
                spectralCentroid: 0.1,
                zeroCrossingRate: 0.3,
                mfccMean: 0.1
            },
            surprised: {
                bias: 0.08,
                energy: 0.3,
                spectralCentroid: 0.2,
                zeroCrossingRate: 0.25,
                mfccMean: 0.15
            },
            disgusted: {
                bias: 0.12,
                energy: 0.1,
                spectralCentroid: 0.15,
                zeroCrossingRate: 0.2,
                mfccMean: 0.1
            },
            neutral: {
                bias: 0.2,
                energy: 0.0,
                spectralCentroid: 0.0,
                zeroCrossingRate: 0.0,
                mfccMean: 0.0
            }
        };
    }

    /**
     * Create empty prediction (fallback)
     * @private
     */
    _createEmptyPrediction() {
        const empty = {};
        this.emotions.forEach(emotion => {
            empty[emotion] = 0;
        });
        empty.neutral = 1;

        return {
            emotion: 'neutral',
            confidence: 0,
            allEmotions: empty,
            method: 'fallback',
            timestamp: Date.now(),
            features: {}
        };
    }

    /**
     * Get prediction statistics
     * @returns {Object}
     */
    getStatistics() {
        if (this.predictionHistory.length === 0) return null;

        const stats = {
            totalPredictions: this.predictionHistory.length,
            emotionDistribution: {}
        };

        // Count emotion occurrences
        this.emotions.forEach(emotion => {
            stats.emotionDistribution[emotion] = this.predictionHistory.filter(
                p => p.emotion === emotion
            ).length;
        });

        // Calculate confidence statistics
        const confidences = this.predictionHistory.map(p => p.confidence);
        stats.avgConfidence = confidences.reduce((a, b) => a + b) / confidences.length;
        stats.maxConfidence = Math.max(...confidences);
        stats.minConfidence = Math.min(...confidences);

        return stats;
    }

    /**
     * Reset prediction history
     */
    reset() {
        this.predictionHistory = [];
        this.featureHistory = [];
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioEmotionPredictor;
}
