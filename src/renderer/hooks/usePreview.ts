import { useCallback } from 'react';
import { useUIStore } from '../stores/ui-store';

export function usePreview() {
  const setPreviewFile = useCallback((file: string | null) => {
    useUIStore.getState().setPreviewFile(file);
  }, []);

  const showDiff = useCallback((file: string) => {
    useUIStore.getState().setPreviewFile(file);
    useUIStore.getState().setPreviewTab('diff');
  }, []);

  const showCode = useCallback((file: string) => {
    useUIStore.getState().setPreviewFile(file);
    useUIStore.getState().setPreviewTab('code');
  }, []);

  const showMarkdown = useCallback((file: string) => {
    useUIStore.getState().setPreviewFile(file);
    useUIStore.getState().setPreviewTab('markdown');
  }, []);

  return { setPreviewFile, showDiff, showCode, showMarkdown };
}
