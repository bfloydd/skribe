import { App, Modal } from 'obsidian';

export class URLInputModal extends Modal {
    result: string;
    onSubmit: (result: string) => void;

    constructor(app: App, onSubmit: (result: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.createEl("h2", { text: "Enter YouTube URL" });

        const inputEl = contentEl.createEl("input", {
            type: "text",
            placeholder: "https://www.youtube.com/watch?v=..."
        });
        inputEl.style.width = "100%";
        inputEl.style.marginBottom = "1em";

        const buttonEl = contentEl.createEl("button", {
            text: "Get Transcript"
        });
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