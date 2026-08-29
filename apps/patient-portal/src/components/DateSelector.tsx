import { useState, useEffect, useMemo } from 'react';

interface DateSelectorProps {
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function DateSelector({ value, onChange, disabled, className }: DateSelectorProps) {
  const [year, setYear] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [day, setDay] = useState<string>('');

  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        setYear(parts[0]);
        setMonth(parts[1]);
        setDay(parts[2]);
      }
    } else {
      setYear('');
      setMonth('');
      setDay('');
    }
  }, [value]);

  const handleUpdate = (y: string, m: string, d: string) => {
    setYear(y);
    setMonth(m);
    setDay(d);
    
    if (y && m && d) {
      onChange(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    } else {
      onChange(''); // Invalid/incomplete date
    }
  };

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr = [];
    for (let i = currentYear; i >= currentYear - 120; i--) {
      arr.push(i.toString());
    }
    return arr;
  }, [currentYear]);

  const daysInMonth = useMemo(() => {
    if (!year || !month) return 31;
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  }, [year, month]);

  const days = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= daysInMonth; i++) {
      arr.push(i.toString().padStart(2, '0'));
    }
    return arr;
  }, [daysInMonth]);

  // Adjust day if month changes and day is out of bounds (e.g. Feb 30)
  useEffect(() => {
    if (day && parseInt(day) > daysInMonth) {
      handleUpdate(year, month, daysInMonth.toString().padStart(2, '0'));
    }
  }, [daysInMonth, year, month, day]);

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {/* 1. Year */}
      <select
        value={year}
        disabled={disabled}
        onChange={(e) => handleUpdate(e.target.value, month, day)}
        className="border border-slate-200 px-2 py-2 text-sm outline-none bg-inherit focus:border-accent text-inherit w-full"
      >
        <option value="" disabled>Año</option>
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* 2. Month */}
      <select
        value={month}
        disabled={disabled || !year}
        onChange={(e) => handleUpdate(year, e.target.value, day)}
        className={`border border-slate-200 px-2 py-2 text-sm outline-none bg-inherit focus:border-accent text-inherit w-full ${(!year) ? 'opacity-50' : ''}`}
      >
        <option value="" disabled>Mes</option>
        {MONTHS.map((m, idx) => {
          const val = (idx + 1).toString().padStart(2, '0');
          return (
            <option key={val} value={val}>{m}</option>
          );
        })}
      </select>

      {/* 3. Day */}
      <select
        value={day}
        disabled={disabled || !month}
        onChange={(e) => handleUpdate(year, month, e.target.value)}
        className={`border border-slate-200 px-2 py-2 text-sm outline-none bg-inherit focus:border-accent text-inherit w-full ${(!month) ? 'opacity-50' : ''}`}
      >
        <option value="" disabled>Día</option>
        {days.map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
    </div>
  );
}
