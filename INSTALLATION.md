# Installation Guide

## Quick Setup

### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn package manager
- Obsidian (version 0.15.0 or higher)

### Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build the Plugin**
   ```bash
   npm run build
   ```

3. **Install in Obsidian**
   - Copy the following files to your vault's `.obsidian/plugins/obsidian-property-groups/` folder:
     - `main.js`
     - `manifest.json`
     - `styles.css`
   
   - Enable the plugin in Obsidian:
     - Go to Settings → Community Plugins
     - Find "Property Groups" in the list
     - Toggle it on

4. **First Use**
   - Click the tags icon in the ribbon to open the Property Groups panel
   - Configure settings in Settings → Plugin Options → Property Groups

## Development Setup

If you want to develop or modify the plugin:

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd obsidian-property-groups
   npm install
   ```

2. **Development Build**
   ```bash
   npm run dev
   ```
   This will start a watch mode that rebuilds the plugin when you make changes.

3. **Testing**
   - Make your changes
   - The plugin will auto-rebuild
   - Reload Obsidian or use Ctrl+R to see changes

## Troubleshooting

### Common Issues

1. **Plugin doesn't appear in Obsidian**
   - Ensure all three files (`main.js`, `manifest.json`, `styles.css`) are in the correct folder
   - Check that the folder is named exactly `obsidian-property-groups`
   - Restart Obsidian

2. **Build errors**
   - Ensure Node.js version is 16+
   - Delete `node_modules` and run `npm install` again
   - Check for TypeScript errors with `npm run build`

3. **Properties not showing**
   - Ensure your notes have frontmatter with properties
   - Check the excluded properties list in settings
   - Try refreshing the Property Groups panel

### Getting Help

- Check the README.md for detailed usage instructions
- Report issues on the GitHub repository
- Join the Obsidian community forums for general help 