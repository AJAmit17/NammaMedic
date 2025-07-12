import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, Alert, AppState } from "react-native";
import { Appbar, PaperProvider, MD3LightTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1a8e2d',
    primaryContainer: '#146922',
    surface: '#1a8e2d',
    onSurface: '#ffffff',
  },
};

interface PaperHeaderProps {
  title: string;
  showBack?: boolean;
}

function PaperHeader({ title, showBack = true }: PaperHeaderProps) {
  const router = useRouter();

  return (
    <View style={{ position: 'relative' }}>
      <LinearGradient
        colors={["#1a8e2d", "#146922"]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 105,
        }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
      <Appbar.Header 
        style={{ 
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
        }}
      >
        {showBack && (
          <Appbar.BackAction 
            onPress={() => router.back()} 
            iconColor="#ffffff"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
          />
        )}
        <Appbar.Content 
          title={title} 
          titleStyle={{ 
            color: '#ffffff', 
            fontSize: 22, 
            fontWeight: '700' 
          }} 
        />
      </Appbar.Header>
    </View>
  );
}

function useNotificationObserver() {
  useEffect(() => {
    let isMounted = true;

    function redirect(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;
      if (url) {
        router.push(url);
      }
    }

    Notifications.getLastNotificationResponseAsync() 
      .then(response => {
        if (!isMounted || !response?.notification) {
          return;
        }
        redirect(response?.notification);
      });

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      redirect(response.notification);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);
}

function useUpdateChecker() {
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const checkForUpdates = async () => {
    if (__DEV__) {
      console.log("Update check skipped in development mode");
      return;
    }

    try {
      setIsCheckingUpdates(true);
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        setUpdateAvailable(true);
        Alert.alert(
          "Update Available",
          "A new version of the app is available. Would you like to update now?",
          [
            {
              text: "Later",
              style: "cancel",
              onPress: () => setUpdateAvailable(false),
            },
            {
              text: "Update",
              onPress: async () => {
                try {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                } catch (error) {
                  console.error("Error updating app:", error);
                  Alert.alert("Update Failed", "Failed to update the app. Please try again later.");
                  setUpdateAvailable(false);
                }
              },
            },
          ]
        );
      } else {
        console.log("No updates available");
      }
    } catch (error) {
      console.error("Error checking for updates:", error);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  useEffect(() => {
    // Check for updates when the app starts
    checkForUpdates();
  }, []);

  return {
    isCheckingUpdates,
    updateAvailable,
    checkForUpdates,
  };
}

export default function Layout() {
  useNotificationObserver();
  useUpdateChecker();

  return (
    <PaperProvider theme={theme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: true,
          contentStyle: { backgroundColor: "white" },
          animation: "slide_from_right",
          navigationBarHidden: true,
          header: ({ options }) => (
            <PaperHeader 
              title={options.title || ""} 
              showBack={options.headerBackVisible !== false}
            />
          ),
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="auth"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="medications/add"
          options={{
            headerShown: true,
            title: "New Medication",
            headerBackVisible: true,
          }}
        />
        <Stack.Screen
          name="refills/index"
          options={{
            headerShown: true,
            title: "Refills",
            headerBackVisible: true,
          }}
        />
        <Stack.Screen
          name="calendar/index"
          options={{
            headerShown: true,
            title: "Calendar",
            headerBackVisible: true,
          }}
        />
        <Stack.Screen
          name="history/index"
          options={{
            headerShown: true,
            title: "History",
            headerBackVisible: true,
          }}
        />
        <Stack.Screen
          name="test"
          options={{
            headerShown: true,
            title: "Widget Test",
            headerBackVisible: true,
          }}
        />
      </Stack>
    </PaperProvider>
  );
}
