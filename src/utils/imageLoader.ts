import { App } from 'obsidian';

/**
 * Returns the path to an asset using Obsidian's resource path system
 * @param app The Obsidian app instance
 * @param pluginDir The plugin directory name
 * @param assetPath The asset path relative to the plugin root
 */
export function getAssetPath(app: App, pluginDir: string, assetPath: string): string {
    return app.vault.adapter.getResourcePath(`${pluginDir}/${assetPath}`);
}

/**
 * Gets the path to the logo image
 * @param app The Obsidian app instance
 * @param pluginDir The plugin directory name
 */
export function getLogoPath(app: App, pluginDir: string): string {
    return getAssetPath(app, pluginDir, 'assets/logo-34DNHXQ2.png');
} 