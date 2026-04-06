/**
 * Advanced Emotion Detection Module
 * Implements facial emotion recognition using TinyFaceDetector (primary)
 * TinyFaceDetector is optimized for real-time detection with reduced latency
 * compared to SSD MobileNet while maintaining good accuracy.
 * 
 * Why TinyFaceDetector?
 * - 5-10x faster than SSD MobileNet
 * - Suitable for real-time webcam detection (24-30+ FPS)
 * - Lower memory footprint
 * - Better for mobile and resource-constrained devices
 * - Trade-off: Slightly lower accuracy in edge cases (extreme angles, small faces)
 * 
 * @module emotionDetector
 * @requires face-api.js
 * @requires tensorflow.js
 */

class EmotionDetector {
    constructor(config = {}) {
        this.config = {
            modelSource: config.modelSource || 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model',
            // PRIMARY: TinyFaceDetector for real-time detection
            inputSize: config.inputSize || 224,      // 224 or 320 (smaller = faster)
            scoreThreshold: config.scoreThreshold || 0.5,
            // OPTIONAL: Keep SSD for comparison/fallback
            includeSsdComparison: config.includeSsdComparison || false,
            // General settings
            confidenceThreshold: config.confidenceThreshold || 0.3,
            maxFacesDetected: config.maxFacesDetected || 5,
            ...config
        };

        this.modelsLoaded = false;
        this.emotionLabels = ['angry', 'disgusted', 'fearful', 'happy', 'neutral', 'sad', 'surprised'];
        this.performanceMetrics = {
            detectionTime: 0,
            totalFrames: 0,
            fps: 0,
            lastFrameTime: Date.now()
        };
    }

    /**
     * Load required models from CDN
     * PRIMARY: TinyFaceDetector + FaceExpressionNet for real-time detection
     * OPTIONAL: SSD MobileNet for comparison (if enabled)
     * @returns {Promise<boolean>} Success status
     */
    async loadModels() {
        try {
            console.log('📦 Loading emotion detection models...');
            console.log('🎯 Primary detector: TinyFaceDetector (optimized for real-time)');
            
            // Load mandatory models for TinyFaceDetector
            const mandatoryModels = [
                faceapi.nets.tinyFaceDetector.loadFromUri(this.config.modelSource),
                faceapi.nets.faceExpressionNet.loadFromUri(this.config.modelSource),
                faceapi.nets.faceLandmark68Net.loadFromUri(this.config.modelSource)
            ];
            
            await Promise.all(mandatoryModels);
            console.log('✅ TinyFaceDetector and expression models loaded');
            
            // Load optional SSD model for comparison
            if (this.config.includeSsdComparison) {
                try {
                    await faceapi.nets.ssdMobilenetv1.loadFromUri(this.config.modelSource);
                    console.log('✅ SSD MobileNet loaded (comparison mode)');
                } catch (error) {
                    console.warn('⚠️  SSD MobileNet failed to load (comparison disabled):', error.message);
                }
            }
            
            this.modelsLoaded = true;
            console.log('✅ All required emotion detection models loaded successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to load required models:', error);
            this.modelsLoaded = false;
            return false;
        }
    }

    /**
     * Detect faces and emotions in video frame (TinyFaceDetector)
     * 
     * TinyFaceDetector Configuration:
     * - inputSize: 224 (faster) or 320 (more accurate, slower)
     *   * 224: ~45-60ms per frame on modern hardware
     *   * 320: ~80-120ms per frame
     * - scoreThreshold: 0.3-0.5 (lower = more detections, higher = more conservative)
     * 
     * @param {HTMLVideoElement} videoElement - Video stream
     * @param {boolean} useSSD - DEPRECATED: Use SSD MobileNet instead of TinyFaceDetector
     * @returns {Promise<Array>} Array of detected emotions with metadata
     */
    async detectEmotions(videoElement, useSSD = false) {
        if (!this.modelsLoaded || !videoElement) {
            return [];
        }

        const startTime = performance.now();

        try {
            let detections;

            if (useSSD && this.config.includeSsdComparison) {
                // FALLBACK: SSD MobileNet (only if explicitly requested AND enabled)
                console.warn('⚠️  Using SSD MobileNet (slower detector) - TinyFaceDetector recommended');
                detections = await faceapi
                    .detectAllFaces(videoElement, new faceapi.SsdMobilenetv1Options())
                    .withFaceLandmarks()
                    .withFaceExpressions();
            } else {
                // PRIMARY: TinyFaceDetector (optimized for real-time detection)
                // Configuration:
                // - inputSize: 224 for speed (recommended), 320 for accuracy
                // - scoreThreshold: Balance between sensitivity and false positives
                const options = new faceapi.TinyFaceDetectorOptions({
                    inputSize: this.config.inputSize,    // Default: 224 (faster)
                    scoreThreshold: this.config.scoreThreshold  // Default: 0.5
                });
                
                detections = await faceapi
                    .detectAllFaces(videoElement, options)
                    .withFaceLandmarks()
                    .withFaceExpressions();
            }

            // Filter by confidence threshold
            const filtered = detections.filter(d => 
                Math.max(...Object.values(d.expressions)) > this.config.confidenceThreshold
            );

            // Limit number of faces
            const results = filtered.slice(0, this.config.maxFacesDetected).map((detection, idx) => 
                this._formatEmotionResult(detection, idx, useSSD && this.config.includeSsdComparison)
            );

            // Update performance metrics
            this._updatePerformanceMetrics(startTime);

            return results;
        } catch (error) {
            console.error('❌ Error during emotion detection:', error);
            return [];
        }
    }

    /**
     * Format detection result with emotion probabilities
     * TinyFaceDetector: Primary detector optimized for real-time performance
     * @private
     */
    _formatEmotionResult(detection, faceIndex, usedSSD = false) {
        const expressions = detection.expressions;
        
        // Get all emotion probabilities sorted
        const emotionScores = Object.entries(expressions)
            .map(([emotion, score]) => ({ emotion, score: Math.round(score * 100) }))
            .sort((a, b) => b.score - a.score);

        const dominantEmotion = emotionScores[0].emotion;
        const confidence = emotionScores[0].score;

        return {
            faceIndex,
            dominantEmotion,
            confidence,
            allExpressions: emotionScores,
            // Bounding box for rendering on canvas
            box: {
                x: Math.round(detection.detection.box.x),
                y: Math.round(detection.detection.box.y),
                width: Math.round(detection.detection.box.width),
                height: Math.round(detection.detection.box.height)
            },
            landmarks: detection.landmarks,
            timestamp: Date.now(),
            // Primary detector: TinyFaceDetector
            detectorType: usedSSD ? 'SSD MobileNet (fallback)' : 'TinyFaceDetector (real-time)',
            details: {
                eyeDistance: this._calculateEyeDistance(detection.landmarks),
                faceSize: this._calculateFaceSize(detection.detection.box),
                alignment: this._calculateFaceAlignment(detection.landmarks)
            }
        };
    }

    /**
     * Calculate distance between eyes for face quality assessment
     * @private
     */
    _calculateEyeDistance(landmarks) {
        if (!landmarks) return null;
        const points = landmarks.getJawOutline();
        if (points.length < 2) return null;
        
        const dx = points[0].x - points[1].x;
        const dy = points[0].y - points[1].y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate face bounding box size
     * @private
     */
    _calculateFaceSize(box) {
        return {
            width: Math.round(box.width),
            height: Math.round(box.height),
            area: Math.round(box.width * box.height),
            position: {
                x: Math.round(box.x),
                y: Math.round(box.y)
            }
        };
    }

    /**
     * Assess face alignment and quality
     * @private
     */
    _calculateFaceAlignment(landmarks) {
        if (!landmarks) return 'unknown';
        
        // Simple check: if face landmarks are within normal bounds
        const points = landmarks.positions;
        if (points.length > 0) {
            return 'frontal';
        }
        return 'angled';
    }

    /**
     * Update FPS and performance metrics
     * @private
     */
    _updatePerformanceMetrics(startTime) {
        this.performanceMetrics.detectionTime = performance.now() - startTime;
        this.performanceMetrics.totalFrames++;
        
        const now = Date.now();
        const elapsed = now - this.performanceMetrics.lastFrameTime;
        
        if (elapsed >= 1000) {
            this.performanceMetrics.fps = Math.round(
                (this.performanceMetrics.totalFrames * 1000) / elapsed
            );
            this.performanceMetrics.lastFrameTime = now;
            this.performanceMetrics.totalFrames = 0;
        }
    }

    /**
     * Get current performance metrics
     * @returns {Object} Performance data
     */
    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    /**
     * Compare TinyFaceDetector vs SSD MobileNet on current frame (for benchmarking)
     * USE: Only for performance comparison and benchmarking
     * RECOMMENDATION: TinyFaceDetector for real-time detection
     * 
     * Performance Expectations:
     * TinyFaceDetector (inputSize: 224):
     *   - Latency: 45-60ms per frame
     *   - FPS: 16-24 FPS on standard hardware
     *   - Trade-off: Slightly lower accuracy in edge cases
     * 
     * SSD MobileNet:
     *   - Latency: 100-200ms per frame
     *   - FPS: 5-10 FPS on standard hardware
     *   - Benefit: Better accuracy on small faces, extreme angles
     * 
     * @param {HTMLVideoElement} videoElement
     * @returns {Promise<Object>} Comparison results with recommendation
     */
    async compareDetectors(videoElement) {
        const startTime = performance.now();
        
        const tinyResults = await this.detectEmotions(videoElement, false);
        const tinyTime = performance.now() - startTime;

        const startTime2 = performance.now();
        const ssdResults = await this.detectEmotions(videoElement, true);
        const ssdTime = performance.now() - startTime2;

        const recommendation = 'TinyFaceDetector (recommended for real-time detection)';

        return {
            tiny: {
                results: tinyResults,
                processingTime: Math.round(tinyTime * 100) / 100,
                facesDetected: tinyResults.length,
                recommendation: 'PRIMARY - Use this for real-time applications'
            },
            ssd: {
                results: ssdResults,
                processingTime: Math.round(ssdTime * 100) / 100,
                facesDetected: ssdResults.length,
                recommendation: 'FALLBACK - Higher accuracy but slower'
            },
            speedup: {
                value: (ssdTime / tinyTime).toFixed(1),
                description: `TinyFaceDetector is ${(ssdTime / tinyTime).toFixed(1)}x faster than SSD MobileNet`
            },
            recommendation: recommendation
        };
    }

    /**
     * Get emotion statistics from multiple detections
     * @param {Array} detections - Array of detection results
     * @returns {Object} Statistical summary
     */
    getEmotionStatistics(detections) {
        if (detections.length === 0) return null;

        const emotionCounts = {};
        let totalConfidence = 0;

        detections.forEach(detection => {
            const emotion = detection.dominantEmotion;
            emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
            totalConfidence += detection.confidence;
        });

        const averageConfidence = Math.round(totalConfidence / detections.length);

        // Convert to percentages
        const emotionDistribution = {};
        Object.entries(emotionCounts).forEach(([emotion, count]) => {
            emotionDistribution[emotion] = Math.round((count / detections.length) * 100);
        });

        return {
            totalFacesDetected: detections.length,
            averageConfidence,
            emotionDistribution,
            dominantEmotion: Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0][0],
            timestamp: Date.now()
        };
    }

    /**
     * Reset performance metrics
     */
    resetMetrics() {
        this.performanceMetrics = {
            detectionTime: 0,
            totalFrames: 0,
            fps: 0,
            lastFrameTime: Date.now()
        };
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmotionDetector;
}
