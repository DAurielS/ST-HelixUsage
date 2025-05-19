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

    // Attempt to find a suitable parent in the left navbar
    // Primary target is 'left-nav-panel' based on index.html analysis.
    let parentElement = document.getElementById('left-nav-panel');

    if (parentElement) {
        // Check if the scrollable inner div exists, common in ST panels
        const scrollableInner = parentElement.querySelector('.scrollableInner');
        if (scrollableInner) {
            scrollableInner.appendChild(usageUI);
            console.log("Helix Usage Monitor UI appended to '.scrollableInner' within '#left-nav-panel'.");
        } else {
            parentElement.appendChild(usageUI);
            console.log("Helix Usage Monitor UI appended to '#left-nav-panel'.");
        }
    } else {
        // Fallback if '#left-nav-panel' is not found
        console.warn("'#left-nav-panel' not found. Attempting fallback selectors.");
        parentElement = document.getElementById('extensions_settings') || document.getElementById('extensions_settings2');
        if (parentElement) {
            // If #extensions_settings or #extensions_settings2 is found, append to its parent
            if (parentElement.parentElement) {
                parentElement.parentElement.appendChild(usageUI);
                console.log("Helix Usage Monitor UI appended to parent of #extensions_settings or #extensions_settings2.");
            } else {
                parentElement.insertAdjacentElement('afterend', usageUI);
                console.log("Helix Usage Monitor UI inserted after #extensions_settings or #extensions_settings2.");
            }
        } else {
            parentElement = document.querySelector('#rm_api_block') || // Another settings panel
                            document.querySelector('#AdvancedFormatting') || // Another settings panel
                            document.querySelector('#WorldInfo') || // World Info panel
                            document.querySelector('#user-settings-block') || // User settings panel
                            document.querySelector('.list-group.menu_list.sortableflex'); // General menu list

            if (parentElement) {
                parentElement.appendChild(usageUI);
                console.log("Helix Usage Monitor UI appended to a fallback panel.");
            } else {
                // Last resort: append to body.
                console.warn("Could not find a suitable parent element for Helix Usage Monitor UI. Appending to body as a last resort.");
                document.body.appendChild(usageUI);
            }
        }
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