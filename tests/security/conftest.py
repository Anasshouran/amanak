"""Make the security engine importable for tests run directly from tests/."""

import sys
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parents[2] / "security-engine"
if str(ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(ENGINE_DIR))