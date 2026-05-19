"""Gunicorn configuration optimized for Render free-tier (512 MB RAM)."""

import os

# ── Server socket ──
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"

# ── Worker processes ──
workers = 1           # Single worker to minimize memory
threads = 1           # Single thread per worker
worker_class = "sync"
timeout = 180         # Allow time for first-request model loading

# ── Memory management ──
preload_app = False         # Do NOT preload; let lazy-loading work
max_requests = 80           # Recycle worker after N requests to prevent leaks
max_requests_jitter = 15    # Add randomness to prevent thundering herd

# ── Logging ──
accesslog = "-"
loglevel = "info"
