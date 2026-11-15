import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { capitalize } from '@/lib/format';
import { formatSet, lastPerformance, recordSetIds } from '@/lib/records';
import { repProfileFor } from '@/lib/repCounter';
import { useAutoRepCounter } from '@/lib/useAutoRepCounter';
import type { WorkoutExercise } from '@/lib/types';
import { haptics } from '@/lib/haptics';
import { useAppStore } from '@/state/AppStore';
import { flags } from '@/config/features';
import { useRestTimer } from '@/state/RestTimer';
import { radius, spacing, useColors } from '@/theme';
import { HowToSection } from './ExerciseInstructions';
import { Stepper } from './Stepper';
import { Button, Card, IconButton, RecordBadge } from './ui';

/** One exercise in the active workout: list of sets plus a big rep counter for the selected set. */
export function ExerciseLogCard({ entry }: { entry: WorkoutExercise }) {
  const c = useColors();
  const { profile, active, workouts, addSet, updateSet, removeSet, removeExercise } = useAppStore();
  const rest = useRestTimer();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected =
    entry.sets.find((s) => s.id === selectedId) ?? entry.sets.find((s) => !s.done) ?? null;
  const selectedIndex = selected ? entry.sets.indexOf(selected) : -1;

  const previous = useMemo(
    () => (flags.previousPerformance ? lastPerformance(workouts, entry.exerciseId) : []),
    [workouts, entry.exerciseId],
  );
  const records = useMemo(
    () => (flags.personalRecords && active ? recordSetIds(active, workouts) : new Set<string>()),
    [active, workouts],
  );

  // Auto-count adds reps to whichever set is selected when a rep is detected.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const auto = useAutoRepCounter(() => {
    const target = selectedRef.current;
    if (!target || target.done) return;
    haptics.selection();
    updateSet(entry.id, target.id, { reps: target.reps + 1 });
  });
  const stopAuto = auto.stop;
  const nothingToCount = !selected || selected.done;
  useEffect(() => {
    if (nothingToCount) stopAuto();
  }, [nothingToCount, stopAuto]);

  const complete = () => {
    if (!selected) return;
    auto.stop();
    updateSet(entry.id, selected.id, { done: true });
    setSelectedId(null);
    haptics.success();
    if (flags.restTimer && profile.autoStartRest) rest.start();
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={styles.header}>
        <Pressable
          style={{ flex: 1 }}
          disabled={!flags.exerciseDetails}
          onPress={() => router.push(`/exercise/${encodeURIComponent(entry.exerciseId)}`)}
        >
          <Text style={[styles.name, { color: c.text }]}>{capitalize(entry.name)}</Text>
          {(entry.target || entry.equipment) && (
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {[entry.target, entry.equipment].filter(Boolean).map((s) => capitalize(s!)).join(' · ')}
            </Text>
          )}
        </Pressable>
        <IconButton icon="trash-outline" label="Remove exercise" onPress={() => removeExercise(entry.id)} />
      </View>

      {previous.length > 0 && (
        <Text style={{ color: c.muted, fontSize: 13 }}>
          Last time: {previous.map((s) => formatSet(s, flags.weightTracking)).join(' · ')}
        </Text>
      )}

      {flags.instructions && <HowToSection exerciseId={entry.exerciseId} />}

      <View style={{ gap: spacing.xs }}>
        {entry.sets.map((s, i) => {
          const isSelected = selected?.id === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setSelectedId(s.id)}
              style={[
                styles.setRow,
                { backgroundColor: isSelected ? c.chip : 'transparent', borderColor: isSelected ? c.primary : c.border },
              ]}
            >
              <Text style={[styles.setNo, { color: c.muted }]}>Set {i + 1}</Text>
              <Text style={[styles.setValue, { color: c.text }]}>
                {s.reps} reps{flags.weightTracking && s.weight > 0 ? ` × ${s.weight} kg` : ''}
              </Text>
              {records.has(s.id) && <RecordBadge />}
              <Pressable
                hitSlop={8}
                accessibilityLabel={s.done ? 'Mark set as not done' : 'Mark set as done'}
                onPress={() => updateSet(entry.id, s.id, { done: !s.done })}
              >
                <Ionicons
                  name={s.done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={s.done ? c.success : c.muted}
                />
              </Pressable>
              <IconButton icon="close" size={18} label="Remove set" onPress={() => removeSet(entry.id, s.id)} />
            </Pressable>
          );
        })}
      </View>

      {selected && (
        <View style={[styles.editor, { borderColor: c.border }]}>
          <Text style={{ color: c.muted, fontWeight: '700' }}>Set {selectedIndex + 1}</Text>
          <Stepper large label="Reps" value={selected.reps} onChange={(reps) => updateSet(entry.id, selected.id, { reps })} />
          {flags.weightTracking && (
            <Stepper
              label="Weight (kg)"
              value={selected.weight}
              step={2.5}
              decimals={2}
              onChange={(weight) => updateSet(entry.id, selected.id, { weight })}
            />
          )}
          {flags.autoRepCounting && auto.available && !selected.done && (
            <View style={{ alignSelf: 'stretch', gap: spacing.xs }}>
              <Button
                title={auto.counting ? 'Stop auto-count' : 'Auto-count reps'}
                icon={auto.counting ? 'stop-circle-outline' : 'pulse'}
                variant="secondary"
                onPress={() => (auto.counting ? auto.stop() : auto.start(repProfileFor(entry.name)))}
              />
              {auto.counting && (
                <Text style={{ color: c.muted, fontSize: 13, textAlign: 'center' }}>
                  Counting from the motion sensor. Keep the device on your arm and start the set.
                </Text>
              )}
            </View>
          )}
          {!selected.done && <Button title="Complete set" icon="checkmark" onPress={complete} style={{ alignSelf: 'stretch' }} />}
        </View>
      )}

      <Button title="Add set" icon="add" variant="secondary" onPress={() => addSet(entry.id)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  name: { fontSize: 17, fontWeight: '700' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  setNo: { width: 48, fontWeight: '600' },
  setValue: { flex: 1, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  editor: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
