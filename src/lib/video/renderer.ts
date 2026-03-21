// Video Rendering Pipeline for Mindra
// Uses Editly + FFmpeg to create mind movies

export interface StoryboardScene {
  affirmation: string;
  duration: number; // seconds
  imagePrompt: string;
  imageUrl?: string;
  transition: 'fade' | 'zoom' | 'pan' | 'dissolve';
  textOverlay?: {
    text: string;
    position: 'center' | 'top' | 'bottom';
    style: 'bold' | 'normal';
  };
}

export interface VideoConfig {
  width: number;
  height: number;
  fps: number;
  duration: number;
  outputFormat: 'mp4' | 'webm';
  quality: 'low' | 'medium' | 'high';
}

export interface RenderJob {
  id: string;
  mindMovieId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputUrl?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

// Default video configuration
export const DEFAULT_CONFIG: VideoConfig = {
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 120, // 2 minutes
  outputFormat: 'mp4',
  quality: 'high',
};

// Mobile configuration (9:16 aspect ratio)
export const MOBILE_CONFIG: VideoConfig = {
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 120,
  outputFormat: 'mp4',
  quality: 'high',
};

/**
 * Generate Editly configuration from storyboard
 */
export function generateEditlyConfig(
  scenes: StoryboardScene[],
  config: VideoConfig = DEFAULT_CONFIG,
  musicTrack?: string
) {
  const editlyConfig = {
    width: config.width,
    height: config.height,
    fps: config.fps,
    // Output path will be set by the render job
    outPath: '', 
    
    clips: scenes.map((scene, index) => ({
      duration: scene.duration,
      
      // Background layer (image or color)
      layers: [
        // Image/video layer
        ...(scene.imageUrl ? [{
          type: 'image',
          path: scene.imageUrl,
          ...(scene.transition === 'zoom' && { zoom: [1, 1.2] }),
          ...(scene.transition === 'pan' && { position: ['left', 'right'] }),
        }] : [{
          type: 'fill-color',
          color: '#0f172a', // Slate-900
        }]),
        
        // Text overlay layer
        {
          type: 'title',
          text: scene.affirmation,
          position: scene.textOverlay?.position ?? 'center',
          textColor: '#ffffff',
          fontPath: '/fonts/inter-bold.ttf',
          fontSize: config.height * 0.06, // 6% of height
          fontWeight: scene.textOverlay?.style ?? 'bold',
        },
        
        // Ken Burns effect (subtle zoom)
        {
          type: 'detached',
          duration: scene.duration,
          layers: [{
            type: 'radial-gradient',
            colors: ['#8b5cf6', '#6366f1'], // Primary to accent
            center: [0.5, 0.5],
          }],
          originX: 0.5,
          originY: 0.5,
          zoom: [1, 1.05], // Subtle zoom
          opacity: 0.1, // Very subtle overlay
        },
      ],
      
      // Transition between clips
      transition: {
        duration: 0.5,
        name: scene.transition === 'dissolve' ? 'fade' : scene.transition,
      },
    })),
    
    // Audio track
    ...(musicTrack ? [{
      audio: {
        path: musicTrack,
        mixVolume: 0.3, // 30% volume
        fadeIn: 1,
        fadeOut: 2,
      },
    }] : []),
    
    // Intro clip (optional)
    defaults: {
      layerType: {
        'title': {
          fontPath: '/fonts/inter-bold.ttf',
          fontSize: config.height * 0.06,
          textColor: '#ffffff',
        },
      },
    },
  };
  
  return editlyConfig;
}

/**
 * Calculate total video duration from scenes
 */
export function calculateDuration(scenes: StoryboardScene[]): number {
  return scenes.reduce((total, scene) => total + scene.duration, 0);
}

/**
 * Validate storyboard before rendering
 */
export function validateStoryboard(scenes: StoryboardScene[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (scenes.length === 0) {
    errors.push('Storyboard must have at least one scene');
  }
  
  if (scenes.length > 20) {
    errors.push('Storyboard cannot have more than 20 scenes');
  }
  
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    
    if (!scene.affirmation || scene.affirmation.length === 0) {
      errors.push(`Scene ${i + 1}: Affirmation is required`);
    }
    
    if (scene.duration < 5 || scene.duration > 60) {
      errors.push(`Scene ${i + 1}: Duration must be between 5 and 60 seconds`);
    }
    
    if (!['fade', 'zoom', 'pan', 'dissolve'].includes(scene.transition)) {
      errors.push(`Scene ${i + 1}: Invalid transition type`);
    }
  }
  
  const totalDuration = calculateDuration(scenes);
  if (totalDuration < 30 || totalDuration > 300) {
    errors.push('Total video duration must be between 30 seconds and 5 minutes');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate thumbnail from video
 * (Would use FFmpeg in production)
 */
export async function generateThumbnail(videoUrl: string): Promise<string> {
  // In production, this would use FFmpeg to extract a frame
  // For now, return a placeholder
  return `${videoUrl}?thumbnail=true`;
}

/**
 * Get render queue position
 * (Would query actual queue in production)
 */
export async function getQueuePosition(jobId: string): Promise<number> {
  // In production, this would query a job queue
  return 1;
}

/**
 * Estimate render time
 */
export function estimateRenderTime(scenes: StoryboardScene[], quality: string): number {
  const duration = calculateDuration(scenes);
  const baseTime = duration * 2; // 2x real-time
  
  const qualityMultiplier = {
    low: 0.5,
    medium: 1,
    high: 2,
  };
  
  return baseTime * (qualityMultiplier[quality as keyof typeof qualityMultiplier] || 1);
}
