from typing import Annotated
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver
from tools import all_tools, browser_tools, regular_tools
from dotenv import load_dotenv
from system_prompt import system_prompt

# Load environment variables from .env file
load_dotenv()
# Initialize LLM
llm = init_chat_model("gemini-2.0-flash", model_provider="google_genai")
llm_with_tools = llm.bind_tools(all_tools)

# Define state structure
class State(TypedDict):
    messages: Annotated[list, add_messages]

# System prompt for the agent
system_prompt = system_prompt

# Custom tool handler that only executes regular tools
# Browser tools will be intercepted at the WebSocket level
def custom_tool_handler(state):
    """Custom tool handler that only executes non-browser tools"""
    from langchain_core.messages import ToolMessage
    
    messages = state["messages"]
    last_message = messages[-1]
    
    results = []
    
    if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
        for tool_call in last_message.tool_calls:
            tool_name = tool_call.get('name', 'unknown')
            tool_args = tool_call.get('args', {})
            tool_id = tool_call.get('id', 'unknown_id')
            
            # Check if this is a browser tool
            browser_tool_names = [tool.name for tool in browser_tools]
            
            if tool_name in browser_tool_names:
                # For browser tools, create a placeholder message
                # The actual execution will be handled by the browser extension
                # Store the tool call info in the state for WebSocket detection
                tool_result = ToolMessage(
                    content=f"🔧 Browser tool '{tool_name}' ready for execution",
                    tool_call_id=tool_id,
                    additional_kwargs={
                        'is_browser_tool': True,
                        'tool_name': tool_name,
                        'tool_args': tool_args,
                        'tool_id': tool_id
                    }
                )
                results.append(tool_result)
            else:
                # For regular tools, execute them normally
                for tool in regular_tools:
                    if tool.name == tool_name:
                        try:
                            result = tool.invoke(tool_args)
                            tool_result = ToolMessage(
                                content=str(result),
                                tool_call_id=tool_id
                            )
                            results.append(tool_result)
                        except Exception as e:
                            error_result = ToolMessage(
                                content=f"Error executing {tool_name}: {str(e)}",
                                tool_call_id=tool_id
                            )
                            results.append(error_result)
                        break
    
    return {"messages": results}

# Graph setup
graph_builder = StateGraph(State)

graph_builder.add_node("chatbot", lambda state: {"messages": [llm_with_tools.invoke(state["messages"])]})
graph_builder.add_node("tools", custom_tool_handler)


graph_builder.add_conditional_edges("chatbot", tools_condition) # it will default to END
graph_builder.add_edge("tools", "chatbot")
graph_builder.add_edge(START, "chatbot")

# Memory for conversation
memory = MemorySaver()
graph = graph_builder.compile(checkpointer=memory)


# Interface function for streaming
def stream_agent(user_input, thread_id: str = "1"):
    """Stream agent responses with state updates only"""
    config = {"configurable": {"thread_id": thread_id}}

    current_state_snapshot = graph.get_state(config=config) # type: ignore
    
    # If user_input is empty, just continue from current state (for tool responses)
    if not user_input:
        try:
            # Continue from current state without adding new user message
            # Check if there are any unprocessed ToolMessages that need AI response
            current_messages = current_state_snapshot.values.get("messages", [])
            if current_messages:
                last_message = current_messages[-1]
                # If the last message is a ToolMessage, we need to trigger the chatbot to process it
                if hasattr(last_message, '__class__') and 'ToolMessage' in str(last_message.__class__):
                    print(f"🔄 Continuing conversation to process ToolMessage...")
                    # Stream with empty input to continue the graph flow
                    for chunk in graph.stream({}, config=config, stream_mode="updates"): # type: ignore
                        yield chunk
                else:
                    # Regular continuation
                    for chunk in graph.stream(None, config=config, stream_mode="updates"): # type: ignore
                        yield chunk
            else:
                # Regular continuation  
                for chunk in graph.stream(None, config=config, stream_mode="updates"): # type: ignore
                    yield chunk
        except Exception as e:
            print(f"Streaming error: {e}")
            yield {"error": str(e)}
        return
    
    # Determine if it's a new conversation for this thread_id
    is_new_conversation = not current_state_snapshot.values.get("messages")

    if is_new_conversation:
        # Initialize the state with the system prompt if it doesn't exist
        messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input}
        ]
    else:   
        messages = [
                    {"role": "user", "content": user_input}
        ]
    
    # Stream with updates mode - only sends updates when state changes
    try:
        for chunk in graph.stream({"messages": messages}, config=config, stream_mode="updates"): # type: ignore
            yield chunk
    except Exception as e:
        print(f"Streaming error: {e}")
        yield {"error": str(e)}

# Keep the original function for backward compatibility
def run_agent(user_input, thread_id: str = "1") -> str:
    
    config = {"configurable": {"thread_id": thread_id}}

    current_state_snapshot = graph.get_state(config=config) # type: ignore
    
    # Determine if it's a new conversation for this thread_id
    # We check if the 'messages' key exists and if the list is empty
    is_new_conversation = not current_state_snapshot.values.get("messages")


    if is_new_conversation:
        # Initialize the state with the system prompt if it doesn't exist
        messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input}
        ]
    else:   
        messages = [
                    {"role": "user", "content": user_input}
        ]
    result = graph.invoke({"messages": messages}, config=config) # type: ignore
    for i in range(len(result["messages"])):
        result["messages"][i].pretty_print()
        print("thread_id :",thread_id)
    print(result["messages"])
    return result["messages"][-1].content

import json

def get_state(thread_id: str = "1") -> dict:
    config = {"configurable": {"thread_id": thread_id}}
    current_state_snapshot = graph.get_state(config=config) # type: ignore
    return (current_state_snapshot) # type: ignore
  