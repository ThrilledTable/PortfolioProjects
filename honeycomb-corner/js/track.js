// =============================================================================
// track.js: PLAYTEST NOTES (a tiny, private "analytics" for playtesters)
// -----------------------------------------------------------------------------
// While someone plays, the game quietly keeps a few numbers IN THEIR OWN SAVE:
//   - how many sessions they've played and how long each lasted
//   - which calendar days they played (so we can see if they came back)
//   - how long it took to reach each goal
//   - how often they wanted to skip a timer but didn't have enough gems
//     ("gem-starved"), and how often they did skip with gems
//   - how many gems they earned and spent
// Nothing is sent anywhere automatically. The numbers are only shared if the
// player opens "Send feedback" and presses Send; the form shows them exactly
// what's included first. (See feedbackModal in ui.js.)
//
// The notes live in the save as `s.playtest` and survive festivals.
// =============================================================================
(function () {
  const HC = window.HC;
  const { bus } = HC;
  const S = () => HC.game;

  // A new session starts if the game was closed for more than 30 minutes.
  const SESSION_GAP = 30 * 60 * 1000;
  const today = () => new Date().toISOString().slice(0, 10); // e.g. "2026-09-30"

  // Make sure the save has a notes object (older saves won't).
  function notes() {
    const s = S();
    if (!s.playtest) {
      s.playtest = {
        firstPlayed: Date.now(),
        sessions: 0,
        sessionSecs: [], // length of each session, in seconds (last 50)
        days: {}, // calendar days played on
        goalAt: {}, // goal number → minutes of play when it was claimed
        gemStarved: 0, // tapped a gem "Finish" button without enough gems
        gemStarvedAt: [], // which goal they were on each time (last 20)
        gemSkips: 0, // timers finished with gems
        gemsSpent: 0,
        feedbackSent: 0,
        lastActive: 0,
      };
    }
    return s.playtest;
  }

  let sessionStart = 0;
  // Called once at start-up (main.js).
  function init() {
    const n = notes();
    const now = Date.now();
    if (!n.lastActive || now - n.lastActive > SESSION_GAP) {
      n.sessions++;
      n.sessionSecs.push(0);
      if (n.sessionSecs.length > 50) n.sessionSecs.shift();
    }
    sessionStart = now;
    n.days[today()] = true;
    n.lastActive = now;

    // Once a second, while the page is visible, add to the session length.
    setInterval(() => {
      if (document.hidden) return;
      const m = notes();
      const t = Date.now();
      if (t - m.lastActive > SESSION_GAP) {
        m.sessions++;
        m.sessionSecs.push(0);
      }
      m.sessionSecs[m.sessionSecs.length - 1] = (m.sessionSecs[m.sessionSecs.length - 1] || 0) + 1;
      m.days[today()] = true;
      m.lastActive = t;
    }, 1000);

    // When a goal is claimed, note how many minutes of play it took.
    bus.on('goalClaimed', () => {
      const s = S();
      notes().goalAt[s.goal] = Math.round(s.playTime / 60);
    });
  }

  // ui.js calls this when a gem button is tapped without enough gems.
  function gemStarved() {
    const n = notes();
    n.gemStarved++;
    n.gemStarvedAt.push((S().goal || 0) + 1);
    if (n.gemStarvedAt.length > 20) n.gemStarvedAt.shift();
  }
  // ...and this when gems are actually spent on a skip.
  function gemSkip(gems) {
    const n = notes();
    n.gemSkips++;
    n.gemsSpent += gems;
  }

  // A short, readable summary: this is what "Send feedback" includes.
  function summary() {
    const s = S();
    const n = notes();
    const days = Object.keys(n.days).sort();
    const secs = n.sessionSecs.filter((x) => x > 0);
    const avg = secs.length ? Math.round(secs.reduce((a, b) => a + b, 0) / secs.length / 60) : 0;
    return {
      version: 'playtest-6',
      minutesPlayed: Math.round(s.playTime / 60),
      sessions: n.sessions,
      avgSessionMinutes: avg,
      longestSessionMinutes: secs.length ? Math.round(Math.max(...secs) / 60) : 0,
      daysPlayed: days.length,
      cameBackNextDay: days.length > 1,
      goalReached: (s.goal || 0) + 1,
      minutesToGoal: n.goalAt,
      species: Object.keys(s.discovered).length,
      helpers: Object.keys(s.staff).length,
      gems: s.gems,
      gemsEarned: s.stats.gemsEarned || 0,
      gemsSpentOnSkips: n.gemsSpent,
      gemSkips: n.gemSkips,
      gemStarved: n.gemStarved,
      gemStarvedOnGoals: n.gemStarvedAt,
      reputation: Math.round(s.rep * 10) / 10,
      festivals: s.festivals,
      device: /Mobi|Android|iPhone|iPad/.test(navigator.userAgent) ? 'phone/tablet' : 'computer',
    };
  }

  HC.track = { init, notes, gemStarved, gemSkip, summary };
})();
