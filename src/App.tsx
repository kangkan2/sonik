/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Library, 
  Settings, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Volume1,
  VolumeX,
  Download,
  Share2,
  Plus,
  User as UserIcon,
  LogOut,
  CreditCard,
  X,
  Shield,
  Trash2,
  Upload,
  RefreshCw,
  Edit2,
  Users,
  MoreVertical,
  ArrowUpCircle,
  ListMusic,
  WifiOff,
  Minimize2,
  Maximize2,
  GripVertical,
  Sparkles,
  Zap,
  Palette,
  AlertTriangle,
  Ticket,
  Github
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import { cn } from './lib/utils';
import { auth, db, storage } from './lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithCredential
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as mm from 'music-metadata-browser';
import { Buffer } from 'buffer';

// Ensure Buffer is available globally for music-metadata-browser
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}

import { User, Song, Playlist, SubscriptionType } from './types';
import { MOCK_SONGS } from './constants';
import { scanLocalMusic } from './lib/offlineMusic';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';

const CountdownTimer = ({ endsAt }: { endsAt: any }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      
      // Handle Firestore Timestamp or other objects
      let targetTime = endsAt;
      if (targetTime && typeof targetTime === 'object' && 'toMillis' in targetTime) {
        targetTime = targetTime.toMillis();
      } else if (typeof targetTime !== 'number') {
        targetTime = Number(targetTime);
      }

      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        clearInterval(timer);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, [endsAt]);

  return <span className="font-mono text-emerald-500">{timeLeft}</span>;
};

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 1, delay: 2.5 }}
      onAnimationComplete={onComplete}
      className="fixed inset-0 z-[1000] bg-black flex items-center justify-center overflow-hidden"
    >
      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: [0.5, 1.2, 1], opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="relative"
        >
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter text-netflix-red relative">
            SONIK
            <span className="absolute -top-2 -right-6 text-xs md:text-sm font-bold">TM</span>
          </h1>
          
          {/* Netflix-like "N" beam effect simulation */}
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: '100%' }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="absolute left-0 top-0 w-2 bg-gradient-to-b from-transparent via-red-600 to-transparent opacity-50"
          />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-8 flex items-center gap-2 text-zinc-500 font-medium tracking-widest text-xs uppercase"
        >
          <Sparkles size={14} className="text-netflix-red" />
          Powered by AI
        </motion.div>
      </div>
      
      {/* Background light pulse */}
      <motion.div 
        animate={{ 
          scale: [1, 1.5, 1],
          opacity: [0.1, 0.2, 0.1]
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 bg-netflix-red/5 rounded-full blur-[120px]"
      />
    </motion.div>
  );
};

// --- Components ---

const Sidebar = ({ user, onLogout }: { user: User | null; onLogout: () => void }) => {
  const location = useLocation();
  
  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: Library, label: 'Your Library', path: '/library' },
  ];

  return (
    <div className="hidden md:flex flex-col w-64 bg-black h-screen sticky top-0 border-r border-white/10 p-6">
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 bg-netflix-red rounded-full flex items-center justify-center">
          <span className="font-bold text-xl">S</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tighter text-netflix-red flex items-start">
          SONIK
          <span className="text-[8px] font-bold ml-0.5 mt-1">TM</span>
        </h1>
      </div>

      <nav className="space-y-4 flex-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-4 text-sm font-medium transition-colors hover:text-white",
              location.pathname === item.path ? "text-white" : "text-zinc-400"
            )}
          >
            <item.icon size={22} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-white/10 space-y-4">
        <Link to="/settings" className="flex items-center gap-4 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
          <Settings size={22} />
          Settings
        </Link>
        {user?.isAdmin && (
          <Link to="/admin" className="flex items-center gap-4 text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors">
            <Shield size={22} />
            Admin Panel
          </Link>
        )}
        {user && (
          <button 
            onClick={onLogout}
            className="flex items-center gap-4 text-sm font-medium text-zinc-400 hover:text-netflix-red transition-colors w-full text-left"
          >
            <LogOut size={22} />
            Logout
          </button>
        )}
      </div>
    </div>
  );
};

const MobileHeader = ({ user }: { user: User | null }) => {
  return (
    <div className="md:hidden flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur-md sticky top-0 z-40 border-b border-white/5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-netflix-red rounded-full flex items-center justify-center">
          <span className="font-bold text-xl">S</span>
        </div>
        <h1 className="text-xl font-bold tracking-tighter text-netflix-red flex items-start">
          SONIK
          <span className="text-[6px] font-bold ml-0.5 mt-0.5">TM</span>
        </h1>
      </div>
      <Link to="/settings">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg border border-white/10"
          style={{ backgroundColor: user?.profileColor || '#E50914' }}
        >
          {user?.email[0].toUpperCase()}
        </div>
      </Link>
    </div>
  );
};

const MobileNav = () => {
  const location = useLocation();
  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: Library, label: 'Library', path: '/library' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-lg border-t border-white/10 px-6 py-3 flex justify-between items-center z-50">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            location.pathname === item.path ? "text-netflix-red" : "text-zinc-500"
          )}
        >
          <item.icon size={20} />
          <span className="text-[10px] font-medium uppercase tracking-widest">{item.label}</span>
        </Link>
      ))}
    </div>
  );
};

const MarqueeText = ({ text, className }: { text: string; className?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldMarquee, setShouldMarquee] = useState(false);

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      setShouldMarquee(textRef.current.offsetWidth > containerRef.current.offsetWidth);
    }
  }, [text]);

  return (
    <div ref={containerRef} className={cn("marquee-container", className)}>
      <span 
        ref={textRef} 
        className={cn(
          "inline-block whitespace-nowrap",
          shouldMarquee && "animate-marquee"
        )}
        style={shouldMarquee ? { '--duration': `${text.length * 0.2}s` } as React.CSSProperties : {}}
      >
        {text}
      </span>
      {shouldMarquee && (
        <span 
          className="inline-block whitespace-nowrap animate-marquee ml-4"
          style={{ '--duration': `${text.length * 0.2}s` } as React.CSSProperties}
        >
          {text}
        </span>
      )}
    </div>
  );
};

const Player = ({ 
  currentSong, 
  isPlaying, 
  onTogglePlay, 
  onNext, 
  onPrev,
  onClose,
  onDownload,
  onDelete,
  onAddToPlaylist,
  user
}: { 
  currentSong: Song | null; 
  isPlaying: boolean; 
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onDownload: (song: Song) => void;
  onDelete: (id: string) => void;
  onAddToPlaylist: (song: Song) => void;
  user: User | null;
}) => {
  const [volume, setVolume] = useState(user?.defaultVolume || 0.5);
  const [boost, setBoost] = useState(user?.aiBoostMode === 'always' ? 2.5 : 1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMini, setIsMini] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const highShelfRef = useRef<BiquadFilterNode | null>(null);
  const lowCutRef = useRef<BiquadFilterNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const isPro = user?.subscription === 'pro';
  const isPlus = user?.subscription === 'plus';
  const isSubscribed = user?.subscription !== 'none' && user?.subscriptionEndsAt && user.subscriptionEndsAt > Date.now();

  const [showAd, setShowAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);

  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: 'Sonik Music',
        artwork: [
          { src: currentSong.thumbnail, sizes: '96x96', type: 'image/png' },
          { src: currentSong.thumbnail, sizes: '128x128', type: 'image/png' },
          { src: currentSong.thumbnail, sizes: '192x192', type: 'image/png' },
          { src: currentSong.thumbnail, sizes: '256x256', type: 'image/png' },
          { src: currentSong.thumbnail, sizes: '384x384', type: 'image/png' },
          { src: currentSong.thumbnail, sizes: '512x512', type: 'image/png' },
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => onTogglePlay());
      navigator.mediaSession.setActionHandler('pause', () => onTogglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => onPrev());
      navigator.mediaSession.setActionHandler('nexttrack', () => onNext());
      
      // Update playback state
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [currentSong, isPlaying, onTogglePlay, onNext, onPrev]);

  useEffect(() => {
    if (currentSong && isPlus && !isPro) {
      setShowAd(true);
      setAdCountdown(5);
      const timer = setInterval(() => {
        setAdCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setShowAd(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentSong?.id, isPlus, isPro]);

  useEffect(() => {
    if (user?.defaultVolume !== undefined) {
      setVolume(user.defaultVolume);
    }
  }, [user?.defaultVolume]);

  useEffect(() => {
    if (user?.aiBoostMode === 'always') {
      setBoost(2.5);
    } else if (user?.aiBoostMode === 'off') {
      setBoost(1.0);
    }
  }, [user?.aiBoostMode]);

  useEffect(() => {
    if (audioRef.current && !audioCtxRef.current) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
        gainNodeRef.current = audioCtxRef.current.createGain();
        
        // High-shelf for clarity
        highShelfRef.current = audioCtxRef.current.createBiquadFilter();
        highShelfRef.current.type = 'highshelf';
        highShelfRef.current.frequency.value = 3000;
        highShelfRef.current.gain.value = user?.cleanAudio ? 8 : 0;

        // Low-cut for rumble/noise reduction
        lowCutRef.current = audioCtxRef.current.createBiquadFilter();
        lowCutRef.current.type = 'highpass';
        lowCutRef.current.frequency.value = 100;
        // We only enable low-cut if cleanAudio is on
        // Note: highpass doesn't have a gain property that works like highshelf
        // We will bypass it by setting frequency to 0 if cleanAudio is off

        sourceRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
        
        sourceRef.current.connect(lowCutRef.current);
        lowCutRef.current.connect(highShelfRef.current);
        highShelfRef.current.connect(gainNodeRef.current);
        gainNodeRef.current.connect(audioCtxRef.current.destination);
      } catch (e) {
        console.error("Web Audio API not supported", e);
      }
    }
  }, []);

  useEffect(() => {
    if (highShelfRef.current && lowCutRef.current) {
      highShelfRef.current.gain.value = user?.cleanAudio ? 8 : 0;
      lowCutRef.current.frequency.value = user?.cleanAudio ? 100 : 0;
    }
  }, [user?.cleanAudio]);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : volume * boost;
    }
    // Fallback for browsers without Web Audio or if it fails
    if (audioRef.current && !audioCtxRef.current) {
      audioRef.current.volume = isMuted ? 0 : Math.min(volume, 1.0);
    }
  }, [volume, boost, isMuted]);

  useEffect(() => {
    if (audioCtxRef.current && isPlaying && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, [isPlaying]);

  useEffect(() => {
    const loadAudio = async () => {
      if (currentSong && audioRef.current) {
        try {
          // Reset progress and audio state to prevent race condition with playAudio
          setProgress(0);
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
          
          // 1. Check if song is in offline cache (Web/PWA)
          const cache = await caches.open('sonik-offline-songs');
          const cachedResponse = await cache.match(currentSong.url);
          
          if (cachedResponse) {
            const blob = await cachedResponse.blob();
            const blobUrl = URL.createObjectURL(blob);
            audioRef.current.src = blobUrl;
            console.log("Playing from offline cache:", currentSong.title);
          } 
          // 2. Check native filesystem (Android/Capacitor)
          else if (Capacitor.isNativePlatform()) {
            try {
              const fileName = `MusicApp/songs/${currentSong.id}.mp3`;
              const file = await Filesystem.readFile({
                path: fileName,
                directory: Directory.ExternalStorage
              });
              // Convert base64 to blob URL for better performance/compatibility
              const blobUrl = `data:audio/mpeg;base64,${file.data}`;
              audioRef.current.src = blobUrl;
              console.log("Playing from native filesystem:", currentSong.title);
            } catch (fsErr) {
              console.log("Not found in native filesystem, playing from URL");
              audioRef.current.src = currentSong.url;
            }
          }
          // 3. Fallback to remote URL
          else {
            audioRef.current.src = currentSong.url;
          }

          // Force load the new source
          audioRef.current.load();

          // We don't call play() here anymore, the isPlaying effect will handle it
          // once the source is loaded and isPlaying is true.
        } catch (error) {
          console.error("Error loading audio:", error);
          audioRef.current.src = currentSong.url;
          audioRef.current.load();
        }
      }
    };

    loadAudio();
    
    // Cleanup blob URLs to prevent memory leaks
    return () => {
      if (audioRef.current?.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, [currentSong]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        // Use a small delay to ensure the src is set and loaded
        const playAudio = () => {
          const playPromise = audioRef.current?.play();
          if (playPromise !== undefined) {
            playPromise.catch(e => {
              if (e.name !== 'AbortError') {
                console.error("Playback failed:", e.message);
                // If it fails, try to load again and play
                audioRef.current?.load();
              }
            });
          }
        };

        if (audioRef.current.readyState >= 2) {
          playAudio();
        } else {
          audioRef.current.oncanplay = () => {
            playAudio();
            if (audioRef.current) audioRef.current.oncanplay = null;
          };
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSong]);

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(isNaN(p) ? 0 : p);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const duration = audioRef.current?.duration || 0;
    const seekTime = (val / 100) * duration;
    if (audioRef.current && !isNaN(seekTime)) {
      audioRef.current.currentTime = seekTime;
      setProgress(val);
    }
  };

  if (!currentSong) return null;

  return (
    <motion.div 
      layout
      drag={isMini}
      dragConstraints={{ left: 0, right: window.innerWidth - 300, top: 0, bottom: window.innerHeight - 100 }}
      dragElastic={0.1}
      dragMomentum={false}
      initial={false}
      className={cn(
        "fixed z-50 transition-all duration-300",
        isMini 
          ? "w-[280px] h-[80px] bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2 cursor-move right-4 bottom-20 md:bottom-4" 
          : "bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-xl border-t border-white/5 px-4 py-3 md:px-6 md:py-4 mb-[60px] md:mb-0"
      )}
    >
      {/* 
        Note: In this web-based Android app, the <audio> element serves as the MediaPlayer.
        When running on Android via Capacitor, this uses the native media stack.
      */}
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate} 
        onEnded={onNext}
        onError={(e) => {
          const target = e.target as HTMLAudioElement;
          console.error("Audio Error:", target.error);
          if (target.error?.code === 4) {
            toast.error("Format not supported or link expired. Try refreshing.");
          }
        }}
        preload="auto"
      />
      
      {isMini ? (
        <div className="flex items-center gap-3 h-full relative group">
          <div className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="p-1 bg-zinc-800 rounded-full cursor-grab active:cursor-grabbing">
              <GripVertical size={12} className="text-zinc-500" />
            </div>
          </div>
          
          <img 
            src={currentSong.thumbnail} 
            alt={currentSong.title} 
            className="w-12 h-12 rounded-lg object-cover shadow-lg flex-shrink-0"
            referrerPolicy="no-referrer"
          />
          
          <div className="flex-1 min-w-0">
            <MarqueeText text={currentSong.title} className="text-xs font-semibold pr-6" />
            <p className="text-[10px] text-zinc-400 truncate">{currentSong.artist}</p>
            <div className="flex items-center gap-3 mt-1">
              <button onClick={onPrev} className="text-zinc-400 hover:text-white transition-colors">
                <SkipBack size={14} fill="currentColor" />
              </button>
              <button 
                onClick={onTogglePlay}
                className="w-6 h-6 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform"
              >
                {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
              </button>
              <button onClick={onNext} className="text-zinc-400 hover:text-white transition-colors">
                <SkipForward size={14} fill="currentColor" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {isPro && (
              <button 
                onClick={() => {
                  if (user?.aiBoostMode === 'off') {
                    toast.error("AI Boost is disabled in settings");
                    return;
                  }
                  setBoost(boost === 1 ? 2.5 : 1);
                }}
                disabled={user?.aiBoostMode === 'off'}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  boost > 1 ? "text-amber-400 bg-amber-400/10" : "text-zinc-500 hover:text-white",
                  user?.aiBoostMode === 'off' && "opacity-20 cursor-not-allowed"
                )}
                title={user?.aiBoostMode === 'off' ? "AI Boost Disabled" : `AI Boost: ${Math.round(boost * 100)}%`}
              >
                <Zap size={14} fill={boost > 1 ? "currentColor" : "none"} />
              </button>
            )}
            {isPlus && !isPro && (
              <button 
                onClick={() => toast.error("AI Boost is a Pro feature!")}
                className="p-1.5 rounded-lg text-zinc-500/50 cursor-not-allowed"
                title="Pro Feature"
              >
                <Zap size={14} />
              </button>
            )}
            <button 
              onClick={() => setIsMini(false)}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              title="Expand"
            >
              <Maximize2 size={14} />
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-netflix-red hover:bg-red-500/10 rounded-lg transition-all"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-netflix-red transition-all duration-100" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Mobile Music Timeline (Main Timeline at Top - Always Visible) */}
          <div className="md:hidden absolute top-0 left-0 right-0 h-[4px] bg-zinc-800">
            <input 
              type="range" 
              min="0" 
              max="100"
              value={isNaN(progress) ? 0 : progress} 
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div 
              className="h-full bg-netflix-red transition-all duration-100" 
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Mobile Top Row: Playtime & Close Button */}
          <div className="flex md:hidden items-center justify-between px-2 mb-1.5">
            <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-full">
              <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                <span className="text-white/80">
                  {Math.floor((audioRef.current?.currentTime || 0) / 60)}:
                  {String(Math.floor((audioRef.current?.currentTime || 0) % 60)).padStart(2, '0')}
                </span>
                <span className="opacity-30">/</span>
                <span>
                  {Math.floor((audioRef.current?.duration && !isNaN(audioRef.current.duration) ? audioRef.current.duration : 0) / 60)}:
                  {String(Math.floor((audioRef.current?.duration && !isNaN(audioRef.current.duration) ? audioRef.current.duration : 0) % 60)).padStart(2, '0')}
                </span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-90"
              title="Close Player"
            >
              <X size={14} />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            {/* Song Info */}
            <div className="flex flex-col w-full md:w-1/3">
              <div className="flex items-center gap-3 w-full">
                <img 
                  src={currentSong.thumbnail} 
                  alt={currentSong.title} 
                  className="w-10 h-10 md:w-12 md:h-12 rounded object-cover shadow-lg"
                  referrerPolicy="no-referrer"
                />
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center gap-2">
                    <MarqueeText text={currentSong.title} className="text-xs md:text-sm font-semibold flex-1" />
                    {user?.downloads?.includes(currentSong.id) && (
                      <WifiOff size={12} className="text-emerald-500 flex-shrink-0" title="Playing offline" />
                    )}
                  </div>
                  <p className="text-[10px] md:text-xs text-zinc-400 truncate">{currentSong.artist}</p>
                </div>
                
                {/* Mobile Only Main Controls - Play/Next/Save Buttons */}
                <div className="flex md:hidden items-center gap-1">
                  <button 
                    onClick={() => onAddToPlaylist(currentSong)}
                    className="p-2 text-zinc-400 hover:text-white"
                    title="Save to Playlist"
                  >
                    <Plus size={20} />
                  </button>
                  <button 
                    onClick={onTogglePlay}
                    className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-lg mx-1"
                  >
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                  </button>
                  <button onClick={onNext} className="text-zinc-400 p-2">
                    <SkipForward size={20} fill="currentColor" />
                  </button>
                </div>
              </div>

              {/* Mobile Volume Scrubber (Replacing buttons below timeline) */}
              <div className="md:hidden flex flex-col gap-1 mt-3 px-1">
                <div className="relative flex items-center h-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="2.5" 
                    step="0.01"
                    value={volume} 
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                  <div 
                    className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-zinc-500 bg-black/50 px-1 rounded pointer-events-none"
                  >
                    Volume: {Math.round(volume * 100)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Controls */}
            <div className="hidden md:flex flex-col items-center gap-2 flex-1">
              <div className="flex items-center gap-6">
                <button onClick={onPrev} className="text-zinc-400 hover:text-white transition-colors">
                  <SkipBack size={20} fill="currentColor" />
                </button>
                <button 
                  onClick={onTogglePlay}
                  className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                >
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                </button>
                <button onClick={onNext} className="text-zinc-400 hover:text-white transition-colors">
                  <SkipForward size={20} fill="currentColor" />
                </button>
                <button 
                  onClick={() => onAddToPlaylist(currentSong)}
                  className="text-zinc-400 hover:text-white transition-colors"
                  title="Add to Playlist"
                >
                  <Plus size={20} />
                </button>
              </div>
              
              <div className="hidden md:flex items-center gap-2 w-full max-w-md">
                <span className="text-[10px] text-zinc-500 w-8 text-right">
                  {Math.floor((audioRef.current?.currentTime || 0) / 60)}:
                  {String(Math.floor((audioRef.current?.currentTime || 0) % 60)).padStart(2, '0')}
                </span>
                <input 
                  type="range" 
                  value={isNaN(progress) ? 0 : progress} 
                  onChange={handleSeek}
                  className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-netflix-red"
                />
                <span className="text-[10px] text-zinc-500 w-8">
                  {Math.floor((audioRef.current?.duration && !isNaN(audioRef.current.duration) ? audioRef.current.duration : 0) / 60)}:
                  {String(Math.floor((audioRef.current?.duration && !isNaN(audioRef.current.duration) ? audioRef.current.duration : 0) % 60)).padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* Desktop Extra Controls */}
            <div className="hidden md:flex items-center justify-end gap-4 w-1/3">
              <div className="hidden md:flex items-center gap-2">
                <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-400 hover:text-white">
                  {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={volume} 
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-20 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>
              
              <div className="flex items-center gap-1 bg-zinc-800/50 rounded-full px-2 py-1 border border-white/5">
                <button 
                  onClick={() => {
                    if (!isPro) {
                      toast.error("AI Sound Boost is a Pro feature!");
                      return;
                    }
                    if (user?.aiBoostMode === 'off') {
                      toast.error("AI Boost is disabled in settings");
                      return;
                    }
                    setBoost(boost === 1 ? 2.5 : 1);
                    if (boost === 1) toast.success("AI Sound Boost Activated (250%)!");
                  }}
                  disabled={user?.aiBoostMode === 'off'}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all",
                    boost > 1 
                      ? "bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.5)]" 
                      : (isPlus && !isPro) ? "text-zinc-500/50 cursor-not-allowed" : "text-zinc-400 hover:text-white",
                    user?.aiBoostMode === 'off' && "opacity-20 cursor-not-allowed"
                  )}
                  title={(isPlus && !isPro) ? "Pro Feature" : ""}
                >
                  <Sparkles size={12} className={cn(boost > 1 && "animate-pulse")} />
                  {boost > 1 ? "250% BOOST" : (isPlus && !isPro) ? "PRO ONLY" : "AI BOOST"}
                </button>
              </div>

              <button 
                onClick={() => setIsMini(true)}
                className="text-zinc-400 hover:text-white transition-colors"
                title="Mini Player"
              >
                <Minimize2 size={18} />
              </button>

              <div className="relative">
                <button 
                  onClick={() => setShowMenu(!showMenu)}
                  className="text-zinc-400 hover:text-white transition-colors"
                  title="More Options"
                >
                  <MoreVertical size={18} />
                </button>

                <AnimatePresence>
                  {showMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full right-0 mb-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 text-xs text-zinc-500 uppercase font-bold border-b border-white/5">Options</div>
                      <button 
                        onClick={() => {
                          toast.success('Added to queue');
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-white hover:bg-white/5 transition-colors"
                      >
                        <ListMusic size={16} />
                        Add to Queue
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={onClose}
                className="text-zinc-400 hover:text-netflix-red transition-colors ml-2"
                title="Close Player"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const SubscriptionModal = ({ 
  user, 
  onLogout, 
  onRefresh, 
  onUpdateSub 
}: { 
  user: User; 
  onLogout: () => void; 
  onRefresh: () => Promise<void>;
  onUpdateSub: (type: SubscriptionType, endsAt?: number) => void;
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'plus' | 'pro'>('pro');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [confirmRedeem, setConfirmRedeem] = useState<{ planType: SubscriptionType; newEndsAt: number; codeDocId: string } | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
    toast.success('Status updated!');
  };

  const executeRedeem = async (planType: SubscriptionType, newEndsAt: number, codeDocId: string) => {
    setIsRedeeming(true);
    try {
      await updateDoc(doc(db, 'redeem_codes', codeDocId), {
        used: true,
        usedBy: user.id,
        usedAt: serverTimestamp()
      });

      onUpdateSub(planType, newEndsAt);
      setRedeemCode('');
      toast.success('Subscription activated!');
      setShowRedeem(false);
      setConfirmRedeem(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to redeem code');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return toast.error('Please enter a code');
    
    setIsRedeeming(true);
    try {
      const q = query(collection(db, 'redeem_codes'), where('code', '==', redeemCode.trim()), where('used', '==', false));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('Invalid or already used code');
      }

      const codeDoc = querySnapshot.docs[0];
      const codeData = codeDoc.data();
      
      const planType = (codeData.value as SubscriptionType) || 'plus';
      const daysToAdd = codeData.days || 30;

      // Plan checks
      const isProActive = user.subscription === 'pro' && typeof user.subscriptionEndsAt === 'number' && user.subscriptionEndsAt > Date.now();
      const isPlusActive = user.subscription === 'plus' && typeof user.subscriptionEndsAt === 'number' && user.subscriptionEndsAt > Date.now();

      if (isProActive && planType === 'plus') {
        throw new Error("This code cannot be added now because a Pro plan is currently running.");
      }
      
      if (isPlusActive && planType === 'pro') {
        throw new Error("This code cannot be added now because a Plus plan is currently running. Only Plus codes can extend your current plan.");
      }
      
      const currentEndsAt = typeof user.subscriptionEndsAt === 'number' && user.subscriptionEndsAt > Date.now() 
        ? user.subscriptionEndsAt 
        : Date.now();
      
      let newEndsAt = currentEndsAt + (Number(daysToAdd) * 24 * 60 * 60 * 1000);

      // Safety cap: Don't allow more than 10 years
      const tenYearsFromNow = Date.now() + (10 * 365 * 24 * 60 * 60 * 1000);
      if (newEndsAt > tenYearsFromNow) {
        newEndsAt = Date.now() + (Number(daysToAdd) * 24 * 60 * 60 * 1000);
      }

      await executeRedeem(planType, newEndsAt, codeDoc.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to redeem code');
      setIsRedeeming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-2xl w-full shadow-2xl"
      >
        <h2 className="text-3xl font-bold text-center mb-2">Subscription Required</h2>
        <p className="text-zinc-400 text-center mb-8">Unlock the full Sonik experience with a redeem code</p>
        
        {!showRedeem ? (
          <>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Plus Plan */}
              <motion.div 
                onClick={() => setSelectedPlan('plus')}
                animate={{ 
                  y: selectedPlan === 'plus' ? [0, -12, 0] : [0, -6, 0],
                  x: selectedPlan === 'plus' ? [0, 4, -4, 0] : 0,
                  rotate: selectedPlan === 'plus' ? [0, 1, -1, 0] : 0,
                  boxShadow: selectedPlan === 'plus' ? [
                    "0 0 20px rgba(229,9,20,0.1)",
                    "0 0 35px rgba(229,9,20,0.3)",
                    "0 0 20px rgba(229,9,20,0.1)"
                  ] : "none"
                }}
                transition={{ 
                  duration: selectedPlan === 'plus' ? 6 : 5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                whileHover={{ scale: 1.05, translateY: -8 }}
                whileTap={{ 
                  scale: 0.95, 
                  x: [0, -6, 6, -6, 6, 0],
                  rotate: [0, -2, 2, -2, 2, 0]
                }}
                className={cn(
                  "rounded-xl p-6 flex flex-col relative overflow-hidden cursor-pointer group transition-all duration-500",
                  selectedPlan === 'plus' 
                    ? "bg-netflix-red/10 border border-netflix-red/50 shadow-[0_0_20px_rgba(229,9,20,0.1)]" 
                    : "bg-zinc-800/50 border border-white/5 hover:border-white/20"
                )}
              >
                {selectedPlan === 'plus' && (
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 pointer-events-none"
                  />
                )}
                <div className="mb-4">
                  <motion.h3 
                    animate={selectedPlan === 'plus' ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="text-2xl font-black mb-2"
                  >
                    Plus
                  </motion.h3>
                  <p className="text-sm text-zinc-400">Essential features for casual listeners.</p>
                </div>
                <div className="mt-auto space-y-2">
                  <div className="flex items-center gap-2 text-sm"><div className="w-1.5 h-1.5 rounded-full bg-netflix-red" /> Playback with ads</div>
                  <div className="flex items-center gap-2 text-sm"><div className="w-1.5 h-1.5 rounded-full bg-netflix-red" /> 1 Playlist limit</div>
                  <div className="flex items-center gap-2 text-sm opacity-50"><div className="w-1.5 h-1.5 rounded-full bg-zinc-600" /> No AI features</div>
                </div>
              </motion.div>

              {/* Pro Plan */}
              <motion.div 
                onClick={() => setSelectedPlan('pro')}
                animate={{ 
                  y: selectedPlan === 'pro' ? [0, -12, 0] : [0, -6, 0],
                  x: selectedPlan === 'pro' ? [0, 4, -4, 0] : 0,
                  rotate: selectedPlan === 'pro' ? [0, 1, -1, 0] : 0,
                  boxShadow: selectedPlan === 'pro' ? [
                    "0 0 20px rgba(16,185,129,0.1)",
                    "0 0 35px rgba(16,185,129,0.3)",
                    "0 0 20px rgba(16,185,129,0.1)"
                  ] : "none"
                }}
                transition={{ 
                  duration: selectedPlan === 'pro' ? 6 : 5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                whileHover={{ scale: 1.05, translateY: -8 }}
                whileTap={{ 
                  scale: 0.95, 
                  x: [0, -6, 6, -6, 6, 0],
                  rotate: [0, -2, 2, -2, 2, 0]
                }}
                className={cn(
                  "rounded-xl p-6 flex flex-col relative overflow-hidden cursor-pointer group transition-all duration-500",
                  selectedPlan === 'pro' 
                    ? "bg-emerald-500/10 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]" 
                    : "bg-zinc-800/50 border border-white/5 hover:border-white/20"
                )}
              >
                {selectedPlan === 'pro' && (
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 pointer-events-none"
                  />
                )}
                <div className="mb-4">
                  <motion.h3 
                    animate={selectedPlan === 'pro' ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="text-2xl font-black mb-2"
                  >
                    Pro
                  </motion.h3>
                  <p className="text-sm text-zinc-400">The ultimate high-fidelity experience.</p>
                </div>
                <div className="mt-auto space-y-2">
                  <div className="flex items-center gap-2 text-sm"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ad-free playback</div>
                  <div className="flex items-center gap-2 text-sm"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 12 Playlist limit</div>
                  <div className="flex items-center gap-2 text-sm"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Unlimited HD Sound</div>
                  <div className="flex items-center gap-2 text-sm"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Full AI Features</div>
                </div>
              </motion.div>
            </div>

            <button 
              onClick={() => setShowRedeem(true)}
              className="w-full mt-8 bg-white text-black py-4 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
            >
              Activate Subscription
            </button>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full mt-2 text-zinc-400 hover:text-white text-sm flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
              {isRefreshing ? 'Refreshing Status...' : 'Already redeemed? Refresh'}
            </button>
          </>
        ) : (
          <div className="space-y-6">
            <div className="bg-zinc-800/50 border border-white/5 rounded-xl p-6">
              <h3 className="text-lg font-bold mb-2">Enter Redeem Code</h3>
              <p className="text-sm text-zinc-400 mb-4">Enter your 12-character code to activate {selectedPlan.toUpperCase()} plan.</p>
              <input 
                autoFocus
                type="text" 
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-netflix-red transition-colors font-mono text-center text-xl tracking-widest"
              />
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowRedeem(false)}
                className="flex-1 py-4 bg-zinc-800 text-white font-bold rounded-xl hover:bg-zinc-700 transition-colors"
              >
                Back
              </button>
              <button 
                onClick={handleRedeem}
                disabled={isRedeeming}
                className="flex-[2] py-4 bg-netflix-red text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isRedeeming ? 'Activating...' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        )}
        
        <button onClick={onLogout} className="w-full mt-6 text-zinc-500 hover:text-white text-xs uppercase tracking-widest font-bold">Logout Account</button>
      </motion.div>
    </div>
  );
};

const MoveSongModal = ({ 
  song, 
  maxPos, 
  onClose, 
  onMove 
}: { 
  song: Song; 
  maxPos: number; 
  onClose: () => void; 
  onMove: (pos: number) => void; 
}) => {
  const [pos, setPos] = useState('');
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4">Move Song</h2>
        <p className="text-zinc-400 mb-4 text-sm">Move "{song.title}" to position (1-{maxPos}):</p>
        <input 
          type="number"
          min="1"
          max={maxPos}
          value={pos}
          onChange={(e) => setPos(e.target.value)}
          className="w-full bg-zinc-800 border border-white/10 rounded-lg p-3 text-white mb-4"
          placeholder="Enter position"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 bg-zinc-800 py-2 rounded-lg text-sm font-bold">Cancel</button>
          <button onClick={() => {
            const p = parseInt(pos);
            if (p >= 1 && p <= maxPos) {
              onMove(p);
              onClose();
            }
          }} className="flex-1 bg-emerald-500 py-2 rounded-lg text-sm font-bold text-black">Move</button>
        </div>
      </div>
    </div>
  );
};

// --- Pages ---

const PROFILE_COLORS = [
  '#E50914', '#1DB954', '#00A8E1', '#FF9900', '#7289DA', 
  '#FF0000', '#0077B5', '#FF4500', '#1DA1F2', '#9146FF',
  '#F472B6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'
];

const getRandomProfileColor = () => PROFILE_COLORS[Math.floor(Math.random() * PROFILE_COLORS.length)];

const LoginPage = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill all fields');
    
    setLoading(true);
    try {
      let userCredential;
      if (isRegister) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      const firebaseUser = userCredential.user;
      
      // Sync with Firestore
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      let userData: User;
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        userData = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          subscription: data.subscription || 'none',
          playlists: data.playlists || [],
          defaultVolume: data.defaultVolume ?? 0.5,
          aiBoostMode: data.aiBoostMode || 'manual',
          cleanAudio: data.cleanAudio ?? false,
          profileColor: data.profileColor || getRandomProfileColor()
        };
      } else {
        userData = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          subscription: 'none',
          playlists: [],
          defaultVolume: 0.5,
          aiBoostMode: 'manual',
          cleanAudio: false,
          profileColor: getRandomProfileColor()
        };
        await setDoc(userDocRef, {
          email: userData.email,
          subscription: userData.subscription,
          playlists: userData.playlists,
          defaultVolume: userData.defaultVolume,
          aiBoostMode: userData.aiBoostMode,
          cleanAudio: userData.cleanAudio,
          profileColor: userData.profileColor,
          createdAt: serverTimestamp()
        });
      }
      
      onLogin(userData);
      toast.success(isRegister ? 'Account created!' : 'Welcome back!');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('Email/Password sign-in is not enabled in Firebase Console. Please enable it in Authentication > Sign-in method.');
      } else {
        toast.error(error.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSignIn = async () => {
    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor Browser for native platforms
        // Use VITE_APP_URL if available, otherwise fallback to the current origin or a default
        const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
        const authUrl = `${baseUrl}/api/auth/github`;
        await Browser.open({ url: authUrl, windowName: '_self' });
      } else {
        // Web fallback
        const provider = new GithubAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        const firebaseUser = userCredential.user;
        await syncUserWithFirestore(firebaseUser);
        toast.success('Signed in with GitHub!');
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('GitHub sign-in is not enabled in Firebase Console. Please enable it in Authentication > Sign-in method.');
      } else if (error.code !== 'auth/popup-closed-by-user') {
        toast.error(error.message || 'GitHub Sign-In failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // Native In-App Google Sign-in using @capawesome/capacitor-google-sign-in
        // Ensure you have your Web Client ID from Firebase Console (Settings > General > Your apps)
        const webClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com";
        
        // Initialize the plugin first (required by this version)
        await GoogleSignIn.initialize({ clientId: webClientId });
        
        const result = await GoogleSignIn.signIn();
        const idToken = result.idToken;
        
        if (!idToken) {
          throw new Error('No ID Token received from Google Sign-In');
        }

        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        const firebaseUser = userCredential.user;
        
        await syncUserWithFirestore(firebaseUser);
      } else {
        // Web fallback
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        const firebaseUser = userCredential.user;
        
        await syncUserWithFirestore(firebaseUser);
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('Google sign-in is not enabled in Firebase Console. Please enable it in Authentication > Sign-in method.');
      } else if (error.code !== 'auth/popup-closed-by-user') {
        toast.error(error.message || 'Google Sign-In failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const syncUserWithFirestore = async (firebaseUser: any) => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    let userData: User;
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      userData = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        subscription: data.subscription || 'none',
        playlists: data.playlists || [],
        defaultVolume: data.defaultVolume ?? 0.5,
        aiBoostMode: data.aiBoostMode || 'manual',
        cleanAudio: data.cleanAudio ?? false,
        profileColor: data.profileColor || getRandomProfileColor()
      };
    } else {
      userData = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        subscription: 'none',
        playlists: [],
        defaultVolume: 0.5,
        aiBoostMode: 'manual',
        cleanAudio: false,
        profileColor: getRandomProfileColor()
      };
      await setDoc(userDocRef, {
        email: userData.email,
        subscription: userData.subscription,
        playlists: userData.playlists,
        defaultVolume: userData.defaultVolume,
        aiBoostMode: userData.aiBoostMode,
        cleanAudio: userData.cleanAudio,
        profileColor: userData.profileColor,
        createdAt: serverTimestamp()
      });
    }
    
    onLogin(userData);
    toast.success('Signed in with Google!');
  };

  return (
    <div className="min-h-screen bg-netflix-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-netflix-red/20 blur-[120px] rounded-full -z-10" />
      
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-12">
          <div className="w-10 h-10 bg-netflix-red rounded-full flex items-center justify-center">
            <span className="font-bold text-2xl">S</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tighter text-netflix-red flex items-start">
            SONIK
            <span className="text-[10px] font-bold ml-1 mt-1">TM</span>
          </h1>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/60 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl"
        >
          <h2 className="text-2xl font-bold mb-6">{isRegister ? 'Create Account' : 'Sign In'}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-white/5 rounded-lg px-4 py-3 focus:outline-none focus:border-netflix-red transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-white/5 rounded-lg px-4 py-3 focus:outline-none focus:border-netflix-red transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-netflix-red text-white font-bold rounded-lg hover:bg-red-700 transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : (isRegister ? 'Sign Up' : 'Sign In')}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-[1px] bg-white/10" />
            <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">OR</span>
            <div className="flex-1 h-[1px] bg-white/10" />
          </div>

          <div className="grid grid-cols-1 gap-3 mt-6">
            <button 
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>

            <button 
              onClick={handleGithubSignIn}
              disabled={loading}
              className="w-full py-3 bg-[#24292e] text-white font-bold rounded-lg hover:bg-[#1b1f23] transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Github className="w-5 h-5" />
              Sign in with GitHub
            </button>
          </div>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const SearchPage = ({ songs, onPlay, user, onAddToPlaylist, onDeleteSong }: { 
  songs: Song[]; 
  onPlay: (song: Song, playlist?: Song[]) => void; 
  user: User | null;
  onAddToPlaylist: (song: Song) => void;
  onDeleteSong: (id: string) => void;
}) => {
  const [query, setQuery] = useState('');
  const isPro = user?.subscription === 'pro';

  const filteredSongs = songs.filter(song => 
    song.title.toLowerCase().includes(query.toLowerCase()) || 
    song.artist.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 pb-32">
      <div className="relative mb-10">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for songs or artists..."
          className="w-full bg-zinc-900/50 border border-white/10 rounded-full py-4 pl-12 pr-6 focus:outline-none focus:border-netflix-red transition-colors"
        />
      </div>

      <div className="space-y-2">
        {query && filteredSongs.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">No songs found for "{query}"</div>
        ) : (
          filteredSongs.map((song) => (
            <div 
              key={song.id}
              className="flex items-center gap-4 bg-zinc-900/30 hover:bg-zinc-800/30 p-3 rounded-lg cursor-pointer transition-colors group"
            >
              <div className="relative w-12 h-12 flex-shrink-0" onClick={() => onPlay(song, filteredSongs)}>
                <img 
                  src={song.thumbnail} 
                  alt={song.title} 
                  className="w-full h-full rounded object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                  <Play size={16} fill="white" className="text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0" onClick={() => onPlay(song, filteredSongs)}>
                <MarqueeText text={song.title} className="font-bold text-sm" />
                <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
              </div>
              <div className="flex items-center gap-1">
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const PlaylistModal = ({ 
  user, 
  song, 
  onClose, 
  onAdd, 
  onCreate 
}: { 
  user: User; 
  song: Song; 
  onClose: () => void; 
  onAdd: (playlistId: string, song: Song) => void;
  onCreate: (name: string) => void;
}) => {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold">Add to Playlist</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 max-h-[400px] overflow-y-auto no-scrollbar space-y-2">
          {user.playlists.length === 0 ? (
            <div className="text-center py-8">
              <Library size={48} className="mx-auto text-zinc-700 mb-4" />
              <p className="text-zinc-500">No playlists yet</p>
            </div>
          ) : (
            user.playlists.map(playlist => (
              <button
                key={playlist.id}
                onClick={() => onAdd(playlist.id, song)}
                className="w-full flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors text-left group"
              >
                <div className="w-12 h-12 bg-zinc-800 rounded flex items-center justify-center group-hover:bg-netflix-red transition-colors">
                  <Library size={20} />
                </div>
                <div>
                  <h3 className="font-bold">{playlist.name}</h3>
                  <p className="text-xs text-zinc-500">{playlist.songs.length} songs</p>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-6 bg-black/40 border-t border-white/5">
          {showCreate ? (
            <div className="flex gap-2">
              <input 
                autoFocus
                type="text" 
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Playlist name"
                className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-netflix-red"
              />
              <button 
                onClick={() => {
                  if (newPlaylistName.trim()) {
                    onCreate(newPlaylistName.trim());
                    setNewPlaylistName('');
                    setShowCreate(false);
                  }
                }}
                className="bg-white text-black px-4 py-2 rounded-lg font-bold text-sm"
              >
                Create
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowCreate(true)}
              className="w-full py-3 border border-dashed border-white/20 rounded-xl text-zinc-400 font-bold hover:border-white/40 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              New Playlist
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const HomePage = ({ onPlay, user, songs, loadingSongs, onAddToPlaylist, onDeleteSong }: { 
  onPlay: (song: Song, playlist?: Song[]) => void; 
  user: User | null; 
  songs: Song[]; 
  loadingSongs: boolean;
  onAddToPlaylist: (song: Song) => void;
  onDeleteSong: (id: string) => void;
}) => {
  const isSubscribed = user?.subscription !== 'none' && user?.subscriptionEndsAt && user.subscriptionEndsAt > Date.now();
  const isPlus = user?.subscription === 'plus';
  const isPro = user?.subscription === 'pro';

  return (
    <div className="p-6 md:p-10 pb-32">
      <header className="mb-10">
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">Good Evening</h1>
      </header>

      {isPlus && (
        <div className="mb-10 bg-gradient-to-r from-zinc-900 to-netflix-red/20 border border-white/10 rounded-xl p-6 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Enjoying Sonik?</h3>
            <p className="text-sm text-zinc-400">Upgrade to Pro Plus to remove ads and unlock downloads.</p>
          </div>
          <Link to="/settings" className="bg-white text-black px-4 py-2 rounded-full font-bold text-sm">Upgrade</Link>
        </div>
      )}

      <section className="mb-12">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="w-1 h-6 bg-netflix-red rounded-full" />
          Trending Now
        </h2>
        {loadingSongs ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-netflix-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {songs.map((song) => (
              <motion.div 
                key={song.id}
                whileHover={{ scale: 1.05 }}
                className="group relative cursor-pointer"
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden relative shadow-xl">
                  <img 
                    src={song.thumbnail} 
                    alt={song.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onPlay(song, songs.slice(0, 6))}
                      className="w-12 h-12 bg-netflix-red rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                    >
                      <Play size={24} fill="white" className="ml-1" />
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <MarqueeText text={song.title} className="font-bold text-sm flex-1" />
                    {user?.downloads?.includes(song.id) && (
                      <WifiOff size={12} className="text-emerald-500 flex-shrink-0" title="Available offline" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="w-1 h-6 bg-netflix-red rounded-full" />
          Recommended for You
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {songs.slice(0, 4).map((song) => (
            <div 
              key={song.id}
              className="flex items-center gap-4 bg-zinc-900/50 hover:bg-zinc-800/50 p-3 rounded-lg cursor-pointer transition-colors group"
            >
              <div className="relative w-16 h-16 flex-shrink-0" onClick={() => onPlay(song, songs.slice(0, 4))}>
                <img 
                  src={song.thumbnail} 
                  alt={song.title} 
                  className="w-full h-full rounded object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                  <Play size={20} fill="white" className="text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0" onClick={() => onPlay(song, songs.slice(0, 4))}>
                <div className="flex items-center gap-2">
                  <MarqueeText text={song.title} className="font-bold flex-1" />
                  {user?.downloads?.includes(song.id) && (
                    <WifiOff size={12} className="text-emerald-500 flex-shrink-0" title="Available offline" />
                  )}
                </div>
                <p className="text-sm text-zinc-500 truncate">{song.artist}</p>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => onAddToPlaylist(song)}
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                  title="Add to Playlist"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const LibraryPage = ({ 
  user, 
  onPlay, 
  onCreatePlaylist,
  onUpdatePlaylist,
  onRefresh,
  onRefreshUser,
  onDeleteSong,
  onDeletePlaylist,
  currentSong,
  onStop
}: { 
  user: User | null; 
  onPlay: (song: Song, playlist?: Song[]) => void;
  onCreatePlaylist: (name: string) => void;
  onUpdatePlaylist: (playlistId: string, songs: Song[]) => void;
  onRefresh: () => void;
  onRefreshUser: () => void;
  onDeleteSong: (id: string) => void;
  onDeletePlaylist: (id: string) => void;
  currentSong: Song | null;
  onStop: () => void;
}) => {
  const isPro = user?.subscription === 'pro';
  const limit = isPro ? 10 : 2;
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewingPlaylist, setViewingPlaylist] = useState<Playlist | null>(null);
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [moveSongData, setMoveSongData] = useState<{song: Song, index: number} | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuIndex !== null) {
        setOpenMenuIndex(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuIndex]);

  const handleCreate = () => {
    if (newPlaylistName.trim()) {
      onCreatePlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setShowCreateInput(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([onRefresh(), onRefreshUser()]);
    setTimeout(() => setIsRefreshing(false), 1000);
    toast.success("Library refreshed");
  };

  const handleMoveSong = (playlistId: string, songIndex: number) => {
    if (!viewingPlaylist) return;
    setMoveSongData({ song: viewingPlaylist.songs[songIndex], index: songIndex });
  };

  const performMove = (newIndex: number) => {
    if (!viewingPlaylist || !moveSongData) return;
    const newSongs = [...viewingPlaylist.songs];
    const [removed] = newSongs.splice(moveSongData.index, 1);
    newSongs.splice(newIndex - 1, 0, removed);
    onUpdatePlaylist(viewingPlaylist.id, newSongs);
    setViewingPlaylist({ ...viewingPlaylist, songs: newSongs });
    setMoveSongData(null);
    toast.success("Position updated");
  };

  const handleRemoveFromPlaylist = (playlistId: string, songIndex: number) => {
    if (!viewingPlaylist) return;
    const songToDelete = viewingPlaylist.songs[songIndex];
    const newSongs = [...viewingPlaylist.songs];
    newSongs.splice(songIndex, 1);
    
    onUpdatePlaylist(playlistId, newSongs);
    setViewingPlaylist({ ...viewingPlaylist, songs: newSongs });
    toast.success("Song deleted from playlist");

    if (currentSong?.id === songToDelete.id) {
      if (newSongs.length > 0) {
        const nextIndex = songIndex < newSongs.length ? songIndex : 0;
        onPlay(newSongs[nextIndex], newSongs);
      } else {
        onStop();
      }
    }
  };

  if (viewingPlaylist) {
    return (
      <div className="p-6 md:p-10 pb-32">
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => setViewingPlaylist(null)}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          >
            <SkipBack size={18} />
            Back to Library
          </button>
          
          <button 
            onClick={() => {
              onDeletePlaylist(viewingPlaylist.id);
              setViewingPlaylist(null);
            }}
            className="flex items-center gap-2 text-zinc-500 hover:text-netflix-red transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <Trash2 size={16} />
            Delete Playlist
          </button>
        </div>

        <div className="flex items-end gap-6 mb-10">
          <div className="w-48 h-48 bg-netflix-red/10 text-netflix-red rounded-2xl flex items-center justify-center shadow-2xl">
            <Library size={80} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Playlist</p>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4">{viewingPlaylist.name}</h1>
            <p className="text-sm text-zinc-400 font-medium mb-6">{viewingPlaylist.songs.length} songs • Created by you</p>
            {viewingPlaylist.songs.length > 0 && (
              <button 
                onClick={() => onPlay(viewingPlaylist.songs[0], viewingPlaylist.songs)}
                className="flex items-center gap-2 bg-netflix-red text-white px-6 py-3 rounded-full font-bold hover:scale-105 transition-transform"
              >
                <Play size={20} fill="currentColor" />
                Play All
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="grid grid-cols-[40px_1fr_auto] gap-4 px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-white/5 mb-4">
            <span>#</span>
            <span>Title</span>
            <span className="text-right">Action</span>
          </div>
          
          {viewingPlaylist.songs.map((song, index) => (
            <div 
              key={`${song.id}-${index}`}
              className="grid grid-cols-[40px_1fr_auto] gap-4 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors group items-center"
            >
              <span className="text-sm font-mono text-zinc-500 group-hover:text-white">{index + 1}{song.label || ''}</span>
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded bg-zinc-800 flex-shrink-0 overflow-hidden relative">
                  <img src={song.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <button 
                    onClick={() => onPlay(song, viewingPlaylist.songs)}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Play size={16} fill="white" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <MarqueeText text={song.title} className="font-bold text-sm flex-1" />
                    {user?.downloads?.includes(song.id) && (
                      <WifiOff size={12} className="text-emerald-500 flex-shrink-0" title="Available offline" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
                </div>
              </div>
              <div className="relative">
                <button 
                  className="p-2 text-zinc-500 hover:text-white transition-colors"
                  title="More Options"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuIndex(openMenuIndex === index ? null : index);
                  }}
                >
                  <MoreVertical size={20} />
                </button>
                {openMenuIndex === index && (
                  <div 
                    className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                  <button 
                    onClick={() => {
                      handleMoveSong(viewingPlaylist.id, index);
                      setOpenMenuIndex(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-white hover:bg-white/5 transition-colors"
                  >
                    <ArrowUpCircle size={14} />
                    Move Position
                  </button>
                  <button 
                    onClick={() => {
                      handleRemoveFromPlaylist(viewingPlaylist.id, index);
                      setOpenMenuIndex(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-white hover:bg-white/5 transition-colors border-t border-white/5"
                  >
                    <Trash2 size={14} />
                    Delete Song
                  </button>
                </div>
                )}
              </div>
            </div>
          ))}

          {viewingPlaylist.songs.length === 0 && (
            <div className="text-center py-20 text-zinc-500 italic">
              This playlist is empty. Add some music!
            </div>
          )}

          {moveSongData && (
            <MoveSongModal 
              song={moveSongData.song}
              maxPos={viewingPlaylist.songs.length}
              onClose={() => setMoveSongData(null)}
              onMove={performMove}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 pb-32">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-black tracking-tighter">Your Library</h1>
          <button 
            onClick={handleRefresh}
            className={cn(
              "p-2 text-zinc-500 hover:text-white transition-all",
              isRefreshing && "animate-spin text-netflix-red"
            )}
            title="Refresh Library"
          >
            <RefreshCw size={20} />
          </button>
        </div>
        <button 
          onClick={() => setShowCreateInput(true)}
          className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full font-bold text-sm hover:bg-zinc-200 transition-colors"
        >
          <Plus size={18} />
          Create Playlist
        </button>
      </div>

      {showCreateInput && (
        <div className="mb-8 bg-zinc-900/50 p-6 rounded-2xl border border-white/10 flex gap-4">
          <input 
            autoFocus
            type="text" 
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="Playlist name"
            className="flex-1 bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-netflix-red"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button 
            onClick={handleCreate}
            className="bg-netflix-red text-white px-6 py-2 rounded-lg font-bold"
          >
            Create
          </button>
          <button 
            onClick={() => setShowCreateInput(false)}
            className="text-zinc-500 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {user?.playlists && user.playlists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {user.playlists.map((playlist) => (
            <div key={playlist.id} className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">{playlist.name}</h2>
                  <p className="text-sm text-zinc-500">{playlist.songs.length} songs</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      onDeletePlaylist(playlist.id);
                    }}
                    className="w-10 h-10 bg-white/5 text-zinc-500 hover:text-netflix-red hover:bg-netflix-red/10 rounded-full flex items-center justify-center transition-all"
                    title="Delete Playlist"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="w-12 h-12 bg-netflix-red/10 text-netflix-red rounded-full flex items-center justify-center">
                    <Library size={24} />
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 flex-1">
                {playlist.songs.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">No songs added yet</p>
                ) : (
                  playlist.songs.slice(0, 3).map((song) => (
                    <div 
                      key={song.id} 
                      className="flex items-center gap-3 group cursor-pointer"
                      onClick={() => onPlay(song, playlist.songs)}
                    >
                      <div className="w-8 h-8 rounded bg-zinc-800 flex-shrink-0 overflow-hidden">
                        <img src={song.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <MarqueeText text={song.title} className="text-sm font-medium group-hover:text-netflix-red transition-colors" />
                        <p className="text-[10px] text-zinc-500 truncate">{song.artist}</p>
                      </div>
                      <Play size={14} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))
                )}
                {playlist.songs.length > 3 && (
                  <p className="text-[10px] text-zinc-500 text-center pt-2">+{playlist.songs.length - 3} more songs</p>
                )}
              </div>

              <button 
                onClick={() => setViewingPlaylist(playlist)}
                className="mt-6 w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
              >
                View All
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
          <Library size={48} className="text-zinc-700 mb-4" />
          <h2 className="text-xl font-bold mb-2">No Playlists Yet</h2>
          <p className="text-zinc-500 max-w-xs mb-6">Start building your collection. You can create up to {limit} playlists on your current plan.</p>
          {!isPro && (
            <Link to="/settings" className="text-netflix-red font-bold hover:underline">
              Upgrade to Pro for 10 playlists
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

const DownloadsPage = ({ user, onPlay, songs, onDownload, onRemoveDownload, onAddToPlaylist, onDeleteSong }: { 
  user: User | null; 
  onPlay: (song: Song, playlist?: Song[]) => void; 
  songs: Song[];
  onDownload: (song: Song) => void;
  onRemoveDownload: (songId: string) => void;
  onAddToPlaylist: (song: Song) => void;
  onDeleteSong: (id: string) => void;
}) => {
  const isPro = user?.subscription === 'pro';
  const downloadedSongs = songs.filter(s => user?.downloads?.includes(s.id));

  return (
    <div className="p-6 md:p-10 pb-32">
      <h1 className="text-4xl font-black tracking-tighter mb-10">Downloads</h1>

      {!isPro ? (
        <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
          <Download size={48} className="text-zinc-700 mb-4" />
          <h2 className="text-xl font-bold mb-2">Downloads are a Pro Feature</h2>
          <p className="text-zinc-500 max-w-xs mb-6">Upgrade to Pro Plus to download your favorite tracks and listen offline.</p>
          <Link to="/settings" className="bg-netflix-red text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-red-700 transition-colors">
            Upgrade Now
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {downloadedSongs.length === 0 ? (
            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
              <Download size={48} className="text-zinc-700 mb-4" />
              <h2 className="text-xl font-bold mb-2">No Downloads Yet</h2>
              <p className="text-zinc-500 max-w-xs">Your downloaded songs will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {downloadedSongs.map((song) => (
                <div 
                  key={song.id}
                  className="flex items-center gap-4 bg-zinc-900/50 p-3 rounded-lg group"
                >
                  <img 
                    src={song.thumbnail} 
                    alt={song.title} 
                    className="w-16 h-16 rounded object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <MarqueeText text={song.title} className="font-bold" />
                    <p className="text-sm text-zinc-500">{song.artist}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onPlay(song, downloadedSongs)}
                      className="p-2 text-zinc-400 hover:text-white"
                    >
                      <Play size={20} fill="currentColor" />
                    </button>
                    <button 
                      onClick={() => onRemoveDownload(song.id)}
                      className="p-2 text-zinc-500 hover:text-netflix-red transition-colors"
                      title="Remove Download"
                    >
                      <Trash2 size={18} />
                    </button>
                    {user?.isAdmin && (
                      <button 
                        onClick={() => {
                          onDeleteSong(song.id);
                        }}
                        className="p-2 text-zinc-500 hover:text-netflix-red transition-colors"
                        title="Delete Song"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <h2 className="text-xl font-bold mt-10 mb-6">Suggested for Download</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {songs.slice(0, 6).map((song) => (
              <div 
                key={song.id}
                className="flex items-center gap-4 bg-zinc-900/50 p-3 rounded-lg group"
              >
                <img 
                  src={song.thumbnail} 
                  alt={song.title} 
                  className="w-16 h-16 rounded object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <MarqueeText text={song.title} className="font-bold" />
                  <p className="text-sm text-zinc-500">{song.artist}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onPlay(song, songs.slice(0, 6))}
                    className="p-2 text-zinc-400 hover:text-white"
                  >
                    <Play size={20} fill="currentColor" />
                  </button>
                  <button 
                    onClick={() => onAddToPlaylist(song)}
                    className="p-2 text-zinc-400 hover:text-white"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SettingsPage = ({ 
  user, 
  onUpdateSub, 
  onLogout, 
  onRefresh,
  onUpdateSettings
}: { 
  user: User | null; 
  onUpdateSub: (type: SubscriptionType, endsAt?: number) => void; 
  onLogout: () => void; 
  onRefresh: () => Promise<void>;
  onUpdateSettings: (settings: Partial<User>) => Promise<void>;
}) => {
  const [redeemCode, setRedeemCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [confirmRedeem, setConfirmRedeem] = useState<{ planType: SubscriptionType; newEndsAt: number; codeDocId: string } | null>(null);
  
  const paletteColors = [
    '#E50914', '#1DB954', '#00A8E1', '#FF9900', '#7289DA', 
    '#FF0000', '#0077B5', '#FF4500', '#1DA1F2', '#9146FF'
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const executeRedeem = async (planType: SubscriptionType, newEndsAt: number, codeDocId: string) => {
    setIsRedeeming(true);
    try {
      await updateDoc(doc(db, 'redeem_codes', codeDocId), {
        used: true,
        usedBy: user?.id,
        usedAt: serverTimestamp()
      });

      onUpdateSub(planType, newEndsAt);
      setRedeemCode('');
      toast.success('Subscription activated!');
      setConfirmRedeem(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to redeem code');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return toast.error('Please enter a code');
    if (!user) return;

    setIsRedeeming(true);
    try {
      const q = query(collection(db, 'redeem_codes'), where('code', '==', redeemCode.trim()), where('used', '==', false));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('Invalid or already used code');
      }

      const codeDoc = querySnapshot.docs[0];
      const codeData = codeDoc.data();
      
      const planType = (codeData.value as SubscriptionType) || 'plus';
      const daysToAdd = codeData.days || 30;

      // Plan checks
      const isProActive = user.subscription === 'pro' && typeof user.subscriptionEndsAt === 'number' && user.subscriptionEndsAt > Date.now();
      const isPlusActive = user.subscription === 'plus' && typeof user.subscriptionEndsAt === 'number' && user.subscriptionEndsAt > Date.now();

      if (isProActive && planType === 'plus') {
        throw new Error("This code cannot be added now because a Pro plan is currently running.");
      }
      
      if (isPlusActive && planType === 'pro') {
        throw new Error("This code cannot be added now because a Plus plan is currently running. Only Plus codes can extend your current plan.");
      }
      
      const currentEndsAt = typeof user.subscriptionEndsAt === 'number' && user.subscriptionEndsAt > Date.now() 
        ? user.subscriptionEndsAt 
        : Date.now();
      
      let newEndsAt = currentEndsAt + (Number(daysToAdd) * 24 * 60 * 60 * 1000);

      // Safety cap: Don't allow more than 10 years
      const tenYearsFromNow = Date.now() + (10 * 365 * 24 * 60 * 60 * 1000);
      if (newEndsAt > tenYearsFromNow) {
        newEndsAt = Date.now() + (Number(daysToAdd) * 24 * 60 * 60 * 1000);
      }

      await executeRedeem(planType, newEndsAt, codeDoc.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to redeem code');
      setIsRedeeming(false);
    }
  };

  return (
    <div className="p-6 md:p-10 pb-32 max-w-4xl mx-auto">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2">Settings</h1>
          <p className="text-zinc-500">Manage your account and preferences</p>
        </div>
      </header>

      <div className="space-y-12">
        <section>
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Account Profile</h2>
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
            {confirmRedeem ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 mb-4">
                <div className="flex items-center gap-3 text-amber-500 mb-4">
                  <AlertTriangle size={24} />
                  <h3 className="font-bold">Plan Upgrade Confirmation</h3>
                </div>
                <p className="text-sm text-zinc-300 mb-6">
                  Plus subscription is active. Adding Pro code will replace Plus, and remaining days will be lost.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => executeRedeem(confirmRedeem.planType, confirmRedeem.newEndsAt, confirmRedeem.codeDocId)}
                    disabled={isRedeeming}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isRedeeming ? 'Processing...' : 'Confirm & Replace'}
                  </button>
                  <button 
                    onClick={() => setConfirmRedeem(null)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <button 
                    onClick={() => setShowPalette(!showPalette)}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-xl border-2 border-white/10 transition-transform hover:scale-105 active:scale-95 overflow-hidden group"
                    style={{ backgroundColor: user?.profileColor || '#E50914' }}
                  >
                    <span className="group-hover:opacity-0 transition-opacity">
                      {user?.email[0].toUpperCase()}
                    </span>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Palette size={24} className="text-white" />
                    </div>
                  </button>
                  
                  <AnimatePresence>
                    {showPalette && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute top-full left-0 mt-4 p-3 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 grid grid-cols-5 gap-2 w-48"
                      >
                        {paletteColors.map(color => (
                          <button
                            key={color}
                            onClick={() => {
                              onUpdateSettings({ profileColor: color });
                              setShowPalette(false);
                            }}
                            className={cn(
                              "w-7 h-7 rounded-full border border-white/10 transition-transform hover:scale-110",
                              user?.profileColor === color && "ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-900"
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div>
                  <h3 className="font-bold text-xl truncate max-w-[200px] md:max-w-none">{user?.email}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-zinc-500">Member since 2024</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={onLogout}
                className="flex items-center justify-center gap-2 px-6 py-2 border border-white/10 rounded-full text-sm font-bold hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Subscription Status</p>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    user?.subscription !== 'none' && user?.subscriptionEndsAt && user.subscriptionEndsAt > Date.now() ? "bg-emerald-500" : "bg-netflix-red"
                  )} />
                  <span className="font-bold">
                    {user?.subscription !== 'none' && user?.subscriptionEndsAt && user.subscriptionEndsAt > Date.now() 
                      ? `Active (${user.subscription.toUpperCase()})` 
                      : 'Inactive'}
                  </span>
                </div>
              </div>
              {user?.subscriptionEndsAt && (
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">Time Remaining</p>
                  <div className="flex items-center gap-3">
                    <CountdownTimer endsAt={user.subscriptionEndsAt} />
                    <button 
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="flex items-center gap-2 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-full transition-colors"
                    >
                      <RefreshCw size={12} className={cn(isRefreshing && "animate-spin")} />
                      {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>

        <section>
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Audio Preferences</h2>
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6 space-y-8">
            <div className="flex flex-col items-center gap-8 p-8 bg-white/5 rounded-2xl border border-white/5">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Volume2 size={24} className="text-netflix-red" />
                  <h3 className="text-xl font-bold">Master Default Volume</h3>
                </div>
                <p className="text-sm text-zinc-500">Set your preferred starting volume for all tracks</p>
              </div>

              {/* The Box in the Middle */}
              <div className="flex flex-col items-center justify-center bg-zinc-900 w-24 h-24 rounded-2xl border-2 border-netflix-red shadow-[0_0_30px_rgba(229,9,20,0.2)]">
                <span className="text-4xl font-black text-white leading-none">
                  {Math.round((user?.defaultVolume || 0.5) * 100)}
                </span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase mt-2 tracking-widest">Percent</span>
              </div>

              <div className="w-full max-w-xl space-y-4">
                <div className="relative h-12 flex items-center group">
                  {/* Custom Track */}
                  <div className="absolute inset-0 flex items-center pointer-events-none">
                    <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="h-full bg-netflix-red"
                        style={{ width: `${((user?.defaultVolume || 0.5) / 2.5) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <input 
                    type="range" 
                    min="0" 
                    max="2.5" 
                    step="0.01" 
                    value={user?.defaultVolume || 0.5}
                    onChange={(e) => onUpdateSettings({ defaultVolume: parseFloat(e.target.value) })}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  
                  {/* Custom Thumb - No transition to ensure "jumping" feel */}
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full border-4 border-netflix-red shadow-2xl pointer-events-none"
                    style={{ 
                      left: `calc(${((user?.defaultVolume || 0.5) / 2.5) * 100}% - 16px)`,
                      transition: 'none' 
                    }}
                  />
                </div>
                
                <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2">
                  <span>0%</span>
                  <span className="text-netflix-red">100% (Standard)</span>
                  <span>250% (Max Boost)</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-bold">AI Sound Boost</h3>
                  <p className="text-sm text-zinc-500">Choose how AI Boost should behave</p>
                </div>
                {user?.subscription === 'plus' && (
                  <span className="bg-blue-600/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-blue-600/30">Pro Feature</span>
                )}
              </div>
              <div className="flex bg-black p-1 rounded-lg border border-white/5 relative">
                {(['off', 'always', 'manual'] as const).map((mode) => (
                  <button
                    key={mode}
                    disabled={user?.subscription === 'plus'}
                    onClick={() => onUpdateSettings({ aiBoostMode: mode })}
                    className={cn(
                      "relative px-4 py-1.5 rounded-md text-xs font-bold transition-all uppercase tracking-widest z-10",
                      user?.aiBoostMode === mode ? "text-white" : "text-zinc-500 hover:text-zinc-300",
                      user?.subscription === 'plus' && "opacity-20 cursor-not-allowed"
                    )}
                  >
                    {user?.aiBoostMode === mode && (
                      <motion.div 
                        layoutId="activeMode"
                        className="absolute inset-0 bg-blue-600 rounded-md shadow-[0_0_15px_rgba(37,99,235,0.4)] -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-bold">Clean Audio</h3>
                  <p className="text-sm text-zinc-500">Enable AI-powered noise reduction and clarity</p>
                </div>
                {user?.subscription === 'plus' && (
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-emerald-500/30">Pro Feature</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest transition-colors",
                  user?.cleanAudio ? "text-emerald-500" : "text-zinc-500"
                )}>
                  {user?.cleanAudio ? 'status switch on' : 'status switch off'}
                </span>
                <button
                  disabled={user?.subscription === 'plus'}
                  onClick={() => onUpdateSettings({ cleanAudio: !user?.cleanAudio })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    user?.cleanAudio ? "bg-emerald-500" : "bg-zinc-800",
                    user?.subscription === 'plus' && "opacity-20 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    user?.cleanAudio ? "left-7" : "left-1"
                  )} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Redeem Subscription</h2>
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
            <>
              <p className="text-sm text-zinc-400 mb-6">Enter your redeem code to activate or extend your subscription.</p>
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <input 
                  type="text" 
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX"
                  className="w-full md:flex-1 bg-black border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-netflix-red transition-colors font-mono"
                />
                <button 
                  onClick={handleRedeem}
                  disabled={isRedeeming}
                  className="w-full md:w-auto bg-white text-black px-8 py-3 rounded-lg font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {isRedeeming ? 'Verifying...' : 'Redeem'}
                </button>
              </div>
            </>
          </div>
        </section>

        <div className="pt-10 border-t border-white/5 text-center">
          <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
            it made by xrok organisation
          </p>
        </div>
      </div>
    </div>
  );
};

const AdminPage = ({ user, songs, onRefreshSongs, onDeleteSong }: { user: User | null; songs: Song[]; onRefreshSongs: () => void; onDeleteSong: (id: string) => void }) => {
  const [codes, setCodes] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [newCode, setNewCode] = useState({ 
    code: '', 
    type: 'subscription' as 'subscription',
    value: 'pro', // plan name
    days: 30 
  });

  // Song Upload State
  const [songUrl, setSongUrl] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [songThumbnail, setSongThumbnail] = useState<File | null>(null);
  const [songDetails, setSongDetails] = useState({ title: '', artist: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

  const handleParseMetadata = async (url?: string) => {
    const targetUrl = url || songUrl;
    if (!targetUrl) return;
    
    setIsParsing(true);
    try {
      let finalSongUrl = targetUrl;
      
      // Google Drive conversion
      if (targetUrl.includes('drive.google.com') || targetUrl.includes('docs.google.com')) {
        const driveIdMatch = targetUrl.match(/\/d\/([^/]+)/) || targetUrl.match(/id=([^&]+)/);
        if (driveIdMatch && driveIdMatch[1]) {
          finalSongUrl = `https://docs.google.com/uc?export=download&id=${driveIdMatch[1]}`;
        }
      }

      // Fetch the metadata
      const metadata = await mm.fetchFromUrl(finalSongUrl);
      
      if (metadata.common) {
        const { title, artist, picture } = metadata.common;
        
        if (title) setSongDetails(prev => ({ ...prev, title }));
        if (artist) setSongDetails(prev => ({ ...prev, artist }));
        
        if (picture && picture.length > 0) {
          const pic = picture[0];
          const blob = new Blob([pic.data], { type: pic.format });
          
          // Upload the extracted cover to Firebase Storage
          const coverRef = ref(storage, `thumbnails/extracted_${Date.now()}_cover`);
          await uploadBytes(coverRef, blob);
          const downloadUrl = await getDownloadURL(coverRef);
          setThumbUrl(downloadUrl);
          toast.success("Metadata and cover art parsed!");
        } else {
          toast.success("Metadata parsed (no cover art found)");
        }
      }
    } catch (error: any) {
      console.error("Metadata parsing error:", error);
      // Don't show toast for automatic parsing to avoid annoyance if it fails due to CORS
      if (!url) toast.error("Could not parse metadata. This is often due to CORS restrictions on the file host.");
    } finally {
      setIsParsing(false);
    }
  };

  // Auto-parse on URL change
  useEffect(() => {
    if (!songUrl || editingSongId) return;
    
    const timer = setTimeout(() => {
      // Only auto-parse if fields are empty
      if (!songDetails.title && !songDetails.artist) {
        handleParseMetadata(songUrl);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [songUrl, editingSongId]);

  useEffect(() => {
    if (!user?.isAdmin) return;

    const fetchCodes = async () => {
      try {
        console.log("Fetching codes as user:", user?.email, "UID:", user?.id);
        const q = query(collection(db, 'redeem_codes'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const codesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCodes(codesList);
      } catch (error: any) {
        console.error("Error fetching codes:", error);
        if (error.code === 'permission-denied') {
          toast.error("Permission Denied: Ensure rules are updated in Firebase Console.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchCodes();

    const fetchUsers = async () => {
      try {
        // Simple query without orderBy to avoid index issues/permission complexity
        const q = query(collection(db, 'users'));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        // Sort manually in memory if needed, or just leave as is
        setUsersList(list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      } catch (error: any) {
        console.error("Error fetching users:", error);
        if (error.code === 'permission-denied') {
          toast.error("Admin: Missing Firestore permissions to list users.");
        }
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [user]);

  const handleUpdateUserStatus = async (userId: string, updates: any) => {
    try {
      await updateDoc(doc(db, 'users', userId), updates);
      setUsersList(usersList.map(u => u.id === userId ? { ...u, ...updates } : u));
      toast.success("User updated successfully");
    } catch (error) {
      toast.error("Failed to update user");
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) result += '-';
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode({ ...newCode, code: result });
  };

  const handleCreateCode = async () => {
    if (!newCode.code) return toast.error("Enter or generate a code");
    try {
      const codeData: any = {
        code: newCode.code,
        type: newCode.type,
        value: newCode.value,
        used: false,
        createdAt: serverTimestamp()
      };

      if (newCode.type === 'subscription') {
        codeData.days = newCode.days;
      }
      
      await setDoc(doc(db, 'redeem_codes', newCode.code), codeData);
      
      // Update local state
      setCodes([{ ...codeData, id: newCode.code, createdAt: { seconds: Math.floor(Date.now() / 1000) } }, ...codes]);
      setNewCode({ ...newCode, code: '' });
      toast.success("Code created!");
    } catch (error: any) {
      console.error("Error creating code:", error);
      toast.error(error.message || "Failed to create code");
    }
  };

  const handleDeleteCode = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'redeem_codes', id));
      setCodes(codes.filter(c => c.id !== id));
      toast.success("Code deleted");
    } catch (error) {
      toast.error("Failed to delete code");
    }
  };

  const handleDeleteSong = async (id: string) => {
    onDeleteSong(id);
  };

  const handleEditSong = (song: Song) => {
    setEditingSongId(song.id);
    setSongDetails({ title: song.title, artist: song.artist });
    setSongUrl(song.url);
    setThumbUrl(song.thumbnail);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUploadSong = async () => {
    if (!songUrl || !songDetails.title || !songDetails.artist) {
      return toast.error("Please fill all song details and provide a valid MP3 URL");
    }

    setIsUploading(true);
    try {
      // 0. Convert Google Drive links to direct stream links
      let finalSongUrl = songUrl;
      if (songUrl.includes('drive.google.com') || songUrl.includes('docs.google.com')) {
        const driveIdMatch = songUrl.match(/\/d\/([^/]+)/) || songUrl.match(/id=([^&]+)/);
        if (driveIdMatch && driveIdMatch[1]) {
          // Use docs.google.com for more reliable direct downloads
          finalSongUrl = `https://docs.google.com/uc?export=download&id=${driveIdMatch[1]}`;
          console.log("Converted Google Drive URL:", finalSongUrl);
        }
      }

      // 1. Upload Thumbnail (optional) or use URL
      let thumbnailUrl = thumbUrl || "https://picsum.photos/seed/music/400/400";
      if (songThumbnail && !thumbUrl) {
        const thumbRef = ref(storage, `thumbnails/${Date.now()}_${songThumbnail.name}`);
        await uploadBytes(thumbRef, songThumbnail);
        thumbnailUrl = await getDownloadURL(thumbRef);
      }

      // 2. Save to Firestore
      const songId = editingSongId || doc(collection(db, 'songs')).id;
      const songData = {
        id: songId,
        title: songDetails.title,
        artist: songDetails.artist,
        url: finalSongUrl,
        thumbnail: thumbnailUrl,
        duration: 0,
        updatedAt: serverTimestamp()
      };

      if (!editingSongId) {
        (songData as any).createdAt = serverTimestamp();
      }

      await setDoc(doc(db, 'songs', songId), songData, { merge: true });

      toast.success(editingSongId ? "Song updated successfully!" : "Song added successfully!");
      setSongUrl('');
      setThumbUrl('');
      setSongThumbnail(null);
      setSongDetails({ title: '', artist: '' });
      setEditingSongId(null);
      onRefreshSongs();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to save song");
    } finally {
      setIsUploading(false);
    }
  };

  if (!user?.isAdmin) return <div className="p-10 text-center">Access Denied</div>;

  return (
    <div className="p-6 md:p-10 pb-32 max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tighter mb-2">Admin Dashboard</h1>
        <p className="text-zinc-500">Manage redeem codes and system settings</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <section className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-6">Create New Code</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Code Type</label>
                <div className="flex bg-black p-1 rounded-lg border border-white/10">
                  <button 
                    className="flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all bg-netflix-red text-white"
                  >
                    Subscription
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Code</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newCode.code}
                    onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                    placeholder="XXXX-XXXX-XXXX"
                    className="flex-1 bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-netflix-red font-mono text-sm"
                  />
                  <button 
                    onClick={generateRandomCode}
                    className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Plan</label>
                  <select 
                    value={newCode.value}
                    onChange={(e) => setNewCode({ ...newCode, value: e.target.value })}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-netflix-red text-sm"
                  >
                    <option value="plus">Plus</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Days</label>
                  <input 
                    type="number" 
                    value={newCode.days}
                    onChange={(e) => setNewCode({ ...newCode, days: parseInt(e.target.value) })}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-netflix-red text-sm"
                  />
                </div>
              </div>

              <button 
                onClick={handleCreateCode}
                className="w-full py-3 text-white font-bold rounded-lg transition-colors mt-4 bg-netflix-red hover:bg-red-700"
              >
                Create Subscription Code
              </button>
            </div>
          </section>

          <section className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-6">{editingSongId ? 'Edit Song' : 'Add New Song'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Title</label>
                <input 
                  type="text" 
                  value={songDetails.title}
                  onChange={(e) => setSongDetails({ ...songDetails, title: e.target.value })}
                  placeholder="Song Title"
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-netflix-red"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Artist</label>
                <input 
                  type="text" 
                  value={songDetails.artist}
                  onChange={(e) => setSongDetails({ ...songDetails, artist: e.target.value })}
                  placeholder="Artist Name"
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-netflix-red"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">Song URL (MP3 or Google Drive)</label>
                  <div className="flex gap-2">
                    {songUrl && (
                      <button 
                        onClick={() => handleParseMetadata()}
                        disabled={isParsing}
                        className="text-[10px] text-emerald-500 hover:underline font-bold flex items-center gap-1"
                      >
                        {isParsing ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                        Auto-Parse
                      </button>
                    )}
                    {songUrl && (
                      <button 
                        onClick={() => {
                          let testUrl = songUrl;
                          if (songUrl.includes('drive.google.com') || songUrl.includes('docs.google.com')) {
                            const driveIdMatch = songUrl.match(/\/d\/([^/]+)/) || songUrl.match(/id=([^&]+)/);
                            if (driveIdMatch && driveIdMatch[1]) {
                              testUrl = `https://docs.google.com/uc?export=download&id=${driveIdMatch[1]}`;
                            }
                          }
                          window.open(testUrl, '_blank');
                        }}
                        className="text-[10px] text-netflix-red hover:underline font-bold"
                      >
                        Test Link
                      </button>
                    )}
                  </div>
                </div>
                <input 
                  type="text" 
                  value={songUrl}
                  onChange={(e) => setSongUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-netflix-red"
                />
                <p className="text-[9px] text-zinc-500 mt-1 italic">Note: Google Drive files must be shared as "Anyone with the link".</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Thumbnail URL (Optional)</label>
                <input 
                  type="text" 
                  value={thumbUrl}
                  onChange={(e) => setThumbUrl(e.target.value)}
                  placeholder="https://supabase.co/storage/v1/object/public/..."
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-netflix-red"
                />
              </div>
              {!editingSongId && (
                <>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-[1px] bg-white/10" />
                    <span className="text-[10px] text-zinc-600 font-bold uppercase">OR</span>
                    <div className="flex-1 h-[1px] bg-white/10" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Upload Thumbnail (Optional)</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setSongThumbnail(e.target.files?.[0] || null)}
                      className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-2 mt-4">
                <button 
                  onClick={handleUploadSong}
                  disabled={isUploading}
                  className="flex-1 py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? 'Saving...' : (
                    <>
                      {editingSongId ? <RefreshCw size={18} /> : <Plus size={18} />}
                      {editingSongId ? 'Update Song' : 'Add Song'}
                    </>
                  )}
                </button>
                {editingSongId && (
                  <button 
                    onClick={() => {
                      setEditingSongId(null);
                      setSongDetails({ title: '', artist: '' });
                      setSongUrl('');
                      setThumbUrl('');
                    }}
                    className="px-4 py-3 bg-zinc-800 text-white font-bold rounded-lg hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <section className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest">Manage Redeem Codes</h2>
              <button 
                onClick={() => {
                  setLoading(true);
                  getDocs(query(collection(db, 'redeem_codes'), orderBy('createdAt', 'desc')))
                    .then(snap => {
                      setCodes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                      setLoading(false);
                    });
                }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            {loading ? (
              <div className="text-center py-10 text-zinc-500">Loading codes...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] text-zinc-500 uppercase border-b border-white/5">
                      <th className="pb-3 font-bold">Code</th>
                      <th className="pb-3 font-bold">Type</th>
                      <th className="pb-3 font-bold">Value</th>
                      <th className="pb-3 font-bold">Status</th>
                      <th className="pb-3 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {codes.map((code) => (
                      <tr key={code.id} className="border-b border-white/5 last:border-0">
                        <td className="py-4 font-mono font-bold">{code.code}</td>
                        <td className="py-4">
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-blue-500/20 text-blue-500">
                            Subscription
                          </span>
                        </td>
                        <td className="py-4">
                          <span className="font-bold">
                            {String(code.value).toUpperCase()} ({code.days}d)
                          </span>
                        </td>
                        <td className="py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            code.used ? "bg-zinc-800 text-zinc-500" : "bg-emerald-500/20 text-emerald-500"
                          )}>
                            {code.used ? 'Used' : 'Active'}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <button 
                            onClick={() => handleDeleteCode(code.id)}
                            className="text-zinc-500 hover:text-netflix-red transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-6">Manage Users</h2>
            {loadingUsers ? (
              <div className="text-center py-10 text-zinc-500">Loading users...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] text-zinc-500 uppercase border-b border-white/5">
                      <th className="pb-3 font-bold">User</th>
                      <th className="pb-3 font-bold">Plan</th>
                      <th className="pb-3 font-bold">Admin</th>
                      <th className="pb-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {usersList.map((u) => (
                      <tr key={u.id} className="border-b border-white/5 last:border-0">
                        <td className="py-4">
                          <div className="font-bold truncate max-w-[150px]" title={u.email}>{u.email}</div>
                          <div className="text-[10px] text-zinc-500">
                            {u.subscriptionEndsAt && u.subscriptionEndsAt > Date.now() 
                              ? `Expires: ${new Date(u.subscriptionEndsAt).toLocaleDateString()}`
                              : 'Expired/None'}
                          </div>
                        </td>
                        <td className="py-4">
                          <select 
                            value={u.subscription || 'none'}
                            onChange={(e) => handleUpdateUserStatus(u.id, { subscription: e.target.value })}
                            className="bg-black border border-white/10 rounded px-2 py-1 text-xs focus:outline-none"
                          >
                            <option value="none">None</option>
                            <option value="plus">Plus</option>
                            <option value="pro">Pro</option>
                          </select>
                        </td>
                        <td className="py-4">
                          <button 
                            onClick={() => handleUpdateUserStatus(u.id, { isAdmin: !u.isAdmin })}
                            className={cn(
                              "px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors",
                              u.isAdmin ? "bg-netflix-red text-white" : "bg-zinc-800 text-zinc-500"
                            )}
                          >
                            {u.isAdmin ? 'Admin' : 'User'}
                          </button>
                        </td>
                        <td className="py-4 text-right">
                          <button 
                            onClick={() => {
                              const days = prompt("Enter days to add:", "30");
                              if (days) {
                                const current = typeof u.subscriptionEndsAt === 'number' && u.subscriptionEndsAt > Date.now() 
                                  ? u.subscriptionEndsAt 
                                  : Date.now();
                                const newEndsAt = current + (parseInt(days) * 24 * 60 * 60 * 1000);
                                handleUpdateUserStatus(u.id, { subscriptionEndsAt: newEndsAt });
                              }
                            }}
                            className="text-emerald-500 hover:text-emerald-400 text-xs font-bold"
                          >
                            +Days
                          </button>
                          <button 
                            onClick={() => handleUpdateUserStatus(u.id, { 
                              subscriptionEndsAt: Date.now() + (30 * 24 * 60 * 60 * 1000),
                              subscription: u.subscription === 'none' ? 'pro' : u.subscription
                            })}
                            className="ml-2 px-2 py-1 bg-emerald-500/20 text-emerald-500 rounded text-[10px] font-bold uppercase hover:bg-emerald-500/30 transition-colors"
                            title="Set to expire in 30 days"
                          >
                            30d
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-6">Manage Songs</h2>
            <div className="space-y-4">
              {songs.map((song) => {
                const isMock = MOCK_SONGS.some(m => m.id === song.id);
                return (
                  <div key={song.id} className="flex items-center gap-4 bg-black/40 p-3 rounded-lg border border-white/5">
                    <img src={song.thumbnail} className="w-12 h-12 rounded object-cover" referrerPolicy="no-referrer" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <MarqueeText text={song.title} className="font-bold text-sm" />
                        {isMock ? (
                          <span className="text-[8px] bg-zinc-800 text-zinc-500 px-1 rounded uppercase font-bold">System</span>
                        ) : (
                          <span className="text-[8px] bg-emerald-500/20 text-emerald-500 px-1 rounded uppercase font-bold">Uploaded</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isMock && (
                        <>
                          <button 
                            onClick={() => handleEditSong(song)}
                            className="p-2 text-zinc-500 hover:text-white transition-colors"
                            title="Edit Song"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteSong(song.id)}
                            className="p-2 text-zinc-500 hover:text-netflix-red transition-colors"
                            title="Delete Song"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {songs.length === 0 && (
                <div className="text-center py-10 text-zinc-500 text-sm italic">No songs available.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [showSplash, setShowSplash] = useState(false);
  const [user, setUser] = useState<User | null>(() => {
    // Initial offline auth check
    const savedUser = localStorage.getItem('sonik_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<Song[] | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState<Song | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const location = useLocation();

  // Sync user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('sonik_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('sonik_user');
    }
  }, [user]);

  // Handle deep links for Google Sign-in
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleDeepLink = async (url: string) => {
      console.log('Handling deep link:', url);
      if (url.includes('sonik://auth-success')) {
        try {
          // URL constructor doesn't like custom schemes, so we normalize it
          const normalizedUrl = url.replace('sonik://', 'http://sonik/');
          const urlObj = new URL(normalizedUrl);
          const accessToken = urlObj.searchParams.get('access_token');
          const idToken = urlObj.searchParams.get('id_token');
          const provider = urlObj.searchParams.get('provider');

          if (provider === 'github' && accessToken) {
            const credential = GithubAuthProvider.credential(accessToken);
            await signInWithCredential(auth, credential);
            toast.success('Signed in with GitHub!');
          } else if (idToken) {
            const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
            await signInWithCredential(auth, credential);
            toast.success('Signed in with Google!');
          }

          // Close the browser if it's still open
          try {
            await Browser.close();
          } catch (e) {
            // Browser might already be closed
          }
        } catch (error: any) {
          console.error('Deep link auth error:', error);
          toast.error('Authentication failed via deep link');
        }
      }
    };

    const subPromise = CapApp.addListener('appUrlOpen', (data: any) => {
      handleDeepLink(data.url);
    });

    // Check if app was opened via deep link initially
    CapApp.getLaunchUrl().then((data) => {
      if (data && data.url) {
        handleDeepLink(data.url);
      }
    });

    return () => {
      subPromise.then(sub => sub.remove());
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('sonik_user');
      setCurrentSong(null);
      setIsPlaying(false);
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const handleRefreshSongs = async () => {
    setLoadingSongs(true);
    try {
      let remoteSongs: Song[] = [];
      if (navigator.onLine) {
        try {
          const q = query(collection(db, 'songs'), orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          remoteSongs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Song));
        } catch (e) {
          console.warn("Failed to fetch remote songs", e);
        }
      }
      
      const localSongs = await scanLocalMusic();
      const localSongsWithFlag = localSongs.map(s => ({ ...s, isOffline: true }));
      
      setSongs([...MOCK_SONGS, ...remoteSongs, ...localSongsWithFlag]);
    } catch (error) {
      console.error("Error fetching songs:", error);
    } finally {
      setLoadingSongs(false);
    }
  };

  const handleDeleteSong = async (id: string) => {
    console.log("handleDeleteSong called with:", id);
    if (!user?.isAdmin) {
      console.log("handleDeleteSong: user is not admin");
      toast.error("Only admins can delete songs");
      return;
    }
    try {
      await deleteDoc(doc(db, 'songs', id));
      toast.success("Song deleted permanently");
      handleRefreshSongs();
      
      if (currentPlaylist) {
        setCurrentPlaylist(prev => prev ? prev.filter(s => s.id !== id) : null);
      }

      if (currentSong?.id === id) {
        if (songs.length > 1) {
          const currentIndex = songs.findIndex(s => s.id === id);
          const nextIndex = (currentIndex + 1) % songs.length;
          setCurrentSong(songs[nextIndex]);
          setIsPlaying(true);
        } else {
          setCurrentSong(null);
          setIsPlaying(false);
        }
      }
      console.log("handleDeleteSong: success");
    } catch (error) {
      console.error("Error deleting song:", error);
      toast.error("Failed to delete song");
    }
  };

  // Sync with Firebase Auth state and User Document
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      handleRefreshSongs();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for subscription expiry and cleanup
    const checkSubscriptionAndCleanup = async () => {
      const savedUser = localStorage.getItem('sonik_user');
      if (!savedUser) return;

      const parsedUser = JSON.parse(savedUser) as User;
      const now = Date.now();
      
      // If subscription expired
      if (parsedUser.subscriptionEndsAt && parsedUser.subscriptionEndsAt < now) {
        console.log("Subscription expired, showing modal...");
        
        // Record expiry date if not already recorded
        if (!localStorage.getItem('sonik_expiry_date')) {
          localStorage.setItem('sonik_expiry_date', parsedUser.subscriptionEndsAt.toString());
        }

        // Show modal instead of auto logout
        setShowSubModal(true);
      } else {
        // Clear expiry date if subscription is active
        localStorage.removeItem('sonik_expiry_date');
      }

      // Check for 3-day cleanup
      const expiryDateStr = localStorage.getItem('sonik_expiry_date');
      if (expiryDateStr) {
        const expiryDate = parseInt(expiryDateStr);
        const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
        
        if (now - expiryDate > threeDaysInMs) {
          console.log("Subscription expired for > 3 days, cleaning up local files...");
          try {
            if (Capacitor.isNativePlatform()) {
              const path = 'MusicApp/songs';
              const result = await Filesystem.readdir({
                path,
                directory: Directory.ExternalStorage
              });
              
              for (const file of result.files) {
                await Filesystem.deleteFile({
                  path: `${path}/${file.name}`,
                  directory: Directory.ExternalStorage
                });
              }
              console.log("Cleanup complete.");
              localStorage.removeItem('sonik_expiry_date');
            }
          } catch (err) {
            console.error("Cleanup failed:", err);
          }
        }
      }
    };

    checkSubscriptionAndCleanup();

    // Fallback for initializing state to prevent freeze
    const timeout = setTimeout(() => {
      if (initializing) {
        console.warn("Initialization timed out, proceeding to app...");
        setInitializing(false);
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(timeout);
    };
  }, [initializing]);

  useEffect(() => {
    let userDocUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
        userDocUnsubscribe = null;
      }

      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Initial check/setup
        try {
          const userDoc = await getDoc(userDocRef);
          const isAdminEmail = firebaseUser.email === 'indiafff568@gmail.com' || firebaseUser.email === 'gtxnvme@gmail.com';

          if (!userDoc.exists()) {
            const userData = {
              email: firebaseUser.email || '',
              subscription: 'none',
              isAdmin: isAdminEmail,
              playlists: [],
              createdAt: serverTimestamp()
            };
            await setDoc(userDocRef, userData);
          } else {
            const data = userDoc.data();
            // Auto-grant admin privileges if not already set
            if (isAdminEmail && !data.isAdmin) {
              await updateDoc(userDocRef, { isAdmin: true });
            }
          }
        } catch (error) {
          console.error("Error during initial user setup:", error);
        }

        // Real-time listener for user data
        userDocUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("User data received from Firestore:", data);
            let subEndsAt = data.subscriptionEndsAt;
            if (subEndsAt && typeof subEndsAt === 'object' && 'toMillis' in subEndsAt) {
              subEndsAt = subEndsAt.toMillis();
            }

            const userData: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              subscription: data.subscription || 'none',
              subscriptionEndsAt: subEndsAt,
              isAdmin: data.isAdmin || false,
              playlists: data.playlists || [],
              downloads: data.downloads || [],
              profileColor: data.profileColor,
              defaultVolume: data.defaultVolume ?? 0.5,
              aiBoostMode: data.aiBoostMode || 'manual',
              cleanAudio: data.cleanAudio ?? false
            };

            setUser(userData);
          }
          setInitializing(false);
        }, (error) => {
          console.error("User document listener error:", error);
          setInitializing(false);
        });
      } else {
        // If offline and no firebase user, we already initialized from localStorage
        if (!navigator.onLine) {
          const savedUser = localStorage.getItem('sonik_user');
          if (savedUser) {
            setUser(JSON.parse(savedUser));
          }
        } else {
          setUser(null);
          localStorage.removeItem('sonik_user');
        }
        setInitializing(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (userDocUnsubscribe) userDocUnsubscribe();
    };
  }, []);

  // Subscription check effect
  useEffect(() => {
    if (initializing) return;
    
    if (user) {
      const isSubscribed = user.subscription !== 'none' && user.subscriptionEndsAt && user.subscriptionEndsAt > Date.now();
      const isSettingsPage = location.pathname === '/settings';
      
      if (!isSubscribed && !isSettingsPage) {
        setShowSubModal(true);
      } else {
        setShowSubModal(false);
      }
    } else {
      setShowSubModal(false);
    }
  }, [user, initializing, location.pathname]);

  // Fetch songs
  useEffect(() => {
    const fetchAllSongs = async () => {
      setLoadingSongs(true);
      try {
        let remoteSongs: Song[] = [];
        if (navigator.onLine) {
          try {
            const q = query(collection(db, 'songs'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            remoteSongs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Song));
          } catch (e) {
            console.warn("Failed to fetch remote songs, using cache/mock", e);
          }
        }

        // Scan local music (Android /MusicApp/songs)
        const localSongs = await scanLocalMusic();
        const localSongsWithFlag = localSongs.map(s => ({ ...s, isOffline: true }));

        setSongs([...MOCK_SONGS, ...remoteSongs, ...localSongsWithFlag]);
      } catch (error) {
        console.error("Error fetching songs:", error);
        setSongs(MOCK_SONGS);
      } finally {
        setLoadingSongs(false);
      }
    };
    fetchAllSongs();
  }, [isOffline]);

  const handleLogin = (userData: User) => {
    setUser(userData);
    // Check if we should show the subscription modal
    const isSubscribed = userData.subscription !== 'none' && userData.subscriptionEndsAt && userData.subscriptionEndsAt > Date.now();
    if (!isSubscribed) {
      setShowSubModal(true);
    }
  };

  const isSubscribed = () => {
    if (!user) return false;
    const endsAt = typeof user.subscriptionEndsAt === 'number' ? user.subscriptionEndsAt : 0;
    // Safety check: if subscription is 'pro' or 'plus' but endsAt is missing, it might be a legacy account.
    // We'll trust the subscription type for now if endsAt is missing but type is set.
    if (user.subscription !== 'none' && !user.subscriptionEndsAt) return true;
    return user.subscription !== 'none' && endsAt > Date.now();
  };

  const handleUpdateSub = async (type: SubscriptionType, endsAt?: number) => {
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.id);
        const updateData: any = {
          subscription: type,
          updatedAt: serverTimestamp()
        };
        if (endsAt) {
          updateData.subscriptionEndsAt = endsAt;
        }
        
        await updateDoc(userDocRef, updateData);
        
        const updatedUser = { 
          ...user, 
          subscription: type,
          subscriptionEndsAt: endsAt || user.subscriptionEndsAt
        };
        setUser(updatedUser);
        setShowSubModal(false);
      } catch (error) {
        console.error("Error updating subscription:", error);
        toast.error("Failed to update subscription");
      }
    }
  };

  const handleUpdateSettings = async (settings: Partial<User>) => {
    if (user) {
      // Restriction: Plus users cannot enable AI features
      if (user.subscription === 'plus') {
        if (settings.aiBoostMode && settings.aiBoostMode !== 'off') {
          toast.error("AI Boost is a Pro feature!");
          return;
        }
        if (settings.cleanAudio === true) {
          toast.error("Clean Audio is a Pro feature!");
          return;
        }
      }

      console.log("Updating settings in Firestore:", settings);
      // Optimistic update
      const previousUser = { ...user };
      setUser({ ...user, ...settings });
      
      try {
        const userDocRef = doc(db, 'users', user.id);
        await updateDoc(userDocRef, {
          ...settings,
          updatedAt: serverTimestamp()
        });
        console.log("Firestore update successful");
      } catch (error) {
        console.error("Error updating settings in Firestore:", error);
        setUser(previousUser); // Rollback
        toast.error("Failed to update settings");
      }
    }
  };

  const handleDownloadToApp = async (song: Song) => {
    if (!user) return;
    if (!isSubscribed()) {
      setShowSubModal(true);
      return;
    }
    if (user.subscription !== 'pro') {
      toast.error("Upgrade to Pro to download songs!");
      return;
    }

    try {
      toast.loading(`Downloading ${song.title}...`, { id: 'download' });

      let fetchSuccess = false;
      try {
        // 1. Cache for offline playback using Cache API (Web/PWA)
        const cache = await caches.open('sonik-offline-songs');
        const response = await fetch(song.url);
        
        if (response.ok) {
          const blob = await response.blob();
          
          // Store in Cache API
          await cache.put(song.url, new Response(blob));

          // 2. Store in Capacitor Filesystem if native (Android)
          if (Capacitor.isNativePlatform()) {
            try {
              // Request permissions first
              const permission = await Filesystem.checkPermissions();
              if (permission.publicStorage !== 'granted') {
                await Filesystem.requestPermissions();
              }

              const reader = new FileReader();
              reader.readAsDataURL(blob);
              reader.onloadend = async () => {
                const base64data = reader.result as string;
                // Remove the data:audio/mpeg;base64, prefix if present
                const base64Content = base64data.split(',')[1] || base64data;
                const fileName = `MusicApp/songs/${song.id}.mp3`;
                
                await Filesystem.writeFile({
                  path: fileName,
                  data: base64Content,
                  directory: Directory.ExternalStorage,
                  recursive: true
                });
                console.log("Saved to native filesystem:", fileName);
              };
            } catch (fsErr) {
              console.error("Failed to save to native filesystem:", fsErr);
            }
          }

          // 3. Trigger browser download (for local device storage)
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${song.title} - ${song.artist}.mp3`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          fetchSuccess = true;
        }
      } catch (fetchError) {
        console.warn("Fetch failed (likely CORS), falling back to direct download link:", fetchError);
      }

      // Fallback if fetch failed or response was not ok
      if (!fetchSuccess) {
        const link = document.createElement('a');
        link.href = song.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        // Note: 'download' attribute only works for same-origin URLs or certain configurations
        link.download = `${song.title} - ${song.artist}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Download started via browser`, { id: 'download' });
      } else {
        toast.success(`${song.title} saved for offline and downloaded!`, { id: 'download' });
      }

      // 3. Save metadata to Firestore
      const userDocRef = doc(db, 'users', user.id);
      const currentDownloads = user.downloads || [];
      
      if (!currentDownloads.includes(song.id)) {
        const updatedDownloads = [...currentDownloads, song.id];
        await updateDoc(userDocRef, { downloads: updatedDownloads });
        setUser({ ...user, downloads: updatedDownloads });
      }
    } catch (error) {
      console.error("Error downloading song:", error);
      toast.error("Failed to download song", { id: 'download' });
    }
  };

  const handleRemoveDownload = async (songId: string) => {
    if (!user) return;
    
    try {
      const song = songs.find(s => s.id === songId);
      if (song) {
        // 1. Remove from Cache API
        const cache = await caches.open('sonik-offline-songs');
        await cache.delete(song.url);

        // 2. Remove from Capacitor Filesystem if native
        if (Capacitor.isNativePlatform()) {
          try {
            const fileName = `MusicApp/songs/${song.id}.mp3`;
            await Filesystem.deleteFile({
              path: fileName,
              directory: Directory.ExternalStorage
            });
            console.log("Removed from native filesystem:", fileName);
          } catch (fsErr) {
            console.warn("Could not find file in native filesystem to delete", fsErr);
          }
        }
      }

      const userDocRef = doc(db, 'users', user.id);
      const updatedDownloads = (user.downloads || []).filter(id => id !== songId);
      
      await updateDoc(userDocRef, { downloads: updatedDownloads });
      setUser({ ...user, downloads: updatedDownloads });
      toast.success("Download removed from offline storage");
    } catch (error) {
      console.error("Error removing download:", error);
      toast.error("Failed to remove download");
    }
  };

  const handleAddToPlaylist = async (playlistId: string, song: Song) => {
    if (!user) return;
    if (!isSubscribed()) {
      setShowSubModal(true);
      return;
    }
    
    try {
      const userDocRef = doc(db, 'users', user.id);
      let songWithLabel = { ...song };
      
      const updatedPlaylists = user.playlists.map(pl => {
        if (pl.id === playlistId) {
          if (pl.songs.some(s => s.id === song.id)) {
            toast.error("Song already in playlist!");
            return pl;
          }
          // Assign a label based on current playlist length (a, b, c...)
          const label = String.fromCharCode(97 + (pl.songs.length % 26));
          songWithLabel = { ...song, label };
          return { ...pl, songs: [...pl.songs, songWithLabel] };
        }
        return pl;
      });

      await updateDoc(userDocRef, { playlists: updatedPlaylists });
      setUser({ ...user, playlists: updatedPlaylists });
      setShowPlaylistModal(false);
      toast.success(`Added to playlist!`);

      // Automatic download for offline playback
      if (user.subscription === 'pro') {
        handleDownloadToApp(songWithLabel);
      }
    } catch (error) {
      console.error("Error adding to playlist:", error);
      toast.error("Failed to add to playlist");
    }
  };

  const handleUpdatePlaylist = async (playlistId: string, songs: Song[]) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.id);
      const updatedPlaylists = (user.playlists || []).map(pl => {
        if (pl.id === playlistId) {
          return { ...pl, songs };
        }
        return pl;
      });

      await updateDoc(userDocRef, { playlists: updatedPlaylists });
      setUser({ ...user, playlists: updatedPlaylists });
    } catch (error) {
      console.error("Error updating playlist:", error);
      toast.error("Failed to update playlist");
    }
  };

  const handleCreatePlaylist = async (name: string) => {
    if (!user) return;
    if (!isSubscribed()) {
      setShowSubModal(true);
      return;
    }
    const isPro = user.subscription === 'pro';
    const limit = isPro ? 12 : 1;

    if (user.playlists.length >= limit) {
      toast.error(`Upgrade to Pro for more than ${limit} playlists!`);
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.id);
      const newPlaylist: Playlist = {
        id: Math.random().toString(36).substr(2, 9),
        name,
        songs: []
      };
      const updatedPlaylists = [...user.playlists, newPlaylist];
      
      await updateDoc(userDocRef, { playlists: updatedPlaylists });
      setUser({ ...user, playlists: updatedPlaylists });
      toast.success("Playlist created!");
    } catch (error) {
      console.error("Error creating playlist:", error);
      toast.error("Failed to create playlist");
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    console.log("handleDeletePlaylist called with:", playlistId);
    if (!user) {
      console.log("handleDeletePlaylist: user not found");
      return;
    }
    try {
      const userDocRef = doc(db, 'users', user.id);
      const updatedPlaylists = (user.playlists || []).filter(pl => pl.id !== playlistId);
      
      await updateDoc(userDocRef, { playlists: updatedPlaylists });
      setUser({ ...user, playlists: updatedPlaylists });
      handleRefreshUser();
      toast.success("Playlist deleted");
      console.log("handleDeletePlaylist: success");
    } catch (error) {
      console.error("Error deleting playlist:", error);
      toast.error("Failed to delete playlist");
    }
  };

  const handlePlay = (song: Song, playlist?: Song[]) => {
    if (!user) return;
    
    if (!isSubscribed()) {
      setShowSubModal(true);
      toast.error("Subscription required to play music");
      return;
    }

    setCurrentSong(song);
    if (playlist) {
      setCurrentPlaylist(playlist);
    } else {
      setCurrentPlaylist(null);
    }
    setIsPlaying(true);
  };

  const handleNext = () => {
    const queue = currentPlaylist && currentPlaylist.length > 0 ? currentPlaylist : songs;
    if (queue.length === 0) {
      if (currentPlaylist) {
        setCurrentPlaylist(null);
        if (songs.length > 0) {
          setCurrentSong(songs[0]);
          setIsPlaying(true);
        } else {
          setCurrentSong(null);
          setIsPlaying(false);
        }
      } else {
        setCurrentSong(null);
        setIsPlaying(false);
      }
      return;
    }
    
    const currentIndex = queue.findIndex(s => s.id === currentSong?.id);
    
    if (currentPlaylist && currentPlaylist.length > 0) {
      // Check if this is an offline/downloads playlist
      const isOfflinePlaylist = currentPlaylist.every(s => user?.downloads?.includes(s.id));

      if (currentIndex === queue.length - 1 || currentIndex === -1) {
        if (isOfflinePlaylist) {
          // Loop back to the beginning for offline playlist
          setCurrentSong(queue[0]);
          setIsPlaying(true);
        } else {
          // Playlist ended or song not found in playlist, switch to global stream
          setCurrentPlaylist(null);
          if (songs.length > 0) {
            // Play a random song from global stream
            const nextGlobalIndex = Math.floor(Math.random() * songs.length);
            setCurrentSong(songs[nextGlobalIndex]);
            setIsPlaying(true);
          } else {
            setCurrentSong(null);
            setIsPlaying(false);
          }
        }
      } else {
        const nextIndex = currentIndex + 1;
        setCurrentSong(queue[nextIndex]);
        setIsPlaying(true);
      }
    } else {
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % queue.length;
      setCurrentSong(queue[nextIndex]);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    const queue = currentPlaylist && currentPlaylist.length > 0 ? currentPlaylist : songs;
    if (queue.length === 0) {
      setCurrentSong(null);
      setIsPlaying(false);
      return;
    }
    
    const currentIndex = queue.findIndex(s => s.id === currentSong?.id);
    const prevIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + queue.length) % queue.length;
    setCurrentSong(queue[prevIndex]);
    setIsPlaying(true);
  };

  const handleRefreshUser = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUser({
          ...user,
          subscription: data.subscription || 'none',
          subscriptionEndsAt: data.subscriptionEndsAt,
          isAdmin: data.isAdmin,
          playlists: data.playlists || [],
          downloads: data.downloads || [],
          defaultVolume: data.defaultVolume ?? user.defaultVolume ?? 0.5,
          aiBoostMode: data.aiBoostMode || user.aiBoostMode || 'manual',
          cleanAudio: data.cleanAudio ?? user.cleanAudio ?? false,
          profileColor: data.profileColor || user.profileColor
        });
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  };

  if (showSplash) {
    return (
      <AnimatePresence mode="wait">
        <SplashScreen onComplete={() => setShowSplash(false)} />
      </AnimatePresence>
    );
  }

  if (initializing) {
    return (
      <div className="min-h-screen bg-netflix-dark flex flex-col items-center justify-center gap-6">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-netflix-red border-t-transparent rounded-full"
        />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">SONIK</h2>
          <p className="text-zinc-500 text-sm animate-pulse">
            {navigator.onLine ? 'Initializing secure session...' : 'Offline Mode: Loading local library...'}
          </p>
        </div>
        {!navigator.onLine && (
          <button 
            onClick={() => setInitializing(false)}
            className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition-all"
          >
            Continue Offline
          </button>
        )}
      </div>
    );
  }

  const handleOpenPlaylistModal = (song: Song) => {
    setSelectedSongForPlaylist(song);
    setShowPlaylistModal(true);
  };

  if (!user) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        <Toaster position="top-center" toastOptions={{ style: { background: '#141414', color: '#fff', border: '1px solid #333' } }} />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-netflix-dark overflow-hidden">
      {isOffline && (
        <div className="bg-netflix-red text-white py-2 px-4 text-center text-[10px] font-bold flex items-center justify-center gap-2 z-[100] sticky top-0 uppercase tracking-widest">
          <WifiOff size={14} />
          Offline Mode: Only downloaded songs are available
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar user={user} onLogout={handleLogout} />
        
        <main className="flex-1 overflow-y-auto no-scrollbar">
          <MobileHeader user={user} />
          <Routes>
            <Route path="/" element={<HomePage onPlay={handlePlay} user={user} songs={songs} loadingSongs={loadingSongs} onAddToPlaylist={handleOpenPlaylistModal} onDeleteSong={handleDeleteSong} />} />
            <Route path="/search" element={<SearchPage songs={songs} onPlay={handlePlay} user={user} onAddToPlaylist={handleOpenPlaylistModal} onDeleteSong={handleDeleteSong} />} />
            <Route path="/library" element={
              <LibraryPage 
                user={user} 
                onPlay={handlePlay} 
                onCreatePlaylist={handleCreatePlaylist} 
                onUpdatePlaylist={handleUpdatePlaylist} 
                onRefresh={handleRefreshSongs} 
                onRefreshUser={handleRefreshUser} 
                onDeleteSong={handleDeleteSong}
                onDeletePlaylist={handleDeletePlaylist}
                currentSong={currentSong}
                onStop={() => {
                  setCurrentSong(null);
                  setIsPlaying(false);
                }}
              />
            } />
            <Route path="/downloads" element={<DownloadsPage user={user} onPlay={handlePlay} songs={songs} onDownload={handleDownloadToApp} onRemoveDownload={handleRemoveDownload} onAddToPlaylist={handleOpenPlaylistModal} onDeleteSong={handleDeleteSong} />} />
            <Route path="/settings" element={<SettingsPage user={user} onUpdateSub={handleUpdateSub} onLogout={handleLogout} onRefresh={handleRefreshUser} onUpdateSettings={handleUpdateSettings} />} />
            <Route path="/admin" element={<AdminPage user={user} songs={songs} onRefreshSongs={handleRefreshSongs} onDeleteSong={handleDeleteSong} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

      <Player 
        currentSong={currentSong} 
        isPlaying={isPlaying} 
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onNext={handleNext}
        onPrev={handlePrev}
        onClose={() => {
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.playbackState = 'none';
          }
          setCurrentSong(null);
          setIsPlaying(false);
        }}
        onDownload={handleDownloadToApp}
        onDelete={handleDeleteSong}
        onAddToPlaylist={handleOpenPlaylistModal}
        user={user}
      />

      <MobileNav />

      <AnimatePresence>
        {showSubModal && user && (
          <SubscriptionModal 
            user={user}
            onLogout={handleLogout} 
            onRefresh={handleRefreshUser} 
            onUpdateSub={handleUpdateSub}
          />
        )}
        {showPlaylistModal && selectedSongForPlaylist && (
          <PlaylistModal 
            user={user} 
            song={selectedSongForPlaylist} 
            onClose={() => setShowPlaylistModal(false)}
            onAdd={handleAddToPlaylist}
            onCreate={handleCreatePlaylist}
          />
        )}
      </AnimatePresence>

      <Toaster 
        position="top-center" 
        toastOptions={{ 
          style: { 
            background: '#141414', 
            color: '#fff', 
            border: '1px solid #333',
            fontSize: '14px',
            fontWeight: '600'
          } 
        }} 
      />
      </div>
    </div>
  );
}
