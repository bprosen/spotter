/**
 * The built-in exercise catalog: common lifts, bodyweight moves and cardio, with the facts the app needs to log
 * and chart them. Cues are a one-line reminder, not coaching.
 */

export type Muscle =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "cardio";

export const MUSCLES: Record<Muscle, { label: string; region: "upper" | "lower" | "core" | "cardio" }> = {
  chest: { label: "Chest", region: "upper" },
  back: { label: "Back", region: "upper" },
  shoulders: { label: "Shoulders", region: "upper" },
  biceps: { label: "Biceps", region: "upper" },
  triceps: { label: "Triceps", region: "upper" },
  forearms: { label: "Forearms", region: "upper" },
  abs: { label: "Abs & core", region: "core" },
  quads: { label: "Quads", region: "lower" },
  hamstrings: { label: "Hamstrings", region: "lower" },
  glutes: { label: "Glutes", region: "lower" },
  calves: { label: "Calves", region: "lower" },
  cardio: { label: "Cardio", region: "cardio" },
};

export const MUSCLE_IDS = Object.keys(MUSCLES) as Muscle[];

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "band"
  | "cardio-machine"
  | "other";

export const EQUIPMENT: Record<Equipment, { label: string }> = {
  barbell: { label: "Barbell" },
  dumbbell: { label: "Dumbbell" },
  kettlebell: { label: "Kettlebell" },
  machine: { label: "Machine" },
  cable: { label: "Cable" },
  bodyweight: { label: "Bodyweight" },
  band: { label: "Band" },
  "cardio-machine": { label: "Cardio machine" },
  other: { label: "Other" },
};

export const EQUIPMENT_IDS = Object.keys(EQUIPMENT) as Equipment[];

/**
 * What a set of this exercise records:
 * - `weight`: load and reps (squat, curl).
 * - `reps`: reps, with optional added load (pull-up, dip). Volume counts reps only.
 * - `time`: a duration (plank, dead hang).
 * - `distance`: distance and time (run, row).
 */
export type Measure = "weight" | "reps" | "time" | "distance";

export const MEASURES: Record<Measure, { label: string }> = {
  weight: { label: "Weight × reps" },
  reps: { label: "Reps" },
  time: { label: "Time" },
  distance: { label: "Distance & time" },
};

export type Exercise = {
  /** Stable id, lowercase-kebab-case. Stored in the database, so never rename one. */
  id: string;
  name: string;
  /** The muscle the exercise is mostly for. Drives grouping and "last trained" on the dashboard. */
  muscle: Muscle;
  /** Other muscles that work hard, in rough order of how much. */
  secondary: Muscle[];
  equipment: Equipment;
  measure: Measure;
  /** A one-line form reminder. */
  cue: string;
};

type Row = [
  id: string,
  name: string,
  muscle: Muscle,
  secondary: Muscle[],
  equipment: Equipment,
  measure: Measure,
  cue: string,
];

const ROWS: Row[] = [
  // chest
  [
    "bench-press",
    "Bench press",
    "chest",
    ["triceps", "shoulders"],
    "barbell",
    "weight",
    "Feet planted, shoulder blades pinned, bar to lower chest.",
  ],
  [
    "incline-bench-press",
    "Incline bench press",
    "chest",
    ["shoulders", "triceps"],
    "barbell",
    "weight",
    "Bench at 30–45°, bar to upper chest.",
  ],
  [
    "decline-bench-press",
    "Decline bench press",
    "chest",
    ["triceps"],
    "barbell",
    "weight",
    "Lock your legs in, bar to the bottom of the chest.",
  ],
  [
    "close-grip-bench-press",
    "Close-grip bench press",
    "triceps",
    ["chest", "shoulders"],
    "barbell",
    "weight",
    "Hands shoulder-width, elbows tucked.",
  ],
  [
    "dumbbell-bench-press",
    "Dumbbell bench press",
    "chest",
    ["triceps", "shoulders"],
    "dumbbell",
    "weight",
    "Lower until the dumbbells are level with your chest.",
  ],
  [
    "incline-dumbbell-press",
    "Incline dumbbell press",
    "chest",
    ["shoulders", "triceps"],
    "dumbbell",
    "weight",
    "Press up and slightly in; don't clank them together.",
  ],
  [
    "dumbbell-fly",
    "Dumbbell fly",
    "chest",
    ["shoulders"],
    "dumbbell",
    "weight",
    "Soft elbows, open wide, hug a tree on the way up.",
  ],
  [
    "cable-crossover",
    "Cable crossover",
    "chest",
    ["shoulders"],
    "cable",
    "weight",
    "Step forward, sweep the handles down and together.",
  ],
  [
    "machine-chest-press",
    "Machine chest press",
    "chest",
    ["triceps", "shoulders"],
    "machine",
    "weight",
    "Handles at mid-chest, press without locking out hard.",
  ],
  ["pec-deck", "Pec deck", "chest", ["shoulders"], "machine", "weight", "Squeeze for a beat when the pads meet."],
  [
    "push-up",
    "Push-up",
    "chest",
    ["triceps", "shoulders", "abs"],
    "bodyweight",
    "reps",
    "Body in one line, chest to a fist from the floor.",
  ],
  [
    "dip",
    "Dip",
    "chest",
    ["triceps", "shoulders"],
    "bodyweight",
    "reps",
    "Lean forward slightly, lower until shoulders dip below elbows.",
  ],

  // back
  [
    "deadlift",
    "Deadlift",
    "back",
    ["hamstrings", "glutes", "forearms"],
    "barbell",
    "weight",
    "Bar over midfoot, brace, push the floor away.",
  ],
  [
    "sumo-deadlift",
    "Sumo deadlift",
    "back",
    ["glutes", "quads", "hamstrings"],
    "barbell",
    "weight",
    "Wide stance, knees out, chest up.",
  ],
  [
    "rack-pull",
    "Rack pull",
    "back",
    ["glutes", "forearms"],
    "barbell",
    "weight",
    "Bar at knee height; finish tall without leaning back.",
  ],
  [
    "barbell-row",
    "Barbell row",
    "back",
    ["biceps", "forearms"],
    "barbell",
    "weight",
    "Hinge to 45°, pull the bar to your belly button.",
  ],
  ["pendlay-row", "Pendlay row", "back", ["biceps"], "barbell", "weight", "Each rep starts dead on the floor."],
  ["t-bar-row", "T-bar row", "back", ["biceps"], "barbell", "weight", "Chest up, drive elbows past your ribs."],
  [
    "dumbbell-row",
    "One-arm dumbbell row",
    "back",
    ["biceps"],
    "dumbbell",
    "weight",
    "Knee and hand on the bench, row to your hip.",
  ],
  [
    "seated-cable-row",
    "Seated cable row",
    "back",
    ["biceps"],
    "cable",
    "weight",
    "Sit tall, pull to the stomach, don't rock.",
  ],
  [
    "lat-pulldown",
    "Lat pulldown",
    "back",
    ["biceps"],
    "cable",
    "weight",
    "Pull the bar to your collarbone, elbows down and back.",
  ],
  [
    "straight-arm-pulldown",
    "Straight-arm pulldown",
    "back",
    ["triceps"],
    "cable",
    "weight",
    "Arms long, sweep the bar to your thighs.",
  ],
  [
    "machine-row",
    "Machine row",
    "back",
    ["biceps"],
    "machine",
    "weight",
    "Chest on the pad, squeeze shoulder blades together.",
  ],
  [
    "pull-up",
    "Pull-up",
    "back",
    ["biceps", "forearms"],
    "bodyweight",
    "reps",
    "Overhand grip, chin over the bar, full hang at the bottom.",
  ],
  ["chin-up", "Chin-up", "back", ["biceps"], "bodyweight", "reps", "Underhand grip, chest towards the bar."],
  [
    "inverted-row",
    "Inverted row",
    "back",
    ["biceps"],
    "bodyweight",
    "reps",
    "Body straight under a bar, pull your chest up to it.",
  ],
  [
    "back-extension",
    "Back extension",
    "back",
    ["glutes", "hamstrings"],
    "bodyweight",
    "reps",
    "Hinge at the hips; stop at a straight line, don't arch.",
  ],
  [
    "good-morning",
    "Good morning",
    "hamstrings",
    ["back", "glutes"],
    "barbell",
    "weight",
    "Bar on your back, soft knees, push hips back.",
  ],
  [
    "shrug",
    "Barbell shrug",
    "back",
    ["forearms"],
    "barbell",
    "weight",
    "Shoulders straight up to the ears, no rolling.",
  ],
  ["dumbbell-shrug", "Dumbbell shrug", "back", ["forearms"], "dumbbell", "weight", "Hold the top for a second."],

  // shoulders
  [
    "overhead-press",
    "Overhead press",
    "shoulders",
    ["triceps", "abs"],
    "barbell",
    "weight",
    "Squeeze glutes, press the bar up past your face, head through.",
  ],
  [
    "push-press",
    "Push press",
    "shoulders",
    ["triceps", "quads"],
    "barbell",
    "weight",
    "Dip and drive with the legs, then press.",
  ],
  [
    "seated-dumbbell-press",
    "Seated dumbbell press",
    "shoulders",
    ["triceps"],
    "dumbbell",
    "weight",
    "Back on the pad, press up without flaring the ribs.",
  ],
  [
    "arnold-press",
    "Arnold press",
    "shoulders",
    ["triceps"],
    "dumbbell",
    "weight",
    "Rotate palms from facing you to facing forward as you press.",
  ],
  [
    "machine-shoulder-press",
    "Machine shoulder press",
    "shoulders",
    ["triceps"],
    "machine",
    "weight",
    "Handles at chin height to start.",
  ],
  [
    "lateral-raise",
    "Lateral raise",
    "shoulders",
    [],
    "dumbbell",
    "weight",
    "Lead with the elbows, stop at shoulder height.",
  ],
  [
    "cable-lateral-raise",
    "Cable lateral raise",
    "shoulders",
    [],
    "cable",
    "weight",
    "Cable behind you, raise out to the side.",
  ],
  ["front-raise", "Front raise", "shoulders", [], "dumbbell", "weight", "Raise to eye level with straight arms."],
  [
    "rear-delt-fly",
    "Rear delt fly",
    "shoulders",
    ["back"],
    "dumbbell",
    "weight",
    "Hinge over, open the arms wide, pinkies up.",
  ],
  [
    "reverse-pec-deck",
    "Reverse pec deck",
    "shoulders",
    ["back"],
    "machine",
    "weight",
    "Face the pad, sweep the handles back.",
  ],
  ["face-pull", "Face pull", "shoulders", ["back"], "cable", "weight", "Rope to your forehead, pull the ends apart."],
  [
    "upright-row",
    "Upright row",
    "shoulders",
    ["back", "biceps"],
    "barbell",
    "weight",
    "Elbows lead, stop below shoulder height.",
  ],
  [
    "pike-push-up",
    "Pike push-up",
    "shoulders",
    ["triceps"],
    "bodyweight",
    "reps",
    "Hips high, lower your head between your hands.",
  ],
  [
    "handstand-push-up",
    "Handstand push-up",
    "shoulders",
    ["triceps"],
    "bodyweight",
    "reps",
    "Against a wall, lower your head to the floor with control.",
  ],

  // biceps
  ["barbell-curl", "Barbell curl", "biceps", ["forearms"], "barbell", "weight", "Elbows pinned, no swinging."],
  [
    "ez-bar-curl",
    "EZ-bar curl",
    "biceps",
    ["forearms"],
    "barbell",
    "weight",
    "Grip the angled part, curl to the chin.",
  ],
  ["dumbbell-curl", "Dumbbell curl", "biceps", ["forearms"], "dumbbell", "weight", "Turn the palm up as you lift."],
  ["hammer-curl", "Hammer curl", "biceps", ["forearms"], "dumbbell", "weight", "Thumbs up the whole way."],
  [
    "incline-dumbbell-curl",
    "Incline dumbbell curl",
    "biceps",
    [],
    "dumbbell",
    "weight",
    "Lie back on an incline bench, arms hanging behind you.",
  ],
  ["preacher-curl", "Preacher curl", "biceps", [], "barbell", "weight", "Armpits on the pad, lower all the way."],
  ["concentration-curl", "Concentration curl", "biceps", [], "dumbbell", "weight", "Elbow braced on your inner thigh."],
  ["cable-curl", "Cable curl", "biceps", ["forearms"], "cable", "weight", "Stand tall, curl without leaning back."],

  // triceps
  [
    "triceps-pushdown",
    "Triceps pushdown",
    "triceps",
    [],
    "cable",
    "weight",
    "Elbows at your sides, push until the arms lock.",
  ],
  ["rope-pushdown", "Rope pushdown", "triceps", [], "cable", "weight", "Spread the rope at the bottom."],
  [
    "overhead-triceps-extension",
    "Overhead triceps extension",
    "triceps",
    [],
    "dumbbell",
    "weight",
    "One dumbbell in both hands, lower behind your head.",
  ],
  [
    "cable-overhead-extension",
    "Cable overhead extension",
    "triceps",
    [],
    "cable",
    "weight",
    "Face away from the stack, extend the rope overhead.",
  ],
  [
    "skull-crusher",
    "Skull crusher",
    "triceps",
    [],
    "barbell",
    "weight",
    "Lower the bar to your forehead, elbows pointing up.",
  ],
  [
    "triceps-kickback",
    "Triceps kickback",
    "triceps",
    [],
    "dumbbell",
    "weight",
    "Upper arm parallel to the floor, straighten behind you.",
  ],
  [
    "bench-dip",
    "Bench dip",
    "triceps",
    ["chest", "shoulders"],
    "bodyweight",
    "reps",
    "Hands on a bench behind you, lower to 90° at the elbow.",
  ],
  [
    "diamond-push-up",
    "Diamond push-up",
    "triceps",
    ["chest"],
    "bodyweight",
    "reps",
    "Hands together under your chest.",
  ],

  // forearms
  ["wrist-curl", "Wrist curl", "forearms", [], "barbell", "weight", "Forearms on your thighs, curl only at the wrist."],
  ["reverse-curl", "Reverse curl", "forearms", ["biceps"], "barbell", "weight", "Overhand grip, curl to the chest."],
  [
    "farmers-carry",
    "Farmer's carry",
    "forearms",
    ["back", "abs"],
    "dumbbell",
    "distance",
    "Heavy in each hand, walk tall.",
  ],
  ["dead-hang", "Dead hang", "forearms", ["back"], "bodyweight", "time", "Hang from a bar with relaxed shoulders."],

  // abs
  ["plank", "Plank", "abs", ["shoulders"], "bodyweight", "time", "Elbows under shoulders, squeeze glutes, don't sag."],
  ["side-plank", "Side plank", "abs", [], "bodyweight", "time", "Hips high, body in a straight line."],
  ["crunch", "Crunch", "abs", [], "bodyweight", "reps", "Curl the ribs towards the hips; don't pull your neck."],
  ["sit-up", "Sit-up", "abs", [], "bodyweight", "reps", "Feet anchored, sit all the way up."],
  [
    "hanging-leg-raise",
    "Hanging leg raise",
    "abs",
    ["forearms"],
    "bodyweight",
    "reps",
    "Hang still, raise straight legs to hip height or higher.",
  ],
  [
    "hanging-knee-raise",
    "Hanging knee raise",
    "abs",
    ["forearms"],
    "bodyweight",
    "reps",
    "Knees to chest without swinging.",
  ],
  ["cable-crunch", "Cable crunch", "abs", [], "cable", "weight", "Kneel, rope by your head, crunch down."],
  [
    "ab-wheel-rollout",
    "Ab wheel rollout",
    "abs",
    ["shoulders"],
    "other",
    "reps",
    "Roll out only as far as you can keep your back flat.",
  ],
  [
    "russian-twist",
    "Russian twist",
    "abs",
    [],
    "bodyweight",
    "reps",
    "Lean back, rotate side to side; count both sides.",
  ],
  ["dead-bug", "Dead bug", "abs", [], "bodyweight", "reps", "Lower back pressed down, extend opposite arm and leg."],
  ["pallof-press", "Pallof press", "abs", [], "cable", "weight", "Press the handle straight out and resist the twist."],
  ["hollow-hold", "Hollow hold", "abs", [], "bodyweight", "time", "Lower back down, arms and legs just off the floor."],

  // quads
  [
    "back-squat",
    "Back squat",
    "quads",
    ["glutes", "hamstrings", "back"],
    "barbell",
    "weight",
    "Brace, sit between your heels, knees track the toes.",
  ],
  ["front-squat", "Front squat", "quads", ["glutes", "abs"], "barbell", "weight", "Elbows high, stay upright."],
  [
    "goblet-squat",
    "Goblet squat",
    "quads",
    ["glutes"],
    "dumbbell",
    "weight",
    "Hold one weight at your chest, elbows inside the knees.",
  ],
  ["hack-squat", "Hack squat", "quads", ["glutes"], "machine", "weight", "Back flat on the pad, go deep."],
  [
    "leg-press",
    "Leg press",
    "quads",
    ["glutes", "hamstrings"],
    "machine",
    "weight",
    "Feet shoulder-width, don't let your lower back lift.",
  ],
  ["leg-extension", "Leg extension", "quads", [], "machine", "weight", "Pause at the top, lower slowly."],
  [
    "bulgarian-split-squat",
    "Bulgarian split squat",
    "quads",
    ["glutes"],
    "dumbbell",
    "weight",
    "Back foot on a bench, drop the back knee straight down.",
  ],
  [
    "walking-lunge",
    "Walking lunge",
    "quads",
    ["glutes", "hamstrings"],
    "dumbbell",
    "weight",
    "Long steps, back knee just off the floor. Count both legs.",
  ],
  [
    "reverse-lunge",
    "Reverse lunge",
    "quads",
    ["glutes"],
    "dumbbell",
    "weight",
    "Step back, keep the front shin vertical.",
  ],
  [
    "step-up",
    "Step-up",
    "quads",
    ["glutes"],
    "dumbbell",
    "weight",
    "Drive through the top foot, don't push off the back one.",
  ],
  [
    "bodyweight-squat",
    "Bodyweight squat",
    "quads",
    ["glutes"],
    "bodyweight",
    "reps",
    "Arms forward for balance, full depth.",
  ],
  [
    "pistol-squat",
    "Pistol squat",
    "quads",
    ["glutes"],
    "bodyweight",
    "reps",
    "One leg out in front, sit all the way down.",
  ],
  ["wall-sit", "Wall sit", "quads", [], "bodyweight", "time", "Back on the wall, thighs parallel to the floor."],

  // hamstrings
  [
    "romanian-deadlift",
    "Romanian deadlift",
    "hamstrings",
    ["glutes", "back"],
    "barbell",
    "weight",
    "Soft knees, push the hips back, bar close to the legs.",
  ],
  [
    "stiff-leg-deadlift",
    "Stiff-leg deadlift",
    "hamstrings",
    ["back", "glutes"],
    "barbell",
    "weight",
    "Legs almost straight, stretch then stand.",
  ],
  [
    "dumbbell-romanian-deadlift",
    "Dumbbell Romanian deadlift",
    "hamstrings",
    ["glutes"],
    "dumbbell",
    "weight",
    "Dumbbells slide down the front of your thighs.",
  ],
  [
    "single-leg-rdl",
    "Single-leg RDL",
    "hamstrings",
    ["glutes"],
    "dumbbell",
    "weight",
    "Hips square, back leg rises as you hinge.",
  ],
  ["lying-leg-curl", "Lying leg curl", "hamstrings", ["calves"], "machine", "weight", "Hips down on the pad."],
  [
    "seated-leg-curl",
    "Seated leg curl",
    "hamstrings",
    [],
    "machine",
    "weight",
    "Lap pad tight, curl all the way under.",
  ],
  [
    "nordic-curl",
    "Nordic curl",
    "hamstrings",
    [],
    "bodyweight",
    "reps",
    "Ankles anchored, lower your body as slowly as you can.",
  ],
  [
    "kettlebell-swing",
    "Kettlebell swing",
    "hamstrings",
    ["glutes", "back"],
    "kettlebell",
    "weight",
    "Hike it back, snap the hips, float it to chest height.",
  ],

  // glutes
  [
    "hip-thrust",
    "Hip thrust",
    "glutes",
    ["hamstrings"],
    "barbell",
    "weight",
    "Upper back on a bench, drive the bar up, chin tucked.",
  ],
  ["glute-bridge", "Glute bridge", "glutes", ["hamstrings"], "bodyweight", "reps", "Feet flat, squeeze at the top."],
  ["cable-kickback", "Cable kickback", "glutes", [], "cable", "weight", "Kick straight back without arching."],
  ["hip-abduction", "Hip abduction", "glutes", [], "machine", "weight", "Push the pads apart, slow on the way back."],
  ["hip-adduction", "Hip adduction", "quads", [], "machine", "weight", "Squeeze the pads together."],

  // calves
  [
    "standing-calf-raise",
    "Standing calf raise",
    "calves",
    [],
    "machine",
    "weight",
    "Full stretch at the bottom, pause at the top.",
  ],
  ["seated-calf-raise", "Seated calf raise", "calves", [], "machine", "weight", "Knees under the pad, slow reps."],
  [
    "single-leg-calf-raise",
    "Single-leg calf raise",
    "calves",
    [],
    "bodyweight",
    "reps",
    "On a step, one foot at a time.",
  ],

  // full body / olympic
  [
    "power-clean",
    "Power clean",
    "back",
    ["quads", "glutes", "shoulders"],
    "barbell",
    "weight",
    "Explode from the hips, catch the bar on your shoulders.",
  ],
  [
    "clean-and-jerk",
    "Clean and jerk",
    "quads",
    ["back", "shoulders", "glutes"],
    "barbell",
    "weight",
    "Clean to the shoulders, dip, drive and split.",
  ],
  [
    "snatch",
    "Snatch",
    "back",
    ["shoulders", "quads", "glutes"],
    "barbell",
    "weight",
    "Wide grip, floor to overhead in one move.",
  ],
  ["thruster", "Thruster", "quads", ["shoulders", "glutes"], "barbell", "weight", "Front squat straight into a press."],
  [
    "kettlebell-goblet-squat",
    "Kettlebell goblet squat",
    "quads",
    ["glutes"],
    "kettlebell",
    "weight",
    "Hold the horns, sit down between your knees.",
  ],
  [
    "turkish-get-up",
    "Turkish get-up",
    "shoulders",
    ["abs", "glutes"],
    "kettlebell",
    "weight",
    "Eyes on the bell, one step at a time. Count each side.",
  ],
  ["burpee", "Burpee", "cardio", ["chest", "quads"], "bodyweight", "reps", "Chest to the floor, jump at the top."],
  ["box-jump", "Box jump", "quads", ["glutes", "calves"], "other", "reps", "Land soft, step down."],
  [
    "sled-push",
    "Sled push",
    "quads",
    ["glutes", "calves"],
    "other",
    "distance",
    "Arms locked, drive with short steps.",
  ],
  [
    "band-pull-apart",
    "Band pull-apart",
    "shoulders",
    ["back"],
    "band",
    "reps",
    "Arms straight, pull the band to your chest.",
  ],

  // cardio
  ["run", "Run", "cardio", ["quads", "calves"], "other", "distance", "Easy days easy, hard days hard."],
  [
    "treadmill",
    "Treadmill",
    "cardio",
    ["quads", "calves"],
    "cardio-machine",
    "distance",
    "A 1% incline feels closest to running outside.",
  ],
  ["walk", "Walk", "cardio", [], "other", "distance", "Brisk pace, arms swinging."],
  [
    "cycling",
    "Cycling",
    "cardio",
    ["quads"],
    "other",
    "distance",
    "Saddle high enough for a slight bend at the bottom.",
  ],
  ["stationary-bike", "Stationary bike", "cardio", ["quads"], "cardio-machine", "distance", "Keep the cadence steady."],
  [
    "rowing-machine",
    "Rowing machine",
    "cardio",
    ["back", "quads"],
    "cardio-machine",
    "distance",
    "Legs, then body, then arms; reverse on the way back.",
  ],
  [
    "elliptical",
    "Elliptical",
    "cardio",
    [],
    "cardio-machine",
    "distance",
    "Stand tall, push and pull with the handles.",
  ],
  [
    "stair-climber",
    "Stair climber",
    "cardio",
    ["glutes", "calves"],
    "cardio-machine",
    "time",
    "Don't lean on the rails.",
  ],
  ["swim", "Swim", "cardio", ["back", "shoulders"], "other", "distance", "Long strokes, breathe every few."],
  ["jump-rope", "Jump rope", "cardio", ["calves"], "other", "time", "Small hops, turn the rope with your wrists."],
];

export const EXERCISES: Exercise[] = ROWS.map(([id, name, muscle, secondary, equipment, measure, cue]) => ({
  id,
  name,
  muscle,
  secondary,
  equipment,
  measure,
  cue,
}));

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export function isExerciseId(id: unknown): id is string {
  return typeof id === "string" && BY_ID.has(id);
}

/** Every muscle an exercise works, primary first. */
export function musclesOf(e: Exercise): Muscle[] {
  return [e.muscle, ...e.secondary.filter((m) => m !== e.muscle)];
}
