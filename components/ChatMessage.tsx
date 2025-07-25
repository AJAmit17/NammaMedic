import { View, Text, StyleSheet } from "react-native";

export type Message = {
    source: string;
    message: string;
};

type Props = {
    message: Message;
};

export function ChatMessage({ message }: Props) {
    const isAI = message.source === "ai";

    return (
        <View
            style={[
                styles.messageContainer,
                isAI ? styles.aiMessage : styles.userMessage,
            ]}
        >
            <View style={[styles.bubble, isAI ? styles.aiBubble : styles.userBubble]}>
                <Text
                    style={[styles.messageText, isAI ? styles.aiText : styles.userText]}
                >
                    {message.message}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    messageContainer: {
        flexDirection: "row",
        // marginVertical: 8,
        paddingHorizontal: 16,
        alignItems: "flex-end",
    },
    aiMessage: {
        justifyContent: "flex-start",
    },
    userMessage: {
        justifyContent: "flex-end",
    },
    bubble: {
        maxWidth: "70%",
        padding: 12,
        borderRadius: 20,
        elevation: 1,
    },
    aiBubble: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 4,
        borderWidth: 1,
        borderColor: "#E0E0E0",
    },
    userBubble: {
        backgroundColor: "#3B82F6",
        borderTopRightRadius: 4,
    },
    messageText: {
        fontSize: 14,
        lineHeight: 20,
        fontFamily: "Inter-Regular",
    },
    aiText: {
        color: "#000000",
        fontWeight: "500",
    },
    userText: {
        color: "#FFFFFF",
    },
});