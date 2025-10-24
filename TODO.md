# 📋 Current TODO List

## 🔥 Active Sprint: Phase 0.5 - Toolkit Upgrade (DO THIS FIRST!)

### Why Phase 0.5?
Current tools only return "right now" data. Can't plan a day without hourly forecasts!
**Build the foundation before the house.**

### Priority 1: Time-Series Data ⏰ ✅ COMPLETE!
- [x] **Upgrade `getWeather()`** → Add hourly forecast (current + 8 hours)
  - ✅ Parse hourly data from Open-Meteo
  - ✅ Return temp, wind, rain, conditions for each hour
  - ✅ Add summary (high/low, best hours)
  - ✅ Added weather condition descriptions
  - ✅ Identify best hours automatically
  - Time: ~30 min → DONE
  
- [x] **Upgrade `getSurf()`** → Add hourly forecast (current + 8 hours)
  - ✅ Parse hourly wave data from Open-Meteo Marine
  - ✅ Return wave height, period, direction for each hour
  - ✅ Add quality assessment per hour (0-5 rating)
  - ✅ Convert wave directions to compass names
  - ✅ Identify best surf hours automatically
  - ✅ Add wave trend (building/dropping)
  - Time: ~30 min → DONE

### Priority 2: Essential Tools (Next Session)
- [ ] **Add `getDriveTimes()`** → Calculate distances between beaches
  - Simple distance calculation (start)
  - Later: Integrate OpenRouteService or Google Maps API
  - Time: ~1 hour
  
- [ ] **Add `getSunTimes()`** → Sunrise/sunset for timing
  - Use SunCalc library or Open-Meteo
  - Return sunrise, sunset, golden hour times
  - Time: ~30 min
  
- [ ] **Add `getCrowdPrediction()`** → Rule-based crowd estimates
  - Simple logic: weekends = busy, mornings = quiet
  - Time-based predictions (9 AM vs 2 PM)
  - Time: ~1 hour

### Testing Current Session
- [ ] **Restart servers:** `./hawaii restart` (from local terminal)
- [ ] **Test hourly weather:** Ask AI "What's the weather for the next 8 hours at Waikiki?"
- [ ] **Test hourly surf:** Ask AI "When are the best waves today at North Shore?"
- [ ] **Verify quality scores:** Check that wave quality ratings make sense
- [ ] **Check summaries:** Ensure best_hours are identified correctly
- [ ] Update frontend to display hourly data (optional - Phase 2)

---

## 🎯 Tonight's Goal

**Upgrade toolkit to support day planning (Phase 0.5)**

1. ✅ Update TODO with Phase 0.5 tasks
2. Upgrade `getWeather()` with hourly data (30 min)
3. Upgrade `getSurf()` with hourly data (30 min)
4. Test both tools thoroughly (15 min)

**Success = Tools can answer "what are conditions at 2 PM?" not just "right now"**

---

## 📦 Backlog: Phase 1 - Full Day Planner (After Phase 0.5)

### Backend Tasks
- [ ] Create `planBeachDay()` MCP tool in `src/mcp/tools.ts`
  - Will use upgraded hourly tools
  - Define input schema (activity, skill, date, time, preferences)
  - Orchestrate multiple tools with time intelligence
  - Generate structured itinerary with optimal timing
- [ ] Add endpoint in `src/server.ts` for `/plan-day`
- [ ] Test tool with various scenarios

### Frontend Tasks
- [ ] Create "Plan My Day" button in hero section
- [ ] Build preferences modal component
- [ ] Create timeline UI component
- [ ] Add export/share buttons

### Testing
- [ ] Test: Surf day for intermediate surfer
- [ ] Test: Family beach day with kids
- [ ] Test: Multi-beach day itinerary

---

## 📝 Notes

- Keep it simple for MVP - can always add complexity later
- Focus on ONE activity type first (surf) if needed
- Perfect demo script is as important as the code
- Document what you learn about MCP orchestration

---

## ✅ Completed This Session

- [x] Cleaned up project (removed 17 useless files)
- [x] Fixed `stop-dev.sh` script (proper process killing)
- [x] Fixed `hawaii` control script (status checks, timing, ctrl+c)
- [x] Created comprehensive ROADMAP.md
- [x] Created TODO.md tracking

---

*Next: Start Phase 1 backend tool*

