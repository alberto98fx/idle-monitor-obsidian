import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import './styles.css'; // Import your external CSS

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

  // We won't do inline styling or directly manipulate style.* here.
  private statusBarItem: HTMLElement;

  // Keys to ignore for "real typing" detection
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

  public async onload() {
    await this.loadSettings();

    this.lastActivityTime = Date.now();

    // Create status bar element
    this.statusBarItem = this.addStatusBarItem();
    // Apply base class from CSS
    this.statusBarItem.addClass('idle-monitor-status-bar');
    this.statusBarItem.setText('All caught up!');

    // Hover listener for showing idle time
    this.statusBarItem.addEventListener('mouseenter', this.showLastActivityTime.bind(this));

    // Initialize idle detection
    this.detectActivity();

    // Sync initial CSS
    this.applyTextColor();
    this.applyRainbowMode();

    // Add settings tab
    this.addSettingTab(new IdleNotifierSettingTab(this.app, this));
  }

  public onunload() {
    // Remove keyboard/mouse listeners
    document.removeEventListener('keydown', this.detectKeyboardActivityBound);
    document.removeEventListener('mousemove', this.resetActivityBound);

    // Clear interval
    if (this.checkIdleIntervalId !== null) {
      clearInterval(this.checkIdleIntervalId);
      this.checkIdleIntervalId = null;
    }
  }

  private detectKeyboardActivityBound = this.detectKeyboardActivity.bind(this);
  private detectKeyboardActivity(evt: KeyboardEvent): void {
    if (evt.metaKey || evt.ctrlKey || evt.altKey) return;
    if (IdleMonitor.IGNORED_KEYS.has(evt.key)) return;
    this.resetActivity();
  }

  private resetActivityBound = this.resetActivity.bind(this);

  private detectActivity(): void {
    // Remove listeners to avoid duplicates
    document.removeEventListener('keydown', this.detectKeyboardActivityBound);
    document.removeEventListener('mousemove', this.resetActivityBound);

    // Add fresh listeners
    document.addEventListener('keydown', this.detectKeyboardActivityBound);

    if (this.settings.includeMouseActivity) {
      document.addEventListener('mousemove', this.resetActivityBound);
    }

    // Clear existing interval
    if (this.checkIdleIntervalId !== null) {
      clearInterval(this.checkIdleIntervalId);
    }

    // Start checking idle state
    this.checkIdleIntervalId = window.setInterval(() => {
      const idleTime = Date.now() - this.lastActivityTime;
      if (idleTime > this.settings.idleThreshold) {
        this.updateIdleStatus(idleTime);
      } else {
        this.statusBarItem.setText('All caught up!');
        this.applyRainbowMode(); // ensure styling remains correct
      }
    }, this.settings.checkInterval);
  }

  private resetActivity(): void {
    this.lastActivityTime = Date.now();
    this.statusBarItem.setText('All caught up!');
    this.applyRainbowMode();
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
    this.applyRainbowMode();
  }

  /**
   * Apply a user-defined color via CSS variable. 
   * We do NOT directly manipulate "style.color".
   */
  private applyTextColor(): void {
    // If no color is defined, let the theme or fallback color apply
    const color = this.settings.textColor || '';
    this.statusBarItem.style.setProperty('--idle-monitor-color', color);
  }

  /**
   * Toggle rainbow mode by adding or removing the .idle-monitor-rainbow class.
   * The animation and gradient are defined in styles.css.
   */
  private applyRainbowMode(): void {
    if (this.settings.rainbowMode) {
      this.statusBarItem.addClass('idle-monitor-rainbow');
    } else {
      this.statusBarItem.removeClass('idle-monitor-rainbow');
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
    // Re-apply text color and rainbow mode if the user changed them
    this.applyTextColor();
    this.applyRainbowMode();
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
      .setName('Idle Time Threshold (ms)')
      .setDesc('Time in milliseconds before plugin considers you idle.')
      .addText((text) =>
        text
          .setPlaceholder('e.g., 30000')
          .setValue(this.plugin.settings.idleThreshold.toString())
          .onChange(async (value: string) => {
            const parsed = parseInt(value, 10);
            this.plugin.settings.idleThreshold = Number.isNaN(parsed)
              ? DEFAULT_SETTINGS.idleThreshold
              : parsed;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Check Interval (ms)')
      .setDesc('Interval in ms for checking idle state.')
      .addText((text) =>
        text
          .setPlaceholder('e.g., 1000')
          .setValue(this.plugin.settings.checkInterval.toString())
          .onChange(async (value: string) => {
            const parsed = parseInt(value, 10);
            this.plugin.settings.checkInterval = Number.isNaN(parsed)
              ? DEFAULT_SETTINGS.checkInterval
              : parsed;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Include Mouse Activity')
      .setDesc('Count mouse movements as activity?')
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
      .setDesc('Custom color for the status bar text (leave empty to use theme color).')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.textColor)
          .onChange(async (value: string) => {
            this.plugin.settings.textColor = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Rainbow Mode')
      .setDesc('Toggle rainbow gradient animation on the status bar.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rainbowMode)
          .onChange(async (value: boolean) => {
            this.plugin.settings.rainbowMode = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Time Format (24-hour)')
      .setDesc('Use 24-hour format for idle time notifications.')
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
