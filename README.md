# Sorrygle for Visual Studio Code

Language support for [Sorrygle](https://github.com/JJoriping/Sorrygle), a text-based MIDI writing language, powered by a language server.

```sorrygle
((bpm=100))
Turkish March =/
#1 (♪)(o=5)
|:{10 c~__dcvbc e~__feDe baGabaGa }
/1 e~~~(vbaGa) :|
/2 {=10} <+cdefgab^c90> [>ga]b [[c~~~|efga]]
```

## Features

Files with the `.srg` or `.sorrygle` extension are recognized as Sorrygle.

- **Syntax highlighting** for notes, rests, ties, chords, ranges, diacritics, configurations, groups, user-defined ranges, emojis, repeats, and comments.
- **Diagnostics**
  - Syntax and semantic errors reported by the official `sorrygle` compiler, mapped back to the original source (comments included).
  - Warnings for out-of-range values: octave `(o=)`, instrument `(p=)`, volume `(v=)`, sustain `(s=)`, durations `(q=)`, channels `#ⓘ`, crescendo/decrescendo targets, and pitch bend values.
  - Warnings for unknown local/global configuration keys.
- **Completion**

  | After      | Suggests                                                                             |
  | ---------- | ------------------------------------------------------------------------------------ |
  | `((`       | Global configurations (`bpm`, `fermata`, `time-sig`)                                 |
  | `(`        | Local configurations, range types, emojis                                            |
  | `(p=`      | General MIDI instruments (searchable by name)                                        |
  | `(q=`      | Durations                                                                            |
  | `(o=`      | Octaves                                                                              |
  | `{=`       | Declared groups                                                                      |
  | `{{`       | Declared user-defined ranges                                                         |
  | `#` / `#~` | Channels / declared channels                                                         |
  | `<`        | Diacritics (staccato, fermata, sforzando, trill, crescendo, decrescendo, pitch bend) |

- **Hover** documentation for notes (with octave and semitone shifts), configurations, instrument names, ranges, diacritics, emojis, repeats, and voltas. Hovering a group or user-defined range reference shows its definition.
- **Go to Definition**, **Find All References**, and **highlighting** for groups (`{10 ...}` / `{=10}`), user-defined ranges (`{{name}}`), emojis, and channels (`#~1` → `#1`).
- **Outline** of channels, groups, user-defined ranges, emoji declarations, and global configurations.
- **Folding** of multi-line groups, ranges, and parallelizations.
- **Toggle line comment** inserts `/=` (tail comment).

> Note that `=/` ignores the text _before_ it and `/=` ignores the text _after_ it.

## Settings

| Setting                       | Default | Description                                                      |
| ----------------------------- | ------- | ---------------------------------------------------------------- |
| `sorrygle.diagnostics.enable` | `true`  | Validate documents with the Sorrygle compiler.                   |
| `sorrygle.trace.server`       | `off`   | Trace the communication between VS Code and the language server. |

## Development

Requires [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/).

```sh
pnpm install
pnpm run build   # or: pnpm run watch
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host with the extension loaded, then open [examples/sample.srg](examples/sample.srg). Use the **Attach to Server** launch configuration to debug the language server (port 6009).

### Project structure

```
src/
├── client/extension.ts      # Starts the language client
└── server/
    ├── server.ts            # LSP handlers (hover, completion, navigation, symbols, folding)
    ├── scanner.ts           # Tokenizer, comment mapping, symbol lookup
    ├── diagnostics.ts       # Compiler errors and lint warnings
    └── docs.ts              # Reference data (configurations, instruments, emojis)
syntaxes/sorrygle.tmLanguage.json
language-configuration.json
```

## License

[MIT No Attribution](LICENSE)
