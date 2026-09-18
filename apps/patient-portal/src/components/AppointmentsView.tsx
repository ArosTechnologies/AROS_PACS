import { useState, useEffect } from 'react';
import { api } from '../api';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket';

export default function AppointmentsView() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('patient_token');
  const socketUrl = token ? `ws://localhost:8000/ws/notifications/?token=${token}` : null;

  useWebSocket(socketUrl, {
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'appointment_update') {
          const updatedAppt = data.data;
          setAppointments(prev => {
            const exists = prev.find(a => a.id === updatedAppt.id);
            if (exists) {
              return prev.map(a => a.id === updatedAppt.id ? { ...a, ...updatedAppt } : a);
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


  const handleAction = async (id: string, action: string) => {
    try {
      await api.put('/auth/patient/appointments/', { appointment_id: id, action });
      fetchAppointments();
    } catch (err) {
      console.error(err);
      alert('Error al actualizar la cita');
    }
  };

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
                {appointments.filter(a => a.status !== 'CANCELLED').map((apt) => (
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

      {/* Citas Canceladas */}
      {appointments.filter(a => a.status === 'CANCELLED').length > 0 && (
        <>
          <div className="mb-4 mt-8">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-500">block</span>
              Citas Canceladas
            </h3>
          </div>
          <div className="enterprise-card overflow-hidden opacity-75">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-sm">
                    <th className="p-4 font-semibold">Clínica</th>
                    <th className="p-4 font-semibold">Fecha Requerida</th>
                    <th className="p-4 font-semibold">Modalidad</th>
                    <th className="p-4 font-semibold text-center">Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.filter(a => a.status === 'CANCELLED').map((apt) => (
                    <tr key={apt.id} className="border-b border-slate-100 last:border-0 bg-slate-50">
                      <td className="p-4 font-semibold text-slate-700 line-through decoration-slate-300">{apt.clinic_name}</td>
                      <td className="p-4 text-sm text-slate-500 line-through decoration-slate-300">
                        {apt.requested_date && !isNaN(new Date(apt.requested_date).getTime())
                          ? new Date(apt.requested_date).toLocaleString()
                          : 'Fecha no especificada'}
                      </td>
                      <td className="p-4 text-sm text-slate-500">{apt.modality || 'General'}</td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 border bg-slate-100 text-slate-500 border-slate-200">
                          <span className="material-symbols-outlined text-xs">block</span> Cancelada
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
