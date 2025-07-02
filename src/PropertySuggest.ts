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
	private documentClickHandler!: (e: Event) => void;

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
				case 'Tab':
					// Close suggestions on tab to allow normal form navigation
					this.closeSuggestions();
					break;
			}
		});

		this.inputEl.addEventListener('blur', (e) => {
			// Check if focus is moving to a suggestion item
			const relatedTarget = e.relatedTarget as HTMLElement;
			if (relatedTarget && this.suggestEl.contains(relatedTarget)) {
				return; // Don't close if clicking on a suggestion
			}
			
			// Delay closing slightly to allow for click events
			setTimeout(() => {
				// Check again if focus returned to input or moved to suggestion
				if (document.activeElement !== this.inputEl && 
					!this.suggestEl.contains(document.activeElement as HTMLElement)) {
					this.closeSuggestions();
				}
			}, 150);
		});

		this.inputEl.addEventListener('focus', () => {
			// Small delay to allow the suggestion container to be positioned correctly
			setTimeout(() => {
				if (this.inputEl.value) {
					this.updateSuggestions(this.inputEl.value);
				} else {
					this.showAllSuggestions();
				}
			}, 50);
		});

		// Close suggestions when clicking outside
		this.documentClickHandler = (e: Event) => {
			if (!this.inputEl.contains(e.target as Node) && 
				!this.suggestEl.contains(e.target as Node)) {
				this.closeSuggestions();
			}
		};
		document.addEventListener('click', this.documentClickHandler);
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
				transition: background-color 0.1s ease;
				user-select: none;
				${index === this.selectedIndex ? 'background: var(--background-modifier-hover);' : ''}
			`;

			suggestionEl.textContent = suggestion;
			suggestionEl.style.color = 'var(--text-normal)';
			suggestionEl.setAttribute('tabindex', '-1'); // Make focusable but not tab-reachable

			// Improve click responsiveness
			suggestionEl.addEventListener('mousedown', (e) => {
				e.preventDefault(); // Prevent input blur
				e.stopPropagation();
			});

			suggestionEl.addEventListener('mouseup', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.selectSuggestion(suggestion);
			});

			// Handle touch events for better mobile support
			suggestionEl.addEventListener('touchstart', (e) => {
				e.preventDefault();
			});

			suggestionEl.addEventListener('touchend', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.selectSuggestion(suggestion);
			});

			// Visual feedback on hover
			suggestionEl.addEventListener('mouseenter', () => {
				this.selectedIndex = index;
				// Update only the visual state without full re-render for better performance
				this.updateSelectionVisual();
			});

			suggestionEl.addEventListener('mouseleave', () => {
				// Reset selection when leaving with mouse
				this.selectedIndex = -1;
				this.updateSelectionVisual();
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

	private updateSelectionVisual(): void {
		if (!this.isOpen) return;
		
		const items = this.suggestEl.querySelectorAll('.property-suggestion-item');
		items.forEach((item, index) => {
			const htmlItem = item as HTMLElement;
			if (index === this.selectedIndex) {
				htmlItem.style.background = 'var(--background-modifier-hover)';
			} else {
				htmlItem.style.background = '';
			}
		});
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
		this.closeSuggestions();
		
		// Remove global event listener
		document.removeEventListener('click', this.documentClickHandler);
		
		// Remove suggestion container
		if (this.suggestEl && this.suggestEl.parentElement) {
			this.suggestEl.parentElement.removeChild(this.suggestEl);
		}
	}
} 