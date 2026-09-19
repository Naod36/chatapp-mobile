import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  Image,
  AccessibilityInfo,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { BlurView } from "expo-blur";
import { authService } from "../services/auth";
import { THEMES } from "../theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthBackground, AnimatedBrand } from "../components/common/AuthMotion";

WebBrowser.maybeCompleteAuthSession();

// Reused from the web app's OAuth client; native (Android/iOS) sign-in needs its own
// dedicated client IDs registered in Google Cloud Console (package/bundle + SHA-1),
// which GoogleSignin.configure() below will pick up once created.
const GOOGLE_WEB_CLIENT_ID =
  "545601616376-4fqet7dm5otcki9hcm5ifjugbja5vj0s.apps.googleusercontent.com";
const GOOGLE_IOS_CLIENT_ID =
  "545601616376-mk8sfpavdtieko9aic76mmafino8i5re.apps.googleusercontent.com";

if (Platform.OS !== "web") {
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
    });
  } catch {
    // Native Google Sign-In module isn't available yet (e.g. running in Expo Go without a dev build).
  }
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// FlowChat auth theme (monochrome + indigo, matches the redesigned web app)
const THEME = {
  pageBg: "#09090b",
  cardBg: "rgba(24, 24, 27, 0.6)",
  cardBorder: "rgba(129, 140, 248, 0.2)",
  text: "#f4f4f5",
  textMuted: "#a1a1aa",
  inputBorder: "rgba(129, 140, 248, 0.2)",
  buttonBg: "#6366f1",
  buttonText: "#ffffff",
  accent: "#818cf8",
};

// Animated wave line component for top background background
function WaveLines() {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: false,
      }),
    ).start();
  }, [animValue]);

  const lines = [];
  const numLines = 5;
  for (let i = 0; i < numLines; i++) {
    const yPos = 0.08 + (i * 0.84) / (numLines - 1);
    lines.push(
      <View
        key={i}
        style={[
          styles.waveLine,
          {
            top: `${yPos * 100}%`,
            opacity: 0.06 + (i % 3) * 0.02,
          },
        ]}
      />,
    );
  }
  return <View style={styles.wavesContainer}>{lines}</View>;
}

// Telegram-style Bottom Moving SVG Waves with wide coverage at the bottom
function BottomMovingWaves() {
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim1, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim1, {
          toValue: 0,
          duration: 5000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim2, {
          toValue: 1,
          duration: 7500,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim2, {
          toValue: 0,
          duration: 7500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const translateX1 = waveAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 0],
  });

  const translateX2 = waveAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  const waveHeight = 280;
  const w = Math.max(800, SCREEN_WIDTH + 240);

  return (
    <View
      style={[styles.bottomWaveContainer, { height: waveHeight }]}
      pointerEvents="none"
    >
      {/* Back Wave Layer - Wide Sweeping Curve */}
      <Animated.View
        style={[styles.waveWrap, { transform: [{ translateX: translateX2 }] }]}
      >
        <Svg
          width={w}
          height={waveHeight}
          viewBox={`0 0 ${w} ${waveHeight}`}
          fill="none"
        >
          <Defs>
            <LinearGradient id="waveGradBack" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#818cf8" stopOpacity="0.75" />
              <Stop offset="100%" stopColor="#6366f1" stopOpacity="0.95" />
            </LinearGradient>
          </Defs>
          <Path
            d={`M 0 50 C ${Math.round(w * 0.33)} 140 ${Math.round(w * 0.66)} 0 ${Math.round(w)} 50 L ${Math.round(w)} ${waveHeight} L 0 ${waveHeight} Z`}
            fill="url(#waveGradBack)"
          />
        </Svg>
      </Animated.View>

      {/* Front Main Wave Layer - Solid Vibrant Blue */}
      <Animated.View
        style={[styles.waveWrap, { transform: [{ translateX: translateX1 }] }]}
      >
        <Svg
          width={w}
          height={waveHeight}
          viewBox={`0 0 ${w} ${waveHeight}`}
          fill="none"
        >
          <Defs>
            <LinearGradient id="waveGradFront" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#6366f1" stopOpacity="0.95" />
              <Stop offset="50%" stopColor="#0369a1" stopOpacity="1.0" />
              <Stop offset="100%" stopColor="#021526" stopOpacity="1.0" />
            </LinearGradient>
          </Defs>
          <Path
            d={`M 0 85 C ${Math.round(w * 0.33)} 20 ${Math.round(w * 0.66)} 120 ${Math.round(w)} 60 L ${Math.round(w)} ${waveHeight} L 0 ${waveHeight} Z`}
            fill="url(#waveGradFront)"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

// Google "G" SVG-like icon built with Text
function GoogleIcon() {
  return (
    <View style={styles.googleIconWrap}>
      <Text style={styles.googleG}>G</Text>
    </View>
  );
}

// FlowChat parallelogram logo
function FlowChatLogo({ theme }) {
  return (
    <View style={styles.logoRow}>
      <Image
        source={require("../../assets/logo-mark-light-theme.png")}
        style={{ width: 32, height: 32, tintColor: theme.accent }}
      />
      <Text style={[styles.brandName, { color: theme.text }]}>FlowChat</Text>
    </View>
  );
}

export default function LoginScreen({
  onLoginSuccess,
  initialError = null,
  onInitialErrorShown,
}) {
  const t = THEMES.dark;
  const insets = useSafeAreaInsets();
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReducedMotion(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(initialError);
  useEffect(() => {
    if (initialError) onInitialErrorShown?.();
    // Only meant to consume the initial value once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState("request");
  const [forgotMessage, setForgotMessage] = useState(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const formItems = useRef(
    [...Array(8)].map(() => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (reducedMotion) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      formItems.forEach((item) => item.setValue(1));
      return;
    }
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    formItems.forEach((item) => item.setValue(0));
    const entrance = Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 60,
          friction: 12,
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(
        60,
        formItems.map((item) =>
          Animated.spring(item, {
            toValue: 1,
            tension: 80,
            friction: 12,
            useNativeDriver: true,
          }),
        ),
      ),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [reducedMotion, fadeAnim, slideAnim, formItems]);

  // Google OAuth configuration
  const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");
  const redirectUri = AuthSession.makeRedirectUri({ preferLocalhost: true });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_WEB_CLIENT_ID,
      scopes: ["openid", "profile", "email"],
      redirectUri,
      responseType: "token",
      // PKCE only applies to the authorization code flow; Google rejects it with
      // "Parameter not allowed for this message type: code_challenge_method" when combined with implicit "token" flow.
      usePKCE: false,
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type === "success") {
      const { access_token } = response.params;
      handleGoogleToken(access_token);
    }
  }, [response]);

  const handleGoogleToken = async (accessToken) => {
    setGoogleLoading(true);
    setError(null);
    try {
      const authData = (await authService.googleLogin)
        ? await authService.googleLogin(accessToken)
        : await (async () => {
            // Fallback: call the API directly
            const res = await fetch(
              "https://chatapp-backend-chyk.onrender.com/auth/google",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential: accessToken }),
              },
            );
            if (!res.ok) throw new Error("Google sign-in failed");
            return res.json();
          })();
      onLoginSuccess(authData);
    } catch (err) {
      setError(err.message || "Google Sign In failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleNativeGoogleSignIn = async () => {
    setError(null);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response) && response.data.idToken) {
        await handleGoogleToken(response.data.idToken);
      }
    } catch (err) {
      const cancelled =
        isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED;
      if (!cancelled) {
        setError(err.message || "Google Sign In failed");
      }
    }
  };

  const handleGoogleButtonPress = () => {
    if (Platform.OS === "web") {
      promptAsync();
    } else {
      handleNativeGoogleSignIn();
    }
  };

  const handleSubmit = async () => {
    if (loading || googleLoading) return;
    if (!identifier.trim() || !password.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (isSignUp && !email.trim()) {
      setError("Email is required for sign up.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let userData;
      if (isSignUp) {
        userData = await authService.signup(
          identifier.trim(),
          email.trim(),
          password,
        );
      } else {
        userData = await authService.login(identifier.trim(), password);
      }
      onLoginSuccess(userData);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForgotPassword = () => {
    setShowForgotPassword(true);
    setForgotStep("request");
    setForgotMessage(null);
    setError(null);
  };

  const handleCancelForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotStep("request");
    setForgotMessage(null);
    setResetEmail("");
    setResetToken("");
    setResetNewPassword("");
    setError(null);
  };

  const handleForgotPasswordRequest = async () => {
    if (loading) return;
    if (!resetEmail.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authService.forgotPassword(resetEmail.trim());
      setForgotMessage(
        "If an account exists for that email, a reset token has been sent. Check your email and enter the token below.",
      );
      setForgotStep("reset");
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async () => {
    if (loading) return;
    if (!resetToken.trim() || !resetNewPassword.trim()) {
      setError("Please enter the reset token and a new password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authService.resetPassword(resetToken.trim(), resetNewPassword);
      setForgotMessage("Your password has been updated. You can sign in now.");
      setForgotStep("done");
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const renderFormItem = (child, index) => {
    const anim = formItems[Math.min(index, formItems.length - 1)];
    return (
      <Animated.View
        key={index}
        style={{
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        }}
      >
        {child}
      </Animated.View>
    );
  };

  let formIndex = 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <AuthBackground theme={t} reducedMotion={reducedMotion} />
      <ScrollView
        style={{ flex: 1, width: "100%" }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 32,
            }}
          >
            <AnimatedBrand theme={t} reducedMotion={reducedMotion} />
          </View>

          {/* Title */}
          {renderFormItem(
            <View>
              <Text style={[styles.title, { color: t.text }]}>
                {showForgotPassword
                  ? forgotStep === "reset"
                    ? "Enter reset token"
                    : forgotStep === "done"
                      ? "Password updated"
                      : "Reset your password"
                  : isSignUp
                    ? "Create your account"
                    : "Welcome back"}
              </Text>
              <Text style={[styles.subtitle, { color: t.textMuted }]}>
                {showForgotPassword
                  ? forgotStep === "reset"
                    ? "Check your email for the reset token and enter it below."
                    : forgotStep === "done"
                      ? "You can sign in with your new password now."
                      : "Enter your email and we'll send you a reset token."
                  : isSignUp
                    ? "A place for your conversations."
                    : "Sign in to FlowChat."}
              </Text>
            </View>,
            formIndex++,
          )}

          {/* Error */}
          {error &&
            renderFormItem(
              <View
                accessibilityLiveRegion="polite"
                style={[
                  styles.errorBox,
                  { borderColor: t.danger, backgroundColor: t.cardBg },
                ]}
              >
                <Text style={[styles.errorText, { color: t.danger }]}>
                  {error}
                </Text>
              </View>,
              formIndex++,
            )}

          {showForgotPassword && (
            <View>
              {forgotStep === "request" && (
                <>
                  <Text style={[styles.label, { color: t.text }]}>Email</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: t.inputBorder,
                        color: t.text,
                        backgroundColor: "transparent",
                      },
                    ]}
                    placeholder="Email address"
                    placeholderTextColor={t.textMuted}
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    accessibilityLabel="Reset email"
                    onSubmitEditing={handleForgotPasswordRequest}
                  />
                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      {
                        backgroundColor: t.accent,
                        opacity: loading ? 0.5 : 1,
                      },
                    ]}
                    onPress={handleForgotPasswordRequest}
                    accessibilityRole="button"
                    accessibilityLabel="Send reset link"
                    accessibilityState={{ disabled: loading, busy: loading }}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.submitBtnText, { color: t.bg }]}>
                      {loading ? "Sending..." : "Send reset link"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {forgotStep === "reset" && (
                <>
                  {forgotMessage && (
                    <View
                      accessibilityLiveRegion="polite"
                      style={[
                        styles.successBox,
                        { borderColor: t.accent, backgroundColor: t.cardBg },
                      ]}
                    >
                      <Text style={[styles.successText, { color: t.text }]}>
                        {forgotMessage}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.label, { color: t.text }]}>
                    Reset token
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: t.inputBorder,
                        color: t.text,
                        backgroundColor: "transparent",
                      },
                    ]}
                    placeholder="Paste the token from your email"
                    placeholderTextColor={t.textMuted}
                    value={resetToken}
                    onChangeText={setResetToken}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Reset token"
                  />
                  <Text style={[styles.label, { color: t.text }]}>
                    New password
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: t.inputBorder,
                        color: t.text,
                        backgroundColor: "transparent",
                      },
                    ]}
                    placeholder="New password"
                    placeholderTextColor={t.textMuted}
                    value={resetNewPassword}
                    onChangeText={setResetNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    accessibilityLabel="New password"
                    onSubmitEditing={handleResetPasswordSubmit}
                  />
                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      {
                        backgroundColor: t.accent,
                        opacity: loading ? 0.5 : 1,
                      },
                    ]}
                    onPress={handleResetPasswordSubmit}
                    accessibilityRole="button"
                    accessibilityLabel="Reset password"
                    accessibilityState={{ disabled: loading, busy: loading }}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.submitBtnText, { color: t.bg }]}>
                      {loading ? "Resetting..." : "Reset password"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {forgotStep === "done" && forgotMessage && (
                <View
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.successBox,
                    { borderColor: t.accent, backgroundColor: t.cardBg },
                  ]}
                >
                  <Text style={[styles.successText, { color: t.text }]}>
                    {forgotMessage}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleCancelForgotPassword}
                accessibilityRole="button"
                accessibilityLabel={
                  forgotStep === "done"
                    ? "Back to sign in"
                    : "Cancel password reset"
                }
                style={styles.switchBtn}
              >
                <Text style={[styles.switchText, { color: t.textMuted }]}>
                  <Text
                    style={{
                      color: t.text,
                      fontWeight: "700",
                      textDecorationLine: "underline",
                    }}
                  >
                    Back to sign in
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!showForgotPassword && (
            <>
              {/* Google Sign In */}
              {renderFormItem(
                <TouchableOpacity
                  style={styles.googleBtn}
                  onPress={handleGoogleButtonPress}
                  disabled={
                    (Platform.OS === "web" && !request) ||
                    googleLoading ||
                    loading
                  }
                  activeOpacity={0.8}
                >
                  {googleLoading ? (
                    <ActivityIndicator color={t.text} size="small" />
                  ) : (
                    <>
                      <GoogleIcon />
                      <Text style={[styles.googleBtnText, { color: t.text }]}>
                        {isSignUp
                          ? "Sign up with Google"
                          : "Sign in with Google"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>,
                formIndex++,
              )}

              {/* OR Divider */}
              {renderFormItem(
                <View style={styles.dividerRow}>
                  <View
                    style={[
                      styles.dividerLine,
                      { backgroundColor: t.inputBorder },
                    ]}
                  />
                  <Text style={[styles.dividerText, { color: t.textMuted }]}>
                    OR
                  </Text>
                  <View
                    style={[
                      styles.dividerLine,
                      { backgroundColor: t.inputBorder },
                    ]}
                  />
                </View>,
                formIndex++,
              )}

              {/* Input fields */}
              {isSignUp &&
                renderFormItem(
                  <View>
                    <Text style={[styles.label, { color: t.text }]}>
                      Username
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          borderColor: t.inputBorder,
                          color: t.text,
                          backgroundColor: "transparent",
                        },
                      ]}
                      placeholder="Username"
                      placeholderTextColor={t.textMuted}
                      value={identifier}
                      onChangeText={setIdentifier}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>,
                  formIndex++,
                )}

              {renderFormItem(
                <View>
                  <Text style={[styles.label, { color: t.text }]}>
                    {isSignUp ? "Email" : "Username or Email"}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: t.inputBorder,
                        color: t.text,
                        backgroundColor: "transparent",
                      },
                    ]}
                    placeholder={
                      isSignUp ? "Email address" : "Email or username"
                    }
                    placeholderTextColor={t.textMuted}
                    value={isSignUp ? email : identifier}
                    onChangeText={isSignUp ? setEmail : setIdentifier}
                    autoCapitalize="none"
                    keyboardType={isSignUp ? "email-address" : "default"}
                    autoCorrect={false}
                  />
                </View>,
                formIndex++,
              )}

              {renderFormItem(
                <View>
                  <Text style={[styles.label, { color: t.text }]}>
                    Password
                  </Text>
                  <View style={{ position: "relative" }}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          borderColor: t.inputBorder,
                          color: t.text,
                          backgroundColor: "transparent",
                          paddingRight: 56,
                        },
                      ]}
                      placeholder="Password"
                      placeholderTextColor={t.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete={
                        isSignUp ? "new-password" : "current-password"
                      }
                      accessibilityLabel="Password"
                      onSubmitEditing={handleSubmit}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((visible) => !visible)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? "Hide password" : "Show password"
                      }
                      style={{
                        position: "absolute",
                        right: 4,
                        top: 1,
                        width: 44,
                        height: 44,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <Path
                          d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z"
                          stroke={t.textMuted}
                          strokeWidth="1.7"
                        />
                        {showPassword && (
                          <Path
                            d="M3 3l18 18"
                            stroke={t.textMuted}
                            strokeWidth="1.7"
                          />
                        )}
                      </Svg>
                    </TouchableOpacity>
                  </View>
                </View>,
                formIndex++,
              )}

              {/* Submit */}
              {renderFormItem(
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor: t.accent,
                      opacity: loading || googleLoading ? 0.5 : 1,
                    },
                  ]}
                  onPress={handleSubmit}
                  accessibilityRole="button"
                  accessibilityLabel={isSignUp ? "Create account" : "Sign in"}
                  accessibilityState={{
                    disabled: loading || googleLoading,
                    busy: loading,
                  }}
                  disabled={loading || googleLoading}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.submitBtnText, { color: t.bg }]}>
                    {isSignUp ? "Create account" : "Sign in"}
                  </Text>
                  <View style={styles.submitBtnIcon}>
                    {loading ? (
                      <ActivityIndicator color={t.bg} size="small" />
                    ) : (
                      <Svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <Path
                          d="M4 12h15m-6-6 6 6-6 6"
                          stroke={t.bg}
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    )}
                  </View>
                </TouchableOpacity>,
                formIndex++,
              )}

              {/* Forgot password link (login mode only) */}
              {!isSignUp &&
                renderFormItem(
                  <TouchableOpacity
                    onPress={handleOpenForgotPassword}
                    accessibilityRole="button"
                    accessibilityLabel="Forgot password?"
                    disabled={loading || googleLoading}
                    style={styles.forgotBtn}
                  >
                    <Text style={[styles.forgotText, { color: t.textMuted }]}>
                      Forgot password?
                    </Text>
                  </TouchableOpacity>,
                  formIndex++,
                )}

              {/* Switch mode */}
              {renderFormItem(
                <TouchableOpacity
                  onPress={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                    setShowPassword(false);
                  }}
                  disabled={loading || googleLoading}
                  style={styles.switchBtn}
                >
                  <Text style={[styles.switchText, { color: t.textMuted }]}>
                    {isSignUp
                      ? "Already have an account? "
                      : "Don't have an account? "}
                    <Text
                      style={{
                        color: t.text,
                        fontWeight: "700",
                        textDecorationLine: "underline",
                      }}
                    >
                      {isSignUp ? "Sign In" : "Create an Account"}
                    </Text>
                  </Text>
                </TouchableOpacity>,
                formIndex++,
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  bottomWaveContainer: {
    position: "absolute",
    bottom: 0,
    left: -60,
    right: -60,
    zIndex: 1,
  },
  waveWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
  },
  wavesContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  waveLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 2,
  },
  card: {
    width: "100%",
    maxWidth: 380,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoParallelogramWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  parallelogram: {
    width: 10,
    height: 22,
    borderRadius: 2,
    transform: [{ skewX: "-12deg" }],
  },
  brandName: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: 0,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0,
    marginBottom: 28,
  },
  errorBox: {
    backgroundColor: "rgba(234, 67, 53, 0.12)",
    borderColor: "rgba(234, 67, 53, 0.2)",
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    color: "#EA4335",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 23,
    minHeight: 46,
    backgroundColor: "transparent",
    paddingVertical: 10,
    marginBottom: 10,
  },
  googleIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
  },
  googleG: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  input: {
    borderRadius: 23,
    minHeight: 46,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 16,
  },
  submitBtn: {
    alignSelf: "center",
    width: 180,
    maxWidth: "100%",
    minHeight: 48,
    borderRadius: 28,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
    overflow: "hidden",
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
    alignSelf: "center",
    textAlign: "center",
    paddingVertical: 12,
  },
  submitBtnIcon: {
    width: 20,
    height: 20,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  switchBtn: {
    alignItems: "center",
    paddingTop: 20,
  },
  switchText: {
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  forgotBtn: {
    alignItems: "center",
    paddingTop: 12,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  successBox: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  successText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
});
