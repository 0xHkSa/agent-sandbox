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

// Multi-Spot Analysis Tool
export interface SpotAnalysis {
  name: string;
  lat: number;
  lon: number;
  type: 'surf' | 'family' | 'snorkel' | 'scenic' | 'mixed';
  island: string;
  weather: any;
  weather_converted: any;
  surf: any;
  surf_converted: any;
  uv: any;
  tides: any;
  outdoorIndex: any;
  beachScore: BeachScore;
  summary: string;
}

export interface MultiSpotAnalysis {
  spots: SpotAnalysis[];
  comparison: {
    best_overall: string;
    best_weather: string;
    best_surf: string;
    best_family: string;
    best_snorkel: string;
    rankings: Array<{
      spot: string;
      overall_score: number;
      weather_score: number;
      surf_score: number;
      uv_safety_score: number;
    }>;
  };
  insights: string[];
  recommendations: string[];
  analysis_time: string;
}

export async function analyzeMultipleSpots(
  spotNames: string[],
  beachTypes?: Array<'surf' | 'family' | 'snorkel' | 'scenic' | 'mixed'>
): Promise<MultiSpotAnalysis> {
  try {
    // Import findSpot function
    const { findSpot } = await import("../utils/spots.js");
    
    // Resolve spot names to coordinates
    const spots = spotNames.map(name => {
      const spot = findSpot(name);
      if (!spot) throw new Error(`Spot "${name}" not found`);
      return spot;
    });

    // Analyze each spot
    const spotAnalyses: SpotAnalysis[] = [];
    
    for (let i = 0; i < spots.length; i++) {
      const spot = spots[i];
      const beachType = beachTypes?.[i] || 'mixed';
      
      try {
        // Get all data for this spot
        const [weather, surf, uv, tides] = await Promise.all([
          getWeather(spot.lat, spot.lon),
          getSurf(spot.lat, spot.lon),
          getUVIndex(spot.lat, spot.lon),
          getTides(spot.lat, spot.lon)
        ]);

        // Calculate outdoor index
        const outdoorIndex = computeOutdoorIndex(weather);
        
        // Calculate comprehensive beach score
        const beachScore = calculateBeachScore(weather, surf, uv, tides, beachType);
        
        // Generate summary
        const summary = generateSpotSummary(spot, weather, surf, uv, beachScore);
        
        spotAnalyses.push({
          name: spot.name,
          lat: spot.lat,
          lon: spot.lon,
          type: beachType,
          island: spot.island || 'Unknown',
          weather,
          weather_converted: weather.current_converted,
          surf,
          surf_converted: surf.hourly_converted,
          uv,
          tides,
          outdoorIndex,
          beachScore,
          summary
        });
      } catch (error) {
        console.error(`Failed to analyze spot ${spot.name}:`, error);
        // Add error entry
        spotAnalyses.push({
          name: spot.name,
          lat: spot.lat,
          lon: spot.lon,
          type: beachType,
          island: spot.island || 'Unknown',
          weather: null,
          weather_converted: null,
          surf: null,
          surf_converted: null,
          uv: null,
          tides: null,
          outdoorIndex: { index: 0, note: "Analysis failed" },
          beachScore: {
            overall: 0,
            weather: 0,
            waves: 0,
            uv_safety: 0,
            tides: 0,
            crowd_level: 0,
            breakdown: {
              temperature_score: 0,
              wind_score: 0,
              precipitation_score: 0,
              wave_height_score: 0,
              wave_period_score: 0,
              uv_index_score: 0,
              tide_level_score: 0,
            },
            recommendations: ["Unable to analyze this spot"],
            best_time_today: "Unknown"
          },
          summary: `Analysis failed for ${spot.name}`
        });
      }
    }

    // Generate comparison analysis
    const comparison = generateComparison(spotAnalyses);
    
    // Generate insights
    const insights = generateInsights(spotAnalyses);
    
    // Generate recommendations
    const recommendations = generateMultiSpotRecommendations(spotAnalyses);

    return {
      spots: spotAnalyses,
      comparison,
      insights,
      recommendations,
      analysis_time: new Date().toISOString()
    };
  } catch (error: any) {
    throw new Error(`Multi-spot analysis failed: ${error.message}`);
  }
}

function generateSpotSummary(
  spot: any, 
  weather: any, 
  surf: any, 
  uv: any, 
  beachScore: BeachScore
): string {
  const temp = weather?.current_converted?.temperature_fahrenheit || 'N/A';
  const wind = weather?.current_converted?.wind_speed_mph || 'N/A';
  const waves = surf?.hourly_converted?.wave_height_feet?.[0] || 'N/A';
  const uvIndex = uv?.uv_index || 'N/A';
  const overallScore = beachScore.overall;
  
  return `${spot.name}: ${overallScore}/10 overall score. Temp: ${temp}°F, Wind: ${wind} mph, Waves: ${waves} ft, UV: ${uvIndex}`;
}

function generateComparison(spots: SpotAnalysis[]): MultiSpotAnalysis['comparison'] {
  const validSpots = spots.filter(s => s.beachScore.overall > 0);
  
  if (validSpots.length === 0) {
    return {
      best_overall: "No valid data",
      best_weather: "No valid data",
      best_surf: "No valid data",
      best_family: "No valid data",
      best_snorkel: "No valid data",
      rankings: []
    };
  }

  // Find best spots by category
  const bestOverall = validSpots.reduce((best, current) => 
    current.beachScore.overall > best.beachScore.overall ? current : best
  );
  
  const bestWeather = validSpots.reduce((best, current) => 
    current.beachScore.weather > best.beachScore.weather ? current : best
  );
  
  const bestSurf = validSpots.reduce((best, current) => 
    current.beachScore.waves > best.beachScore.waves ? current : best
  );
  
  const bestFamily = validSpots
    .filter(s => s.type === 'family')
    .reduce((best, current) => 
      current.beachScore.overall > best.beachScore.overall ? current : best,
      validSpots[0] // fallback
    );
  
  const bestSnorkel = validSpots
    .filter(s => s.type === 'snorkel')
    .reduce((best, current) => 
      current.beachScore.overall > best.beachScore.overall ? current : best,
      validSpots[0] // fallback
    );

  // Generate rankings
  const rankings = validSpots
    .map(spot => ({
      spot: spot.name,
      overall_score: spot.beachScore.overall,
      weather_score: spot.beachScore.weather,
      surf_score: spot.beachScore.waves,
      uv_safety_score: spot.beachScore.uv_safety
    }))
    .sort((a, b) => b.overall_score - a.overall_score);

  return {
    best_overall: bestOverall.name,
    best_weather: bestWeather.name,
    best_surf: bestSurf.name,
    best_family: bestFamily.name,
    best_snorkel: bestSnorkel.name,
    rankings
  };
}

function generateInsights(spots: SpotAnalysis[]): string[] {
  const insights: string[] = [];
  const validSpots = spots.filter(s => s.beachScore.overall > 0);
  
  if (validSpots.length === 0) {
    return ["No valid data available for analysis"];
  }

  // Temperature insights
  const temps = validSpots.map(s => s.weather_converted?.temperature_fahrenheit).filter(t => t);
  if (temps.length > 0) {
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const tempRange = Math.max(...temps) - Math.min(...temps);
    insights.push(`Average temperature across spots: ${avgTemp.toFixed(1)}°F (range: ${tempRange.toFixed(1)}°F)`);
  }

  // Wave insights
  const waves = validSpots.map(s => s.surf_converted?.wave_height_feet?.[0]).filter(w => w);
  if (waves.length > 0) {
    const avgWaves = waves.reduce((a, b) => a + b, 0) / waves.length;
    const maxWaves = Math.max(...waves);
    const minWaves = Math.min(...waves);
    insights.push(`Wave conditions vary from ${minWaves.toFixed(1)}ft to ${maxWaves.toFixed(1)}ft (avg: ${avgWaves.toFixed(1)}ft)`);
  }

  // Score distribution
  const scores = validSpots.map(s => s.beachScore.overall);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const highScoreSpots = validSpots.filter(s => s.beachScore.overall >= 8).length;
  insights.push(`Average beach score: ${avgScore.toFixed(1)}/10. ${highScoreSpots} spots rated 8+ (excellent)`);

  // UV insights
  const uvLevels = validSpots.map(s => s.uv?.uv_index).filter(u => u);
  if (uvLevels.length > 0) {
    const avgUV = uvLevels.reduce((a, b) => a + b, 0) / uvLevels.length;
    const highUVSpots = validSpots.filter(s => (s.uv?.uv_index || 0) >= 7).length;
    insights.push(`Average UV index: ${avgUV.toFixed(1)}. ${highUVSpots} spots have high UV (7+) - sunscreen essential`);
  }

  return insights;
}

function generateMultiSpotRecommendations(spots: SpotAnalysis[]): string[] {
  const recommendations: string[] = [];
  const validSpots = spots.filter(s => s.beachScore.overall > 0);
  
  if (validSpots.length === 0) {
    return ["Unable to provide recommendations - no valid data"];
  }

  // Find the best overall spot
  const bestSpot = validSpots.reduce((best, current) => 
    current.beachScore.overall > best.beachScore.overall ? current : best
  );
  
  recommendations.push(`🏆 Best overall choice: ${bestSpot.name} (${bestSpot.beachScore.overall}/10)`);

  // Family-friendly recommendations
  const familySpots = validSpots.filter(s => s.type === 'family' && s.beachScore.overall >= 7);
  if (familySpots.length > 0) {
    const bestFamily = familySpots.reduce((best, current) => 
      current.beachScore.overall > best.beachScore.overall ? current : best
    );
    recommendations.push(`👨‍👩‍👧‍👦 Best for families: ${bestFamily.name} (${bestFamily.beachScore.overall}/10)`);
  }

  // Surf recommendations
  const surfSpots = validSpots.filter(s => s.type === 'surf' && s.beachScore.waves >= 7);
  if (surfSpots.length > 0) {
    const bestSurf = surfSpots.reduce((best, current) => 
      current.beachScore.waves > best.beachScore.waves ? current : best
    );
    recommendations.push(`🏄‍♂️ Best for surfing: ${bestSurf.name} (waves: ${bestSurf.beachScore.waves}/10)`);
  }

  // Snorkel recommendations
  const snorkelSpots = validSpots.filter(s => s.type === 'snorkel' && s.beachScore.overall >= 7);
  if (snorkelSpots.length > 0) {
    const bestSnorkel = snorkelSpots.reduce((best, current) => 
      current.beachScore.overall > best.beachScore.overall ? current : best
    );
    recommendations.push(`🤿 Best for snorkeling: ${bestSnorkel.name} (${bestSnorkel.beachScore.overall}/10)`);
  }

  // Weather-based recommendations
  const rainySpots = validSpots.filter(s => (s.weather?.current?.precipitation || 0) > 0.5);
  if (rainySpots.length > 0) {
    recommendations.push(`⚠️ ${rainySpots.length} spots have rain - consider indoor alternatives`);
  }

  // UV warnings
  const highUVSpots = validSpots.filter(s => (s.uv?.uv_index || 0) >= 7);
  if (highUVSpots.length > 0) {
    recommendations.push(`☀️ ${highUVSpots.length} spots have high UV - sunscreen and shade essential`);
  }

  return recommendations;
}
