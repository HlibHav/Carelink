"""
Quick LangChain + Phoenix tracing demo using OTLP HTTP exporter (local Phoenix).

Usage:
  source .venv-phoenix39/bin/activate
  export OPENAI_API_KEY=sk-...
  export PHOENIX_ENDPOINT=http://localhost:6006       # optional; default is localhost
  export PHOENIX_PROJECT_NAME=carelink-demo           # optional; default is "carelink-demo"
  python scripts/phoenix_langchain_demo.py
"""

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from openinference.instrumentation.langchain import LangChainInstrumentor
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor


def main() -> None:
  project_name = project = "carelink-demo"
  endpoint_url = "http://localhost:6006"
  otlp_traces_url = f"{endpoint_url}/v1/traces"

  resource = Resource.create(
    {
      "service.name": project_name,
      "service.namespace": "carelink",
    }
  )
  provider = TracerProvider(resource=resource)
  processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_traces_url))
  provider.add_span_processor(processor)
  trace.set_tracer_provider(provider)

  LangChainInstrumentor().instrument()

  prompt = ChatPromptTemplate.from_template("{x} {y} {z}?").partial(
    x="why is",
    z="blue",
  )
  chain = prompt | ChatOpenAI(model_name="gpt-4o-mini")

  resp = chain.invoke({"y": "the sky"})
  print("Response:", resp)


if __name__ == "__main__":
  main()
