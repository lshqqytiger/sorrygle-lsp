import {
  CompletionItem,
  CompletionItemKind,
  createConnection,
  DocumentHighlight,
  DocumentHighlightKind,
  DocumentSymbol,
  FoldingRange,
  Hover,
  InsertTextFormat,
  Location,
  MarkupKind,
  ProposedFeatures,
  Range,
  SymbolKind,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  DEFAULT_EMOJIS,
  DIACRITICS,
  DURATIONS,
  GLOBAL_CONFIGS,
  GM_INSTRUMENTS,
  KEY_NAMES,
  LOCAL_CONFIGS,
  RANGE_TYPES,
  TOKEN_DOCS,
} from "./docs";
import { validate } from "./diagnostics";
import {
  analyze,
  Analysis,
  findDeclaration,
  findReferences,
  isDeclaration,
  Span,
  Token,
  tokenAt,
} from "./scanner";

const VALIDATION_DELAY = 300;
const SNIPPET_LIMIT = 400;

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const cache = new Map<string, { version: number; analysis: Analysis }>();
const timers = new Map<string, NodeJS.Timeout>();
let diagnosticsEnabled = true;

function getAnalysis(document: TextDocument): Analysis {
  const cached = cache.get(document.uri);
  if (cached?.version === document.version) return cached.analysis;
  const analysis = analyze(document.getText());
  cache.set(document.uri, { version: document.version, analysis });
  return analysis;
}

function toRange(document: TextDocument, span: Span): Range {
  return {
    start: document.positionAt(span.start),
    end: document.positionAt(span.end),
  };
}

function scheduleValidation(document: TextDocument): void {
  clearTimeout(timers.get(document.uri));
  timers.set(
    document.uri,
    setTimeout(() => {
      timers.delete(document.uri);
      const current = documents.get(document.uri);
      if (!current) return;
      const diagnostics = diagnosticsEnabled
        ? validate(current, getAnalysis(current))
        : [];
      connection.sendDiagnostics({
        uri: current.uri,
        version: current.version,
        diagnostics,
      });
    }, VALIDATION_DELAY),
  );
}

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    completionProvider: { triggerCharacters: ["(", "{", "=", "#", "~", "<"] },
    hoverProvider: true,
    definitionProvider: true,
    referencesProvider: true,
    documentHighlightProvider: true,
    documentSymbolProvider: true,
    foldingRangeProvider: true,
  },
}));

connection.onInitialized(() => {
  void refreshConfiguration();
});

connection.onDidChangeConfiguration(() => {
  void refreshConfiguration();
});

async function refreshConfiguration(): Promise<void> {
  try {
    const config = await connection.workspace.getConfiguration("sorrygle");
    diagnosticsEnabled = config?.diagnostics?.enable !== false;
  } catch {
    diagnosticsEnabled = true;
  }
  documents.all().forEach(scheduleValidation);
}

documents.onDidChangeContent((e) => scheduleValidation(e.document));
documents.onDidClose((e) => {
  clearTimeout(timers.get(e.document.uri));
  timers.delete(e.document.uri);
  cache.delete(e.document.uri);
  connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

// ---- Hover ----

/** Source extent of a declaration, including its body. */
function declarationExtent(analysis: Analysis, decl: Token): Span {
  if (decl.kind === "udrDef") {
    const body = analysis.tokens[analysis.tokens.indexOf(decl) + 1];
    if (body?.kind === "blockOpen" && body.closeEnd !== undefined)
      return { start: decl.start, end: body.closeEnd };
  }
  return { start: decl.start, end: decl.closeEnd ?? decl.end };
}

function snippet(analysis: Analysis, decl: Token): string {
  const extent = declarationExtent(analysis, decl);
  let code = analysis.text.slice(extent.start, extent.end);
  if (code.length > SNIPPET_LIMIT) code = code.slice(0, SNIPPET_LIMIT) + " ...";
  return "```sorrygle\n" + code + "\n```";
}

function count(text: string | undefined, c: string): number {
  return text ? text.split(c).length - 1 : 0;
}

function describeNote(token: Token): string {
  if (token.key === "x") {
    return "**UDR placeholder** `x` — replaced by each note of the range the user-defined range is applied to.";
  }
  const parts = [`**Note** ${KEY_NAMES[token.key!] ?? token.key}`];
  const octave = count(token.prefix, "^") - count(token.prefix, "v");
  const semitone = count(token.suffix, "+") - count(token.suffix, "-");
  if (octave) parts.push(`octave ${octave > 0 ? "+" : ""}${octave}`);
  if (semitone)
    parts.push(
      `${semitone > 0 ? "+" : ""}${semitone} semitone${Math.abs(semitone) > 1 ? "s" : ""}`,
    );
  return parts.join(" · ");
}

function describeConfig(
  token: Token,
  table: typeof LOCAL_CONFIGS,
  kind: string,
): string {
  const info = table[token.key!];
  if (!info) return `**Unknown ${kind}** \`${token.key}\``;
  let R = `**${info.label}** \`${token.text}\`\n\n${info.description}\n\nDefault: \`${info.defaultValue}\``;
  if (table === LOCAL_CONFIGS && token.key === "p") {
    const [patch, bank] = token.value!.split("/");
    const name = GM_INSTRUMENTS[parseInt(patch, 10)];
    if (name)
      R += `\n\nInstrument: **${name}** (PC# ${parseInt(patch, 10) + 1}${bank ? `, bank ${bank}` : ""})`;
  }
  return R;
}

function describe(analysis: Analysis, token: Token): string | undefined {
  switch (token.kind) {
    case "note":
      return describeNote(token);
    case "localConfig":
      return describeConfig(token, LOCAL_CONFIGS, "local configuration");
    case "globalConfig":
      return describeConfig(token, GLOBAL_CONFIGS, "global configuration");
    case "emojiDecl":
      return `**Emoji declaration** ${token.key} → \`${token.inner!.text}\``;
    case "emojiRef": {
      const decl = findDeclaration(analysis, token);
      const expansion = decl?.inner?.text ?? DEFAULT_EMOJIS[token.key!];
      return expansion
        ? `**Emoji reference** ${token.key} → \`${expansion}\`${decl ? "" : " (default)"}`
        : `**Unknown emoji** ${token.key}`;
    }
    case "channel":
      return token.continued
        ? `**Channel continuation** \`#~${token.key}\` — continue the previous \`#${token.key}\`.`
        : `**Channel declaration** \`#${token.key}\` — following input goes to MIDI channel ${token.key}.`;
    case "groupDecl":
      return `**Group declaration** \`{${token.key} ...}\` — reference it with \`{=${token.key}}\`.`;
    case "udrDef":
      return `**User-defined range** \`{{${token.key}}}\` — apply it with \`{{${token.key}}}(...)\`.`;
    case "groupRef":
    case "udrRef": {
      const decl = findDeclaration(analysis, token);
      const label =
        token.kind === "groupRef"
          ? `**Group reference** \`{=${token.key}}\``
          : `**User-defined range** \`{{${token.key}}}\``;
      return decl
        ? `${label}\n\n${snippet(analysis, decl)}`
        : `${label} — not declared.`;
    }
    case "rangeOpen": {
      if (token.udr) return `**User-defined range** \`{{${token.key}}}(...)\``;
      const info = RANGE_TYPES[token.key!];
      return info
        ? `**${info.label}** \`(${token.key}...)\`\n\n${info.description}`
        : undefined;
    }
    case "diacriticOpen": {
      const info = DIACRITICS[token.key!];
      return info
        ? `**${info.label}** \`<${token.key}...>\`\n\n${info.description}`
        : undefined;
    }
    case "repeatClose": {
      const n = token.value ? parseInt(token.value, 10) : 1;
      return `**Close repeat** — repeat the closed interval ${n} time${n > 1 ? "s" : ""}.`;
    }
    case "volta":
      return token.key === "1"
        ? "**Prima volta** — play the following notes only the first time."
        : "**Seconda volta** — play the following notes after one repetition, skipping the prima volta.";
  }
  return TOKEN_DOCS[token.kind];
}

connection.onHover(({ textDocument, position }): Hover | null => {
  const document = documents.get(textDocument.uri);
  if (!document) return null;
  const analysis = getAnalysis(document);
  const token = tokenAt(analysis, document.offsetAt(position));
  const value = token && describe(analysis, token);
  if (!token || !value) return null;
  return {
    contents: { kind: MarkupKind.Markdown, value },
    range: toRange(document, token),
  };
});

// ---- Completion ----

function uniqueKeys(
  analysis: Analysis,
  predicate: (t: Token) => boolean,
): string[] {
  return [...new Set(analysis.tokens.filter(predicate).map((t) => t.key!))];
}

connection.onCompletion(({ textDocument, position }): CompletionItem[] => {
  const document = documents.get(textDocument.uri);
  if (!document) return [];
  const analysis = getAnalysis(document);
  const offset = document.offsetAt(position);
  const linePrefix = analysis.masked.slice(
    document.offsetAt({ line: position.line, character: 0 }),
    offset,
  );
  const replace = (typed: string): Range => ({
    start: document.positionAt(offset - typed.length),
    end: position,
  });
  const item = (
    label: string,
    typed: string,
    kind: CompletionItemKind,
    extra: Partial<CompletionItem> = {},
  ): CompletionItem => ({
    label,
    kind,
    textEdit: { range: replace(typed), newText: extra.insertText ?? label },
    ...extra,
  });
  let m: RegExpExecArray | null;

  if ((m = /\(\(([\w.\/\-]*)$/.exec(linePrefix))) {
    return Object.entries(GLOBAL_CONFIGS).map(([key, info]) =>
      item(key, m![1], CompletionItemKind.Property, {
        detail: info.label,
        documentation: info.description,
        insertText: `${key}=\${1:${info.defaultValue}}`,
        insertTextFormat: InsertTextFormat.Snippet,
      }),
    );
  }
  if ((m = /\(p=([^()=]*)$/.exec(linePrefix))) {
    return GM_INSTRUMENTS.map((name, i) =>
      item(String(i), m![1], CompletionItemKind.EnumMember, {
        detail: name,
        filterText: `${i} ${name}`,
        sortText: String(i).padStart(3, "0"),
      }),
    );
  }
  if ((m = /\(q=(\w*)$/.exec(linePrefix))) {
    return DURATIONS.flatMap((d) => [d, `${d}t`, `d${d}`]).map((d, i) =>
      item(d, m![1], CompletionItemKind.Value, {
        detail: d.endsWith("t")
          ? "Triplet"
          : d.startsWith("d")
            ? "Dotted"
            : `1/${d} note`,
        sortText: String(i).padStart(3, "0"),
      }),
    );
  }
  if ((m = /\(o=(\d*)$/.exec(linePrefix))) {
    return Array.from({ length: 9 }, (_, i) =>
      item(String(i), m![1], CompletionItemKind.Value, {
        detail: `Octave ${i}`,
      }),
    );
  }
  if ((m = /\{=(\d*)$/.exec(linePrefix))) {
    return uniqueKeys(analysis, (t) => t.kind === "groupDecl").map((key) =>
      item(key, m![1], CompletionItemKind.Reference, { detail: "Group" }),
    );
  }
  if ((m = /\{\{([\w.\/\-]*)$/.exec(linePrefix))) {
    return uniqueKeys(analysis, (t) => t.kind === "udrDef").map((key) =>
      item(key, m![1], CompletionItemKind.Function, {
        detail: "User-defined range",
      }),
    );
  }
  if ((m = /#~(\d*)$/.exec(linePrefix))) {
    return uniqueKeys(
      analysis,
      (t) => t.kind === "channel" && !t.continued,
    ).map((key) =>
      item(key, m![1], CompletionItemKind.Module, {
        detail: `Continue channel ${key}`,
      }),
    );
  }
  if ((m = /#(\d*)$/.exec(linePrefix))) {
    return Array.from({ length: 16 }, (_, i) =>
      item(String(i + 1), m![1], CompletionItemKind.Module, {
        detail: `Channel ${i + 1}`,
        sortText: String(i).padStart(2, "0"),
      }),
    );
  }
  if (/<$/.test(linePrefix)) {
    return Object.entries(DIACRITICS).map(([key, info]) =>
      item(`<${key}`, "", CompletionItemKind.Operator, {
        detail: info.label,
        documentation: info.description,
        filterText: key,
        insertText: info.snippet,
        insertTextFormat: InsertTextFormat.Snippet,
      }),
    );
  }
  if ((m = /\(([\w.\/\-]*)$/.exec(linePrefix))) {
    const typed = m[1];
    const declaredEmojis = uniqueKeys(analysis, (t) => t.kind === "emojiDecl");
    return [
      ...Object.entries(LOCAL_CONFIGS).map(([key, info]) =>
        item(`${key}=`, typed, CompletionItemKind.Property, {
          detail: info.label,
          documentation: info.description,
          insertText: `${key}=\${1:${info.defaultValue}}`,
          insertTextFormat: InsertTextFormat.Snippet,
        }),
      ),
      ...(typed
        ? []
        : Object.entries(RANGE_TYPES).map(([key, info]) =>
            item(key, typed, CompletionItemKind.Keyword, {
              detail: info.label,
              documentation: info.description,
            }),
          )),
      ...(typed
        ? []
        : [...new Set([...declaredEmojis, ...Object.keys(DEFAULT_EMOJIS)])].map(
            (key) =>
              item(key, typed, CompletionItemKind.Constant, {
                detail: declaredEmojis.includes(key)
                  ? "Emoji (declared)"
                  : `Emoji → ${DEFAULT_EMOJIS[key]}`,
              }),
          )),
    ];
  }
  return [];
});

// ---- Navigation ----

function symbolRange(document: TextDocument, token: Token): Range {
  return toRange(document, token.keySpan ?? token);
}

connection.onDefinition(({ textDocument, position }): Location | null => {
  const document = documents.get(textDocument.uri);
  if (!document) return null;
  const analysis = getAnalysis(document);
  const token = tokenAt(analysis, document.offsetAt(position));
  const decl = token && findDeclaration(analysis, token);
  return decl
    ? Location.create(document.uri, symbolRange(document, decl))
    : null;
});

connection.onReferences(({ textDocument, position, context }): Location[] => {
  const document = documents.get(textDocument.uri);
  if (!document) return [];
  const analysis = getAnalysis(document);
  const token = tokenAt(analysis, document.offsetAt(position));
  if (!token) return [];
  return findReferences(analysis, token)
    .filter((t) => context.includeDeclaration || !isDeclaration(t))
    .map((t) => Location.create(document.uri, symbolRange(document, t)));
});

connection.onDocumentHighlight(
  ({ textDocument, position }): DocumentHighlight[] => {
    const document = documents.get(textDocument.uri);
    if (!document) return [];
    const analysis = getAnalysis(document);
    const token = tokenAt(analysis, document.offsetAt(position));
    if (!token) return [];
    return findReferences(analysis, token).map((t) =>
      DocumentHighlight.create(
        symbolRange(document, t),
        isDeclaration(t)
          ? DocumentHighlightKind.Write
          : DocumentHighlightKind.Read,
      ),
    );
  },
);

// ---- Document structure ----

connection.onDocumentSymbol(({ textDocument }): DocumentSymbol[] => {
  const document = documents.get(textDocument.uri);
  if (!document) return [];
  const analysis = getAnalysis(document);
  const { tokens, text } = analysis;
  const channels = tokens.filter((t) => t.kind === "channel");
  const flat: { span: Span; symbol: DocumentSymbol }[] = [];
  const add = (
    span: Span,
    selection: Span,
    name: string,
    kind: SymbolKind,
    detail?: string,
  ): void => {
    flat.push({
      span,
      symbol: {
        name,
        kind,
        detail,
        range: toRange(document, span),
        selectionRange: toRange(document, selection),
        children: [],
      },
    });
  };

  for (const t of tokens) {
    switch (t.kind) {
      case "globalConfig":
        add(t, t, `((${t.key}))`, SymbolKind.Property, t.value);
        break;
      case "emojiDecl":
        add(t, t.keySpan ?? t, t.key!, SymbolKind.Constant, t.inner?.text);
        break;
      case "udrDef":
        add(
          declarationExtent(analysis, t),
          t,
          `{{${t.key}}}`,
          SymbolKind.Function,
          "User-defined range",
        );
        break;
      case "groupDecl":
        add(
          declarationExtent(analysis, t),
          t,
          `{${t.key}}`,
          SymbolKind.Object,
          "Group",
        );
        break;
      case "channel":
        {
          const next = channels[channels.indexOf(t) + 1];
          const end = next ? next.start : text.length;
          add(
            {
              start: t.start,
              end: t.start + text.slice(t.start, end).trimEnd().length,
            },
            t,
            t.continued ? `#~${t.key}` : `#${t.key}`,
            SymbolKind.Namespace,
            t.continued ? "Channel continuation" : "Channel",
          );
        }
        break;
    }
  }
  // Nest symbols by containment; `flat` is already ordered by start offset.
  const roots: DocumentSymbol[] = [];
  const stack: typeof flat = [];
  for (const entry of flat) {
    while (stack.length && stack[stack.length - 1].span.end < entry.span.end)
      stack.pop();
    const parent = stack[stack.length - 1];
    (parent ? parent.symbol.children! : roots).push(entry.symbol);
    stack.push(entry);
  }
  return roots;
});

connection.onFoldingRanges(({ textDocument }): FoldingRange[] => {
  const document = documents.get(textDocument.uri);
  if (!document) return [];
  const R: FoldingRange[] = [];
  for (const t of getAnalysis(document).tokens) {
    if (t.closeEnd === undefined) continue;
    const startLine = document.positionAt(t.start).line;
    const endLine = document.positionAt(t.closeEnd - 1).line;
    if (endLine > startLine) R.push({ startLine, endLine });
  }
  return R;
});

documents.listen(connection);
connection.listen();
