import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { VideoProject, VideoScene } from './types/video';
import { INITIAL_PROJECT } from './data/defaultProjects';
import { Header } from './components/Header';
import { SidebarAssets } from './components/SidebarAssets';
import { VideoPlayerPreview } from './components/VideoPlayerPreview';
import { TimelineEditor } from './components/TimelineEditor';
import { MotionInspector } from './components/MotionInspector';
import { JSXExportModal } from './components/JSXExportModal';
import { AIScriptModal } from './components/AIScriptModal';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { audioEngine } from './utils/audioSynthesizer';

export default function App() {
  const [project, setProject] = useState<VideoProject>(INITIAL_PROJECT);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);

  // Modals
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);
  const [isJSXModalOpen, setIsJSXModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Pipeline simulation state
  const [isPipelineRunning, setIsPipelineRunning] = useState<boolean>(false);
  const [pipelineProgress, setPipelineProgress] = useState<number>(0);

  const lastSceneOrderRef = useRef<number>(1);
  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  // Synchronize audio volumes whenever project settings change
  useEffect(() => {
    audioEngine.setVolumes(
      project.audio.bgmEnabled ? project.audio.bgmVolume : 0,
      project.audio.sfxEnabled ? project.audio.sfxVolume : 0,
      project.audio.voiceoverEnabled ? project.audio.voiceoverVolume : 0
    );
  }, [project.audio]);

  // Main high-precision animation and playback tick
  const playbackTick = useCallback((timestamp: number) => {
    if (!lastTimestampRef.current) {
      lastTimestampRef.current = timestamp;
    }
    const deltaSec = (timestamp - lastTimestampRef.current) / 1000;
    lastTimestampRef.current = timestamp;

    setCurrentTime((prevTime) => {
      let nextTime = prevTime + deltaSec;

      // Loop or stop at the end
      if (nextTime >= project.totalDuration) {
        nextTime = 0;
      }

      // Detect Scene transition trigger for audio SFX (Glitch Woosh + Sub-bass impact)
      const currentActiveScene = project.scenes.find(
        (s) => nextTime >= s.timing[0] && nextTime < s.timing[1]
      ) || project.scenes[0];

      if (currentActiveScene && currentActiveScene.order !== lastSceneOrderRef.current) {
        lastSceneOrderRef.current = currentActiveScene.order;
        if (project.audio.sfxEnabled) {
          audioEngine.playGlitchWoosh();
          audioEngine.playSubBassImpact();
        }
        if (project.audio.voiceoverEnabled) {
          audioEngine.speakNarration(currentActiveScene.narrative, project.language);
        }
      }

      return nextTime;
    });

    animFrameRef.current = requestAnimationFrame(playbackTick);
  }, [project]);

  // Start / Stop Playback
  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      audioEngine.stopAmbientBGM();
      audioEngine.stopSpeech();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      lastTimestampRef.current = null;
    } else {
      setIsPlaying(true);
      if (project.audio.bgmEnabled) {
        audioEngine.startAmbientBGM();
      }
      const activeScene = project.scenes.find(
        (s) => currentTime >= s.timing[0] && currentTime < s.timing[1]
      ) || project.scenes[0];
      if (activeScene && project.audio.voiceoverEnabled) {
        audioEngine.speakNarration(activeScene.narrative, project.language);
      }
      lastTimestampRef.current = performance.now();
      animFrameRef.current = requestAnimationFrame(playbackTick);
    }
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      audioEngine.stopAmbientBGM();
      audioEngine.stopSpeech();
    };
  }, []);

  // Update current scene index based on scrubbing or selection
  useEffect(() => {
    const activeIdx = project.scenes.findIndex(
      (s) => currentTime >= s.timing[0] && currentTime <= s.timing[1]
    );
    if (activeIdx !== -1 && activeIdx !== currentSceneIndex) {
      setCurrentSceneIndex(activeIdx);
    }
  }, [currentTime, project.scenes]);

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    const activeIdx = project.scenes.findIndex(
      (s) => newTime >= s.timing[0] && newTime <= s.timing[1]
    );
    if (activeIdx !== -1) {
      setCurrentSceneIndex(activeIdx);
    }
  };

  const handleReset = () => {
    setCurrentTime(0);
    lastSceneOrderRef.current = 1;
  };

  // Scene Operations
  const handleUpdateScene = (index: number, updated: Partial<VideoScene>) => {
    setProject((prev) => {
      const updatedScenes = [...prev.scenes];
      updatedScenes[index] = {
        ...updatedScenes[index],
        ...updated,
      };
      return {
        ...prev,
        scenes: updatedScenes,
      };
    });
  };

  const handleAddScene = () => {
    const lastScene = project.scenes[project.scenes.length - 1];
    const newStart = lastScene ? lastScene.timing[1] : 0;
    const newEnd = newStart + 5;
    const newOrder = project.scenes.length + 1;

    const newScene: VideoScene = {
      id: `scene-${Date.now()}`,
      order: newOrder,
      narrative: project.language === 'ar' 
        ? 'مشهد جديد مليء بالإثارة والحركة السينمائية.' 
        : 'A brand new scene surging with cinematic power and velocity.',
      visualPrompt: 'High speed cinematic drone tracking shot through glowing architectural neon structures, 8k resolution anamorphic',
      timing: [newStart, newEnd],
      kineticText: {
        text: project.language === 'ar' ? 'قمة الإثارة والحماس' : 'UNSTOPPABLE MOMENTUM',
        preset: 'Elastic Overshoot',
        fontFamily: 'Cairo',
        fontSize: 54,
        fillColor: '#FFFFFF',
        accentColor: '#E50914',
        springParams: { amp: 0.12, freq: 2.0, decay: 4.0 },
        isArabic: project.language === 'ar',
      },
      transition: {
        type: 'AE_Glitch_Pop_V2',
        duration: 0.5,
        rgbOffset: 14,
        displacementScale: 45,
        flashIntensity: 1.5,
        sfx: 'glitch_pop_woosh.wav',
      },
      audioMood: 'Cinematic Sub-bass boom',
      visualTheme: 'dark-cinematic',
      customMediaUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1080&auto=format&fit=crop',
      mediaType: 'image',
      zoomMotion: 'zoom-in',
    };

    setProject((prev) => ({
      ...prev,
      totalDuration: newEnd,
      scenes: [...prev.scenes, newScene],
    }));
    setCurrentSceneIndex(project.scenes.length);
  };

  const handleDeleteScene = (index: number) => {
    if (project.scenes.length <= 1) return;
    setProject((prev) => {
      const filtered = prev.scenes.filter((_, i) => i !== index);
      let currentT = 0;
      const reordered = filtered.map((s, i) => {
        const dur = s.timing[1] - s.timing[0];
        const sStart = currentT;
        const sEnd = currentT + dur;
        currentT = sEnd;
        return {
          ...s,
          order: i + 1,
          timing: [sStart, sEnd] as [number, number],
        };
      });
      return {
        ...prev,
        totalDuration: currentT,
        scenes: reordered,
      };
    });
    setCurrentSceneIndex(Math.max(0, index - 1));
  };

  const handleUpdateProject = (updated: Partial<VideoProject>) => {
    setProject((prev) => ({ ...prev, ...updated }));
  };

  // Run Full Auto Pipeline simulation
  const handleRunAutoPipeline = () => {
    setIsPipelineRunning(true);
    setPipelineProgress(0);
    audioEngine.playGlitchWoosh();

    const interval = setInterval(() => {
      setPipelineProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsPipelineRunning(false);
          audioEngine.playSubBassImpact();
          confetti({
            particleCount: 75,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#E50914', '#FFD700', '#FFFFFF'],
          });
          if (!isPlaying) {
            handleTogglePlay();
          }
          return 100;
        }
        return prev + 10;
      });
    }, 250);
  };

  const handleResetPipeline = () => {
    setProject(INITIAL_PROJECT);
    setCurrentTime(0);
    setCurrentSceneIndex(0);
    if (isPlaying) {
      handleTogglePlay();
    }
  };

  const handleApplyGeneratedProject = (generatedData: any) => {
    if (!generatedData) return;
    
    const scenes: VideoScene[] = (generatedData.scenes || []).map((s: any, idx: number) => ({
      id: s.id || `scene-${idx + 1}`,
      order: idx + 1,
      narrative: s.narrative || '',
      visualPrompt: s.visualPrompt || '',
      timing: s.timing || [idx * 5, (idx + 1) * 5],
      kineticText: {
        text: s.kineticText?.text || 'KINETIC MOTION',
        preset: s.kineticText?.preset || 'Elastic Overshoot',
        fontFamily: s.kineticText?.fontFamily || 'Cairo',
        fontSize: s.kineticText?.fontSize || 56,
        fillColor: s.kineticText?.fillColor || '#FFFFFF',
        accentColor: s.kineticText?.accentColor || '#E50914',
        springParams: s.kineticText?.springParams || { amp: 0.12, freq: 2.0, decay: 4.0 },
        isArabic: generatedData.language === 'ar' || project.language === 'ar',
      },
      transition: s.transition || {
        type: 'AE_Glitch_Pop_V2',
        duration: 0.5,
        rgbOffset: 14,
        displacementScale: 45,
        flashIntensity: 1.5,
        sfx: 'glitch_pop_woosh.wav',
      },
      audioMood: s.audioMood || 'Oud & Lo-Fi ambient',
      visualTheme: s.visualTheme || 'dark-cinematic',
      customMediaUrl: [
        'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1080&auto=format&fit=crop'
      ][idx % 3],
      mediaType: 'image',
      zoomMotion: 'zoom-in',
    }));

    const totalDur = scenes.length > 0 ? scenes[scenes.length - 1].timing[1] : 15;

    setProject((prev) => ({
      ...prev,
      title: generatedData.title || prev.title,
      topic: generatedData.topic || prev.topic,
      style: generatedData.style || prev.style,
      language: generatedData.language || prev.language,
      totalDuration: totalDur,
      scenes,
    }));

    setCurrentTime(0);
    setCurrentSceneIndex(0);
    audioEngine.playSubBassImpact();
  };

  const currentActiveScene = project.scenes[currentSceneIndex] || project.scenes[0];

  return (
    <div className="w-screen h-screen bg-[#0a0a0c] text-[#f0f0f0] font-sans flex flex-col overflow-hidden relative selection:bg-[#E50914] selection:text-white">
      {/* Background Ambient Blur Spheres */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] bg-[#E50914]/12 rounded-full blur-[130px]" />
        <div className="absolute top-[40%] -right-[10%] w-[550px] h-[550px] bg-[#FFD700]/7 rounded-full blur-[110px]" />
      </div>

      {/* Top Navbar */}
      <Header
        project={project}
        onOpenAIModal={() => setIsAIModalOpen(true)}
        onOpenJSXModal={() => setIsJSXModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onRunAutoPipeline={handleRunAutoPipeline}
        isPipelineRunning={isPipelineRunning}
        pipelineProgress={pipelineProgress}
      />

      {/* Main Suite Workspace */}
      <div className="flex flex-1 overflow-hidden z-10 min-h-0">
        <SidebarAssets
          project={project}
          currentSceneIndex={currentSceneIndex}
          onSelectScene={(idx) => {
            setCurrentSceneIndex(idx);
            if (project.scenes[idx]) {
              setCurrentTime(project.scenes[idx].timing[0]);
            }
          }}
          onUpdateScene={handleUpdateScene}
          onAddScene={handleAddScene}
          onDeleteScene={handleDeleteScene}
          onOpenJSXModal={() => setIsJSXModalOpen(true)}
          onOpenAIModal={() => setIsAIModalOpen(true)}
        />

        <div className="flex-1 flex flex-col bg-black/10 min-w-0 overflow-hidden">
          <VideoPlayerPreview
            project={project}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onSeek={handleSeek}
            onReset={handleReset}
            currentScene={currentActiveScene}
            currentSceneIndex={currentSceneIndex}
          />

          <TimelineEditor
            project={project}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onSeek={handleSeek}
            onReset={handleReset}
            currentSceneIndex={currentSceneIndex}
            onSelectScene={(idx) => {
              setCurrentSceneIndex(idx);
              if (project.scenes[idx]) {
                setCurrentTime(project.scenes[idx].timing[0]);
              }
            }}
          />
        </div>

        <MotionInspector
          project={project}
          currentScene={currentActiveScene}
          currentSceneIndex={currentSceneIndex}
          onUpdateScene={handleUpdateScene}
          onUpdateProject={handleUpdateProject}
          onRunAutoPipeline={handleRunAutoPipeline}
          onResetPipeline={handleResetPipeline}
          isPipelineRunning={isPipelineRunning}
          pipelineProgress={pipelineProgress}
        />
      </div>

      {/* Modals */}
      <JSXExportModal
        isOpen={isJSXModalOpen}
        onClose={() => setIsJSXModalOpen(false)}
        project={project}
      />

      <AIScriptModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onApplyGeneratedProject={handleApplyGeneratedProject}
      />

      <ProjectSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        project={project}
        onUpdateProject={handleUpdateProject}
      />
    </div>
  );
}
