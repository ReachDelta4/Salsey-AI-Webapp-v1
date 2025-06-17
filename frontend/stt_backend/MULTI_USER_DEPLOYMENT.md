# Multi-User Speech-to-Text Server Deployment Guide

This guide explains how to deploy and scale the multi-user real-time speech-to-text server system for production use. The system is designed to support multiple concurrent users, each with their own isolated speech recognition instance, and can be scaled across multiple GPUs.

## Architecture Overview

The multi-user STT system consists of several key components:

1. **WebSocket Server**: The main server that handles client connections, processes audio data, and returns transcriptions
2. **GPU Resource Monitor**: Manages GPU allocation and implements circuit breakers to prevent resource exhaustion
3. **Optimized STT Engine**: Whisper-based speech recognition optimized for real-time transcription
4. **Load Balancer** (for multi-node deployments): Distributes client connections across multiple server instances

## System Requirements

### Minimum Requirements (Single Server, ~15 Users)

- **CPU**: 8+ cores (Intel i7/i9 or AMD Ryzen 7/9)
- **RAM**: 16GB+
- **GPU**: NVIDIA RTX 3060 (12GB VRAM) or better
- **Storage**: 20GB+ SSD
- **Network**: 100Mbps+ with low latency
- **OS**: Ubuntu 20.04+ or Windows Server 2019+

### Recommended for 50+ Users (Multi-Server Deployment)

- **4+ Servers**, each with:
  - **CPU**: 16+ cores
  - **RAM**: 32GB+
  - **GPU**: NVIDIA RTX 4090 (24GB VRAM) or NVIDIA A10G (24GB VRAM)
  - **Storage**: 100GB+ SSD
  - **Network**: 1Gbps+ with low latency
- **Load Balancer**: HAProxy, NGINX, or cloud load balancer (AWS ALB, etc.)

## Single-Server Deployment

### 1. Install Dependencies

```bash
# Install Python dependencies
pip install RealtimeSTT faster-whisper websockets numpy

# Install NVIDIA CUDA toolkit for GPU support
# For Ubuntu:
sudo apt update
sudo apt install nvidia-cuda-toolkit
```

### 2. Configure the Server

Edit the configuration section in `realtime_stt_websocket_server.py`:

```python
# Create server with configurable connection limits
server = RealtimeSTTServer(
    host='0.0.0.0',  # Listen on all interfaces
    port=8012,       # WebSocket port
    max_connections=15,  # Limit based on your GPU capacity
    enable_gpu_monitoring=True
)
```

### 3. Start the Server

```bash
# Start the server
python realtime_stt_websocket_server.py

# Using screen or tmux for persistent sessions
screen -S stt_server
python realtime_stt_websocket_server.py
# Press Ctrl+A, D to detach

# Or using systemd (recommended for production)
# Create a systemd service file
```

## Multi-Server Deployment

For larger deployments (50+ users), you'll need multiple servers with a load balancer.

### 1. Set Up Multiple Server Instances

Install and configure the STT server on each machine as described above.

### 2. Configure Load Balancer (Example: NGINX)

```nginx
http {
    upstream stt_servers {
        # Important: Use IP hash for WebSocket connection stickiness
        ip_hash;
        
        # Add your server instances here
        server stt-server-1:8012;
        server stt-server-2:8012;
        server stt-server-3:8012;
        server stt-server-4:8012;
    }

    server {
        listen 80;
        server_name stt.yourdomain.com;

        location / {
            proxy_pass http://stt_servers;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            
            # WebSocket settings
            proxy_read_timeout 86400;
            proxy_send_timeout 86400;
        }
    }
}
```

### 3. Cloud Deployment (AWS Example)

For cloud deployments, you can use:

1. **EC2 instances** with GPU (g4dn.xlarge or g5.xlarge)
2. **Application Load Balancer** with WebSocket support
3. **Auto Scaling Group** to adjust capacity based on demand

## Monitoring and Management

### Resource Monitoring

The system includes built-in GPU resource monitoring. You can also add:

1. **Prometheus + Grafana**: For comprehensive monitoring
2. **Custom Health Check Endpoint**: Add a `/health` route for load balancer health checks

### Key Metrics to Monitor

- **Active Connections**: Number of concurrent users
- **GPU Memory Usage**: Per GPU and total
- **Transcription Latency**: Time from audio receipt to transcription
- **Error Rates**: Connection errors, processing errors, etc.

## Performance Tuning

### GPU Resource Allocation

Adjust these parameters in `gpu_monitor.py` based on your specific model and hardware:

```python
self.gpu_monitor = GPUMonitor(
    memory_threshold=85.0,  # VRAM usage threshold percentage
    memory_per_user=500,    # Estimated VRAM per user in MB
    reserve_memory=1000,    # Reserved VRAM in MB
    check_interval=10.0     # Monitoring interval in seconds
)
```

### Circuit Breaker Configuration

Adjust these parameters in the server to control error handling:

```python
# Circuit breaker threshold - disconnect clients after this many consecutive errors
MAX_CONSECUTIVE_ERRORS = 5
```

## Load Testing

Use the included `test_multi_user.py` script to test your deployment:

```bash
# Test with 50 simulated users, 5 connecting simultaneously
python test_multi_user.py --clients 50 --concurrent 5 --runtime 300
```

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check server is running and port is open
2. **WebSocket Connection Failures**: Check load balancer configuration
3. **Out of Memory Errors**: Reduce `max_connections` or increase `memory_per_user`
4. **High Latency**: Check network conditions, reduce batch size

### Checking Logs

```bash
# View the last 100 log entries
tail -n 100 /var/log/stt_server.log

# Monitor logs in real-time
tail -f /var/log/stt_server.log
```

## Security Considerations

1. **Add Authentication**: Implement token-based authentication for the WebSocket
2. **Use HTTPS**: Configure SSL/TLS on your load balancer
3. **Rate Limiting**: Implement connection and request rate limiting
4. **Input Validation**: Verify audio format and size before processing

## Conclusion

This multi-user STT server system provides a scalable solution for real-time speech-to-text transcription. By following this deployment guide, you can set up a robust system capable of handling dozens or even hundreds of concurrent users across multiple GPUs.

For further assistance, please contact the system administrator or refer to the code documentation.

---

## Appendix: Client Connection Example

Here's a simple example of how clients should connect to the server:

```javascript
// Browser WebSocket client example
const socket = new WebSocket('wss://your-stt-server.com/');

socket.onopen = () => {
  console.log('Connected to STT server');
  
  // Start sending audio
  startAudioCapture();
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'realtime') {
    // Handle real-time transcription updates
    console.log('Real-time:', data.text);
  } else if (data.type === 'completed') {
    // Handle completed transcription
    console.log('Completed:', data.text);
  } else if (data.type === 'error') {
    // Handle errors
    console.error('Error:', data.message);
  }
};

function sendAudio(audioChunk) {
  // Convert audio to base64
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioChunk)));
  
  // Send to server
  socket.send(JSON.stringify({
    type: 'audio',
    data: base64Audio,
    sample_rate: 16000
  }));
}
``` 