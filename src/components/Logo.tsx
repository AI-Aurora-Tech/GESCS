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
      default: return '/logos/logo-grupo.png';
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
          target.style.display = 'none';
          const fallback = target.parentElement?.querySelector('.svg-fallback');
          if (fallback) fallback.classList.remove('hidden');
        }}
      />
      <div className="svg-fallback hidden flex flex-col items-center justify-center w-full h-full">
        <svg viewBox="0 0 100 100" className="w-full h-full shadow-sm">
          <circle cx="50" cy="50" r="48" fill={colors.primary} />
          <circle cx="50" cy="50" r="44" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="2 2" />
          
          {/* Simplified Flor-de-Lis for fallback */}
          <path 
            d="M50 25 L55 45 L75 45 L60 55 L65 75 L50 65 L35 75 L40 55 L25 45 L45 45 Z" 
            fill="white"
            opacity="0.9"
          />
          
          {size > 40 && (
            <>
              <text x="50" y="20" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold" fontFamily="sans-serif">U.E.B.</text>
              <text x="50" y="85" textAnchor="middle" fill="white" fontSize="5" fontWeight="bold" fontFamily="sans-serif">S. CAETANO DO SUL</text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
};

export default Logo;
