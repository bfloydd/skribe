import { App } from 'obsidian';
// Import the SVG logo directly
import logoSvg from '../../assets/logo-150-34DNHXQ2.svg';

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
 * Gets the inline SVG logo data
 * This uses esbuild-plugin-inline-image to include the SVG directly
 */
export function getLogoPath(): string {
    // Return the imported SVG data directly
    return logoSvg;
} 