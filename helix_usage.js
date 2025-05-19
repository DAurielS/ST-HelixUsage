// SillyTavern Helix Usage Monitor Extension

import { eventSource, event_types, callPopup } from "../../../../script.js"; // Added callPopup
import { findSecret, SECRET_KEYS } from "../../../secrets.js"; // Added imports for secrets

// Get the SillyTavern context
const context = SillyTavern.getContext();

// Variable to store if Helix configuration is active
let isHelixConfigActive = false;
let usageCountdownInterval = null;
let nextMessageExpiryTimeMs = null;

// Log to confirm the extension is loaded
console.log("Helix Usage Monitor extension loaded.");

// --- Helper Functions ---
function formatMillisecondsToTime(ms) {
    if (ms < 0) ms = 0;
    let totalSeconds = Math.floor(ms / 1000);
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;

    const pad = (num) => String(num).padStart(2, '0');

    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    } else {
        return `${pad(minutes)}:${pad(seconds)}`;
    }
}

// --- Mock API Function ---
async function fetchHelixUsageData_mock(apiKey) {
    console.log(`Fetching mock Helix usage data (API Key: ${apiKey ? 'provided' : 'not provided'})...`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    const total_limit = 50;
    // Simulate some usage, ensuring it's less than total_limit
    const current_usage_count = Math.floor(Math.random() * (total_limit - 5)) + 5; // e.g. 5 to 49

    let messages = [];
    if (current_usage_count > 0) {
        for (let i = 0; i < current_usage_count; i++) {
            // Generate timestamps spread out over the last 20 hours for variety
            const randomMinutesAgo = Math.floor(Math.random() * 20 * 60); // Up to 20 hours ago
            messages.push({ timestamp: new Date(Date.now() - randomMinutesAgo * 60 * 1000).toISOString() });
        }
        // Sort messages by timestamp, oldest first
        messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    
    // Ensure we don't have more messages than current_usage_count (though loop above should handle it)
    // More accurately, the number of messages should BE the current_usage_count if they represent individual uses.
    // For this mock, let's ensure the count matches the messages array length.
    const final_current_usage_count = messages.length;


    const mockResponse = {
        total_limit: total_limit,
        current_usage_count: final_current_usage_count,
        messages: messages
    };
    // console.log("Mock data generated:", JSON.parse(JSON.stringify(mockResponse))); // Log a deep copy
    return mockResponse;
}

// --- Timer Logic ---
function startUsageCountdown(expiryTimeMs) {
    clearInterval(usageCountdownInterval);
    nextMessageExpiryTimeMs = expiryTimeMs;

    const nextMessageTimeText = document.getElementById('helix-next-message-time-text');
    if (!nextMessageTimeText) {
        console.warn("Helix Monitor: Next message time text element not found in startUsageCountdown.");
        return;
    }

    const updateTimerDisplay = () => {
        const remainingMs = nextMessageExpiryTimeMs - Date.now();
        if (remainingMs <= 0) {
            clearInterval(usageCountdownInterval);
            if (nextMessageTimeText) nextMessageTimeText.textContent = 'Next Message In: Refreshing...';
            console.log("Helix Monitor: Countdown expired, refreshing usage data.");
            refreshUsageData(); // Trigger refresh
        } else {
            if (nextMessageTimeText) nextMessageTimeText.textContent = `Next Message In: ${formatMillisecondsToTime(remainingMs)}`;
        }
    };

    updateTimerDisplay(); // Initial display update
    usageCountdownInterval = setInterval(updateTimerDisplay, 1000);
    // console.log(`Helix Monitor: Countdown started. Target expiry: ${new Date(expiryTimeMs).toISOString()}`);
}


// --- Main Data Refresh and UI Update Logic ---
async function refreshUsageData() {
    const messagesUsedText = document.getElementById('helix-messages-used-text');
    const nextMessageTimeText = document.getElementById('helix-next-message-time-text');

    // This function assumes isHelixConfigActive is true because it's called
    // by checkAndUpdateHelixUI (on activation), generation event listeners (which check),
    // or timer expiry (which implies it was active).
    if (!isHelixConfigActive) {
        console.warn("Helix Monitor: refreshUsageData called while not active. This is unexpected. Aborting.");
        return;
    }

    console.log('Helix Monitor: Refreshing Helix usage data...');
    // Set loading states immediately
    if (messagesUsedText) messagesUsedText.textContent = 'Messages Used: Loading...';
    if (nextMessageTimeText) nextMessageTimeText.textContent = 'Next Message In: Loading...';

    let helixApiKey = null;
    try {
        helixApiKey = await findSecret(SECRET_KEYS.CUSTOM);
        if (!helixApiKey || typeof helixApiKey !== 'string' || helixApiKey.trim() === '') {
            console.error('Helix Monitor: Failed to retrieve a valid API key for CUSTOM endpoint. It might be missing, or "allowKeysExposure" is false in config.yaml.');
            if (messagesUsedText) messagesUsedText.textContent = 'Messages Used: Key Error';
            if (nextMessageTimeText) nextMessageTimeText.textContent = 'Next Message In: Key Error';
            // Display a popup to the user
            toastr.info('<h3>Helix Usage Monitor Error</h3><p>Could not retrieve the API key for the custom Helix endpoint. Please ensure your API key is correctly configured in SillyTavern for the "Custom" provider and that <code>allowKeysExposure</code> is set to <code>true</code> in your <code>config.yaml</code> file (requires server restart after changing).</p>', 'text');
            return; // Stop further processing
        }
        console.log('Helix Monitor: API key retrieved successfully via findSecret.');
    } catch (err) {
        console.error('Helix Monitor: Error calling findSecret:', err);
        if (messagesUsedText) messagesUsedText.textContent = 'Messages Used: Key Error';
        if (nextMessageTimeText) nextMessageTimeText.textContent = 'Next Message In: Key Error';
        toastr.info('<h3>Helix Usage Monitor Error</h3><p>An error occurred while trying to retrieve the API key. Check the browser console for details.</p>', 'text');
        return; // Stop further processing
    }

    try {
        const data = await fetchHelixUsageData_mock(helixApiKey);

        if (messagesUsedText) {
            messagesUsedText.textContent = `Messages Used: ${data.current_usage_count} / ${data.total_limit}`;
        }

        if (nextMessageTimeText) {
            if (data.current_usage_count === 0) {
                nextMessageTimeText.textContent = 'Next Message In: Ready';
                clearInterval(usageCountdownInterval);
            } else if (data.messages && data.messages.length > 0) {
                // Messages are already sorted by the mock function (oldest first)
                const oldestMessageTimestamp = new Date(data.messages[0].timestamp).getTime();
                const expiryTimeMs = oldestMessageTimestamp + (24 * 60 * 60 * 1000);
                
                if (expiryTimeMs <= Date.now()) {
                    nextMessageTimeText.textContent = 'Next Message In: Refreshing...';
                    clearInterval(usageCountdownInterval);
                    console.log("Helix Monitor: Oldest message already expired, triggering immediate refresh.");
                    // Add a small delay to prevent potential rapid loop if mock always returns expired
                    setTimeout(refreshUsageData, 500);
                } else {
                    startUsageCountdown(expiryTimeMs);
                }
            } else if (data.current_usage_count > 0 && (!data.messages || data.messages.length === 0)) {
                nextMessageTimeText.textContent = 'Next Message In: Unknown (No msgs)';
                clearInterval(usageCountdownInterval);
                console.warn("Helix Monitor: Usage count > 0 but no messages array. Timer not started.");
            } else { // current_usage_count < total_limit and no specific message expiring soon (or other unhandled cases)
                nextMessageTimeText.textContent = 'Next Message In: Ready';
                clearInterval(usageCountdownInterval);
            }
        }
        // console.log('Helix Monitor: UI updated with new data.');

    } catch (error) {
        console.error('Helix Monitor: Error fetching or processing Helix usage data:', error);
        if (messagesUsedText) messagesUsedText.textContent = 'Messages Used: Error';
        if (nextMessageTimeText) nextMessageTimeText.textContent = 'Next Message In: Error';
        clearInterval(usageCountdownInterval); // Stop timer on error
    }
}

// Function to create the Helix Usage Display UI
function createUsageDisplayUI() {
    const container = document.createElement('div');
    container.id = 'helix-usage-container';

    const messagesUsedP = document.createElement('p');
    messagesUsedP.id = 'helix-messages-used-text';
    messagesUsedP.textContent = 'Messages Used: N/A';
    container.appendChild(messagesUsedP);

    const nextMessageTimeP = document.createElement('p');
    nextMessageTimeP.id = 'helix-next-message-time-text';
    nextMessageTimeP.textContent = 'Next Message In: N/A';
    container.appendChild(nextMessageTimeP);

    return container;
}

// Function to check conditions and update Helix UI visibility and API key
function checkAndUpdateHelixUI() {
    const uiContainer = document.getElementById('helix-usage-container');
    const messagesUsedText = document.getElementById('helix-messages-used-text');
    const nextMessageTimeText = document.getElementById('helix-next-message-time-text');

    if (!uiContainer) {
        console.warn("Helix Monitor: UI container not found in checkAndUpdateHelixUI.");
        return;
    }

    const currentSettings = context.chatCompletionSettings;
    let newActiveState = false;
    const helixUrlPattern = 'https://helixmind.online';

    if (currentSettings?.chat_completion_source === 'custom') {
        const customUrl = currentSettings?.custom_url ?? '';
        if (customUrl.startsWith(helixUrlPattern)) {
            newActiveState = true;
        }
    }

    if (isHelixConfigActive !== newActiveState) {
        console.log(`Helix Monitor: Active state changing from ${isHelixConfigActive} to ${newActiveState}.`);
        isHelixConfigActive = newActiveState; // Update the global state

        if (isHelixConfigActive) {
            uiContainer.classList.add('helix-active');
            console.log('Helix Monitor: Became active. Triggering initial data refresh.');
            refreshUsageData(); // Refresh data now that it's active
        } else {
            uiContainer.classList.remove('helix-active');
            clearInterval(usageCountdownInterval); // Stop timer
            if (messagesUsedText) messagesUsedText.textContent = 'Messages Used: N/A';
            if (nextMessageTimeText) nextMessageTimeText.textContent = 'Next Message In: N/A';
            console.log('Helix Monitor: Became inactive. UI reset and timer cleared.');
        }
    }
    // If state hasn't changed, do nothing here. Refreshes are triggered by:
    // 1. Becoming active (above).
    // 2. Generation end/stopped events.
    // 3. Timer expiry.
}

// Function to initialize and inject the UI
function initHelixUsageUI() {
    // Check if the UI already exists
    if (document.getElementById('helix-usage-container')) {
        console.log("Helix Usage Monitor UI already exists.");
        return;
    }

    const usageUI = createUsageDisplayUI();
    let injectionSuccessful = false;

    // Injection logic: Target the "Streaming" toggle in the left navbar.
    // The goal is to insert the Helix Usage UI before the "Streaming" toggle.
    const streamToggleInput = document.getElementById('stream_toggle');
    let streamingToggleDiv = null;

    if (streamToggleInput) {
        // Find the closest ancestor div with class 'range-block'
        streamingToggleDiv = streamToggleInput.closest('div.range-block');
    }

    if (streamingToggleDiv && streamingToggleDiv.parentElement) {
        // The parentElement should be div#range_block_openai or a similar container
        try {
            streamingToggleDiv.parentElement.insertBefore(usageUI, streamingToggleDiv);
            console.log("Helix Usage Monitor UI injected before the 'Streaming' toggle's div.range-block.");
            injectionSuccessful = true;
        } catch (e) {
            console.error("Error injecting Helix Usage Monitor UI before 'Streaming' toggle's div.range-block:", e);
        }
    } else {
        console.warn("Could not find the 'Streaming' toggle (input#stream_toggle) or its 'div.range-block' container. Attempting fallback injection.");
    }

    // Fallback: If specific injection fails, append to a known general area in the left navbar.
    if (!injectionSuccessful) {
        const leftNavPanel = document.getElementById('left-nav-panel');
        if (leftNavPanel) {
            const scrollableInner = leftNavPanel.querySelector('.scrollableInner .panels'); // More specific target
            if (scrollableInner) {
                scrollableInner.appendChild(usageUI);
                console.log("Helix Usage Monitor UI appended to '.scrollableInner .panels' in '#left-nav-panel' (fallback).");
                injectionSuccessful = true;
            } else {
                const genericScrollable = leftNavPanel.querySelector('.scrollableInner');
                if (genericScrollable) {
                    genericScrollable.appendChild(usageUI);
                     console.log("Helix Usage Monitor UI appended to '.scrollableInner' in '#left-nav-panel' (fallback).");
                     injectionSuccessful = true;
                } else {
                    leftNavPanel.appendChild(usageUI);
                    console.log("Helix Usage Monitor UI appended to '#left-nav-panel' (fallback).");
                    injectionSuccessful = true;
                }
            }
        }
    }

    if (!injectionSuccessful) {
        // Last resort: append to body if no suitable panel found.
        console.warn("Could not find a suitable parent element in the left navbar for Helix Usage Monitor UI. Appending to body as a last resort.");
        document.body.appendChild(usageUI);
    }

    if (injectionSuccessful) {
        // Call once after successful UI injection to set initial state
        checkAndUpdateHelixUI();
    }
}

// Initialize the UI when the script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHelixUsageUI);
} else {
    // DOMContentLoaded has already fired
    initHelixUsageUI();
}

// Listen for settings updates to re-evaluate conditions
eventSource.on(event_types.SETTINGS_UPDATED, () => {
    console.log("Helix Usage Monitor: SETTINGS_UPDATED event received.");
    checkAndUpdateHelixUI();
});

// Listen for generation ended event to trigger refresh
eventSource.on(event_types.GENERATION_ENDED, (data) => {
    console.log("Helix Usage Monitor: GENERATION_ENDED event received.");
    if (isHelixConfigActive) {
        console.log("Helix Monitor: Active, refreshing data after generation ended.");
        refreshUsageData();
    }
});