import unittest
from unittest.mock import patch, MagicMock
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_agent import run_agent, stream_agent, get_state

class TestAIAgent(unittest.TestCase):
    def setUp(self):
        # Setup test data
        self.test_user_input = "Find me a blue shirt"
        self.test_thread_id = "test_thread_1"
        self.test_image_data = "base64_encoded_image_data"
        
    @patch('ai_agent.llm_with_tools')
    def test_run_agent_basic(self, mock_llm):
        # Test basic text input
        mock_llm.invoke.return_value = MagicMock(content="Here are some blue shirts")
        result = run_agent(self.test_user_input, self.test_thread_id)
        self.assertIsInstance(result, str)
        self.assertTrue(len(result) > 0)

    @patch('ai_agent.llm_with_tools')
    def test_run_agent_empty_input(self, mock_llm):
        # Test empty input
        with self.assertRaises(Exception):
            run_agent("", self.test_thread_id)

    @patch('ai_agent.llm_with_tools')
    def test_run_agent_special_characters(self, mock_llm):
        # Test input with special characters
        special_input = "Find me a shirt with @#$% symbols"
        mock_llm.invoke.return_value = MagicMock(content="Here are some shirts")
        result = run_agent(special_input, self.test_thread_id)
        self.assertIsInstance(result, str)

    @patch('ai_agent.llm_with_tools')
    def test_run_agent_long_input(self, mock_llm):
        # Test very long input
        long_input = "Find me a shirt" * 100
        mock_llm.invoke.return_value = MagicMock(content="Here are some shirts")
        result = run_agent(long_input, self.test_thread_id)
        self.assertIsInstance(result, str)

    def test_get_state(self):
        # Test state retrieval
        state = get_state(self.test_thread_id)
        self.assertIsInstance(state, dict)
        self.assertIn('values', state)

    @patch('ai_agent.graph')
    def test_stream_agent(self, mock_graph):
        # Test streaming functionality
        mock_graph.stream.return_value = [
            {"messages": [MagicMock(content="Streaming response")]}
        ]
        stream = stream_agent(self.test_user_input, self.test_thread_id)
        self.assertIsNotNone(stream)

if __name__ == '__main__':
    unittest.main() 