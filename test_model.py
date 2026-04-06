"""
Lucid-X: Model Testing & Evaluation Utility

Quick script to test trained emotion model on single images or real-time webcam

Usage:
    python test_model.py --mode single --image path/to/image.jpg
    python test_model.py --mode webcam
    python test_model.py --mode benchmark --dataset dataset/
"""

import os
import json
import argparse
import numpy as np
import cv2
from pathlib import Path

# TensorFlow
import tensorflow as tf
from tensorflow.keras.models import load_model


class ModelTester:
    """Test and evaluate trained emotion recognition model"""
    
    def __init__(self, model_path, metadata_path):
        """
        Load model and metadata
        
        Args:
            model_path: Path to emotion_model.h5
            metadata_path: Path to label_mapping.json
        """
        print(f"📦 Loading model from {model_path}...")
        self.model = load_model(model_path)
        
        print(f"📄 Loading metadata from {metadata_path}...")
        with open(metadata_path, 'r') as f:
            self.metadata = json.load(f)
        
        self.emotions = self.metadata['emotions']
        self.img_size = tuple(self.metadata['image_size'])
        
        print(f"✅ Model loaded!")
        print(f"   Emotions: {self.emotions}")
        print(f"   Input size: {self.img_size}")
    
    def predict_image(self, image_path):
        """
        Predict emotion for single image
        
        Args:
            image_path: Path to image file
            
        Returns:
            dict: Prediction results
        """
        # Load image
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            print(f"❌ Failed to load image: {image_path}")
            return None
        
        # Resize
        img = cv2.resize(img, self.img_size)
        
        # Normalize
        img = img.astype('float32') / 255.0
        
        # Add dimensions
        img_batch = np.expand_dims(np.expand_dims(img, axis=0), axis=-1)
        
        # Predict
        prediction = self.model.predict(img_batch, verbose=0)
        emotion_scores = prediction[0]
        
        # Get dominant emotion
        dominant_idx = np.argmax(emotion_scores)
        dominant_emotion = self.emotions[dominant_idx]
        confidence = emotion_scores[dominant_idx]
        
        return {
            'image': image_path,
            'emotion': dominant_emotion,
            'confidence': float(confidence),
            'all_emotions': {
                emotion: float(score)
                for emotion, score in zip(self.emotions, emotion_scores)
            },
            'sorted_emotions': sorted(
                zip(self.emotions, emotion_scores),
                key=lambda x: x[1],
                reverse=True
            )
        }
    
    def predict_webcam(self, duration=30):
        """
        Real-time prediction from webcam
        
        Args:
            duration: How long to run (seconds)
        """
        print("🎥 Starting webcam prediction...")
        print("   Press 'q' to quit")
        
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            print("❌ Failed to open webcam")
            return
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        print(f"   FPS: {fps}, Resolution: {width}x{height}")
        
        frame_count = 0
        emotion_counts = {e: 0 for e in self.emotions}
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Convert to grayscale
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Detect face (simple bounding box for demo)
            # TODO: Use face detector here for real implementation
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)
            
            emotion_text = "No face detected"
            confidence_text = ""
            
            if len(faces) > 0:
                # Get largest face
                x, y, w, h = max(faces, key=lambda f: f[2]*f[3])
                
                # Extract face region
                face_img = gray[y:y+h, x:x+w]
                face_img = cv2.resize(face_img, self.img_size)
                
                # Predict
                face_img_norm = face_img.astype('float32') / 255.0
                face_batch = np.expand_dims(np.expand_dims(face_img_norm, axis=0), axis=-1)
                
                prediction = self.model.predict(face_batch, verbose=0)
                emotion_scores = prediction[0]
                
                dominant_idx = np.argmax(emotion_scores)
                emotion = self.emotions[dominant_idx]
                confidence = emotion_scores[dominant_idx]
                
                emotion_text = f"Emotion: {emotion.upper()}"
                confidence_text = f"Confidence: {confidence*100:.1f}%"
                
                emotion_counts[emotion] += 1
                
                # Draw bounding box
                cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
                cv2.putText(frame, emotion_text, (x, y-30),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                cv2.putText(frame, confidence_text, (x, y-5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            # Display frame
            cv2.imshow('Emotion Detection', frame)
            
            frame_count += 1
            if (frame_count % 30) == 0:
                print(f"   Frame {frame_count}: {emotion_text} {confidence_text}")
            
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        
        cap.release()
        cv2.destroyAllWindows()
        
        print(f"\n✅ Webcam session ended")
        print(f"   Total frames: {frame_count}")
        print(f"   Emotion Distribution:")
        for emotion, count in emotion_counts.items():
            if count > 0:
                pct = (count / frame_count) * 100
                print(f"      {emotion}: {count} ({pct:.1f}%)")
    
    def benchmark_dataset(self, dataset_path):
        """
        Evaluate model on entire dataset
        
        Args:
            dataset_path: Path to dataset directory
        """
        print(f"📊 Benchmarking on dataset: {dataset_path}")
        
        dataset_path = Path(dataset_path)
        
        results = {}
        total_correct = 0
        total_images = 0
        
        for emotion_dir in sorted(dataset_path.iterdir()):
            if not emotion_dir.is_dir():
                continue
            
            emotion = emotion_dir.name
            image_files = list(emotion_dir.glob('*.jpg')) + list(emotion_dir.glob('*.png'))
            
            if len(image_files) == 0:
                continue
            
            correct = 0
            scores = {e: [] for e in self.emotions}
            
            print(f"\n   Testing {emotion}...")
            
            for img_path in image_files:
                prediction_result = self.predict_image(str(img_path))
                if prediction_result is None:
                    continue
                
                # Check if prediction is correct
                if prediction_result['emotion'] == emotion:
                    correct += 1
                
                # Track scores
                for e, score in prediction_result['all_emotions'].items():
                    scores[e].append(score)
                
                total_images += 1
            
            accuracy = (correct / len(image_files)) * 100 if image_files else 0
            total_correct += correct
            
            results[emotion] = {
                'accuracy': accuracy,
                'correct': correct,
                'total': len(image_files),
                'avg_score': np.mean(scores[emotion]) if scores[emotion] else 0
            }
            
            print(f"      Accuracy: {accuracy:.1f}% ({correct}/{len(image_files)})")
        
        # Overall accuracy
        overall_accuracy = (total_correct / total_images) * 100 if total_images > 0 else 0
        
        print(f"\n{'='*50}")
        print(f"BENCHMARK RESULTS")
        print(f"{'='*50}")
        print(f"Total Images: {total_images}")
        print(f"Overall Accuracy: {overall_accuracy:.2f}%")
        print(f"\nPer-Emotion Accuracy:")
        for emotion, result in results.items():
            print(f"   {emotion}: {result['accuracy']:.1f}%")
        
        return results


def main():
    parser = argparse.ArgumentParser(description='Lucid-X Model Tester')
    parser.add_argument('--model', type=str, default='models/custom/emotion_model.h5',
                       help='Path to trained model')
    parser.add_argument('--metadata', type=str, default='models/custom/label_mapping.json',
                       help='Path to metadata JSON')
    parser.add_argument('--mode', type=str, choices=['single', 'webcam', 'benchmark'],
                       default='webcam', help='Test mode')
    parser.add_argument('--image', type=str, help='Image path (for single mode)')
    parser.add_argument('--dataset', type=str, default='dataset/',
                       help='Dataset path (for benchmark mode)')
    
    args = parser.parse_args()
    
    # Load model
    tester = ModelTester(args.model, args.metadata)
    
    # Run test
    if args.mode == 'single':
        if not args.image:
            print("❌ --image argument required for single mode")
            return
        
        result = tester.predict_image(args.image)
        if result:
            print(f"\n{'='*50}")
            print(f"PREDICTION: {result['emotion'].upper()}")
            print(f"Confidence: {result['confidence']*100:.2f}%")
            print(f"\nAll Emotions:")
            for emotion, score in result['sorted_emotions']:
                bar_length = int(score * 40)
                bar = '█' * bar_length
                print(f"   {emotion:12s} {score*100:6.2f}% {bar}")
            print(f"{'='*50}")
    
    elif args.mode == 'webcam':
        tester.predict_webcam()
    
    elif args.mode == 'benchmark':
        tester.benchmark_dataset(args.dataset)


if __name__ == '__main__':
    main()
