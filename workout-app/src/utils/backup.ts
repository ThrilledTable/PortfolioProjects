import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { BackupData, isValidBackupData } from '../store/useStore';

export interface ExportResult {
  success: boolean;
  message?: string;
}

export interface ImportResult {
  success: boolean;
  data?: BackupData;
  message?: string;
}

function backupFilename(): string {
  return `workout-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export async function exportBackup(data: BackupData): Promise<ExportResult> {
  const json = JSON.stringify(data, null, 2);

  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') {
      return { success: false, message: 'Export is not available in this environment.' };
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFilename();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { success: true };
  }

  try {
    const file = new File(Paths.cache, backupFilename());
    if (file.exists) file.delete();
    file.create();
    file.write(json);
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Workout Data',
      });
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'Could not export data.' };
  }
}

export async function importBackup(): Promise<ImportResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', base64: false });
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, message: 'Cancelled.' };
    }
    const asset = result.assets[0];

    let text: string;
    if (asset.file) {
      text = await asset.file.text();
    } else if (Platform.OS === 'web') {
      const response = await fetch(asset.uri);
      text = await response.text();
    } else {
      text = await new File(asset.uri).text();
    }

    const parsed = JSON.parse(text);
    if (!isValidBackupData(parsed)) {
      return { success: false, message: 'This file is not a valid backup.' };
    }
    return { success: true, data: parsed };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'Could not read the selected file.' };
  }
}
