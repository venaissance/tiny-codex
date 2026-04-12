import { create } from 'zustand';

export type PreviewTab = 'preview' | 'code' | 'diff' | 'markdown' | 'image' | 'pdf';

interface UIState {
  previewVisible: boolean;
  previewTab: PreviewTab;
  previewFile: string | null;
  projectPath: string | null;
  currentModel: string;
  mode: 'local' | 'worktree';
  theme: 'dark' | 'light';
  togglePreview: () => void;
  setPreviewTab: (tab: PreviewTab) => void;
  setPreviewFile: (file: string | null) => void;
  setProjectPath: (path: string | null) => void;
  setCurrentModel: (model: string) => void;
  setMode: (mode: 'local' | 'worktree') => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  previewVisible: true,
  previewTab: 'preview',
  previewFile: null,
  projectPath: null,
  currentModel: 'MiniMax-M2.7',
  mode: 'local',
  theme: 'light',
  togglePreview: () => set((s) => ({ previewVisible: !s.previewVisible })),
  setPreviewTab: (tab) => set({ previewTab: tab }),
  setPreviewFile: (file) => set({ previewFile: file }),
  setProjectPath: (path) => set({ projectPath: path }),
  setCurrentModel: (model) => set({ currentModel: model }),
  setMode: (mode) => set({ mode }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
}));
