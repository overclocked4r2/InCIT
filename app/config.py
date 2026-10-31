"""Application configuration."""
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = Path(os.environ.get("INCIT_DATA_DIR", str(PROJECT_ROOT / "data")))
DATASET_PATH = DATA_DIR / "cit_public.json"

# Team name for exports
TEAM_NAME = os.environ.get("INCIT_TEAM", "InCIT")

# Database
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./incit.db")

# CORS origins for local dev
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
