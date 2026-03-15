import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Song } from '../types';

export const scanLocalMusic = async (): Promise<Song[]> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('Not on native platform, skipping local scan');
    return [];
  }

  try {
    // Request permissions first
    const permission = await Filesystem.checkPermissions();
    if (permission.publicStorage !== 'granted') {
      await Filesystem.requestPermissions();
    }

    // We try to scan /MusicApp/songs
    // On Android, this is often in the root of external storage
    const path = 'MusicApp/songs';
    
    try {
      const result = await Filesystem.readdir({
        path: path,
        directory: Directory.ExternalStorage,
      });

      const songs: Song[] = [];

      for (const file of result.files) {
        if (file.name.endsWith('.mp3') || file.name.endsWith('.m4a') || file.name.endsWith('.wav')) {
          const fileUri = await Filesystem.getUri({
            path: `${path}/${file.name}`,
            directory: Directory.ExternalStorage,
          });

          songs.push({
            id: `local-${file.name}`,
            title: file.name.replace(/\.(mp3|m4a|wav)$/, ''),
            artist: 'Local File',
            thumbnail: 'https://picsum.photos/seed/music/200/200',
            url: Capacitor.convertFileSrc(fileUri.uri),
            duration: 0, // We don't know the duration yet
          });
        }
      }

      return songs;
    } catch (e) {
      console.warn('Could not find /MusicApp/songs folder, creating it...');
      try {
        await Filesystem.mkdir({
          path: path,
          directory: Directory.ExternalStorage,
          recursive: true
        });
      } catch (mkdirErr) {
        console.error('Failed to create directory', mkdirErr);
      }
      return [];
    }
  } catch (error) {
    console.error('Error scanning local music:', error);
    return [];
  }
};
