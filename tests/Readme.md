

### ✅ AI Agent Testing & Benchmarking Highlights

* 🧪 **Comprehensive Unit Tests**: Covered core agent functions (`run_agent`, `stream_agent`, `get_state`) across multiple edge cases (empty, long, special input).
* 🧠 **Mocked LLM & Graph Components**: Used `unittest.mock` to simulate external dependencies for isolated logic testing.
* 🔁 **Stream Handling Verified**: Ensured correct consumption and processing of streamed responses from the agent pipeline.
* 🕒 **Performance Benchmarked**: Tracked execution time and peak memory usage for both agents using `tracemalloc` and `time`.
* 📝 **Results Logged**: Auto-generated a readable `BENCHMARK_STATS.md` for repeatable testing and dev insights.

---

### 📊 Benchmark Results

```
run_agent:     3.7049s   | Memory: 315.21 KB | Result: "I will now use the search tool to find a blue shir..."
stream_agent:  2.2934s   | Memory: 207.40 KB | Result: "<generator object stream_agent at 0x...>"
```
### Testing

* Step 1
```
python3 benchmark_ai_agent.py
```
* Step 2
```
check the stats at BENCHMARK_STATS.md
```
