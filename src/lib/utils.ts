import attributesData from "@/data/attributes.json";

export interface ProfileData {
  physicalAttributes?: { [key: string]: string };
  credentials?: { [key: string]: { apiKey: string, username: string } };
  selectedKinks?: string[];
  selectedToys?: string[];
  selectedOutfits?: string[];
  selectedHashtags?: string[];
  targetPlatforms?: string[];
  age?: string | number;
  experience?: string;
}

export function calculateProfileProgress(profile: ProfileData | null | undefined): number {
  if (!profile) return 0;

  let totalWeight = 0;
  let accumulatedPoints = 0;

  // 1. Physical Attributes (11 categories) - 25%
  const attributeCategories = attributesData.map(a => a.category);
  const totalAttrs = attributeCategories.length;
  let filledAttrs = 0;
  if (profile.physicalAttributes) {
    attributeCategories.forEach(cat => {
      if (profile.physicalAttributes![cat]) filledAttrs++;
    });
  }
  const attrProgress = (filledAttrs / totalAttrs) * 25;
  accumulatedPoints += attrProgress;
  totalWeight += 25;

  // 2. Platform Credentials - 25%
  // Must have username and apiKey for each target platform
  const platforms = profile.targetPlatforms || [];
  if (platforms.length > 0) {
    let credsScore = 0;
    platforms.forEach(p => {
      const cred = profile.credentials?.[p];
      if (cred && cred.username && cred.apiKey) {
        credsScore += 1;
      }
    });
    accumulatedPoints += (credsScore / platforms.length) * 25;
  } else {
    // If no platforms selected, this part is 0 unless we consider it "complete" if empty? 
    // Usually at least one platform is expected.
  }
  totalWeight += 25;

  // 3. Kinks, Toys, Outfits - 30% (10% each)
  if (profile.selectedKinks && profile.selectedKinks.length > 0) accumulatedPoints += 10;
  if (profile.selectedToys && profile.selectedToys.length > 0) accumulatedPoints += 10;
  if (profile.selectedOutfits && profile.selectedOutfits.length > 0) accumulatedPoints += 10;
  totalWeight += 30;

  // 4. Hashtags - 10% (Should have 5)
  const hashtagsCount = profile.selectedHashtags?.length || 0;
  accumulatedPoints += Math.min(hashtagsCount / 5, 1) * 10;
  totalWeight += 10;

  // 5. General Info (Age, Experience) - 10%
  if (profile.age) accumulatedPoints += 5;
  if (profile.experience && profile.experience !== "") accumulatedPoints += 5;
  totalWeight += 10;

  return Math.round(accumulatedPoints);
}
