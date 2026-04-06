/**
 * Multimodal Emotion Recognition System - Main Coordinator
 * Orchestrates all ML modules for comprehensive emotion analysis
 * Manages real-time processing pipeline and state
 * 
 * @module emotionSystem
 */

class MultimodalEmotionSystem {
    constructor(config = {}) {
        this.config = {
            enableAudio: config.enableAudio !== false,
            enableFacial: config.enableFacial !== false,
            enableMultimodal: config.enableMultimodal !== false,
            enableExplainability: config.enableExplainability !== false,
            enableReporting: config.enableReporting !== false,
            facialWeight: config.facialWeight || 0.6,
            audioWeight: config.audioWeight || 0.4,
            ...config
        };

        // Initialize all modules
        this.emotionDetector = new EmotionDetector(config.emotionDetectorConfig);
        this.temporalModel = new TemporalEmotionModel(config.temporalModelConfig);
        this.audioRecognizer = new AudioEmotionRecognizer(config.audioRecognizerConfig);
        this.multimodalFusion = new MultimodalFusionEngine({
            facialWeight: this.config.facialWeight,
            audioWeight: this.config.audioWeight
        });
        this.explainableAI = new ExplainableAI(config.explainableAIConfig);
        this.sessionReport = new SessionReportGenerator(config.sessionReportConfig);
        this.performanceComparison = new PerformanceComparison(config.performanceComparisonConfig);

        // System state
        this.isRunning = false;
        this.isPaused = false;
        this.currentFrame = null;
        this.processingQueue = [];
        this.systemMetrics = {
            totalFramesProcessed: 0,
            averageProcessingTime: 0,
            fps: 0,
            lastUpdateTime: Date.now()
        };

        // Event callbacks
        this.callbacks = {
            onEmotionDetected: config.onEmotionDetected || (() => {}),
            onAudioDetected: config.onAudioDetected || (() => {}),
            onFusionResult: config.onFusionResult || (() => {}),
            onSystemUpdate: config.onSystemUpdate || (() => {}),
            onError: config.onError || (() => {})
        };
    }

    /**
     * Initialize the entire emotion recognition system
     * @param {HTMLVideoElement} videoElement - Video source
     * @param {boolean} withAudio - Enable audio processing
     * @returns {Promise<boolean>} Success status
     */
    async initialize(videoElement, withAudio = true) {
        try {
            console.log('🚀 Initializing Multimodal Emotion Recognition System...');

            // Load facial emotion models
            if (this.config.enableFacial) {
                const facialLoaded = await this.emotionDetector.loadModels();
                if (!facialLoaded) {
                    throw new Error('Failed to load facial emotion models');
                }
                console.log('✅ Facial emotion detection initialized');
            }

            // Initialize audio capture
            if (this.config.enableAudio && withAudio) {
                const audioInitialized = await this.audioRecognizer.initialize();
                if (!audioInitialized) {
                    console.warn('⚠️  Audio capture failed, continuing without audio');
                }
                console.log('✅ Audio emotion recognition initialized');
            }

            this.videoElement = videoElement;
            console.log('✅ System initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ System initialization failed:', error);
            this.callbacks.onError(error);
            return false;
        }
    }

    /**
     * Start real-time emotion recognition
     * @returns {Promise<void>}
     */
    async start() {
        if (this.isRunning) {
            console.warn('⚠️  System already running');
            return;
        }

        this.isRunning = true;
        this.isPaused = false;
        console.log('▶️  Starting real-time emotion recognition...');

        this._processingLoop();
    }

    /**
     * Main processing loop
     * @private
     */
    async _processingLoop() {
        const loopStartTime = performance.now();

        try {
            if (!this.isPaused && this.isRunning) {
                // Facial emotion detection
                let facialResult = null;
                if (this.config.enableFacial && this.videoElement) {
                    const detections = await this.emotionDetector.detectEmotions(this.videoElement);
                    
                    if (detections.length > 0) {
                        facialResult = detections[0]; // Primary face
                        
                        // Apply temporal smoothing
                        const temporalResult = this.temporalModel.addEmotionFrame(
                            facialResult.dominantEmotion,
                            facialResult.confidence,
                            facialResult.allExpressions
                        );

                        // Add explainability
                        if (this.config.enableExplainability && facialResult.landmarks) {
                            const saliency = this.explainableAI.generateSaliencyMap(
                                {
                                    landmarks: facialResult.landmarks,
                                    box: facialResult.box
                                },
                                temporalResult.smoothedEmotion,
                                temporalResult.smoothedConfidence
                            );
                            facialResult.explanation = saliency;
                        }

                        // Record for reporting
                        this.sessionReport.recordEmotionEvent(facialResult);

                        // Callback
                        this.callbacks.onEmotionDetected(facialResult);
                    }
                }

                // Audio emotion detection
                let audioResult = null;
                if (this.config.enableAudio && this.audioRecognizer.isInitialized) {
                    const features = this.audioRecognizer.extractFeatures();
                    if (features) {
                        audioResult = this.audioRecognizer.predictEmotion();
                        
                        if (audioResult) {
                            this.sessionReport.recordAudioEvent(audioResult);
                            this.callbacks.onAudioDetected(audioResult);
                        }
                    }
                }

                // Multimodal fusion
                if (this.config.enableMultimodal && facialResult && audioResult) {
                    const fusionResult = this.multimodalFusion.fuseEmotions(
                        {
                            emotion: facialResult.dominantEmotion || 'unknown',
                            confidence: facialResult.confidence || 0,
                            allExpressions: facialResult.allExpressions
                        },
                        {
                            emotion: audioResult.emotion,
                            confidence: audioResult.confidence
                        }
                    );

                    this.sessionReport.recordMultimodalEvent(fusionResult);
                    this.callbacks.onFusionResult(fusionResult);
                }

                // System metrics
                this._updateSystemMetrics();
            }
        } catch (error) {
            console.error('❌ Processing error:', error);
            this.callbacks.onError(error);
        }

        // Continue loop if running
        if (this.isRunning) {
            requestAnimationFrame(() => this._processingLoop());
        }
    }

    /**
     * Update system metrics
     * @private
     */
    _updateSystemMetrics() {
        this.systemMetrics.totalFramesProcessed++;

        const now = Date.now();
        const elapsed = now - this.systemMetrics.lastUpdateTime;

        if (elapsed >= 1000) {
            this.systemMetrics.fps = this.systemMetrics.totalFramesProcessed;
            this.systemMetrics.totalFramesProcessed = 0;
            this.systemMetrics.lastUpdateTime = now;

            this.callbacks.onSystemUpdate(this.getMetrics());
        }
    }

    /**
     * Pause emotion recognition
     */
    pause() {
        this.isPaused = true;
        console.log('⏸️  Emotion recognition paused');
    }

    /**
     * Resume emotion recognition
     */
    resume() {
        if (!this.isRunning) {
            console.warn('⚠️  System not running. Call start() first.');
            return;
        }
        this.isPaused = false;
        console.log('▶️  Emotion recognition resumed');
        this._processingLoop();
    }

    /**
     * Stop emotion recognition
     */
    stop() {
        this.isRunning = false;
        this.isPaused = false;
        
        // Clean up audio
        if (this.audioRecognizer) {
            this.audioRecognizer.stop();
        }

        console.log('⏹️  Emotion recognition stopped');
    }

    /**
     * Get current system metrics and status
     * @returns {Object} System metrics
     */
    getMetrics() {
        return {
            running: this.isRunning,
            paused: this.isPaused,
            fps: this.systemMetrics.fps,
            emotionDetectorMetrics: this.emotionDetector.getPerformanceMetrics(),
            temporalModelStats: this.temporalModel.getStatistics(),
            audioStats: this.audioRecognizer.getStatistics(),
            multimodalMetrics: this.multimodalFusion.getMetrics(),
            timestamp: Date.now()
        };
    }

    /**
     * Get detailed analysis
     * @returns {Object} Current analysis data
     */
    getAnalysis() {
        return {
            emotionalTrend: this.temporalModel.getDominantEmotionTrend(),
            temporalStability: {
                score: this.temporalModel.stabilityScore,
                level: this.temporalModel.getPredictionConfidenceLevel()
            },
            multimodalAgreement: this.multimodalFusion.analyzeAgreement(),
            emotionTimeline: this.multimodalFusion.getTimeline().slice(-100),
            recentSaliencyMaps: this.explainableAI.getRecentSaliencyMaps(5)
        };
    }

    /**
     * Compare detector performance
     * @param {number} duration - Benchmark duration in seconds
     * @returns {Promise<Object>} Comparison results
     */
    async compareDetectors(duration = 30) {
        if (!this.videoElement) {
            throw new Error('Video element not initialized');
        }

        return await this.performanceComparison.runComparison(
            this.videoElement,
            this.emotionDetector,
            duration
        );
    }

    /**
     * Generate comprehensive session report
     * @returns {Object} Complete session report
     */
    generateSessionReport() {
        return this.sessionReport.generateReport();
    }

    /**
     * Export session report
     * @param {string} format - Format: 'json', 'text', or 'both'
     * @returns {Object|string} Exported report
     */
    exportSessionReport(format = 'both') {
        switch (format) {
            case 'json':
                return this.sessionReport.exportJSON();
            case 'text':
                return this.sessionReport.exportText();
            case 'both':
                return {
                    json: this.sessionReport.exportJSON(),
                    text: this.sessionReport.exportText()
                };
            default:
                return null;
        }
    }

    /**
     * Adjust multimodal fusion weights
     * @param {number} facialWeight - Facial weight (0-1)
     * @param {number} audioWeight - Audio weight (0-1)
     */
    adjustFusionWeights(facialWeight, audioWeight) {
        this.multimodalFusion.adjustWeights(facialWeight, audioWeight);
        this.config.facialWeight = facialWeight;
        this.config.audioWeight = audioWeight;
        console.log(`✅ Fusion weights adjusted: Facial=${facialWeight}, Audio=${audioWeight}`);
    }

    /**
     * Reset all systems
     */
    reset() {
        this.stop();
        this.temporalModel.reset();
        this.audioRecognizer.reset();
        this.multimodalFusion.reset();
        this.explainableAI.reset();
        this.sessionReport.reset();
        this.performanceComparison.reset();
        this.systemMetrics = {
            totalFramesProcessed: 0,
            averageProcessingTime: 0,
            fps: 0,
            lastUpdateTime: Date.now()
        };
        console.log('🔄 All systems reset');
    }

    /**
     * Get system status summary
     * @returns {Object} Status summary
     */
    getStatus() {
        return {
            running: this.isRunning,
            paused: this.isPaused,
            components: {
                facialDetection: {
                    enabled: this.config.enableFacial,
                    loaded: this.emotionDetector.modelsLoaded
                },
                audioDetection: {
                    enabled: this.config.enableAudio,
                    initialized: this.audioRecognizer.isInitialized
                },
                multimodalFusion: {
                    enabled: this.config.enableMultimodal,
                    weights: {
                        facial: this.config.facialWeight,
                        audio: this.config.audioWeight
                    }
                },
                explainability: {
                    enabled: this.config.enableExplainability
                },
                reporting: {
                    enabled: this.config.enableReporting
                }
            },
            metrics: this.getMetrics()
        };
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultimodalEmotionSystem;
}
