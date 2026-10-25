import base64
import json
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from ai_agent import run_agent, stream_agent


app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True)


# ---- Threadwise: wardrobe + budget REST API ----
import wardrobe as wd

@app.route('/wardrobe', methods=['GET'])
def wardrobe_get():
    return jsonify({"items": wd.list_items(), "outfits": wd.outfits(), "gaps": wd.gaps(),
                    "budget": wd.budget_status(), "plans": wd.list_plans()})

@app.route('/wardrobe', methods=['POST'])
def wardrobe_add():
    d = request.get_json(force=True)
    try:
        return jsonify(wd.add_item(d["name"], d["category"], d["color"], d.get("occasion", "casual")))
    except (ValueError, KeyError) as e:
        return jsonify({"error": str(e)}), 400

@app.route('/wardrobe/<int:item_id>', methods=['DELETE'])
def wardrobe_delete(item_id):
    return jsonify({"deleted": wd.remove_item(item_id)})

@app.route('/budget', methods=['POST'])
def budget_set():
    d = request.get_json(force=True)
    return jsonify(wd.set_budget(float(d["amount"]), d.get("period", "month")))

@app.route('/plans/<int:plan_id>/bought', methods=['POST'])
def plan_bought(plan_id):
    return jsonify({"ok": wd.mark_bought(plan_id)})

@app.route('/chat', methods=['POST'])
def chat():
    
    user_message = request.form.get("message", "")
    image_file = request.files.get("image",None)
    thread_id = request.form.get("thread_id", "1")  # Default to thread_id "1"

    print("User message:", user_message)
    print("Image file:", image_file)
    print("Thread ID:", thread_id)

    print(image_file)

    if not user_message.strip() and not image_file:
        return jsonify({"error": "Message and image both are empty"}), 400


    image_data = None
    mime_type = None
    if image_file is not None:
        # image_data = base64.b64encode(httpx.get(image_url).content).decode("utf-8")
        print("Image file is not None")
        image_bytes = image_file.read()
        # image = Image.open(BytesIO((image_bytes)))
        # image.save('sample.png')
        # image.show()
        image_data = base64.b64encode(image_bytes).decode("utf-8")
        mime_type = image_file.mimetype
 
    if image_data is None:
        user_request = [                                
                {
                  "type": "text",
                  "text": user_message,
                },
            ]
    else:
        user_request = [
                    {
                    "type": "text",
                    "text": user_message,
                    },
                    {
                    "type": "image",
                    "source_type": "base64",
                    "data": image_data,  # Read the image data
                    "mime_type": "image/jpeg",
                    },
                ]   
    try:
        # Pass both the message and the image path to the agent
        reply = run_agent(user_request,thread_id)  # type: ignore
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    # finally:
        # # Clean up the image file after processing
        # if image_path and os.path.exists(image_path):
        #     os.remove(image_path)


@app.route('/chat', methods=['GET'])
def get_chat_state():
    # Get the current state of the model
    thread_id = request.args.get('thread_id', '1')  # Default to thread_id "1"
    
    try:
        from ai_agent import get_state
        state = get_state(thread_id)
        
        # Extract messages and format them for frontend
        messages = []
        if state.values.get("messages"): # type: ignore
            for msg in state.values["messages"]: # type: ignore
                # Skip system messages
                if hasattr(msg, 'type') and msg.type == 'system':
                    continue
                    
                # Format message for frontend
                role = 'user' if msg.type == 'human' else 'assistant'
                content = msg.content
                
                # Handle different content types (text vs multimodal)
                if isinstance(content, list):
                    # Extract text and image data from multimodal content
                    text_content = ""
                    image_data = None
                    
                    for item in content:
                        if item.get("type") == "text":
                            text_content = item.get("text", "")
                        elif item.get("type") == "image":
                            image_data = item.get("data")
                    
                    messages.append({
                        "role": role,
                        "content": text_content,
                        "image": f"data:image/jpeg;base64,{image_data}" if image_data else None
                    })
                else:
                    messages.append({
                        "role": role,
                        "content": content,
                        "image": None
                    })
        
        return jsonify({"messages": messages})
    except Exception as e:
        return jsonify({"error": str(e), "messages": []}), 500

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('status', {'message': 'Connected to server'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

# Global tracking for browser tools to prevent duplicates across all sessions
browser_tool_tracking = {}
# Global content tracking to prevent duplicates across streaming phases
global_content_tracking = {}
# Global tool message tracking to prevent duplicates across chat requests
sent_tool_messages_global = {}

@socketio.on('chat_stream')
def handle_chat_stream(data):
    """Handle streaming chat requests via WebSocket"""
    try:
        user_message = data.get('message', '')
        image_data = data.get('image_data')
        thread_id = data.get('thread_id', '1')
        
        print(f"WebSocket chat request - Thread: {thread_id}, Message: {user_message[:50]}...")
        
        if not user_message.strip() and not image_data:
            emit('error', {'message': 'Message and image both are empty'})
            return
        
        # Prepare user request
        if image_data is None:
            user_request = [                                
                {
                  "type": "text",
                  "text": user_message,
                },
            ]
        else:
            user_request = [
                {
                "type": "text",
                "text": user_message,
                },
                {
                "type": "image",
                "source_type": "base64",
                "data": image_data,
                "mime_type": "image/jpeg",
                },
            ]
        
        # Send initial acknowledgment
        emit('stream_start', {'thread_id': thread_id})
        
        # Stream the agent response
        final_content = ""
        browser_tool_sent = {}  # Track sent browser tool calls to prevent duplicates
        sent_content = set()  # Track sent content to prevent duplicate messages
        
        # Use thread-specific tool message tracking to prevent duplicates across chat requests
        if thread_id not in sent_tool_messages_global:
            sent_tool_messages_global[thread_id] = set()
        
        sent_tool_messages = sent_tool_messages_global[thread_id]  # Use thread-specific tracking
        session_id = f"{thread_id}_{int(time.time())}"  # Unique session identifier
        
        # Use global tracking key for this thread to persist across streaming phases
        global_key = f"session_{thread_id}_{session_id}"
        if global_key not in global_content_tracking:
            global_content_tracking[global_key] = set()
        
        print(f"Starting stream session: {session_id}")
        
        for chunk in stream_agent(user_request, thread_id):
            if isinstance(chunk, dict) and 'error' in chunk:
                emit('error', {'message': chunk['error']})
                return
            
            # Extract meaningful updates from the chunk
            if isinstance(chunk, dict):
                # Process different types of updates
                for node_name, node_data in chunk.items():
                    if isinstance(node_data, dict) and 'messages' in node_data and node_data['messages']:
                        # Get the latest message
                        messages_list = node_data['messages']
                        if messages_list:
                            latest_message = messages_list[-1]
                            
                            # Handle different message types
                            if hasattr(latest_message, 'content') and latest_message.content:
                                content = latest_message.content
                                
                                # Check if this is a browser tool message (only handle here, not in tool_calls)
                                if (hasattr(latest_message, 'additional_kwargs') and 
                                    latest_message.additional_kwargs and
                                    latest_message.additional_kwargs.get('is_browser_tool')):
                                    
                                    # This is a browser tool call - send to frontend
                                    tool_info = latest_message.additional_kwargs
                                    tool_name = tool_info.get('tool_name')
                                    tool_args = tool_info.get('tool_args', {})
                                    tool_id = tool_info.get('tool_id')
                                    
                                    # Prevent duplicate browser tool calls
                                    if tool_id not in browser_tool_sent:
                                        browser_tool_sent[tool_id] = True
                                        
                                        print(f"🔧 Browser tool detected: {tool_name} with args: {tool_args}")
                                        
                                        # Send tool call to frontend for execution
                                        emit('browser_tool_call', {
                                            'thread_id': thread_id,
                                            'tool_name': tool_name,
                                            'tool_args': tool_args,
                                            'tool_id': tool_id,
                                            'message': f"Executing {tool_name} with parameters: {tool_args}"
                                        })
                                        
                                        # Show user what's happening (only once per unique tool call)
                                        tool_message_key = f"tool_call_{tool_name}_{tool_id}"
                                        if tool_message_key not in sent_tool_messages:
                                            sent_tool_messages.add(tool_message_key)
                                            emit('stream_update', {
                                                'thread_id': thread_id,
                                                'node': node_name,
                                                'content': f"🔧 Executing browser action: {tool_name}",
                                                'type': 'tool_call'
                                            })
                                else:
                                    # Regular message content - check for duplicates more strictly
                                    content_key = f"{node_name}_{content}"
                                    if content_key not in sent_content and content_key not in global_content_tracking[global_key]:
                                        sent_content.add(content_key)
                                        global_content_tracking[global_key].add(content_key)
                                        final_content = content
                                        print(f"📤 Sending message: {content[:50]}...")
                                        emit('stream_update', {
                                            'thread_id': thread_id,
                                            'node': node_name,
                                            'content': content,
                                            'type': 'message'
                                        })
                                    else:
                                        print(f"🚫 Skipping duplicate content: {content[:50]}...")
                            elif hasattr(latest_message, 'tool_calls') and latest_message.tool_calls:
                                # Handle tool calls - Only handle non-browser tools here
                                for tool_call in latest_message.tool_calls:
                                    tool_name = tool_call.get('name', 'unknown')
                                    tool_args = tool_call.get('args', {})
                                    tool_id = tool_call.get('id', 'unknown_id')
                                    
                                    # Check if this is a browser extension tool
                                    browser_tools = ['add_to_cart', 'scroll_page', 'set_price_range', 'search_page', 'click_element', 'screen_capture']
                                    
                                    if tool_name not in browser_tools:
                                        # Regular tool call (non-browser)
                                        emit('stream_update', {
                                            'thread_id': thread_id,
                                            'node': node_name,
                                            'content': f"Using tool: {tool_name}",
                                            'type': 'tool_call'
                                        })
                    else:
                        # Fallback for simpler updates
                        emit('stream_update', {
                            'thread_id': thread_id,
                            'node': node_name,
                            'content': str(node_data),
                            'type': 'state_update'
                        })
        
        # Only send completion signal if no browser tools were called
        # (browser tools will trigger their own completion via handle_browser_tool_result)
        if not browser_tool_sent:
            emit('stream_complete', {
                'thread_id': thread_id,
                'final_content': final_content
            })
        
    except Exception as e:
        print(f"WebSocket error: {e}")
        emit('error', {'message': str(e)})

@socketio.on('browser_tool_result')
def handle_browser_tool_result(data):
    """Handle results from browser tool execution"""
    try:
        thread_id = data.get('thread_id', '1')
        tool_id = data.get('tool_id')
        tool_name = data.get('tool_name')
        success = data.get('success', False)
        screenshot_data = data.get('screenshot_data')
        error_message = data.get('error')
        
        print(f"📸 Received browser tool result for {tool_name} (ID: {tool_id}, Success: {success})")
        
        # Import here to avoid circular imports
        from langchain_core.messages import ToolMessage, HumanMessage
        from ai_agent import graph
        
        # Create appropriate tool message
        messages_to_add = []
        
        if success and screenshot_data and tool_name == 'screen_capture':
            # For screen_capture, create TWO messages:
            # 1. ToolMessage with text only (confirming tool execution)
            # 2. HumanMessage with the image (so Gemini can actually see it)
            
            # First, create the tool completion message
            tool_message = ToolMessage(
                content="Screenshot captured successfully from current tab.",
                tool_call_id=tool_id
            )
            
            # Then create a HumanMessage with the image for AI analysis
            # This is necessary because Gemini cannot process images in ToolMessage format
            analysis_message = HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": "this is the webpage requested via toolcall"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{screenshot_data}"
                        }
                    }
                ]
            )
            
            print(f"📸 Created ToolMessage + HumanMessage for screen_capture (image size: {len(screenshot_data)} bytes)")
            messages_to_add = [tool_message, analysis_message]
            
        elif success and screenshot_data:
            # For other tools with screenshots
            tool_result = f"Browser action '{tool_name}' completed successfully. Screenshot captured."
            
            # Create tool message with the screenshot as image content
            tool_message = ToolMessage(
                content=[
                    {
                        "type": "text",
                        "text": tool_result
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{screenshot_data}"
                        }
                    }
                ],
                tool_call_id=tool_id
            )
            messages_to_add = [tool_message]
        else:
            # Create ToolMessage with error or simple success
            if success:
                message_content = f"✅ Browser action '{tool_name}' completed successfully."
            else:
                error_msg = error_message or "Browser action failed"
                message_content = f"❌ Browser action '{tool_name}' failed: {error_msg}"
            
            tool_message = ToolMessage(
                content=message_content,
                tool_call_id=tool_id
            )
            messages_to_add = [tool_message]
        
        try:
            # Update graph state with tool result
            config = {"configurable": {"thread_id": thread_id}}
            graph.update_state(config, {"messages": messages_to_add})  # type: ignore
            print(f"✅ Updated graph state with {len(messages_to_add)} message(s) for {tool_name}")
            
            # For screen_capture, immediately trigger continuation to let AI analyze the screenshot
            if tool_name == 'screen_capture' and success and screenshot_data:
                print(f"🤖 Triggering AI analysis of screenshot...")
                # Continue the graph so the AI can analyze the screenshot
                try:
                    for chunk in stream_agent([], thread_id):  # Empty input to continue
                        if isinstance(chunk, dict) and 'error' in chunk:
                            emit('error', {'message': chunk['error']})
                            break
                        
                        # Process the AI's analysis of the screenshot
                        if isinstance(chunk, dict):
                            for node_name, node_data in chunk.items():
                                if isinstance(node_data, dict) and 'messages' in node_data and node_data['messages']:
                                    messages_list = node_data['messages']
                                    if messages_list:
                                        latest_message = messages_list[-1]
                                        if hasattr(latest_message, 'content') and latest_message.content:
                                            content = latest_message.content
                                            print(f"🤖 AI screenshot analysis: {content[:100]}...")
                                            emit('stream_update', {
                                                'thread_id': thread_id,
                                                'node': node_name,
                                                'content': content,
                                                'type': 'message'
                                            })
                except Exception as continuation_error:
                    print(f"⚠️ Error triggering AI analysis: {continuation_error}")
                    
        except Exception as state_error:
            print(f"⚠️ Error updating graph state: {state_error}")
            # Continue anyway - the tool result info is still valuable
        
        # Send update to frontend
        if success:
            status_message = f"✅ Browser action '{tool_name}' completed successfully"
        else:
            error_msg = error_message or "Browser action failed"
            status_message = f"❌ Browser action '{tool_name}' failed: {error_msg}"
            
        result_message_key = f"tool_result_{tool_name}_{tool_id}_{thread_id}"  # Make it thread-specific
        
        # Only send tool result update once per tool execution
        if result_message_key not in browser_tool_tracking:
            browser_tool_tracking[result_message_key] = True
            emit('stream_update', {
                'thread_id': thread_id,
                'node': 'browser_tools',
                'content': status_message,
                'type': 'tool_result'
            })
        else:
            print(f"🚫 Skipping duplicate tool result: {status_message}")
        
        try:
            # Continue the conversation by triggering the next step
            # Skip continuation for screen_capture as it's handled specifically above
            if tool_name != 'screen_capture':
                print(f"🔄 Continuing conversation after {tool_name} tool result...")
                continuation_started = False
                
                # Get the global tracking key for this thread
                session_keys = [key for key in global_content_tracking.keys() if key.startswith(f"session_{thread_id}_")]
                current_global_key = session_keys[-1] if session_keys else f"session_{thread_id}_continuation"
                
                if current_global_key not in global_content_tracking:
                    global_content_tracking[current_global_key] = set()
                
                for chunk in stream_agent([], thread_id):  # Empty input to continue
                    if isinstance(chunk, dict) and 'error' in chunk:
                        emit('error', {'message': chunk['error']})
                        return
                    
                    continuation_started = True
                    
                    # Process the continuation
                    if isinstance(chunk, dict):
                        for node_name, node_data in chunk.items():
                            if isinstance(node_data, dict) and 'messages' in node_data and node_data['messages']:
                                messages_list = node_data['messages']
                                if messages_list:
                                    latest_message = messages_list[-1]
                                    if hasattr(latest_message, 'content') and latest_message.content:
                                        content = latest_message.content
                                        content_key = f"{node_name}_{content}"
                                    
                                        # Only send if we haven't sent this content before (globally)
                                        if content_key not in global_content_tracking[current_global_key]:
                                            global_content_tracking[current_global_key].add(content_key)
                                            print(f"📤 Sending continuation: {content[:50]}...")
                                            emit('stream_update', {
                                                'thread_id': thread_id,
                                                'node': node_name,
                                                'content': content,
                                                'type': 'message'
                                            })
                                        else:
                                            print(f"🚫 Skipping duplicate continuation: {content[:50]}...")
                
                # Send completion signal
                emit('stream_complete', {
                    'thread_id': thread_id,
                    'final_content': 'Browser action completed and analyzed' if continuation_started else status_message
                })
            else:
                # For screen_capture, send completion after AI analysis is done
                emit('stream_complete', {
                    'thread_id': thread_id,
                    'final_content': 'Screenshot captured and analyzed'
                })
            
        except Exception as continuation_error:
            print(f"⚠️ Error continuing conversation: {continuation_error}")
            # Still send completion signal even if continuation failed
            emit('stream_complete', {
                'thread_id': thread_id,
                'final_content': status_message
            })
        
    except Exception as e:
        print(f"❌ Error handling browser tool result: {e}")
        emit('error', {'message': f'Error processing browser tool result: {str(e)}'})
        
        # Try to send a completion signal even on error
        try:
            emit('stream_complete', {
                'thread_id': data.get('thread_id', '1'),
                'final_content': f'Browser tool processing failed: {str(e)}'
            })
        except:
            pass  # If even this fails, just give up gracefully

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
