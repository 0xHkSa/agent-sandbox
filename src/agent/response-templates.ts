// Response Templates for AI Agent
// Provides consistent, natural responses for common question types

export interface TemplateContext {
  location: string;
  temperature: number;
  windSpeed: number;
  precipitation: number;
  conditions: string;
  waveHeight?: number;
  wavePeriod?: number;
  uvIndex?: number;
  tideLevel?: number;
  beachScore?: number;
  hourlyForecast?: any[];
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  activityType?: 'surfing' | 'family' | 'snorkeling' | 'general';
}

export interface ResponseTemplate {
  id: string;
  category: 'weather' | 'surf' | 'beach_score' | 'general';
  patterns: string[]; // Question patterns this template matches
  template: (context: TemplateContext) => string;
  priority: number; // Higher number = higher priority
}

// Weather Response Templates
export const weatherTemplates: ResponseTemplate[] = [
  {
    id: 'current_weather_excellent',
    category: 'weather',
    patterns: ['weather', 'temperature', 'conditions'],
    priority: 12,
    template: (ctx) => {
      const timeGreeting = getTimeGreeting(ctx.timeOfDay);
      const activityHint = getActivityHint(ctx);
      return `${timeGreeting} ${ctx.location} is absolutely perfect! ${ctx.temperature}°F with gentle ${ctx.windSpeed}mph winds and ${ctx.conditions.toLowerCase()}. ${activityHint} This is exactly what you want for a great day out.`;
    }
  },
  {
    id: 'current_weather_good',
    category: 'weather',
    patterns: ['weather', 'temperature', 'conditions'],
    priority: 10,
    template: (ctx) => {
      const timeGreeting = getTimeGreeting(ctx.timeOfDay);
      const activityHint = getActivityHint(ctx);
      return `${timeGreeting} ${ctx.location} is looking great! ${ctx.temperature}°F with ${ctx.windSpeed}mph winds and ${ctx.conditions.toLowerCase()}. ${activityHint} Perfect weather for outdoor activities.`;
    }
  },
  {
    id: 'current_weather_moderate',
    category: 'weather',
    patterns: ['weather', 'temperature', 'conditions'],
    priority: 9,
    template: (ctx) => {
      const timeGreeting = getTimeGreeting(ctx.timeOfDay);
      const advice = getWeatherAdvice(ctx);
      const alternative = getAlternativeActivity(ctx);
      return `${timeGreeting} ${ctx.location} is ${ctx.temperature}°F with ${ctx.windSpeed}mph winds and ${ctx.conditions.toLowerCase()}. ${advice} ${alternative}`;
    }
  },
  {
    id: 'weather_forecast_hours',
    category: 'weather',
    patterns: ['next', 'hours', 'forecast'],
    priority: 8,
    template: (ctx) => {
      if (ctx.hourlyForecast && ctx.hourlyForecast.length > 0) {
        const hours = ctx.hourlyForecast.length;
        const tempRange = getTempRange(ctx.hourlyForecast);
        const trend = getWeatherTrend(ctx.hourlyForecast);
        const bestTime = getBestTimeWindow(ctx.hourlyForecast);
        return `For the next ${hours} hours in ${ctx.location}: temperatures ${tempRange}°F, ${ctx.windSpeed}mph winds, and ${ctx.conditions.toLowerCase()}. ${trend} ${bestTime}`;
      }
      return `Weather forecast for ${ctx.location}: ${ctx.temperature}°F with ${ctx.windSpeed}mph winds and ${ctx.conditions.toLowerCase()}.`;
    }
  },
  {
    id: 'weather_rain_concern',
    category: 'weather',
    patterns: ['rain', 'precipitation', 'wet'],
    priority: 7,
    template: (ctx) => {
      if (ctx.precipitation > 0.5) {
        const indoorSuggestions = getIndoorSuggestions(ctx);
        return `${ctx.location} has rain expected (${ctx.precipitation}mm). ${indoorSuggestions} Or check back in a few hours - conditions can change quickly here!`;
      }
      return `${ctx.location} is dry with no rain expected. Great conditions for outdoor activities!`;
    }
  },
  {
    id: 'weather_hot_concern',
    category: 'weather',
    patterns: ['hot', 'warm', 'temperature'],
    priority: 6,
    template: (ctx) => {
      if (ctx.temperature > 85) {
        const heatAdvice = getHeatAdvice(ctx);
        return `${ctx.location} is quite warm at ${ctx.temperature}°F! ${heatAdvice} Consider early morning or late afternoon activities when it's cooler.`;
      }
      return `${ctx.location} has comfortable temperatures at ${ctx.temperature}°F. Perfect for outdoor activities!`;
    }
  }
];

// Surf Response Templates
export const surfTemplates: ResponseTemplate[] = [
  {
    id: 'surf_conditions_excellent',
    category: 'surf',
    patterns: ['surf', 'waves', 'surfing'],
    priority: 12,
    template: (ctx) => {
      if (ctx.waveHeight && ctx.wavePeriod) {
        const quality = assessSurfQuality(ctx.waveHeight, ctx.wavePeriod);
        const skillLevel = getSkillLevelAdvice(ctx.waveHeight, ctx.wavePeriod);
        const bestTime = getBestSurfTime(ctx);
        return `${ctx.location} surf is absolutely firing! ${ctx.waveHeight}ft waves with ${ctx.wavePeriod}s period - ${quality} conditions! ${skillLevel} ${bestTime}`;
      }
      return `${ctx.location} surf conditions look excellent with ${ctx.windSpeed}mph winds. Check local reports for wave details.`;
    }
  },
  {
    id: 'surf_conditions_good',
    category: 'surf',
    patterns: ['surf', 'waves', 'surfing'],
    priority: 10,
    template: (ctx) => {
      if (ctx.waveHeight && ctx.wavePeriod) {
        const quality = assessSurfQuality(ctx.waveHeight, ctx.wavePeriod);
        const skillLevel = getSkillLevelAdvice(ctx.waveHeight, ctx.wavePeriod);
        return `${ctx.location} surf: ${ctx.waveHeight}ft waves with ${ctx.wavePeriod}s period. ${quality} conditions for surfing! ${skillLevel}`;
      }
      return `${ctx.location} surf conditions look good with ${ctx.windSpeed}mph winds. Check local reports for wave details.`;
    }
  },
  {
    id: 'surf_conditions_poor',
    category: 'surf',
    patterns: ['surf', 'waves', 'surfing'],
    priority: 9,
    template: (ctx) => {
      if (ctx.waveHeight && ctx.waveHeight < 2) {
        const alternatives = getSurfAlternatives(ctx);
        return `${ctx.location} has small waves (${ctx.waveHeight}ft). ${alternatives} Or check North Shore - it might be bigger there!`;
      }
      return `${ctx.location} surf conditions are challenging with ${ctx.windSpeed}mph winds. Consider other activities today.`;
    }
  },
  {
    id: 'surf_conditions_dangerous',
    category: 'surf',
    patterns: ['surf', 'waves', 'surfing'],
    priority: 11,
    template: (ctx) => {
      if (ctx.waveHeight && ctx.waveHeight > 8) {
        const safetyAdvice = getSurfSafetyAdvice(ctx);
        return `⚠️ ${ctx.location} has big waves (${ctx.waveHeight}ft) - ${ctx.wavePeriod}s period. ${safetyAdvice} Only experienced surfers should consider it.`;
      }
      return `${ctx.location} surf conditions are challenging with ${ctx.windSpeed}mph winds. Consider other activities today.`;
    }
  }
];

// Beach Score Response Templates
export const beachScoreTemplates: ResponseTemplate[] = [
  {
    id: 'beach_score_excellent',
    category: 'beach_score',
    patterns: ['score', 'rating', 'best', 'good'],
    priority: 12,
    template: (ctx) => {
      if (ctx.beachScore && ctx.beachScore >= 8) {
        const highlights = getBeachHighlights(ctx);
        const perfectFor = getPerfectActivities(ctx);
        return `${ctx.location} scores ${ctx.beachScore}/10 - absolutely excellent! ${highlights} Perfect for ${perfectFor}. This is exactly what you want for an amazing beach day!`;
      }
      return `${ctx.location} has outstanding conditions today. Ideal for beach activities!`;
    }
  },
  {
    id: 'beach_score_good',
    category: 'beach_score',
    patterns: ['score', 'rating', 'good'],
    priority: 10,
    template: (ctx) => {
      if (ctx.beachScore && ctx.beachScore >= 6) {
        const strengths = getBeachStrengths(ctx);
        const recommendations = getActivityRecommendations(ctx);
        return `${ctx.location} scores ${ctx.beachScore}/10 - solid conditions! ${strengths} Great for ${recommendations}.`;
      }
      return `${ctx.location} has decent conditions today. Worth checking out!`;
    }
  },
  {
    id: 'beach_score_moderate',
    category: 'beach_score',
    patterns: ['score', 'rating'],
    priority: 8,
    template: (ctx) => {
      if (ctx.beachScore && ctx.beachScore >= 4) {
        const concerns = getBeachConcerns(ctx);
        const alternatives = getAlternativeBeaches(ctx);
        return `${ctx.location} scores ${ctx.beachScore}/10 - moderate conditions. ${concerns} ${alternatives}`;
      }
      return `${ctx.location} has mixed conditions today. Consider other options.`;
    }
  }
];

// General Response Templates
export const generalTemplates: ResponseTemplate[] = [
  {
    id: 'activity_recommendation',
    category: 'general',
    patterns: ['recommend', 'suggest', 'what to do'],
    priority: 8,
    template: (ctx) => {
      const activity = getActivityRecommendation(ctx);
      return `Based on current conditions in ${ctx.location}, I'd recommend ${activity}. ${getActivityReasoning(ctx)}`;
    }
  },
  {
    id: 'safety_concern',
    category: 'general',
    patterns: ['safe', 'dangerous', 'risk'],
    priority: 9,
    template: (ctx) => {
      const safetyLevel = assessSafetyLevel(ctx);
      return `${ctx.location} conditions are ${safetyLevel}. ${getSafetyAdvice(ctx)}`;
    }
  }
];

// Helper Functions
function getTimeGreeting(timeOfDay?: string): string {
  switch (timeOfDay) {
    case 'morning': return 'Good morning!';
    case 'afternoon': return 'Good afternoon!';
    case 'evening': return 'Good evening!';
    case 'night': return 'Good evening!';
    default: return 'Right now,';
  }
}

// Enhanced activity and condition helpers
function getActivityHint(ctx: TemplateContext): string {
  if (ctx.temperature >= 80 && ctx.windSpeed < 10) {
    return 'Perfect for swimming and sunbathing!';
  }
  if (ctx.windSpeed > 15) {
    return 'Great for wind sports or a refreshing walk!';
  }
  if (ctx.temperature < 75) {
    return 'Nice for hiking or exploring!';
  }
  return 'Ideal for any outdoor adventure!';
}

function getWeatherTrend(hourlyForecast: any[]): string {
  if (!hourlyForecast || hourlyForecast.length < 2) return '';
  
  const temps = hourlyForecast.map(h => h.temperature_f);
  const firstHalf = temps.slice(0, Math.floor(temps.length / 2));
  const secondHalf = temps.slice(Math.floor(temps.length / 2));
  
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  if (secondAvg > firstAvg + 2) return 'Temperatures are rising throughout the day.';
  if (secondAvg < firstAvg - 2) return 'Temperatures are cooling off later.';
  return 'Conditions are staying pretty consistent.';
}

function getBestTimeWindow(hourlyForecast: any[]): string {
  if (!hourlyForecast || hourlyForecast.length === 0) return '';
  
  const goodHours = hourlyForecast.filter(h => 
    h.precipitation_mm < 0.5 && 
    h.temperature_f >= 75 && 
    h.temperature_f <= 85 &&
    h.wind_mph < 15
  );
  
  if (goodHours.length === 0) return 'Conditions are mixed throughout the period.';
  if (goodHours.length === hourlyForecast.length) return 'Great conditions all day long!';
  
  const bestTimes = goodHours.slice(0, 3).map(h => h.time);
  return `Best times: ${bestTimes.join(', ')}.`;
}

function getIndoorSuggestions(ctx: TemplateContext): string {
  const suggestions = [
    'Check out the Bishop Museum or Iolani Palace',
    'Visit Pearl Harbor or the Polynesian Cultural Center',
    'Explore local shops and restaurants',
    'Try indoor activities like bowling or movies'
  ];
  return suggestions[Math.floor(Math.random() * suggestions.length)] || 'Try indoor activities';
}

function getHeatAdvice(ctx: TemplateContext): string {
  if (ctx.uvIndex && ctx.uvIndex > 8) {
    return 'High UV and heat - definitely use sunscreen and seek shade!';
  }
  return 'Stay hydrated and take breaks in the shade!';
}

function getAlternativeActivity(ctx: TemplateContext): string {
  if (ctx.windSpeed > 20) {
    return 'The wind makes it perfect for kiteboarding or windsurfing!';
  }
  if (ctx.temperature < 70) {
    return 'Great weather for hiking or exploring the island!';
  }
  return 'Consider indoor activities or wait for better conditions.';
}

// Surf-specific helpers
function getSkillLevelAdvice(waveHeight: number, wavePeriod: number): string {
  if (waveHeight >= 6) return 'Advanced surfers only - these are serious waves!';
  if (waveHeight >= 4) return 'Intermediate to advanced surfers will love this!';
  if (waveHeight >= 2) return 'Perfect for beginners to intermediate surfers!';
  return 'Great for learning or longboarding!';
}

function getBestSurfTime(ctx: TemplateContext): string {
  if (ctx.windSpeed < 10) return 'Light winds make this perfect timing!';
  if (ctx.windSpeed > 15) return 'Windy conditions - early morning might be better.';
  return 'Good conditions for surfing!';
}

function getSurfAlternatives(ctx: TemplateContext): string {
  const alternatives = [
    'Try stand-up paddleboarding or kayaking instead',
    'Perfect day for snorkeling or swimming',
    'Great weather for beach volleyball or frisbee',
    'Consider hiking or exploring the island'
  ];
  return alternatives[Math.floor(Math.random() * alternatives.length)] || 'Try other beach activities';
}

function getSurfSafetyAdvice(ctx: TemplateContext): string {
  if (ctx.waveHeight && ctx.waveHeight > 10) return 'These are massive waves - only expert surfers should attempt.';
  return 'Strong currents and big waves - surf with a buddy and know your limits.';
}

// Beach score helpers
function getBeachHighlights(ctx: TemplateContext): string {
  const highlights = [];
  if (ctx.temperature >= 80) highlights.push('perfect temperature');
  if (ctx.windSpeed < 10) highlights.push('calm winds');
  if (ctx.precipitation < 0.5) highlights.push('no rain');
  if (ctx.uvIndex && ctx.uvIndex < 6) highlights.push('moderate UV');
  
  if (highlights.length === 0) return 'Good overall conditions.';
  return `Highlights: ${highlights.join(', ')}.`;
}

function getPerfectActivities(ctx: TemplateContext): string {
  if (ctx.waveHeight && ctx.waveHeight >= 3) return 'surfing and beach activities';
  if (ctx.temperature >= 80 && ctx.windSpeed < 10) return 'swimming, sunbathing, and water sports';
  if (ctx.windSpeed > 15) return 'wind sports and beach walks';
  return 'all beach activities';
}

function getBeachStrengths(ctx: TemplateContext): string {
  const strengths = [];
  if (ctx.temperature >= 75) strengths.push('comfortable temperature');
  if (ctx.windSpeed < 15) strengths.push('manageable winds');
  if (ctx.precipitation < 1) strengths.push('minimal rain risk');
  
  if (strengths.length === 0) return 'Decent overall conditions.';
  return `Strengths: ${strengths.join(', ')}.`;
}

function getActivityRecommendations(ctx: TemplateContext): string {
  if (ctx.waveHeight && ctx.waveHeight >= 2) return 'surfing and beach activities';
  if (ctx.temperature >= 80) return 'swimming and sunbathing';
  if (ctx.windSpeed > 15) return 'wind sports';
  return 'general beach activities';
}

function getBeachConcerns(ctx: TemplateContext): string {
  const concerns = [];
  if (ctx.temperature < 70) concerns.push('cooler temperatures');
  if (ctx.windSpeed > 20) concerns.push('strong winds');
  if (ctx.precipitation > 1) concerns.push('rain risk');
  if (ctx.uvIndex && ctx.uvIndex > 8) concerns.push('high UV');
  
  if (concerns.length === 0) return 'Some mixed conditions.';
  return `Concerns: ${concerns.join(', ')}.`;
}

function getAlternativeBeaches(ctx: TemplateContext): string {
  const alternatives = [
    'Try Waikiki for calmer conditions',
    'Check out North Shore for different conditions',
    'Consider Kailua Beach for family-friendly options',
    'Lanikai might have better conditions'
  ];
  return alternatives[Math.floor(Math.random() * alternatives.length)] || 'Try other beaches';
}

function getWeatherAdvice(ctx: TemplateContext): string {
  if (ctx.temperature < 70) return 'You might want a light jacket.';
  if (ctx.temperature > 85) return 'Stay hydrated and seek shade.';
  if (ctx.windSpeed > 20) return 'It\'s quite windy - secure loose items.';
  return 'Comfortable conditions for outdoor activities.';
}

function getForecastAdvice(ctx: TemplateContext): string {
  if (ctx.precipitation > 0.5) return 'Rain is expected, so plan accordingly.';
  if (ctx.windSpeed > 15) return 'Windy conditions may affect some activities.';
  return 'Stable conditions throughout the period.';
}

function assessSurfQuality(waveHeight: number, wavePeriod: number): string {
  if (waveHeight >= 4 && wavePeriod >= 10) return 'Excellent';
  if (waveHeight >= 3 && wavePeriod >= 8) return 'Good';
  if (waveHeight >= 2 && wavePeriod >= 6) return 'Fair';
  return 'Poor';
}

function getActivityRecommendation(ctx: TemplateContext): string {
  if (ctx.activityType) {
    switch (ctx.activityType) {
      case 'surfing': return 'surfing';
      case 'family': return 'family beach time';
      case 'snorkeling': return 'snorkeling';
      default: return 'beach activities';
    }
  }
  
  if (ctx.waveHeight && ctx.waveHeight >= 3) return 'surfing';
  if (ctx.temperature >= 80 && ctx.windSpeed < 15) return 'swimming and sunbathing';
  if (ctx.windSpeed > 20) return 'wind sports';
  return 'general beach activities';
}

function getActivityReasoning(ctx: TemplateContext): string {
  const reasons = [];
  if (ctx.temperature >= 75) reasons.push('warm temperatures');
  if (ctx.windSpeed < 15) reasons.push('calm winds');
  if (ctx.precipitation < 0.5) reasons.push('no rain expected');
  if (ctx.uvIndex && ctx.uvIndex < 6) reasons.push('moderate UV levels');
  
  return reasons.length > 0 ? `Great because of ${reasons.join(', ')}.` : 'Conditions look decent.';
}

function assessSafetyLevel(ctx: TemplateContext): string {
  if (ctx.waveHeight && ctx.waveHeight > 6) return 'challenging';
  if (ctx.windSpeed > 25) return 'windy';
  if (ctx.uvIndex && ctx.uvIndex > 8) return 'high UV';
  return 'safe';
}

function getSafetyAdvice(ctx: TemplateContext): string {
  if (ctx.waveHeight && ctx.waveHeight > 6) return 'Large waves - experienced surfers only.';
  if (ctx.windSpeed > 25) return 'Strong winds - avoid water activities.';
  if (ctx.uvIndex && ctx.uvIndex > 8) return 'High UV - use sunscreen and seek shade.';
  return 'Standard beach safety applies.';
}

function getTempRange(hourlyForecast: any[]): string {
  if (!hourlyForecast || hourlyForecast.length === 0) return '';
  
  const temps = hourlyForecast.map(h => h.temperature_f);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  
  if (min === max) return `${min}`;
  return `${min}-${max}`;
}

// Template Selection Logic
export function selectBestTemplate(question: string, context: TemplateContext): ResponseTemplate | null {
  const allTemplates = [...weatherTemplates, ...surfTemplates, ...beachScoreTemplates, ...generalTemplates];
  const q = question.toLowerCase();
  
  // Find templates that match the question patterns
  const matchingTemplates = allTemplates.filter(template => 
    template.patterns.some(pattern => q.includes(pattern))
  );
  
  if (matchingTemplates.length === 0) return null;
  
  // Sort by priority and return the best match
  return matchingTemplates.sort((a, b) => b.priority - a.priority)[0] || null;
}

// Template Application
export function applyTemplate(template: ResponseTemplate, context: TemplateContext): string {
  try {
    return template.template(context);
  } catch (error) {
    console.error('Template application error:', error);
    return `Current conditions in ${context.location}: ${context.temperature}°F, ${context.windSpeed}mph winds, ${context.conditions.toLowerCase()}.`;
  }
}
