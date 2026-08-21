import type {
  CapabilityAgentPipelineSettledEvent,
  CapabilityAgentPipelineSettledHandler,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";

type Cleanup = () => void;

const agentPipelineSettledHandlers = new Set<CapabilityAgentPipelineSettledHandler>();

export function registerCapabilityAgentPipelineSettledHandler(
  handler: CapabilityAgentPipelineSettledHandler,
): Cleanup {
  agentPipelineSettledHandlers.add(handler);
  return () => {
    agentPipelineSettledHandlers.delete(handler);
  };
}

export async function dispatchCapabilityAgentPipelineSettled(
  event: CapabilityAgentPipelineSettledEvent,
): Promise<void> {
  const outcomes = await Promise.allSettled(
    [...agentPipelineSettledHandlers].map((handler) => handler(event)),
  );
  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      logger.warn(outcome.reason, "[capability] agent pipeline settled handler failed");
    }
  }
}

export function resetCapabilityAgentPipelineSettledHandlers(): void {
  agentPipelineSettledHandlers.clear();
}
