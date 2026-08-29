import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import Split from 'react-split';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface DictationScreenProps {
  studyUid: string;
  onBack: () => void;
}

export default function DictationScreen({ studyUid, onBack }: DictationScreenProps) {
  // Mock data to match the UI style requested
  const [patient, setPatient] = useState({
    name: 'Cargando...',
    dob: 'N/A',
    gender: 'N/A',
    mrn: 'N/A'
  });

  const [study, setStudy] = useState({
    modality: '...',
    description: 'Cargando detalles del estudio...',
    date: 'N/A'
  });

  useEffect(() => {
    // We could fetch a single study if the endpoint supports it, 
    // but for now let's just get the list and find it.
    api.get('/clinical_data/studies/')
      .then(res => {
        const studies = res.data.studies || [];
        const found = studies.find((s: any) => s.study_instance_uid === studyUid);
        if (found) {
          setPatient({
            name: found.patient_name || 'Desconocido',
            dob: found.patient_dob || 'N/A',
            gender: 'Masculino', // TODO: backend doesn't return gender yet
            mrn: `ID-${found.patient_id || 'N/A'}`
          });
          setStudy({
            modality: found.modality || 'OT',
            description: found.study_description || 'Estudio DICOM',
            date: found.study_date || 'N/A'
          });
        }
      })
      .catch(console.error);
  }, [studyUid]);

  const [findings, setFindings] = useState('');
  const [conclusions, setConclusions] = useState('');

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{'list': 'ordered'}, {'list': 'bullet'}],
      ['clean']
    ],
  };

  const handleSave = async (status: string) => {
    try {
      await api.post('/clinical_data/reports/', {
        study_uid: studyUid,
        findings,
        conclusions,
        status
      });
      alert(`Reporte guardado como ${status}`);
      onBack();
    } catch (err) {
      console.error(err);
      alert('Error al guardar el reporte');
    }
  };

  return createPortal(
    <div className="fixed inset-0 flex flex-col bg-slate-50 z-[100] animate-fade-in">
      {/* Header */}
      <header className="h-14 bg-[var(--color-clinic-accent)] text-white flex items-center justify-between px-6 shrink-0 shadow-md relative z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 hover:bg-white/20 px-3 py-1.5 transition-colors font-medium text-sm"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Regresar al Worklist
          </button>
          <div className="h-5 w-px bg-white/30"></div>
          <h1 className="font-extrabold tracking-wide text-lg text-white">Dictaminación de Estudio</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold opacity-90">Dr. Juan Radiólogo</span>
          <div className="w-8 h-8 bg-white text-[var(--color-clinic-accent)] font-bold flex items-center justify-center text-sm shadow-sm">
            JR
          </div>
        </div>
      </header>

      {/* Split Pane */}
      <Split 
        className="flex h-[calc(100vh-56px)] w-full overflow-hidden" 
        sizes={[70, 30]} 
        minSize={[600, 320]}
        expandToMin={false}
        gutterSize={10}
        gutterAlign="center"
        direction="horizontal"
      >
        {/* Left Pane: OHIF Viewer */}
        <div className="h-full bg-black relative">
          <iframe 
            src={`http://localhost:3000/viewer?StudyInstanceUIDs=${studyUid}`}
            className="w-full h-full border-none"
            title="OHIF Viewer"
          />
        </div>

        {/* Right Pane: Report Editor */}
        <div className="h-full bg-white flex flex-col border-l border-slate-200 overflow-y-auto">
          {/* Patient & Study Context */}
          <div className="p-6 bg-slate-50 border-b border-slate-200 shrink-0">
            <h2 className="text-xl font-extrabold text-slate-900 mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-clinic-accent">description</span>
              Reporte Radiológico
            </h2>
            
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div className="flex flex-col"><span className="font-bold text-slate-500 text-xs uppercase tracking-wider mb-0.5">Paciente</span> <span className="font-semibold text-slate-900">{patient.name}</span></div>
              <div className="flex flex-col"><span className="font-bold text-slate-500 text-xs uppercase tracking-wider mb-0.5">DOB</span> <span className="text-slate-800">{patient.dob}</span></div>
              <div className="flex flex-col"><span className="font-bold text-slate-500 text-xs uppercase tracking-wider mb-0.5">MRN</span> <span className="text-[var(--color-clinic-accent)] font-bold bg-[var(--color-clinic-accent)]/10 px-2 py-0.5 text-xs w-max">{patient.mrn}</span></div>
              <div className="flex flex-col"><span className="font-bold text-slate-500 text-xs uppercase tracking-wider mb-0.5">Género</span> <span className="text-slate-800 flex items-center gap-1"><span className="material-symbols-outlined text-[14px] text-blue-500">male</span> {patient.gender}</span></div>
            </div>
            
            <hr className="my-5 border-slate-200/80" />
            
            <div className="grid grid-cols-1 gap-y-3 text-sm">
              <div className="flex flex-col"><span className="font-bold text-slate-500 text-xs uppercase tracking-wider mb-0.5">Estudio</span> <span className="font-semibold text-slate-900">{study.description}</span></div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col"><span className="font-bold text-slate-500 text-xs uppercase tracking-wider mb-0.5">Modalidad</span> <span className="bg-purple-100 text-purple-700 px-2 py-0.5 font-extrabold text-xs border border-purple-200">{study.modality}</span></div>
                <div className="flex flex-col"><span className="font-bold text-slate-500 text-xs uppercase tracking-wider mb-0.5">Fecha</span> <span className="text-slate-800 font-medium">{study.date}</span></div>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="p-6 flex-1 flex flex-col gap-6 bg-slate-50/50">
            <div className="flex flex-col flex-1 gap-2 min-h-[250px]">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[var(--color-clinic-accent)]">search</span> 
                Hallazgos (Findings)
              </label>
              <div className="flex-1 quill-modern">
                <ReactQuill 
                  theme="snow" 
                  value={findings} 
                  onChange={setFindings}
                  modules={modules}
                  className="h-full flex flex-col"
                />
              </div>
            </div>

            <div className="flex flex-col flex-1 gap-2 min-h-[200px]">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-green-600">done_all</span> 
                Conclusiones (Conclusions)
              </label>
              <div className="flex-1 quill-modern">
                <ReactQuill 
                  theme="snow" 
                  value={conclusions} 
                  onChange={setConclusions}
                  modules={modules}
                  className="h-full flex flex-col"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-5 border-t border-slate-200 bg-white shrink-0 flex flex-wrap gap-4 justify-center shadow-[0_-4px_10px_rgba(0,0,0,0.02)] relative z-10">
            <button 
              className="enterprise-btn-secondary flex-1 whitespace-nowrap min-w-[140px] text-sm"
              onClick={() => handleSave('PEN')}
            >
              Guardar Borrador
            </button>
            <button 
              className="enterprise-btn flex-1 shadow-md flex items-center justify-center gap-2 whitespace-nowrap min-w-[140px] text-sm"
              onClick={() => handleSave('FIN')}
            >
              <span className="material-symbols-outlined text-sm">send</span>
              Completar Reporte
            </button>
          </div>
        </div>
      </Split>
    </div>,
    document.body
  );
}
