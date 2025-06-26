import { Plugin, WorkspaceLeaf, TFile, CachedMetadata, MetadataCache, Vault, Notice } from 'obsidian';
import { PropertyGroupsView, VIEW_TYPE_PROPERTY_GROUPS } from './src/PropertyGroupsView';
import { PropertyGroupsSettingTab } from './src/PropertyGroupsSettingTab';
import { PropertySourceManager } from './src/PropertySourceManager';

export interface PropertyGroupsSettings {
	excludedProperties: string[];
	sourcePages: PropertySourceConfig[];
}

export interface PropertySourceConfig {
	propertyName: string;
	propertyValue: string;
	targetPage: string;
	targetHeading: string;
	enabled: boolean;
}

const DEFAULT_SETTINGS: PropertyGroupsSettings = {
	excludedProperties: [],
	sourcePages: []
};

export default class PropertyGroupsPlugin extends Plugin {
	settings: PropertyGroupsSettings = DEFAULT_SETTINGS;
	propertySourceManager: PropertySourceManager = new PropertySourceManager(this.app, this.settings);

	async onload() {
		await this.loadSettings();

		// Initialize property source manager
		this.propertySourceManager = new PropertySourceManager(this.app, this.settings);

		// Register view
		this.registerView(
			VIEW_TYPE_PROPERTY_GROUPS,
			(leaf) => new PropertyGroupsView(leaf, this)
		);

		// Add ribbon icon (left sidebar like calendar plugin)
		this.addRibbonIcon('tags', 'Custom Properties Extended', () => {
			this.activateView();
		});

		// Add command
		this.addCommand({
			id: 'open-property-groups',
			name: 'Open Custom Properties Extended',
			callback: () => {
				this.activateView();
			}
		});

		// Register events for property source management
		this.registerEvent(
			this.app.metadataCache.on('changed', (file, data, cache) => {
				this.propertySourceManager.handleFileChange(file, cache);
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile) {
					this.propertySourceManager.handleFileDelete(file);
				}
			})
		);

		// Add settings tab
		this.addSettingTab(new PropertyGroupsSettingTab(this.app, this));

		// Initialize property source manager on startup
		this.app.workspace.onLayoutReady(() => {
			this.propertySourceManager.initializeAllSourcePages();
		});
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_PROPERTY_GROUPS);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.propertySourceManager.updateSettings(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_PROPERTY_GROUPS);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_PROPERTY_GROUPS, active: true });
			}
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	private isEmptyValue(value: any): boolean {
		if (value === null || value === undefined) return true;
		if (typeof value === 'string' && value.trim() === '') return true;
		if (Array.isArray(value) && value.length === 0) return true;
		if (Array.isArray(value) && value.every(item => this.isEmptyValue(item))) return true;
		return false;
	}

	normalizePropertyValue(value: any): string[] {
		if (this.isEmptyValue(value)) return [];
		
		if (Array.isArray(value)) {
			// Handle arrays by flattening and processing each item
			const results: string[] = [];
			for (const item of value) {
				if (!this.isEmptyValue(item)) {
					if (Array.isArray(item)) {
						// Nested array - recursively process
						results.push(...this.normalizePropertyValue(item));
					} else {
						// Convert to string and trim
						const stringValue = String(item).trim();
						if (stringValue !== '') {
							results.push(stringValue);
						}
					}
				}
			}
			return results;
		} else {
			// Single value - convert to string and return as array
			const stringValue = String(value).trim();
			return stringValue !== '' ? [stringValue] : [];
		}
	}

	getPropertyGroups(): Map<string, Map<string, TFile[]>> {
		const propertyGroups = new Map<string, Map<string, TFile[]>>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const frontmatter = cache.frontmatter;
			
			for (const [key, value] of Object.entries(frontmatter)) {
				// Skip excluded properties
				if (this.settings.excludedProperties.includes(key)) continue;
				
				// Skip system properties
				if (key.startsWith('__') || key === 'position') continue;

				// Skip empty values
				if (this.isEmptyValue(value)) continue;

				// Normalize the property value(s)
				const normalizedValues = this.normalizePropertyValue(value);
				
				// Skip if no valid values after normalization
				if (normalizedValues.length === 0) continue;

				if (!propertyGroups.has(key)) {
					propertyGroups.set(key, new Map());
				}

				const valueGroups = propertyGroups.get(key)!;

				// Add each normalized value separately
				for (const normalizedValue of normalizedValues) {
					if (!valueGroups.has(normalizedValue)) {
						valueGroups.set(normalizedValue, []);
					}
					valueGroups.get(normalizedValue)!.push(file);
				}
			}
		}

		return propertyGroups;
	}



	async bulkReplacePropertyValue(propertyName: string, oldValue: string, newValue: string): Promise<number> {
		const files = this.app.vault.getMarkdownFiles();
		let modifiedCount = 0;
		
		console.log(`[Bulk Replace] Starting bulk replacement: ${propertyName}: "${oldValue}" -> "${newValue}"`);

		for (const file of files) {
			try {
				const content = await this.app.vault.read(file);
				const cache = this.app.metadataCache.getFileCache(file);
				
				if (!cache?.frontmatter) continue;

				const frontmatter = cache.frontmatter;
				const propertyValue = frontmatter[propertyName];

				if (propertyValue === undefined || propertyValue === null) continue;

				// Check if the property contains the old value
				const normalizedValues = this.normalizePropertyValue(propertyValue);
				const hasOldValue = normalizedValues.includes(oldValue);
				
				console.log(`[Bulk Replace] File: ${file.path}`);
				console.log(`[Bulk Replace] Property value:`, propertyValue);
				console.log(`[Bulk Replace] Normalized values:`, normalizedValues);
				console.log(`[Bulk Replace] Has old value "${oldValue}":`, hasOldValue);

				if (hasOldValue) {
					let newContent = content;
					
					// Split content into frontmatter and body
					const frontmatterRegex = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/;
					const match = content.match(frontmatterRegex);
					
					if (match) {
						console.log(`[Bulk Replace] Found frontmatter in ${file.path}`);
						const frontmatterContent = match[1];
						const bodyContent = content.slice(match[0].length);
						
						// Process the frontmatter line by line
						const lines = frontmatterContent.split(/\r?\n/);
						const newLines = [];
						let inTargetProperty = false;
						let propertyIndent = '';
						let modified = false;
						
						for (let i = 0; i < lines.length; i++) {
							const line = lines[i];
							
							// Check if this is the start of our target property
							const propertyMatch = line.match(new RegExp(`^(\\s*)(${this.escapeRegex(propertyName)}):\\s*(.*)$`));
							
							if (propertyMatch) {
								console.log(`[Bulk Replace] Found property line: "${line}"`);
								const indent = propertyMatch[1];
								const propName = propertyMatch[2];
								const valueText = propertyMatch[3].trim();
								
								inTargetProperty = true;
								propertyIndent = indent;
								
								if (Array.isArray(propertyValue)) {
									// Handle multi-line YAML list format
									if (valueText === '' || valueText === '[]') {
										// Property has array values on following lines
										newLines.push(line);
									} else {
										// Inline array format - convert to multi-line
										newLines.push(`${indent}${propName}:`);
									}
								} else {
									// Handle single value properties
									if (String(propertyValue) === oldValue) {
										let formattedNewValue = newValue;
										if (typeof newValue === 'string' && /[\s:#\[\]{}|>]/.test(newValue)) {
											formattedNewValue = `"${String(newValue).replace(/"/g, '\\"')}"`;
										}
										const newLine = `${indent}${propName}: ${formattedNewValue}`;
										console.log(`[Bulk Replace] Single value replacement: "${line}" -> "${newLine}"`);
										newLines.push(newLine);
										modified = true;
										inTargetProperty = false;
									} else {
										newLines.push(line);
										inTargetProperty = false;
									}
								}
							} else if (inTargetProperty && line.match(/^\s*-\s+/)) {
								// This is a list item for our target property
								const listItemMatch = line.match(/^(\s*-\s+)(.*)$/);
								if (listItemMatch) {
									const listPrefix = listItemMatch[1];
									const itemValue = listItemMatch[2].trim();
									
									// Remove quotes if present
									const cleanValue = itemValue.replace(/^["']|["']$/g, '');
									
									console.log(`[Bulk Replace] Found list item: "${cleanValue}"`);
									
									if (cleanValue === oldValue) {
										let formattedNewValue = newValue;
										if (typeof newValue === 'string' && /[\s:#\[\]{}|>]/.test(newValue)) {
											formattedNewValue = `"${newValue}"`;
										}
										const newLine = `${listPrefix}${formattedNewValue}`;
										console.log(`[Bulk Replace] List item replacement: "${line}" -> "${newLine}"`);
										newLines.push(newLine);
										modified = true;
									} else {
										newLines.push(line);
									}
								} else {
									newLines.push(line);
								}
							} else if (inTargetProperty && line.trim() === '') {
								// Empty line within property - keep it
								newLines.push(line);
							} else if (inTargetProperty && line.match(/^\S/) || (inTargetProperty && line.match(/^\s/) && !line.match(new RegExp(`^${propertyIndent}\\s`)))) {
								// We've hit a new property or line that's not part of our target property
								inTargetProperty = false;
								newLines.push(line);
							} else {
								// Regular line or line not related to our property
								if (inTargetProperty && line.match(new RegExp(`^${propertyIndent}\\s`))) {
									// This line is still part of our property but not a list item
									// Could be a comment or other YAML structure
									newLines.push(line);
								} else {
									inTargetProperty = false;
									newLines.push(line);
								}
							}
						}
						
						// If we were processing an array and need to add the new items
						if (Array.isArray(propertyValue) && modified) {
							console.log(`[Bulk Replace] Array was modified, rebuilding list`);
							// Find where our property starts and rebuild the entire list
							const rebuiltLines = [];
							let skipMode = false;
							let foundProperty = false;
							
							for (const line of newLines) {
								const propertyMatch = line.match(new RegExp(`^(\\s*)(${this.escapeRegex(propertyName)}):\\s*(.*)$`));
								if (propertyMatch && !foundProperty) {
									foundProperty = true;
									const indent = propertyMatch[1];
									rebuiltLines.push(`${indent}${propertyName}:`);
									
									// Add all the updated array items
									const newArray = propertyValue.map(val => {
										const stringVal = String(val);
										return stringVal === oldValue ? newValue : val;
									});
									
									for (const item of newArray) {
										let formattedItem = item;
										if (typeof item === 'string' && /[\s:#\[\]{}|>]/.test(item)) {
											formattedItem = `"${item}"`;
										}
										rebuiltLines.push(`${indent}  - ${formattedItem}`);
									}
									skipMode = true;
								} else if (skipMode && (line.match(/^\S/) || line.match(/^\s*\w+:/))) {
									// Hit a new property, stop skipping
									skipMode = false;
									rebuiltLines.push(line);
								} else if (!skipMode) {
									rebuiltLines.push(line);
								}
								// Skip lines while in skipMode (old list items)
							}
							newContent = `---\n${rebuiltLines.join('\n')}\n---\n${bodyContent}`;
						} else if (modified) {
							newContent = `---\n${newLines.join('\n')}\n---\n${bodyContent}`;
						}
						
						if (modified) {
							console.log(`[Bulk Replace] Modifying file ${file.path}`);
							await this.app.vault.modify(file, newContent);
							modifiedCount++;
						} else {
							console.log(`[Bulk Replace] No modifications needed for ${file.path}`);
						}
					} else {
						console.log(`[Bulk Replace] No frontmatter regex match in ${file.path}`);
						console.log(`[Bulk Replace] Content start:`, content.substring(0, 100));
					}
				}
			} catch (error) {
				console.error(`Error processing file ${file.path}:`, error);
			}
		}

		console.log(`[Bulk Replace] Completed. Modified ${modifiedCount} files.`);
		return modifiedCount;
	}

	private escapeRegex(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

} 