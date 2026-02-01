import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';

const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (ipcRenderer) {
        const max = await ipcRenderer.invoke('window-is-maximized');
        setIsMaximized(max);
      }
    };
    check();
  }, []);

  const minimize = () => ipcRenderer?.send('window-minimize');
  const maximize = () => {
    ipcRenderer?.send('window-maximize');
    setIsMaximized(!isMaximized);
  };
  const close = () => ipcRenderer?.send('window-close');

  return (
    <div className="h-10 flex items-center justify-between bg-orion-bg/80 backdrop-blur-md border-b border-orion-border-subtle shrink-0 z-50">
      {/* Drag region */}
      <div className="flex-1 h-full flex items-center px-4 app-drag">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-md bg-gradient-orion flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">O</span>
          </div>
          <span className="text-xs font-semibold text-orion-text-secondary tracking-wide">
            Orion Voice
          </span>
        </div>
      </div>

      {/* Window controls */}
      <div className="flex items-center h-full app-no-drag">
        <button
          onClick={minimize}
          className="h-full px-3.5 flex items-center justify-center text-orion-text-tertiary hover:text-orion-text hover:bg-white/5 transition-colors duration-150"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={maximize}
          className="h-full px-3.5 flex items-center justify-center text-orion-text-tertiary hover:text-orion-text hover:bg-white/5 transition-colors duration-150"
        >
          {isMaximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          onClick={close}
          className="h-full px-3.5 flex items-center justify-center text-orion-text-tertiary hover:text-white hover:bg-red-500/80 transition-colors duration-150"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
