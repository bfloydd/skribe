import { App, Modal, setIcon } from 'obsidian';

export class URLInputModal extends Modal {
    result: string;
    onSubmit: (result: string) => void;

    constructor(app: App, onSubmit: (result: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const {contentEl} = this;
        
        // Use max-width instead of fixed width for better responsiveness
        this.modalEl.style.width = "450px";
        this.modalEl.style.maxWidth = "520px";
        
        // Create a styled container for the title
        const titleContainer = contentEl.createDiv({
            cls: 'skribe-modal-title-container'
        });
        
        // Add the feather icon
        const iconEl = titleContainer.createSpan({
            cls: 'skribe-modal-icon'
        });
        setIcon(iconEl, 'feather');
        
        // Add the "Skribe a Video" text
        titleContainer.createSpan({
            text: "Skribe a Video",
            cls: 'skribe-modal-title'
        });
        
        // Create the input container
        const inputContainer = contentEl.createDiv({
            cls: 'skribe-modal-input-container'
        });
        
        // Create the input element with styling
        const inputEl = inputContainer.createEl("input", {
            type: "text",
            placeholder: "Enter YouTube URL...",
            cls: 'skribe-modal-input'
        });
        
        // Create the button with styling
        const buttonEl = inputContainer.createEl("button", {
            text: "Go!",
            cls: 'skribe-modal-button'
        });
        
        // Add CSS styles inline for consistency
        contentEl.style.padding = "15px";
        
        titleContainer.style.display = "flex";
        titleContainer.style.alignItems = "center";
        titleContainer.style.marginBottom = "15px";
        
        iconEl.style.color = "#7eb4ea";
        iconEl.style.marginRight = "8px";
        iconEl.style.width = "24px";
        iconEl.style.height = "24px";
        
        const titleSpan = titleContainer.querySelector('.skribe-modal-title') as HTMLElement;
        if (titleSpan) {
            titleSpan.style.fontSize = "1.2em";
            titleSpan.style.color = "#a1a1a1";
        }
        
        inputContainer.style.display = "flex";
        inputContainer.style.flexWrap = "wrap"; // Allow items to wrap on small screens
        inputContainer.style.gap = "10px";
        
        inputEl.style.flexGrow = "1";
        inputEl.style.flexBasis = "200px"; // This helps it wrap when container gets small
        inputEl.style.padding = "8px 12px";
        inputEl.style.borderRadius = "4px";
        inputEl.style.border = "1px solid var(--background-modifier-border)";
        inputEl.style.backgroundColor = "var(--background-primary-alt)";
        
        buttonEl.style.padding = "8px 16px";
        buttonEl.style.borderRadius = "4px";
        buttonEl.style.backgroundColor = "#d88686";
        buttonEl.style.color = "white";
        buttonEl.style.border = "none";
        buttonEl.style.cursor = "pointer";
        buttonEl.style.flexShrink = "0"; // Prevent button from shrinking
        
        // Add event listeners
        buttonEl.addEventListener("click", () => {
            this.onSubmit(inputEl.value);
            this.close();
        });

        inputEl.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                this.onSubmit(inputEl.value);
                this.close();
            }
        });
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
} 