import { App } from 'obsidian';

export class PropertySuggest {
	private app: App;
	private inputEl: HTMLInputElement;
	private suggestEl!: HTMLElement;
	private suggestions: string[] = [];
	private selectedIndex: number = -1;
	private isOpen: boolean = false;
	private onSelect: (value: string) => void;
	private getSuggestions: () => string[];

	constructor(app: App, inputEl: HTMLInputElement, getSuggestions: () => string[], onSelect: (value: string) => void) {
		this.app = app;
		this.inputEl = inputEl;
		this.getSuggestions = getSuggestions;
		this.onSelect = onSelect;
		this.setupEventListeners();
		this.createSuggestContainer();
	}

	private createSuggestContainer(): void {
		this.suggestEl = createDiv('property-suggestion-container');
		this.suggestEl.style.cssText = `
			position: absolute;
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 8px;
			max-height: 200px;
			overflow-y: auto;
			z-index: 1000;
			display: none;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		`;
		
		// Insert after the input element's parent to avoid positioning issues
		if (this.inputEl.parentElement) {
			this.inputEl.parentElement.style.position = 'relative';
			this.inputEl.parentElement.appendChild(this.suggestEl);
		}
	}

	private setupEventListeners(): void {
		this.inputEl.addEventListener('input', (e) => {
			this.updateSuggestions((e.target as HTMLInputElement).value);
		});

		this.inputEl.addEventListener('keydown', (e) => {
			if (!this.isOpen) return;

			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
					this.renderSuggestions();
					break;
				case 'ArrowUp':
					e.preventDefault();
					this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
					this.renderSuggestions();
					break;
				case 'Enter':
					e.preventDefault();
					if (this.selectedIndex >= 0 && this.selectedIndex < this.suggestions.length) {
						this.selectSuggestion(this.suggestions[this.selectedIndex]);
					}
					break;
				case 'Escape':
					this.closeSuggestions();
					break;
			}
		});

		this.inputEl.addEventListener('blur', () => {
			// Delay closing to allow for click events
			setTimeout(() => this.closeSuggestions(), 300);
		});

		this.inputEl.addEventListener('focus', () => {
			if (this.inputEl.value) {
				this.updateSuggestions(this.inputEl.value);
			} else {
				this.showAllSuggestions();
			}
		});
	}

	private updateSuggestions(query: string): void {
		const allSuggestions = this.getSuggestions();
		
		if (!query.trim()) {
			this.suggestions = allSuggestions.slice(0, 10);
		} else {
			const searchQuery = query.toLowerCase();
			this.suggestions = allSuggestions
				.filter(suggestion => suggestion.toLowerCase().includes(searchQuery))
				.slice(0, 10);
		}

		this.selectedIndex = -1;
		this.renderSuggestions();
	}

	private showAllSuggestions(): void {
		const allSuggestions = this.getSuggestions();
		this.suggestions = allSuggestions.slice(0, 10);
		
		if (this.suggestions.length > 0) {
			this.selectedIndex = -1;
			this.renderSuggestions();
		} else {
			this.closeSuggestions();
		}
	}

	private renderSuggestions(): void {
		if (this.suggestions.length === 0) {
			this.closeSuggestions();
			return;
		}

		this.suggestEl.empty();
		this.isOpen = true;
		this.suggestEl.style.display = 'block';

		this.suggestions.forEach((suggestion, index) => {
			const suggestionEl = this.suggestEl.createDiv('property-suggestion-item');
			
			suggestionEl.style.cssText = `
				padding: 8px 12px;
				cursor: pointer;
				border-bottom: 1px solid var(--background-modifier-border);
				transition: background-color 0.15s ease;
				${index === this.selectedIndex ? 'background: var(--background-modifier-hover);' : ''}
			`;

			suggestionEl.textContent = suggestion;
			suggestionEl.style.color = 'var(--text-normal)';

			// Prevent default and stop propagation to avoid blur issues
			suggestionEl.addEventListener('mousedown', (e) => {
				e.preventDefault();
			});

			suggestionEl.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.selectSuggestion(suggestion);
			});

			suggestionEl.addEventListener('mouseenter', () => {
				this.selectedIndex = index;
				this.renderSuggestions();
			});
		});

		// Position the suggestions below the input
		this.positionSuggestions();
	}

	private positionSuggestions(): void {
		if (!this.inputEl.parentElement) return;

		const rect = this.inputEl.getBoundingClientRect();
		const parentRect = this.inputEl.parentElement.getBoundingClientRect();
		
		this.suggestEl.style.top = `${rect.bottom - parentRect.top + 4}px`;
		this.suggestEl.style.left = `${rect.left - parentRect.left}px`;
		this.suggestEl.style.width = `${rect.width}px`;
	}

	private selectSuggestion(suggestion: string): void {
		this.inputEl.value = suggestion;
		this.closeSuggestions();
		
		// Call the callback
		this.onSelect(suggestion);
		
		// Trigger input and change events to ensure the value is properly registered
		this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
		this.inputEl.dispatchEvent(new Event('change', { bubbles: true }));
		
		// Focus back to input
		this.inputEl.focus();
	}

	private closeSuggestions(): void {
		this.isOpen = false;
		this.suggestEl.style.display = 'none';
		this.suggestions = [];
		this.selectedIndex = -1;
	}

	destroy(): void {
		if (this.suggestEl && this.suggestEl.parentElement) {
			this.suggestEl.parentElement.removeChild(this.suggestEl);
		}
	}
} 