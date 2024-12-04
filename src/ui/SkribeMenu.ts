import { setIcon } from 'obsidian';
import type SkribePlugin from '../../main';

export class SkribeMenu {
    private menu: HTMLElement;
    private plugin: SkribePlugin;

    constructor(plugin: SkribePlugin) {
        this.plugin = plugin;
        this.initialize();
    }

    private initialize() {
        // Create menu container
        this.menu = document.createElement('div');
        this.menu.addClass('skribe-menu');
        document.body.appendChild(this.menu);

        // Create menu header
        const header = this.menu.createDiv({ cls: 'skribe-menu-header' });
        header.createDiv({ cls: 'skribe-menu-title', text: 'Skribe' });
        const closeButton = header.createDiv({ cls: 'skribe-menu-close' });
        setIcon(closeButton, 'x');

        // Create menu items
        this.createMenuItem('play-circle', 'Get Transcript by URL', () => {
            this.hide();
            this.plugin.handlePromptCommand();
        });

        this.createMenuItem('text', 'Get Transcript from Selection', () => {
            this.hide();
            this.plugin.handleSelectionCommand();
        });

        this.createMenuItem('link', 'Replace with Skribe Link', () => {
            this.hide();
            this.plugin.handleReplaceCommand();
        });

        // Close button handler
        closeButton.addEventListener('click', () => this.hide());

        // Close menu when clicking outside
        document.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!this.menu.contains(target) && 
                !this.plugin.app.workspace.containerEl.querySelector('.side-dock-ribbon-action')?.contains(target)) {
                this.hide();
            }
        });
    }

    private createMenuItem(icon: string, text: string, callback: () => void) {
        const item = this.menu.createDiv({ cls: 'skribe-menu-item' });
        const iconDiv = item.createDiv({ cls: 'skribe-menu-item-icon' });
        setIcon(iconDiv, icon);
        item.createSpan({ text });
        item.addEventListener('click', callback);
    }

    public show() {
        this.menu.addClass('active');
    }

    public hide() {
        this.menu.removeClass('active');
    }

    public toggle() {
        if (this.menu.hasClass('active')) {
            this.hide();
        } else {
            this.show();
        }
    }
} 