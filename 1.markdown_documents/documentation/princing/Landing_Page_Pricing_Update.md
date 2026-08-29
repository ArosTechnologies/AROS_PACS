# Actualización de Landing Page: Sección de Precios y Propuesta de Valor

Este documento contiene el *copywriting* (textos comerciales), la estructura de los planes de precios y el código fuente para implementar una gráfica interactiva de ahorro en tu Landing Page actual (`/Users/ivanvivas/Repositories/LandingPage`).

---

## 1. Encabezado y Propuesta de Valor (Copywriting)

**Título Principal:** "Crece sin límites. Paga solo lo justo."
**Subtítulo:** "El primer PACS 100% Cloud-Native que no te castiga por tener éxito. Con nuestro modelo *Bring Your Own Storage* (BYOS), pagas una suscripción plana y el costo real de tu almacenamiento a AWS. Despídete del abusivo cobro 'por estudio'."

**3 Beneficios Clave (Para destacar con íconos):**
1. **Soberanía de Datos (BYOS):** Las imágenes viven en TU cuenta de AWS. Eres 100% dueño de tus datos. Sin cuotas de retención o extracción.
2. **Privacidad Garantizada:** Arquitectura *Zero Data Retention*. AROS no guarda un solo byte de la información clínica de tus pacientes en sus servidores centrales.
3. **Escalabilidad Real:** Ahorra hasta un 80% en costos de software a medida que tu volumen de estudios crece.

---

## 2. Tabla Comparativa de Planes de Precios

A continuación, la tabla comparativa sugerida para la sección de "Pricing" de tu página. Esta estructura visual facilitará a los clientes decidir el plan adecuado.

| Característica / Funcionalidad | 🟢 Starter (Pequeñas) | 🔵 Professional (Medianas) | 🟣 Enterprise (Grandes) |
|---|:---:|:---:|:---:|
| **Precio AROS / mes** | **$115 USD** | **$250 USD** | **$600 USD** |
| **Volumen Recomendado** | Hasta 300 estudios | Hasta 1,500 estudios | +1,500 estudios |
| **Costo AWS Estimado (Pago directo a AWS)**| ~$75 USD/mes | ~$130 USD/mes | ~$320+ USD/mes |
| **Visor Web DICOM (OHIF) a 0 latencia** | ✅ | ✅ | ✅ |
| **Almacenamiento Propio (BYOS)** | ✅ | ✅ | ✅ |
| **Privacidad Zero Data Retention** | ✅ | ✅ | ✅ |
| **Conexión de Modalidades (Equipos)** | ✅ Ilimitadas | ✅ Ilimitadas | ✅ Ilimitadas |
| **Soporte Múltiples Sucursales** | ✅ | ✅ | ✅ |
| **Integraciones (RIS/HIS, API, SSO)** | ✅ | ✅ | ✅ |
| **Canal de Asistencia** | Email y Tickets | Email y Chat en Vivo | Teléfono y Canal Privado (Slack/Teams) |
| **Tiempo de Respuesta (SLA)** | 48 horas | 12 horas | 2 horas (Soporte 24/7) |
| **Monitoreo Proactivo de AWS** | ❌ | ✅ | ✅ |
| **Gerente de Cuenta Dedicado (CSM)** | ❌ | ❌ | ✅ |
| **Prioridad en Nuevas Funciones (Early Access)** | ❌ | ❌ | ✅ |

---

## 3. Gráfica Interactiva de Ahorro (Componente React)

Para que el cliente vea exactamente cuánto ahorrará, aquí tienes el código de un componente interactivo para tu proyecto en React/Next.js. Utiliza la librería `recharts`.

> **Nota de instalación:** En la terminal de tu Landing Page ejecuta: `npm install recharts lucide-react`

Crea un archivo llamado `SavingsChart.tsx` en tu carpeta de componentes e inserta este código:

```tsx
import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';

// Datos pre-calculados basados en el modelo de precios de AROS v2.0
const data = [
  { estudios: 150, aros: 190, competencia: 274, ahorro: 84 },
  { estudios: 300, aros: 195, competencia: 549, ahorro: 354 },
  { estudios: 600, aros: 205, competencia: 1098, ahorro: 893 },
  { estudios: 1000, aros: 225, competencia: 1830, ahorro: 1605 },
  { estudios: 1500, aros: 380, competencia: 2745, ahorro: 2365 }, // Plan Pro
  { estudios: 3000, aros: 920, competencia: 5490, ahorro: 4570 }  // Plan Enterprise
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const ahorroAnual = payload[0].payload.ahorro * 12;
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-xl">
        <p className="font-bold text-gray-800 mb-2">{label} Estudios al mes</p>
        <div className="space-y-1 text-sm">
          <p className="text-red-500 font-medium">Competencia: ${payload[1].value} / mes</p>
          <p className="text-blue-600 font-bold">AROS Total: ${payload[0].value} / mes</p>
          <hr className="my-2" />
          <p className="text-green-600 font-bold text-lg">
            Ahorro: ${payload[0].payload.ahorro} / mes
          </p>
          <p className="text-green-700 text-xs font-bold bg-green-50 inline-block px-2 py-1 rounded">
            (${ahorroAnual.toLocaleString()} dólares al año)
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export default function SavingsChart() {
  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="mb-6 text-center">
        <h3 className="text-2xl font-bold text-gray-900">La "Trampa" del Cobro por Estudio</h3>
        <p className="text-gray-500 mt-2">Pasa el cursor sobre la gráfica para ver cuánto dinero pierdes cada mes con otros sistemas.</p>
      </div>
      
      <div className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis 
              dataKey="estudios" 
              tick={{fill: '#6b7280'}} 
              tickLine={false}
              label={{ value: 'Estudios por mes', position: 'bottom', fill: '#6b7280' }}
            />
            <YAxis 
              tickFormatter={(value) => `$${value}`} 
              tick={{fill: '#6b7280'}}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={36} />
            
            <Line 
              name="AROS (Suscripción + AWS)" 
              type="monotone" 
              dataKey="aros" 
              stroke="#2563eb" 
              strokeWidth={4}
              dot={{ r: 6, strokeWidth: 2, fill: 'white' }}
              activeDot={{ r: 8, fill: '#2563eb', stroke: 'white', strokeWidth: 3 }}
            />
            <Line 
              name="Competencia ($1.83/estudio)" 
              type="monotone" 
              dataKey="competencia" 
              stroke="#ef4444" 
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={{ r: 4, fill: '#ef4444' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

### Instrucciones de uso para la Landing Page:
1. Copia y pega el componente `SavingsChart.tsx` en tu carpeta `src/components/`.
2. Importa el componente dentro de tu archivo de Precios o directamente en el archivo `ProductPacs.tsx`.
3. Al interactuar con él en tu navegador, el usuario verá cómo la línea roja de la competencia se dispara agresivamente, mientras la línea azul de AROS se mantiene plana, resaltando el ahorro masivo al año (ej: $19,000 USD anuales al llegar a 1000 estudios).
