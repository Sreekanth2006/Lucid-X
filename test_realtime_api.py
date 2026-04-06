"""
Test the real-time audio emotion detection API
"""

import requests
import json
from pathlib import Path
import time

# Config
API_URL = "http://localhost:3000/api/emotion/audio"
TEST_AUDIO_DIR = Path("audio_dataset/neutral")

def test_emotion_detection():
    """Test single audio file emotion detection via API"""
    
    print("\n" + "="*60)
    print("TESTING REAL-TIME AUDIO EMOTION DETECTION API")
    print("="*60)
    
    # Find audio files
    audio_files = list(TEST_AUDIO_DIR.glob("*.wav"))
    
    if not audio_files:
        print(f"\n[ERROR] No audio files found in {TEST_AUDIO_DIR}")
        return False
    
    print(f"\n[INFO] Found {len(audio_files)} test audio files")
    print(f"[INFO] Testing API endpoint: {API_URL}")
    print(f"[INFO] Server is expected to be running on http://localhost:3000\n")
    
    success_count = 0
    
    for audio_file in audio_files[:3]:  # Test first 3 files
        print(f"\n[TEST] Sending: {audio_file.name}")
        
        try:
            # Open and send audio file
            with open(audio_file, 'rb') as f:
                files = {'audio': f}
                response = requests.post(API_URL, files=files, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get('success'):
                    emotion = result.get('emotion', 'UNKNOWN').upper()
                    confidence = result.get('confidence', 0)
                    conf_pct = round(confidence * 100, 2)
                    
                    print(f"[SUCCESS] Emotion: {emotion}")
                    print(f"[SUCCESS] Confidence: {conf_pct}%")
                    success_count += 1
                else:
                    print(f"[ERROR] API returned error: {result.get('error', 'Unknown error')}")
            else:
                print(f"[ERROR] HTTP {response.status_code}: {response.text[:100]}")
        
        except requests.exceptions.ConnectionError:
            print(f"[ERROR] Cannot connect to server at {API_URL}")
            print(f"[INFO] Make sure the server is running (node server.js)")
            return False
        except Exception as e:
            print(f"[ERROR] {type(e).__name__}: {e}")
        
        time.sleep(1)  # Wait 1 second between requests
    
    # Summary
    print("\n" + "="*60)
    print(f"RESULTS: {success_count}/{len(audio_files[:3])} tests passed")
    
    if success_count > 0:
        print("[SUCCESS] Real-time audio emotion detection API is WORKING!")
    else:
        print("[ERROR] API is not responding correctly")
    
    print("="*60 + "\n")
    
    return success_count > 0

if __name__ == "__main__":
    test_emotion_detection()
