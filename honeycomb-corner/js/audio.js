// =============================================================================
// audio.js: SOUND EFFECTS AND MUSIC
// -----------------------------------------------------------------------------
// There are no sound files. Every sound is made on the spot by the browser's
// built-in synthesizer (the "Web Audio" feature), the same way old game
// consoles made music: simple buzzy tones called square and triangle waves.
//
// A sound effect is just a few short notes, e.g. the coin sound is two quick
// high beeps. The music is a 32-step loop: a melody on top of a bass line.
//
// Browsers refuse to play any sound until the person has tapped or clicked
// the page, so nothing happens until unlock() is called from a tap.
// =============================================================================
(function () {
  const HC = window.HC;
  let ac = null; // the browser's audio engine (created on first tap)
  let master = null, musicGain = null, sfxGain = null; // volume knobs
  let musicTimer = null, nextNote = 0, step = 0;

  // Create the audio engine and three volume knobs: overall, effects, music.
  function ensure() {
    if (ac) return ac;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null; // very old browser: no sound, no problem
    ac = new Ctx();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    sfxGain = ac.createGain();
    sfxGain.gain.value = 0.35;
    sfxGain.connect(master);
    musicGain = ac.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    return ac;
  }

  // Play one note.
  //   freq  - pitch in Hz (440 is the A above middle C)
  //   start - when to start (in the audio engine's clock)
  //   dur   - how long, in seconds
  //   type  - 'square' (buzzy) or 'triangle' (softer)
  //   vol   - loudness, 0 to 1
  //   slide - optional pitch bend over the note
  // The volume jumps up quickly and fades out, so notes "pluck" rather than click.
  function tone(freq, start, dur, type = 'square', vol = 0.5, dest = sfxGain, slide = 0) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(dest);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  // Convert a piano-key number to a pitch. 60 is middle C, 72 the C above it.
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // Each sound effect: a function that plays its notes starting at time t.
  const SFX = {
    coin: (t) => { tone(N(83), t, 0.05, 'square', 0.25); tone(N(88), t + 0.05, 0.12, 'square', 0.25); },
    buy: (t) => [72, 76, 79].forEach((n, i) => tone(N(n), t + i * 0.06, 0.09, 'square', 0.22)),
    click: (t) => tone(N(84), t, 0.03, 'square', 0.15),
    fail: (t) => { tone(N(55), t, 0.09, 'square', 0.25); tone(N(50), t + 0.09, 0.14, 'square', 0.25); },
    hatch: (t) => [72, 76, 79, 84, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.08, 0.12, i % 2 ? 'triangle' : 'square', 0.25)),
    order: (t) => [79, 83, 86, 91].forEach((n, i) => tone(N(n), t + i * 0.07, 0.1, 'square', 0.22)),
    discover: (t) => [67, 72, 76, 79, 84, 88, 91].forEach((n, i) => tone(N(n), t + i * 0.07, 0.14, 'square', 0.22)),
    bell: (t) => { tone(N(96), t, 0.25, 'triangle', 0.3); tone(N(91), t + 0.12, 0.3, 'triangle', 0.2); },
    text: (t) => tone(N(79), t, 0.02, 'square', 0.08), // tick as the text box types
  };

  // The music: 32 steps, each a note number or 0 for silence. A gentle tune
  // in F major, melody over a slow bass line.
  const MELODY = [77, 0, 81, 0, 84, 0, 81, 79, 77, 0, 74, 0, 72, 0, 0, 0, 74, 0, 77, 0, 79, 0, 81, 79, 77, 0, 76, 0, 77, 0, 0, 0];
  const BASS = [53, 0, 0, 0, 60, 0, 0, 0, 50, 0, 0, 0, 57, 0, 0, 0, 46, 0, 0, 0, 53, 0, 0, 0, 48, 0, 0, 0, 53, 0, 55, 0];
  const STEP = 0.19; // seconds per step

  // Every 100ms, book the notes due in the next 0.3s. Booking slightly ahead
  // keeps the rhythm steady even if the page is briefly busy.
  function scheduleMusic() {
    while (nextNote < ac.currentTime + 0.3) {
      const m = MELODY[step % 32], b = BASS[step % 32];
      if (m) tone(N(m), nextNote, STEP * 1.6, 'square', 0.18, musicGain);
      if (b) tone(N(b), nextNote, STEP * 3.5, 'triangle', 0.35, musicGain);
      if (step % 4 === 2) tone(2000, nextNote, 0.02, 'square', 0.03, musicGain, -1500); // soft hi-hat
      nextNote += STEP;
      step++;
    }
  }

  HC.audio = {
    // Call from any tap: starts the audio engine the first time.
    unlock() {
      if (!ensure()) return;
      if (ac.state === 'suspended') ac.resume();
      HC.audio.syncMusic();
    },
    // Play a named sound effect (if sound is switched on in Settings).
    play(name) {
      const s = HC.game;
      if (!s || !s.settings.sfx || !ac || ac.state !== 'running' || !SFX[name]) return;
      SFX[name](ac.currentTime + 0.01);
    },
    // Start or stop the music to match the Settings toggle.
    syncMusic() {
      const on = HC.game && HC.game.settings.music && ac && ac.state === 'running';
      if (on && !musicTimer) {
        nextNote = ac.currentTime + 0.05;
        musicTimer = setInterval(scheduleMusic, 100);
      } else if (!on && musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
})();
