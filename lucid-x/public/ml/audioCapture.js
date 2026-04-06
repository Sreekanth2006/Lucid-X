/**
 * Enhanced Audio Emotion Recognition Module with Meyda Integration
 * Captures microphone input and extracts audio features for emotion prediction
 * Uses Meyda library for advanced feature extraction when available
 * Falls back to built-in FFT analysis if Meyda unavailable
 * 
 * Features extracted:
 * - MFCC (Mel-Frequency Cepstral Coefficients)
 * - Energy / RMS
 * - Spectral Centroid
 * - Spectral Spread
 * - Zero Crossing Rate
 * - Chroma Features (when using Meyda)
 * 
 * @module audioEmotionRecognitionEnhanced
 * @requires Web Audio API
 * @requires Meyda (optional)
 */

class AudioCaptureModule {
    /**
     * Handle raw audio capture from microphone
     */
    constructor(config = {}) {
        this.config = {
            sampleRate: config.sampleRate || 16000,
            channelCount: config.channelCount || 1,
            bufferSize: config.bufferSize || 4096,
            useMeyda: config.useMeyda !== false,
            echoCancellation: config.echoCancellation !== false,
            noiseSuppression: config.noiseSuppression !== false,
            autoGainControl: config.autoGainControl !== false,
            ...config
        };

        this.audioContext = null;
        this.mediaStream = null;
        this.source = null;
        this.analyser = null;
        this.scriptProcessor = null;
        this.isInitialized = false;
        this.isMeydasAvailable = false;

        // Callbacks
        this.onAudioData = config.onAudioData || (() => {});
    }

    /**
     * Initialize microphone capture
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            console.log('🎤 Initializing audio capture...');

            // Check if Meyda is available globally
            this.isMeydasAvailable = typeof Meyda !== 'undefined';
            if (this.isMeydasAvailable) {
                console.log('✅ Meyda library detected');
            } else {
                console.log('⚠️  Meyda not available, using fallback features');
            }

            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: this.config.echoCancellation,
                    noiseSuppression: this.config.noiseSuppression,
                    autoGainControl: this.config.autoGainControl,
                    sampleRate: this.config.sampleRate
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create media source
            this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Create analyser for FFT analysis
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            
            this.source.connect(this.analyser);

            // Setup script processor for raw audio processing
            this.scriptProcessor = this.audioContext.createScriptProcessor(
                this.config.bufferSize, 
                this.config.channelCount, 
                this.config.channelCount
            );

            this.source.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);

            // Callback on audio processing
            this.scriptProcessor.onaudioprocess = (event) => {
                const audioData = event.inputBuffer.getChannelData(0);
                this.onAudioData({
                    rawAudio: audioData,
                    timestamp: this.audioContext.currentTime,
                    sampleRate: this.audioContext.sampleRate
                });
            };

            this.isInitialized = true;
            console.log('✅ Audio capture initialized successfully');
            console.log(`  - Sample Rate: ${this.audioContext.sampleRate}Hz`);
            console.log(`  - Buffer Size: ${this.config.bufferSize}`);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize audio capture:', error);
            if (error.name === 'NotAllowedError') {
                console.error('   → Microphone permission denied');
            } else if (error.name === 'NotFoundError') {
                console.error('   → No microphone found');
            }
            return false;
        }
    }

    /**
     * Get current frequency data
     * @returns {Uint8Array}
     */
    getFrequencyData() {
        if (!this.analyser) return null;
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);
        return data;
    }

    /**
     * Stop audio capture
     */
    stop() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
        }
        if (this.source) {
            this.source.disconnect();
        }
        this.isInitialized = false;
    }

    /**
     * Get audio context sample rate
     */
    getSampleRate() {
        return this.audioContext?.sampleRate || 44100;
    }
}

/**
 * Audio Feature Extraction Module
 * Extracts features using Meyda (if available) or fallback methods
 */
class AudioFeatureExtractor {
    constructor(config = {}) {
        this.config = {
            numMFCC: config.numMFCC || 13,
            useMeyda: config.useMeyda !== false,
            featureUpdateRate: config.featureUpdateRate || 100, // ms
            ...config
        };

        this.isMeydasAvailable = typeof Meyda !== 'undefined';
        this.meydaAnalyzer = null;
        this.featureBuffer = [];
        this.lastFeatureTime = 0;

        // Feature statistics for normalization
        this.featureStats = {
            energy: { min: -100, max: 0 },
            spectralCentroid: { min: 0, max: 8000 },
            zeroCrossingRate: { min: 0, max: 1 },
            mfcc: new Array(this.config.numMFCC).fill(0).map(() => ({ min: -1000, max: 1000 }))
        };
    }

    /**
     * Initialize Meyda if available
     * @param {AudioContext} audioContext
     * @param {AudioNode} sourceNode
     */
    initializeMeyda(audioContext, sourceNode) {
        if (!this.isMeydasAvailable) {
            console.warn('⚠️  Meyda library not available');
            return false;
        }

        try {
            // Request features from Meyda
            this.meydaAnalyzer = Meyda.createMeydaAnalyzer({
                audioContext: audioContext,
                source: sourceNode,
                bufferSize: 2048,
                featureExtractors: [
                    'mfcc',
                    'energy',
                    'spectralCentroid',
                    'spectralFlatness',
                    'spectralRolloff',
                    'zeroCrossingRate',
                    'chroma'
                ],
                callback: (features) => {
                    // Features received asynchronously
                }
            });

            console.log('✅ Meyda analyzer initialized');
            return true;
        } catch (error) {
            console.warns('⚠️  Meyda initialization failed:', error);
            return false;
        }
    }

    /**
     * Extract features from frequency data
     * Uses Meyda if available, falls back to built-in
     * @param {Uint8Array} frequencyData - FFT output
     * @param {Float32Array} waveformData - Raw audio samples
     * @returns {Object} Extracted features
     */
    extractFeatures(frequencyData, waveformData = null) {
        const now = Date.now();
        
        // Check rate limiting
        if (now - this.lastFeatureTime < this.config.featureUpdateRate) {
            return null;
        }
        this.lastFeatureTime = now;

        let features = {
            timestamp: now,
            usedMeyda: false
        };

        // Try Meyda first if available
        if (this.isMeydasAvailable && this.meydaAnalyzer) {
            try {
                const meydaFeatures = this.meydaAnalyzer.extract();
                if (meydaFeatures) {
                    features = {
                        ...features,
                        ...meydaFeatures,
                        usedMeyda: true
                    };
                }
            } catch (error) {
                console.warn('Meyda extraction failed, using fallback');
            }
        }

        // Fallback to built-in extraction if Meyda not available or failed
        if (!features.usedMeyda) {
            const fallbackFeatures = this._extractFallbackFeatures(frequencyData, waveformData);
            features = { ...features, ...fallbackFeatures };
        }

        // Normalize features
        features = this._normalizeFeatures(features);

        // Store in buffer
        this.featureBuffer.push(features);
        if (this.featureBuffer.length > 100) {
            this.featureBuffer.shift();
        }

        return features;
    }

    /**
     * Fallback feature extraction without Meyda
     * @private
     */
    _extractFallbackFeatures(frequencyData, waveformData = null) {
        const features = {};

        // Energy / RMS
        features.energy = this._calculateEnergy(frequencyData);

        // Spectral Centroid
        features.spectralCentroid = this._calculateSpectralCentroid(frequencyData);

        // Spectral Spread (variance)
        features.spectralSpread = this._calculateSpectralSpread(frequencyData);

        // Zero Crossing Rate (if waveform available)
        features.zeroCrossingRate = waveformData 
            ? this._calculateZeroCrossingRate(waveformData)
            : 0;

        // MFCC approximation
        features.mfcc = this._approximateMFCC(frequencyData);

        return features;
    }

    /**
     * Calculate energy from frequency spectrum
     * @private
     */
    _calculateEnergy(frequencyData) {
        let energy = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            energy += frequencyData[i] ** 2;
        }
        // Convert to dB scale
        const rms = Math.sqrt(energy / frequencyData.length) / 255;
        const db = 20 * Math.log10(Math.max(rms, 0.00001));
        return Math.max(-100, Math.min(0, db));
    }

    /**
     * Calculate spectral centroid (brightness indicator)
     * @private
     */
    _calculateSpectralCentroid(frequencyData) {
        let numerator = 0;
        let denominator = 0;

        for (let i = 0; i < frequencyData.length; i++) {
            numerator += i * frequencyData[i];
            denominator += frequencyData[i];
        }

        if (denominator === 0) return 0;
        
        // Approximate frequency: bin_index / (fft_size / 2) * nyquist
        // Nyquist ≈ 22050 Hz for standard audio
        const binFreq = (numerator / denominator) * (22050 / frequencyData.length);
        return Math.min(8000, binFreq);
    }

    /**
     * Calculate spectral spread (variance around centroid)
     * @private
     */
    _calculateSpectralSpread(frequencyData) {
        const centroid = this._calculateSpectralCentroid(frequencyData);
        let variance = 0;
        let energy = 0;

        for (let i = 0; i < frequencyData.length; i++) {
            const freq = i * (22050 / frequencyData.length);
            variance += frequencyData[i] * ((freq - centroid) ** 2);
            energy += frequencyData[i];
        }

        if (energy === 0) return 0;
        return Math.sqrt(variance / energy);
    }

    /**
     * Calculate zero-crossing rate from waveform
     * @private
     */
    _calculateZeroCrossingRate(waveformData, windowSize = 512) {
        let zcr = 0;
        let validSamples = 0;

        for (let i = 1; i < Math.min(windowSize, waveformData.length); i++) {
            // Count sign changes
            if ((waveformData[i - 1] >= 0 && waveformData[i] < 0) ||
                (waveformData[i - 1] < 0 && waveformData[i] >= 0)) {
                zcr++;
            }
            validSamples++;
        }

        return validSamples > 0 ? zcr / validSamples : 0;
    }

    /**
     * Approximate MFCC without full Mel-scale filtering
     * Returns 13-band MFCC-like features
     * @private
     */
    _approximateMFCC(frequencyData) {
        const mfccBands = this.config.numMFCC;
        const mfcc = new Array(mfccBands).fill(0);

        // Divide spectrum into logarithmic bands (Mel-scale approximation)
        const bandSize = Math.floor(frequencyData.length / mfccBands);

        for (let band = 0; band < mfccBands; band++) {
            let energy = 0;
            const startIdx = band * bandSize;
            const endIdx = Math.min((band + 1) * bandSize, frequencyData.length);

            for (let i = startIdx; i < endIdx; i++) {
                energy += frequencyData[i] ** 2;
            }

            // Log magnitude (similar to MFCC log compression)
            mfcc[band] = Math.log(1 + Math.sqrt(energy / (endIdx - startIdx)));
        }

        return mfcc;
    }

    /**
     * Normalize features to standard ranges
     * @private
     */
    _normalizeFeatures(features) {
        const normalized = { ...features };

        // Normalize energy to [0, 1]
        if (normalized.energy !== undefined) {
            normalized.energy = (normalized.energy + 100) / 100;
            normalized.energy = Math.max(0, Math.min(1, normalized.energy));
        }

        // Normalize spectral centroid
        if (normalized.spectralCentroid !== undefined) {
            normalized.spectralCentroid = Math.min(1, normalized.spectralCentroid / 8000);
        }

        // Normalize MFCC array
        if (normalized.mfcc && Array.isArray(normalized.mfcc)) {
            normalized.mfcc = normalized.mfcc.map(val => {
                // Scale to [-1, 1]
                return Math.max(-1, Math.min(1, val / 50));
            });
        }

        return normalized;
    }

    /**
     * Get feature statistics over buffer
     * @returns {Object}
     */
    getStatistics() {
        if (this.featureBuffer.length === 0) return null;

        const stats = {};

        // Calculate mean and std for each feature
        if (this.featureBuffer[0].energy !== undefined) {
            const energies = this.featureBuffer.map(f => f.energy);
            stats.energyMean = energies.reduce((a, b) => a + b) / energies.length;
            stats.energyStd = Math.sqrt(
                energies.reduce((sq, n) => sq + (n - stats.energyMean) ** 2) / energies.length
            );
        }

        if (this.featureBuffer[0].spectralCentroid !== undefined) {
            const centroids = this.featureBuffer.map(f => f.spectralCentroid);
            stats.centroidMean = centroids.reduce((a, b) => a + b) / centroids.length;
        }

        return stats;
    }

    /**
     * Clear feature buffer
     */
    reset() {
        this.featureBuffer = [];
    }
}

// Export modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioCaptureModule, AudioFeatureExtractor };
}
