import os
import json
import base64
import asyncio
import logging
import traceback
import time
import websockets
import numpy as np
from optimized_realtime_stt import create_optimized_realtime_stt
from gpu_monitor import GPUMonitor

# Set CPU threading limits
os.environ['OMP_NUM_THREADS'] = '2'
os.environ['MKL_NUM_THREADS'] = '2'
os.environ['NUMEXPR_MAX_THREADS'] = '2'

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('realtime_stt_server')

class RealtimeSTTServer:
    def __init__(self, host='0.0.0.0', port=8012, max_connections=50, connection_timeout=30, 
                enable_gpu_monitoring=True):
        self.host = host
        self.port = port
        # Resource management settings
        self.max_connections = max_connections
        self.connection_timeout = connection_timeout
        self.active_connections = 0
        self.connection_semaphore = asyncio.Semaphore(max_connections)
        # Stats tracking
        self.connection_stats = {
            'total_connections': 0,
            'failed_connections': 0,
            'active_connections': 0,
        }
        
        # GPU monitoring
        self.enable_gpu_monitoring = enable_gpu_monitoring
        if self.enable_gpu_monitoring:
            self.gpu_monitor = GPUMonitor(
                memory_threshold=85.0,  # 85% VRAM usage triggers warnings
                memory_per_user=500,    # 500 MB per user (conservative estimate)
                reserve_memory=1000,    # Keep 1 GB in reserve
                check_interval=10.0     # Check every 10 seconds
            )
        else:
            self.gpu_monitor = None
        
    async def start_server(self):
        """Start the WebSocket server with proper error handling"""
        try:
            # Start GPU monitoring if enabled
            if self.enable_gpu_monitoring and self.gpu_monitor:
                await self.gpu_monitor.start_monitoring()
                logger.info("GPU monitoring started")
            
            server = await websockets.serve(
                self._wrapped_handle_client, 
            self.host, 
                self.port,
                ping_interval=20,  # Keep connections alive
                ping_timeout=30,   # Detect stale connections
        )
        logger.info(f"Server started on ws://{self.host}:{self.port}")
            return server
        except Exception as e:
            logger.critical(f"Failed to start server: {e}")
            # Re-raise to allow proper handling by the caller
            raise
            
    async def _wrapped_handle_client(self, websocket, path):
        """Wrapper around handle_client with connection limiting and error isolation"""
        client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        
        # Try to acquire a connection slot
        acquired = False
        try:
            # Set a timeout for acquiring a connection
            acquire_task = asyncio.create_task(self.connection_semaphore.acquire())
            try:
                # Wait for either the semaphore or a timeout
                await asyncio.wait_for(acquire_task, timeout=self.connection_timeout)
                acquired = True
                self.connection_stats['active_connections'] += 1
                self.connection_stats['total_connections'] += 1
                
                # Allocate a GPU for this client if monitoring is enabled
                gpu_id = None
                if self.enable_gpu_monitoring and self.gpu_monitor:
                    success, gpu_id = self.gpu_monitor.allocate_gpu_for_user(client_id)
                    if not success:
                        logger.warning(f"No GPU available for {client_id}, rejecting connection")
                        await self._send_error_message(websocket, "resource_unavailable", 
                                                  "No GPU resources available, please try again later")
                        return
                
                # Now process the client connection with the allocated GPU
                try:
                    await self.handle_client(websocket, gpu_id)
                finally:
                    # Always release the GPU when done
                    if self.enable_gpu_monitoring and self.gpu_monitor and gpu_id is not None:
                        self.gpu_monitor.release_gpu_for_user(client_id)
                        
            except asyncio.TimeoutError:
                if not acquired:
                    # Couldn't get a connection slot in time
                    logger.warning(f"Connection from {client_id} timed out waiting for a free slot")
                    await self._send_error_message(websocket, "server_busy", 
                                              "Server is at capacity, please try again later")
                    return
        except Exception as e:
            self.connection_stats['failed_connections'] += 1
            error_msg = f"Unexpected error handling connection from {client_id}: {e}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            try:
                await self._send_error_message(websocket, "server_error", 
                                          "An unexpected error occurred")
            except:
                pass  # Connection might already be closed
        finally:
            # Always release the semaphore if it was acquired
            if acquired:
                self.connection_stats['active_connections'] -= 1
                self.connection_semaphore.release()
    
    async def _send_error_message(self, websocket, error_code, error_message):
        """Send a standardized error message to the client"""
        try:
            await websocket.send(json.dumps({
                'type': 'error',
                'error_code': error_code,
                'message': error_message,
                'timestamp': time.time()
            }))
        except Exception as e:
            # Just log this - we're already in an error handler
            logger.debug(f"Failed to send error message: {e}")
            
    async def handle_client(self, websocket, gpu_id=None):
        """
        Handle a single client connection.
        Each client gets its own dedicated STT recorder instance.
        
        Args:
            websocket: The WebSocket connection
            gpu_id: Optional GPU ID to use for this client
        """
        client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        logger.info(f"Client connected: {client_id}" + (f" on GPU {gpu_id}" if gpu_id is not None else ""))
        
        # Resource tracking for this specific connection
        chunks_processed = 0
        transcription_count = 0
        connection_start_time = time.time()
        
        # Isolated exception handling for recorder creation
        try:
            # 1. Create a dedicated recorder for this client, potentially with GPU selection
            recorder_kwargs = {}
            if gpu_id is not None:
                # Add GPU selection to the recorder creation parameters
                recorder_kwargs['gpu_device_index'] = gpu_id
            
            recorder = create_optimized_realtime_stt(**recorder_kwargs)
        except Exception as e:
            logger.error(f"Failed to create STT recorder for {client_id}: {e}")
            logger.error(traceback.format_exc())
            await self._send_error_message(websocket, "initialization_error", 
                                      "Failed to initialize speech recognition")
            return
        
        # --- Define client-specific callbacks ---
        # These callbacks are closures, capturing the specific `websocket` for this client.
        async def send_to_client(message):
            """Helper to send messages to this specific client."""
            try:
                await websocket.send(message)
            except websockets.exceptions.ConnectionClosed:
                # This is expected if the client disconnects while a message is in flight
                pass
            except Exception as e:
                logger.error(f"Error sending message to {client_id}: {e}")

        def handle_realtime_update(text):
            """Handle real-time transcription updates for this client."""
            nonlocal transcription_count
            transcription_count += 1
            asyncio.create_task(send_to_client(json.dumps({
                'type': 'realtime',
                'text': text,
                'id': f"{client_id}_{transcription_count}"  # Add unique ID for debugging
            })))
            
        def handle_completed_transcription(text):
            """Handle completed transcription for this client."""
            nonlocal transcription_count
            if text and text.strip():
                transcription_count += 1
                asyncio.create_task(send_to_client(json.dumps({
                    'type': 'completed',
                    'text': text,
                    'id': f"{client_id}_{transcription_count}"  # Add unique ID for debugging
                })))

        def handle_recording_start():
            """Handle recording start event for this client."""
            logger.info(f"Recording started for {client_id}")
            asyncio.create_task(send_to_client(json.dumps({
                'type': 'status',
                'status': 'recording_started'
            })))
    
        def handle_recording_stop():
            """Handle recording stop event for this client."""
            logger.info(f"Recording stopped for {client_id}")
            asyncio.create_task(send_to_client(json.dumps({
                'type': 'status',
                'status': 'recording_stopped'
            })))

        # 2. Assign the client-specific callbacks to the new recorder instance
        recorder.on_realtime_transcription_update = handle_realtime_update
        recorder.on_recording_start = handle_recording_start
        recorder.on_recording_stop = handle_recording_stop
        
        # 3. Start the transcription fetching loop for this client
        # Wrap it in try/except to isolate errors
        transcription_task = None
        try:
            async def transcription_loop():
                """Continuously fetch and process final transcriptions from the recorder."""
                loop_iterations = 0
                while True:
                    try:
                        # The `text` method with a callback is non-blocking
                        recorder.text(handle_completed_transcription)
                        loop_iterations += 1
                        
                        # Log status periodically
                        if loop_iterations % 100 == 0:
                            logger.debug(f"Transcription loop for {client_id}: {loop_iterations} iterations")
                            
                        # Adjust sleep time as needed for responsiveness vs. CPU usage
                        await asyncio.sleep(0.1)
                    except websockets.exceptions.ConnectionClosed:
                        logger.info(f"Connection closed during transcription loop for {client_id}")
                        break
                    except Exception as e:
                        logger.error(f"Error in transcription loop for {client_id}: {e}")
                        logger.error(traceback.format_exc())
                        # Don't break - try to continue processing
                        await asyncio.sleep(1)  # Slow down if errors occur
            
            transcription_task = asyncio.create_task(transcription_loop())
        except Exception as e:
            logger.error(f"Failed to start transcription loop for {client_id}: {e}")
            logger.error(traceback.format_exc())
            await self._send_error_message(websocket, "processing_error", 
                                      "Failed to start speech processing")
            # Make sure to clean up
            if recorder:
                try:
                    recorder.stop()
                except:
                    pass
            return

        # 4. Start the recorder and process incoming messages
        audio_processing_errors = 0
        MAX_CONSECUTIVE_ERRORS = 5  # Circuit breaker threshold
        
        try:
            recorder.start()
            logger.info(f"STT recorder initialized and started for {client_id}")
            
            # Send a ready message to the client
            await send_to_client(json.dumps({
                'type': 'status',
                'status': 'ready',
                'message': 'STT engine ready to process audio'
            }))
            
            async for message in websocket:
                try:
                    data = json.loads(message)
                    
                    if data['type'] == 'audio':
                        # Reset error counter on successful message
                        audio_processing_errors = 0
                        
                        # Track the amount of audio being processed
                        chunks_processed += 1
                        
                        # Process audio with proper error handling
                        try:
                            audio_bytes = base64.b64decode(data['data'])
                            audio_data = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32767.0
                            recorder.feed_audio(audio_data, original_sample_rate=data.get('sample_rate', 16000))
                        except Exception as e:
                            audio_processing_errors += 1
                            logger.error(f"Error processing audio chunk from {client_id}: {e}")
                            # Only notify client on first few errors to avoid spamming
                            if audio_processing_errors <= 3:
                                await self._send_error_message(websocket, "audio_processing_error", 
                                                          f"Error processing audio: {str(e)[:100]}")
                            
                            # Circuit breaker pattern - disconnect if too many consecutive errors
                            if audio_processing_errors >= MAX_CONSECUTIVE_ERRORS:
                                logger.warning(f"Too many audio errors for {client_id}, closing connection")
                                await self._send_error_message(websocket, "connection_terminated", 
                                                          "Too many audio processing errors")
                                break
                        
                    elif data['type'] == 'command':
                        if data['command'] == 'stop':
                            # The client wants to stop the session
                            await send_to_client(json.dumps({
                                'type': 'status',
                                'status': 'stopped',
                                'message': 'Session ended by client request'
                            }))
                            break
                        elif data['command'] == 'ping':
                            # Simple keepalive
                            await send_to_client(json.dumps({
                                'type': 'pong',
                                'timestamp': time.time()
                            }))
                        elif data['command'] == 'get_stats':
                            # Return GPU and connection stats
                            stats = {
                                'connections': self.connection_stats,
                                'gpu': None
                            }
                            
                            # Add GPU stats if available
                            if self.enable_gpu_monitoring and self.gpu_monitor:
                                stats['gpu'] = self.gpu_monitor.get_allocation_stats()
                                
                            await send_to_client(json.dumps({
                                'type': 'stats',
                                'data': stats,
                                'timestamp': time.time()
                            }))
                            
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse message as JSON from {client_id}")
                    await self._send_error_message(websocket, "invalid_message", 
                                              "Message is not valid JSON")
                except Exception as e:
                    logger.error(f"Error processing message from {client_id}: {str(e)}")
                    logger.error(traceback.format_exc())
                    await self._send_error_message(websocket, "message_processing_error", 
                                              "Error processing your message")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client disconnected: {client_id}")
        except Exception as e:
            logger.error(f"Unexpected error in client handler for {client_id}: {e}")
            logger.error(traceback.format_exc())
        finally:
            # 5. Critical Cleanup: Ensure resources are released when client disconnects
            session_duration = time.time() - connection_start_time
            logger.info(f"Cleaning up for {client_id} after {session_duration:.2f}s, processed {chunks_processed} chunks")
            
            # Cancel the transcription task first
            if transcription_task:
                try:
                    transcription_task.cancel()
                    # Give it a moment to clean up
                    await asyncio.sleep(0.1)
                except Exception as e:
                    logger.error(f"Error cancelling transcription task for {client_id}: {e}")
            
            # Then stop the recorder with error handling
            try:
                recorder.stop()
                # If the library has a dedicated shutdown method, use it
                if hasattr(recorder, 'shutdown'):
                    recorder.shutdown()
            except Exception as e:
                logger.error(f"Error shutting down recorder for {client_id}: {e}")
            
            logger.info(f"Recorder for {client_id} shut down")
            # Explicitly help garbage collection
            recorder = None
        
    async def shutdown(self):
        """Gracefully shut down the server and all resources"""
        logger.info("Shutting down server...")
        
        # Stop GPU monitoring if enabled
        if self.enable_gpu_monitoring and self.gpu_monitor:
            self.gpu_monitor.stop_monitoring()
            logger.info("GPU monitoring stopped")
            
        logger.info("Server shutdown complete")

async def main():
    try:
        # Create server with configurable connection limits
        server = RealtimeSTTServer(
            host='0.0.0.0', 
            port=8012, 
            max_connections=50,  # Adjust based on your GPU capacity
            enable_gpu_monitoring=True  # Set to False to disable GPU monitoring
        )
    
    # Start server
        server_instance = await server.start_server()
        
        # The server will now run forever, handling clients as they connect.
        logger.info("Server running, press Ctrl+C to exit")
        await asyncio.Future()
    except asyncio.CancelledError:
        logger.info("Server task cancelled")
    except Exception as e:
        logger.critical(f"Fatal error in main loop: {e}")
        logger.critical(traceback.format_exc())
    finally:
        # Gracefully shut down
        if 'server' in locals():
        await server.shutdown()
        logger.info("Server shutdown complete")

if __name__ == "__main__":
    print("Starting Real-time STT WebSocket Server...")
    print("Optimized for multi-user, high-availability production use")
    print("Architecture: Multi-user, one STT instance per client")
    print("Connect to ws://localhost:8012")
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down server...") 