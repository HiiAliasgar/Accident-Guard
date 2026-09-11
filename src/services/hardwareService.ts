// Hardware & Driver Power Management Service
// Manages Screen WakeLock, Network Connectivity, Native Haptics, and Background Doze Suppression

/** WakeLock API sentinel (not yet in all TS libs) */
interface WakeLockSentinel {
  readonly released: boolean;
  readonly type: 'screen';
  release(): Promise<void>;
  addEventListener(type: 'release', callback: () => void): void;
}

import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';

type NetworkCallback = (isOnline: boolean) => void;

class HardwareService {
  private wakeLockSentinel: WakeLockSentinel | null = null;
  private isWakeLockRequested: boolean = false;
  private networkListeners: Set<NetworkCallback> = new Set();
  private isOnlineStatus: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window !== 'undefined') {
      // Network connectivity listeners
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));

      // Auto-reacquire WakeLock on visibility change (e.g. driver locks/unlocks phone)
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && this.isWakeLockRequested) {
          await this.acquireWakeLock();
        }
      });

      // Capacitor Native App Lifecycle
      try {
        App.addListener('appStateChange', async (state) => {
          if (state.isActive && this.isWakeLockRequested) {
            await this.acquireWakeLock();
          }
        });
      } catch (err) {
        console.debug('[HardwareService] Capacitor App plugin unavailable (browser-only mode):', err);
      }
    }
  }

  /**
   * Keep mobile device screen and CPU awake while driving monitor is active
   */
  public async acquireWakeLock(): Promise<boolean> {
    this.isWakeLockRequested = true;
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.wakeLockSentinel = await (navigator as unknown as { wakeLock: { request(type: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen');
        if (this.wakeLockSentinel) {
          this.wakeLockSentinel.addEventListener('release', () => {
            this.wakeLockSentinel = null;
          });
        }
        return true;
      } catch (err) {
        console.debug('[HardwareService] Screen WakeLock unavailable:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Release WakeLock when monitoring is turned off or app closed
   */
  public async releaseWakeLock(): Promise<void> {
    this.isWakeLockRequested = false;
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch (err) {
        console.debug('[HardwareService] WakeLock release failed:', err);
      }
      this.wakeLockSentinel = null;
    }
  }

  public isWakeLockActive(): boolean {
    return this.wakeLockSentinel !== null;
  }

  /**
   * Trigger physical emergency vibration (via Capacitor Haptics with Web Vibration fallback)
   */
  public async triggerEmergencyVibration(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([500, 200, 500, 200, 1000]);
        } catch {
          // Ignore
        }
      }
    }
  }

  /**
   * Trigger light feedback vibration on button tap
   */
  public async triggerHapticFeedback(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(40);
        } catch {
          // Ignore
        }
      }
    }
  }

  /**
   * Network Connectivity Monitor
   */
  public isOnline(): boolean {
    return this.isOnlineStatus;
  }

  public subscribeNetworkStatus(callback: NetworkCallback): () => void {
    this.networkListeners.add(callback);
    callback(this.isOnlineStatus);
    return () => {
      this.networkListeners.delete(callback);
    };
  }

  private handleNetworkChange(status: boolean): void {
    this.isOnlineStatus = status;
    this.networkListeners.forEach((listener) => {
      try {
        listener(status);
      } catch {
        // Ignore listener error
      }
    });
  }
}

export const hardwareService = new HardwareService();
