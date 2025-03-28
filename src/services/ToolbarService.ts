import { setIcon, Notice } from 'obsidian';
import { ToolbarCommand, ToolbarConfig, CommandContext } from '../types';

/**
 * ToolbarService - Manages toolbar commands and configurations
 * Uses Command Pattern for individual actions and Composite Pattern for grouping commands
 */
export class ToolbarService {
    private static instance: ToolbarService;
    private toolbarConfigs: Map<string, ToolbarConfig> = new Map();
    private commonCommands: Map<string, ToolbarCommand> = new Map();

    // CRITICAL: Map to store strong references to view instances
    private viewRefs: Map<string, any> = new Map();

    private constructor() {}

    /**
     * Get singleton instance
     */
    public static getInstance(): ToolbarService {
        if (!ToolbarService.instance) {
            ToolbarService.instance = new ToolbarService();
        }
        return ToolbarService.instance;
    }

    /**
     * Register a common command that can be shared across toolbars
     */
    public registerCommonCommand(command: ToolbarCommand): void {
        this.commonCommands.set(command.id, command);
    }

    /**
     * Register multiple common commands
     */
    public registerCommonCommands(commands: ToolbarCommand[]): void {
        commands.forEach(cmd => this.registerCommonCommand(cmd));
    }

    /**
     * Register a toolbar configuration
     */
    public registerToolbarConfig(config: ToolbarConfig): void {
        this.toolbarConfigs.set(config.id, config);
    }

    /**
     * Get a toolbar configuration by ID
     */
    public getToolbarConfig(id: string): ToolbarConfig | undefined {
        return this.toolbarConfigs.get(id);
    }

    /**
     * Get a common command by ID
     */
    public getCommonCommand(id: string): ToolbarCommand | undefined {
        return this.commonCommands.get(id);
    }

    /**
     * Create a toolbar in the provided container element
     */
    public createToolbar(
        container: HTMLElement, 
        toolbarId: string, 
        context: CommandContext
    ): void {
        console.log(`Creating toolbar: ${toolbarId}`);
        
        // Clear existing contents
        container.empty();
        
        // Set toolbar ID for later reference
        container.setAttribute('data-toolbar-id', toolbarId);
        
        // Get the toolbar config
        const config = this.toolbarConfigs.get(toolbarId);
        
        if (!config) {
            console.error(`Toolbar config not found for: ${toolbarId}`);
            return;
        }
        
        // CRITICAL: Store a strong reference to the view instance with a unique ID
        // This is the key to making buttons work later
        if (context.view) {
            const viewInstanceId = `view_${toolbarId}_${Date.now()}`;
            this.viewRefs.set(viewInstanceId, context.view);
            container.setAttribute('data-view-id', viewInstanceId);
            console.log(`Stored view reference with ID: ${viewInstanceId}`, context.view);
        } else {
            console.warn(`No view instance found in context for toolbar: ${toolbarId}`);
        }
        
        // Create buttons for commands
        config.commands.forEach(command => {
            this.createCommandButton(container, command, context);
        });
    }

    /**
     * Create a button for a command
     */
    private createCommandButton(
        container: HTMLElement, 
        command: ToolbarCommand, 
        context: CommandContext
    ): HTMLElement {
        console.log(`Creating button for command: ${command.id}`);
        
        // CRITICAL: Get the view instance ID and retrieve the strong reference
        const viewInstanceId = container.getAttribute('data-view-id');
        const viewRef = viewInstanceId ? this.viewRefs.get(viewInstanceId) : null;
        
        if (viewRef) {
            console.log(`Retrieved view reference for command ${command.id} from ID: ${viewInstanceId}`);
        } else {
            console.warn(`No view reference found for command: ${command.id}`);
        }
        
        // Check if this is a reference to a common command
        let actualCommand = command;
        
        if (command.id.startsWith('common:')) {
            const commonCommandId = command.id.substring(7);
            const commonCommand = this.commonCommands.get(commonCommandId);
            
            if (commonCommand) {
                console.log(`Found common command for: ${commonCommandId}`);
                actualCommand = commonCommand;
            } else {
                console.warn(`Common command not found for: ${commonCommandId}`);
            }
        }

        const isEnabled = actualCommand.isEnabled(context);
        
        // Debug logging for why buttons may be disabled
        if (!isEnabled) {
            console.log(`Command ${actualCommand.id} is DISABLED. Context:`, {
                hasContent: !!context.content,
                contentLength: context.content?.length,
                activeTab: context.activeTab,
                hasPlugin: !!context.plugin, 
                hasApiKey: !!context.plugin?.settings?.openaiApiKey,
                commandId: actualCommand.id
            });
        } else {
            console.log(`Command ${actualCommand.id} is ENABLED`);
        }
        
        // Create button with Obsidian's DOM API
        const button = container.createEl('button', {
            cls: `clickable-icon toolbar-button ${!isEnabled ? 'disabled-button' : ''}`,
            attr: { 
                'aria-label': actualCommand.tooltip,
                'title': actualCommand.tooltip,
                'data-command-id': actualCommand.id,
            }
        });
        
        // Set button style based on enabled state
        if (!isEnabled) {
            button.style.opacity = '0.5';
            button.style.cursor = 'not-allowed';
            button.style.pointerEvents = 'none'; // Make it not clickable
        }
        
        console.log(`Button created for ${actualCommand.id}, classNames: ${button.className}, disabled: ${!isEnabled}`);
        
        // Set the icon
        setIcon(button, actualCommand.icon);
        
        // Add click handler with the viewRef captured in its closure
        // Using function() instead of arrow function to maintain proper this binding
        button.addEventListener('click', function(e) {
            // If button is disabled, don't process click
            if (button.classList.contains('disabled-button')) {
                return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            
            console.log(`%c TOOLBAR BUTTON CLICKED: ${actualCommand.id}`, 'background: #444; color: white; font-size: 14px; padding: 3px;');
            
            try {
                // Direct method calling using the strong viewRef - this is key to making it work
                if (viewRef) {
                    // Handle special commands with direct method calls
                    if (actualCommand.id === 'enhance-ai' && typeof viewRef.enhanceWithAI === 'function') {
                        console.log(`Directly calling enhanceWithAI on view instance`);
                        viewRef.enhanceWithAI();
                        return;
                    } 
                    else if (actualCommand.id === 'create-revised' && typeof viewRef.createRevisedContent === 'function') {
                        console.log(`Directly calling createRevisedContent on view instance`);
                        viewRef.createRevisedContent();
                        return;
                    }
                    else if (actualCommand.id === 'start-over' && typeof viewRef.resetView === 'function') {
                        console.log(`Directly calling resetView on view instance`);
                        viewRef.resetView();
                        return;
                    }
                }
                
                // Fall back to execute if direct method call didn't happen
                actualCommand.execute(context);
            } catch (error) {
                console.error(`Error handling button click for command ${actualCommand.id}:`, error);
                new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
        
        return button;
    }

    /**
     * Create a composite toolbar by combining multiple toolbar configurations
     */
    public createCompositeToolbar(
        container: HTMLElement,
        toolbarIds: string[],
        context: CommandContext
    ): HTMLElement {
        const buttonContainer = container.createDiv({
            cls: 'nav-buttons-container toolbar-container composite-toolbar',
            attr: {
                'data-toolbar-ids': toolbarIds.join(',')
            }
        });

        // Collect all commands from the specified toolbars
        const allCommands: ToolbarCommand[] = [];
        
        toolbarIds.forEach(id => {
            const config = this.toolbarConfigs.get(id);
            if (config) {
                allCommands.push(...config.commands);
            }
        });

        // Create buttons for each command
        allCommands.forEach(command => {
            this.createCommandButton(buttonContainer, command, context);
        });

        return buttonContainer;
    }

    /**
     * Update the state of an existing toolbar
     */
    public updateToolbarState(
        container: HTMLElement,
        context: CommandContext
    ): void {
        console.log('Updating toolbar state');
        
        // Find all buttons in the container
        const buttons = container.querySelectorAll('button[data-command-id]');
        
        buttons.forEach(button => {
            const commandId = button.getAttribute('data-command-id');
            if (!commandId) return;
            
            // Find the command
            let command: ToolbarCommand | undefined;
            
            if (commandId.startsWith('common:')) {
                command = this.commonCommands.get(commandId.substring(7));
            } else {
                // Find the toolbar config
                const toolbarId = container.getAttribute('data-toolbar-id');
                if (!toolbarId) return;
                
                const toolbarConfig = this.toolbarConfigs.get(toolbarId);
                if (!toolbarConfig) return;
                
                command = toolbarConfig.commands.find(cmd => cmd.id === commandId);
            }
            
            if (!command) return;
            
            // Update button state based on isEnabled
            const isEnabled = command.isEnabled(context);
            const buttonEl = button as HTMLElement;
            
            if (isEnabled) {
                // Enable the button
                buttonEl.classList.remove('disabled-button');
                buttonEl.style.opacity = '1';
                buttonEl.style.cursor = 'pointer';
                buttonEl.style.pointerEvents = 'auto';
                console.log(`Updated button ${commandId} to ENABLED state`);
            } else {
                // Disable the button
                buttonEl.classList.add('disabled-button');
                buttonEl.style.opacity = '0.5';
                buttonEl.style.cursor = 'not-allowed';
                buttonEl.style.pointerEvents = 'none'; // Make it not clickable
                console.log(`Updated button ${commandId} to DISABLED state (not clickable)`);
            }
        });
    }

    /**
     * Clean up references when a view is destroyed
     * This is important to prevent memory leaks
     */
    public cleanupViewReferences(toolbarId: string): void {
        const prefix = `view_${toolbarId}_`;
        const keysToRemove: string[] = [];
        
        // Find all keys that match the prefix
        this.viewRefs.forEach((_, key) => {
            if (key.startsWith(prefix)) {
                keysToRemove.push(key);
            }
        });
        
        // Remove the references
        keysToRemove.forEach(key => {
            this.viewRefs.delete(key);
            console.log(`Removed view reference: ${key}`);
        });
    }
} 