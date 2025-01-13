import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
  } from 'obsidian';
  
  /**
   * Import our external stylesheet. Your bundler must be configured
   * to handle CSS imports for this to work properly (e.g., rollup-plugin-postcss).
   */
  import './styles.css';
  
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
	private rainbowGradientStep: number;
  
	/**
	 * This is where we store the reference to our status bar element.
	 */
	private statusBarItem: HTMLElement;
  
	/**
	 * A set of keys that will be ignored for resetting idle time.
	 * (e.g., Shift, Meta, Ctrl, F1-F12, etc.)
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
  
	/**
	 * The main onload lifecycle method for Obsidian plugins.
	 */
	public async onload(): Promise<void> {
	  await this.loadSettings();
  
	  this.lastActivityTime = Date.now();
	  this.rainbowGradientStep = 0;
  
	  // Initialize activity detection
	  this.detectActivity();
  
	  // Create the status bar item and apply our custom CSS class
	  this.statusBarItem = this.addStatusBarItem();
	  this.statusBarItem.addClass('idle-monitor-status-bar'); 
	  this.statusBarItem.setText('All caught up!');
	  
	  // Register hover listener
	  this.statusBarItem.addEventListener('mouseenter', this.showLastActivityTime.bind(this));
	  
	  // Set initial color/gradient
	  this.updateStatusBarColor();
  
	  // Add settings tab
	  this.addSettingTab(new IdleNotifierSettingTab(this.app, this));
	}
  
	/**
	 * Plugin unload lifecycle method.
	 * Remove any event listeners or intervals here to prevent memory leaks.
	 */
	public onunload(): void {
	  document.removeEventListener('keydown', this.detectKeyboardActivityBound);
	  document.removeEventListener('mousemove', this.resetActivityBound);
  
	  if (this.checkIdleIntervalId !== null) {
		clearInterval(this.checkIdleIntervalId);
		this.checkIdleIntervalId = null;
	  }
	}
  
	/**
	 * Ensures we only treat "real typing" as activity by filtering out
	 * shortcuts, function keys, etc.
	 */
	private detectKeyboardActivityBound = this.detectKeyboardActivity.bind(this);
	private detectKeyboardActivity(evt: KeyboardEvent): void {
	  // If a modifier key (cmd, ctrl, alt) is active, ignore.
	  if (evt.metaKey || evt.ctrlKey || evt.altKey) return;
  
	  // If the pressed key is in the ignored set, skip resetting.
	  if (IdleMonitor.IGNORED_KEYS.has(evt.key)) return;
  
	  // Otherwise, treat as real typing
	  this.resetActivity();
	}
  
	/**
	 * Optional mouse activity reset, if enabled in settings.
	 */
	private resetActivityBound = this.resetActivity.bind(this);
  
	private detectActivity(): void {
	  // Clean up old listeners
	  document.removeEventListener('keydown', this.detectKeyboardActivityBound);
	  document.removeEventListener('mousemove', this.resetActivityBound);
  
	  // Add new listeners
	  document.addEventListener('keydown', this.detectKeyboardActivityBound);
  
	  if (this.settings.includeMouseActivity) {
		document.addEventListener('mousemove', this.resetActivityBound);
	  }
  
	  // Clear previous interval if exists
	  if (this.checkIdleIntervalId !== null) {
		clearInterval(this.checkIdleIntervalId);
	  }
  
	  // Start a new interval to check idle state
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
  
	/**
	 * Applies either rainbow gradient styling or a static color 
	 * depending on user settings. 
	 * 
	 * Here, if `rainbowMode` is true, we rely on in-code style manipulations. 
	 * Otherwise, we just set the `color` property, letting external CSS handle the rest.
	 */
	private updateStatusBarColor(): void {
	  if (this.settings.rainbowMode) {
		this.statusBarItem.removeClass('idle-monitor-status-bar'); // optional if you want to remove base styling
  
		// Create dynamic rainbow effect
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
		// Re-apply or retain base class
		this.statusBarItem.addClass('idle-monitor-status-bar'); 
		
		// If user set a custom color, apply it
		if (this.settings.textColor) {
		  this.statusBarItem.style.color = this.settings.textColor;
		} else {
		  // or let CSS define the default
		  this.statusBarItem.style.color = '';
		}
		this.statusBarItem.style.backgroundImage = 'none';
	  }
	}
  
	/**
	 * Show a Notice with the exact time user became idle (12h or 24h format).
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
	 * Load settings from persistent storage.
	 */
	private async loadSettings(): Promise<void> {
	  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
  
	/**
	 * Save settings to persistent storage.
	 */
	public async saveSettings(): Promise<void> {
	  await this.saveData(this.settings);
	}
  }
  
  /**
   * Settings tab for configuring idle threshold, intervals, etc.
   */
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
  