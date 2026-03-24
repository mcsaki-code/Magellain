# NoticeOfRace.net Data Analysis & Feature Roadmap

## Data Model from NoticeOfRace.net

Based on the boat performance page (ID=706, Impetuous) and exported results, NoticeOfRace.net tracks the following data per boat:

### Per-Event Data
- **Scored Events**: List of all regattas/series the boat has competed in
- **Division/Fleet**: JAM A, Spinnaker A/B/C (boat can race in different divisions)
- **Rating**: PHRF rating at time of race (can vary per event, e.g., Pi scored at 132)
- **Series standings**: Total points, place, throwouts applied

### Per-Race Data
- **Finish Time**: Actual clock time (e.g., "8:27:12 PM")
- **Elapsed Time**: Duration from start to finish (e.g., "01:17:12")
- **Corrected Elapsed**: PHRF-adjusted time (e.g., "01:00:14")
- **Corrected Position**: Final placement after handicap
- **Status Codes**: Finished, DNC, DNF, DSQ, DNS, RC, TLE, OCS, RAF, UFD, RDG
- **Seconds/Mile (Class)**: Gap to winner expressed as seconds per nautical mile
- **VMG**: Velocity Made Good (kts) — the key performance metric
- **Course Distance**: Nautical miles (e.g., 4.80 JAM, 6.00 Spinnaker)
- **Start Time**: Per-division start times

### Boat Profile Data
- Sail number, boat name, skipper, club affiliation
- Model/class (e.g., Kelt 8.5, S2 7.9, Abbott 33)
- PHRF/JAM ratings (can differ)

---

## Gap Analysis: Current App vs. NoticeOfRace.net

| Feature | NoticeOfRace | MagellAIn Current | Priority |
|---------|-------------|-------------------|----------|
| Series standings with cumulative points | Yes | No (race-by-race only) | **P0** |
| Boat performance page (all events) | Yes | No | **P0** |
| VMG tracking per race | Yes (calculated) | Stored in raw_data only | **P1** |
| Corrected time display | Yes | Partial (stored, not shown) | **P1** |
| Seconds/mile gap analysis | Yes | No | **P1** |
| Throwout scoring | Yes (configurable) | No | **P1** |
| Head-to-head competitor comparison | No | No | **P2** |
| Performance trend charts over time | No | No | **P2** |
| Rating change tracking | Yes (per-race) | No | **P2** |
| Multi-club fleet registry | Yes | Partial (boats exist) | **P3** |
| Course/distance tracking | Yes | Schema exists, not populated | **P3** |

---

## Proposed Features (Ordered by Impact)

### Phase 1: Series Standings & Boat Performance (Sprint 1-2)

#### 1A. Series Standings Page
**What**: Compute and display cumulative series standings per fleet, matching NoticeOfRace.net's format.
**Data we have**: All 12 WNATR races + 4 divisions + Spring #1 are now in Supabase.
**Implementation**:
- New component: `SeriesStandings` — queries all race_results for a regatta, groups by fleet, sums corrected_position per boat
- Throwout support: regatta-level `throwouts` count (stored in raw_data or new column)
- Display: Table with boat name, R1-R12 scores, total, place — matching the PDF format
- Color-code DNF/DNC/DSQ differently from finishes

#### 1B. Boat Performance Dashboard
**What**: Per-boat page showing all race history, VMG trends, and head-to-head stats.
**Route**: `/menu/boats/[id]/performance`
**Data we have**: Impetuous has 13 races (12 WNATR + Spring #1 with VMG/timing).
**Sections**:
- **Season Summary**: Races sailed, wins, podiums, avg finish, best VMG
- **Race Log**: Chronological list of all results with expandable details
- **VMG Chart**: Line chart of VMG over time (where available)
- **Fleet Position Trend**: Sparkline showing position across a series
- **Head-to-Head**: Compare against any other boat in the same fleet

#### 1C. Enhanced Race Results Display
**What**: Show full results table per race (not just winners), with corrected times, elapsed times, VMG.
**Current**: Only shows fleet winners with medal icon.
**Proposed**: Expandable full results table per race, sortable by fleet.

### Phase 2: Analytics & Insights (Sprint 3-4)

#### 2A. VMG Analytics
**What**: Track and visualize VMG (Velocity Made Good) as the primary performance metric.
**Why**: VMG is the gold standard for racing performance — it tells you how fast you actually moved toward the mark regardless of course sailed. The Spring #1 data already has VMG values (Impetuous: 3.73 kts, Feisty: 4.31 kts).
**Implementation**:
- Extract VMG from raw_data where available
- Calculate VMG from elapsed_time and distance where we have both: `VMG = distance_nm / (elapsed_time_sec / 3600)`
- Show VMG alongside corrected position in results
- VMG comparison chart across boats in same race

#### 2B. Seconds-Per-Mile Gap Analysis
**What**: Express the gap between boats as seconds per nautical mile — a normalized metric that works across different course lengths.
**Formula**: `(boat_corrected_sec - winner_corrected_sec) / distance_nm`
**Why**: This is how NoticeOfRace.net shows gaps. It lets you compare performance across races of different lengths.

#### 2C. PHRF Performance Analysis
**What**: Track how a boat performs relative to its PHRF rating.
**Metrics**:
- **Rating Efficiency**: Does the boat consistently beat or lose to its rating?
- **Rating Delta**: Suggested rating adjustment based on actual performance
- **Fleet Handicap Analysis**: Show which boats are over/under-rated in the fleet

### Phase 3: Data Import & Automation (Sprint 5-6)

#### 3A. NoticeOfRace.net Scraper
**What**: Automated import of results from noticeofrace.net.
**Approach**: Server-side scraper (Netlify function or Edge function) that:
1. Takes a boat ID (e.g., 706 for Impetuous) or event URL
2. Fetches the performance page and parses the HTML table
3. Maps boats to our database (by sail number + name)
4. Creates/updates race results with full timing data
**Frequency**: On-demand initially, scheduled weekly during racing season

#### 3B. CSV/Tab-Delimited Import
**What**: Direct import from NoticeOfRace.net's "Export to Tab Delimited Text" button.
**Why**: Simpler than scraping, works immediately, user-controlled.
**Implementation**: Upload flow on the races page that parses the tab-delimited format we already have (the uploaded .txt files).

#### 3C. Multi-Source Data Reconciliation
**What**: Handle the same boat appearing with slightly different names/clubs across events.
**Example**: "ford yatch club" vs "FYC" vs "Ford Yacht Club" in the data.
**Implementation**: Fuzzy matching on sail number + boat name, with manual override.

### Phase 4: AI-Powered Insights (Sprint 7-8)

#### 4A. Claude Race Analyst
**What**: Feed race results to the Claude coach so it can provide contextual analysis.
**Prompts**:
- "How did Impetuous do in the WNATR series?" → Summary with trends
- "Compare my VMG against Bag Lady" → Head-to-head analysis
- "What's my rating efficiency this season?" → PHRF performance analysis
- "Should I protest Pi's rating?" → Data-driven rating analysis

#### 4B. Pre-Race Intelligence
**What**: Before a race, show the user how they typically perform against the registered fleet.
**Data**: Historical head-to-head records, average gap in seconds/mile, conditions where they excel.

#### 4C. Post-Race Debrief
**What**: After results are imported, auto-generate a race debrief.
**Includes**: What went well, where time was lost, comparison to season average, actionable suggestions.

---

## Database Schema Additions Needed

```sql
-- Add VMG column to race_results (currently only in raw_data)
ALTER TABLE race_results ADD COLUMN vmg_kts NUMERIC;

-- Add throwouts to regattas
ALTER TABLE regattas ADD COLUMN throwouts INTEGER DEFAULT 0;

-- Boat performance summary (materialized or computed)
-- Could be a view:
CREATE VIEW boat_season_summary AS
SELECT
  b.id as boat_id,
  b.name,
  r.id as regatta_id,
  rr.fleet,
  COUNT(*) as races_entered,
  COUNT(CASE WHEN rr.status = 'finished' THEN 1 END) as races_finished,
  COUNT(CASE WHEN rr.corrected_position = 1 THEN 1 END) as wins,
  COUNT(CASE WHEN rr.corrected_position <= 3 THEN 1 END) as podiums,
  AVG(CASE WHEN rr.status = 'finished' THEN rr.corrected_position END) as avg_finish,
  SUM(rr.corrected_position) as total_points,
  AVG(CASE WHEN rr.vmg_kts IS NOT NULL THEN rr.vmg_kts END) as avg_vmg
FROM race_results rr
JOIN boats b ON rr.boat_id = b.id
JOIN races ra ON rr.race_id = ra.id
JOIN regattas r ON ra.regatta_id = r.id
GROUP BY b.id, b.name, r.id, rr.fleet;
```

---

## Current Data Inventory

After this import session, MagellAIn's database contains:

| Regatta | Races | Boats | Results | Has Timing | Has VMG |
|---------|-------|-------|---------|------------|---------|
| 2025 S2 7.9 Championship | 4 | 20 | 80 | No | No |
| 2025 WSSC WNATR | 12 | 28 | 336 | No | No |
| 2025 WSSC Spring Series | 1 | 28 | 25 | 6 results | 6 results |
| **Total** | **17** | **~45 unique** | **441** | **6** | **6** |

The Spring #1 race is our richest data point with actual VMG values — this is the template for what we want all race data to look like.

---

## Recommended Next Steps

1. **Build Series Standings component** — highest user value, data is ready
2. **Build Boat Performance page** — Impetuous has 13 races of history
3. **Add tab-delimited import** — let users upload results directly from NoticeOfRace.net
4. **Build NoticeOfRace.net scraper** — automate data collection for the whole fleet
5. **Integrate race data into Claude coach** — make the AI aware of real performance
