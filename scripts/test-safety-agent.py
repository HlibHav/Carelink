import asyncio
import json
import os
import signal
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

services = []

async def start_service(cmd, cwd):
    proc = await asyncio.create_subprocess_exec(*cmd, cwd=cwd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    services.append(proc)
    return proc

async def run_test():
    event_bus = await start_service(["npm", "run", "dev"], ROOT / "services" / "event-bus")
    memory = await start_service(["npm", "run", "dev"], ROOT / "services" / "memory-manager")
    scheduling = await start_service(["npm", "run", "dev"], ROOT / "services" / "scheduling")
    safety = await start_service(["npm", "run", "dev"], ROOT / "agents" / "safety")

    await asyncio.sleep(5)

    # publish a safety trigger
    import aiohttp
    async with aiohttp.ClientSession() as session:
        payload = {
            "topic": "safety.trigger.v1",
            "event": {
                "user_id": "user_demo",
                "turn_id": "turn_1",
                "reason": "fall_detected",
                "physical_summary": "Fall detected in bathroom",
            },
        }
        async with session.post("http://localhost:4300/events", json=payload) as resp:
            print("published", resp.status)

    await asyncio.sleep(5)

    for proc in services:
        proc.send_signal(signal.SIGINT)
        await proc.wait()

asyncio.run(run_test())
