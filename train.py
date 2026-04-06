"""
Lucid-X: Audio Emotion Recognition with Pretrained Models
===========================================================

Audio emotion recognition using pretrained wav2vec2 model.
No dataset needed - uses HuggingFace pretrained models.

Features:
- Automatic speech emotion recognition from audio files
- wav2vec2 feature extraction + emotion classifier
- Direct inference without training
- Support for wav/mp3 audio files
- Real-time emotion prediction
- Batch processing capabilities

Requirements:
    pip install transformers torch librosa

Author: Lucid-X Development Team
Date: 2024
"""

import os
import json
import numpy as np
from pathlib import Path
from datetime import datetime
import warnings
import argparse
import sys
warnings.filterwarnings('ignore')

# Audio processing
import librosa
import librosa.display

# Deep Learning & Transformers
import torch
from transformers import pipeline, Wav2Vec2Processor, Wav2Vec2Model, AutoModelForAudioClassification

# Visualization
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, classification_report
import seaborn as sns


class AudioEmotionRecognizer:
    """
    Audio emotion recognition using pretrained wav2vec2 model
    No training needed - uses HuggingFace pretrained models
    """
    
    def __init__(self, model_name='superb/wav2vec2-base-superb-er', output_dir='models/audio'):
        """
        Initialize audio emotion recognizer with pretrained model
        
        Args:
            model_name (str): HuggingFace model identifier
            output_dir (str): Directory to save logs and results
        """
        self.model_name = model_name
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load pretrained model
        print(f"[LOAD] Loading pretrained model: {model_name}")
        self.pipe = pipeline("audio-classification", model=model_name)
        
        # Emotion mapping
        self.emotion_labels = ['neutral', 'happy', 'sad', 'angry']
        self.label_mapping = {label: idx for idx, label in enumerate(self.emotion_labels)}
        self.reverse_mapping = {idx: label for label, idx in self.label_mapping.items()}
        
        # Results storage
        self.predictions = []
        self.feature_cache = {}
        
        print("[OK] Audio Emotion Recognizer initialized")
        print(f"   Model: {model_name}")
        print(f"   Output dir: {self.output_dir}")
        print(f"   Emotions: {', '.join(self.emotion_labels)}")
    
    def load_audio(self, audio_path, target_sr=16000):
        """
        Load audio file using librosa
        
        Args:
            audio_path (str): Path to audio file
            target_sr (int): Target sampling rate
            
        Returns:
            tuple: (audio, sr) - audio waveform and sampling rate
        """
        print(f"[AUDIO] Loading audio: {audio_path}")
        
        try:
            audio, sr = librosa.load(audio_path, sr=target_sr)
            print(f"[OK] Loaded successfully")
            print(f"[INFO] Duration: {len(audio)/sr:.2f}s")
            print(f"[INFO] Sampling rate: {sr} Hz")
            return audio, sr
        except Exception as e:
            print(f"[ERROR] Error loading audio: {e}")
            return None, None
    
    def predict_emotion(self, audio_path):
        """
        Predict emotion from audio file using librosa for loading
        
        Args:
            audio_path (str): Path to audio file
            
        Returns:
            dict: Prediction result with emotion and confidence
        """
        print(f"[PREDICT] Predicting emotion from: {Path(audio_path).name}")
        
        try:
            # Load audio using librosa
            audio, sr = librosa.load(audio_path, sr=16000)
            
            # Process through pipeline
            outputs = self.pipe(audio)
            
            # Get top prediction
            top_result = outputs[0] if isinstance(outputs, list) else outputs
            emotion = top_result.get('label', 'unknown')
            confidence = top_result.get('score', 0.0)
            
            prediction = {
                'file': Path(audio_path).name,
                'emotion': emotion,
                'confidence': confidence,
                'timestamp': datetime.now().isoformat(),
                'all_scores': outputs if isinstance(outputs, list) else [outputs]
            }
            
            self.predictions.append(prediction)
            
            print(f"[RESULT] Emotion: {emotion.upper()}")
            print(f"[RESULT] Confidence: {confidence*100:.2f}%")
            
            return prediction
            
        except Exception as e:
            print(f"[ERROR] Error during prediction: {e}")
            return None
    
    def batch_predict(self, audio_dir):
        """
        Process multiple audio files from directory
        
        Args:
            audio_dir (str): Directory containing audio files
            
        Returns:
            list: List of predictions
        """
        print(f"\n📂 Batch processing audio files from: {audio_dir}")
        
        audio_dir = Path(audio_dir)
        audio_extensions = ['.wav', '.mp3', '.ogg', '.flac']
        audio_files = []
        
        for ext in audio_extensions:
            audio_files.extend(audio_dir.glob(f'*{ext}'))
            audio_files.extend(audio_dir.glob(f'**/*{ext}'))
        
        audio_files = list(set(audio_files))
        print(f"   Found {len(audio_files)} audio files")
        
        batch_predictions = []
        for idx, audio_file in enumerate(audio_files, 1):
            print(f"\n   [{idx}/{len(audio_files)}] Processing {audio_file.name}")
            prediction = self.predict_emotion(str(audio_file))
            if prediction:
                batch_predictions.append(prediction)
        
        return batch_predictions
    
    def extract_features(self, audio_path):
        """
        Extract wav2vec2 features from audio
        
        Args:
            audio_path (str): Path to audio file
            
        Returns:
            torch.Tensor: Feature embeddings
        """
        print(f"\n🔬 Extracting features from: {Path(audio_path).name}")
        
        try:
            # Load audio
            audio, sr = librosa.load(audio_path, sr=16000)
            
            # Load processor and model
            processor = Wav2Vec2Processor.from_pretrained(self.model_name)
            model = Wav2Vec2Model.from_pretrained(self.model_name)
            
            # Process audio
            inputs = processor(audio, sampling_rate=16000, return_tensors="pt")
            
            # Extract features
            with torch.no_grad():
                outputs = model(**inputs)
                features = outputs.last_hidden_state
            
            print(f"   ✅ Features extracted")
            print(f"      Shape: {features.shape}")
            
            # Cache features
            self.feature_cache[Path(audio_path).name] = features.numpy()
            
            return features
            
        except Exception as e:
            print(f"   ❌ Error extracting features: {e}")
            return None
    
    def save_results(self, filename='emotion_predictions.json'):
        """
        Save prediction results to JSON
        
        Args:
            filename (str): Output filename
        """
        output_path = self.output_dir / filename
        
        # Convert results for JSON serialization
        results_serializable = []
        for pred in self.predictions:
            pred_copy = pred.copy()
            pred_copy['all_scores'] = [
                {'label': s.get('label', 'unknown'), 'score': float(s.get('score', 0))}
                for s in pred['all_scores']
            ]
            pred_copy['confidence'] = float(pred_copy['confidence'])
            results_serializable.append(pred_copy)
        
        with open(output_path, 'w') as f:
            json.dump(results_serializable, f, indent=2)
        
        print(f"\n💾 Results saved to: {output_path}")
    
    def create_emotion_report(self):
        """
        Create a summary report of predictions
        """
        if not self.predictions:
            print("No predictions to report")
            return
        
        print("\n📊 Emotion Prediction Report")
        print("=" * 50)
        print(f"Total files processed: {len(self.predictions)}")
        
        # Emotion distribution
        emotion_counts = {}
        emotion_confidences = {}
        for pred in self.predictions:
            emotion = pred['emotion']
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
            if emotion not in emotion_confidences:
                emotion_confidences[emotion] = []
            emotion_confidences[emotion].append(pred['confidence'])
        
        print("\nEmotion Distribution:")
        for emotion, count in sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / len(self.predictions)) * 100
            avg_confidence = np.mean(emotion_confidences[emotion])
            print(f"  {emotion.upper():<10} - {count:>3} files ({percentage:>5.1f}%) | Avg Confidence: {avg_confidence*100:.2f}%")
        
        # Overall average confidence
        all_confidences = [pred['confidence'] for pred in self.predictions]
        avg_confidence = np.mean(all_confidences)
        print(f"\nAverage Confidence: {avg_confidence*100:.2f}%")
    
    def load_dataset(self):
        """
        Load dataset from directory structure
        Assumes structure: dataset/emotion_label/image_files.jpg
        
        Returns:
            tuple: (X, y) - images and labels
        """
        print("\n📂 Loading dataset...")
        
        images = []
        labels = []
        
        # Get emotion folders
        if not self.dataset_path.exists():
            raise FileNotFoundError(f"Dataset path not found: {self.dataset_path}")
        
        emotion_dirs = [d for d in self.dataset_path.iterdir() if d.is_dir()]
        
        if not emotion_dirs:
            raise FileNotFoundError(f"No emotion folders found in {self.dataset_path}")
        
        # Create label mapping from folder names
        for idx, emotion_dir in enumerate(sorted(emotion_dirs)):
            emotion = emotion_dir.name
            self.emotion_labels.append(emotion)
            self.label_mapping[emotion] = idx
            self.reverse_mapping[idx] = emotion
            print(f"   [{idx}] {emotion}")
        
        # Load images
        for emotion_idx, emotion_dir in enumerate(sorted(emotion_dirs)):
            emotion = emotion_dir.name
            image_files = list(emotion_dir.glob('*.jpg')) + list(emotion_dir.glob('*.png'))
            
            print(f"\n   Loading {emotion}... ({len(image_files)} images)")
            
            for img_path in image_files:
                try:
                    # Read image in grayscale
                    img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
                    
                    if img is None:
                        print(f"      ⚠️  Failed to load {img_path.name}")
                        continue
                    
                    # Resize to target size
                    img = cv2.resize(img, self.img_size)
                    
                    images.append(img)
                    labels.append(emotion_idx)
                    
                except Exception as e:
                    print(f"      ⚠️  Error loading {img_path.name}: {e}")
        
        # Convert to numpy arrays
        X = np.array(images, dtype='float32')
        y = np.array(labels, dtype='int32')
        
        # Normalize pixel values (0-1)
        X = X / 255.0
        
        print(f"\n✅ Dataset loaded!")
        print(f"   Total images: {len(X)}")
        print(f"   Image shape: {X.shape}")
        print(f"   Label shape: {y.shape}")
        print(f"   Classes: {len(self.emotion_labels)}")
        
        return X, y
    
    def preprocess_and_split(self, X, y):
        """
        Preprocess data and split into train/validation/test
        
        Args:
            X: Images
            y: Labels
        """
        print("\n🔄 Preprocessing and splitting data...")
        
        # Add channel dimension if needed
        if len(X.shape) == 3:
            X = np.expand_dims(X, axis=-1)
            print(f"   Added channel dimension: {X.shape}")
        
        # Shuffle dataset
        indices = np.random.permutation(len(X))
        X = X[indices]
        y = y[indices]
        
        # Split into train and test (80/20)
        split_point = int(len(X) * 0.8)
        X_train_full = X[:split_point]
        y_train_full = y[:split_point]
        X_test = X[split_point:]
        y_test = y[split_point:]
        
        # Split train into train/val (80/20 of train data = 64/16 overall)
        val_split = int(len(X_train_full) * 0.2)
        X_train = X_train_full[:-val_split]
        y_train = y_train_full[:-val_split]
        X_val = X_train_full[-val_split:]
        y_val = y_train_full[-val_split:]
        
        print(f"   Training set: {len(X_train)} images")
        print(f"   Validation set: {len(X_val)} images")
        print(f"   Test set: {len(X_test)} images")
        
        self.X_train = X_train
        self.y_train = y_train
        self.X_val = X_val
        self.y_val = y_val
        self.X_test = X_test
        self.y_test = y_test
    
    def apply_data_augmentation(self):
        """
        Create augmented dataset for training
        Augmentations: rotation, zoom, horizontal flip, brightness
        """
        print("\n🎨 Applying data augmentation...")
        
        augmentor = ImageDataGenerator(
            rotation_range=20,        # Random rotation ±20°
            zoom_range=0.2,           # Random zoom up to 20%
            horizontal_flip=True,     # Random horizontal flip
            brightness_range=[0.8, 1.2],  # Brightness variation
            fill_mode='nearest'
        )
        
        # For training data, we'll use on-the-fly augmentation during training
        # Real-time augmentation will happen during model.fit()
        
        print("   ✅ Augmentation configured for on-the-fly generation")
        return augmentor
    
    def build_cnn_model(self):
        """
        Build CNN architecture optimized for emotion recognition
        
        Architecture:
        - Conv2D → ReLU → MaxPooling (3 blocks)
        - Dropout for regularization
        - Dense layers with ReLU
        - Softmax output for 7 emotions
        
        Returns:
            keras.Model: Compiled model
        """
        print("\n🏗️  Building CNN model...")
        
        num_emotions = len(self.emotion_labels)
        input_shape = (self.img_size[0], self.img_size[1], 1)
        
        model = models.Sequential([
            # Block 1
            layers.Conv2D(32, (3, 3), activation='relu', input_shape=input_shape),
            layers.BatchNormalization(),
            layers.MaxPooling2D((2, 2)),
            layers.Dropout(0.25),
            
            # Block 2
            layers.Conv2D(64, (3, 3), activation='relu'),
            layers.BatchNormalization(),
            layers.MaxPooling2D((2, 2)),
            layers.Dropout(0.25),
            
            # Block 3
            layers.Conv2D(128, (3, 3), activation='relu'),
            layers.BatchNormalization(),
            layers.MaxPooling2D((2, 2)),
            layers.Dropout(0.25),
            
            # Global Average Pooling
            layers.GlobalAveragePooling2D(),
            
            # Dense layers
            layers.Dense(256, activation='relu'),
            layers.BatchNormalization(),
            layers.Dropout(0.5),
            
            layers.Dense(128, activation='relu'),
            layers.BatchNormalization(),
            layers.Dropout(0.5),
            
            # Output layer
            layers.Dense(num_emotions, activation='softmax')
        ])
        
        # Compile model
        optimizer = Adam(learning_rate=0.001)
        model.compile(
            optimizer=optimizer,
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        
        print("✅ Model built successfully!")
        model.summary()
        
        self.model = model
        return model
    
    def train_model(self):
        """
        Train the model with callbacks and data augmentation
        """
        print("\n🚀 Starting training...")
        
        if self.model is None:
            raise RuntimeError("Model not built. Call build_cnn_model() first.")
        
        # Data augmentation for training
        train_augmentor = ImageDataGenerator(
            rotation_range=25,
            zoom_range=0.2,
            horizontal_flip=True,
            brightness_range=[0.8, 1.2],
            width_shift_range=0.1,
            height_shift_range=0.1,
            fill_mode='nearest',
            rescale=1./255  # Already normalized but reassure
        )
        
        # Callbacks
        callbacks = [
            # Early stopping if validation loss stops improving
            EarlyStopping(
                monitor='val_loss',
                patience=15,
                restore_best_weights=True,
                verbose=1
            ),
            
            # Save best model
            ModelCheckpoint(
                str(self.output_dir / 'best_model.h5'),
                monitor='val_accuracy',
                save_best_only=True,
                mode='max',
                verbose=1
            ),
            
            # Reduce learning rate on plateau
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=5,
                min_lr=1e-7,
                verbose=1
            )
        ]
        
        # Generate batches with augmentation
        train_generator = train_augmentor.flow(
            self.X_train, self.y_train,
            batch_size=self.batch_size,
            shuffle=True
        )
        
        # Train model
        self.history = self.model.fit(
            train_generator,
            steps_per_epoch=len(self.X_train) // self.batch_size,
            epochs=self.epochs,
            validation_data=(self.X_val, self.y_val),
            callbacks=callbacks,
            verbose=1
        )
        
        print("\n✅ Training completed!")
        return self.history
    


# =============================================
# MAIN EXECUTION - AUDIO EMOTION RECOGNITION
# =============================================

if __name__ == '__main__':
    """
    Audio Emotion Recognition using Pretrained Models
    
    No training needed - direct inference on audio files
    
    Usage:
        # Single file prediction (for API)
        python train.py --audio path/to/audio.wav
        
        # Batch processing
        python train.py --batch audio_dataset/
        
        # Default (test mode)
        python train.py
    """
    
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Lucid-X Audio Emotion Recognition')
    parser.add_argument('--audio', type=str, help='Path to single audio file for prediction')
    parser.add_argument('--batch', type=str, help='Directory for batch processing')
    args = parser.parse_args()
    
    print("\n" + "="*60)
    print("LUCID-X: AUDIO EMOTION RECOGNITION")
    print("Using Pretrained wav2vec2 Model")
    print("="*60)
    
    # Initialize recognizer with pretrained model
    recognizer = AudioEmotionRecognizer(
        model_name='superb/wav2vec2-base-superb-er',
        output_dir='models/audio'
    )
    
    # Single file prediction (for API/Server integration)
    if args.audio:
        print(f"[PROCESS] Processing single audio file: {args.audio}")
        if not os.path.exists(args.audio):
            print(f"[ERROR] File not found: {args.audio}")
            sys.exit(1)
        
        prediction = recognizer.predict_emotion(args.audio)
        
        if prediction:
            # Output JSON for API consumption
            output = {
                'emotion': prediction['emotion'],
                'confidence': prediction['confidence'],
                'all_scores': prediction['all_scores']
            }
            print(json.dumps(output))
            sys.exit(0)
        else:
            print(json.dumps({'emotion': 'ERROR', 'confidence': 0, 'error': 'Processing failed'}))
            sys.exit(1)
    
    # Batch processing
    elif args.batch:
        print(f"[BATCH] Batch processing directory: {args.batch}")
        predictions = recognizer.batch_predict(args.batch)
        
        if predictions:
            recognizer.save_results()
            recognizer.create_emotion_report()
        sys.exit(0)
    
    # Default: Test mode
    else:
        # Quick test with audio_dataset if available
        audio_dir = Path('audio_dataset')
        if audio_dir.exists():
            print(f"[FOUND] Found audio_dataset directory")
            predictions = recognizer.batch_predict(str(audio_dir))
            
            if predictions:
                recognizer.save_results()
                recognizer.create_emotion_report()
        else:
            print(f"[INFO] audio_dataset not found")
            print("   To use:")
            print("   1. Add audio files (.wav, .mp3) to audio_dataset/")
            print("   2. Or test with single file:")
            print("      python train.py --audio path/to/audio.wav")
    
    print("\n" + "="*60)
    print("[SUCCESS] AUDIO EMOTION RECOGNITION READY")
    print("="*60)
