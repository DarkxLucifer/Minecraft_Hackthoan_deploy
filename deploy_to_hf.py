"""
VisionX Hugging Face Space Deployment Script
===========================================
Deploy the AI models and FastAPI / Gradio backend to Hugging Face Spaces.
Reads Hugging Face User Access Token from HF_TOKEN environment variable.
"""

import os
import sys
from pathlib import Path
from huggingface_hub import HfApi

TOKEN = os.getenv("HF_TOKEN")
if not TOKEN:
    # Try reading from .env if present
    env_file = Path(__file__).resolve().parent / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("HF_TOKEN="):
                TOKEN = line.split("=", 1)[1].strip()
                break

if not TOKEN:
    print("HF_TOKEN environment variable not set.")
    print("Usage:")
    print("  $env:HF_TOKEN=\"hf_your_token_here\"")
    print("  python deploy_to_hf.py")
    sys.exit(1)

REPO_ID = os.getenv("HF_SPACE_REPO", "Yashraj9696/Test")
SRC_DIR = Path(__file__).resolve().parent / "hf_space_deploy"

def deploy():
    print(f"Connecting to Hugging Face Space: {REPO_ID}...")
    api = HfApi(token=TOKEN)

    print(f"Uploading entire {SRC_DIR} to Space {REPO_ID}...")
    api.upload_folder(
        folder_path=str(SRC_DIR),
        repo_id=REPO_ID,
        repo_type="space",
        commit_message="Deploy full VisionX backend with video streaming, runs, and surveillance database"
    )

    info = api.space_info(REPO_ID)
    print("\n[OK] Space deployed successfully!")
    print(f"  -> Space URL: https://huggingface.co/spaces/{REPO_ID}")
    print(f"  -> Direct App URL: https://yashraj9696-test.hf.space")
    print(f"  -> Current Stage: {info.runtime.stage}")

if __name__ == "__main__":
    deploy()
