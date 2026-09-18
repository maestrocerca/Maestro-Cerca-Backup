import React, { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
  Eye,
  Check,
  X
} from 'lucide-react';
import { Maestro } from '../types';
import {
  parseManyChatCSV,
  ManyChatParseResult,
  ParsedManyChatRow,
  CanonicalField,
  HeaderMapping,
} from '../lib/manychatCsv';

export interface ManyChatImporterProps {
  onImport: (leads: Array<Partial<Maestro>>) => Promise<{ imported: number; skipped: number; errors: number }>;
  existingMaestros: Maestro[];
}

const FIELD_LABELS: Record<CanonicalField, string> = {
  nombre: 'Nombre completo',
  apellidos: 'Apellidos',
  oficioPrincipal: 'Oficio principal',
  serviciosAdicionales: 'Servicios adicionales',
  ciudad: 'Ciudad / Municipio',
  zonas: 'Zonas de cobertura',
  experiencia: 'Años de experiencia',
  telefono: 'Teléfono celular',
  disponibilidad: 'Disponibilidad de horario',
  finishedAt: 'Fecha de finalización',
  manychatId: 'ID de ManyChat',
};

export const ManyChatImporter: React.FC<ManyChatImporterProps> = ({ onImport, existingMaestros }) => {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parseResult, setParseResult] = useState<ManyChatParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showMappingDetails, setShowMappingDetails] = useState(true);

  const processContent = (content: string) => {
    setErrorMsg('');
    setImportResult(null);

    if (!content.trim()) {
      setParseResult(null);
      return;
    }

    const result = parseManyChatCSV(content, { existingMaestros });
    if (result.error) {
      setErrorMsg(result.error);
      setParseResult(null);
    } else {
      setParseResult(result);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setCsvText(text);
      processContent(text);
    };
    reader.readAsText(file);
  };

  const handleRunImport = async () => {
    if (!parseResult) return;

    const validRows = parseResult.rows.filter((r) => r.status === 'valid');
    if (validRows.length === 0) {
      setErrorMsg('No hay registros válidos listos para importar.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      // Extraer payload canónico cumpliendo el contrato estricto
      const payload: Array<Partial<Maestro>> = validRows.map((r) => r.lead);

      const res = await onImport(payload);
      setImportResult(res);

      // Actualizar estado de las filas importadas
      setParseResult((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          rows: prev.rows.map((r) =>
            r.status === 'valid'
              ? { ...r, status: 'duplicate', statusReason: 'Recién importado a la colección /maestros' }
              : r
          ),
          stats: {
            ...prev.stats,
            valid: 0,
            duplicate: prev.stats.duplicate + prev.stats.valid,
          },
        };
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ocurrió un error al importar los registros. Intenta nuevamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setCsvText('');
    setFileName('');
    setParseResult(null);
    setImportResult(null);
    setErrorMsg('');
  };

  const sampleCsvSnippet = `User Id,User,"¿Cuál es tu nombre completo? 👤\\n(Por favor escribe tu nombre y apellidos)","¿Cuál es tu oficio principal o especialidad? 🔨","¿Qué otros servicios o trabajos realizas?","¿En qué ciudad o municipio vives?","¿A qué zonas, municipios o ciudades puedes trasladarte?","¿Cuántos años de experiencia tienes en tu oficio?","¿Cuál es tu número de teléfono celular para que te contacten los clientes? 📱","¿Cuál es tu disponibilidad de horario o días?",Finished At
10982374,"Carlos","Carlos Mario Mendoza García","Albañil","Pegado de tabique, aplanados, colado de losas","Querétaro","Juriquilla, El Refugio, Zibatá","12","4421234567","Lunes a Sábado de 8am a 6pm","2026-09-18 10:20:00"`;

  return (
    <div id="manychat-csv-importer" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-orange-600" />
            <span>Importador de Leads ManyChat (CSV)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Normalización difusa y mapeo resiliente de preguntas de chatbot ManyChat directamente a la colección canónica{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-orange-700 font-mono font-bold">/maestros</code> con IDs deterministas e idempotencia.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Fuzzy Pattern Matching v2</span>
          </span>
        </div>
      </div>

      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Box 1: File Drop & Select */}
        <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center shadow-xs">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Cargar archivo CSV exportado de ManyChat</p>
            <p className="text-xs text-slate-500 mt-0.5 max-w-sm">
              Soporta preguntas extensas con emojis, saltos de línea dentro de comillas, notación científica y formatos limpios.
            </p>
          </div>
          <label className="py-2.5 px-5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors">
            <span>Seleccionar archivo (.csv)</span>
            <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
          </label>
          {fileName && (
            <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Archivo: {fileName}</span>
            </p>
          )}
        </div>

        {/* Box 2: Direct Textarea Paste */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>O pega aquí el texto CSV directamente:</span>
            {csvText && (
              <button
                type="button"
                onClick={handleClear}
                className="text-slate-400 hover:text-red-600 cursor-pointer transition-colors"
              >
                Limpiar todo
              </button>
            )}
          </div>
          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              processContent(e.target.value);
            }}
            placeholder={sampleCsvSnippet}
            className="w-full p-3 bg-slate-50 border border-slate-300 rounded-2xl text-[11px] font-mono focus:bg-white focus:outline-hidden focus:border-orange-500 leading-relaxed"
          />
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Success banner */}
      {importResult && (
        <div className="p-5 rounded-2xl bg-green-50 border border-green-200 text-green-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-green-900">
            <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0" />
            <span>Importación completada en la colección canónica /maestros</span>
          </div>
          <p className="text-xs text-green-800 leading-relaxed">
            • <strong>{importResult.imported}</strong> registros guardados con estatus <code>status: 'draft'</code> y <code>onboardingIncomplete: true</code>.<br />
            • <strong>{importResult.skipped}</strong> omitidos por duplicidad telefónica o ID preexistente.<br />
            {importResult.errors > 0 && <span>• <strong>{importResult.errors}</strong> omitidos por errores de validación.<br /></span>}
            Cada documento fue creado de forma determinista con el prefijo <code>mc_</code> garantizando idempotencia.
          </p>
        </div>
      )}

      {/* Mappings & Detections Badge Bar */}
      {parseResult && parseResult.mappings.length > 0 && (
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-bold text-slate-800">
                Columnas y Preguntas de Chatbot Reconocidas ({parseResult.detectedFields.length} detectadas)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowMappingDetails(!showMappingDetails)}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
            >
              {showMappingDetails ? 'Ocultar detalles' : 'Ver mapeo completo'}
            </button>
          </div>

          {showMappingDetails && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
              {parseResult.mappings.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between ${
                    m.canonicalField
                      ? 'bg-white border-orange-200/80 shadow-2xs'
                      : 'bg-slate-100/70 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="truncate text-slate-600 font-medium" title={m.rawHeader}>
                    Col #{idx + 1}: &quot;{m.rawHeader}&quot;
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    {m.canonicalField ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-800">
                        ➜ {FIELD_LABELS[m.canonicalField]}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-200 text-slate-500">
                        Descartado (metadata)
                      </span>
                    )}
                    {m.matchedPattern && (
                      <span className="text-[10px] text-slate-400 truncate max-w-[90px]" title={m.matchedPattern}>
                        ({m.matchedPattern})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats bar & Import Action */}
      {parseResult && parseResult.rows.length > 0 && (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                Registros: {parseResult.stats.total}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                {parseResult.stats.valid} listos
              </span>
              {parseResult.stats.duplicate > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                  {parseResult.stats.duplicate} ya existentes
                </span>
              )}
              {parseResult.stats.invalid > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                  {parseResult.stats.invalid} datos incompletos
                </span>
              )}
            </div>

            <button
              type="button"
              id="run-manychat-import-btn"
              disabled={parseResult.stats.valid === 0 || isProcessing}
              onClick={handleRunImport}
              className="py-2.5 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Escribiendo en /maestros...</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  <span>Importar {parseResult.stats.valid} leads a /maestros</span>
                </>
              )}
            </button>
          </div>

          {/* Interactive Preview Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Nombre y Apellidos</th>
                    <th className="py-2.5 px-4">Teléfono Sanitizado</th>
                    <th className="py-2.5 px-4">ID Determinista</th>
                    <th className="py-2.5 px-4">Oficio Principal</th>
                    <th className="py-2.5 px-4">Ciudad / Zonas</th>
                    <th className="py-2.5 px-4">Experiencia</th>
                    <th className="py-2.5 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {parseResult.rows.map((row) => {
                    const lead = row.lead;
                    return (
                      <tr
                        key={row.rowIndex}
                        className={
                          row.status === 'valid'
                            ? 'hover:bg-orange-50/40'
                            : 'bg-slate-50/60 opacity-75'
                        }
                      >
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          <div>{lead.nombre}</div>
                          {lead.apellidos && lead.apellidos !== lead.nombre && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              Apellidos: {lead.apellidos}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">
                          {lead.telefono ? (
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                              {lead.telefono}
                            </span>
                          ) : (
                            <span className="text-red-500 italic">No válido</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500">
                          <code>{lead.id}</code>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {lead.oficioPrincipal}
                          </span>
                          {lead.serviciosAdicionales && (
                            <p className="text-[10px] text-slate-400 truncate max-w-[140px] mt-0.5" title={lead.serviciosAdicionales}>
                              + {lead.serviciosAdicionales}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          <div className="font-semibold">{lead.ciudad}</div>
                          {lead.zonas && lead.zonas !== lead.ciudad && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[120px]" title={lead.zonas}>
                              {lead.zonas}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">
                          {lead.experiencia ? `${lead.experiencia} años` : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {row.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Listo (Borrador)</span>
                            </span>
                          ) : row.status === 'duplicate' ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700"
                              title={row.statusReason}
                            >
                              <span>Ya en plataforma</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700"
                              title={row.statusReason}
                            >
                              <AlertCircle className="w-3 h-3" />
                              <span>{row.statusReason || 'Dato inválido'}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ManyChatCsvImporter = ManyChatImporter;
