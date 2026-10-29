import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { releaseNotesOutput } from "./release-notes.mjs";

function readOutput(value) {
  const lines = value.split("\n");
  const delimiter = lines.shift().replace("body<<", "");
  assert.equal(lines.at(-2), delimiter);
  return lines.slice(0, -2).join("\n");
}
test("keeps Thai release notes without requiring a trailing newline", () => {
  assert.equal(readOutput(releaseNotesOutput("อัปเดตบทเรียน\nพร้อมใช้งาน")), "อัปเดตบทเรียน\nพร้อมใช้งาน");
});
test("normalizes Windows newlines and treats the old delimiter as ordinary text", () => {
  assert.equal(readOutput(releaseNotesOutput("หัวข้อ\r\nEND_OF_NOTES\r\nจบ\r\n")), "หัวข้อ\nEND_OF_NOTES\nจบ");
});
test("writes a valid UTF-8 action output from a manual release note", () => {
  const directory = mkdtempSync(join(tmpdir(), "mimi-notes-"));
  try {
    const output = join(directory, "output.txt");
    const result = spawnSync(process.execPath, [".github/scripts/release-notes.mjs"], {
      env: { ...process.env, NOTES: "รุ่นใหม่ที่ไม่มีบรรทัดท้าย", GITHUB_OUTPUT: output }, encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readOutput(readFileSync(output, "utf8")), "รุ่นใหม่ที่ไม่มีบรรทัดท้าย");
  } finally { rmSync(join(directory, "output.txt"), { force: true }); rmdirSync(directory); }
});
