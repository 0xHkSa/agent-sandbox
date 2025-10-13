import axios from "axios";

export async function getWeather(lat: number, lon: number) {
  const url = "https://api.open-meteo.com/v1/forecast";
  const params = {
    latitude: lat,
    longitude: lon,
    current: ["temperature_2m","apparent_temperature","precipitation","wind_speed_10m"].join(","),
    timezone: "Pacific/Honolulu"
  };
  const { data } = await axios.get(url, { params, timeout: 8000 });
  return data; // raw Open-Meteo payload
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
  return data; // raw marine payload
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
