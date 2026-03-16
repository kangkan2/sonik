export type SubscriptionType = 'none' | 'plus' | 'pro';
export type RedeemCodeType = 'subscription';

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
  isOffline?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
}

export interface RedeemCode {
  id: string;
  code: string;
  type: RedeemCodeType;
  value: string; // plan name
  days?: number; // for subscription
  used: boolean;
  usedBy?: string;
  usedAt?: any;
  createdAt: any;
}
