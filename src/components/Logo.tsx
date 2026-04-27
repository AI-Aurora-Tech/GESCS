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
      case 'Senior': return { primary: '#991B1B', secondary: '#FFFFFF', text: 'Senior' }; // Maroon
      case 'Pioneiro': return { primary: '#1E293B', secondary: '#FFFFFF', text: 'Pioneiro' }; // Slate
      default: return { primary: '#1E3A8A', secondary: '#FACC15', text: 'GESCS' }; // Navy Blue/Yellow
    }
  };

  const colors = getColors();

  const isGroup = branch === 'Grupo' || !branch || branch === '';

  if (isGroup) {
    return (
      <div className={`flex flex-col items-center justify-center relative ${className}`} style={{ width: size, height: size }}>
        <img 
          src="/logos/logo-grupo.png" 
          alt="GESCS" 
          className="w-full h-full object-contain z-10"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).parentElement?.classList.add('use-svg-fallback');
          }}
        />
        <div className="hidden [.use-svg-fallback_&]:flex flex-col items-center justify-center w-full h-full">
          <svg viewBox="0 0 100 100" className="w-full h-full shadow-sm">
            <circle cx="50" cy="50" r="45" fill="white" stroke="#1E3A8A" strokeWidth="2" />
            <path 
              d="M50 15 L60 45 L90 45 L65 65 L75 95 L50 75 L25 95 L35 65 L10 45 L40 45 Z" 
              fill="#1E3A8A"
            />
            <path 
              d="M35 45 L50 35 L65 45 L50 55 Z" 
              fill="#FACC15"
            />
            {size > 30 && (
              <text x="50" y="70" textAnchor="middle" fill="white" fontSize="8" fontWeight="black" fontFamily="sans-serif">GESCS</text>
            )}
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
        <path 
          d="M50 10 L60 40 L90 40 L65 60 L75 90 L50 70 L25 90 L35 60 L10 40 L40 40 Z" 
          fill={colors.primary}
          stroke={colors.secondary}
          strokeWidth="2"
        />
        <circle cx="50" cy="50" r="15" fill={colors.secondary} opacity="0.2" />
      </svg>
      {size > 40 && (
        <span className="text-[8px] font-black uppercase tracking-tighter mt-0.5" style={{ color: colors.primary }}>
          {colors.text}
        </span>
      )}
    </div>
  );
};

export default Logo;
