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
    public registerToolbar(config: ToolbarConfig): void {
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
    ): HTMLElement {
        const toolbarConfig = this.toolbarConfigs.get(toolbarId);
        
        if (!toolbarConfig) {
            console.error(`Toolbar configuration not found for ID: ${toolbarId}`);
            return container;
        }

        const buttonContainer = container.createDiv({
            cls: 'nav-buttons-container toolbar-container',
            attr: {
                'data-toolbar-id': toolbarId
            }
        });

        // Create buttons for each command in the toolbar
        toolbarConfig.commands.forEach(command => {
            this.createCommandButton(buttonContainer, command, context);
        });

        return buttonContainer;
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
        console.log(`Command ${actualCommand.id} isEnabled: ${isEnabled}`);
        
        const button = container.createEl('button', {
            cls: 'clickable-icon',
            attr: { 
                'aria-label': actualCommand.tooltip,
                'title': actualCommand.tooltip,
                'data-command-id': actualCommand.id,
                'disabled': !isEnabled
            }
        });
        
        setIcon(button, actualCommand.icon);
        
        if (!isEnabled) {
            button.addClass('disabled-button');
        }
        
        button.addEventListener('click', async (e) => {
            console.log(`Button clicked for command: ${actualCommand.id}`);
            e.preventDefault();
            e.stopPropagation();
            
            if (!isEnabled) {
                console.log(`Command ${actualCommand.id} is disabled, not executing`);
                return;
            }
            
            try {
                console.log(`Executing command: ${actualCommand.id}`);
                await actualCommand.execute(context);
                console.log(`Command ${actualCommand.id} executed successfully`);
            } catch (error) {
                console.error(`Error executing command ${actualCommand.id}:`, error);
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
        console.log('ToolbarService: Updating toolbar state');
        
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
            
            // Update button state
            const isEnabled = command.isEnabled(context);
            
            if (isEnabled) {
                button.removeAttribute('disabled');
                button.classList.remove('disabled-button');
            } else {
                button.setAttribute('disabled', 'true');
                button.classList.add('disabled-button');
            }
        });
    }
} 