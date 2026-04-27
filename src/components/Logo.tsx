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

  const getLogoSrc = () => {
    switch (branch) {
      case 'Lobinho': return '/logos/lobinho.png';
      case 'Escoteiro': return '/logos/escoteiro.png';
      case 'Senior': return '/logos/senior.png';
      case 'Pioneiro': return '/logos/pioneiro.png';
      default: return '/logos/logo-grupo.png';
    }
  };

  const logoSrc = getLogoSrc();
  const isGroup = branch === 'Grupo' || !branch || branch === '';

  return (
    <div className={`flex flex-col items-center justify-center relative ${className}`} style={{ width: size, height: size }}>
      <img 
        src={logoSrc} 
        alt={branch} 
        className="w-full h-full object-contain z-10"
        referrerPolicy="no-referrer"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).parentElement?.querySelector('.svg-fallback')?.classList.remove('hidden');
        }}
      />
      <div className="svg-fallback hidden flex flex-col items-center justify-center w-full h-full">
        <svg viewBox="0 0 100 100" className="w-full h-full shadow-sm">
          <circle cx="50" cy="50" r="45" fill="white" stroke={colors.primary} strokeWidth="2" />
          <path 
            d="M50 15 L60 45 L90 45 L65 65 L75 95 L50 75 L25 95 L35 65 L10 45 L40 45 Z" 
            fill={colors.primary}
          />
          {size > 30 && (
            <text x="50" y="70" textAnchor="middle" fill="white" fontSize="8" fontWeight="black" fontFamily="sans-serif">GESCS</text>
          )}
        </svg>
      </div>
    </div>
  );
};

export default Logo;
