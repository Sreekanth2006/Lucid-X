"""
Test Audio Emotion Recognition
Demonstrates the pretrained model with synthetic audio samples
"""

import numpy as np
from pathlib import Path
import soundfile as sf
from train import AudioEmotionRecognizer

def generate_test_audio_files():
    """
    Generate synthetic test audio files for demonstration
    (sine waves at different frequencies representing different emotions)
    """
    print("\n🎵 Generating test audio files...")
    
    audio_dir = Path('audio_dataset')
    audio_dir.mkdir(exist_ok=True)
    
    # Audio parameters
    duration = 3  # seconds
    sample_rate = 16000  # Hz
    
    # Different frequencies for different emotions (simulated)
    emotions_freq = {
        'happy': 800,    # Higher frequency = happier
        'sad': 200,      # Lower frequency = sadder
        'angry': 600,    # Mid-high = angry
        'neutral': 400   # Mid-range = neutral
    }
    
    for emotion, frequency in emotions_freq.items():
        emotion_dir = audio_dir / emotion
        emotion_dir.mkdir(exist_ok=True)
        
        # Generate 2 samples per emotion
        for i in range(1, 3):
            t = np.linspace(0, duration, int(sample_rate * duration))
            
            # Generate sine wave
            audio = 0.5 * np.sin(2 * np.pi * frequency * t)
            
            # Add some variation
            audio += 0.1 * np.sin(2 * np.pi * (frequency * 0.5) * t)
            audio += 0.05 * np.random.normal(0, 0.1, len(audio))  # Add noise
            
            # Normalize
            audio = audio / np.max(np.abs(audio)) * 0.95
            
            # Save
            output_file = emotion_dir / f'{emotion}_{i}.wav'
            sf.write(str(output_file), audio, sample_rate)
            
            print(f"   ✅ {emotion}_{i}.wav ({frequency} Hz)")
    
    print(f"   📁 Created {len(emotions_freq) * 2} test audio files")
    return audio_dir

def run_emotion_recognition_test():
    """
    Test emotion recognition on generated audio files
    """
    print("\n" + "="*60)
    print("AUDIO EMOTION RECOGNITION TEST")
    print("="*60)
    
    # Step 1: Generate test audio
    audio_dir = generate_test_audio_files()
    
    # Step 2: Initialize recognizer
    print("\n🔄 Initializing Audio Emotion Recognizer...")
    recognizer = AudioEmotionRecognizer(
        model_name='superb/wav2vec2-base-superb-er',
        output_dir='models/audio'
    )
    
    # Step 3: Batch process audio files
    print("\n🧠 Processing audio files...")
    predictions = recognizer.batch_predict(str(audio_dir))
    
    # Step 4: Save and report results
    if predictions:
        recognizer.save_results('test_emotion_predictions.json')
        recognizer.create_emotion_report()
        
        # Step 5: Detailed analysis
        print("\n📊 DETAILED PREDICTIONS:")
        print("-" * 60)
        
        for idx, pred in enumerate(predictions, 1):
            print(f"\n{idx}. {pred['file']}")
            print(f"   🎯 Emotion: {pred['emotion'].upper()}")
            print(f"   📈 Confidence: {pred['confidence']*100:.2f}%")
            
            print(f"   All scores:")
            for score in pred['all_scores']:
                label = score.get('label', 'unknown')
                value = score.get('score', 0)
                bar_length = int(value * 30)
                bar = '█' * bar_length + '░' * (30 - bar_length)
                print(f"      {label:<10} [{bar}] {value*100:6.2f}%")
    
    print("\n" + "="*60)
    print("✅ TEST COMPLETE!")
    print("="*60)
    print(f"Results saved to: models/audio/test_emotion_predictions.json")

def test_single_file(file_path):
    """
    Test emotion recognition on a single file
    
    Usage:
        test_single_file('path/to/audio.wav')
    """
    print(f"\n🎧 Testing single file: {file_path}")
    
    recognizer = AudioEmotionRecognizer()
    prediction = recognizer.predict_emotion(file_path)
    
    if prediction:
        print(f"\n📊 Result:")
        print(f"   Emotion: {prediction['emotion'].upper()}")
        print(f"   Confidence: {prediction['confidence']*100:.2f}%")
    
    return prediction

if __name__ == '__main__':
    # Check if soundfile is available
    try:
        import soundfile as sf
    except ImportError:
        print("\n📦 Installing soundfile for audio generation...")
        import subprocess
        subprocess.run(['pip', 'install', 'soundfile'], check=True)
        import soundfile as sf
    
    # Run the test
    run_emotion_recognition_test()
    
    # Optional: Test individual file
    # example_file = 'audio_dataset/happy/happy_1.wav'
    # test_single_file(example_file)
