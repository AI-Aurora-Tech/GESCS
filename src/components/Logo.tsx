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
      default: return { primary: '#2563EB', secondary: '#FACC15', text: 'GESCS' }; // Blue/Yellow
    }
  };

  const colors = getColors();

  if (branch === 'Grupo' || !branch) {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <img 
          src="/logos/logo-grupo.png" 
          alt="GESCS" 
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
        {/* Fleur-de-lis inspired shape */}
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
