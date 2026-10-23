import * as path from "path";
import { ExtensionContext } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

export async function activate(context: ExtensionContext): Promise<void> {
  const serverModule = context.asAbsolutePath(
    path.join("dist", "server", "server.js"),
  );
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: "sorrygle" }],
    synchronize: { configurationSection: "sorrygle" },
  };
  client = new LanguageClient(
    "sorrygle",
    "Sorrygle Language Server",
    serverOptions,
    clientOptions,
  );
  await client.start();
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
