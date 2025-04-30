import { useState, useEffect } from 'react';
import { Settings, X, Check, Monitor, Moon, Sun, Palette } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';

export function ThemeSelector() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useThemeStore();
  const [selectedColor, setSelectedColor] = useState<string>(() => {
    // Get saved theme color from localStorage or default to indigo
    const savedColor = localStorage.getItem('theme-color');
    return savedColor || 'indigo';
  });

  // Apply theme when component mounts and when selected color changes
  useEffect(() => {
    document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
    document.body.classList.add(`theme-${selectedColor}`);
    
    // Update active colors in CSS for editor and other components
    document.documentElement.style.setProperty('--ql-active-color', getComputedStyle(document.documentElement).getPropertyValue(`--${selectedColor}-500`));
    
    // Save theme to localStorage
    localStorage.setItem('theme-color', selectedColor);
  }, [selectedColor]);

  const handleThemeChange = (color: string) => {
    setSelectedColor(color);
  };

  const colorOptions = [
    { name: 'Indigo', value: 'indigo', color: '#6366f1' },
    { name: 'Blue', value: 'blue', color: '#3b82f6' },
    { name: 'Green', value: 'green', color: '#22c55e' },
    { name: 'Purple', value: 'purple', color: '#a855f7' },
    { name: 'Orange', value: 'orange', color: '#f97316' },
  ];

  return (
    <>
      {/* Theme toggle button */}
      <div 
        className="theme-selector-toggle" 
        onClick={() => setOpen(true)}
        role="button"
        aria-label="Tema Seçenekleri"
      >
        <Palette className="h-5 w-5" />
      </div>

      {/* Theme panel */}
      <div className={`theme-selector-panel ${open ? 'open' : ''}`}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold">Tema Ayarları</h3>
          </div>
          <button 
            onClick={() => setOpen(false)}
            className="p-2 rounded-full hover:bg-muted flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-8 space-y-2">
          <h4 className="text-sm font-medium mb-3">Görünüm Modu</h4>
          <div className="flex gap-2">
            <button 
              onClick={() => setTheme('light')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-lg transition-colors
                         ${theme === 'light' 
                           ? 'border-2 border-primary bg-primary/5' 
                           : 'border border-border bg-background hover:bg-muted'}`}
            >
              <Sun className={`h-5 w-5 ${theme === 'light' ? 'text-primary' : 'text-foreground'}`} />
              <span>Açık</span>
            </button>
            <button 
              onClick={() => setTheme('system')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-lg transition-colors
                         ${theme === 'system' 
                           ? 'border-2 border-primary bg-primary/5' 
                           : 'border border-border bg-background hover:bg-muted'}`}
            >
              <Monitor className={`h-5 w-5 ${theme === 'system' ? 'text-primary' : 'text-foreground'}`} />
              <span>Sistem</span>
            </button>
            <button 
              onClick={() => setTheme('dark')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-lg transition-colors
                         ${theme === 'dark' 
                           ? 'border-2 border-primary bg-primary/5' 
                           : 'border border-border bg-background hover:bg-muted'}`}
            >
              <Moon className={`h-5 w-5 ${theme === 'dark' ? 'text-primary' : 'text-foreground'}`} />
              <span>Koyu</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium mb-3">Tema Rengi</h4>
          <div className="grid grid-cols-1 gap-2">
            {colorOptions.map(option => (
              <button 
                key={option.value}
                className={`theme-option flex items-center p-3 rounded-lg transition-colors
                          ${selectedColor === option.value 
                            ? 'border-2 border-primary bg-primary/5' 
                            : 'border border-border hover:bg-muted'}`}
                onClick={() => handleThemeChange(option.value)}
              >
                <div 
                  className="theme-option-color" 
                  style={{ backgroundColor: option.color }}
                />
                <span className="text-foreground">{option.name}</span>
                {selectedColor === option.value && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 border-t pt-6">
          <p className="text-xs text-muted-foreground">
            Tema ayarlarınız tarayıcı üzerinde saklanır ve sistem genelinde kaydedilir.
          </p>
        </div>
      </div>
    </>
  );
}