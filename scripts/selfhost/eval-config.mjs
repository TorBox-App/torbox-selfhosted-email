// Evaluates infra/selfhost.config.ts the way `sst deploy` does — real config,
// real SST platform components, real @pulumi/aws — with only the Pulumi
// engine mocked (pulumi's official setMocks test API). No AWS, no credentials.
//
// The build replicates SST's run-phase bundling (sst/sst pkg/project/run.go +
// pkg/js/js.go, pinned to the sst version in package.json):
//   - provider imports come from SST's own .sst/provider-lock.json
//   - the aws/sst globals shim is prepended to files whose path lacks ".sst"
//     (SST's InjectGlobals rule — the reason the config filename must never
//     contain that substring)
//   - @pulumi/* stay external and resolve from .sst/platform/node_modules
//
// Modes:
//   node eval-config.mjs           — the config must evaluate: run() completes,
//                                    expected resources register, outputs exist
//   node eval-config.mjs negative  — self-test: the same config under a
//                                    ".sst"-containing filename MUST throw
//                                    "aws is not defined"; proves this harness
//                                    still detects the failure mode
//
// Requires `sst install` to have run first (the smoke job does).
import { copyFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const INFRA = join(REPO, "infra");
const PLATFORM = join(INFRA, ".sst", "platform");
const CONFIG = join(INFRA, "selfhost.config.ts");

const negative = process.argv[2] === "negative";

// Provider shim exactly as run.go builds it, from SST's own lock file
const lock = JSON.parse(
  readFileSync(join(INFRA, ".sst", "provider-lock.json"), "utf8")
);
const GLOBALS = [
  ...lock.map((e) => `import * as ${e.alias} from "${e.package}";`),
  `import * as sst from "${join(PLATFORM, "src/components")}";`,
].join("\n");

const APP = {
  name: "wraps-selfhost",
  stage: "evalsmoke",
  removal: "remove",
  protect: false,
  home: "aws",
  providers: { aws: { region: "us-east-1" } },
};
const CLI = {
  command: "deploy",
  dev: false,
  paths: {
    root: INFRA,
    work: join(INFRA, ".sst"),
    platform: PLATFORM,
    home: join(tmpdir(), "sst-eval-home"),
  },
  home: "aws",
  state: { version: {} },
};

// SST's own esbuild, installed into the platform by `sst install`
const esbuild = await import(
  join(PLATFORM, "node_modules/esbuild/lib/main.js")
);

let configPath = CONFIG;
if (negative) {
  // Same contents, filename containing ".sst" — must lose the globals shim
  configPath = join(tmpdir(), "negctl.sst.config.ts");
  copyFileSync(CONFIG, configPath);
}

const outfile = join(PLATFORM, `evalsmoke.${negative ? "neg" : "pos"}.mjs`);
await esbuild.build({
  stdin: {
    contents: `import { run } from "${join(PLATFORM, "src/auto/run.ts")}";\nimport mod from '${configPath}';\nexport { run, mod };`,
    resolveDir: INFRA,
    sourcefile: "eval.ts",
    loader: "ts",
  },
  bundle: true,
  outfile,
  format: "esm",
  platform: "node",
  logLevel: "error",
  external: [
    "@pulumi/*",
    "undici",
    "@pulumiverse/*",
    "@sst-provider/*",
    "@aws-sdk/*",
    "esbuild",
    "archiver",
    "glob",
    "vite",
    "dotenv",
  ],
  banner: {
    js: [
      `import { createRequire as topLevelCreateRequire } from 'module';`,
      "const require = topLevelCreateRequire(import.meta.url);",
      `import { fileURLToPath as topLevelFileUrlToPath, URL as topLevelURL } from "url"`,
      "const __filename = topLevelFileUrlToPath(import.meta.url)",
      `const __dirname = topLevelFileUrlToPath(new topLevelURL(".", import.meta.url))`,
    ].join("\n"),
  },
  inject: [join(PLATFORM, "src/shim/run.js")],
  define: {
    $app: JSON.stringify(APP),
    $cli: JSON.stringify(CLI),
    $dev: "false",
  },
  plugins: [
    {
      name: "InjectGlobals",
      setup(build) {
        build.onLoad({ filter: /\.(js|ts|jsx|tsx)$/ }, (args) => {
          let contents = readFileSync(args.path, "utf8");
          if (!args.path.includes(".sst")) {
            contents = `${GLOBALS}\n${contents}`;
          }
          return {
            contents,
            loader: args.path.endsWith(".js") ? "js" : "ts",
          };
        });
      },
    },
  ],
});

const pulumi = await import(
  join(PLATFORM, "node_modules/@pulumi/pulumi/index.js")
);
const registered = [];
pulumi.runtime.setMocks(
  {
    newResource: (args) => {
      registered.push(`${args.type}::${args.name}`);
      return {
        id: `${args.name}-id`,
        state: {
          ...args.inputs,
          arn: `arn:aws:mock:::${args.name}`,
          name: args.inputs?.name ?? args.name,
          url: `https://mock.invalid/${args.name}`,
        },
      };
    },
    call: (args) => ({ ...args.inputs, accountId: "123456789012", id: "mock" }),
  },
  APP.name,
  APP.stage,
  true
);

process.chdir(INFRA);
let outputs;
let thrown;
try {
  const bundle = await import(outfile);
  await pulumi.runtime.runInPulumiStack(async () => {
    outputs = await bundle.run(bundle.mod.run);
    return outputs;
  });
} catch (err) {
  thrown = err;
} finally {
  rmSync(outfile, { force: true });
  if (negative) rmSync(configPath, { force: true });
}

function fail(msg) {
  console.error(`EVAL-SMOKE FAIL: ${msg}`);
  process.exit(1);
}

if (negative) {
  // The harness must still be able to DETECT the missing-globals failure —
  // otherwise a future SST change could make the positive check meaningless.
  if (
    !(
      thrown instanceof ReferenceError &&
      /aws is not defined/.test(thrown.message)
    )
  ) {
    fail(
      `negative control expected "ReferenceError: aws is not defined" from a ".sst"-named config, got: ${thrown ?? "no error"}`
    );
  }
  console.log(
    'EVAL-SMOKE OK (negative control): ".sst"-named config correctly fails with ReferenceError'
  );
  // Pulumi's promise-leak detector hooks process exit and overrides the code;
  // dangling promises are expected under the mocked engine.
  process.removeAllListeners("exit");
  process.exit(0);
}

if (thrown) {
  fail(`config run() threw: ${thrown.stack ?? thrown}`);
}

const EXPECT_RESOURCES = [
  "aws:scheduler/scheduleGroup:ScheduleGroup::SelfhostSchedulerGroup",
  "sst:aws:Dynamo::SelfhostRateLimitTable",
  "sst:aws:Queue::SelfhostBatchQueue",
  "sst:aws:Queue::SelfhostWorkflowQueue",
  "sst:aws:Function::SelfhostApi",
  "sst:aws:Nextjs::SelfhostWeb",
];
for (const want of EXPECT_RESOURCES) {
  if (!registered.includes(want)) {
    fail(
      `expected resource not registered: ${want}\nregistered:\n  ${registered.join("\n  ")}`
    );
  }
}

const EXPECT_OUTPUTS = ["apiUrl", "webUrl", "schedulerGroupName"];
for (const key of EXPECT_OUTPUTS) {
  if (!(outputs && key in outputs)) {
    fail(
      `expected run() output missing: ${key} (got: ${Object.keys(outputs ?? {}).join(",")})`
    );
  }
}

console.log(
  `EVAL-SMOKE OK: run() evaluated with ${registered.length} resources registered, outputs: ${Object.keys(outputs).join(",")}`
);
// Exit explicitly: the mocked engine leaves dangling promises behind (normal
// for pulumi test harnesses), and pulumi's leak detector hooks process exit
// to override the code — disarm it; success is already determined.
process.removeAllListeners("exit");
process.exit(0);
