# Optimized RealtimeSTT for CPU

This package provides an optimized configuration for running RealtimeSTT on CPU with real-time transcription capabilities. It is specifically tuned for systems with limited resources, such as Intel i5 processors with 8GB RAM.

## Files Overview

- `start_stt_server_optimized_realtime.bat` - Optimized batch file for starting the STT server with real-time transcription
- `optimized_realtime_stt.py` - Python module with optimized STT configuration
- `realtime_stt_websocket_server.py` - WebSocket server implementation for real-time STT
- `test_stt_client.py` - Test client for connecting to the WebSocket server

## Key Optimizations

1. **CPU Threading Control**
   - Limited thread usage to prevent resource contention
   - `OMP_NUM_THREADS=2`, `MKL_NUM_THREADS=2`, `NUMEXPR_MAX_THREADS=2`

2. **Aggressive Latency Control**
   - `allowed_latency_limit=15` - Very strict limit to prevent audio queue overflow
   - `realtime_processing_pause=0.005` - Frequent real-time updates
   - `handle_buffer_overflow=True` - Properly handles overflows

3. **Memory Management**
   - Uses a single model for both real-time and final transcription
   - `use_main_model_for_realtime=True`
   - Minimal batch sizes: `batch_size=1`, `realtime_batch_size=1`

4. **VAD Configuration**
   - Optimized Silero VAD settings: `silero_sensitivity=0.4`
   - Uses ONNX for faster processing: `silero_use_onnx=True`
   - Disabled problematic VAD filter: Removed `faster_whisper_vad_filter`

5. **Fast Response Times**
   - Short minimum recording: `min_length_of_recording=0.05`
   - Quick gap between recordings: `min_gap_between_recordings=0.05`
   - Fast post-speech silence: `post_speech_silence_duration=0.2`

## Usage Instructions

### Running the Server

#### Option 1: Using the Batch File

Simply run the batch file to start the server with optimized settings:

```bash
.\start_stt_server_optimized_realtime.bat
```

#### Option 2: Using Python Directly

Run the standalone Python implementation:

```bash
python optimized_realtime_stt.py
```

#### Option 3: Running the WebSocket Server

Start the WebSocket server for network clients:

```bash
python realtime_stt_websocket_server.py
```

### Testing the WebSocket Server

You can test the WebSocket server using the provided test client:

```bash
# Stream from microphone
python test_stt_client.py

# Stream from an audio file
python test_stt_client.py --file path/to/audio.wav
```

## WebSocket API

The WebSocket server accepts the following message types:

1. **Audio Data**
   ```json
   {
     "type": "audio",
     "data": "base64-encoded-audio-data",
     "sample_rate": 16000
   }
   ```

2. **Commands**
   ```json
   {
     "type": "command",
     "command": "start|stop|clear"
   }
   ```

The server responds with:

1. **Real-time Transcription**
   ```json
   {
     "type": "realtime",
     "text": "Partial transcription text..."
   }
   ```

2. **Completed Transcription**
   ```json
   {
     "type": "completed",
     "text": "Final transcription text."
   }
   ```

3. **Status Updates**
   ```json
   {
     "type": "status",
     "status": "recording_started|recording_stopped|cleared"
   }
   ```

## Troubleshooting

If you still encounter audio queue overflow issues:

1. Further reduce `allowed_latency_limit` to 10
2. Increase `OMP_NUM_THREADS` and other thread settings if you have more cores
3. Use an even smaller model (like `tiny` instead of `tiny.en`) 
4. Disable real-time transcription completely for final-only transcription
5. Consider upgrading your hardware for better performance

## System Requirements

- Python 3.8+
- PyAudio
- RealtimeSTT 0.3.104+
- Faster-Whisper 1.1.1+
- WebSockets library (for WebSocket server and client)
- NumPy 