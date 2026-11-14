import { router } from 'expo-router';
import { useCallback } from 'react';
import { ExerciseCatalog } from '@/components/ExerciseCatalog';
import type { Exercise } from '@/lib/types';
import { flags } from '@/config/features';

export default function ExercisesScreen() {
  const open = useCallback((e: Exercise) => router.push(`/exercise/${encodeURIComponent(e.id)}`), []);
  return <ExerciseCatalog onSelect={flags.exerciseDetails ? open : undefined} />;
}
