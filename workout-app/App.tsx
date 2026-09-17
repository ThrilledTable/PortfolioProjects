import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigator from './src/navigation/RootNavigator';
import { DialogProvider } from './src/components/DialogProvider';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DialogProvider>
        <RootNavigator />
      </DialogProvider>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}
