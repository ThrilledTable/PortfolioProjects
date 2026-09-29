// =============================================================================
// nav.js: THE MAP OF THE SCENE, AND HOW PEOPLE WALK AROUND IT
// -----------------------------------------------------------------------------
// The game picture is 240 pixels wide and 160 tall (the Game Boy Advance's
// screen size), split into 16×16 pixel "tiles". Positions are written as
// (x, y) where x counts pixels from the left edge and y from the TOP edge
// (so a bigger y is lower down the screen).
//
// Rough layout:
//   left third  (x 0-100)   the garden with up to six hives
//   right part  (x 112-240) inside the shop: shelves along the top wall,
//                           the counter/register on the right, the storeroom
//                           crates on the left, the door at the bottom
//   bottom strip (y 144-160) the street outside
//
// The shopkeeper and staff don't wander freely. They walk between named
// spots ("nodes") joined by straight lines ("edges"), like stops on a
// train map. `route(from, to)` finds the shortest chain of stops, which
// keeps people from walking through walls, hives or the counter.
// =============================================================================
(function () {
  const HC = window.HC;

  // ---------------------------------------------------------------------------
  // Fixed positions used by the customers, the renderer and the workers.
  // ---------------------------------------------------------------------------
  const layout = {
    W: 240, H: 160, T: 16, // screen width, height, tile size

    // Customer walking lines (customers use their own simple paths):
    doorX: 152, // the door's x position
    streetY: 152, // the street customers walk along
    doorY: 136, // standing in the doorway
    insideY: 120, // just inside the door
    aisleY: 40, // the aisle in front of the shelves
    corridorX: 168, // the walkway customers use to reach the queue
    turnY: 56, // the row customers use to walk from shelves to the corridor

    // Where the register is (customers pay the person standing here).
    desk: { x: 216, y: 98 },
    // The counter itself: people standing behind it have their legs hidden.
    counter: { x: 190, y: 96, w: 47, h: 16 },
    // Shelf number i (0-7) stands along the back wall at this x.
    shelfX: (i) => (7 + i) * 16 + 8,
    // Queue spots in front of the counter. Spot 0 is first in line. The line
    // runs left along the floor, then bends upward if it gets long.
    queueSlot: (i) => (i < 3 ? { x: 216 - 16 * i, y: 120 } : { x: 184, y: 104 - 16 * (i - 3) }),
    // Hive spots in the garden, as [column, row] in 16-pixel tiles.
    hiveSlots: [[1, 1], [4, 1], [1, 4], [4, 4], [1, 7], [4, 7]],
    // The travelling merchant's wagon parks here on the street.
    wagon: { x: 40, y: 152 },
    // The request board stands outside the shop, right of the door.
    board: { x: 206, y: 150 },
    // The storeroom crates (inside, bottom-left) and Candle Machine (behind counter).
    crates: { x: 113, y: 86, w: 26, h: 22 },
    machine: { x: 204, y: 60, w: 30, h: 20 },
  };

  // ---------------------------------------------------------------------------
  // The walking network ("graph"). Each node has a position; EDGES lists
  // which pairs of nodes have a clear straight path between them.
  // ---------------------------------------------------------------------------
  const NODES = {
    DESK: { x: 216, y: 98 }, // at the register, behind the counter
    SIDE: { x: 199, y: 98 }, // behind the counter, beside the register
    BACK: { x: 182, y: 90 }, // just past the left end of the counter
    MACH: { x: 220, y: 86 }, // in front of the Candle Machine
    MID: { x: 182, y: 112 }, // open floor in the middle of the shop
    DOORIN: { x: 152, y: 112 }, // just inside the door
    STORE: { x: 134, y: 112 }, // in front of the storeroom crates
    AISLE: { x: 152, y: 40 }, // the aisle in front of the shelves
    DOOR: { x: 152, y: 136 }, // in the doorway
    STREET: { x: 152, y: 152 }, // on the street outside the door
    LANE0: { x: 48, y: 152 }, // where the garden path meets the street
    LANE3: { x: 48, y: 132 }, // garden path, level with the bottom hives
    LANE2: { x: 48, y: 84 }, // garden path, level with the middle hives
    LANE1: { x: 48, y: 36 }, // garden path, level with the top hives
  };
  const EDGES = [
    ['DESK', 'SIDE'], ['SIDE', 'BACK'], ['DESK', 'MACH'], ['MACH', 'BACK'],
    ['BACK', 'MID'], ['MID', 'DOORIN'], ['DOORIN', 'STORE'], ['DOORIN', 'AISLE'],
    ['DOORIN', 'DOOR'], ['DOOR', 'STREET'], ['STREET', 'LANE0'],
    ['LANE0', 'LANE3'], ['LANE3', 'LANE2'], ['LANE2', 'LANE1'],
  ];
  // One node in front of each shelf, reached along the aisle.
  for (let i = 0; i < 8; i++) {
    NODES['SH' + i] = { x: layout.shelfX(i), y: layout.aisleY };
    EDGES.push(['AISLE', 'SH' + i]);
  }
  // One node in front of each hive, reached from the garden path.
  const laneFor = { 36: 'LANE1', 84: 'LANE2', 132: 'LANE3' };
  layout.hiveSlots.forEach(([cx, cy], i) => {
    const front = { x: cx * 16 + 8, y: cy * 16 + 20 };
    NODES['HV' + i] = front;
    EDGES.push(['HV' + i, laneFor[front.y]]);
  });

  // Build a quick lookup: node -> list of [neighbour, distance].
  const links = {};
  for (const k of Object.keys(NODES)) links[k] = [];
  const dist = (a, b) => Math.hypot(NODES[a].x - NODES[b].x, NODES[a].y - NODES[b].y);
  for (const [a, b] of EDGES) {
    links[a].push([b, dist(a, b)]);
    links[b].push([a, dist(a, b)]);
  }

  // ---------------------------------------------------------------------------
  // route('DESK', 'HV2') returns the list of positions to walk through, not
  // including the starting spot. Uses the classic "Dijkstra" method: explore
  // outward from the start, always extending the shortest trail found so far,
  // until the destination is reached.
  // ---------------------------------------------------------------------------
  const cache = new Map();
  function route(from, to) {
    const key = from + '>' + to;
    if (cache.has(key)) return cache.get(key).map((p) => ({ x: p.x, y: p.y }));
    const best = { [from]: 0 };
    const prev = {};
    const open = new Set([from]);
    while (open.size) {
      // Pick the unexplored node with the shortest known distance.
      let cur = null;
      for (const n of open) if (cur === null || best[n] < best[cur]) cur = n;
      open.delete(cur);
      if (cur === to) break;
      for (const [nb, d] of links[cur]) {
        const nd = best[cur] + d;
        if (best[nb] === undefined || nd < best[nb]) {
          best[nb] = nd;
          prev[nb] = cur;
          open.add(nb);
        }
      }
    }
    // Walk backwards from the destination to rebuild the trail.
    const names = [];
    for (let n = to; n && n !== from; n = prev[n]) names.unshift(n);
    const pts = names.map((n) => NODES[n]);
    cache.set(key, pts);
    return pts.map((p) => ({ x: p.x, y: p.y }));
  }

  // Length in pixels of a route (used to estimate trip times).
  function routeLength(from, to) {
    let len = 0, prevPt = NODES[from];
    for (const p of route(from, to)) {
      len += Math.hypot(p.x - prevPt.x, p.y - prevPt.y);
      prevPt = p;
    }
    return len;
  }

  // Move a walker (customer or worker) along its `path` for dt seconds.
  // Returns true once it has reached the end of the path.
  function moveAlong(w, dt) {
    if (!w.path.length) return true;
    const tgt = w.path[0];
    const dx = tgt.x - w.x, dy = tgt.y - w.y;
    const d = Math.hypot(dx, dy);
    const step = w.speed * dt;
    // Face the direction of travel (used to pick the sprite).
    if (Math.abs(dx) > Math.abs(dy)) w.dir = dx > 0 ? 'right' : 'left';
    else if (d > 0.01) w.dir = dy > 0 ? 'down' : 'up';
    if (d <= step) {
      w.x = tgt.x;
      w.y = tgt.y;
      w.path.shift();
    } else {
      w.x += (dx / d) * step;
      w.y += (dy / d) * step;
    }
    w.walk += dt; // drives the walking animation
    return w.path.length === 0;
  }

  HC.layout = layout;
  HC.nav = { NODES, route, routeLength, moveAlong };
})();
