# Audio Integration Verification Checklist

## ✅ Step-by-Step Verification

### 1. **Verify Script Imports** (2 minutes)
```
✓ Open: http://localhost:3000/patient
✓ Press F12 to open Developer Tools
✓ Go to Console tab
```

**Expected Output:**
```
🎤 Initializing audio emotion integration...
✅ Audio capture initialized successfully
  - Sample Rate: 16000Hz
  - Buffer Size: 4096
✅ Feature extractor ready
✅ Audio emotion predictor ready
✅ Event buffer ready
✅ Multimodal fusion engine ready
▶️ Audio emotion processing started
```

If you see any modules as `undefined`, the script imports didn't work.

---

### 2. **Test Microphone Access** (2 minutes)
```
✓ Console shows microphone permission request
✓ Click "Allow" in browser permission prompt
✓ Verify no "NotAllowedError" in console
```

**What to look for:**
```
✅ Emotion recognition models loaded successfully
✅ Audio capture initialized successfully
```

---

### 3. **Test Audio Feature Extraction** (1 minute)
```javascript
// In browser console, type:
audioIntegration.metrics

// Should show:
{
  fps: 60,
  audioLatency: 15,
  isAudioAvailable: true,      // ← Should be TRUE
  isFacialAvailable: true       // ← Should be TRUE
}
```

---

### 4. **Visual Verification** (3 minutes)
```
✓ Your video appears (camera working)
✓ Emotion display shows:
  - Facial emotion (from face detection)
  - Facial confidence %
  - Should update every 500ms
```

**Speak test:**
- Say "Hello!" in happy voice → Should show HAPPY/SURPRISED
- Say "I'm sad" slowly → Should show SAD
- Yell "STOP!" → Should show ANGRY
- Whisper "neutral" → Should show NEUTRAL

**What to expect:**
- Facial emotion updates based on expressions
- Audio emotion updates based on tone of voice
- Final multimodal emotion combines both

---

### 5. **Network Verification** (2 minutes)
```
✓ Press F12 → Network tab
✓ Filter: XHR
✓ Refresh page and speak
✓ Look for:
  - /ml/audioCapture.js ✓
  - /ml/audioEmotionPredictor.js ✓
  - /ml/emotionEventBuffer.js ✓
  - /ml/advancedMultimodalFusion.js ✓
  - /ml/audioIntegrationExample.js ✓
```

All should have status 200 (success).

---

### 6. **Feature Extraction Test** (2 minutes)
```javascript
// In console, type:
if (audioIntegration && audioIntegration.audioCapture) {
  const freq = audioIntegration.audioCapture.getFrequencyData();
  console.log('Audio data flowing:', freq ? 'YES ✓' : 'NO ✗');
  console.log('Sample:', freq?.slice(0, 10));
}
```

Should show array of numbers (frequency data).

---

### 7. **Emotion Prediction Test** (2 minutes)
```javascript
// In console:
if (audioIntegration && audioIntegration.emotionPredictor) {
  console.log('Last 3 predictions:');
  const preds = audioIntegration.emotionPredictor.predictionHistory.slice(-3);
  preds.forEach((p, i) => {
    console.log(`${i+1}. ${p.emotion} (${Math.round(p.confidence*100)}%)`);
  });
}
```

Should show recent emotions.

---

## 🔴 Common Issues & Fixes

### Issue: Microphone Permission Denied
```
❌ console shows: NotAllowedError: Permission denied
```

**Fix:**
1. Click address bar
2. Look for camera/microphone icon
3. Click it → Allow
4. Refresh page

Alternatively:
1. Settings (⋮) → Privacy and security
2. Site settings → Microphone
3. Find localhost:3000 → Change to "Allow"

---

### Issue: Audio modules not loading
```
❌ console shows: Uncaught ReferenceError: AudioCaptureModule is not defined
```

**Fix:**
1. Check Network tab (F12)
2. Verify `/ml/*.js` files load with status 200
3. Check browser cache:
   - F12 → Network tab
   - Click gear icon → Disable cache
   - Refresh page
4. Ensure files exist in `lucid-x/public/ml/`

---

### Issue: "modelsLoaded is not defined"
```
❌ Uncaught ReferenceError: modelsLoaded is not defined
```

**Fix:**
This means patient.js isn't loading properly.
1. Clear browser cache
2. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
3. Check if patient.js exists in `/public/patient.js`

---

### Issue: Audio emotion never updates
```
❌ Console shows audio logs but emotion display doesn't change
```

**Possible causes:**
1. Audio capture isn't getting data:
   ```javascript
   audioIntegration.metrics.isAudioAvailable // Check if TRUE
   ```

2. Feature extraction isn't running:
   ```javascript
   audioIntegration.emotionPredictor?.predictionHistory?.length // Should grow
   ```

3. Callbacks aren't firing:
   - Add console.log in emotionSystem.js `onAudioDetected` callback

---

### Issue: Only facial emotion shows, no audio
```
❌ Emotion display only shows facial recognition
```

**This is actually OK!** It means audio capture failed but facial still works.

To fix audio:
1. Check if `audioIntegration` exists:
   ```javascript
   console.log(audioIntegration); // Should be an object, not undefined
   ```

2. Check if it initialized:
   ```javascript
   console.log(audioIntegration?.metrics?.isAudioAvailable); // Should be true
   ```

---

## 📊 Performance Checklist

### CPU Usage
- Should be < 20% with both video & audio
- If > 50%, check:
  - Browser tab background
  - Video resolution (lower it in code)
  - Audio buffer size

### Memory Usage
- Should be < 100 MB
- If growing constantly, check:
  - Event buffer isn't clearing
  - Prediction history is capped at 50 items

### Latency
- Facial: ~100-150ms
- Audio: ~50-100ms
- Combined: ~200ms max

Check with:
```javascript
console.log(audioIntegration.metrics);
```

---

## 🧪 Test Scenarios

### Test 1: Happy Emotion
**Do this:**
1. Smile broadly
2. Speak with high pitch: "I'm so happy!"
3. Expected: HAPPY emotion, 70-90% confidence

### Test 2: Sad Emotion
**Do this:**
1. Look down, slouch
2. Speak quietly and slowly: "I feel sad..."
3. Expected: SAD emotion, 60-80% confidence

### Test 3: Angry Emotion
**Do this:**
1. Furrow brow
2. Speak harshly and loudly: "That's not acceptable!"
3. Expected: ANGRY emotion, 70-85% confidence

### Test 4: Neutral Emotion
**Do this:**
1. Face camera straight
2. Speak normally: "Good morning."
3. Expected: NEUTRAL emotion, 50-70% confidence

### Test 5: No Face
**Do this:**
1. Look away from camera
2. Speak naturally
3. Expected: Facial = "No Face", Audio still detects emotion

---

## 📈 Debug Output Example

When everything works, you should see:

```
[12:34:56] 🎙️ Initializing audio emotion integration...
[12:34:56] ✅ Audio capture initialized successfully
[12:34:56]   - Sample Rate: 16000Hz
[12:34:56]   - Buffer Size: 4096
[12:34:57] ✅ Feature extractor ready
[12:34:57] ✅ Audio emotion predictor ready
[12:34:57] ✅ Event buffer ready
[12:34:57] ✅ Multimodal fusion engine ready
[12:34:57] ▶️ Audio emotion processing started
[12:34:58] 🎭 Dominant emotion: happy (85%)
[12:34:59] 🎭 Multimodal emotion: happy
[12:35:00] 🎤 Dominant emotion (audio): happy (75%)
[12:35:01] 🎭 Final fused emotion: happy (confidence: 0.82)
```

---

## 📞 If Still Having Issues

1. Check this file for detailed logs: [AUDIO_INTEGRATION_FIX.md](../AUDIO_INTEGRATION_FIX.md)
2. Verify all files modified (see "Files Modified" section)
3. Ensure server is running: `npm start` in `lucid-x/` folder
4. Hard refresh browser: Ctrl+Shift+R
5. Check microphone works elsewhere (Zoom, Teams, etc.)

---

## ✅ Final Checklist

- [ ] Network requests show all `.js` files loaded (200 status)
- [ ] Console shows "✅ Audio capture initialized"
- [ ] Browser shows microphone permission prompt
- [ ] Microphone permission is ALLOWED
- [ ] Console shows "Audio emotion processing started"
- [ ] Video element displays camera feed
- [ ] Emotion display shows both facial and audio
- [ ] Speaking changes the emotion display
- [ ] Console shows emotion predictions updating
- [ ] Network tab shows data being sent to server

**If all ✓, your audio emotion integration is working!**

---

**Test Date**: ____________  
**Status**: ____________  
**Notes**: 

_________________________________
_________________________________
_________________________________
