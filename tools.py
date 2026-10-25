# tools.py (CORRECTED - with proper Pydantic schemas)
import json
from langchain_core.tools import StructuredTool
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from langchain_community.tools import DuckDuckGoSearchRun

# --- Pydantic Schemas for Browser Tools ---

class AddToCartArgs(BaseModel):
    product_name: str = Field(description="The name of the product to add to cart")

class ScrollPageArgs(BaseModel):
    direction: str = Field(description="Direction to scroll", enum=["up", "down"]) # type: ignore
    amount: int = Field(description="Amount to scroll in pixels")

class SetPriceRangeArgs(BaseModel):
    min_price: int = Field(description="Lower price limit")
    max_price: int = Field(description="Higher price limit")

class SearchPageArgs(BaseModel):
    query: str = Field(description="Search query to execute")

class ClickElementArgs(BaseModel):
    target: str = Field(description="Description of what to click (e.g., 'add to cart button', 'next page')")

class ScreenCaptureArgs(BaseModel):
    pass  # No arguments needed for screen capture

class CheckoutArgs(BaseModel):
    confirmation: bool = Field(default=True, description="Confirmation to proceed with checkout")

class NavigateToCartArgs(BaseModel):
    pass  # No arguments needed to navigate to cart

# --- Browser Tool Functions ---

def add_to_cart_func(product_name: str) -> Dict[str, Any]:
    return {"action_name": "add_to_cart", "payload": {"product_name": product_name}}

def scroll_page_func(direction: str, amount: int) -> Dict[str, Any]:
    return {"action_name": "scroll_page", "payload": {"direction": direction, "amount": amount}}

def set_price_range_func(min_price: int, max_price: int) -> Dict[str, Any]:
    return {"action_name": "set_price_range", "payload": {"min_price": min_price, "max_price": max_price}}

def search_page_func(query: str) -> Dict[str, Any]:
    return {"action_name": "search_page", "payload": {"query": query}}

def click_element_func(target: str) -> Dict[str, Any]:
    return {"action_name": "click_element", "payload": {"target": target}}

def screen_capture_func() -> Dict[str, Any]:
    return {"action_name": "screen_capture", "payload": {}}

def checkout_func(confirmation: bool = True) -> Dict[str, Any]:
    return {"action_name": "checkout", "payload": {"confirmation": confirmation}}

def navigate_to_cart_func() -> Dict[str, Any]:
    return {"action_name": "navigate_to_cart", "payload": {}}

# --- Browser Tool Definitions ---

add_to_cart_tool = StructuredTool.from_function(
    func=add_to_cart_func,
    name="add_to_cart",
    description="Adds a product to cart by searching for it on the current page. "
                "This matches the background.js add_to_cart command format.",
    args_schema=AddToCartArgs
)

scroll_page_tool = StructuredTool.from_function(
    func=scroll_page_func,
    name="scroll_page",
    description="Scrolls the page up or down by specified amount. "
                "This matches the background.js scroll command format.",
    args_schema=ScrollPageArgs
)

set_price_range_tool = StructuredTool.from_function(
    func=set_price_range_func,
    name="set_price_range",
    description="Sets price range filter on e-commerce pages. "
                "This matches the background.js price command format.",
    args_schema=SetPriceRangeArgs
)

search_page_tool = StructuredTool.from_function(
    func=search_page_func,
    name="search_page",
    description="Performs search on the current page using the search functionality. "
                "This matches the background.js search command format.",
    args_schema=SearchPageArgs
)

click_element_tool = StructuredTool.from_function(
    func=click_element_func,
    name="click_element",
    description="Clicks on an element by describing what to click. "
                "This matches the background.js click command format.",
    args_schema=ClickElementArgs
)

screen_capture_tool = StructuredTool.from_function(
    func=screen_capture_func,
    name="screen_capture",
    description="Captures a screenshot of the current webpage for visual analysis. "
                "Use this when you need to see what's currently displayed on the user's screen, "
                "analyze webpage content, or answer questions about visual elements on the page. "
                "The screenshot will be automatically captured and provided to you for analysis.",
    args_schema=ScreenCaptureArgs
)

checkout_tool = StructuredTool.from_function(
    func=checkout_func,
    name="checkout",
    description="Proceeds to checkout with all items currently in the cart. "
                "Use this after adding all required items to complete the purchase process. "
                "This will navigate to the checkout page and initiate the purchase flow.",
    args_schema=CheckoutArgs
)

navigate_to_cart_tool = StructuredTool.from_function(
    func=navigate_to_cart_func,
    name="navigate_to_cart",
    description="Navigates to the shopping cart page to view all added items. "
                "Use this to review items in cart before checkout or to modify cart contents.",
    args_schema=NavigateToCartArgs
)

# --- DuckDuckGo Search Tool ---
search = DuckDuckGoSearchRun()

def _duckduckgo_search_wrapper(query: str) -> str:
    """Wrapper for DuckDuckGoSearchRun to ensure it receives a direct string input."""
    return search.run(query)

duckduckgo_search_tool = StructuredTool.from_function(
    func=_duckduckgo_search_wrapper,
    name="duckduckgo_search",
    description="Useful for searching the internet for current information. "
                "Use this when you need to find recent information, news, or data that might not be in your training data."
)


# --- Wardrobe-memory tools (executed server-side) ---
import wardrobe as wd

class AddItemArgs(BaseModel):
    name: str = Field(description="Short name, e.g. 'navy linen shirt'")
    category: str = Field(description="One of: top, bottom, footwear, outerwear, accessory, onepiece")
    color: str = Field(description="Dominant colour, one word, e.g. 'navy'")
    occasion: str = Field(default="casual", description="casual, formal, ethnic, sport or party")

class UnlockArgs(BaseModel):
    category: str = Field(description="Category of the candidate purchase")
    color: str = Field(description="Colour of the candidate purchase")
    occasion: str = Field(default="casual", description="Occasion of the candidate purchase")

class BudgetArgs(BaseModel):
    amount: float = Field(description="Budget in INR")
    period: str = Field(default="month", description="Budget period label")

class PlanArgs(BaseModel):
    name: str = Field(description="Product name")
    price: float = Field(description="Price in INR")
    category: str = Field(description="Category")
    color: str = Field(description="Colour")
    occasion: str = Field(default="casual", description="Occasion")

class OccasionArgs(BaseModel):
    occasion: Optional[str] = Field(default=None, description="Optional occasion filter")

class NoArgs(BaseModel):
    pass

def _j(x): return json.dumps(x, ensure_ascii=False, default=str)

def _add_item(name, category, color, occasion="casual"):
    try: return _j(wd.add_item(name, category, color, occasion))
    except ValueError as e: return f"Error: {e}"

wardrobe_tools = [
    StructuredTool.from_function(_add_item, name="wardrobe_add", args_schema=AddItemArgs,
        description="Save a garment the user OWNS to their wardrobe memory (e.g. after they show a photo of it)."),
    StructuredTool.from_function(lambda: _j(wd.list_items()), name="wardrobe_list", args_schema=NoArgs,
        description="List every garment in the user's wardrobe."),
    StructuredTool.from_function(lambda occasion=None: _j(wd.outfits(occasion)), name="wardrobe_outfits",
        args_schema=OccasionArgs, description="Outfits the user can already build from what they own."),
    StructuredTool.from_function(lambda: _j(wd.gaps()), name="wardrobe_gaps", args_schema=NoArgs,
        description="Find what's missing from the wardrobe, ranked by how many outfits each fix would unlock."),
    StructuredTool.from_function(lambda category, color, occasion="casual": _j(wd.unlock_score(category, color, occasion)),
        name="unlock_score", args_schema=UnlockArgs,
        description="Before recommending a purchase, check how many NEW outfits it would create with the existing wardrobe."),
    StructuredTool.from_function(lambda amount, period="month": _j(wd.set_budget(amount, period)),
        name="set_budget", args_schema=BudgetArgs, description="Set the user's shopping budget in INR."),
    StructuredTool.from_function(lambda: _j(wd.budget_status()), name="budget_status", args_schema=NoArgs,
        description="Show budget, committed spend and remaining amount."),
    StructuredTool.from_function(lambda name, price, category, color, occasion="casual":
        _j(wd.add_plan(name, price, category, color, occasion)),
        name="plan_purchase", args_schema=PlanArgs,
        description="Reserve part of the budget for an item the user agreed to buy. Refuses if over budget."),
]

# --- Tool Organization ---
browser_tools = [
    add_to_cart_tool,
    scroll_page_tool,
    set_price_range_tool,
    search_page_tool,
    click_element_tool,
    screen_capture_tool,
    checkout_tool,
    navigate_to_cart_tool
]

regular_tools = [
    duckduckgo_search_tool
] + wardrobe_tools

all_tools = browser_tools + regular_tools

# Test if tools work correctly
if __name__ == "__main__":
    print("--- Testing Browser Tool Output Formats ---")
    
    # Test new browser tools
    add_cart_result = add_to_cart_tool.invoke({"product_name": "iPhone 15"})
    print(f"Add to Cart Result: {add_cart_result}")

    scroll_result = scroll_page_tool.invoke({"direction": "down", "amount": 300})
    print(f"Scroll Result: {scroll_result}")

    price_result = set_price_range_tool.invoke({"min_price": 200, "max_price": 600})
    print(f"Price Range Result: {price_result}")

    search_result = search_page_tool.invoke({"query": "wireless headphones"})
    print(f"Search Result: {search_result}")

    click_result = click_element_tool.invoke({"target": "add to cart button"})
    print(f"Click Result: {click_result}")

    screen_result = screen_capture_tool.invoke({})
    print(f"Screen Capture Result: {screen_result}")

    checkout_result = checkout_tool.invoke({"confirmation": True})
    print(f"Checkout Result: {checkout_result}")

    navigate_cart_result = navigate_to_cart_tool.invoke({})
    print(f"Navigate to Cart Result: {navigate_cart_result}")

    print("\n--- Testing Tool Args Schema ---")
    print(f"Scroll tool args: {scroll_page_tool.args}")
