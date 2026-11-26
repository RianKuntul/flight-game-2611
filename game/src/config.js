// Sky Courier: Ridge Run — tuning constants for the whole game.
// One place for every number a designer would tweak: flight, world, missions.
export const GAME = {
  title: 'SKY COURIER',
  subtitle: 'RIDGE RUN',
  canvasWidth: 1280,
  canvasHeight: 720,
};

export const FLIGHT = {
  maxSpeed: 62, // m/s at full throttle
  cruiseSpeed: 42,
  minSpeed: 16, // below this the Kestrel stalls and sinks
  accel: 14, // m/s^2 toward the throttle target speed
  drag: 0.35,
  pitchRate: 0.9, // rad/s at full stick
  rollRate: 1.9,
  turnRate: 0.8, // yaw gained per radian of bank, per second
  maxPitch: 0.55,
  maxRoll: 1.1,
  gravitySink: 9, // m/s^2 of sink when stalled
  climbFactor: 0.9,
  groundClearance: 2.2, // metres above terrain before a strike counts
  safeLandingSink: 4.5, // m/s vertical speed allowed on the runway
  safeLandingSpeed: 34, // m/s ground speed allowed on the runway
  fuelCapacity: 120,
};

export const WORLD = {
  size: 6000, // terrain spans -3000..3000 m on x and z
  cell: 60, // terrain grid spacing in metres
  viewDistance: 1500,
  maxHeight: 260,
  seed: 20261126,
};

export const RUNWAY = {
  x: -1400, // centre of the airfield, west end of the valley
  z: 400,
  heading: Math.PI / 2, // runway runs north-south (along z)
  length: 620,
  width: 34,
};

export const MISSIONS = [
  {
    name: 'SORTIE 1 — RING RUN',
    brief: 'Thread all 5 rings, then bring her home to Runway 18.',
    rings: 5,
    wind: 0,
    ringSpread: 1.0,
  },
  {
    name: 'SORTIE 2 — CANYON SLALOM',
    brief: 'Low rings through the canyon, crosswind from the west.',
    rings: 7,
    wind: 3.5,
    ringSpread: 1.25,
  },
  {
    name: 'SORTIE 3 — STORM PASS',
    brief: 'Seven rings over the high ridge, strong gusts. Mind the fuel.',
    rings: 7,
    wind: 6,
    ringSpread: 1.5,
  },
];

export const SCORE = {
  ring: 100,
  ringCentreBonus: 50,
  landing: 500,
  landingSoftBonus: 150,
  timeBonusPerSecond: 4,
  crashPenalty: 0,
};
