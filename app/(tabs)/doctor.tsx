"use client"

import { useState, useEffect } from "react"
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Dimensions,
    Platform,
    SafeAreaView,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import * as Speech from "expo-speech"
import { ChatMessage, type Message as ChatMessageType } from "@/components/ChatMessage"
import ConvAiDOMComponent from "@/components/ConvAI"
import tools from "@/utils/tools"

const { width } = Dimensions.get("window")

interface DoctorMessage {
    id: string
    type: "user" | "ai"
    text: string
    timestamp: Date
}

export default function AIDoctorScreen() {
    const [messages, setMessages] = useState<DoctorMessage[]>([])
    const [conversationMessages, setConversationMessages] = useState<ChatMessageType[]>([])
    const [conversationStatus, setConversationStatus] = useState<string>("disconnected")
    const [isSpeaking, setIsSpeaking] = useState(false)

    // useEffect(() => {
    //     // Initialize component
    // }, [])

    // const speakResponse = async (text: string) => {
    //     try {
    //         setIsSpeaking(true)
    //         await Speech.speak(text, {
    //             language: "en-US",
    //             pitch: 1.0,
    //             rate: 0.8,
    //             onDone: () => setIsSpeaking(false),
    //             onStopped: () => setIsSpeaking(false),
    //             onError: () => setIsSpeaking(false),
    //         })
    //     } catch (error) {
    //         console.error("Error speaking text:", error)
    //         setIsSpeaking(false)
    //     }
    // }

    // const stopSpeaking = () => {
    //     Speech.stop()
    //     setIsSpeaking(false)
    // }

    const clearChat = () => {
        Alert.alert("Clear Chat", "Are you sure you want to clear the conversation?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Clear",
                style: "destructive",
                onPress: () => {
                    setMessages([])
                    setConversationMessages([])
                },
            },
        ])
    }

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={["#4A90E2", "#357ABD"]} style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.headerTop}>
                        <Text style={styles.title}>AI Doctor</Text>
                        <TouchableOpacity style={styles.clearButton} onPress={clearChat}>
                            <Ionicons name="refresh-outline" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.subtitle}>Your AI-powered medical assistant</Text>

                    {/* Centered Microphone Section */}
                    <View style={styles.microphoneSection}>
                        <View style={styles.convAiContainer}>
                            <ConvAiDOMComponent
                                dom={{ style: styles.convAiComponent }}
                                platform={Platform.OS}
                                get_battery_level={tools.get_battery_level}
                                change_brightness={tools.change_brightness}
                                flash_screen={tools.flash_screen}
                                onMessage={(message) => {
                                    console.log("Received conversation message:", message)
                                    setConversationMessages((prev) => [...prev, message])
                                }}
                            />
                        </View>
                        {/* <Text style={styles.connectionStatus}>
                            Voice AI: {conversationStatus === "connected" ? "🟢 Connected" : "🔴 Disconnected"}
                        </Text>*/ }
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.chatContainer}>
                <ScrollView
                    style={styles.messagesList}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ElevenLabs Conversation Messages */}
                    {/* {conversationMessages.length > 0 && (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>🎙️ Voice Conversation ({conversationMessages.length} messages)</Text>
                        </View>
                    )} */}
                    {conversationMessages.map((message, index) => (
                        <View key={`conv-${index}`} style={styles.chatMessageWrapper}>
                            <ChatMessage message={message} />
                        </View>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.inputContainer}>
                <View style={styles.disclaimerContainer}>
                    <Text style={styles.disclaimerText}>
                        ⚠️ This AI assistant provides general health information only. Always consult healthcare professionals for
                        medical advice.
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f9fa",
    },
    header: {
        paddingTop: 50,
        paddingBottom: 30,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        minHeight: 380, // Increased height
        zIndex: 10, // Ensure header stays on top
    },
    headerContent: {
        paddingHorizontal: 20,
        flex: 1,
    },
    headerTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        // marginBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        color: "white",
    },
    clearButton: {
        padding: 8,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        borderRadius: 12,
    },
    subtitle: {
        fontSize: 16,
        color: "rgba(255, 255, 255, 0.9)",
        marginBottom: 30, // Increased margin
    },
    microphoneSection: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 5,
        paddingBottom: 25, // Increased padding
        minHeight: 220, // Ensure minimum height
    },
    convAiContainer: {
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 5,
        overflow: "visible",
    },
    convAiComponent: {
        width: 160,
        height: 160,
        // Ensure no clipping
        overflow: "visible",
    },
    connectionStatus: {
        fontSize: 16,
        color: "rgba(255, 255, 255, 0.95)",
        textAlign: "center",
        fontWeight: "600",
        backgroundColor: "rgba(255, 255, 255, 0.15)",
        paddingHorizontal: 20,
        paddingVertical: 8, // Reduced from 10 to 8
        borderRadius: 25,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.2)",
        minWidth: 200,
        marginTop: -5, // Negative margin to pull it closer to the button
    },
    chatContainer: {
        flex: 1,
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: 0, // Remove negative margin to prevent overlap
        zIndex: 1, // Lower z-index than header
    },
    messagesList: {
        flex: 1,
    },
    messagesContent: {
        paddingVertical: 16,
        // paddingTop: 25, // Extra padding at top
    },
    inputContainer: {
        backgroundColor: "white",
        paddingHorizontal: 20,
        paddingTop: 8, // Reduced from 15
        paddingBottom: 12, // Reduced from 20
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
    },
    disclaimerContainer: {
        backgroundColor: "#FFF3CD",
        padding: 6, // Reduced from 12
        borderRadius: 8, // Reduced from 12
        borderLeftWidth: 2, // Reduced from 4
        borderLeftColor: "#FF9800",
    },
    disclaimerText: {
        fontSize: 10, // Reduced from 12
        color: "#856404",
        textAlign: "center",
        lineHeight: 12, // Reduced from 16
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "rgba(74, 144, 226, 0.1)",
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#4A90E2",
        textAlign: "center",
    },
    chatMessageWrapper: {
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        marginHorizontal: 8,
        borderRadius: 12,
        marginBottom: 8,
        zIndex: 1, // Ensure messages stay below header
        position: "relative", // Establish stacking context
    },
})
