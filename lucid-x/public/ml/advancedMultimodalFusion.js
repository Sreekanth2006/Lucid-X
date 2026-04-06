/**
 * Advanced Multimodal Fusion Engine
 * Combines facial and audio emotion predictions with multiple fusion strategies
 * 
 * Strategies:
 * 1. LATE FUSION (default) - Combine at decision level (60% face, 40% audio)
 * 2. EARLY FUSION - Combine features before classification
 * 3. ADAPTIVE FUSION - Weights adjust based on confidence/agreement
 * 4. CONFIDENCE-BASED - Higher confidence modality dominates
 * 
 * Outputs:
 * - Fused emotion and confidence
 * - Consensus score (how much do modalities agree?)
 * - Reliability assessment
 * - Detailed fusion breakdown
 * 
 * @module multimodalFusionEngine
 */

class AdvancedMultimodalFusion {
    constructor(config = {}) {
        this.config = {
            fusionStrategy: config.fusionStrategy || 'late-fusion', // 'late-fusion', 'adaptive', 'confidence-based'
            baseFacialWeight: config.baseFacialWeight || 0.6,
            baseAudioWeight: config.baseAudioWeight || 0.4,
            consensusThreshold: config.consensusThreshold || 0.7,
            enableAdaptiveWeights: config.enableAdaptiveWeights !== false,
            enableExplanation: config.enableExplanation !== false,
            ...config
        };

        // Adaptive weights (adjusted based on recent agreement)
        this.facialWeight = this.config.baseFacialWeight;
        this.audioWeight = this.config.baseAudioWeight;

        // History for agreement tracking
        this.fusionHistory = [];
        this.agreementHistory = [];
    }

    /**
     * Fuse facial and audio predictions
     * @param {Object} faceData - Facial emotion with confidence and all emotions
     * @param {Object} audioData - Audio emotion with confidence and all emotions
     * @returns {Object} Fused result
     */
    fuseEmotions(faceData, audioData) {
        if (!faceData || !audioData) {
            return this._handleMissingModality(faceData, audioData);
        }

        let fusionResult;

        // Choose fusion strategy
        switch (this.config.fusionStrategy) {
            case 'adaptive':
                fusionResult = this._fuseAdaptive(faceData, audioData);
                break;
            case 'confidence-based':
                fusionResult = this._fuseConfidenceBased(faceData, audioData);
                break;
            case 'late-fusion':
            default:
                fusionResult = this._fuseLateFusion(faceData, audioData);
        }

        // Calculate metrics
        fusionResult.consensus = this._calculateConsensus(faceData, audioData);
        fusionResult.agreement = this._classifyAgreement(fusionResult.consensus);
        fusionResult.reliability = this._calculateReliability(fusionResult, faceData, audioData);

        // Generate explanation if enabled
        if (this.config.enableExplanation) {
            fusionResult.explanation = this._generateExplanation(
                fusionResult, faceData, audioData
            );
        }

        // Store in history
        this.fusionHistory.push(fusionResult);
        this.agreementHistory.push(fusionResult.consensus);

        if (this.fusionHistory.length > 100) {
            this.fusionHistory.shift();
            this.agreementHistory.shift();
        }

        return fusionResult;
    }

    /**
     * Late fusion: Weighted average at decision level
     * @private
     */
    _fuseLateFusion(faceData, audioData) {
        const emotionList = ['happy', 'sad', 'angry', 'fearful', 'surprised', 'disgusted', 'neutral'];
        const fusedScores = {};

        emotionList.forEach(emotion => {
            const faceScore = faceData.allEmotions?.[emotion] || 0;
            const audioScore = audioData.allEmotions?.[emotion] || 0;

            fusedScores[emotion] = 
                (faceScore * this.facialWeight) + 
                (audioScore * this.audioWeight);
        });

        // Normalize scores
        const scoreSum = Object.values(fusedScores).reduce((a, b) => a + b, 0);
        if (scoreSum > 0) {
            emotionList.forEach(emotion => {
                fusedScores[emotion] /= scoreSum;
            });
        }

        // Find dominant emotion
        let dominantEmotion = 'neutral';
        let maxScore = 0;
        Object.entries(fusedScores).forEach(([emotion, score]) => {
            if (score > maxScore) {
                maxScore = score;
                dominantEmotion = emotion;
            }
        });

        return {
            emotion: dominantEmotion,
            confidence: maxScore,
            allEmotions: fusedScores,
            strategy: 'late-fusion',
            timestamp: Date.now(),
            details: {
                facialEmotion: faceData.emotion,
                facialConfidence: faceData.confidence,
                audioEmotion: audioData.emotion,
                audioConfidence: audioData.confidence,
                facialWeight: this.facialWeight,
                audioWeight: this.audioWeight
            }
        };
    }

    /**
     * Adaptive fusion: Weights change based on confidence and agreement
     * High confidence modality gets more weight
     * @private
     */
    _fuseAdaptive(faceData, audioData) {
        // Adjust weights based on confidence
        const totalConfidence = faceData.confidence + audioData.confidence;
        let adaptiveFacialWeight = this.config.baseFacialWeight;
        let adaptiveAudioWeight = this.config.baseAudioWeight;

        if (totalConfidence > 0) {
            // More confident modality gets more weight
            adaptiveFacialWeight = (this.config.baseFacialWeight + faceData.confidence) / 2;
            adaptiveAudioWeight = (this.config.baseAudioWeight + audioData.confidence) / 2;

            // Normalize
            const sum = adaptiveFacialWeight + adaptiveAudioWeight;
            adaptiveFacialWeight /= sum;
            adaptiveAudioWeight /= sum;
        }

        // Update stored weights for next prediction
        this.facialWeight = adaptiveFacialWeight;
        this.audioWeight = adaptiveAudioWeight;

        // Apply same fusion as late fusion but with adaptive weights
        const emotionList = ['happy', 'sad', 'angry', 'fearful', 'surprised', 'disgusted', 'neutral'];
        const fusedScores = {};

        emotionList.forEach(emotion => {
            const faceScore = faceData.allEmotions?.[emotion] || 0;
            const audioScore = audioData.allEmotions?.[emotion] || 0;

            fusedScores[emotion] = 
                (faceScore * adaptiveFacialWeight) + 
                (audioScore * adaptiveAudioWeight);
        });

        // Normalize
        const scoreSum = Object.values(fusedScores).reduce((a, b) => a + b, 0);
        if (scoreSum > 0) {
            emotionList.forEach(emotion => {
                fusedScores[emotion] /= scoreSum;
            });
        }

        // Find dominant
        let dominantEmotion = 'neutral';
        let maxScore = 0;
        Object.entries(fusedScores).forEach(([emotion, score]) => {
            if (score > maxScore) {
                maxScore = score;
                dominantEmotion = emotion;
            }
        });

        return {
            emotion: dominantEmotion,
            confidence: maxScore,
            allEmotions: fusedScores,
            strategy: 'adaptive-fusion',
            timestamp: Date.now(),
            details: {
                facialEmotion: faceData.emotion,
                facialConfidence: faceData.confidence,
                audioEmotion: audioData.emotion,
                audioConfidence: audioData.confidence,
                facialWeight: adaptiveFacialWeight,
                audioWeight: adaptiveAudioWeight,
                adaptiveAdjustment: {
                    baseFacial: this.config.baseFacialWeight,
                    adaptedFacial: adaptiveFacialWeight,
                    reason: 'confidence-based weighting'
                }
            }
        };
    }

    /**
     * Confidence-based fusion: Higher confidence modality dominates
     * @private
     */
    _fuseConfidenceBased(faceData, audioData) {
        let result;
        let dominantModality;

        if (faceData.confidence >= audioData.confidence) {
            // Use facial as base
            result = {
                emotion: faceData.emotion,
                confidence: faceData.confidence * 0.9, // Slightly reduced if disagreement
                allEmotions: faceData.allEmotions,
                dominantModality: 'facial',
                details: {
                    base: 'facial',
                    faceConfidence: faceData.confidence,
                    audioConfidence: audioData.confidence,
                    disagreement: faceData.emotion !== audioData.emotion
                }
            };

            // Adjust if audio strongly disagrees
            if (faceData.emotion !== audioData.emotion && audioData.confidence > 0.7) {
                const blendedConfidence = faceData.confidence * 0.7 + audioData.confidence * 0.3;
                result.confidence = blendedConfidence;
                result.details.blended = true;
            }
        } else {
            // Use audio as base
            result = {
                emotion: audioData.emotion,
                confidence: audioData.confidence * 0.9,
                allEmotions: audioData.allEmotions,
                dominantModality: 'audio',
                details: {
                    base: 'audio',
                    faceConfidence: faceData.confidence,
                    audioConfidence: audioData.confidence,
                    disagreement: faceData.emotion !== audioData.emotion
                }
            };

            if (faceData.emotion !== audioData.emotion && faceData.confidence > 0.7) {
                const blendedConfidence = audioData.confidence * 0.7 + faceData.confidence * 0.3;
                result.confidence = blendedConfidence;
                result.details.blended = true;
            }
        }

        result.strategy = 'confidence-based';
        result.timestamp = Date.now();

        return result;
    }

    /**
     * Calculate consensus between modalities
     * Returns 0-1 score of agreement
     * @private
     */
    _calculateConsensus(faceData, audioData) {
        // Direct emotion match
        if (faceData.emotion === audioData.emotion) {
            // Use average confidence as consensus strength
            return (faceData.confidence + audioData.confidence) / 2;
        }

        // Partial agreement using emotion similarity
        const emotionSimilarity = this._getEmotionSimilarity(
            faceData.emotion, 
            audioData.emotion
        );

        // Blend emotion match with confidence
        const baseConsensus = emotionSimilarity * 0.5 +
                              (1 - Math.abs(faceData.confidence - audioData.confidence)) * 0.5;

        return baseConsensus;
    }

    /**
     * Get similarity between two emotions
     * Some emotions are more related (happy-surprised, sad-fearful)
     * @private
     */
    _getEmotionSimilarity(emotion1, emotion2) {
        if (emotion1 === emotion2) return 1.0;

        // Emotion similarity matrix
        const similarities = {
            'happy-surprised': 0.8,
            'happy-neutral': 0.7,
            'sad-fearful': 0.7,
            'sad-neutral': 0.6,
            'angry-fearful': 0.6,
            'angry-disgusted': 0.7,
            'fearful-surprised': 0.6,
            'disgusted-angry': 0.7,
            'surprised-happy': 0.8
        };

        const key1 = `${emotion1}-${emotion2}`;
        const key2 = `${emotion2}-${emotion1}`;

        return similarities[key1] || similarities[key2] || 0.3;
    }

    /**
     * Classify agreement level
     * @private
     */
    _classifyAgreement(consensusScore) {
        if (consensusScore >= this.config.consensusThreshold) {
            return 'high-agreement';
        } else if (consensusScore >= 0.5) {
            return 'partial-agreement';
        } else {
            return 'disagreement';
        }
    }

    /**
     * Calculate overall reliability score
     * @private
     */
    _calculateReliability(fusionResult, faceData, audioData) {
        let score = 0.5; // Base reliability

        // Confidence component (30%)
        const avgConfidence = (faceData.confidence + audioData.confidence) / 2;
        score += avgConfidence * 0.3;

        // Agreement component (40%)
        score += fusionResult.consensus * 0.4;

        // Consensus bonus (30%)
        if (fusionResult.agreement === 'high-agreement') {
            score += 0.3;
        } else if (fusionResult.agreement === 'partial-agreement') {
            score += 0.15;
        }

        return Math.min(1.0, score);
    }

    /**
     * Generate explanation for fusion decision
     * @private
     */
    _generateExplanation(fusionResult, faceData, audioData) {
        const explain = {
            summary: '',
            details: [],
            confidence_assessment: '',
            recommendation: ''
        };

        // Build summary
        if (fusionResult.agreement === 'high-agreement') {
            explain.summary = `Both facial and audio emotion analysis strongly suggest ${fusionResult.emotion.toUpperCase()}.`;
        } else if (fusionResult.agreement === 'partial-agreement') {
            explain.summary = `Facial emotion suggests ${faceData.emotion.toUpperCase()}, audio suggests ${audioData.emotion.toUpperCase()}. ` +
                            `Final assessment: ${fusionResult.emotion.toUpperCase()}.`;
        } else {
            explain.summary = `Facial and audio modalities differ: ${faceData.emotion.toUpperCase()} vs ${audioData.emotion.toUpperCase()}. ` +
                            `Fused prediction: ${fusionResult.emotion.toUpperCase()}.`;
        }

        // Details
        explain.details = [
            `Facial emotion: ${faceData.emotion} (confidence: ${(faceData.confidence * 100).toFixed(1)}%)`,
            `Audio emotion: ${audioData.emotion} (confidence: ${(audioData.confidence * 100).toFixed(1)}%)`,
            `Consensus score: ${(fusionResult.consensus * 100).toFixed(1)}%`,
            `Fusion strategy: ${fusionResult.strategy}`
        ];

        // Assessment
        if (fusionResult.reliability > 0.8) {
            explain.confidence_assessment = 'Very high confidence in this prediction';
        } else if (fusionResult.reliability > 0.6) {
            explain.confidence_assessment = 'Moderate to high confidence';
        } else {
            explain.confidence_assessment = 'Lower confidence - may warrant human review';
        }

        // Recommendation
        if (fusionResult.agreement === 'disagreement') {
            explain.recommendation = 'Consider asking for clarification or context as modalities disagree';
        } else if (fusionResult.emotion === 'neutral') {
            explain.recommendation = 'User appears neutral - continue monitoring for emotional changes';
        } else {
            explain.recommendation = `User appears ${fusionResult.emotion}. Respond appropriately to their emotional state.`;
        }

        return explain;
    }

    /**
     * Handle missing modality (only one or both missing)
     * @private
     */
    _handleMissingModality(faceData, audioData) {
        if (faceData && !audioData) {
            // Only facial available
            return {
                emotion: faceData.emotion,
                confidence: faceData.confidence * 0.85, // Reduced confidence without audio
                allEmotions: faceData.allEmotions,
                strategy: 'facial-only',
                timestamp: Date.now(),
                details: {
                    reason: 'audio_not_available',
                    modality: 'facial'
                }
            };
        } else if (audioData && !faceData) {
            // Only audio available
            return {
                emotion: audioData.emotion,
                confidence: audioData.confidence * 0.85,
                allEmotions: audioData.allEmotions,
                strategy: 'audio-only',
                timestamp: Date.now(),
                details: {
                    reason: 'facial_not_available',
                    modality: 'audio'
                }
            };
        } else {
            // Neither available
            return {
                emotion: 'neutral',
                confidence: 0,
                allEmotions: { neutral: 1 },
                strategy: 'no-data',
                timestamp: Date.now(),
                details: { reason: 'both_modalities_unavailable' }
            };
        }
    }

    /**
     * Get agreement trend
     * Returns how agreement is changing over time
     * @returns {Object}
     */
    getAgreementTrend(windowSize = 10) {
        if (this.agreementHistory.length < 2) {
            return { trend: 'insufficient-data', direction: 'neutral' };
        }

        const window = this.agreementHistory.slice(Math.max(0, this.agreementHistory.length - windowSize));
        const recent = window.slice(-5);
        const older = window.slice(0, Math.max(1, window.length - 5));

        const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b) / older.length;

        const trend = recentAvg - olderAvg;

        return {
            trend: Math.abs(trend),
            direction: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
            currentAvg: recentAvg,
            previousAvg: olderAvg,
            windowSize: window.length
        };
    }

    /**
     * Get fusion statistics
     * @returns {Object}
     */
    getStatistics() {
        if (this.fusionHistory.length === 0) return null;

        const agreements = this.agreementHistory;
        
        return {
            totalFusions: this.fusionHistory.length,
            averageConsensus: agreements.reduce((a, b) => a + b) / agreements.length,
            maxConsensus: Math.max(...agreements),
            minConsensus: Math.min(...agreements),
            agreementTrend: this.getAgreementTrend(),
            strategyUsed: this.config.fusionStrategy,
            currentWeights: {
                facial: this.facialWeight,
                audio: this.audioWeight
            }
        };
    }

    /**
     * Reset
     */
    reset() {
        this.fusionHistory = [];
        this.agreementHistory = [];
        this.facialWeight = this.config.baseFacialWeight;
        this.audioWeight = this.config.baseAudioWeight;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedMultimodalFusion;
}
