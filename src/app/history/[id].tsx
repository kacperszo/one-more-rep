import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, RecordBadge, SectionTitle, Stat } from '@/components/ui';
import { INTENSITY_LABEL, INTENSITY_MET } from '@/lib/calories';
import { capitalize, formatDate, formatDuration, formatTime } from '@/lib/format';
import { recordSetIds } from '@/lib/records';
import { workoutStats } from '@/lib/workout';
import { useAppStore } from '@/state/AppStore';
import { flags } from '@/config/features';
import { spacing, useColors } from '@/theme';

export default function WorkoutDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { workouts, active, deleteWorkout, repeatWorkout } = useAppStore();
  const workout = workouts.find((w) => w.id === id);

  if (!workout) return <EmptyState icon="alert-circle-outline" title="Workout not found" />;

  const stats = workoutStats(workout);
  const records = flags.personalRecords ? recordSetIds(workout, workouts) : new Set<string>();

  const remove = () =>
    Alert.alert('Delete workout?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteWorkout(workout.id);
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: workout.name }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View>
          <Text style={[styles.title, { color: c.text }]}>{workout.name}</Text>
          <Text style={{ color: c.muted }}>
            {formatDate(workout.startedAt)}, {formatTime(workout.startedAt)}
            {workout.endedAt ? ` – ${formatTime(workout.endedAt)}` : ''}
          </Text>
        </View>

        <Card style={{ gap: spacing.lg }}>
          {(flags.stopwatch || flags.calories || records.size > 0) && (
            <View style={styles.stats}>
              {flags.stopwatch && <Stat label="Duration" value={formatDuration(workout.durationMs ?? 0)} />}
              {flags.calories && <Stat label="kcal" value={String(workout.calories ?? 0)} />}
              {records.size > 0 && <Stat label="Records" value={String(records.size)} />}
            </View>
          )}
          <View style={styles.stats}>
            <Stat label="Exercises" value={String(stats.exercises)} />
            <Stat label="Sets" value={String(stats.sets)} />
            <Stat label="Reps" value={String(stats.reps)} />
            {flags.weightTracking && <Stat label="Volume (kg)" value={String(stats.volume)} />}
          </View>
          {flags.calories && (
            <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>
              {INTENSITY_LABEL[workout.intensity]} intensity (MET {INTENSITY_MET[workout.intensity]})
              {workout.bodyWeightKg ? ` · ${workout.bodyWeightKg} kg body weight` : ''}
            </Text>
          )}
        </Card>

        {workout.exercises.map((e) => (
          <Card key={e.id} style={{ gap: spacing.sm }}>
            <Text style={[styles.exName, { color: c.text }]}>{capitalize(e.name)}</Text>
            {e.sets.map((s, i) => (
              <View key={s.id} style={styles.setRow}>
                <Text style={{ color: c.muted, width: 56 }}>Set {i + 1}</Text>
                <Text style={{ color: s.done ? c.text : c.muted, flex: 1, fontVariant: ['tabular-nums'] }}>
                  {s.reps} reps{flags.weightTracking && s.weight > 0 ? ` × ${s.weight} kg` : ''}
                </Text>
                {records.has(s.id) && <RecordBadge />}
                {!s.done && <Text style={{ color: c.muted, fontSize: 12 }}>skipped</Text>}
              </View>
            ))}
          </Card>
        ))}

        {workout.exercises.length === 0 && (
          <Card>
            <SectionTitle>No exercises logged</SectionTitle>
          </Card>
        )}

        {flags.repeatWorkout && workout.exercises.length > 0 && (
          <Button
            title={active ? 'Finish the current workout to repeat this one' : 'Repeat workout'}
            icon="repeat"
            variant="secondary"
            disabled={active != null}
            onPress={() => {
              if (repeatWorkout(workout)) router.push('/workout');
            }}
          />
        )}
        <Button title="Delete workout" icon="trash-outline" variant="ghost" onPress={remove} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  title: { fontSize: 24, fontWeight: '800' },
  stats: { flexDirection: 'row' },
  exName: { fontSize: 17, fontWeight: '700' },
  setRow: { flexDirection: 'row', alignItems: 'center' },
});
