const fs = require('fs');
const b64 = fs.readFileSync('public/logos/logo-grupo.png.jpeg').toString('base64');
const dataUri = 'data:image/jpeg;base64,' + b64;
const tsx = `import React from 'react';

// ============================================================================
// LOGO DO 207º GRUPO ESCOTEIRO S. CAETANO DO SUL
// A imagem está EMBUTIDA aqui (data URI) para não depender de arquivo/caminho
// nem de deploy — assim a logo aparece igual no app e nas etiquetas.
//
// COMO TROCAR A LOGO NO FUTURO:
//   1. Salve sua imagem em public/logos/logo-grupo.png.jpeg (ou outro nome).
//   2. Rode: node scripts/gen-logo.cjs   (gera este arquivo com a nova imagem)
//   OU, manualmente: gere um "data URI" da imagem (base64) e substitua a
//   constante GROUP_LOGO abaixo.
// ============================================================================
const GROUP_LOGO = '${dataUri}';

interface LogoProps {
  branch?: 'Lobinho' | 'Escoteiro' | 'Senior' | 'Pioneiro' | 'Grupo';
  className?: string;
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ branch = 'Grupo', className = '', size = 48 }) => {
  // Ramos específicos tentam carregar seus arquivos; se não existirem, caem na
  // logo do grupo (embutida), que nunca falha.
  const branchSrc: Record<string, string> = {
    Lobinho: '/logos/lobinho.png',
    Escoteiro: '/logos/escoteiro.png',
    Senior: '/logos/senior.png',
    Pioneiro: '/logos/pioneiro.png',
  };
  const logoSrc = (branch && branchSrc[branch]) ? branchSrc[branch] : GROUP_LOGO;

  return (
    <div className={\`flex items-center justify-center \${className}\`} style={{ width: size, height: size }}>
      <img
        src={logoSrc}
        alt={branch || 'GESCS'}
        className="w-full h-full object-contain"
        referrerPolicy="no-referrer"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          if (target.src !== GROUP_LOGO) target.src = GROUP_LOGO;
        }}
      />
    </div>
  );
};

export default Logo;
`;
fs.writeFileSync('src/components/Logo.tsx', tsx);
fs.copyFileSync('/tmp/gen-logo.cjs', 'scripts/gen-logo.cjs');
console.log('Logo.tsx gerado. data URI length =', dataUri.length, 'chars');
