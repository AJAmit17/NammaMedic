import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Dimensions,
    Modal,
    TextInput,
    Share,
    Linking,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

// Gender options
const GENDER_OPTIONS = [
    'Male',
    'Female',
    'Non-binary',
    'Prefer not to say',
    'Other'
];

// Blood type options
const BLOOD_TYPE_OPTIONS = [
    'A+',
    'A-',
    'B+',
    'B-',
    'AB+',
    'AB-',
    'O+',
    'O-',
    'Unknown'
];

// Common medical conditions
const COMMON_CONDITIONS = [
    'Diabetes Type 1',
    'Diabetes Type 2',
    'High Blood Pressure',
    'Heart Disease',
    'Asthma',
    'Arthritis',
    'Depression',
    'Anxiety',
    'High Cholesterol',
    'Thyroid Disease',
    'COPD',
    'Kidney Disease',
    'Liver Disease',
    'Epilepsy',
    'Migraine',
    'Osteoporosis',
    'Cancer',
    'Autoimmune Disease',
];

// Common allergies
const COMMON_ALLERGIES = [
    'Penicillin',
    'Aspirin',
    'Ibuprofen',
    'Sulfa drugs',
    'Peanuts',
    'Tree nuts',
    'Shellfish',
    'Fish',
    'Milk',
    'Eggs',
    'Soy',
    'Wheat',
    'Bee stings',
    'Latex',
    'Pet dander',
    'Pollen',
    'Dust mites',
    'Mold',
];

interface UserProfile {
    firstName: string;
    lastName: string;
    age: number;
    dateOfBirth: string;
    gender: string;
    height: number; // in cm
    weight: number; // in kg
    bloodType: string;
    allergies: string[];
    medicalConditions: string[];
    emergencyContact: {
        name: string;
        phone: string;
        relationship: string;
    };
    doctor: {
        name: string;
        phone: string;
        specialty: string;
    };
}

const defaultProfile: UserProfile = {
    firstName: '',
    lastName: '',
    age: 0,
    dateOfBirth: '',
    gender: 'Not specified',
    height: 0,
    weight: 0,
    bloodType: 'Not specified',
    allergies: [],
    medicalConditions: [],
    emergencyContact: {
        name: '',
        phone: '',
        relationship: '',
    },
    doctor: {
        name: '',
        phone: '',
        specialty: '',
    },
};

export default function ProfileScreen() {
    const [profile, setProfile] = useState<UserProfile>(defaultProfile);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [medicalFormVisible, setMedicalFormVisible] = useState(false);
    const [settingsModalVisible, setSettingsModalVisible] = useState(false);
    const [genderModalVisible, setGenderModalVisible] = useState(false);
    const [bloodTypeModalVisible, setBloodTypeModalVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [editingField, setEditingField] = useState<string>('');
    const [editValue, setEditValue] = useState<string>('');
    const [newCondition, setNewCondition] = useState<string>('');
    const [newAllergy, setNewAllergy] = useState<string>('');
    const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
    const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const savedProfile = await AsyncStorage.getItem('userProfile');
            if (savedProfile) {
                setProfile(JSON.parse(savedProfile));
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    };

    const saveProfile = async (updatedProfile: UserProfile) => {
        try {
            await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
            setProfile(updatedProfile);
        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', 'Failed to save profile');
        }
    };

    const handleEdit = (field: string, currentValue: string) => {
        setEditingField(field);
        setEditValue(currentValue);
        setEditModalVisible(true);
    };    const handleSaveEdit = () => {
        const updatedProfile = { ...profile };

        switch (editingField) {
            case 'firstName':
                updatedProfile.firstName = editValue;
                break;
            case 'lastName':
                updatedProfile.lastName = editValue;
                break;
            case 'age':
                updatedProfile.age = parseInt(editValue) || 0;
                break;
            case 'dateOfBirth':
                updatedProfile.dateOfBirth = editValue;
                break;
            case 'gender':
                updatedProfile.gender = editValue;
                break;
            case 'height':
                updatedProfile.height = parseFloat(editValue) || 0;
                break;
            case 'weight':
                updatedProfile.weight = parseFloat(editValue) || 0;
                break;
            case 'bloodType':
                updatedProfile.bloodType = editValue;
                break;
            case 'emergencyContactName':
                updatedProfile.emergencyContact.name = editValue;
                break;
            case 'emergencyContactPhone':
                updatedProfile.emergencyContact.phone = editValue;
                break;
            case 'emergencyContactRelationship':
                updatedProfile.emergencyContact.relationship = editValue;
                break;
            case 'doctorName':
                updatedProfile.doctor.name = editValue;
                break;
            case 'doctorPhone':
                updatedProfile.doctor.phone = editValue;
                break;
            case 'doctorSpecialty':
                updatedProfile.doctor.specialty = editValue;
                break;
        }

        saveProfile(updatedProfile);
        setEditModalVisible(false);
    };

    const handleOpenMedicalForm = () => {
        setSelectedConditions([...profile.medicalConditions]);
        setSelectedAllergies([...profile.allergies]);
        setNewCondition('');
        setNewAllergy('');
        setMedicalFormVisible(true);
    };

    const handleSaveMedicalForm = () => {
        const updatedProfile = { ...profile };
        updatedProfile.medicalConditions = [...selectedConditions];
        updatedProfile.allergies = [...selectedAllergies];

        // Add custom conditions and allergies if entered
        if (newCondition.trim() && !selectedConditions.includes(newCondition.trim())) {
            updatedProfile.medicalConditions.push(newCondition.trim());
        }
        if (newAllergy.trim() && !selectedAllergies.includes(newAllergy.trim())) {
            updatedProfile.allergies.push(newAllergy.trim());
        }

        saveProfile(updatedProfile);
        setMedicalFormVisible(false);
    };

    const toggleCondition = (condition: string) => {
        setSelectedConditions(prev =>
            prev.includes(condition)
                ? prev.filter(c => c !== condition)
                : [...prev, condition]
        );
    };

    const toggleAllergy = (allergy: string) => {
        setSelectedAllergies(prev =>
            prev.includes(allergy)
                ? prev.filter(a => a !== allergy)
                : [...prev, allergy]
        );
    };

    const removeCondition = (condition: string) => {
        const updatedProfile = { ...profile };
        updatedProfile.medicalConditions = profile.medicalConditions.filter(c => c !== condition);
        saveProfile(updatedProfile);
    };

    const removeAllergy = (allergy: string) => {
        const updatedProfile = { ...profile };
        updatedProfile.allergies = profile.allergies.filter(a => a !== allergy);
        saveProfile(updatedProfile);
    };

    // Settings functions
    const downloadUserData = async () => {
        try {
            const formatUserData = () => {
                const data = `
NAMMA MEDIC - USER PROFILE DATA
===============================
Export Date: ${new Date().toLocaleDateString()}

PERSONAL INFORMATION
--------------------
Name: ${profile.firstName} ${profile.lastName}
Age: ${profile.age} years
Date of Birth: ${profile.dateOfBirth || 'Not specified'}
Gender: ${profile.gender}
Height: ${profile.height} cm
Weight: ${profile.weight} kg
Blood Type: ${profile.bloodType}
BMI: ${calculateBMI()} (${getBMICategory(calculateBMI())})

EMERGENCY CONTACT
-----------------
Name: ${profile.emergencyContact.name || 'Not specified'}
Phone: ${profile.emergencyContact.phone || 'Not specified'}
Relationship: ${profile.emergencyContact.relationship || 'Not specified'}

PRIMARY DOCTOR
--------------
Name: ${profile.doctor.name || 'Not specified'}
Phone: ${profile.doctor.phone || 'Not specified'}
Specialty: ${profile.doctor.specialty || 'Not specified'}

MEDICAL CONDITIONS
------------------
${profile.medicalConditions.length > 0 ? profile.medicalConditions.map((condition, index) => `${index + 1}. ${condition}`).join('\n') : 'None recorded'}

ALLERGIES
---------
${profile.allergies.length > 0 ? profile.allergies.map((allergy, index) => `${index + 1}. ${allergy}`).join('\n') : 'None recorded'}

===============================
This data was exported from Namma Medic app.
For medical use, please consult your healthcare provider.
                `;
                return data.trim();
            };

            const formattedData = formatUserData();
            
            await Share.share({
                message: formattedData,
                title: 'Namma Medic - User Profile Data',
            });

            Alert.alert(
                'Data Shared Successfully!',
                'Your medical profile data has been prepared for sharing.',
                [{ text: 'OK' }]
            );

        } catch (error) {
            console.error('Error sharing user data:', error);
            Alert.alert('Share Error', 'Failed to share your profile data. Please try again.');
        }
    };

    const openPrivacyPolicy = () => {
        Alert.alert(
            'Privacy Policy',
            'This app stores your medical information locally on your device. We do not share your personal health information with third parties without your consent. Your data is encrypted and protected.\n\nFor full privacy policy, visit our website or contact support.',
            [{ text: 'OK' }]
        );
    };

    const openTermsAndConditions = () => {
        Alert.alert(
            'Terms and Conditions',
            'By using Namma Medic, you agree to:\n\n• Use this app for personal health tracking only\n• Consult healthcare professionals for medical decisions\n• Keep your login credentials secure\n• Report any issues to our support team\n\nThis app is not a substitute for professional medical advice.',
            [{ text: 'OK' }]
        );
    };

    const openNotificationSettings = () => {
        Alert.alert(
            'Notification Settings',
            'Notification settings can be managed in your device settings:\n\nAndroid: Settings > Apps > Namma Medic > Notifications\niOS: Settings > Notifications > Namma Medic\n\nYou can also manage medicine reminders within the app.',
            [
                { text: 'Cancel' },
                { 
                    text: 'Open Settings', 
                    onPress: () => {
                        try {
                            Linking.openSettings();
                        } catch (error) {
                            Alert.alert('Error', 'Could not open device settings. Please navigate manually.');
                        }
                    }
                }
            ]
        );
    };

    const handleGenderSelect = (gender: string) => {
        const updatedProfile = { ...profile, gender };
        saveProfile(updatedProfile);
        setGenderModalVisible(false);
    };

    const handleBloodTypeSelect = (bloodType: string) => {
        const updatedProfile = { ...profile, bloodType };
        saveProfile(updatedProfile);
        setBloodTypeModalVisible(false);
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            const formattedDate = selectedDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            const updatedProfile = { ...profile, dateOfBirth: formattedDate };
            saveProfile(updatedProfile);
        }
    };

    const calculateBMI = () => {
        if (profile.height > 0 && profile.weight > 0) {
            const heightInMeters = profile.height / 100;
            const bmi = profile.weight / (heightInMeters * heightInMeters);
            return bmi.toFixed(1);
        }
        return 'N/A';
    };

    const getBMICategory = (bmi: string) => {
        const bmiValue = parseFloat(bmi);
        if (bmi === 'N/A') return '';
        if (bmiValue < 18.5) return 'Underweight';
        if (bmiValue < 25) return 'Normal';
        if (bmiValue < 30) return 'Overweight';
        return 'Obese';
    };

    const ProfileCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <View style={styles.profileCard}>
            <Text style={styles.cardTitle}>{title}</Text>
            {children}
        </View>
    );

    const DatePickerField = ({
        label,
        value,
        onPress,
        icon
    }: {
        label: string;
        value: string;
        onPress: () => void;
        icon: string;
    }) => (
        <TouchableOpacity
            style={styles.fieldContainer}
            onPress={onPress}
        >
            <View style={styles.fieldContent}>
                <Ionicons name={icon as any} size={20} color="#666" />
                <View style={styles.fieldText}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    <Text style={styles.fieldValue}>
                        {value || 'Not set'}
                    </Text>
                </View>
            </View>
            <Ionicons name="calendar-outline" size={20} color="#ccc" />
        </TouchableOpacity>
    );

    const EditableField = ({
        label,
        value,
        field,
        icon,
        unit = ''
    }: {
        label: string;
        value: string;
        field: string;
        icon: string;
        unit?: string;
    }) => (
        <TouchableOpacity
            style={styles.fieldContainer}
            onPress={() => handleEdit(field, value)}
        >
            <View style={styles.fieldContent}>
                <Ionicons name={icon as any} size={20} color="#666" />
                <View style={styles.fieldText}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    <Text style={styles.fieldValue}>
                        {value || 'Not set'} {unit}
                    </Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
    );

    const bmi = calculateBMI();
    const bmiCategory = getBMICategory(bmi);

    return (
        <View style={{ flex: 1 }}>
            <ScrollView 
                style={styles.container} 
                showsVerticalScrollIndicator={false}
            >
            <LinearGradient colors={["#8E24AA", "#7B1FA2"]} style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity 
                        style={styles.settingsButton}
                        onPress={() => setSettingsModalVisible(true)}
                    >
                        <Ionicons name="settings-outline" size={24} color="white" />
                    </TouchableOpacity>
                    <View style={styles.avatarContainer}>
                        <Ionicons name="person" size={60} color="white" />
                    </View>
                    <Text style={styles.userName}>
                        {profile.firstName && profile.lastName
                            ? `${profile.firstName} ${profile.lastName}`
                            : 'User Profile'
                        }
                    </Text>
                    {profile.age > 0 && (
                        <Text style={styles.userAge}>{profile.age} years old</Text>
                    )}
                </View>
            </LinearGradient>

            <View style={styles.content}>
                <View pointerEvents="box-none">
                        {/* Basic Information */}
                <ProfileCard title="Basic Information">
                    <EditableField
                        label="First Name"
                        value={profile.firstName}
                        field="firstName"
                        icon="person-outline"
                    />
                    <EditableField
                        label="Last Name"
                        value={profile.lastName}
                        field="lastName"
                        icon="person-outline"
                    />
                    <EditableField
                        label="Age"
                        value={profile.age.toString()}
                        field="age"
                        icon="calendar-outline"
                        unit="years"
                    />
                    <DatePickerField
                        label="Date of Birth"
                        value={profile.dateOfBirth}
                        onPress={() => setShowDatePicker(true)}
                        icon="calendar"
                    />
                    <TouchableOpacity
                        style={styles.fieldContainer}
                        onPress={() => setGenderModalVisible(true)}
                    >
                        <View style={styles.fieldContent}>
                            <Ionicons name="male-female-outline" size={20} color="#666" />
                            <View style={styles.fieldText}>
                                <Text style={styles.fieldLabel}>Gender</Text>
                                <Text style={styles.fieldValue}>
                                    {profile.gender || 'Not selected'}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>
                </ProfileCard>

                {/* Physical Details */}
                <ProfileCard title="Physical Details">
                    <EditableField
                        label="Height"
                        value={profile.height.toString()}
                        field="height"
                        icon="resize-outline"
                        unit="cm"
                    />
                    <EditableField
                        label="Weight"
                        value={profile.weight.toString()}
                        field="weight"
                        icon="fitness-outline"
                        unit="kg"
                    />
                    <TouchableOpacity
                        style={styles.fieldContainer}
                        onPress={() => setBloodTypeModalVisible(true)}
                    >
                        <View style={styles.fieldContent}>
                            <Ionicons name="water-outline" size={20} color="#666" />
                            <View style={styles.fieldText}>
                                <Text style={styles.fieldLabel}>Blood Type</Text>
                                <Text style={styles.fieldValue}>
                                    {profile.bloodType || 'Not selected'}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>

                    {/* BMI Display */}
                    {bmi !== 'N/A' && (
                        <View style={styles.bmiContainer}>
                            <Text style={styles.bmiLabel}>BMI</Text>
                            <Text style={styles.bmiValue}>{bmi}</Text>
                            <Text style={[
                                styles.bmiCategory,
                                {
                                    color:
                                        bmiCategory === 'Normal' ? '#4CAF50' :
                                            bmiCategory === 'Underweight' ? '#FF9800' :
                                                bmiCategory === 'Overweight' ? '#FF5722' : '#F44336'
                                }
                            ]}>
                                {bmiCategory}
                            </Text>
                        </View>
                    )}
                </ProfileCard>

                {/* Emergency Contact */}
                <ProfileCard title="Emergency Contact">
                    <EditableField
                        label="Name"
                        value={profile.emergencyContact.name}
                        field="emergencyContactName"
                        icon="call-outline"
                    />
                    <EditableField
                        label="Phone"
                        value={profile.emergencyContact.phone}
                        field="emergencyContactPhone"
                        icon="phone-portrait-outline"
                    />
                    <EditableField
                        label="Relationship"
                        value={profile.emergencyContact.relationship}
                        field="emergencyContactRelationship"
                        icon="heart-outline"
                    />
                </ProfileCard>

                {/* Doctor Information */}
                <ProfileCard title="Primary Doctor">
                    <EditableField
                        label="Name"
                        value={profile.doctor.name}
                        field="doctorName"
                        icon="medical-outline"
                    />
                    <EditableField
                        label="Phone"
                        value={profile.doctor.phone}
                        field="doctorPhone"
                        icon="call-outline"
                    />
                    <EditableField
                        label="Specialty"
                        value={profile.doctor.specialty}
                        field="doctorSpecialty"
                        icon="library-outline"
                    />
                </ProfileCard>

                {/* Medical Conditions */}
                <ProfileCard title="Medical Conditions & Allergies">
                    <View style={styles.medicalSection}>
                        <Text style={styles.medicalSectionTitle}>Conditions</Text>
                        {profile.medicalConditions.length > 0 ? (
                            profile.medicalConditions.map((condition, index) => (
                                <View key={index} style={styles.medicalItemContainer}>
                                    <Text style={styles.medicalItem}>• {condition}</Text>
                                    <TouchableOpacity
                                        onPress={() => removeCondition(condition)}
                                        style={styles.removeButton}
                                    >
                                        <Ionicons name="close-circle" size={18} color="#FF5252" />
                                    </TouchableOpacity>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.emptyText}>No medical conditions recorded</Text>
                        )}

                        <Text style={[styles.medicalSectionTitle, { marginTop: 15 }]}>Allergies</Text>
                        {profile.allergies.length > 0 ? (
                            profile.allergies.map((allergy, index) => (
                                <View key={index} style={styles.medicalItemContainer}>
                                    <Text style={styles.medicalItem}>• {allergy}</Text>
                                    <TouchableOpacity
                                        onPress={() => removeAllergy(allergy)}
                                        style={styles.removeButton}
                                    >
                                        <Ionicons name="close-circle" size={18} color="#FF5252" />
                                    </TouchableOpacity>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.emptyText}>No allergies recorded</Text>
                        )}

                        <TouchableOpacity style={styles.addButton} onPress={handleOpenMedicalForm}>
                            <Ionicons name="add-circle-outline" size={20} color="#8E24AA" />
                            <Text style={styles.addButtonText}>Add Medical Information</Text>
                        </TouchableOpacity>
                    </View>
                </ProfileCard>
                    </View>
                </View>
            </ScrollView>

            {/* Gender Selection Modal */}
            <Modal
                visible={genderModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setGenderModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Gender</Text>
                            <TouchableOpacity
                                onPress={() => setGenderModalVisible(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        {/* <Text style={styles.scrollHint}>Scroll to see all options</Text> */}
                        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={true}>
                            {GENDER_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option}
                                    style={[
                                        styles.optionItem,
                                        profile.gender === option && styles.optionItemSelected
                                    ]}
                                    onPress={() => handleGenderSelect(option)}
                                >
                                    <Text style={[
                                        styles.optionText,
                                        profile.gender === option && styles.optionTextSelected
                                    ]}>
                                        {option}
                                    </Text>
                                    {profile.gender === option && (
                                        <Ionicons name="checkmark" size={20} color="#8E24AA" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Blood Type Selection Modal */}
            <Modal
                visible={bloodTypeModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setBloodTypeModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Blood Type</Text>
                            <TouchableOpacity
                                onPress={() => setBloodTypeModalVisible(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.scrollHint}>Scroll to see all options</Text>
                        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={true}>
                            {BLOOD_TYPE_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option}
                                    style={[
                                        styles.optionItem,
                                        profile.bloodType === option && styles.optionItemSelected
                                    ]}
                                    onPress={() => handleBloodTypeSelect(option)}
                                >
                                    <Text style={[
                                        styles.optionText,
                                        profile.bloodType === option && styles.optionTextSelected
                                    ]}>
                                        {option}
                                    </Text>
                                    {profile.bloodType === option && (
                                        <Ionicons name="checkmark" size={20} color="#8E24AA" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Edit Modal */}
            <Modal
                visible={editModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit {editingField}</Text>
                            <TouchableOpacity
                                onPress={() => setEditModalVisible(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.editInput}
                            value={editValue}
                            onChangeText={setEditValue}
                            placeholder={`Enter ${editingField}`}
                            keyboardType={
                                editingField.includes('age') || editingField.includes('height') || editingField.includes('weight') || editingField.includes('phone')
                                    ? 'numeric'
                                    : 'default'
                            }
                            multiline={false}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setEditModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleSaveEdit}
                            >
                                <Text style={styles.saveButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Medical Form Modal */}
            <Modal
                visible={medicalFormVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setMedicalFormVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.medicalModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Medical Information</Text>
                            <TouchableOpacity
                                onPress={() => setMedicalFormVisible(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.medicalFormScroll} showsVerticalScrollIndicator={false}>
                            {/* Medical Conditions Section */}
                            <View style={styles.formSection}>
                                <Text style={styles.formSectionTitle}>Medical Conditions</Text>
                                <Text style={styles.formSectionSubtitle}>Select all that apply:</Text>

                                <View style={styles.checkboxContainer}>
                                    {COMMON_CONDITIONS.map((condition) => (
                                        <TouchableOpacity
                                            key={condition}
                                            style={styles.checkboxItem}
                                            onPress={() => toggleCondition(condition)}
                                        >
                                            <Ionicons
                                                name={selectedConditions.includes(condition) ? "checkbox" : "square-outline"}
                                                size={24}
                                                color={selectedConditions.includes(condition) ? "#8E24AA" : "#ccc"}
                                            />
                                            <Text style={styles.checkboxLabel}>{condition}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.customInputLabel}>Add custom condition:</Text>
                                <TextInput
                                    style={styles.customInput}
                                    value={newCondition}
                                    onChangeText={setNewCondition}
                                    placeholder="Enter a medical condition not listed above"
                                    multiline={false}
                                />
                            </View>

                            {/* Allergies Section */}
                            <View style={styles.formSection}>
                                <Text style={styles.formSectionTitle}>Allergies</Text>
                                <Text style={styles.formSectionSubtitle}>Select all that apply:</Text>

                                <View style={styles.checkboxContainer}>
                                    {COMMON_ALLERGIES.map((allergy) => (
                                        <TouchableOpacity
                                            key={allergy}
                                            style={styles.checkboxItem}
                                            onPress={() => toggleAllergy(allergy)}
                                        >
                                            <Ionicons
                                                name={selectedAllergies.includes(allergy) ? "checkbox" : "square-outline"}
                                                size={24}
                                                color={selectedAllergies.includes(allergy) ? "#8E24AA" : "#ccc"}
                                            />
                                            <Text style={styles.checkboxLabel}>{allergy}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.customInputLabel}>Add custom allergy:</Text>
                                <TextInput
                                    style={styles.customInput}
                                    value={newAllergy}
                                    onChangeText={setNewAllergy}
                                    placeholder="Enter an allergy not listed above"
                                    multiline={false}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setMedicalFormVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleSaveMedicalForm}
                            >
                                <Text style={styles.saveButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Settings Modal */}
            <Modal
                visible={settingsModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSettingsModalVisible(false)}
            >
                <View style={styles.settingsModalOverlay}>
                    <TouchableOpacity 
                        style={styles.settingsModalBackdrop}
                        activeOpacity={1}
                        onPress={() => setSettingsModalVisible(false)}
                    />
                    <View style={styles.settingsModalContent}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Settings</Text>
                            <TouchableOpacity
                                onPress={() => setSettingsModalVisible(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.settingsOptions}>
                            <TouchableOpacity
                                style={styles.settingsOption}
                                onPress={() => {
                                    setSettingsModalVisible(false);
                                    setTimeout(() => openPrivacyPolicy(), 100);
                                }}
                            >
                                <View style={styles.settingsOptionContent}>
                                    <Ionicons name="shield-checkmark-outline" size={24} color="#8E24AA" />
                                    <View style={styles.settingsOptionText}>
                                        <Text style={styles.settingsOptionTitle}>Privacy Policy</Text>
                                        <Text style={styles.settingsOptionSubtitle}>How we protect your data</Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.settingsOption}
                                onPress={() => {
                                    setSettingsModalVisible(false);
                                    setTimeout(() => openTermsAndConditions(), 100);
                                }}
                            >
                                <View style={styles.settingsOptionContent}>
                                    <Ionicons name="document-text-outline" size={24} color="#8E24AA" />
                                    <View style={styles.settingsOptionText}>
                                        <Text style={styles.settingsOptionTitle}>Terms & Conditions</Text>
                                        <Text style={styles.settingsOptionSubtitle}>App usage terms</Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.settingsOption}
                                onPress={() => {
                                    setSettingsModalVisible(false);
                                    setTimeout(() => openNotificationSettings(), 100);
                                }}
                            >
                                <View style={styles.settingsOptionContent}>
                                    <Ionicons name="notifications-outline" size={24} color="#8E24AA" />
                                    <View style={styles.settingsOptionText}>
                                        <Text style={styles.settingsOptionTitle}>Notifications</Text>
                                        <Text style={styles.settingsOptionSubtitle}>Manage notification settings</Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.settingsOption}
                                onPress={() => {
                                    setSettingsModalVisible(false);
                                    setTimeout(() => downloadUserData(), 100);
                                }}
                            >
                                <View style={styles.settingsOptionContent}>
                                    <Ionicons name="share-outline" size={24} color="#8E24AA" />
                                    <View style={styles.settingsOptionText}>
                                        <Text style={styles.settingsOptionTitle}>Share Profile Data</Text>
                                        <Text style={styles.settingsOptionSubtitle}>Export and share your medical profile</Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            
            {/* Date Picker */}
            {showDatePicker && (
                <DateTimePicker
                    value={profile.dateOfBirth ? new Date(profile.dateOfBirth) : new Date()}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f9fa",
    },
    header: {
        paddingTop: 50,
        paddingBottom: 25,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerContent: {
        alignItems: "center",
        paddingHorizontal: 20,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 15,
    },
    userName: {
        fontSize: 24,
        fontWeight: "700",
        color: "white",
        marginBottom: 5,
    },
    userAge: {
        fontSize: 16,
        color: "rgba(255, 255, 255, 0.9)",
    },
    content: {
        flex: 1,
        paddingTop: 20,
        paddingBottom: 30,
    },
    profileCard: {
        backgroundColor: "white",
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 20,
        marginBottom: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#333",
        marginBottom: 15,
    },
    fieldContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: "#f0f0f0",
    },
    fieldContent: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    fieldText: {
        marginLeft: 12,
        flex: 1,
    },
    fieldLabel: {
        fontSize: 14,
        color: "#666",
        marginBottom: 2,
    },
    fieldValue: {
        fontSize: 16,
        color: "#333",
        fontWeight: "500",
    },
    bmiContainer: {
        backgroundColor: "#f8f9fa",
        borderRadius: 12,
        padding: 15,
        marginTop: 10,
        alignItems: "center",
    },
    bmiLabel: {
        fontSize: 14,
        color: "#666",
        marginBottom: 5,
    },
    bmiValue: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#333",
    },
    bmiCategory: {
        fontSize: 14,
        fontWeight: "600",
        marginTop: 5,
    },
    medicalSection: {
        marginTop: 5,
    },
    medicalSectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
        marginBottom: 8,
    },
    medicalItem: {
        fontSize: 14,
        color: "#666",
        marginBottom: 4,
        lineHeight: 20,
    },
    emptyText: {
        fontSize: 14,
        color: "#999",
        fontStyle: "italic",
    },
    addButton: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 15,
        paddingVertical: 10,
    },
    addButtonText: {
        color: "#8E24AA",
        fontWeight: "600",
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 20,
        width: width * 0.9,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
    },
    closeButton: {
        padding: 5,
    },
    editInput: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: "row",
        gap: 10,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
    },
    cancelButton: {
        backgroundColor: "#f0f0f0",
    },
    saveButton: {
        backgroundColor: "#8E24AA",
    },
    cancelButtonText: {
        color: "#666",
        fontWeight: "600",
    },
    saveButtonText: {
        color: "white",
        fontWeight: "600",
    },
    // Medical form specific styles
    medicalItemContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    removeButton: {
        padding: 4,
    },
    medicalModalContent: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 20,
        width: width * 0.95,
        maxHeight: "90%",
    },
    medicalFormScroll: {
        maxHeight: 500,
    },
    formSection: {
        marginBottom: 25,
    },
    formSectionTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#333",
        marginBottom: 8,
    },
    formSectionSubtitle: {
        fontSize: 14,
        color: "#666",
        marginBottom: 15,
    },
    checkboxContainer: {
        marginBottom: 15,
    },
    checkboxItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 5,
    },
    checkboxLabel: {
        fontSize: 16,
        color: "#333",
        marginLeft: 12,
        flex: 1,
    },
    customInputLabel: {
        fontSize: 14,
        color: "#666",
        marginBottom: 8,
        fontWeight: "600",
    },
    customInput: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        backgroundColor: "#f9f9f9",
    },
    // Settings styles
    settingsButton: {
        position: 'absolute',
        top: 15,
        right: 20,
        padding: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        zIndex: 1,
    },
    settingsModalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    settingsModalBackdrop: {
        flex: 1,
    },
    settingsModalContent: {
        backgroundColor: "white",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        width: width,
        maxHeight: "70%",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: "#ddd",
        borderRadius: 2,
        alignSelf: "center",
        marginBottom: 15,
        marginTop: -5,
    },
    settingsOptions: {
        marginTop: 10,
        paddingBottom: 20,
    },
    settingsOption: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 18,
        paddingHorizontal: 10,
        marginBottom: 8,
        backgroundColor: "#f8f9fa",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#f0f0f0",
    },
    settingsOptionContent: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    settingsOptionText: {
        marginLeft: 15,
        flex: 1,
    },
    settingsOptionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
        marginBottom: 2,
    },
    settingsOptionSubtitle: {
        fontSize: 14,
        color: "#666",
    },
    // Single-select modal styles
    optionsList: {
        maxHeight: 300,
        marginVertical: 10,
    },
    scrollHint: {
        fontSize: 14,
        color: "#8E24AA",
        textAlign: "center",
        marginBottom: 10,
        fontStyle: "italic",
    },
    optionItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 15,
        paddingHorizontal: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: "#f0f0f0",
    },
    optionItemSelected: {
        backgroundColor: "#f8f0ff",
    },
    optionText: {
        fontSize: 16,
        color: "#333",
        flex: 1,
    },
    optionTextSelected: {
        color: "#8E24AA",
        fontWeight: "600",
    },
});
