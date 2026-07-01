import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as KeepAwake from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const PRESETS = [10, 15, 30, 60, 120, 180, 300];
const KEEP_TAG = 'interval-bell';
const CUSTOM_DEFAULT_SEC = 10 * 60;
const CUSTOM_INPUT_ACCESSORY_ID = 'custom-interval-done';
const CUSTOM_INTERVAL_SCROLL_Y = 320;
const HISTORY_DELETE_REVEAL_WIDTH = 86;

const CHIMES = [
  {
    id: 'deep',
    label: 'Deep bowl',
    detail: 'Long, grounded strike',
    module: require('./assets/chimes/bowl-deep.mp3'),
  },
  {
    id: 'soft',
    label: 'Soft bowl',
    detail: 'Gentle, short decay',
    module: require('./assets/chimes/bowl-soft.mp3'),
  },
  {
    id: 'clear',
    label: 'Clear bowl',
    detail: 'Light, clean tone',
    module: require('./assets/chimes/bowl-clear.mp3'),
  },
  {
    id: 'bright',
    label: 'Bright bowl',
    detail: 'Open upper shimmer',
    module: require('./assets/chimes/bowl-bright.mp3'),
  },
  {
    id: 'sustain',
    label: 'Singing bowl',
    detail: 'Slow sustained bloom',
    module: require('./assets/chimes/bowl-sustain.mp3'),
  },
] as const;

type ChimeId = (typeof CHIMES)[number]['id'];

type SessionRecord = {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  intervalSec: number;
  chimeLabel: string;
  repetitions: number;
};

type AppScreen = 'setup' | 'history';

function formatInterval(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  if (r === 0) return `${m}m`;
  return `${m}m ${r}s`;
}

function formatDuration(sec: number): string {
  const rounded = Math.max(0, Math.round(sec));
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatCountdown(sec: number): string {
  const clamped = Math.max(0, Math.ceil(sec));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  if (m === 0) return `${s}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatSessionTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatSessionDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatReps(count: number): string {
  return count === 1 ? '1 rep' : `${count} reps`;
}

async function playChimePreview(module: number) {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
    const { sound } = await Audio.Sound.createAsync(module);
    sound.setOnPlaybackStatusUpdate((st) => {
      if (st.isLoaded && 'didJustFinish' in st && st.didJustFinish) {
        void sound.unloadAsync();
      }
    });
    await sound.playAsync();
  } catch {
    /* ignore */
  }
}

export default function App() {
  const { width } = useWindowDimensions();
  const [intervalSec, setIntervalSec] = useState(30);
  const [chimeId, setChimeId] = useState<ChimeId>('deep');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [repetitions, setRepetitions] = useState(0);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [screen, setScreen] = useState<AppScreen>('setup');
  const [customIntervalSec, setCustomIntervalSec] = useState(CUSTOM_DEFAULT_SEC);
  const [customMinutesText, setCustomMinutesText] = useState('10');
  const [customSecondsText, setCustomSecondsText] = useState('00');
  const [showCustomInterval, setShowCustomInterval] = useState(false);

  const cycleStartRef = useRef(Date.now());
  const sessionStartRef = useRef(Date.now());
  const repetitionsRef = useRef(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const setupScrollRef = useRef<ScrollView | null>(null);

  const chimeModule = CHIMES.find((c) => c.id === chimeId)!.module;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        const prev = soundRef.current;
        soundRef.current = null;
        if (prev) {
          await prev.unloadAsync();
        }
        const { sound } = await Audio.Sound.createAsync(chimeModule);
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
      } catch {
        /* dev / missing asset */
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [chimeModule]);

  const onChimePickerChange = (v: ChimeId) => {
    setChimeId(v);
  };

  const selectPresetInterval = (sec: number) => {
    setShowCustomInterval(false);
    setIntervalSec(sec);
  };

  const selectCustomInterval = () => {
    setShowCustomInterval(true);
    setIntervalSec(customIntervalSec);
  };

  const updateCustomIntervalPart = (part: 'minutes' | 'seconds', rawValue: string) => {
    const value = rawValue.replace(/\D/g, '').slice(0, 2);
    const nextMinutesText = part === 'minutes' ? value : customMinutesText;
    const nextSecondsText = part === 'seconds' ? value : customSecondsText;
    if (part === 'minutes') {
      setCustomMinutesText(nextMinutesText);
    } else {
      setCustomSecondsText(nextSecondsText);
    }
    const minutes = Math.min(Number.parseInt(nextMinutesText, 10) || 0, 99);
    const seconds = Math.min(Number.parseInt(nextSecondsText, 10) || 0, 59);
    const next = Math.max(1, minutes * 60 + seconds);
    setCustomIntervalSec(next);
    setIntervalSec(next);
    setShowCustomInterval(true);
  };

  const focusCustomIntervalInput = () => {
    setTimeout(() => {
      setupScrollRef.current?.scrollTo({ y: CUSTOM_INTERVAL_SCROLL_Y, animated: true });
    }, 80);
  };

  const finishCustomIntervalInput = () => {
    const minutes = Math.min(Number.parseInt(customMinutesText, 10) || 0, 99);
    const seconds = Math.min(Number.parseInt(customSecondsText, 10) || 0, 59);
    const next = Math.max(1, minutes * 60 + seconds);
    setCustomIntervalSec(next);
    setIntervalSec(next);
    setCustomMinutesText(String(Math.floor(next / 60)));
    setCustomSecondsText(String(next % 60).padStart(2, '0'));
    Keyboard.dismiss();
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== id));
  };

  useEffect(() => {
    if (!isRunning) return;
    void KeepAwake.activateKeepAwakeAsync(KEEP_TAG).catch(() => {});
    return () => {
      try {
        void KeepAwake.deactivateKeepAwake(KEEP_TAG).catch(() => {});
      } catch {
        /* ignore */
      }
    };
  }, [isRunning]);

  const playChime = useCallback(async () => {
    try {
      const s = soundRef.current;
      if (s) {
        await s.replayAsync();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const tick = useCallback(() => {
    const now = Date.now();
    const elapsed = (now - cycleStartRef.current) / 1000;
    const iv = Math.max(intervalSec, 1);
    if (elapsed >= iv) {
      const completed = Math.floor(elapsed / iv);
      void playChime();
      cycleStartRef.current += completed * iv * 1000;
      repetitionsRef.current += completed;
      setRepetitions(repetitionsRef.current);
      setProgress(0);
    } else {
      setProgress(elapsed / iv);
    }
  }, [intervalSec, playChime]);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(tick, 1000 / 60);
    return () => clearInterval(id);
  }, [isRunning, tick]);

  const start = () => {
    const now = Date.now();
    cycleStartRef.current = now;
    sessionStartRef.current = now;
    repetitionsRef.current = 0;
    setRepetitions(0);
    setProgress(0);
    setIsRunning(true);
  };

  const stop = () => {
    const endedAt = Date.now();
    const durationSec = (endedAt - sessionStartRef.current) / 1000;
    const session: SessionRecord = {
      id: `${sessionStartRef.current}-${endedAt}`,
      startedAt: sessionStartRef.current,
      endedAt,
      durationSec,
      intervalSec,
      chimeLabel: selectedChime.label,
      repetitions: repetitionsRef.current,
    };
    setSessions((prev) => [session, ...prev].slice(0, 8));
    setScreen('setup');
    setIsRunning(false);
    setProgress(0);
  };

  const selectedChime = CHIMES.find((c) => c.id === chimeId)!;
  const hasSessions = sessions.length > 0;
  const remainingSec = intervalSec * (1 - progress);
  const layoutWidth = Math.min(width, 430);
  const ringSize = Math.min(layoutWidth - 52, isRunning ? 300 : 214);
  const stroke = isRunning ? 12 : 9;
  const cx = ringSize / 2;
  const cy = ringSize / 2;
  const r = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['#071316', '#14221f', '#1d1a18']}
        locations={[0, 0.55, 1]}
        style={[StyleSheet.absoluteFill, styles.passThrough]}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'transparent', 'rgba(0,0,0,0.44)']}
        locations={[0, 0.48, 1]}
        style={[StyleSheet.absoluteFill, styles.passThrough]}
      />

      <SafeAreaView style={[styles.fill, styles.phonePane]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      {isRunning ? (
        <Pressable
          style={styles.fill}
          onPress={stop}
          accessibilityRole="button"
          accessibilityLabel="End session"
        >
          <View style={styles.runningContent}>
            <Text style={styles.runningKicker}>{formatInterval(intervalSec)} interval</Text>
            <View style={[styles.ringFrame, { width: ringSize, height: ringSize }]}>
              <Svg width={ringSize} height={ringSize}>
                <Defs>
                  <SvgLinearGradient id="ringProgress" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#f0d394" />
                    <Stop offset="0.48" stopColor="#cfe8d8" />
                    <Stop offset="1" stopColor="#f7eee0" />
                  </SvgLinearGradient>
                </Defs>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth={stroke}
                  fill="none"
                />
                <Circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  stroke="url(#ringProgress)"
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={circumference * (1 - progress)}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              </Svg>
              <View style={styles.timerFace}>
                <Text style={styles.timerText}>{formatCountdown(remainingSec)}</Text>
                <Text style={styles.timerUnit}>seconds</Text>
              </View>
            </View>
            <View style={styles.repPanel}>
              <Text style={styles.repValue}>{repetitions}</Text>
              <Text style={styles.repLabel}>{repetitions === 1 ? 'repetition' : 'repetitions'}</Text>
            </View>
            <Text style={styles.endHint}>Tap anywhere to end</Text>
          </View>
        </Pressable>
      ) : screen === 'history' ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.historyPage}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.historyPageHeader}>
            <Pressable
              onPress={() => setScreen('setup')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back to setup"
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Svg width={20} height={20} viewBox="0 0 20 20">
                <Line x1={12.5} y1={4} x2={6.5} y2={10} stroke="#d7eadf" strokeWidth={2} strokeLinecap="round" />
                <Line x1={6.5} y1={10} x2={12.5} y2={16} stroke="#d7eadf" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </Pressable>
            <View style={styles.historyPageTitleBlock}>
              <Text style={styles.historyPageTitle}>History</Text>
              <Text style={styles.historyPageSubhead}>Past sessions</Text>
            </View>
          </View>

          <View style={styles.historyList}>
            {sessions.map((session) => (
              <SwipeDeleteHistoryRow
                key={session.id}
                session={session}
                onDelete={() => deleteSession(session.id)}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          ref={setupScrollRef}
          style={styles.fill}
          contentContainerStyle={styles.setup}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.appName}>Bell</Text>
            <Text style={styles.appSubhead}>Interval timer</Text>
            {hasSessions ? (
              <Pressable
                onPress={() => setScreen('history')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Open session history"
                style={({ pressed }) => [
                  styles.historyButton,
                  pressed && styles.pressed,
                ]}
              >
                <Svg width={18} height={18} viewBox="0 0 18 18">
                  <Circle cx={9} cy={9} r={6.5} stroke="#d7eadf" strokeWidth={1.7} fill="none" />
                  <Line x1={9} y1={9} x2={9} y2={5.5} stroke="#d7eadf" strokeWidth={1.7} strokeLinecap="round" />
                  <Line x1={9} y1={9} x2={12} y2={10.8} stroke="#d7eadf" strokeWidth={1.7} strokeLinecap="round" />
                </Svg>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.previewWrap}>
            <View style={[styles.ringFrame, { width: ringSize, height: ringSize }]}>
              <Svg width={ringSize} height={ringSize}>
                <Defs>
                  <SvgLinearGradient id="idleRing" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#b9d8c4" />
                    <Stop offset="1" stopColor="#f0d394" />
                  </SvgLinearGradient>
                </Defs>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  stroke="url(#idleRing)"
                  strokeWidth={stroke}
                  fill="none"
                  opacity={0.86}
                />
              </Svg>
              <View style={styles.timerFace}>
                <Text style={styles.idleTime}>{formatInterval(intervalSec)}</Text>
                <Text style={styles.idleChime}>{selectedChime.label}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Interval</Text>
            <View style={styles.intervalGrid}>
              {PRESETS.map((p) => {
                const selected = p === intervalSec && !showCustomInterval;
                return (
                  <Pressable
                    key={p}
                    onPress={() => selectPresetInterval(p)}
                    style={({ pressed }) => [
                      styles.intervalChip,
                      selected && styles.intervalChipSelected,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.intervalText, selected && styles.intervalTextSelected]}>
                      {formatInterval(p)}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={selectCustomInterval}
                style={({ pressed }) => [
                  styles.intervalChip,
                  showCustomInterval && styles.intervalChipSelected,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: showCustomInterval }}
              >
                <Text style={[styles.intervalText, showCustomInterval && styles.intervalTextSelected]}>
                  Custom
                </Text>
              </Pressable>
            </View>
            {showCustomInterval ? (
              <View style={styles.customIntervalPanel}>
                <View style={styles.customIntervalField}>
                  <TextInput
                    value={customMinutesText}
                    onChangeText={(value) => updateCustomIntervalPart('minutes', value)}
                    onFocus={focusCustomIntervalInput}
                    onSubmitEditing={finishCustomIntervalInput}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    blurOnSubmit
                    inputAccessoryViewID={CUSTOM_INPUT_ACCESSORY_ID}
                    selectTextOnFocus
                    maxLength={2}
                    style={styles.customIntervalInput}
                    accessibilityLabel="Custom interval minutes"
                  />
                  <Text style={styles.customIntervalUnit}>min</Text>
                </View>
                <View style={styles.customIntervalDivider} />
                <View style={styles.customIntervalField}>
                  <TextInput
                    value={customSecondsText}
                    onChangeText={(value) => updateCustomIntervalPart('seconds', value)}
                    onFocus={focusCustomIntervalInput}
                    onSubmitEditing={finishCustomIntervalInput}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    blurOnSubmit
                    inputAccessoryViewID={CUSTOM_INPUT_ACCESSORY_ID}
                    selectTextOnFocus
                    maxLength={2}
                    style={styles.customIntervalInput}
                    accessibilityLabel="Custom interval seconds"
                  />
                  <Text style={styles.customIntervalUnit}>sec</Text>
                </View>
                <Pressable
                  onPress={finishCustomIntervalInput}
                  accessibilityRole="button"
                  accessibilityLabel="Done editing custom interval"
                  style={({ pressed }) => [styles.customIntervalDone, pressed && styles.pressed]}
                >
                  <Text style={styles.customIntervalDoneText}>Done</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={[styles.section, styles.chimeSection]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, styles.sectionHeaderLabel]}>Chime</Text>
              <Pressable
                onPress={() => void playChimePreview(chimeModule)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Play selected chime"
                style={({ pressed }) => [styles.previewButton, pressed && styles.pressed]}
              >
                <Text style={styles.previewButtonText}>Play</Text>
              </Pressable>
            </View>

            <View style={styles.chimeList}>
              {CHIMES.map((c) => {
                const selected = c.id === chimeId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => onChimePickerChange(c.id)}
                    style={({ pressed }) => [
                      styles.chimeRow,
                      selected && styles.chimeRowSelected,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <View style={styles.chimeCopy}>
                      <Text style={[styles.chimeLabel, selected && styles.chimeLabelSelected]}>{c.label}</Text>
                      <Text style={styles.chimeDetail}>{c.detail}</Text>
                    </View>
                    <View style={[styles.radio, selected && styles.radioSelected]} />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            onPress={start}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>Begin session</Text>
          </Pressable>

        </ScrollView>
      )}
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={CUSTOM_INPUT_ACCESSORY_ID}>
          <View style={styles.inputAccessory}>
            <Pressable
              onPress={finishCustomIntervalInput}
              accessibilityRole="button"
              accessibilityLabel="Done editing custom interval"
              style={({ pressed }) => [styles.inputAccessoryButton, pressed && styles.pressed]}
            >
              <Text style={styles.inputAccessoryButtonText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function SwipeDeleteHistoryRow({
  session,
  onDelete,
}: {
  session: SessionRecord;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);

  const animateTo = useCallback(
    (value: number) => {
      Animated.spring(translateX, {
        toValue: value,
        useNativeDriver: true,
        tension: 90,
        friction: 12,
      }).start();
      isOpenRef.current = value < 0;
    },
    [translateX],
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        const base = isOpenRef.current ? -HISTORY_DELETE_REVEAL_WIDTH : 0;
        const next = Math.max(-HISTORY_DELETE_REVEAL_WIDTH, Math.min(0, base + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldOpen = gesture.dx < -34 || (isOpenRef.current && gesture.dx > -24);
        animateTo(shouldOpen ? -HISTORY_DELETE_REVEAL_WIDTH : 0);
      },
      onPanResponderTerminate: () => {
        animateTo(isOpenRef.current ? -HISTORY_DELETE_REVEAL_WIDTH : 0);
      },
    }),
  ).current;

  return (
    <View style={styles.historySwipeFrame}>
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel="Delete session"
        style={({ pressed }) => [styles.historyDeleteAction, pressed && styles.pressed]}
      >
        <Text style={styles.historyDeleteText}>Delete</Text>
      </Pressable>
      <Animated.View
        style={[styles.historyRow, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.historyMain}>
          <Text style={styles.historyTitle}>
            {formatReps(session.repetitions)} · {formatDuration(session.durationSec)}
          </Text>
          <Text style={styles.historyDetail}>
            {formatInterval(session.intervalSec)} · {session.chimeLabel}
          </Text>
        </View>
        <View style={styles.historyDateStack}>
          <Text style={styles.historyDate}>{formatSessionDate(session.endedAt)}</Text>
          <Text style={styles.historyTime}>{formatSessionTime(session.endedAt)}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#071316',
    alignItems: 'center',
  },
  fill: {
    flex: 1,
  },
  phonePane: {
    width: '100%',
    maxWidth: 430,
  },
  passThrough: {
    pointerEvents: 'none',
  },
  setup: {
    minHeight: '100%',
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 28,
  },
  header: {
    width: '100%',
    alignItems: 'center',
    minHeight: 76,
    marginBottom: 16,
    position: 'relative',
  },
  historyButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(207,232,216,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(207,232,216,0.18)',
  },
  appName: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
    color: '#f7f0e7',
  },
  appSubhead: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(247,240,231,0.62)',
  },
  previewWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  section: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: 'rgba(247,240,231,0.56)',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  sectionHeaderLabel: {
    marginBottom: 0,
  },
  intervalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chimeSection: {
    marginTop: -4,
  },
  intervalChip: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 70,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(247,240,231,0.12)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalChipSelected: {
    backgroundColor: '#f2ddad',
    borderColor: '#f2ddad',
  },
  intervalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f7f0e7',
  },
  intervalTextSelected: {
    color: '#14201d',
  },
  customIntervalPanel: {
    minHeight: 64,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(247,240,231,0.12)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  customIntervalField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  customIntervalInput: {
    minWidth: 48,
    paddingVertical: 8,
    paddingHorizontal: 4,
    color: '#f7f0e7',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    textAlign: 'center',
  },
  customIntervalUnit: {
    marginLeft: 5,
    color: 'rgba(247,240,231,0.56)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  customIntervalDivider: {
    width: 1,
    height: 34,
    backgroundColor: 'rgba(247,240,231,0.12)',
  },
  customIntervalDone: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(207,232,216,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(207,232,216,0.2)',
  },
  customIntervalDoneText: {
    color: '#d7eadf',
    fontSize: 13,
    fontWeight: '700',
  },
  inputAccessory: {
    minHeight: 46,
    paddingHorizontal: 14,
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: '#14201d',
    borderTopWidth: 1,
    borderTopColor: 'rgba(247,240,231,0.12)',
  },
  inputAccessoryButton: {
    minHeight: 34,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputAccessoryButtonText: {
    color: '#f2ddad',
    fontSize: 15,
    fontWeight: '700',
  },
  chimeList: {
    gap: 10,
  },
  chimeRow: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(247,240,231,0.11)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chimeRowSelected: {
    borderColor: 'rgba(240,211,148,0.72)',
    backgroundColor: 'rgba(240,211,148,0.13)',
  },
  chimeCopy: {
    flex: 1,
    paddingRight: 14,
  },
  chimeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f7f0e7',
  },
  chimeLabelSelected: {
    color: '#fff6df',
  },
  chimeDetail: {
    marginTop: 3,
    fontSize: 13,
    color: 'rgba(247,240,231,0.52)',
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(247,240,231,0.3)',
  },
  radioSelected: {
    borderWidth: 5,
    borderColor: '#f2ddad',
    backgroundColor: '#14201d',
  },
  previewButton: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(207,232,216,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(207,232,216,0.2)',
  },
  previewButtonText: {
    color: '#d7eadf',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBtn: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    marginTop: 0,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f2ddad',
    elevation: 4,
  },
  primaryBtnPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14201d',
  },
  runningContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 44,
  },
  ringFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerFace: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runningKicker: {
    marginBottom: 28,
    color: 'rgba(247,240,231,0.5)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timerText: {
    fontSize: 72,
    lineHeight: 82,
    fontWeight: '700',
    color: '#f7f0e7',
  },
  timerUnit: {
    marginTop: -4,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(247,240,231,0.48)',
  },
  idleTime: {
    fontSize: 46,
    lineHeight: 54,
    fontWeight: '700',
    color: '#f7f0e7',
  },
  idleChime: {
    marginTop: 2,
    fontSize: 14,
    color: 'rgba(247,240,231,0.58)',
  },
  endHint: {
    marginTop: 24,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(247,240,231,0.42)',
  },
  repPanel: {
    minWidth: 138,
    marginTop: 28,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(247,240,231,0.11)',
  },
  repValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: '#f7f0e7',
  },
  repLabel: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(247,240,231,0.5)',
  },
  historyPage: {
    minHeight: '100%',
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 28,
  },
  historyPageHeader: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    minHeight: 52,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 8,
    width: 38,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(207,232,216,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(207,232,216,0.18)',
  },
  historyPageTitleBlock: {
    alignItems: 'center',
  },
  historyPageTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: '#f7f0e7',
  },
  historyPageSubhead: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(247,240,231,0.56)',
  },
  historyList: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: 9,
  },
  historySwipeFrame: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#8e2b25',
  },
  historyDeleteAction: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: HISTORY_DELETE_REVEAL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b33a32',
  },
  historyDeleteText: {
    color: '#fff7f2',
    fontSize: 14,
    fontWeight: '700',
  },
  historyRow: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(247,240,231,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyMain: {
    flex: 1,
    paddingRight: 12,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f7f0e7',
  },
  historyDetail: {
    marginTop: 3,
    fontSize: 12,
    color: 'rgba(247,240,231,0.5)',
  },
  historyDateStack: {
    alignItems: 'flex-end',
  },
  historyDate: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(247,240,231,0.68)',
  },
  historyTime: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(207,232,216,0.62)',
  },
  pressed: {
    opacity: 0.76,
  },
});
