import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import type {
  ConversationWithDetails,
  Message,
  ServerToClientEvents,
} from "@uchicago-marketplace/shared";
import { colors } from "@/constants/colors";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/lib/socket-context";

/* ── Helpers ── */

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/* ── Component ── */

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [conversation, setConversation] = useState<ConversationWithDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [readAt, setReadAt] = useState<string | null>(null);

  const socket = useSocket();
  const flatListRef = useRef<FlatList<Message>>(null);

  /* ── Fetch data ── */
  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const [conv, msgs] = await Promise.all([
          api.conversations.get(id),
          api.conversations.getMessages(id),
        ]);
        setConversation(conv);
        setMessages(msgs.data);
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [id]);

  /* ── Mark as read on mount ── */
  useEffect(() => {
    if (!id) return;
    api.conversations.markRead(id).catch(() => {});
  }, [id]);

  /* ── Socket.IO ── */
  useEffect(() => {
    if (!id || !socket) return;

    const handleNewMessage: ServerToClientEvents["new_message"] = (payload) => {
      if (payload.conversationId !== id) return;
      setMessages((prev) => {
        // avoid duplicates
        if (prev.some((m) => m.id === payload.message.id)) return prev;
        return [payload.message, ...prev];
      });
      // mark as read immediately when we receive a message in this chat
      api.conversations.markRead(id).catch(() => {});
    };

    const handleMessagesRead: ServerToClientEvents["messages_read"] = (payload) => {
      if (payload.conversationId !== id) return;
      // Only track read receipts for messages we sent
      setReadAt(payload.readAt);
    };

    socket.on("new_message", handleNewMessage);
    socket.on("messages_read", handleMessagesRead);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("messages_read", handleMessagesRead);
    };
  }, [id, socket]);

  /* ── Send message ── */
  const handleSend = useCallback(async () => {
    const body = messageText.trim();
    if (!body || isSending || !id) return;

    setIsSending(true);
    setMessageText("");

    try {
      const sent = await api.conversations.sendMessage(id, body);
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [sent, ...prev];
      });
    } catch {
      setMessageText(body); // restore on error
    } finally {
      setIsSending(false);
    }
  }, [messageText, isSending, id]);

  /* ── Render message bubble ── */
  const renderItem = useCallback(
    ({ item }: { item: Message }) => {
      const isSent = item.senderId === user?.id;
      const isRead = isSent && readAt !== null && new Date(item.createdAt) <= new Date(readAt);

      return (
        <View style={[styles.bubbleRow, isSent ? styles.bubbleRowSent : styles.bubbleRowReceived]}>
          <View style={[styles.bubble, isSent ? styles.bubbleSent : styles.bubbleReceived]}>
            <Text style={isSent ? styles.bubbleTextSent : styles.bubbleTextReceived}>
              {item.body}
            </Text>
          </View>
          <View style={[styles.bubbleMeta, isSent ? styles.bubbleMetaSent : styles.bubbleMetaReceived]}>
            <Text style={styles.bubbleTime}>{formatTime(item.createdAt)}</Text>
            {isSent && (
              <FontAwesome
                name={isRead ? "check-circle" : "check"}
                size={11}
                color={isRead ? colors.success : colors.gray[400]}
                style={styles.readIcon}
              />
            )}
          </View>
        </View>
      );
    },
    [user?.id, readAt]
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  /* ── Header ── */
  const navBar = (
    <View style={[styles.navBar, { paddingTop: insets.top }]}>
      <Pressable style={styles.navButton} onPress={() => router.back()}>
        <FontAwesome name="arrow-left" size={18} color={colors.gray[900]} />
      </Pressable>

      {conversation ? (
        <View style={styles.navCenter}>
          <View style={styles.navAvatar}>
            <Text style={styles.navAvatarText}>
              {getInitials(conversation.otherParticipant.name)}
            </Text>
          </View>
          <View style={styles.navInfo}>
            <Text style={styles.navName} numberOfLines={1}>
              {conversation.otherParticipant.name}
            </Text>
            <Text style={styles.navPostTitle} numberOfLines={1}>
              {conversation.post.title}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.navCenter} />
      )}

      <View style={styles.navButton} />
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {navBar}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.maroon[600]} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {navBar}

      {/* Messages list — inverted so newest is at bottom */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        inverted
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome name="comment-o" size={40} color={colors.gray[300]} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
          </View>
        }
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={colors.gray[400]}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
          returnKeyType="default"
          blurOnSubmit={false}
        />
        <Pressable
          style={[
            styles.sendButton,
            (!messageText.trim() || isSending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!messageText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <FontAwesome name="send" size={16} color={colors.white} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* NavBar */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    gap: 8,
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  navCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  navAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.maroon[100],
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  navAvatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.maroon[700],
  },
  navInfo: {
    flex: 1,
    minWidth: 0,
  },
  navName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[900],
  },
  navPostTitle: {
    fontSize: 12,
    color: colors.gray[500],
    marginTop: 1,
  },

  /* Messages */
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexGrow: 1,
  },
  bubbleRow: {
    marginBottom: 8,
  },
  bubbleRowSent: {
    alignItems: "flex-end",
  },
  bubbleRowReceived: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleSent: {
    backgroundColor: colors.maroon[600],
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: colors.gray[100],
    borderBottomLeftRadius: 4,
  },
  bubbleTextSent: {
    fontSize: 15,
    color: colors.white,
    lineHeight: 20,
  },
  bubbleTextReceived: {
    fontSize: 15,
    color: colors.gray[900],
    lineHeight: 20,
  },
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 4,
  },
  bubbleMetaSent: {
    justifyContent: "flex-end",
  },
  bubbleMetaReceived: {
    justifyContent: "flex-start",
  },
  bubbleTime: {
    fontSize: 11,
    color: colors.gray[400],
  },
  readIcon: {
    marginLeft: 2,
  },

  /* Empty state (inverted list, so uses scaleY) */
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray[700],
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.gray[400],
    marginTop: 4,
    textAlign: "center",
  },

  /* Input bar */
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.white,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.gray[900],
    backgroundColor: colors.gray[50],
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.maroon[600],
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
