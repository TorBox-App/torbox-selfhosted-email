import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
  StartLiveTailCommand,
} from "@aws-sdk/client-cloudwatch-logs";

export type LogGroup = {
  name: string;
  arn: string;
  storedBytes: number;
  retentionDays: number | null;
};

export type LogEntry = {
  timestamp: number;
  message: string;
  logStream: string;
  logGroup: string;
};

const WRAPS_LOG_PREFIX = "/aws/lambda/wraps-";

export async function discoverLogGroups(region: string): Promise<LogGroup[]> {
  const client = new CloudWatchLogsClient({ region });
  const groups: LogGroup[] = [];
  let nextToken: string | undefined;

  do {
    const result = await client.send(
      new DescribeLogGroupsCommand({
        logGroupNamePrefix: WRAPS_LOG_PREFIX,
        nextToken,
      })
    );

    for (const group of result.logGroups ?? []) {
      if (group.logGroupName && group.arn) {
        groups.push({
          name: group.logGroupName,
          arn: group.arn,
          storedBytes: group.storedBytes ?? 0,
          retentionDays: group.retentionInDays ?? null,
        });
      }
    }

    nextToken = result.nextToken;
  } while (nextToken);

  return groups;
}

export type LiveTailSession = {
  stream: AsyncIterable<LogEntry[]>;
  abort: () => void;
};

export function startLiveTail(
  region: string,
  logGroupIdentifiers: string[],
  filterPattern?: string
): LiveTailSession {
  const client = new CloudWatchLogsClient({ region });
  const abortController = new AbortController();

  const stream = (async function* () {
    const response = await client.send(
      new StartLiveTailCommand({
        logGroupIdentifiers,
        logEventFilterPattern: filterPattern ?? "",
      }),
      { abortSignal: abortController.signal }
    );

    if (!response.responseStream) {
      return;
    }

    for await (const event of response.responseStream) {
      if (event.sessionUpdate?.sessionResults) {
        const entries: LogEntry[] = event.sessionUpdate.sessionResults.map(
          (e) => ({
            timestamp: e.timestamp ?? Date.now(),
            message: (e.message ?? "").trimEnd(),
            logStream: e.logStreamName ?? "",
            logGroup: e.logGroupIdentifier ?? "",
          })
        );
        if (entries.length > 0) {
          yield entries;
        }
      }
    }
  })();

  return {
    stream,
    abort: () => abortController.abort(),
  };
}

export async function fetchRecentLogs(
  region: string,
  logGroupName: string,
  startTime: number,
  filterPattern?: string
): Promise<LogEntry[]> {
  const client = new CloudWatchLogsClient({ region });
  const entries: LogEntry[] = [];
  let nextToken: string | undefined;

  do {
    const result = await client.send(
      new FilterLogEventsCommand({
        logGroupName,
        startTime,
        filterPattern,
        nextToken,
        limit: 200,
      })
    );

    for (const event of result.events ?? []) {
      entries.push({
        timestamp: event.timestamp ?? Date.now(),
        message: (event.message ?? "").trimEnd(),
        logStream: event.logStreamName ?? "",
        logGroup: logGroupName,
      });
    }

    nextToken = result.nextToken;
  } while (nextToken && entries.length < 500);

  return entries;
}
