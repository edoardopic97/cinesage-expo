import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
  Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { setUserProfile, checkUsernameExists } from '../lib/firestore';
import { colors } from '../theme/colors';

const FEATURES = [
  { icon: 'sparkles', color: colors.red, title: 'AI-Powered Search', desc: 'Describe any mood or vibe and find the perfect film' },
  { icon: 'star', color: colors.gold, title: 'Track & Rate', desc: 'Build your watched list and rate every movie you see' },
  { icon: 'bookmark', color: '#60a5fa', title: 'Watchlist', desc: 'Save films to watch later, never forget a recommendation' },
  { icon: 'people', color: '#4ade80', title: 'Social Discovery', desc: 'Connect with friends and share your favourite picks' },
];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1.2, duration: 800, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      ]),
      Animated.timing(logoScale, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => setSplashDone(true));
  }, []);

  const getErrorMessage = (error: any): string => {
    const code = error.code || '';
    if (code.includes('email-already-in-use')) return 'This email is already registered';
    if (code.includes('invalid-email')) return 'Please enter a valid email address';
    if (code.includes('weak-password')) return 'Password must be at least 6 characters';
    if (code.includes('user-not-found')) return 'No account found with this email';
    if (code.includes('wrong-password')) return 'Incorrect password';
    if (code.includes('invalid-credential')) return 'Invalid email or password';
    if (code.includes('too-many-requests')) return 'Too many attempts. Please try again later';
    if (code.includes('network-request-failed')) return 'Network error. Check your connection';
    return 'Something went wrong. Please try again';
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        if (!username.trim()) { Alert.alert('Error', 'Username is required'); setLoading(false); return; }
        if (username.includes(' ')) { Alert.alert('Error', 'Username cannot contain spaces'); setLoading(false); return; }
        if (password !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); setLoading(false); return; }
        const exists = await checkUsernameExists(username);
        if (exists) { Alert.alert('Error', 'Username already taken'); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await setUserProfile(cred.user.uid, { email: email.trim(), displayName: username.trim() });
        await sendEmailVerification(cred.user);
        Alert.alert('Check your email 📧', 'We sent a verification link to your email. Please verify to continue.');
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (!cred.user.emailVerified) {
          Alert.alert('Verify your email', 'Please check your inbox for the verification link we sent when you signed up.');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={['#0d0d0d', '#1a0505', '#0a0a0a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <Text style={s.logo}>Cine<Text style={s.logoAccent}>Sage</Text></Text>
          <Text style={s.tagline}>Your AI-powered movie companion</Text>
        </Animated.View>

        <Animated.View style={{ opacity: contentOpacity, width: '100%' }}>

        <View style={s.features}>
          {FEATURES.map((f, i) => (
            <View key={i} style={s.featureRow}>
              <View style={s.featureIcon}>
                <Ionicons name={f.icon as any} size={16} color={f.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.form}>
          <Text style={s.formTitle}>{isSignUp ? 'Create account' : 'Welcome back'}</Text>
          <Text style={s.formSub}>{isSignUp ? 'Join CineSage and start discovering great films' : 'Sign in to continue your movie journey'}</Text>

          {isSignUp && (
            <View style={s.fieldWrap}>
              <Text style={s.label}>USERNAME</Text>
              <View style={s.inputWrap}>
                <Ionicons name="person-outline" size={16} color={colors.subtle} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="Choose a username"
                  placeholderTextColor={colors.subtle}
                  value={username}
                  onChangeText={(t) => setUsername(t.replace(/\s/g, ''))}
                  autoCapitalize="none"
                />
              </View>
            </View>
          )}

          <View style={s.fieldWrap}>
            <Text style={s.label}>EMAIL</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={16} color={colors.subtle} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="your@email.com"
                placeholderTextColor={colors.subtle}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>PASSWORD</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.subtle} style={s.inputIcon} />
              <TextInput
                style={[s.input, { paddingRight: 48 }]}
                placeholder="••••••••"
                placeholderTextColor={colors.subtle}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.subtle} />
              </TouchableOpacity>
            </View>
          </View>

          {isSignUp && (
            <View style={s.fieldWrap}>
              <Text style={s.label}>CONFIRM PASSWORD</Text>
              <View style={s.inputWrap}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.subtle} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.subtle}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
            </View>
          )}

          <TouchableOpacity style={s.btn} onPress={handleAuth} disabled={loading} activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <View style={s.btnInner}>
                <Text style={s.btnText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setConfirmPassword(''); }} style={s.toggle}>
            <Text style={s.toggleText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={s.toggleAccent}>{isSignUp ? 'Sign in' : 'Sign up free'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 40 },
  logo: { fontSize: 42, fontWeight: '900', color: colors.white, letterSpacing: -1, textAlign: 'center' },
  logoAccent: { color: colors.red },
  tagline: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 32 },
  features: { marginBottom: 32, gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 2 },
  featureDesc: { color: colors.subtle, fontSize: 12, lineHeight: 18 },
  form: { gap: 14 },
  formTitle: { color: colors.white, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  formSub: { color: colors.subtle, fontSize: 14, marginBottom: 8 },
  fieldWrap: { gap: 6 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  inputWrap: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 14, top: 16, zIndex: 1 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10, padding: 14, paddingLeft: 42, fontSize: 15, color: colors.text,
  },
  eyeBtn: { position: 'absolute', right: 14, top: 14 },
  btn: {
    backgroundColor: colors.red, borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  toggle: { alignItems: 'center', marginTop: 16 },
  toggleText: { color: colors.muted, fontSize: 14 },
  toggleAccent: { color: colors.red, fontWeight: '700' },
});
