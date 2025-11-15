interface SafetyCommand {
  userId: string;
  turnId: string;
  prompt: string;
  reason?: string;
  escalation?: string;
}

const queue = new Map<string, SafetyCommand[]>();
const maxCommandsPerUser = 5;

export function enqueueSafetyCommand(command: SafetyCommand) {
  if (!queue.has(command.userId)) {
    queue.set(command.userId, []);
  }
  const list = queue.get(command.userId)!;
  list.push(command);
  if (list.length > maxCommandsPerUser) {
    list.shift();
  }
}

export function dequeueSafetyCommand(userId: string): SafetyCommand | undefined {
  const list = queue.get(userId);
  if (!list || !list.length) {
    return undefined;
  }
  return list.shift();
}
