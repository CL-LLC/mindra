'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2, X } from 'lucide-react';
import type { AffirmationManifest } from '@/lib/video/renderer';

interface MindMoviePlayerProps {
  videoUrl: string;
  manifest?: AffirmationManifest | null;
  autoPlay?: boolean;
  onComplete?: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function MindMoviePlayer({
  videoUrl,
  manifest,
  autoPlay = false,
  onComplete,
  onClose,
  showCloseButton = false,
}: MindMoviePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const completionFiredRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentAffirmation, setCurrentAffirmation] = useState<string | null>(null);
  const [affirmationPosition, setAffirmationPosition] = useState<'center' | 'top' | 'bottom'>('center');

  // Reset state when video changes
  useEffect(() => {
    completionFiredRef.current = false;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsLoading(true);
    setCurrentAffirmation(null);
    setAffirmationPosition('center');
  }, [videoUrl]);

  // Find current affirmation based on playback time
  const updateCurrentAffirmation = useCallback((time: number) => {
    if (!manifest?.scenes) {
      setCurrentAffirmation(null);
      return;
    }

    const scene = manifest.scenes.find(
      (s) => time >= s.startTime && time < s.endTime
    );

    if (scene) {
      setCurrentAffirmation(scene.affirmation);
      setAffirmationPosition(scene.position);
    } else {
      setCurrentAffirmation(null);
    }
  }, [manifest]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      updateCurrentAffirmation(video.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (!completionFiredRef.current) {
        completionFiredRef.current = true;
        onComplete?.();
      }
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      if (autoPlay && video.paused) {
        video.play().catch(() => {});
      }
    };

    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);

    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);
    };
  }, [videoUrl, autoPlay, onComplete, updateCurrentAffirmation]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (video.paused || video.ended) {
        await video.play();
      } else {
        video.pause();
      }
      setIsPlaying(!video.paused && !video.ended);
    } catch (error) {
      console.error('Video playback failed:', error);
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
    updateCurrentAffirmation(time);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const vol = parseFloat(e.target.value);
    video.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen failed:', error);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Position classes for affirmation overlay
  const positionClasses = {
    center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center',
    top: 'top-8 left-1/2 -translate-x-1/2 text-center',
    bottom: 'bottom-24 left-1/2 -translate-x-1/2 text-center', // Above controls
  };

  return (
    <div
      ref={containerRef}
      className="relative bg-slate-900 rounded-lg overflow-hidden"
    >
      {/* Video container */}
      <div className="relative aspect-video">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800 z-10">
            <Loader2 className="w-12 h-12 text-slate-600 animate-spin" />
          </div>
        )}

        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full"
          onClick={togglePlay}
          playsInline
          preload="metadata"
        />

        {/* Affirmation overlay */}
        {currentAffirmation && isPlaying && (
          <div
            className={`absolute ${positionClasses[affirmationPosition]} z-20 pointer-events-none`}
          >
            <div className="bg-black/70 backdrop-blur-sm px-6 py-3 rounded-lg max-w-[85%]">
              <p className="text-white text-lg md:text-xl font-medium leading-relaxed text-shadow-lg overflow-hidden max-h-[4.5em]" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                {currentAffirmation}
              </p>
            </div>
          </div>
        )}

        {/* Close button */}
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-30 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="bg-slate-900 px-4 py-3">
        <div className="mb-3">
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            disabled={!duration}
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2 hover:bg-slate-800 rounded-lg transition"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-2 hover:bg-slate-800 rounded-lg transition"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-white" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-slate-800 rounded-lg transition"
          >
            <Maximize className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
