import React from 'react';

interface LogoProps {
  branch?: 'Lobinho' | 'Escoteiro' | 'Senior' | 'Pioneiro' | 'Grupo';
  className?: string;
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ branch = 'Grupo', className = '', size = 48 }) => {
  const getColors = () => {
    switch (branch) {
      case 'Lobinho': return { primary: '#FACC15', secondary: '#1E40AF', text: 'Lobinho' }; // Yellow/Blue
      case 'Escoteiro': return { primary: '#15803D', secondary: '#FFFFFF', text: 'Escoteiro' }; // Green
      case 'Senior': return { primary: '#911B1B', secondary: '#FFFFFF', text: 'Senior' }; // Maroon
      case 'Pioneiro': return { primary: '#1E293B', secondary: '#FFFFFF', text: 'Pioneiro' }; // Slate
      default: return { primary: '#F06292', secondary: '#FFFFFF', text: 'GESCS' }; // Pink/Coral from user attachment
    }
  };

  const colors = getColors();

  const getLogoSrc = () => {
    switch (branch) {
      case 'Lobinho': return '/logos/lobinho.png';
      case 'Escoteiro': return '/logos/escoteiro.png';
      case 'Senior': return '/logos/senior.png';
      case 'Pioneiro': return '/logos/pioneiro.png';
      default: return '/logos/logo-grupo.png.png';
    }
  };

  const logoSrc = getLogoSrc();

  return (
    <div className={`flex flex-col items-center justify-center relative ${className}`} style={{ width: size, height: size }}>
      <img 
        src={logoSrc} 
        alt={branch || 'GESCS'} 
        className="w-full h-full object-contain z-10"
        referrerPolicy="no-referrer"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          // Tenta o caminho sem a duplicidade de extensão caso o usuário renomeie
          if (target.src.endsWith('.png.png')) {
            target.src = '/logos/logo-grupo.png';
            return;
          }
          target.style.display = 'none';
          const fallback = target.parentElement?.querySelector('.svg-fallback');
          if (fallback) fallback.classList.remove('hidden');
        }}
      />
      <div className="svg-fallback hidden flex flex-col items-center justify-center w-full h-full">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Main Pink Circle */}
          <circle cx="50" cy="50" r="49" fill="#f98b8b" />
          
          {/* Internal White Dashed Ring */}
          <circle cx="50" cy="50" r="45" fill="none" stroke="white" strokeWidth="0.4" strokeDasharray="2 2" />
          
          {/* Top Text - UEB and Region */}
          <text x="50" y="16" textAnchor="middle" fill="white" fontSize="4.5" fontWeight="black" fontFamily="sans-serif">U.E.B.</text>
          <text x="50" y="24" textAnchor="middle" fill="#FFFFFF" fontSize="3.5" fontWeight="bold" fontFamily="sans-serif">SÃO PAULO</text>
          
          {/* Central Logo Elements (Simplified recreation of the scout badge) */}
          {/* Background Star of David pattern */}
          <path d="M50 35 L68 65 L32 65 Z" fill="none" stroke="#5d4037" strokeWidth="1" opacity="0.6" />
          <path d="M50 70 L68 40 L32 40 Z" fill="none" stroke="#5d4037" strokeWidth="1" opacity="0.6" />
          
          {/* Flor-de-lis */}
          <path d="M50 38 Q58 40 50 62 Q42 40 50 38" fill="#FACC15" stroke="#5d4037" strokeWidth="0.5" />
          <path d="M38 52 Q40 48 50 62 Q60 48 62 52 Q65 60 50 62 Q35 60 38 52" fill="#FACC15" stroke="#5d4037" strokeWidth="0.5" />
          
          {/* Bottom Text - Group Name */}
          <text x="50" y="82" textAnchor="middle" fill="white" fontSize="2.8" fontWeight="bold" fontFamily="sans-serif">207º GRUPO ESCOTEIRO</text>
          <text x="50" y="88" textAnchor="middle" fill="white" fontSize="3" fontWeight="black" fontFamily="sans-serif">S. CAETANO DO SUL</text>
        </svg>
      </div>
    </div>
  );
};

export default Logo;
