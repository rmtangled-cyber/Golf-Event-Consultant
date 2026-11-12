import { Alert, Platform } from 'react-native';

/** Web では window.confirm、ネイティブでは Alert で確認する */
export function confirm(message: string, onOk: () => void, okLabel = 'OK') {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(message)) onOk();
    return;
  }
  Alert.alert('確認', message, [
    { text: 'キャンセル', style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onOk },
  ]);
}
