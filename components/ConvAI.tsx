"use client"

"use dom"

import { useCallback, useState } from "react"
import { useConversation } from "@elevenlabs/react"
import { View, Pressable, StyleSheet, Alert } from "react-native"
import type { Message } from "@/components/ChatMessage"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { Audio } from "expo-av"
import type tools from "@/utils/tools"

async function requestMicrophonePermission() {
    try {
        console.log("Requesting microphone permission...")

        // Check if we're in a DOM environment (webview)
        if (typeof navigator !== "undefined" && navigator.mediaDevices) {
            console.log("Using web navigator API for microphone permission")
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                // Stop the stream immediately as we just needed permission
                stream.getTracks().forEach((track) => track.stop())
                console.log("Web microphone permission granted")
                return true
            } catch (webError) {
                console.error("Web microphone permission error:", webError)
                return false
            }
        } else {
            console.log("Using React Native Audio API for microphone permission")
            // React Native environment - use expo-av
            const { status } = await Audio.requestPermissionsAsync()
            console.log("Audio permission status:", status)
            if (status === "granted") {
                return true
            } else {
                console.error("Microphone permission denied")
                return false
            }
        }
    } catch (error) {
        console.error("Error requesting microphone permission:", error)
        return false
    }
}

export default function ConvAiDOMComponent({
    platform,
    get_battery_level,
    change_brightness,
    flash_screen,
    onMessage,
}: {
    dom?: import("expo/dom").DOMProps
    platform: string
    get_battery_level: typeof tools.get_battery_level
    change_brightness: typeof tools.change_brightness
    flash_screen: typeof tools.flash_screen
    onMessage: (message: Message) => void
}) {
    const [isLoading, setIsLoading] = useState(false)
    const [hasPermission, setHasPermission] = useState<boolean | null>(null)

    const conversation = useConversation({
        onConnect: () => {
            console.log("ElevenLabs Connected")
            setIsLoading(false)
        },
        onDisconnect: () => {
            console.log("ElevenLabs Disconnected")
            setIsLoading(false)
        },
        onMessage: (message: Message) => {
            console.log("ElevenLabs Message received:", message)
            onMessage(message)
        },
        onError: (error: any) => {
            console.error("ElevenLabs Error:", error)
            setIsLoading(false)
            Alert.alert("Connection Error", `Failed to connect to AI voice service: ${error.message || error}`, [
                { text: "OK" },
            ])
        },
    })

    const startConversation = useCallback(async () => {
        try {
            setIsLoading(true)
            console.log("Starting ElevenLabs conversation...")

            // Request microphone permission
            const permissionGranted = await requestMicrophonePermission()
            setHasPermission(permissionGranted)

            if (!permissionGranted) {
                Alert.alert(
                    "Microphone Permission Required",
                    "Please allow microphone access to use voice conversation features.",
                    [{ text: "OK" }],
                )
                setIsLoading(false)
                return
            }

            // Check if agent ID is configured
            const agentId = process.env.EXPO_PUBLIC_AI_AGENT_ID || "";
            if (!agentId) {
                Alert.alert(
                    "Configuration Error",
                    "AI voice agent is not configured. Please check your environment variables.",
                    [{ text: "OK" }],
                )
                setIsLoading(false)
                return
            }

            console.log("Starting session with agent ID:", agentId)

            // Start the conversation with your agent
            await conversation.startSession({
                agentId: agentId,
                dynamicVariables: {
                    platform,
                },
                clientTools: {
                    logMessage: async ({ message }: { message: string }) => {
                        console.log("Agent tool message:", message)
                    },
                    get_battery_level,
                    change_brightness,
                    flash_screen,
                },
            })

            console.log("ElevenLabs session started successfully")
        } catch (error) {
            console.error("Failed to start ElevenLabs conversation:", error)
            setIsLoading(false)
            const errorMessage = error instanceof Error ? error.message : String(error)
            Alert.alert("Connection Failed", `Unable to start voice conversation: ${errorMessage}`, [{ text: "OK" }])
        }
    }, [conversation, platform, get_battery_level, change_brightness, flash_screen])

    const stopConversation = useCallback(async () => {
        try {
            setIsLoading(true)
            await conversation.endSession()
            console.log("ElevenLabs session ended")
        } catch (error) {
            console.error("Error ending conversation:", error)
        } finally {
            setIsLoading(false)
        }
    }, [conversation])

    const getButtonIcon = () => {
        if (isLoading) {
            return "loading"
        }
        if (conversation.status === "connected") {
            return "phone-hangup"
        }
        return "microphone"
    }

    const getButtonColor = () => {
        if (conversation.status === "connected") {
            return "#EF4444" // Red for active call
        }
        if (hasPermission === false) {
            return "#9CA3AF" // Gray for no permission
        }
        return "#3B82F6" // Blue for ready
    }

    return (
        <Pressable
            style={[
                styles.callButton,
                conversation.status === "connected" && styles.callButtonActive,
                isLoading && styles.callButtonLoading,
            ]}
            onPress={conversation.status === "disconnected" ? startConversation : stopConversation}
            disabled={isLoading}
        >
            <View
                style={[
                    styles.buttonInner,
                    { backgroundColor: getButtonColor() },
                    conversation.status === "connected" && styles.buttonInnerActive,
                ]}
            >
                <MaterialCommunityIcons
                    name={getButtonIcon()}
                    size={36}
                    color="white"
                    style={[styles.buttonIcon, isLoading && styles.buttonIconLoading]}
                />
            </View>

            {/* Status indicator */}
            {/* <View style={[styles.statusIndicator, conversation.status === "connected" && styles.statusIndicatorActive]} /> */}
        </Pressable>
    )
}

const styles = StyleSheet.create({
    callButton: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: "rgba(255, 255, 255, 0.3)",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    callButtonActive: {
        backgroundColor: "rgba(239, 68, 68, 0.25)",
        borderColor: "rgba(239, 68, 68, 0.4)",
    },
    callButtonLoading: {
        backgroundColor: "rgba(156, 163, 175, 0.25)",
        borderColor: "rgba(156, 163, 175, 0.4)",
    },
    buttonInner: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#3B82F6",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#3B82F6",
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    buttonInnerActive: {
        backgroundColor: "#EF4444",
        shadowColor: "#EF4444",
    },
    buttonIcon: {
        transform: [{ translateY: 0 }],
    },
    buttonIconLoading: {
        opacity: 0.7,
    },
    statusIndicator: {
        position: "absolute",
        top: 15,
        right: 15,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "#6B7280",
        borderWidth: 3,
        borderColor: "white",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    statusIndicatorActive: {
        backgroundColor: "#10B981",
    },
})
