"""
Voice-enabled LangChain agent that renders ElevenLabs audio for every response.

Usage:
    python voice_agent.py "Привіт! Як минув твій день?"
"""

from __future__ import annotations

import argparse
import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
import base64
import certifi
import websockets
import ssl
import json
from elevenlabs import ElevenLabs
from langchain.agents import AgentExecutor, AgentType, initialize_agent
from langchain.tools import BaseTool, tool
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field, ConfigDict


class VoiceOutput(BaseModel):
  """Schema describing the text that should be converted to speech."""

  text: str = Field(..., description="Текст для перетворення у голос")


async def stream_text_to_speech(text: str, voice_id: str, api_key: str, *, model_id: str) -> bytes:
  """Streams ElevenLabs TTS via WebSocket and returns concatenated PCM/MP3 bytes."""

  uri = f"wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id={model_id}"
  audio_chunks: list[bytes] = []

  ssl_context = ssl.create_default_context()
  ssl_context.load_verify_locations(certifi.where())

  async with websockets.connect(uri, ssl=ssl_context) as websocket:
    init_frame = {
      "text": " ",
      "voice_settings": {"stability": 0.5, "similarity_boost": 0.8},
      "xi_api_key": api_key,
    }
    await websocket.send(json.dumps(init_frame))

    await websocket.send(json.dumps({"text": text}))
    await websocket.send(json.dumps({"text": ""}))

    while True:
      try:
        message = await websocket.recv()
        data = json.loads(message)
        if audio := data.get("audio"):
          audio_chunks.append(base64.b64decode(audio))
        if data.get("isFinal"):
          break
      except websockets.exceptions.ConnectionClosed:
        break

  return b"".join(audio_chunks)


@tool
def gratitude_context(topic: str) -> str:
  """Toy retrieval tool to mimic CareLink memory lookup."""

  responses = {
    "loneliness": "Згадаймо, як ти радів прогулянкам з Сарою по парку о 15:00.",
    "sleep": "Ти казав, що 10-хвилинна медитація перед сном заспокоює.",
  }
  return responses.get(topic.lower(), "Попроси користувача описати більше деталей.")


@dataclass
class VoiceEnabledAgent:
  agent: AgentExecutor
  voice_id: str
  eleven_model_id: str
  api_key: str

  async def process_with_voice(self, user_input: str) -> dict[str, Any]:
    text_response = await self.agent.arun(user_input)
    if isinstance(text_response, dict) and "output" in text_response:
      text_response = str(text_response["output"])
    audio_bytes = await stream_text_to_speech(
      text_response, self.voice_id, self.api_key, model_id=self.eleven_model_id
    )
    audio_base64 = base64.b64encode(audio_bytes).decode("ascii")
    return {
      "text": text_response,
      "audio_bytes": audio_bytes,
      "audio_base64": audio_base64,
      "mime_type": "audio/mpeg",
      "tool_metadata": {"voice_id": self.voice_id, "model_id": self.eleven_model_id},
    }


def build_agent(
  llm: Optional[ChatOpenAI] = None,
  additional_tools: Optional[list[BaseTool]] = None,
) -> AgentExecutor:
  llm = llm or ChatOpenAI(model="gpt-4o-mini", temperature=0.4)
  tools = additional_tools or []
  tools.append(gratitude_context)
  return initialize_agent(
    tools=tools,
    llm=llm,
    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    handle_parsing_errors=True,
    verbose=True,
  )


def ensure_env(var: str) -> str:
  value = os.getenv(var)
  if not value:
    raise RuntimeError(f"Environment variable {var} is required.")
  return value


async def main() -> None:
  parser = argparse.ArgumentParser(description="LangChain + ElevenLabs voice agent demo")
  parser.add_argument(
    "prompt",
    nargs="?",
    default=os.getenv("DEFAULT_PROMPT", "Привіт! Як минув твій день?"),
    help="User utterance to feed into the agent.",
  )
  parser.add_argument(
    "--out",
    default="output/last_response.mp3",
    help="Path to store the generated audio.",
  )
  args = parser.parse_args()

  load_dotenv()

  agent = build_agent()
  voice_agent = VoiceEnabledAgent(
    agent=agent,
    voice_id=ensure_env("ELEVENLABS_VOICE_ID"),
    eleven_model_id=ensure_env("ELEVENLABS_MODEL_ID"),
    api_key=ensure_env("ELEVENLABS_API_KEY"),
  )

  print("💬  User:", args.prompt)
  result = await voice_agent.process_with_voice(args.prompt)
  print("🧠  Agent reply:", result["text"])

  output_path = Path(args.out)
  output_path.parent.mkdir(parents=True, exist_ok=True)
  output_path.write_bytes(result["audio_bytes"])
  print(f"🔊  Saved audio to {output_path} ({result['mime_type']})")


if __name__ == "__main__":
  try:
    asyncio.run(main())
  except KeyboardInterrupt:
    print("Interrupted by user.")
