---
title: VisionX ANPR Intelligence
emoji: 🚗
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 5.29.1
app_file: app.py
pinned: false
---

# VisionX - Indian Automated License Plate Recognition (ALPR) & Surveillance AI

Cloud AI Engine running fine-tuned YOLO11 plate localization + Microsoft TrOCR character recognition for Indian vehicle plates.

### API Endpoints
- `GET /api/health` - Health check & model status
- `POST /api/anpr/detect` - Upload image for full 3-Stage ANPR detection
