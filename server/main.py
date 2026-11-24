import os
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from fastapi import FastAPI, WebSocket
import uvicorn
from faster_whisper import WhisperModel
import asyncio
import subprocess

app = FastAPI()

print("🧠 Loading AI Model...")
# Using the CPU to bypass the NVIDIA missing files error!
model = WhisperModel("base", device="cpu", compute_type="int8")
print("✅ Model Loaded. Waiting for Edge...")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("🔗 Edge Extension Connected! Recording started...")
    
    chunk_count = 0
    
    with open("live_meeting.webm", "wb") as f:
        try:
            while True:
                message = await websocket.receive()
                
                if "bytes" in message:
                    audio_chunk = message['bytes']
                    f.write(audio_chunk)
                    f.flush() 
                    
                    chunk_count += 1
                    print("🎵", end="", flush=True) 
                    
                    if chunk_count % 5 == 0:
                        print("\n🧠 Transcribing...") 
                        await asyncio.to_thread(transcribe_audio, "live_meeting.webm")
                        
        except Exception as e:
            # THIS RUNS THE EXACT SECOND YOU HIT "STOP RECORDING"
            print(f"\n❌ Meeting Ended.")
            print("🎵 Converting audio to MP3... Please wait.")
            
            try:
                # Crack open the webm file and export it as an mp3
                subprocess.run(
                    ["ffmpeg", "-y", "-i", "live_meeting.webm", "-vn", "-ar", "44100", "-ac", "2", "-b:a", "192k", "meeting_audio.mp3"],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                print("✅ Successfully saved 'meeting_audio.mp3' in your server folder!")
            except Exception as convert_error:
                print(f"⚠️ MP3 Conversion failed: {convert_error}")
                print("If it says it can't find ffmpeg, you might need to close and reopen your terminal one more time!")

def transcribe_audio(file_path):
    try:
        segments, info = model.transcribe(file_path, beam_size=5)
        
        print("\n📝 --- LIVE MEETING TRANSCRIPT --- 📝")
        
        for segment in segments:
            if segment.text.strip(): 
                print(f"[{segment.start:.2f}s] {segment.text}")
                
    except Exception as e:
        print(f"\n⚠️ AI Error: {e}") 

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)