chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "openPopup") {
        chrome.action.openPopup();
    }
});
// In background.js or service_worker.js (for Manifest V3)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message received in background script:", message);
    // Process the message and send a response if necessary
    if (message.action === "applyFilter") {
        // Handle the filter logic here
        sendResponse({ success: true });
    }
    return true; // Indicates you want to send a response asynchronously
});
