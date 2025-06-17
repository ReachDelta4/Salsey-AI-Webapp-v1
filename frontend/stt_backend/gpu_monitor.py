#!/usr/bin/env python3
"""
GPU Resource Monitor for Multi-User STT Server

This module provides utilities to monitor GPU resources and
implement circuit breakers for a multi-user Speech-to-Text server.
"""

import logging
import asyncio
import time
import os
import json
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple

# Configure logging
logger = logging.getLogger('gpu_monitor')

@dataclass
class GPUStats:
    """Data class to hold GPU statistics"""
    device_id: int
    memory_used: int  # in MB
    memory_total: int  # in MB
    utilization: float  # percentage (0-100)
    temperature: int  # in Celsius
    power_usage: float  # in Watts
    power_limit: float  # in Watts
    available_for_new_connections: bool = True
    
    @property
    def memory_used_percent(self) -> float:
        """Calculate memory usage as a percentage"""
        if self.memory_total == 0:
            return 0
        return (self.memory_used / self.memory_total) * 100
    
    @property
    def memory_free(self) -> int:
        """Calculate free memory in MB"""
        return self.memory_total - self.memory_used
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        result = asdict(self)
        result['memory_used_percent'] = self.memory_used_percent
        result['memory_free'] = self.memory_free
        return result

class GPUMonitor:
    """
    Monitors GPU resources and implements circuit breakers
    for a multi-user Speech-to-Text server.
    """
    
    def __init__(
        self, 
        memory_threshold: float = 90.0,  # percentage
        utilization_threshold: float = 95.0,  # percentage
        temperature_threshold: int = 85,  # Celsius
        check_interval: float = 5.0,  # seconds
        memory_per_user: int = 500,  # MB - estimated VRAM needed per user
        reserve_memory: int = 1000,  # MB - memory to keep reserved
        enable_nvidia_checks: bool = True
    ):
        """
        Initialize the GPU monitor with thresholds and settings.
        
        Args:
            memory_threshold: Percentage of memory usage that triggers warnings
            utilization_threshold: Percentage of GPU utilization that triggers warnings
            temperature_threshold: Temperature in Celsius that triggers warnings
            check_interval: How often to check GPU status (seconds)
            memory_per_user: Estimated memory required per user (MB)
            reserve_memory: Memory to keep reserved (MB)
            enable_nvidia_checks: Whether to try using NVIDIA tools
        """
        self.memory_threshold = memory_threshold
        self.utilization_threshold = utilization_threshold
        self.temperature_threshold = temperature_threshold
        self.check_interval = check_interval
        self.memory_per_user = memory_per_user
        self.reserve_memory = reserve_memory
        self.enable_nvidia_checks = enable_nvidia_checks
        
        # State tracking
        self.gpu_stats: Dict[int, GPUStats] = {}
        self.monitoring_task = None
        self.status_history: List[Dict] = []
        self.has_nvidia_tools = False
        self._check_nvidia_tools()
        
        # User allocation tracking
        self.user_gpu_assignments: Dict[str, int] = {}  # user_id -> gpu_id
    
    def _check_nvidia_tools(self) -> bool:
        """Check if NVIDIA tools (nvidia-smi) are available"""
        if not self.enable_nvidia_checks:
            logger.info("NVIDIA checks disabled by configuration")
            self.has_nvidia_tools = False
            return False
            
        try:
            import subprocess
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=2
            )
            if result.returncode == 0:
                self.has_nvidia_tools = True
                logger.info(f"NVIDIA GPU detected: {result.stdout.strip()}")
                return True
            else:
                self.has_nvidia_tools = False
                logger.warning("nvidia-smi command failed, will use fallback methods")
                return False
        except Exception as e:
            self.has_nvidia_tools = False
            logger.warning(f"Failed to check for NVIDIA tools: {e}")
            return False
    
    def get_gpu_stats(self) -> Dict[int, GPUStats]:
        """
        Get current stats for all GPUs.
        If NVIDIA tools are not available, use fallback methods.
        """
        if not self.has_nvidia_tools:
            return self._get_fallback_gpu_stats()
        
        try:
            import subprocess
            # Get detailed GPU information
            result = subprocess.run([
                "nvidia-smi",
                "--query-gpu=index,memory.used,memory.total,utilization.gpu,temperature.gpu,power.draw,power.limit",
                "--format=csv,noheader,nounits"
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            
            if result.returncode != 0:
                logger.warning(f"nvidia-smi command failed: {result.stderr}")
                return self._get_fallback_gpu_stats()
            
            # Parse output
            gpu_stats = {}
            for line in result.stdout.strip().split('\n'):
                if not line.strip():
                    continue
                    
                values = [val.strip() for val in line.split(',')]
                if len(values) >= 7:
                    device_id = int(values[0])
                    memory_used = int(float(values[1]))
                    memory_total = int(float(values[2]))
                    utilization = float(values[3])
                    temperature = int(float(values[4]))
                    power_usage = float(values[5])
                    power_limit = float(values[6])
                    
                    # Determine if this GPU can accept new connections
                    memory_free = memory_total - memory_used
                    available = (
                        memory_free >= (self.memory_per_user + self.reserve_memory) and
                        utilization < self.utilization_threshold and
                        temperature < self.temperature_threshold
                    )
                    
                    gpu_stats[device_id] = GPUStats(
                        device_id=device_id,
                        memory_used=memory_used,
                        memory_total=memory_total,
                        utilization=utilization,
                        temperature=temperature,
                        power_usage=power_usage,
                        power_limit=power_limit,
                        available_for_new_connections=available
                    )
            
            # If we got stats, update our cached copy
            if gpu_stats:
                self.gpu_stats = gpu_stats
                return gpu_stats
            else:
                logger.warning("No GPU stats returned from nvidia-smi")
                return self._get_fallback_gpu_stats()
                
        except Exception as e:
            logger.error(f"Error getting GPU stats: {e}")
            return self._get_fallback_gpu_stats()
    
    def _get_fallback_gpu_stats(self) -> Dict[int, GPUStats]:
        """
        Fallback method when NVIDIA tools are not available.
        This uses a simple heuristic based on the number of active connections.
        """
        # If we have cached stats, return those
        if self.gpu_stats:
            return self.gpu_stats
            
        # Create a dummy GPU with estimated usage
        active_users = len(self.user_gpu_assignments)
        estimated_memory_used = active_users * self.memory_per_user
        
        # Assuming a default GPU with 12GB VRAM (common for RTX GPUs)
        memory_total = 12 * 1024  # 12 GB in MB
        
        # Estimate utilization based on users
        estimated_utilization = min(95, (active_users / 15) * 100)  # 15 users = 100% utilization
        
        # Create a dummy GPU stat
        dummy_gpu = GPUStats(
            device_id=0,
            memory_used=estimated_memory_used,
            memory_total=memory_total,
            utilization=estimated_utilization,
            temperature=65,  # Reasonable default
            power_usage=150.0,  # Reasonable default
            power_limit=250.0,  # Reasonable default
            available_for_new_connections=(estimated_memory_used < (memory_total - self.reserve_memory))
        )
        
        self.gpu_stats = {0: dummy_gpu}
        return self.gpu_stats
    
    async def start_monitoring(self):
        """Start the GPU monitoring background task"""
        if self.monitoring_task is not None:
            logger.warning("Monitoring already running")
            return
            
        async def monitoring_loop():
            while True:
                try:
                    # Get current stats
                    gpu_stats = self.get_gpu_stats()
                    
                    # Log the stats
                    stats_summary = []
                    for gpu_id, stats in gpu_stats.items():
                        status = "AVAILABLE" if stats.available_for_new_connections else "BUSY"
                        stats_summary.append(
                            f"GPU {gpu_id}: {stats.memory_used_percent:.1f}% memory, "
                            f"{stats.utilization:.1f}% util, {stats.temperature}°C [{status}]"
                        )
                    
                    logger.info(f"GPU Status: {' | '.join(stats_summary)}")
                    
                    # Add to history (keeping last 100 entries)
                    timestamp = time.time()
                    history_entry = {
                        "timestamp": timestamp,
                        "gpus": {gpu_id: stats.to_dict() for gpu_id, stats in gpu_stats.items()}
                    }
                    self.status_history.append(history_entry)
                    if len(self.status_history) > 100:
                        self.status_history = self.status_history[-100:]
                    
                    # Check for alerts
                    self._check_alerts(gpu_stats)
                    
                    # Write stats to a file for external monitoring
                    self._write_stats_file(history_entry)
                    
                except Exception as e:
                    logger.error(f"Error in GPU monitoring loop: {e}")
                
                # Wait for next check
                await asyncio.sleep(self.check_interval)
        
        self.monitoring_task = asyncio.create_task(monitoring_loop())
        logger.info("GPU monitoring started")
    
    def stop_monitoring(self):
        """Stop the GPU monitoring background task"""
        if self.monitoring_task is not None:
            self.monitoring_task.cancel()
            self.monitoring_task = None
            logger.info("GPU monitoring stopped")
    
    def _check_alerts(self, gpu_stats: Dict[int, GPUStats]):
        """Check GPU stats against thresholds and log alerts"""
        for gpu_id, stats in gpu_stats.items():
            alerts = []
            
            if stats.memory_used_percent >= self.memory_threshold:
                alerts.append(f"Memory usage high: {stats.memory_used_percent:.1f}%")
                
            if stats.utilization >= self.utilization_threshold:
                alerts.append(f"Utilization high: {stats.utilization:.1f}%")
                
            if stats.temperature >= self.temperature_threshold:
                alerts.append(f"Temperature high: {stats.temperature}°C")
            
            if alerts:
                logger.warning(f"GPU {gpu_id} alerts: {', '.join(alerts)}")
    
    def _write_stats_file(self, stats_entry: Dict):
        """Write stats to a file for external monitoring"""
        try:
            stats_dir = os.path.join(os.path.dirname(__file__), "stats")
            os.makedirs(stats_dir, exist_ok=True)
            
            stats_file = os.path.join(stats_dir, "gpu_stats.json")
            with open(stats_file, 'w') as f:
                json.dump(stats_entry, f)
        except Exception as e:
            logger.error(f"Error writing stats file: {e}")
    
    def allocate_gpu_for_user(self, user_id: str) -> Tuple[bool, Optional[int]]:
        """
        Allocate a GPU for a user based on current resource availability.
        
        Args:
            user_id: Unique identifier for the user
            
        Returns:
            Tuple of (success, gpu_id)
            If success is False, gpu_id will be None
        """
        # If user already has an allocation, return it
        if user_id in self.user_gpu_assignments:
            return True, self.user_gpu_assignments[user_id]
        
        # Get fresh GPU stats
        gpu_stats = self.get_gpu_stats()
        
        # Find the best GPU for this user
        best_gpu_id = None
        best_free_memory = -1
        
        for gpu_id, stats in gpu_stats.items():
            if stats.available_for_new_connections:
                # Choose the GPU with the most free memory
                if stats.memory_free > best_free_memory:
                    best_gpu_id = gpu_id
                    best_free_memory = stats.memory_free
        
        if best_gpu_id is not None:
            # Assign this GPU to the user
            self.user_gpu_assignments[user_id] = best_gpu_id
            logger.info(f"Allocated GPU {best_gpu_id} for user {user_id} (free memory: {best_free_memory} MB)")
            return True, best_gpu_id
        else:
            logger.warning(f"No available GPU for user {user_id}")
            return False, None
    
    def release_gpu_for_user(self, user_id: str):
        """
        Release a GPU allocation for a user.
        
        Args:
            user_id: Unique identifier for the user
        """
        if user_id in self.user_gpu_assignments:
            gpu_id = self.user_gpu_assignments[user_id]
            logger.info(f"Released GPU {gpu_id} allocation for user {user_id}")
            del self.user_gpu_assignments[user_id]
    
    def get_allocation_stats(self) -> Dict:
        """Get statistics about current GPU allocations"""
        # Count users per GPU
        users_per_gpu = {}
        for user_id, gpu_id in self.user_gpu_assignments.items():
            users_per_gpu[gpu_id] = users_per_gpu.get(gpu_id, 0) + 1
        
        # Get current GPU stats
        gpu_stats = self.get_gpu_stats()
        
        # Combine the information
        allocation_stats = {
            "total_users": len(self.user_gpu_assignments),
            "gpus": {}
        }
        
        for gpu_id, stats in gpu_stats.items():
            allocation_stats["gpus"][str(gpu_id)] = {
                "users": users_per_gpu.get(gpu_id, 0),
                "memory_used_percent": stats.memory_used_percent,
                "available": stats.available_for_new_connections
            }
        
        return allocation_stats

# Example usage
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    async def demo():
        # Create a monitor with default settings
        monitor = GPUMonitor()
        
        # Start monitoring
        await monitor.start_monitoring()
        
        # Simulate some user allocations
        for i in range(10):
            user_id = f"user_{i}"
            success, gpu_id = monitor.allocate_gpu_for_user(user_id)
            if success:
                print(f"Allocated GPU {gpu_id} for {user_id}")
            else:
                print(f"Failed to allocate GPU for {user_id}")
        
        # Get allocation stats
        stats = monitor.get_allocation_stats()
        print(f"Allocation stats: {json.dumps(stats, indent=2)}")
        
        # Wait a bit
        await asyncio.sleep(10)
        
        # Release some allocations
        for i in range(5):
            user_id = f"user_{i}"
            monitor.release_gpu_for_user(user_id)
        
        # Get updated stats
        stats = monitor.get_allocation_stats()
        print(f"Updated allocation stats: {json.dumps(stats, indent=2)}")
        
        # Stop monitoring
        monitor.stop_monitoring()
    
    asyncio.run(demo()) 