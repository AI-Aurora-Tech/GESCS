import React from 'react';

// ============================================================================
// LOGO DO 207º GRUPO ESCOTEIRO S. CAETANO DO SUL
// A imagem fica em: public/logos/logo-grupo.PNG
//
// COMO TROCAR A LOGO (app, favicon e etiquetas de uma vez):
//   Basta substituir o arquivo public/logos/logo-grupo.PNG pela nova imagem
//   (mantendo o mesmo nome). Todos os lugares usam este componente.
//   Obs.: em servidores (Vercel) o nome diferencia maiúsculas/minúsculas,
//   por isso o nome precisa ser exatamente "logo-grupo.PNG".
// ============================================================================
const GROUP_LOGO = '/logos/logo-grupo.PNG';

// Se o nome principal não for encontrado, tenta variações comuns (à prova de
// maiúsculas/minúsculas e de extensão), antes de desistir.
const GROUP_LOGO_FALLBACKS = [
  '/logos/logo-grupo.png',
  '/logos/logo-grupo.PNG.png',
  '/logos/logo-grupo.png.jpeg',
];

interface LogoProps {
  branch?: 'Lobinho' | 'Escoteiro' | 'Senior' | 'Pioneiro' | 'Grupo';
  className?: string;
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ branch = 'Grupo', className = '', size = 48 }) => {
  // Ramos específicos tentam seus próprios arquivos; se não existirem, caem na
  // logo do grupo (via cadeia de fallback do onError).
  const branchSrc: Record<string, string> = {
    Lobinho: '/logos/lobinho.png',
    Escoteiro: '/logos/escoteiro.png',
    Senior: '/logos/senior.png',
    Pioneiro: '/logos/pioneiro.png',
  };
  const primary = (branch && branchSrc[branch]) ? branchSrc[branch] : GROUP_LOGO;

  return (
    <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <img
        src={primary}
        alt={branch || 'GESCS'}
        className="w-full h-full object-contain"
        referrerPolicy="no-referrer"
        data-fallback-step="0"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          const step = Number(img.dataset.fallbackStep || '0');
          if (step < GROUP_LOGO_FALLBACKS.length) {
            img.dataset.fallbackStep = String(step + 1);
            img.src = GROUP_LOGO_FALLBACKS[step];
          }
        }}
      />
    </div>
  );
};

export default Logo;
