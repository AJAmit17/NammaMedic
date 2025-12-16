import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
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
import { Appbar } from 'react-native-paper';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as ImagePicker from 'expo-image-picker';

const GEMINI_KEY = "AIzaSyACyo51oBUD2wZrE-O4Bo8_oOUYry1ppq4"

interface DoctorInfo {
    name: string;
    degree: string;
    specialization: string;
    clinic_name: string;
    clinic_address: string;
    clinic_hours: string;
    holiday: string;
    phone: string[];
}

interface PatientInfo {
    name: string;
    date: string;
    age: string;
    weight: string;
    body_temperature: string;
}

interface PrescriptionItem {
    sl_no: number;
    medicine: string;
    dosage_pattern: string;
}

interface PrescriptionData {
    doctor: DoctorInfo;
    patient: PatientInfo;
    prescription: PrescriptionItem[];
    note: string;
    signature_present: boolean;
}

interface ApiResponse {
    fullResponse: any;
    prescriptionData: PrescriptionData | null;
    rawText: string;
}

export default function PrescriptionScreen() {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imageSource, setImageSource] = useState<'url' | 'gallery' | 'camera' | null>(null);
    const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showUrlModal, setShowUrlModal] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [showRawResponse, setShowRawResponse] = useState(false);

    const SYSTEM_PROMPT = `
            You are an expert medical prescription analyzer. Analyze the prescription image and extract all relevant information into a structured JSON format.

            CRITICAL: Return ONLY a valid JSON object. Do NOT include any markdown formatting, code blocks, or backticks like \`\`\`json. Return pure, clean JSON only.

            Extract the following information and return ONLY a valid JSON object in this exact format:

            {
            "doctor": {
                "name": "Doctor's full name",
                "degree": "Medical degrees and qualifications",
                "specialization": "Medical specialization if mentioned",
                "clinic_name": "Name of clinic/hospital",
                "clinic_address": "Complete address of clinic",
                "clinic_hours": "Operating hours if mentioned",
                "holiday": "Holiday information if mentioned",
                "phone": ["phone numbers as array"]
            },
            "patient": {
                "name": "Patient's full name",
                "date": "Date of prescription",
                "age": "Patient age if mentioned",
                "weight": "Patient weight if mentioned",
                "body_temperature": "Temperature if mentioned"
            },
            "prescription": [
                {
                "sl_no": 1,
                "medicine": "Medicine name",
                "dosage_pattern": "Dosage pattern (e.g., 1-0-1, twice daily, etc.)"
                }
            ],
            "note": "Any additional notes or instructions",
            "signature_present": true
            }

            Rules:
            - Extract all text accurately from the prescription
            - If information is not available, use empty string ""
            - For arrays, use empty array [] if no data
            - For prescription items, number them sequentially starting from 1
            - Maintain exact medicine names and dosages as written
            - Return ONLY the JSON object, no additional text, no markdown, no code blocks
            - Do not wrap the response in \`\`\`json or any other formatting
        `;

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
        setImageSource('url');
        setApiResponse(null);
        setShowUrlModal(false);
        setImageUrl('');
    };

    const showUrlInput = () => {
        setShowUrlModal(true);
    };

    const requestPermissions = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to select images.');
            return false;
        }
        return true;
    };

    const pickImageFromGallery = async () => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setSelectedImage(result.assets[0].uri);
            setImageSource('gallery');
            setApiResponse(null);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Sorry, we need camera permissions to take photos.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setSelectedImage(result.assets[0].uri);
            setImageSource('camera');
            setApiResponse(null);
        }
    };

    const convertImageToBase64 = async (imageUri: string): Promise<string> => {
        try {
            // Check if it's a URL or local file
            if (imageUri.startsWith('http')) {
                // Handle URL - same as before
                const response = await fetch(imageUri);
                const blob = await response.blob();
                
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64String = reader.result as string;
                        const base64Data = base64String.split(',')[1];
                        resolve(base64Data);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } else {
                // Handle local file (from gallery or camera)
                const response = await fetch(imageUri);
                const blob = await response.blob();
                
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64String = reader.result as string;
                        const base64Data = base64String.split(',')[1];
                        resolve(base64Data);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            }
        } catch (error) {
            throw new Error(`Failed to convert image to base64: ${error}`);
        }
    };

    const getMimeTypeFromUri = (uri: string): string => {
        if (uri.startsWith('http')) {
            // Handle URL
            const extension = uri.split('.').pop()?.toLowerCase();
            switch (extension) {
                case 'jpg':
                case 'jpeg':
                    return 'image/jpeg';
                case 'png':
                    return 'image/png';
                case 'gif':
                    return 'image/gif';
                case 'webp':
                    return 'image/webp';
                default:
                    return 'image/jpeg';
            }
        } else {
            // Handle local file - default to jpeg for gallery/camera images
            return 'image/jpeg';
        }
    };

    const extractPrescriptionData = async () => {
        if (!selectedImage) {
            Alert.alert('Error', 'Please select an image first');
            return;
        }

        if (!GEMINI_KEY) {
            Alert.alert('Configuration Error', 'Google Gemini API key not configured');
            return;
        }

        setIsProcessing(true);

        try {
            // Initialize Gemini
            const genAI = new GoogleGenerativeAI(GEMINI_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            // Convert image URL to base64
            const base64Image = await convertImageToBase64(selectedImage);
            const mimeType = getMimeTypeFromUri(selectedImage);

            // Create the prompt with image
            const prompt = SYSTEM_PROMPT;

            const imagePart = {
                inlineData: {
                    data: base64Image,
                    mimeType: mimeType,
                },
            };

            // Generate content
            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

            console.log('Raw Gemini response:', text);

            // Try to parse the JSON response
            let prescriptionData: PrescriptionData | null = null;
            try {
                // Clean the response text to extract JSON
                let cleanedText = text.trim();
                
                // Remove any markdown code blocks if present
                cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
                
                // Find JSON object
                const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    prescriptionData = JSON.parse(jsonMatch[0]);
                } else {
                    // Try parsing the entire cleaned text
                    prescriptionData = JSON.parse(cleanedText);
                }
            } catch (parseError) {
                console.error('Failed to parse JSON:', parseError);
                console.log('Raw text that failed to parse:', text);
                Alert.alert('Warning', 'Could not parse structured data, showing raw response');
            }

            setApiResponse({
                fullResponse: result,
                prescriptionData: prescriptionData,
                rawText: text,
            });

        } catch (error) {
            console.error('Error calling Gemini API:', error);
            Alert.alert('Error', `Failed to analyze prescription: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <LinearGradient colors={["#0288D1", "#0277BD", "#01579B"]} style={styles.header}>
                <View style={styles.headerTop}>
                    <Appbar.BackAction
                        onPress={() => router.back()}
                        iconColor="#ffffff"
                        size={24}
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', margin: 0 }}
                    />
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>Prescription</Text>
                        <Text style={styles.subtitle}>Analyze prescription using AI-powered Gemini Vision</Text>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.contentContainer}>
                <View style={styles.imageSection}>
                    {selectedImage ? (
                        <View>
                            <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                            <Text style={styles.imageSourceText}>
                                {imageSource === 'url' && '🌐 From URL'}
                                {imageSource === 'gallery' && '📷 From Gallery'}
                                {imageSource === 'camera' && '📸 From Camera'}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.placeholderImage}>
                            <Text style={styles.placeholderText}>No image selected</Text>
                        </View>
                    )}
                </View>

                <View style={styles.buttonContainer}>
                    <TouchableOpacity style={[styles.button, styles.cameraButton]} onPress={takePhoto}>
                        <Text style={styles.buttonText}>📸 Take Photo</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={[styles.button, styles.galleryButton]} onPress={pickImageFromGallery}>
                        <Text style={styles.buttonText}>🖼️ Choose from Gallery</Text>
                    </TouchableOpacity>
{/* 
                    <TouchableOpacity style={[styles.button, styles.urlButton]} onPress={showUrlInput}>
                        <Text style={styles.buttonText}>🌐 Enter Image URL</Text>
                    </TouchableOpacity> */}

                    <TouchableOpacity
                        style={[styles.button, styles.extractButton, !selectedImage && styles.disabledButton]}
                        onPress={extractPrescriptionData}
                        disabled={!selectedImage || isProcessing}
                    >
                        {isProcessing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Analyze Prescription</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {apiResponse && (
                    <View style={styles.resultSection}>
                        {apiResponse.prescriptionData ? (
                            <View>
                                <Text style={styles.resultTitle}>Prescription Analysis:</Text>
                                
                                {/* Doctor Information */}
                                <View style={styles.sectionContainer}>
                                    <Text style={styles.sectionTitle}>👨‍⚕️ Doctor Information</Text>
                                    <View style={styles.infoContainer}>
                                        <Text style={styles.infoLabel}>Name:</Text>
                                        <Text style={styles.infoValue}>{apiResponse.prescriptionData.doctor.name || 'Not found'}</Text>
                                    </View>
                                    <View style={styles.infoContainer}>
                                        <Text style={styles.infoLabel}>Degree:</Text>
                                        <Text style={styles.infoValue}>{apiResponse.prescriptionData.doctor.degree || 'Not found'}</Text>
                                    </View>
                                    <View style={styles.infoContainer}>
                                        <Text style={styles.infoLabel}>Clinic:</Text>
                                        <Text style={styles.infoValue}>{apiResponse.prescriptionData.doctor.clinic_name || 'Not found'}</Text>
                                    </View>
                                </View>

                                {/* Patient Information */}
                                <View style={styles.sectionContainer}>
                                    <Text style={styles.sectionTitle}>👤 Patient Information</Text>
                                    <View style={styles.infoContainer}>
                                        <Text style={styles.infoLabel}>Name:</Text>
                                        <Text style={styles.infoValue}>{apiResponse.prescriptionData.patient.name || 'Not found'}</Text>
                                    </View>
                                    <View style={styles.infoContainer}>
                                        <Text style={styles.infoLabel}>Date:</Text>
                                        <Text style={styles.infoValue}>{apiResponse.prescriptionData.patient.date || 'Not found'}</Text>
                                    </View>
                                    {apiResponse.prescriptionData.patient.age && (
                                        <View style={styles.infoContainer}>
                                            <Text style={styles.infoLabel}>Age:</Text>
                                            <Text style={styles.infoValue}>{apiResponse.prescriptionData.patient.age}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Prescription */}
                                <View style={styles.sectionContainer}>
                                    <Text style={styles.sectionTitle}>💊 Prescription</Text>
                                    {apiResponse.prescriptionData.prescription.length > 0 ? (
                                        apiResponse.prescriptionData.prescription.map((item, index) => (
                                            <View key={index} style={styles.prescriptionItem}>
                                                <Text style={styles.medicineNumber}>{item.sl_no}.</Text>
                                                <View style={styles.medicineDetails}>
                                                    <Text style={styles.medicineName}>{item.medicine}</Text>
                                                    <Text style={styles.dosagePattern}>Dosage: {item.dosage_pattern}</Text>
                                                </View>
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={styles.noDataText}>No prescription items found</Text>
                                    )}
                                </View>

                                {/* Notes */}
                                {apiResponse.prescriptionData.note && (
                                    <View style={styles.sectionContainer}>
                                        <Text style={styles.sectionTitle}>📝 Notes</Text>
                                        <Text style={styles.noteText}>{apiResponse.prescriptionData.note}</Text>
                                    </View>
                                )}

                                {/* Signature Status */}
                                <View style={styles.sectionContainer}>
                                    <Text style={styles.sectionTitle}>✍️ Signature</Text>
                                    <Text style={[styles.signatureStatus, apiResponse.prescriptionData.signature_present ? styles.signaturePresent : styles.signatureAbsent]}>
                                        {apiResponse.prescriptionData.signature_present ? '✅ Signature Present' : '❌ No Signature Found'}
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.resultTitle}>Raw Analysis Result:</Text>
                                <ScrollView style={styles.responseScrollView} nestedScrollEnabled={true}>
                                    <Text style={styles.rawText}>{apiResponse.rawText}</Text>
                                </ScrollView>
                            </View>
                        )}

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
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        paddingTop: 40, // Significantly reduced to move title closer to notch
        paddingBottom: 15, // Reduced from 25 to decrease gap
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        position: "relative",
    },
    headerTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        paddingHorizontal: 20,
        position: "relative",
    },
    headerContent: {
        alignItems: 'center',
        flex: 1,
        marginHorizontal: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#ffffff',
        textAlign: 'center',
        opacity: 0.9,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 16,
        marginTop: 20,
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
    cameraButton: {
        backgroundColor: '#e91e63',
    },
    galleryButton: {
        backgroundColor: '#ff9800',
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
    // New styles for structured prescription display
    sectionContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#007bff',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    infoContainer: {
        flexDirection: 'row',
        marginBottom: 8,
        alignItems: 'flex-start',
    },
    infoLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        width: 80,
        marginRight: 12,
    },
    infoValue: {
        fontSize: 14,
        color: '#333',
        flex: 1,
        lineHeight: 20,
    },
    prescriptionItem: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#28a745',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    medicineNumber: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#28a745',
        marginRight: 12,
        minWidth: 30,
    },
    medicineDetails: {
        flex: 1,
    },
    medicineName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    dosagePattern: {
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic',
    },
    noteText: {
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
        fontStyle: 'italic',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 6,
    },
    signatureStatus: {
        fontSize: 16,
        fontWeight: '600',
        padding: 12,
        borderRadius: 6,
        textAlign: 'center',
    },
    signaturePresent: {
        backgroundColor: '#d4edda',
        color: '#155724',
    },
    signatureAbsent: {
        backgroundColor: '#f8d7da',
        color: '#721c24',
    },
    noDataText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        fontStyle: 'italic',
        paddingVertical: 20,
    },
    rawText: {
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
        fontFamily: 'monospace',
    },
});