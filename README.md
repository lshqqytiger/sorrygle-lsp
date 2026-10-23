# sorrygle-lsp

Language Server Protocol implementation for [Sorrygle](https://github.com/JJoriping/Sorrygle), a text-based MIDI writing language.

The package's `main` entry is the language server executable. It implements document synchronization, diagnostics, completion, hover, definitions, references, highlights, document symbols, and folding ranges. It communicates using the transport selected by `vscode-languageserver` (stdio or Node IPC), so it can be started by an LSP client such as [sorrygle-lsp-vscode](https://github.com/lshqqytiger/sorrygle-lsp-vscode).

## Development

Requires Node.js and pnpm.

```sh
pnpm install
pnpm run build
```

The build output is `dist/server.js`. To prepare an npm tarball locally:

```sh
pnpm pack
```

The package includes the compiled language server and its runtime dependencies. The VS Code client and editor-specific syntax configuration live in the separate [`sorrygle-lsp-vscode`](https://github.com/lshqqytiger/sorrygle-lsp-vscode) repository.

## License

[MIT No Attribution](LICENSE)
