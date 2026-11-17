import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { DialogProvider } from './src/components/DialogProvider';

// Safari only reports the notch and home-indicator insets to `env()` once the
// page opts out of the automatic safe-area letterbox, and Expo's generated page
// does not ask for that. Without this the insets all read 0 in the browser and
// every screen sits in a shrunken box with grey bars around it.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const viewport = document.querySelector('meta[name="viewport"]');
  const content = viewport?.getAttribute('content') ?? 'width=device-width, initial-scale=1';
  if (viewport && !content.includes('viewport-fit')) {
    viewport.setAttribute('content', `${content}, viewport-fit=cover`);
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DialogProvider>
          <RootNavigator />
        </DialogProvider>
        <StatusBar style="light" />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
