import * as Haptics from 'expo-haptics';
import { flags } from '@/config/features';

/** Haptic feedback that respects the `haptics` feature flag. */
export const haptics = {
  selection() {
    if (flags.haptics) Haptics.selectionAsync().catch(() => {});
  },
  success() {
    if (flags.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};
