import { useState } from 'react';

export interface TextStyle {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: 'normal' | 'bold';
  color?: string;
}

export interface ContainerStyle {
  backgroundColor?: string;
  borderColor?: string;
}

export interface ReportLayout {
  header: {
    alignment: 'space-between' | 'center' | 'left' | 'right';
    items: Array<{
      id: string;
      type: 'image' | 'text';
      url?: string;
      content?: string;
      width?: string;
      fontSize?: string;
      color?: string;
      fontFamily?: string;
      fontWeight?: 'normal' | 'bold';
    }>;
  };
  body?: {
    pageBackgroundUrl?: string;
    blocks?: Array<'patient_info' | 'study_content' | 'signatures'>;
    sections?: {
      patient_info?: {
        container?: ContainerStyle;
        title?: TextStyle;
        label?: TextStyle;
        value?: TextStyle;
      };
      study_content?: {
        title?: TextStyle;
        report?: TextStyle;
      };
      signatures?: {
        text?: TextStyle;
      };
    };
  };
  footer: {
    text: string;
    fontSize: string;
    color: string;
  };
}

interface ReportLayoutBuilderProps {
  layout: ReportLayout;
  onChange: (layout: ReportLayout) => void;
  primaryColor: string;
  onPreview: () => void;
  isPreviewing: boolean;
}

type SelectedElement = 
  | { type: 'global' } 
  | { type: 'header_item', id: string } 
  | { type: 'body' } 
  | { type: 'body_section', sectionId: 'patient_info' | 'study_content' | 'signatures' }
  | { type: 'body_element', sectionId: 'patient_info' | 'study_content' | 'signatures', elementId: string }
  | { type: 'footer' };

export default function ReportLayoutBuilder({ layout, onChange, primaryColor, onPreview, isPreviewing }: ReportLayoutBuilderProps) {
  const [selectedElement, setSelectedElement] = useState<SelectedElement>({ type: 'global' });

  // Ensure we have a default layout if empty
  const currentLayout: ReportLayout = layout?.header ? {
    ...layout,
    body: {
      ...layout.body,
      blocks: layout.body?.blocks || ['patient_info', 'study_content', 'signatures'],
      sections: layout.body?.sections || {}
    }
  } : {
    header: {
      alignment: 'space-between',
      items: [
        { id: '1', type: 'image', url: 'https://placehold.co/200x80/f1f5f9/94a3b8?text=LOGO+AQUI' },
        { id: '2', type: 'text', content: 'Reporte Médico', fontSize: '16pt', color: '#0f172a', fontFamily: 'sans-serif', fontWeight: 'bold' }
      ]
    },
    body: {
      pageBackgroundUrl: '',
      blocks: ['patient_info', 'study_content', 'signatures'],
      sections: {}
    },
    footer: {
      text: 'Información de Contacto y Dirección de la Clínica',
      fontSize: '10pt',
      color: '#64748b'
    }
  };

  const setHeaderAlignment = (align: ReportLayout['header']['alignment']) => {
    onChange({ ...currentLayout, header: { ...currentLayout.header, alignment: align } });
  };

  const updateHeaderItem = (id: string, updates: any) => {
    const newItems = currentLayout.header.items.map(i => i.id === id ? { ...i, ...updates } : i);
    onChange({ ...currentLayout, header: { ...currentLayout.header, items: newItems } });
  };

  const updateFooter = (updates: any) => {
    onChange({ ...currentLayout, footer: { ...currentLayout.footer, ...updates } });
  };

  const updateBody = (updates: any) => {
    onChange({ ...currentLayout, body: { ...currentLayout.body, ...updates } });
  };

  const updateSectionStyle = (sectionId: 'patient_info' | 'study_content' | 'signatures', styleType: 'container' | 'title' | 'label' | 'value' | 'report' | 'text', updates: Partial<TextStyle | ContainerStyle>) => {
    const currentSections = currentLayout.body?.sections || {};
    const section: any = currentSections[sectionId] || {};
    const existingStyle: any = section[styleType] || {};
    
    const newSections = {
      ...currentSections,
      [sectionId]: {
        ...section,
        [styleType]: {
          ...existingStyle,
          ...updates
        }
      }
    };
    updateBody({ sections: newSections });
  };

  const moveHeaderItem = (fromIndex: number, toIndex: number) => {
    const items = [...currentLayout.header.items];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    onChange({ ...currentLayout, header: { ...currentLayout.header, items } });
  };

  const moveBodyBlock = (fromIndex: number, toIndex: number) => {
    const blocks = [...(currentLayout.body?.blocks || [])];
    const [moved] = blocks.splice(fromIndex, 1);
    blocks.splice(toIndex, 0, moved);
    updateBody({ blocks });
  };

  const TextControls = ({ 
    style, 
    onChange,
    defaultColor = '#0f172a',
    defaultSize = '12pt',
    defaultWeight = 'normal'
  }: { 
    style?: TextStyle, 
    onChange: (updates: Partial<TextStyle>) => void,
    defaultColor?: string,
    defaultSize?: string,
    defaultWeight?: 'normal' | 'bold'
  }) => (
    <div className="flex flex-col gap-3 p-3 bg-white border border-slate-200 rounded">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Tipografía</span>
          <select 
            value={style?.fontFamily || 'sans-serif'} 
            onChange={e => onChange({ fontFamily: e.target.value })}
            className="border border-slate-300 rounded px-2 py-1.5 text-xs outline-none bg-white shadow-sm"
          >
            <option value="sans-serif">Sans-serif</option>
            <option value="serif">Serif</option>
            <option value="monospace">Monospace</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Tamaño</span>
          <select 
            value={style?.fontSize || defaultSize} 
            onChange={e => onChange({ fontSize: e.target.value })}
            className="border border-slate-300 rounded px-2 py-1.5 text-xs outline-none bg-white shadow-sm"
          >
            <option value="8pt">8pt</option>
            <option value="10pt">10pt</option>
            <option value="12pt">12pt</option>
            <option value="14pt">14pt</option>
            <option value="16pt">16pt</option>
            <option value="18pt">18pt</option>
            <option value="24pt">24pt</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-1">
        <button 
          type="button"
          onClick={() => onChange({ fontWeight: (style?.fontWeight || defaultWeight) === 'normal' ? 'bold' : 'normal' })}
          className={`flex items-center justify-center border px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-colors ${(style?.fontWeight || defaultWeight) === 'bold' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
        >
          B
        </button>
        <div className="flex flex-col flex-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Color HEX</span>
          <input 
            type="text"
            value={style?.color || defaultColor}
            onChange={e => onChange({ color: e.target.value })}
            className="border-b border-slate-300 text-xs py-1 outline-none font-mono"
          />
        </div>
      </div>
    </div>
  );

  const ContainerControls = ({ 
    style, 
    onChange,
    defaultBg = 'transparent',
    defaultBorder = 'transparent'
  }: { 
    style?: ContainerStyle, 
    onChange: (updates: Partial<ContainerStyle>) => void,
    defaultBg?: string,
    defaultBorder?: string
  }) => (
    <div className="flex flex-col gap-3 p-3 bg-white border border-slate-200 rounded">
      <div className="flex items-center gap-4">
        <div className="flex flex-col flex-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Color de Fondo</span>
          <input 
            type="text"
            value={style?.backgroundColor || defaultBg}
            onChange={e => onChange({ backgroundColor: e.target.value })}
            className="border-b border-slate-300 text-xs py-1 outline-none font-mono"
          />
        </div>
        <div className="flex flex-col flex-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Color Borde Inferior</span>
          <input 
            type="text"
            value={style?.borderColor || defaultBorder}
            onChange={e => onChange({ borderColor: e.target.value })}
            className="border-b border-slate-300 text-xs py-1 outline-none font-mono"
          />
        </div>
      </div>
    </div>
  );

  // -------------------------
  // PROPERTIES PANEL RENDERER
  // -------------------------
  const renderPropertiesPanel = () => {
    if (selectedElement.type === 'global') {
      return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-4">
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-lg flex flex-col gap-4">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-accent">view_stream</span>
              Alineación del Encabezado
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'space-between', label: 'Separados', icon: 'align_justify_space_between' },
                { id: 'left', label: 'Izquierda', icon: 'format_align_left' },
                { id: 'center', label: 'Centro', icon: 'format_align_center' },
                { id: 'right', label: 'Derecha', icon: 'format_align_right' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setHeaderAlignment(opt.id as any)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded border transition-colors ${currentLayout.header.alignment === opt.id ? 'bg-accent/10 border-accent text-accent' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                >
                  <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-5 rounded-lg flex flex-col gap-4">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-accent">format_paint</span>
              Fondo Global de la Página
            </h4>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">URL de Imagen (Opcional)</span>
              <input 
                type="text" 
                value={currentLayout.body?.pageBackgroundUrl || ''} 
                onChange={e => updateBody({ pageBackgroundUrl: e.target.value })}
                className="border border-slate-200 px-2 py-1.5 text-xs w-full outline-none focus:border-accent"
                placeholder="https://..."
              />
              <p className="text-[10px] text-slate-500 mt-1">Haz clic en los elementos de la vista previa a la derecha para configurarlos individualmente.</p>
            </div>
          </div>
        </div>
      );
    }

    if (selectedElement.type === 'header_item') {
      const itemIndex = currentLayout.header.items.findIndex(i => i.id === selectedElement.id);
      const item = currentLayout.header.items[itemIndex];
      if (!item) {
        setSelectedElement({ type: 'global' });
        return null;
      }
      return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedElement({ type: 'global' })} className="text-slate-500 hover:text-accent flex items-center text-xs font-bold gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span> Volver
            </button>
            <span className="text-xs font-bold text-slate-400">PROPIEDADES</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-5 rounded-lg flex flex-col gap-4 shadow-sm">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-accent">
                  {item.type === 'image' ? 'image' : 'text_fields'}
                </span>
                {item.type === 'image' ? 'Logotipo' : 'Texto'}
              </h4>
              <div className="flex gap-1">
                <button type="button" disabled={itemIndex === 0} onClick={() => moveHeaderItem(itemIndex, itemIndex - 1)} className="text-slate-500 hover:text-accent disabled:opacity-30 cursor-pointer bg-white border border-slate-200 rounded p-1 shadow-sm"><span className="material-symbols-outlined text-[16px] leading-none block">arrow_upward</span></button>
                <button type="button" disabled={itemIndex === currentLayout.header.items.length - 1} onClick={() => moveHeaderItem(itemIndex, itemIndex + 1)} className="text-slate-500 hover:text-accent disabled:opacity-30 cursor-pointer bg-white border border-slate-200 rounded p-1 shadow-sm"><span className="material-symbols-outlined text-[16px] leading-none block">arrow_downward</span></button>
              </div>
            </div>

            {item.type === 'image' ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-600">URL de la Imagen</span>
                  <input type="text" value={item.url} onChange={e => updateHeaderItem(item.id, { url: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm w-full outline-none focus:border-accent shadow-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-600">Ancho MÁX (CSS)</span>
                  <input type="text" value={item.width || '150px'} onChange={e => updateHeaderItem(item.id, { width: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm w-full outline-none focus:border-accent shadow-sm" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-600">Contenido</span>
                  <input type="text" value={item.content} onChange={e => updateHeaderItem(item.id, { content: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm w-full outline-none focus:border-accent shadow-sm" />
                </div>
                <TextControls style={{ fontFamily: item.fontFamily, fontSize: item.fontSize, fontWeight: item.fontWeight, color: item.color }} onChange={(u) => updateHeaderItem(item.id, u)} defaultSize="16pt" defaultWeight="bold" />
              </div>
            )}
          </div>
        </div>
      );
    }

    if (selectedElement.type === 'body') {
      const blocks = currentLayout.body?.blocks || ['patient_info', 'study_content', 'signatures'];
      return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedElement({ type: 'global' })} className="text-slate-500 hover:text-accent flex items-center text-xs font-bold gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span> Volver
            </button>
            <span className="text-xs font-bold text-slate-400">PROPIEDADES GLOBALES CUERPO</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-5 rounded-lg flex flex-col gap-4 shadow-sm">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-2 border-b border-slate-200">
              <span className="material-symbols-outlined text-lg text-accent">view_day</span>
              Orden de Secciones
            </h4>
            <div className="flex flex-col gap-2">
              {blocks.map((b, idx) => (
                <div key={b} className="flex justify-between items-center bg-white border border-slate-200 p-2 rounded shadow-sm">
                  <span className="text-sm font-semibold text-slate-700">
                    {b === 'patient_info' ? 'Info. del Paciente' : b === 'study_content' ? 'Contenido del Estudio' : 'Área de Firmas'}
                  </span>
                  <div className="flex gap-1">
                    <button type="button" disabled={idx === 0} onClick={() => moveBodyBlock(idx, idx - 1)} className="text-slate-400 hover:text-accent disabled:opacity-30"><span className="material-symbols-outlined text-[16px] block">arrow_upward</span></button>
                    <button type="button" disabled={idx === blocks.length - 1} onClick={() => moveBodyBlock(idx, idx + 1)} className="text-slate-400 hover:text-accent disabled:opacity-30"><span className="material-symbols-outlined text-[16px] block">arrow_downward</span></button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-center border-t border-slate-200 pt-3">Haz clic en una sección específica en el lienzo para personalizar sus contenedores y textos.</p>
          </div>
        </div>
      );
    }

    if (selectedElement.type === 'body_section') {
      const sectionLabels: Record<string, string> = {
        'patient_info': 'Información del Paciente',
        'study_content': 'Contenido del Estudio',
        'signatures': 'Área de Firmas'
      };

      const sectionStyles = currentLayout.body?.sections?.[selectedElement.sectionId] || {};

      return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedElement({ type: 'body' })} className="text-slate-500 hover:text-accent flex items-center text-xs font-bold gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span> Volver a Cuerpo
            </button>
            <span className="text-xs font-bold text-slate-400 text-right uppercase">Sección: {sectionLabels[selectedElement.sectionId]}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex flex-col gap-4 shadow-sm">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-2 border-b border-slate-200">
              <span className="material-symbols-outlined text-lg text-accent">format_shapes</span>
              Estilo del Contenedor
            </h4>
            <ContainerControls 
              style={(sectionStyles as any).container} 
              onChange={(u) => updateSectionStyle(selectedElement.sectionId as any, 'container', u)}
              defaultBg={selectedElement.sectionId === 'patient_info' ? '#f8fafc' : 'transparent'}
              defaultBorder={selectedElement.sectionId === 'patient_info' ? '#e2e8f0' : 'transparent'}
            />
            <p className="text-[10px] text-slate-500 mt-2 text-center border-t border-slate-200 pt-3">Haz clic en un texto específico en el lienzo para editar su tipografía.</p>
          </div>
        </div>
      );
    }

    if (selectedElement.type === 'body_element') {
      const sectionStyles = currentLayout.body?.sections?.[selectedElement.sectionId] || {};
      const elementStyle = (sectionStyles as any)[selectedElement.elementId] || {};
      
      const elementLabels: Record<string, string> = {
        'title': 'Títulos',
        'label': 'Etiquetas (Ej. Paciente:)',
        'value': 'Valores (Ej. Juan Pérez)',
        'report': 'Texto de Hallazgos',
        'text': 'Firma del Médico'
      };

      return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedElement({ type: 'body_section', sectionId: selectedElement.sectionId })} className="text-slate-500 hover:text-accent flex items-center text-xs font-bold gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span> Volver a Sección
            </button>
            <span className="text-xs font-bold text-slate-400 text-right uppercase truncate max-w-[120px]">{elementLabels[selectedElement.elementId]}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex flex-col gap-4 shadow-sm">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-2 border-b border-slate-200">
              <span className="material-symbols-outlined text-lg text-accent">text_format</span>
              Diseño de Texto
            </h4>
            <TextControls 
              style={elementStyle} 
              onChange={(u) => updateSectionStyle(selectedElement.sectionId as any, selectedElement.elementId as any, u)}
              defaultSize={selectedElement.elementId === 'title' ? '14pt' : '12pt'}
              defaultWeight={['title', 'label', 'text'].includes(selectedElement.elementId) ? 'bold' : 'normal'}
            />
          </div>
        </div>
      );
    }

    if (selectedElement.type === 'footer') {
      return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedElement({ type: 'global' })} className="text-slate-500 hover:text-accent flex items-center text-xs font-bold gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span> Volver
            </button>
            <span className="text-xs font-bold text-slate-400">PROPIEDADES</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-5 rounded-lg flex flex-col gap-4 shadow-sm">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-2 border-b border-slate-200">
              <span className="material-symbols-outlined text-lg text-accent">vertical_align_bottom</span>
              Pie de Página
            </h4>
            <textarea value={currentLayout.footer.text} onChange={e => updateFooter({ text: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm w-full outline-none focus:border-accent resize-none h-24 shadow-sm" placeholder="Dirección, Teléfono, Email, etc..." />
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-600">Tamaño</span>
                <select value={currentLayout.footer.fontSize || '10pt'} onChange={e => updateFooter({ fontSize: e.target.value })} className="border border-slate-300 rounded px-2 py-2 text-sm outline-none bg-white shadow-sm">
                  <option value="8pt">8pt</option><option value="10pt">10pt</option><option value="12pt">12pt</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  // -------------------------
  // CANVAS BLOCK RENDERERS
  // -------------------------
  const isSelected = (type: string, sectionId?: string, elementId?: string) => {
    if (type === 'section') return selectedElement.type === 'body_section' && selectedElement.sectionId === sectionId;
    if (type === 'element') return selectedElement.type === 'body_element' && selectedElement.sectionId === sectionId && selectedElement.elementId === elementId;
    return false;
  };

  const getS = (sectionId: 'patient_info'|'study_content'|'signatures'): any => currentLayout.body?.sections?.[sectionId] || {};

  const handleElementClick = (e: React.MouseEvent, sectionId: 'patient_info'|'study_content'|'signatures', elementId: string) => {
    e.stopPropagation();
    setSelectedElement({ type: 'body_element', sectionId, elementId });
  };

  const renderPatientInfo = () => {
    const s = getS('patient_info');
    const sC = s.container; const sT = s.title; const sL = s.label; const sV = s.value;
    
    return (
      <div 
        className={`mb-6 p-4 rounded border-2 transition-colors cursor-pointer ${isSelected('section', 'patient_info') ? 'border-accent shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
        style={{ backgroundColor: sC?.backgroundColor || '#f8fafc', borderColor: sC?.borderColor || (isSelected('section', 'patient_info') ? undefined : '#e2e8f0') }}
        onClick={(e) => { e.stopPropagation(); setSelectedElement({ type: 'body_section', sectionId: 'patient_info' }); }}
      >
        <h2 
          className={`mb-3 transition-colors cursor-pointer p-1 -m-1 rounded ${isSelected('element', 'patient_info', 'title') ? 'bg-accent/10 outline outline-1 outline-accent' : 'hover:bg-slate-200/50'}`}
          style={{ fontFamily: sT?.fontFamily || 'sans-serif', fontSize: sT?.fontSize || '14pt', fontWeight: sT?.fontWeight || 'bold', color: sT?.color || '#0f172a' }}
          onClick={(e) => handleElementClick(e, 'patient_info', 'title')}
        >Información del Paciente</h2>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {['Paciente', 'ID Paciente', 'Fecha Estudio', 'Modalidad', 'Médico Referente', 'Acceso (UID)'].map((label, i) => (
            <div key={label} className="flex gap-2 p-1 -m-1 rounded">
              <span 
                className={`uppercase transition-colors cursor-pointer rounded ${isSelected('element', 'patient_info', 'label') ? 'bg-accent/10 outline outline-1 outline-accent' : 'hover:bg-slate-200/50'}`}
                style={{ fontFamily: sL?.fontFamily || 'sans-serif', fontSize: sL?.fontSize || '10pt', fontWeight: sL?.fontWeight || 'bold', color: sL?.color || '#475569' }}
                onClick={(e) => handleElementClick(e, 'patient_info', 'label')}
              >{label}:</span>
              
              <span 
                className={`transition-colors cursor-pointer rounded truncate ${isSelected('element', 'patient_info', 'value') ? 'bg-accent/10 outline outline-1 outline-accent' : 'hover:bg-slate-200/50'}`}
                style={{ fontFamily: sV?.fontFamily || 'sans-serif', fontSize: sV?.fontSize || '12pt', fontWeight: sV?.fontWeight || 'normal', color: sV?.color || '#334155' }}
                onClick={(e) => handleElementClick(e, 'patient_info', 'value')}
              >{i === 0 ? 'Juan Pérez' : i === 1 ? 'PT-0001' : i === 2 ? '2026-08-26' : i === 3 ? 'MR' : i === 4 ? 'Dr. House' : '1.2.840...'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStudyContent = () => {
    const s = getS('study_content');
    const sC = s.container; const sT = s.title; const sR = s.report;

    return (
      <div 
        className={`mb-6 p-2 -m-2 rounded border-2 transition-colors cursor-pointer ${isSelected('section', 'study_content') ? 'border-accent shadow-sm' : 'border-transparent hover:border-slate-300'}`}
        style={{ backgroundColor: sC?.backgroundColor || 'transparent' }}
        onClick={(e) => { e.stopPropagation(); setSelectedElement({ type: 'body_section', sectionId: 'study_content' }); }}
      >
        <div className="mb-4">
          <span 
            className={`border-b inline-block transition-colors cursor-pointer rounded p-1 -m-1 ${isSelected('element', 'study_content', 'title') ? 'bg-accent/10 outline outline-1 outline-accent' : 'hover:bg-slate-200/50'}`} 
            style={{ 
              fontFamily: sT?.fontFamily || 'sans-serif', fontSize: sT?.fontSize || '16pt', fontWeight: sT?.fontWeight || 'bold', 
              color: sT?.color || primaryColor, borderColor: sC?.borderColor || primaryColor,
              paddingBottom: '5px'
            }}
            onClick={(e) => handleElementClick(e, 'study_content', 'title')}
          >
            Resonancia Magnética de Cráneo
          </span>
        </div>
        
        <div 
          className={`transition-colors cursor-pointer rounded p-1 -m-1 ${isSelected('element', 'study_content', 'report') ? 'bg-accent/10 outline outline-1 outline-accent' : 'hover:bg-slate-200/50'}`}
          onClick={(e) => handleElementClick(e, 'study_content', 'report')}
        >
          <h3 style={{ fontFamily: sR?.fontFamily || 'sans-serif', fontSize: sR?.fontSize ? `calc(${sR.fontSize} + 2pt)` : '14pt', fontWeight: 'bold', color: '#0f172a' }} className="mb-2">Hallazgos y Diagnóstico</h3>
          <p style={{ fontFamily: sR?.fontFamily || 'sans-serif', fontSize: sR?.fontSize || '12pt', fontWeight: sR?.fontWeight || 'normal', color: sR?.color || '#334155' }} className="text-justify leading-relaxed">
            Se visualiza parénquima cerebral de morfología y señal conservada. No se aprecian lesiones isquémicas ni hemorrágicas recientes. Sistema ventricular de tamaño, forma y situación normales. Surcos de la convexidad y cisternas de la base sin alteraciones.
            <br/><br/>
            <strong>Conclusión:</strong> Estudio dentro de límites normales.
          </p>
        </div>
      </div>
    );
  };

  const renderSignatures = () => {
    const s = getS('signatures');
    const sC = s.container; const sT = s.text;

    return (
      <div 
        className={`mt-12 text-right pr-10 p-4 rounded border-2 transition-colors cursor-pointer ${isSelected('section', 'signatures') ? 'border-accent shadow-sm' : 'border-transparent hover:border-slate-300'}`}
        style={{ backgroundColor: sC?.backgroundColor || 'transparent' }}
        onClick={(e) => { e.stopPropagation(); setSelectedElement({ type: 'body_section', sectionId: 'signatures' }); }}
      >
        <div 
          className={`inline-block border-t w-48 text-center pt-2 transition-colors cursor-pointer rounded ${isSelected('element', 'signatures', 'text') ? 'bg-accent/10 outline outline-1 outline-accent' : 'hover:bg-slate-200/50'}`}
          style={{ 
            fontFamily: sT?.fontFamily || 'sans-serif', fontSize: sT?.fontSize || '10pt', fontWeight: sT?.fontWeight || 'bold', 
            color: sT?.color || '#334155', borderColor: sC?.borderColor || sT?.color || '#334155'
          }}
          onClick={(e) => handleElementClick(e, 'signatures', 'text')}
        >
          Firma del Médico Radiólogo
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Configuration Sidebar */}
      <div className="lg:w-1/3">
        {renderPropertiesPanel()}

        <div className="mt-8 pt-6 border-t border-slate-200">
          <button 
            type="button"
            onClick={onPreview}
            disabled={isPreviewing}
            className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg shadow-md hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isPreviewing ? (
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined">picture_as_pdf</span>
            )}
            {isPreviewing ? 'Generando Preview...' : 'Previsualizar PDF Completo'}
          </button>
        </div>
      </div>

      {/* Visual Live Preview Canvas */}
      <div className="lg:w-2/3">
        <div 
          className="bg-slate-200 p-8 rounded-xl flex items-center justify-center min-h-[600px] overflow-x-auto shadow-inner cursor-default"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedElement({ type: 'global' });
          }}
        >
          
          <div 
            className="bg-white shadow-2xl w-[21cm] min-h-[29.7cm] flex flex-col relative shrink-0 origin-top scale-[0.6] sm:scale-75 md:scale-90 xl:scale-100 transition-all duration-300"
            style={currentLayout.body?.pageBackgroundUrl ? {
              backgroundImage: `url(${currentLayout.body.pageBackgroundUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            } : {}}
            onClick={() => setSelectedElement({ type: 'global' })}
          >
            
            {currentLayout.body?.pageBackgroundUrl && (
              <div className="absolute inset-0 bg-white/90 z-0 pointer-events-none"></div>
            )}
            
            <div className="absolute inset-x-[2cm] inset-y-[2.5cm] border border-dashed border-slate-200/30 pointer-events-none z-0"></div>

            <header 
              className="mt-[1cm] mx-[2cm] pb-3 mb-8 border-b-2 flex items-center z-10 min-h-[80px]"
              style={{ 
                borderColor: primaryColor,
                justifyContent: currentLayout.header.alignment === 'space-between' ? 'space-between' :
                                currentLayout.header.alignment === 'center' ? 'center' :
                                currentLayout.header.alignment === 'right' ? 'flex-end' : 'flex-start'
              }}
            >
              {currentLayout.header.items.map(item => {
                const isSelected = selectedElement.type === 'header_item' && selectedElement.id === item.id;
                return (
                  <div 
                    key={item.id} 
                    className={`mx-2 p-2 border-2 cursor-pointer transition-colors ${isSelected ? 'border-accent bg-accent/5' : 'border-transparent hover:border-slate-300 hover:bg-slate-50'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElement({ type: 'header_item', id: item.id });
                    }}
                  >
                    {item.type === 'image' ? (
                      <img src={item.url} style={{ width: item.width || '150px', maxHeight: '80px', objectFit: 'contain' }} alt="Logo" />
                    ) : (
                      <div style={{ 
                        fontSize: item.fontSize || '14pt', 
                        fontWeight: item.fontWeight === 'normal' ? 'normal' : 'bold', 
                        color: item.color || '#0f172a',
                        fontFamily: item.fontFamily || 'sans-serif' 
                      }}>
                        {item.content || 'Escribe aquí...'}
                      </div>
                    )}
                  </div>
                );
              })}
            </header>

            <main 
              className={`mx-[2cm] flex-1 z-10 p-2 border-2 cursor-pointer transition-colors ${selectedElement.type === 'body' ? 'border-accent bg-accent/5' : 'border-transparent hover:border-slate-300 hover:bg-slate-50'}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedElement({ type: 'body' });
              }}
            >
              {(currentLayout.body?.blocks || ['patient_info', 'study_content', 'signatures']).map(block => (
                <div key={block}>
                  {block === 'patient_info' && renderPatientInfo()}
                  {block === 'study_content' && renderStudyContent()}
                  {block === 'signatures' && renderSignatures()}
                </div>
              ))}
            </main>

            <footer 
              className={`mx-[2cm] mb-[1cm] pt-3 border-t-2 text-center p-2 cursor-pointer transition-colors ${selectedElement.type === 'footer' ? 'border-accent bg-accent/5' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'}`}
              style={{ fontSize: currentLayout.footer.fontSize, color: currentLayout.footer.color }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedElement({ type: 'footer' });
              }}
            >
              <div className="font-semibold text-rose-500 mb-1 font-sans">ESTE ES UN DOCUMENTO DE PREVISUALIZACIÓN - NO VÁLIDO PARA DIAGNÓSTICO</div>
              <div className="font-sans whitespace-pre-wrap">{currentLayout.footer.text || 'Agregar información al pie...'}</div>
            </footer>

          </div>
        </div>
      </div>
    </div>
  );
}
