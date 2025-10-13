export type Spot = { name: string; lat: number; lon: number };

export const SPOTS: Spot[] = [
  { name: "Honolulu", lat: 21.3069, lon: -157.8583 },
  { name: "Waikiki", lat: 21.2810, lon: -157.8374 },
  { name: "North Shore (Ehukai)", lat: 21.6649, lon: -158.0532 },
  { name: "Kailua", lat: 21.4022, lon: -157.7394 }
];

export function findSpot(query: string): Spot | undefined {
  const q = query.toLowerCase();
  return SPOTS.find(s => s.name.toLowerCase().includes(q));
}
