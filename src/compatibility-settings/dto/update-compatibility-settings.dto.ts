export class UpdateCompatibilitySettingsDto {
  pairInsights?: Record<string, { 
    insight: string; chemistry: string; daily: string; 
    score?: number;
    categoryScores?: {
      emotional: number; intellectual: number; physical: number;
      spiritual: number; communication: number; romance: number;
      longTerm: number;
    };
    strengths?: string[]; challenges?: string[]; advice?: string 
  }>;
  elementInsights?: Record<string, { 
    insight: string; chemistry: string; daily: string; 
    score?: number;
    categoryScores?: {
      emotional: number; intellectual: number; physical: number;
      spiritual: number; communication: number; romance: number;
      longTerm: number;
    };
    strengths?: string[]; challenges?: string[]; advice?: string 
  }>;
  archetypes?: Record<string, { title: string; planet: string; traits: string[]; description: string; inLove: string }>;
  numerologyPairInsights?: Record<string, string>;
  numerologyScores?: Record<string, number>;
  numerologyChallenges?: Record<string, string>;
}
