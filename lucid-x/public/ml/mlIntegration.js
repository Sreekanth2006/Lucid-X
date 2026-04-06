/**
 * Lucid-X ML Integration Module
 * Shows how to integrate MultimodalEmotionSystem into existing portal
 * 
 * This module provides the glue between existing WebRTC/Socket.IO
 * and the new emotion recognition system.
 * 
 * @module mlIntegration
 */

class MLIntegration {
    constructor(config = {}) {
        this.config = {
            remoteVideoId: config.remoteVideoId || 'remoteVideo',
            dashboardContainerId: config.dashboardContainerId || 'emotionDashboard',
            enableDashboard: config.enableDashboard !== false,
            enableReporting: config.enableReporting !== false,
            socketInstance: config.socketInstance,
            ...config
        };

        this.emotionSystem = null;
        this.dashboard = null;
        this.isInitialized = false;
    }

    /**
     * Initialize ML system with existing portal
     * Call this after WebRTC video is flowing
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            console.log('🤖 Initializing Emotion Recognition System...');

            // Create emotion system
            this.emotionSystem = new MultimodalEmotionSystem({
                enableAudio: true,
                enableFacial: true,
                enableMultimodal: true,
                enableExplainability: true,
                enableReporting: this.config.enableReporting,
                facialWeight: 0.6,
                audioWeight: 0.4,

                // Setup callbacks
                onEmotionDetected: (result) => this._handleFacialEmotion(result),
                onAudioDetected: (result) => this._handleAudioEmotion(result),
                onFusionResult: (result) => this._handleFusionResult(result),
                onSystemUpdate: (metrics) => this._handleSystemUpdate(metrics),
                onError: (error) => this._handleError(error)
            });

            // Get video element
            const videoElement = document.getElementById(this.config.remoteVideoId);
            if (!videoElement) {
                throw new Error(`Video element with id '${this.config.remoteVideoId}' not found`);
            }

            // Initialize emotion system
            const initialized = await this.emotionSystem.initialize(videoElement, true);
            if (!initialized) {
                throw new Error('Failed to initialize emotion system');
            }

            // Setup dashboard if enabled
            if (this.config.enableDashboard) {
                this._setupDashboard();
            }

            this.isInitialized = true;
            console.log('✅ ML System initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ ML Initialization failed:', error);
            this._handleError(error);
            return false;
        }
    }

    /**
     * Start emotion recognition
     */
    start() {
        if (!this.isInitialized) {
            console.warn('⚠️  System not initialized. Call initialize() first.');
            return;
        }

        this.emotionSystem.start();
        console.log('▶️  Emotion recognition started');
    }

    /**
     * Stop emotion recognition
     */
    stop() {
        if (this.emotionSystem) {
            this.emotionSystem.stop();
            console.log('⏹️  Emotion recognition stopped');
        }
    }

    /**
     * Setup dashboard UI
     * @private
     */
    _setupDashboard() {
        try {
            const container = document.getElementById(this.config.dashboardContainerId);
            if (!container) {
                console.warn(`Dashboard container '${this.config.dashboardContainerId}' not found`);
                return;
            }

            this.dashboard = new EmotionDashboard(this.config.dashboardContainerId, {
                maxTimelinePoints: 300,
                showSaliency: true,
                showPerformance: true,

                // Connect export
                onExport: () => this._handleExport(),
                onReset: () => this._handleReset(),
                onPause: () => this.emotionSystem.pause()
            });

            console.log('✅ Dashboard initialized');
        } catch (error) {
            console.error('❌ Dashboard setup failed:', error);
        }
    }

    /**
     * Handle facial emotion detection
     * @private
     */
    _handleFacialEmotion(result) {
        if (!result) return;

        // Update dashboard if available
        if (this.dashboard) {
            this.dashboard.updateEmotionDisplay({
                emotion: result.dominantEmotion,
                confidence: result.confidence
            });
        }

        // Broadcast to server via Socket.IO if available
        if (this.config.socketInstance) {
            this.config.socketInstance.emit('emotionUpdate', {
                type: 'facial',
                emotion: result.dominantEmotion,
                confidence: result.confidence,
                timestamp: Date.now()
            });
        }

        // Custom callback if provided
        if (this.config.onEmotionDetected) {
            this.config.onEmotionDetected(result);
        }
    }

    /**
     * Handle audio emotion detection
     * @private
     */
    _handleAudioEmotion(result) {
        if (!result) return;

        // Update dashboard
        if (this.dashboard) {
            this.dashboard.updateAudioDisplay({
                emotion: result.emotion,
                confidence: result.confidence,
                energy: result.energy || 0.5
            });
        }

        // Broadcast to server
        if (this.config.socketInstance) {
            this.config.socketInstance.emit('audioEmotionUpdate', {
                emotion: result.emotion,
                confidence: result.confidence,
                energy: result.energy,
                timestamp: Date.now()
            });
        }

        if (this.config.onAudioDetected) {
            this.config.onAudioDetected(result);
        }
    }

    /**
     * Handle multimodal fusion result
     * @private
     */
    _handleFusionResult(result) {
        if (!result) return;

        // Update dashboard
        if (this.dashboard) {
            this.dashboard.updateMultimodalDisplay(result);

            // Update temporal stability
            const analysis = this.emotionSystem.getAnalysis();
            if (analysis.temporalStability) {
                this.dashboard.updateTemporalStability(analysis.temporalStability);
            }

            // Update saliency explanation
            if (result.explanation) {
                this.dashboard.updateExplanation(result.explanation);
            }
        }

        // Broadcast to server with full details
        if (this.config.socketInstance) {
            this.config.socketInstance.emit('multimodalEmotionUpdate', {
                fusedEmotion: result.fusedEmotion,
                fusedConfidence: result.fusedConfidence,
                consensusScore: result.consensusScore,
                agreement: result.agreement,
                facialEmotion: result.facialEmotion,
                audioEmotion: result.audioEmotion,
                timestamp: Date.now()
            });
        }

        if (this.config.onFusionResult) {
            this.config.onFusionResult(result);
        }
    }

    /**
     * Handle system metrics update
     * @private
     */
    _handleSystemUpdate(metrics) {
        // Update dashboard performance metrics
        if (this.dashboard) {
            this.dashboard.updatePerformanceMetrics(metrics);
        }

        // Log metrics periodically
        if (metrics.fps % 10 === 0) {
            console.log(`📊 FPS: ${metrics.fps}, Detection: ${metrics.emotionDetectorMetrics?.averageDetectionTime?.toFixed(1)}ms`);
        }

        if (this.config.onSystemUpdate) {
            this.config.onSystemUpdate(metrics);
        }
    }

    /**
     * Handle errors
     * @private
     */
    _handleError(error) {
        console.error('❌ ML System Error:', error);

        // Show error to user if UI available
        if (this.dashboard) {
            const errorElement = document.createElement('div');
            errorElement.style.cssText = 'background: #f44336; color: white; padding: 10px; border-radius: 4px; margin-top: 10px;';
            errorElement.textContent = `Error: ${error.message}`;
            document.querySelector('[id$="Dashboard"]')?.appendChild(errorElement);
        }

        if (this.config.onError) {
            this.config.onError(error);
        }
    }

    /**
     * Handle report export
     * @private
     */
    _handleExport() {
        try {
            const report = this.emotionSystem.generateSessionReport();
            const jsonExport = this.emotionSystem.exportSessionReport('json');
            const textExport = this.emotionSystem.exportSessionReport('text');

            // Option 1: Download as file
            const filename = `emotion-report-${Date.now()}.json`;
            const blob = new Blob([JSON.stringify(jsonExport, null, 2)], {
                type: 'application/json'
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);

            // Option 2: Send to server
            if (this.config.socketInstance) {
                this.config.socketInstance.emit('saveSessionReport', {
                    report: jsonExport,
                    timestamp: new Date().toISOString()
                });
            }

            console.log('✅ Report exported');

            // Show confirmation
            alert('Session report exported and saved');
        } catch (error) {
            console.error('❌ Export failed:', error);
            alert('Failed to export report');
        }
    }

    /**
     * Handle reset
     * @private
     */
    _handleReset() {
        if (confirm('Reset all emotion data? This cannot be undone.')) {
            this.emotionSystem.reset();
            console.log('🔄 System reset');
        }
    }

    /**
     * Get current emotion analysis
     * @returns {Object} Current analysis data
     */
    getAnalysis() {
        return this.emotionSystem?.getAnalysis() || null;
    }

    /**
     * Get system metrics
     * @returns {Object} Current metrics
     */
    getMetrics() {
        return this.emotionSystem?.getMetrics() || null;
    }

    /**
     * Generate full session report
     * @returns {Object} Complete report
     */
    generateReport() {
        return this.emotionSystem?.generateSessionReport() || null;
    }

    /**
     * Compare detector performance
     * @param {number} duration - Benchmark duration in seconds
     * @returns {Promise<Object>}
     */
    async compareDetectors(duration = 30) {
        if (!this.emotionSystem) {
            throw new Error('System not initialized');
        }

        return await this.emotionSystem.compareDetectors(duration);
    }
}

/**
 * Usage Example in patient.html or therapist.html:
 * 
 * // Initialize after WebRTC is established
 * const mlIntegration = new MLIntegration({
 *     remoteVideoId: 'remoteVideo',
 *     dashboardContainerId: 'emotionDashboard',
 *     socketInstance: socket,
 *     enableDashboard: true,
 *     enableReporting: true,
 *     
 *     onEmotionDetected: (result) => {
 *         console.log('Facial:', result.dominantEmotion);
 *     },
 *     onFusionResult: (result) => {
 *         console.log('Fused emotion:', result.fusedEmotion);
 *     }
 * });
 * 
 * // Initialize ML system
 * await mlIntegration.initialize();
 * mlIntegration.start();
 * 
 * // Later: Export session report
 * const report = mlIntegration.generateReport();
 */

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MLIntegration;
}
