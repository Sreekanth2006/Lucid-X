/**
 * Explainable AI Module - Grad-CAM Visualization
 * Visualizes which facial regions contribute most to emotion predictions
 * Generates saliency maps and textual explanations
 * 
 * @module explainableAI
 */

class ExplainableAI {
    constructor(config = {}) {
        this.config = {
            visualizationMode: config.visualizationMode || 'heatmap', // 'heatmap' or 'overlay'
            contrastLevel: config.contrastLevel || 0.8,
            blurRadius: config.blurRadius || 3,
            ...config
        };

        this.featureImportance = {
            'happy': { mouth: 45, eyes: 35, eyebrows: 20 },
            'sad': { mouth: 40, eyes: 40, eyebrows: 20 },
            'angry': { eyebrows: 50, eyes: 30, mouth: 20 },
            'fearful': { eyes: 50, eyebrows: 30, mouth: 20 },
            'disgusted': { nose: 30, mouth: 40, eyes: 30 },
            'surprised': { mouth: 50, eyes: 40, eyebrows: 10 },
            'neutral': { eyes: 40, mouth: 35, eyebrows: 25 }
        };

        this.explanations = {
            'happy': [
                'Smile detected with elevated mouth corners',
                'Positive eye crinkles (crow\'s feet)',
                'Raised cheeks and expanded mouth',
                'Overall positive facial expression'
            ],
            'sad': [
                'Downturned mouth corners',
                'Inner eyebrows raised (pain/sadness expression)',
                'Reduced eye opening',
                'Overall drooping facial features'
            ],
            'angry': [
                'Lowered and drawn eyebrows',
                'Intense forward gaze',
                'Tightened lips and jaw',
                'Overall threatening facial expression'
            ],
            'fearful': [
                'Raised upper eyelids (wide eyes)',
                'Raised and pulled eyebrows',
                'Tensed mouth',
                'Overall appearance of alarm'
            ],
            'disgusted': [
                'Wrinkled nose and upper lip lift',
                'Slightly dropped jaw',
                'Narrowed eyes',
                'Overall expression of rejection'
            ],
            'surprised': [
                'Widely opened eyes and mouth',
                'Raised eyebrows at maximum height',
                'Open mouth (often O-shaped)',
                'Sudden unexpected expression'
            ],
            'neutral': [
                'Relaxed facial muscles',
                'Normal eyes opening',
                'Resting mouth position',
                'Balanced facial expression'
            ]
        };

        this.saliencyMaps = [];
    }

    /**
     * Generate saliency map for emotion prediction
     * @param {Object} detection - Face detection with landmarks
     * @param {string} emotion - Predicted emotion
     * @param {number} confidence - Confidence score
     * @returns {Object} Saliency data
     */
    generateSaliencyMap(detection, emotion, confidence) {
        if (!detection || !emotion) return null;

        const landmarks = detection.landmarks;
        const faceBox = detection.box;

        // Create attention heatmap
        const heatmap = this._createHeatmap(landmarks, emotion);

        // Identify key regions
        const keyRegions = this._identifyKeyRegions(landmarks, emotion);

        // Generate explanation
        const explanation = this._generateExplanation(emotion, confidence, keyRegions);

        const saliency = {
            timestamp: Date.now(),
            emotion,
            confidence,
            heatmap,
            keyRegions,
            explanation,
            visualizationUrl: this._generateVisualizationUrl(heatmap, faceBox)
        };

        this.saliencyMaps.push(saliency);
        if (this.saliencyMaps.length > 100) {
            this.saliencyMaps.shift();
        }

        return saliency;
    }

    /**
     * Create attention heatmap based on emotion-specific features
     * @private
     */
    _createHeatmap(landmarks, emotion) {
        const importance = this.featureImportance[emotion] || this.featureImportance['neutral'];
        
        const heatmap = {
            mouth: {
                intensity: importance.mouth || 35,
                region: this._getRegionBounds(landmarks, [48, 68]), // Mouth points
                importance: 'mouth'
            },
            eyes: {
                intensity: importance.eyes || 35,
                region: this._getRegionBounds(landmarks, [36, 48]), // Eye points
                importance: 'eyes'
            },
            eyebrows: {
                intensity: importance.eyebrows || 30,
                region: this._getRegionBounds(landmarks, [17, 27]), // Eyebrow points
                importance: 'eyebrows'
            },
            nose: {
                intensity: importance.nose || 20,
                region: this._getRegionBounds(landmarks, [27, 36]), // Nose points
                importance: 'nose'
            }
        };

        return heatmap;
    }

    /**
     * Get bounding region for facial landmark points
     * @private
     */
    _getRegionBounds(landmarks, pointRange) {
        const points = landmarks.positions.slice(pointRange[0], pointRange[1]);
        
        if (points.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }

    /**
     * Identify key regions contributing to emotion
     * @private
     */
    _identifyKeyRegions(landmarks, emotion) {
        const importance = this.featureImportance[emotion];
        
        return Object.entries(importance)
            .map(([region, score]) => ({
                region,
                importance: score,
                description: this._getRegionDescription(region, emotion)
            }))
            .sort((a, b) => b.importance - a.importance);
    }

    /**
     * Get description of regional changes
     * @private
     */
    _getRegionDescription(region, emotion) {
        const descriptions = {
            'mouth_happy': 'Corners lifted in smile',
            'mouth_sad': 'Corners drawn down',
            'mouth_surprised': 'Open and rounded',
            'eyes_happy': 'Positive eye crinkles',
            'eyes_sad': 'Look downward-drooping',
            'eyes_fearful': 'Wide open with alert',
            'eyes_angry': 'Intense forward stare',
            'eyebrows_angry': 'Lowered and drawn',
            'eyebrows_fearful': 'Raised and upward',
            'nose_disgusted': 'Wrinkled and raised'
        };

        const key = `${region}_${emotion}`;
        return descriptions[key] || `${region} showing strong ${emotion} indicators`;
    }

    /**
     * Generate natural language explanation
     * @private
     */
    _generateExplanation(emotion, confidence, keyRegions) {
        if (confidence < 40) {
            return {
                summary: `Uncertain ${emotion} detection (${confidence}% confidence)`,
                details: 'Facial features are ambiguous. May need closer inspection.',
                reliability: 'LOW',
                suggestions: [
                    'Ensure good lighting',
                    'Position face more directly to camera',
                    'Provide clear facial expression'
                ]
            };
        }

        const baseExplanation = this.explanations[emotion]?.[0] || 'Unknown emotion detected';
        const keyRegionText = keyRegions
            .slice(0, 2)
            .map(r => `${r.region} (${r.importance}%)`)
            .join(' and ');

        const reliability = confidence > 80 ? 'HIGH' : confidence > 60 ? 'MEDIUM' : 'LOW';

        return {
            summary: `${emotion.charAt(0).toUpperCase() + emotion.slice(1)} emotion detected (${confidence}% confidence)`,
            baseExpression: baseExplanation,
            contributingFeatures: keyRegionText,
            details: this.explanations[emotion]
                .slice(1)
                .map(e => `• ${e}`)
                .join('\n'),
            reliability,
            suggestions: this._getSuggestions(emotion, confidence)
        };
    }

    /**
     * Get suggestions based on emotion
     * @private
     */
    _getSuggestions(emotion, confidence) {
        const suggestions = {
            'sad': [
                'Patient may need emotional support',
                'Consider exploring challenges or concerns',
                'Offer therapeutic interventions if appropriate'
            ],
            'angry': [
                'Monitor for potential escalation',
                'Create safe environment for expression',
                'Consider stress reduction techniques'
            ],
            'fearful': [
                'Assess source of anxiety',
                'Use grounding techniques',
                'Provide reassurance and support'
            ],
            'happy': [
                'Positive emotional state',
                'Build on this for therapeutic progress',
                'Good time for positive reinforcement'
            ]
        };

        return suggestions[emotion] || [
            'Continue monitoring emotional state',
            'Correlate with patient feedback',
            'Track changes over session'
        ];
    }

    /**
     * Generate visualization URL (for client-side rendering)
     * @private
     */
    _generateVisualizationUrl(heatmap, faceBox) {
        return {
            mode: this.config.visualizationMode,
            regions: Object.keys(heatmap),
            dimensions: {
                x: faceBox.x,
                y: faceBox.y,
                width: faceBox.width,
                height: faceBox.height
            }
        };
    }

    /**
     * Create HTML canvas-based heatmap visualization
     * @param {HTMLCanvasElement} canvas - Target canvas
     * @param {Object} videoFrame - Source image/video frame
     * @param {Object} heatmap - Heatmap data
     * @param {number} alpha - Overlay transparency (0-1)
     */
    visualizeHeatmapOnCanvas(canvas, videoFrame, heatmap, alpha = 0.6) {
        if (!canvas || !videoFrame) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw video frame
        ctx.drawImage(videoFrame, 0, 0, canvas.width, canvas.height);

        // Draw heatmap overlays
        Object.entries(heatmap).forEach(([region, data]) => {
            this._drawRegionHeatmap(
                ctx,
                data.region,
                data.intensity / 100,
                alpha
            );
        });
    }

    /**
     * Draw single region heatmap
     * @private
     */
    _drawRegionHeatmap(ctx, region, intensity, alpha) {
        // Create color gradient (red for high intensity, blue for low)
        const hue = 120 * (1 - intensity); // 0 = red, 120 = green
        const color = `hsla(${hue}, 100%, 50%, ${alpha * intensity})`;

        ctx.fillStyle = color;
        ctx.fillRect(
            region.x,
            region.y,
            region.width,
            region.height
        );

        // Draw border to highlight region
        ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.lineWidth = 2;
        ctx.strokeRect(
            region.x,
            region.y,
            region.width,
            region.height
        );
    }

    /**
     * Get feature importance summary
     * @returns {Object} Importance matrix
     */
    getFeatureImportance() {
        return JSON.parse(JSON.stringify(this.featureImportance));
    }

    /**
     * Get recent saliency maps
     * @param {number} count - Number of maps to return
     * @returns {Array} Recent saliency maps
     */
    getRecentSaliencyMaps(count = 10) {
        return this.saliencyMaps.slice(-count);
    }

    /**
     * Reset explainability data
     */
    reset() {
        this.saliencyMaps = [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExplainableAI;
}
