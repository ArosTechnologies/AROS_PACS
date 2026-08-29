import { useState } from 'react';

interface ScheduleBuilderProps {
  value: string;
  onChange: (formattedSchedule: string) => void;
}

interface DayBlock {
  enabled: boolean;
  open: string;
  close: string;
}

interface ScheduleState {
  weekdays: DayBlock;
  saturday: DayBlock;
  sunday: DayBlock;
}

export default function ScheduleBuilder({ value, onChange }: ScheduleBuilderProps) {
  // Parse incoming formatted string into state
  const parseSchedule = (str: string): ScheduleState => {
    const s = str || '';
    const is24_7 = s.toLowerCase().includes('24 horas') || s.toLowerCase().includes('24/7');

    if (is24_7) {
      return {
        weekdays: { enabled: true, open: '00:00', close: '23:59' },
        saturday: { enabled: true, open: '00:00', close: '23:59' },
        sunday: { enabled: true, open: '00:00', close: '23:59' },
      };
    }

    // Default Fallback
    const result: ScheduleState = {
      weekdays: { enabled: true, open: '07:00', close: '20:00' },
      saturday: { enabled: true, open: '08:00', close: '15:00' },
      sunday: { enabled: false, open: '09:00', close: '14:00' },
    };

    // Extract hours like "07:00 - 20:00"
    const weekdayMatch = s.match(/Lun\s*-\s*Vie[^:]*:\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
    if (weekdayMatch) {
      result.weekdays = { enabled: true, open: weekdayMatch[1], close: weekdayMatch[2] };
    }

    const satMatch = s.match(/S[áa]b[^:]*:\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
    if (satMatch) {
      result.saturday = { enabled: true, open: satMatch[1], close: satMatch[2] };
    } else if (s.toLowerCase().includes('sáb: cerrado') || s.toLowerCase().includes('sab: cerrado')) {
      result.saturday = { enabled: false, open: '08:00', close: '15:00' };
    }

    const sunMatch = s.match(/Dom[^:]*:\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
    if (sunMatch) {
      result.sunday = { enabled: true, open: sunMatch[1], close: sunMatch[2] };
    } else if (s.toLowerCase().includes('dom: cerrado')) {
      result.sunday = { enabled: false, open: '09:00', close: '14:00' };
    }

    return result;
  };

  const [schedule, setSchedule] = useState<ScheduleState>(() => parseSchedule(value));
  const [activePreset, setActivePreset] = useState<string>('custom');

  // Serialize state to string
  const serializeSchedule = (st: ScheduleState): string => {
    const parts: string[] = [];

    // Weekdays
    if (st.weekdays.enabled) {
      parts.push(`Lun - Vie: ${st.weekdays.open} - ${st.weekdays.close}`);
    } else {
      parts.push('Lun - Vie: Cerrado');
    }

    // Saturday
    if (st.saturday.enabled) {
      parts.push(`Sáb: ${st.saturday.open} - ${st.saturday.close}`);
    } else {
      parts.push('Sáb: Cerrado');
    }

    // Sunday
    if (st.sunday.enabled) {
      parts.push(`Dom: ${st.sunday.open} - ${st.sunday.close}`);
    } else {
      parts.push('Dom: Cerrado');
    }

    return parts.join(' | ');
  };

  const updateField = (
    block: 'weekdays' | 'saturday' | 'sunday',
    field: keyof DayBlock,
    val: boolean | string
  ) => {
    setSchedule((prev) => {
      const updated = {
        ...prev,
        [block]: {
          ...prev[block],
          [field]: val,
        },
      };
      const str = serializeSchedule(updated);
      onChange(str);
      return updated;
    });
    setActivePreset('custom');
  };

  const applyPreset = (type: 'standard' | 'extended' | '24_7' | 'continuous_sat') => {
    let preset: ScheduleState;
    if (type === 'standard') {
      preset = {
        weekdays: { enabled: true, open: '07:00', close: '20:00' },
        saturday: { enabled: true, open: '08:00', close: '15:00' },
        sunday: { enabled: false, open: '09:00', close: '14:00' },
      };
    } else if (type === 'extended') {
      preset = {
        weekdays: { enabled: true, open: '06:30', close: '21:00' },
        saturday: { enabled: true, open: '07:30', close: '18:00' },
        sunday: { enabled: true, open: '08:00', close: '14:00' },
      };
    } else if (type === 'continuous_sat') {
      preset = {
        weekdays: { enabled: true, open: '08:00', close: '20:00' },
        saturday: { enabled: true, open: '08:00', close: '20:00' },
        sunday: { enabled: false, open: '09:00', close: '14:00' },
      };
    } else {
      // 24/7
      preset = {
        weekdays: { enabled: true, open: '00:00', close: '23:59' },
        saturday: { enabled: true, open: '00:00', close: '23:59' },
        sunday: { enabled: true, open: '00:00', close: '23:59' },
      };
    }

    setSchedule(preset);
    setActivePreset(type);
    onChange(serializeSchedule(preset));
  };

  // Time Validation
  const hasTimeError = (block: DayBlock) => {
    if (!block.enabled) return false;
    return block.open >= block.close && block.close !== '00:00' && block.close !== '23:59';
  };

  return (
    <div className="flex flex-col gap-4 w-full bg-slate-50 p-5 border border-slate-200 shadow-sm">
      {/* Header with Quick Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
            Constructor Interactivo de Horarios
          </span>
          <span className="text-[11px] text-slate-500">
            Define los rangos de atención precisos sin riesgo de formato inválido.
          </span>
        </div>

        {/* Quick Presets Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => applyPreset('standard')}
            className={`px-2.5 py-1 border text-[11px] font-bold shadow-xs cursor-pointer transition-colors ${
              activePreset === 'standard'
                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
            }`}
          >
            Estándar (7-20 / Sáb 8-15)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('extended')}
            className={`px-2.5 py-1 border text-[11px] font-bold shadow-xs cursor-pointer transition-colors ${
              activePreset === 'extended'
                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
            }`}
          >
            Extendido (6:30-21)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('24_7')}
            className={`px-2.5 py-1 border text-[11px] font-bold shadow-xs cursor-pointer transition-colors ${
              activePreset === '24_7'
                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
            }`}
          >
            24/7 Urgencias
          </button>
          <button
            type="button"
            disabled
            className={`px-2.5 py-1 border text-[11px] font-bold shadow-xs transition-colors ${
              activePreset === 'custom'
                ? 'bg-[var(--color-clinic-accent)] text-white border-[var(--color-clinic-accent)]'
                : 'bg-slate-100 border-slate-200 text-slate-400'
            }`}
          >
            Personalizado
          </button>
        </div>
      </div>

      {/* Grid of 3 Structured Shift Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Block 1: Lunes a Viernes */}
        <div
          className={`p-4 border transition-all ${
            schedule.weekdays.enabled
              ? 'bg-white border-slate-300 shadow-xs'
              : 'bg-slate-100/70 border-slate-200 opacity-75'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-slate-600">calendar_today</span>
              <span className="font-bold text-xs text-slate-900">Lunes a Viernes</span>
            </div>
            <button
              type="button"
              onClick={() => updateField('weekdays', 'enabled', !schedule.weekdays.enabled)}
              className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer border ${
                schedule.weekdays.enabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {schedule.weekdays.enabled ? 'Abierto' : 'Cerrado'}
            </button>
          </div>

          {schedule.weekdays.enabled ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Apertura</label>
                  <input
                    type="time"
                    value={schedule.weekdays.open}
                    onChange={(e) => updateField('weekdays', 'open', e.target.value)}
                    className="w-full h-9 border border-slate-300 px-2 text-xs font-mono bg-white focus:border-[var(--color-clinic-accent)] outline-none font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Cierre</label>
                  <input
                    type="time"
                    value={schedule.weekdays.close}
                    onChange={(e) => updateField('weekdays', 'close', e.target.value)}
                    className="w-full h-9 border border-slate-300 px-2 text-xs font-mono bg-white focus:border-[var(--color-clinic-accent)] outline-none font-bold text-slate-800"
                  />
                </div>
              </div>
              {hasTimeError(schedule.weekdays) && (
                <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">warning</span> La hora de cierre debe ser posterior
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-2">Sin servicio entre semana</p>
          )}
        </div>

        {/* Block 2: Sábados */}
        <div
          className={`p-4 border transition-all ${
            schedule.saturday.enabled
              ? 'bg-white border-slate-300 shadow-xs'
              : 'bg-slate-100/70 border-slate-200 opacity-75'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-slate-600">event</span>
              <span className="font-bold text-xs text-slate-900">Sábados</span>
            </div>
            <button
              type="button"
              onClick={() => updateField('saturday', 'enabled', !schedule.saturday.enabled)}
              className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer border ${
                schedule.saturday.enabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {schedule.saturday.enabled ? 'Abierto' : 'Cerrado'}
            </button>
          </div>

          {schedule.saturday.enabled ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Apertura</label>
                  <input
                    type="time"
                    value={schedule.saturday.open}
                    onChange={(e) => updateField('saturday', 'open', e.target.value)}
                    className="w-full h-9 border border-slate-300 px-2 text-xs font-mono bg-white focus:border-[var(--color-clinic-accent)] outline-none font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Cierre</label>
                  <input
                    type="time"
                    value={schedule.saturday.close}
                    onChange={(e) => updateField('saturday', 'close', e.target.value)}
                    className="w-full h-9 border border-slate-300 px-2 text-xs font-mono bg-white focus:border-[var(--color-clinic-accent)] outline-none font-bold text-slate-800"
                  />
                </div>
              </div>
              {hasTimeError(schedule.saturday) && (
                <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">warning</span> La hora de cierre debe ser posterior
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-2">Cerrado los sábados</p>
          )}
        </div>

        {/* Block 3: Domingos y Feriados */}
        <div
          className={`p-4 border transition-all ${
            schedule.sunday.enabled
              ? 'bg-white border-slate-300 shadow-xs'
              : 'bg-slate-100/70 border-slate-200 opacity-75'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-slate-600">weekend</span>
              <span className="font-bold text-xs text-slate-900">Domingos y Feriados</span>
            </div>
            <button
              type="button"
              onClick={() => updateField('sunday', 'enabled', !schedule.sunday.enabled)}
              className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer border ${
                schedule.sunday.enabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {schedule.sunday.enabled ? 'Abierto' : 'Cerrado'}
            </button>
          </div>

          {schedule.sunday.enabled ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Apertura</label>
                  <input
                    type="time"
                    value={schedule.sunday.open}
                    onChange={(e) => updateField('sunday', 'open', e.target.value)}
                    className="w-full h-9 border border-slate-300 px-2 text-xs font-mono bg-white focus:border-[var(--color-clinic-accent)] outline-none font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Cierre</label>
                  <input
                    type="time"
                    value={schedule.sunday.close}
                    onChange={(e) => updateField('sunday', 'close', e.target.value)}
                    className="w-full h-9 border border-slate-300 px-2 text-xs font-mono bg-white focus:border-[var(--color-clinic-accent)] outline-none font-bold text-slate-800"
                  />
                </div>
              </div>
              {hasTimeError(schedule.sunday) && (
                <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">warning</span> La hora de cierre debe ser posterior
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-2">Cerrado domingos y festivos</p>
          )}
        </div>
      </div>
    </div>
  );
}
