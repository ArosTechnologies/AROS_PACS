import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket';
import { api } from './api';
import ImageCropper from './components/ImageCropper';
import AppointmentsView from './components/AppointmentsView';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

type ViewState = 'login' | 'home' | 'studies' | 'patients' | 'profile' | 'study_detail' | 'appointments' | 'ohif';

export default function App() {
  const [view, setView] = useState<ViewState>('login');
  const [token, setToken] = useState<string | null>(localStorage.getItem('physician_token'));
  const [doctorProfile, setDoctorProfile] = useState<any>({
    name: 'Dr. Carlos Mendoza',
    email: 'medico@aros.com',
    phone: '+52 55 4912 3456',
    specialty: 'Medicina Interna y Diagnóstica',
    cedula_profesional: 'CED-MED-7492011',
    clinic: 'Red AROS Salud'
  });

  const [patients, setPatients] = useState<any[]>([]);
  const [studies, setStudies] = useState<any[]>([]);
  const [selectedStudy, setSelectedStudy] = useState<any>(null);
  const [patientFilter, setPatientFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  const fetchData = (isSilent = false) => {
    if (token) {
      if (!isSilent) setLoading(true);
      api.get('/auth/me/')
        .then(res => {
          if (res.data) {
            setDoctorProfile({
              id: res.data.id,
              name: res.data.name || `${res.data.first_name || ''} ${res.data.last_name || ''}`.trim() || 'Médico',
              email: res.data.email || '',
              phone: res.data.phone || '',
              specialty: res.data.specialty || '',
              cedula_profesional: res.data.cedula_profesional || '',
              bio: res.data.bio || '',
              clinic: 'Red AROS Salud',
              avatar_url: res.data.avatar_url || ''
            });
          }
        })
        .catch(console.error);

      api.get('/auth/physician/patients/')
        .then(res => setPatients(res.data || []))
        .catch(console.error);

      api.get('/auth/physician/studies/')
        .then(res => setStudies(res.data || []))
        .catch(console.error)
        .finally(() => {
          if (!isSilent) setLoading(false);
        });
    }
  };

  // Toast notification state
  const [toasts, setToasts] = useState<{id: number; type: string; message: string; icon: string}[]>([]);
  const toastIdRef = useRef(0);

  const addToast = useCallback((type: string, message: string, icon = 'info') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, type, message, icon }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);


  const socketUrl = token ? `ws://localhost:8000/ws/notifications/?token=${token}` : null;
  useWebSocket(socketUrl, {
    share: true,
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'appointment_update') {
          const appt = data.data;
          let msg = `La cita de ${appt.patient_name || 'paciente'} ha sido actualizada.`;
          if (appt.status === 'ACCEPTED') msg = `La cita de ${appt.patient_name || 'paciente'} ha sido confirmada por la clínica.`;
          else if (appt.status === 'REJECTED') msg = `La cita de ${appt.patient_name || 'paciente'} ha sido rechazada por la clínica.`;
          else if (appt.status === 'CANCELLED') msg = `La cita de ${appt.patient_name || 'paciente'} ha sido cancelada.`;
          else if (appt.status === 'PROPOSED') msg = `La clínica ha propuesto un nuevo horario para ${appt.patient_name || 'paciente'}.`;
          addToast('info', msg, 'notifications_active');
          window.dispatchEvent(new CustomEvent('physician_ws_message', { detail: data }));
        } else if (data.type === 'consent_revoked') {
          const revokedPatientName = data.data.patient_name || 'Un paciente';
          addToast('warning', `${revokedPatientName} ha revocado tu acceso a su expediente.`, 'gpp_bad');
          fetchData(true);
          window.dispatchEvent(new CustomEvent('physician_ws_message', { detail: data }));
          
          // Redirect to studies if currently viewing their study
          if (selectedStudy && String(selectedStudy.patient_id) === String(data.data.patient_id)) {
             setSelectedStudy(null);
             setView('studies');
          }
        } else if (data.type === 'consent_granted') {
          const patientName = data.data.patient_name || 'Un paciente';
          addToast('success', `${patientName} te ha otorgado acceso a su expediente.`, 'verified_user');
          fetchData(true);
          window.dispatchEvent(new CustomEvent('physician_ws_message', { detail: data }));
        }
      } catch (err) {
        console.error('WebSocket Error', err);
      }
    }
  });

  useEffect(() => {
    if (token) {
      if (view === 'login') setView('home');
      fetchData();
      const interval = setInterval(() => fetchData(true), 60000);
      return () => clearInterval(interval);
    }
  }, [token]);


  if (!token || view === 'login') {
    return (
      <div className="min-h-screen bg-secondary text-text-primary p-4 flex items-center justify-center">
        <LoginView setToken={setToken} setView={setView} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary text-text-primary flex flex-col md:flex-row pt-16 md:pt-0 pb-16 md:pb-0">
      {/* Mobile Topbar */}
      <div className="md:hidden fixed top-0 left-0 w-full h-16 bg-accent text-white flex items-center justify-between px-4 z-50 shadow-md">
        <h1 className="text-2xl m-0 flex tracking-tighter leading-none">
          <span className="font-extrabold text-slate-900">PORTAL</span>
          <span className="font-extrabold text-white">MÉDICO</span>
        </h1>
        <button 
          onClick={async () => { 
            try { await api.post('/auth/logout/'); } catch(e) { console.error(e); }
            setToken(null); 
            setDoctorProfile({});
            setPatients([]);
            setStudies([]);
            setSelectedStudy(null);
            setPatientFilter('');
            localStorage.removeItem('physician_token'); 
            localStorage.removeItem('physician_user'); 
            setView('login'); 
          }}
          className="p-2 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          title="Cerrar sesión"
        >
          <span className="material-symbols-outlined text-2xl">logout</span>
        </button>
      </div>
      {/* Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-200 flex-col z-50 h-full">
        <div className="p-8 bg-accent text-white flex justify-between items-start">
          <h1 className="text-4xl m-0 flex flex-col tracking-tighter leading-none">
            <span className="font-extrabold text-slate-900">PORTAL</span>
            <span className="font-extrabold text-white">MÉDICO</span>
          </h1>
        </div>
        
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <button 
            onClick={() => { setView('home'); setPatientFilter(''); }} 
            className={`flex items-center gap-3 px-4 py-3 font-medium transition-all duration-200 text-left cursor-pointer ${view === 'home' ? 'bg-slate-50 text-accent font-semibold' : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <span className="material-symbols-outlined text-xl">home</span>
            Inicio
          </button>
          
          <button 
            onClick={() => { setView('patients'); setPatientFilter(''); }} 
            className={`flex items-center gap-3 px-4 py-3 font-medium transition-all duration-200 text-left cursor-pointer ${view === 'patients' ? 'bg-slate-50 text-accent font-semibold' : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <span className="material-symbols-outlined text-xl">group</span>
            Mis Pacientes
          </button>
          
          <button 
            onClick={() => { setView('studies'); setPatientFilter(''); }} 
            className={`flex items-center gap-3 px-4 py-3 font-medium transition-all duration-200 text-left cursor-pointer ${view === 'studies' || view === 'study_detail' || view === 'ohif' ? 'bg-slate-50 text-accent font-semibold' : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <span className="material-symbols-outlined text-xl">medical_information</span>
            Estudios Recientes
          </button>

          <button 
            onClick={() => { setView('appointments'); setPatientFilter(''); }} 
            className={`flex items-center gap-3 px-4 py-3 font-medium transition-all duration-200 text-left cursor-pointer ${view === 'appointments' ? 'bg-slate-50 text-accent font-semibold' : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <span className="material-symbols-outlined text-xl">calendar_month</span>
            Agenda
          </button>
        </nav>

        <div className="p-4 border-t border-slate-200 bg-white flex flex-col gap-2">
          <button 
            onClick={() => setView('profile')}
            className={`w-full flex items-center gap-3 p-2 text-left transition-colors border ${view === 'profile' ? 'bg-slate-50 border-slate-200' : 'border-transparent hover:bg-slate-50 hover:border-slate-200 cursor-pointer'}`}
          >
            <div className="w-10 h-10 bg-accent text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0 overflow-hidden">
              {doctorProfile.avatar_url ? (
                <img src={doctorProfile.avatar_url.startsWith('http') ? doctorProfile.avatar_url : `http://localhost:8000${doctorProfile.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <>{doctorProfile.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('') || 'DR'}</>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 truncate">{doctorProfile.name}</p>
              <p className="text-xs text-slate-500 truncate">Ver mi perfil</p>
            </div>
          </button>
          <button 
            onClick={async () => { 
              try { await api.post('/auth/logout/'); } catch(e) { console.error(e); }
              setToken(null); 
              setDoctorProfile({});
              setPatients([]);
              setStudies([]);
              setSelectedStudy(null);
              setPatientFilter('');
              localStorage.removeItem('physician_token'); 
              localStorage.removeItem('physician_user'); 
              setView('login'); 
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            Cerrar sesión
          </button>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Powered by</span>
            <img src="/ISO-HOR-RED.png" alt="AROS Logo" className="h-5" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-72 bg-slate-50 animate-fade-in relative flex flex-col h-full overflow-y-auto">
        {view === 'home' && (
          <div className="p-6 md:p-10 w-full">
            <HomeView 
              setView={setView} 
              setSelectedStudy={setSelectedStudy} 
              patients={patients} 
              studies={studies} 
              doctor={doctorProfile} 
            />
          </div>
        )}
        {view === 'studies' && (
          <div className="p-6 md:p-10 w-full">
            <StudiesView 
              studies={studies} 
              patients={patients}
              setView={setView} 
              setSelectedStudy={setSelectedStudy} 
              patientFilter={patientFilter}
              setPatientFilter={setPatientFilter}
              refreshStudies={fetchData} 
              loading={loading} 
            />
          </div>
        )}
        {view === 'study_detail' && (
          <div className="p-6 md:p-10 w-full">
            <PhysicianStudyDetailView 
              study={selectedStudy} 
              setView={setView} 
            />
          </div>
        )}
        {view === 'ohif' && selectedStudy && (
          <div className="flex-1 w-full h-full relative bg-black flex flex-col">
            <div className="h-14 bg-black border-b border-zinc-800 flex items-center px-4 shrink-0">
              <button 
                onClick={() => setView('study_detail')} 
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">arrow_back</span>
                <span className="font-medium text-sm">Volver al Detalle</span>
              </button>
              <div className="mx-auto text-white/60 text-sm font-medium">
                {selectedStudy.patient_name} - {selectedStudy.modality}
              </div>
            </div>
            <iframe 
              src={`http://localhost:3000/viewer/${selectedStudy.study_uid}`} 
              className="flex-1 w-full h-full border-0"
              title="OHIF Viewer"
              allowFullScreen
            />
          </div>
        )}
        {view === 'patients' && (
          <div className="p-6 md:p-10 w-full">
            <PatientsView 
              patients={patients} 
              setView={setView} 
              setPatientFilter={setPatientFilter}
              refreshPatients={fetchData}
              loading={loading} 
            />
          </div>
        )}
        {view === 'profile' && (
          <div className="p-6 md:p-10 w-full">
            <ProfileView 
              doctor={doctorProfile} 
              setDoctor={setDoctorProfile} 
            />
          </div>
        )}
        {view === 'appointments' && (
          <div className="p-6 md:p-10 w-full">
            <AppointmentsView patients={patients} />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-white border-t border-slate-200 flex items-center justify-around z-50 px-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <button onClick={() => setView('home')} className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${view === 'home' ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: view === 'home' ? "'FILL' 1" : "'FILL' 0" }}>home</span>
        </button>
        <button onClick={() => setView('patients')} className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${view === 'patients' ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: view === 'patients' ? "'FILL' 1" : "'FILL' 0" }}>group</span>
        </button>
        <button onClick={() => setView('appointments')} className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${view === 'appointments' ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: view === 'appointments' ? "'FILL' 1" : "'FILL' 0" }}>calendar_month</span>
        </button>
        <button onClick={() => setView('studies')} className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${view === 'studies' || view === 'study_detail' ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: view === 'studies' || view === 'study_detail' ? "'FILL' 1" : "'FILL' 0" }}>medical_information</span>
        </button>
        <button onClick={() => setView('profile')} className="flex flex-col items-center justify-center w-12 h-12">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden transition-all ${view === 'profile' ? 'ring-2 ring-accent ring-offset-2' : 'ring-1 ring-slate-200'}`}>
            {doctorProfile?.avatar_url ? (
              <img src={doctorProfile.avatar_url.startsWith('http') ? doctorProfile.avatar_url : `http://localhost:8000${doctorProfile.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-accent text-white flex items-center justify-center">
                {doctorProfile.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('') || 'DR'}
              </div>
            )}
          </div>
        </button>
      </nav>

      {/* Toast Notifications */}
      <div className="fixed top-20 md:top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '380px' }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto w-80 bg-white border border-slate-200 shadow-xl rounded-none overflow-hidden flex flex-col animate-slide-up"
          >
            <div className="p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500">{toast.icon}</span>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-slate-800">Notificación</h4>
                <p className="text-xs text-slate-600 mt-1">{toast.message}</p>
              </div>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-sm block">close</span>
              </button>
            </div>
            <div className="h-1 bg-slate-100 w-full">
              <div className="h-full bg-emerald-500 animate-[shrink_5s_linear_forwards]"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// LOGIN VIEW
// ----------------------------------------------------------------------
function LoginView({ setToken, setView }: { setToken: (t: string) => void, setView: (v: ViewState) => void }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cedula, setCedula] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user was redirected from email verification
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
      if (params.get('pending_approval') === 'true') {
        setSuccessMsg('¡Tu correo ha sido verificado! Tu cuenta está en revisión y te notificaremos cuando sea aprobada por nuestro equipo médico.');
      } else {
        setSuccessMsg('¡Tu cuenta ha sido verificada con éxito! Ya puedes iniciar sesión.');
      }
    }
  }, []);

  const handleSubmit = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    const em = customEmail || email;
    const pw = customPass || password;
    
    try {
      if (isRegistering) {
        // AWS WAF Captcha is handled automatically via challenge.js interceptor
        
        await api.post('/auth/register/physician/', { 
          email: em.trim(), 
          password: pw,
          first_name: firstName,
          last_name: lastName,
          cedula_profesional: cedula,
          specialty: specialty || 'Médico General'
        }, { withCredentials: false });
        setSuccessMsg('Registro exitoso. Revisa tu correo electrónico para verificar tu cuenta y comenzar el proceso de validación.');
        setIsRegistering(false);
      } else {
        const res = await api.post('/auth/login/', { email_hash: em.trim(), password: pw });
        if (res.data.access) {
          localStorage.setItem('physician_token', res.data.access);
          setToken(res.data.access);
          setView('home');
        }
      }
    } catch (err: any) {
      console.log('REGISTER ERROR:', err);
      console.log('STATUS:', err.response?.status);
      console.log('HAS CONTAINER:', !!document.getElementById("aws-waf-captcha-container"));
      // @ts-ignore
      console.log('HAS AWSWAFCAPTCHA:', !!window.AwsWafCaptcha);
      
      if (err.response?.status === 405) {
        // Render AWS WAF Captcha manually
        setLoading(false);
        const container = document.getElementById("aws-waf-captcha-container");
        // @ts-ignore
        if (container && window.AwsWafCaptcha) {
          // @ts-ignore
          window.AwsWafCaptcha.renderCaptcha(container, {
            apiKey: "",
            onSuccess: async (wafToken: string) => {
              setLoading(true);
              try {
                await api.post('/auth/register/physician/', { 
                  email: em.trim(), 
                  password: pw,
                  first_name: firstName,
                  last_name: lastName,
                  cedula_profesional: cedula,
                  specialty: specialty || 'Médico General'
                }, { 
                  withCredentials: false,
                  headers: { 'x-aws-waf-token': wafToken }
                });
                setSuccessMsg('Registro exitoso. Revisa tu correo electrónico para verificar tu cuenta y comenzar el proceso de validación.');
                setIsRegistering(false);
                container.innerHTML = '';
              } catch (retryErr: any) {
                setError(retryErr.response?.data?.error || 'Error al crear la cuenta después del CAPTCHA.');
              } finally {
                setLoading(false);
              }
            },
            onError: (captchaErr: any) => {
              setError('Error al cargar el CAPTCHA.');
              console.error(captchaErr);
            }
          });
          return;
        } else {
          setError('El sistema de validación (CAPTCHA) no pudo cargar. Por favor, desactiva temporalmente cualquier bloqueador de anuncios (AdBlock, Escudos de Brave) para esta página y recarga.');
          return;
        }
      }
      
      if (isRegistering) {
        setError(err.response?.data?.error || 'Error al registrar la cuenta. Inténtalo de nuevo.');
      } else {
        setError(err.response?.data?.detail || 'No se encontró un usuario activo con esas credenciales. (Es posible que tu cuenta aún esté pendiente de aprobación)');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md">
      <div className="enterprise-card p-10 w-full bg-white animate-slide-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-accent flex items-center justify-center text-white font-bold text-2xl shadow-sm mb-4">
            <span className="material-symbols-outlined">stethoscope</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Portal Médico</h1>
          <p className="text-sm text-slate-500 mt-1">Acceso para médicos asociados AROS</p>
        </div>
      
        {error && (
          <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm shrink-0">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {isRegistering && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-sm text-slate-700">Nombre(s) <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  placeholder="Ej. Roberto"
                  value={firstName} 
                  onChange={e => setFirstName(e.target.value)} 
                  className="border border-slate-300 px-4 py-2.5 bg-white focus:bg-slate-50 focus:border-accent focus:ring-1 focus:ring-accent transition-colors outline-none text-sm"
                  required 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-sm text-slate-700">Apellidos (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ej. Martínez"
                  value={lastName} 
                  onChange={e => setLastName(e.target.value)} 
                  className="border border-slate-300 px-4 py-2.5 bg-white focus:bg-slate-50 focus:border-accent focus:ring-1 focus:ring-accent transition-colors outline-none text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-sm text-slate-700">Cédula Profesional <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  placeholder="Ej. 12345678"
                  value={cedula} 
                  onChange={e => setCedula(e.target.value)} 
                  className="border border-slate-300 px-4 py-2.5 bg-white focus:bg-slate-50 focus:border-accent focus:ring-1 focus:ring-accent transition-colors outline-none text-sm"
                  required 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-sm text-slate-700">Especialidad (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ej. Radiología"
                  value={specialty} 
                  onChange={e => setSpecialty(e.target.value)} 
                  className="border border-slate-300 px-4 py-2.5 bg-white focus:bg-slate-50 focus:border-accent focus:ring-1 focus:ring-accent transition-colors outline-none text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-sm text-slate-700">Usuario / Correo</label>
            <input 
              type="email" 
              placeholder="doctor@clinica.com"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="border border-slate-300 px-4 py-2.5 bg-white focus:bg-slate-50 focus:border-accent focus:ring-1 focus:ring-accent transition-colors outline-none text-sm"
              required 
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-sm text-slate-700">Contraseña</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="border border-slate-300 px-4 py-2.5 bg-white focus:bg-slate-50 focus:border-accent focus:ring-1 focus:ring-accent transition-colors outline-none w-full pr-10 text-sm"
                required 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-lg block leading-none">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          
          {isRegistering && (
            <div className="mt-2 text-xs text-slate-500 text-center flex flex-col gap-2">
              <span>Al solicitar acceso, aceptas nuestros Términos de Servicio. Tu cuenta será revisada manualmente por nuestro equipo usando tu Cédula Profesional.</span>
              <div id="aws-waf-captcha-container" className="flex items-center justify-center min-h-[50px] w-full rounded"></div>
            </div>
          )}

          <button type="submit" disabled={loading} className="enterprise-btn mt-2 w-full py-2.5 flex items-center justify-center gap-2">
            {loading ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                {isRegistering ? 'Procesando...' : 'Iniciando sesión...'}
              </>
            ) : (
              isRegistering ? 'Solicitar Cuenta' : 'Ingresar al Portal'
            )}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <button 
            type="button" 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setSuccessMsg('');
            }}
            className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
          >
            {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿Eres médico? Solicita una cuenta'}
          </button>
        </div>


      </div>

      <div className="mt-8 flex items-center justify-center gap-2 animate-slide-up opacity-90">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Powered by</span>
        <img src="/ISO-HOR-RED.png" alt="AROS Logo" className="h-6" />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// HOME VIEW
// ----------------------------------------------------------------------
function HomeView({ 
  setView, 
  setSelectedStudy, 
  patients, 
  studies, 
  doctor 
}: { 
  setView: (v: ViewState) => void, 
  setSelectedStudy: (s: any) => void, 
  patients: any[], 
  studies: any[], 
  doctor: any 
}) {
  return (
    <div className="flex flex-col gap-8 pb-12 animate-slide-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Bienvenido, {doctor.name || 'Doctor'}.
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Panel de control clínico y visualización de estudios diagnósticos con consentimiento activo.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          className="enterprise-card p-6 flex flex-col justify-between h-44 cursor-pointer hover:border-accent transition-all bg-white border border-slate-200 shadow-sm" 
          onClick={() => setView('patients')}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-accent/10 flex items-center justify-center text-accent">
              <span className="material-symbols-outlined text-2xl">group</span>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consorcio AROS</span>
          </div>
          <div>
            <h4 className="text-3xl font-extrabold text-slate-900">{patients.length}</h4>
            <p className="text-sm text-slate-600 font-medium mt-0.5">
              {patients.length === 1 ? 'Paciente con consentimiento activo' : 'Pacientes con consentimiento activo'}
            </p>
          </div>
        </div>

        <div 
          className="enterprise-card p-6 flex flex-col justify-between h-44 cursor-pointer hover:border-accent transition-all bg-white border border-slate-200 shadow-sm" 
          onClick={() => setView('studies')}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-amber-500/10 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-2xl">medical_information</span>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Federación PACS</span>
          </div>
          <div>
            <h4 className="text-3xl font-extrabold text-slate-900">{studies.length}</h4>
            <p className="text-sm text-slate-600 font-medium mt-0.5">
              {studies.length === 1 ? 'Estudio disponible para diagnóstico' : 'Estudios disponibles para diagnóstico'}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Studies Preview */}
      <div className="enterprise-card p-0 overflow-hidden bg-white border border-slate-200 shadow-sm">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Últimos Estudios Diagnósticos</h3>
            <p className="text-xs text-slate-500 mt-0.5">Imágenes DICOM sincronizadas desde la red de clínicas</p>
          </div>
          <button onClick={() => setView('studies')} className="text-accent text-xs font-bold hover:underline cursor-pointer flex items-center gap-1">
            Ver Todos los Estudios
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/50 text-slate-600 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">Fecha</th>
                <th className="p-4 font-bold">Paciente</th>
                <th className="p-4 font-bold">Modalidad</th>
                <th className="p-4 font-bold">Descripción</th>
                <th className="p-4 font-bold">Estado Reporte</th>
                <th className="p-4 font-bold text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {studies.slice(0, 5).map((study) => (
                <tr key={study.id || study.study_uid} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-semibold text-slate-900 text-sm whitespace-nowrap">{study.study_date}</td>
                  <td className="p-4 font-bold text-slate-900 text-sm">{study.patient_name}</td>
                  <td className="p-4">
                    <span className="bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1 font-extrabold text-xs">
                      {study.modality}
                    </span>
                  </td>
                  <td className="p-4 text-slate-700 text-sm font-medium">{study.study_description}</td>
                  <td className="p-4">
                    {study.report ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold">
                        <span className="material-symbols-outlined text-xs">verified</span>
                        Reporte Disponible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium">
                        <span className="material-symbols-outlined text-xs">hourglass_empty</span>
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedStudy(study);
                        setView('study_detail');
                      }}
                      className="enterprise-btn py-1.5 px-3 text-xs inline-flex items-center gap-1.5 font-bold cursor-pointer"
                    >
                      <span>Ver Detalle</span>
                      <span className="material-symbols-outlined text-sm">visibility</span>
                    </button>
                  </td>
                </tr>
              ))}

              {studies.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                    <span className="material-symbols-outlined text-3xl text-slate-300 block mb-2">folder_open</span>
                    No hay estudios recientes disponibles para los pacientes asignados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// PATIENTS VIEW
// ----------------------------------------------------------------------
function PatientsView({ 
  patients, 
  setView, 
  setPatientFilter,
  refreshPatients,
  loading 
}: { 
  patients: any[], 
  setView: (v: ViewState) => void, 
  setPatientFilter: (f: string) => void,
  refreshPatients: () => void,
  loading: boolean 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filtered = patients.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pb-12 animate-slide-up">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Mis Pacientes</h2>
          <p className="text-slate-500 mt-1">Directorio de pacientes que han otorgado consentimiento médico para compartir su expediente e imágenes DICOM.</p>
        </div>
      </div>

      <div className="enterprise-card p-6 mb-8 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white border border-slate-200 shadow-sm">
        <div className="flex-1 w-full relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400">search</span>
          <input 
            type="text" 
            placeholder="Buscar paciente por nombre o correo electrónico..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm font-medium"
          />
        </div>
      </div>

      <div className="enterprise-card p-0 overflow-hidden bg-white border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-bold">
                <th className="p-4">Paciente</th>
                <th className="p-4">Contacto</th>
                <th className="p-4">Consentimiento</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent text-white flex items-center justify-center font-bold text-sm shadow-sm">
                        {p.avatar || 'P'}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 text-sm block">{p.name}</span>
                        <span className="text-xs text-slate-500">{p.dob ? `Nacimiento: ${p.dob}` : 'Fecha de nac. registrada'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-900 text-sm font-medium block">{p.email || 'Sin correo'}</span>
                    {p.phone && <span className="text-xs text-slate-500">{p.phone}</span>}
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold">
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      Activo ({p.consent_date})
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => {
                        setPatientFilter(p.name);
                        setView('studies');
                      }} 
                      className="enterprise-btn-secondary py-1.5 px-3 text-xs font-bold cursor-pointer"
                    >
                      Ver Estudios
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-sm text-slate-500">
                    <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">person_search</span>
                    No se encontraron pacientes con consentimiento activo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// STUDIES VIEW
// ----------------------------------------------------------------------
function StudiesView({ 
  studies, 
  patients,
  setView, 
  setSelectedStudy, 
  patientFilter, 
  setPatientFilter,
  refreshStudies, 
  loading 
}: { 
  studies: any[], 
  patients: any[],
  setView: (v: ViewState) => void, 
  setSelectedStudy: (s: any) => void, 
  patientFilter: string,
  setPatientFilter: (f: string) => void,
  refreshStudies: () => void, 
  loading: boolean 
}) {
  const [searchTerm, setSearchTerm] = useState(patientFilter || '');

  useEffect(() => {
    if (patientFilter) {
      setSearchTerm(patientFilter);
    }
  }, [patientFilter]);

  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(patientFilter || null);

  useEffect(() => {
    if (patientFilter) {
      setExpandedPatientId(patientFilter);
    }
  }, [patientFilter]);

  const filteredPatients = patients.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pb-12 animate-slide-up">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Estudios de Pacientes</h2>
          <p className="text-slate-500 mt-1">Acceda a los reportes diagnósticos y al visor DICOM OHIF de los pacientes que le han otorgado consentimiento.</p>
        </div>
      </div>

      <div className="enterprise-card p-6 mb-8 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white border border-slate-200 shadow-sm">
        <div className="flex-1 w-full relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400">search</span>
          <input 
            type="text" 
            placeholder="Buscar paciente por nombre..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm font-medium"
          />
        </div>
        {searchTerm && (
          <button 
            onClick={() => {
              setSearchTerm('');
            }}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold underline shrink-0"
          >
            Limpiar filtro
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 mt-8">
        {filteredPatients.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-500 bg-white border border-slate-200 shadow-sm">
            No se encontraron pacientes que coincidan con la búsqueda.
          </div>
        )}

        {filteredPatients.map(patient => {
          const isExpanded = expandedPatientId === patient.id;
          const patientStudies = studies.filter(s => String(s.patient_id) === String(patient.id));
          
          return (
            <div key={patient.id} className={`border transition-all bg-white ${isExpanded ? 'border-accent shadow-md ring-1 ring-accent/20' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
              {/* Header */}
              <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpandedPatientId(isExpanded ? null : patient.id)}>
                 <div>
                    <h3 className="font-bold text-slate-900">{patient.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{patientStudies.length} {patientStudies.length === 1 ? 'estudio disponible' : 'estudios disponibles'}</p>
                 </div>
                 <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-accent' : ''}`}>expand_more</span>
              </div>
              
              {/* Content */}
              {isExpanded && (
                 <div className="border-t border-slate-100 bg-slate-50 overflow-x-auto cursor-default">
                   {patientStudies.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-500">
                        No hay estudios recientes para este paciente.
                      </div>
                   ) : (
                     <table className="w-full text-left border-collapse min-w-[750px]">
                       <thead>
                         <tr className="border-b border-slate-200 bg-slate-100/50 text-slate-600 text-xs uppercase tracking-wider font-bold">
                           <th className="p-4">Fecha</th>
                           <th className="p-4">Modalidad</th>
                           <th className="p-4">Descripción del Estudio</th>
                           <th className="p-4">Estado Reporte</th>
                           <th className="p-4 text-right">Acción</th>
                         </tr>
                       </thead>
                       <tbody>
                         {patientStudies.map((study) => (
                           <tr key={study.id || study.study_uid} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors bg-white">
                             <td className="p-4 font-semibold text-slate-900 text-sm whitespace-nowrap">{study.study_date}</td>
                             <td className="p-4">
                               <span className="bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1 font-extrabold text-xs">
                                 {study.modality}
                               </span>
                             </td>
                             <td className="p-4 text-slate-700 text-sm font-semibold">{study.study_description}</td>
                             <td className="p-4">
                               {study.report ? (
                                 <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold">
                                   <span className="material-symbols-outlined text-xs">verified</span>
                                   Reporte Disponible
                                 </span>
                               ) : (
                                 <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium">
                                   <span className="material-symbols-outlined text-xs">hourglass_empty</span>
                                   Pendiente
                                 </span>
                               )}
                             </td>
                             <td className="p-4 text-right">
                               <button 
                                 onClick={() => {
                                   setSelectedStudy(study);
                                   setView('study_detail');
                                 }}
                                 className="enterprise-btn inline-flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-bold shadow-sm cursor-pointer"
                               >
                                 <span>Ver Detalle</span>
                                 <span className="material-symbols-outlined text-sm">visibility</span>
                               </button>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   )}
                 </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// STUDY DETAIL VIEW (Physician Version with Structured Report & OHIF)
// ----------------------------------------------------------------------
function PhysicianStudyDetailView({ study, setView }: { study: any, setView: (v: ViewState) => void }) {
  if (!study) {
    return (
      <div className="flex flex-col items-center justify-center h-full pt-20">
        <p className="text-slate-500 mb-4">No se ha seleccionado ningún estudio.</p>
        <button onClick={() => setView('studies')} className="enterprise-btn-secondary">Volver a mis estudios</button>
      </div>
    );
  }

  const report = study.report;

  return (
    <div className="pb-12 animate-slide-up w-full">
      <button 
        onClick={() => setView('studies')} 
        className="flex items-center gap-2 text-slate-500 hover:text-accent mb-6 font-semibold transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        Volver a Estudios Recientes
      </button>

      {/* Header Banner */}
      <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold text-slate-900">{study.study_description || 'Estudio Médico'}</h2>
            <span className="bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-0.5 font-extrabold text-xs">
              {study.modality}
            </span>
          </div>
          <p className="text-slate-500 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">calendar_month</span> Realizado el {study.study_date}
            <span className="mx-1">•</span>
            <span className="material-symbols-outlined text-sm">domain</span> Red AROS ({study.clinic_slug || 'demo-clinic'})
          </p>
        </div>
        
        <div className="shrink-0">
          {report ? (
            <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 text-emerald-800 font-bold text-xs flex items-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-base">verified</span>
              Dictamen Radiológico Completado
            </div>
          ) : (
            <div className="bg-slate-100 border border-slate-200 px-4 py-2 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-base">hourglass_empty</span>
              Interpretación Pendiente
            </div>
          )}
        </div>
      </div>

      {/* Patient Summary Card */}
      <div className="enterprise-card p-6 mb-8 bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-accent text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {(study.patient_name || 'P').split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-900">{study.patient_name}</h4>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-0.5">
              {study.patient_dob && <span>Nacimiento: <strong className="text-slate-700">{study.patient_dob}</strong></span>}
              <span>Contacto: <strong className="text-slate-700">{study.patient_email || study.patient_phone}</strong></span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
        {/* Report Card */}
        {report ? (
          <div className="enterprise-card p-0 bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-accent">description</span>
                Reporte Radiológico Estructurado
              </h3>
            </div>
            
            <div className="p-8">
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Indicación Clínica / Motivo</h4>
                <p className="text-slate-700 text-sm leading-relaxed">
                  Evaluación de seguimiento y diagnóstico solicitada para el paciente {study.patient_name}.
                </p>
              </div>
              
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Hallazgos Radiológicos</h4>
                {report.findings ? (
                  <div 
                    className="text-slate-800 text-sm leading-relaxed whitespace-pre-line bg-slate-50 p-4 border border-slate-200"
                    dangerouslySetInnerHTML={{ __html: report.findings }}
                  />
                ) : (
                  <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line bg-slate-50 p-4 border border-slate-200">
                    No se han registrado hallazgos patológicos relevantes en el examen evaluado.
                  </p>
                )}
              </div>
              
              <div className="p-4 bg-emerald-50/70 border-l-4 border-emerald-600 mb-8">
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2">Conclusión Diagnóstica</h4>
                {report.conclusions ? (
                  <div 
                    className="text-emerald-950 font-semibold text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: report.conclusions }}
                  />
                ) : (
                  <p className="text-emerald-950 font-semibold text-sm leading-relaxed">
                    Estudio dentro de límites normales.
                  </p>
                )}
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm border border-slate-200">
                    RM
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{report.radiologist || 'Médico Asignado'}</p>
                    <p className="text-xs text-slate-500 font-mono">Cédula Profesional: {report.cedula || 'N/D'}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-mono">Fecha de Emisión: {report.date || study.study_date}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="enterprise-card p-10 flex flex-col items-center text-center bg-white border border-slate-200">
            <div className="w-16 h-16 bg-slate-50 flex items-center justify-center text-slate-400 mb-4 border border-slate-100">
              <span className="material-symbols-outlined text-3xl">medical_information</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Reporte en Proceso de Interpretación</h3>
            <p className="text-slate-500 text-sm max-w-lg mb-6">
              Las imágenes DICOM han sido recibidas en el PACS. El médico radiólogo se encuentra interpretando el estudio. Usted puede visualizar las imágenes diagnósticas inmediatamente a través del visor OHIF.
            </p>
          </div>
        )}

        {/* OHIF Medical Viewer Card */}
        <div className="enterprise-card p-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white border border-slate-200 shadow-sm">
          <div>
            <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="material-symbols-outlined text-accent">view_in_ar</span>
              Visor Médico DICOM (OHIF Web)
            </h4>
            <p className="text-sm text-slate-500 mt-1">
              Abra las series de imágenes en alta resolución con herramientas de medición, contraste Hounsfield (WL/WW), zoom y reconstrucción MPR.
            </p>
          </div>
          <button 
            onClick={() => setView('ohif')}
            className="enterprise-btn shrink-0 flex items-center gap-2 px-5 py-2.5 font-bold text-sm shadow-sm cursor-pointer"
          >
            <span>Abrir en OHIF</span>
            <span className="material-symbols-outlined text-sm">open_in_new</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// PROFILE VIEW
// ----------------------------------------------------------------------
function ProfileView({ doctor, setDoctor }: { doctor: any, setDoctor?: (d: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ ...doctor });
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  useEffect(() => {
    setFormData({ ...doctor });
  }, [doctor]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    if (formData.phone && !isValidPhoneNumber(formData.phone)) {
      setStatusMsg({ type: 'error', text: 'El número de teléfono no es válido o tiene una longitud incorrecta.' });
      setSaving(false);
      return;
    }
    try {
      const names = (formData.name || '').split(' ');
      const firstName = names[0] || '';
      const lastName = names.slice(1).join(' ') || '';

      const res = await api.put('/auth/me/', {
        first_name: firstName,
        last_name: lastName,
        phone: formData.phone,
        cedula_profesional: formData.cedula_profesional,
        specialty: formData.specialty,
        bio: formData.bio || ''
      });

      if (res.data) {
        if (setDoctor) {
          setDoctor({
            ...doctor,
            name: `${res.data.first_name || ''} ${res.data.last_name || ''}`.trim() || formData.name,
            phone: res.data.phone,
            cedula_profesional: res.data.cedula_profesional,
            specialty: res.data.specialty
          });
        }
        setStatusMsg({ type: 'success', text: 'Perfil profesional actualizado exitosamente.' });
        setEditing(false);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.response?.data?.error || 'Error al guardar perfil.' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
  };

  return (
    <div className="pb-12 animate-slide-up w-full">
      {imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropComplete={async (blob) => {
            try {
              const form = new FormData();
              form.append('avatar', blob, 'avatar.jpg');
              const response = await api.patch('/auth/me/avatar/', form, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
              if (setDoctor) {
                setDoctor({ ...doctor, avatar_url: response.data.avatar_url });
              }
              alert('Avatar actualizado correctamente');
            } catch (err: any) {
              console.error(err);
              alert('Error al subir imagen de perfil');
            } finally {
              setImageToCrop(null);
            }
          }}
          onCancel={() => setImageToCrop(null)}
        />
      )}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Mi Perfil Profesional</h2>
        <p className="text-slate-500 mt-1">Gestione sus datos de contacto y credenciales médicas verificadas por AROS.</p>
      </div>

      {statusMsg && (
        <div className={`p-4 mb-6 text-sm font-semibold flex items-center gap-2 border ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          <span className="material-symbols-outlined text-lg">
            {statusMsg.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {statusMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna Izquierda: Tarjeta Principal (Sticky on scroll) */}
        <div className="lg:col-span-1 flex flex-col gap-6 lg:sticky lg:top-8 self-start">
          <div className="enterprise-card p-6 flex flex-col items-center text-center bg-white border border-slate-200 shadow-sm">
            <div className="relative w-24 h-24 bg-accent text-white flex items-center justify-center font-extrabold text-3xl shadow-sm mb-4 group cursor-pointer overflow-hidden border border-slate-200">
              {doctor.avatar_url ? (
                <img src={doctor.avatar_url.startsWith('http') ? doctor.avatar_url : `http://localhost:8000${doctor.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <>{doctor.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('') || 'DR'}</>
              )}
              <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                <span className="material-symbols-outlined text-white text-xl">photo_camera</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarSelect} />
              </label>
            </div>
            <h3 className="text-xl font-bold text-slate-900">{doctor.name}</h3>
            <p className="text-sm font-semibold text-accent mb-1">{doctor.specialty}</p>
            <p className="text-xs text-slate-500 font-mono mb-4">Cédula: {doctor.cedula_profesional || 'N/D'}</p>
            <div className="w-full flex items-center justify-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-50 py-1.5 border border-emerald-200">
              <span className="material-symbols-outlined text-sm">verified</span>
              Médico Verificado en Red AROS
            </div>
          </div>
          
          <div className="enterprise-card p-0 overflow-hidden bg-white border border-slate-200 shadow-sm">
            <div className="bg-slate-50 p-4 border-b border-slate-200">
              <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-accent text-lg">domain</span>
                Afiliación Institucional
              </h4>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div>
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Red de Diagnóstico</span>
                <span className="font-semibold text-slate-900 text-sm">{doctor.clinic}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <form onSubmit={handleSave} className="enterprise-card p-0 bg-white border border-slate-200 shadow-sm">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
              <h4 className="font-bold text-slate-900 text-lg">Datos Profesionales</h4>
              <button 
                type="button" 
                onClick={() => {
                  if (editing) {
                    setFormData({ ...doctor });
                    setStatusMsg(null);
                  }
                  setEditing(!editing);
                }}
                className="text-accent text-sm font-semibold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">{editing ? 'close' : 'edit'}</span>
                {editing ? 'Cancelar' : 'Editar Datos'}
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre Completo</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  disabled={!editing}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={`border border-slate-200 px-3 py-2 text-sm outline-none ${editing ? 'bg-white focus:border-accent' : 'bg-slate-100 text-slate-900'}`} 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Especialidad</label>
                <input 
                  type="text" 
                  value={formData.specialty} 
                  disabled={!editing}
                  onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                  className={`border border-slate-200 px-3 py-2 text-sm outline-none ${editing ? 'bg-white focus:border-accent' : 'bg-slate-100 text-slate-900'}`} 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cédula Profesional</label>
                <input 
                  type="text" 
                  value={formData.cedula_profesional} 
                  disabled={!editing}
                  onChange={e => setFormData({ ...formData, cedula_profesional: e.target.value })}
                  className={`border border-slate-200 px-3 py-2 text-sm font-mono uppercase outline-none ${editing ? 'bg-white focus:border-accent' : 'bg-slate-100 text-slate-900'}`} 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Teléfono de Contacto</label>
                <div className={`border border-slate-200 px-3 py-2 text-sm outline-none ${editing ? 'bg-white focus:border-accent' : 'bg-slate-100 text-slate-900'}`}>
                  <PhoneInput
                    international
                    countryCallingCodeEditable={false}
                    defaultCountry="MX"
                    limitMaxLength={true}
                    smartCaret={false}
                    value={formData.phone}
                    onChange={(val) => setFormData({ ...formData, phone: val || '' })}
                    disabled={!editing}
                    className="PhoneInput-custom w-full outline-none bg-transparent"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Correo Electrónico (Identificador)</label>
                <input 
                  type="email" 
                  value={doctor.email} 
                  disabled 
                  className="border border-slate-200 px-3 py-2 bg-slate-100 text-slate-500 cursor-not-allowed text-sm outline-none" 
                />
              </div>
            </div>

            {editing && (
              <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                <button 
                  type="submit" 
                  disabled={saving || (formData.phone ? !isValidPhoneNumber(formData.phone) : false)}
                  className={`enterprise-btn px-6 py-2 text-sm flex items-center gap-2 ${formData.phone && !isValidPhoneNumber(formData.phone) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {saving ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      Guardando...
                    </>
                  ) : (
                    'Guardar Cambios'
                  )}
                </button>
              </div>
            )}
          </form>

          <div className="enterprise-card p-0 bg-white border border-slate-200 shadow-sm">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
              <h4 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-accent text-xl">lock</span>
                Seguridad de la Cuenta
              </h4>
            </div>
            <div className="p-6 bg-slate-50 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h5 className="font-bold text-slate-900 text-sm">Contraseña y Cifrado Zero-Trust</h5>
                  <p className="text-xs text-slate-500">Cuentas protegidas con derivación Argon2 y KMS asimétrico.</p>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1">
                  Protección Activa
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
