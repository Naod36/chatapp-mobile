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
    Alert,
    Animated,
    Dimensions,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { authService } from "../services/auth";

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// FlowChat auth theme (matches web dark theme)
const THEME = {
    pageBg: "#021526",
    cardBg: "rgba(2, 21, 38, 0.85)",
    cardBorder: "rgba(110, 172, 218, 0.2)",
    text: "#e2e8f0",
    textMuted: "#94a3b8",
    inputBorder: "rgba(110, 172, 218, 0.2)",
    buttonBg: "#03346E",
    buttonText: "#ffffff",
    accent: "#6EACDA",
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
            })
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
            />
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
            ])
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
            ])
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
        <View style={[styles.bottomWaveContainer, { height: waveHeight }]} pointerEvents="none">
            {/* Back Wave Layer - Wide Sweeping Curve */}
            <Animated.View style={[styles.waveWrap, { transform: [{ translateX: translateX2 }] }]}>
                <Svg width={w} height={waveHeight} viewBox={`0 0 ${w} ${waveHeight}`} fill="none">
                    <Defs>
                        <LinearGradient id="waveGradBack" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0%" stopColor="#38bdf8" stopOpacity="0.75" />
                            <Stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
                        </LinearGradient>
                    </Defs>
                    <Path
                        d={`M0,50 C${w * 0.25},140 ${w * 0.55},0 ${w * 0.8},110 ${w},30 L${w},${waveHeight} L0,${waveHeight} Z`}
                        fill="url(#waveGradBack)"
                    />
                </Svg>
            </Animated.View>

            {/* Front Main Wave Layer - Solid Vibrant Blue */}
            <Animated.View style={[styles.waveWrap, { transform: [{ translateX: translateX1 }] }]}>
                <Svg width={w} height={waveHeight} viewBox={`0 0 ${w} ${waveHeight}`} fill="none">
                    <Defs>
                        <LinearGradient id="waveGradFront" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0%" stopColor="#0284c7" stopOpacity="0.95" />
                            <Stop offset="50%" stopColor="#0369a1" stopOpacity="1.0" />
                            <Stop offset="100%" stopColor="#021526" stopOpacity="1.0" />
                        </LinearGradient>
                    </Defs>
                    <Path
                        d={`M0,85 C${w * 0.28},15 ${w * 0.6},125 ${w * 0.82},35 ${w},90 L${w},${waveHeight} L0,${waveHeight} Z`}
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
function FlowChatLogo() {
    return (
        <View style={styles.logoRow}>
            <View style={styles.logoParallelogramWrap}>
                <View style={[styles.parallelogram, { backgroundColor: THEME.text }]} />
                <View style={[styles.parallelogram, { backgroundColor: THEME.text, marginLeft: 2 }]} />
            </View>
            <Text style={styles.brandName}>FlowChat</Text>
        </View>
    );
}

export default function LoginScreen({ onLoginSuccess }) {
    const t = THEME;
    const [isSignUp, setIsSignUp] = useState(false);
    const [identifier, setIdentifier] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState(null);

    // Entrance animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const formItems = useRef([...Array(8)].map(() => new Animated.Value(0))).current;

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
            ]),
            Animated.stagger(
                60,
                formItems.map((item) =>
                    Animated.spring(item, { toValue: 1, tension: 80, friction: 12, useNativeDriver: true })
                )
            ),
        ]).start();
    }, []);

    // Google OAuth configuration
    const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");
    const redirectUri = AuthSession.makeRedirectUri({ preferLocalhost: true });

    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
            clientId: "765688882603-sjt9jl25jd28k8hmo2jjgr53fmvn4hki.apps.googleusercontent.com",
            scopes: ["openid", "profile", "email"],
            redirectUri,
            responseType: "token",
        },
        discovery
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
            const authData = await authService.googleLogin
                ? await authService.googleLogin(accessToken)
                : await (async () => {
                    // Fallback: call the API directly
                    const res = await fetch("https://chatapp-backend-chyk.onrender.com/auth/google", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ credential: accessToken }),
                    });
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

    const handleSubmit = async () => {
        if (loading) return;
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
                userData = await authService.signup(identifier.trim(), email.trim(), password);
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

    const renderFormItem = (child, index) => {
        const anim = formItems[Math.min(index, formItems.length - 1)];
        return (
            <Animated.View
                key={index}
                style={{
                    opacity: anim,
                    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                }}
            >
                {child}
            </Animated.View>
        );
    };

    let formIndex = 0;

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: t.pageBg }]}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            {/* Background wave lines */}
            <WaveLines />

            <Animated.View
                style={[
                    styles.card,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                        backgroundColor: t.cardBg,
                        borderColor: t.cardBorder,
                    },
                ]}
            >
                {/* Logo */}
                {renderFormItem(<FlowChatLogo />, formIndex++)}

                {/* Title */}
                {renderFormItem(
                    <View>
                        <Text style={[styles.title, { color: t.text }]}>
                            {isSignUp ? "Sign Up" : "Sign In"}
                        </Text>
                        <Text style={[styles.subtitle, { color: t.textMuted }]}>
                            {isSignUp
                                ? "Create an account to start chatting"
                                : "Continue to access your chats"}
                        </Text>
                    </View>,
                    formIndex++
                )}

                {/* Error */}
                {error &&
                    renderFormItem(
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>,
                        formIndex++
                    )}

                {/* Google Sign In */}
                {renderFormItem(
                    <TouchableOpacity
                        style={[styles.googleBtn, { borderColor: t.inputBorder }]}
                        onPress={() => promptAsync()}
                        disabled={!request || googleLoading}
                        activeOpacity={0.8}
                    >
                        {googleLoading ? (
                            <ActivityIndicator color={t.text} size="small" />
                        ) : (
                            <>
                                <GoogleIcon />
                                <Text style={[styles.googleBtnText, { color: t.text }]}>
                                    {isSignUp ? "Sign up with Google" : "Sign in with Google"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>,
                    formIndex++
                )}

                {/* OR Divider */}
                {renderFormItem(
                    <View style={styles.dividerRow}>
                        <View style={[styles.dividerLine, { backgroundColor: t.inputBorder }]} />
                        <Text style={[styles.dividerText, { color: t.textMuted }]}>OR</Text>
                        <View style={[styles.dividerLine, { backgroundColor: t.inputBorder }]} />
                    </View>,
                    formIndex++
                )}

                {/* Input fields */}
                {isSignUp &&
                    renderFormItem(
                        <View>
                            <Text style={[styles.label, { color: t.text }]}>Username</Text>
                            <TextInput
                                style={[styles.input, { borderColor: t.inputBorder, color: t.text, backgroundColor: "rgba(2,21,38,0.5)" }]}
                                placeholder="Choose a username"
                                placeholderTextColor={t.textMuted}
                                value={identifier}
                                onChangeText={setIdentifier}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>,
                        formIndex++
                    )}

                {renderFormItem(
                    <View>
                        <Text style={[styles.label, { color: t.text }]}>
                            {isSignUp ? "Email" : "Username or Email"}
                        </Text>
                        <TextInput
                            style={[styles.input, { borderColor: t.inputBorder, color: t.text, backgroundColor: "rgba(2,21,38,0.5)" }]}
                            placeholder={isSignUp ? "Enter your email" : "Enter your email or username"}
                            placeholderTextColor={t.textMuted}
                            value={isSignUp ? email : identifier}
                            onChangeText={isSignUp ? setEmail : setIdentifier}
                            autoCapitalize="none"
                            keyboardType={isSignUp ? "email-address" : "default"}
                            autoCorrect={false}
                        />
                    </View>,
                    formIndex++
                )}

                {renderFormItem(
                    <View>
                        <Text style={[styles.label, { color: t.text }]}>Password</Text>
                        <TextInput
                            style={[styles.input, { borderColor: t.inputBorder, color: t.text, backgroundColor: "rgba(2,21,38,0.5)" }]}
                            placeholder="Enter your password"
                            placeholderTextColor={t.textMuted}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>,
                    formIndex++
                )}

                {/* Submit */}
                {renderFormItem(
                    <TouchableOpacity
                        style={[styles.submitBtn, { backgroundColor: t.buttonBg, opacity: loading ? 0.7 : 1 }]}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={[styles.submitBtnText, { color: t.buttonText }]}>
                                {isSignUp ? "Sign Up" : "Sign In"}
                            </Text>
                        )}
                    </TouchableOpacity>,
                    formIndex++
                )}

                {/* Switch mode */}
                {renderFormItem(
                    <TouchableOpacity
                        onPress={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                        }}
                        style={styles.switchBtn}
                    >
                        <Text style={[styles.switchText, { color: t.textMuted }]}>
                            {isSignUp ? "Already have an account? " : "Don't have an account? "}
                            <Text style={{ color: t.text, fontWeight: "700", textDecorationLine: "underline" }}>
                                {isSignUp ? "Sign In" : "Create an Account"}
                            </Text>
                        </Text>
                    </TouchableOpacity>,
                    formIndex++
                )}
            </Animated.View>

            {/* Moving Wave Animation at the Bottom */}
            <BottomMovingWaves />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        overflow: "hidden",
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
        maxWidth: 420,
        borderRadius: 24,
        borderWidth: 1.5,
        padding: 28,
        zIndex: 2,
        // Glassmorphism effect
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 25 },
        shadowOpacity: 0.6,
        shadowRadius: 50,
        elevation: 20,
    },
    logoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 20,
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
        fontSize: 18,
        fontWeight: "900",
        color: "#e2e8f0",
        letterSpacing: 0.3,
    },
    title: {
        fontSize: 22,
        fontWeight: "700",
        letterSpacing: -0.3,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: "500",
        letterSpacing: 0.2,
        marginBottom: 20,
    },
    errorBox: {
        backgroundColor: "rgba(234, 67, 53, 0.12)",
        borderColor: "rgba(234, 67, 53, 0.2)",
        borderWidth: 1.5,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
    },
    errorText: {
        color: "#EA4335",
        fontSize: 11,
        fontWeight: "600",
        textAlign: "center",
    },
    googleBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        borderRadius: 999,
        borderWidth: 1,
        paddingVertical: 13,
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
        fontSize: 12,
        fontWeight: "700",
    },
    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginVertical: 16,
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
        fontSize: 11,
        fontWeight: "700",
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    input: {
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 20,
        paddingVertical: 13,
        fontSize: 13,
        fontWeight: "500",
        marginBottom: 16,
    },
    submitBtn: {
        borderRadius: 999,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    submitBtnText: {
        fontSize: 13,
        fontWeight: "700",
    },
    switchBtn: {
        alignItems: "center",
        paddingTop: 20,
    },
    switchText: {
        fontSize: 12,
        fontWeight: "500",
    },
});
