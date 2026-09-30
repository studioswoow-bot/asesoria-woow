import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toysDataRaw from "@/data/toys.json";
import glossaryDataRaw from "@/data/glossary.json";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface ToyItem {
  name: string;
  use: string;
  category: string;
  brand: string;
}

interface GlossaryItem {
  term: string;
  definition: string;
}

const toysData: ToyItem[] = toysDataRaw as ToyItem[];
const glossaryData: GlossaryItem[] = glossaryDataRaw as GlossaryItem[];

export interface ModelPdfData {
  id: string;
  name: string;
  lastName?: string;
  nickname?: string;
  artisticName?: string;
  status?: string;
  shift?: string;
  age?: string | number;
  birth_date?: string;
  experience?: string;
  photo_url?: string | null;
  category?: string;
  platforms?: string[];
  accounts?: Array<{
    platformName: string;
    username: string;
    status?: string;
    comments?: string;
  }>;
  physicalAttributes?: Record<string, string>;
  selectedKinks?: string[];
  selectedToys?: string[];
  selectedOutfits?: string[];
  customOutfits?: string[];
  selectedHashtags?: string[];
  interviewNotes?: string;
  room?: string;
  whatsapp?: string;
}

/**
 * Convierte una imagen (URL pública o Firebase Storage) a Base64 usando el endpoint proxy
 */
export async function fetchImageAsBase64(url: string): Promise<string | null> {
  if (!url || typeof window === "undefined") return null;

  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Proxy error ${res.status}`);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Fallo al cargar imagen vía proxy, intentando directo:", err);
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("No se pudo cargar la imagen de la modelo:", e);
      return null;
    }
  }
}

/**
 * Calcula la edad a partir de la fecha de nacimiento si no viene dada
 */
function getCalculatedAge(age?: string | number, birthDate?: string): string {
  if (age && String(age).trim() !== "") {
    return `${age} años`;
  }
  if (birthDate) {
    try {
      const birth = new Date(birthDate);
      if (!isNaN(birth.getTime())) {
        const diff = Date.now() - birth.getTime();
        const ageYears = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        if (ageYears > 0 && ageYears < 100) {
          return `${ageYears} años`;
        }
      }
    } catch {
      // Ignorar error de parsing
    }
  }
  return "No especificada";
}

/**
 * Genera el documento PDF resumen para la modelo
 */
export async function generateModelSummaryPdf(
  modelData: ModelPdfData,
  userNotes?: string
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  // Paleta de colores Estudios WooW
  const PRIMARY_RGB: [number, number, number] = [142, 31, 77]; // Magenta institucional #8E1F4D
  const PRIMARY_DARK_RGB: [number, number, number] = [98, 18, 51]; // #621233
  const ACCENT_GOLD_RGB: [number, number, number] = [201, 162, 39]; // Dorado #C9A227
  const TEXT_MAIN_RGB: [number, number, number] = [30, 30, 36];
  const TEXT_MUTED_RGB: [number, number, number] = [100, 100, 110];
  const BG_LIGHT_RGB: [number, number, number] = [248, 249, 251];
  const BORDER_RGB: [number, number, number] = [220, 224, 230];

  // Cargar imagen de la modelo si está disponible
  let base64Photo: string | null = null;
  if (modelData.photo_url) {
    try {
      base64Photo = await fetchImageAsBase64(modelData.photo_url);
    } catch (e) {
      console.warn("No se pudo obtener imagen base64:", e);
    }
  }

  // --- ENCABEZADO SUPERIOR ELEGANTE ---
  doc.setFillColor(...PRIMARY_RGB);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Barra dorada decorativa debajo del header
  doc.setFillColor(...ACCENT_GOLD_RGB);
  doc.rect(0, 28, pageWidth, 2.5, "F");

  // Texto del encabezado
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ESTUDIOS WOOW • FICHA INTEGRAL DE MODELO", marginX, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(245, 230, 235);
  doc.text(
    "EXPEDIENTE DE CARACTERIZACIÓN Y PERFILAMIENTO ESTRATÉGICO PARA IA LOCAL",
    marginX,
    20
  );

  const formattedDate = new Date().toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Fecha: ${formattedDate}`, pageWidth - marginX, 13, { align: "right" });
  doc.text(`ID: ${modelData.id.substring(0, 10)}`, pageWidth - marginX, 20, {
    align: "right",
  });

  // --- TARJETA DE IDENTIFICACIÓN CON FOTO ---
  let currentY = 36;
  const cardHeight = 44;

  // Fondo de tarjeta de modelo
  doc.setFillColor(...BG_LIGHT_RGB);
  doc.setDrawColor(...BORDER_RGB);
  doc.roundedRect(marginX, currentY, contentWidth, cardHeight, 3, 3, "FD");

  // Espacio para la foto (a la izquierda)
  const photoSize = 36;
  const photoX = marginX + 4;
  const photoY = currentY + 4;

  if (base64Photo) {
    try {
      // Dibujar imagen
      doc.addImage(
        base64Photo,
        "JPEG",
        photoX,
        photoY,
        photoSize,
        photoSize,
        undefined,
        "FAST"
      );
      // Marco decorativo para la foto
      doc.setDrawColor(...PRIMARY_RGB);
      doc.setLineWidth(0.8);
      doc.rect(photoX, photoY, photoSize, photoSize, "S");
    } catch (e) {
      console.warn("Fallo insertando imagen en PDF:", e);
      drawAvatarFallback();
    }
  } else {
    drawAvatarFallback();
  }

  function drawAvatarFallback() {
    doc.setFillColor(235, 235, 240);
    doc.rect(photoX, photoY, photoSize, photoSize, "F");
    doc.setDrawColor(...BORDER_RGB);
    doc.rect(photoX, photoY, photoSize, photoSize, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...PRIMARY_RGB);
    const initials = (modelData.artisticName || modelData.name || "M")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
    doc.text(initials, photoX + photoSize / 2, photoY + photoSize / 2 + 5, {
      align: "center",
    });
  }

  // Datos principales al lado de la foto
  const infoX = photoX + photoSize + 6;
  let infoY = currentY + 7;

  const displayName =
    modelData.artisticName ||
    modelData.nickname ||
    modelData.name ||
    "Modelo sin apodo";
  const legalName =
    modelData.name + (modelData.lastName ? ` ${modelData.lastName}` : "");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PRIMARY_RGB);
  doc.text(displayName, infoX, infoY);

  // Badge de Estado
  const statusStr = (modelData.status || "Activa").toUpperCase();
  const isOnlineOrActive = ["ACTIVE", "ACTIVA", "ACTIVO", "ONLINE"].includes(
    statusStr
  );
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  if (isOnlineOrActive) {
    doc.setFillColor(34, 197, 94); // Verde
  } else {
    doc.setFillColor(239, 68, 68); // Rojo
  }
  const badgeWidth = doc.getTextWidth(statusStr) + 8;
  const badgeX = pageWidth - marginX - badgeWidth - 4;
  doc.roundedRect(badgeX, currentY + 4, badgeWidth, 6, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(statusStr, badgeX + badgeWidth / 2, currentY + 8.2, { align: "center" });

  infoY += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED_RGB);
  doc.text(`Nombre real: ${legalName}`, infoX, infoY);

  infoY += 6;
  // Fila de datos rápidos
  const ageCalculated = getCalculatedAge(modelData.age, modelData.birth_date);
  const expStr =
    modelData.experience === "nuevo"
      ? "Principiante / Sin experiencia"
      : modelData.experience === "more"
      ? "Experimentada / Con trayectoria previa"
      : modelData.experience || "No especificada";

  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_MAIN_RGB);
  doc.text(`• Edad: `, infoX, infoY);
  doc.setFont("helvetica", "bold");
  doc.text(`${ageCalculated}`, infoX + 13, infoY);

  doc.setFont("helvetica", "normal");
  doc.text(`• Turno: `, infoX + 48, infoY);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${(modelData.shift || "No asignado").toUpperCase()}`,
    infoX + 62,
    infoY
  );

  doc.setFont("helvetica", "normal");
  doc.text(`• Categoría: `, infoX + 96, infoY);
  doc.setFont("helvetica", "bold");
  doc.text(`${modelData.category || "General"}`, infoX + 115, infoY);

  infoY += 5.5;
  doc.setFont("helvetica", "normal");
  doc.text(`• Experiencia: `, infoX, infoY);
  doc.setFont("helvetica", "bold");
  doc.text(`${expStr}`, infoX + 22, infoY);

  infoY += 5.5;
  // Plataformas activas y cuentas
  const platformsList =
    modelData.platforms && modelData.platforms.length > 0
      ? modelData.platforms.join(", ")
      : "No registradas";
  doc.setFont("helvetica", "normal");
  doc.text(`• Plataformas: `, infoX, infoY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY_DARK_RGB);
  doc.text(`${platformsList}`, infoX + 23, infoY);

  currentY += cardHeight + 6;

  // --- SECCIÓN 1: CARACTERÍSTICAS FÍSICAS PRINCIPALES ---
  const physAttrs = modelData.physicalAttributes || {};
  const physicalRows: [string, string, string, string][] = [
    [
      "Etnia a trabajar:",
      physAttrs["Etnia a trabajar"] || "Latina",
      "Estatura:",
      physAttrs["Estatura"] || "No especificada",
    ],
    [
      "Tipo de Cabello:",
      physAttrs["Tipo de Cabello"] || "No especificado",
      "Color de Cabello:",
      physAttrs["Color de Cabello"] || "No especificado",
    ],
    [
      "Color de Ojos:",
      physAttrs["Color de Ojos"] || "No especificado",
      "Peso aproximado:",
      physAttrs["Peso"] || "No especificado",
    ],
    [
      "Busto / Senos:",
      physAttrs["Senos"] || "No especificado",
      "Nalgas / Cadera:",
      physAttrs["Nalga"] || "No especificada",
    ],
    [
      "Vello púbico:",
      physAttrs["Vello pubico"] || "No especificado",
      "Tatuajes:",
      physAttrs["Tatuajes"] || "Ninguno",
    ],
    [
      "Piercings:",
      physAttrs["Piercings"] || "Ninguno",
      "Habitación Estudio:",
      modelData.room || "Estudio Principal",
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [
      [
        {
          content: "1. CARACTERÍSTICAS FÍSICAS Y MORFOLOGÍA",
          colSpan: 4,
          styles: {
            fillColor: PRIMARY_RGB,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9.5,
          },
        },
      ],
    ],
    body: physicalRows.map((r) => [
      { content: r[0], styles: { fontStyle: "bold", textColor: TEXT_MUTED_RGB, cellWidth: 35 } },
      { content: r[1], styles: { textColor: TEXT_MAIN_RGB, cellWidth: 56 } },
      { content: r[2], styles: { fontStyle: "bold", textColor: TEXT_MUTED_RGB, cellWidth: 35 } },
      { content: r[3], styles: { textColor: TEXT_MAIN_RGB, cellWidth: 56 } },
    ]),
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      lineColor: BORDER_RGB,
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [252, 252, 253],
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // --- SECCIÓN 2: INVENTARIO DE JUGUETES TECNOLÓGICOS Y HERRAMIENTAS ---
  const selectedToys = modelData.selectedToys || [];
  let toysRows: [string, string, string][] = [];

  if (selectedToys.length > 0) {
    toysRows = selectedToys.map((toyName) => {
      const match = toysData.find(
        (t) => t.name.toLowerCase() === toyName.toLowerCase()
      );
      return [
        toyName,
        match?.category || "Accesorio / Juguete",
        match?.use || "Interacción en show",
      ];
    });
  } else {
    toysRows = [["Sin juguetes registrados", "General", "No se han marcado juguetes en el perfilamiento"]];
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [
      [
        {
          content: `2. INVENTARIO DE JUGUETES DISPONIBLES (${selectedToys.length} REGISTRADOS)`,
          colSpan: 3,
          styles: {
            fillColor: ACCENT_GOLD_RGB,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9.5,
          },
        },
      ],
      [
        { content: "Juguete / Dispositivo", styles: { fontStyle: "bold", cellWidth: 55 } },
        { content: "Categoría", styles: { fontStyle: "bold", cellWidth: 45 } },
        { content: "Uso y Dinámica en Transmisión", styles: { fontStyle: "bold" } },
      ],
    ],
    body: toysRows,
    theme: "striped",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: BORDER_RGB,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [60, 60, 65],
      textColor: [255, 255, 255],
    },
    alternateRowStyles: {
      fillColor: [250, 248, 252],
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // --- SECCIÓN 3: SHOWS, KINKS Y ESPECIALIDADES HABLADAS ---
  const selectedKinks = modelData.selectedKinks || [];
  let kinksFormatted = "";
  if (selectedKinks.length > 0) {
    kinksFormatted = selectedKinks.join(" • ");
  } else {
    kinksFormatted = "No se seleccionaron shows o kinks específicos en el formulario.";
  }

  // Vestuarios y lencería
  const allOutfits = [
    ...(modelData.selectedOutfits || []),
    ...(modelData.customOutfits || []),
  ];
  const outfitsFormatted =
    allOutfits.length > 0
      ? allOutfits.join(" • ")
      : "Vestuario estándar / lencería convencional";

  // Hashtags
  const hashtagsFormatted =
    modelData.selectedHashtags && modelData.selectedHashtags.length > 0
      ? modelData.selectedHashtags.join(" ")
      : "#woow #webcam #model";

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [
      [
        {
          content: `3. SHOWS, KINKS Y DINÁMICAS ACORDADAS (${selectedKinks.length} SELECCIONADOS)`,
          styles: {
            fillColor: PRIMARY_RGB,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9.5,
          },
        },
      ],
    ],
    body: [
      [
        {
          content:
            "Repertorio de Shows y Especialidades Permisibles:\n" +
            kinksFormatted +
            "\n\nVestuarios y Estilismo Disponible:\n" +
            outfitsFormatted +
            "\n\nHashtags y Nichos de Tráfico:\n" +
            hashtagsFormatted,
          styles: {
            cellPadding: 3.5,
            fontSize: 8,
            textColor: TEXT_MAIN_RGB,
            lineColor: BORDER_RGB,
            lineWidth: 0.2,
          },
        },
      ],
    ],
    theme: "plain",
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // --- SECCIÓN 4: RESUMEN DE CONVERSACIÓN / NOTAS DE ENTREVISTA ---
  // Recopilar notas del usuario, notas guardadas en perfil, o comentarios de cuentas
  const accountComments = (modelData.accounts || [])
    .filter((a) => a.comments && a.comments.trim().length > 0)
    .map((a) => `[${a.platformName} (${a.username})]: ${a.comments}`)
    .join("\n");

  const combinedNotes = [
    userNotes ? `Notas de la entrevista:\n${userNotes}` : "",
    modelData.interviewNotes && modelData.interviewNotes !== userNotes
      ? `Histórico de lo hablado con la modelo:\n${modelData.interviewNotes}`
      : "",
    accountComments ? `Observaciones técnicas de plataformas:\n${accountComments}` : "",
  ]
    .filter((s) => s.trim().length > 0)
    .join("\n\n");

  const notesText =
    combinedNotes.trim().length > 0
      ? combinedNotes
      : "Entrevista inicial completada. La modelo expresó buena disposición para los shows seleccionados, manejo responsable de sus juguetes y cumplimiento estricto con los horarios del turno asignado.";

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [
      [
        {
          content: "4. RESUMEN DE LO HABLADO CON LA MODELO (ENTREVISTA Y ACUERDOS)",
          styles: {
            fillColor: [50, 50, 58],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9.5,
          },
        },
      ],
    ],
    body: [
      [
        {
          content: notesText,
          styles: {
            cellPadding: 3.5,
            fontSize: 8,
            textColor: TEXT_MAIN_RGB,
            lineColor: BORDER_RGB,
            lineWidth: 0.2,
          },
        },
      ],
    ],
    theme: "plain",
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // --- SECCIÓN 5: BLOQUE ESTRUCTURADO PARA PROMPT DE IA LOCAL ---
  const aiPromptText = `
--- PROMPT SUGERIDO PARA LLM / IA LOCAL ---
Actúa como un estratega experto en marketing, branding y creación de personajes (persona webcam) para Estudios WooW.
Utiliza la siguiente ficha oficial de la modelo para generar:
1) Biografía seductora en 1ª persona (versiones en español e inglés).
2) Arquetipo de personaje y estilo de conversación sugerido para el chat.
3) Menú de propinas / Tip Menu estratégico escalonado para Chaturbate/Stripchat usando sus juguetes reales (${selectedToys.slice(0, 5).join(", ")}).
4) 5 ideas de shows temáticos semanales acordes a sus características físicas y fetiches permitidos.

[DATOS MODELO]:
• Nombre artístico: ${displayName}
• Edad: ${ageCalculated} | Etnia: ${physAttrs["Etnia a trabajar"] || "Latina"} | Experiencia: ${expStr}
• Rasgos: Cabello ${physAttrs["Color de Cabello"] || "N/A"} ${physAttrs["Tipo de Cabello"] || ""}, Ojos ${physAttrs["Color de Ojos"] || "N/A"}, Estatura ${physAttrs["Estatura"] || "N/A"}, Senos ${physAttrs["Senos"] || "N/A"}, Nalgas ${physAttrs["Nalga"] || "N/A"}.
• Juguetes: ${selectedToys.join(", ") || "Convencionales"}
• Shows y Kinks: ${selectedKinks.slice(0, 15).join(", ") || "General"}
• Outfits: ${allOutfits.slice(0, 8).join(", ") || "Lencería"}
• Acuerdos de entrevista: ${notesText.substring(0, 200)}...
---------------------------------------------
`.trim();

  // Si estamos muy cerca del fondo, nueva página
  if (currentY + 50 > pageHeight - 20) {
    doc.addPage();
    currentY = 20;
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [
      [
        {
          content: "5. PROMPT ESTRUCTURADO Y CONTEXTO LISTO PARA IA LOCAL",
          styles: {
            fillColor: PRIMARY_DARK_RGB,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9.5,
          },
        },
      ],
    ],
    body: [
      [
        {
          content: aiPromptText,
          styles: {
            cellPadding: 3,
            fontSize: 7.2,
            font: "courier",
            textColor: [40, 40, 45],
            fillColor: [248, 248, 250],
            lineColor: PRIMARY_RGB,
            lineWidth: 0.3,
          },
        },
      ],
    ],
    theme: "plain",
  });

  // --- PIE DE PÁGINA EN TODAS LAS PÁGINAS ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 150);

    // Línea separadora tenue
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 10, pageWidth - marginX, pageHeight - 10);

    doc.text(
      "Estudios WooW • Sistema de Perfilamiento v2.0 • Documento Confidencial",
      marginX,
      pageHeight - 6
    );
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 6,
      { align: "right" }
    );
  }

  return doc;
}

/**
 * Descarga directamente el PDF generado con un nombre descriptivo
 */
export async function downloadModelSummaryPdf(
  modelData: ModelPdfData,
  userNotes?: string
): Promise<void> {
  const doc = await generateModelSummaryPdf(modelData, userNotes);
  const cleanName = (
    modelData.artisticName ||
    modelData.nickname ||
    modelData.name ||
    "Modelo"
  )
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase();

  const fileName = `Ficha_IA_${cleanName}_WooW.pdf`;
  doc.save(fileName);
}

/**
 * Obtiene todos los datos complementarios de Firestore (models + modelos_profile_v2)
 */
export async function fetchCompleteModelPdfData(modelId: string): Promise<ModelPdfData | null> {
  try {
    const modelRef = doc(db, "models", modelId);
    const profileRef = doc(db, "modelos_profile_v2", modelId);

    const [modelSnap, profileSnap] = await Promise.all([
      getDoc(modelRef),
      getDoc(profileRef)
    ]);

    if (!modelSnap.exists() && !profileSnap.exists()) {
      return null;
    }

    const modelData = modelSnap.exists() ? modelSnap.data() : {};
    const profileData = profileSnap.exists() ? profileSnap.data() : {};
    const generalInfo = profileData.generalInfo || {};

    return {
      id: modelId,
      name: modelData.name || generalInfo.realName || profileData.realName || "Sin nombre",
      lastName: modelData.lastName || "",
      nickname: modelData.nickname || "",
      artisticName: generalInfo.artisticName || profileData.artisticName || modelData.nickname || modelData.name || "Sin nombre",
      status: modelData.status || "Activa",
      shift: modelData.shift || "No asignado",
      age: generalInfo.age || profileData.age || modelData.age || "",
      birth_date: modelData.birth_date || "",
      experience: generalInfo.experience || profileData.experience || modelData.experience || "nuevo",
      photo_url: modelData.photo_url || null,
      category: modelData.category || "General",
      platforms: modelData.platforms || generalInfo.targetPlatforms || profileData.targetPlatforms || [],
      accounts: modelData.accounts || [],
      physicalAttributes: profileData.physicalAttributes || {},
      selectedKinks: profileData.selectedKinks || [],
      selectedToys: profileData.selectedToys || [],
      selectedOutfits: profileData.selectedOutfits || [],
      customOutfits: profileData.customOutfits || [],
      selectedHashtags: profileData.selectedHashtags || [],
      interviewNotes: profileData.interviewNotes || profileData.conversationNotes || "",
      room: modelData.currentRoomId || "Estudio Principal",
      whatsapp: modelData.whatsapp || ""
    };
  } catch (error) {
    console.error("Error fetching complete model PDF data:", error);
    return null;
  }
}

/**
 * Guarda las notas de la entrevista o conversación en el perfil V2 de la modelo
 */
export async function saveModelInterviewNotes(modelId: string, notes: string): Promise<void> {
  try {
    const profileRef = doc(db, "modelos_profile_v2", modelId);
    await setDoc(profileRef, { 
      interviewNotes: notes, 
      updatedAt: new Date().toISOString() 
    }, { merge: true });
  } catch (error) {
    console.error("Error saving interview notes:", error);
  }
}

