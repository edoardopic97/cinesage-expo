import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { SharedMovieProvider, useSharedMovie } from '../contexts/SharedMovieContext';
import LoginScreen from '../screens/LoginScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import TabNavigator from './TabNavigator';
import { colors } from '../theme/colors';
import axios from 'axios';

const Stack = createNativeStackNavigator();

const OMDB_KEY = '2ff93aac';

function DeepLinkHandler() {
  const { openSharedMovie } = useSharedMovie();
  const openRef = React.useRef(openSharedMovie);
  openRef.current = openSharedMovie;

  useEffect(() => {
    const handleUrl = async (url: string) => {
      const match = url.match(/\/movie\/(tt\d+)/);
      if (!match) return;
      try {
        const res = await axios.get('https://www.omdbapi.com/', {
          params: { apikey: OMDB_KEY, i: match[1] },
        });
        if (res.data?.Response === 'True') {
          const m = res.data;
          openRef.current({
            Title: m.Title,
            Year: m.Year,
            Poster: m.Poster !== 'N/A' ? m.Poster : '',
            Genre: m.Genre !== 'N/A' ? m.Genre : '',
            Plot: m.Plot !== 'N/A' ? m.Plot : '',
            imdbRating: m.imdbRating !== 'N/A' ? m.imdbRating : '',
            Runtime: m.Runtime !== 'N/A' ? m.Runtime : undefined,
            Country: m.Country !== 'N/A' ? m.Country : undefined,
            Type: m.Type,
            Director: m.Director !== 'N/A' ? m.Director : undefined,
            Actors: m.Actors !== 'N/A' ? m.Actors : undefined,
            Language: m.Language !== 'N/A' ? m.Language : undefined,
            Awards: m.Awards !== 'N/A' ? m.Awards : undefined,
            imdbID: m.imdbID,
            Rated: m.Rated !== 'N/A' ? m.Rated : undefined,
            Ratings: m.Ratings,
          });
        }
      } catch {}
    };

    Linking.getInitialURL().then(url => { if (url) handleUrl(url); }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub?.remove?.();
  }, []);

  return null;
}

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={colors.red} />
      </View>
    );
  }

  return (
    <SharedMovieProvider>
      <NavigationContainer>
        <DeepLinkHandler />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            user.emailVerified ? (
              <Stack.Screen name="Main" component={TabNavigator} />
            ) : (
              <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
            )
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SharedMovieProvider>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
});
