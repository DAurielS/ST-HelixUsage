// SillyTavern Helix Usage Monitor Extension

import { eventSource, event_types, callPopup } from "../../../../script.js"; // Added callPopup
import { findSecret, SECRET_KEYS } from "../../../secrets.js"; // Added imports for secrets

// Get the SillyTavern context
const context = SillyTavern.getContext();

// Variable to store if Helix configuration is active
let isHelixConfigActive = false;
let usageCountdownInterval = null;
let nextMessageExpiryTimeMs = null;

// --- Settings Constants and Management ---
const ST_HELIX_USAGE_SETTINGS_MODULE = 'ST-HelixUsage-Settings';
const defaultHelixSettings = {
    showHourlyBreakdown: false,
};

// Function to get or initialize extension settings
function getHelixUsageSettings() {
    if (!context.extensionSettings[ST_HELIX_USAGE_SETTINGS_MODULE]) {
        context.extensionSettings[ST_HELIX_USAGE_SETTINGS_MODULE] = structuredClone(defaultHelixSettings);
    }
    // Ensure all default keys exist
    for (const key in defaultHelixSettings) {
        if (context.extensionSettings[ST_HELIX_USAGE_SETTINGS_MODULE][key] === undefined) {
            context.extensionSettings[ST_HELIX_USAGE_SETTINGS_MODULE][key] = defaultHelixSettings[key];
        }
    }
    return context.extensionSettings[ST_HELIX_USAGE_SETTINGS_MODULE];
}

// Function to add the settings panel to SillyTavern's UI
function addHelixUsageSettingsPanel() {
    const settingsHtml = `
<div id="st-helix-usage-settings-panel" class="extension_settings_section">
    <h4>ST-HelixUsage Settings</h4>
    <div class="form-group">
        <input type="checkbox" id="helix-usage-hourly-toggle" name="helix-usage-hourly-toggle" style="margin-right: 5px;" />
        <label for="helix-usage-hourly-toggle">Show Hourly Message Reset Breakdown</label>
    </div>
    <!-- Additional settings for ST-HelixUsage can be added here in the future -->
</div>
    `;

    // The first argument is the display name for the settings section header
    context.addExtensionSettings('ST-HelixUsage', settingsHtml);

    // After addExtensionSettings, the HTML should be in the DOM.
    // We can now find the element and attach event listeners.
    const toggle = document.getElementById('helix-usage-hourly-toggle');

    if (toggle) {
        const currentSettings = getHelixUsageSettings();
        toggle.checked = currentSettings.showHourlyBreakdown;

        toggle.addEventListener('change', () => {
            const settingsToUpdate = getHelixUsageSettings();
            settingsToUpdate.showHourlyBreakdown = toggle.checked;
            context.saveSettingsDebounced();
            console.log(`Helix Monitor: Hourly breakdown setting changed to ${toggle.checked}`);
            // If this setting needs to trigger an immediate UI update elsewhere in the extension,
            // call the relevant function here. For example, if the hourly breakdown display
            // is part of the main UI, you might call a function to refresh that display.
        });
    } else {
        // This might happen if addExtensionSettings is async and doesn't complete
        // before getElementById is called, or if the ID is incorrect.
        // However, addExtensionSettings is generally expected to make elements available.
        console.warn("Helix Monitor: Could not find 'helix-usage-hourly-toggle' in settings panel immediately after addExtensionSettings. The event listener might not be attached.");
    }
}


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
    
    const final_current_usage_count = messages.length;

    const mockResponse = {
        total_limit: total_limit,
        current_usage_count: final_current_usage_count,
        messages: messages
    };
    return mockResponse;
}

// --- Real API Function ---
async function fetchHelixUsageData_real(apiKey) {
    const apiUrl = 'https://helixmind.online/v1/usage';
    console.log(`Helix Monitor: Fetching REAL Helix usage data from ${apiUrl}...`);

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            let errorBodyDetail = "";
            try {
                const errorBodyText = await response.text(); 
                errorBodyDetail = errorBodyText.substring(0, 500); 
                console.error(`Helix Monitor: API Error Response Text (Status ${response.status}): ${errorBodyText}`);
            } catch (e) {
                console.warn('Helix Monitor: Could not read API error body.');
                errorBodyDetail = "(could not read error body)";
            }
            throw new Error(`API request failed: ${response.status} ${response.statusText}. Details: ${errorBodyDetail}`);
        }

        const parsedResponse = await response.json();
        // console.log('Helix Monitor: Raw Real API Response:', JSON.stringify(parsedResponse, null, 2)); // For debugging

        // Filter messages to within the last 24 hours and transform
        const twentyFourHoursAgoMs = Date.now() - (24 * 60 * 60 * 1000);
        let activeMessages = [];

        if (parsedResponse.data && Array.isArray(parsedResponse.data)) {
            activeMessages = parsedResponse.data
                .map(item => ({
                    ...item, // Keep original fields like 'model'
                    timestamp_ms: item.timestamp * 1000 // Convert API's seconds to milliseconds
                }))
                .filter(message => message.timestamp_ms >= twentyFourHoursAgoMs);
            
            // Sort active messages by timestamp, oldest first, to ensure messages[0] is the oldest for timer logic
            activeMessages.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
            console.log(`Helix Monitor: Found ${activeMessages.length} messages within the last 24 hours out of ${parsedResponse.data.length} total from API.`);
        } else {
            console.log("Helix Monitor: No 'data' array in API response or it's not an array.");
        }

        // Handle total_limit
        let apiTotalLimit = Infinity; // Default to no limit
        if (parsedResponse.limit === "") {
            apiTotalLimit = Infinity;
            console.log("Helix Monitor: API reports no limit (empty string).");
        } else if (parsedResponse.limit && !isNaN(parseInt(parsedResponse.limit, 10))) {
            apiTotalLimit = parseInt(parsedResponse.limit, 10);
            console.log(`Helix Monitor: API reports limit: ${apiTotalLimit}`);
        } else if (parsedResponse.hasOwnProperty('limit')) { // It has the key, but not empty or valid number
            console.warn(`Helix Monitor: API returned unexpected value for limit: "${parsedResponse.limit}". Treating as no limit.`);
            apiTotalLimit = Infinity;
        }

        const transformedData = {
            current_usage_count: activeMessages.length,
            messages: activeMessages, // These messages already have timestamp_ms
            total_limit: apiTotalLimit
        };
        // console.log('Helix Monitor: Transformed API Data:', JSON.stringify(transformedData, null, 2)); // For debugging
        return transformedData;

    } catch (error) {
        console.error('Helix Monitor: Network error or other issue fetching real Helix usage data:', error);
        throw error; // Re-throw to be caught by refreshUsageData
    }
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
            refreshUsageData(); 
        } else {
            if (nextMessageTimeText) nextMessageTimeText.textContent = `Next Message In: ${formatMillisecondsToTime(remainingMs)}`;
        }
    };

    updateTimerDisplay(); 
    usageCountdownInterval = setInterval(updateTimerDisplay, 1000);
}


// --- Main Data Refresh and UI Update Logic ---
async function refreshUsageData() {
    const messagesUsedText = document.getElementById('helix-messages-used-text');
    const nextMessageTimeText = document.getElementById('helix-next-message-time-text');

    if (!isHelixConfigActive) {
        console.warn("Helix Monitor: refreshUsageData called while not active. This is unexpected. Aborting.");
        return;
    }

    console.log('Helix Monitor: Refreshing Helix usage data...');
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
            return; 
        }
        console.log('Helix Monitor: API key retrieved successfully via findSecret.');
    } catch (err) {
        console.error('Helix Monitor: Error calling findSecret:', err);
        if (messagesUsedText) messagesUsedText.textContent = 'Messages Used: Key Error';
        if (nextMessageTimeText) nextMessageTimeText.textContent = 'Next Message In: Key Error';
        toastr.info('<h3>Helix Usage Monitor Error</h3><p>An error occurred while trying to retrieve the API key. Check the browser console for details.</p>', 'text');
        return; 
    }

    try {
        const data = await fetchHelixUsageData_real(helixApiKey); 

        if (messagesUsedText) {
            if (typeof data.total_limit === 'number' && isFinite(data.total_limit)) {
                messagesUsedText.textContent = `Messages Used: ${data.current_usage_count} / ${data.total_limit}`;
            } else { // No limit or invalid limit
                messagesUsedText.textContent = `Messages Used: ${data.current_usage_count}`;
            }
        }

        if (nextMessageTimeText) {
            if (data.current_usage_count === 0 || !data.messages || data.messages.length === 0) {
                nextMessageTimeText.textContent = 'Next Message In: Ready';
                clearInterval(usageCountdownInterval);
                nextMessageExpiryTimeMs = null; 
                console.log("Helix Monitor: No messages used or messages array empty. Timer cleared, UI set to Ready.");
            } else {
                const oldestMessageTimestampMs = data.messages[0].timestamp_ms;
                const calculatedExpiryTimeMs = oldestMessageTimestampMs + (24 * 60 * 60 * 1000);
                
                console.log(`Helix Monitor: Oldest msg ts (ms): ${oldestMessageTimestampMs}, Calculated expiry (ms): ${calculatedExpiryTimeMs}, Now (ms): ${Date.now()}`);

                if (calculatedExpiryTimeMs <= Date.now()) {
                    // Oldest message is already expired according to calculation
                    nextMessageTimeText.textContent = 'Next Message In: Slot Open!'; // Or "Ready"
                    clearInterval(usageCountdownInterval);
                    nextMessageExpiryTimeMs = null; // Clear stored expiry time
                    console.log("Helix Monitor: Oldest message already expired. UI updated, timer cleared. No immediate auto-refresh from this path.");
                    // Removed: setTimeout(refreshUsageData, 1500); // This was causing the loop
                } else {
                    // Oldest message has a future expiry time
                    startUsageCountdown(calculatedExpiryTimeMs);
                }
            }
        }

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
        console.warn("Helix Monitor: Main UI container not found in checkAndUpdateHelixUI.");
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
        // Even if main UI exists, ensure settings panel is added (idempotent if already there)
        // or that its interactive elements are correctly initialized.
        // Calling addHelixUsageSettingsPanel here ensures it runs.
        addHelixUsageSettingsPanel();
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
            const scrollableInner = leftNavPanel.querySelector('.scrollableInner .panels'); 
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
        console.warn("Could not find a suitable parent element in the left navbar for Helix Usage Monitor UI. Appending to body as a last resort.");
        document.body.appendChild(usageUI);
        injectionSuccessful = true; // Assuming append to body is a success for this flag's purpose
    }

    if (injectionSuccessful) {
        checkAndUpdateHelixUI();
        // Add the settings panel after the main UI is initialized and injected.
        addHelixUsageSettingsPanel();
    }
}

// Initialize the UI when the script loads
if (typeof jQuery !== 'undefined') {
    jQuery(async () => {
        initHelixUsageUI();
    });
} else {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHelixUsageUI);
    } else {
        initHelixUsageUI();
    }
}


// Listen for settings updates to re-evaluate conditions
eventSource.on(event_types.SETTINGS_UPDATED, () => {
    console.log("Helix Usage Monitor: SETTINGS_UPDATED event received.");
    checkAndUpdateHelixUI();
    // Also re-check the settings panel's toggle state in case settings were changed externally somehow
    const toggle = document.getElementById('helix-usage-hourly-toggle');
    if (toggle) {
        const currentSettings = getHelixUsageSettings();
        if (toggle.checked !== currentSettings.showHourlyBreakdown) {
            toggle.checked = currentSettings.showHourlyBreakdown;
            console.log("Helix Monitor: Settings panel toggle updated from SETTINGS_UPDATED event.");
        }
    }
});

// Listen for generation ended event to trigger refresh
eventSource.on(event_types.GENERATION_ENDED, (data) => {
    console.log("Helix Usage Monitor: GENERATION_ENDED event received.");
    if (isHelixConfigActive) {
        console.log("Helix Monitor: Active, refreshing data after generation ended.");
        refreshUsageData();
    }
});