export type SubscriptionType = 'none' | 'plus' | 'pro';

export interface User {
  id: string;
  email: string;
  subscription: SubscriptionType;
  subscriptionEndsAt?: number; // timestamp in ms
  isAdmin?: boolean;
  playlists: Playlist[];
  downloads?: string[]; // Array of song IDs
  defaultVolume?: number;
  aiBoostMode?: 'off' | 'always' | 'manual';
  cleanAudio?: boolean;
  profileColor?: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  url: string;
  duration: number;
  label?: string;
}

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
}
