import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { api } from './api';
import DictationScreen from './components/DictationScreen';
import ImageCropper from './components/ImageCropper';
import LocationPicker from './components/LocationPicker';
import ScheduleBuilder from './components/ScheduleBuilder';
import ReportLayoutBuilder from './components/ReportLayoutBuilder';

type ViewState = 'login' | 'dashboard';

export default function App() {
  const [view, setView] = useState<ViewState>('login');
  const [activeTab, setActiveTab] = useState<string>('main');
  const [token, setToken] = useState<string | null>(localStorage.getItem('clinic_token'));
  const [currentUser, setCurrentUser] = useState<any>(
    localStorage.getItem('clinic_user') ? JSON.parse(localStorage.getItem('clinic_user')!) : null
  );
  
  const [clinicConfig, setClinicConfig] = useState({
    name: 'Centro AROS Principal',
    primaryColor: '#0284c7',
    hoverColor: '#0369a1',
    logoText: 'CAP',
    address: 'Av. Insurgentes Sur 123, Roma Norte, Cuauhtémoc, CDMX',
    phone: '+52 55 5584 9200',
    email: 'contacto@aros-salud.mx',
    rating: 4.9,
    latitude: 19.4184,
    longitude: -99.1643,
    specialties: [
      'Radiología Digital (Rayos X)',
      'Tomografía Computarizada (TAC)',
      'Resonancia Magnética (RMN)',
      'Ultrasonido Diagnóstico y Doppler 4D',
      'Mastografía Digital',
      'Densitometría Ósea'
    ],
    openingHours: 'Lun - Vie: 07:00 - 20:00 | Sáb: 08:00 - 15:00 | Dom: Cerrado',
    reportLayout: undefined as any
  });

  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  useEffect(() => {
    // Fetch real clinic config
    api.get('/auth/clinic-config/')
      .then(res => {
        if (res.data) {
          setClinicConfig(prev => ({
            ...prev,
            name: res.data.name || prev.name,
            primaryColor: res.data.primary_color || prev.primaryColor,
            logoText: (res.data.name || prev.name).charAt(0),
            address: res.data.address || prev.address,
            phone: res.data.phone || prev.phone,
            email: res.data.email || prev.email,
            rating: res.data.rating !== undefined ? res.data.rating : prev.rating,
            latitude: res.data.latitude !== undefined && res.data.latitude !== null ? res.data.latitude : prev.latitude,
            longitude: res.data.longitude !== undefined && res.data.longitude !== null ? res.data.longitude : prev.longitude,
            specialties: res.data.specialties || prev.specialties,
            openingHours: res.data.opening_hours || prev.openingHours,
            reportLayout: res.data.report_layout || prev.reportLayout
          }));
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    // If logged in, fetch fresh profile data
    if (token) {
      api.get('/auth/me/')
        .then(res => {
          if (res.data) {
            setCurrentUser(res.data);
            localStorage.setItem('clinic_user', JSON.stringify(res.data));
          }
        })
        .catch(console.error);
    }
  }, [token]);
  
  useEffect(() => {
    document.documentElement.style.setProperty('--clinic-primary', clinicConfig.primaryColor);
    document.documentElement.style.setProperty('--clinic-hover', clinicConfig.hoverColor || clinicConfig.primaryColor);
    
    if (token && view === 'login') setView('dashboard');
  }, [token, view, clinicConfig]);

  if (view === 'login') {
    return <LoginView setToken={setToken} setView={setView} setCurrentUser={setCurrentUser} setActiveTab={setActiveTab} clinicConfig={clinicConfig} />;
  }

  const role = currentUser?.role || 'Radiólogo';

  // Define sidebar navigation based on role
  let navItems: {id: string, icon: string, label: string}[] = [];
  if (role === 'Radiólogo') {
    navItems = [
      { id: 'main', icon: 'list_alt', label: 'Worklist' },
      { id: 'reports', icon: 'description', label: 'Mis Reportes' }
    ];
  } else if (role === 'Asistente Médico') {
    navItems = [
      { id: 'main', icon: 'desk', label: 'Recepción' },
      { id: 'patients', icon: 'group', label: 'Pacientes' }
    ];
  } else if (role === 'Administrador' || role === 'Superadministrador') {
    navItems = [
      { id: 'main', icon: 'bar_chart', label: 'Métricas' },
      { id: 'staff', icon: 'badge', label: 'Personal Médico' }
    ];
    if (role === 'Superadministrador') {
      navItems.push({ id: 'config', icon: 'settings', label: 'Configuración Clínica' });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans">
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
              setCurrentUser((prev: any) => prev ? { ...prev, avatar_url: response.data.avatar_url } : null);
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
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col md:fixed md:h-full z-50">
        <div className="p-6 text-white flex flex-col justify-center bg-[var(--color-clinic-accent)]">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white flex items-center justify-center text-[var(--color-clinic-accent)] font-bold text-xl shadow-sm">
              {clinicConfig.logoText}
            </div>
            <span className="text-xs font-bold tracking-widest uppercase opacity-90">CLINIC PORTAL</span>
          </div>
          <h1 className="text-xl m-0 font-extrabold tracking-tight leading-tight text-white line-clamp-2">
            {clinicConfig.name}
          </h1>
          <p className="text-[11px] text-white/80 mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">location_on</span>
            <span className="truncate">{clinicConfig.address.split(',')[0]}</span>
          </p>
        </div>
        
        <nav className="flex-1 flex flex-col pt-4 gap-1.5 border-t border-slate-100 overflow-y-auto">
          {navItems.map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)} 
              className={`flex items-center gap-3 px-5 py-3 font-medium transition-all duration-200 text-left border-r-4 ${activeTab === item.id ? 'bg-slate-50 text-clinic-accent font-semibold border-[var(--color-clinic-accent)]' : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-200'}`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 bg-white flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 p-2 text-left mb-1 transition-colors border ${activeTab === 'profile' ? 'bg-slate-50 border-[var(--color-clinic-accent)]' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
            title="Ver mi perfil"
          >
            <div className="w-10 h-10 bg-slate-100 flex items-center justify-center text-[var(--color-clinic-accent)] font-bold text-sm border border-slate-200 shrink-0 shadow-sm overflow-hidden">
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url.startsWith('http') ? currentUser.avatar_url : `http://localhost:8000${currentUser.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <>{currentUser?.initials || 'U'}</>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 truncate">{currentUser?.name || currentUser?.first_name || 'Usuario'}</p>
              <p className="text-xs text-slate-500 truncate">Ver mi perfil</p>
            </div>
          </button>

          <button 
            onClick={() => { 
              setToken(null); 
              setCurrentUser(null);
              localStorage.removeItem('clinic_token'); 
              localStorage.removeItem('clinic_user');
              setView('login'); 
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all text-xs shadow-sm"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Cerrar sesión
          </button>
          
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Powered by</span>
            <img src="/ISO-HOR-RED.png" alt="AROS Logo" className="h-4" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-72 bg-slate-50 relative flex flex-col h-screen overflow-y-auto">
        <div key={activeTab} className="p-6 md:p-10 w-full animate-slide-up">
          {activeTab === 'profile' ? (
            <StaffProfileView 
              currentUser={currentUser} 
              setCurrentUser={setCurrentUser} 
              setImageToCrop={setImageToCrop} 
            />
          ) : (
            <>
              {role === 'Radiólogo' && <RadiologistView activeTab={activeTab} />}
              {role === 'Asistente Médico' && <AssistantView activeTab={activeTab} />}
              {(role === 'Administrador' || role === 'Superadministrador') && (
                <AdminView 
                  activeTab={activeTab} 
                  currentUser={currentUser} 
                  clinicConfig={clinicConfig} 
                  setClinicConfig={setClinicConfig} 
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------
// LOGIN VIEW
// ----------------------------------------------------------------------
function LoginView({ setToken, setView, setCurrentUser, setActiveTab, clinicConfig }: { setToken: (t: string) => void, setView: (v: ViewState) => void, setCurrentUser: (u: any) => void, setActiveTab: (t: string) => void, clinicConfig: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login/', { email_hash: email, password });
      
      if (res.data.access) {
        localStorage.setItem('clinic_token', res.data.access);
        setToken(res.data.access);
        
        const profileRes = await api.get('/auth/me/', {
          headers: { Authorization: `Bearer ${res.data.access}` }
        });
        
        const realUser = profileRes.data;
        localStorage.setItem('clinic_user', JSON.stringify(realUser));
        setCurrentUser(realUser);
        
        setActiveTab('main');
        setView('dashboard');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-[var(--color-clinic-accent)] text-white flex items-center justify-center font-bold text-3xl shadow-sm mb-3">
            {clinicConfig.logoText}
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight text-center">{clinicConfig.name}</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Portal de Acceso Clínico PACS</p>
        </div>

        <div className="enterprise-card p-8 bg-white border border-slate-200 shadow-xl">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Correo Electrónico</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="border border-slate-200 p-3 bg-slate-50 text-slate-900 focus:bg-white focus:border-[var(--color-clinic-accent)] transition-colors outline-none text-sm"
                placeholder="doctor@clinica.com"
                required 
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contraseña</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="border border-slate-200 p-3 bg-slate-50 text-slate-900 focus:bg-white focus:border-[var(--color-clinic-accent)] transition-colors outline-none w-full pr-10 text-sm"
                  placeholder="••••••••"
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
            
            <button 
              type="submit" 
              disabled={loading}
              className="enterprise-btn mt-2 py-3 text-sm font-bold w-full flex justify-center items-center gap-2 shadow-sm hover:shadow"
            >
              {loading && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
              Ingresar al Sistema
            </button>
          </form>

          {/* Quick Login Role Selector */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2 text-center">
              Acceso rápido por rol (Contraseña: <code className="bg-slate-100 px-1 py-0.5 font-mono text-slate-800">password123</code>):
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button 
                type="button" 
                onClick={() => quickFill('superadmin@clinica.com')}
                className="text-left px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors flex flex-col"
              >
                <span className="text-xs font-bold text-slate-900">👑 Superadmin</span>
                <span className="text-[10px] text-slate-500 font-mono truncate">superadmin@clinica.com</span>
              </button>

              <button 
                type="button" 
                onClick={() => quickFill('radiologo@clinica.com')}
                className="text-left px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors flex flex-col"
              >
                <span className="text-xs font-bold text-slate-900">🩺 Radiólogo</span>
                <span className="text-[10px] text-slate-500 font-mono truncate">radiologo@clinica.com</span>
              </button>

              <button 
                type="button" 
                onClick={() => quickFill('asistente@clinica.com')}
                className="text-left px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors flex flex-col"
              >
                <span className="text-xs font-bold text-slate-900">📋 Asistente</span>
                <span className="text-[10px] text-slate-500 font-mono truncate">asistente@clinica.com</span>
              </button>

              <button 
                type="button" 
                onClick={() => quickFill('admin@clinica.com')}
                className="text-left px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors flex flex-col"
              >
                <span className="text-xs font-bold text-slate-900">⚙️ Administrador</span>
                <span className="text-[10px] text-slate-500 font-mono truncate">admin@clinica.com</span>
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex items-center justify-center gap-2 animate-slide-up opacity-90">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Powered by</span>
          <img src="/ISO-HOR-RED.png" alt="AROS Logo" className="h-5" />
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// STAFF PROFILE VIEW (FOR ALL CLINIC INTEGRANTS)
// ----------------------------------------------------------------------
function StaffProfileView({ currentUser, setCurrentUser, setImageToCrop }: { currentUser: any, setCurrentUser: (u: any) => void, setImageToCrop: (s: string | null) => void }) {
  const [formData, setFormData] = useState({
    first_name: currentUser?.first_name || '',
    last_name: currentUser?.last_name || '',
    phone: currentUser?.phone || '',
    cedula_profesional: currentUser?.cedula_profesional || '',
    specialty: currentUser?.specialty || 'Radiología General',
    bio: currentUser?.bio || '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        phone: currentUser.phone || '',
        cedula_profesional: currentUser.cedula_profesional || '',
        specialty: currentUser.specialty || 'Radiología General',
        bio: currentUser.bio || ''
      }));
    }
  }, [currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (formData.new_password && formData.new_password !== formData.confirm_password) {
      setStatusMsg({ type: 'error', text: 'Las nuevas contraseñas no coinciden.' });
      return;
    }
    if (formData.phone && !isValidPhoneNumber(formData.phone)) {
      setStatusMsg({ type: 'error', text: 'El número de teléfono no es válido o tiene una longitud incorrecta.' });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        cedula_profesional: formData.cedula_profesional,
        specialty: formData.specialty,
        bio: formData.bio
      };

      if (formData.new_password) {
        payload.current_password = formData.current_password;
        payload.new_password = formData.new_password;
      }

      const res = await api.put('/auth/me/', payload);
      setCurrentUser(res.data);
      localStorage.setItem('clinic_user', JSON.stringify(res.data));
      
      setFormData(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }));

      setStatusMsg({ type: 'success', text: 'Perfil y credenciales actualizados exitosamente.' });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ 
        type: 'error', 
        text: err.response?.data?.error || err.response?.data?.detail || 'Error al actualizar el perfil.' 
      });
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
    <div className="w-full">
      {/* Header Banner */}
      <div className="enterprise-card p-8 mb-8 bg-white border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
          <div className="flex items-center gap-5">
            <div className="relative w-20 h-20 bg-[var(--color-clinic-accent)] text-white font-bold text-2xl flex items-center justify-center shadow-md group cursor-pointer overflow-hidden border-2 border-white">
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url.startsWith('http') ? currentUser.avatar_url : `http://localhost:8000${currentUser.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <>{currentUser?.initials || 'U'}</>
              )}
              <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                <span className="material-symbols-outlined text-white text-xl">photo_camera</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarSelect} />
              </label>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 bg-slate-900 text-white tracking-wider">
                  {currentUser?.role || 'Personal Médico'}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Activo
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">
                {currentUser?.name || `${formData.first_name} ${formData.last_name}` || 'Mi Perfil'}
              </h2>
              <p className="text-sm text-slate-500 font-medium">{currentUser?.email}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-right text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Identificador de Usuario:</span>
            <code className="bg-slate-100 px-2 py-1 border border-slate-200 font-mono text-[11px] text-slate-600">
              {currentUser?.id || 'ID-AROS'}
            </code>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 mb-6 text-sm font-semibold flex items-center gap-2 border ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          <span className="material-symbols-outlined text-lg">
            {statusMsg.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {statusMsg.text}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSaveProfile} className="flex flex-col gap-8">
        {/* Section 1: Personal Data */}
        <div className="enterprise-card p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-200">
            <span className="material-symbols-outlined text-[var(--color-clinic-accent)]">person</span>
            <h3 className="text-lg font-bold text-slate-900">Información Personal y Contacto</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="flex flex-col gap-2">
              <div className="h-5 flex items-center">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre(s)</label>
              </div>
              <input 
                type="text" 
                value={formData.first_name} 
                onChange={e => setFormData({...formData, first_name: e.target.value})}
                placeholder="Nombre(s)" 
                className="h-11 border border-slate-200 px-3 bg-slate-50 text-slate-900 focus:bg-white focus:border-[var(--color-clinic-accent)] outline-none transition-colors text-sm w-full"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-5 flex items-center">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Apellidos</label>
              </div>
              <input 
                type="text" 
                value={formData.last_name} 
                onChange={e => setFormData({...formData, last_name: e.target.value})}
                placeholder="Apellidos" 
                className="h-11 border border-slate-200 px-3 bg-slate-50 text-slate-900 focus:bg-white focus:border-[var(--color-clinic-accent)] outline-none transition-colors text-sm w-full"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-5 flex items-center">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Teléfono de Contacto</label>
              </div>
              <div className="h-11 border border-slate-200 px-3 bg-slate-50 text-slate-900 focus-within:bg-white focus-within:border-[var(--color-clinic-accent)] outline-none transition-colors text-sm w-full">
                  <PhoneInput
                    international
                    countryCallingCodeEditable={false}
                    defaultCountry="MX"
                    limitMaxLength={true}
                    smartCaret={false}
                    value={formData.phone}
                  onChange={(val) => setFormData({...formData, phone: val || ''})}
                  className="PhoneInput-custom w-full h-full outline-none bg-transparent"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-5 flex items-center">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Correo Electrónico (Identificador)</label>
              </div>
              <input 
                type="email" 
                disabled 
                value={currentUser?.email || ''} 
                className="h-11 border border-slate-200 px-3 bg-slate-100 text-slate-500 cursor-not-allowed outline-none text-sm w-full"
              />
              <span className="text-[11px] text-slate-400">El correo está cifrado y verificado por el Core AROS.</span>
            </div>
          </div>
        </div>

        {/* Section 2: Medical & Professional Credentials */}
        <div className="enterprise-card p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-200">
            <span className="material-symbols-outlined text-[var(--color-clinic-accent)]">verified_user</span>
            <h3 className="text-lg font-bold text-slate-900">Credenciales Profesionales y Especialidad</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 items-start">
            <div className="flex flex-col gap-2">
              <div className="h-5 flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cédula Profesional Médica</label>
                {formData.cedula_profesional && (
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5 leading-none">
                    <span className="material-symbols-outlined text-xs leading-none">check</span> Verificada
                  </span>
                )}
              </div>
              <input 
                type="text" 
                value={formData.cedula_profesional} 
                onChange={e => setFormData({...formData, cedula_profesional: e.target.value})}
                placeholder="Ej. CED-MED-8492019" 
                className="h-11 border border-slate-200 px-3 bg-slate-50 text-slate-900 focus:bg-white focus:border-[var(--color-clinic-accent)] outline-none font-mono uppercase text-sm w-full"
              />
              <span className="text-[11px] text-slate-500">Requerida para la firma digital y membretado de reportes (RF011/RF012).</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-5 flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Especialidad / Área de Enfoque</label>
              </div>
              <input 
                type="text" 
                value={formData.specialty} 
                onChange={e => setFormData({...formData, specialty: e.target.value})}
                placeholder="Ej. Neurorradiología, Radiología Intervencionista, etc." 
                className="h-11 border border-slate-200 px-3 bg-slate-50 text-slate-900 focus:bg-white focus:border-[var(--color-clinic-accent)] outline-none text-sm w-full"
              />
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {['Neurorradiología', 'Imagenología Mamaria', 'Tórax y Abdomen', 'Musculoesquelético', 'Radiología General'].map(spec => (
                  <button 
                    key={spec} 
                    type="button" 
                    onClick={() => setFormData({...formData, specialty: spec})}
                    className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                  >
                    {spec}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="h-5 flex items-center">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Biografía / Resumen de Experiencia Clínica</label>
            </div>
            <textarea 
              rows={3}
              value={formData.bio} 
              onChange={e => setFormData({...formData, bio: e.target.value})}
              placeholder="Describe tu trayectoria, certificaciones y experiencia médica..." 
              className="border border-slate-200 p-3 bg-slate-50 text-slate-900 focus:bg-white focus:border-[var(--color-clinic-accent)] outline-none transition-colors text-sm w-full"
            />
          </div>
        </div>

        {/* Section 3: Password Update (Optional) */}
        <div className="enterprise-card p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-200">
            <span className="material-symbols-outlined text-[var(--color-clinic-accent)]">lock</span>
            <h3 className="text-lg font-bold text-slate-900">Seguridad y Cambio de Contraseña</h3>
          </div>

          <p className="text-xs text-slate-500 mb-6">Si deseas cambiar tu contraseña, ingresa tu contraseña actual y define la nueva contraseña.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="flex flex-col gap-2">
              <div className="h-5 flex items-center">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contraseña Actual</label>
              </div>
              <input 
                type="password" 
                value={formData.current_password} 
                onChange={e => setFormData({...formData, current_password: e.target.value})}
                placeholder="••••••••" 
                className="h-11 border border-slate-200 px-3 bg-slate-50 text-slate-900 focus:bg-white focus:border-[var(--color-clinic-accent)] outline-none text-sm w-full"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-5 flex items-center">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nueva Contraseña</label>
              </div>
              <input 
                type="password" 
                value={formData.new_password} 
                onChange={e => setFormData({...formData, new_password: e.target.value})}
                placeholder="••••••••" 
                className="h-11 border border-slate-200 px-3 bg-slate-50 text-slate-900 focus:bg-white focus:border-[var(--color-clinic-accent)] outline-none text-sm w-full"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-5 flex items-center">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Confirmar Contraseña</label>
              </div>
              <input 
                type="password" 
                value={formData.confirm_password} 
                onChange={e => setFormData({...formData, confirm_password: e.target.value})}
                placeholder="••••••••" 
                className="h-11 border border-slate-200 px-3 bg-slate-50 text-slate-900 focus:bg-white focus:border-[var(--color-clinic-accent)] outline-none text-sm w-full"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <button 
            type="submit" 
            disabled={saving || (formData.phone ? !isValidPhoneNumber(formData.phone) : false)}
            className={`enterprise-btn px-8 py-3 text-base flex items-center gap-2 shadow-sm hover:shadow ${formData.phone && !isValidPhoneNumber(formData.phone) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                Guardando Cambios...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">save</span>
                Guardar Mi Perfil
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ----------------------------------------------------------------------
// RADIOLOGIST ROLE
// ----------------------------------------------------------------------
function RadiologistView({ activeTab }: { activeTab: string }) {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchStudies = (isSilent = false) => {
    if (!isSilent) setLoading(true);
    api.get('/clinical_data/studies/')
      .then(res => {
        const fetchedStudies = res.data.studies || [];
        const mappedStudies = fetchedStudies.map((s: any, idx: number) => ({
          id: idx,
          name: s.patient_name || 'Desconocido',
          dob: s.patient_dob || 'N/A',
          date: s.study_date || 'N/A',
          study_uid: s.study_instance_uid,
          modality: s.modality || 'OT',
          status: 'Pendiente'
        }));
        setPatients(mappedStudies);
        if (!isSilent) setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching studies:", err);
        if (!isSilent) setLoading(false);
      });
  };

  useEffect(() => {
    fetchStudies();
    const interval = setInterval(() => fetchStudies(true), 60000); // 60 seconds silent poll
    return () => clearInterval(interval);
  }, []);
  
  const [dictatingStudyUid, setDictatingStudyUid] = useState<string | null>(null);

  if (dictatingStudyUid) {
    return <DictationScreen studyUid={dictatingStudyUid} onBack={() => setDictatingStudyUid(null)} />;
  }

  if (activeTab === 'reports') {
    return (
      <div className="w-full">
        <h2 className="text-2xl font-bold text-slate-900 mb-8">Mis Reportes</h2>
        <div className="p-12 text-center flex flex-col items-center justify-center bg-white border border-slate-200">
          <span className="material-symbols-outlined text-4xl text-slate-400 mb-3">history</span>
          <h3 className="text-lg font-semibold text-slate-900">Sin reportes recientes</h3>
          <p className="text-sm text-slate-500">Los estudios dictaminados aparecerán aquí.</p>
        </div>
      </div>
    );
  }

  // Worklist (Main)
  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Worklist</h2>
          <p className="text-slate-500 mt-1">Estudios asignados pendientes de dictamen</p>
        </div>
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input 
              type="text" 
              placeholder="Buscar estudio..." 
              className="w-full border border-slate-200 pl-10 pr-3 py-2 bg-white text-slate-900 focus:border-[var(--color-clinic-accent)] outline-none transition-colors" 
            />
          </div>
        </div>
      </div>
      
      <div className="enterprise-card p-0 overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 font-bold text-slate-700 uppercase text-xs tracking-wider">Estado</th>
              <th className="px-6 py-4 font-bold text-slate-700 uppercase text-xs tracking-wider">Paciente</th>
              <th className="px-6 py-4 font-bold text-slate-700 uppercase text-xs tracking-wider">Modalidad</th>
              <th className="px-6 py-4 font-bold text-slate-700 uppercase text-xs tracking-wider">Fecha Estudio</th>
              <th className="px-6 py-4 font-bold text-slate-700 uppercase text-xs tracking-wider text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {patients.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-bold border ${p.status === 'Pendiente' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-6 py-4 font-bold text-slate-900">{p.name}</td>
                <td className="px-6 py-4">
                  <span className="bg-slate-100 text-slate-700 px-2.5 py-1 text-xs font-bold border border-slate-200">
                    {p.modality}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{p.date}</td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => setDictatingStudyUid(p.study_uid)}
                    className="enterprise-btn py-1.5 px-4 text-sm inline-flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">edit_document</span>
                    Dictaminar
                  </button>
                </td>
              </tr>
            ))}
            {patients.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">No hay estudios pendientes en la worklist.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// ASSISTANT ROLE
// ----------------------------------------------------------------------
function AssistantView({ activeTab }: { activeTab: string }) {
  const [patients, setPatients] = useState<any[]>([]);
  const [studyRequests, setStudyRequests] = useState<any[]>([]);

  const fetchData = () => {
    api.get('/auth/patients/')
      .then(res => setPatients(res.data.patients || []))
      .catch(console.error);
    api.get('/clinical_data/study-requests/')
      .then(res => setStudyRequests(res.data.requests || []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 60 seconds background poll
    return () => clearInterval(interval);
  }, []);

  if (activeTab === 'patients') {
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Directorio de Pacientes</h2>
          <button onClick={fetchData} className="enterprise-btn-secondary py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <span className="material-symbols-outlined text-sm">sync</span>
            Actualizar
          </button>
        </div>
        <div className="enterprise-card p-0">
          <ul className="divide-y divide-slate-100">
            {patients.length === 0 ? (
              <div className="p-12 text-center text-slate-500">No hay pacientes registrados en el sistema.</div>
            ) : (
              patients.map((p, idx) => (
                <li key={idx} className="p-6 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <p className="font-bold text-slate-900">{p.first_name} {p.last_name}</p>
                    <p className="text-sm text-slate-500">CURP / MRN: {p.curp_or_mrn || 'N/A'} • Nacimiento: {p.dob || 'N/A'}</p>
                  </div>
                  <button className="enterprise-btn-secondary px-4 py-1.5 text-sm">Ver Historial</button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    );
  }

  // Recepción (Main)
  const pendingRequests = studyRequests.filter((r: any) => r.status === 'Scheduled');
  
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Panel de Recepción</h2>
        <button onClick={fetchData} className="enterprise-btn-secondary py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
          <span className="material-symbols-outlined text-sm">sync</span>
          Actualizar
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="enterprise-card p-6 flex flex-col justify-between border-l-4 border-l-orange-500">
          <h3 className="text-sm font-bold text-slate-500 uppercase">Pacientes en Espera / Agendados</h3>
          <p className="text-4xl font-extrabold text-slate-900 mt-2">{pendingRequests.length}</p>
        </div>
        <div className="enterprise-card p-6 flex flex-col justify-between border-l-4 border-l-green-500">
          <h3 className="text-sm font-bold text-slate-500 uppercase">Estudios Procesados Hoy</h3>
          <p className="text-4xl font-extrabold text-slate-900 mt-2">14</p>
        </div>
      </div>

      <div className="enterprise-card p-0">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-900">Agenda del Día</h3>
          <button className="text-sm font-bold text-clinic-accent uppercase hover:underline">Ver Todo</button>
        </div>
        <div className="p-6">
          <ul className="divide-y divide-slate-100">
            {studyRequests.length === 0 ? (
              <div className="text-center text-slate-500 py-4">No hay citas agendadas para hoy.</div>
            ) : (
              studyRequests.map((req, idx) => (
                <li key={idx} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900">{req.patient_name || 'Paciente'}</p>
                    <p className="text-xs text-slate-500">{req.study_description} - {req.scheduled_time || 'Sin hora'}</p>
                  </div>
                  <button className="enterprise-btn px-4 py-1.5 text-sm">Marcar Llegada</button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// ADMINISTRATOR & SUPERADMINISTRATOR ROLE
// ----------------------------------------------------------------------
function AdminView({ activeTab, currentUser, clinicConfig, setClinicConfig }: { activeTab: string, currentUser: any, clinicConfig: any, setClinicConfig: any }) {
  const [isPreviewingReport, setIsPreviewingReport] = useState(false);

  const handlePreviewReport = async () => {
    try {
      setIsPreviewingReport(true);
      const res = await api.post('/gateway/clinic-config/report-preview/', {
        report_layout: clinicConfig.reportLayout
      }, {
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error fetching preview PDF', err);
      alert('Hubo un error al generar la previsualización del PDF.');
    } finally {
      setIsPreviewingReport(false);
    }
  };
  const [staff, setStaff] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [newStaff, setNewStaff] = useState({ 
    email: '', 
    password: '', 
    role: 'Radiólogo',
    first_name: '',
    last_name: '',
    cedula_profesional: '',
    specialty: 'Radiología General',
    phone: ''
  });

  const [newSpecialtyInput, setNewSpecialtyInput] = useState('');

  const fetchStaff = () => {
    api.get('/auth/users/')
      .then(res => setStaff(res.data.users || []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newStaff.phone && !isValidPhoneNumber(newStaff.phone)) {
      alert('El número de teléfono no es válido o tiene una longitud incorrecta.');
      return;
    }
    try {
      if (editUserId) {
        const updatePayload = { 
          email: newStaff.email, 
          role: newStaff.role, 
          first_name: newStaff.first_name,
          last_name: newStaff.last_name,
          cedula_profesional: newStaff.cedula_profesional,
          specialty: newStaff.specialty,
          phone: newStaff.phone,
          ...(newStaff.password ? { password: newStaff.password } : {}) 
        };
        await api.put(`/auth/users/${editUserId}/`, updatePayload);
        alert('Personal actualizado exitosamente');
      } else {
        await api.post('/auth/users/', newStaff);
        alert('Personal agregado exitosamente');
      }
      setShowModal(false);
      setEditUserId(null);
      setNewStaff({ 
        email: '', password: '', role: 'Radiólogo', first_name: '', last_name: '', cedula_profesional: '', specialty: 'Radiología General', phone: '' 
      });
      fetchStaff();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Error al guardar personal');
    }
  };

  const handleEditStaff = (user: any) => {
    setEditUserId(user.id);
    setNewStaff({ 
      email: user.email, 
      password: '', 
      role: user.role,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      cedula_profesional: user.cedula_profesional || '',
      specialty: user.specialty || 'Radiología General',
      phone: user.phone || ''
    });
    setShowModal(true);
  };

  const handleDeleteStaff = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este usuario?')) {
      try {
        await api.delete(`/auth/users/${id}/`);
        fetchStaff();
      } catch (err) {
        console.error(err);
        alert('Error al eliminar');
      }
    }
  };

  // -------------------------------------------------------------
  // TAB: Personal Médico
  // -------------------------------------------------------------
  if (activeTab === 'staff') {
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Personal de la Clínica</h2>
            <p className="text-slate-500 mt-1">Directorio médico, cédulas profesionales y gestión de accesos</p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchStaff} className="enterprise-btn-secondary py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
              <span className="material-symbols-outlined text-sm">sync</span>
              Actualizar
            </button>
            <button 
              onClick={() => { 
                setEditUserId(null); 
                setNewStaff({ email: '', password: '', role: 'Radiólogo', first_name: '', last_name: '', cedula_profesional: '', specialty: 'Radiología General', phone: '' }); 
                setShowModal(true); 
              }} 
              className="enterprise-btn flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              Agregar Integrante
            </button>
          </div>
        </div>
        
        <div className="enterprise-card p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 font-bold text-slate-700 uppercase text-xs tracking-wider">Integrante</th>
                <th className="px-6 py-4 font-bold text-slate-700 uppercase text-xs tracking-wider">Rol</th>
                <th className="px-6 py-4 font-bold text-slate-700 uppercase text-xs tracking-wider">Cédula / Especialidad</th>
                <th className="px-6 py-4 font-bold text-slate-700 uppercase text-xs tracking-wider">Contacto</th>
                <th className="px-6 py-4 font-bold text-slate-700 uppercase text-xs tracking-wider">Estado</th>
                <th className="px-6 py-4 font-bold text-slate-700 uppercase text-xs tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {staff.map((user: any) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-800">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {user.cedula_profesional ? (
                      <p className="font-mono text-slate-700 font-semibold">{user.cedula_profesional}</p>
                    ) : (
                      <p className="text-slate-400 italic">Sin cédula</p>
                    )}
                    <p className="text-slate-500">{user.specialty || 'General'}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {user.phone || '—'}
                  </td>
                  <td className="px-6 py-4">
                    {user.is_active ? 
                      <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 border border-green-200">Activo</span> : 
                      <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 border border-red-200">Inactivo</span>
                    }
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    {!(currentUser?.role !== 'Superadministrador' && (user.role === 'Administrador' || user.role === 'Superadministrador')) && (
                      <>
                        <button onClick={() => handleEditStaff(user)} className="text-slate-400 hover:text-clinic-accent p-1" title="Editar">
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onClick={() => handleDeleteStaff(user.id)} className="text-red-400 hover:text-red-700 p-1" title="Eliminar">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-slate-500">Cargando personal...</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Agregar/Editar Personal */}
        {showModal && createPortal(
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] animate-fade-in p-4">
            <div className="bg-white p-8 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900">
                <span className="material-symbols-outlined">close</span>
              </button>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">{editUserId ? 'Modificar Integrante' : 'Nuevo Integrante'}</h2>
              <form onSubmit={handleAddStaff} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4 items-start">
                  <div className="flex flex-col gap-1.5">
                    <div className="h-5 flex items-center">
                      <label className="text-xs font-bold text-slate-700 uppercase">Nombre(s)</label>
                    </div>
                    <input type="text" required value={newStaff.first_name} onChange={e => setNewStaff({...newStaff, first_name: e.target.value})} className="h-10 w-full border border-slate-300 px-3 outline-none focus:border-[var(--color-clinic-accent)] text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="h-5 flex items-center">
                      <label className="text-xs font-bold text-slate-700 uppercase">Apellidos</label>
                    </div>
                    <input type="text" required value={newStaff.last_name} onChange={e => setNewStaff({...newStaff, last_name: e.target.value})} className="h-10 w-full border border-slate-300 px-3 outline-none focus:border-[var(--color-clinic-accent)] text-sm" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="h-5 flex items-center">
                    <label className="text-xs font-bold text-slate-700 uppercase">Correo Electrónico</label>
                  </div>
                  <input type="email" required value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} className="h-10 w-full border border-slate-300 px-3 outline-none focus:border-[var(--color-clinic-accent)] text-sm" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="h-5 flex items-center">
                    <label className="text-xs font-bold text-slate-700 uppercase">Teléfono de Contacto</label>
                  </div>
                  <div className="h-10 w-full border border-slate-300 px-3 focus-within:border-[var(--color-clinic-accent)] text-sm bg-white">
                    <PhoneInput
                      international
                      countryCallingCodeEditable={false}
                      defaultCountry="MX"
                      limitMaxLength={true}
                      smartCaret={false}
                      value={newStaff.phone}
                      onChange={(val) => setNewStaff({...newStaff, phone: val || ''})}
                      className="PhoneInput-custom w-full h-full outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 items-start">
                  <div className="flex flex-col gap-1.5">
                    <div className="h-5 flex items-center">
                      <label className="text-xs font-bold text-slate-700 uppercase">Cédula Profesional</label>
                    </div>
                    <input type="text" value={newStaff.cedula_profesional} onChange={e => setNewStaff({...newStaff, cedula_profesional: e.target.value})} placeholder="CED-12345" className="h-10 w-full border border-slate-300 px-3 outline-none focus:border-[var(--color-clinic-accent)] text-sm uppercase font-mono" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="h-5 flex items-center">
                      <label className="text-xs font-bold text-slate-700 uppercase">Especialidad</label>
                    </div>
                    <input type="text" value={newStaff.specialty} onChange={e => setNewStaff({...newStaff, specialty: e.target.value})} placeholder="Radiología..." className="h-10 w-full border border-slate-300 px-3 outline-none focus:border-[var(--color-clinic-accent)] text-sm" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="h-5 flex items-center">
                    <label className="text-xs font-bold text-slate-700 uppercase">Rol</label>
                  </div>
                  <select value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})} className="h-10 w-full border border-slate-300 px-3 outline-none focus:border-[var(--color-clinic-accent)] bg-white text-sm">
                    <option value="Radiólogo">Radiólogo</option>
                    <option value="Asistente Médico">Asistente Médico</option>
                    {currentUser?.role === 'Superadministrador' && (
                      <>
                        <option value="Administrador">Administrador</option>
                        <option value="Superadministrador">Superadministrador</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="h-5 flex items-center">
                    <label className="text-xs font-bold text-slate-700 uppercase">Contraseña {editUserId && <span className="text-slate-400 font-normal">(Opcional: Dejar en blanco para no cambiarla)</span>}</label>
                  </div>
                  <input type="password" required={!editUserId} value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})} className="h-10 w-full border border-slate-300 px-3 outline-none focus:border-[var(--color-clinic-accent)] text-sm" placeholder="••••••••" />
                </div>

                <div className="mt-4 flex gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="enterprise-btn-secondary flex-1 py-2 text-sm">Cancelar</button>
                  <button type="submit" disabled={newStaff.phone ? !isValidPhoneNumber(newStaff.phone) : false} className={`enterprise-btn flex-1 py-2 text-sm ${newStaff.phone && !isValidPhoneNumber(newStaff.phone) ? 'opacity-50 cursor-not-allowed' : ''}`}>Guardar</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // TAB: Configuración de la Clínica (SUPERADMIN)
  // -------------------------------------------------------------
  if (activeTab === 'config') {
    const handleUpdateConfig = async (e: React.FormEvent) => {
      e.preventDefault();
      if (clinicConfig.phone && !isValidPhoneNumber(clinicConfig.phone)) {
        alert('El número de teléfono no es válido o tiene una longitud incorrecta.');
        return;
      }
      try {
        const res = await api.put('/auth/clinic-config/', {
          name: clinicConfig.name,
          primary_color: clinicConfig.primaryColor,
          address: clinicConfig.address,
          phone: clinicConfig.phone,
          email: clinicConfig.email,
          rating: clinicConfig.rating,
          specialties: clinicConfig.specialties,
          opening_hours: clinicConfig.openingHours,
          latitude: clinicConfig.latitude,
          longitude: clinicConfig.longitude,
          report_layout: clinicConfig.reportLayout
        });
        
        setClinicConfig((prev: any) => ({
          ...prev,
          name: res.data.name,
          primaryColor: res.data.primary_color,
          logoText: res.data.name.charAt(0),
          address: res.data.address,
          phone: res.data.phone,
          email: res.data.email,
          rating: res.data.rating,
          specialties: res.data.specialties,
          openingHours: res.data.opening_hours,
          latitude: res.data.latitude,
          longitude: res.data.longitude
        }));
        alert('Configuración de la clínica guardada exitosamente. Los datos se actualizarán automáticamente en el mapa de pacientes.');
      } catch (err: any) {
        alert(err.response?.data?.error || 'Error al guardar configuración.');
        console.error(err);
      }
    };

    const addSpecialty = (spec: string) => {
      const trimmed = spec.trim();
      if (trimmed && !clinicConfig.specialties.includes(trimmed)) {
        setClinicConfig((prev: any) => ({
          ...prev,
          specialties: [...prev.specialties, trimmed]
        }));
      }
      setNewSpecialtyInput('');
    };

    const removeSpecialty = (spec: string) => {
      setClinicConfig((prev: any) => ({
        ...prev,
        specialties: prev.specialties.filter((s: string) => s !== spec)
      }));
    };

    return (
      <div className="w-full">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Gestión General de la Clínica</h2>
          <p className="text-slate-500 mt-1">Configuración institucional, marca white-label, datos de contacto y catálogo de servicios para la app de pacientes.</p>
        </div>

        <form onSubmit={handleUpdateConfig} className="flex flex-col gap-8">
          {/* Card 1: Identidad y Marca */}
          <div className="enterprise-card p-8">
            <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-200">
              <span className="material-symbols-outlined text-[var(--color-clinic-accent)]">branding_watermark</span>
              <h3 className="text-lg font-bold text-slate-900">Identidad y Marca (White-Label)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="flex flex-col gap-2">
                <div className="h-5 flex items-center">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre Oficial de la Clínica</label>
                </div>
                <input 
                  type="text" 
                  required 
                  value={clinicConfig.name} 
                  onChange={e => setClinicConfig((prev: any) => ({...prev, name: e.target.value}))} 
                  className="h-11 border border-slate-200 px-3 bg-slate-50 focus:bg-white focus:border-[var(--color-clinic-accent)] outline-none text-sm w-full" 
                  placeholder="Ej. Centro Médico AROS"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="h-5 flex items-center">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Color Principal del Tema (HEX)</label>
                </div>
                <div className="flex items-center gap-3 h-11">
                  <div className="w-11 h-11 rounded-none overflow-hidden border border-slate-300 flex-shrink-0 relative shadow-sm hover:shadow transition-shadow">
                    <input 
                      type="color" 
                      value={clinicConfig.primaryColor} 
                      onChange={e => setClinicConfig((prev: any) => ({...prev, primaryColor: e.target.value}))} 
                      className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" 
                      title="Elige un color o usa el cuentagotas"
                    />
                  </div>
                  <input 
                    type="text" 
                    required 
                    pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$" 
                    placeholder="#0284c7" 
                    value={clinicConfig.primaryColor} 
                    onChange={e => setClinicConfig((prev: any) => ({...prev, primaryColor: e.target.value}))} 
                    className="h-11 border border-slate-200 px-3 bg-slate-50 focus:bg-white focus:border-[var(--color-clinic-accent)] outline-none flex-1 font-mono uppercase text-sm" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Ubicación y Contacto */}
          <div className="enterprise-card p-8">
            <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-200">
              <span className="material-symbols-outlined text-[var(--color-clinic-accent)]">store</span>
              <h3 className="text-lg font-bold text-slate-900">Ubicación Física y Contacto</h3>
            </div>

            <div className="flex flex-col gap-6">
              {/* Interactive OpenStreetMap Geocoding & Pin Location Picker */}
              <div className="flex flex-col gap-2">
                <div className="h-5 flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Dirección Física y Posición Geográfica Exacta</label>
                </div>
                <LocationPicker 
                  address={clinicConfig.address}
                  latitude={clinicConfig.latitude}
                  longitude={clinicConfig.longitude}
                  primaryColor={clinicConfig.primaryColor}
                  onChange={({ address, latitude, longitude }) => {
                    setClinicConfig((prev: any) => ({
                      ...prev,
                      address,
                      latitude,
                      longitude
                    }));
                  }}
                />
                <span className="text-[11px] text-slate-500">
                  Busca por calle/colonia o haz clic directamente sobre el mapa para posicionar la entrada de tu clínica. Los pacientes verán este punto exacto en su mapa interactivo.
                </span>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="flex flex-col gap-2">
                  <div className="h-5 flex items-center">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Teléfono de Atención</label>
                  </div>
                  <div className="h-11 border border-slate-200 px-3 bg-slate-50 focus-within:bg-white focus-within:border-[var(--color-clinic-accent)] outline-none text-sm w-full font-medium">
                    <PhoneInput
                      international
                      countryCallingCodeEditable={false}
                      defaultCountry="MX"
                      limitMaxLength={true}
                      smartCaret={false}
                      value={clinicConfig.phone}
                      onChange={(val) => setClinicConfig((prev: any) => ({...prev, phone: val || ''}))}
                      className="PhoneInput-custom w-full h-full outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="h-5 flex items-center">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Correo Electrónico Institucional</label>
                  </div>
                  <input 
                    type="email" 
                    required 
                    value={clinicConfig.email} 
                    onChange={e => setClinicConfig((prev: any) => ({...prev, email: e.target.value}))} 
                    className="h-11 border border-slate-200 px-3 bg-slate-50 focus:bg-white focus:border-[var(--color-clinic-accent)] outline-none text-sm w-full font-medium" 
                    placeholder="contacto@aros-salud.mx"
                  />
                </div>
              </div>

              {/* Interactive Schedule Builder */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <div className="h-5 flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Horario Oficial de Atención</label>
                </div>
                <ScheduleBuilder 
                  value={clinicConfig.openingHours}
                  onChange={(formattedSchedule) => {
                    setClinicConfig((prev: any) => ({
                      ...prev,
                      openingHours: formattedSchedule
                    }));
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Calificación y Especialidades */}
          <div className="enterprise-card p-8">
            <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-200">
              <span className="material-symbols-outlined text-[var(--color-clinic-accent)]">medical_services</span>
              <h3 className="text-lg font-bold text-slate-900">Calidad y Especialidades Ofrecidas</h3>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Calificación Otorgada por Pacientes (Red AROS)</span>
                  <p className="text-xs text-slate-500 mt-1">
                    Puntaje promedio calculado automáticamente a partir de las evaluaciones reales de los pacientes en la app AROS.
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-white px-4 py-2.5 border border-slate-200 shadow-sm shrink-0">
                  <div className="flex items-center text-amber-500 font-black text-xl gap-1">
                    <span className="material-symbols-outlined text-2xl fill-1 text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span>{clinicConfig.rating || '5.0'}</span>
                  </div>
                  <div className="border-l border-slate-200 pl-3 text-right">
                    <span className="text-xs font-bold text-slate-900 block">{clinicConfig.totalReviews || 1} {clinicConfig.totalReviews === 1 ? 'opinión' : 'opiniones'}</span>
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 justify-end">
                      <span className="material-symbols-outlined text-xs">verified</span> Pacientes AROS
                    </span>
                  </div>
                </div>
              </div>

              {/* Specialties Tag Manager */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Especialidades Médicas y Estudios Disponibles</label>
                
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 min-h-[60px] items-center">
                  {clinicConfig.specialties.map((spec: string) => (
                    <span 
                      key={spec} 
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-xs font-bold text-slate-800 shadow-sm"
                    >
                      <span>{spec}</span>
                      <button 
                        type="button" 
                        onClick={() => removeSpecialty(spec)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Eliminar especialidad"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    </span>
                  ))}
                  {clinicConfig.specialties.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No has agregado especialidades aún.</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newSpecialtyInput} 
                    onChange={e => setNewSpecialtyInput(e.target.value)} 
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty(newSpecialtyInput); }}}
                    placeholder="Escribe una especialidad y presiona Agregar..." 
                    className="flex-1 border border-slate-200 p-2.5 text-sm bg-white focus:border-[var(--color-clinic-accent)] outline-none"
                  />
                  <button 
                    type="button" 
                    onClick={() => addSpecialty(newSpecialtyInput)}
                    className="enterprise-btn-secondary px-5 py-2.5 text-sm flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Agregar
                  </button>
                </div>

                {/* Preset Suggestions */}
                <div className="mt-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Sugerencias rápidas:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Radiología Digital (Rayos X)', 
                      'Tomografía Computarizada (TAC)', 
                      'Resonancia Magnética (RMN)', 
                      'Ultrasonido Doppler 4D', 
                      'Mastografía Digital', 
                      'Densitometría Ósea', 
                      'Fluoroscopía Digital', 
                      'PET / CT', 
                      'Ecocardiografía'
                    ].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => addSpecialty(preset)}
                        className={`text-[11px] font-medium px-2.5 py-1 border transition-colors ${clinicConfig.specialties.includes(preset) ? 'bg-slate-200 text-slate-400 border-slate-200 cursor-default' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
                        disabled={clinicConfig.specialties.includes(preset)}
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3.5: Report Layout Builder */}
          <div className="enterprise-card p-8">
            <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-200">
              <span className="material-symbols-outlined text-[var(--color-clinic-accent)]">insert_page_break</span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Diseño de Reporte (Membrete)</h3>
                <p className="text-xs text-slate-500 mt-1">Configura el encabezado y pie de página que se usarán al generar los PDFs de los estudios para los pacientes.</p>
              </div>
            </div>
            
            <ReportLayoutBuilder
              layout={clinicConfig.reportLayout}
              onChange={(newLayout) => setClinicConfig((prev: any) => ({ ...prev, reportLayout: newLayout }))}
              primaryColor={clinicConfig.primaryColor}
              onPreview={handlePreviewReport}
              isPreviewing={isPreviewingReport}
            />
          </div>

          {/* Card 4: DICOM Node Info */}
          <div className="enterprise-card p-8 bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-200">
              <span className="material-symbols-outlined text-slate-600">dns</span>
              <h3 className="text-lg font-bold text-slate-900">Nodo DICOM & Servidor PACS Local</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              <div>
                <span className="font-bold text-slate-500 uppercase block mb-1">Servidor REST Orthanc</span>
                <code className="bg-white px-2 py-1 border border-slate-200 font-mono text-slate-700 block">http://localhost:8042</code>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase block mb-1">Puerto DICOM (C-STORE)</span>
                <code className="bg-white px-2 py-1 border border-slate-200 font-mono text-slate-700 block">4242 (TCP)</code>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase block mb-1">Application Entity Title (AET)</span>
                <code className="bg-white px-2 py-1 border border-slate-200 font-mono text-slate-700 block">AROS_PACS</code>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <button 
              type="submit"
              disabled={clinicConfig.phone ? !isValidPhoneNumber(clinicConfig.phone) : false} 
              className={`enterprise-btn px-8 py-3 text-base flex items-center gap-2 shadow-sm hover:shadow ${clinicConfig.phone && !isValidPhoneNumber(clinicConfig.phone) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="material-symbols-outlined text-lg">save</span>
              Guardar Configuración de Clínica
            </button>
          </div>
        </form>
      </div>
    );
  }

  // -------------------------------------------------------------
  // TAB: Métricas (Main)
  // -------------------------------------------------------------
  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-slate-900 mb-8">Métricas Generales</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="enterprise-card p-6 flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-500 uppercase">Estudios Realizados (Mes)</h3>
          <p className="text-4xl font-extrabold text-slate-900 mt-2">342</p>
        </div>
        <div className="enterprise-card p-6 flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-500 uppercase">Personal Médico Registrado</h3>
          <p className="text-4xl font-extrabold text-slate-900 mt-2">12</p>
        </div>
        <div className="enterprise-card p-6 flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-500 uppercase">Tiempo Prom. Dictamen</h3>
          <p className="text-4xl font-extrabold text-slate-900 mt-2">45<span className="text-lg text-slate-500 ml-1">min</span></p>
        </div>
      </div>
    </div>
  );
}
