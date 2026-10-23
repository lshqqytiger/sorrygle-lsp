export type TokenKind =
  | "globalConfig"
  | "emojiDecl"
  | "localConfig"
  | "emojiRef"
  | "channel"
  | "udrDef"
  | "udrRef"
  | "groupDecl"
  | "groupRef"
  | "blockOpen"
  | "blockClose"
  | "parallelOpen"
  | "parallelSep"
  | "parallelClose"
  | "chordOpen"
  | "arpeggioOpen"
  | "graceOpen"
  | "bracketClose"
  | "rangeOpen"
  | "parenClose"
  | "diacriticOpen"
  | "angleClose"
  | "bendValue"
  | "velocity"
  | "repeatOpen"
  | "repeatClose"
  | "volta"
  | "note"
  | "rest"
  | "tie"
  | "unknown";

export interface Span {
  start: number;
  end: number;
}

export interface Token extends Span {
  kind: TokenKind;
  text: string;
  /** Config key, emoji, UDR name, group id, channel id, range type, diacritic type or note key. */
  key?: string;
  keySpan?: Span;
  value?: string;
  valueSpan?: Span;
  prefix?: string;
  suffix?: string;
  /** `#~n` channel continuation. */
  continued?: boolean;
  /** `{{name}}(...)` range. */
  udr?: boolean;
  /** Local configuration inside an emoji declaration. */
  inner?: Token;
  /** Offset right after the matching closer, for openers. */
  closeEnd?: number;
}

export interface CommentMap {
  /** Offsets of each line start in the original text. */
  lineStarts: number[];
  /** Offsets of each line start in the comment-stripped text the compiler sees. */
  strippedStarts: number[];
  /** Length of the head comment (`... =/`) of each line. */
  heads: number[];
}

export interface Analysis {
  text: string;
  masked: string;
  comments: Span[];
  commentMap: CommentMap;
  tokens: Token[];
}

const KEYS = "xcdefgabCDEFGA도레미파솔라시돗렛팟솘랏렢밒솚랖싶";
const WORD = String.raw`[\w.\/\-]+`;
const EMOJI = String.raw`[^\x00-\xFF]+`;

const RE_GLOBAL = new RegExp(String.raw`\(\((${WORD})=(${WORD})\)\)`, "y");
const RE_EMOJI_DECL = new RegExp(
  String.raw`\(\((${EMOJI})=(\s*)\((${WORD})=(${WORD})\)\s*\)\)`,
  "y",
);
const RE_LOCAL = new RegExp(String.raw`\((${WORD})=(${WORD})\)`, "y");
const RE_EMOJI_REF = new RegExp(String.raw`\((${EMOJI})\)`, "y");
const RE_BEND = /\(([-0-9.]+)\)/y;
const RE_UDR = new RegExp(String.raw`\{\{(${WORD})\}\}(\s*)([{(])?`, "y");
const RE_GROUP_REF = /\{=(\d+)\}/y;
const RE_GROUP_DECL = /\{(\d+)/y;
const RE_CHANNEL = /#(~?)(\d+)/y;
const RE_REPEAT_CLOSE = /:\|(\d*)/y;
const RE_NOTE = new RegExp(`([v^]*)([${KEYS}])([-+]*)`, "uy");
const RE_VELOCITY = /\d+(?=\s*>)/y;
const RE_HEAD_COMMENT = /^(.*)=\//;
const RE_TAIL_COMMENT = /\/=.*/;

const OPENERS: ReadonlySet<TokenKind> = new Set<TokenKind>([
  "blockOpen",
  "groupDecl",
  "parallelOpen",
  "chordOpen",
  "arpeggioOpen",
  "graceOpen",
  "rangeOpen",
  "diacriticOpen",
]);

/** Mirrors `Sorrygle.preprocess`, which strips `... =/` and `/= ...` per line. */
function scanComments(text: string): {
  comments: Span[];
  commentMap: CommentMap;
} {
  const comments: Span[] = [];
  const commentMap: CommentMap = {
    lineStarts: [],
    strippedStarts: [],
    heads: [],
  };
  let offset = 0;
  let stripped = 0;

  for (const line of text.split("\n")) {
    const head = RE_HEAD_COMMENT.exec(line)?.[0].length ?? 0;
    const tail = RE_TAIL_COMMENT.exec(line.slice(head));
    let removed = head;

    if (head) comments.push({ start: offset, end: offset + head });
    if (tail) {
      comments.push({
        start: offset + head + tail.index,
        end: offset + head + tail.index + tail[0].length,
      });
      removed += tail[0].length;
    }
    commentMap.lineStarts.push(offset);
    commentMap.strippedStarts.push(stripped);
    commentMap.heads.push(head);
    offset += line.length + 1;
    stripped += line.length - removed + 1;
  }
  return { comments, commentMap };
}

/** Converts an offset in the comment-stripped text into an offset in the original text. */
export function toOriginalOffset(
  map: CommentMap,
  strippedOffset: number,
): number {
  let line = 0;
  for (let i = 1; i < map.strippedStarts.length; i++) {
    if (map.strippedStarts[i] > strippedOffset) break;
    line = i;
  }
  return (
    map.lineStarts[line] +
    map.heads[line] +
    strippedOffset -
    map.strippedStarts[line]
  );
}

export function analyze(text: string): Analysis {
  const { comments, commentMap } = scanComments(text);
  const chars = text.split("");
  for (const c of comments) {
    for (let i = c.start; i < c.end; i++) chars[i] = " ";
  }
  const masked = chars.join("");
  const tokens: Token[] = [];
  const stack: Token[] = [];
  let i = 0;

  const top = (): Token | undefined => stack[stack.length - 1];
  const push = (token: Token): Token => {
    tokens.push(token);
    if (OPENERS.has(token.kind)) stack.push(token);
    return token;
  };
  const simple = (kind: TokenKind, length: number, key?: string): Token =>
    push({
      kind,
      start: i,
      end: i + length,
      text: masked.slice(i, i + length),
      key,
    });
  const match = (re: RegExp): RegExpExecArray | null => {
    re.lastIndex = i;
    return re.exec(masked);
  };
  const close = (closer: Token, accepts: TokenKind[]): void => {
    for (let j = stack.length - 1; j >= 0; j--) {
      if (!accepts.includes(stack[j].kind)) continue;
      stack[j].closeEnd = closer.end;
      stack.length = j;
      return;
    }
  };

  while (i < masked.length) {
    const c = masked[i];
    const next = masked[i + 1];
    let m: RegExpExecArray | null;

    if (/\s/.test(c)) {
      i++;
      continue;
    }
    let token: Token | undefined;

    switch (c) {
      case "(":
        if (next === "(" && (m = match(RE_GLOBAL))) {
          token = push({
            kind: "globalConfig",
            start: i,
            end: i + m[0].length,
            text: m[0],
            key: m[1],
            keySpan: { start: i + 2, end: i + 2 + m[1].length },
            value: m[2],
            valueSpan: {
              start: i + 3 + m[1].length,
              end: i + 3 + m[1].length + m[2].length,
            },
          });
          break;
        }
        if (next === "(" && (m = match(RE_EMOJI_DECL))) {
          const innerStart = i + 3 + m[1].length + m[2].length;
          token = push({
            kind: "emojiDecl",
            start: i,
            end: i + m[0].length,
            text: m[0],
            key: m[1],
            keySpan: { start: i + 2, end: i + 2 + m[1].length },
            inner: {
              kind: "localConfig",
              start: innerStart,
              end: innerStart + m[3].length + m[4].length + 3,
              text: `(${m[3]}=${m[4]})`,
              key: m[3],
              value: m[4],
            },
          });
          break;
        }
        if (
          top()?.kind === "diacriticOpen" &&
          top()?.key === "p" &&
          (m = match(RE_BEND))
        ) {
          token = push({
            kind: "bendValue",
            start: i,
            end: i + m[0].length,
            text: m[0],
            value: m[1],
          });
          break;
        }
        if ((m = match(RE_LOCAL))) {
          token = push({
            kind: "localConfig",
            start: i,
            end: i + m[0].length,
            text: m[0],
            key: m[1],
            keySpan: { start: i + 1, end: i + 1 + m[1].length },
            value: m[2],
            valueSpan: {
              start: i + 2 + m[1].length,
              end: i + 2 + m[1].length + m[2].length,
            },
          });
          break;
        }
        if ((m = match(RE_EMOJI_REF))) {
          token = push({
            kind: "emojiRef",
            start: i,
            end: i + m[0].length,
            text: m[0],
            key: m[1],
            keySpan: { start: i + 1, end: i + 1 + m[1].length },
          });
          break;
        }
        token = "v^357s:|".includes(next ?? "")
          ? simple("rangeOpen", 2, next)
          : simple("rangeOpen", 1, "");
        break;
      case ")":
        close((token = simple("parenClose", 1)), ["rangeOpen"]);
        break;
      case "{":
        if (next === "{" && (m = match(RE_UDR))) {
          const nameSpan = { start: i + 2, end: i + 2 + m[1].length };
          const isDef = m[3] === "{";
          token = push({
            kind: isDef ? "udrDef" : "udrRef",
            start: i,
            end: nameSpan.end + 2,
            text: `{{${m[1]}}}`,
            key: m[1],
            keySpan: nameSpan,
          });
          if (m[3]) {
            i += m[0].length - 1;
            token = simple(isDef ? "blockOpen" : "rangeOpen", 1, m[1]);
            token.udr = !isDef;
          }
          break;
        }
        if ((m = match(RE_GROUP_REF))) {
          token = push({
            kind: "groupRef",
            start: i,
            end: i + m[0].length,
            text: m[0],
            key: m[1],
            keySpan: { start: i + 2, end: i + 2 + m[1].length },
          });
          break;
        }
        if ((m = match(RE_GROUP_DECL))) {
          token = push({
            kind: "groupDecl",
            start: i,
            end: i + m[0].length,
            text: m[0],
            key: m[1],
            keySpan: { start: i + 1, end: i + m[0].length },
          });
          break;
        }
        token = simple("blockOpen", 1);
        break;
      case "}":
        close((token = simple("blockClose", 1)), ["blockOpen", "groupDecl"]);
        break;
      case "[":
        if (next === "[") token = simple("parallelOpen", 2);
        else if (next === "|") token = simple("arpeggioOpen", 2);
        else if (next === ">") token = simple("graceOpen", 2);
        else token = simple("chordOpen", 1);
        break;
      case "]":
        if (top()?.kind === "parallelOpen" && next === "]")
          close((token = simple("parallelClose", 2)), ["parallelOpen"]);
        else
          close((token = simple("bracketClose", 1)), [
            "chordOpen",
            "arpeggioOpen",
            "graceOpen",
          ]);
        break;
      case "|":
        if (next === ":") token = simple("repeatOpen", 2);
        else
          token = simple(
            top()?.kind === "parallelOpen" ? "parallelSep" : "unknown",
            1,
          );
        break;
      case ":":
        m = match(RE_REPEAT_CLOSE);
        token = m
          ? push({
              kind: "repeatClose",
              start: i,
              end: i + m[0].length,
              text: m[0],
              value: m[1] || undefined,
            })
          : simple("unknown", 1);
        break;
      case "<":
        token =
          next && ".~!t+-p".includes(next)
            ? simple("diacriticOpen", 2, next)
            : simple("unknown", 1);
        break;
      case ">":
        close((token = simple("angleClose", 1)), ["diacriticOpen"]);
        break;
      case "/":
        token =
          next === "1" || next === "2"
            ? simple("volta", 2, next)
            : simple("unknown", 1);
        break;
      case "#":
        m = match(RE_CHANNEL);
        token = m
          ? push({
              kind: "channel",
              start: i,
              end: i + m[0].length,
              text: m[0],
              key: m[2],
              continued: m[1] === "~",
              keySpan: { start: i + 1 + m[1].length, end: i + m[0].length },
            })
          : simple("unknown", 1);
        break;
      case "_":
      case "ㅇ":
        token = simple("rest", 1);
        break;
      case "~":
      case "ㅡ":
        token = simple("tie", 1);
        break;
      default:
        if (
          /\d/.test(c) &&
          top()?.kind === "diacriticOpen" &&
          "+-".includes(top()!.key!) &&
          (m = match(RE_VELOCITY))
        ) {
          token = push({
            kind: "velocity",
            start: i,
            end: i + m[0].length,
            text: m[0],
            value: m[0],
          });
          break;
        }
        if ((m = match(RE_NOTE))) {
          token = push({
            kind: "note",
            start: i,
            end: i + m[0].length,
            text: m[0],
            prefix: m[1],
            key: m[2],
            suffix: m[3],
            keySpan: {
              start: i + m[1].length,
              end: i + m[1].length + m[2].length,
            },
          });
          break;
        }
        token = simple("unknown", c.length);
    }
    i = Math.max(token.end, i + 1);
  }
  return { text, masked, comments, commentMap, tokens };
}

export function tokenAt(analysis: Analysis, offset: number): Token | undefined {
  const { tokens } = analysis;
  return (
    tokens.find((t) => t.start <= offset && offset < t.end) ??
    tokens.find((t) => t.end === offset)
  );
}

export type SymbolKind = "group" | "udr" | "emoji" | "channel";

export function symbolOf(
  token: Token,
): { kind: SymbolKind; key: string } | undefined {
  switch (token.kind) {
    case "groupDecl":
    case "groupRef":
      return { kind: "group", key: token.key! };
    case "udrDef":
    case "udrRef":
      return { kind: "udr", key: token.key! };
    case "emojiDecl":
    case "emojiRef":
      return { kind: "emoji", key: token.key! };
    case "channel":
      return { kind: "channel", key: token.key! };
  }
  return undefined;
}

export function isDeclaration(token: Token): boolean {
  return (
    token.kind === "groupDecl" ||
    token.kind === "udrDef" ||
    token.kind === "emojiDecl" ||
    (token.kind === "channel" && !token.continued)
  );
}

export function findDeclaration(
  analysis: Analysis,
  token: Token,
): Token | undefined {
  const symbol = symbolOf(token);
  if (!symbol) return undefined;
  const candidates = analysis.tokens.filter(
    (t) =>
      isDeclaration(t) &&
      symbolOf(t)?.key === symbol.key &&
      symbolOf(t)?.kind === symbol.kind,
  );

  // `#~n` continues the latest `#n` declared before it.
  if (symbol.kind === "channel")
    return candidates.filter((t) => t.start <= token.start).pop();
  return candidates[0];
}

export function findReferences(analysis: Analysis, token: Token): Token[] {
  const symbol = symbolOf(token);
  if (!symbol) return [];
  return analysis.tokens.filter((t) => {
    const s = symbolOf(t);
    return s?.kind === symbol.kind && s.key === symbol.key;
  });
}
