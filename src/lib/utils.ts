import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Gera um número de referência ÚNICO para cada venda/transação, mesmo que
// duas sejam feitas no mesmo instante. Formato legível: PREFIXO-DDMMAA-HHMMSS-XXXX
// (data/hora + sufixo aleatório que evita colisão de refs simultâneas).
export function genRef(prefix: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${p(d.getDate())}${p(d.getMonth() + 1)}${p(d.getFullYear() % 100)}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}
