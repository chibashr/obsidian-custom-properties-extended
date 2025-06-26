# Obsidian Property Groups Plugin

A powerful Obsidian plugin that allows you to easily group and manage custom properties across your vault, with automatic linking between properties and source pages.

## Features

### 🏷️ Property Grouping
- **Visual Property Organization**: View all your custom properties grouped by name and value in a dedicated right sidebar panel
- **Hierarchical Display**: Properties are organized in a collapsible tree structure showing property names, their values, and associated files
- **Smart List Handling**: Arrays are automatically broken down into individual items (e.g., `people: [John, Jane, Bob]` shows as separate entries for John, Jane, and Bob)
- **Clean Data**: Automatically excludes null, empty, and undefined property values from grouping
- **Smart Filtering**: Exclude specific properties from the groups view
- **Quick Navigation**: Click on any file in the groups to open it instantly

### 🔗 Automatic Property Linking
- **Source Page Management**: Automatically maintain links on designated "source pages" based on property values
- **Dynamic Updates**: Links are automatically added when properties are set and removed when properties are changed or deleted
- **Flexible Configuration**: Set up multiple property-to-page relationships with custom headings

## Installation

### Manual Installation
1. Download the latest release from the GitHub releases page
2. Extract the files to your vault's `.obsidian/plugins/obsidian-property-groups/` folder
3. Enable the plugin in Obsidian's Community Plugins settings

### Building from Source
1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the plugin
4. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin folder

## Usage

### Viewing Property Groups

1. **Open the Property Groups Panel**: 
   - Click the tags icon in the ribbon, or
   - Use the command palette: "Property Groups: Open Property Groups"

2. **Navigate the Interface**:
   - Properties are listed alphabetically with expandable sections
   - Each property shows its values and the count of files using each value
   - Click on property names or values to expand/collapse sections
   - Click on file names to open them

### Configuring Property Source Pages

1. **Open Settings**: Go to Settings → Plugin Options → Property Groups

2. **Set Up Excluded Properties**:
   - Add property names (comma-separated) that you want to hide from the groups view
   - Useful for system properties or properties you don't want to group

3. **Configure Source Pages**:
   - Click "Add Configuration" to create a new property source page setup
   - A dialog will open with auto-completion for:
     - Property names (from existing properties in your vault)
     - Property values (based on the selected property)
     - Target pages (from existing note names)
     - Headings (common heading suggestions)
   - View all configurations in a compact table format
   - Edit, enable/disable, or delete configurations easily

## Use Cases

### Use Case 1: Customer Property Grouping
**Scenario**: You want to see all pages associated with a specific customer.

**Setup**: No additional configuration needed - just use the Property Groups panel.

**Usage**: 
1. Open the Property Groups panel
2. Find the "customer" property
3. Expand to see all values including your customer name
4. Click on the customer name to see all associated pages
5. Click on any page name to open it

### Use Case 2: Project Page Auto-Linking
**Scenario**: Automatically maintain links on project pages for all notes with matching project properties.

**Setup**:
1. Go to Settings → Property Groups
2. Click "Add Configuration" to create a new setup
3. In the dialog, configure:
   - Property Name: `project` (auto-completed from existing properties)
   - Property Value: `PROJ-001` (auto-completed from existing values for "project")
   - Target Page: `Project PROJ-001` (auto-completed from existing page names)
   - Target Heading: `Associated Pages` (choose from common suggestions)
4. Save the configuration

**Result**: 
- When you add `project: PROJ-001` to any note's frontmatter, a link to that note automatically appears on the "Project PROJ-001" page under "# Associated Pages"
- When you remove the property, the link is automatically removed
- The target page is created automatically if it doesn't exist