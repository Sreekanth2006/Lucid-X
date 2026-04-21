"""
Lucid-X Speech Emotion Analysis Backend
=========================================

This Python microservice analyzes speech emotions using wav2vec2 models.

Requirements:
    pip install flask python-multipart transformers torch torchaudio librosa flask-cors numpy

How to run:
    python speech_service.py

The service will run on http://localhost:5000
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import librosa
import io
import torch
from transformers import pipeline
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for browser requests

# Load wav2vec2 emotion classification model
# This model is trained on speech emotion recognition datasets
logger.info("Loading wav2vec2 speech emotion recognition model...")
try:
    # Using Hugging Face model for speech emotion
    emotion_classifier = pipeline(
        "audio-classification",
        model="superb/hubert-large-superb-er",  # Speech emotion recognition model
        device=0 if torch.cuda.is_available() else -1  # Use GPU if available
    )
    logger.info("✅ Speech emotion model loaded successfully")
except Exception as e:
    logger.warning(f"⚠️  Could not load GPU-optimized model: {e}")
    logger.info("Trying alternative model...")
    try:
        emotion_classifier = pipeline(
            "audio-classification",
            model="wav2vec2-large-xls-r-300m-emotion-en",
            device=-1  # CPU
        )
        logger.info("✅ Alternative speech emotion model loaded")
    except Exception as e:
        logger.error(f"❌ Failed to load emotion model: {e}")
        emotion_classifier = None

# Emotion mapping - map model outputs to standardized emotion categories
EMOTION_MAP = {
    'happy': 'happy',
    'joy': 'happy',
    'sad': 'sad',
    'sadness': 'sad',
    'anger': 'angry',
    'angry': 'angry',
    'neutral': 'neutral',
    'disgust': 'disgusted',
    'fear': 'fearful',
    'fearful': 'fearful',
    'surprise': 'surprised',
    'surprised': 'surprised',
}

def normalize_emotion(predicted_emotion):
    """
    Map model-specific emotion labels to our standard 7 emotion categories
    """
    predicted_emotion_lower = predicted_emotion.lower().strip()
    
    # Check direct match
    if predicted_emotion_lower in EMOTION_MAP:
        return EMOTION_MAP[predicted_emotion_lower]
    
    # Check partial match
    for key, value in EMOTION_MAP.items():
        if key in predicted_emotion_lower or predicted_emotion_lower in key:
            return value
    
    # Default to neutral if no match
    return 'neutral'

@app.route('/analyze-speech', methods=['POST'])
def analyze_speech():
    """
    Analyze speech emotion from audio file
    
    Expected POST data:
        - audio: Audio file (webm, wav, mp3, etc.)
        - sessionId: Session identifier
        - timestamp: Client timestamp (optional)
    
    Returns:
        {
            "emotion": "happy",
            "confidence": 0.92,
            "allEmotions": {
                "happy": 0.92,
                "sad": 0.05,
                "neutral": 0.03
            },
            "timestamp": 1234567890
        }
    """
    try:
        # Get audio file from request
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        sessionId = request.form.get('sessionId', 'unknown')
        clientTimestamp = request.form.get('timestamp', '')
        
        # Log request
        logger.info(f"🎤 Received audio from session {sessionId}")
        
        # Check if model is loaded
        if emotion_classifier is None:
            return jsonify({
                'error': 'Speech emotion model not available',
                'emotion': 'neutral',
                'confidence': 0.5,
                'allEmotions': {'neutral': 1.0}
            }), 503
        
        # Read audio file
        audio_data = audio_file.read()
        
        # Convert webm/various formats to numpy array
        # Using librosa to load audio
        try:
            # Load audio with librosa (handles multiple formats)
            audio_bytes = io.BytesIO(audio_data)
            y, sr = librosa.load(audio_bytes, sr=16000, mono=True)  # 16kHz mono
            
            # Ensure minimum audio length (at least 0.5 seconds)
            min_samples = int(16000 * 0.5)
            if len(y) < min_samples:
                logger.warning(f"⚠️  Audio too short ({len(y)} samples), padding...")
                y = np.pad(y, (0, min_samples - len(y)), mode='constant')
            
            logger.info(f"📊 Audio loaded: {len(y)} samples at {sr}Hz")
        except Exception as e:
            logger.error(f"❌ Failed to load audio: {e}")
            return jsonify({
                'error': f'Audio processing failed: {str(e)}',
                'emotion': 'neutral',
                'confidence': 0.5,
                'allEmotions': {'neutral': 1.0}
            }), 400
        
        # Analyze emotion
        try:
            # Get predictions from model
            predictions = emotion_classifier(y)
            logger.info(f"🎯 Raw predictions: {predictions}")
            
            # The model returns a list of dicts with 'label' and 'score'
            if not predictions or len(predictions) == 0:
                raise ValueError("Model returned no predictions")
            
            # Sort by score (confidence)
            predictions = sorted(predictions, key=lambda x: x['score'], reverse=True)
            
            # Get top emotion
            top_prediction = predictions[0]
            predicted_emotion = top_prediction['label']
            confidence = float(top_prediction['score'])
            
            # Normalize emotion to our 7-emotion standard
            normalized_emotion = normalize_emotion(predicted_emotion)
            
            # Build emotion distribution
            all_emotions = {}
            for pred in predictions:
                emotion = normalize_emotion(pred['label'])
                score = float(pred['score'])
                
                # Aggregate duplicate emotions
                if emotion in all_emotions:
                    all_emotions[emotion] += score
                else:
                    all_emotions[emotion] = score
            
            # Normalize emotion distribution to sum to 1.0
            total = sum(all_emotions.values())
            if total > 0:
                all_emotions = {k: v / total for k, v in all_emotions.items()}
            
            logger.info(f"✅ Emotion analysis: {normalized_emotion} ({confidence:.1%})")
            logger.info(f"📊 Emotion distribution: {all_emotions}")
            
            return jsonify({
                'emotion': normalized_emotion,
                'confidence': confidence,
                'allEmotions': all_emotions,
                'timestamp': int(clientTimestamp) if clientTimestamp else None,
                'model': 'wav2vec2-emotion'
            }), 200
            
        except Exception as e:
            logger.error(f"❌ Emotion classification failed: {e}")
            return jsonify({
                'error': f'Classification failed: {str(e)}',
                'emotion': 'neutral',
                'confidence': 0.5,
                'allEmotions': {'neutral': 1.0}
            }), 500
    
    except Exception as e:
        logger.error(f"❌ Unexpected error in /analyze-speech: {e}")
        return jsonify({
            'error': f'Server error: {str(e)}',
            'emotion': 'neutral',
            'confidence': 0.5,
            'allEmotions': {'neutral': 1.0}
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """
    Health check endpoint
    """
    return jsonify({
        'status': 'healthy',
        'service': 'Lucid-X Speech Emotion Analysis',
        'model_loaded': emotion_classifier is not None
    }), 200

@app.route('/', methods=['GET'])
def index():
    """
    Index endpoint with API documentation
    """
    return jsonify({
        'name': 'Lucid-X Speech Emotion Analysis Service',
        'version': '1.0.0',
        'endpoints': {
            'POST /analyze-speech': 'Analyze emotion from audio file',
            'GET /health': 'Health check'
        },
        'models': {
            'speech_emotion': 'wav2vec2 (Hubert Large SUPERB ER)',
            'device': 'CUDA' if torch.cuda.is_available() else 'CPU'
        }
    }), 200

if __name__ == '__main__':
    logger.info("🚀 Starting Lucid-X Speech Emotion Analysis Service on http://localhost:5000")
    
    # Run Flask app
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,  # Set to True only for development
        threaded=True
    )
