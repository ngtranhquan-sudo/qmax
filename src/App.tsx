/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Save, 
  FolderOpen, 
  Undo2, 
  Redo2, 
  Settings, 
  Coffee, 
  X, 
  Maximize2, 
  RotateCcw, 
  Download, 
  RefreshCw,
  ChevronRight,
  Plus,
  User,
  Star,
  Trash2,
  ImageIcon,
  Upload,
  Loader2,
  ChevronLeft,
  Send,
  FileJson,
  HelpCircle,
  FileSpreadsheet,
  FileText,
  Scissors
} from 'lucide-react';
import mammoth from 'mammoth';
import { motion, AnimatePresence } from 'motion/react';
import { useUndoRedo } from './hooks/useUndoRedo';
import { slugify } from './utils/slugify';
import { GoogleGenAI } from "@google/genai";
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

// Types
interface Character {
  id: string;
  name: string;
  description: string;
  images: string[]; // base64
  isDefault: boolean;
}

interface Scene {
  id: string;
  sceneNo: string; // Cột A
  script: string;  // Cột B & C gộp lại
  promptName: string; // Cột D
  contextDesc: string; // Cột E
  selectedCharacterIds: string[]; // Cột F
  generatedImageUrl: string | null;
  motionPrompt: string | null;
  motionPromptName: string | null;
  isGenerating: boolean;
  isGeneratingMotion: boolean;
}

interface ProjectData {
  name: string;
  stylePrompt: string;
  styleImages: string[]; // base64
  characters: Character[];
  scenes: Scene[];
  activeTabId: string;
}

// Utils
const generateId = (prefix: string) => `${prefix}-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;

export default function App() {
  // --- State ---
  const { state: project, setState: setProject, undo, redo, canUndo, canRedo } = useUndoRedo<ProjectData>({
    name: '',
    stylePrompt: '',
    styleImages: [],
    characters: [
      { id: 'char-1', name: '', description: '', images: [], isDefault: true },
      { id: 'char-2', name: '', description: '', images: [], isDefault: false },
      { id: 'char-3', name: '', description: '', images: [], isDefault: false },
      { id: 'char-4', name: '', description: '', images: [], isDefault: false },
      { id: 'char-5', name: '', description: '', images: [], isDefault: false },
      { id: 'char-6', name: '', description: '', images: [], isDefault: false },
      { id: 'char-7', name: '', description: '', images: [], isDefault: false }
    ],
    scenes: [
      { 
        id: 'scene-1', 
        sceneNo: '1', 
        script: '', 
        promptName: '', 
        contextDesc: '', 
        selectedCharacterIds: [], 
        generatedImageUrl: null, 
        motionPrompt: null,
        motionPromptName: null,
        isGenerating: false,
        isGeneratingMotion: false
      }
    ],
    activeTabId: 'tab-1'
  });

  const [zoom, setZoom] = useState(1);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isCoffeeModalOpen, setIsCoffeeModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [fullViewSceneId, setFullViewSceneId] = useState<string | null>(null);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isBatchGeneratingMotion, setIsBatchGeneratingMotion] = useState(false);
  const [editingMotionSceneId, setEditingMotionSceneId] = useState<string | null>(null);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [scriptMessages, setScriptMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [scriptInput, setScriptInput] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [hasExcelUploaded, setHasExcelUploaded] = useState(false);

  if (!project) return null;

  // --- Effects ---
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            handleSave();
            break;
          case 'o':
            e.preventDefault();
            handleOpen();
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, undo, redo]);

  // Zoom with Ctrl + Scroll
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(prev => Math.min(Math.max(prev + delta, 0.5), 2));
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-zoom', zoom.toString());
  }, [zoom]);

  // --- Handlers ---
  const handleSave = async () => {
    const fileName = project.name ? slugify(project.name) : 'du-an-moi';
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    
    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `${fileName}.json`,
          types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Save failed', err);
    }
  };

  const handleOpen = async () => {
    try {
      if ('showOpenFilePicker' in window) {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }]
        });
        const file = await handle.getFile();
        const text = await file.text();
        setProject(JSON.parse(text));
      } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const text = await file.text();
            setProject(JSON.parse(text));
          }
        };
        input.click();
      }
    } catch (err) {
      console.error('Open failed', err);
    }
  };

  const updateProjectName = (name: string) => {
    setProject(prev => ({ ...prev, name }));
  };

  // --- Character Handlers ---
  const updateCharacter = (id: string, updates: Partial<Character>) => {
    setProject(prev => ({
      ...prev,
      characters: prev.characters.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const setDefaultCharacter = (id: string) => {
    setProject(prev => ({
      ...prev,
      characters: prev.characters.map(c => ({ ...c, isDefault: c.id === id }))
    }));
  };

  const handleImageUpload = async (charId: string, files: FileList | null) => {
    if (!files) return;
    const char = project.characters.find(c => c.id === charId);
    if (!char) return;

    const newImages = [...char.images];
    for (let i = 0; i < files.length; i++) {
      if (newImages.length >= 5) break;
      const file = files[i];
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push(base64);
    }
    updateCharacter(charId, { images: newImages });
  };

  const removeImage = (charId: string, index: number) => {
    const char = project.characters.find(c => c.id === charId);
    if (!char) return;
    const newImages = [...char.images];
    newImages.splice(index, 1);
    updateCharacter(charId, { images: newImages });
  };

  const handleStyleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    const newImages = [...project.styleImages];
    for (let i = 0; i < files.length; i++) {
      if (newImages.length >= 5) break;
      const file = files[i];
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push(base64);
    }
    setProject(prev => ({ ...prev, styleImages: newImages }));
  };

  const removeStyleImage = (index: number) => {
    const newImages = [...project.styleImages];
    newImages.splice(index, 1);
    setProject(prev => ({ ...prev, styleImages: newImages }));
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHasExcelUploaded(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target?.result;
      const workbook = XLSX.read(bstr, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Bỏ qua hàng đầu tiên (tiêu đề)
      const rows = data.slice(1);
      const defaultChar = project.characters.find(c => c.isDefault);

      const newScenes: Scene[] = rows.map((row, index) => {
        const sceneNo = String(row[0] || '');
        const hasC = sceneNo.toUpperCase().includes('C');
        
        return {
          id: generateId('scene'),
          sceneNo: sceneNo,
          script: String(row[1] || row[2] || ''),
          promptName: String(row[3] || ''),
          contextDesc: String(row[4] || ''),
          selectedCharacterIds: hasC && defaultChar ? [defaultChar.id] : [],
          generatedImageUrl: null,
          motionPrompt: null,
          motionPromptName: null,
          isGenerating: false,
          isGeneratingMotion: false
        };
      });

      if (newScenes.length > 0) {
        setProject(prev => ({ ...prev, scenes: newScenes }));
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- Scene Handlers ---
  const addScene = () => {
    const newScene: Scene = {
      id: generateId('scene'),
      sceneNo: String(project.scenes.length + 1),
      script: '',
      promptName: '',
      contextDesc: '',
      selectedCharacterIds: [],
      generatedImageUrl: null,
      motionPrompt: null,
      motionPromptName: null,
      isGenerating: false,
      isGeneratingMotion: false
    };
    setProject(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }));
  };

  const updateScene = (id: string, updates: Partial<Scene>) => {
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const removeScene = (id: string) => {
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.filter(s => s.id !== id)
    }));
  };

  // --- Image Generation Logic ---
  const generateImage = async (sceneId: string, customPrompt?: string) => {
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    updateScene(sceneId, { isGenerating: true });

    try {
      const currentApiKey = apiKey || (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
      if (!currentApiKey) throw new Error("API Key is missing. Please check your settings.");

      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      
      // Prepare style context
      const parts: any[] = [];
      project.styleImages.forEach(imgBase64 => {
        const [mime, data] = imgBase64.split(';base64,');
        parts.push({
          inlineData: {
            data: data,
            mimeType: mime.split(':')[1]
          }
        });
      });

      // Prepare characters context
      const selectedChars = project.characters.filter(c => scene.selectedCharacterIds.includes(c.id));

      selectedChars.forEach(char => {
        char.images.forEach(imgBase64 => {
          const [mime, data] = imgBase64.split(';base64,');
          parts.push({
            inlineData: {
              data: data,
              mimeType: mime.split(':')[1]
            }
          });
        });
        if (char.name || char.description) {
          parts.push({ text: `Character: ${char.name}. Traits: ${char.description}` });
        }
      });

      const finalPrompt = customPrompt || `${project.stylePrompt} ${scene.contextDesc}`;
      parts.push({ text: `Generate a high quality image for this scene. 
Style Description: ${project.stylePrompt}
Scene Context: ${scene.contextDesc}
Prompt Name: ${scene.promptName}

Ensure the appearance of the characters matches the provided images and descriptions exactly. Do not add any text to the image.` });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: "16:9"
          }
        }
      });

      let imageUrl = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        updateScene(sceneId, { generatedImageUrl: imageUrl, isGenerating: false });
      } else {
        const textResponse = response.text || "No response text from model.";
        throw new Error(`Model did not return an image. Response: ${textResponse}`);
      }
    } catch (err) {
      console.error("Generation failed:", err);
      updateScene(sceneId, { isGenerating: false });
      alert("Lỗi khi tạo ảnh: " + (err as Error).message);
    }
  };

  const handleScriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let content = '';
    try {
      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else {
        content = await file.text();
      }

      if (content) {
        setScriptMessages([
          { role: 'user', content: content },
          { role: 'ai', content: 'Bạn cần hỗ trợ gì với kịch bản này?' }
        ]);
        setIsScriptModalOpen(true);
      }
    } catch (err) {
      console.error("Script upload failed:", err);
      alert("Lỗi khi đọc file kịch bản: " + (err as Error).message);
    }
  };

  const handleScriptChatSubmit = async (customPrompt?: string) => {
    const prompt = customPrompt || scriptInput;
    if (!prompt.trim()) return;

    const newMessages = [...scriptMessages, { role: 'user', content: prompt }];
    setScriptMessages(newMessages);
    setScriptInput('');
    setIsGeneratingScript(true);

    try {
      const currentApiKey = apiKey || (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
      if (!currentApiKey) throw new Error("API Key is missing. Please check your settings.");

      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: "You are a helpful script assistant. Help the user process their script for video production. If the user asks to split the script, follow their formatting rules strictly."
        }
      });

      // Send history (simplified for now, but chat object handles it)
      // We start fresh with the history we have
      const responseStream = await chat.sendMessageStream({ message: prompt });
      
      let fullResponse = '';
      setScriptMessages(prev => [...prev, { role: 'ai', content: '' }]);

      for await (const chunk of responseStream) {
        fullResponse += chunk.text;
        setScriptMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content = fullResponse;
          return updated;
        });
      }
    } catch (err) {
      console.error("Script chat failed:", err);
      setScriptMessages(prev => [...prev, { role: 'ai', content: "Lỗi: " + (err as Error).message }]);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const applyScriptToStoryboard = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    setProject(prev => {
      const newScenes = [...prev.scenes];
      lines.forEach((line, idx) => {
        if (newScenes[idx]) {
          newScenes[idx].script = line.trim();
        } else {
          newScenes.push({
            id: generateId('scene'),
            sceneNo: String(idx + 1),
            script: line.trim(),
            promptName: '',
            contextDesc: '',
            selectedCharacterIds: [],
            generatedImageUrl: null,
            motionPrompt: null,
            motionPromptName: null,
            isGenerating: false,
            isGeneratingMotion: false
          });
        }
      });
      return { ...prev, scenes: newScenes };
    });
    setIsScriptModalOpen(false);
  };

  const generateMotionPrompt = async (sceneId: string) => {
    const sceneIdx = project.scenes.findIndex(s => s.id === sceneId);
    if (sceneIdx === -1) return;
    const scene = project.scenes[sceneIdx];

    updateScene(sceneId, { isGeneratingMotion: true });

    try {
      const currentApiKey = apiKey || (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
      if (!currentApiKey) throw new Error("API Key is missing. Please check your settings.");

      const ai = new GoogleGenAI({ apiKey: currentApiKey });

      // Get context from surrounding scenes (3-5 before and after)
      const startIdx = Math.max(0, sceneIdx - 4);
      const endIdx = Math.min(project.scenes.length - 1, sceneIdx + 4);
      const contextScenes = project.scenes.slice(startIdx, endIdx + 1);
      
      const contextText = contextScenes.map((s, i) => {
        const relativeIdx = startIdx + i + 1;
        return `Scene ${relativeIdx}: ${s.vietnamese}. Context: ${s.contextDesc}`;
      }).join('\n');

      const parts: any[] = [];
      
      // Add the current image if it exists for visual context
      if (scene.generatedImageUrl) {
        const [mime, data] = scene.generatedImageUrl.split(';base64,');
        parts.push({
          inlineData: {
            data: data,
            mimeType: mime.split(':')[1]
          }
        });
      }

      const systemInstruction = `You are a professional cinematic motion designer. 
Your task is to generate a detailed motion prompt for an AI video generator based on a provided image (the END FRAME) and its script context.

The motion prompt must:
1. Be highly detailed and technical, describing specific camera movements (e.g., crane down, dolly in, pan, tilt, tracking shot, handheld, gimbal).
2. Describe character movement (or lack thereof) and environmental changes (lighting shifts, wind, particles).
3. Use professional cinematic terminology (e.g., focal length, depth of field, parallax effect, establishing shot, close-up).
4. Describe the START FRAME clearly as a high-angle, wide establishing shot or a layered composition that leads to the provided END FRAME.
5. Balance the motion for a 6-10 second duration.
6. Ensure seamless transition in art style, textures, color palette, and lighting.
7. Explicitly mention foreground elements to create depth and a sense of discovery.

You must return the response in JSON format with two fields:
- "motionPrompt": The full detailed English motion prompt.
- "motionPromptName": A short Vietnamese summary (5-10 words) describing the motion clearly.

Example of "motionPrompt" structure:
"This image represents the END FRAME of a cinematic sequence... The START FRAME should be a [shot type]... The camera will [movement] through [foreground elements] to reveal [subject]... Art style and lighting must match the provided image exactly... Total duration: 8 seconds."`;

      const prompt = `Script Context:\n${contextText}\n\nCurrent Scene (Scene ${sceneIdx + 1}):\nVietnamese: ${scene.vietnamese}\nContext: ${scene.contextDesc}\n\nBased on the image and context provided, generate the motion prompt as instructed.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text);
      updateScene(sceneId, { 
        motionPrompt: result.motionPrompt, 
        motionPromptName: result.motionPromptName,
        isGeneratingMotion: false 
      });
    } catch (err) {
      console.error("Motion generation failed:", err);
      updateScene(sceneId, { isGeneratingMotion: false });
      alert("Lỗi khi tạo motion prompt: " + (err as Error).message);
    }
  };

  const batchGenerateMotion = async () => {
    setIsBatchGeneratingMotion(true);
    for (const scene of project.scenes) {
      if (scene.generatedImageUrl && !scene.motionPrompt) {
        await generateMotionPrompt(scene.id);
      }
    }
    setIsBatchGeneratingMotion(false);
  };

  const batchGenerate = async () => {
    setIsBatchGenerating(true);
    for (const scene of project.scenes) {
      if (!scene.generatedImageUrl) {
        await generateImage(scene.id);
      }
    }
    setIsBatchGenerating(false);
  };

  const downloadAllAsZip = async () => {
    const zip = new JSZip();
    project.scenes.forEach((scene, index) => {
      if (scene.generatedImageUrl) {
        const base64Data = scene.generatedImageUrl.split(',')[1];
        zip.file(`${index + 1}.png`, base64Data, { base64: true });
      }
    });
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(project.name || 'project')}-images.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSingleImage = (scene: Scene) => {
    if (!scene.generatedImageUrl) return;
    const a = document.createElement('a');
    a.href = scene.generatedImageUrl;
    a.download = `${scene.sceneNo || 'scene'}.png`;
    a.click();
  };

  // --- Render Helpers ---
  const currentFullViewIndex = project.scenes.findIndex(s => s.id === fullViewSceneId);
  const currentFullViewScene = project.scenes[currentFullViewIndex];

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-green-100/30 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'glass-panel py-2' : 'bg-transparent py-4'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold gradient-text tracking-tight">QMAX</h1>
            <div className="h-6 w-[1px] bg-slate-200 mx-2" />
            <div className="flex items-center gap-2">
              <button onClick={handleSave} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" title="Save (Ctrl+S)">
                <Save size={18} />
              </button>
              <button onClick={handleOpen} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" title="Open (Ctrl+O)">
                <FolderOpen size={18} />
              </button>
              <div className="w-[1px] h-4 bg-slate-200 mx-1" />
              <button onClick={undo} disabled={!canUndo} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors" title="Undo (Ctrl+Z)">
                <Undo2 size={18} />
              </button>
              <button onClick={redo} disabled={!canRedo} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors" title="Redo (Ctrl+Shift+Z)">
                <Redo2 size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {zoom !== 1 && (
              <button 
                onClick={() => setZoom(1)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel text-xs font-medium text-green-600 hover:bg-green-50 transition-all border-green-100"
              >
                <RotateCcw size={14} />
                Reset {Math.round(zoom * 100)}%
              </button>
            )}
            <button 
              onClick={() => setIsApiKeyModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel text-sm font-medium text-slate-700 hover-gradient transition-all"
            >
              <Settings size={16} />
              API Key
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Wrapper (Zoomable) */}
      <main className="flex-1 pt-24 pb-20 px-6 zoom-container">
        <div className="max-w-7xl mx-auto space-y-12">
          
          {/* Project Name Input */}
          <div className="text-center space-y-4">
            <div className="relative inline-block group">
              <input
                type="text"
                value={project.name}
                onChange={(e) => updateProjectName(e.target.value.toUpperCase())}
                placeholder="NHẬP TÊN DỰ ÁN TẠI ĐÂY"
                className={`text-4xl md:text-6xl font-black text-center bg-transparent border-none focus:ring-0 placeholder:text-slate-200 transition-all w-full max-w-3xl ${project.name ? 'gradient-text' : 'text-slate-200'}`}
              />
              <div className="absolute -bottom-2 left-0 right-0 h-[2px] bg-linear-to-r from-transparent via-green-200 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Style Prompt Input */}
          <section className="glass-panel rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
              <Settings className="text-green-600" />
              Mô tả Phong cách (Style Prompt)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <textarea 
                  placeholder="Nhập mô tả phong cách vẽ chung cho toàn bộ app (ví dụ: Anime, 3D Render, Cinematic, Watercolor...)"
                  value={project.stylePrompt}
                  onChange={(e) => setProject(prev => ({ ...prev, stylePrompt: e.target.value }))}
                  className="w-full bg-slate-50/50 rounded-xl p-4 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-green-500 min-h-[120px] border border-slate-100"
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span>Ảnh tham chiếu phong cách ({project.styleImages.length}/5)</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {project.styleImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group/img border border-slate-100">
                      <img src={img} alt="Style" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => removeStyleImage(idx)}
                        className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {project.styleImages.length < 5 && (
                    <label className="aspect-square rounded-lg border-2 border-dashed border-slate-200 hover:border-green-400 hover:bg-green-50 transition-all flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-green-600">
                      <Upload size={16} />
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleStyleImageUpload(e.target.files)}
                      />
                    </label>
                  )}
                </div>
                {project.styleImages.length < 5 && (
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleStyleImageUpload(e.dataTransfer.files);
                    }}
                    className="py-2 border border-dashed border-slate-100 rounded-lg text-[10px] text-center text-slate-400 italic"
                  >
                    Kéo thả ảnh phong cách vào đây
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Character Management Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                <User className="text-green-600" />
                Quản lý Nhân vật (Tối đa 7)
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {project.characters.map((char) => (
                <div key={char.id} className="glass-panel rounded-3xl p-6 space-y-4 relative group">
                  <button 
                    onClick={() => setDefaultCharacter(char.id)}
                    className={`absolute top-4 right-4 p-2 rounded-full transition-all ${char.isDefault ? 'bg-yellow-400 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                    title="Đặt làm mặc định"
                  >
                    <Star size={16} fill={char.isDefault ? 'currentColor' : 'none'} />
                  </button>

                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Tên nhân vật..."
                      value={char.name}
                      onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
                      className="w-full bg-transparent border-b border-slate-100 focus:border-green-500 text-lg font-bold outline-none py-1"
                    />
                    <textarea 
                      placeholder="Mô tả đặc điểm (trang phục, phong cách...)"
                      value={char.description}
                      onChange={(e) => updateCharacter(char.id, { description: e.target.value })}
                      className="w-full bg-slate-50/50 rounded-xl p-3 text-sm text-slate-600 outline-none focus:ring-1 focus:ring-green-500 min-h-[80px] resize-none"
                    />
                  </div>

                  {/* Image Upload Area */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <span>Ảnh tham chiếu ({char.images.length}/5)</span>
                    </div>
                    
                    <div className="grid grid-cols-5 gap-2">
                      {char.images.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group/img border border-slate-100">
                          <img src={img} alt="Char" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            onClick={() => removeImage(char.id, idx)}
                            className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {char.images.length < 5 && (
                        <label className="aspect-square rounded-lg border-2 border-dashed border-slate-200 hover:border-green-400 hover:bg-green-50 transition-all flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-green-600">
                          <Upload size={16} />
                          <input 
                            type="file" 
                            multiple 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleImageUpload(char.id, e.target.files)}
                          />
                        </label>
                      )}
                    </div>
                    
                    {/* Drag & Drop Hint */}
                    {char.images.length < 5 && (
                      <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleImageUpload(char.id, e.dataTransfer.files);
                        }}
                        className="py-2 border border-dashed border-slate-100 rounded-lg text-[10px] text-center text-slate-400 italic"
                      >
                        Kéo thả ảnh vào đây
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Storyboard Section */}
          <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                <ImageIcon className="text-green-600" />
                Kịch bản & Phân cảnh
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                {!hasExcelUploaded && project.scenes.length <= 1 && !project.scenes[0].vietnamese && (
                  <label className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel text-sm font-bold text-orange-600 hover:bg-orange-50 cursor-pointer transition-all">
                    <FileText size={16} />
                    Upload Script (Doc/Txt)
                    <input type="file" accept=".docx, .txt" className="hidden" onChange={handleScriptUpload} />
                  </label>
                )}
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel text-sm font-bold text-blue-600 hover:bg-blue-50 cursor-pointer transition-all">
                  <FileSpreadsheet size={16} />
                  Upload Excel
                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
                </label>
                <button 
                  onClick={batchGenerateMotion}
                  disabled={isBatchGeneratingMotion}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel text-sm font-bold text-blue-600 hover-gradient transition-all disabled:opacity-50"
                >
                  {isBatchGeneratingMotion ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                  Tạo Motion hàng loạt
                </button>
                <button 
                  onClick={batchGenerate}
                  disabled={isBatchGenerating}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel text-sm font-bold text-green-600 hover-gradient transition-all disabled:opacity-50"
                >
                  {isBatchGenerating ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                  Tạo ảnh hàng loạt
                </button>
                <button 
                  onClick={downloadAllAsZip}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all"
                >
                  <Download size={16} />
                  Download Full (Zip)
                </button>
              </div>
            </div>

            <div className="glass-panel rounded-3xl overflow-hidden overflow-x-auto">
              <table className="w-full border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-4 py-4 text-left w-24">
                      <div className="flex items-center gap-1">
                        Scene
                        <div className="group relative">
                          <HelpCircle size={12} className="cursor-help text-slate-300" />
                          <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none normal-case font-normal">
                            Số thứ tự phân cảnh. Khi tải ảnh, tên file sẽ giống tên ô này.
                          </div>
                        </div>
                      </div>
                    </th>
                    <th className="px-4 py-4 text-left">Kịch bản</th>
                    <th className="px-4 py-4 text-left">
                      <div className="flex items-center gap-1">
                        Tên Prompt
                        <div className="group relative">
                          <HelpCircle size={12} className="cursor-help text-slate-300" />
                          <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none normal-case font-normal">
                            Tóm tắt những gì xảy ra trong phân cảnh để check tính chính xác.
                          </div>
                        </div>
                      </div>
                    </th>
                    <th className="px-4 py-4 text-left">Mô tả bối cảnh</th>
                    <th className="px-4 py-4 text-left w-48">Nhân vật</th>
                    <th className="px-4 py-4 text-center w-48">Ảnh minh họa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {project.scenes.map((scene, idx) => (
                    <tr key={scene.id} className="group hover:bg-slate-50/30 transition-colors">
                      <td className="px-4 py-4 align-top">
                        <input 
                          type="text"
                          value={scene.sceneNo}
                          onChange={(e) => updateScene(scene.id, { sceneNo: e.target.value })}
                          className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700"
                        />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <textarea 
                          value={scene.script}
                          onChange={(e) => updateScene(scene.id, { script: e.target.value })}
                          className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-700 resize-none min-h-[60px]"
                        />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <textarea 
                          value={scene.promptName}
                          onChange={(e) => updateScene(scene.id, { promptName: e.target.value })}
                          className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-600 italic resize-none min-h-[60px]"
                        />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <textarea 
                          value={scene.contextDesc}
                          onChange={(e) => updateScene(scene.id, { contextDesc: e.target.value })}
                          className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-600 resize-none min-h-[60px]"
                        />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-1">
                          {project.characters.map(char => (
                            <button
                              key={char.id}
                              onClick={() => {
                                const newIds = scene.selectedCharacterIds.includes(char.id)
                                  ? scene.selectedCharacterIds.filter(id => id !== char.id)
                                  : [...scene.selectedCharacterIds, char.id];
                                updateScene(scene.id, { selectedCharacterIds: newIds });
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                scene.selectedCharacterIds.includes(char.id)
                                  ? 'bg-green-600 text-white border-green-600'
                                  : 'bg-white text-slate-400 border-slate-200 hover:border-green-400'
                              }`}
                            >
                              {char.name || `NV ${char.id.split('-')[1]}`}
                            </button>
                          ))}
                          {scene.selectedCharacterIds.length === 0 && (
                            <span className="text-[10px] text-slate-300 italic">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col items-center gap-3">
                          <div className="relative w-32 aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group/img">
                            {scene.generatedImageUrl ? (
                              <>
                                <img src={scene.generatedImageUrl} alt="Gen" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button 
                                    onClick={() => setFullViewSceneId(scene.id)}
                                    className="p-1 bg-white rounded-lg text-slate-800 hover:text-green-600 transition-colors"
                                  >
                                    <Maximize2 size={14} />
                                  </button>
                                  <button 
                                    onClick={() => generateImage(scene.id)}
                                    className="p-1 bg-white rounded-lg text-slate-800 hover:text-green-600 transition-colors"
                                  >
                                    <RefreshCw size={14} />
                                  </button>
                                  <button 
                                    onClick={() => downloadSingleImage(scene)}
                                    className="p-1 bg-white rounded-lg text-slate-800 hover:text-green-600 transition-colors"
                                  >
                                    <Download size={14} />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                {scene.isGenerating ? <Loader2 className="animate-spin" size={20} /> : <ImageIcon size={20} />}
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => generateImage(scene.id)}
                            disabled={scene.isGenerating}
                            className="px-3 py-1 rounded-lg primary-gradient text-white text-[10px] font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1"
                          >
                            {scene.isGenerating ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                            {scene.generatedImageUrl ? 'Tạo lại' : 'Tạo ảnh'}
                          </button>

                          {scene.generatedImageUrl && (
                            <div className="w-full space-y-2">
                              <button 
                                onClick={() => generateMotionPrompt(scene.id)}
                                disabled={scene.isGeneratingMotion}
                                className="w-full px-3 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                {scene.isGeneratingMotion ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                                {scene.motionPrompt ? 'Tạo lại Motion' : 'Tạo Motion'}
                              </button>

                              {scene.motionPrompt && (
                                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-blue-600">{scene.motionPromptName}</span>
                                    <button 
                                      onClick={() => {
                                        navigator.clipboard.writeText(scene.motionPrompt || '');
                                      }}
                                      className="p-1 hover:bg-slate-200 rounded text-slate-400"
                                      title="Copy Prompt"
                                    >
                                      <Save size={10} />
                                    </button>
                                  </div>
                                  <p className="text-[9px] text-slate-500 line-clamp-3 leading-tight">
                                    {scene.motionPrompt}
                                  </p>
                                  <button 
                                    onClick={() => setEditingMotionSceneId(scene.id)}
                                    className="text-[9px] text-blue-500 hover:underline font-bold"
                                  >
                                    Xem Full
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <button 
                onClick={addScene}
                className="w-full py-6 bg-slate-50/50 hover:bg-green-50 text-slate-400 hover:text-green-600 transition-all flex items-center justify-center gap-2 font-bold border-t border-slate-100"
              >
                <Plus size={20} />
                Thêm Phân đoạn mới
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-slate-100">
        <p className="text-slate-400 text-sm">
          Prompting by <a href="https://xizital.com" target="_blank" rel="noopener noreferrer" className="text-green-600 font-semibold hover:underline">Qmax</a>
        </p>
      </footer>

      {/* Coffee Bubble */}
      <div className="fixed bottom-8 right-8 z-[100]">
        <button
          onClick={() => setIsCoffeeModalOpen(true)}
          className="w-14 h-14 rounded-full primary-gradient text-white shadow-lg shadow-green-200 flex items-center justify-center hover:scale-110 transition-transform group relative"
        >
          <Coffee size={24} />
          <span className="absolute right-full mr-4 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Mời Qmax một ly cà phê
          </span>
        </button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {/* API Key Modal */}
        {isApiKeyModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsApiKeyModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass-panel rounded-3xl p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Quản lý API Key</h2>
                <button onClick={() => setIsApiKeyModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-slate-500">Nhập API Key của Gemini để sử dụng các chức năng AI của App.</p>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Nhập API Key tại đây..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                />
                <button 
                  onClick={() => setIsApiKeyModalOpen(false)}
                  className="w-full py-3 primary-gradient text-white font-bold rounded-xl shadow-lg shadow-green-100 hover:opacity-90 transition-opacity"
                >
                  Lưu API Key
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Full View Modal */}
        {fullViewSceneId && currentFullViewScene && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setFullViewSceneId(null)}
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-6xl flex flex-col md:flex-row gap-8 items-stretch"
            >
              {/* Image Section */}
              <div className="flex-1 relative group">
                <div className="aspect-video rounded-3xl overflow-hidden bg-black flex items-center justify-center border border-white/10 shadow-2xl">
                  {currentFullViewScene.generatedImageUrl ? (
                    <img src={currentFullViewScene.generatedImageUrl} alt="Full" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <Loader2 className="animate-spin text-white" size={48} />
                  )}
                </div>
                
                {/* Navigation */}
                <button 
                  onClick={() => {
                    const prevIdx = (currentFullViewIndex - 1 + project.scenes.length) % project.scenes.length;
                    setFullViewSceneId(project.scenes[prevIdx].id);
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                >
                  <ChevronLeft size={32} />
                </button>
                <button 
                  onClick={() => {
                    const nextIdx = (currentFullViewIndex + 1) % project.scenes.length;
                    setFullViewSceneId(project.scenes[nextIdx].id);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                >
                  <ChevronRight size={32} />
                </button>
              </div>

              {/* Info & Refinement Section */}
              <div className="w-full md:w-96 glass-panel rounded-3xl p-8 flex flex-col justify-between border-white/10">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black text-white">SCENE {currentFullViewIndex + 1}</h2>
                    <button onClick={() => setFullViewSceneId(null)} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
                      <X size={24} />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tiếng Việt</label>
                    <p className="text-slate-200 text-sm leading-relaxed">{currentFullViewScene.vietnamese || "Chưa có nội dung"}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bối cảnh</label>
                    <p className="text-slate-200 text-xs italic leading-relaxed">{currentFullViewScene.contextDesc || "Chưa có mô tả bối cảnh"}</p>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tinh chỉnh ảnh</label>
                    <div className="relative">
                      <textarea 
                        value={refinementPrompt}
                        onChange={(e) => setRefinementPrompt(e.target.value)}
                        placeholder="Nhập yêu cầu sửa ảnh (ví dụ: làm sáng hơn, đổi màu áo...)"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:ring-1 focus:ring-green-500 min-h-[120px] resize-none"
                      />
                      <button 
                        onClick={() => {
                          generateImage(currentFullViewScene.id, `${currentFullViewScene.contextDesc}. Refinement: ${refinementPrompt}`);
                          setRefinementPrompt('');
                        }}
                        disabled={currentFullViewScene.isGenerating}
                        className="absolute bottom-3 right-3 p-2 primary-gradient text-white rounded-xl shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>

                  {currentFullViewScene.motionPrompt && (
                    <div className="space-y-4 p-4 bg-blue-900/20 rounded-2xl border border-blue-500/20">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Motion Prompt</label>
                        <button 
                          onClick={() => navigator.clipboard.writeText(currentFullViewScene.motionPrompt || '')}
                          className="p-1.5 hover:bg-white/10 rounded text-slate-400"
                          title="Copy Motion Prompt"
                        >
                          <Save size={14} />
                        </button>
                      </div>
                      <p className="text-blue-100 text-[10px] font-bold">{currentFullViewScene.motionPromptName}</p>
                      <p className="text-slate-300 text-[10px] line-clamp-3 leading-relaxed">{currentFullViewScene.motionPrompt}</p>
                      <button 
                        onClick={() => setEditingMotionSceneId(currentFullViewScene.id)}
                        className="text-[10px] text-blue-400 hover:underline font-bold"
                      >
                        Xem Full & Chỉnh sửa
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-8 flex flex-col gap-3">
                  <button 
                    onClick={() => generateImage(currentFullViewScene.id)}
                    disabled={currentFullViewScene.isGenerating}
                    className="w-full py-4 glass-panel text-white font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                    {currentFullViewScene.isGenerating ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                    Tạo lại ảnh gốc
                  </button>
                  <button 
                    onClick={() => downloadSingleImage(currentFullViewScene)}
                    className="w-full py-4 primary-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-green-900/20 hover:opacity-90 transition-opacity"
                  >
                    <Download size={20} />
                    Tải ảnh về máy
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Editing Motion Modal */}
        {editingMotionSceneId && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditingMotionSceneId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass-panel rounded-3xl p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Motion Prompt Chi tiết</h2>
                  <p className="text-xs text-slate-500">Phân cảnh {project.scenes.findIndex(s => s.id === editingMotionSceneId) + 1}</p>
                </div>
                <button onClick={() => setEditingMotionSceneId(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              {(() => {
                const scene = project.scenes.find(s => s.id === editingMotionSceneId);
                if (!scene) return null;
                return (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tóm tắt chuyển động (Tiếng Việt)</label>
                      <input 
                        type="text"
                        value={scene.motionPromptName || ''}
                        onChange={(e) => updateScene(scene.id, { motionPromptName: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-blue-600 outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prompt Motion (English)</label>
                        <button 
                          onClick={() => navigator.clipboard.writeText(scene.motionPrompt || '')}
                          className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline"
                        >
                          <Save size={12} />
                          Copy Full Prompt
                        </button>
                      </div>
                      <textarea 
                        value={scene.motionPrompt || ''}
                        onChange={(e) => updateScene(scene.id, { motionPrompt: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 min-h-[300px] leading-relaxed"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => generateMotionPrompt(scene.id)}
                        disabled={scene.isGeneratingMotion}
                        className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {scene.isGeneratingMotion ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                        Tạo lại Prompt
                      </button>
                      <button 
                        onClick={() => setEditingMotionSceneId(null)}
                        className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:opacity-90 transition-opacity"
                      >
                        Lưu & Đóng
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}

        {/* Script Chat Modal */}
        {isScriptModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsScriptModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl h-[80vh] glass-panel rounded-3xl overflow-hidden flex"
            >
              {/* Chat Area */}
              <div className="flex-1 flex flex-col bg-white/80">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-800">Hỗ trợ Kịch bản</h2>
                  <button onClick={() => setIsScriptModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {scriptMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                        msg.role === 'user' 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-slate-100 text-slate-700 rounded-tl-none'
                      }`}>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        {msg.role === 'ai' && idx === scriptMessages.length - 1 && !isGeneratingScript && (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <button 
                              onClick={() => applyScriptToStoryboard(msg.content)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-all flex items-center gap-2"
                            >
                              <FileSpreadsheet size={16} />
                              Trình bày kịch bản
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isGeneratingScript && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none">
                        <Loader2 className="animate-spin text-slate-400" size={20} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-slate-100 flex gap-3">
                  <input 
                    type="text"
                    value={scriptInput}
                    onChange={(e) => setScriptInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScriptChatSubmit()}
                    placeholder="Nhập yêu cầu tại đây..."
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button 
                    onClick={() => handleScriptChatSubmit()}
                    disabled={isGeneratingScript}
                    className="p-3 bg-blue-600 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>

              {/* Sidebar Controls */}
              <div className="w-72 bg-slate-50 p-6 border-l border-slate-100 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Công cụ kịch bản</h3>
                <button 
                  onClick={() => handleScriptChatSubmit("Chia nhỏ kịch bản trên ra thành các dòng ngắn 7-15 chữ (lưu ý không cắt ngang nội dung đang nói cho phù hợp với số chữ, câu nào phải hết ý câu đó, lưu ý chỉ cắt ngắn không thêm không bớt bất kỳ chữ nào vào kịch bản mỗi đoạn viết ở một dòng, xuống hàng rồi đến phân đoạn tiếp theo, Chỉ viết kịch bản, không thông báo, không trình bày, không chào hỏi, không nói gì thêm khác, chỉ chia nhỏ kịch bản, bắt đầu bằng phân đoạn đầu được chia nhỏ kết thúc là phân đoạn cuối. Ví dụ câu trả lời mẫu là:\nNgày hôm nay chúng ta cùng nhau chào đón một vị khách mời\nNgười này vô cùng đặc biệt.\nCó thể bạn đã thấy anh ta qua tivi, bởi vì anh ta nổi tiếng.\nMỗi phân đoạn chia ngắn như vậy về sau nhằm mục đích tạo giọng nói và tạo ảnh minh họa vì vậy không được chia quá ngắn và không được cắt ngang ý đang triển khai")}
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-left hover:border-blue-500 transition-all group"
                >
                  <div className="flex items-center gap-2 text-blue-600 font-bold mb-1">
                    <Scissors size={16} />
                    Phân đoạn
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">Chia kịch bản thành các câu ngắn để tạo ảnh & voice.</p>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isCoffeeModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsCoffeeModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm glass-panel rounded-3xl p-8 text-center space-y-6"
            >
              <div className="flex justify-end">
                <button onClick={() => setIsCoffeeModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800">Mời Qmax một ly cà phê</h2>
                <p className="text-sm text-slate-500">Nếu bạn thấy những chia sẻ của mình hữu ích, hãy mời mình một ly cà phê nhé!</p>
                <div className="aspect-square w-full max-w-[240px] mx-auto rounded-2xl overflow-hidden border-4 border-white shadow-lg">
                  <img 
                    src="https://xizital.com/wp-content/uploads/2025/10/z7084477223291_1aa5f551f0f549b6d3d1d72d70e3d4e4.jpg" 
                    alt="QR Code" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <p className="text-xs text-slate-400 italic">"Đổi nội dung bong bóng này tùy theo nhu cầu của bạn"</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
