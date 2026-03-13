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
  WifiOff
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
  signInWithPopup
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
  orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User, Song, Playlist, SubscriptionType } from './types';
import { MOCK_SONGS } from './constants';

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

// --- Components ---

const Sidebar = ({ user, onLogout }: { user: User | null; onLogout: () => void }) => {
  const location = useLocation();
  
  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: Library, label: 'Your Library', path: '/library' },
    { icon: Download, label: 'Downloads', path: '/downloads' },
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

const MobileNav = () => {
  const location = useLocation();
  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: Library, label: 'Library', path: '/library' },
    { icon: Download, label: 'Downloads', path: '/downloads' },
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

const Player = ({ 
  currentSong, 
  isPlaying, 
  onTogglePlay, 
  onNext, 
  onPrev,
  onClose,
  user
}: { 
  currentSong: Song | null; 
  isPlaying: boolean; 
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  user: User | null;
}) => {
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isSubscribed = user?.subscription !== 'none' && user?.subscriptionEndsAt && user.subscriptionEndsAt > Date.now();

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const loadAudio = async () => {
      if (currentSong && audioRef.current) {
        try {
          // Check if song is in offline cache
          const cache = await caches.open('sonik-offline-songs');
          const cachedResponse = await cache.match(currentSong.url);
          
          if (cachedResponse) {
            const blob = await cachedResponse.blob();
            const blobUrl = URL.createObjectURL(blob);
            audioRef.current.src = blobUrl;
            console.log("Playing from offline cache:", currentSong.title);
          } else {
            audioRef.current.src = currentSong.url;
          }

          if (isPlaying) {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch(e => {
                if (e.name !== 'AbortError') {
                  console.error("Playback failed", e);
                }
              });
            }
          }
        } catch (error) {
          console.error("Error loading audio:", error);
          audioRef.current.src = currentSong.url;
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
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            if (e.name !== 'AbortError') {
              console.error("Playback failed", e);
            }
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

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

  const isPro = user?.subscription === 'pro';

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-xl border-t border-white/5 px-4 py-3 md:px-6 md:py-4 flex flex-col gap-2 z-40 mb-[60px] md:mb-0">
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate} 
        onEnded={onNext}
      />
      
      {/* Mobile Progress Bar */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-[2px] bg-zinc-800">
        <div 
          className="h-full bg-netflix-red transition-all duration-100" 
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="flex items-center justify-between">
        {/* Song Info */}
        <div className="flex items-center gap-3 w-1/3">
          <img 
            src={currentSong.thumbnail} 
            alt={currentSong.title} 
            className="w-12 h-12 rounded object-cover shadow-lg"
            referrerPolicy="no-referrer"
          />
          <div className="overflow-hidden">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold truncate flex-1">{currentSong.title}</h4>
              {user?.downloads?.includes(currentSong.id) && (
                <WifiOff size={12} className="text-emerald-500 flex-shrink-0" title="Playing offline" />
              )}
            </div>
            <p className="text-xs text-zinc-400 truncate">{currentSong.artist}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-2 flex-1">
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

        {/* Extra Controls */}
        <div className="flex items-center justify-end gap-4 w-1/3">
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
          
          {isPro && (
            <button 
              onClick={() => toast.success('Downloading song...')}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <Download size={18} />
            </button>
          )}
          
          {isPro && (
            <button 
              onClick={() => toast.success('Link copied to clipboard!')}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <Share2 size={18} />
            </button>
          )}

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
  );
};

const SubscriptionModal = ({ onSelect, onLogout }: { onSelect: (type: SubscriptionType, endsAt?: number) => void; onLogout: () => void }) => {
  const [selectedPlan, setSelectedPlan] = useState<'plus' | 'pro'>('pro');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-2xl w-full shadow-2xl"
      >
        <h2 className="text-3xl font-bold text-center mb-2">Subscription Required</h2>
        <p className="text-zinc-400 text-center mb-8">Unlock the full Sonik experience with a redeem code</p>
        
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
                className={cn("text-xl font-bold", selectedPlan === 'plus' ? "text-netflix-red" : "text-white")}
              >
                Plus
              </motion.h3>
              <p className="text-sm text-zinc-500 mt-1">Basic Premium Access</p>
            </div>
            <ul className="text-sm space-y-3 mb-8 flex-1">
              <li className="flex items-center gap-2 text-zinc-300"><Plus size={14} /> Unlimited song play</li>
              <li className="flex items-center gap-2 text-zinc-300"><Plus size={14} /> 2 Playlists limit</li>
              <li className="flex items-center gap-2 text-zinc-300"><Plus size={14} /> Contains Ads</li>
            </ul>
            <Link 
              to="/settings"
              onClick={() => onSelect('none')}
              className={cn(
                "w-full py-3 font-bold rounded-lg transition-colors text-center",
                selectedPlan === 'plus' ? "bg-netflix-red text-white hover:bg-red-700" : "bg-white text-black hover:bg-zinc-200"
              )}
            >
              Redeem Plus
            </Link>
          </motion.div>

          {/* Pro Plan */}
          <motion.div 
            onClick={() => setSelectedPlan('pro')}
            animate={{ 
              y: selectedPlan === 'pro' ? [0, -12, 0] : [0, -6, 0],
              x: selectedPlan === 'pro' ? [0, 4, -4, 0] : 0,
              rotate: selectedPlan === 'pro' ? [0, 1, -1, 0] : 0,
              boxShadow: selectedPlan === 'pro' ? [
                "0 0 20px rgba(229,9,20,0.1)",
                "0 0 35px rgba(229,9,20,0.3)",
                "0 0 20px rgba(229,9,20,0.1)"
              ] : "none"
            }}
            transition={{ 
              duration: selectedPlan === 'pro' ? 6 : 5, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            whileHover={{ scale: 1.05, translateY: -8, rotate: 0 }}
            whileTap={{ 
              scale: 0.95, 
              x: [0, -6, 6, -6, 6, 0],
              rotate: [0, -2, 2, -2, 2, 0]
            }}
            className={cn(
              "rounded-xl p-6 flex flex-col relative overflow-hidden cursor-pointer group transition-all duration-500",
              selectedPlan === 'pro' 
                ? "bg-netflix-red/10 border border-netflix-red/50 shadow-[0_0_20px_rgba(229,9,20,0.1)]" 
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
            <motion.div 
              animate={{ 
                opacity: selectedPlan === 'pro' ? [0.8, 1, 0.8] : 0.5,
                y: selectedPlan === 'pro' ? [0, -4, 0] : 0
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                y: { duration: 3, repeat: Infinity, ease: "easeInOut" }
              }}
              className={cn(
                "absolute top-0 right-0 text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-tighter transition-colors",
                selectedPlan === 'pro' ? "bg-netflix-red text-white" : "bg-zinc-700 text-zinc-400"
              )}
            >
              Best Value
            </motion.div>
            <div className="mb-4">
              <motion.h3 
                animate={selectedPlan === 'pro' ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className={cn("text-xl font-bold", selectedPlan === 'pro' ? "text-netflix-red" : "text-white")}
              >
                Pro Plus
              </motion.h3>
              <p className="text-sm text-zinc-500 mt-1">Full Premium Access</p>
            </div>
            <ul className="text-sm space-y-3 mb-8 flex-1">
              <li className="flex items-center gap-2 text-zinc-300"><Plus size={14} /> No Ads</li>
              <li className="flex items-center gap-2 text-zinc-300"><Plus size={14} /> Unlimited downloads</li>
              <li className="flex items-center gap-2 text-zinc-300"><Plus size={14} /> 10 Playlists</li>
              <li className="flex items-center gap-2 text-zinc-300"><Plus size={14} /> Background play</li>
            </ul>
            <Link 
              to="/settings"
              onClick={() => onSelect('none')}
              className={cn(
                "w-full py-3 font-bold rounded-lg transition-colors text-center",
                selectedPlan === 'pro' ? "bg-netflix-red text-white hover:bg-red-700" : "bg-white text-black hover:bg-zinc-200"
              )}
            >
              Redeem Pro
            </Link>
          </motion.div>
        </div>
        
        <button 
          onClick={onLogout}
          className="w-full mt-6 py-3 border border-white/10 text-white font-bold rounded-lg hover:bg-white/5 transition-colors text-sm flex items-center justify-center gap-2"
        >
          <LogOut size={16} />
          Logout
        </button>
      </motion.div>
    </div>
  );
};

// --- Pages ---

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
          subscription: data.subscription || 'plus',
          playlists: data.playlists || []
        };
      } else {
        userData = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          subscription: 'plus',
          playlists: []
        };
        await setDoc(userDocRef, {
          email: userData.email,
          subscription: userData.subscription,
          playlists: userData.playlists,
          createdAt: serverTimestamp()
        });
      }
      
      onLogin(userData);
      toast.success(isRegister ? 'Account created!' : 'Welcome back!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
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
          subscription: data.subscription || 'plus',
          playlists: data.playlists || []
        };
      } else {
        userData = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          subscription: 'plus',
          playlists: []
        };
        await setDoc(userDocRef, {
          email: userData.email,
          subscription: userData.subscription,
          playlists: userData.playlists,
          createdAt: serverTimestamp()
        });
      }
      
      onLogin(userData);
      toast.success('Signed in with Google!');
    } catch (error: any) {
      console.error(error);
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error(error.message || 'Google Sign-In failed');
      }
    } finally {
      setLoading(false);
    }
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

          <button 
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full mt-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>

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

const SearchPage = ({ songs, onPlay, user, onDownload, onAddToPlaylist }: { 
  songs: Song[]; 
  onPlay: (song: Song) => void; 
  user: User | null;
  onDownload: (song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
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
              <div className="relative w-12 h-12 flex-shrink-0" onClick={() => onPlay(song)}>
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
              <div className="flex-1 min-w-0" onClick={() => onPlay(song)}>
                <h3 className="font-bold text-sm truncate">{song.title}</h3>
                <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onAddToPlaylist(song)}
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <Plus size={18} />
                </button>
                <button 
                  onClick={() => onDownload(song)}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    isPro ? "text-emerald-500 hover:bg-emerald-500/10" : "text-zinc-600"
                  )}
                >
                  <Download size={18} />
                </button>
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

        <div className="p-6 max-h-[400px] overflow-y-auto space-y-2">
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

const HomePage = ({ onPlay, user, songs, loadingSongs, onDownload, onAddToPlaylist }: { 
  onPlay: (song: Song) => void; 
  user: User | null; 
  songs: Song[]; 
  loadingSongs: boolean;
  onDownload: (song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
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
                      onClick={() => onPlay(song)}
                      className="w-12 h-12 bg-netflix-red rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                    >
                      <Play size={24} fill="white" className="ml-1" />
                    </button>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => onDownload(song)}
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-xl",
                          isPro ? "bg-emerald-500 text-white" : "bg-zinc-800/80 text-zinc-400"
                        )}
                      >
                        <Download size={20} />
                      </button>
                      <button 
                        onClick={() => onAddToPlaylist(song)}
                        className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-xl"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm truncate flex-1">{song.title}</h3>
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
              <div className="relative w-16 h-16 flex-shrink-0" onClick={() => onPlay(song)}>
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
              <div className="flex-1 min-w-0" onClick={() => onPlay(song)}>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold truncate flex-1">{song.title}</h3>
                  {user?.downloads?.includes(song.id) && (
                    <WifiOff size={12} className="text-emerald-500 flex-shrink-0" title="Available offline" />
                  )}
                </div>
                <p className="text-sm text-zinc-500 truncate">{song.artist}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onAddToPlaylist(song)}
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                  title="Add to Playlist"
                >
                  <Plus size={20} />
                </button>
                <button 
                  onClick={() => onDownload(song)}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    isPro ? "text-emerald-500 hover:bg-emerald-500/10" : "text-zinc-600"
                  )}
                >
                  <Download size={20} />
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
  onRefreshUser
}: { 
  user: User | null; 
  onPlay: (song: Song) => void;
  onCreatePlaylist: (name: string) => void;
  onUpdatePlaylist: (playlistId: string, songs: Song[]) => void;
  onRefresh: () => void;
  onRefreshUser: () => void;
}) => {
  const isPro = user?.subscription === 'pro';
  const limit = isPro ? 10 : 2;
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewingPlaylist, setViewingPlaylist] = useState<Playlist | null>(null);

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
    const targetPos = prompt(`Move song to position (1-${viewingPlaylist.songs.length}):`, (songIndex + 1).toString());
    if (targetPos === null) return;
    
    const newIndex = parseInt(targetPos) - 1;
    if (isNaN(newIndex) || newIndex < 0 || newIndex >= viewingPlaylist.songs.length) {
      toast.error("Invalid position");
      return;
    }

    const newSongs = [...viewingPlaylist.songs];
    const [movedSong] = newSongs.splice(songIndex, 1);
    newSongs.splice(newIndex, 0, movedSong);
    
    onUpdatePlaylist(playlistId, newSongs);
    setViewingPlaylist({ ...viewingPlaylist, songs: newSongs });
    toast.success("Position updated");
  };

  if (viewingPlaylist) {
    return (
      <div className="p-6 md:p-10 pb-32">
        <button 
          onClick={() => setViewingPlaylist(null)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-8 transition-colors"
        >
          <SkipBack size={18} />
          Back to Library
        </button>

        <div className="flex items-end gap-6 mb-10">
          <div className="w-48 h-48 bg-netflix-red/10 text-netflix-red rounded-2xl flex items-center justify-center shadow-2xl">
            <Library size={80} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Playlist</p>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4">{viewingPlaylist.name}</h1>
            <p className="text-sm text-zinc-400 font-medium">{viewingPlaylist.songs.length} songs • Created by you</p>
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
                    onClick={() => onPlay(song)}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Play size={16} fill="white" />
                  </button>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate group-hover:text-netflix-red transition-colors flex-1">{song.title}</p>
                    {user?.downloads?.includes(song.id) && (
                      <WifiOff size={12} className="text-emerald-500 flex-shrink-0" title="Available offline" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
                </div>
              </div>
              <div className="relative">
                <button 
                  onClick={() => handleMoveSong(viewingPlaylist.id, index)}
                  className="p-2 text-zinc-500 hover:text-white transition-colors"
                  title="Edit Position"
                >
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>
          ))}

          {viewingPlaylist.songs.length === 0 && (
            <div className="text-center py-20 text-zinc-500 italic">
              This playlist is empty. Add some music!
            </div>
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
                <div className="w-12 h-12 bg-netflix-red/10 text-netflix-red rounded-full flex items-center justify-center">
                  <Library size={24} />
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
                      onClick={() => onPlay(song)}
                    >
                      <div className="w-8 h-8 rounded bg-zinc-800 flex-shrink-0 overflow-hidden">
                        <img src={song.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-netflix-red transition-colors">{song.title}</p>
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

const DownloadsPage = ({ user, onPlay, songs, onDownload, onAddToPlaylist }: { 
  user: User | null; 
  onPlay: (song: Song) => void; 
  songs: Song[];
  onDownload: (song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
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
                  <div className="flex-1">
                    <h3 className="font-bold">{song.title}</h3>
                    <p className="text-sm text-zinc-500">{song.artist}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onPlay(song)}
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
                <div className="flex-1">
                  <h3 className="font-bold">{song.title}</h3>
                  <p className="text-sm text-zinc-500">{song.artist}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onPlay(song)}
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
                  <button 
                    onClick={() => onDownload(song)}
                    className="p-2 text-netflix-red"
                  >
                    <Download size={20} />
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

const SettingsPage = ({ user, onUpdateSub, onLogout, onRefresh }: { user: User | null; onUpdateSub: (type: SubscriptionType, endsAt?: number) => void; onLogout: () => void; onRefresh: () => Promise<void> }) => {
  const [redeemCode, setRedeemCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
    toast.success('Subscription status updated!');
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
      
      const planType = codeData.type || 'plus';
      const daysToAdd = codeData.days || 30;
      
      const currentEndsAt = typeof user.subscriptionEndsAt === 'number' && user.subscriptionEndsAt > Date.now() 
        ? user.subscriptionEndsAt 
        : Date.now();
      
      let newEndsAt = currentEndsAt + (Number(daysToAdd) * 24 * 60 * 60 * 1000);

      // Safety cap: Don't allow more than 10 years
      const tenYearsFromNow = Date.now() + (10 * 365 * 24 * 60 * 60 * 1000);
      if (newEndsAt > tenYearsFromNow) {
        newEndsAt = Date.now() + (Number(daysToAdd) * 24 * 60 * 60 * 1000);
      }

      await updateDoc(doc(db, 'redeem_codes', codeDoc.id), {
        used: true,
        usedBy: user.id,
        usedAt: serverTimestamp()
      });

      onUpdateSub(planType, newEndsAt);
      setRedeemCode('');
      toast.success(`Successfully redeemed ${daysToAdd} days of ${planType.toUpperCase()}!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to redeem code');
    } finally {
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-netflix-red rounded-full flex items-center justify-center text-2xl font-bold">
                  {user?.email[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-xl truncate max-w-[200px] md:max-w-none">{user?.email}</h3>
                  <p className="text-sm text-zinc-500">Member since 2024</p>
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
                      className="p-1 text-zinc-500 hover:text-white transition-colors"
                      title="Refresh Status"
                    >
                      <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Redeem Subscription</h2>
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
            <p className="text-sm text-zinc-400 mb-6">Enter your redeem code to activate or extend your subscription.</p>
            <div className="flex gap-4">
              <input 
                type="text" 
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                className="flex-1 bg-black border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-netflix-red transition-colors font-mono"
              />
              <button 
                onClick={handleRedeem}
                disabled={isRedeeming}
                className="bg-white text-black px-8 py-3 rounded-lg font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {isRedeeming ? 'Verifying...' : 'Redeem'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const AdminPage = ({ user, songs, onRefreshSongs }: { user: User | null; songs: Song[]; onRefreshSongs: () => void }) => {
  const [codes, setCodes] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [newCode, setNewCode] = useState({ code: '', days: 30, type: 'pro' as SubscriptionType });

  // Song Upload State
  const [songUrl, setSongUrl] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [songThumbnail, setSongThumbnail] = useState<File | null>(null);
  const [songDetails, setSongDetails] = useState({ title: '', artist: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

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
      console.log("Attempting to create code:", newCode.code, "as user:", user?.email);
      const codeData = {
        code: newCode.code,
        days: newCode.days,
        type: newCode.type,
        used: false,
        createdAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'redeem_codes', newCode.code), codeData);
      
      // Update local state with a temporary timestamp for immediate UI update
      setCodes([{ ...codeData, id: newCode.code, createdAt: { seconds: Math.floor(Date.now() / 1000) } } as any, ...codes]);
      setNewCode({ code: '', days: 30, type: 'pro' });
      toast.success("Code created!");
    } catch (error: any) {
      console.error("Error creating code:", error);
      if (error.code === 'permission-denied') {
        toast.error("Permission Denied: Check Firestore Rules in Firebase Console.");
      } else {
        toast.error(error.message || "Failed to create code");
      }
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
    if (!confirm("Are you sure you want to delete this song?")) return;
    try {
      await deleteDoc(doc(db, 'songs', id));
      toast.success("Song deleted");
      onRefreshSongs();
    } catch (error) {
      toast.error("Failed to delete song");
    }
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
        url: songUrl,
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
                    title="Generate Random Code"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Days</label>
                  <input 
                    type="number" 
                    value={newCode.days}
                    onChange={(e) => setNewCode({ ...newCode, days: parseInt(e.target.value) })}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-netflix-red text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Type</label>
                  <select 
                    value={newCode.type}
                    onChange={(e) => setNewCode({ ...newCode, type: e.target.value as SubscriptionType })}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-netflix-red text-sm"
                  >
                    <option value="plus">Plus</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
              </div>
              <button 
                onClick={handleCreateCode}
                className="w-full py-3 bg-netflix-red text-white font-bold rounded-lg hover:bg-red-700 transition-colors mt-4"
              >
                Create Code
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
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Song MP3 URL</label>
                <input 
                  type="text" 
                  value={songUrl}
                  onChange={(e) => setSongUrl(e.target.value)}
                  placeholder="https://example.com/song.mp3"
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-netflix-red"
                />
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
            <h2 className="text-sm font-bold uppercase tracking-widest mb-6">Existing Codes</h2>
            {loading ? (
              <div className="text-center py-10 text-zinc-500">Loading codes...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] text-zinc-500 uppercase border-b border-white/5">
                      <th className="pb-3 font-bold">Code</th>
                      <th className="pb-3 font-bold">Type</th>
                      <th className="pb-3 font-bold">Days</th>
                      <th className="pb-3 font-bold">Status</th>
                      <th className="pb-3 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {codes.map((code) => (
                      <tr key={code.id} className="border-b border-white/5 last:border-0">
                        <td className="py-4 font-mono font-bold">{code.code}</td>
                        <td className="py-4 uppercase text-xs">{code.type}</td>
                        <td className="py-4">{code.days}</td>
                        <td className="py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            code.used ? "bg-zinc-800 text-zinc-500" : "bg-emerald-500/20 text-emerald-500"
                          )}>
                            {code.used ? 'Used' : 'Available'}
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
                        <h3 className="font-bold text-sm truncate">{song.title}</h3>
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
  const [user, setUser] = useState<User | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState<Song | null>(null);
  const location = useLocation();

  // Sync with Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          let userData: User;
          const isAdminEmail = firebaseUser.email === 'indiafff568@gmail.com' || firebaseUser.email === 'gtxnvme@gmail.com';

          if (userDoc.exists()) {
            const data = userDoc.data();
            
            // Ensure subscriptionEndsAt is a number (ms)
            let subEndsAt = data.subscriptionEndsAt;
            if (subEndsAt && typeof subEndsAt === 'object' && 'toMillis' in subEndsAt) {
              subEndsAt = subEndsAt.toMillis();
            } else if (typeof subEndsAt !== 'number') {
              subEndsAt = undefined;
            }

            // SAFETY FIX: If subscription is absurdly long (e.g., > 10 years), reset it to 30 days.
            const tenYears = 10 * 365 * 24 * 60 * 60 * 1000;
            if (subEndsAt && subEndsAt > Date.now() + tenYears) {
              console.warn("Absurdly long subscription detected, resetting to 30 days:", subEndsAt);
              subEndsAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
              updateDoc(userDocRef, { subscriptionEndsAt: subEndsAt });
            }

            // TRIAL FIX: If no active subscription, grant a 30-day trial automatically
            if (!data.subscription || data.subscription === 'none' || !subEndsAt || subEndsAt < Date.now()) {
              const thirtyDays = 30 * 24 * 60 * 60 * 1000;
              subEndsAt = Date.now() + thirtyDays;
              updateDoc(userDocRef, { 
                subscription: 'pro', 
                subscriptionEndsAt: subEndsAt 
              });
              data.subscription = 'pro';
            }

            userData = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              subscription: data.subscription || 'pro',
              subscriptionEndsAt: subEndsAt,
              isAdmin: data.isAdmin || isAdminEmail,
              playlists: data.playlists || []
            };

            // Auto-grant admin privileges if not already set
            if (isAdminEmail && !data.isAdmin) {
              await updateDoc(userDocRef, {
                isAdmin: true
              });
              userData.isAdmin = true;
              toast.success("Admin privileges granted!");
            }
          } else {
            // Fallback if doc doesn't exist yet - Grant 30-day trial by default
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            userData = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              subscription: 'pro',
              subscriptionEndsAt: Date.now() + thirtyDays,
              isAdmin: isAdminEmail,
              playlists: []
            };
            
            await setDoc(userDocRef, {
              email: userData.email,
              subscription: userData.subscription,
              subscriptionEndsAt: userData.subscriptionEndsAt,
              isAdmin: userData.isAdmin,
              playlists: userData.playlists,
              createdAt: serverTimestamp()
            });
            
            toast.success("Welcome! You've been granted a 30-day Pro trial.");
          }
          setUser(userData);
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            subscription: 'none',
            playlists: []
          });
        }
      } else {
        setUser(null);
      }
      setInitializing(false);
    });

    return () => unsubscribe();
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
    const fetchSongs = async () => {
      try {
        const q = query(collection(db, 'songs'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedSongs = querySnapshot.docs.map(doc => doc.data() as Song);
        setSongs([...MOCK_SONGS, ...fetchedSongs]);
      } catch (error) {
        console.error("Error fetching songs:", error);
        setSongs(MOCK_SONGS);
      } finally {
        setLoadingSongs(false);
      }
    };
    fetchSongs();
  }, []);

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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setCurrentSong(null);
      setIsPlaying(false);
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Logout failed');
    }
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
        toast.success(`Subscription updated to ${type.toUpperCase()}`);
      } catch (error) {
        console.error("Error updating subscription:", error);
        toast.error("Failed to update subscription");
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
        // 1. Cache for offline playback using Cache API
        const cache = await caches.open('sonik-offline-songs');
        const response = await fetch(song.url);
        
        if (response.ok) {
          // Store the actual audio file in the browser's cache
          await cache.put(song.url, response.clone());

          // 2. Trigger browser download (for local device storage)
          const blob = await response.blob();
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
      const updatedPlaylists = user.playlists.map(pl => {
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
    const limit = isPro ? 10 : 2;

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

  const handlePlay = (song: Song) => {
    if (!user) return;
    
    if (!isSubscribed()) {
      setShowSubModal(true);
      toast.error("Subscription required to play music");
      return;
    }

    setCurrentSong(song);
    setIsPlaying(true);
  };

  const handleNext = () => {
    if (songs.length === 0) return;
    const currentIndex = songs.findIndex(s => s.id === currentSong?.id);
    const nextIndex = (currentIndex + 1) % songs.length;
    setCurrentSong(songs[nextIndex]);
  };

  const handlePrev = () => {
    if (songs.length === 0) return;
    const currentIndex = songs.findIndex(s => s.id === currentSong?.id);
    const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    setCurrentSong(songs[prevIndex]);
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
          downloads: data.downloads || []
        });
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  };

  const handleRefreshSongs = async () => {
    setLoadingSongs(true);
    try {
      const q = query(collection(db, 'songs'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedSongs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Song));
      setSongs([...MOCK_SONGS, ...fetchedSongs]);
    } catch (error) {
      console.error("Error fetching songs:", error);
    } finally {
      setLoadingSongs(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-netflix-dark flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-netflix-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        <Toaster position="top-center" toastOptions={{ style: { background: '#141414', color: '#fff', border: '1px solid #333' } }} />
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-netflix-dark overflow-hidden">
      <Sidebar user={user} onLogout={handleLogout} />
      
      <main className="flex-1 overflow-y-auto h-screen">
        <Routes>
          <Route path="/" element={<HomePage onPlay={handlePlay} user={user} songs={songs} loadingSongs={loadingSongs} onDownload={handleDownloadToApp} onAddToPlaylist={(song) => { setSelectedSongForPlaylist(song); setShowPlaylistModal(true); }} />} />
          <Route path="/search" element={<SearchPage songs={songs} onPlay={handlePlay} user={user} onDownload={handleDownloadToApp} onAddToPlaylist={(song) => { setSelectedSongForPlaylist(song); setShowPlaylistModal(true); }} />} />
          <Route path="/library" element={<LibraryPage user={user} onPlay={handlePlay} onCreatePlaylist={handleCreatePlaylist} onUpdatePlaylist={handleUpdatePlaylist} onRefresh={handleRefreshSongs} onRefreshUser={handleRefreshUser} />} />
          <Route path="/downloads" element={<DownloadsPage user={user} onPlay={handlePlay} songs={songs} onDownload={handleDownloadToApp} onAddToPlaylist={(song) => { setSelectedSongForPlaylist(song); setShowPlaylistModal(true); }} />} />
          <Route path="/settings" element={<SettingsPage user={user} onUpdateSub={handleUpdateSub} onLogout={handleLogout} onRefresh={handleRefreshUser} />} />
          <Route path="/admin" element={<AdminPage user={user} songs={songs} onRefreshSongs={handleRefreshSongs} />} />
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
          setCurrentSong(null);
          setIsPlaying(false);
        }}
        user={user}
      />

      <MobileNav />

      <AnimatePresence>
        {showSubModal && (
          <SubscriptionModal onSelect={handleUpdateSub} onLogout={handleLogout} />
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
  );
}
