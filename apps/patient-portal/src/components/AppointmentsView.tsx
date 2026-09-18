import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { api } from '../api';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket';

export default function AppointmentsView() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const token = localStorage.getItem('patient_token');
  const socketUrl = token ? `ws://localhost:8000/ws/notifications/?token=${token}` : null;

  useWebSocket(socketUrl, {
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'appointment_update') {
          const updatedAppt = data.data;
          let msg = `Tu cita fue actualizada a: ${updatedAppt.status}`;
          if (updatedAppt.status === 'ACCEPTED') msg = `¡Tu cita ha sido confirmada!`;
          else if (updatedAppt.status === 'REJECTED') msg = `Tu solicitud de cita ha sido rechazada.`;
          else if (updatedAppt.status === 'CANCELLED') msg = `Tu cita ha sido cancelada.`;
          else if (updatedAppt.status === 'PROPOSED') {
             if (updatedAppt.proposed_by === 'CLINIC') msg = `${updatedAppt.clinic_name || 'La clínica'} te ha propuesto un nuevo horario.`;
             else msg = `Tu propuesta de horario ha sido enviada.`;
          } else if (updatedAppt.status === 'PENDING') msg = `Tu cita está en revisión.`;
          
          setToastMessage(msg);
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
    shouldReconnect: () => true,
    reconnectInterval: 3000,
  });

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/patient/appointments/');
      setAppointments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);


  const handleAction = async (id: string, action: string, proposedDate?: string, reason?: string) => {
    try {
      const payload: any = { appointment_id: id, action };
      if (proposedDate) {
        payload.proposed_date = proposedDate;
      }
      if (reason) {
        payload.reason = reason;
      }
      await api.put('/auth/patient/appointments/', payload);
      fetchAppointments();
      setProposingFor(null);
      setActionReason('');
    } catch (err) {
      console.error(err);
      alert('Error al actualizar la cita');
    }
  };

  const [proposingFor, setProposingFor] = useState<string | null>(null);
  const [proposedDate, setProposedDate] = useState<Date | null>(new Date());
  const [proposedTime, setProposedTime] = useState('09:00');
  const [actionReason, setActionReason] = useState('');

  return (
    <div className="pb-12 animate-slide-up w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Mis Citas</h2>
          <p className="text-slate-500 mt-1">Gestiona tus próximas citas y el historial de asistencias.</p>
        </div>
      </div>

      <div className="enterprise-card overflow-hidden">
        {loading && appointments.filter(a => a.status !== 'CANCELLED').length === 0 ? (
          <div className="p-10 text-slate-500 text-center">Cargando citas...</div>
        ) : appointments.filter(a => a.status !== 'CANCELLED').length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center bg-white">
            <div className="w-16 h-16 bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
              <span className="material-symbols-outlined text-3xl">event_busy</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Sin Citas Activas</h3>
            <p className="text-sm text-slate-500">No tienes citas activas registradas actualmente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-sm">
                  <th className="p-4 font-semibold">Clínica</th>
                  <th className="p-4 font-semibold">Fecha Requerida</th>
                  <th className="p-4 font-semibold">Modalidad</th>
                  <th className="p-4 font-semibold text-center">Estatus</th>
                  <th className="p-4 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {appointments.filter(a => a.status !== 'CANCELLED' && a.status !== 'REJECTED').map((apt) => (
                  <tr key={apt.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-semibold text-slate-900">{apt.clinic_name}</td>
                    <td className="p-4 text-sm text-slate-700">
                      {apt.requested_date && !isNaN(new Date(apt.requested_date).getTime())
                        ? new Date(apt.requested_date).toLocaleString()
                        : 'Fecha no especificada'}
                      {apt.proposed_date && !isNaN(new Date(apt.proposed_date).getTime()) && (
                        <div className="text-xs font-semibold text-amber-600 mt-1">
                          Propuesta: {new Date(apt.proposed_date).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-sm text-slate-700">{apt.modality || 'General'}</td>
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
                      {(apt.status === 'REJECTED' || apt.status === 'PROPOSED') && apt.clinic_notes && (
                        <div className="mt-2 text-xs bg-slate-100 p-2 text-slate-700 text-left border-l-2 border-slate-300">
                          <span className="font-semibold block mb-0.5">Mensaje de la clínica:</span>
                          {apt.clinic_notes}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {proposingFor === apt.id ? (
                        <div className="flex flex-col items-end gap-2 w-full max-w-[280px] ml-auto">
                          <div className="flex gap-2 w-full">
                            <div className="w-1/2 relative">
                              <DatePicker
                                selected={proposedDate}
                                onChange={(date) => { setProposedDate(date); setProposedTime(''); }}
                                minDate={new Date()}
                                filterDate={(date) => {
                                  const map = parseWorkingHours(apt.clinic_opening_hours || '');
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
                                const map = parseWorkingHours(apt.clinic_opening_hours || '');
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
                            placeholder="Razón / Notas a la clínica"
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
                            }} className="text-xs px-2 py-1 bg-[var(--color-clinic-accent)] text-white hover:bg-opacity-90 rounded-none w-full" style={{ backgroundColor: '#0284c7' }}>Confirmar</button>
                          </div>
                        </div>
                      ) : (apt.status === 'PROPOSED' && apt.proposed_by === 'CLINIC') ? (
                        <div className="flex flex-col gap-2 justify-end">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => handleAction(apt.id, 'accept')} className="enterprise-btn py-1 px-3 text-xs bg-emerald-600 border-emerald-700 hover:bg-emerald-700">Aceptar Fecha</button>
                            <button onClick={() => {
                              setProposingFor(apt.id);
                              setActionReason('');
                              let reqDate = new Date();
                              if (apt.proposed_date) {
                                reqDate = new Date(apt.proposed_date);
                              } else if (apt.requested_date) {
                                reqDate = new Date(apt.requested_date);
                              }
                              if (isNaN(reqDate.getTime())) reqDate = new Date();
                              setProposedDate(reqDate);
                              setProposedTime(`${reqDate.getHours().toString().padStart(2, '0')}:${(Math.floor(reqDate.getMinutes() / 30) * 30).toString().padStart(2, '0')}`);
                            }} className="enterprise-btn-secondary py-1 px-3 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 rounded-none">Reprogramar</button>
                            <button onClick={() => handleAction(apt.id, 'cancel')} className="enterprise-btn-secondary py-1 px-3 text-xs text-rose-600 hover:bg-rose-50">Cancelar</button>
                          </div>
                        </div>
                      ) : null}
                      {apt.status === 'PROPOSED' && apt.proposed_by === 'PATIENT' && (
                        <div className="text-xs text-slate-500 mb-2 italic">
                          Esperando confirmación de la clínica...
                        </div>
                      )}
                      {(apt.status === 'PENDING' || apt.status === 'ACCEPTED') && (
                        <button onClick={() => handleAction(apt.id, 'cancel')} className="enterprise-btn-secondary py-1 px-3 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 rounded-none">Cancelar Cita</button>
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
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-slate-600 text-sm">
                  <th className="p-4 font-semibold">Clínica</th>
                  <th className="p-4 font-semibold">Fecha Requerida</th>
                  <th className="p-4 font-semibold">Modalidad</th>
                  <th className="p-4 font-semibold text-center">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {appointments.filter(a => a.status === 'CANCELLED' || a.status === 'REJECTED').map((apt) => (
                  <tr key={apt.id} className="border-b border-slate-100 last:border-0 bg-white">
                    <td className="p-4 font-semibold text-slate-700 line-through decoration-slate-300">{apt.clinic_name}</td>
                    <td className="p-4 text-sm text-slate-500 line-through decoration-slate-300">
                      {apt.requested_date && !isNaN(new Date(apt.requested_date).getTime())
                        ? new Date(apt.requested_date).toLocaleString()
                        : 'Fecha no especificada'}
                    </td>
                    <td className="p-4 text-sm text-slate-500">{apt.modality || 'General'}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 border uppercase tracking-wide ${
                        apt.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {apt.status === 'REJECTED' ? 'Rechazada' : 'Cancelada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {toastMessage && (
        <div className="fixed top-6 right-6 w-80 bg-white border border-slate-200 shadow-xl rounded z-[9999] overflow-hidden flex flex-col animate-slide-up">
          <div className="p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-indigo-600">notifications_active</span>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-slate-800">Notificación</h4>
              <p className="text-xs text-slate-600 mt-1">{toastMessage}</p>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-sm block">close</span>
            </button>
          </div>
          <div className="h-1 bg-slate-100 w-full">
            <div className="h-full bg-indigo-500 animate-[shrink_5s_linear_forwards]"></div>
          </div>
        </div>
      )}
    </div>
  );
}
