// SillyTavern Helix Usage Monitor Extension

import { eventSource, event_types } from "../../../../script.js";

// Get the SillyTavern context
const context = SillyTavern.getContext();

// Variable to store if Helix configuration is active
let isHelixConfigActive = false;

// Log to confirm the extension is loaded
console.log("Helix Usage Monitor extension loaded.");

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
    // Log the entire context and context.settings to check their availability and structure
    console.log('Helix Monitor Debug: SillyTavern.getContext() result:', context);
    console.log('Helix Monitor Debug: context.settings object:', context?.settings); // Keep for one more check if needed
    console.log('Helix Monitor Debug: context.chatCompletionSettings object:', context?.chatCompletionSettings);

    const uiContainer = document.getElementById('helix-usage-container');
    if (!uiContainer) {
        console.warn("Helix Usage Monitor: UI container not found in checkAndUpdateHelixUI.");
        return;
    }


    const currentSettings = context.chatCompletionSettings; // *** Changed from context.settings ***
    let isActive = false;
    const helixUrlPattern = 'https://helixmind.online';

    // Log the relevant settings from context for debugging
    // Log the relevant settings from context.chatCompletionSettings for debugging
    console.log('Helix Monitor Debug (using chatCompletionSettings): chat_completion_source =', currentSettings?.chat_completion_source,
                '| custom_url =', currentSettings?.custom_url,
                '| api_server =', currentSettings?.api_server); // api_server might be elsewhere or not in chatCompletionSettings

    // Primary Check: If 'Custom' provider is selected
    if (currentSettings?.chat_completion_source === 'custom') {
        const customUrl = currentSettings?.custom_url ?? '';
        if (customUrl.startsWith(helixUrlPattern)) {
            isActive = true;
        }
    }
    // Secondary Check: If a generic 'api_server' is pointing to Helix
    else if (currentSettings?.api_server?.startsWith(helixUrlPattern)) {
        isActive = true;
    }

    isHelixConfigActive = isActive; // Update the global state

    if (isHelixConfigActive) {
        uiContainer.classList.add('helix-active');
        // uiContainer.style.display = ''; // Old method
        console.log('Helix Monitor: Detected active Helix endpoint. API key is expected to be configured and will be handled by SillyTavern for requests.');
    } else {
        uiContainer.classList.remove('helix-active');
        // uiContainer.style.display = 'none'; // Old method
        console.log('Helix Monitor: Helix endpoint not detected as active based on current settings.');
    }
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
// Ensuring the DOM is likely ready for manipulation.
// SillyTavern extensions often run after initial DOM load.
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