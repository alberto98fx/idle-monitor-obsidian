import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
  } from 'obsidian';
  
  /**
   * Interface defining the shape of the plugin's settings.
   */
  interface IdleMonitorSettings {
	idleThreshold: number;       // Idle time in ms before showing a notification
	checkInterval: number;       // Interval in ms to check for idle state
	includeMouseActivity: boolean;
	textColor: string;
	rainbowMode: boolean;
	timeFormat24Hour: boolean;
  }
  
  /**
   * Default plugin settings.
   */
  const DEFAULT_SETTINGS: IdleMonitorSettings = {
	idleThreshold: 1000,          // 1 second
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
	 * onload() is called by Obsidian when the plugin is loaded.
	 */
	public async onload(): Promise<void> {
	  // Load settings from data.json or use defaults
	  await this.loadSettings();
  
	  this.lastActivityTime = Date.now();
	  this.rainbowGradientStep = 0;
  
	  // Initialize idle detection and UI elements
	  this.detectActivity();
	  this.statusBarItem = this.addStatusBarItem();
	  this.statusBarItem.addEventListener('mouseenter', this.showLastActivityTime.bind(this));
	  this.updateStatusBarColor();
	  this.statusBarItem.setText('All caught up!');
  
	  // Add the settings tab to Obsidian’s settings panel
	  this.addSettingTab(new IdleNotifierSettingTab(this.app, this));
	}
  
	/**
	 * onunload() is called by Obsidian when the plugin is unloaded.
	 * Clean up any event listeners and intervals to avoid memory leaks.
	 */
	public onunload(): void {
	  document.removeEventListener('keydown', this.resetActivityBound);
	  document.removeEventListener('mousemove', this.resetActivityBound);
  
	  if (this.checkIdleIntervalId !== null) {
		clearInterval(this.checkIdleIntervalId);
		this.checkIdleIntervalId = null;
	  }
	}
  
	/**
	 * Sets up detection of user activity by adding the appropriate event listeners
	 * and periodically checking for idle time.
	 */
	private detectActivity(): void {
	  // Remove old listeners to avoid duplicating them
	  document.removeEventListener('keydown', this.resetActivityBound);
	  document.removeEventListener('mousemove', this.resetActivityBound);
  
	  // Listen for keyboard activity
	  document.addEventListener('keydown', this.resetActivityBound);
  
	  // Conditionally listen for mouse activity
	  if (this.settings.includeMouseActivity) {
		document.addEventListener('mousemove', this.resetActivityBound);
	  }
  
	  // Clear old interval if it exists
	  if (this.checkIdleIntervalId !== null) {
		clearInterval(this.checkIdleIntervalId);
	  }
  
	  // Periodically check for idle state
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
  
	/**
	 * Bound function to reset the lastActivityTime.  
	 * Helpful to define it once so it can be removed without creating new references each time.
	 */
	private resetActivityBound = this.resetActivity.bind(this);
  
	/**
	 * Resets the lastActivityTime to the current time.
	 */
	private resetActivity(): void {
	  this.lastActivityTime = Date.now();
	  this.statusBarItem.setText('All caught up!');
	  this.updateStatusBarColor();
	}
  
	/**
	 * Updates the status bar text based on how long the user has been idle.
	 * @param idleTime - The time in milliseconds since last user activity.
	 */
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
  
	/**
	 * Updates the status bar color or gradient based on the plugin settings (rainbow or static color).
	 */
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
		// If no color is set, Obsidian’s default is used
		this.statusBarItem.style.color = this.settings.textColor || '';
		this.statusBarItem.style.backgroundImage = 'none';
	  }
	}
  
	/**
	 * Displays a notice about the exact time of last user activity, 
	 * respecting the user’s 12-hour or 24-hour format preference.
	 */
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
  
	/**
	 * Loads plugin settings from Obsidian’s persistent storage.
	 */
	private async loadSettings(): Promise<void> {
	  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
  
	/**
	 * Saves the current plugin settings to Obsidian’s persistent storage.
	 */
	public async saveSettings(): Promise<void> {
	  await this.saveData(this.settings);
	}
  }
  
  /**
   * A settings tab that allows users to configure the idle threshold, 
   * check interval, and other plugin options.
   */
  class IdleNotifierSettingTab extends PluginSettingTab {
	private readonly plugin: IdleMonitor;
  
	constructor(app: App, plugin: IdleMonitor) {
	  super(app, plugin);
	  this.plugin = plugin;
	}
  
	/**
	 * Renders the setting tab UI elements inside Obsidian's settings panel.
	 */
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
			  // Safely update or revert to default if invalid
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
			  // Safely update or revert to default if invalid
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
			  // Re-detect with updated mouse-activity preference
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
  