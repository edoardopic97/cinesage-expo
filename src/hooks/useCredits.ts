import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_CREDITS = 5;

// UIDs with unlimited searches
const UNLIMITED_UIDS = new Set([
  'frJAbG1XU8T3Q4ZnFa4VPOrFVOv1',
]);

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function useCredits(userId?: string) {
  const isUnlimited = userId ? UNLIMITED_UIDS.has(userId) : false;
  const [credits, setCredits] = useState(isUnlimited ? Infinity : MAX_CREDITS);
  const storageKey = userId ? `credits_${userId}` : null;

  useEffect(() => {
    if (isUnlimited) { setCredits(Infinity); return; }
    if (!storageKey) return;
    AsyncStorage.getItem(storageKey).then(raw => {
      if (!raw) { setCredits(MAX_CREDITS); return; }
      const { date, used } = JSON.parse(raw);
      setCredits(date === todayKey() ? MAX_CREDITS - used : MAX_CREDITS);
    }).catch(() => setCredits(MAX_CREDITS));
  }, [storageKey]);

  const spend = useCallback(async (): Promise<boolean> => {
    if (isUnlimited) {
      if (userId) import('../lib/firestore').then(({ incrementSearchCount }) => incrementSearchCount(userId)).catch(() => {});
      return true;
    }
    if (!storageKey) return false;
    const raw = await AsyncStorage.getItem(storageKey).catch(() => null);
    let used = 0;
    if (raw) {
      const parsed = JSON.parse(raw);
      used = parsed.date === todayKey() ? parsed.used : 0;
    }
    if (used >= MAX_CREDITS) return false;
    used++;
    await AsyncStorage.setItem(storageKey, JSON.stringify({ date: todayKey(), used }));
    setCredits(MAX_CREDITS - used);
    if (userId) import('../lib/firestore').then(({ incrementSearchCount }) => incrementSearchCount(userId)).catch(() => {});
    return true;
  }, [storageKey, userId]);

  return { credits, maxCredits: isUnlimited ? Infinity : MAX_CREDITS, spend };
}
