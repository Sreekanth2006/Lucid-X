## Lucid-X Multimodal Emotion Recognition System

# Complete Setup & Integration Guide

This guide walks through setting up and integrating the multimodal emotion recognition system for real-time mental health teleconsultation applications.

## 📋 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Multimodal Emotion Recognition System (emotionSystem.js)   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Facial Emotion Detection (emotionDetector.js)       │   │
│  │ • SSD MobileNet v1 (accurate, slower)               │   │
│  │ • Tiny Face Detector (fast, real-time)              │   │
│  │ • 7 emotions + neutral detection                    │   │
│  │ • Face tracking & quality metrics                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Temporal Smoothing (temporalEmotionModel.js)        │   │
│  │ • Rolling window: 15 frames (~3 seconds)            │   │
│  │ • EMA smoothing (factor: 0.7)                       │   │
│  │ • Spike detection & stability scoring               │   │
│  │ • Prevents jitter & false positives                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Multimodal Fusion (multimodalFusion.js)             │   │
│  │ • Late fusion strategy                              │   │
│  │ • Facial (60%) + Audio (40%) weights               │   │
│  │ • Consensus detection                               │   │
│  │ • Reliability scoring                                │   │
│  └─────────────────────────────────────────────────────┘   │
│           ↙                                  ↖               │
│  ┌──────────────────┐          ┌──────────────────────┐   │
│  │ Audio Emotion    │          │ Explainable AI       │   │
│  │ (audioEmotion    │          │ (explainableAI.js)   │   │
│  │ Recognizer.js)   │          │ • Saliency maps      │   │
│  │ • MFCC features  │          │ • Natural language   │   │
│  │ • Energy, pitch  │          │ • Region importance  │   │
│  │ • Spectral info  │          │ • Clinical context   │   │
│  └──────────────────┘          └──────────────────────┘   │
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Session Reporting (sessionReport.js)                │   │
│  │ • Emotion timeline & distribution                   │   │
│  │ • Multimodal metrics & agreement                    │   │
│  │ • Clinical insights & recommendations               │   │
│  │ • JSON & text export formats                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🎨 Dashboard (emotionDashboard.js)                        │
│  🔬 Performance (performanceComparison.js)                 │
│  💡 Preprocessing (lightPreprocessor.js)                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## ✅ System Architecture

### Core Modules

| Module | Purpose | Key Features |
|--------|---------|--------------|
| **emotionDetector.js** | Facial emotion detection | SSD/Tiny comparison, multi-face support, face quality metrics |
| **temporalEmotionModel.js** | Temporal smoothing | EMA smoothing, spike detection, stability scoring |
| **audioEmotionRecognizer.js** | Speech emotion analysis | MFCC features, energy/pitch extraction, Web Audio API |
| **multimodalFusion.js** | Combine facial + audio | Late fusion, consensus detection, agreement metrics |
| **explainableAI.js** | Interpretability | Saliency maps, attention visualization, natural language |
| **sessionReport.js** | Session analytics | Timeline tracking, emotion distribution, clinical insights |
| **performanceComparison.js** | Benchmarking | FPS comparison, latency analysis, detector evaluation |
| **emotionSystem.js** | Main orchestrator | Coordinates all modules, manages state, provides unified API |
| **emotionDashboard.js** | Real-time visualization | Charts, metrics display, saliency visualization |
| **lightPreprocessor.js** | Image enhancement | Histogram equalization, brightness normalization for low-light |

## 🚀 Quick Start

### 1. HTML Setup

Include all scripts in your HTML file (patient.html or therapist.html):

```html
<!-- Required dependencies -->
<script src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js"></script>

<!-- ML Modules (in order) -->
<script src="ml/emotionDetector.js"></script>
<script src="ml/temporalEmotionModel.js"></script>
<script src="ml/audioEmotionRecognizer.js"></script>
<script src="ml/multimodalFusion.js"></script>
<script src="ml/explainableAI.js"></script>
<script src="ml/sessionReport.js"></script>
<script src="ml/performanceComparison.js"></script>
<script src="ml/lightPreprocessor.js"></script>

<!-- Orchestrator & Dashboard -->
<script src="ml/emotionSystem.js"></script>
<script src="ml/emotionDashboard.js"></script>
```

### 2. Initialize in Your Application

```javascript
const emotionSystem = new MultimodalEmotionSystem({
    enableAudio: true,
    enableFacial: true,
    enableMultimodal: true,
    enableExplainability: true,
    facialWeight: 0.6,
    audioWeight: 0.4,
    
    // Callbacks
    onEmotionDetected: (result) => {
        console.log('Facial emotion:', result.dominantEmotion);
    },
    onAudioDetected: (result) => {
        console.log('Audio emotion:', result.emotion);
    },
    onFusionResult: (result) => {
        console.log('Multimodal fusion:', result.fusedEmotion);
    },
    onSystemUpdate: (metrics) => {
        console.log('FPS:', metrics.fps);
    }
});

// Initialize with video element
const videoElement = document.getElementById('remoteVideo');
await emotionSystem.initialize(videoElement, true);

// Start real-time analysis
emotionSystem.start();
```

### 3. Setup Dashboard

```html
<!-- Add container to HTML -->
<div id="emotionDashboard"></div>
```

```javascript
const dashboard = new EmotionDashboard('emotionDashboard', {
    maxTimelinePoints: 300,
    showSaliency: true,
    showPerformance: true,
    
    onExport: () => {
        const report = emotionSystem.generateSessionReport();
        downloadReport(report);
    }
});

// Connect system to dashboard
emotionSystem.config.onEmotionDetected = (result) => {
    dashboard.updateEmotionDisplay({
        emotion: result.dominantEmotion,
        confidence: result.confidence
    });
};

emotionSystem.config.onAudioDetected = (result) => {
    dashboard.updateAudioDisplay(result);
};

emotionSystem.config.onFusionResult = (result) => {
    dashboard.updateMultimodalDisplay(result);
};

emotionSystem.config.onSystemUpdate = (metrics) => {
    dashboard.updatePerformanceMetrics(metrics);
};
```

## 📊 API Reference

### MultimodalEmotionSystem

#### Initialization
```javascript
const system = new MultimodalEmotionSystem(config);
```

**Config Options:**
```javascript
{
    enableAudio: boolean,              // Enable audio processing
    enableFacial: boolean,             // Enable facial detection
    enableMultimodal: boolean,         // Enable fusion
    enableExplainability: boolean,     // Enable saliency maps
    enableReporting: boolean,          // Enable session tracking
    facialWeight: 0-1,                // Facial weight in fusion
    audioWeight: 0-1,                 // Audio weight in fusion
    onEmotionDetected: (result) => {}, // Facial emotion callback
    onAudioDetected: (result) => {},   // Audio emotion callback
    onFusionResult: (result) => {},    // Multimodal fusion callback
    onSystemUpdate: (metrics) => {},   // Metrics update callback
    onError: (error) => {}             // Error callback
}
```

#### Core Methods

**Initialize System:**
```javascript
await system.initialize(videoElement, withAudio);
```
- `videoElement`: HTMLVideoElement for facial analysis
- `withAudio`: Boolean to enable audio processing
- Returns: Promise<boolean> - Success status

**Start/Stop Analysis:**
```javascript
system.start();          // Begin real-time processing
system.pause();          // Pause (no new detections)
system.resume();         // Resume from pause
system.stop();           // Stop and cleanup
```

**Get Current Data:**
```javascript
const metrics = system.getMetrics();
const analysis = system.getAnalysis();
const status = system.getStatus();
```

**Fusion Control:**
```javascript
system.adjustFusionWeights(0.6, 0.4); // Facial, Audio weights
```

**Reporting:**
```javascript
const report = system.generateSessionReport();
const json = system.exportSessionReport('json');
const text = system.exportSessionReport('text');
```

### EmotionDetector

```javascript
const detector = new EmotionDetector({
    useSSD: true,              // true=SSD, false=Tiny
    confidenceThreshold: 0.5,
    minFaceDistance: 100
});

await detector.loadModels();
const results = await detector.detectEmotions(videoElement);

// Returns:
{
    landmarks: Landmarks,
    box: { x, y, width, height },
    dominantEmotion: 'happy',
    confidence: 0.92,
    allExpressions: {
        happy: 0.92,
        sad: 0.03,
        // ... other emotions
    }
}
```

### TemporalEmotionModel

```javascript
const temporal = new TemporalEmotionModel({
    windowSize: 15,        // Frames
    emaFactor: 0.7,        // Smoothing factor
    stabilityThreshold: 0.8
});

temporal.addEmotionFrame('happy', 0.92, expressions);
// Returns: {
//   smoothedEmotion: 'happy',
//   smoothedConfidence: 0.88,
//   isStable: true
// }

temporal.detectSpikes();     // Find sudden changes
temporal.isStable();         // Check if emotion is stable
```

### AudioEmotionRecognizer

```javascript
const audio = new AudioEmotionRecognizer({
    sampleRate: 16000,
    fftSize: 2048,
    numBands: 13  // MFCC bands
});

await audio.initialize();  // Request microphone access

const features = audio.extractFeatures();
const emotion = audio.predictEmotion();

// Emotions: happy, sad, angry, fearful, surprised, disgusted, neutral
```

### MultimodalFusionEngine

```javascript
const fusion = new MultimodalFusionEngine({
    facialWeight: 0.6,
    audioWeight: 0.4
});

const result = fusion.fuseEmotions(facialData, audioData);
// Returns: {
//   fusedEmotion: 'happy',
//   fusedConfidence: 0.87,
//   consensusScore: 0.92,
//   reliabilityScore: 0.89,
//   agreement: 'high'
// }

const metrics = fusion.analyzeAgreement();
const trend = fusion.getDominantEmotionTrend();
```

### ExplainableAI

```javascript
const xai = new ExplainableAI();

const explanation = xai.generateSaliencyMap(faceData, emotion, confidence);
// Returns: {
//   saliency: { heatmap, regions },
//   naturalLanguage: "Happy emotion detected due to...",
//   keyRegions: ['mouth', 'eyes'],
//   reliability: 'high'
// }
```

### SessionReportGenerator

```javascript
const reporter = new SessionReportGenerator({
    sessionName: 'Patient-001',
    therapistName: 'Dr. Smith'
});

reporter.recordEmotionEvent(emotionData);
reporter.recordAudioEvent(audioData);
reporter.recordMultimodalEvent(fusionResult);

const fullReport = reporter.generateReport();
const json = reporter.exportJSON();
const text = reporter.exportText();
```

### LightPreprocessor

```javascript
const preprocessor = new LightPreprocessor({
    enableHistogramEqualization: true,
    enableBrightnessNormalization: true,
    enableContrastEnhancement: true,
    gammaCorrection: true,
    targetBrightness: 150,
    brightnessThreshold: 80
});

const processed = preprocessor.preprocessFrame(imageData);
preprocessor.processCanvas(canvas);

const stats = preprocessor.getStatistics();
```

## 🎯 Integration Examples

### Example 1: Patient Portal

```javascript
// In patient.html
const initializeEmotionAnalysis = async () => {
    // Get remote video (therapist feed)
    const remoteVideo = document.getElementById('remoteVideo');
    
    // Setup ML system
    const emotionSystem = new MultimodalEmotionSystem({
        enableAudio: true,
        enableFacial: true,
        enableMultimodal: true,
        onFusionResult: (result) => {
            console.log(`Detected emotion: ${result.fusedEmotion}`);
            updateUIWithEmotion(result);
        }
    });
    
    // Initialize with video
    const ready = await emotionSystem.initialize(remoteVideo, true);
    if (ready) {
        emotionSystem.start();
        
        // Setup dashboard
        const dashboard = new EmotionDashboard('emotionPanel');
        // ... connect callbacks
    }
};
```

### Example 2: Therapist Dashboard with Reports

```javascript
// In therapist.html
const setupTherapistDashboard = async () => {
    const emotionSystem = new MultimodalEmotionSystem({
        enableReporting: true,
        onSystemUpdate: (metrics) => {
            updateMetricsDisplay(metrics);
        }
    });
    
    // After session
    const generateReportButton = document.getElementById('reportBtn');
    generateReportButton.addEventListener('click', () => {
        const report = emotionSystem.generateSessionReport();
        displayReport(report);
        
        // Export for record
        const json = emotionSystem.exportSessionReport('json');
        saveSessionData(json);
    });
};
```

### Example 3: Server-Side Logging (Node.js)

```javascript
// In server.js - receiving emotion data from clients
io.on('connection', (socket) => {
    socket.on('emotionUpdate', (emotionData) => {
        // Log emotion for analysis
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${emotionData.fusedEmotion} (${emotionData.fusedConfidence})`);
        
        // Store in database
        storeEmotionLog({
            sessionId: socket.sessionId,
            timestamp,
            emotion: emotionData.fusedEmotion,
            confidence: emotionData.fusedConfidence,
            modalities: {
                facial: emotionData.facialEmotion,
                audio: emotionData.audioEmotion
            }
        });
    });
});
```

## ⚙️ Configuration Recommendations

### For Real-Time Video Calls
```javascript
{
    enableAudio: true,           // Audio adds richness
    enableFacial: true,          // Primary signal
    enableMultimodal: true,      // Combined analysis
    facialWeight: 0.65,          // Facial slightly dominant
    audioWeight: 0.35            // Audio support
}
```

### For Performance (Low-End Devices)
```javascript
{
    emotionDetectorConfig: {
        useSSD: false  // Use Tiny detector
    },
    enableAudio: false,          // Skip audio processing
    enableExplainability: false  // Skip saliency maps
}
```

### For Explainability (Clinical Use)
```javascript
{
    enableExplainability: true,  // Full saliency maps
    enableReporting: true,       // Detailed reporting
    facialWeight: 0.5,           // Balanced weights
    audioWeight: 0.5             // Equal importance
}
```

## 📈 Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| FPS | 15-30 | Real-time acceptable |
| Detection Latency | < 50ms | Per-frame processing |
| Memory | < 200MB | Browser memory usage |
| Audio Latency | < 100ms | WebAudio buffer |
| Fusion Latency | < 10ms | Negligible overhead |

## 🧪 Testing & Validation

### Unit Test Template
```javascript
// Test emotion detection accuracy
async function testEmotionDetection() {
    const system = new MultimodalEmotionSystem();
    await system.initialize(testVideoElement);
    
    const result = await system.emotionDetector.detectEmotions(testVideoElement);
    
    console.assert(result.length > 0, 'Should detect face');
    console.assert(result[0].dominantEmotion, 'Should have emotion');
    console.assert(result[0].confidence > 0.5, 'Confidence should be reasonable');
}
```

### Integration Test Template
```javascript
// Test multimodal fusion
async function testMultimodalFusion() {
    const system = new MultimodalEmotionSystem({
        enableMultimodal: true
    });
    
    await system.initialize(videoElement, true);
    system.start();
    
    // Wait for fusion results
    setTimeout(() => {
        const analysis = system.getAnalysis();
        console.log('Emotional Trend:', analysis.emotionalTrend);
        console.log('Multimodal Agreement:', analysis.multimodalAgreement);
    }, 5000);
}
```

## 📚 Important Notes

1. **Browser Requirements**: Chrome/Edge 75+, Firefox 75+, Safari 12+
2. **HTTPS Only**: Required for accessing microphone
3. **Model Loading**: First load may take 3-5 seconds (models cached after)
4. **Memory**: Clean up with `system.stop()` after sessions
5. **Permissions**: Request camera + microphone access before `initialize()`
6. **Real-Time**: Use Tiny detector for 30+ FPS on standard hardware

## 🔧 Troubleshooting

**Q: Models not loading**
- Check CDN availability of face-api.js
- Verify HTTPS connection
- Check browser console for CORS errors

**Q: Low FPS**
- Switch from SSD to Tiny detector: `useSSD: false`
- Reduce temporal window size
- Disable explainability: `enableExplainability: false`

**Q: Audio permission denied**
- Check HTTPS setup
- Request permissions explicitly
- Check browser privacy settings

**Q: Low emotion detection accuracy**
- Ensure good lighting
- Enable light preprocessor
- Verify face is clearly visible
- Check detector confidence threshold

## 📝 Next Steps

1. ✅ Integrate modules into your portal
2. ✅ Setup dashboard visualization
3. ✅ Configure fusion weights for your use case
4. ✅ Test with real patient-therapist sessions
5. ✅ Export and analyze session reports
6. ✅ Iterate on clinical recommendations

---

**Version**: 1.0  
**Last Updated**: 2024  
**Research Grade**: Final Year Project Suitable
