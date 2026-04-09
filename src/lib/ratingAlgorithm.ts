import { ActionPlan, DailyTracking } from '@/context/ActionPlanContext';

export interface WooWRatingResult {
  scoreA_ICR: number;       // Max 40
  scoreB_Evolucion: number; // Max 30
  scoreC_ZScore: number;    // Max 20
  scoreD_Perfil: number;    // Max 10
  puntajeTotal: number;     // Max 100
  calificacionFinal: number; // Max 5.0
  tip: string;
  detalles: {
    icrReal: number;
    icrMeta: number;
    zScore: number;
    crecimientoTPH: number;
  };
}

export function calculateWooWRating(
  progressBase: number,
  currentPlan?: ActionPlan,
  previousPlan?: ActionPlan,
  maxStudioICR?: number
): WooWRatingResult {
  // Inicializamos valores base seguros
  let icrReal = 0;
  let icrMeta = 0;
  let zScorePromedio = 0;
  let crecimientoTPH = 0;

  let scoreA_ICR = 0;
  let scoreB_Evolucion = 0;
  let scoreC_ZScore = 10; // Base para alguien promedio si no hay datos
  let scoreD_Perfil = Math.min(10, (progressBase / 100) * 10);
  let totalTokens = 0;
  let totalHoursReales = 0;
  let totalHoursPlaneadas = 0;

  // Analizamos el plan en curso si existe
  if (currentPlan && currentPlan.dailyTracking && currentPlan.dailyTracking.length > 0) {
    const t = currentPlan.dailyTracking;
    totalTokens = t.reduce((acc, curr) => acc + (curr.tokens || 0), 0);
    totalHoursReales = t.reduce((acc, curr) => acc + (curr.hours || 0), 0);
    totalHoursPlaneadas = t.reduce((acc, curr) => acc + (curr.plannedHours || 0), 0);
    
    // ICR Real = Tokens Totales / Horas Planeadas Totales
    if (totalHoursPlaneadas > 0) {
      icrReal = totalTokens / totalHoursPlaneadas;
    }
    
    icrMeta = currentPlan.goals?.icr || 0;
    
    // Z-Score promedio del periodo
    const validZScores = t.filter(x => x.zscore !== undefined);
    if (validZScores.length > 0) {
      zScorePromedio = validZScores.reduce((acc, curr) => acc + (curr.zscore || 0), 0) / validZScores.length;
    }

    // --- CÁLCULO PILAR A: Rendimiento / ICR (Max 40 pts) ---
    // Según audio: El ICR más alto del estudio es el 40/40.
    if (maxStudioICR && maxStudioICR > 0) {
      scoreA_ICR = Math.min(40, (icrReal / maxStudioICR) * 40);
    } else if (icrMeta > 0) {
      scoreA_ICR = Math.min(40, (icrReal / icrMeta) * 40);
    } else if (icrReal > 0) {
      scoreA_ICR = 20; 
    }

    // --- CÁLCULO PILAR C: Relativo / Z-Score (Max 20 pts) ---
    scoreC_ZScore = Math.min(20, Math.max(0, 10 + (zScorePromedio * 5)));

    // --- CÁLCULO PILAR B: Evolución de Planes (Max 30 pts) ---
    // 1. Gestión Activa (10pts)
    let scoreGestion = 10; // Si hay plan y hay iteraciones diarias, tiene gestión activa
    
    // 2. Crecimiento Orgánico (10pts)
    let scoreCrecimiento = 0;
    const tphCurrent = totalHoursReales > 0 ? (totalTokens / totalHoursReales) : 0;
    
    if (previousPlan && previousPlan.dailyTracking && previousPlan.dailyTracking.length > 0) {
      const prevT = previousPlan.dailyTracking;
      const prevTokens = prevT.reduce((acc, curr) => acc + (curr.tokens || 0), 0);
      const prevHours = prevT.reduce((acc, curr) => acc + (curr.hours || 0), 0);
      const tphPrev = prevHours > 0 ? (prevTokens / prevHours) : 0;
      
      if (tphPrev > 0) {
        crecimientoTPH = ((tphCurrent - tphPrev) / tphPrev) * 100;
        
        if (crecimientoTPH > 15) {
          scoreCrecimiento = 10;
        } else if (crecimientoTPH >= 0) {
          scoreCrecimiento = 7;
        } else {
          scoreCrecimiento = 0;
        }
      } else {
         scoreCrecimiento = 7; // Si el plan anterior generaba 0 TPH y ahora hay algo.
      }
    } else {
      // Si no hay plan previo con que comparar pero este plan tiene TPH positivo
      if (tphCurrent > 0) scoreCrecimiento = 7; 
    }

    // 3. Efectividad y Metas (10pts)
    let scoreEfectividad = 0;
    const gResult = currentPlan.evaluation?.globalResult;
    if (gResult === 'Superó metas') {
      scoreEfectividad = 10;
    } else if (gResult === 'Cumplió metas mínimas') {
      scoreEfectividad = 6;
    } else if (gResult === 'No cumplió metas') {
      scoreEfectividad = 0;
    } else {
      // Si aún no se evalúa el plan actual, damos un voto de confianza medio
      scoreEfectividad = 5; 
    }

    scoreB_Evolucion = scoreGestion + scoreCrecimiento + scoreEfectividad;

  } else {
    // Si no hay ningún plan en curso
    scoreA_ICR = 0; // Sin plan no hay metas de ICR cumplidas registradas aquí
    scoreC_ZScore = 10; // Se mantiene en el promedio general neutral
    scoreB_Evolucion = 0; // No hay gestión activa
  }

  // --- CONSOLIDACIÓN FINAL ---
  const puntajeTotal = Math.round(scoreA_ICR + scoreB_Evolucion + scoreC_ZScore + scoreD_Perfil);
  
  // Fórmula: Calificación = MAX(1.0, (Puntaje/20))
  let calificacionFinal = puntajeTotal / 20;
  if (calificacionFinal < 1.0) calificacionFinal = 1.0;
  if (calificacionFinal > 5.0) calificacionFinal = 5.0;

  // --- GENERACIÓN DE TIP DINÁMICO ---
  let tip = "";
  if (scoreB_Evolucion === 0) {
     tip = "💡 Es urgente crear e interactuar con un Plan de Acción activo. Esto impulsará el puntaje general fuertemente.";
  } else if (totalTokens === 0) {
     tip = "📡 Sin producción detectada. Asegúrate de que tus métricas hayan sido sincronizadas por el coordinador en tu Plan de Acción actual.";
  } else if (scoreA_ICR < 22) {
     const metaText = maxStudioICR ? `el máximo del estudio (${maxStudioICR.toFixed(0)})` : `tu meta de ${icrMeta}`;
     tip = `📈 Rendimiento ICR Mejorable. Has logrado un ICR de ${icrReal.toFixed(0)} frente a ${metaText}. ¡Ajusta tu show para acercarte a las líderes del estudio!`;
  } else if (scoreC_ZScore < 10) {
     tip = "🚀 Buen trabajo, pero tu Z-Score revela que estás por debajo del promedio del estudio. ¡Revisa qué hacen las modelos top e implementa esos shows!";
  } else if (scoreD_Perfil < 10) {
     tip = "✍️ Estás trabajando genial, pero tu perfil es el pase de entrada. Llévalo al 100% para conseguir esos puntos faltantes e incentivar más clics en tu sala.";
  } else if (calificacionFinal >= 4.5) {
     tip = "⭐ ¡Nivel Élite! Mantén la consistencia. Intenta romper tus propios récords de TPH en el siguiente Plan de Acción.";
  } else {
     tip = "🔥 Sigue así, monitorea tus horas planeadas contra horas reales (ICJ) para que todo se unifique correctamente.";
  }

  return {
    scoreA_ICR: Math.round(scoreA_ICR),
    scoreB_Evolucion: Math.round(scoreB_Evolucion),
    scoreC_ZScore: Math.round(scoreC_ZScore),
    scoreD_Perfil: Math.round(scoreD_Perfil),
    puntajeTotal,
    calificacionFinal: Number(calificacionFinal.toFixed(1)),
    tip,
    detalles: {
       icrReal,
       icrMeta,
       zScore: zScorePromedio,
       crecimientoTPH
    }
  };
}
