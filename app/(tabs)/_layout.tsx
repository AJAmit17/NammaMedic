import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#1a8e2d',
                tabBarInactiveTintColor: '#666',
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: 'white',
                    borderTopWidth: 1,
                    borderTopColor: '#e0e0e0',
                    height: 80,
                    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
                    paddingTop: 5,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '600',
                },
                tabBarIconStyle: {
                    marginBottom: 2,
                },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Medicine',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="medical" size={size} color={color} />
                    ),
                }}
            />
            {/* <Tabs.Screen
                name="steps"
                options={{
                    title: 'Steps',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="footsteps" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="water"
                options={{
                    title: 'Water Intake',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="water" size={size} color={color} />
                    ),
                }}
            /> */}
            <Tabs.Screen
                name="health-dashboard"
                options={{
                    title: 'Health',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="analytics" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="doctor"
                options={{
                    title: 'AI Doctor',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="medical-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
