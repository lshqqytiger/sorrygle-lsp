import { Sorrygle } from "sorrygle";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DURATIONS, RE_DURATION } from "./docs";
import { Analysis, Span, toOriginalOffset } from "./scanner";

const SOURCE = "sorrygle";
const MAX_EXPECTATIONS = 8;

function diagnostic(
  document: TextDocument,
  span: Span,
  message: string,
  severity: DiagnosticSeverity,
): Diagnostic {
  return {
    range: {
      start: document.positionAt(span.start),
      end: document.positionAt(span.end),
    },
    message,
    severity,
    source: SOURCE,
  };
}

function compilerDiagnostic(
  document: TextDocument,
  analysis: Analysis,
  error: unknown,
): Diagnostic {
  const text = analysis.text;
  const e = error as { message?: string; index?: unknown; offset?: unknown };
  const lines = String(e.message ?? error).split(/\r?\n/);
  let message = lines[0];
  let stripped: number | undefined;

  if (typeof e.index === "number") {
    stripped = e.index;
  } else if (typeof e.offset === "number") {
    // Nearley syntax error, whose message was prettified by Sorrygle.
    stripped = e.offset;
    const expected = lines
      .filter((v) => v.startsWith("• "))
      .map((v) => v.slice(2));
    message = "Syntax error";
    if (expected.length) {
      const shown = expected.slice(0, MAX_EXPECTATIONS).join(", ");
      message += `. Expected: ${shown}${expected.length > MAX_EXPECTATIONS ? ", ..." : ""}`;
    }
  }
  if (stripped === undefined) {
    const at = message === "Incomplete data" ? text.length : 0;
    if (message === "Incomplete data")
      message = "Incomplete data: unexpected end of input (unclosed bracket?)";
    return diagnostic(
      document,
      { start: at, end: at },
      message,
      DiagnosticSeverity.Error,
    );
  }
  const start = Math.min(
    toOriginalOffset(analysis.commentMap, stripped),
    text.length,
  );
  const end =
    start < text.length && !/[\r\n]/.test(text[start]) ? start + 1 : start;
  return diagnostic(
    document,
    { start, end },
    message,
    DiagnosticSeverity.Error,
  );
}

function checkRange(value: string, min: number, max: number): boolean {
  if (!/^-?\d+$/.test(value)) return false;
  const n = parseInt(value, 10);
  return n >= min && n <= max;
}

function lint(document: TextDocument, analysis: Analysis): Diagnostic[] {
  const R: Diagnostic[] = [];
  const warn = (span: Span, message: string): void => {
    R.push(diagnostic(document, span, message, DiagnosticSeverity.Warning));
  };

  for (const t of analysis.tokens) {
    const valueSpan = t.valueSpan ?? t;
    switch (t.kind) {
      case "localConfig":
        {
          const v = t.value!;
          switch (t.key) {
            case "o":
              if (!checkRange(v, 0, 8))
                warn(valueSpan, "Octave should be an integer between 0 and 8.");
              break;
            case "p":
              {
                const [patch, bank, ...rest] = v.split("/");
                if (
                  !checkRange(patch, 0, 127) ||
                  (bank !== undefined && !checkRange(bank, 0, 127)) ||
                  rest.length
                ) {
                  warn(
                    valueSpan,
                    "Instrument should be `ⓘ` or `ⓘ/bank` where ⓘ is between 0 and 127.",
                  );
                }
              }
              break;
            case "q":
              if (!RE_DURATION.test(v))
                warn(
                  valueSpan,
                  `Invalid duration. Use one of ${DURATIONS.join(", ")} (optionally with a \`d\`/\`dd\` prefix or a \`t\` suffix), or \`Tⓘ\`.`,
                );
              break;
            case "s":
              if (!checkRange(v, 0, 127))
                warn(
                  valueSpan,
                  "Sustain pedal value should be an integer between 0 and 127.",
                );
              break;
            case "t":
              if (!/^-?\d+$/.test(v))
                warn(valueSpan, "Transpose should be an integer.");
              break;
            case "v":
              if (!checkRange(v, 1, 100))
                warn(
                  valueSpan,
                  "Volume should be an integer between 1 and 100.",
                );
              break;
            default:
              warn(t.keySpan ?? t, `Unknown local configuration: ${t.key}`);
          }
        }
        break;
      case "globalConfig":
        switch (t.key) {
          case "bpm":
            if (!(parseFloat(t.value!) > 0))
              warn(valueSpan, "BPM should be a positive number.");
            break;
          case "fermata":
            if (!(parseFloat(t.value!) > 0))
              warn(valueSpan, "Fermata length should be a positive number.");
            break;
          case "time-sig":
            if (!/^\d+\/\d+$/.test(t.value!))
              warn(valueSpan, "Time signature should be in the form `ⓘ/ⓘ`.");
            break;
          default:
            warn(t.keySpan ?? t, `Unknown global configuration: ${t.key}`);
        }
        break;
      case "channel":
        if (!checkRange(t.key!, 1, 16))
          warn(t.keySpan ?? t, "Channel should be between 1 and 16.");
        break;
      case "velocity":
        if (!checkRange(t.value!, 1, 100))
          warn(t, "Target volume should be between 1 and 100.");
        break;
      case "bendValue":
        {
          const n = parseFloat(t.value!);
          if (isNaN(n) || n < -1 || n > 1)
            warn(t, "Pitch bend value should be between -1 and 1.");
        }
        break;
    }
  }
  return R;
}

export function validate(
  document: TextDocument,
  analysis: Analysis,
): Diagnostic[] {
  const R = lint(document, analysis);

  if (analysis.masked.trim()) {
    try {
      Sorrygle.compile(analysis.text);
    } catch (e) {
      R.push(compilerDiagnostic(document, analysis, e));
    }
  }
  return R;
}
