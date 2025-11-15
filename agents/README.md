# CareLink Agents

This folder will host the autonomous LLM-driven components described in `docs/architecture/carelink_agents.md`.

| Folder | Responsibility |
| --- | --- |
| `dialogue/` | Dialogue Orchestrator agent that mediates all user interactions. |
| `coach/` | Long-horizon Coach & Planning agent (subscribes to `coach.trigger.v1`, publishes plans). |
| `safety/` | Global Safety & Escalation agent. |
| `memory-nightly/` | Nighttime mode of the Memory Manager for summarization/compression. |

Each agent will eventually expose its own service entry point plus prompt assets and evaluation harnesses.
