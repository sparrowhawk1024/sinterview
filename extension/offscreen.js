// Connect directly to your Python server
const socket = new WebSocket('ws://127.0.0.1:8000/ws');

socket.onopen = () => console.log("Offscreen connected to Python Server!");

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.target === 'offscreen' && message.type === 'START_RECORDING') {
    
    // 1. Get the audio stream from the tab
    const media = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: message.data
        }
      },
      video: false
    });

    // --- THE FIX: PLAY AUDIO BACK TO YOUR SPEAKERS ---
    const audioCtx = new window.AudioContext();
    const source = audioCtx.createMediaStreamSource(media);
    source.connect(audioCtx.destination);
    // -------------------------------------------------

    // 2. Start recording the stream to send to Python
    const recorder = new MediaRecorder(media, { mimeType: 'audio/webm' });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
        socket.send(event.data);
      }
    };

    recorder.start(1000); // Send chunks every 1 second
  }
});