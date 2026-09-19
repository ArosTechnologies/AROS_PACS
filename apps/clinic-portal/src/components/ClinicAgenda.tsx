import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { api } from '../api';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket';

export default function ClinicAgenda({ openingHours = '' }: { openingHours?: string }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Propose new time state
  const [proposingFor, setProposingFor] = useState<string | null>(null);
  const [rejectingFor, setRejectingFor] = useState<string | null>(null);
  const [proposedDate, setProposedDate] = useState<Date | null>(null);
  const [proposedTime, setProposedTime] = useState<string>('');
  const [actionReason, setActionReason] = useState<string>('');

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedAppointments = (appts: any[]) => {
    if (!sortConfig) return appts;
    return [...appts].sort((a, b) => {
      let aVal = a[sortConfig.key] || '';
      let bVal = b[sortConfig.key] || '';
      
      if (sortConfig.key === 'requested_date' || sortConfig.key === 'proposed_date') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const token = localStorage.getItem('clinic_token');
  const socketUrl = token ? `ws://localhost:8000/ws/notifications/?token=${token}` : null;

  useWebSocket(socketUrl, {
    share: true,
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'appointment_update') {
          const updatedAppt = data.data;
          
          setAppointments(prev => {
            const exists = prev.find(a => String(a.id) === String(updatedAppt.id));
            if (exists) {
              return prev.map(a => String(a.id) === String(updatedAppt.id) ? { ...a, ...updatedAppt } : a);
            }
            return [updatedAppt, ...prev];
          });
        }
      } catch (err) {
        console.error("Error parsing websocket message", err);
      }
    },
    shouldReconnect: (closeEvent) => true,
    reconnectInterval: 3000,
  });

  const parseWorkingHours = (scheduleStr: string) => {
    const scheduleMap: Record<number, { open: string; close: string } | null> = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
    if (!scheduleStr) return scheduleMap;
    const dayMap: Record<string, number> = { 'dom': 0, 'lun': 1, 'mar': 2, 'mie': 3, 'mié': 3, 'jue': 4, 'vie': 5, 'sab': 6, 'sáb': 6 };
    const parts = scheduleStr.toLowerCase().split('|');
    for (const part of parts) {
      const [daysStr, ...hoursParts] = part.split(':');
      if (!daysStr || hoursParts.length === 0) continue;
      const hoursStr = hoursParts.join(':').trim();
      const [open, close] = hoursStr.split('-').map(s => s.trim());
      if (!open || !close) continue;
      const daysParts = daysStr.trim().split('-').map(s => s.trim());
      if (daysParts.length === 2) {
        const startDay = dayMap[daysParts[0].substring(0,3)];
        const endDay = dayMap[daysParts[1].substring(0,3)];
        if (startDay !== undefined && endDay !== undefined) {
          for (let i = startDay; i <= endDay; i++) scheduleMap[i] = { open, close };
        }
      } else if (daysParts.length === 1) {
        const day = dayMap[daysParts[0].substring(0,3)];
        if (day !== undefined) scheduleMap[day] = { open, close };
      }
    }
    if (Object.values(scheduleMap).every(v => v === null)) {
      for(let i=1; i<=5; i++) scheduleMap[i] = { open: '07:00', close: '20:00' };
      scheduleMap[6] = { open: '08:00', close: '15:00' };
    }
    return scheduleMap;
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/gateway/agenda/');
      setAppointments(res.data);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar la agenda.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    
    // Listen to real-time events
    const handleWs = (e: any) => {
      const data = e.detail;
      if (data.type === 'new_appointment' || data.type === 'appointment_status_changed') {
        fetchAppointments();
      }
    };
    window.addEventListener('clinic_ws_message', handleWs);
    return () => window.removeEventListener('clinic_ws_message', handleWs);
  }, []);

  const handleAction = async (id: string, action: string, date?: string, reason?: string) => {
    try {
      await api.put('/gateway/agenda/', {
        appointment_id: id,
        action,
        proposed_date: date ? date : undefined,
        reason: reason
      });
      setProposingFor(null);
      setRejectingFor(null);
      setActionReason('');
      fetchAppointments();
    } catch (err) {
      console.error(err);
      alert('Error al actualizar la cita.');
    }
  };

  if (loading && appointments.length === 0) return <div className="p-10 text-slate-500">Cargando agenda...</div>;
  if (error) return <div className="p-10 text-red-500">{error}</div>;

  return (
    <div className="pb-12 animate-slide-up w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Agenda de Citas</h2>
        <p className="text-slate-500 mt-1">Gestiona las solicitudes de citas de los pacientes y médicos asociados.</p>
      </div>

      <div className="enterprise-card overflow-hidden mb-8">
        {appointments.filter(a => a.status !== 'CANCELLED' && a.status !== 'REJECTED').length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center bg-white">
            <div className="w-16 h-16 bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
              <span className="material-symbols-outlined text-3xl">calendar_month</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Agenda Vacía</h3>
            <p className="text-sm text-slate-500">No hay citas activas registradas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-sm">
                  <th className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('patient_name')}>
                    <div className="flex items-center gap-1">
                      Paciente
                      {sortConfig?.key === 'patient_name' && <span className="material-symbols-outlined text-[10px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('created_by')}>
                    <div className="flex items-center gap-1">
                      Solicitada Por
                      {sortConfig?.key === 'created_by' && <span className="material-symbols-outlined text-[10px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('requested_date')}>
                    <div className="flex items-center gap-1">
                      Fecha Requerida
                      {sortConfig?.key === 'requested_date' && <span className="material-symbols-outlined text-[10px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('modality')}>
                    <div className="flex items-center gap-1">
                      Modalidad / Notas
                      {sortConfig?.key === 'modality' && <span className="material-symbols-outlined text-[10px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('status')}>
                    <div className="flex items-center justify-center gap-1">
                      Estatus
                      {sortConfig?.key === 'status' && <span className="material-symbols-outlined text-[10px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="p-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {getSortedAppointments(appointments.filter(a => a.status !== 'CANCELLED' && a.status !== 'REJECTED')).map((apt) => (
                  <tr key={apt.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-slate-900">{apt.patient_name}</div>
                      <div className="text-xs text-slate-500">{apt.patient_phone}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-700">{apt.created_by}</td>
                    <td className="p-4 text-sm text-slate-700">
                      {apt.requested_date && !isNaN(new Date(apt.requested_date).getTime()) 
                        ? new Date(apt.requested_date).toLocaleString() 
                        : 'Fecha no especificada'}
                      {apt.proposed_date && !isNaN(new Date(apt.proposed_date).getTime()) && (
                        <div className="text-xs text-amber-600 mt-1">
                          Propuesta: {new Date(apt.proposed_date).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-semibold">{apt.modality || 'General'}</div>
                      {apt.notes && <div className="text-xs text-slate-500 mt-1 max-w-[200px] truncate" title={apt.notes}>{apt.notes}</div>}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 border ${
                        apt.status === 'PENDING' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                        apt.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        apt.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        apt.status === 'PROPOSED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {apt.status === 'PENDING' && <><span className="material-symbols-outlined text-xs">pending</span> Pendiente</>}
                        {apt.status === 'ACCEPTED' && <><span className="material-symbols-outlined text-xs">check_circle</span> Aceptada</>}
                        {apt.status === 'REJECTED' && <><span className="material-symbols-outlined text-xs">cancel</span> Rechazada</>}
                        {apt.status === 'PROPOSED' && <><span className="material-symbols-outlined text-xs">schedule</span> Reprogramada</>}
                        {apt.status === 'CANCELLED' && <><span className="material-symbols-outlined text-xs">block</span> Cancelada</>}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {proposingFor === apt.id ? (
                        <div className="flex flex-col items-end gap-2 w-full max-w-[280px] ml-auto">
                          <div className="flex gap-2 w-full">
                            <div className="w-1/2">
                              <DatePicker
                                selected={proposedDate}
                                onChange={(date) => { setProposedDate(date); setProposedTime(''); }}
                                minDate={new Date()}
                                filterDate={(date) => {
                                  const map = parseWorkingHours(openingHours);
                                  return !!map[date.getDay()];
                                }}
                                className="border border-slate-300 p-1.5 text-sm w-full outline-none bg-white rounded-none"
                                placeholderText="Fecha"
                                dateFormat="dd/MM/yyyy"
                              />
                            </div>
                            <select
                              value={proposedTime}
                              onChange={e => setProposedTime(e.target.value)}
                              className="border border-slate-300 p-1.5 text-sm w-1/2 outline-none bg-white rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={!proposedDate}
                            >
                              <option value="">Hora</option>
                              {(() => {
                                if (!proposedDate) return null;
                                const map = parseWorkingHours(openingHours);
                                const hours = map[proposedDate.getDay()];
                                if (!hours) return null;
                                const { open, close } = hours;
                                const slots = [];
                                let [h, m] = open.split(':').map(Number);
                                const [endH, endM] = close.split(':').map(Number);
                                while (h < endH || (h === endH && m <= endM)) {
                                  slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                                  m += 30;
                                  if (m >= 60) { h += 1; m -= 60; }
                                }
                                return slots.map(s => <option key={s} value={s}>{s}</option>);
                              })()}
                            </select>
                          </div>
                          <input 
                            type="text"
                            placeholder="Razón / Notas al paciente"
                            value={actionReason}
                            onChange={e => setActionReason(e.target.value)}
                            className="border border-slate-300 p-1.5 text-sm w-full outline-none bg-white rounded-none"
                          />
                          <div className="flex gap-2 w-full justify-end">
                            <button onClick={() => {setProposingFor(null); setActionReason('');}} className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded-none w-full text-slate-700">Cancelar</button>
                            <button onClick={() => {
                              if (!proposedDate || !proposedTime) {
                                alert('Por favor selecciona una fecha y hora válidas.');
                                return;
                              }
                              const d = new Date(proposedDate);
                              const [h, m] = proposedTime.split(':').map(Number);
                              d.setHours(h, m, 0, 0);
                              handleAction(apt.id, 'propose', d.toISOString(), actionReason);
                            }} className="text-xs px-2 py-1 bg-[var(--color-clinic-accent)] text-white hover:bg-opacity-90 rounded-none w-full">Confirmar</button>
                          </div>
                        </div>
                      ) : rejectingFor === apt.id ? (
                        <div className="flex flex-col items-end gap-2 w-full max-w-[250px] ml-auto">
                          <input 
                            type="text"
                            placeholder="Razón del rechazo..."
                            value={actionReason}
                            onChange={e => setActionReason(e.target.value)}
                            className="border border-slate-300 p-1.5 text-sm w-full outline-none bg-white rounded-none"
                          />
                          <div className="flex gap-2 w-full justify-end">
                            <button onClick={() => {setRejectingFor(null); setActionReason('');}} className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded-none w-full text-slate-700">Cancelar</button>
                            <button onClick={() => handleAction(apt.id, 'reject', undefined, actionReason)} className="text-xs px-2 py-1 bg-rose-600 text-white hover:bg-rose-700 rounded-none w-full">Rechazar</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {apt.status === 'PROPOSED' && apt.proposed_by === 'PATIENT' ? (
                            <button onClick={() => handleAction(apt.id, 'accept')} className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-none transition-colors border border-transparent hover:border-emerald-200" title="Aceptar Propuesta"><span className="material-symbols-outlined text-lg block leading-none">check</span></button>
                          ) : null}
                          {(apt.status === 'PENDING' || (apt.status === 'PROPOSED' && apt.proposed_by === 'PATIENT')) && (
                            <>
                              {apt.status === 'PENDING' && (
                                <button onClick={() => handleAction(apt.id, 'accept')} className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-none transition-colors border border-transparent hover:border-emerald-200" title="Aceptar"><span className="material-symbols-outlined text-lg block leading-none">check</span></button>
                              )}
                              <button onClick={() => { 
                                setProposingFor(apt.id); 
                                let reqDate = new Date();
                                if (apt.proposed_date) {
                                  reqDate = new Date(apt.proposed_date);
                                } else if (apt.requested_date) {
                                  reqDate = new Date(apt.requested_date);
                                }
                                if (isNaN(reqDate.getTime())) reqDate = new Date();
                                setProposedDate(reqDate);
                                setProposedTime(`${reqDate.getHours().toString().padStart(2, '0')}:${(Math.floor(reqDate.getMinutes() / 30) * 30).toString().padStart(2, '0')}`);
                              }} className="w-8 h-8 flex items-center justify-center text-amber-600 hover:bg-amber-50 rounded-none transition-colors border border-transparent hover:border-amber-200" title="Proponer Nueva Fecha"><span className="material-symbols-outlined text-lg block leading-none">schedule</span></button>
                              <button onClick={() => { setRejectingFor(apt.id); }} className="w-8 h-8 flex items-center justify-center text-rose-600 hover:bg-rose-50 rounded-none transition-colors border border-transparent hover:border-rose-200" title="Rechazar"><span className="material-symbols-outlined text-lg block leading-none">close</span></button>
                            </>
                          )}
                          {apt.status === 'PROPOSED' && apt.proposed_by !== 'PATIENT' && (
                             <span className="text-xs text-slate-400">Esperando respuesta</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Citas Canceladas / Rechazadas */}
      {appointments.filter(a => a.status === 'CANCELLED' || a.status === 'REJECTED').length > 0 && (
        <details className="mt-8 mb-4 bg-white border border-slate-200 rounded overflow-hidden">
          <summary className="p-4 bg-slate-50 border-b border-slate-200 cursor-pointer font-semibold text-slate-700 hover:bg-slate-100 flex items-center justify-between outline-none">
            Historial de Citas Canceladas / Rechazadas
            <span className="text-xs font-normal text-slate-500">
              {appointments.filter(a => a.status === 'CANCELLED' || a.status === 'REJECTED').length} registro(s)
            </span>
          </summary>
          <div className="overflow-x-auto opacity-75">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-slate-600 text-sm">
                  <th className="p-4 font-semibold cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('patient_name')}>
                    <div className="flex items-center gap-1">
                      Paciente
                      {sortConfig?.key === 'patient_name' && <span className="material-symbols-outlined text-[10px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="p-4 font-semibold cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('created_by')}>
                    <div className="flex items-center gap-1">
                      Solicitada Por
                      {sortConfig?.key === 'created_by' && <span className="material-symbols-outlined text-[10px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="p-4 font-semibold cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('requested_date')}>
                    <div className="flex items-center gap-1">
                      Fecha Requerida
                      {sortConfig?.key === 'requested_date' && <span className="material-symbols-outlined text-[10px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="p-4 font-semibold cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('modality')}>
                    <div className="flex items-center gap-1">
                      Modalidad / Notas
                      {sortConfig?.key === 'modality' && <span className="material-symbols-outlined text-[10px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('status')}>
                    <div className="flex items-center justify-center gap-1">
                      Estatus
                      {sortConfig?.key === 'status' && <span className="material-symbols-outlined text-[10px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="p-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {getSortedAppointments(appointments.filter(a => a.status === 'CANCELLED' || a.status === 'REJECTED')).map((apt) => (
                  <tr key={apt.id} className="border-b border-slate-100 last:border-0 bg-white">
                    <td className="p-4">
                      <div className="font-semibold text-slate-700 line-through decoration-slate-300">{apt.patient_name}</div>
                      <div className="text-xs text-slate-500">{apt.patient_phone}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-500">{apt.created_by}</td>
                    <td className="p-4 text-sm text-slate-500 line-through decoration-slate-300">
                      {apt.requested_date && !isNaN(new Date(apt.requested_date).getTime()) 
                        ? new Date(apt.requested_date).toLocaleString() 
                        : 'Fecha no especificada'}
                    </td>
                    <td className="p-4 text-slate-500">
                      <div className="text-sm">{apt.modality || 'General'}</div>
                      {apt.clinic_notes && (
                        <div className="text-xs text-rose-600 mt-1 max-w-[200px] truncate" title={apt.clinic_notes}>
                          Motivo: {apt.clinic_notes}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 border uppercase tracking-wide ${
                        apt.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {apt.status === 'REJECTED' ? 'Rechazada' : 'Cancelada'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {apt.status === 'REJECTED' && (
                        <button onClick={() => handleAction(apt.id, 'recover')} className="enterprise-btn-secondary py-1 px-3 text-xs bg-white hover:bg-slate-50 text-slate-600">
                          Recuperar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

    </div>
  );
}
