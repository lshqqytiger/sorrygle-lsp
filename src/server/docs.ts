export interface ConfigInfo {
  label: string;
  description: string;
  defaultValue: string;
}

export const GLOBAL_CONFIGS: Record<string, ConfigInfo> = {
  bpm: {
    label: "BPM configuration",
    description: "Set the current BPM.",
    defaultValue: "120",
  },
  fermata: {
    label: "Fermata configuration",
    description:
      "Set the length of fermatas. The duration of a fermata note is multiplied by this value.",
    defaultValue: "2",
  },
  "time-sig": {
    label: "Time signature configuration",
    description: "Set the time signature (e.g. `3/4`).",
    defaultValue: "4/4",
  },
};

export const LOCAL_CONFIGS: Record<string, ConfigInfo> = {
  o: {
    label: "Default octave",
    description: "(0 ≤ ⓘ ≤ 8) Set the default octave for following input.",
    defaultValue: "4",
  },
  p: {
    label: "Instrument",
    description:
      "(0 ≤ ⓘ ≤ 127) Set the instrument (GM 1 Sound Set, PC# = ⓘ + 1). A bank can be given as `p=ⓘ/bank`.",
    defaultValue: "0",
  },
  q: {
    label: "Quantization",
    description: "Set the default note/rest/tie length for following input.",
    defaultValue: "16",
  },
  s: {
    label: "Sustain pedal",
    description:
      "(0 ≤ ⓘ ≤ 127) Set the sustain pedal value. Enabled only if ⓘ ≥ 64.",
    defaultValue: "0",
  },
  t: {
    label: "Transpose",
    description: "Transpose following input by ⓘ semitones.",
    defaultValue: "0",
  },
  v: {
    label: "Volume",
    description: "(1 ≤ ⓘ ≤ 100) Set the volume for following input.",
    defaultValue: "80",
  },
};

export const RANGE_TYPES: Record<
  string,
  { label: string; description: string }
> = {
  "^": {
    label: "Ranged octave up",
    description: "Play all notes in the bracket one octave higher.",
  },
  v: {
    label: "Ranged octave down",
    description: "Play all notes in the bracket one octave lower.",
  },
  "3": {
    label: "Triplet",
    description:
      "Set the length of each note to 2/3 of the current quantization.",
  },
  "5": {
    label: "Quintuplet",
    description:
      "Set the length of each note to 2/5 of the current quantization.",
  },
  "7": {
    label: "Septuplet",
    description:
      "Set the length of each note to 2/7 of the current quantization.",
  },
  s: {
    label: "Ranged sustain pedal",
    description: "Same as `(s=127)...(s=0)`.",
  },
  ":": {
    label: "Ranged sublength",
    description: "Halve the length of each note (quadruplet).",
  },
  "|": {
    label: "Ranged superlength",
    description: "Double the length of each note (uni-tuplet).",
  },
};

export const DIACRITICS: Record<
  string,
  { label: string; description: string; snippet: string }
> = {
  ".": {
    label: "Staccato",
    description: "Play the note shortly (precisely T8).",
    snippet: ".$1>",
  },
  "~": {
    label: "Fermata",
    description: "Play the note lengthily (as configured by `((fermata=ⓝ))`).",
    snippet: "~$1>",
  },
  "!": {
    label: "Sforzando",
    description: "Play the note strongly (in the maximum volume).",
    snippet: "!$1>",
  },
  t: {
    label: "Trill",
    description: "Play the note as a trill (of interval T16).",
    snippet: "t$1>",
  },
  "+": {
    label: "Crescendo",
    description:
      "(1 ≤ ⓘ ≤ 100) Play all notes with volume increasing from the current volume to ⓘ: `<+cegⓘ>`.",
    snippet: "+$1${2:100}>",
  },
  "-": {
    label: "Decrescendo",
    description:
      "(1 ≤ ⓘ ≤ 100) Play all notes with volume decreasing from the current volume to ⓘ: `<-gecⓘ>`.",
    snippet: "-$1${2:1}>",
  },
  p: {
    label: "Pitch bend",
    description:
      "(-1 ≤ ⓝ ≤ 1) Modify the pitch bend linearly: `<p(ⓝ)c~(ⓝ)~~(ⓝ)>`.",
    snippet: "p(${1:0})$2(${3:1})>",
  },
};

export const KEY_NAMES: Record<string, string> = {
  c: "C",
  d: "D",
  e: "E",
  f: "F",
  g: "G",
  a: "A",
  b: "B",
  C: "C♯",
  D: "D♯",
  F: "F♯",
  G: "G♯",
  A: "A♯",
  도: "C",
  레: "D",
  미: "E",
  파: "F",
  솔: "G",
  라: "A",
  시: "B",
  돗: "C♯",
  렛: "D♯",
  팟: "F♯",
  솘: "G♯",
  랏: "A♯",
  렢: "D♭",
  밒: "E♭",
  솚: "G♭",
  랖: "A♭",
  싶: "B♭",
};

export const DEFAULT_EMOJIS: Record<string, string> = {
  "𝅝": "(q=1)",
  "𝅗𝅥": "(q=2)",
  "𝅘𝅥": "(q=4)",
  "𝅘𝅥𝅮": "(q=8)",
  "𝅘𝅥𝅯": "(q=16)",
  "𝅘𝅥𝅰": "(q=32)",
  "♩": "(q=4)",
  "♪": "(q=8)",
  "♬": "(q=16)",
  "🎹": "(p=0)",
  "🪗": "(p=21)",
  "🎸": "(p=24)",
  "🎻": "(p=40)",
  "🎤": "(p=54)",
  "🎺": "(p=56)",
  "🎷": "(p=64)",
  "🪕": "(p=105)",
  "🥁": "(p=118)",
};

export const DURATIONS = ["1", "2", "4", "8", "16", "32", "64"];
export const RE_DURATION = /^(?:d{0,2}(?:1|2|4|8|16|32|64)t?|T\d+)$/;

export const TOKEN_DOCS: Partial<Record<string, string>> = {
  parallelOpen:
    "**Parallelization** `[[...|...]]` — play all sections at once.",
  parallelSep:
    "**Parallelization separator** — starts the next simultaneous section.",
  parallelClose: "**Parallelization** end.",
  chordOpen: "**Chord** `[ceg]` — play all keys at once.",
  arpeggioOpen: "**Arpeggio** `[|ceg]` — play the keys rapidly in sequence.",
  graceOpen:
    "**Appoggiatura** `[>ga]b` — treat all notes in the bracket as appoggiaturas of the next note.",
  repeatOpen: "**Open repeat** — set the start point of a repetition.",
  rest: "**Rest** — keep silent for the current quantization.",
  tie: "**Tie** — increase the length of the preceding note by the current quantization.",
  bendValue: "**Pitch bend value** (-1 ≤ ⓝ ≤ 1).",
  velocity: "**Target volume** of the crescendo/decrescendo (1 ≤ ⓘ ≤ 100).",
};

export const GM_INSTRUMENTS = [
  "Acoustic Grand Piano",
  "Bright Acoustic Piano",
  "Electric Grand Piano",
  "Honky-tonk Piano",
  "Electric Piano 1",
  "Electric Piano 2",
  "Harpsichord",
  "Clavinet",
  "Celesta",
  "Glockenspiel",
  "Music Box",
  "Vibraphone",
  "Marimba",
  "Xylophone",
  "Tubular Bells",
  "Dulcimer",
  "Drawbar Organ",
  "Percussive Organ",
  "Rock Organ",
  "Church Organ",
  "Reed Organ",
  "Accordion",
  "Harmonica",
  "Tango Accordion",
  "Acoustic Guitar (nylon)",
  "Acoustic Guitar (steel)",
  "Electric Guitar (jazz)",
  "Electric Guitar (clean)",
  "Electric Guitar (muted)",
  "Overdriven Guitar",
  "Distortion Guitar",
  "Guitar Harmonics",
  "Acoustic Bass",
  "Electric Bass (finger)",
  "Electric Bass (pick)",
  "Fretless Bass",
  "Slap Bass 1",
  "Slap Bass 2",
  "Synth Bass 1",
  "Synth Bass 2",
  "Violin",
  "Viola",
  "Cello",
  "Contrabass",
  "Tremolo Strings",
  "Pizzicato Strings",
  "Orchestral Harp",
  "Timpani",
  "String Ensemble 1",
  "String Ensemble 2",
  "Synth Strings 1",
  "Synth Strings 2",
  "Choir Aahs",
  "Voice Oohs",
  "Synth Choir",
  "Orchestra Hit",
  "Trumpet",
  "Trombone",
  "Tuba",
  "Muted Trumpet",
  "French Horn",
  "Brass Section",
  "Synth Brass 1",
  "Synth Brass 2",
  "Soprano Sax",
  "Alto Sax",
  "Tenor Sax",
  "Baritone Sax",
  "Oboe",
  "English Horn",
  "Bassoon",
  "Clarinet",
  "Piccolo",
  "Flute",
  "Recorder",
  "Pan Flute",
  "Blown Bottle",
  "Shakuhachi",
  "Whistle",
  "Ocarina",
  "Lead 1 (square)",
  "Lead 2 (sawtooth)",
  "Lead 3 (calliope)",
  "Lead 4 (chiff)",
  "Lead 5 (charang)",
  "Lead 6 (voice)",
  "Lead 7 (fifths)",
  "Lead 8 (bass + lead)",
  "Pad 1 (new age)",
  "Pad 2 (warm)",
  "Pad 3 (polysynth)",
  "Pad 4 (choir)",
  "Pad 5 (bowed)",
  "Pad 6 (metallic)",
  "Pad 7 (halo)",
  "Pad 8 (sweep)",
  "FX 1 (rain)",
  "FX 2 (soundtrack)",
  "FX 3 (crystal)",
  "FX 4 (atmosphere)",
  "FX 5 (brightness)",
  "FX 6 (goblins)",
  "FX 7 (echoes)",
  "FX 8 (sci-fi)",
  "Sitar",
  "Banjo",
  "Shamisen",
  "Koto",
  "Kalimba",
  "Bagpipe",
  "Fiddle",
  "Shanai",
  "Tinkle Bell",
  "Agogo",
  "Steel Drums",
  "Woodblock",
  "Taiko Drum",
  "Melodic Tom",
  "Synth Drum",
  "Reverse Cymbal",
  "Guitar Fret Noise",
  "Breath Noise",
  "Seashore",
  "Bird Tweet",
  "Telephone Ring",
  "Helicopter",
  "Applause",
  "Gunshot",
];
