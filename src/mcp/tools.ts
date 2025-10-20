import axios from "axios";

// Unit conversion utilities
export function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9/5 + 32) * 10) / 10; // Round to 1 decimal
}

export function kmhToMph(kmh: number): number {
  return Math.round((kmh * 0.621371) * 10) / 10; // Round to 1 decimal
}

export function metersToFeet(meters: number): number {
  return Math.round((meters * 3.28084) * 10) / 10; // Round to 1 decimal
}

// Smart Beach Scoring System
export interface BeachScore {
  overall: number; // 0-10 scale for consumers
  weather: number; // 0-10
  waves: number; // 0-10
  uv_safety: number; // 0-10
  tides: number; // 0-10
  crowd_level: number; // 0-10 (10 = least crowded)
  breakdown: {
    temperature_score: number;
    wind_score: number;
    precipitation_score: number;
    wave_height_score: number;
    wave_period_score: number;
    uv_index_score: number;
    tide_level_score: number;
  };
  recommendations: string[];
  best_time_today?: string;
}

export function calculateBeachScore(
  weather: any,
  surf: any,
  uv: any,
  tides: any,
  beachType: 'family' | 'surf' | 'snorkel' | 'scenic' | 'mixed',
  crowdLevel?: number
): BeachScore {
  const tempF = weather?.current_converted?.temperature_fahrenheit || weather?.current?.temperature_2m;
  const windMph = weather?.current_converted?.wind_speed_mph || weather?.current?.wind_speed_10m;
  const precipitation = weather?.current?.precipitation || 0;
  const waveHeightFt = surf?.hourly_converted?.wave_height_feet?.[0] || (surf?.hourly?.wave_height?.[0] ? metersToFeet(surf.hourly.wave_height[0]) : 0);
  const wavePeriod = surf?.hourly?.wave_period?.[0] || 0;
  const uvIndex = uv?.uv_index || 0;
  const currentTide = tides?.current_tide || 0;
  
  // Calculate individual component scores (0-100 scale internally)
  const temperatureScore = calculateTemperatureScore(tempF);
  const windScore = calculateWindScore(windMph);
  const precipitationScore = calculatePrecipitationScore(precipitation);
  const waveHeightScore = calculateWaveHeightScore(waveHeightFt, beachType);
  const wavePeriodScore = calculateWavePeriodScore(wavePeriod, beachType);
  const uvIndexScore = calculateUVIndexScore(uvIndex);
  const tideLevelScore = calculateTideLevelScore(currentTide, beachType);
  
  // Calculate weighted scores based on beach type
  const weights = getBeachTypeWeights(beachType);
  
  const weatherScore = Math.round(
    (temperatureScore * weights.temperature +
     windScore * weights.wind +
     precipitationScore * weights.precipitation) * 10
  ) / 10;
  
  const waveScore = Math.round(
    (waveHeightScore * weights.waveHeight +
     wavePeriodScore * weights.wavePeriod) * 10
  ) / 10;
  
  const uvSafetyScore = Math.round(uvIndexScore * 10) / 10;
  const tideScore = Math.round(tideLevelScore * 10) / 10;
  
  // Default crowd level if not provided (simulate based on beach popularity)
  const defaultCrowdLevel = getDefaultCrowdLevel(beachType);
  const crowdScore = Math.round((crowdLevel ?? defaultCrowdLevel) * 10) / 10;
  
  // Calculate overall score (0-100 internally, then convert to 0-10)
  const overallScore = Math.round(
    (weatherScore * weights.weather +
     waveScore * weights.waves +
     uvSafetyScore * weights.uv +
     tideScore * weights.tides +
     crowdScore * weights.crowd) * 10
  ) / 10;
  
  // Convert to 0-10 scale for consumers
  const overallScoreOutOf10 = Math.round(overallScore) / 10;
  
  const recommendations = generateRecommendations(
    weatherScore, waveScore, uvSafetyScore, tideScore, crowdScore, beachType
  );
  
  const bestTimeToday = calculateBestTimeToday(weather, surf, tides);
  
  return {
    overall: Math.min(10, Math.max(0, overallScoreOutOf10)),
    weather: Math.min(10, Math.max(0, weatherScore / 10)),
    waves: Math.min(10, Math.max(0, waveScore / 10)),
    uv_safety: Math.min(10, Math.max(0, uvSafetyScore / 10)),
    tides: Math.min(10, Math.max(0, tideScore / 10)),
    crowd_level: Math.min(10, Math.max(0, crowdScore / 10)),
    breakdown: {
      temperature_score: Math.min(10, Math.max(0, temperatureScore / 10)),
      wind_score: Math.min(10, Math.max(0, windScore / 10)),
      precipitation_score: Math.min(10, Math.max(0, precipitationScore / 10)),
      wave_height_score: Math.min(10, Math.max(0, waveHeightScore / 10)),
      wave_period_score: Math.min(10, Math.max(0, wavePeriodScore / 10)),
      uv_index_score: Math.min(10, Math.max(0, uvIndexScore / 10)),
      tide_level_score: Math.min(10, Math.max(0, tideLevelScore / 10)),
    },
    recommendations,
    best_time_today: bestTimeToday
  };
}

// Individual scoring functions (0-100 scale)
function calculateTemperatureScore(tempF: number): number {
  if (tempF < 70) return 60; // Too cool
  if (tempF < 75) return 80; // Cool but okay
  if (tempF <= 85) return 100; // Perfect
  if (tempF <= 90) return 85; // Warm but okay
  return 70; // Too hot
}

function calculateWindScore(windMph: number): number {
  if (windMph < 5) return 100; // Calm
  if (windMph < 10) return 90; // Light breeze
  if (windMph < 15) return 75; // Moderate
  if (windMph < 20) return 60; // Strong
  return 40; // Very windy
}

function calculatePrecipitationScore(precipitation: number): number {
  if (precipitation === 0) return 100; // No rain
  if (precipitation < 0.5) return 80; // Light drizzle
  if (precipitation < 2) return 50; // Light rain
  return 20; // Heavy rain
}

function calculateWaveHeightScore(waveHeightFt: number, beachType: string): number {
  switch (beachType) {
    case 'family':
      if (waveHeightFt < 1) return 100; // Perfect for kids
      if (waveHeightFt < 2) return 90; // Good for families
      if (waveHeightFt < 3) return 70; // Okay with supervision
      return 40; // Too rough for families
    case 'surf':
      if (waveHeightFt < 2) return 60; // Small waves
      if (waveHeightFt < 4) return 90; // Good surf
      if (waveHeightFt < 6) return 100; // Great surf
      if (waveHeightFt < 8) return 85; // Big but surfable
      return 60; // Very big, experts only
    case 'snorkel':
      if (waveHeightFt < 1) return 100; // Perfect for snorkeling
      if (waveHeightFt < 2) return 80; // Good snorkeling
      return 40; // Too rough for snorkeling
    default:
      if (waveHeightFt < 2) return 90; // Generally good
      if (waveHeightFt < 4) return 80; // Moderate
      return 60; // Rough
  }
}

function calculateWavePeriodScore(wavePeriod: number, beachType: string): number {
  if (wavePeriod < 8) return 60; // Short period, choppy
  if (wavePeriod < 12) return 80; // Decent period
  if (wavePeriod < 16) return 100; // Great period
  return 90; // Very long period
}

function calculateUVIndexScore(uvIndex: number): number {
  if (uvIndex <= 2) return 100; // Low risk
  if (uvIndex <= 5) return 85; // Moderate risk
  if (uvIndex <= 7) return 70; // High risk
  if (uvIndex <= 10) return 50; // Very high risk
  return 30; // Extreme risk
}

function calculateTideLevelScore(tideLevel: number, beachType: string): number {
  // Simplified tide scoring - in reality this would be more complex
  if (beachType === 'surf') {
    if (tideLevel > 0.5) return 90; // Higher tide often better for surfing
    return 70; // Lower tide
  }
  // For families and snorkeling, moderate tide levels are usually best
  if (tideLevel > -0.5 && tideLevel < 1.5) return 90;
  return 70;
}

function getBeachTypeWeights(beachType: string) {
  switch (beachType) {
    case 'family':
      return {
        weather: 0.3,
        waves: 0.2,
        uv: 0.2,
        tides: 0.1,
        crowd: 0.2,
        temperature: 0.4,
        wind: 0.3,
        precipitation: 0.3,
        waveHeight: 0.6,
        wavePeriod: 0.4
      };
    case 'surf':
      return {
        weather: 0.2,
        waves: 0.4,
        uv: 0.1,
        tides: 0.2,
        crowd: 0.1,
        temperature: 0.3,
        wind: 0.4,
        precipitation: 0.3,
        waveHeight: 0.5,
        wavePeriod: 0.5
      };
    case 'snorkel':
      return {
        weather: 0.3,
        waves: 0.3,
        uv: 0.2,
        tides: 0.1,
        crowd: 0.1,
        temperature: 0.4,
        wind: 0.3,
        precipitation: 0.3,
        waveHeight: 0.7,
        wavePeriod: 0.3
      };
    default:
      return {
        weather: 0.25,
        waves: 0.25,
        uv: 0.2,
        tides: 0.1,
        crowd: 0.2,
        temperature: 0.4,
        wind: 0.3,
        precipitation: 0.3,
        waveHeight: 0.5,
        wavePeriod: 0.5
      };
  }
}

function getDefaultCrowdLevel(beachType: string): number {
  // Simulate crowd levels based on beach popularity
  switch (beachType) {
    case 'family':
      return 60; // Family beaches tend to be busier
    case 'surf':
      return 80; // Surf spots vary by conditions
    case 'snorkel':
      return 70; // Snorkel spots moderately busy
    case 'scenic':
      return 90; // Scenic spots often less crowded
    default:
      return 75; // Mixed beaches average
  }
}

function generateRecommendations(
  weatherScore: number, waveScore: number, uvScore: number, 
  tideScore: number, crowdScore: number, beachType: string
): string[] {
  const recommendations: string[] = [];
  
  if (weatherScore < 70) {
    recommendations.push("Weather conditions are not ideal - consider indoor activities");
  }
  
  if (uvScore < 70) {
    recommendations.push("High UV index - use sunscreen and seek shade frequently");
  }
  
  if (crowdScore < 60) {
    recommendations.push("Beach may be crowded - arrive early for better parking");
  }
  
  if (waveScore > 80 && beachType === 'surf') {
    recommendations.push("Great surf conditions - perfect day for surfing!");
  }
  
  if (waveScore < 60 && beachType === 'family') {
    recommendations.push("Waves may be too rough for young children");
  }
  
  if (recommendations.length === 0) {
    recommendations.push("Excellent conditions - perfect beach day!");
  }
  
  return recommendations;
}

function calculateBestTimeToday(weather: any, surf: any, tides: any): string {
  // Simplified best time calculation
  const currentHour = new Date().getHours();
  
  // Generally best beach times are 9am-3pm
  if (currentHour >= 9 && currentHour <= 15) {
    return "Now is a great time!";
  } else if (currentHour < 9) {
    return "Best time: 9am-3pm";
  } else {
    return "Best time: Tomorrow 9am-3pm";
  }
}

// NOAA Tide Data - Free API
export async function getTides(lat: number, lon: number) {
  try {
    // Find nearest NOAA tide station for Hawaii
    const hawaiiStations = [
      { id: "1612340", name: "Honolulu", lat: 21.3069, lon: -157.8583 },
      { id: "1615680", name: "Kahului", lat: 20.8956, lon: -156.4767 },
      { id: "1617760", name: "Hilo", lat: 19.7297, lon: -155.0900 },
      { id: "1619910", name: "Nawiliwili", lat: 21.9544, lon: -159.3561 }
    ];
    
    // Find closest station
    let closestStation = hawaiiStations[0];
    let minDistance = Math.sqrt(Math.pow(lat - closestStation.lat, 2) + Math.pow(lon - closestStation.lon, 2));
    
    for (const station of hawaiiStations) {
      const distance = Math.sqrt(Math.pow(lat - station.lat, 2) + Math.pow(lon - station.lon, 2));
      if (distance < minDistance) {
        minDistance = distance;
        closestStation = station;
      }
    }
    
    const today = new Date().toISOString().split('T')[0];
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter`;
    const params = {
      product: 'predictions',
      application: 'GoHawaii',
      begin_date: today,
      end_date: today,
      datum: 'MLLW',
      station: closestStation.id,
      time_zone: 'lst_ldt',
      units: 'english',
      interval: 'h',
      format: 'json'
    };
    
    const { data } = await axios.get(url, { params, timeout: 10000 });
    
    if (data.predictions && data.predictions.length > 0) {
      // Get current hour tide
      const now = new Date();
      const currentHour = now.getHours();
      const currentTide = data.predictions.find((p: any) => {
        const tideTime = new Date(p.t);
        return tideTime.getHours() === currentHour;
      });
      
      return {
        station: closestStation.name,
        current_tide: currentTide ? parseFloat(currentTide.v) : null,
        current_time: currentTide ? currentTide.t : null,
        next_high: findNextHighTide(data.predictions),
        next_low: findNextLowTide(data.predictions),
        all_tides: data.predictions.slice(0, 24) // Next 24 hours
      };
    }
    
    return { error: "No tide data available" };
  } catch (error: any) {
    console.error("Tide API error:", error.message);
    return { error: "Tide data unavailable" };
  }
}

function findNextHighTide(predictions: any[]): any {
  const now = new Date();
  return predictions.find(p => {
    const tideTime = new Date(p.t);
    return tideTime > now && parseFloat(p.v) > 0;
  });
}

function findNextLowTide(predictions: any[]): any {
  const now = new Date();
  return predictions.find(p => {
    const tideTime = new Date(p.t);
    return tideTime > now && parseFloat(p.v) < 0;
  });
}

// EPA UV Index - Free API
export async function getUVIndex(lat: number, lon: number) {
  try {
    // EPA UV Index API (free, no key required)
    const url = `https://enviro.epa.gov/enviro/ef_metadata.html`;
    
    // For Hawaii, we'll use a simplified approach with Open-Meteo UV data
    const uvUrl = "https://api.open-meteo.com/v1/forecast";
    const params = {
      latitude: lat,
      longitude: lon,
      current: ["uv_index"],
      timezone: "Pacific/Honolulu"
    };
    
    const { data } = await axios.get(uvUrl, { params, timeout: 8000 });
    
    if (data.current && data.current.uv_index !== undefined) {
      const uvIndex = data.current.uv_index;
      return {
        uv_index: uvIndex,
        risk_level: getUVRiskLevel(uvIndex),
        protection_needed: getUVProtection(uvIndex),
        recommendation: getUVRecommendation(uvIndex)
      };
    }
    
    return { error: "UV data unavailable" };
  } catch (error: any) {
    console.error("UV API error:", error.message);
    return { error: "UV data unavailable" };
  }
}

function getUVRiskLevel(uvIndex: number): string {
  if (uvIndex <= 2) return "Low";
  if (uvIndex <= 5) return "Moderate";
  if (uvIndex <= 7) return "High";
  if (uvIndex <= 10) return "Very High";
  return "Extreme";
}

function getUVProtection(uvIndex: number): string {
  if (uvIndex <= 2) return "Minimal protection needed";
  if (uvIndex <= 5) return "Sunscreen recommended";
  if (uvIndex <= 7) return "Sunscreen + hat recommended";
  if (uvIndex <= 10) return "Sunscreen + hat + shade";
  return "Avoid sun exposure";
}

function getUVRecommendation(uvIndex: number): string {
  if (uvIndex <= 2) return "Safe for extended outdoor activities";
  if (uvIndex <= 5) return "Good for outdoor activities with protection";
  if (uvIndex <= 7) return "Limit time in sun, seek shade";
  if (uvIndex <= 10) return "Minimize sun exposure";
  return "Avoid outdoor activities during peak sun hours";
}

export async function getWeather(lat: number, lon: number) {
  const url = "https://api.open-meteo.com/v1/forecast";
  const params = {
    latitude: lat,
    longitude: lon,
    current: ["temperature_2m","apparent_temperature","precipitation","wind_speed_10m"].join(","),
    timezone: "Pacific/Honolulu"
  };
  const { data } = await axios.get(url, { params, timeout: 8000 });
  
  // Add converted units to the response
  if (data.current) {
    const current = data.current;
    data.current_converted = {
      temperature_fahrenheit: celsiusToFahrenheit(current.temperature_2m),
      apparent_temperature_fahrenheit: celsiusToFahrenheit(current.apparent_temperature),
      wind_speed_mph: kmhToMph(current.wind_speed_10m),
      precipitation_mm: current.precipitation
    };
  }
  
  return data; // Enhanced payload with conversions
}

export async function getSurf(lat: number, lon: number) {
  const url = "https://marine-api.open-meteo.com/v1/marine";
  const params = {
    latitude: lat,
    longitude: lon,
    hourly: ["wave_height","wave_direction","wave_period","wind_wave_height"].join(","),
    timezone: "Pacific/Honolulu"
  };
  const { data } = await (await import("axios")).default.get(url, { params, timeout: 8000 });
  
  // Add converted units to the response
  if (data.hourly) {
    const hourly = data.hourly;
    data.hourly_converted = {
      wave_height_feet: hourly.wave_height?.map((h: number) => metersToFeet(h)),
      wind_wave_height_feet: hourly.wind_wave_height?.map((h: number) => metersToFeet(h)),
      wave_direction: hourly.wave_direction,
      wave_period: hourly.wave_period
    };
  }
  
  return data; // Enhanced payload with conversions
}

export function computeOutdoorIndex(weather: any): { index: number; note: string } {
  try {
    const cur = weather?.current || {};
    const temp = Number(cur.temperature_2m);         // °C
    const precip = Number(cur.precipitation ?? 0);   // mm
    const wind = Number(cur.wind_speed_10m ?? 0);    // km/h

    let score = 10;
    if (Number.isNaN(temp)) return { index: 0, note: "No current temp data" };

    if (temp < 20 || temp > 31) score -= 2;     // cooler/hotter than comfy
    if (precip > 0.1) score -= 3;               // raining
    if (wind > 9) score -= 2;                   // windy
    if (score < 0) score = 0;

    const note =
      score >= 8 ? "Excellent for outdoors" :
      score >= 5 ? "Decent with some caution" :
                   "Maybe indoor plans today";

    return { index: Math.round(score), note };
  } catch {
    return { index: 0, note: "Insufficient data" };
  }
}
