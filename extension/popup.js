document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('recordBtn').addEventListener('click', () => {
    // Tell the background script to start the process
    chrome.runtime.sendMessage({ type: 'START_RECORDING' });
    document.getElementById('status').innerText = "🔴 Recording Requested...";
    document.getElementById('status').style.color = "red";
  });
});