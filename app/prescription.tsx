import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
    Image,
    TextInput,
    Modal,
} from 'react-native';

const AZURE_KEY = ""; // Replace with your Azure Computer Vision key
const AZURE_ENDPOINT = ""; // Updated endpoint

interface ApiResponse {
    fullResponse: any;
    extractedTexts: string[];
}

export default function PrescriptionScreen() {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showUrlModal, setShowUrlModal] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [showRawResponse, setShowRawResponse] = useState(false);

    const handleUrlSubmit = () => {
        if (!imageUrl.trim()) {
            Alert.alert('Error', 'Please enter a valid URL');
            return;
        }

        // Basic URL validation
        try {
            new URL(imageUrl);
        } catch {
            Alert.alert('Error', 'Please enter a valid URL');
            return;
        }

        setSelectedImage(imageUrl);
        setApiResponse(null);
        setShowUrlModal(false);
        setImageUrl('');
    };

    const showUrlInput = () => {
        setShowUrlModal(true);
    };

    const extractTexts = (responseJson: any) => {
        const allTexts: any = [];
        if (responseJson?.readResult?.blocks) {
            responseJson.readResult.blocks.forEach((block: any) => {
                if (block.lines) {
                    block.lines.forEach((line: any) => {
                        if (line.text) {
                            allTexts.push(line.text);
                        }
                    });
                }
            });
        }

        return allTexts;
    };


    const extractTextFromImage = async () => {
        if (!selectedImage) {
            Alert.alert('Error', 'Please select an image first');
            return;
        }

        if (!AZURE_KEY || !AZURE_ENDPOINT) {
            Alert.alert('Configuration Error', 'Azure Computer Vision credentials not configured');
            return;
        }

        setIsProcessing(true);

        try {
            const requestBody = JSON.stringify({
                url: selectedImage,
            });

            const analyzeUrl = `https://prescription-ocr.cognitiveservices.azure.com/computervision/imageanalysis:analyze?features=caption%2Cread&model-version=latest&language=en&api-version=2024-02-01`;

            const response = await fetch(analyzeUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': AZURE_KEY,
                },
                body: requestBody,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            const extractedTexts = extractTexts(result);

            setApiResponse({
                fullResponse: result,
                extractedTexts: extractedTexts,
            });

        } catch (error) {
            console.error('Error calling API:', error);
            Alert.alert('Error', `Failed to call API: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Prescription Image Analyzer</Text>
                <Text style={styles.subtitle}>Enter an image URL to extract text using Azure Computer Vision</Text>
            </View>

            <View style={styles.imageSection}>
                {selectedImage ? (
                    <View>
                        <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                        <Text style={styles.imageSourceText}>🌐 From URL</Text>
                    </View>
                ) : (
                    <View style={styles.placeholderImage}>
                        <Text style={styles.placeholderText}>No image URL entered</Text>
                    </View>
                )}
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity style={[styles.button, styles.urlButton]} onPress={showUrlInput}>
                    <Text style={styles.buttonText}>Enter Image URL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.extractButton, !selectedImage && styles.disabledButton]}
                    onPress={extractTextFromImage}
                    disabled={!selectedImage || isProcessing}
                >
                    {isProcessing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Call API</Text>
                    )}
                </TouchableOpacity>
            </View>

            {apiResponse && (
                <View style={styles.resultSection}>
                    <Text style={styles.resultTitle}>Extracted Texts:</Text>
                    <ScrollView style={styles.responseScrollView} nestedScrollEnabled={true}>
                        {apiResponse.extractedTexts.length > 0 ? (
                            apiResponse.extractedTexts.map((text, index) => (
                                <View key={index} style={styles.textItem}>
                                    <Text style={styles.textIndex}>{index + 1}.</Text>
                                    <Text style={styles.extractedText}>{text}</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.noTextFound}>No text found in the image</Text>
                        )}
                    </ScrollView>

                    <TouchableOpacity
                        style={styles.rawResponseButton}
                        onPress={() => setShowRawResponse(!showRawResponse)}
                    >
                        <Text style={styles.rawResponseButtonText}>
                            {showRawResponse ? '▼ Hide Raw Response' : '▶ Show Raw Response'}
                        </Text>
                    </TouchableOpacity>

                    {showRawResponse && (
                        <ScrollView style={styles.rawResponseScrollView} nestedScrollEnabled={true}>
                            <Text style={styles.responseText}>
                                {JSON.stringify(apiResponse.fullResponse, null, 2)}
                            </Text>
                        </ScrollView>
                    )}
                </View>
            )}

            {/* URL Input Modal */}
            <Modal
                visible={showUrlModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowUrlModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Enter Image URL</Text>
                        <TextInput
                            style={styles.urlInput}
                            placeholder="https://example.com/image.jpg"
                            value={imageUrl}
                            onChangeText={setImageUrl}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <TouchableOpacity
                            style={styles.testUrlButton}
                            onPress={() => setImageUrl('https://learn.microsoft.com/azure/ai-services/computer-vision/media/quickstarts/presentation.png')}
                        >
                            <Text style={styles.testUrlText}>📄 Use Sample Image</Text>
                        </TouchableOpacity>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => {
                                    setShowUrlModal(false);
                                    setImageUrl('');
                                }}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.submitButton]}
                                onPress={handleUrlSubmit}
                            >
                                <Text style={styles.submitButtonText}>Use URL</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 16,
    },
    header: {
        marginBottom: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    imageSection: {
        marginBottom: 24,
        alignItems: 'center',
    },
    selectedImage: {
        width: 300,
        height: 200,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#ddd',
    },
    imageSourceText: {
        textAlign: 'center',
        marginTop: 8,
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
    },
    placeholderImage: {
        width: 300,
        height: 200,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#ddd',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fafafa',
    },
    placeholderText: {
        color: '#999',
        fontSize: 16,
    },
    buttonContainer: {
        gap: 12,
        marginBottom: 24,
    },
    button: {
        backgroundColor: '#007bff',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    extractButton: {
        backgroundColor: '#28a745',
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    resultSection: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    resultTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    textContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    extractedTextContent: {
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
    },
    metadataContainer: {
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 12,
    },
    metadataTitle: {
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic',
    },
    urlButton: {
        backgroundColor: '#6f42c1',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        margin: 20,
        minWidth: 300,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
        textAlign: 'center',
    },
    urlInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 12,
        backgroundColor: '#f9f9f9',
    },
    testUrlButton: {
        backgroundColor: '#e3f2fd',
        borderWidth: 1,
        borderColor: '#2196f3',
        borderRadius: 6,
        padding: 10,
        marginBottom: 16,
        alignItems: 'center',
    },
    testUrlText: {
        color: '#1976d2',
        fontSize: 14,
        fontWeight: '500',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    submitButton: {
        backgroundColor: '#007bff',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    responseScrollView: {
        maxHeight: 400,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    responseText: {
        fontSize: 12,
        color: '#333',
        fontFamily: 'monospace',
        lineHeight: 16,
    },
    textItem: {
        flexDirection: 'row',
        marginBottom: 8,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: '#fff',
        borderRadius: 6,
        borderLeftWidth: 3,
        borderLeftColor: '#007bff',
    },
    textIndex: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#007bff',
        marginRight: 8,
        minWidth: 30,
    },
    extractedText: {
        fontSize: 14,
        color: '#333',
        flex: 1,
        lineHeight: 20,
    },
    noTextFound: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
        fontStyle: 'italic',
        paddingVertical: 20,
    },
    rawResponseButton: {
        backgroundColor: '#6c757d',
        padding: 12,
        borderRadius: 6,
        marginTop: 16,
        marginBottom: 8,
        alignItems: 'center',
    },
    rawResponseButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    rawResponseScrollView: {
        maxHeight: 300,
        backgroundColor: '#f1f3f4',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
});