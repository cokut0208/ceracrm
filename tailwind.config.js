// tailwind.config.js
// TAM KOD - Animasyonlu Ellipsis Keyframes ve Utility Eklendi
const plugin = require('tailwindcss/plugin'); // Plugin import edildi

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        md: '2rem',
        lg: '3rem',
        xl: '4rem',
        '2xl': '5rem',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1400px',
      },
    },
    extend: { // Mevcut extend ayarların burada devam ediyor
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      keyframes: { // Mevcut keyframes'lere ekleme yapıyoruz
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        // --- YENİ EKLENEN KEYFRAMES ---
        'ellipsis-animation': { // Animasyon adı
          '0%, 100%': { content: '"."' },   // Başlangıç ve bitiş: .
          '33%': { content: '".."' }, // Orta 1: ..
          '66%': { content: '"..."' }, // Orta 2: ...
        },
        // --- YENİ EKLENEN KEYFRAMES SONU ---
      },
      animation: { // Mevcut animation'lara ekleme yapıyoruz
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        // --- YENİ EKLENEN ANİMASYON UTILITY ---
        // `animate-ellipsis` class'ını oluşturur ve `ellipsis-animation` keyframes'ini kullanır
        'ellipsis': 'ellipsis-animation 1.2s infinite steps(1, end)',
        // --- YENİ EKLENEN ANİMASYON UTILITY SONU ---
      },
    }, // extend bloğu burada bitiyor
  },
  plugins: [
    require('tailwindcss-animate'),
    // --- YENİ EKLENEN PLUGIN ---
    // Bu plugin, `animate-ellipsis` class'ına sahip elemanın ::after pseudo-element'ını hedefler
    // ve animasyon için gerekli başlangıç content'ini ve diğer stilleri ayarlar.
    plugin(function({ addUtilities }) {
      addUtilities({
        '.animate-ellipsis': {
          '&::after': {
            content: '""', // Başlangıç content'i boş
            display: 'inline-block', // Yan yana durması için
            width: '1.25em', // Noktaların sığacağı kadar genişlik (ayarlanabilir)
            'text-align': 'left', // Noktaları sola yasla
            animation: 'ellipsis-animation 1.2s infinite steps(1, end)', // Keyframes'i uygula
             // Dikey hizalamayı ayarla (opsiyonel, duruma göre gerekebilir)
            // 'vertical-align': 'bottom',
          }
        }
      })
    })
    // --- YENİ EKLENEN PLUGIN SONU ---
  ],
};