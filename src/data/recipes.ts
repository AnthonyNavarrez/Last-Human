export interface RecipeDefinition {
  id: string;
  label: string;
  stationId: 'hand' | 'crafting_bench';
  inputs: { itemId: string; quantity: number }[];
  outputs: { itemId: string; quantity: number }[];
  craftTimeMs: number;
}

export const RECIPES: RecipeDefinition[] = [
  // ── Tools ──────────────────────────────────────────────────────────────────
  {
    id: 'stone_axe', label: 'Stone Axe', stationId: 'crafting_bench',
    inputs:  [{ itemId: 'wood', quantity: 3 }, { itemId: 'stone', quantity: 5 }],
    outputs: [{ itemId: 'stone_axe', quantity: 1 }],
    craftTimeMs: 1000,
  },
  {
    id: 'stone_pickaxe', label: 'Stone Pickaxe', stationId: 'crafting_bench',
    inputs:  [{ itemId: 'wood', quantity: 5 }, { itemId: 'stone', quantity: 10 }],
    outputs: [{ itemId: 'stone_pickaxe', quantity: 1 }],
    craftTimeMs: 1000,
  },
  {
    id: 'repair_hammer', label: 'Repair Hammer', stationId: 'crafting_bench',
    inputs:  [{ itemId: 'wood', quantity: 3 }, { itemId: 'stone', quantity: 3 }],
    outputs: [{ itemId: 'repair_hammer', quantity: 1 }],
    craftTimeMs: 1000,
  },

  // ── Weapons ────────────────────────────────────────────────────────────────
  {
    id: 'stone_sword', label: 'Stone Sword', stationId: 'crafting_bench',
    inputs:  [{ itemId: 'wood', quantity: 3 }, { itemId: 'stone', quantity: 8 }],
    outputs: [{ itemId: 'stone_sword', quantity: 1 }],
    craftTimeMs: 1500,
  },
  {
    id: 'copper_sword', label: 'Copper Sword', stationId: 'crafting_bench',
    inputs:  [{ itemId: 'copper_ore', quantity: 5 }, { itemId: 'wood', quantity: 3 }],
    outputs: [{ itemId: 'copper_sword', quantity: 1 }],
    craftTimeMs: 2000,
  },
  {
    id: 'pistol', label: 'Pistol', stationId: 'crafting_bench',
    inputs:  [{ itemId: 'iron_ore', quantity: 8 }, { itemId: 'wood', quantity: 5 }],
    outputs: [{ itemId: 'pistol', quantity: 1 }],
    craftTimeMs: 3000,
  },
  {
    id: 'bullet', label: 'Bullet (×5)', stationId: 'crafting_bench',
    inputs:  [{ itemId: 'iron_ore', quantity: 1 }],
    outputs: [{ itemId: 'bullet', quantity: 5 }],
    craftTimeMs: 500,
  },

  // ── Placeables ─────────────────────────────────────────────────────────────
  {
    id: 'auto_miner', label: 'Auto Miner', stationId: 'crafting_bench',
    inputs:  [{ itemId: 'iron_ore', quantity: 5 }, { itemId: 'stone', quantity: 8 }, { itemId: 'wood', quantity: 5 }],
    outputs: [{ itemId: 'auto_miner', quantity: 1 }],
    craftTimeMs: 3000,
  },
];
