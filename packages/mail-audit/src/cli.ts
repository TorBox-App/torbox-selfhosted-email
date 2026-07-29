import pc from "picocolors";
import { runCheck } from "./commands/check.js";
import { runSpfCheck } from "./commands/spf.js";
import { parseArgs } from "./parse-args.js";
import { printUsage, VERSION } from "./utils.js";

const args = parseArgs(process.argv);

function domainError(usage: string): never {
  if (args.invalidDomain) {
    console.log(pc.red(`Error: invalid domain "${args.invalidDomain}"`));
  } else {
    console.log(pc.red("Error: domain is required"));
  }
  console.log(pc.dim(usage));
  process.exit(1);
}

switch (args.command) {
  case "help":
    printUsage();
    process.exit(0);
    break;

  case "version":
    console.log(`mail-audit v${VERSION}`);
    process.exit(0);
    break;

  case "spf": {
    if (!args.domain) {
      domainError("Usage: mail-audit spf <domain>");
    }
    await runSpfCheck(args.domain, args.flags);
    break;
  }

  case "check": {
    if (!args.domain) {
      domainError("Usage: mail-audit <domain>");
    }
    await runCheck(args.domain, args.flags);
    break;
  }
}
