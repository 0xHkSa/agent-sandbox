export type Spot = { 
  name: string; 
  lat: number; 
  lon: number; 
  island: string;
  type: 'surf' | 'family' | 'snorkel' | 'scenic' | 'mixed';
  description?: string;
};

export const SPOTS: Spot[] = [
  // Oahu Beaches Only
  { name: "Waikiki Beach", lat: 21.2766, lon: -157.8269, island: "Oahu", type: "family", description: "Iconic beach, perfect for beginners and families" },
  { name: "Kailua Beach", lat: 21.4010, lon: -157.7394, island: "Oahu", type: "family", description: "Calm waters, great for kids and kayaking" },
  { name: "Lanikai Beach", lat: 21.3927, lon: -157.7160, island: "Oahu", type: "scenic", description: "Crystal clear water, stunning sunrise views" },
  { name: "North Shore (Ehukai)", lat: 21.6649, lon: -158.0532, island: "Oahu", type: "surf", description: "World-famous surf spot, powerful winter waves" },
  { name: "Sandy Beach", lat: 21.2847, lon: -157.6722, island: "Oahu", type: "surf", description: "Powerful shorebreak, experienced surfers only" },
  { name: "Makapu'u Beach", lat: 21.3106, lon: -157.6589, island: "Oahu", type: "mixed", description: "Bodyboarding spot with scenic lighthouse views" },
  { name: "Hanauma Bay", lat: 21.2706, lon: -157.6939, island: "Oahu", type: "snorkel", description: "Protected marine sanctuary, excellent snorkeling" },
  { name: "Sunset Beach", lat: 21.6589, lon: -158.0539, island: "Oahu", type: "surf", description: "Long right-handers, winter surf destination" },
  { name: "Pipeline", lat: 21.6649, lon: -158.0532, island: "Oahu", type: "surf", description: "Most famous surf break in the world" },
  { name: "Ala Moana Beach", lat: 21.2906, lon: -157.8422, island: "Oahu", type: "family", description: "Protected lagoon, great for families and beginners" },
  { name: "Waimanalo Beach", lat: 21.3347, lon: -157.7000, island: "Oahu", type: "family", description: "Long sandy beach, less crowded than Waikiki" },
  { name: "Bellows Beach", lat: 21.3500, lon: -157.7200, island: "Oahu", type: "family", description: "Military-only access, calm waters perfect for families (requires military ID)" },
  { name: "Honolulu", lat: 21.3069, lon: -157.8583, island: "Oahu", type: "mixed", description: "City center, multiple beach options nearby" }
];

export function findSpot(query: string): Spot | undefined {
  const q = query.toLowerCase().trim();
  
  // Direct name match first
  let spot = SPOTS.find(s => s.name.toLowerCase().includes(q));
  if (spot) return spot;
  
  // Island match
  spot = SPOTS.find(s => s.island.toLowerCase().includes(q));
  if (spot) return spot;
  
  // Type match (surf, family, snorkel, etc.)
  spot = SPOTS.find(s => s.type.toLowerCase().includes(q));
  if (spot) return spot;
  
  // Partial word matching
  spot = SPOTS.find(s => 
    s.name.toLowerCase().split(' ').some(word => word.includes(q)) ||
    s.description?.toLowerCase().includes(q)
  );
  
  return spot;
}

// Helper function to get beaches by type
export function getBeachesByType(type: 'surf' | 'family' | 'snorkel' | 'scenic' | 'mixed'): Spot[] {
  return SPOTS.filter(s => s.type === type);
}

// Helper function to get beaches by island
export function getBeachesByIsland(island: string): Spot[] {
  return SPOTS.filter(s => s.island.toLowerCase().includes(island.toLowerCase()));
}

// Helper function to recommend beaches based on criteria
export function recommendBeaches(criteria: {
  family?: boolean;
  surf?: boolean;
  snorkel?: boolean;
  scenic?: boolean;
  island?: string;
  excludeRestricted?: boolean;
}): Spot[] {
  let filtered = SPOTS;
  
  // Filter out restricted beaches by default unless explicitly requested
  if (criteria.excludeRestricted !== false) {
    filtered = filtered.filter(s => 
      !s.name.includes('Bellows') && 
      !s.name.includes('Hanauma')
    );
  }
  
  if (criteria.family) {
    filtered = filtered.filter(s => s.type === 'family' || s.type === 'mixed');
  }
  
  if (criteria.surf) {
    filtered = filtered.filter(s => s.type === 'surf' || s.type === 'mixed');
  }
  
  if (criteria.snorkel) {
    filtered = filtered.filter(s => s.type === 'snorkel' || s.type === 'mixed');
  }
  
  if (criteria.scenic) {
    filtered = filtered.filter(s => s.type === 'scenic' || s.type === 'mixed');
  }
  
  if (criteria.island) {
    filtered = filtered.filter(s => s.island.toLowerCase().includes(criteria.island.toLowerCase()));
  }
  
  return filtered;
}
