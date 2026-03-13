import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Dimensions, ScrollView, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { searchMovies, type MovieResult } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useCredits } from '../hooks/useCredits';

import MovieCard from '../components/MovieCard';

const { width: SCREEN_W } = Dimensions.get('window');
const TRENDING = ['Oscar winners 2024', 'Dark thriller', 'Feel-good anime', '90s action classics', 'Slow burn romance', 'Heist movies'];
const RATINGS = ['Any', '7+', '8+', '9+'];

type Category = 'all' | 'movie' | 'tv';

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { credits, maxCredits, spend } = useCredits(user?.uid);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieResult[]>([]);
  const [allResults, setAllResults] = useState<MovieResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [category, setCategory] = useState<Category>('all');
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showRatingDrop, setShowRatingDrop] = useState(false);
  const [minRating, setMinRating] = useState('Any');
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const inputRef = useRef<TextInput>(null);

  // Real-time notifications
  useEffect(() => {
    if (!user?.uid) return;
    let unsub: (() => void) | undefined;
    import('../lib/firestore').then(({ subscribeToNotifications }) => {
      unsub = subscribeToNotifications(user.uid, setNotifications);
    });
    return () => { unsub?.(); };
  }, [user?.uid]);

  const openNotifs = async () => {
    setShowNotifs(true);
    if (!user?.uid || notifications.every(n => n.read)) return;
    import('../lib/firestore').then(({ markNotificationsRead }) => {
      markNotificationsRead(user.uid).catch(() => {});
    });
  };

  // Load search history
  useEffect(() => {
    if (!user?.uid) return;
    AsyncStorage.getItem(`searchHistory_${user.uid}`).then(saved => {
      if (saved) setSearchHistory(JSON.parse(saved));
    }).catch(() => {});
  }, [user?.uid]);

  const addToHistory = useCallback(async (q: string) => {
    if (!user?.uid) return;
    const updated = [q, ...searchHistory.filter(h => h !== q)].slice(0, 10);
    setSearchHistory(updated);
    await AsyncStorage.setItem(`searchHistory_${user.uid}`, JSON.stringify(updated)).catch(() => {});
  }, [user?.uid, searchHistory]);

  const handleSearch = async (q?: string) => {
    const searchQuery = (q || query).trim();
    if (!searchQuery) return;

    const ok = await spend();
    if (!ok) {
      setError('No credits left today. Credits refresh daily!');
      return;
    }

    setError(null);
    setLoading(true);
    setHasSearched(true);
    setQuery('');
    setShowHistory(false);
    addToHistory(searchQuery);

    // Build enriched prompt with filters for the LLM
    let llmQuery = searchQuery;
    if (category === 'movie') llmQuery += ', only movies (no TV series)';
    else if (category === 'tv') llmQuery += ', only TV series (no movies)';
    if (minRating !== 'Any') llmQuery += `, minimum IMDb rating ${minRating}`;

    try {
      const res = await searchMovies(llmQuery, category);
      const movies = res.movies || [];
      setAllResults(movies);
      setResults(movies);
    } catch (err: any) {
      const msg = err?.message || 'Search failed';
      setError(msg);
      setAllResults([]);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic client-side filtering on results page
  const filteredResults = React.useMemo(() => {
    if (!hasSearched) return results;
    let filtered = allResults;
    if (category === 'movie') filtered = filtered.filter(m => (m.Type || '').toLowerCase() === 'movie');
    else if (category === 'tv') filtered = filtered.filter(m => ['series', 'tv series'].includes((m.Type || '').toLowerCase()));
    if (minRating !== 'Any') {
      const min = parseFloat(minRating);
      filtered = filtered.filter(m => parseFloat(m.imdbRating || '0') >= min);
    }
    return filtered;
  }, [allResults, category, minRating, hasSearched]);

  const displayName = profile?.displayName || user?.email?.split('@')[0] || 'User';

  const FilterPill = ({ label, value }: { label: string; value: Category; icon?: string }) => (
    <TouchableOpacity style={[s.pill, category === value && s.pillActive]} onPress={() => setCategory(value)}>
      <Text style={[s.pillText, category === value && s.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const RatingDropdown = () => (
    <View style={{ position: 'relative', zIndex: 99 }}>
      <TouchableOpacity style={[s.pill, minRating !== 'Any' && s.ratingPillActive]} onPress={() => setShowRatingDrop(!showRatingDrop)}>
        <Text style={[s.pillText, minRating !== 'Any' && { color: colors.gold }]}>{minRating === 'Any' ? '★ Rating' : `★ ${minRating}`}</Text>
        <Ionicons name={showRatingDrop ? 'chevron-up' : 'chevron-down'} size={10} color={colors.muted} />
      </TouchableOpacity>
      {showRatingDrop && (
        <View style={s.dropdown}>
          {RATINGS.map(r => (
            <TouchableOpacity key={r} style={[s.dropItem, minRating === r && s.dropItemActive]} onPress={() => { setMinRating(r); setShowRatingDrop(false); }}>
              <Text style={[s.dropItemText, minRating === r && { color: colors.gold }]}>{r === 'Any' ? 'Any rating' : `★ ${r}`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  if (!hasSearched) {
    return (
      <View style={s.container}>
        {/* Background gradient with subtle red vignette */}
        <LinearGradient colors={['#0a0a0a', '#0a0a0a']} style={StyleSheet.absoluteFill} />
        {/* Layered gradients to simulate a soft radial red glow */}
        <LinearGradient
          colors={['rgba(229,9,20,0.07)', 'transparent']}
          style={s.vignette}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 0 }}
        />
        <LinearGradient
          colors={['rgba(229,9,20,0.07)', 'transparent']}
          style={s.vignette}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 1 }}
        />
        <LinearGradient
          colors={['rgba(229,9,20,0.06)', 'transparent']}
          style={s.vignette}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0, y: 0.5 }}
        />
        <LinearGradient
          colors={['rgba(229,9,20,0.06)', 'transparent']}
          style={s.vignette}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />

        {/* Fixed top bar */}
        <View style={[s.topBarWrap, { paddingTop: insets.top + 8 }]}>
          <View style={s.topBarRow}>
            <View style={s.topBarLeft}>
              <View style={s.topAvatar}>
                <Text style={s.topAvatarText}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={s.topName} numberOfLines={1}>{displayName}</Text>
            </View>
            <View style={s.topBarRight}>
              <View style={s.topChip}>
                <Ionicons name="sparkles" size={12} color={colors.red} />
                <Text style={s.topChipTextRed}>AI</Text>
              </View>
              <View style={s.topChip}>
                <Ionicons name="flash" size={12} color={credits > 0 ? colors.gold : colors.subtle} />
                <Text style={[s.topChipTextGold, credits === 0 && { color: colors.subtle }]}>{credits}/{maxCredits}</Text>
              </View>
              <TouchableOpacity style={s.topChip} onPress={openNotifs}>
                <Ionicons name="notifications-outline" size={14} color={colors.text} />
                {notifications.filter(n => !n.read).length > 0 && <View style={s.topBellDot} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.heroContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Text style={s.heroTitle}>Find Your Next{'\n'}<Text style={s.heroAccent}>Favorite Show</Text></Text>
          <Text style={s.heroSub}>Describe any mood, genre, or vibe — our AI finds the perfect movies & TV series for you.</Text>

          <View style={s.searchRow}>
            <View style={s.inputWrap}>
              <Ionicons name="search" size={16} color={colors.subtle} style={s.searchIcon} />
              <TextInput
                ref={inputRef}
                style={s.input}
                placeholder='Try "dark thriller" or "90s comedy"…'
                placeholderTextColor={colors.subtle}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => handleSearch()}
                onFocus={() => setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity style={s.searchBtn} onPress={() => handleSearch()} disabled={!query.trim() || loading}>
              {loading ? <ActivityIndicator color={colors.white} size="small" /> : (
                <><Ionicons name="send" size={16} color={colors.white} /><Text style={s.searchBtnText}>Search</Text></>
              )}
            </TouchableOpacity>
          </View>

          <View style={s.filterRow}>
            <FilterPill label="All" value="all" icon="grid-outline" />
            <FilterPill label="Movies" value="movie" icon="film-outline" />
            <FilterPill label="TV Series" value="tv" icon="tv-outline" />
            <RatingDropdown />
          </View>

          {/* Search history dropdown */}
          {showHistory && searchHistory.length > 0 && (
            <View style={s.historyDropdown}>
              {searchHistory.slice(0, 6).map((h, i) => (
                <TouchableOpacity key={i} style={s.historyItem} onPress={() => { setQuery(h); setShowHistory(false); handleSearch(h); }}>
                  <Ionicons name="time-outline" size={13} color={colors.subtle} />
                  <Text style={s.historyText}>{h}</Text>
                  <Ionicons name="arrow-up-outline" size={13} color={colors.subtle} style={{ marginLeft: 'auto', transform: [{ rotate: '-45deg' }] }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={s.trendingSection}>
            <View style={s.trendingHeader}>
              <Ionicons name="flame" size={13} color={colors.red} />
              <Text style={s.trendingLabel}>TRENDING</Text>
            </View>
            <View style={s.trendingRow}>
              {TRENDING.map((t, i) => (
                <TouchableOpacity key={i} style={s.trendingChip} onPress={() => { setQuery(t); handleSearch(t); }}>
                  <Text style={s.trendingText}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Notifications Modal */}
        <Modal visible={showNotifs} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNotifs(false)}>
          <SafeAreaView style={s.notifModal} edges={['top', 'bottom']}>
            <View style={s.notifHeader}>
              <TouchableOpacity onPress={() => setShowNotifs(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={s.notifTitle}>Notifications</Text>
              <View style={{ width: 24 }} />
            </View>
            <FlatList
              data={notifications}
              keyExtractor={(item, i) => item.id || i.toString()}
              contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
              ListEmptyComponent={
                <View style={s.notifEmpty}>
                  <Ionicons name="notifications-off-outline" size={40} color="rgba(255,255,255,0.1)" />
                  <Text style={s.notifEmptyText}>No notifications yet</Text>
                  <Text style={s.notifEmptySub}>Friend requests, acceptances and updates will appear here.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[s.notifCard, !item.read && s.notifUnread]}>
                  <View style={s.notifIcon}>
                    <Ionicons name={item.type === 'friend_request' ? 'person-add' : item.type === 'friend_accepted' ? 'people' : 'notifications'} size={16} color={colors.red} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.notifText}>{item.message}</Text>
                    <Text style={s.notifTime}>{item.createdAt?.toDate?.()?.toLocaleDateString?.() || ''}</Text>
                  </View>
                  {!item.read && <View style={s.notifDot} />}
                </View>
              )}
            />
          </SafeAreaView>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Search bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setHasSearched(false); setResults([]); }} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={[s.inputWrap, { flex: 1 }]}>
          <Ionicons name="search" size={14} color={colors.subtle} style={s.searchIcon} />
          <TextInput
            style={[s.input, { fontSize: 14, padding: 10, paddingLeft: 34 }]}
            placeholder="New search…"
            placeholderTextColor={colors.subtle}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity style={[s.searchBtn, { paddingHorizontal: 14, paddingVertical: 10 }]} onPress={() => handleSearch()}>
          <Ionicons name="search" size={16} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={[s.filterRow, { paddingHorizontal: 16, marginBottom: 12 }]}>
        <FilterPill label="All" value="all" icon="grid-outline" />
        <FilterPill label="Movies" value="movie" icon="film-outline" />
        <FilterPill label="TV Series" value="tv" icon="tv-outline" />
        <RatingDropdown />
        <Text style={s.resultCount}>{filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.red} />
          <Text style={s.loadingText}>Searching for perfect movies…</Text>
        </View>
      ) : error ? (
        <View style={s.errorWrap}>
          <Ionicons name="alert-circle" size={20} color="#ff6b6b" />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => { setError(null); setHasSearched(false); }}>
            <Text style={{ color: colors.red, fontWeight: '700', fontSize: 13, marginTop: 8 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredResults}
          keyExtractor={(item) => item.imdbID || item.Title}
          numColumns={3}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.gridRow}
          renderItem={({ item, index }) => (
            <MovieCard movie={item} allMovies={filteredResults} currentIndex={index} />
          )}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="search-outline" size={48} color={colors.subtle} />
              <Text style={s.emptyText}>No results found. Try a different search.</Text>
              <TouchableOpacity style={s.retryBtn} onPress={() => setHasSearched(false)}>
                <Text style={s.retryText}>New Search</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  heroContent: { alignItems: 'center', padding: 24, paddingTop: 8, paddingBottom: 120 },
  topBarWrap: {
    backgroundColor: 'rgba(10,10,10,0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  topBarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 10 },
  topAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center',
  },
  topAvatarText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  topName: { color: colors.text, fontWeight: '700', fontSize: 14, flexShrink: 1 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 32, paddingHorizontal: 10, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  topChipTextRed: { color: colors.red, fontSize: 11, fontWeight: '800' },
  topChipTextGold: { color: colors.gold, fontSize: 11, fontWeight: '800' },
  topBellDot: { position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red },
  vignette: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  heroTitle: { fontSize: 34, fontWeight: '900', color: colors.white, textAlign: 'center', lineHeight: 40, letterSpacing: -0.5 },
  heroAccent: { color: colors.red },
  heroSub: { color: colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginTop: 12, marginBottom: 32, maxWidth: 340 },
  searchRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 12 },
  inputWrap: { flex: 1, position: 'relative' },
  searchIcon: { position: 'absolute', left: 14, top: 14, zIndex: 1 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, padding: 14, paddingLeft: 40, fontSize: 15, color: colors.text,
  },
  searchBtn: {
    backgroundColor: colors.red, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  searchBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 24, alignItems: 'center', width: '100%', zIndex: 99 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pillActive: { borderColor: colors.red, backgroundColor: 'rgba(229,9,20,0.15)' },
  pillText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: colors.red },
  ratingPillActive: { borderColor: 'rgba(245,197,24,0.35)', backgroundColor: 'rgba(245,197,24,0.1)' },
  dropdown: {
    position: 'absolute', bottom: 40, right: 0, zIndex: 999,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10, paddingVertical: 4, minWidth: 120,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  dropItem: { paddingHorizontal: 14, paddingVertical: 10 },
  dropItemActive: { backgroundColor: 'rgba(245,197,24,0.08)' },
  dropItemText: { color: colors.text, fontSize: 13, fontWeight: '600' },

  trendingSection: { width: '100%', marginTop: 8 },
  trendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 12 },
  trendingLabel: { color: colors.subtle, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  trendingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  trendingChip: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 99, paddingHorizontal: 16, paddingVertical: 9,
  },
  trendingText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  topBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  backBtn: { padding: 8 },
  resultCount: { color: colors.subtle, fontSize: 12, fontWeight: '600', marginLeft: 'auto' },
  grid: { paddingHorizontal: 16, paddingBottom: 100 },
  gridRow: { gap: 8, marginBottom: 8 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.subtle, fontSize: 14 },
  errorWrap: { alignItems: 'center', margin: 16, padding: 24, backgroundColor: 'rgba(229,9,20,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(229,9,20,0.2)' },
  errorText: { color: '#ff6b6b', fontSize: 14, textAlign: 'center', marginTop: 8 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: colors.subtle, fontSize: 14 },
  retryBtn: { backgroundColor: colors.red, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  retryText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  // Search history
  historyDropdown: { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, marginTop: -12, paddingTop: 4, marginBottom: 16 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  historyText: { color: colors.muted, fontSize: 14, fontWeight: '500' },
  // Notifications modal
  notifModal: { flex: 1, backgroundColor: colors.dark },
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  notifTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  notifEmpty: { alignItems: 'center', paddingVertical: 60 },
  notifEmptyText: { color: colors.subtle, fontSize: 14, fontWeight: '600', marginTop: 12 },
  notifEmptySub: { color: 'rgba(255,255,255,0.2)', fontSize: 13, marginTop: 4, textAlign: 'center', maxWidth: 260 },
  notifCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 12, marginBottom: 8 },
  notifUnread: { backgroundColor: 'rgba(229,9,20,0.04)', borderColor: 'rgba(229,9,20,0.15)' },
  notifIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(229,9,20,0.12)', alignItems: 'center', justifyContent: 'center' },
  notifText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  notifTime: { color: colors.subtle, fontSize: 11, marginTop: 2 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
});
