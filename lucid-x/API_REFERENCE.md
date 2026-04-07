## Multimodal Emotion Recognition System - API Reference

# Complete API Documentation

## Table of Contents
1. [MultimodalEmotionSystem](#multimodalemotionsystem)
2. [EmotionDetector](#emotiondetector)
3. [TemporalEmotionModel](#temporalemotionmodel)
4. [AudioEmotionRecognizer](#audioemotionrecognizer)
5. [MultimodalFusionEngine](#multimodalfusionengine)
6. [ExplainableAI](#explainableai)
7. [SessionReportGenerator](#sessionreportgenerator)
8. [PerformanceComparison](#performancecomparison)
9. [LightPreprocessor](#lightpreprocessor)
10. [EmotionDashboard](#emotiondashboard)
11. [MLIntegration](#mlintegration)

---

## MultimodalEmotionSystem

**Purpose**: Main orchestrator coordinating all emotion recognition modules

### Constructor
```javascript
new MultimodalEmotionSystem(config)
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enableAudio` | boolean | `true` | Enable audio emotion recognition |
| `enableFacial` | boolean | `true` | Enable facial emotion detection |
| `enableMultimodal` | boolean | `true` | Enable multimodal fusion |
| `enableExplainability` | boolean | `true` | Enable saliency maps |
| `enableReporting` | boolean | `true` | Enable session tracking |
| `facialWeight` | number (0-1) | `0.6` | Weight for facial emotion in fusion |
| `audioWeight` | number (0-1) | `0.4` | Weight for audio emotion in fusion |
| `onEmotionDetected` | function | `()=>{}` | Facial emotion callback |
| `onAudioDetected` | function | `()=>{}` | Audio emotion callback |
| `onFusionResult` | function | `()=>{}` | Fusion result callback |
| `onSystemUpdate` | function | `()=>{}` | System metrics callback |
| `onError` | function | `()=>{}` | Error handler callback |

### Methods

#### initialize(videoElement, withAudio)
Initializes all ML components

**Parameters:**
- `videoElement` (HTMLVideoElement): Source video element
- `withAudio` (boolean): Enable audio processing

**Returns:** `Promise<boolean>`

**Example:**
```javascript
const success = await system.initialize(videoElement, true);
```

#### start()
Begin real-time emotion recognition

**Returns:** `void`

#### pause()
Pause emotion recognition (can be resumed)

**Returns:** `void`

#### resume()
Resume paused emotion recognition

**Returns:** `void`

#### stop()
Stop emotion recognition and cleanup resources

**Returns:** `void`

#### getMetrics()
Get current system performance metrics

**Returns:**
```javascript
{
    running: boolean,
    paused: boolean,
    fps: number,
    emotionDetectorMetrics: {
        totalFrames: number,
        averageDetectionTime: number,
        detectionRate: number
    },
    temporalModelStats: {
        windowSize: number,
        stability: number
    },
    audioStats: {
        averageEnergy: number,
        averagePitch: number
    },
    multimodalMetrics: {
        consensusRate: number,
        agreementRate: number
    },
    timestamp: number
}
```

#### getAnalysis()
Get detailed emotional analysis

**Returns:**
```javascript
{
    emotionalTrend: string,          // 'increasing' | 'decreasing' | 'stable' | 'volatile'
    temporalStability: {
        score: number,                // 0-1
        level: string                 // 'building' | 'medium' | 'high'
    },
    multimodalAgreement: {
        consensusScore: number,       // 0-1
        agreementRate: number         // 0-100
    },
    emotionTimeline: Array,           // Last 100 emotion points
    recentSaliencyMaps: Array         // Last 5 saliency maps
}
```

#### getStatus()
Get comprehensive system status

**Returns:**
```javascript
{
    running: boolean,
    paused: boolean,
    components: {
        facialDetection: { enabled, loaded },
        audioDetection: { enabled, initialized },
        multimodalFusion: { enabled, weights: {facial, audio} },
        explainability: { enabled },
        reporting: { enabled }
    },
    metrics: {...}  // Same as getMetrics()
}
```

#### adjustFusionWeights(facialWeight, audioWeight)
Dynamically adjust emotion fusion weights

**Parameters:**
- `facialWeight` (number, 0-1): Facial emotion weight
- `audioWeight` (number, 0-1): Audio emotion weight

**Returns:** `void`

#### compareDetectors(duration)
Benchmark SSD vs Tiny detectors

**Parameters:**
- `duration` (number): Test duration in seconds, default 30

**Returns:** `Promise<Object>`

#### generateSessionReport()
Create comprehensive session report

**Returns:** Session report object (see SessionReportGenerator)

#### exportSessionReport(format)
Export session data

**Parameters:**
- `format` (string): 'json', 'text', or 'both'

**Returns:** Object or string

#### reset()
Reset all systems and clear data

**Returns:** `void`

---

## EmotionDetector

**Purpose**: Detect facial emotions using computer vision

### Constructor
```javascript
new EmotionDetector(config)
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `useSSD` | boolean | `true` | Use SSD (accurate) vs Tiny (fast) |
| `confidenceThreshold` | number | `0.5` | Minimum emotion confidence |
| `minFaceDistance` | number | `100` | Min pixels between faces |
| `detectAlternatives` | boolean | `true` | Detect other faces too |

### Methods

#### loadModels()
Load face-api models from CDN

**Returns:** `Promise<boolean>`

#### detectEmotions(videoElement, useSSD)
Detect emotions in video frame

**Parameters:**
- `videoElement` (HTMLVideoElement): Source video
- `useSSD` (boolean): Override detector type

**Returns:** `Promise<Array>`

```javascript
[{
    landmarks: Object,                // Face landmarks
    box: { x, y, width, height },
    dominantEmotion: string,          // 'happy', 'sad', etc.
    confidence: number,               // 0-1
    allExpressions: {
        happy: number,
        sad: number,
        angry: number,
        fearful: number,
        surprised: number,
        disgusted: number,
        neutral: number
    },
    faceQuality: {
        eyeDistance: number,
        alignment: number
    }
}]
```

#### compareDetectors()
Compare SSD and Tiny performance

**Returns:** `Promise<Object>`

#### getPerformanceMetrics()
Get detection performance stats

**Returns:**
```javascript
{
    totalFrames: number,
    averageDetectionTime: number,    // milliseconds
    fps: number,
    detectionRate: number             // percentage
}
```

---

## TemporalEmotionModel

**Purpose**: Smooth frame-by-frame emotions with temporal context

### Constructor
```javascript
new TemporalEmotionModel(config)
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `windowSize` | number | `15` | Frame window size |
| `emaFactor` | number | `0.7` | Exponential moving average factor |
| `stabilityThreshold` | number | `0.8` | Emotion stability threshold |
| `spikeThreshold` | number | `0.2` | Emotion change threshold |

### Methods

#### addEmotionFrame(emotion, confidence, allExpressions)
Add frame to temporal model

**Parameters:**
- `emotion` (string): Detected emotion
- `confidence` (number): Detection confidence
- `allExpressions` (Object): All emotion probabilities

**Returns:**
```javascript
{
    smoothedEmotion: string,
    smoothedConfidence: number,
    isStable: boolean,
    changeDetected: boolean
}
```

#### detectSpikes()
Identify sudden emotion changes

**Returns:** `Array` of spike events

#### isStable()
Check if emotion is stable

**Returns:** `boolean`

#### getPredictionConfidenceLevel()
Get stability level

**Returns:** `string` - 'building' | 'medium' | 'high'

#### getStatistics()
Get temporal model stats

**Returns:**
```javascript
{
    windowSize: number,
    currentFrames: number,
    stabilityScore: number,
    averageConfidence: number
}
```

#### getDominantEmotionTrend()
Analyze emotion trend

**Returns:** `Object` with trend information

#### reset()
Clear temporal history

**Returns:** `void`

---

## AudioEmotionRecognizer

**Purpose**: Recognize emotion from speech

### Constructor
```javascript
new AudioEmotionRecognizer(config)
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sampleRate` | number | `16000` | Audio sample rate (Hz) |
| `fftSize` | number | `2048` | FFT analysis size |
| `numBands` | number | `13` | MFCC bands |
| `energyThreshold` | number | `0.1` | Minimum energy threshold |

### Methods

#### initialize()
Request microphone access

**Returns:** `Promise<boolean>`

#### extractFeatures()
Extract audio features from current frame

**Returns:**
```javascript
{
    energy: number,           // 0-1
    pitch: number,            // Hz
    spectralCentroid: number, // Hz
    zeroCrossingRate: number,
    mfcc: Array[13],          // Mel-frequency cepstral coefficients
    timestamp: number
}
```

#### predictEmotion()
Classify emotion from features

**Returns:**
```javascript
{
    emotion: string,          // 'happy', 'sad', etc.
    confidence: number,       // 0-1
    energy: number,
    pitch: number,
    features: Object
}
```

#### getStatistics()
Get audio statistics

**Returns:**
```javascript
{
    averageEnergy: number,
    averagePitch: number,
    frameCount: number,
    recordingDuration: number
}
```

#### stop()
Stop audio recording

**Returns:** `void`

#### reset()
Clear audio history

**Returns:** `void`

#### get isInitialized()
Check if audio is initialized

**Returns:** `boolean`

---

## MultimodalFusionEngine

**Purpose**: Combine facial and audio emotions

### Constructor
```javascript
new MultimodalFusionEngine(config)
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `facialWeight` | number | `0.6` | Facial emotion weight |
| `audioWeight` | number | `0.4` | Audio emotion weight |
| `consensusThreshold` | number | `0.7` | Strong agreement threshold |

### Methods

#### fuseEmotions(facialData, audioData, context)
Combine facial and audio predictions

**Parameters:**
- `facialData` (Object): Facial emotion with confidence
- `audioData` (Object): Audio emotion with confidence
- `context` (Object, optional): Additional context

**Returns:**
```javascript
{
    fusedEmotion: string,
    fusedConfidence: number,
    consensusScore: number,      // 0-1
    reliabilityScore: number,    // 0-1
    agreement: string,           // 'high' | 'partial' | 'low'
    facialEmotion: string,
    audioEmotion: string,
    timestamp: number
}
```

#### analyzeAgreement()
Analyze multimodal agreement metrics

**Returns:**
```javascript
{
    consensusRate: number,       // percentage
    agreementRate: number,       // percentage
    totalComparisons: number,
    strongAgreements: number,
    partialAgreements: number,
    disagreements: number
}
```

#### getDominantEmotionTrend()
Analyze emotion trend over time

**Returns:** `Object` with trend analysis

#### getTimeline()
Get emotion timeline

**Returns:** `Array` of emotion events

#### adjustWeights(facialWeight, audioWeight)
Adjust fusion weights

**Parameters:**
- `facialWeight` (number, 0-1)
- `audioWeight` (number, 0-1)

**Returns:** `void`

#### getMetrics()
Get fusion metrics

**Returns:** `Object` with detailed metrics

#### reset()
Clear fusion history

**Returns:** `void`

---

## ExplainableAI

**Purpose**: Provide interpretable explanations for emotion predictions

### Constructor
```javascript
new ExplainableAI(config)
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enableSaliency` | boolean | `true` | Generate saliency maps |
| `enableExplanation` | boolean | `true` | Generate text explanations |
| `heatmapResolution` | number | `50` | Heatmap grid size |

### Methods

#### generateSaliencyMap(faceData, emotion, confidence)
Create saliency map for face region

**Parameters:**
- `faceData` (Object): Face landmarks and box
- `emotion` (string): Predicted emotion
- `confidence` (number): Prediction confidence

**Returns:**
```javascript
{
    saliency: {
        heatmap: Object,
        regions: Array
    },
    naturalLanguage: string,         // Text explanation
    keyRegions: Array,               // Important regions
    reliability: string,             // 'high' | 'medium' | 'low'
    suggestions: Array               // Clinical suggestions
}
```

#### visualizeHeatmapOnCanvas(canvas, saliencyData)
Draw saliency map on canvas

**Parameters:**
- `canvas` (HTMLCanvasElement): Target canvas
- `saliencyData` (Object): Saliency map data

**Returns:** `void`

#### getRecentSaliencyMaps(count)
Get last N saliency maps

**Parameters:**
- `count` (number): Number of maps

**Returns:** `Array`

#### reset()
Clear saliency history

**Returns:** `void`

---

## SessionReportGenerator

**Purpose**: Generate comprehensive session analytics reports

### Constructor
```javascript
new SessionReportGenerator(config)
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sessionName` | string | `''` | Session identifier |
| `therapistName` | string | `''` | Therapist name |
| `patientName` | string | `''` | Patient name |
| `sessionType` | string | `'consultation'` | Type of session |

### Methods

#### recordEmotionEvent(emotionData)
Log facial emotion event

**Parameters:**
- `emotionData` (Object): Emotion detection result

**Returns:** `void`

#### recordAudioEvent(audioData)
Log audio emotion event

**Parameters:**
- `audioData` (Object): Audio emotion result

**Returns:** `void`

#### recordMultimodalEvent(fusionData)
Log multimodal fusion event

**Parameters:**
- `fusionData` (Object): Fusion result

**Returns:** `void`

#### generateReport()
Create comprehensive report

**Returns:**
```javascript
{
    metadata: {
        sessionName: string,
        sessionStart: number,
        sessionDuration: number,
        therapist: string,
        patient: string
    },
    summary: {
        primaryEmotion: string,
        emotionDistribution: Object,
        averageConfidence: number
    },
    analysis: {
        emotionalSpikes: Array,
        emotionTransitions: Array,
        stableEmotions: Array
    },
    multimodal: {
        consensusRate: number,
        agreementMetrics: Object
    },
    insights: Array,
    recommendations: Array,
    timeline: Array
}
```

#### exportJSON()
Export report as JSON

**Returns:** `String` (JSON formatted)

#### exportText()
Export report as formatted text

**Returns:** `String` (Text formatted)

#### reset()
Clear session data

**Returns:** `void`

---

## PerformanceComparison

**Purpose**: Benchmark detector performance

### Constructor
```javascript
new PerformanceComparison(config)
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `benchmarkDuration` | number | `30` | Duration in seconds |

### Methods

#### runComparison(videoElement, emotionDetector, duration)
Run SSD vs Tiny benchmark

**Parameters:**
- `videoElement` (HTMLVideoElement): Video source
- `emotionDetector` (EmotionDetector): Detector instance
- `duration` (number): Test duration

**Returns:** `Promise<Object>`

#### getBenchmarkReport()
Get latest benchmark results

**Returns:**
```javascript
{
    ssdMetrics: { fps, latency, detectionRate },
    tinyMetrics: { fps, latency, detectionRate },
    comparison: {
        speedupFactor: number,
        recommendation: string
    },
    timestamp: number
}
```

#### getChartData()
Get data for charting

**Returns:** `Object` formatted for chart libraries

#### exportAsText()
Export comparison as text

**Returns:** `String`

#### exportAsJSON()
Export comparison as JSON

**Returns:** `String`

#### reset()
Clear benchmark data

**Returns:** `void`

---

## LightPreprocessor

**Purpose**: Handle low-light image enhancement

### Constructor
```javascript
new LightPreprocessor(config)
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enableHistogramEqualization` | boolean | `true` | Enable histogram equalization |
| `enableBrightnessNormalization` | boolean | `true` | Normalize brightness |
| `enableContrastEnhancement` | boolean | `true` | Enhance contrast |
| `gammaCorrection` | boolean | `true` | Apply gamma correction |
| `targetBrightness` | number | `150` | Target brightness level |
| `brightnessThreshold` | number | `80` | Low-light threshold |

### Methods

#### preprocessFrame(imageData)
Preprocess single frame

**Parameters:**
- `imageData` (ImageData | HTMLCanvasElement): Frame to process

**Returns:** `ImageData` - Processed frame

#### processCanvas(canvas)
Process canvas element in-place

**Parameters:**
- `canvas` (HTMLCanvasElement): Canvas to process

**Returns:** `void`

#### getStatistics()
Get preprocessing statistics

**Returns:**
```javascript
{
    imagesProcessed: number,
    lowLightImagesDetected: number,
    lowLightPercentage: string,
    averageProcessingTime: string,
    isRealTimeCapable: boolean
}
```

#### reset()
Clear statistics

**Returns:** `void`

---

## EmotionDashboard

**Purpose**: Real-time visualization of emotion data

### Constructor
```javascript
new EmotionDashboard(containerId, config)
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `containerId` | string | required | HTML element ID |
| `maxTimelinePoints` | number | `300` | Timeline data points |
| `updateInterval` | number | `100` | Update frequency (ms) |
| `showSaliency` | boolean | `true` | Show saliency maps |
| `showPerformance` | boolean | `true` | Show FPS/latency |
| `onExport` | function | `()=>{}` | Export callback |
| `onReset` | function | `()=>{}` | Reset callback |
| `onPause` | function | `()=>{}` | Pause callback |

### Methods

#### updateEmotionDisplay(emotionData)
Update facial emotion display

**Parameters:**
- `emotionData` (Object): `{emotion, confidence}`

**Returns:** `void`

#### updateAudioDisplay(audioData)
Update audio emotion display

**Parameters:**
- `audioData` (Object): `{emotion, confidence, energy}`

**Returns:** `void`

#### updateMultimodalDisplay(multimodalData)
Update fusion results

**Parameters:**
- `multimodalData` (Object): Fusion result

**Returns:** `void`

#### updatePerformanceMetrics(metrics)
Update performance display

**Parameters:**
- `metrics` (Object): System metrics

**Returns:** `void`

#### updateTemporalStability(stabilityData)
Update stability indicator

**Parameters:**
- `stabilityData` (Object): `{score, level}`

**Returns:** `void`

#### updateTrend(trend)
Update trend indicator

**Parameters:**
- `trend` (string): Trend direction

**Returns:** `void`

#### updateExplanation(explanation)
Update saliency explanation

**Parameters:**
- `explanation` (Object): Saliency data

**Returns:** `void`

#### reset()
Clear all dashboard data

**Returns:** `void`

---

## MLIntegration

**Purpose**: Easy integration with existing portal applications

### Constructor
```javascript
new MLIntegration(config)
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `remoteVideoId` | string | `'remoteVideo'` | Video element ID |
| `dashboardContainerId` | string | `'emotionDashboard'` | Dashboard container ID |
| `enableDashboard` | boolean | `true` | Show dashboard UI |
| `enableReporting` | boolean | `true` | Enable session tracking |
| `socketInstance` | Socket.IO | `null` | Socket.IO instance |
| `onEmotionDetected` | function | `()=>{}` | Custom callback |
| `onFusionResult` | function | `()=>{}` | Custom callback |

### Methods

#### initialize()
Setup ML system

**Returns:** `Promise<boolean>`

#### start()
Start emotion recognition

**Returns:** `void`

#### stop()
Stop emotion recognition

**Returns:** `void`

#### getAnalysis()
Get current analysis

**Returns:** `Object`

#### getMetrics()
Get system metrics

**Returns:** `Object`

#### generateReport()
Generate session report

**Returns:** `Object`

#### compareDetectors(duration)
Benchmark detectors

**Parameters:**
- `duration` (number): Test duration

**Returns:** `Promise<Object>`

---

## Testing Checklist

- [ ] All modules load without errors
- [ ] Video initialization works
- [ ] Audio permissions granted
- [ ] Facial detection functioning
- [ ] Temporal smoothing applied
- [ ] Audio features extracted
- [ ] Multimodal fusion working
- [ ] Saliency maps generated
- [ ] Dashboard displays correctly
- [ ] Session reports exported
- [ ] Performance metrics tracked
- [ ] 15+ FPS achieved
- [ ] No memory leaks detected
- [ ] Error handling working

---

**Version**: 1.0  
**Last Updated**: 2024  
**Status**: Production Ready
