/**
 * Session Report Generator
 * Generates comprehensive emotion session reports with statistics and analysis
 * Exports reports in JSON, PDF, and text formats
 * 
 * @module sessionReport
 */

class SessionReportGenerator {
    constructor(config = {}) {
        this.config = {
            sessionName: config.sessionName || `Session_${Date.now()}`,
            patientInfo: config.patientInfo || {},
            ...config
        };

        this.sessionStart = Date.now();
        this.sessionData = {
            emotionEvents: [],
            audioEvents: [],
            multimodalEvents: [],
            performanceMetrics: [],
            systemEvents: []
        };
    }

    /**
     * Record emotion event during session
     * @param {Object} event - Emotion detection event
     */
    recordEmotionEvent(event) {
        this.sessionData.emotionEvents.push({
            ...event,
            timestamp: Date.now(),
            sessionTime: Date.now() - this.sessionStart
        });
    }

    /**
     * Record audio event
     * @param {Object} event - Audio prediction event
     */
    recordAudioEvent(event) {
        this.sessionData.audioEvents.push({
            ...event,
            timestamp: Date.now(),
            sessionTime: Date.now() - this.sessionStart
        });
    }

    /**
     * Record multimodal fusion event
     * @param {Object} event - Fusion event
     */
    recordMultimodalEvent(event) {
        this.sessionData.multimodalEvents.push({
            ...event,
            timestamp: Date.now(),
            sessionTime: Date.now() - this.sessionStart
        });
    }

    /**
     * Record system/performance event
     * @param {Object} event - System event
     */
    recordSystemEvent(event) {
        this.sessionData.systemEvents.push({
            ...event,
            timestamp: Date.now(),
            sessionTime: Date.now() - this.sessionStart
        });
    }

    /**
     * Generate comprehensive session report
     * @returns {Object} Complete session report
     */
    generateReport() {
        const report = {
            metadata: this._generateMetadata(),
            summary: this._generateSummary(),
            emotionAnalysis: this._analyzeEmotions(),
            audioAnalysis: this._analyzeAudio(),
            multimodalAnalysis: this._analyzeMultimodal(),
            performance: this._analyzePerformance(),
            insights: this._generateInsights(),
            recommendations: this._generateRecommendations(),
            timelineGraph: this._generateTimeline(),
            exportedAt: new Date().toISOString()
        };

        return report;
    }

    /**
     * Generate report metadata
     * @private
     */
    _generateMetadata() {
        const duration = Math.round((Date.now() - this.sessionStart) / 1000);
        
        return {
            sessionName: this.config.sessionName,
            sessionDate: new Date(this.sessionStart).toISOString(),
            duration: {
                seconds: duration,
                minutes: Math.round(duration / 60),
                formatted: `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`
            },
            patientInfo: this.config.patientInfo,
            recordedEvents: {
                emotion: this.sessionData.emotionEvents.length,
                audio: this.sessionData.audioEvents.length,
                multimodal: this.sessionData.multimodalEvents.length,
                system: this.sessionData.systemEvents.length
            }
        };
    }

    /**
     * Generate session summary
     * @private
     */
    _generateSummary() {
        if (this.sessionData.multimodalEvents.length === 0) {
            return {
                totalEvents: 0,
                note: 'No sufficient data for analysis'
            };
        }

        const events = this.sessionData.multimodalEvents;
        const dominantEmotions = {};
        
        events.forEach(event => {
            const emotion = event.dominantEmotion;
            dominantEmotions[emotion] = (dominantEmotions[emotion] || 0) + 1;
        });

        const [primaryEmotion, primaryCount] = Object.entries(dominantEmotions)
            .sort((a, b) => b[1] - a[1])[0];

        const primaryPercent = Math.round((primaryCount / events.length) * 100);

        return {
            totalEvents: events.length,
            primaryEmotion,
            primaryEmotionPercentage: primaryPercent,
            emotionDistribution: dominantEmotions,
            overallConfidence: Math.round(
                events.reduce((sum, e) => sum + e.confidence, 0) / events.length
            ),
            primaryObservation: this._generatePrimaryObservation(primaryEmotion, primaryPercent)
        };
    }

    /**
     * Generate primary observation
     * @private
     */
    _generatePrimaryObservation(emotion, percentage) {
        const observations = {
            'happy': `Patient displayed predominantly positive affect throughout the session (${percentage}% of observations), suggesting good emotional regulation and positive mood state.`,
            'sad': `Patient showed significant sadness during the session (${percentage}% of observations), which may indicate low mood, potential depression symptoms, or sadness related to discussed topics.`,
            'angry': `Patient exhibited anger or irritability (${percentage}% of observations), suggesting frustration, aggression, or strong negative emotions that warrant further exploration.`,
            'fearful': `Patient displayed anxiety or fear (${percentage}% of observations), indicating potential anxiety disorder, phobia, or fear response to specific triggers.`,
            'disgusted': `Patient showed disgust or aversion (${percentage}% of observations), which may indicate moral judgments or negative reactions to discussed content.`,
            'surprised': `Patient showed surprise (${percentage}% of observations), which may relate to unexpected therapeutic insights or responses.`,
            'neutral': `Patient maintained relatively neutral affect (${percentage}% of observations), which may suggest emotional suppression, calmness, or difficulty expressing emotions.`
        };

        return observations[emotion] || 'Continue monitoring emotional state for patterns and changes.';
    }

    /**
     * Analyze emotion data
     * @private
     */
    _analyzeEmotions() {
        const events = this.sessionData.emotionEvents;
        
        if (events.length === 0) return null;

        const emotions = events.map(e => e.dominantEmotion);
        const confidences = events.map(e => e.confidence);
        
        // Emotional spikes (large changes)
        const spikes = [];
        for (let i = 1; i < confidences.length; i++) {
            const change = Math.abs(confidences[i] - confidences[i - 1]);
            if (change > 25) {
                spikes.push({
                    time: events[i].sessionTime,
                    from: emotions[i - 1],
                    to: emotions[i],
                    magnitude: change
                });
            }
        }

        return {
            totalFrames: events.length,
            averageConfidence: Math.round(confidences.reduce((a, b) => a + b) / confidences.length),
            maxConfidence: Math.max(...confidences),
            minConfidence: Math.min(...confidences),
            emotionSpikes: spikes.slice(0, 10), // Top 10 spikes
            faceDetectionRate: Math.round((events.filter(e => e.confidence > 20).length / events.length) * 100)
        };
    }

    /**
     * Analyze audio data
     * @private
     */
    _analyzeAudio() {
        const events = this.sessionData.audioEvents;

        if (events.length === 0) {
            return { note: 'No audio data recorded' };
        }

        const emotions = events.map(e => e.emotion);
        const emotionCounts = {};
        
        emotions.forEach(e => {
            emotionCounts[e] = (emotionCounts[e] || 0) + 1;
        });

        const stats = events.map(e => e.features || {});
        const avgEnergy = Math.round(
            stats.reduce((sum, s) => sum + (s.energy || 0), 0) / stats.length
        );

        return {
            totalFrames: events.length,
            emotionDistribution: emotionCounts,
            averageEnergy: avgEnergy,
            averagePitch: Math.round(
                stats.reduce((sum, s) => sum + (s.pitch || 0), 0) / stats.length
            )
        };
    }

    /**
     * Analyze multimodal fusion
     * @private
     */
    _analyzeMultimodal() {
        const events = this.sessionData.multimodalEvents;

        if (events.length === 0) {
            return { note: 'No multimodal data recorded' };
        }

        const consensusFusions = events.filter(e => e.consensus?.achieved).length;
        const agreements = events.map(e => e.agreement || 0);

        return {
            totalFusions: events.length,
            consensusRate: Math.round((consensusFusions / events.length) * 100),
            averageAgreement: Math.round(agreements.reduce((a, b) => a + b) / agreements.length),
            averageReliability: Math.round(
                events.reduce((sum, e) => sum + (e.reliabilityScore || 0), 0) / events.length
            ),
            facialDominance: this._calculateModalityDominance(events, 'facial'),
            audioDominance: this._calculateModalityDominance(events, 'audio')
        };
    }

    /**
     * Calculate modality dominance
     * @private
     */
    _calculateModalityDominance(events, modality) {
        let matchCount = 0;
        
        events.forEach(event => {
            const emotion = modality === 'facial' ? event.facial?.emotion : event.audio?.emotion;
            if (emotion === event.dominantEmotion) {
                matchCount++;
            }
        });

        return Math.round((matchCount / events.length) * 100);
    }

    /**
     * Analyze performance metrics
     * @private
     */
    _analyzePerformance() {
        const systemEvents = this.sessionData.systemEvents;

        if (systemEvents.length === 0) {
            return { note: 'No performance data recorded' };
        }

        const fps = systemEvents.filter(e => e.type === 'fps').map(e => e.value || 0);
        const latencies = systemEvents.filter(e => e.type === 'latency').map(e => e.value || 0);

        return {
            averageFPS: fps.length > 0 ? Math.round(fps.reduce((a, b) => a + b) / fps.length) : 'N/A',
            averageLatency: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b) / latencies.length) : 'N/A',
            peakFPS: fps.length > 0 ? Math.max(...fps) : 'N/A',
            dropoutIncidents: systemEvents.filter(e => e.type === 'dropout').length
        };
    }

    /**
     * Generate insights from data
     * @private
     */
    _generateInsights() {
        const multimodalData = this.sessionData.multimodalEvents;
        
        if (multimodalData.length === 0) {
            return ['Insufficient data for insights'];
        }

        const insights = [];

        // Check for emotion volatility
        const confidences = multimodalData.map(e => e.confidence);
        const variance = this._calculateVariance(confidences);
        if (variance > 500) {
            insights.push('Patient showed high emotional volatility with frequent mood shifts.');
        } else if (variance < 100) {
            insights.push('Patient maintained relatively stable emotional state throughout session.');
        }

        // Check for consensus
        const consensusRate = (multimodalData.filter(e => e.consensus?.achieved).length / multimodalData.length) * 100;
        if (consensusRate > 80) {
            insights.push('Facial and audio emotions showed strong agreement, indicating consistent emotional expression.');
        } else if (consensusRate < 40) {
            insights.push('Facial and audio emotions showed disagreement; patient may be suppressing voice or using different expressions.');
        }

        // Check for emotional spikes
        const spikes = [];
        const confidences2 = multimodalData.map(e => e.confidence);
        for (let i = 1; i < confidences2.length; i++) {
            if (Math.abs(confidences2[i] - confidences2[i - 1]) > 30) {
                spikes.push(i);
            }
        }
        if (spikes.length > 5) {
            insights.push(`Patient experienced ${spikes.length} significant emotional transitions, suggesting reactive emotional patterns.`);
        }

        return insights;
    }

    /**
     * Calculate variance helper
     * @private
     */
    _calculateVariance(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b) / values.length;
        return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    }

    /**
     * Generate recommendations
     * @private
     */
    _generateRecommendations() {
        const summary = this._generateSummary();
        const emotion = summary.primaryEmotion;

        const recommendations = {
            'sad': [
                'Assess for depression screening',
                'Explore underlying causes of sadness',
                'Recommend mood-enhancing activities',
                'Consider medication referral if symptoms persist'
            ],
            'angry': [
                'Teach anger management techniques',
                'Explore triggers and coping strategies',
                'Practice deep breathing and relaxation',
                'Consider assertiveness training'
            ],
            'fearful': [
                'Assess anxiety levels and sources',
                'Introduce exposure therapy if appropriate',
                'Teach grounding and anxiety management techniques',
                'Consider relaxation training'
            ],
            'happy': [
                'Build on positive momentum',
                'Reinforce adaptive coping strategies',
                'Explore what contributes to positive mood',
                'Use this as foundation for therapeutic progress'
            ],
            'neutral': [
                'Explore affect suppression patterns',
                'Encourage emotional expression',
                'Assess for emotional numbness or dissociation',
                'Increase emotional awareness exercises'
            ]
        };

        return recommendations[emotion] || [
            'Continue regular monitoring',
            'Track emotion patterns over time',
            'Correlate with life events',
            'Adjust treatment as needed'
        ];
    }

    /**
     * Generate timeline graph data
     * @private
     */
    _generateTimeline() {
        const events = this.sessionData.multimodalEvents;
        
        if (events.length === 0) return [];

        return events.map((event, idx) => ({
            index: idx,
            time: event.sessionTime,
            emotion: event.dominantEmotion,
            confidence: event.confidence,
            consensus: event.consensus?.achieved ? 1 : 0,
            reliability: event.reliabilityScore
        }));
    }

    /**
     * Export report as JSON
     * @returns {string} JSON string
     */
    exportJSON() {
        const report = this.generateReport();
        return JSON.stringify(report, null, 2);
    }

    /**
     * Export report as plain text
     * @returns {string} Formatted text
     */
    exportText() {
        const report = this.generateReport();
        const metadata = report.metadata;
        const summary = report.summary;
        const analysis = report.emotionAnalysis;
        const insights = report.insights;
        const recommendations = report.recommendations;

        let text = `
╔════════════════════════════════════════════════════════════════╗
║                    EMOTION SESSION REPORT                      ║
╚════════════════════════════════════════════════════════════════╝

SESSION INFORMATION
───────────────────────────────────────────────────────────────
Session Name:     ${metadata.sessionName}
Date:             ${new Date(metadata.sessionDate).toLocaleString()}
Duration:         ${metadata.duration.formatted}
Patient ID:       ${metadata.patientInfo.id || 'N/A'}

SUMMARY
───────────────────────────────────────────────────────────────
Primary Emotion:  ${summary.primaryEmotion?.toUpperCase() || 'Unknown'}
Prevalence:       ${summary.primaryEmotionPercentage}%
Overall Confidence: ${summary.overallConfidence}%

EMOTION DISTRIBUTION:
`;
        Object.entries(summary.emotionDistribution || {}).forEach(([emotion, count]) => {
            text += `  ${emotion.padEnd(12)}: ${count} observations\n`;
        });

        text += `
KEY OBSERVATIONS
───────────────────────────────────────────────────────────────
${summary.primaryObservation}

DETAILED ANALYSIS
───────────────────────────────────────────────────────────────
Total Emotion Frames Analyzed: ${analysis?.totalFrames || 0}
Average Confidence: ${analysis?.averageConfidence || 0}%
Face Detection Rate: ${analysis?.faceDetectionRate || 0}%
Emotional Spikes: ${analysis?.emotionSpikes?.length || 0}

INSIGHTS
───────────────────────────────────────────────────────────────
`;
        insights.forEach(insight => {
            text += `• ${insight}\n`;
        });

        text += `
RECOMMENDATIONS
───────────────────────────────────────────────────────────────
`;
        recommendations.forEach(rec => {
            text += `• ${rec}\n`;
        });

        text += `
═══════════════════════════════════════════════════════════════
Report Generated: ${report.exportedAt}
═══════════════════════════════════════════════════════════════
`;

        return text;
    }

    /**
     * Reset session data
     */
    reset() {
        this.sessionStart = Date.now();
        this.sessionData = {
            emotionEvents: [],
            audioEvents: [],
            multimodalEvents: [],
            performanceMetrics: [],
            systemEvents: []
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionReportGenerator;
}
