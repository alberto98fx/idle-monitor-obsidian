import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
  } from 'obsidian';
  
  interface IdleMonitorSettings {
	idleThreshold: number;
	checkInterval: number;
	includeMouseActivity: boolean;
	textColor: string;
	rainbowMode: boolean;
	timeFormat24Hour: boolean;
  }
  
  const DEFAULT_SETTINGS: IdleMonitorSettings = {
	idleThreshold: 30000,
	checkInterval: 1000,
	includeMouseActivity: true,
	textColor: '',
	rainbowMode: false,
	timeFormat24Hour: false,
  };
  
  export default class IdleMonitor extends Plugin {
	private settings: IdleMonitorSettings;
	private lastActivityTime: number;
	private checkIdleIntervalId: number | null = null;
	private statusBarItem: HTMLElement;
	private rainbowGradientStep: number;
  
	/**
	 * A set of keys that will be ignored for resetting idle time.
	 */
	private static readonly IGNORED_KEYS = new Set([
	  'Shift',
	  'Meta',
	  'Control',
	  'Alt',
	  'CapsLock',
	  'ArrowLeft',
	  'ArrowRight',
	  'ArrowUp',
	  'ArrowDown',
	  'Escape',
	  'Tab',
	  'Enter',
	  'Backspace',
	  'Delete',
	  'Insert',
	  'Home',
	  'End',
	  'PageUp',
	  'PageDown',
	  // Function keys
	  'F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12',
	]);
  
	async onload(): Promise<void> {
	  await this.loadSettings();
  
	  this.lastActivityTime = Date.now();
	  this.rainbowGradientStep = 0;
  
	  // Initialize idle detection
	  this.detectActivity();
  
	  // Create and configure status bar item
	  this.statusBarItem = this.addStatusBarItem();
	  this.statusBarItem.addEventListener('mouseenter', this.showLastActivityTime.bind(this));
	  this.updateStatusBarColor();
	  this.statusBarItem.setText('All caught up!');
  
	  // Optional ribbon icon
	  const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', () => {
		new Notice('This is a notice!');
	  });
	  ribbonIconEl.addClass('my-plugin-ribbon-class');
  
	  // Add settings tab
	  this.addSettingTab(new IdleNotifierSettingTab(this.app, this));
	}
  
	onunload(): void {
	  // Remove event listeners
	  document.removeEventListener('keydown', this.detectKeyboardActivityBound);
	  document.removeEventListener('mousemove', this.resetActivityBound);
  
	  // Clear the idle check interval
	  if (this.checkIdleIntervalId !== null) {
		clearInterval(this.checkIdleIntervalId);
		this.checkIdleIntervalId = null;
	  }
	}
  
	/**
	 * Separate event listener for keyboard activity that filters out
	 * modifier keys, function keys, etc.
	 */
	private detectKeyboardActivityBound = this.detectKeyboardActivity.bind(this);
	private detectKeyboardActivity(evt: KeyboardEvent): void {
	  // If a modifier key (cmd, ctrl, alt) is active, ignore.
	  if (evt.metaKey || evt.ctrlKey || evt.altKey) return;
  
	  // If the pressed key is in the ignored set, skip resetting.
	  if (IdleMonitor.IGNORED_KEYS.has(evt.key)) return;
  
	  // If it passes the checks, we treat it as real typing.
	  this.resetActivity();
	}
  
	/**
	 * Bound function for mouse activity, if enabled.
	 */
	private resetActivityBound = this.resetActivity.bind(this);
  
	private detectActivity(): void {
	  // Remove old listeners if they exist (to avoid duplicates)
	  document.removeEventListener('keydown', this.detectKeyboardActivityBound);
	  document.removeEventListener('mousemove', this.resetActivityBound);
  
	  // Add keyboard listener
	  document.addEventListener('keydown', this.detectKeyboardActivityBound);
  
	  // Conditionally add mouse listener
	  if (this.settings.includeMouseActivity) {
		document.addEventListener('mousemove', this.resetActivityBound);
	  }
  
	  // Clear old interval if it exists
	  if (this.checkIdleIntervalId !== null) {
		clearInterval(this.checkIdleIntervalId);
	  }
  
	  // Set an interval to check for idle state
	  this.checkIdleIntervalId = window.setInterval(() => {
		const idleTime = Date.now() - this.lastActivityTime;
		if (idleTime > this.settings.idleThreshold) {
		  this.updateIdleStatus(idleTime);
		} else {
		  this.statusBarItem.setText('All caught up!');
		  this.updateStatusBarColor();
		}
	  }, this.settings.checkInterval);
	}
  
	private resetActivity(): void {
	  this.lastActivityTime = Date.now();
	  this.statusBarItem.setText('All caught up!');
	  this.updateStatusBarColor();
	}
  
	private updateIdleStatus(idleTime: number): void {
	  const totalSeconds = Math.floor(idleTime / 1000);
	  const hours = Math.floor(totalSeconds / 3600);
	  const minutes = Math.floor((totalSeconds % 3600) / 60);
	  const seconds = totalSeconds % 60;
  
	  let timeString = '';
	  if (hours > 0) {
		timeString += `${hours} hour${hours !== 1 ? 's' : ''} `;
	  }
	  if (minutes > 0 || hours > 0) {
		timeString += `${minutes} minute${minutes !== 1 ? 's' : ''} `;
	  }
	  timeString += `${seconds} second${seconds !== 1 ? 's' : ''}`;
  
	  this.statusBarItem.setText(`Idle for ${timeString}`);
	  this.updateStatusBarColor();
	}
  
	private updateStatusBarColor(): void {
	  if (this.settings.rainbowMode) {
		const gradient = `linear-gradient(
		  90deg, 
		  hsl(${this.rainbowGradientStep}, 100%, 50%), 
		  hsl(${(this.rainbowGradientStep + 15) % 360}, 100%, 50%), 
		  hsl(${(this.rainbowGradientStep + 30) % 360}, 100%, 50%)
		)`;
		this.statusBarItem.style.backgroundImage = gradient;
		this.statusBarItem.style.color = 'transparent';
		this.statusBarItem.style.backgroundClip = 'text';
		// @ts-expect-error: WebKit-specific property
		this.statusBarItem.style.webkitBackgroundClip = 'text';
		this.rainbowGradientStep = (this.rainbowGradientStep + 20) % 360;
	  } else {
		this.statusBarItem.style.color = this.settings.textColor || '';
		this.statusBarItem.style.backgroundImage = 'none';
	  }
	}
  
	private showLastActivityTime(): void {
	  const lastActivityDate = new Date(this.lastActivityTime);
	  const timeString = lastActivityDate.toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: !this.settings.timeFormat24Hour,
	  });
	  new Notice(`You stopped typing at: ${timeString}`);
	}
  
	private async loadSettings(): Promise<void> {
	  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
  
	public async saveSettings(): Promise<void> {
	  await this.saveData(this.settings);
	}
  }
  
  class IdleNotifierSettingTab extends PluginSettingTab {
	private readonly plugin: IdleMonitor;
  
	constructor(app: App, plugin: IdleMonitor) {
	  super(app, plugin);
	  this.plugin = plugin;
	}
  
	public display(): void {
	  const { containerEl } = this;
	  containerEl.empty();
	  containerEl.createEl('h2', { text: 'Idle Notifier Settings' });
  
	  new Setting(containerEl)
		.setName('Idle Time Threshold')
		.setDesc('Set the idle time in milliseconds before a notification is shown.')
		.addText((text) =>
		  text
			.setPlaceholder('Enter time in ms')
			.setValue(this.plugin.settings.idleThreshold.toString())
			.onChange(async (value: string) => {
			  const parsedValue = parseInt(value, 10);
			  this.plugin.settings.idleThreshold = Number.isNaN(parsedValue)
				? DEFAULT_SETTINGS.idleThreshold
				: parsedValue;
			  await this.plugin.saveSettings();
			})
		);
  
	  new Setting(containerEl)
		.setName('Check Interval')
		.setDesc('Set the interval in milliseconds for checking idle state.')
		.addText((text) =>
		  text
			.setPlaceholder('Enter interval in ms')
			.setValue(this.plugin.settings.checkInterval.toString())
			.onChange(async (value: string) => {
			  const parsedValue = parseInt(value, 10);
			  this.plugin.settings.checkInterval = Number.isNaN(parsedValue)
				? DEFAULT_SETTINGS.checkInterval
				: parsedValue;
			  await this.plugin.saveSettings();
			})
		);
  
	  new Setting(containerEl)
		.setName('Include Mouse Activity')
		.setDesc('Should mouse movement count as activity?')
		.addToggle((toggle) =>
		  toggle
			.setValue(this.plugin.settings.includeMouseActivity)
			.onChange(async (value: boolean) => {
			  this.plugin.settings.includeMouseActivity = value;
			  await this.plugin.saveSettings();
			  this.plugin.detectActivity();
			})
		);
  
	  new Setting(containerEl)
		.setName('Text Color')
		.setDesc('Set the color of the idle status text.')
		.addText((text) =>
		  text
			.setPlaceholder('Enter a color (e.g., #ffffff or red)')
			.setValue(this.plugin.settings.textColor)
			.onChange(async (value: string) => {
			  this.plugin.settings.textColor = value;
			  await this.plugin.saveSettings();
			  this.plugin.updateStatusBarColor();
			})
		);
  
	  new Setting(containerEl)
		.setName('Rainbow Mode')
		.setDesc('Cycle through rainbow colors for the idle status text with a glowing gradient.')
		.addToggle((toggle) =>
		  toggle
			.setValue(this.plugin.settings.rainbowMode)
			.onChange(async (value: boolean) => {
			  this.plugin.settings.rainbowMode = value;
			  await this.plugin.saveSettings();
			  this.plugin.updateStatusBarColor();
			})
		);
  
	  new Setting(containerEl)
		.setName('Time Format (24-hour)')
		.setDesc('Toggle between 12-hour and 24-hour time format.')
		.addToggle((toggle) =>
		  toggle
			.setValue(this.plugin.settings.timeFormat24Hour)
			.onChange(async (value: boolean) => {
			  this.plugin.settings.timeFormat24Hour = value;
			  await this.plugin.saveSettings();
			})
		);
	}
  }
  