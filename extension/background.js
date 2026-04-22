let creating; // Prevent double-loading

async function setupOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    console.log("Offscreen document already exists. Reusing it.");
    return;
  }

  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['USER_MEDIA'],
      justification: 'Recording meeting audio'
    });
    await creating;
    creating = null;
    console.log("Offscreen document successfully created!");
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    // We wrap this in a self-calling async function to catch errors properly
    (async () => {
      try {
        console.log("1. Checking active tab...");
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
          throw new Error("Cannot record a restricted browser page. Please go to a normal website like YouTube.");
        }

        console.log("2. Requesting audio stream ID...");
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
        
        if (!streamId) {
          throw new Error("Browser refused to give an audio stream. Try refreshing the tab.");
        }

        console.log("3. Waking up offscreen document...");
        await setupOffscreenDocument('offscreen.html');

        console.log("4. Sending stream ID to offscreen...");
        chrome.runtime.sendMessage({
          type: 'START_RECORDING',
          target: 'offscreen',
          data: streamId
        });

      } catch (error) {
        console.error("❌ RECORDING FAILED:", error.message);
      }
    })();
  }
  return true; // Keeps the message channel open
});