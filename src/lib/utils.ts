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
}

export function calculateProfileProgress(profile: ProfileData | null | undefined): number {
  if (!profile) return 0;

  let totalPoints = 0;

  // 1. Physical Attributes (11 categories) - 25%
  const attributeCategories = attributesData.map(a => a.category);
  const totalAttrs = attributeCategories.length;
  let filledAttrs = 0;
  if (profile.physicalAttributes) {
    attributeCategories.forEach(cat => {
      const val = profile.physicalAttributes![cat];
      if (val && val !== "") filledAttrs++;
    });
  }
  totalPoints += (filledAttrs / totalAttrs) * 25;

  // 2. Platform Credentials - 25%
  const targetedPlatforms = profile.targetPlatforms || [];
  const apiPlatforms = profile.apiEnabledPlatforms || [];
  
  if (targetedPlatforms.length > 0) {
    if (apiPlatforms.length > 0) {
      let credsScore = 0;
      apiPlatforms.forEach(p => {
        const cred = profile.credentials?.[p];
        if (cred && cred.username && (cred.apiKey || (cred as any).apiSecret)) { // Consider secret too
          credsScore += 1;
        }
      });
      totalPoints += (credsScore / apiPlatforms.length) * 25;
    } else {
      // If none are API enabled, this section is functionally done (nothing required)
      totalPoints += 25;
    }
  } else {
    // If no target platforms selected, this section is NOT complete (0%)
    totalPoints += 0;
  }

  // 3. Kinks, Toys, Outfits - 30% (10% each)
  if (Array.isArray(profile.selectedKinks) && profile.selectedKinks.length > 0) totalPoints += 10;
  if (Array.isArray(profile.selectedToys) && profile.selectedToys.length > 0) totalPoints += 10;
  if (Array.isArray(profile.selectedOutfits) && profile.selectedOutfits.length > 0) totalPoints += 10;

  // 4. Hashtags - 10% (Should have 5)
  const hashtagsCount = Array.isArray(profile.selectedHashtags) ? profile.selectedHashtags.length : 0;
  totalPoints += Math.min(hashtagsCount / 5, 1) * 10;

  // 5. General Info (Age, Experience) - 10%
  if (profile.age && profile.age !== "") totalPoints += 5;
  if (profile.experience && profile.experience !== "") totalPoints += 5;

  return Math.round(totalPoints);
}
