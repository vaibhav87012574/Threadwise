import time
import tracemalloc
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai_agent import run_agent, stream_agent

BENCHMARK_RESULTS = []

def benchmark_run_agent():
    user_input = "Find me a blue shirt"
    thread_id = "benchmark_thread"
    start_time = time.time()
    tracemalloc.start()
    try:
        result = run_agent(user_input, thread_id)
    except Exception as e:
        result = str(e)
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    elapsed = time.time() - start_time
    BENCHMARK_RESULTS.append(f"run_agent: {elapsed:.4f}s, memory: {peak/1024:.2f} KB, result: {str(result)[:50]}")

def benchmark_stream_agent():
    user_input = "Find me a blue shirt"
    thread_id = "benchmark_thread"
    start_time = time.time()
    tracemalloc.start()
    try:
        stream = stream_agent(user_input, thread_id)
        # If stream is a generator, consume it
        if hasattr(stream, '__iter__') and not isinstance(stream, str):
            for _ in stream:
                pass
    except Exception as e:
        stream = str(e)
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    elapsed = time.time() - start_time
    BENCHMARK_RESULTS.append(f"stream_agent: {elapsed:.4f}s, memory: {peak/1024:.2f} KB, result: {str(stream)[:50]}")

def save_results():
    with open(os.path.join(os.path.dirname(__file__), "BENCHMARK_STATS.md"), "w") as f:
        f.write("# AI Agent Benchmark Results\n\n")
        for line in BENCHMARK_RESULTS:
            f.write(line + "\n")

if __name__ == "__main__":
    benchmark_run_agent()
    benchmark_stream_agent()
    save_results() 