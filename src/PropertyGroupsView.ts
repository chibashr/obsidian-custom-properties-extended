import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import PropertyGroupsPlugin from '../main';

export const VIEW_TYPE_PROPERTY_GROUPS = 'property-groups-view';

export class PropertyGroupsView extends ItemView {
	plugin: PropertyGroupsPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: PropertyGroupsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_PROPERTY_GROUPS;
	}

	getDisplayText() {
		return 'Property Groups';
	}

	getIcon() {
		return 'tags';
	}

	async onOpen() {
		this.draw();
		
		// Register for metadata changes to refresh the view
		this.registerEvent(
			this.app.metadataCache.on('changed', () => {
				this.draw();
			})
		);

		this.registerEvent(
			this.app.vault.on('create', () => {
				this.draw();
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', () => {
				this.draw();
			})
		);
	}

	async onClose() {
		// Nothing to clean up.
	}

	draw() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('property-groups-container');

		const headerEl = container.createEl('div', { cls: 'property-groups-header' });
		headerEl.createEl('h4', { text: 'Custom Properties Extended' });

		const refreshBtn = headerEl.createEl('button', {
			cls: 'clickable-icon property-groups-refresh',
			attr: { 'aria-label': 'Refresh property groups' }
		});
		refreshBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-refresh-cw"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
		refreshBtn.onclick = () => this.draw();

		const contentEl = container.createEl('div', { cls: 'property-groups-content' });

		const propertyGroups = this.plugin.getPropertyGroups();

		if (propertyGroups.size === 0) {
			contentEl.createEl('div', {
				text: 'No properties found',
				cls: 'property-groups-empty'
			});
			return;
		}

		// Sort properties alphabetically
		const sortedProperties = Array.from(propertyGroups.entries()).sort(([a], [b]) => a.localeCompare(b));

		for (const [propertyName, valueGroups] of sortedProperties) {
			const propertyEl = contentEl.createEl('div', { cls: 'property-group' });
			
			const propertyHeaderEl = propertyEl.createEl('div', {
				cls: 'property-group-header clickable-icon',
				attr: { 'data-property': propertyName }
			});

			const collapseIcon = propertyHeaderEl.createEl('span', { cls: 'collapse-icon' });
			collapseIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-chevron-right"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

			const propertyTitle = propertyHeaderEl.createEl('span', {
				text: propertyName,
				cls: 'property-group-title'
			});

			const propertyCount = propertyHeaderEl.createEl('span', {
				text: `(${valueGroups.size})`,
				cls: 'property-group-count'
			});

			const valuesEl = propertyEl.createEl('div', { cls: 'property-values collapsed' });

			// Sort values alphabetically
			const sortedValues = Array.from(valueGroups.entries()).sort(([a], [b]) => a.localeCompare(b));

			for (const [value, files] of sortedValues) {
				const valueEl = valuesEl.createEl('div', { cls: 'property-value' });
				
				const valueHeaderEl = valueEl.createEl('div', {
					cls: 'property-value-header clickable-icon',
					attr: { 'data-value': value }
				});

				const valueCollapseIcon = valueHeaderEl.createEl('span', { cls: 'collapse-icon' });
				valueCollapseIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-chevron-right"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

				const valueTitle = valueHeaderEl.createEl('span', {
					text: value,
					cls: 'property-value-title'
				});

				const valueCount = valueHeaderEl.createEl('span', {
					text: `(${files.length})`,
					cls: 'property-value-count'
				});

				const filesEl = valueEl.createEl('div', { cls: 'property-files collapsed' });

				// Sort files alphabetically
				const sortedFiles = files.sort((a, b) => a.basename.localeCompare(b.basename));

				for (const file of sortedFiles) {
					const fileEl = filesEl.createEl('div', {
						cls: 'property-file clickable-icon',
						text: file.basename
					});

					fileEl.onclick = async () => {
						const leaf = this.app.workspace.getUnpinnedLeaf();
						await leaf.openFile(file);
					};
				}

				// Toggle value visibility
				valueHeaderEl.onclick = () => {
					const isCollapsed = filesEl.hasClass('collapsed');
					if (isCollapsed) {
						filesEl.removeClass('collapsed');
						valueCollapseIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-chevron-down"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
					} else {
						filesEl.addClass('collapsed');
						valueCollapseIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-chevron-right"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
					}
				};
			}

			// Toggle property visibility
			propertyHeaderEl.onclick = () => {
				const isCollapsed = valuesEl.hasClass('collapsed');
				if (isCollapsed) {
					valuesEl.removeClass('collapsed');
					collapseIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-chevron-down"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
				} else {
					valuesEl.addClass('collapsed');
					collapseIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-chevron-right"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
				}
			};
		}
	}
} 