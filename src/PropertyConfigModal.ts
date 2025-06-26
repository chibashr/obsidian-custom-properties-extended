import { Modal, App, Setting, TFile, Notice } from 'obsidian';
import { PropertySourceConfig } from '../main';
import { PropertySuggest } from './PropertySuggest';

export class PropertyConfigModal extends Modal {
	config: PropertySourceConfig;
	onSave: (config: PropertySourceConfig) => void;
	private propertyNames: string[];
	private propertyValues: Map<string, Set<string>>;
	private pageNames: string[];
	private suggests: PropertySuggest[] = [];
	private isNewConfig: boolean;

	constructor(app: App, config: PropertySourceConfig, onSave: (config: PropertySourceConfig) => void) {
		super(app);
		this.config = { ...config }; // Create a copy
		this.onSave = onSave;
		this.propertyNames = [];
		this.propertyValues = new Map();
		this.pageNames = [];
		this.isNewConfig = !config.propertyName && !config.propertyValue && !config.targetPage;
		
		this.loadAutoCompleteData();
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		
		contentEl.createEl('h2', { text: 'Property Source Configuration' });

		// Enabled toggle
		new Setting(contentEl)
			.setName('Enabled')
			.setDesc('Whether this configuration is active')
			.addToggle(toggle => toggle
				.setValue(this.config.enabled)
				.onChange((value) => {
					this.config.enabled = value;
				}));

		// Property Name with autocomplete
		new Setting(contentEl)
			.setName('Property Name')
			.setDesc('The name of the property to watch')
			.addText(text => {
				text.setPlaceholder('project')
					.setValue(this.config.propertyName)
					.onChange((value) => {
						this.config.propertyName = value;
					});
				
				// Add autocomplete functionality using PropertySuggest
				const suggest = new PropertySuggest(
					this.app,
					text.inputEl,
					() => this.propertyNames,
					(value) => {
						this.config.propertyName = value;
					}
				);
				this.suggests.push(suggest);
			});

		// Property Value with autocomplete based on selected property
		new Setting(contentEl)
			.setName('Property Value')
			.setDesc('The value of the property that triggers linking')
			.addText(text => {
				text.setPlaceholder('SO95067')
					.setValue(this.config.propertyValue)
					.onChange((value) => {
						this.config.propertyValue = value;
					});
				
				// Add autocomplete for values of the selected property
				const suggest = new PropertySuggest(
					this.app,
					text.inputEl,
					() => {
						const values = this.propertyValues.get(this.config.propertyName);
						return values ? Array.from(values) : [];
					},
					(value) => {
						this.config.propertyValue = value;
					}
				);
				this.suggests.push(suggest);
			});

		// Target Page with autocomplete
		new Setting(contentEl)
			.setName('Target Page')
			.setDesc('The page where links should be added (includes folder paths, without .md extension)')
			.addText(text => {
				text.setPlaceholder('Projects/Project SO95067')
					.setValue(this.config.targetPage)
					.onChange((value) => {
						this.config.targetPage = value;
					});
				
				// Add autocomplete for existing page names including full paths
				const suggest = new PropertySuggest(
					this.app,
					text.inputEl,
					() => this.pageNames,
					(value) => {
						this.config.targetPage = value;
					}
				);
				this.suggests.push(suggest);
			});

		// Target Heading with common heading suggestions
		new Setting(contentEl)
			.setName('Target Heading')
			.setDesc('The heading under which links should be added (must include # prefix)')
			.addText(text => {
				text.setPlaceholder('# Associated Pages')
					.setValue(this.config.targetHeading)
					.onChange((value) => {
						this.config.targetHeading = value;
					});
				
				// Add autocomplete for common headings with # prefixes
				const commonHeadings = [
					'# Associated Pages',
					'# Related Files',
					'# Linked Notes',
					'# References',
					'# Documents',
					'# Notes',
					'# Files',
					'# Links',
					'# Related Content',
					'## Associated Pages',
					'## Related Files',
					'## References',
					'### Associated Pages',
					'### Related Files'
				];
				
				const suggest = new PropertySuggest(
					this.app,
					text.inputEl,
					() => commonHeadings,
					(value) => {
						this.config.targetHeading = value;
					}
				);
				this.suggests.push(suggest);
			});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'space-between';
		buttonContainer.style.marginTop = '20px';

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();

		const saveBtn = buttonContainer.createEl('button', { text: 'Save', cls: 'mod-cta' });
		saveBtn.onclick = () => {
			this.handleSave();
		};
	}

	private async handleSave() {
		// Validate required fields
		if (!this.config.propertyName.trim()) {
			new Notice('Property name is required');
			return;
		}
		
		if (!this.config.propertyValue.trim()) {
			new Notice('Property value is required');
			return;
		}
		
		if (!this.config.targetPage.trim()) {
			new Notice('Target page is required');
			return;
		}
		
		if (!this.config.targetHeading.trim()) {
			new Notice('Target heading is required');
			return;
		}
		
		// Ensure heading starts with #
		if (!this.config.targetHeading.startsWith('#')) {
			new Notice('Target heading must start with # (e.g., "# Associated Pages")');
			return;
		}

		// Save the configuration
		this.onSave(this.config);

		// If this is a new configuration, ask if user wants to run it immediately
		if (this.isNewConfig && this.config.enabled) {
			const shouldRunNow = await this.confirmImmediateExecution();
			if (shouldRunNow) {
				await this.runRuleImmediately();
			}
		}

		this.close();
	}

	private confirmImmediateExecution(): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Run Rule Immediately?');
			
			const { contentEl } = modal;
			contentEl.createEl('p', {
				text: `Do you want to scan all existing notes and apply this rule now? This will add links to "${this.config.targetPage}" for all notes that currently have the property "${this.config.propertyName}: ${this.config.propertyValue}".`
			});

			const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
			buttonContainer.style.display = 'flex';
			buttonContainer.style.gap = '10px';
			buttonContainer.style.marginTop = '20px';

			const noBtn = buttonContainer.createEl('button', { text: 'No, I\'ll do it later' });
			noBtn.onclick = () => {
				modal.close();
				resolve(false);
			};

			const yesBtn = buttonContainer.createEl('button', { text: 'Yes, run now', cls: 'mod-cta' });
			yesBtn.onclick = () => {
				modal.close();
				resolve(true);
			};

			modal.open();
		});
	}

	private async runRuleImmediately() {
		try {
			const files = this.app.vault.getMarkdownFiles();
			let processedCount = 0;
			let linkedCount = 0;

			const notice = new Notice('Processing files...', 0); // 0 = don't auto-hide

			for (const file of files) {
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter) {
					const propertyValue = cache.frontmatter[this.config.propertyName];
					
					// Use the same normalization logic as PropertySourceManager
					const normalizedValues = this.normalizePropertyValue(propertyValue);
					const hasMatchingValue = normalizedValues.includes(this.config.propertyValue);
					
					if (hasMatchingValue) {
						await this.addLinkToTargetPage(file);
						linkedCount++;
					}
					processedCount++;
				}
			}

			notice.hide();
			new Notice(`Processed ${processedCount} files. Added ${linkedCount} links to "${this.config.targetPage}".`);
		} catch (error) {
			console.error('Error running rule immediately:', error);
			new Notice('Error applying rule to existing files. Check console for details.');
		}
	}

	private async addLinkToTargetPage(file: TFile): Promise<void> {
		const targetFile = this.app.vault.getAbstractFileByPath(`${this.config.targetPage}.md`);
		
		if (!targetFile || !(targetFile instanceof TFile)) {
			// Create the target page if it doesn't exist
			await this.createTargetPage();
			return this.addLinkToTargetPage(file);
		}

		const content = await this.app.vault.read(targetFile);
		const lines = content.split('\n');
		
		// Extract heading text without the # prefix for pattern matching
		const headingText = this.config.targetHeading.replace(/^#+\s*/, '');
		const headingPattern = new RegExp(`^#+\\s+${this.escapeRegex(headingText)}\\s*$`);
		let headingIndex = -1;
		
		// Find the heading
		for (let i = 0; i < lines.length; i++) {
			if (headingPattern.test(lines[i])) {
				headingIndex = i;
				break;
			}
		}

		if (headingIndex === -1) {
			// Heading doesn't exist, add it at the end
			lines.push('', this.config.targetHeading, '');
			headingIndex = lines.length - 2;
		}

		const linkText = `- [[${file.path.replace('.md', '')}]]`;
		
		// Check if link already exists under this heading
		let linkExists = false;
		let nextHeadingIndex = lines.length;
		
		// Find the next heading to know where this section ends
		for (let i = headingIndex + 1; i < lines.length; i++) {
			if (lines[i].match(/^#+\s+/)) {
				nextHeadingIndex = i;
				break;
			}
		}

		// Check if link already exists in this section
		for (let i = headingIndex + 1; i < nextHeadingIndex; i++) {
			if (lines[i].includes(`[[${file.path.replace('.md', '')}]]`)) {
				linkExists = true;
				break;
			}
		}

		if (!linkExists) {
			// Add the link after the heading
			let insertIndex = headingIndex + 1;
			
			// Skip any empty lines after the heading
			while (insertIndex < nextHeadingIndex && lines[insertIndex].trim() === '') {
				insertIndex++;
			}

			lines.splice(insertIndex, 0, linkText);
			
			await this.app.vault.modify(targetFile, lines.join('\n'));
		}
	}

	private async createTargetPage(): Promise<void> {
		const content = `# ${this.config.targetPage}

${this.config.targetHeading}

`;
		
		try {
			await this.app.vault.create(`${this.config.targetPage}.md`, content);
		} catch (error) {
			console.error('Failed to create target page:', error);
		}
	}

	private escapeRegex(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		
		// Clean up all suggestion instances
		this.suggests.forEach(suggest => suggest.destroy());
		this.suggests = [];
	}

	private isEmptyValue(value: any): boolean {
		if (value === null || value === undefined) return true;
		if (typeof value === 'string' && value.trim() === '') return true;
		if (Array.isArray(value) && value.length === 0) return true;
		if (Array.isArray(value) && value.every(item => this.isEmptyValue(item))) return true;
		return false;
	}

	private normalizePropertyValue(value: any): string[] {
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

	private loadAutoCompleteData() {
		const files = this.app.vault.getMarkdownFiles();
		const propertyNames = new Set<string>();
		const propertyValues = new Map<string, Set<string>>();
		const pageNames = new Set<string>();

		// Collect page names with full paths (without .md extension)
		files.forEach(file => {
			pageNames.add(file.path.replace('.md', ''));
		});

		// Collect property names and values
		files.forEach(file => {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter) {
				Object.entries(cache.frontmatter).forEach(([key, value]) => {
					// Skip system properties
					if (key.startsWith('__') || key === 'position') return;
					
					// Skip empty values
					if (this.isEmptyValue(value)) return;
					
					propertyNames.add(key);
					
					if (!propertyValues.has(key)) {
						propertyValues.set(key, new Set());
					}
					
					// Use the same normalization logic as the main plugin
					const normalizedValues = this.normalizePropertyValue(value);
					normalizedValues.forEach(normalizedValue => {
						propertyValues.get(key)!.add(normalizedValue);
					});
				});
			}
		});

		this.propertyNames = Array.from(propertyNames).sort();
		this.propertyValues = propertyValues;
		this.pageNames = Array.from(pageNames).sort();
	}
} 