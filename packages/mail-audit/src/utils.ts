export const VERSION = "1.0.1";

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printUsage(): void {
  console.log(`
  Usage: mail-audit <domain> [options]
         mail-audit spf <domain> [options]

  Commands:
    <domain>         Run full email deliverability audit
    spf <domain>     Analyze SPF record and lookup tree

  Options:
    --json           Output as JSON
    --quick          Fast mode (fewer checks)
    --verbose        Show all details
    --skip-blacklists  Skip blacklist checks
    --skip-tls       Skip mail server TLS checks
    --timeout <ms>   DNS timeout in milliseconds
    -h, --help       Show this help
    -v, --version    Show version

  Examples:
    npx mail-audit example.com
    npx mail-audit example.com --json
    npx mail-audit spf example.com
`);
}

export function createSpinner() {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    start(msg: string) {
      process.stdout.write(`\r${frames[0]} ${msg}`);
      timer = setInterval(() => {
        i = (i + 1) % frames.length;
        process.stdout.write(`\r${frames[i]} ${msg}`);
      }, 80);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      process.stdout.write(`\r${" ".repeat(80)}\r`);
    },
  };
}
