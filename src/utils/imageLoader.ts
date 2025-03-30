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
    // Try assets directory first (prefer it if exists)
    try {
        const assetsPath = getAssetPath(app, pluginDir, 'assets/logo-34DNHXQ2.png');
        // Log the path for debugging
        console.log('Trying logo path: ', assetsPath);
        return assetsPath;
    } catch (e) {
        // If that fails, fall back to root level
        console.log('Could not find logo in assets folder, trying root level');
        try {
            return getAssetPath(app, pluginDir, 'logo-34DNHXQ2.png');
        } catch (e) {
            console.log('Could not find logo at root level either, using hardcoded path');
            // Last resort: just use a direct path that should work in most cases
            return `${pluginDir}/logo-34DNHXQ2.png`;
        }
    }
} 