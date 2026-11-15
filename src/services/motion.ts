/**
 * Accelerometer samples in g, from whatever the platform offers.
 * The rep counter only depends on this module, so other sources (a watch
 * streaming samples, a recorded file) can be plugged in here later.
 */
import { Accelerometer } from 'expo-sensors';
import { Platform } from 'react-native';
import type { Sample } from '@/lib/repCounter';

const SAMPLE_INTERVAL_MS = 40; // 25 Hz, same as the watch apps
const G = 9.80665;

export type MotionSubscription = { remove: () => void };

export async function isMotionAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
  try {
    return await Accelerometer.isAvailableAsync();
  } catch {
    return false;
  }
}

export function subscribeToMotion(onSample: (sample: Sample) => void): MotionSubscription {
  if (Platform.OS === 'web') {
    // expo-sensors reports orientation angles on web, so read real acceleration directly.
    const handler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      onSample({ t: Date.now(), x: a.x / G, y: a.y / G, z: a.z / G });
    };
    window.addEventListener('devicemotion', handler);
    return { remove: () => window.removeEventListener('devicemotion', handler) };
  }
  Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
  return Accelerometer.addListener(({ x, y, z }) => onSample({ t: Date.now(), x, y, z }));
}
