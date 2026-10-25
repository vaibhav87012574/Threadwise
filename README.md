# Threadwise: a stylist that shops your closet first

Most shopping assistants say "buy this." Threadwise asks "do you need it?"

It keeps a persistent **wardrobe memory** and a **budget**, and judges every product by one number:
**how many new outfits it unlocks** with what you already own.

## How it works
1. Show a photo of something you own → saved to your closet (colour, category, occasion).
2. Show something you want → `unlock_score` says how many new outfits it creates (0 = skip it).
3. Ask "what should I buy?" → `wardrobe_gaps` ranks missing pieces by outfits unlocked.
4. Agree on an item → `plan_purchase` reserves budget (refused if over). Browser tools then search Amazon India with your remaining budget as the price cap.

## Layout
- `wardrobe.py`: SQLite closet, colour-matching outfit engine, gap + unlock scoring, budget
- `tools.py`: browser tools + wardrobe tools exposed to the agent
- `system_prompt.py`: Threadwise persona and workflow
- `app.py`: Flask/SocketIO + REST (`/wardrobe`, `/budget`, `/plans/<id>/bought`)
- `ai_agent_interface/`: React app with live Closet panel
- `ai_agent_extension/`: Chrome side-panel that executes the shopping actions

## Run
```bash
pip install -r requirements.txt && echo "GOOGLE_API_KEY=..." > .env && python app.py
cd ai_agent_interface && npm i && npm run dev
cd ai_agent_extension && npm i && npm run build   # load dist/ as unpacked extension
```
