import os
import sys
import tempfile
from typing import Dict, Any, List, Optional

# Ensure project root is on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

# Ensure bin directory (with ffmpeg.exe) is in PATH
_bin_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "bin"))
if os.path.exists(_bin_path) and _bin_path not in os.environ.get("PATH", ""):
    os.environ["PATH"] = _bin_path + os.pathsep + os.environ.get("PATH", "")

_whisper_model = None

def get_whisper_model(model_name: str = "tiny"):
    """
    Returns the cached Whisper ASR model instance (loads on first request).
    """
    global _whisper_model
    if _whisper_model is None:
        import whisper
        print(f"[Whisper ASR] Loading local Whisper model ('{model_name}')...")
        _whisper_model = whisper.load_model(model_name)
        print("[Whisper ASR] Local Whisper model loaded successfully.")
    return _whisper_model

def transcribe_audio_bytes(audio_bytes: bytes, language: str = "en") -> Dict[str, Any]:
    """
    Transcribes raw audio bytes (WebM, WAV, MP3, etc.) using Whisper ASR.
    Returns:
      {
        "transcript": str,
        "duration_seconds": float,
        "segments": [{"start": float, "end": float, "text": str}],
        "language": str
      }
    """
    if not audio_bytes or len(audio_bytes) < 100:
        return {
            "transcript": "",
            "duration_seconds": 0.0,
            "segments": [],
            "language": language,
        }

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        model = get_whisper_model()
        result = model.transcribe(tmp_path, language=language, fp16=False, temperature=0.0)
        transcript = (result.get("text") or "").strip()
        raw_segments = result.get("segments") or []
        segments = [
            {
                "start": float(s.get("start", 0.0)),
                "end": float(s.get("end", 0.0)),
                "text": str(s.get("text", "")).strip(),
            }
            for s in raw_segments
        ]
        duration = float(segments[-1]["end"]) if segments else 0.0
        return {
            "transcript": transcript,
            "duration_seconds": round(duration, 2),
            "segments": segments,
            "language": language,
        }
    except Exception as e:
        print(f"[Whisper ASR Error]: {e}")
        return {
            "transcript": "",
            "duration_seconds": 0.0,
            "segments": [],
            "language": language,
        }
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
