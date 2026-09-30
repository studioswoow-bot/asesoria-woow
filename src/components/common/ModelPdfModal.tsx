"use client";

import React, { useState, useEffect } from "react";
import ModelAvatar from "@/components/common/ModelAvatar";
import {
  fetchCompleteModelPdfData,
  downloadModelSummaryPdf,
  saveModelInterviewNotes,
  ModelPdfData,
} from "@/lib/pdfGenerator";

interface ModelPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelId: string | null;
  initialData?: ModelPdfData | null;
}

export default function ModelPdfModal({
  isOpen,
  onClose,
  modelId,
  initialData,
}: ModelPdfModalProps) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [modelData, setModelData] = useState<ModelPdfData | null>(initialData || null);
  const [notes, setNotes] = useState("");
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !modelId) return;

    async function loadData() {
      setLoading(true);
      setStatusMessage(null);
      try {
        const data = await fetchCompleteModelPdfData(modelId!);
        if (data) {
          setModelData(data);
          setNotes(data.interviewNotes || "");
        }
      } catch (err) {
        console.error("Error al cargar datos para el PDF:", err);
      } finally {
        setLoading(false);
      }
    }

    if (!initialData || initialData.id !== modelId) {
      loadData();
    } else {
      setModelData(initialData);
      setNotes(initialData.interviewNotes || "");
    }
  }, [isOpen, modelId, initialData]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!modelData) return;
    setGenerating(true);
    setStatusMessage("Generando documento PDF de alta calidad...");

    try {
      // Si el usuario marcó guardar notas y hay notas editadas
      if (saveToProfile && notes.trim() !== (modelData.interviewNotes || "").trim()) {
        await saveModelInterviewNotes(modelData.id, notes.trim());
      }

      // Generar y descargar el PDF con las notas
      await downloadModelSummaryPdf(modelData, notes.trim());
      setStatusMessage("¡PDF descargado con éxito!");

      setTimeout(() => {
        onClose();
        setStatusMessage(null);
      }, 1500);
    } catch (error: any) {
      console.error("Error al generar PDF:", error);
      setStatusMessage("Error al generar el PDF. Por favor intenta de nuevo.");
    } finally {
      setGenerating(false);
    }
  };

  const displayName =
    modelData?.artisticName ||
    modelData?.nickname ||
    modelData?.name ||
    "Modelo";

  const totalKinks = modelData?.selectedKinks?.length || 0;
  const totalToys = modelData?.selectedToys?.length || 0;
  const totalOutfits =
    (modelData?.selectedOutfits?.length || 0) +
    (modelData?.customOutfits?.length || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-panel-dark border border-text-main/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header con gradiente institucional */}
        <div className="bg-gradient-to-r from-primary to-primary-dark p-6 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/15 flex items-center justify-center text-white backdrop-blur-md">
              <span className="material-symbols-outlined text-2xl">picture_as_pdf</span>
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                Generar Ficha PDF para IA Local
              </h3>
              <p className="text-xs text-white/80">
                Resumen ejecutivo con características, juguetes, shows y prompt para LLMs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="size-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-text-muted font-bold uppercase tracking-wider">
                Recopilando ficha de la modelo...
              </p>
            </div>
          ) : !modelData ? (
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center text-red-400 text-sm">
              No se pudo cargar la información de esta modelo.
            </div>
          ) : (
            <>
              {/* Tarjeta resumen rápida de la modelo */}
              <div className="p-4 bg-text-main/5 border border-text-main/10 rounded-2xl flex items-center gap-4">
                <ModelAvatar
                  name={modelData.name}
                  nickname={modelData.nickname || modelData.artisticName}
                  photoUrl={modelData.photo_url}
                  size="xl"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-text-main truncate">
                      {displayName}
                    </h4>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        ["active", "activa", "activo", "online"].includes(
                          (modelData.status || "").toLowerCase()
                        )
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-red-500/15 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {modelData.status || "Activa"}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">
                    Nombre real: {modelData.name} {modelData.lastName || ""}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                    <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md font-bold">
                      {totalToys} Juguetes
                    </span>
                    <span className="bg-accent-gold/10 text-accent-gold border border-accent-gold/20 px-2 py-0.5 rounded-md font-bold">
                      {totalKinks} Shows / Kinks
                    </span>
                    <span className="bg-text-main/10 text-text-muted px-2 py-0.5 rounded-md font-bold">
                      {totalOutfits} Outfits
                    </span>
                    {modelData.platforms && modelData.platforms.length > 0 && (
                      <span className="bg-text-main/10 text-text-muted px-2 py-0.5 rounded-md">
                        {modelData.platforms.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Qué se incluirá en el PDF */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">verified</span>
                  Contenido incluido en el PDF para la IA:
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
                  <div className="flex items-center gap-2 p-2 bg-text-main/5 rounded-xl border border-text-main/5">
                    <span className="material-symbols-outlined text-primary text-sm">photo_camera</span>
                    <span>Foto de la modelo</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-text-main/5 rounded-xl border border-text-main/5">
                    <span className="material-symbols-outlined text-primary text-sm">straighten</span>
                    <span>Morfología y rasgos físicos</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-text-main/5 rounded-xl border border-text-main/5">
                    <span className="material-symbols-outlined text-accent-gold text-sm">toys</span>
                    <span>Inventario de juguetes ({totalToys})</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-text-main/5 rounded-xl border border-text-main/5">
                    <span className="material-symbols-outlined text-accent-gold text-sm">theater_comedy</span>
                    <span>Shows, kinks y fetiches ({totalKinks})</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-text-main/5 rounded-xl border border-text-main/5">
                    <span className="material-symbols-outlined text-emerald-400 text-sm">checkroom</span>
                    <span>Vestuarios y estilismo ({totalOutfits})</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-text-main/5 rounded-xl border border-text-main/5">
                    <span className="material-symbols-outlined text-emerald-400 text-sm">smart_toy</span>
                    <span>Prompt optimizado para LLMs</span>
                  </div>
                </div>
              </div>

              {/* Lo que se habló con la modelo (editable) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">forum</span>
                    Resumen de lo hablado con la modelo (Entrevista / Notas):
                  </label>
                  <span className="text-[10px] text-text-muted">Se incluirá en el PDF</span>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Escribe o amplía aquí lo que se conversó con la modelo: límites personales, dinámica de show favorita, personalidad que proyecta, metas semanales, disponibilidad de horarios o temas de conversación preferidos..."
                  rows={4}
                  className="w-full bg-text-main/5 border border-text-main/15 rounded-2xl p-4 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-text-muted/60"
                />

                <label className="flex items-center gap-2 cursor-pointer text-xs text-text-muted hover:text-text-main transition-colors">
                  <input
                    type="checkbox"
                    checked={saveToProfile}
                    onChange={(e) => setSaveToProfile(e.target.checked)}
                    className="rounded text-primary focus:ring-primary border-text-main/20 bg-text-main/5 size-4"
                  />
                  <span>Guardar estas notas en el perfil de la modelo en la base de datos</span>
                </label>
              </div>

              {/* Mensaje de estado */}
              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold text-center ${
                    statusMessage.includes("éxito")
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : statusMessage.includes("Error")
                      ? "bg-red-500/15 text-red-400 border border-red-500/30"
                      : "bg-primary/10 text-primary border border-primary/20"
                  }`}
                >
                  {statusMessage}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer con botones de acción */}
        <div className="p-4 bg-text-main/5 border-t border-text-main/10 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-5 py-2.5 rounded-xl border border-text-main/15 text-xs font-bold text-text-muted hover:text-text-main hover:bg-text-main/5 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleDownload}
            disabled={generating || loading || !modelData}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Generando PDF...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>Descargar PDF para IA</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
