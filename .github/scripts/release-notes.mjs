import { randomUUID } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function releaseNotesOutput(notes) {
  const delimiter = `NOTES_${randomUUID().replaceAll("-", "")}`;
  const body = notes.replace(/\r\n?/g, "\n");
  return `body<<${delimiter}\n${body}${body.endsWith("\n") ? "" : "\n"}${delimiter}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const notes = process.env.NOTES || readFileSync(".github/release-notes.md", "utf8");
  appendFileSync(process.env.GITHUB_OUTPUT, releaseNotesOutput(notes), "utf8");
}
