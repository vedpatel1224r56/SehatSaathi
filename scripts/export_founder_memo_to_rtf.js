const fs = require("fs");

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error("Usage: node export_founder_memo_to_rtf.js <input.md> <output.rtf>");
  process.exit(1);
}

let text = fs.readFileSync(input, "utf8");
text = text
  .replace(/\\/g, "\\\\")
  .replace(/[{}]/g, (match) => `\\${match}`)
  .replace(/\t/g, "    ");

const lines = text.split(/\r?\n/);

let rtf = "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Helvetica;}{\\f1 Courier;}}\\fs24\n";

for (const line of lines) {
  if (/^# /.test(line)) {
    rtf += `\\b\\fs36 ${line.replace(/^# /, "")}\\b0\\fs24\\par\n`;
    continue;
  }
  if (/^## /.test(line)) {
    rtf += `\\b\\fs30 ${line.replace(/^## /, "")}\\b0\\fs24\\par\n`;
    continue;
  }
  if (/^### /.test(line)) {
    rtf += `\\b\\fs26 ${line.replace(/^### /, "")}\\b0\\fs24\\par\n`;
    continue;
  }
  if (/^---+$/.test(line.trim())) {
    rtf += "\\par_______________________________________________________________\\par\n";
    continue;
  }
  if (/^\|/.test(line)) {
    rtf += `\\f1 ${line}\\f0\\par\n`;
    continue;
  }
  if (/^[-*] /.test(line)) {
    rtf += `\\tab\\bullet\\tab ${line.replace(/^[-*] /, "")}\\par\n`;
    continue;
  }
  if (/^\d+\. /.test(line)) {
    const number = line.match(/^\d+\./)[0];
    rtf += `\\b ${number}\\b0 ${line.replace(/^\d+\. /, "")}\\par\n`;
    continue;
  }
  rtf += `${line}\\par\n`;
}

rtf += "}";
fs.writeFileSync(output, rtf);
