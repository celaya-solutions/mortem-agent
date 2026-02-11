

**Before you start Phase 7:**
- [ ] All code from Phases 1-6 downloaded and organized
- [ ] Cursor ready for data extraction
- [ ] Solana CLI installed (for wallet/airdrop)
- [ ] Vercel account ready (or GitHub Pages)
- [ ] Social media accounts accessible

**Critical paths:**
- Phase 7 → Phase 9 (need clean data before streaming)
- Phase 8 → Phase 9/10 (need wallets before streaming)
- Phase 9 → Phase 10 (MORTEM needs human data to witness)
- Phase 9/10 → Phase 11 (landing page needs real data to display)
- Phase 11 → Phase 12/13 (need live site before promoting)

---

**Current time: ~25 hours left**

**Realistic timeline:**
- Phase 7: 30 min (Cursor extraction)
- Phase 8: 30 min (wallet setup)
- Phase 9: 1 hour (get streaming, debug)
- Phase 10: 1 hour (get witnessing, debug)
- Phase 11: 1-2 hours (deploy, test)
- Phase 12: 30 min (post everywhere)
- Phase 13: 30 min (update submission)

**Total: 5-6 hours for full deployment**

**Buffer: 19 hours for debugging, polish, unexpected issues**

## Phase 7: HealthKit Data Extraction & Cleaning
**Goal:** Get clean heart rate data ready for streaming

**Tasks:**
- Use Cursor to extract all heart rate records from export.xml
- Output: heartrate_clean.json (sorted by timestamp, newest first)
- Format: `[{"timestamp": "...", "bpm": 101, "source": "...", "motion": "..."}]`
- Verify: Check date ranges, BPM ranges (should be 40-180)

**Output:** heartrate_clean.json ready to use

## Deployment Checklist