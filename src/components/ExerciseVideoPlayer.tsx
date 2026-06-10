"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Volume2, VolumeX, X } from "lucide-react";

interface ExerciseVideoPlayerProps {
  videoUrl?: string;
  exerciseName: string;
  onClose?: () => void;
  autoPlay?: boolean;
}

export function ExerciseVideoPlayer({
  videoUrl,
  exerciseName,
  onClose,
  autoPlay = true,
}: ExerciseVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;
    if (autoPlay) {
      videoRef.current.play();
    }
  }, [autoPlay]);

  if (!videoUrl) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="max-w-2xl w-full">
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-auto max-h-[70vh] object-contain"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 flex items-center gap-3">
            <button
              onClick={() => {
                if (videoRef.current) {
                  if (videoRef.current.paused) {
                    videoRef.current.play();
                  } else {
                    videoRef.current.pause();
                  }
                }
              }}
              className="p-2 bg-white bg-opacity-20 hover:bg-opacity-40 rounded-lg transition"
            >
              <Play size={16} className="text-white" />
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = !videoRef.current.muted;
                  setIsMuted(!isMuted);
                }
              }}
              className="p-2 bg-white bg-opacity-20 hover:bg-opacity-40 rounded-lg transition"
            >
              {isMuted ? (
                <VolumeX size={16} className="text-white" />
              ) : (
                <Volume2 size={16} className="text-white" />
              )}
            </button>

            <div className="flex-1" />

            <button
              onClick={onClose}
              className="p-2 bg-white bg-opacity-20 hover:bg-opacity-40 rounded-lg transition"
            >
              <X size={16} className="text-white" />
            </button>
          </div>

          {/* Header */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black to-transparent p-4">
            <p className="text-white font-semibold">{exerciseName}</p>
          </div>
        </div>

        <p className="text-white text-center text-sm mt-3">
          Watch the form cue before starting your set
        </p>
      </div>
    </div>
  );
}
