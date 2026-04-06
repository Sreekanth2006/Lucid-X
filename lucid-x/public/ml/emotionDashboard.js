/**
 * Real-Time Emotion Recognition Dashboard
 * Visualizes multimodal emotion analysis with charts and metrics
 * 
 * @module emotionDashboard
 */

class EmotionDashboard {
    constructor(containerId, config = {}) {
        this.containerId = containerId;
        this.config = {
            maxTimelinePoints: config.maxTimelinePoints || 300,
            updateInterval: config.updateInterval || 100,
            chartType: config.chartType || 'line',
            showSaliency: config.showSaliency !== false,
            showPerformance: config.showPerformance !== false,
            ...config
        };

        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container with id '${containerId}' not found`);
        }

        // Data storage
        this.emotionHistory = [];
        this.audioHistory = [];
        this.multimodalHistory = [];
        this.performanceHistory = [];

        this.setupUI();
    }

    /**
     * Setup dashboard HTML structure
     * @private
     */
    setupUI() {
        this.container.innerHTML = `
            <div class="emotion-dashboard">
                <!-- Main metrics row -->
                <div class="metrics-row">
                    <div class="metric-card card-primary">
                        <div class="card-header">Current Emotion</div>
                        <div id="currentEmotion" class="emotion-display">
                            <div class="emotion-name">--</div>
                            <div class="emotion-confidence">Confidence: 0%</div>
                        </div>
                    </div>

                    <div class="metric-card card-secondary">
                        <div class="card-header">Audio Emotion</div>
                        <div id="audioEmotion" class="audio-display">
                            <div class="audio-emotion-name">--</div>
                            <div class="audio-energy">Energy: 0%</div>
                        </div>
                    </div>

                    <div class="metric-card card-tertiary">
                        <div class="card-header">Multimodal Agreement</div>
                        <div id="multimodalAgreement" class="agreement-display">
                            <div class="agreement-percentage">0%</div>
                            <div class="agreement-status">--</div>
                        </div>
                    </div>

                    <div class="metric-card card-quaternary">
                        <div class="card-header">System Performance</div>
                        <div id="systemPerformance" class="performance-display">
                            <div class="fps-display">FPS: --</div>
                            <div class="latency-display">Latency: -- ms</div>
                        </div>
                    </div>
                </div>

                <!-- Charts row -->
                <div class="charts-row">
                    <div class="chart-container">
                        <div class="chart-header">Emotion Timeline (30s)</div>
                        <canvas id="emotionTimeline" class="chart"></canvas>
                    </div>

                    <div class="chart-container">
                        <div class="chart-header">Emotion Distribution</div>
                        <canvas id="emotionPie" class="chart"></canvas>
                    </div>
                </div>

                <!-- Stability and temporal analysis -->
                <div class="analysis-row">
                    <div class="analysis-card">
                        <div class="card-header">Temporal Stability</div>
                        <div id="temporalStability" class="stability-display">
                            <div class="stability-bar">
                                <div class="stability-fill" style="width: 0%"></div>
                            </div>
                            <div class="stability-label">Building...</div>
                        </div>
                    </div>

                    <div class="analysis-card">
                        <div class="card-header">Emotion Trend</div>
                        <div id="emotionTrend" class="trend-display">
                            <div class="trend-arrow">→</div>
                            <div class="trend-text">No data</div>
                        </div>
                    </div>

                    <div class="analysis-card">
                        <div class="card-header">Saliency Explanation</div>
                        <div id="saliencyExplanation" class="explanation-display">
                            <p class="explanation-text">Waiting for facial detection...</p>
                        </div>
                    </div>
                </div>

                <!-- Detailed metrics -->
                <div class="detailed-metrics">
                    <div class="metrics-header">Detailed Metrics</div>
                    <div id="detailedMetrics" class="metrics-table">
                        <div class="metric-row">
                            <span class="metric-name">Frames Processed:</span>
                            <span id="framesProcessed" class="metric-value">0</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-name">Avg Detection Time:</span>
                            <span id="avgDetectionTime" class="metric-value">0 ms</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-name">Detection Rate:</span>
                            <span id="detectionRate" class="metric-value">0%</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-name">Consensus Rate:</span>
                            <span id="consensusRate" class="metric-value">0%</span>
                        </div>
                    </div>
                </div>

                <!-- Saliency canvas -->
                <div class="saliency-container" ${this.config.showSaliency ? '' : 'style="display:none"'}>
                    <div class="saliency-header">Attention Map</div>
                    <canvas id="saliencyCanvas" class="saliency-canvas" width="400" height="300"></canvas>
                </div>

                <!-- Controls -->
                <div class="dashboard-controls">
                    <button id="btnPause" class="btn btn-primary">Pause</button>
                    <button id="btnReset" class="btn btn-secondary">Reset</button>
                    <button id="btnExport" class="btn btn-tertiary">Export Report</button>
                </div>
            </div>
        `;

        this.setupStyles();
        this.setupCharts();
        this.attachEventListeners();
    }

    /**
     * Setup dashboard CSS styles
     * @private
     */
    setupStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .emotion-dashboard {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f7fa;
                padding: 20px;
                border-radius: 8px;
                color: #333;
            }

            .metrics-row {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }

            .metric-card {
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                border-left: 4px solid #4CAF50;
            }

            .card-primary { border-left-color: #2196F3; }
            .card-secondary { border-left-color: #FF9800; }
            .card-tertiary { border-left-color: #9C27B0; }
            .card-quaternary { border-left-color: #F44336; }

            .card-header {
                font-size: 12px;
                color: #999;
                text-transform: uppercase;
                font-weight: 600;
                margin-bottom: 10px;
            }

            .emotion-display, .audio-display, .agreement-display, .performance-display {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .emotion-name, .audio-emotion-name {
                font-size: 28px;
                font-weight: bold;
                color: #2196F3;
            }

            .emotion-confidence, .audio-energy {
                font-size: 14px;
                color: #666;
            }

            .agreement-percentage {
                font-size: 32px;
                font-weight: bold;
                color: #9C27B0;
            }

            .agreement-status {
                font-size: 14px;
                color: #666;
            }

            .fps-display, .latency-display {
                font-size: 16px;
                font-weight: 600;
                margin: 5px 0;
            }

            .charts-row {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }

            .chart-container {
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .chart-header {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 15px;
                color: #333;
            }

            .chart {
                width: 100%;
                height: 250px;
            }

            .analysis-row {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }

            .analysis-card {
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .stability-display {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .stability-bar {
                height: 20px;
                background: #eee;
                border-radius: 10px;
                overflow: hidden;
            }

            .stability-fill {
                height: 100%;
                background: linear-gradient(90deg, #FF9800, #4CAF50);
                transition: width 0.3s ease;
            }

            .stability-label {
                font-size: 13px;
                color: #666;
                font-weight: 500;
            }

            .trend-display {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 16px;
            }

            .trend-arrow {
                font-size: 24px;
            }

            .trend-text {
                color: #666;
            }

            .explanation-display {
                font-size: 13px;
                line-height: 1.6;
                color: #666;
            }

            .explanation-text {
                margin: 0;
            }

            .detailed-metrics {
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                margin-bottom: 20px;
            }

            .metrics-header {
                font-weight: 600;
                margin-bottom: 15px;
                color: #333;
            }

            .metrics-table {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 15px;
            }

            .metric-row {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid #eee;
                font-size: 14px;
            }

            .metric-name {
                color: #666;
                font-weight: 500;
            }

            .metric-value {
                color: #2196F3;
                font-weight: 600;
                font-family: 'Courier New', monospace;
            }

            .saliency-container {
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                margin-bottom: 20px;
            }

            .saliency-header {
                font-weight: 600;
                margin-bottom: 15px;
            }

            .saliency-canvas {
                width: 100%;
                max-width: 400px;
                border: 1px solid #ddd;
                border-radius: 4px;
            }

            .dashboard-controls {
                display: flex;
                gap: 10px;
                margin-top: 20px;
            }

            .btn {
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .btn-primary {
                background: #2196F3;
                color: white;
            }

            .btn-primary:hover {
                background: #1976D2;
            }

            .btn-secondary {
                background: #f44336;
                color: white;
            }

            .btn-secondary:hover {
                background: #da190b;
            }

            .btn-tertiary {
                background: #4CAF50;
                color: white;
            }

            .btn-tertiary:hover {
                background: #45a049;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Setup chart instances
     * @private
     */
    setupCharts() {
        // Timeline chart
        const timelineCanvas = document.getElementById('emotionTimeline');
        this.timelineCtx = timelineCanvas.getContext('2d');

        // Pie chart
        const pieCanvas = document.getElementById('emotionPie');
        this.pieCtx = pieCanvas.getContext('2d');

        this.initializeCharts();
    }

    /**
     * Initialize chart data
     * @private
     */
    initializeCharts() {
        // Empty charts initially
        this.drawEmptyChart(this.timelineCtx);
        this.drawEmptyChart(this.pieCtx);
    }

    /**
     * Draw empty placeholder chart
     * @private
     */
    drawEmptyChart(ctx) {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#999';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for data...', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }

    /**
     * Attach event listeners
     * @private
     */
    attachEventListeners() {
        document.getElementById('btnPause').addEventListener('click', () => {
            this.config.onPause?.();
        });

        document.getElementById('btnReset').addEventListener('click', () => {
            this.reset();
            this.config.onReset?.();
        });

        document.getElementById('btnExport').addEventListener('click', () => {
            this.config.onExport?.();
        });
    }

    /**
     * Update emotion display
     * @param {Object} emotionData - Emotion detection result
     */
    updateEmotionDisplay(emotionData) {
        const emotionDiv = document.getElementById('currentEmotion');
        emotionDiv.innerHTML = `
            <div class="emotion-name">${emotionData.emotion || '--'}</div>
            <div class="emotion-confidence">Confidence: ${(emotionData.confidence * 100).toFixed(1)}%</div>
        `;

        // Store in history
        this.emotionHistory.push({
            time: Date.now(),
            emotion: emotionData.emotion,
            confidence: emotionData.confidence
        });

        // Keep history size manageable
        if (this.emotionHistory.length > this.config.maxTimelinePoints) {
            this.emotionHistory.shift();
        }

        this.updateTimeline();
    }

    /**
     * Update audio emotion display
     * @param {Object} audioData - Audio emotion result
     */
    updateAudioDisplay(audioData) {
        const audioDiv = document.getElementById('audioEmotion');
        audioDiv.innerHTML = `
            <div class="audio-emotion-name">${audioData.emotion || '--'}</div>
            <div class="audio-energy">Energy: ${(audioData.energy * 100).toFixed(1)}%</div>
        `;

        this.audioHistory.push({
            time: Date.now(),
            emotion: audioData.emotion,
            confidence: audioData.confidence,
            energy: audioData.energy
        });

        if (this.audioHistory.length > this.config.maxTimelinePoints) {
            this.audioHistory.shift();
        }
    }

    /**
     * Update multimodal agreement display
     * @param {Object} multimodalData - Fusion result
     */
    updateMultimodalDisplay(multimodalData) {
        const agreementDiv = document.getElementById('multimodalAgreement');
        const agreementRate = (multimodalData.consensusScore * 100).toFixed(1);
        const status = multimodalData.consensusScore > 0.7 ? '✓ Strong Agreement' :
                       multimodalData.consensusScore > 0.5 ? '◐ Partial Agreement' : 
                       '✗ Disagreement';

        agreementDiv.innerHTML = `
            <div class="agreement-percentage">${agreementRate}%</div>
            <div class="agreement-status">${status}</div>
        `;

        this.multimodalHistory.push({
            time: Date.now(),
            emotion: multimodalData.fusedEmotion,
            confidence: multimodalData.fusedConfidence,
            consensusScore: multimodalData.consensusScore
        });

        if (this.multimodalHistory.length > this.config.maxTimelinePoints) {
            this.multimodalHistory.shift();
        }

        this.updatePieChart();
    }

    /**
     * Update performance metrics
     * @param {Object} metrics - System metrics
     */
    updatePerformanceMetrics(metrics) {
        const perfDiv = document.getElementById('systemPerformance');
        const avgLatency = metrics.emotionDetectorMetrics?.averageDetectionTime || 0;

        perfDiv.innerHTML = `
            <div class="fps-display">FPS: ${metrics.fps}</div>
            <div class="latency-display">Latency: ${avgLatency.toFixed(1)} ms</div>
        `;

        document.getElementById('framesProcessed').textContent = 
            metrics.emotionDetectorMetrics?.totalFrames || 0;
        document.getElementById('avgDetectionTime').textContent = 
            `${avgLatency.toFixed(1)} ms`;
    }

    /**
     * Update temporal stability display
     * @param {Object} stabilityData - Stability information
     */
    updateTemporalStability(stabilityData) {
        const stabilityDiv = document.getElementById('temporalStability');
        const fillElement = stabilityDiv.querySelector('.stability-fill');
        const labelElement = stabilityDiv.querySelector('.stability-label');

        const stableScore = stabilityData.score || 0;
        fillElement.style.width = (stableScore * 100) + '%';
        labelElement.textContent = `${stabilityData.level || 'Building...'} (${(stableScore * 100).toFixed(0)}%)`;
    }

    /**
     * Update emotion trend
     * @param {string} trend - Trend direction
     */
    updateTrend(trend) {
        const trendDiv = document.getElementById('emotionTrend');
        const arrows = {
            'increasing': '↗',
            'decreasing': '↘',
            'stable': '→',
            'volatile': '⇄'
        };

        trendDiv.innerHTML = `
            <div class="trend-arrow">${arrows[trend] || '→'}</div>
            <div class="trend-text">${trend || 'Analyzing...'}</div>
        `;
    }

    /**
     * Update saliency explanation
     * @param {Object} explanation - Saliency explanation data
     */
    updateExplanation(explanation) {
        const expDiv = document.getElementById('saliencyExplanation');
        if (explanation && explanation.naturalLanguage) {
            expDiv.innerHTML = `<p class="explanation-text">${explanation.naturalLanguage}</p>`;
        }

        // Draw saliency canvas
        if (this.config.showSaliency && explanation && explanation.heatmap) {
            this.drawSaliencyMap(explanation);
        }
    }

    /**
     * Draw saliency heatmap on canvas
     * @private
     */
    drawSaliencyMap(explanation) {
        const canvas = document.getElementById('saliencyCanvas');
        const ctx = canvas.getContext('2d');

        if (!explanation.heatmap) return;

        // Clear canvas
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw heatmap
        const heatmap = explanation.heatmap;
        const cellWidth = canvas.width / heatmap.width;
        const cellHeight = canvas.height / heatmap.height;

        for (let i = 0; i < heatmap.width; i++) {
            for (let j = 0; j < heatmap.height; j++) {
                const value = heatmap.data[j * heatmap.width + i] || 0;
                const hue = (1 - value) * 240; // Blue to Red
                ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
                ctx.fillRect(i * cellWidth, j * cellHeight, cellWidth, cellHeight);
            }
        }
    }

    /**
     * Update timeline chart
     * @private
     */
    updateTimeline() {
        const ctx = this.timelineCtx;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        if (this.emotionHistory.length < 2) {
            this.drawEmptyChart(ctx);
            return;
        }

        // Draw grid
        this.drawTimelineGrid(ctx);

        // Draw emotion line
        const emotionMap = {
            'happy': '#4CAF50',
            'sad': '#2196F3',
            'angry': '#f44336',
            'fearful': '#9C27B0',
            'surprised': '#FF9800',
            'disgusted': '#795548',
            'neutral': '#999'
        };

        // Group by emotions
        const emotionData = {};
        this.emotionHistory.forEach((point, idx) => {
            if (!emotionData[point.emotion]) {
                emotionData[point.emotion] = [];
            }
            emotionData[point.emotion].push({ x: idx, y: point.confidence });
        });

        // Draw each emotion's confidence line
        Object.entries(emotionData).forEach(([emotion, points]) => {
            this.drawLine(ctx, points, emotionMap[emotion] || '#999');
        });

        // Draw axes
        this.drawTimelineAxes(ctx);
    }

    /**
     * Draw timeline grid
     * @private
     */
    drawTimelineGrid(ctx) {
        ctx.strokeStyle = '#eee';
        ctx.lineWidth = 1;

        // Horizontal grid lines
        for (let i = 0; i <= 10; i++) {
            const y = (ctx.canvas.height / 10) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(ctx.canvas.width, y);
            ctx.stroke();
        }
    }

    /**
     * Draw line on chart
     * @private
     */
    drawLine(ctx, points, color) {
        if (points.length === 0) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const padding = 40;
        const xRange = ctx.canvas.width - padding * 2;
        const yRange = ctx.canvas.height - padding * 2;

        ctx.beginPath();
        points.forEach((point, idx) => {
            const x = padding + (point.x / (this.emotionHistory.length - 1)) * xRange;
            const y = ctx.canvas.height - padding - point.y * yRange;
            
            if (idx === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    }

    /**
     * Draw timeline axes
     * @private
     */
    drawTimelineAxes(ctx) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;

        // X-axis
        ctx.beginPath();
        ctx.moveTo(40, ctx.canvas.height - 40);
        ctx.lineTo(ctx.canvas.width - 40, ctx.canvas.height - 40);
        ctx.stroke();

        // Y-axis
        ctx.beginPath();
        ctx.moveTo(40, 40);
        ctx.lineTo(40, ctx.canvas.height - 40);
        ctx.stroke();

        // Labels
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Time', ctx.canvas.width / 2, ctx.canvas.height - 10);

        ctx.save();
        ctx.translate(15, ctx.canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Confidence', 0, 0);
        ctx.restore();
    }

    /**
     * Update pie chart
     * @private
     */
    updatePieChart() {
        const ctx = this.pieCtx;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        if (this.multimodalHistory.length === 0) {
            this.drawEmptyChart(ctx);
            return;
        }

        // Count emotions
        const emotionCounts = {};
        this.multimodalHistory.forEach(point => {
            emotionCounts[point.emotion] = (emotionCounts[point.emotion] || 0) + 1;
        });

        // Draw pie
        const colors = {
            'happy': '#4CAF50',
            'sad': '#2196F3',
            'angry': '#f44336',
            'fearful': '#9C27B0',
            'surprised': '#FF9800',
            'disgusted': '#795548',
            'neutral': '#999'
        };

        const centerX = ctx.canvas.width / 2;
        const centerY = ctx.canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;

        let startAngle = 0;
        Object.entries(emotionCounts).forEach(([emotion, count]) => {
            const sliceAngle = (count / this.multimodalHistory.length) * 2 * Math.PI;
            
            ctx.fillStyle = colors[emotion] || '#999';
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            ctx.lineTo(centerX, centerY);
            ctx.fill();

            startAngle += sliceAngle;
        });
    }

    /**
     * Reset dashboard
     */
    reset() {
        this.emotionHistory = [];
        this.audioHistory = [];
        this.multimodalHistory = [];
        this.performanceHistory = [];
        this.initializeCharts();
        
        document.getElementById('currentEmotion').innerHTML = '<div class="emotion-name">--</div>';
        document.getElementById('audioEmotion').innerHTML = '<div class="audio-emotion-name">--</div>';
        document.getElementById('multimodalAgreement').innerHTML = '<div class="agreement-percentage">0%</div>';
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmotionDashboard;
}
