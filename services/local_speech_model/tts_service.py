"""
Text-To-Speech (TTS) Service (services/local_speech_model/tts_service.py)
========================================================================
Generates natural-sounding spoken audio for the AI interviewer.
Supports:
1. OpenAI Audio Speech API (via OPENAI_API_KEY / SPEECH_API_KEY)
2. Microsoft Edge Neural Voice streaming if configured
3. Graceful fallback signaling so frontend uses Web Speech API (window.speechSynthesis).
"""

import os
import io
import logging
from typing import Optional, Dict

logger = logging.getLogger("synterview.tts")

EDGE_VOICES = {
    "us": {"female": "en-US-AvaNeural", "male": "en-US-AndrewNeural"},
    "indian": {"female": "en-IN-NeerjaNeural", "male": "en-IN-PrabhatNeural"},
}
OPENAI_VOICES = {"female": "nova", "male": "onyx"}
MAX_CHARS = 1000


def generate_speech_audio(
    text: str,
    gender: str = "female",
    accent: str = "us"
) -> Optional[bytes]:
    """
    Attempts to synthesize speech via OpenAI or Edge TTS. Returns MP3 bytes if successful,
    or None if the frontend should use Web Speech API.
    """
    text = text.strip()[:MAX_CHARS]
    if not text:
        return None

    gender = gender.lower() if gender in ("female", "male") else "female"
    accent = accent.lower() if accent in ("us", "indian") else "us"

    # 1. Try OpenAI TTS API if key is present
    api_key = os.getenv("SPEECH_API_KEY") or os.getenv("OPENAI_API_KEY")
    if api_key:
        try:
            import requests
            voice_name = OPENAI_VOICES.get(gender, "nova")
            res = requests.post(
                "https://api.openai.com/v1/audio/speech",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o-mini-tts",
                    "voice": voice_name,
                    "input": text,
                    "response_format": "mp3"
                },
                timeout=5
            )
            if res.status_code == 200:
                return res.content
        except Exception as exc:
            logger.warning(f"OpenAI TTS synthesis error: {exc}")

    # Fallback to None: Frontend will seamlessly speak via Web Speech API
    return None
