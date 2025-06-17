#!/usr/bin/env python3
"""
Multi-user stress test for the Real-time STT WebSocket Server.
This script simulates multiple clients connecting simultaneously and streaming audio.
"""

import asyncio
import websockets
import json
import base64
import time
import random
import argparse
import os
import numpy as np
from datetime import datetime

# Configuration
DEFAULT_WS_URL = "ws://localhost:8012"
DEFAULT_AUDIO_FOLDER = "./test_audio"  # Directory with audio samples
DEFAULT_NUM_CLIENTS = 10
DEFAULT_RUNTIME_SECONDS = 30
DEFAULT_CONCURRENT_CONNECTIONS = 5  # How many clients to start simultaneously
DEFAULT_CONNECT_DELAY = 2.0  # Seconds between batches of connections

# Stats tracking
stats = {
    "connected_clients": 0,
    "total_connections": 0,
    "failed_connections": 0,
    "total_messages_sent": 0,
    "total_messages_received": 0,
    "total_audio_chunks": 0,
    "errors": 0,
    "connection_times": [],
    "start_time": 0,
}

class SimulatedClient:
    """Simulates a client connecting to the STT WebSocket server and streaming audio."""
    
    def __init__(self, url, client_id, audio_files, max_duration=30):
        self.url = url
        self.client_id = client_id
        self.audio_files = audio_files
        self.max_duration = max_duration
        self.stats = {
            "audio_chunks_sent": 0,
            "messages_received": 0,
            "connection_time": 0,
            "errors": 0,
            "transcriptions": [],
            "connection_successful": False,
        }
    
    async def run(self):
        """Run the simulation for this client."""
        global stats
        stats["total_connections"] += 1
        
        print(f"Client {self.client_id}: Connecting to {self.url}")
        connection_start = time.time()
        
        try:
            async with websockets.connect(self.url) as websocket:
                self.stats["connection_time"] = time.time() - connection_start
                stats["connection_times"].append(self.stats["connection_time"])
                self.stats["connection_successful"] = True
                stats["connected_clients"] += 1
                
                print(f"Client {self.client_id}: Connected in {self.stats['connection_time']:.2f}s")
                
                # Start the message receiver task
                receiver_task = asyncio.create_task(self._receive_messages(websocket))
                
                # Main client loop
                await self._run_simulation(websocket)
                
                # Clean up
                receiver_task.cancel()
                
        except Exception as e:
            stats["failed_connections"] += 1
            self.stats["errors"] += 1
            print(f"Client {self.client_id}: Connection failed: {e}")
        finally:
            if self.stats["connection_successful"]:
                stats["connected_clients"] -= 1
            
            print(f"Client {self.client_id}: Disconnected")
            
    async def _run_simulation(self, websocket):
        """Run the main simulation loop, streaming audio and commands."""
        global stats
        start_time = time.time()
        
        try:
            # Choose a random audio file
            if self.audio_files:
                audio_file = random.choice(self.audio_files)
                print(f"Client {self.client_id}: Using audio file {os.path.basename(audio_file)}")
                
                # Read the audio file - in a real simulation, we'd parse actual audio formats
                # For this test, we'll just simulate chunks of audio data
                with open(audio_file, "rb") as f:
                    audio_data = f.read()
                
                # Generate synthetic audio chunks if needed
                if not audio_data:
                    audio_data = self._generate_synthetic_audio(10)
                
                # Break the audio data into chunks
                chunk_size = 3200  # Approx 100ms at 16kHz, 16-bit mono
                chunks = [audio_data[i:i+chunk_size] for i in range(0, len(audio_data), chunk_size)]
                
                # Send audio data with realistic timing
                for chunk in chunks:
                    if time.time() - start_time > self.max_duration:
                        break
                        
                    # Send the chunk
                    await self._send_audio_chunk(websocket, chunk)
                    
                    # Sleep to simulate real-time audio
                    await asyncio.sleep(0.1)  # 100ms chunks
                    
                    # Sometimes simulate a pause
                    if random.random() < 0.05:
                        await asyncio.sleep(random.uniform(0.5, 2.0))
                
                # Send a stop command to end the session
                await websocket.send(json.dumps({
                    "type": "command",
                    "command": "stop"
                }))
                stats["total_messages_sent"] += 1
                
            else:
                # No audio files - simulate with synthetic data
                print(f"Client {self.client_id}: Using synthetic audio")
                
                end_time = start_time + self.max_duration
                while time.time() < end_time:
                    # Generate random synthetic audio
                    chunk = self._generate_synthetic_audio()
                    await self._send_audio_chunk(websocket, chunk)
                    
                    # Sleep to simulate real-time audio
                    await asyncio.sleep(0.1)
                    
                    # Simulate occasional silence
                    if random.random() < 0.1:
                        await asyncio.sleep(random.uniform(0.5, 1.5))
                
                # Send a stop command
                await websocket.send(json.dumps({
                    "type": "command",
                    "command": "stop"
                }))
                stats["total_messages_sent"] += 1
                
        except Exception as e:
            self.stats["errors"] += 1
            stats["errors"] += 1
            print(f"Client {self.client_id}: Error in simulation: {e}")
    
    async def _receive_messages(self, websocket):
        """Receive and process messages from the server."""
        global stats
        
        try:
            async for message in websocket:
                self.stats["messages_received"] += 1
                stats["total_messages_received"] += 1
                
                try:
                    data = json.loads(message)
                    if data.get("type") == "completed" or data.get("type") == "realtime":
                        self.stats["transcriptions"].append({
                            "type": data.get("type"),
                            "text": data.get("text"),
                            "timestamp": time.time()
                        })
                        
                        if len(self.stats["transcriptions"]) % 5 == 0:
                            print(f"Client {self.client_id}: Received {len(self.stats['transcriptions'])} transcriptions")
                    
                    elif data.get("type") == "error":
                        print(f"Client {self.client_id}: Received error: {data.get('message')}")
                        self.stats["errors"] += 1
                        
                except json.JSONDecodeError:
                    print(f"Client {self.client_id}: Received invalid JSON")
                    
        except websockets.exceptions.ConnectionClosed:
            print(f"Client {self.client_id}: Connection closed by server")
        except Exception as e:
            self.stats["errors"] += 1
            stats["errors"] += 1
            print(f"Client {self.client_id}: Error receiving messages: {e}")
    
    async def _send_audio_chunk(self, websocket, chunk):
        """Send an audio chunk to the server."""
        global stats
        
        try:
            # Encode the chunk in base64
            encoded_chunk = base64.b64encode(chunk).decode('utf-8')
            
            # Send the audio data
            await websocket.send(json.dumps({
                "type": "audio",
                "data": encoded_chunk,
                "sample_rate": 16000
            }))
            
            self.stats["audio_chunks_sent"] += 1
            stats["total_audio_chunks"] += 1
            stats["total_messages_sent"] += 1
            
        except Exception as e:
            self.stats["errors"] += 1
            stats["errors"] += 1
            print(f"Client {self.client_id}: Error sending audio: {e}")
    
    def _generate_synthetic_audio(self, seconds=0.1):
        """Generate synthetic audio data for testing."""
        # Generate random noise at 16kHz, 16-bit mono
        sample_rate = 16000
        num_samples = int(seconds * sample_rate)
        
        # Create random audio data (white noise)
        audio = np.random.normal(0, 0.1, num_samples)
        
        # Convert to 16-bit PCM
        audio = (audio * 32767).astype(np.int16)
        
        # Return as bytes
        return audio.tobytes()

async def print_stats(stats, interval=5):
    """Periodically print statistics about the test run."""
    while True:
        await asyncio.sleep(interval)
        
        # Calculate stats
        elapsed = time.time() - stats["start_time"]
        avg_conn_time = sum(stats["connection_times"]) / len(stats["connection_times"]) if stats["connection_times"] else 0
        
        # Print current stats
        print("\n" + "="*50)
        print(f"Test running for {elapsed:.1f}s")
        print(f"Connected clients: {stats['connected_clients']}")
        print(f"Total connections: {stats['total_connections']} (failed: {stats['failed_connections']})")
        print(f"Avg connection time: {avg_conn_time:.2f}s")
        print(f"Messages: {stats['total_messages_sent']} sent, {stats['total_messages_received']} received")
        print(f"Audio chunks: {stats['total_audio_chunks']}")
        print(f"Errors: {stats['errors']}")
        print("="*50 + "\n")

async def main():
    """Main function to run the test."""
    parser = argparse.ArgumentParser(description="Test multi-user capability of the STT WebSocket server")
    parser.add_argument("--url", default=DEFAULT_WS_URL, help="WebSocket server URL")
    parser.add_argument("--clients", type=int, default=DEFAULT_NUM_CLIENTS, help="Number of clients to simulate")
    parser.add_argument("--runtime", type=int, default=DEFAULT_RUNTIME_SECONDS, help="Test duration in seconds")
    parser.add_argument("--audio", default=DEFAULT_AUDIO_FOLDER, help="Folder with audio samples")
    parser.add_argument("--concurrent", type=int, default=DEFAULT_CONCURRENT_CONNECTIONS, 
                        help="How many clients to connect at once")
    parser.add_argument("--delay", type=float, default=DEFAULT_CONNECT_DELAY, 
                        help="Seconds between batches of connections")
    
    args = parser.parse_args()
    
    global stats
    stats["start_time"] = time.time()
    
    # Check for audio files
    audio_files = []
    if os.path.isdir(args.audio):
        for file in os.listdir(args.audio):
            if file.endswith((".wav", ".mp3", ".pcm", ".raw")):
                audio_files.append(os.path.join(args.audio, file))
    
    if not audio_files:
        print("No audio files found, will use synthetic audio")
    
    # Start stats printer
    stats_task = asyncio.create_task(print_stats(stats))
    
    # Create and start client tasks in batches
    client_tasks = []
    
    for i in range(0, args.clients, args.concurrent):
        batch_size = min(args.concurrent, args.clients - i)
        batch = []
        
        print(f"Starting batch of {batch_size} clients...")
        
        for j in range(batch_size):
            client_id = i + j + 1
            client = SimulatedClient(args.url, client_id, audio_files, args.runtime)
            task = asyncio.create_task(client.run())
            batch.append(task)
            client_tasks.append(task)
        
        # Wait for batch to connect before starting next batch
        if i + batch_size < args.clients:
            await asyncio.sleep(args.delay)
    
    # Wait for the specified runtime
    try:
        await asyncio.sleep(args.runtime)
        
        # Cancel any remaining client tasks
        for task in client_tasks:
            if not task.done():
                task.cancel()
                
        # Wait for tasks to complete cancellation
        if client_tasks:
            await asyncio.gather(*client_tasks, return_exceptions=True)
    finally:
        # Cancel stats printer
        stats_task.cancel()
        
        # Print final stats
        elapsed = time.time() - stats["start_time"]
        print("\n" + "="*50)
        print(f"TEST COMPLETE - Ran for {elapsed:.1f}s")
        print(f"Total connections: {stats['total_connections']} (failed: {stats['failed_connections']})")
        print(f"Messages: {stats['total_messages_sent']} sent, {stats['total_messages_received']} received")
        print(f"Audio chunks: {stats['total_audio_chunks']}")
        print(f"Errors: {stats['errors']}")
        
        # Calculate average connection time
        if stats["connection_times"]:
            avg_conn_time = sum(stats["connection_times"]) / len(stats["connection_times"])
            print(f"Average connection time: {avg_conn_time:.2f}s")
        
        print("="*50)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTest interrupted by user") 