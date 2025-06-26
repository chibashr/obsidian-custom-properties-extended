import { App, PluginSettingTab, Setting, Notice, Modal } from 'obsidian';
import PropertyGroupsPlugin, { PropertySourceConfig } from '../main';
import { PropertyConfigModal } from './PropertyConfigModal';

export class PropertyGroupsSettingTab extends PluginSettingTab {
	plugin: PropertyGroupsPlugin;
	bulkOldValueSetting: Setting | null = null;

	constructor(app: App, plugin: PropertyGroupsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Custom Properties Extended Settings' });

		// Excluded Properties Section
		containerEl.createEl('h3', { text: 'Excluded Properties' });
		containerEl.createEl('p', {
			text: 'Properties listed here will not appear in the Property Groups view.',
			cls: 'setting-item-description'
		});

		new Setting(containerEl)
			.setName('Excluded properties')
			.setDesc('Comma-separated list of property names to exclude')
			.addTextArea(text => text
				.setPlaceholder('property1, property2, property3')
				.setValue(this.plugin.settings.excludedProperties.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.excludedProperties = value
						.split(',')
						.map(prop => prop.trim())
						.filter(prop => prop.length > 0);
					await this.plugin.saveSettings();
				}));

		// Property Source Pages Section
		containerEl.createEl('h3', { text: 'Property Source Pages' });
		containerEl.createEl('p', {
			text: 'Configure automatic linking between properties and source pages. When a note has the specified property value, a link will be automatically added to the target page under the specified heading.',
			cls: 'setting-item-description'
		});

		// Add button for new configuration
		new Setting(containerEl)
			.setName('Add Property Source Page')
			.setDesc('Add a new property source page configuration')
			.addButton(button => button
				.setButtonText('Add Configuration')
				.setCta()
				.onClick(() => {
					this.openConfigModal({
						propertyName: '',
						propertyValue: '',
						targetPage: '',
						targetHeading: 'Associated Pages',
						enabled: true
					}, (config) => {
						this.plugin.settings.sourcePages.push(config);
						this.plugin.saveSettings();
						this.renderSourcePagesTable();
					});
				}));

		// Container for the configurations table
		const tableContainer = containerEl.createEl('div', { cls: 'property-source-table-container' });
		this.renderSourcePagesTable(tableContainer);

		// Bulk Property Management Section
		containerEl.createEl('h3', { text: 'Bulk Property Management' });
		containerEl.createEl('p', {
			text: 'Mass update property values across all notes. Useful for standardizing naming conventions (e.g., changing "rp2008" to "RP2008" in all notes).',
			cls: 'setting-item-description'
		});

		const bulkContainer = containerEl.createEl('div', { cls: 'bulk-property-container' });
		
		// Property Name
		let selectedProperty = '';
		new Setting(bulkContainer)
			.setName('Property Name')
			.setDesc('The property name to search for')
			.addDropdown(dropdown => {
				// Get all unique property names from vault
				const properties = this.getUniquePropertyNames();
				dropdown.addOption('', 'Select a property...');
				properties.forEach(prop => {
					dropdown.addOption(prop, prop);
				});
				dropdown.onChange(value => {
					selectedProperty = value;
					this.updatePropertyValuesDropdown(value);
				});
			});

		// Old Value
		let selectedOldValue = '';
		const oldValueSetting = new Setting(bulkContainer)
			.setName('Current Value')
			.setDesc('The current value to replace')
			.addDropdown(dropdown => {
				dropdown.addOption('', 'Select property first...');
				dropdown.setDisabled(true);
				dropdown.onChange(value => {
					selectedOldValue = value;
				});
			});

		// New Value
		let newValue = '';
		new Setting(bulkContainer)
			.setName('New Value')
			.setDesc('The new value to replace with')
			.addText(text => text
				.setPlaceholder('Enter new value...')
				.onChange(value => {
					newValue = value;
				}));

		// Preview button
		new Setting(bulkContainer)
			.setName('Preview Changes')
			.setDesc('See which files would be affected')
			.addButton(button => button
				.setButtonText('Preview')
				.onClick(() => {
					this.previewBulkChanges(selectedProperty, selectedOldValue, newValue);
				}));

		// Execute button
		new Setting(bulkContainer)
			.setName('Execute Changes')
			.setDesc('Apply the changes to all matching files')
			.addButton(button => button
				.setButtonText('Execute')
				.setWarning()
				.onClick(async () => {
					if (!selectedProperty || !selectedOldValue || !newValue) {
						new Notice('Please fill in all fields');
						return;
					}
					await this.executeBulkChanges(selectedProperty, selectedOldValue, newValue);
				}));

		// Store references for updating
		this.bulkOldValueSetting = oldValueSetting;
	}

	renderSourcePagesTable(container?: HTMLElement): void {
		const tableContainer = container || this.containerEl.querySelector('.property-source-table-container') as HTMLElement;
		if (!tableContainer) return;
		
		tableContainer.empty();

		if (this.plugin.settings.sourcePages.length === 0) {
			tableContainer.createEl('p', {
				text: 'No property source pages configured.',
				cls: 'setting-item-description'
			});
			return;
		}

		const table = tableContainer.createEl('table', { cls: 'property-source-table' });
		
		// Table header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Order' });
		headerRow.createEl('th', { text: 'Status' });
		headerRow.createEl('th', { text: 'Property' });
		headerRow.createEl('th', { text: 'Value' });
		headerRow.createEl('th', { text: 'Target Page' });
		headerRow.createEl('th', { text: 'Heading' });
		headerRow.createEl('th', { text: 'Actions' });

		// Table body
		const tbody = table.createEl('tbody');
		
		this.plugin.settings.sourcePages.forEach((config, index) => {
			const row = tbody.createEl('tr');
			
			// Order controls
			const orderCell = row.createEl('td', { cls: 'order-cell' });
			const upBtn = orderCell.createEl('button', {
				text: '↑',
				cls: 'mod-small order-btn',
				attr: { 'aria-label': 'Move up', title: 'Move up' }
			});
			upBtn.disabled = index === 0;
			upBtn.onclick = () => {
				if (index > 0) {
					// Swap with previous item
					const temp = this.plugin.settings.sourcePages[index - 1];
					this.plugin.settings.sourcePages[index - 1] = this.plugin.settings.sourcePages[index];
					this.plugin.settings.sourcePages[index] = temp;
					this.plugin.saveSettings();
					this.renderSourcePagesTable();
				}
			};

			const downBtn = orderCell.createEl('button', {
				text: '↓',
				cls: 'mod-small order-btn',
				attr: { 'aria-label': 'Move down', title: 'Move down' }
			});
			downBtn.disabled = index === this.plugin.settings.sourcePages.length - 1;
			downBtn.onclick = () => {
				if (index < this.plugin.settings.sourcePages.length - 1) {
					// Swap with next item
					const temp = this.plugin.settings.sourcePages[index + 1];
					this.plugin.settings.sourcePages[index + 1] = this.plugin.settings.sourcePages[index];
					this.plugin.settings.sourcePages[index] = temp;
					this.plugin.saveSettings();
					this.renderSourcePagesTable();
				}
			};
			
			// Status
			const statusCell = row.createEl('td');
			const statusIndicator = statusCell.createEl('div', {
				cls: `status-indicator ${config.enabled ? 'enabled' : 'disabled'}`,
				text: config.enabled ? '●' : '○'
			});
			statusIndicator.title = config.enabled ? 'Enabled' : 'Disabled';

			// Property Name
			row.createEl('td', { 
				text: config.propertyName || '(empty)',
				cls: config.propertyName ? '' : 'empty-value'
			});

			// Property Value
			row.createEl('td', { 
				text: config.propertyValue || '(empty)',
				cls: config.propertyValue ? '' : 'empty-value'
			});

			// Target Page
			row.createEl('td', { 
				text: config.targetPage || '(empty)',
				cls: config.targetPage ? '' : 'empty-value'
			});

			// Target Heading
			row.createEl('td', { 
				text: config.targetHeading || '(empty)',
				cls: config.targetHeading ? '' : 'empty-value'
			});

			// Actions
			const actionsCell = row.createEl('td', { cls: 'actions-cell' });
			
			const editBtn = actionsCell.createEl('button', {
				text: 'Edit',
				cls: 'mod-small'
			});
			editBtn.onclick = () => {
				this.openConfigModal(config, (updatedConfig) => {
					this.plugin.settings.sourcePages[index] = updatedConfig;
					this.plugin.saveSettings();
					this.renderSourcePagesTable();
				});
			};

			const deleteBtn = actionsCell.createEl('button', {
				text: 'Delete',
				cls: 'mod-small mod-warning'
			});
			deleteBtn.onclick = () => {
				this.plugin.settings.sourcePages.splice(index, 1);
				this.plugin.saveSettings();
				this.renderSourcePagesTable();
			};

			const toggleBtn = actionsCell.createEl('button', {
				text: config.enabled ? 'Disable' : 'Enable',
				cls: 'mod-small'
			});
			toggleBtn.onclick = () => {
				config.enabled = !config.enabled;
				this.plugin.saveSettings();
				this.renderSourcePagesTable();
			};
		});
	}

	openConfigModal(config: PropertySourceConfig, onSave: (config: PropertySourceConfig) => void): void {
		const modal = new PropertyConfigModal(this.app, config, onSave);
		modal.open();
	}

	getUniquePropertyNames(): string[] {
		const properties = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();

		files.forEach(file => {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter) {
				Object.keys(cache.frontmatter).forEach(key => {
					// Skip system properties
					if (!key.startsWith('__') && key !== 'position') {
						properties.add(key);
					}
				});
			}
		});

		return Array.from(properties).sort();
	}

	getPropertyValues(propertyName: string): string[] {
		const values = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();

		files.forEach(file => {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter && cache.frontmatter[propertyName]) {
				const value = cache.frontmatter[propertyName];
				const normalizedValues = this.plugin.normalizePropertyValue(value);
				normalizedValues.forEach(val => values.add(val));
			}
		});

		return Array.from(values).sort();
	}

	updatePropertyValuesDropdown(propertyName: string): void {
		if (!this.bulkOldValueSetting) return;

		// Get the dropdown component
		const dropdown = this.bulkOldValueSetting.controlEl.querySelector('select');
		if (!dropdown) return;

		// Clear existing options
		dropdown.innerHTML = '';

		if (!propertyName) {
			dropdown.add(new Option('Select property first...', ''));
			dropdown.disabled = true;
			return;
		}

		dropdown.disabled = false;
		dropdown.add(new Option('Select a value...', ''));

		const values = this.getPropertyValues(propertyName);
		values.forEach(value => {
			dropdown.add(new Option(value, value));
		});
	}

	previewBulkChanges(propertyName: string, oldValue: string, newValue: string): void {
		if (!propertyName || !oldValue || !newValue) {
			new Notice('Please fill in all fields');
			return;
		}

		const files = this.app.vault.getMarkdownFiles();
		const affectedFiles: string[] = [];

		files.forEach(file => {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter && cache.frontmatter[propertyName]) {
				const value = cache.frontmatter[propertyName];
				const normalizedValues = this.plugin.normalizePropertyValue(value);
				if (normalizedValues.includes(oldValue)) {
					affectedFiles.push(file.path);
				}
			}
		});

		if (affectedFiles.length === 0) {
			new Notice('No files found with the specified property value');
			return;
		}

		const message = `This will modify ${affectedFiles.length} file(s):\n\n${affectedFiles.slice(0, 10).join('\n')}${affectedFiles.length > 10 ? `\n\n...and ${affectedFiles.length - 10} more` : ''}`;
		
		// Create a modal to show the preview
		const modal = new class extends Modal {
			constructor(app: App) {
				super(app);
			}

			onOpen() {
				const { contentEl } = this;
				contentEl.createEl('h2', { text: 'Preview Bulk Changes' });
				contentEl.createEl('p', { text: `Changing "${oldValue}" to "${newValue}" in property "${propertyName}"` });
				
				const fileList = contentEl.createEl('div', { cls: 'bulk-preview-list' });
				fileList.style.maxHeight = '300px';
				fileList.style.overflowY = 'auto';
				fileList.style.border = '1px solid var(--background-modifier-border)';
				fileList.style.padding = '10px';
				fileList.style.marginTop = '10px';

				affectedFiles.forEach(filePath => {
					fileList.createEl('div', { text: filePath });
				});

				const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
				buttonContainer.style.marginTop = '20px';
				buttonContainer.style.display = 'flex';
				buttonContainer.style.gap = '10px';

				const closeBtn = buttonContainer.createEl('button', { text: 'Close' });
				closeBtn.onclick = () => this.close();
			}
		}(this.app);
		
		modal.open();
	}

	async executeBulkChanges(propertyName: string, oldValue: string, newValue: string): Promise<void> {
		if (!propertyName || !oldValue || !newValue) {
			new Notice('Please fill in all fields');
			return;
		}

		const notice = new Notice('Processing files...', 0);
		
		try {
			const modifiedCount = await this.plugin.bulkReplacePropertyValue(propertyName, oldValue, newValue);
			notice.hide();
			
			if (modifiedCount === 0) {
				new Notice('No files were modified');
			} else {
				new Notice(`Successfully modified ${modifiedCount} file(s)`);
			}
			
			// Refresh the dropdown to reflect changes
			this.updatePropertyValuesDropdown(propertyName);
			
		} catch (error) {
			notice.hide();
			console.error('Error during bulk property replacement:', error);
			new Notice('Error occurred during bulk replacement. Check console for details.');
		}
	}
} 