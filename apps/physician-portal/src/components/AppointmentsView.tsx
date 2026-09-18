import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { api } from '../api';

export default function AppointmentsView({ patients }: { patients: any[] }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // New appointment form
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedClinic, setSelectedClinic] = useState('');
  const [clinicSearch, setClinicSearch] = useState('');
  const [isClinicDropdownOpen, setIsClinicDropdownOpen] = useState(false);
  const [requestedDate, setRequestedDate] = useState<Date | null>(null);
  const [requestedTime, setRequestedTime] = useState<string>('');
  const [modality, setModality] = useState('');
  const [notes, setNotes] = useState('');

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/physician/appointments/');
      setAppointments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClinics = async () => {
    try {
      const res = await api.get('/auth/clinics/');
      setClinics(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchClinics();
    
    // Listen for WS updates
    const handleWs = (e: any) => {
      if (e.detail?.type === 'appointment_status_changed') {
        fetchAppointments();
      }
    };
    window.addEventListener('physician_ws_message', handleWs);
    return () => window.removeEventListener('physician_ws_message', handleWs);
  }, []);

  const handleRequestAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedDate || !requestedTime || !selectedPatient || !selectedClinic) return;
    
    try {
      const yyyy = requestedDate.getFullYear();
      const mm = String(requestedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(requestedDate.getDate()).padStart(2, '0');
      const dateString = `${yyyy}-${mm}-${dd}`;
      const datetimeString = `${dateString}T${requestedTime}:00`;
      
      await api.post('/auth/physician/appointments/', {
        patient_id: selectedPatient,
        clinic_id: selectedClinic,
        requested_date: new Date(datetimeString).toISOString(),
        modality,
        notes
      });
      setShowModal(false);
      setModality('');
      setNotes('');
      setRequestedDate(null);
      setRequestedTime('');
      setSelectedClinic('');
      setClinicSearch('');
      fetchAppointments();
      alert('Cita solicitada exitosamente');
    } catch (err) {
      console.error(err);
      alert('Error al solicitar la cita');
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      await api.put('/auth/physician/appointments/', { appointment_id: id, action });
      fetchAppointments();
    } catch (err) {
      console.error(err);
      alert('Error al actualizar la cita');
    }
  };

  const parseWorkingHours = (scheduleStr: string) => {
    const scheduleMap: Record<number, { open: string, close: string } | null> = {
      0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null
    };
    if (!scheduleStr) {
      for(let i=1; i<=5; i++) scheduleMap[i] = { open: '07:00', close: '20:00' };
      scheduleMap[6] = { open: '08:00', close: '15:00' };
      return scheduleMap;
    }
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

  const filteredClinics = clinics.filter(c => c.name.toLowerCase().includes(clinicSearch.toLowerCase()));

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedPatient('');
    setSelectedClinic('');
    setClinicSearch('');
    setRequestedDate(null);
    setRequestedTime('');
    setModality('');
    setNotes('');
  };

  return (
    <div className="pb-12 animate-slide-up w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Agenda de Pacientes</h2>
          <p className="text-slate-500 mt-1">Gestiona las solicitudes de citas para tus pacientes vinculados.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="enterprise-btn py-2 px-4 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Agendar Estudio para Paciente
        </button>
      </div>

      <div className="enterprise-card overflow-hidden">
        {loading && appointments.length === 0 ? (
          <div className="p-10 text-slate-500 text-center">Cargando citas...</div>
        ) : appointments.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center bg-white">
            <div className="w-16 h-16 bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
              <span className="material-symbols-outlined text-3xl">event_busy</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Sin Citas</h3>
            <p className="text-sm text-slate-500">No hay citas solicitadas para tus pacientes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-sm">
                  <th className="p-4 font-semibold">Fecha</th>
                  <th className="p-4 font-semibold">Paciente</th>
                  <th className="p-4 font-semibold">Clínica</th>
                  <th className="p-4 font-semibold">Estudio/Modalidad</th>
                  <th className="p-4 font-semibold">Estatus</th>
                  <th className="p-4 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => (
                  <tr key={apt.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-900 whitespace-nowrap">
                      {new Date(apt.requested_date || apt.proposed_date || '').toLocaleDateString('es-MX', {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="p-4 font-bold text-slate-900">{apt.patient_name || apt.created_by}</td>
                    <td className="p-4 text-slate-600 font-medium">{apt.clinic_name}</td>
                    <td className="p-4 text-slate-600">{apt.modality}</td>
                    <td className="p-4">
                      {apt.status === 'PENDING' && <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1"><span className="material-symbols-outlined text-xs">pending</span> Pendiente Clínica</span>}
                      {apt.status === 'PROPOSED' && <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1"><span className="material-symbols-outlined text-xs">schedule</span> Clínica Propone Fecha</span>}
                      {apt.status === 'ACCEPTED' && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1"><span className="material-symbols-outlined text-xs">check_circle</span> Confirmada</span>}
                      {apt.status === 'CANCELLED' && <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1"><span className="material-symbols-outlined text-xs">cancel</span> Cancelada</span>}
                    </td>
                    <td className="p-4 text-right">
                      {apt.status === 'PROPOSED' && (
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => handleAction(apt.id, 'accept')} className="enterprise-btn py-1 px-3 text-xs bg-emerald-600 border-emerald-700 hover:bg-emerald-700">Aceptar Fecha</button>
                          <button onClick={() => handleAction(apt.id, 'cancel')} className="enterprise-btn-secondary py-1 px-3 text-xs text-rose-600 hover:bg-rose-50">Cancelar</button>
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

      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] animate-fade-in p-4">
          <div className="bg-white p-8 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={() => setIsClinicDropdownOpen(false)}>
            <button onClick={handleCloseModal} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900">
              <span className="material-symbols-outlined">close</span>
            </button>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Agendar Nuevo Estudio</h2>
            
            <form onSubmit={handleRequestAppointment} className="flex flex-col gap-4 overflow-visible" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">Paciente</label>
                <select 
                  value={selectedPatient} 
                  onChange={e => setSelectedPatient(e.target.value)}
                  className="border border-slate-300 p-2 outline-none text-sm bg-white"
                  required
                >
                  <option value="">Selecciona un paciente</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 relative group">
                <label className="text-sm font-semibold text-slate-700">Clínica / Sucursal</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-2 top-2 text-slate-400 text-lg">search</span>
                  <input
                    type="text"
                    placeholder="Buscar clínica..."
                    value={clinicSearch}
                    onFocus={() => setIsClinicDropdownOpen(true)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setClinicSearch(val);
                      setSelectedClinic('');
                      setRequestedDate('');
                      setRequestedTime('');
                      setIsClinicDropdownOpen(true);
                    }}
                    className="border border-slate-300 p-2 pl-8 outline-none text-sm bg-white w-full"
                    required
                  />
                  {isClinicDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 shadow-xl max-h-48 overflow-y-auto z-[2000]">
                      {filteredClinics.length > 0 ? (
                        filteredClinics.map(c => (
                          <div
                            key={c.id}
                            className="p-3 text-sm hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                            onClick={() => {
                              setSelectedClinic(c.id);
                              setClinicSearch(c.name);
                              setRequestedDate(null);
                              setRequestedTime('');
                              setIsClinicDropdownOpen(false);
                            }}
                          >
                            <div className="font-semibold text-slate-900">{c.name}</div>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-sm text-slate-500 text-center">No se encontraron clínicas</div>
                      )}
                    </div>
                  )}
                </div>
                {!selectedClinic && clinicSearch !== '' && (
                   <span className="text-xs text-rose-500 mt-1">Por favor selecciona una clínica de la lista.</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5 relative">
                <label className="text-sm font-semibold text-slate-700">Fecha y Hora Preferida</label>
                <div className="flex gap-2">
                  <div className="w-1/2">
                    <DatePicker
                      selected={requestedDate}
                      onChange={(date) => {
                        setRequestedDate(date);
                        setRequestedTime('');
                      }}
                      minDate={(() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        return d;
                      })()}
                      filterDate={(date) => {
                        const dayOfWeek = date.getDay();
                        const clinic = clinics.find(c => c.id === selectedClinic);
                        if (!clinic) return true;
                        const map = parseWorkingHours(clinic.opening_hours || '');
                        return !!map[dayOfWeek];
                      }}
                      className="border border-slate-300 p-2 text-sm w-full outline-none bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholderText="Selecciona la fecha"
                      dateFormat="dd/MM/yyyy"
                      required
                      disabled={!selectedClinic}
                    />
                  </div>
                  <select
                    value={requestedTime}
                    onChange={(e) => setRequestedTime(e.target.value)}
                    className="border border-slate-300 p-2 text-sm w-1/2 outline-none bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                    disabled={!requestedDate || !selectedClinic}
                  >
                    <option value="">Selecciona la hora</option>
                    {(() => {
                      if (!requestedDate || !selectedClinic) return null;
                      const clinic = clinics.find(c => c.id === selectedClinic);
                      if (!clinic) return null;
                      
                      const dayOfWeek = requestedDate.getDay();
                      const map = parseWorkingHours(clinic.opening_hours || '');
                      const hours = map[dayOfWeek];
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
                      return slots.map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                      ));
                    })()}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">Modalidad o Estudio</label>
                <input 
                  type="text"
                  value={modality}
                  onChange={e => setModality(e.target.value)}
                  placeholder="Ej. Resonancia Magnética de Rodilla"
                  className="border border-slate-300 p-2 text-sm outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">Justificación / Notas Clínicas (Opcional)</label>
                <textarea 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="border border-slate-300 p-2 text-sm outline-none resize-none"
                ></textarea>
              </div>

              <button 
                type="submit" 
                disabled={!clinics.find(c => c.id === selectedClinic)}
                className="enterprise-btn mt-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Solicitar Cita a la Clínica
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
