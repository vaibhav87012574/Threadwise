import { useEffect, useState, useCallback } from 'react';

const API = 'http://localhost:5000';
const SWATCH = { denim: '#3b5b92', navy: '#1f2a52', cream: '#f3ead7', beige: '#d9c6a5', olive: '#6b7b3a',
  mustard: '#d4a017', maroon: '#6d1a2b', teal: '#127c7c', rust: '#b5502a', 'off-white': '#f5f2ea' };
const swatch = (c) => SWATCH[c] || c;

export default function Closet({ refreshKey }) {
  const [data, setData] = useState(null);
  const [budgetInput, setBudgetInput] = useState('');

  const load = useCallback(async () => {
    try { setData(await (await fetch(`${API}/wardrobe`)).json()); } catch { /* backend offline */ }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const saveBudget = async () => {
    if (!budgetInput) return;
    await fetch(`${API}/budget`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(budgetInput) }) });
    setBudgetInput(''); load();
  };
  const remove = async (id) => { await fetch(`${API}/wardrobe/${id}`, { method: 'DELETE' }); load(); };

  if (!data) return <div className="closet-empty">Closet offline</div>;
  const { items, outfits, gaps, budget } = data;
  const pct = budget.budget ? Math.min(100, (budget.committed / budget.budget) * 100) : 0;

  return (
    <div className="closet">
      <div className="closet-stat">
        <span className="closet-num">{outfits.length}</span> outfits from <span className="closet-num">{items.length}</span> pieces
      </div>

      <div className="closet-budget">
        {budget.budget ? (
          <>
            <div className="meter"><div className="meter-fill" style={{ width: `${pct}%` }} /></div>
            <small>₹{Math.round(budget.remaining)} left of ₹{Math.round(budget.budget)}</small>
          </>
        ) : (
          <div className="budget-set">
            <input type="number" placeholder="Set budget ₹" value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)} />
            <button onClick={saveBudget}>Set</button>
          </div>
        )}
      </div>

      {gaps.missing.length > 0 && (
        <div className="closet-gap">
          <small>Biggest gap</small>
          <div>{gaps.missing[0].occasion} {gaps.missing[0].category} <b>+{gaps.missing[0].new_outfits}</b> outfits</div>
        </div>
      )}

      <div className="closet-grid">
        {items.map((i) => (
          <div key={i.id} className="closet-chip" title={`${i.name} · ${i.occasion}`} onClick={() => remove(i.id)}>
            <span className="dot" style={{ background: swatch(i.color) }} />
            <span>{i.name}</span>
          </div>
        ))}
        {items.length === 0 && <small>Send a photo and say “add to my closet”.</small>}
      </div>
    </div>
  );
}
