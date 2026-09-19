import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket';
import { api } from './api';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import DateSelector from './components/DateSelector';
import ImageCropper from './components/ImageCropper';
import AppointmentsView from './components/AppointmentsView';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

// Fix for default marker icon in leaflet with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type ViewState = 'login' | 'home' | 'studies' | 'profile' | 'clinics' | 'doctors' | 'study_detail' | 'appointments' | 'ohif';

export default function App() {
  const [view, setView] = useState<ViewState>('login');
  const [token, setToken] = useState<string | null>(localStorage.getItem('patient_token'));
  const [selectedStudy, setSelectedStudy] = useState<any>(null);
  
  // Shared State
  const [patient, setPatient] = useState<any>(null);
  const [studies, setStudies] = useState<any[]>([]);
  const [partialHistory, setPartialHistory] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [dataFetched, setDataFetched] = useState(false);

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
          let msg = `Tu cita en ${appt.clinic_name || 'la clínica'} ha sido actualizada.`;
          if (appt.status === 'ACCEPTED') msg = `Tu cita en ${appt.clinic_name || 'la clínica'} ha sido confirmada.`;
          else if (appt.status === 'REJECTED') msg = `Tu cita en ${appt.clinic_name || 'la clínica'} no pudo ser agendada.`;
          else if (appt.status === 'CANCELLED') msg = `Tu cita en ${appt.clinic_name || 'la clínica'} ha sido cancelada.`;
          else if (appt.status === 'PROPOSED') {
             if (appt.proposed_by === 'CLINIC' || appt.proposed_by === 'PHYSICIAN') msg = `${appt.clinic_name || 'La clínica'} ha propuesto un nuevo horario.`;
             else msg = `Tu propuesta de horario ha sido enviada a ${appt.clinic_name || 'la clínica'}.`;
          }
          addToast('info', msg, 'notifications_active');
        } else if (data.type === 'report_completed') {
          addToast('success', `Tu estudio en ${data.data.clinic_name || 'la clínica'} ya ha sido dictaminado.`, 'assignment_turned_in');
          fetchStudies();
        }
      } catch (err) {
        console.error('WebSocket Error', err);
      }
    }
  });

  const fetchStudies = () => {
    if (token) {
      api.get('/gateway/studies/').then(res => {
        setStudies(res.data.studies || []);
        if (res.data.partial_history) setPartialHistory(true);
      }).catch(console.error);
    }
  };

  const fetchDoctors = async () => {
    if (token) {
      try {
        const res = await api.get('/auth/patient/doctors/');
        setDoctors(res.data);
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    const handleTokenRefreshed = (e: any) => setToken(e.detail);
    window.addEventListener('token_refreshed', handleTokenRefreshed);
    return () => window.removeEventListener('token_refreshed', handleTokenRefreshed);
  }, []);

  useEffect(() => {
    if (token && view === 'login') setView('home');
    
    if (token && !dataFetched) {
      api.get('/auth/patient/me/').then(res => setPatient(res.data)).catch(console.error);
      fetchStudies();
      fetchDoctors();
      api.get('/auth/clinics/').then(res => setClinics(res.data)).catch(console.error);
      setDataFetched(true);
    }
  }, [token, view, dataFetched]);



  if (!token || view === 'login') {
    return (
      <div className="min-h-screen bg-secondary text-text-primary p-4 flex items-center justify-center">
        <LoginView setToken={setToken} setView={setView} />
      </div>
    );
  }

  return (
    <div className="min-h-screen md:h-screen bg-secondary text-text-primary flex flex-col md:flex-row pt-16 md:pt-0 pb-16 md:pb-0 md:overflow-hidden">
      {/* Mobile Topbar */}
      <div className="md:hidden fixed top-0 left-0 w-full h-16 bg-accent text-white flex items-center justify-between px-4 z-50 shadow-md">
        <h1 className="text-2xl m-0 flex tracking-tighter leading-none">
          <span className="font-extrabold text-slate-900">MEDI</span>
          <span className="font-extrabold text-white">KALI.</span>
        </h1>
        <button 
          onClick={async () => { 
            try { await api.post('/auth/logout/'); } catch(e) { console.error(e); }
            setToken(null); 
            setPatient(null);
            setStudies([]);
            setDoctors([]);
            setClinics([]);
            setDataFetched(false);
            localStorage.removeItem('patient_token'); 
            localStorage.removeItem('patient_user'); 
            setView('login'); 
          }}
          className="p-2 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          title="Cerrar sesión"
        >
          <span className="material-symbols-outlined text-2xl">logout</span>
        </button>
      </div>
      {/* Sidebar (Desktop Only) */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-72 bg-white flex-col z-50 h-full">
        <div className="p-8 bg-accent text-white flex justify-between items-start">
          <h1 className="text-4xl m-0 flex flex-col tracking-tighter leading-none">
            <span className="font-extrabold text-slate-900">MEDI</span>
            <span className="font-extrabold text-white">KALI.</span>
          </h1>
        </div>
        
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <button 
            onClick={() => setView('home')} 
            className={`flex items-center gap-3 px-4 py-3  font-medium transition-all duration-200 text-left ${view === 'home' ? 'bg-slate-50 text-accent font-semibold' : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <span className="material-symbols-outlined text-xl">home</span>
            Inicio
          </button>
          
          <button 
            onClick={() => setView('studies')} 
            className={`flex items-center gap-3 px-4 py-3  font-medium transition-all duration-200 text-left ${view === 'studies' ? 'bg-slate-50 text-accent font-semibold' : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <span className="material-symbols-outlined text-xl">medical_information</span>
            Mis Estudios
          </button>
          
          <button 
            onClick={() => setView('appointments')} 
            className={`flex items-center gap-3 px-4 py-3  font-medium transition-all duration-200 text-left ${view === 'appointments' ? 'bg-slate-50 text-accent font-semibold' : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <span className="material-symbols-outlined text-xl">calendar_month</span>
            Mis Citas
          </button>
          

          <button 
            onClick={() => setView('doctors')} 
            className={`flex items-center gap-3 px-4 py-3  font-medium transition-all duration-200 text-left ${view === 'doctors' ? 'bg-slate-50 text-accent font-semibold' : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <span className="material-symbols-outlined text-xl">stethoscope</span>
            Mis Doctores
          </button>
          
          <button 
            onClick={() => setView('clinics')} 
            className={`flex items-center gap-3 px-4 py-3  font-medium transition-all duration-200 text-left ${view === 'clinics' ? 'bg-slate-50 text-accent font-semibold' : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <span className="material-symbols-outlined text-xl">map</span>
            Clínicas Disponibles
          </button>
        </nav>

        <div className="p-4 border-t border-slate-200 bg-white flex flex-col gap-2">
          <button 
            onClick={() => setView('profile')}
            className={`w-full flex items-center gap-3 p-2 text-left transition-colors border ${view === 'profile' ? 'bg-slate-50 border-slate-200' : 'border-transparent hover:bg-slate-50 hover:border-slate-200 cursor-pointer'}`}
          >
            <div className="w-10 h-10 bg-accent text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0 overflow-hidden">
              {patient?.avatar_url ? (
                <img src={patient.avatar_url.startsWith('http') ? patient.avatar_url : `http://localhost:8000${patient.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <>{patient?.name ? patient.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'P'}</>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 truncate">{patient?.name || 'Mi Perfil'}</p>
              <p className="text-xs text-slate-500 truncate">Ver mi perfil</p>
            </div>
          </button>
          <button 
            onClick={async () => { 
              try { await api.post('/auth/logout/'); } catch(e) { console.error(e); }
              setToken(null); 
              setPatient(null);
              setStudies([]);
              setDoctors([]);
              setClinics([]);
              setDataFetched(false);
              localStorage.removeItem('patient_token'); 
              localStorage.removeItem('patient_user'); 
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
      <main className={`flex-1 md:ml-72 animate-fade-in relative flex flex-col h-full ${view === 'ohif' ? 'bg-black overflow-hidden' : 'bg-slate-50 overflow-y-auto'}`}>
        {view === 'home' && <div className="p-6 md:p-10 w-full"><HomeView setView={setView} patient={patient} studies={studies} doctors={doctors} /></div>}
        {view === 'studies' && <div className="p-6 md:p-10 w-full"><DashboardView setView={setView} setSelectedStudy={setSelectedStudy} studies={studies} partialHistory={partialHistory} /></div>}
        {view === 'study_detail' && <div className="p-6 md:p-10 w-full"><StudyDetailView study={selectedStudy} setView={setView} /></div>}
        {view === 'ohif' && selectedStudy && (
          <div className="flex-1 w-full flex flex-col bg-black z-10">
            <div className="h-14 bg-black border-b border-zinc-800 flex items-center px-4 shrink-0">
              <button 
                onClick={() => setView('study_detail')} 
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">arrow_back</span>
                <span className="font-medium text-sm">Volver al Detalle</span>
              </button>
              <div className="mx-auto text-white/60 text-sm font-medium">
                {patient?.name} - {selectedStudy.modality}
              </div>
            </div>
            <iframe 
              src={`http://localhost:3000/viewer/${selectedStudy.study_uid || selectedStudy.id}`} 
              className="flex-1 w-full h-full border-0 block"
              title="OHIF Viewer"
              allowFullScreen
            />
          </div>
        )}
        {view === 'profile' && <div className="p-6 md:p-10 w-full"><ProfileView patient={patient} setPatient={setPatient} /></div>}
        {view === 'doctors' && <div className="p-6 md:p-10 w-full"><DoctorsView doctors={doctors} fetchDoctors={fetchDoctors} /></div>}
        {view === 'clinics' && <ClinicsView clinics={clinics} />}
        {view === 'appointments' && <div className="p-6 md:p-10 w-full"><AppointmentsView /></div>}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-white border-t border-slate-200 flex items-center justify-around z-50 px-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <button onClick={() => setView('home')} className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${view === 'home' ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: view === 'home' ? "'FILL' 1" : "'FILL' 0" }}>home</span>
        </button>
        <button onClick={() => setView('studies')} className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${view === 'studies' ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: view === 'studies' ? "'FILL' 1" : "'FILL' 0" }}>medical_information</span>
        </button>
        <button onClick={() => setView('appointments')} className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${view === 'appointments' ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: view === 'appointments' ? "'FILL' 1" : "'FILL' 0" }}>calendar_month</span>
        </button>
        <button onClick={() => setView('doctors')} className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${view === 'doctors' ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: view === 'doctors' ? "'FILL' 1" : "'FILL' 0" }}>stethoscope</span>
        </button>
        <button onClick={() => setView('clinics')} className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${view === 'clinics' ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: view === 'clinics' ? "'FILL' 1" : "'FILL' 0" }}>map</span>
        </button>
        <button onClick={() => setView('profile')} className="flex flex-col items-center justify-center w-12 h-12">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden transition-all ${view === 'profile' ? 'ring-2 ring-accent ring-offset-2' : 'ring-1 ring-slate-200'}`}>
            {patient?.avatar_url ? (
              <img src={patient.avatar_url.startsWith('http') ? patient.avatar_url : `http://localhost:8000${patient.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-accent text-white flex items-center justify-center">
                {patient?.name ? patient.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'P'}
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
              <span className="material-symbols-outlined text-accent">{toast.icon}</span>
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
              <div className="h-full bg-accent animate-[shrink_5s_linear_forwards]"></div>
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
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user was redirected from email verification
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
      setSuccessMsg('¡Tu cuenta ha sido verificada con éxito! Ya puedes iniciar sesión.');
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
        
        await api.post('/auth/register/patient/', { 
          email: em.trim(), 
          password: pw,
          first_name: firstName,
          last_name: lastName
        }, { withCredentials: false });
        setSuccessMsg('Registro exitoso. Revisa tu correo electrónico para verificar tu cuenta.');
        setIsRegistering(false);
      } else {
        const res = await api.post('/auth/login/', { email_hash: em.trim(), password: pw });
        if (res.data.access) {
          localStorage.setItem('patient_token', res.data.access);
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
        // @ts-ignore - AwsWafCaptcha is provided by the AWS SDK in index.html
        if (container && window.AwsWafCaptcha) {
          // @ts-ignore
          window.AwsWafCaptcha.renderCaptcha(container, {
            apiKey: "",
            onSuccess: async (wafToken: string) => {
              setLoading(true);
              try {
                await api.post('/auth/register/patient/', { 
                  email: em.trim(), 
                  password: pw,
                  first_name: firstName,
                  last_name: lastName
                }, { 
                  withCredentials: false,
                  headers: { 'x-aws-waf-token': wafToken }
                });
                setSuccessMsg('Registro exitoso. Revisa tu correo electrónico para verificar tu cuenta.');
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
        setError(err.response?.data?.detail || 'No se encontró un usuario activo con esas credenciales.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md">
      <div className="enterprise-card p-10 w-full bg-white animate-slide-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-accent flex items-center justify-center text-white font-bold text-2xl shadow-sm mb-4">A</div>
          <h1 className="text-2xl font-bold text-slate-900">Portal de Pacientes</h1>
          <p className="text-sm text-slate-500 mt-1">Accede a tus estudios e imágenes diagnósticas AROS</p>
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
                <label className="font-medium text-sm text-slate-700">Nombre</label>
                <input 
                  type="text" 
                  placeholder="Juan"
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
                  placeholder="Pérez"
                  value={lastName} 
                  onChange={e => setLastName(e.target.value)} 
                  className="border border-slate-300 px-4 py-2.5 bg-white focus:bg-slate-50 focus:border-accent focus:ring-1 focus:ring-accent transition-colors outline-none text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-sm text-slate-700">Correo electrónico</label>
            <input 
              type="email" 
              placeholder="ejemplo@correo.com"
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
              <span>Al crear una cuenta, aceptas nuestros Términos de Servicio y Política de Privacidad.</span>
              <div id="aws-waf-captcha-container" className="flex items-center justify-center min-h-[50px] w-full rounded"></div>
            </div>
          )}

          <button type="submit" disabled={loading} className="enterprise-btn mt-2 w-full py-2.5 flex items-center justify-center gap-2">
            {loading ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                {isRegistering ? 'Creando cuenta...' : 'Iniciando sesión...'}
              </>
            ) : (
              isRegistering ? 'Crear Cuenta' : 'Ingresar al Portal'
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
            {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
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
// HOME VIEW (Welcome Dashboard)
// ----------------------------------------------------------------------
function HomeView({ setView, patient, studies, doctors = [] }: { setView: (v: ViewState) => void, patient: any, studies: any[], doctors?: any[] }) {
  const recentStudies = studies.slice(0, 2);
  const firstName = patient ? patient.name.split(' ')[0] : 'Cargando...';
  const trustedDoctorsCount = doctors.filter(d => d.trusted).length;

  return (
    <div className="flex flex-col gap-8 pb-12 animate-slide-up">
      {/* Header Saludo */}
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Hola, {firstName}.</h2>
        <p className="text-base text-slate-500">Aquí está el resumen actualizado de tu historial médico.</p>
      </div>

      {/* Bento Grid: Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="enterprise-card p-6 flex flex-col justify-between h-40 bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined">radiology</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-600">Último Estudio</h3>
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900">{studies.length > 0 ? studies[0].modality : 'Ninguno'}</h4>
            <p className="text-sm text-slate-500">{studies.length > 0 ? (studies[0].study_description || studies[0].study_date) : 'Sin estudios registrados'}</p>
          </div>
        </div>

        <div className="enterprise-card p-6 flex flex-col justify-between h-40 cursor-pointer hover:border-accent transition-colors bg-white border border-slate-200 shadow-sm" onClick={() => setView('studies')}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-100 flex items-center justify-center text-slate-700">
              <span className="material-symbols-outlined">folder_open</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-600">Total de Estudios</h3>
          </div>
          <div>
            <h4 className="text-3xl font-bold text-slate-900">{studies.length}</h4>
            <p className="text-sm text-slate-500">En todo tu historial médico</p>
          </div>
        </div>

        <div className="enterprise-card p-6 flex flex-col justify-between h-40 cursor-pointer hover:border-accent transition-colors bg-white border border-slate-200 shadow-sm" onClick={() => setView('doctors')}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined">stethoscope</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-600">Doctores de Confianza</h3>
          </div>
          <div>
            <h4 className="text-3xl font-bold text-slate-900">{trustedDoctorsCount}</h4>
            <p className="text-sm text-slate-500">
              {trustedDoctorsCount === 1 ? 'Médico con acceso activo' : 'Médicos con acceso activo'}
            </p>
          </div>
        </div>
      </div>

      {/* Reciente Section */}
      <div className="enterprise-card p-0 mt-2">
        <div className="p-5 flex justify-between items-center border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">Actividad Reciente</h3>
          <button onClick={() => setView('studies')} className="text-accent text-sm font-medium hover:underline">Ver todo</button>
        </div>
        
        <div className="flex flex-col">
          {recentStudies.length === 0 ? (
             <div className="p-8 text-center text-slate-500">No hay actividad reciente.</div>
          ) : recentStudies.map((study, i) => (
            <div key={i} className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4 mb-3 md:mb-0">
                <div className="w-12 h-12  bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200">
                  <span className="material-symbols-outlined">skeleton</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">{study.study_description || 'Estudio Médico'}</h4>
                  <p className="text-sm text-slate-500">{study._source_clinic} <span className="mx-1">•</span> {study.study_date}</p>
                </div>
              </div>
              <button onClick={() => setView('studies')} className="enterprise-btn-secondary py-1.5 px-4 text-sm">Ver Detalles</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// STUDIES VIEW
// ----------------------------------------------------------------------
function DashboardView({ setView, setSelectedStudy, studies, partialHistory }: { setView: (v: ViewState) => void, setSelectedStudy: (s: any) => void, studies: any[], partialHistory: boolean }) {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const sortedStudies = [...studies].sort((a, b) => {
    if (!sortConfig) return 0;
    
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    // Custom handling for status which is derived from report
    if (sortConfig.key === 'status') {
      aVal = a.report && a.report.status === 'COM' ? 'Reporte Final' : 'Pendiente';
      bVal = b.report && b.report.status === 'COM' ? 'Reporte Final' : 'Pendiente';
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return 'swap_vert';
    return sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
  };

  return (
    <div className="pb-12 animate-slide-up">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Mis Estudios</h2>
        <p className="text-slate-500 mt-1">Accede a tu historial clínico completo e imágenes DICOM.</p>
      </div>

      {partialHistory && (
        <div className="bg-orange-50 border border-orange-200  p-4 mb-6 flex flex-col md:flex-row items-center gap-4 shadow-sm">
          <div className="w-10 h-10  bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div>
            <strong className="text-sm font-semibold text-orange-800 block">Historial Parcial</strong> 
            <span className="text-sm text-orange-700">Algunas clínicas en la red no están respondiendo actualmente.</span>
          </div>
        </div>
      )}
      
      <div className="enterprise-card overflow-hidden">
        {studies.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center bg-white">
            <div className="w-16 h-16 bg-slate-100  flex items-center justify-center text-slate-400 mb-4">
              <span className="material-symbols-outlined text-3xl">inventory_2</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No hay estudios disponibles</h3>
            <p className="text-sm text-slate-500">Tus estudios médicos aparecerán aquí cuando estén listos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-sm">
                  <th className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('study_date')}>
                    <div className="flex items-center gap-1">Fecha <span className="material-symbols-outlined text-sm">{getSortIcon('study_date')}</span></div>
                  </th>
                  <th className="p-4 font-semibold">Modalidad</th>
                  <th className="p-4 font-semibold">Descripción</th>
                  <th className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors text-center" onClick={() => requestSort('status')}>
                    <div className="flex items-center justify-center gap-1">Estatus <span className="material-symbols-outlined text-sm">{getSortIcon('status')}</span></div>
                  </th>
                  <th className="p-4 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudies.map((study, idx) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-900">{study.study_date}</td>
                    <td className="p-4">
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1  font-semibold text-xs tracking-wide">
                        {study.modality}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">{study.study_description || 'Sin descripción'}</td>
                    <td className="p-4 text-center">
                      {study.report && study.report.status === 'COM' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-1"><span className="material-symbols-outlined text-xs">description</span> Reporte Final</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1"><span className="material-symbols-outlined text-xs">pending</span> Pendiente</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => { setSelectedStudy(study); setView('study_detail'); }}
                        className="enterprise-btn-secondary inline-flex items-center gap-2 py-1.5 px-3 text-sm"
                      >
                        Ver Detalles
                        <span className="material-symbols-outlined text-sm">visibility</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// PROFILE VIEW
// ----------------------------------------------------------------------
function ProfileView({ patient, setPatient }: { patient: any, setPatient?: (p: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    dob: '',
    address: '',
    gender: 'O',
    curp_or_mrn: '',
    blood_type: 'O+',
    allergies: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  useEffect(() => {
    if (patient) {
      setFormData({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        phone: patient.phone || '',
        dob: patient.dob || '',
        address: patient.address || '',
        gender: patient.gender || '',
        curp_or_mrn: patient.curp_or_mrn || '',
        blood_type: patient.blood_type || '',
        allergies: patient.allergies || '',
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    }
  }, [patient]);

  if (!patient) return <div className="p-10 text-slate-500">Cargando perfil...</div>;

  const initials = patient.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'P';

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.new_password && formData.new_password !== formData.confirm_password) {
      setStatusMsg({ type: 'error', text: 'Las nuevas contraseñas no coinciden.' });
      return;
    }
    if (formData.phone && !isValidPhoneNumber(formData.phone)) {
      setStatusMsg({ type: 'error', text: 'El número de teléfono móvil no es válido o tiene una longitud incorrecta.' });
      return;
    }
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await api.put('/auth/patient/me/', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        dob: formData.dob,
        address: formData.address,
        gender: formData.gender,
        curp_or_mrn: formData.curp_or_mrn,
        blood_type: formData.blood_type,
        allergies: formData.allergies,
        current_password: formData.current_password || undefined,
        new_password: formData.new_password || undefined
      });
      if (setPatient) {
        setPatient(res.data);
      }
      setStatusMsg({ type: 'success', text: 'Tu perfil ha sido actualizado exitosamente.' });
      setEditing(false);
      setFormData(prev => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }));
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.response?.data?.error || 'Error al guardar los cambios del perfil.' });
    } finally {
      setSaving(false);
    }
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
              if (setPatient) {
                setPatient((prev: any) => prev ? { ...prev, avatar_url: response.data.avatar_url } : null);
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
        <h2 className="text-2xl font-bold text-slate-900">Mi Perfil</h2>
        <p className="text-slate-500 mt-1">Gestiona tu información personal, datos clínicos y credenciales de acceso a la Red AROS.</p>
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
          <div className="enterprise-card p-6 flex flex-col items-center text-center bg-white border border-slate-200">
            <div className="relative w-24 h-24 bg-accent text-white flex items-center justify-center font-extrabold text-3xl shadow-sm mb-4 group cursor-pointer overflow-hidden border border-slate-200">
              {patient.avatar_url ? (
                <img src={patient.avatar_url.startsWith('http') ? patient.avatar_url : `http://localhost:8000${patient.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <>{initials}</>
              )}
              <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                <span className="material-symbols-outlined text-white text-xl">photo_camera</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarSelect} />
              </label>
            </div>
            <h3 className="text-xl font-bold text-slate-900">{patient.name || 'Paciente'}</h3>
            <p className="text-xs text-slate-500 font-mono mb-4">AROS ID: #{patient.aros_id}</p>
            <div className="w-full flex items-center justify-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-50 py-1.5 border border-emerald-200">
              <span className="material-symbols-outlined text-sm">verified</span>
              Expediente Digital Activo
            </div>
          </div>
          
          <div className="enterprise-card p-0 overflow-hidden bg-white border border-slate-200">
            <div className="bg-slate-50 p-4 border-b border-slate-200">
              <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-accent text-lg">medical_services</span>
                Información Vital
              </h4>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div>
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Grupo Sanguíneo</span>
                <span className="font-bold text-slate-900 text-sm">{patient.blood_type || 'No especificado'}</span>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Alergias</span>
                <span className="font-semibold text-rose-600 text-sm">{patient.allergies || 'No especificadas'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Formulario Completo de Perfil */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <form onSubmit={handleSaveProfile} className="enterprise-card p-0 bg-white border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
              <h4 className="font-bold text-slate-900 text-lg">Datos Personales y Demográficos</h4>
              <button 
                type="button" 
                onClick={() => {
                  if (editing) {
                    setFormData({ ...patient, new_password: '', confirm_password: '' });
                    setStatusMsg(null);
                  }
                  setEditing(!editing);
                }}
                className="text-accent font-semibold cursor-pointer flex items-center gap-1 group"
              >
                <span className="material-symbols-outlined text-lg">{editing ? 'close' : 'edit'}</span>
                <span className="text-sm group-hover:underline underline-offset-2">{editing ? 'Cancelar' : 'Editar Datos'}</span>
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre(s)</label>
                <input 
                  type="text" 
                  value={formData.first_name} 
                  disabled={!editing}
                  onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                  className={`border border-slate-200 px-3 py-2 text-sm outline-none ${editing ? 'bg-white focus:border-accent' : 'bg-slate-100 text-slate-900'}`} 
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Apellidos</label>
                <input 
                  type="text" 
                  value={formData.last_name} 
                  disabled={!editing}
                  onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                  className={`border border-slate-200 px-3 py-2 text-sm outline-none ${editing ? 'bg-white focus:border-accent' : 'bg-slate-100 text-slate-900'}`} 
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Fecha de Nacimiento</label>
                <DateSelector 
                  value={formData.dob}
                  disabled={!editing}
                  onChange={(val) => setFormData({ ...formData, dob: val })}
                  className={editing ? 'bg-white' : 'bg-slate-100 text-slate-900'}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Género</label>
                <select 
                  value={formData.gender} 
                  disabled={!editing}
                  onChange={e => setFormData({ ...formData, gender: e.target.value })}
                  className={`border border-slate-200 px-3 py-2 text-sm outline-none ${editing ? 'bg-white focus:border-accent' : 'bg-slate-100 text-slate-900'}`}
                >
                  <option value="F">Femenino</option>
                  <option value="M">Masculino</option>
                  <option value="O">Otro</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Teléfono Móvil</label>
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

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">CURP / Identificador Médico</label>
                <input 
                  type="text" 
                  value={formData.curp_or_mrn} 
                  disabled={!editing}
                  onChange={e => setFormData({ ...formData, curp_or_mrn: e.target.value })}
                  className={`border border-slate-200 px-3 py-2 text-sm font-mono uppercase outline-none ${editing ? 'bg-white focus:border-accent' : 'bg-slate-100 text-slate-900'}`} 
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Dirección Física</label>
                <input 
                  type="text" 
                  value={formData.address} 
                  disabled={!editing}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className={`border border-slate-200 px-3 py-2 text-sm outline-none ${editing ? 'bg-white focus:border-accent' : 'bg-slate-100 text-slate-900'}`} 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Grupo Sanguíneo</label>
                <select 
                  value={formData.blood_type} 
                  disabled={!editing}
                  onChange={e => setFormData({ ...formData, blood_type: e.target.value })}
                  className={`border border-slate-200 px-3 py-2 text-sm outline-none ${editing ? 'bg-white focus:border-accent' : 'bg-slate-100 text-slate-900'}`}
                >
                  <option value="">Seleccione...</option>
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bt => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Alergias Conocidas</label>
                <input 
                  type="text" 
                  value={formData.allergies} 
                  disabled={!editing}
                  onChange={e => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="Ej. Penicilina, AINEs, Ninguna"
                  className={`border border-slate-200 px-3 py-2 text-sm outline-none ${editing ? 'bg-white focus:border-accent' : 'bg-slate-100 text-slate-900'}`} 
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Correo Electrónico (Identificador)</label>
                <input 
                  type="email" 
                  value={patient.email} 
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
                  className={`enterprise-btn px-6 py-2.5 text-sm flex items-center gap-2 ${formData.phone && !isValidPhoneNumber(formData.phone) ? 'opacity-50 cursor-not-allowed' : ''}`}
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

          {/* Card 2: Seguridad */}
          <div className="enterprise-card p-0 bg-white border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
              <h4 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-accent text-xl">lock</span>
                Seguridad y Acceso
              </h4>
            </div>
            <div className="p-6 bg-slate-50 flex flex-col gap-5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h5 className="font-bold text-slate-900 text-sm">Contraseña y Cifrado de Datos</h5>
                  <p className="text-xs text-slate-500 mt-0.5">Tus imágenes y reportes médicos están protegidos con KMS asimétrico.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setEditing(true)}
                  className="enterprise-btn-secondary text-xs py-2 px-4 cursor-pointer font-bold"
                >
                  Actualizar Datos
                </button>
              </div>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}

// Helper component to center map on search or clinic click
function MapCenter({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [center, zoom, map]);
  return null;
}

// ----------------------------------------------------------------------
// CLINICS VIEW
// ----------------------------------------------------------------------
const arosIcon = L.divIcon({
  className: 'custom-aros-icon',
  html: `<div class="w-10 h-10 relative cursor-pointer group hover:scale-110 transition-transform duration-200 origin-bottom">
          <div class="absolute inset-0 bg-accent text-white flex items-center justify-center shadow-md z-10">
            <span class="material-symbols-outlined text-2xl">location_on</span>
          </div>
          <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-accent rotate-45 shadow-sm z-0"></div>
         </div>`,
  iconSize: [40, 48],
  iconAnchor: [20, 48],
  popupAnchor: [0, -50]
});

function ClinicsView({ clinics: initialClinics }: { clinics: any[] }) {
  const [clinics, setClinics] = useState<any[]>(initialClinics);
  const [searchTerm, setSearchTerm] = useState('');
  const initialCenter: [number, number] = clinics.length > 0 && clinics[0].lat ? [clinics[0].lat, clinics[0].lng] : [19.4184, -99.1643];
  const [mapCenter, setMapCenter] = useState<[number, number]>(initialCenter);
  const [mapZoom, setMapZoom] = useState<number>(13);
  const [isSheetExpanded, setIsSheetExpanded] = useState<boolean>(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragDelta, setDragDelta] = useState<number>(0);
  const [expandedClinicId, setExpandedClinicId] = useState<string | null>(null);
  const [ratingLoading, setRatingLoading] = useState<string | null>(null);
  const [ratingMsg, setRatingMsg] = useState<{ id: string, type: 'success' | 'error', text: string } | null>(null);
  const markerRefs = useRef<{ [key: string]: L.Marker | null }>({});

  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [requestedDateObj, setRequestedDateObj] = useState<Date | null>(null);
  const [requestedTime, setRequestedTime] = useState<string>('');
  const [modality, setModality] = useState('');
  const [notes, setNotes] = useState('');

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

  const handleRequestAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedDateObj || !requestedTime || !selectedClinicId) return;
    
    const localDateStr = `${requestedDateObj.getFullYear()}-${(requestedDateObj.getMonth()+1).toString().padStart(2, '0')}-${requestedDateObj.getDate().toString().padStart(2, '0')}T${requestedTime}:00`;
    
    try {
      await api.post('/auth/patient/appointments/', {
        clinic_id: selectedClinicId,
        requested_date: new Date(localDateStr).toISOString(),
        modality,
        notes
      });
      setShowAppointmentModal(false);
      setModality('');
      setNotes('');
      setRequestedDateObj(null);
      setRequestedTime('');
      alert('Cita solicitada exitosamente. Verifícala en la sección Mis Citas.');
    } catch (err) {
      console.error(err);
      alert('Error al solicitar la cita');
    }
  };

  useEffect(() => {
    setClinics(initialClinics);
    if (initialClinics.length > 0 && initialClinics[0].lat && initialClinics[0].lng) {
      setMapCenter([initialClinics[0].lat, initialClinics[0].lng]);
    }
  }, [initialClinics]);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setTouchStartY(e.touches[0].clientY);
    setIsDragging(true);
    setDragDelta(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isDragging || touchStartY === null) return;
    const currentY = e.touches[0].clientY;
    setDragDelta(currentY - touchStartY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (touchStartY === null) {
      setIsDragging(false);
      return;
    }
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY;
    
    setIsDragging(false);

    if (deltaY < -40) {
      setIsSheetExpanded(true); // swiped up
    } else if (deltaY > 40) {
      setIsSheetExpanded(false); // swiped down
    } else if (Math.abs(deltaY) < 5) {
      setIsSheetExpanded(!isSheetExpanded); // tap
    }
    
    setDragDelta(0);
    setTouchStartY(null);
  };

  const handleToggleClinic = (clinic: any) => {
    const isCurrentlyExpanded = expandedClinicId === clinic.id;
    if (isCurrentlyExpanded) {
      setExpandedClinicId(null);
    } else {
      setExpandedClinicId(clinic.id);
      const pos: [number, number] = [clinic.lat || 19.4184, clinic.lng || -99.1643];
      setMapCenter(pos);
      setMapZoom(15);
      const marker = markerRefs.current[clinic.id];
      if (marker) {
        marker.openPopup();
      }
    }
  };

  const handleRateClinic = async (clinicId: string, score: number) => {
    setRatingLoading(clinicId);
    setRatingMsg(null);
    try {
      const res = await api.post('/auth/patient/clinics/rate/', {
        clinic_id: clinicId,
        score
      });
      if (res.data.status === 'success') {
        setClinics(prev => prev.map(c => c.id === clinicId ? {
          ...c,
          rating: res.data.new_average,
          total_reviews: res.data.total_reviews,
          user_score: res.data.user_score,
          has_rated: true,
          has_attended: true
        } : c));
        
        setRatingMsg({ id: clinicId, type: 'success', text: `¡Gracias! Has calificado con ${score}★.` });
      }
    } catch (err: any) {
      console.error('Error rating clinic:', err);
      setRatingMsg({ id: clinicId, type: 'error', text: err.response?.data?.error || 'No fue posible registrar la calificación.' });
    } finally {
      setRatingLoading(null);
    }
  };

  const filteredClinics = clinics.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    ((c.specialties || []).some((s: string) => s.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="relative w-full flex-1 animate-fade-in bg-slate-200 min-h-[calc(100vh-8rem)] md:min-h-0 md:h-full">
      <div className="absolute inset-0 w-full h-full z-0">
        <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
            maxZoom={20}
          />
          <MapCenter center={mapCenter} zoom={mapZoom} />
          {clinics.map(clinic => (
            <Marker 
              key={clinic.id} 
              ref={(el) => { markerRefs.current[clinic.id] = el; }}
              position={[clinic.lat || 19.4184, clinic.lng || -99.1643]}
              icon={arosIcon}
              eventHandlers={{
                click: () => handleToggleClinic(clinic)
              }}
            >
              <Popup minWidth={340} maxWidth={440}>
                <div className="w-full bg-white text-slate-900 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 text-slate-900 flex items-center justify-between gap-3">
                    <h3 className="font-extrabold text-sm tracking-wide m-0 leading-tight flex-1">{clinic.name}</h3>
                    <div className="inline-flex items-center gap-1 bg-white text-amber-500 border border-slate-200 shadow-sm px-2 py-0.5 shrink-0 text-xs rounded-none">
                      <span className="material-symbols-outlined text-[13px] leading-none text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="font-extrabold leading-none">{clinic.rating || '5.0'}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 flex flex-col gap-2.5 text-xs text-slate-700">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-accent text-base shrink-0 mt-0.5 leading-none">location_on</span>
                      <span className="leading-relaxed font-medium text-slate-800">{clinic.address}</span>
                    </div>

                    {clinic.phone && (
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="material-symbols-outlined text-sm shrink-0 leading-none text-slate-500">call</span>
                        <a href={`tel:${clinic.phone.replace(/\s+/g, '')}`} className="font-semibold text-accent hover:underline">
                          {clinic.phone}
                        </a>
                      </div>
                    )}

                    {clinic.opening_hours && (
                      <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                        <span className="material-symbols-outlined text-xs shrink-0 leading-none text-slate-400">schedule</span>
                        <span>{clinic.opening_hours}</span>
                      </div>
                    )}

                    {clinic.specialties && clinic.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2 mt-1 border-t border-slate-200">
                        {clinic.specialties.slice(0, 3).map((spec: string) => (
                          <span key={spec} className="text-[10px] font-bold px-1.5 py-0.5 bg-white border border-slate-200 text-slate-700">
                            {spec}
                          </span>
                        ))}
                        {clinic.specialties.length > 3 && (
                          <span className="text-[10px] font-semibold text-slate-500 self-center">
                            +{clinic.specialties.length - 3} más
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Overlay Panel (Floating Card on Desktop, Bottom Sheet on Mobile) */}
      <div 
        className={`absolute md:top-6 md:left-6 md:bottom-auto bottom-0 left-0 w-full md:w-96 md:max-w-[calc(100%-3rem)] bg-white md:border border-t border-slate-200 shadow-2xl flex flex-col md:h-auto md:max-h-[calc(100%-3rem)] z-10 md:rounded-none rounded-t-2xl overflow-hidden h-[60vh] ${isDragging ? '' : 'transition-transform duration-300'} md:transform-none`}
        style={window.innerWidth < 768 ? { transform: `translateY(${isDragging ? (isSheetExpanded ? Math.max(0, dragDelta) + 'px' : `calc(100% - 96px + ${Math.min(0, dragDelta)}px)`) : (isSheetExpanded ? '0px' : 'calc(100% - 96px)')})` } : {}}
      >
        
        {/* Mobile Handle & Header Area */}
        <div 
          className="h-24 md:h-auto bg-slate-100 cursor-pointer md:cursor-default select-none border-b border-slate-200 text-slate-900 flex flex-col justify-center relative touch-none"
          onClick={() => {
            if (window.innerWidth < 768) setIsSheetExpanded(!isSheetExpanded);
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Mobile Handle */}
          <div className="md:hidden w-full flex justify-center pt-2 pb-1 absolute top-0 left-0">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
          </div>

          <div className="p-4 md:p-5 pt-5 md:pt-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold tracking-tight">Red de Clínicas AROS</h2>
              <span className="text-xs px-2 py-0.5 bg-accent text-white font-bold uppercase tracking-wider">
                {clinics.length} {clinics.length === 1 ? 'Sede' : 'Sedes'}
              </span>
            </div>
            <p className="text-xs opacity-80 mt-1 text-slate-600">Localiza tu centro de diagnóstico y consulta sus especialidades</p>
          </div>
        </div>
        
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input 
              type="text" 
              placeholder="Buscar por clínica, dirección o especialidad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 bg-white focus:border-accent outline-none font-medium"
            />
          </div>
        </div>

        <div className="overflow-y-auto p-3 flex flex-col gap-3">
          {filteredClinics.map(clinic => {
            const isExpanded = expandedClinicId === clinic.id;
            return (
              <div 
                key={clinic.id} 
                onClick={() => handleToggleClinic(clinic)}
                className={`p-4 border transition-all cursor-pointer bg-white ${isExpanded ? 'border-accent shadow-md ring-1 ring-accent/20' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}
              >
                {/* Header (Always Visible) */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-base leading-tight">{clinic.name}</h3>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {clinic.total_reviews || 0} {clinic.total_reviews === 1 ? 'opinión de paciente' : 'opiniones de pacientes'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 border border-amber-200 shrink-0 rounded-none">
                      <span className="material-symbols-outlined text-[13px] text-amber-500 leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span>{clinic.rating || '5.0'}</span>
                    </span>
                    <span className={`material-symbols-outlined text-slate-400 text-lg transition-transform duration-200 ${isExpanded ? 'rotate-180 text-accent' : ''}`}>
                      expand_more
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mt-2 flex items-start gap-1">
                  <span className="material-symbols-outlined text-sm text-accent shrink-0 mt-0.5">location_on</span>
                  <span className="leading-snug">{clinic.address}</span>
                </p>

                {/* Collapsible Detailed Content */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-3 animate-fade-in">
                    {clinic.opening_hours && (
                      <p className="text-[11px] text-slate-600 flex items-center gap-1.5 font-medium bg-slate-50 p-2 border border-slate-100">
                        <span className="material-symbols-outlined text-sm text-slate-500 shrink-0">schedule</span>
                        <span>{clinic.opening_hours}</span>
                      </p>
                    )}

                    {/* Specialties Pills */}
                    {clinic.specialties && clinic.specialties.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                          Especialidades Disponibles
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {clinic.specialties.map((spec: string) => (
                            <span 
                              key={spec} 
                              className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {spec}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Patient Rating Section */}
                    <div className="pt-2.5 border-t border-slate-100 flex flex-col gap-1.5 bg-slate-50 p-3 border border-slate-200" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                          {clinic.has_rated ? 'Tu calificación registrada:' : clinic.has_attended ? 'Calificar esta sede:' : 'Calificación de la sede:'}
                        </span>
                        {clinic.has_rated && (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs">check_circle</span> Calificada
                          </span>
                        )}
                      </div>

                      {clinic.has_attended ? (
                        clinic.has_rated ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center text-amber-500">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                  key={star}
                                  className="material-symbols-outlined text-base leading-none"
                                  style={{ fontVariationSettings: `'FILL' ${(clinic.user_score || 5) >= star ? 1 : 0}` }}
                                >
                                  star
                                </span>
                              ))}
                            </div>
                            <span className="text-xs font-bold text-slate-700">
                              Has otorgado {clinic.user_score || 5}★
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => handleRateClinic(clinic.id, star)}
                                  disabled={ratingLoading === clinic.id}
                                  className="text-amber-400 hover:scale-125 transition-transform focus:outline-none p-0.5 cursor-pointer"
                                  title={`Calificar con ${star} estrellas`}
                                >
                                  <span
                                    className="material-symbols-outlined text-xl leading-none"
                                    style={{ fontVariationSettings: `'FILL' 0` }}
                                  >
                                    star
                                  </span>
                                </button>
                              ))}
                              <span className="text-xs text-slate-500 font-medium ml-1.5">
                                {ratingLoading === clinic.id ? 'Guardando...' : 'Toca para calificar (1 sola vez)'}
                              </span>
                            </div>
                            {ratingMsg && ratingMsg.id === clinic.id && (
                              <span className={`text-[11px] font-semibold ${ratingMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {ratingMsg.text}
                              </span>
                            )}
                          </div>
                        )
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-white p-2 border border-slate-200">
                          <span className="material-symbols-outlined text-xs text-slate-400 shrink-0">info</span>
                          <span>Disponible tras realizarte un estudio en esta clínica.</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {clinic.phone && (
                        <a 
                          href={`tel:${clinic.phone.replace(/\s+/g, '')}`}
                          onClick={(e) => e.stopPropagation()}
                          className="enterprise-btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1.5 font-bold shadow-sm"
                        >
                          <span className="material-symbols-outlined text-sm">call</span>
                          Llamar
                        </a>
                      )}
                      {clinic.email && (
                        <a 
                          href={`mailto:${clinic.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="enterprise-btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1.5 font-bold shadow-sm"
                        >
                          <span className="material-symbols-outlined text-sm">mail</span>
                          Contacto
                        </a>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedClinicId(clinic.id); setShowAppointmentModal(true); }}
                        className="enterprise-btn text-xs py-2 px-3 flex items-center justify-center gap-1.5 font-bold shadow-sm col-span-2 mt-1"
                      >
                        <span className="material-symbols-outlined text-sm">calendar_month</span>
                        Agendar Cita
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredClinics.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">search_off</span>
              No se encontraron clínicas que coincidan con tu búsqueda.
            </div>
          )}
        </div>
      </div>

      {showAppointmentModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[9999] animate-fade-in p-4" style={{ position: 'fixed' }}>
          <div className="bg-white p-8 w-full max-w-md shadow-2xl relative rounded-none">
            <button onClick={() => setShowAppointmentModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900">
              <span className="material-symbols-outlined">close</span>
            </button>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Agendar Nueva Cita</h2>
            
            <form onSubmit={handleRequestAppointment} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-sm font-semibold text-slate-700">Fecha Preferida</label>
                <DatePicker
                  selected={requestedDateObj}
                  onChange={(date: Date | null) => {
                    setRequestedDateObj(date);
                    setRequestedTime('');
                  }}
                  minDate={new Date()}
                  filterDate={(date) => {
                    const clinic = clinics.find(c => c.id === selectedClinicId);
                    if (!clinic) return true;
                    const hours = parseWorkingHours(clinic.opening_hours);
                    return hours[date.getDay()] !== null;
                  }}
                  dateFormat="yyyy-MM-dd"
                  className="border border-slate-300 p-2 text-sm w-full outline-none z-[1000] rounded-none bg-white"
                  placeholderText="Seleccione una fecha"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">Hora Preferida</label>
                <select
                  value={requestedTime}
                  onChange={(e) => setRequestedTime(e.target.value)}
                  className="border border-slate-300 p-2 text-sm outline-none bg-white"
                  required
                  disabled={!requestedDateObj}
                >
                  <option value="">Seleccione una hora</option>
                  {(() => {
                    if (!requestedDateObj) return null;
                    const clinic = clinics.find(c => c.id === selectedClinicId);
                    const hoursMap = parseWorkingHours(clinic?.opening_hours || '');
                    const dayConfig = hoursMap[requestedDateObj.getDay()];
                    if (!dayConfig) return null;
                    
                    const slots = [];
                    const [openH, openM] = dayConfig.open.split(':').map(Number);
                    const [closeH, closeM] = dayConfig.close.split(':').map(Number);
                    
                    let currentH = openH;
                    let currentM = openM;
                    
                    while (currentH < closeH || (currentH === closeH && currentM <= closeM)) {
                      const timeStr = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;
                      slots.push(<option key={timeStr} value={timeStr}>{timeStr}</option>);
                      currentM += 30;
                      if (currentM >= 60) {
                        currentM -= 60;
                        currentH += 1;
                      }
                    }
                    return slots;
                  })()}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">Modalidad o Estudio (Opcional)</label>
                <input 
                  type="text"
                  value={modality}
                  onChange={e => setModality(e.target.value)}
                  placeholder="Ej. Resonancia Magnética"
                  className="border border-slate-300 p-2 text-sm outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">Notas para la Clínica (Opcional)</label>
                <textarea 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="border border-slate-300 p-2 text-sm outline-none resize-none"
                ></textarea>
              </div>

              <button type="submit" className="enterprise-btn mt-4 py-3">Solicitar Cita</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



// ----------------------------------------------------------------------
// DOCTORS VIEW
// ----------------------------------------------------------------------
function DoctorsView({ doctors, fetchDoctors }: { doctors: any[], fetchDoctors: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'trusted'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const toggleAccess = async (doctorId: string, currentAccess: boolean) => {
    setUpdatingId(doctorId);
    try {
      await api.post('/auth/patient/doctors/', {
        action: currentAccess ? 'revoke' : 'grant',
        doctor_id: doctorId
      });
      await fetchDoctors();
    } catch (e) {
      console.error('Error toggling doctor access:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredDoctors = doctors.filter(doc => {
    const matchesSearch = (doc.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (doc.specialty || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (doc.hospital || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (filterTab === 'trusted') {
      return matchesSearch && doc.trusted;
    }
    return matchesSearch;
  });

  const trustedCount = doctors.filter(d => d.trusted).length;

  return (
    <div className="pb-12 w-full animate-slide-up">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Mis Doctores de Confianza</h2>
          <p className="text-slate-500 mt-1 text-sm">
            Gestione qué médicos especialistas tienen acceso a su expediente clínico y visualizador DICOM en la red AROS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${filterTab === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Todos ({doctors.length})
          </button>
          <button 
            onClick={() => setFilterTab('trusted')}
            className={`px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${filterTab === 'trusted' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Con Acceso ({trustedCount})
          </button>
        </div>
      </div>

      <div className="enterprise-card p-6 mb-8 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white border border-slate-200 shadow-sm">
        <div className="flex-1 w-full relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400">search</span>
          <input 
            type="text" 
            placeholder="Buscar por nombre, especialidad o red hospitalaria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDoctors.map(doctor => (
          <div key={doctor.id} className="enterprise-card p-0 flex flex-col bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition-all overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center border-b border-slate-100 relative bg-slate-50/50 flex-1">
              {doctor.trusted && (
                <span className="absolute top-4 right-4 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">verified</span>
                  Acceso Activo
                </span>
              )}
              <div className="w-16 h-16 bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xl border border-slate-200 mb-3 shadow-inner">
                {doctor.avatar}
              </div>
              <h3 className="text-lg font-bold text-slate-900">{doctor.name}</h3>
              <p className="text-sm font-semibold text-accent mt-0.5">{doctor.specialty}</p>
              <p className="text-xs text-slate-500 mt-1">{doctor.hospital}</p>
              {doctor.cedula && (
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">Cédula: {doctor.cedula}</p>
              )}
            </div>
            
            <div className="p-4 bg-white flex gap-3 mt-auto">
              {doctor.trusted ? (
                <button 
                  disabled={updatingId === doctor.id}
                  onClick={() => toggleAccess(doctor.id, doctor.trusted)} 
                  className="flex-1 border border-slate-300 bg-white text-rose-600 font-bold py-2 text-xs hover:bg-rose-50 hover:border-rose-300 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {updatingId === doctor.id ? 'Actualizando...' : 'Revocar Acceso'}
                </button>
              ) : (
                <button 
                  disabled={updatingId === doctor.id}
                  onClick={() => toggleAccess(doctor.id, doctor.trusted)} 
                  className="flex-1 enterprise-btn text-xs py-2 font-bold cursor-pointer disabled:opacity-50"
                >
                  {updatingId === doctor.id ? 'Actualizando...' : 'Dar Acceso'}
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredDoctors.length === 0 && (
          <div className="col-span-full p-12 text-center flex flex-col items-center justify-center enterprise-card bg-white border border-slate-200">
            <span className="material-symbols-outlined text-4xl text-slate-400 mb-3">search_off</span>
            <h3 className="text-lg font-semibold text-slate-900">No se encontraron doctores</h3>
            <p className="text-sm text-slate-500">Prueba con otro término de búsqueda o cambia la pestaña de filtro.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// STUDY DETAIL VIEW (Patient Friendly)
// ----------------------------------------------------------------------
function StudyDetailView({ study, setView }: { study: any, setView: (v: ViewState) => void }) {
  const [isDownloading, setIsDownloading] = useState(false);
  
  if (!study) {
    return (
      <div className="flex flex-col items-center justify-center h-full pt-20">
        <p className="text-slate-500 mb-4">No se ha seleccionado ningún estudio.</p>
        <button onClick={() => setView('studies')} className="enterprise-btn-secondary">Volver a mis estudios</button>
      </div>
    );
  }

  const studyUid = study.study_uid || study.study_instance_uid || study.uid || '';
  const report = study.report;
  const hasReport = !!report;

  const handleDownloadReport = async () => {
    try {
      setIsDownloading(true);
      const res = await api.get(`/gateway/studies/${studyUid}/report/pdf/`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error fetching PDF', err);
      alert('Hubo un error al descargar el reporte PDF.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="pb-12 animate-slide-up w-full">
      <button onClick={() => setView('studies')} className="flex items-center gap-2 text-slate-500 hover:text-accent mb-6 font-semibold transition-colors cursor-pointer">
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        Volver a mis estudios
      </button>

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
            <span className="material-symbols-outlined text-sm">domain</span> Red AROS ({study._source_clinic || study.clinic_slug || 'demo-clinic'})
          </p>
        </div>
        
        <div className="shrink-0">
          {hasReport ? (
            <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 text-emerald-800 font-bold text-xs flex items-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-base">verified</span> Dictamen Radiológico Disponible
            </div>
          ) : (
            <div className="bg-slate-100 border border-slate-200 px-4 py-2 text-slate-600 font-bold text-xs flex items-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-base">hourglass_empty</span> Interpretación Pendiente
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full">
      {!hasReport ? (
        <div className="flex flex-col gap-6">
          <div className="enterprise-card p-10 flex flex-col items-center text-center bg-white border border-slate-200 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 flex items-center justify-center text-slate-400 mb-4 border border-slate-100">
              <span className="material-symbols-outlined text-3xl">medical_information</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Imágenes Procesadas y Seguras</h3>
            <p className="text-slate-500 max-w-lg mb-6 text-sm">
              Las imágenes de su estudio han sido transferidas al PACS de forma segura. El médico radiólogo se encuentra elaborando el dictamen final. Puede abrir el visor DICOM para ver sus imágenes directamente.
            </p>
            <button 
              onClick={() => setView('ohif')}
              className="enterprise-btn flex items-center gap-2 px-6 py-2.5 font-bold text-sm shadow-sm cursor-pointer"
            >
              <span>Abrir Imágenes en Visor OHIF</span>
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="enterprise-card p-0 bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-accent">description</span>
                Reporte Radiológico
              </h3>
              <button 
                onClick={handleDownloadReport}
                disabled={isDownloading}
                className="enterprise-btn py-1.5 px-4 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDownloading ? (
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-sm">print</span>
                )}
                {isDownloading ? 'Generando...' : 'Imprimir / PDF'}
              </button>
            </div>
            
            <div className="p-8">
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Indicación Clínica</h4>
                <p className="text-slate-700 text-sm leading-relaxed">
                  Estudio diagnóstico solicitado para control y valoración médica.
                </p>
              </div>
              
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Hallazgos</h4>
                <div 
                  className="text-slate-800 text-sm leading-relaxed bg-slate-50 p-4 border border-slate-200 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: report.findings }}
                />
              </div>
              
              <div className="p-4 bg-emerald-50/70 border-l-4 border-emerald-600 mb-8">
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2">Conclusión Diagnóstica</h4>
                <div 
                  className="text-emerald-950 font-semibold text-sm leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: report.conclusions }}
                />
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm border border-slate-200">
                    RM
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Firma Digital</span>
                    <p className="font-bold text-slate-900 text-sm">{report.radiologist || 'Médico Asignado'}</p>
                    <p className="text-xs text-slate-500 font-mono">Cédula Profesional: {report.cedula || 'N/D'}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-mono">Fecha de Emisión: {report.date || study.study_date}</span>
              </div>
            </div>
          </div>

          <div className="enterprise-card p-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white border border-slate-200 shadow-sm">
            <div>
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-accent">view_in_ar</span>
                Imágenes Médicas DICOM
              </h4>
              <p className="text-sm text-slate-500 mt-1">Acceda al visor OHIF de grado radiológico para inspeccionar cortes, aplicar filtros y mediciones.</p>
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
      )}
      </div>
    </div>
  );
}
