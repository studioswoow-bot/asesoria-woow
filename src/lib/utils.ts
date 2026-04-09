import attributesData from "@/data/attributes.json";

export interface ProfileData {
  physicalAttributes?: { [key: string]: string };
  credentials?: { [key: string]: { apiKey: string, username: string } };
  selectedKinks?: string[];
  selectedToys?: string[];
  selectedOutfits?: string[];
  selectedHashtags?: string[];
  targetPlatforms?: string[];
  apiEnabledPlatforms?: string[];
  age?: string | number;
  experience?: string;
  generalInfo?: {
    age?: string | number;
    experience?: string;
    targetPlatforms?: string[];
  };
}

export interface CompletionItem {
  id: string;
  label: string;
  completed: boolean;
  score: number;
}

export function calculateProfileProgress(profile: ProfileData | any | null | undefined): number {
  if (!profile) return 0;

  // Normalizar datos: Si vienen de Firebase V2, campos como age, experience y targetPlatforms 
  // suelen estar dentro de generalInfo.
  const generalInfo = profile.generalInfo || {};
  const age = profile.age || generalInfo.age;
  const experience = profile.experience || generalInfo.experience;
  const targetPlatforms = profile.targetPlatforms || generalInfo.targetPlatforms || [];
  const apiPlatforms = profile.apiEnabledPlatforms || [];

  let totalPoints = 0;

  // 1. Physical Attributes (11 categories) - 25%
  const totalAttrs = attributesData.length;
  let filledAttrs = 0;
  if (profile.physicalAttributes) {
    attributesData.forEach(attr => {
      const val = profile.physicalAttributes![attr.category];
      if (val && val !== "") filledAttrs++;
    });
  }
  totalPoints += (filledAttrs / totalAttrs) * 25;

  // 2. Platform Credentials - 25%
  if (targetPlatforms.length > 0) {
    // Si hay plataformas habilitadas para API, verificar credenciales
    if (apiPlatforms.length > 0) {
      let credsScore = 0;
      apiPlatforms.forEach((p: string) => {
        const cred = profile.credentials?.[p];
        if (cred && (cred.username || cred.user) && (cred.apiKey || cred.apiSecret || cred.password)) {
          credsScore += 1;
        }
      });
      totalPoints += (credsScore / apiPlatforms.length) * 25;
    } else {
      // Si hay plataformas pero ninguna requiere API para el progreso (solo Drive)
      totalPoints += 25;
    }
  } else {
    // Si no hay plataformas objetivo seleccionadas, esta sección está incompleta
    totalPoints += 0;
  }

  // 3. Kinks, Toys, Outfits - 30% (10% cada uno)
  if (Array.isArray(profile.selectedKinks) && profile.selectedKinks.length > 0) totalPoints += 10;
  if (Array.isArray(profile.selectedToys) && profile.selectedToys.length > 0) totalPoints += 10;
  if (Array.isArray(profile.selectedOutfits) && profile.selectedOutfits.length > 0) totalPoints += 10;

  // 4. Hashtags - 10% (Se recomiendan 5)
  const hashtagsCount = Array.isArray(profile.selectedHashtags) ? profile.selectedHashtags.length : 0;
  totalPoints += Math.min(hashtagsCount / 5, 1) * 10;

  // 5. General Info (Age, Experience) - 10%
  if (age && age !== "") totalPoints += 5;
  if (experience && experience !== "") totalPoints += 5;

  // Asegurar que no exceda 100 y redondear
  return Math.min(100, Math.round(totalPoints));
}

export function getProfileCompletionChecklist(profile: ProfileData | any | null | undefined): CompletionItem[] {
  const items: CompletionItem[] = [];
  if (!profile) return items;

  const generalInfo = profile.generalInfo || {};
  const age = profile.age || generalInfo.age;
  const experience = profile.experience || generalInfo.experience;
  const targetPlatforms = profile.targetPlatforms || generalInfo.targetPlatforms || [];
  const apiPlatforms = profile.apiEnabledPlatforms || [];

  // 1. Physical Attributes (25%)
  const totalAttrs = attributesData.length;
  let filledAttrs = 0;
  if (profile.physicalAttributes) {
    attributesData.forEach(attr => {
      const val = profile.physicalAttributes![attr.category];
      if (val && val !== "") filledAttrs++;
    });
  }
  const attrScore = (filledAttrs / totalAttrs) * 25;
  items.push({
    id: 'physicalAttributes',
    label: `Atributos físicos (${filledAttrs}/${totalAttrs})`,
    completed: filledAttrs === totalAttrs,
    score: Math.round(attrScore)
  });

  // 2. Platform Credentials (25%)
  let credsScore = 0;
  let credsCompleted = false;
  if (targetPlatforms.length > 0) {
    if (apiPlatforms.length > 0) {
      let validCreds = 0;
      apiPlatforms.forEach((p: string) => {
        const cred = profile.credentials?.[p];
        if (cred && (cred.username || cred.user) && (cred.apiKey || cred.apiSecret || cred.password)) {
          validCreds++;
        }
      });
      credsScore = (validCreds / apiPlatforms.length) * 25;
      credsCompleted = validCreds === apiPlatforms.length;
    } else {
      credsScore = 25;
      credsCompleted = true;
    }
  }
  items.push({
    id: 'credentials',
    label: 'Credenciales de plataformas / API',
    completed: credsCompleted,
    score: Math.round(credsScore)
  });

  // 3. Kinks, Toys, Outfits (30%)
  items.push({
    id: 'kinks',
    label: 'Categorías / Kinks seleccionados',
    completed: Array.isArray(profile.selectedKinks) && profile.selectedKinks.length > 0,
    score: (Array.isArray(profile.selectedKinks) && profile.selectedKinks.length > 0) ? 10 : 0
  });
  items.push({
    id: 'toys',
    label: 'Juguetes / Toys registrados',
    completed: Array.isArray(profile.selectedToys) && profile.selectedToys.length > 0,
    score: (Array.isArray(profile.selectedToys) && profile.selectedToys.length > 0) ? 10 : 0
  });
  items.push({
    id: 'outfits',
    label: 'Outfits / Lencería detallada',
    completed: Array.isArray(profile.selectedOutfits) && profile.selectedOutfits.length > 0,
    score: (Array.isArray(profile.selectedOutfits) && profile.selectedOutfits.length > 0) ? 10 : 0
  });

  // 4. Hashtags (10%)
  const hashtagsCount = Array.isArray(profile.selectedHashtags) ? profile.selectedHashtags.length : 0;
  items.push({
    id: 'hashtags',
    label: `Hashtags recomendados (${hashtagsCount}/5)`,
    completed: hashtagsCount >= 5,
    score: Math.round(Math.min(hashtagsCount / 5, 1) * 10)
  });

  // 5. General Info (10%)
  items.push({
    id: 'age',
    label: 'Edad verificada',
    completed: !!(age && age !== ""),
    score: (age && age !== "") ? 5 : 0
  });
  items.push({
    id: 'experience',
    label: 'Tiempo de experiencia',
    completed: !!(experience && experience !== ""),
    score: (experience && experience !== "") ? 5 : 0
  });

  return items;
}
