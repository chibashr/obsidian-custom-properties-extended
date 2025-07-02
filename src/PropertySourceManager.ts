import { App, TFile, CachedMetadata, Notice } from 'obsidian';
import { PropertyGroupsSettings, PropertySourceConfig, PropertyCondition } from '../main';

export class PropertySourceManager {
	app: App;
	settings: PropertyGroupsSettings;

	constructor(app: App, settings: PropertyGroupsSettings) {
		this.app = app;
		this.settings = settings;
	}

	updateSettings(settings: PropertyGroupsSettings) {
		this.settings = settings;
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

	async handleFileChange(file: TFile, cache: CachedMetadata | null) {
		if (!cache?.frontmatter) {
			// File no longer has frontmatter, remove any existing links
			await this.removeFileFromAllSourcePages(file);
			return;
		}

		const frontmatter = cache.frontmatter;

		for (const config of this.settings.sourcePages) {
			if (!config.enabled) continue;

			// Check if this file matches the conditions
			const matchesConditions = this.evaluateConditions(frontmatter, config);
			
			if (matchesConditions) {
				// Add link to source page
				await this.addLinkToSourcePage(file, config);
			} else {
				// Remove link from source page if it exists
				await this.removeLinkFromSourcePage(file, config);
			}
		}
	}

	private evaluateConditions(frontmatter: any, config: PropertySourceConfig): boolean {
		// Support legacy format
		if (config.propertyName && config.propertyValue && !config.conditions) {
			const propertyValue = frontmatter[config.propertyName];
			if (this.isEmptyValue(propertyValue)) return false;
			
			const normalizedValues = this.normalizePropertyValue(propertyValue);
			return normalizedValues.includes(config.propertyValue);
		}

		// New format with multiple conditions
		if (!config.conditions || config.conditions.length === 0) return false;

		const results = config.conditions.map(condition => {
			const propertyValue = frontmatter[condition.propertyName];
			if (this.isEmptyValue(propertyValue)) return false;
			
			const normalizedValues = this.normalizePropertyValue(propertyValue);
			
			switch (condition.operator) {
				case 'equals':
					return normalizedValues.includes(condition.propertyValue);
				case 'contains':
					return normalizedValues.some(value => 
						value.toLowerCase().includes(condition.propertyValue.toLowerCase())
					);
				default:
					return false;
			}
		});

		// Apply logical operator
		return config.logicalOperator === 'OR' 
			? results.some(result => result)
			: results.every(result => result);
	}

	async handleFileDelete(file: TFile) {
		await this.removeFileFromAllSourcePages(file);
	}

	async addLinkToSourcePage(file: TFile, config: PropertySourceConfig): Promise<void> {
		// Don't add the source page to its own associated pages
		const targetPagePath = `${config.targetPage}.md`;
		if (file.path === targetPagePath) {
			return;
		}

		const sourceFile = this.app.vault.getAbstractFileByPath(targetPagePath);
		
		if (!sourceFile || !(sourceFile instanceof TFile)) {
			// Create the source page if it doesn't exist
			await this.createSourcePage(config);
			return this.addLinkToSourcePage(file, config);
		}

		const content = await this.app.vault.read(sourceFile);
		const lines = content.split('\n');
		
		// Extract heading text without the # prefix for pattern matching
		const headingText = config.targetHeading.replace(/^#+\s*/, '');
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
			lines.push('', config.targetHeading, '');
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
			
			await this.app.vault.modify(sourceFile, lines.join('\n'));
		}
	}

	async removeLinkFromSourcePage(file: TFile, config: PropertySourceConfig) {
		const sourceFile = this.app.vault.getAbstractFileByPath(`${config.targetPage}.md`);
		
		if (!sourceFile || !(sourceFile instanceof TFile)) {
			return;
		}

		const content = await this.app.vault.read(sourceFile);
		const lines = content.split('\n');
		
		const linkPattern = new RegExp(`^\\s*-\\s*\\[\\[${this.escapeRegex(file.path.replace('.md', ''))}\\]\\]\\s*$`);
		let modified = false;
		
		for (let i = lines.length - 1; i >= 0; i--) {
			if (linkPattern.test(lines[i])) {
				lines.splice(i, 1);
				modified = true;
			}
		}

		if (modified) {
			await this.app.vault.modify(sourceFile, lines.join('\n'));
		}
	}

	async removeFileFromAllSourcePages(file: TFile) {
		for (const config of this.settings.sourcePages) {
			if (!config.enabled) continue;
			await this.removeLinkFromSourcePage(file, config);
		}
	}

	async createSourcePage(config: PropertySourceConfig) {
		const content = `# ${config.targetPage}

${config.targetHeading}

`;
		
		try {
			await this.app.vault.create(`${config.targetPage}.md`, content);
		} catch (error) {
			console.error('Failed to create source page:', error);
		}
	}

	async initializeAllSourcePages() {
		// Go through all files and ensure proper linking
		const files = this.app.vault.getMarkdownFiles();
		
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache) {
				await this.handleFileChange(file, cache);
			}
		}
	}

	private escapeRegex(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

} 