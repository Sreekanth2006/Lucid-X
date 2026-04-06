/**
 * COMPLETE INTEGRATION EXAMPLE
 * Real-Time Audio + Video Multimodal Emotion Recognition
 * 
 * This example shows how to integrate all audio modules with the existing
 * Lucid-X facial emotion detection system.
 * 
 * Steps:
 * 1. Audio capture setup
 * 2. Feature extraction loop
 * 3. Emotion prediction
 * 4. Temporal synchronization
 * 5. Multimodal fusion
 * 6. Real-time UI updates
 * 
 * @module integrationExample
 */

class LucidXAudioIntegration {
    constructor(config = {}) {
        this.config = {
            // Video elements
            remoteVideoId: config.remoteVideoId || 'remoteVideo',
            dashboardId: config.dashboardId || 'emotionDashboard',
            
            // Audio configuration
            audioSampleRate: config.audioSampleRate || 16000,
            featureUpdateRate: config.featureUpdateRate || 100, // ms
            
            // Feature extraction
            numMFCC: config.numMFCC || 13,
            useMeyda: config.useMeyda !== false,
            
            // Prediction method
            predictionMethod: config.predictionMethod || 'rule-based',
            
            // Fusion strategy
            fusionStrategy: config.fusionStrategy || 'adaptive',
            baseFacialWeight: config.baseFacialWeight || 0.6,
            baseAudioWeight: config.baseAudioWeight || 0.4,
            
            // Callbacks
            onEmotionUpdate: config.onEmotionUpdate || (() => {}),
            onError: config.onError || (() => {}),
            
            ...config
        };

        // Core modules
        this.audioCapture = null;
        this.featureExtractor = null;
        this.emotionPredictor = null;
        this.eventBuffer = null;
        this.multimodalFusion = null;

        // State
        this.isRunning = false;
        this.processingLoop = null;
        
        // Metrics
        this.metrics = {
            fps: 0,
            audioLatency: 0,
            isAudioAvailable: false,
            isFacialAvailable: false
        };
    }

    /**
     * Initialize all audio and fusion modules
     * Call this after the video is flowing
     */
    async initialize() {
        try {
            console.log('🚀 Initializing Lucid-X Audio Integration...');

            // 1. Audio Capture
            this.audioCapture = new AudioCaptureModule({
                sampleRate: this.config.audioSampleRate,
                useMeyda: this.config.useMeyda,
                onAudioData: (data) => this._processAudioFrame(data)
            });

            const audioCaptureReady = await this.audioCapture.initialize();
            if (!audioCaptureReady) {
                console.warn('⚠️  Audio capture failed, system will work with facial only');
                this.metrics.isAudioAvailable = false;
            } else {
                this.metrics.isAudioAvailable = true;
                console.log('✅ Audio capture ready');
            }

            // 2. Feature Extractor
            this.featureExtractor = new AudioFeatureExtractor({
                numMFCC: this.config.numMFCC,
                useMeyda: this.config.useMeyda,
                featureUpdateRate: this.config.featureUpdateRate
            });

            // Try to init Meyda if available
            if (this.metrics.isAudioAvailable && this.config.useMeyda) {
                try {
                    this.featureExtractor.initializeMeyda(
                        this.audioCapture.audioContext,
                        this.audioCapture.source
                    );
                } catch (error) {
                    console.warn('Meyda initialization failed, using fallback features');
                }
            }
            console.log('✅ Feature extractor ready');

            // 3. Emotion Predictor
            this.emotionPredictor = new AudioEmotionPredictor({
                predictionMethod: this.config.predictionMethod,
                smoothingWindow: 5
            });
            console.log('✅ Audio emotion predictor ready');

            // 4. Event Buffer (for synchronization)
            this.eventBuffer = new EmotionEventBuffer({
                maxBufferSize: 300,
                temporalWindow: 3000,
                onEmotionEvent: (event) => this._handleEmotionEvent(event)
            });
            console.log('✅ Event buffer ready');

            // 5. Multimodal Fusion
            this.multimodalFusion = new AdvancedMultimodalFusion({
                fusionStrategy: this.config.fusionStrategy,
                baseFacialWeight: this.config.baseFacialWeight,
                baseAudioWeight: this.config.baseAudioWeight,
                enableExplanation: true
            });
            console.log('✅ Multimodal fusion engine ready');

            console.log('✅ ALL MODULES INITIALIZED SUCCESSFULLY');
            console.log(`   - Audio: ${this.metrics.isAudioAvailable ? '✓' : '✗'}`);
            console.log(`   - Facial: (expected from existing system)`);
            console.log(`   - Fusion Strategy: ${this.config.fusionStrategy}`);

            return true;
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.config.onError(error);
            return false;
        }
    }

    /**
     * Start the real-time processing loop
     */
    start() {
        if (this.isRunning) {
            console.warn('Already running');
            return;
        }

        this.isRunning = true;
        console.log('▶️  Starting real-time emotion recognition');

        this._startProcessingLoop();
    }

    /**
     * Stop real-time processing
     */
    stop() {
        this.isRunning = false;
        if (this.audioCapture) {
            this.audioCapture.stop();
        }
        if (this.processingLoop) {
            cancelAnimationFrame(this.processingLoop);
        }
        console.log('⏹️  Stopped');
    }

    /**
     * Record facial emotion from existing system
     * Called from your existing facial emotion detector
     * 
     * Example usage:
     * const integration = new LucidXAudioIntegration();
     * await integration.initialize();
     * 
     * // In your facial detection loop:
     * if (detections.length > 0) {
     *     const face = detections[0];
     *     integration.recordFaceEmotion({
     *         dominantEmotion: 'happy',
     *         confidence: 0.92,
     *         allExpressions: {...},
     *         ...
     *     });
     * }
     */
    recordFaceEmotion(faceEmotionResult, videoTimestamp = null) {
        if (!this.eventBuffer) return;

        this.metrics.isFacialAvailable = true;
        const ts = videoTimestamp || performance.now();
        
        this.eventBuffer.recordFaceEmotion(faceEmotionResult, ts);
    }

    /**
     * Get current emotion state
     * Returns latest fused emotion
     */
    getCurrentEmotion() {
        const recentEvents = this.eventBuffer?.getRecentEvents(1);
        if (recentEvents && recentEvents.length > 0) {
            return recentEvents[0].fused || recentEvents[0].faceEmotion;
        }
        return null;
    }

    /**
     * Get emotion statistics for dashboard
     */
    getStatistics() {
        return {
            buffer: this.eventBuffer?.getWindowStatistics(),
            fusion: this.multimodalFusion?.getStatistics(),
            audioPredictor: this.emotionPredictor?.getStatistics(),
            metrics: this.metrics
        };
    }

    /**
     * Export current session data
     */
    exportSessionData() {
        return {
            events: this.eventBuffer?.exportBuffer('json'),
            statistics: this.getStatistics(),
            timestamp: new Date().toISOString()
        };
    }

    // =============================================
    // INTERNAL METHODS
    // =============================================

    /**
     * Process audio frame from ScriptProcessor
     * Called automatically as audio comes in
     * @private
     */
    _processAudioFrame(audioData) {
        if (!this.isRunning) return;

        // Extract features from current frame
        const frequencyData = this.audioCapture.getFrequencyData();
        if (!frequencyData) return;

        const features = this.featureExtractor.extractFeatures(
            frequencyData,
            audioData.rawAudio
        );

        if (!features) return;

        // Predict emotion
        const audioEmotion = this.emotionPredictor.predictEmotion(features);
        
        // Record in buffer
        if (audioEmotion && this.eventBuffer) {
            this.eventBuffer.recordAudioEmotion(audioEmotion);
        }
    }

    /**
     * Main processing loop (runs at video frame rate)
     * @private
     */
    _startProcessingLoop() {
        const processFrame = () => {
            if (!this.isRunning) return;

            try {
                // Update metrics
                this._updateMetrics();

                // Get current fused emotion for UI
                const currentEmotion = this.getCurrentEmotion();
                if (currentEmotion) {
                    this.config.onEmotionUpdate(currentEmotion);
                }
            } catch (error) {
                console.error('Processing error:', error);
            }

            this.processingLoop = requestAnimationFrame(processFrame);
        };

        this.processingLoop = requestAnimationFrame(processFrame);
    }

    /**
     * Update performance metrics
     * @private
     */
    _updateMetrics() {
        const stats = this.eventBuffer?.getWindowStatistics();
        if (stats) {
            // Rough FPS estimate
            this.metrics.fps = Math.round(stats.videoEvents / (stats.duration / 1000));
        }
    }

    /**
     * Handle emotion event callbacks
     * @private
     */
    _handleEmotionEvent(event) {
        // This is called when new emotion events are added to buffer
        // Can be used for real-time updates, logging, etc.
    }
}

/**
 * USAGE EXAMPLE IN patient.html OR therapist.html
 * 
 * // 1. Create instance
 * const integration = new LucidXAudioIntegration({
 *     remoteVideoId: 'remoteVideo',
 *     dashboardId: 'emotionPanel',
 *     fusionStrategy: 'adaptive',
 *     baseFacialWeight: 0.6,
 *     baseAudioWeight: 0.4,
 *     
 *     onEmotionUpdate: (emotion) => {
 *         // Update UI with current emotion
 *         updateDashboard(emotion);
 *     },
 *     
 *     onError: (error) => {
 *         console.error('Audio emotion error:', error);
 *     }
 * });
 * 
 * // 2. Initialize (after WebRTC is ready)
 * await integration.initialize();
 * integration.start();
 * 
 * // 3. In your facial detection loop:
 * // (Modify your existing emotionDetector.detectEmotions call)
 * const detections = await emotionDetector.detectEmotions(videoElement);
 * if (detections.length > 0) {
 *     const faceData = detections[0];
 *     
 *     // Record facial emotion in audio integration
 *     integration.recordFaceEmotion(faceData);
 *     
 *     // Update facial UI
 *     updateFacialEmotion(faceData);
 * }
 * 
 * // 4. Later: Get statistics for dashboard
 * const stats = integration.getStatistics();
 * displayEmotionTimeline(stats.buffer);
 * displayAgreementMetrics(stats.fusion);
 * 
 * // 5. Export session data
 * const sessionData = integration.exportSessionData();
 * saveToServer(sessionData);
 * 
 * // 6. On session end
 * integration.stop();
 */

/**
 * HTML SETUP
 * 
 * <div id="emotionDashboard" style="margin-top: 20px;">
 *   <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
 *     
 *     <!-- Current Emotions -->
 *     <div style="background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
 *       <h3 style="margin: 0 0 10px 0; color: #666; font-size: 12px; font-weight: 600;">FACIAL EMOTION</h3>
 *       <div id="facialEmotionDisplay" style="font-size: 24px; font-weight: bold; color: #2196F3;">--</div>
 *     </div>
 *     
 *     <div style="background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
 *       <h3 style="margin: 0 0 10px 0; color: #666; font-size: 12px; font-weight: 600;">AUDIO EMOTION</h3>
 *       <div id="audioEmotionDisplay" style="font-size: 24px; font-weight: bold; color: #FF9800;">--</div>
 *     </div>
 *     
 *     <div style="background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
 *       <h3 style="margin: 0 0 10px 0; color: #666; font-size: 12px; font-weight: 600;">FUSED EMOTION</h3>
 *       <div id="fusedEmotionDisplay" style="font-size: 24px; font-weight: bold; color: #4CAF50;">--</div>
 *     </div>
 *     
 *   </div>
 *   
 *   <div style="margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px;">
 *     <h3 style="margin: 0 0 10px 0; color: #666; font-size: 12px; font-weight: 600;">AGREEMENT METRICS</h3>
 *     <div id="agreementMetrics" style="font-size: 12px; color: #999;">
 *       <!-- Filled by JavaScript -->
 *     </div>
 *   </div>
 * </div>
 * 
 * <script>
 * // Initialize integration
 * const integration = new LucidXAudioIntegration({
 *     onEmotionUpdate: (emotion) => {
 *         if (emotion.fused) {
 *             document.getElementById('fusedEmotionDisplay').textContent = 
 *                 emotion.fused.emotion.toUpperCase();
 *         }
 *         if (emotion.faceEmotion) {
 *             document.getElementById('facialEmotionDisplay').textContent = 
 *                 emotion.faceEmotion.emotion.toUpperCase();
 *         }
 *         if (emotion.audioEmotion) {
 *             document.getElementById('audioEmotionDisplay').textContent = 
 *                 emotion.audioEmotion.emotion.toUpperCase();
 *         }
 *     }
 * });
 * 
 * await integration.initialize();
 * integration.start();
 * </script>
 */

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LucidXAudioIntegration;
}
