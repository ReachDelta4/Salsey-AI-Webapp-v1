@echo off
echo Starting RealtimeSTT Server with GPU-optimized multilingual transcription...
echo Configuration optimized for NVIDIA GPUs with Whisper Turbo model supporting multiple languages.
echo Model: Whisper Turbo (multilingual, high-performance)

REM Set environment variables for CUDA optimization
set CUDA_VISIBLE_DEVICES=0
set PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512

stt-server ^
  --model turbo ^
  --language auto ^
  --compute_type float16 ^
  --device cuda ^
  --batch_size 16 ^
  --realtime_batch_size 8 ^
  --allowed_latency_limit 120 ^
  --silero_sensitivity 0.5 ^
  --silero_deactivity_detection ^
  --silero_use_onnx ^
  --webrtc_sensitivity 2 ^
  --min_length_of_recording 0.1 ^
  --min_gap_between_recordings 0.1 ^
  --realtime_processing_pause 0.05 ^
  --init_realtime_after_seconds 0.05 ^
  --beam_size 3 ^
  --beam_size_realtime 2 ^
  --handle_buffer_overflow ^
  --use_main_model_for_realtime ^
  --early_transcription_on_silence 150 ^
  --suppress_tokens -1 ^
  --initial_prompt "This transcription may include various languages like Hindi, English, and Telugu. Proper nouns are capitalized." ^
  --enable_realtime_transcription 

echo.
echo If you see any errors, make sure:
echo 1. CUDA and cuDNN are properly installed
echo 2. Your GPU has at least 8GB VRAM (for Turbo model)
echo 3. You have the latest NVIDIA drivers