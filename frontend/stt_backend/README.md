# Real-time Speech-to-Text Server

This directory contains server configurations for real-time speech transcription using the RealtimeSTT framework, optimized for different hardware and language configurations.

## Available Server Configurations

### 1. CPU Optimized (English-only)
**File:** `start_stt_server_optimized_realtime.bat`

This configuration is optimized for CPU usage with the tiny Whisper model for English-only transcription. It's suitable for:
- Systems without a GPU
- Single-user or limited multi-user environments (1-3 users)
- English-only transcription needs
- Low-resource environments

### 2. GPU Optimized (Multilingual)
**File:** `start_stt_server_gpu_multilingual.bat`

This configuration is optimized for NVIDIA GPUs with the medium Whisper model for multilingual transcription, specifically tuned for:
- Hindi, English, and Telugu language support
- Multi-user environments (up to 15 users per GPU)
- Systems with NVIDIA GPUs (minimum 8GB VRAM recommended)
- Real-time transcription with lower latency

## Hardware Requirements

### CPU Mode
- **Minimum:** 4-core CPU (Intel i5-8250U or better)
- **Recommended:** 8-core CPU
- **RAM:** 8GB minimum, 16GB recommended
- **Disk Space:** 5GB for models and caching

### GPU Mode
- **GPU:** NVIDIA GPU with at least 8GB VRAM (RTX 3060 or better recommended)
- **CUDA:** CUDA 11.7+ and cuDNN installed
- **CPU:** 4+ cores
- **RAM:** 16GB minimum
- **Disk Space:** 10GB for models and caching

## Installation

1. Install the RealtimeSTT package:
   ```
   pip install RealtimeSTT
   ```

2. If using GPU mode, install CUDA and PyTorch with CUDA support:
   ```
   # For CUDA 11.8
   pip install torch==2.5.1+cu118 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu118

   # For CUDA 12.1
   pip install torch==2.5.1+cu121 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu121
   ```

## Usage

### Starting the Server

1. **CPU Mode (English-only):**
   ```
   start_stt_server_optimized_realtime.bat
   ```

2. **GPU Mode (Multilingual):**
   ```
   start_stt_server_gpu_multilingual.bat
   ```

The server will start on port 8012 and be accessible via WebSocket at `ws://localhost:8012`.

### Connecting to the Server

You can connect to the server using the included WebSocket client example or any WebSocket client that supports binary data transmission. See `realtime_stt_websocket_server.py` for the protocol details.

## Configuration Parameters Explained

### Key Parameters

- **model**: Size/type of Whisper model ('tiny', 'base', 'small', 'medium', 'large')
- **language**: Language code or 'auto' for language detection
- **compute_type**: Computation precision ('float32', 'float16', 'int8')
- **device**: Computation device ('cpu' or 'cuda')
- **batch_size**: How many audio segments to process at once
- **allowed_latency_limit**: Maximum allowed latency in milliseconds
- **silero_sensitivity**: Sensitivity for voice activity detection (0.0-1.0)

### CPU vs. GPU Optimization

The CPU and GPU configurations differ in several key ways:

1. **Model Size**: 
   - CPU uses 'tiny' for lower resource usage
   - GPU uses 'medium' for better accuracy

2. **Computation Type**: 
   - CPU uses 'int8' quantization for better performance
   - GPU uses 'float16' for better accuracy while maintaining performance

3. **Batch Size**: 
   - CPU uses smaller batch sizes (1)
   - GPU uses larger batch sizes (16) to leverage parallel processing

4. **Real-time Processing**: 
   - GPU has more aggressive real-time processing settings
   - CPU has more conservative settings to prevent overload

## Troubleshooting

### Common Issues

1. **"CUDA not available" error**:
   - Ensure NVIDIA drivers are up to date
   - Verify CUDA and PyTorch with CUDA are correctly installed
   - Check `nvidia-smi` command works in your terminal

2. **High CPU usage**:
   - Reduce batch_size parameter
   - Consider using a smaller model
   - Set OMP_NUM_THREADS to match your core count

3. **Delayed transcription**:
   - Adjust allowed_latency_limit to a higher value
   - Check your system for other resource-intensive processes

4. **Memory errors**:
   - Reduce batch size
   - Use a smaller model
   - Use int8 quantization instead of float16

## Multi-User Setup

For information on deploying this server for multiple users, please see the `MULTI_USER_DEPLOYMENT.md` file in this directory.

## Language Support

- **English-only mode** (tiny.en model): Optimized for English speech recognition
- **Multilingual mode** (medium model): Supports 100+ languages with specific optimizations for Hindi, English, and Telugu through the initial prompt

## Credits

Based on the RealtimeSTT library by Kolja Beigel: https://github.com/KoljaB/RealtimeSTT 