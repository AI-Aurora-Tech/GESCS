import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Filter, 
  Info, 
  MapPin, 
  Clock, 
  Trash2,
  List,
  Grid
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface ScoutEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  branch: 'Filhote' | 'Lobinho' | 'Escoteiro' | 'Senior' | 'Pioneiro' | 'Grupo Geral' | 'Chefia';
  created_at?: string;
}

const BRANCH_CONFIG = {
  'Filhote': { label: 'Filhote', color: 'bg-orange-500 text-white', border: 'border-orange-500', hex: '#F97316' },
  'Lobinho': { label: 'Lobinho', color: 'bg-yellow-400 text-gray-900', border: 'border-yellow-400', hex: '#FACC15' },
  'Escoteiro': { label: 'Escoteiro', color: 'bg-emerald-600 text-white', border: 'border-emerald-600', hex: '#059669' },
  'Senior': { label: 'Senior', color: 'bg-rose-900 text-white', border: 'border-rose-900', hex: '#4C0519' },
  'Pioneiro': { label: 'Pioneiro', color: 'bg-red-600 text-white', border: 'border-red-600', hex: '#DC2626' },
  'Grupo Geral': { label: 'Grupo Geral', color: 'bg-orange-400 text-white', border: 'border-orange-400', hex: '#FB923C' },
  'Chefia': { label: 'Chefia', color: 'bg-blue-600 text-white', border: 'border-blue-600', hex: '#2563EB' }
};

// Fixed Brazilian National Holidays for current/any year
const getHolidays = (year: number) => {
  return [
    { date: `${year}-01-01`, title: 'Confraternização Universal (Ano Novo)' },
    { date: `${year}-04-21`, title: 'Tiradentes' },
    { date: `${year}-05-01`, title: 'Dia do Trabalho' },
    { date: `${year}-09-07`, title: 'Independência do Brasil' },
    { date: `${year}-10-12`, title: 'Nossa Senhora Aparecida' },
    { date: `${year}-11-02`, title: 'Finados' },
    { date: `${year}-11-15`, title: 'Proclamação da República' },
    { date: `${year}-11-20`, title: 'Dia da Consciência Negra' },
    { date: `${year}-12-25`, title: 'Natal' },
    // Static estimations for Easter/Carnaval/Corpus Christi in 2026 for convenience
    { date: '2026-02-17', title: 'Carnaval' },
    { date: '2026-04-03', title: 'Sexta-feira Santa' },
    { date: '2026-06-04', title: 'Corpus Christi' }
  ];
};

const DEFAULT_EVENTS: ScoutEvent[] = [
  { id: 'se-1', title: 'Indaba Geral de Planejamento', description: 'Reunião de alinhamento de chefia e planejamento de atividades do semestre.', date: '2026-06-06', branch: 'Chefia' },
  { id: 'se-2', title: 'Grande Fogo de Conselho', description: 'Celebração tradicional com música, esquetes e integração de todos os ramos.', date: '2026-06-13', branch: 'Grupo Geral' },
  { id: 'se-3', title: 'Jornada Pioneira de Sobrevivência', description: 'Atividade prática de caminhada, orientação e acampamento rústico.', date: '2026-06-18', branch: 'Pioneiro' },
  { id: 'se-4', title: 'Cerimônia de Promessa Lobinho', description: 'Passagem e entrega de lenços e distintivos de promessa aos novos lobinhos.', date: '2026-06-20', branch: 'Lobinho' },
  { id: 'se-5', title: 'Grande Acampamento de Grupo', description: 'Acampamento conjunto no sítio com gincanas e técnicas mateiras avançadas.', date: '2026-06-27', branch: 'Grupo Geral' },
  { id: 'se-6', title: 'Atividade Especial Ramo Filhote', description: 'Brincadeiras ao ar livre e introdução às primeiras técnicas de nós simples.', date: '2026-06-05', branch: 'Filhote' },
  { id: 'se-7', title: 'Treinamento de Sobrevivência Escoteiro', description: 'Pioneiras de abrigo e cozinha mateira para patrulhas.', date: '2026-06-14', branch: 'Escoteiro' },
  { id: 'se-8', title: 'Fórum de Jovens Líderes Sênior', description: 'Debates sobre liderança juvenil e engajamento comunitário.', date: '2026-06-21', branch: 'Senior' }
];

const Agenda: React.FC = () => {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 5, 25)); // Set June 2026 based on mock local time
  const [events, setEvents] = useState<ScoutEvent[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [showHolidays, setShowHolidays] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  
  // New Event Form State
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '2026-06-25',
    branch: 'Grupo Geral' as ScoutEvent['branch']
  });

  const year = currentDate.getFullYear();
  const holidays = getHolidays(year);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('scout_events')
        .select('*')
        .order('date', { ascending: true });
      
      if (error) {
        console.warn("Table scout_events might not exist, falling back to local storage.", error);
        loadLocalEvents();
      } else if (data && data.length > 0) {
        setEvents(data);
      } else {
        // Seed default events if database is empty
        setEvents(DEFAULT_EVENTS);
        localStorage.setItem('scout_events', JSON.stringify(DEFAULT_EVENTS));
      }
    } catch (e) {
      console.error(e);
      loadLocalEvents();
    }
  };

  const loadLocalEvents = () => {
    const local = localStorage.getItem('scout_events');
    if (local) {
      setEvents(JSON.parse(local));
    } else {
      setEvents(DEFAULT_EVENTS);
      localStorage.setItem('scout_events', JSON.stringify(DEFAULT_EVENTS));
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const eventItem: ScoutEvent = {
      id: Math.random().toString(36).substring(2, 9),
      ...newEvent,
      created_at: new Date().toISOString()
    };

    try {
      // Attempt Supabase insert
      const { error } = await supabase.from('scout_events').insert([newEvent]);
      if (error) throw error;
      fetchEvents();
    } catch (err) {
      console.warn("Could not insert in Supabase, saving locally", err);
      const updated = [...events, eventItem].sort((a, b) => a.date.localeCompare(b.date));
      setEvents(updated);
      localStorage.setItem('scout_events', JSON.stringify(updated));
    }

    setIsModalOpen(false);
    setNewEvent({
      title: '',
      description: '',
      date: format(currentDate, 'yyyy-MM-dd'),
      branch: 'Grupo Geral'
    });
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Deseja realmente excluir este evento da agenda?")) return;
    try {
      const { error } = await supabase.from('scout_events').delete().eq('id', id);
      if (error) throw error;
      fetchEvents();
    } catch (err) {
      console.warn("Supabase delete failed, deleting locally", err);
      const updated = events.filter(ev => ev.id !== id);
      setEvents(updated);
      localStorage.setItem('scout_events', JSON.stringify(updated));
    }
  };

  // Month Math
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart); // 0 (Sun) to 6 (Sat)

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  // Filters
  const filteredEvents = events.filter(ev => {
    if (selectedBranch !== 'all' && ev.branch !== selectedBranch) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda do Grupo</h1>
          <p className="text-gray-500 text-sm">Calendário de eventos e atividades integradas de todos os Ramos.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
            className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            {viewMode === 'calendar' ? (
              <><List size={16} className="mr-2" /> Modo Lista</>
            ) : (
              <><Grid size={16} className="mr-2" /> Modo Calendário</>
            )}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={16} className="mr-2" /> Novo Evento
          </button>
        </div>
      </header>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Filter size={16} className="text-gray-400 mr-2" />
          <button
            onClick={() => setSelectedBranch('all')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
              selectedBranch === 'all' 
                ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
            )}
          >
            Todos os Ramos
          </button>
          {Object.entries(BRANCH_CONFIG).map(([name, conf]) => (
            <button
              key={name}
              onClick={() => setSelectedBranch(name)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                selectedBranch === name 
                  ? `${conf.color} ${conf.border} shadow-sm` 
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              )}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: conf.hex }}></span>
              {name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center cursor-pointer text-xs font-medium text-gray-600">
            <input 
              type="checkbox" 
              checked={showHolidays} 
              onChange={(e) => setShowHolidays(e.target.checked)}
              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Feriados Nacionais
          </label>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Calendar Month Header */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 capitalize flex items-center">
              <CalendarIcon className="mr-2 text-blue-600" size={20} />
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-1">
              <button 
                onClick={handlePrevMonth}
                className="p-2 hover:bg-gray-50 rounded-lg text-gray-600 border border-gray-200 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={handleNextMonth}
                className="p-2 hover:bg-gray-50 rounded-lg text-gray-600 border border-gray-200 transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Days of week */}
          <div className="grid grid-cols-7 text-center bg-gray-50 border-b border-gray-100 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          {/* Monthly Days Grid */}
          <div className="grid grid-cols-7 auto-rows-[120px] divide-x divide-y divide-gray-100">
            {/* Empty padding cells for start of month */}
            {Array.from({ length: startDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="bg-gray-50/50 p-2 text-gray-300"></div>
            ))}

            {/* Actual day cells */}
            {daysInMonth.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isToday = isSameDay(day, new Date(2026, 5, 25)); // Mock today check
              
              // Filter events for this day
              const dayEvents = filteredEvents.filter(ev => ev.date === dateStr);
              
              // Filter holidays for this day
              const dayHoliday = showHolidays ? holidays.find(h => h.date === dateStr) : null;

              return (
                <div 
                  key={dateStr} 
                  className={cn(
                    "p-2 flex flex-col justify-between transition-colors relative hover:bg-slate-50/50",
                    isToday ? "bg-blue-50/30" : ""
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      "text-sm font-semibold flex items-center justify-center w-6 h-6 rounded-full",
                      isToday ? "bg-blue-600 text-white font-bold" : "text-gray-700"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayHoliday && (
                      <span className="text-[10px] text-red-500 font-bold uppercase truncate max-w-[80px]" title={dayHoliday.title}>
                        Feriado
                      </span>
                    )}
                  </div>

                  {/* Day items container */}
                  <div className="mt-1 space-y-1 overflow-y-auto max-h-[80px] no-scrollbar flex-1">
                    {dayHoliday && (
                      <div className="px-1.5 py-0.5 bg-red-50 border border-red-100 text-red-700 text-[9px] font-medium rounded truncate" title={dayHoliday.title}>
                        🇧🇷 {dayHoliday.title}
                      </div>
                    )}
                    {dayEvents.map(ev => {
                      const conf = BRANCH_CONFIG[ev.branch];
                      return (
                        <div 
                          key={ev.id}
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold truncate cursor-pointer shadow-sm border",
                            conf ? `${conf.color} ${conf.border}` : "bg-gray-100 text-gray-700 border-gray-200"
                          )}
                          title={`${ev.title} (${ev.branch})`}
                        >
                          {ev.title}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Ending grid padding */}
            {Array.from({ length: (7 - ((daysInMonth.length + startDayOfWeek) % 7)) % 7 }).map((_, idx) => (
              <div key={`empty-end-${idx}`} className="bg-gray-50/50 p-2"></div>
            ))}
          </div>
        </div>
      ) : (
        /* Chronological list view */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-sm uppercase text-gray-500">
              Próximos Eventos do Grupo ({filteredEvents.length})
            </div>
            <div className="divide-y divide-gray-100">
              {filteredEvents.map(ev => {
                const conf = BRANCH_CONFIG[ev.branch];
                const dateObj = parseISO(ev.date);
                return (
                  <div key={ev.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex gap-4">
                      {/* Date block */}
                      <div className="bg-slate-100 text-slate-800 p-3 rounded-xl flex flex-col items-center justify-center w-16 h-16 flex-shrink-0 text-center border border-slate-200 shadow-sm">
                        <span className="text-xl font-bold leading-none">{format(dateObj, 'dd')}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider mt-1">{format(dateObj, 'MMM', { locale: ptBR })}</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border", conf ? `${conf.color} ${conf.border}` : "bg-gray-100 text-gray-700")}>
                            {ev.branch}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-base">{ev.title}</h3>
                        {ev.description && <p className="text-sm text-gray-500 mt-1">{ev.description}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                      <button 
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Excluir evento"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredEvents.length === 0 && (
                <div className="p-12 text-center text-gray-400">
                  <CalendarIcon size={48} className="mx-auto mb-4 opacity-10" />
                  Nenhum evento agendado para o filtro selecionado.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 animate-in fade-in duration-200">
            <h2 className="text-xl font-bold mb-6">Criar Novo Evento</h2>
            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título do Evento</label>
                <input 
                  required
                  type="text"
                  placeholder="Ex: Mutirão, Indaba, Passagem..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input 
                  required
                  type="date"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ramo Responsável / Atrelado</label>
                <select 
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newEvent.branch}
                  onChange={(e) => setNewEvent({...newEvent, branch: e.target.value as any})}
                >
                  {Object.keys(BRANCH_CONFIG).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição / Detalhes</label>
                <textarea 
                  rows={3}
                  placeholder="Informações adicionais para os escoteiros/chefes..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
                >
                  Adicionar Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agenda;
