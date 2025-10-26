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
    let closestStation = hawaiiStations[0]!;
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

export interface WeatherOptions {
  hours?: number;
  startOffsetHours?: number;
  timeDescriptor?: string;
}

function parseTimeDescriptor(descriptor?: string): { startOffsetHours?: number; hours?: number } {
  if (!descriptor) return {};
  const lower = descriptor.toLowerCase();
  let hours: number | undefined;
  let startOffsetHours: number | undefined;

  const matchHours = lower.match(/next\s+(\d+)\s*hour/);
  if (matchHours) {
    hours = Math.min(48, Math.max(1, parseInt(matchHours[1], 10)));
  }

  const matchDuration = lower.match(/(\d+)\s*hour/);
  if (!hours && matchDuration) {
    hours = Math.min(48, Math.max(1, parseInt(matchDuration[1], 10)));
  }

  if (lower.includes("tomorrow")) {
    startOffsetHours = 24;
  }
  if (lower.includes("tonight")) {
    startOffsetHours = 12;
  }

  if (lower.includes("morning")) {
    const base = lower.includes("tomorrow") ? 24 : 0;
    startOffsetHours = base + 6;
    hours = hours ?? 6;
  } else if (lower.includes("afternoon")) {
    const base = lower.includes("tomorrow") ? 24 : 0;
    startOffsetHours = base + 12;
    hours = hours ?? 6;
  } else if (lower.includes("evening")) {
    const base = lower.includes("tomorrow") ? 24 : 0;
    startOffsetHours = base + 17;
    hours = hours ?? 5;
  }

  return { startOffsetHours, hours };
}

export async function getWeather(lat: number, lon: number, options: WeatherOptions = {}) {
  const descriptorConfig = parseTimeDescriptor(options.timeDescriptor);
  const hoursToShow = Math.min(
    48,
    Math.max(1, options.hours ?? descriptorConfig.hours ?? 12)
  );
  const startOffsetHours = Math.max(0, options.startOffsetHours ?? descriptorConfig.startOffsetHours ?? 0);
  const forecastSpanHours = startOffsetHours + hoursToShow;
  const forecastDays = Math.min(3, Math.max(1, Math.ceil((forecastSpanHours + 1) / 24)));

  const url = "https://api.open-meteo.com/v1/forecast";
  const params = {
    latitude: lat,
    longitude: lon,
    current: ["temperature_2m","apparent_temperature","precipitation","wind_speed_10m"].join(","),
    hourly: ["temperature_2m","apparent_temperature","precipitation","wind_speed_10m","weather_code"].join(","),
    timezone: "Pacific/Honolulu",
    forecast_days: forecastDays
  };
  const { data } = await axios.get(url, { params, timeout: 8000 });
  
  // Add converted units to current data
  if (data.current) {
    const current = data.current;
    data.current_converted = {
      temperature_fahrenheit: celsiusToFahrenheit(current.temperature_2m),
      apparent_temperature_fahrenheit: celsiusToFahrenheit(current.apparent_temperature),
      wind_speed_mph: kmhToMph(current.wind_speed_10m),
      precipitation_mm: current.precipitation
    };
  }
  
  // Process hourly data - configurable window
  if (data.hourly && data.hourly.time) {
    // Use Hawaii timezone for comparison
    const now = new Date();
    const hawaiiTime = new Date(now.toLocaleString("en-US", {timeZone: "Pacific/Honolulu"}));
    const startTime = new Date(hawaiiTime.getTime() + startOffsetHours * 60 * 60 * 1000);
    
    let startIndex = data.hourly.time.findIndex((t: string) => {
      const hourTime = new Date(t);
      return hourTime >= startTime;
    });
    
    if (startIndex < 0) {
      startIndex = Math.max(0, data.hourly.time.length - hoursToShow);
    }
    
    if (startIndex >= 0) {
      const endIndex = Math.min(startIndex + hoursToShow, data.hourly.time.length);
      
      // Extract the relevant hours
      const hourlySlice = {
        time: data.hourly.time.slice(startIndex, endIndex),
        temperature_2m: data.hourly.temperature_2m.slice(startIndex, endIndex),
        apparent_temperature: data.hourly.apparent_temperature.slice(startIndex, endIndex),
        precipitation: data.hourly.precipitation.slice(startIndex, endIndex),
        wind_speed_10m: data.hourly.wind_speed_10m.slice(startIndex, endIndex),
        weather_code: data.hourly.weather_code.slice(startIndex, endIndex)
      };
      
      const hourlyEntries = [];
      // Build formatted hourly forecast
      data.hourly_forecast = hourlySlice.time.map((time: string, i: number) => {
        const hour = new Date(time);
        const weatherDescription = getWeatherDescription(hourlySlice.weather_code[i]);
        
        const entry = {
          time: hour.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Honolulu' }),
          hour_24: hour.getHours(),
          iso_time: hour.toISOString(),
          temperature_f: celsiusToFahrenheit(hourlySlice.temperature_2m[i]),
          feels_like_f: celsiusToFahrenheit(hourlySlice.apparent_temperature[i]),
          wind_mph: kmhToMph(hourlySlice.wind_speed_10m[i]),
          precipitation_mm: hourlySlice.precipitation[i],
          conditions: weatherDescription,
          is_good_weather: hourlySlice.precipitation[i] < 0.5 && hourlySlice.temperature_2m[i] >= 20 && hourlySlice.temperature_2m[i] <= 32
        };
        hourlyEntries.push(entry);
        return entry;
      });
      
      // Calculate summary stats
      const temps = hourlySlice.temperature_2m;
      data.forecast_summary = {
        period: `${hoursToShow} hour outlook starting ${startTime.toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'Pacific/Honolulu' })}`,
        high_f: celsiusToFahrenheit(Math.max(...temps)),
        low_f: celsiusToFahrenheit(Math.min(...temps)),
        avg_wind_mph: kmhToMph(hourlySlice.wind_speed_10m.reduce((a: number, b: number) => a + b, 0) / hourlySlice.wind_speed_10m.length),
        rain_expected: hourlySlice.precipitation.some((p: number) => p > 0.5),
        best_hours: hourlySlice.time
          .map((t: string, i: number) => ({ time: t, index: i }))
          .filter((h: any) => hourlySlice.precipitation[h.index] < 0.5 && hourlySlice.temperature_2m[h.index] >= 23 && hourlySlice.temperature_2m[h.index] <= 29)
          .slice(0, 3)
          .map((h: any) => new Date(h.time).toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'Pacific/Honolulu' }))
      };

      // Provide grouped summaries by day/period for planning scenarios
      const groupedByDay = new Map<string, typeof hourlyEntries>();
      hourlyEntries.forEach((entry) => {
        const date = new Date(entry.iso_time);
        const hawaiiDate = date.toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu' });
        if (!groupedByDay.has(hawaiiDate)) {
          groupedByDay.set(hawaiiDate, []);
        }
        groupedByDay.get(hawaiiDate)!.push(entry);
      });

      const periodRanges: Array<{ label: string; start: number; end: number }> = [
        { label: "sunrise", start: 5, end: 8 },
        { label: "morning", start: 8, end: 12 },
        { label: "afternoon", start: 12, end: 17 },
        { label: "evening", start: 17, end: 21 }
      ];

      data.period_summaries = Array.from(groupedByDay.entries()).map(([day, entriesForDay]) => {
        const periods = periodRanges.map(({ label, start, end }) => {
          const block = entriesForDay.filter((entry) => entry.hour_24 >= start && entry.hour_24 < end);
          if (block.length === 0) {
            return { label, available: false };
          }
          const avgTemp = block.reduce((sum, entry) => sum + entry.temperature_f, 0) / block.length;
          const avgWind = block.reduce((sum, entry) => sum + entry.wind_mph, 0) / block.length;
          const rainChance = block.filter((entry) => entry.precipitation_mm > 0.5).length / block.length;
          const familyFriendly = block.filter((entry) => entry.precipitation_mm < 0.5 && entry.wind_mph < 18 && entry.temperature_f >= 73 && entry.temperature_f <= 86).length / block.length;
          return {
            label,
            available: true,
            start: block[0].time,
            end: block[block.length - 1].time,
            avg_temperature_f: Math.round(avgTemp),
            avg_wind_mph: Math.round(avgWind),
            rain_probability: Math.round(rainChance * 100),
            family_friendly_score: Math.round(familyFriendly * 100)
          };
        });
        return { day, periods };
      });
    }
  }
  
  return data; // Enhanced payload with conversions and hourly forecast
}

// Helper function to convert weather codes to descriptions
function getWeatherDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 67) return "Rainy";
  if (code <= 77) return "Snowy";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}

export async function getSurf(lat: number, lon: number) {
  const url = "https://marine-api.open-meteo.com/v1/marine";
  const params = {
    latitude: lat,
    longitude: lon,
    hourly: ["wave_height","wave_direction","wave_period","wind_wave_height"].join(","),
    timezone: "Pacific/Honolulu",
    forecast_days: 1 // Only get today's data
  };
  const { data } = await (await import("axios")).default.get(url, { params, timeout: 8000 });
  
  // Add converted units to the response (keep for backward compatibility)
  if (data.hourly) {
    const hourly = data.hourly;
    data.hourly_converted = {
      wave_height_feet: hourly.wave_height?.map((h: number) => metersToFeet(h)),
      wind_wave_height_feet: hourly.wind_wave_height?.map((h: number) => metersToFeet(h)),
      wave_direction: hourly.wave_direction,
      wave_period: hourly.wave_period
    };
  }
  
  // Process hourly data - get current hour + next 8 hours
  if (data.hourly && data.hourly.time) {
    const now = new Date();
    const currentHourIndex = data.hourly.time.findIndex((t: string) => {
      const hourTime = new Date(t);
      return hourTime >= now;
    });
    
    if (currentHourIndex >= 0) {
      const hoursToShow = 9; // Current hour + 8 future hours
      const endIndex = Math.min(currentHourIndex + hoursToShow, data.hourly.time.length);
      
      // Extract the relevant hours
      const hourlySlice = {
        time: data.hourly.time.slice(currentHourIndex, endIndex),
        wave_height: data.hourly.wave_height.slice(currentHourIndex, endIndex),
        wave_direction: data.hourly.wave_direction.slice(currentHourIndex, endIndex),
        wave_period: data.hourly.wave_period.slice(currentHourIndex, endIndex),
        wind_wave_height: data.hourly.wind_wave_height?.slice(currentHourIndex, endIndex) || []
      };
      
      // Build formatted hourly forecast
      data.hourly_forecast = hourlySlice.time.map((time: string, i: number) => {
        const hour = new Date(time);
        const waveHeightFt = metersToFeet(hourlySlice.wave_height[i]);
        const wavePeriod = hourlySlice.wave_period[i];
        const waveQuality = assessWaveQuality(waveHeightFt, wavePeriod);
        const waveDir = getWaveDirectionName(hourlySlice.wave_direction[i]);
        
        return {
          time: hour.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Honolulu' }),
          hour_24: hour.getHours(),
          wave_height_ft: waveHeightFt,
          wave_height_m: hourlySlice.wave_height[i],
          wave_period_s: wavePeriod,
          wave_direction: waveDir,
          wave_direction_degrees: hourlySlice.wave_direction[i],
          quality: waveQuality.rating,
          quality_description: waveQuality.description,
          good_for_surfing: waveQuality.rating >= 3 // 3+ out of 5 is good
        };
      });
      
      // Calculate summary stats
      const waveHeights = hourlySlice.wave_height;
      const wavePeriods = hourlySlice.wave_period;
      data.surf_summary = {
        period: `Next ${hoursToShow} hours`,
        max_wave_height_ft: metersToFeet(Math.max(...waveHeights)),
        min_wave_height_ft: metersToFeet(Math.min(...waveHeights)),
        avg_wave_height_ft: metersToFeet(waveHeights.reduce((a: number, b: number) => a + b, 0) / waveHeights.length),
        avg_wave_period_s: wavePeriods.reduce((a: number, b: number) => a + b, 0) / wavePeriods.length,
        dominant_direction: getWaveDirectionName(hourlySlice.wave_direction[0]),
        trend: waveHeights[waveHeights.length - 1] > waveHeights[0] ? "building" : "dropping",
        best_hours: hourlySlice.time
          .map((t: string, i: number) => ({ time: t, index: i, score: assessWaveQuality(metersToFeet(hourlySlice.wave_height[i]), hourlySlice.wave_period[i]).rating }))
          .filter((h: any) => h.score >= 3)
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 3)
          .map((h: any) => new Date(h.time).toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'Pacific/Honolulu' }))
      };
    }
  }
  
  return data; // Enhanced payload with conversions and hourly forecast
}

// Helper function to assess wave quality for surfing
function assessWaveQuality(waveHeightFt: number, periodS: number): { rating: number, description: string } {
  // Rating out of 5
  let rating = 0;
  let description = "";
  
  // Wave height scoring (ideal 2-6ft for most surfers)
  if (waveHeightFt >= 2 && waveHeightFt <= 6) {
    rating += 2.5;
    description = "Good height";
  } else if (waveHeightFt >= 1 && waveHeightFt < 2) {
    rating += 1.5;
    description = "Small waves";
  } else if (waveHeightFt > 6 && waveHeightFt <= 10) {
    rating += 2;
    description = "Large waves";
  } else if (waveHeightFt > 10) {
    rating += 1;
    description = "Very large - advanced only";
  } else {
    rating += 0.5;
    description = "Very small - flat";
  }
  
  // Period scoring (longer period = better quality)
  if (periodS >= 12) {
    rating += 2.5;
    description += ", excellent period";
  } else if (periodS >= 10) {
    rating += 2;
    description += ", good period";
  } else if (periodS >= 8) {
    rating += 1.5;
    description += ", moderate period";
  } else if (periodS >= 6) {
    rating += 1;
    description += ", short period";
  } else {
    rating += 0.5;
    description += ", very short period";
  }
  
  return { rating, description };
}

// Helper function to convert wave direction to compass direction
function getWaveDirectionName(degrees: number): string {
  if (degrees >= 337.5 || degrees < 22.5) return "N";
  if (degrees >= 22.5 && degrees < 67.5) return "NE";
  if (degrees >= 67.5 && degrees < 112.5) return "E";
  if (degrees >= 112.5 && degrees < 157.5) return "SE";
  if (degrees >= 157.5 && degrees < 202.5) return "S";
  if (degrees >= 202.5 && degrees < 247.5) return "SW";
  if (degrees >= 247.5 && degrees < 292.5) return "W";
  if (degrees >= 292.5 && degrees < 337.5) return "NW";
  return "N";
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
      return spot!;
    });

    // Analyze each spot
    const spotAnalyses: SpotAnalysis[] = [];
    
    for (let i = 0; i < spots.length; i++) {
      const spot = spots[i]!;
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
  
  const familySpots = validSpots.filter(s => s.type === 'family');
  const bestFamily = familySpots.length > 0 
    ? familySpots.reduce((best, current) => 
        current.beachScore.overall > best.beachScore.overall ? current : best
      )
    : null;
  
  const snorkelSpots = validSpots.filter(s => s.type === 'snorkel');
  const bestSnorkel = snorkelSpots.length > 0 
    ? snorkelSpots.reduce((best, current) => 
        current.beachScore.overall > best.beachScore.overall ? current : best
      )
    : null;

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
    best_family: bestFamily?.name || "No family spots",
    best_snorkel: bestSnorkel?.name || "No snorkel spots",
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

/**
 * Get sunrise/sunset times for a location
 */
export async function getSunTimes(lat: number, lon: number): Promise<any> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset,sunshine_duration&timezone=auto&forecast_days=1`
    );
    
    if (!response.ok) {
      throw new Error(`Sun times API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.daily || !data.daily.sunrise || !data.daily.sunset) {
      throw new Error('Invalid sun times data received');
    }
    
    const sunrise = data.daily.sunrise[0];
    const sunset = data.daily.sunset[0];
    const sunshineDuration = data.daily.sunshine_duration[0]; // seconds
    
    // Parse times and calculate day length
    const sunriseTime = new Date(sunrise);
    const sunsetTime = new Date(sunset);
    const dayLengthMs = sunsetTime.getTime() - sunriseTime.getTime();
    const dayLengthHours = Math.floor(dayLengthMs / (1000 * 60 * 60));
    const dayLengthMinutes = Math.floor((dayLengthMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // Format times for display
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    };
    
    // Calculate golden hour times (1 hour after sunrise, 1 hour before sunset)
    const goldenHourStart = new Date(sunriseTime.getTime() + (60 * 60 * 1000));
    const goldenHourEnd = new Date(sunsetTime.getTime() - (60 * 60 * 1000));
    
    return {
      location: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
      date: sunrise.split('T')[0],
      sunrise: {
        time: sunrise,
        formatted: formatTime(sunriseTime),
        hour_24: sunriseTime.getHours()
      },
      sunset: {
        time: sunset,
        formatted: formatTime(sunsetTime),
        hour_24: sunsetTime.getHours()
      },
      day_length: {
        hours: dayLengthHours,
        minutes: dayLengthMinutes,
        total_minutes: Math.floor(dayLengthMs / (1000 * 60)),
        formatted: `${dayLengthHours}h ${dayLengthMinutes}m`
      },
      golden_hour: {
        start: {
          time: goldenHourStart.toISOString(),
          formatted: formatTime(goldenHourStart),
          hour_24: goldenHourStart.getHours()
        },
        end: {
          time: goldenHourEnd.toISOString(),
          formatted: formatTime(goldenHourEnd),
          hour_24: goldenHourEnd.getHours()
        }
      },
      sunshine_duration_hours: Math.round(sunshineDuration / 3600),
      timezone: data.timezone,
      utc_offset_seconds: data.utc_offset_seconds
    };
    
  } catch (error) {
    console.error('Error fetching sun times:', error);
    throw new Error(`Failed to get sun times: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
