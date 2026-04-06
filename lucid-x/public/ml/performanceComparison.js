/**
 * Performance Comparison Module
 * Compares performance of different detection methods
 * Tracks FPS, latency, accuracy, and resource usage
 * 
 * @module performanceComparison
 */

class PerformanceComparison {
    constructor(config = {}) {
        this.config = config;

        this.results = {
            ssdMobileNet: {
                name: 'SSD MobileNet',
                detections: [],
                fps: [],
                latencies: [],
                memoryUsage: [],
                accuracyMetrics: []
            },
            tinyFaceDetector: {
                name: 'TinyFaceDetector',
                detections: [],
                fps: [],
                latencies: [],
                memoryUsage: [],
                accuracyMetrics: []
            }
        };

        this.currentBenchmark = null;
    }

    /**
     * Start performance comparison benchmark
     * @param {HTMLVideoElement} videoElement - Video source
     * @param {EmotionDetector} detector - Detector instance
     * @param {number} duration - Duration in seconds
     * @returns {Promise<Object>} Benchmark results
     */
    async runComparison(videoElement, detector, duration = 30) {
        console.log(`🏁 Starting ${duration}s performance comparison...`);

        const startTime = performance.now();
        const endTime = startTime + (duration * 1000);

        let ssdFrameCount = 0;
        let tinyFrameCount = 0;

        while (performance.now() < endTime) {
            // Test SSD MobileNet
            const ssdStart = performance.now();
            const ssdResults = await detector.detectEmotions(videoElement, true);
            const ssdLatency = performance.now() - ssdStart;

            this.results.ssdMobileNet.detections.push(ssdResults.length);
            this.results.ssdMobileNet.latencies.push(ssdLatency);
            ssdFrameCount++;

            // Test TinyFaceDetector
            const tinyStart = performance.now();
            const tinyResults = await detector.detectEmotions(videoElement, false);
            const tinyLatency = performance.now() - tinyStart;

            this.results.tinyFaceDetector.detections.push(tinyResults.length);
            this.results.tinyFaceDetector.latencies.push(tinyLatency);
            tinyFrameCount++;

            // Record memory usage if available
            if (performance.memory) {
                this.results.ssdMobileNet.memoryUsage.push(performance.memory.usedJSHeapSize);
                this.results.tinyFaceDetector.memoryUsage.push(performance.memory.usedJSHeapSize);
            }

            // Small delay to prevent blocking
            await this._sleep(10);
        }

        // Calculate FPS
        this.results.ssdMobileNet.fps = ssdFrameCount / duration;
        this.results.tinyFaceDetector.fps = tinyFrameCount / duration;

        // Generate comparison report
        const report = this._generateComparisonReport();
        this.currentBenchmark = report;

        console.log('✅ Benchmark completed');
        return report;
    }

    /**
     * Sleep helper
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generate comparison report
     * @private
     */
    _generateComparisonReport() {
        const ssd = this.results.ssdMobileNet;
        const tiny = this.results.tinyFaceDetector;

        const report = {
            timestamp: Date.now(),
            comparison: {
                ssdMobileNet: this._calculateMetrics(ssd),
                tinyFaceDetector: this._calculateMetrics(tiny)
            },
            recommendation: this._generateRecommendation(ssd, tiny),
            speedup: {
                tinyVsSsd: (this._getAverageLatency(ssd) / this._getAverageLatency(tiny)).toFixed(2),
                unit: 'x faster'
            }
        };

        return report;
    }

    /**
     * Calculate metrics for detector
     * @private
     */
    _calculateMetrics(detectorResults) {
        const avgLatency = this._getAverageLatency(detectorResults);
        const avgDetections = detectorResults.detections.length > 0
            ? (detectorResults.detections.reduce((a, b) => a + b) / detectorResults.detections.length).toFixed(2)
            : 0;

        return {
            fps: Math.round(detectorResults.fps),
            averageLatency: Math.round(avgLatency * 100) / 100,
            detectionRate: avgDetections,
            peakMemory: detectorResults.memoryUsage.length > 0
                ? Math.round(Math.max(...detectorResults.memoryUsage) / 1024 / 1024 * 100) / 100
                : 'N/A',
            unit: {
                latency: 'ms',
                memory: 'MB'
            }
        };
    }

    /**
     * Get average latency
     * @private
     */
    _getAverageLatency(detectorResults) {
        if (detectorResults.latencies.length === 0) return 0;
        return detectorResults.latencies.reduce((a, b) => a + b) / detectorResults.latencies.length;
    }

    /**
     * Generate recommendation based on comparison
     * @private
     */
    _generateRecommendation(ssd, tiny) {
        const ssdLatency = this._getAverageLatency(ssd);
        const tinyLatency = this._getAverageLatency(tiny);
        const latencyDiff = ssdLatency - tinyLatency;

        if (latencyDiff > tinyLatency * 0.5) {
            return {
                recommended: 'TinyFaceDetector',
                reason: `TinyFaceDetector is ${(latencyDiff / ssdLatency * 100).toFixed(1)}% faster and suitable for real-time applications.`,
                context: 'Use TinyFaceDetector for real-time emotion recognition on limited hardware'
            };
        } else {
            return {
                recommended: 'SSD MobileNet',
                reason: 'SSD MobileNet offers better accuracy with acceptable latency.',
                context: 'Use SSD MobileNet for high-accuracy applications where latency is less critical'
            };
        }
    }

    /**
     * Get current benchmark report
     * @returns {Object} Benchmark data
     */
    getBenchmarkReport() {
        return this.currentBenchmark;
    }

    /**
     * Export comparison results as formatted text
     * @returns {string} Formatted comparison report
     */
    exportAsText() {
        if (!this.currentBenchmark) {
            return 'No benchmark data available. Run comparison first.';
        }

        const comp = this.currentBenchmark.comparison;
        const ssd = comp.ssdMobileNet;
        const tiny = comp.tinyFaceDetector;
        const rec = this.currentBenchmark.recommendation;

        let report = `
╔════════════════════════════════════════════════════════════════╗
║              DETECTOR PERFORMANCE COMPARISON                   ║
╚════════════════════════════════════════════════════════════════╝

PERFORMANCE METRICS
───────────────────────────────────────────────────────────────
                          SSD MobileNet      TinyFaceDetector
───────────────────────────────────────────────────────────────
FPS                       ${String(ssd.fps).padEnd(18)} ${tiny.fps}
Latency (ms)              ${String(ssd.averageLatency).padEnd(18)} ${tiny.averageLatency}
Memory Usage (MB)         ${String(ssd.peakMemory).padEnd(18)} ${tiny.peakMemory}
Detections/Frame          ${String(ssd.detectionRate).padEnd(18)} ${tiny.detectionRate}

SPEEDUP COMPARISON
───────────────────────────────────────────────────────────────
TinyFaceDetector is ${this.currentBenchmark.speedup.tinyVsSsd}x ${this.currentBenchmark.speedup.unit}

RECOMMENDATION
───────────────────────────────────────────────────────────────
🎯 Recommended Method: ${rec.recommended}

Reason: ${rec.reason}

Context: ${rec.context}

ANALYSIS
───────────────────────────────────────────────────────────────
${ssd.fps > tiny.fps ? '✓ SSD MobileNet has higher FPS for smoother processing' : '✓ TinyFaceDetector has higher FPS for smoother processing'}
${ssd.peakMemory !== 'N/A' && tiny.peakMemory !== 'N/A' && ssd.peakMemory < tiny.peakMemory ? '✓ SSD MobileNet uses less memory' : '✓ TinyFaceDetector uses less memory'}
${ssd.averageLatency < tiny.averageLatency ? '✓ SSD MobileNet is faster per frame' : '✓ TinyFaceDetector is faster per frame'}

CONCLUSION
───────────────────────────────────────────────────────────────
For this hardware configuration, ${rec.recommended} is the optimal choice.
Consider your specific use case:
- Real-time: Prioritize TinyFaceDetector
- Accuracy: Prioritize SSD MobileNet
- Balanced: Use recommended method

═══════════════════════════════════════════════════════════════
Report Generated: ${new Date(this.currentBenchmark.timestamp).toLocaleString()}
═══════════════════════════════════════════════════════════════
`;

        return report;
    }

    /**
     * Export comparison as JSON
     * @returns {string} JSON string
     */
    exportAsJSON() {
        return JSON.stringify(this.currentBenchmark, null, 2);
    }

    /**
     * Get comparison data for charting
     * @returns {Object} Chart-ready data
     */
    getChartData() {
        const ssd = this.results.ssdMobileNet;
        const tiny = this.results.tinyFaceDetector;

        return {
            latency: {
                labels: this._generateLabels(Math.min(ssd.latencies.length, tiny.latencies.length)),
                ssd: ssd.latencies.slice(0, 100),
                tiny: tiny.latencies.slice(0, 100)
            },
            memory: {
                labels: this._generateLabels(Math.min(ssd.memoryUsage.length, tiny.memoryUsage.length)),
                ssd: (ssd.memoryUsage || []).map(m => m / 1024 / 1024).slice(0, 100),
                tiny: (tiny.memoryUsage || []).map(m => m / 1024 / 1024).slice(0, 100)
            },
            metrics: {
                ssdFPS: Math.round(ssd.fps),
                tinyFPS: Math.round(tiny.fps),
                ssdLatency: Math.round(this._getAverageLatency(ssd) * 100) / 100,
                tinyLatency: Math.round(this._getAverageLatency(tiny) * 100) / 100
            }
        };
    }

    /**
     * Generate labels for chart
     * @private
     */
    _generateLabels(count) {
        return Array.from(Array(count)).map((_, i) => `T+${i}s`);
    }

    /**
     * Reset comparison data
     */
    reset() {
        this.results = {
            ssdMobileNet: {
                name: 'SSD MobileNet',
                detections: [],
                fps: [],
                latencies: [],
                memoryUsage: [],
                accuracyMetrics: []
            },
            tinyFaceDetector: {
                name: 'TinyFaceDetector',
                detections: [],
                fps: [],
                latencies: [],
                memoryUsage: [],
                accuracyMetrics: []
            }
        };
        this.currentBenchmark = null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceComparison;
}
