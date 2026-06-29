export type RecipeTab = 'tools' | 'weapons' | 'buildings' | 'misc';

export interface RecipeDefinition {
  id: string;
  label: string;
  stationId: 'hand' | 'crafting_bench';
  tab: RecipeTab;
  inputs: { itemId: string; quantity: number }[];
  outputs: { itemId: string; quantity: number }[];
  craftTimeMs: number;
}

export const RECIPES: RecipeDefinition[] = [
  // ── Tools ──────────────────────────────────────────────────────────────────
  {
    id: 'stone_axe', label: 'Stone Axe', stationId: 'crafting_bench', tab: 'tools',
    inputs:  [{ itemId: 'wood', quantity: 3 }, { itemId: 'stone', quantity: 5 }],
    outputs: [{ itemId: 'stone_axe', quantity: 1 }],
    craftTimeMs: 1000,
  },
  {
    id: 'stone_pickaxe', label: 'Stone Pickaxe', stationId: 'crafting_bench', tab: 'tools',
    inputs:  [{ itemId: 'wood', quantity: 5 }, { itemId: 'stone', quantity: 10 }],
    outputs: [{ itemId: 'stone_pickaxe', quantity: 1 }],
    craftTimeMs: 1000,
  },
  {
    id: 'repair_hammer', label: 'Hammer', stationId: 'crafting_bench', tab: 'tools',
    inputs:  [{ itemId: 'wood', quantity: 3 }, { itemId: 'stone', quantity: 3 }],
    outputs: [{ itemId: 'repair_hammer', quantity: 1 }],
    craftTimeMs: 1000,
  },

  // ── Weapons ────────────────────────────────────────────────────────────────
  {
    id: 'iron_sword', label: 'Iron Sword', stationId: 'crafting_bench', tab: 'weapons',
    inputs:  [{ itemId: 'iron_ore', quantity: 10 }, { itemId: 'wood', quantity: 10 }],
    outputs: [{ itemId: 'iron_sword', quantity: 1 }],
    craftTimeMs: 2000,
  },
  {
    id: 'bow', label: 'Bow', stationId: 'crafting_bench', tab: 'weapons',
    inputs:  [{ itemId: 'iron_ore', quantity: 8 }, { itemId: 'wood', quantity: 5 }],
    outputs: [{ itemId: 'bow', quantity: 1 }],
    craftTimeMs: 3000,
  },
  {
    id: 'wooden_arrow', label: 'Wooden Arrow (×5)', stationId: 'crafting_bench', tab: 'weapons',
    inputs:  [{ itemId: 'iron_ore', quantity: 1 }],
    outputs: [{ itemId: 'wooden_arrow', quantity: 5 }],
    craftTimeMs: 500,
  },

  // ── Buildings ──────────────────────────────────────────────────────────────
  {
    id: 'auto_miner', label: 'Drill', stationId: 'crafting_bench', tab: 'buildings',
    inputs:  [{ itemId: 'iron_ore', quantity: 5 }, { itemId: 'stone', quantity: 8 }, { itemId: 'wood', quantity: 5 }],
    outputs: [{ itemId: 'auto_miner', quantity: 1 }],
    craftTimeMs: 3000,
  },
  // ── Misc ───────────────────────────────────────────────────────────────────
  {
    id: 'battery', label: 'Battery', stationId: 'crafting_bench', tab: 'misc',
    inputs:  [{ itemId: 'iron_ore', quantity: 5 }, { itemId: 'copper_ore', quantity: 5 }],
    outputs: [{ itemId: 'battery', quantity: 1 }],
    craftTimeMs: 1500,
  },

  {
    id: 'turret', label: 'Turret', stationId: 'crafting_bench', tab: 'buildings',
    inputs:  [
      { itemId: 'wood',     quantity: 25 },
      { itemId: 'iron_ore', quantity: 15 },
      { itemId: 'stone',    quantity: 10 },
    ],
    outputs: [{ itemId: 'turret', quantity: 1 }],
    craftTimeMs: 3000,
  },
  {
    id: 'canon', label: 'Canon Lv.1', stationId: 'crafting_bench', tab: 'buildings',
    inputs:  [
      { itemId: 'stone',    quantity: 25 },
      { itemId: 'iron_ore', quantity: 20 },
      { itemId: 'wood',     quantity: 5  },
    ],
    outputs: [{ itemId: 'canon', quantity: 1 }],
    craftTimeMs: 3000,
  },
  {
    id: 'anvil', label: 'Anvil', stationId: 'crafting_bench', tab: 'buildings',
    inputs:  [
      { itemId: 'iron_ore',   quantity: 12 },
      { itemId: 'copper_ore', quantity: 12 },
      { itemId: 'stone',      quantity: 20 },
    ],
    outputs: [{ itemId: 'anvil', quantity: 1 }],
    craftTimeMs: 3000,
  },
  {
    id: 'saw', label: 'Saw', stationId: 'crafting_bench', tab: 'buildings',
    inputs:  [
      { itemId: 'copper_ore', quantity: 20 },
      { itemId: 'iron_ore',   quantity: 20 },
      { itemId: 'stone',      quantity: 25 },
    ],
    outputs: [{ itemId: 'saw', quantity: 1 }],
    craftTimeMs: 3000,
  },
];
