// SillyTavern Helix Usage Monitor Extension

// Get the SillyTavern context
const context = SillyTavern.getContext();

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