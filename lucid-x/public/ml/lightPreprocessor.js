/**
 * Light Preprocessing Engine
 * Handles low-light image enhancement and preprocessing
 * Includes histogram equalization, brightness normalization, and contrast enhancement
 * 
 * @module lightPreprocessor
 */

class LightPreprocessor {
    constructor(config = {}) {
        this.config = {
            enableHistogramEqualization: config.enableHistogramEqualization !== false,
            enableBrightnessNormalization: config.enableBrightnessNormalization !== false,
            enableContrastEnhancement: config.enableContrastEnhancement !== false,
            gammaCorrection: config.gammaCorrection !== false,
            targetBrightness: config.targetBrightness || 150,
            brightnessThreshold: config.brightnessThreshold || 80,
            ...config
        };

        this.stats = {
            imagesProcessed: 0,
            lowLightImages: 0,
            averageProcessingTime: 0
        };
    }

    /**
     * Preprocess frame (main entry point)
     * @param {CanvasImageData|HTMLCanvasElement} imageData - Frame to process
     * @returns {ImageData} Processed image data
     */
    preprocessFrame(imageData) {
        const startTime = performance.now();
        let processedData = imageData;

        try {
            // Convert canvas to ImageData if needed
            if (imageData instanceof HTMLCanvasElement) {
                const ctx = imageData.getContext('2d');
                processedData = ctx.getImageData(0, 0, imageData.width, imageData.height);
            }

            // Check if image is low-light
            const brightness = this._calculateAverageBrightness(processedData);
            const isLowLight = brightness < this.config.brightnessThreshold;

            if (isLowLight) {
                this.stats.lowLightImages++;

                // Apply preprocessing pipeline for low-light
                if (this.config.enableBrightnessNormalization) {
                    processedData = this._normalizeBrightness(processedData, this.config.targetBrightness);
                }

                if (this.config.enableHistogramEqualization) {
                    processedData = this._adaptiveHistogramEqualization(processedData);
                }

                if (this.config.enableContrastEnhancement) {
                    processedData = this._enhanceContrast(processedData);
                }
            }

            // Apply gamma correction if enabled
            if (this.config.gammaCorrection) {
                processedData = this._applyGammaCorrection(processedData, 1.2);
            }

            this.stats.imagesProcessed++;
            const endTime = performance.now();
            this.stats.averageProcessingTime = 
                (this.stats.averageProcessingTime * (this.stats.imagesProcessed - 1) + 
                 (endTime - startTime)) / this.stats.imagesProcessed;

            return processedData;
        } catch (error) {
            console.error('❌ Preprocessing error:', error);
            return imageData;
        }
    }

    /**
     * Calculate average brightness
     * @private
     */
    _calculateAverageBrightness(imageData) {
        const data = imageData.data;
        let totalBrightness = 0;
        const sampleSize = Math.min(1000, data.length / 4); // Sample for performance

        for (let i = 0; i < data.length; i += (data.length / sampleSize) * 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Standard brightness formula
            totalBrightness += 0.299 * r + 0.587 * g + 0.114 * b;
        }

        return totalBrightness / sampleSize;
    }

    /**
     * Normalize brightness to target level
     * @private
     */
    _normalizeBrightness(imageData, targetBrightness) {
        const data = imageData.data;
        const currentBrightness = this._calculateAverageBrightness(imageData);
        
        if (currentBrightness === 0) return imageData;

        const brightnessFactor = targetBrightness / currentBrightness;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * brightnessFactor);     // R
            data[i + 1] = Math.min(255, data[i + 1] * brightnessFactor); // G
            data[i + 2] = Math.min(255, data[i + 2] * brightnessFactor); // B
            // A (alpha) unchanged
        }

        return imageData;
    }

    /**
     * Adaptive histogram equalization (CLAHE-style)
     * Divides image into blocks and equalizes each block locally
     * @private
     */
    _adaptiveHistogramEqualization(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // Convert to grayscale for processing
        const gray = new Uint8ClampedArray(width * height);
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        // Divide into blocks (8x8 recommended for real-time)
        const blockSize = 8;
        const processedGray = new Uint8ClampedArray(gray);

        for (let by = 0; by < Math.ceil(height / blockSize); by++) {
            for (let bx = 0; bx < Math.ceil(width / blockSize); bx++) {
                this._equalizeBlock(processedGray, gray, width, height, bx, by, blockSize);
            }
        }

        // Convert back to RGBA
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            const val = processedGray[j];
            data[i] = val;     // R
            data[i + 1] = val; // G
            data[i + 2] = val; // B
            // Keep original alpha
        }

        return imageData;
    }

    /**
     * Equalize single block
     * @private
     */
    _equalizeBlock(processedGray, gray, width, height, bx, by, blockSize) {
        const blockStartX = bx * blockSize;
        const blockStartY = by * blockSize;
        const blockEndX = Math.min(blockStartX + blockSize, width);
        const blockEndY = Math.min(blockStartY + blockSize, height);

        // Calculate histogram for this block
        const histogram = new Uint32Array(256);
        let totalPixels = 0;

        for (let y = blockStartY; y < blockEndY; y++) {
            for (let x = blockStartX; x < blockEndX; x++) {
                const idx = y * width + x;
                histogram[gray[idx]]++;
                totalPixels++;
            }
        }

        // Calculate CDF
        const cdf = new Uint32Array(256);
        cdf[0] = histogram[0];
        for (let i = 1; i < 256; i++) {
            cdf[i] = cdf[i - 1] + histogram[i];
        }

        // Create lookup table
        const lut = new Uint8ClampedArray(256);
        const cdfMin = cdf[0];
        for (let i = 0; i < 256; i++) {
            lut[i] = Math.round(((cdf[i] - cdfMin) / (totalPixels - cdfMin)) * 255);
        }

        // Apply LUT to block
        for (let y = blockStartY; y < blockEndY; y++) {
            for (let x = blockStartX; x < blockEndX; x++) {
                const idx = y * width + x;
                processedGray[idx] = lut[gray[idx]];
            }
        }
    }

    /**
     * Enhance contrast
     * @private
     */
    _enhanceContrast(imageData) {
        const data = imageData.data;

        // Find min and max values
        let minVal = 255, maxVal = 0;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            minVal = Math.min(minVal, gray);
            maxVal = Math.max(maxVal, gray);
        }

        const range = maxVal - minVal;
        if (range === 0) return imageData;

        // Stretch contrast
        for (let i = 0; i < data.length; i += 4) {
            const value = Math.round(((0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) - minVal) / range * 255);
            
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
        }

        return imageData;
    }

    /**
     * Apply gamma correction
     * @private
     */
    _applyGammaCorrection(imageData, gamma) {
        const data = imageData.data;
        const invGamma = 1.0 / gamma;

        // Precompute gamma lookup table
        const gammaLUT = new Uint8ClampedArray(256);
        for (let i = 0; i < 256; i++) {
            gammaLUT[i] = Math.round(255 * Math.pow(i / 255, invGamma));
        }

        // Apply gamma correction
        for (let i = 0; i < data.length; i += 4) {
            data[i] = gammaLUT[data[i]];
            data[i + 1] = gammaLUT[data[i + 1]];
            data[i + 2] = gammaLUT[data[i + 2]];
        }

        return imageData;
    }

    /**
     * Denoise using bilateral filtering approximation
     * @private
     */
    _denoise(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const denoised = new Uint8ClampedArray(data);

        const kernelSize = 3;
        const colorSigma = 50;
        const spatialSigma = 10;

        for (let i = 0; i < denoised.length; i += 4) {
            const pixelIdx = i / 4;
            const x = pixelIdx % width;
            const y = Math.floor(pixelIdx / width);

            let r = 0, g = 0, b = 0, weight = 0;

            for (let dy = -kernelSize; dy <= kernelSize; dy++) {
                for (let dx = -kernelSize; dx <= kernelSize; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const nIdx = (ny * width + nx) * 4;
                        const dr = data[nIdx] - data[i];
                        const dg = data[nIdx + 1] - data[i + 1];
                        const db = data[nIdx + 2] - data[i + 2];
                        const colorDist = dr * dr + dg * dg + db * db;
                        const spatialDist = dx * dx + dy * dy;

                        const w = Math.exp(-colorDist / (2 * colorSigma * colorSigma)) *
                                 Math.exp(-spatialDist / (2 * spatialSigma * spatialSigma));

                        r += data[nIdx] * w;
                        g += data[nIdx + 1] * w;
                        b += data[nIdx + 2] * w;
                        weight += w;
                    }
                }
            }

            if (weight > 0) {
                denoised[i] = Math.round(r / weight);
                denoised[i + 1] = Math.round(g / weight);
                denoised[i + 2] = Math.round(b / weight);
            }
        }

        imageData.data.set(denoised);
        return imageData;
    }

    /**
     * Get preprocessing statistics
     * @returns {Object} Stats
     */
    getStatistics() {
        return {
            imagesProcessed: this.stats.imagesProcessed,
            lowLightImagesDetected: this.stats.lowLightImages,
            lowLightPercentage: (this.stats.lowLightImages / this.stats.imagesProcessed * 100).toFixed(2) + '%',
            averageProcessingTime: this.stats.averageProcessingTime.toFixed(2) + ' ms',
            isRealTimeCapable: this.stats.averageProcessingTime < 33.3 // 30 FPS threshold
        };
    }

    /**
     * Process canvas element directly
     * @param {HTMLCanvasElement} canvas - Canvas to process
     */
    processCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const processed = this.preprocessFrame(imageData);
        ctx.putImageData(processed, 0, 0);
    }

    /**
     * Reset statistics
     */
    reset() {
        this.stats = {
            imagesProcessed: 0,
            lowLightImages: 0,
            averageProcessingTime: 0
        };
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LightPreprocessor;
}
