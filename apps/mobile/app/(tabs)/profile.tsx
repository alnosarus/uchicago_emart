import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";

/* ─── Sign-in screen (unauthenticated) ─── */

function SignInScreen({ onSignIn }: { onSignIn: () => void }) {
  const insets = useSafeAreaInsets();
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleSignIn() {
    setIsSigningIn(true);
    try {
      await onSignIn();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Sign in failed. Please try again.";
      Alert.alert("Sign In Error", message);
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.avatarPlaceholder}>
        <FontAwesome name="user" size={40} color={colors.gray[300]} />
      </View>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>
        Sign in to manage your posts, messages, and saved items.
      </Text>
      <Pressable
        style={[styles.signInButton, isSigningIn && styles.disabledButton]}
        onPress={handleSignIn}
        disabled={isSigningIn}
      >
        {isSigningIn ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.signInButtonText}>Sign in with Google</Text>
        )}
      </Pressable>
      <Text style={styles.hint}>Only @uchicago.edu accounts</Text>
    </View>
  );
}

/* ─── Authenticated profile screen ─── */

function AuthenticatedProfile({
  user,
  onSignOut,
}: {
  user: { id: string; name: string; email: string; avatarUrl: string | null; isVerified: boolean };
  onSignOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await onSignOut();
    } catch {
      Alert.alert("Error", "Failed to sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {/* Profile header */}
      <View style={styles.profileHeader}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <FontAwesome name="user" size={40} color={colors.gray[300]} />
          </View>
        )}
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        {user.isVerified && (
          <View style={styles.verifiedBadge}>
            <FontAwesome name="check-circle" size={14} color={colors.success} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
      </View>

      {/* My Posts section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Posts</Text>
        <View style={styles.placeholderCard}>
          <FontAwesome name="list" size={20} color={colors.gray[400]} />
          <Text style={styles.placeholderText}>
            Your posts will appear here
          </Text>
        </View>
      </View>

      {/* Sign out */}
      <Pressable
        style={[styles.signOutButton, isSigningOut && styles.disabledButton]}
        onPress={handleSignOut}
        disabled={isSigningOut}
      >
        {isSigningOut ? (
          <ActivityIndicator size="small" color={colors.error} />
        ) : (
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

/* ─── Main screen ─── */

export default function ProfileScreen() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.maroon[600]} />
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return <SignInScreen onSignIn={login} />;
  }

  return <AuthenticatedProfile user={user} onSignOut={logout} />;
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: colors.white,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },

  /* Avatar */
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gray[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },

  /* Sign-in screen */
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.gray[900],
  },
  subtitle: {
    fontSize: 13,
    color: colors.gray[500],
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
  signInButton: {
    marginTop: 20,
    backgroundColor: colors.maroon[600],
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
  },
  signInButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  hint: {
    marginTop: 8,
    fontSize: 11,
    color: colors.gray[400],
  },

  /* Authenticated profile */
  profileHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.gray[900],
  },
  userEmail: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 4,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    backgroundColor: "#f0f7f0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.success,
  },

  /* Sections */
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.gray[900],
    marginBottom: 12,
  },
  placeholderCard: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderStyle: "dashed",
  },
  placeholderText: {
    fontSize: 13,
    color: colors.gray[400],
  },

  /* Sign out */
  signOutButton: {
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  signOutButtonText: {
    color: colors.error,
    fontWeight: "700",
    fontSize: 14,
  },

  disabledButton: {
    opacity: 0.5,
  },
});
