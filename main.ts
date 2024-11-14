import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, Command } from 'obsidian';

// Remember to rename these classes and interfaces!

interface VTSSettings {
	youtubeApiKey: string;
}

const DEFAULT_SETTINGS: VTSSettings = {
	youtubeApiKey: ''
}

export const VIEW_TYPE_TRANSCRIPTION = "transcription-view";

export class TranscriptionView extends ItemView {
	content: string;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.content = '';
	}

	getViewType() {
		return VIEW_TYPE_TRANSCRIPTION;
	}

	getDisplayText() {
		return "Video Transcription";
	}

	setContent(content: string) {
		this.content = content;
		this.refresh();
	}

	async onOpen() {
		this.refresh();
	}

	async refresh() {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl("div", { text: this.content });
	}
}

export default class VTS extends Plugin {
	settings: VTSSettings;
	view: TranscriptionView;

	async onload() {
		console.log('Loading VTS plugin...');
		
		await this.loadSettings();

		// Register the view
		this.registerView(
			VIEW_TYPE_TRANSCRIPTION,
			(leaf) => new TranscriptionView(leaf)
		);

		// Add command with explicit editor check
		this.addCommand({
			id: 'vts-get-selected-transcript',
			name: 'VTS: Get Selected Video Transcript',
			icon: 'quote',
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView) {
					if (!checking) {
						this.handleTranscriptRequest(activeView).catch(console.error);
					}
					return true;
				}
				return false;
			}
		});

		console.log('VTS plugin loaded, command registered');
		
		this.addSettingTab(new VTSSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;
		
		let leaf = workspace.getRightLeaf(false);
		if (!leaf) {
			leaf = workspace.getLeaf('split', 'vertical');
		}
		
		await leaf.setViewState({
			type: VIEW_TYPE_TRANSCRIPTION,
			active: true,
		});

		this.view = leaf.view as TranscriptionView;
		return this.view;
	}

	async getYouTubeTranscript(videoId: string): Promise<string> {
		// This is where you'd implement the YouTube API call
		// You'll need to use the YouTube Data API or a third-party library
		// For now, returning a placeholder
		return `Transcript for video ${videoId}`;
	}

	isYouTubeUrl(url: string): boolean {
		const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
		return pattern.test(url);
	}

	extractVideoId(url: string): string | null {
		const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
		const match = url.match(regExp);
		return (match && match[2].length === 11) ? match[2] : null;
	}

	private async handleTranscriptRequest(activeView: MarkdownView) {
		const editor = activeView.editor;
		const selection = editor.getSelection();
		if (!selection) {
			new Notice('Please select a YouTube URL first');
			return;
		}

		if (!this.isYouTubeUrl(selection)) {
			new Notice('Invalid YouTube URL. Please select a valid YouTube URL');
			return;
		}

		const videoId = this.extractVideoId(selection);
		if (!videoId) {
			new Notice('Could not extract video ID from the URL');
			return;
		}

		new Notice('Fetching transcript...');
		try {
			const transcript = await this.getYouTubeTranscript(videoId);
			const view = await this.activateView();
			view.setContent(transcript);
			new Notice('Transcript loaded successfully');
		} catch (error) {
			new Notice('Failed to fetch transcript. Check console for details');
			console.error('VTS Transcript Error:', error);
		}
	}
}

class VTSModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class VTSSettingTab extends PluginSettingTab {
	plugin: VTS;

	constructor(app: App, plugin: VTS) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('YouTube API Key')
			.setDesc('Enter your YouTube Data API key')
			.addText(text => text
				.setPlaceholder('Enter API key')
				.setValue(this.plugin.settings.youtubeApiKey)
				.onChange(async (value) => {
					this.plugin.settings.youtubeApiKey = value;
					await this.plugin.saveSettings();
				}));
	}
}
