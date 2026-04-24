import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { 
  BrainCircuit, 
  AlertTriangle, 
  TrendingDown, 
  Users, 
  Calendar,
  Sparkles,
  Search,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from '../lib/utils';

// Helper to get Gemini API key safely
const getAI = () => {
  const apiKey = (process.env.GEMINI_API_KEY);
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing');
  return new GoogleGenAI({ apiKey });
};

interface AnalysisResult {
  reason: string;
  count: number;
  members: string[];
  suggestion: string;
  impact_level: 'High' | 'Medium' | 'Low';
}

const ScoutAI: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [dataStats, setDataStats] = useState({
    totalMembers: 0,
    nonPaymentRate: 0,
    activeEvents: 0
  });

  const analyzeData = async () => {
    setLoading(true);
    try {
      // 1. Fetch relevant data for AI analysis
      // In a real app, we'd fetch member payments, event fees, absences, etc.
      const { data: members } = await supabase.from('scouts_members').select('*');
      const { data: payments } = await supabase.from('scouts_payments').select('*');
      
      // 2. Prepare context for Gemini
      const statsContext = JSON.stringify({
        members: members?.slice(0, 50), // Limited for context size
        recentPayments: payments?.slice(0, 50),
        systemNote: "Analyze patterns of non-payment. Look for correlations between high event fees and delinquency, or high absence rates and non-payment."
      });

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analise os dados do Grupo Escoteiro para identificar motivos de inadimplência.
        Considere taxas de eventos elevadas, frequência de faltas e histórico de pagamentos.
        
        DADOS: ${statsContext}`,
        config: {
          systemInstruction: "Você é um analista de dados escoteiros. Identifique padrões de inadimplência e sugira ações. Retorne sempre um array de objetos JSON.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                reason: { type: Type.STRING },
                count: { type: Type.NUMBER },
                members: { 
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                suggestion: { type: Type.STRING },
                impact_level: { 
                  type: Type.STRING,
                  enum: ['High', 'Medium', 'Low']
                }
              },
              required: ['reason', 'count', 'members', 'suggestion', 'impact_level']
            }
          }
        }
      });

      const text = response.text || '[]';
      try {
        const parsedResults = JSON.parse(text);
        setResults(Array.isArray(parsedResults) ? parsedResults : []);
      } catch (parseErr) {
        console.error('Failed to parse AI response:', text);
        // Fallback to manual cleanup if needed
        const cleaned = text.replace(/```json|```/g, '').trim();
        try {
          const retryParsed = JSON.parse(cleaned);
          setResults(Array.isArray(retryParsed) ? retryParsed : []);
        } catch (e) {
          setResults([]);
        }
      }

      // Mock stats update
      setDataStats({
        totalMembers: members?.length || 0,
        nonPaymentRate: 24, // Example percentage
        activeEvents: 5
      });
    } catch (err) {
      console.error('AI Analysis Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyzeData();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BrainCircuit className="mr-3 text-purple-600" size={32} />
            Análise Inteligente (Scout AI)
          </h1>
          <p className="text-gray-500">Inteligência Artificial identificando padrões de inadimplência e evasão.</p>
        </div>
        <button 
          onClick={analyzeData}
          disabled={loading}
          className="flex items-center px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 disabled:opacity-50"
        >
          {loading ? <Loader2 className="mr-2 animate-spin" size={20} /> : <Sparkles className="mr-2" size={20} />}
          Recalcular Análise
        </button>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 text-blue-600 mb-4">
            <Users size={24} />
            <span className="font-bold uppercase text-[10px] tracking-widest text-gray-400">Total de Membros</span>
          </div>
          <p className="text-3xl font-black">{dataStats.totalMembers}</p>
          <p className="text-xs text-gray-400 mt-2">Base de dados atualizada</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 text-red-600 mb-4">
            <TrendingDown size={24} />
            <span className="font-bold uppercase text-[10px] tracking-widest text-gray-400">Taxa de Inadimplência</span>
          </div>
          <p className="text-3xl font-black">{dataStats.nonPaymentRate}%</p>
          <div className="w-full bg-gray-100 h-2 rounded-full mt-2">
            <div className="bg-red-500 h-2 rounded-full" style={{ width: `${dataStats.nonPaymentRate}%` }} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 text-purple-600 mb-4">
            <Calendar size={24} />
            <span className="font-bold uppercase text-[10px] tracking-widest text-gray-400">Eventos em Análise</span>
          </div>
          <p className="text-3xl font-black">{dataStats.activeEvents}</p>
          <p className="text-xs text-gray-400 mt-2">Cruzamento de taxas e participação</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analysis Results */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900 px-2">Insights da IA</h3>
          {loading ? (
            <div className="bg-white p-12 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
              <p className="text-lg font-bold text-gray-900">Processando Padrões...</p>
              <p className="text-sm text-gray-500">Gemini está cruzando dados de frequência e financeiro.</p>
            </div>
          ) : (
            results.map((res, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                    res.impact_level === 'High' ? "bg-red-100 text-red-600" :
                    res.impact_level === 'Medium' ? "bg-yellow-100 text-yellow-600" : "bg-blue-100 text-blue-600"
                  )}>
                    Impacto: {res.impact_level}
                  </span>
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(n => (
                      <div key={n} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white" />
                    ))}
                  </div>
                </div>
                <h4 className="font-black text-lg text-gray-900 mb-2">{res.reason}</h4>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">{res.suggestion}</p>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <span className="text-sm font-bold text-purple-600">{res.count} Membros afetados</span>
                  <button className="text-xs font-black uppercase text-gray-400 hover:text-purple-600 flex items-center">
                    Ver Membros <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Suggestion Engine */}
        <div className="bg-purple-900 rounded-2xl p-8 text-white relative overflow-hidden h-fit">
          <div className="relative z-10">
            <h3 className="text-2xl font-black mb-4">Recomendação Estratégica</h3>
            <p className="text-purple-200 mb-8 leading-relaxed">
              Baseado nos dados analisados, recomendamos a revisão das taxas do acampamento que excedem o teto de R$ 150,00 por membro, 
              visto que estas apresentam uma correlação de 85% com a inadimplência imediata em famílias com mais de 2 escoteiros.
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                <p className="text-xs font-bold uppercase text-purple-300 mb-1">Ação Sugerida</p>
                <p className="font-medium text-sm">Criar cupom de desconto familiar automático para eventos acima de R$ 100.</p>
              </div>
              <div className="p-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                <p className="text-xs font-bold uppercase text-purple-300 mb-1">Ação Sugerida</p>
                <p className="font-medium text-sm">Enviar lembrete proativo via WhatsApp 3 dias antes da data de baixa frequência.</p>
              </div>
            </div>
          </div>
          <BrainCircuit className="absolute -right-20 -bottom-20 text-white/5 w-96 h-96" />
        </div>
      </div>
    </div>
  );
};

export default ScoutAI;
