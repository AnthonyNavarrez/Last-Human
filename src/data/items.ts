export interface ItemDefinition {
  id: string;
  label: string;
  spriteKey: string;
  maxStack: number;
  type: 'resource' | 'tool' | 'weapon' | 'ammo' | 'placeable' | 'consumable';
  damage?: number;
  description?: string;
}

export const ITEMS: Record<string, ItemDefinition> = {
  // ── Resources ──────────────────────────────────────────────────────────────
  blueberry:  { id: 'blueberry',  label: 'Blueberry',  spriteKey: 'item-blueberry',  maxStack: 99, type: 'resource' },
  wood:       { id: 'wood',       label: 'Wood',       spriteKey: 'item-branch',     maxStack: 99, type: 'resource' },
  stone:      { id: 'stone',      label: 'Stone',      spriteKey: 'item-rock',       maxStack: 99, type: 'resource' },
  iron_ore:   { id: 'iron_ore',   label: 'Iron Ore',   spriteKey: 'item-iron-ore',   maxStack: 99, type: 'resource' },
  copper_ore: { id: 'copper_ore', label: 'Copper Ore', spriteKey: 'item-copper-ore', maxStack: 99, type: 'resource' },
  leather:    { id: 'leather',    label: 'Leather',    spriteKey: 'item-leather',    maxStack: 99, type: 'resource' },
  coin:       { id: 'coin',       label: 'Coin',       spriteKey: 'item-coin',       maxStack: 99, type: 'resource' },
  battery:    { id: 'battery',    label: 'Battery',    spriteKey: 'item-battery',    maxStack: 99, type: 'resource', description: '200 energy' },
  wooden_arrow: { id: 'wooden_arrow', label: 'Wooden Arrow', spriteKey: 'item-wooden-arrow', maxStack: 99, type: 'ammo', damage: 2 },

  // ── Tools ──────────────────────────────────────────────────────────────────
  stone_axe:      { id: 'stone_axe',      label: 'Stone Axe',      spriteKey: 'item-stone-axe',      maxStack: 1, type: 'tool' },
  stone_pickaxe:  { id: 'stone_pickaxe',  label: 'Stone Pickaxe',  spriteKey: 'item-stone-pickaxe',  maxStack: 1, type: 'tool' },
  repair_hammer:  { id: 'repair_hammer',  label: 'Hammer',  spriteKey: 'item-repair-hammer',  maxStack: 1, type: 'tool' },

  // ── Weapons ────────────────────────────────────────────────────────────────
  iron_sword: { id: 'iron_sword', label: 'Iron Sword', spriteKey: 'item-iron-sword', maxStack: 1, type: 'weapon', damage: 7 },
  bow:        { id: 'bow',        label: 'Bow',        spriteKey: 'item-bow',        maxStack: 1, type: 'weapon', damage: 4 },

  // ── Placeables ─────────────────────────────────────────────────────────────
  acorn:           { id: 'acorn',           label: 'Acorn',          spriteKey: 'item-acorn',             maxStack: 10, type: 'placeable', description: 'Plant a tree stump that grows back in 1 minute' },
  crafting_bench:  { id: 'crafting_bench',  label: 'Crafting Bench', spriteKey: 'building-crafting-bench', maxStack: 1,  type: 'placeable' },
  auto_miner: { id: 'auto_miner', label: 'Drill',      spriteKey: 'autominer-idle', maxStack: 5, type: 'placeable', description: 'Place on stone/ore to automatically harvest' },
  saw:        { id: 'saw',        label: 'Saw',         spriteKey: 'saw-idle',       maxStack: 5, type: 'placeable', description: 'Place on a tree to automatically harvest' },
  canon:      { id: 'canon',      label: 'Canon Lv.1', spriteKey: 'canon1-f2',     maxStack: 5, type: 'placeable', description: 'Shoots cannonballs at nearby enemies' },
  turret:     { id: 'turret',     label: 'Turret',     spriteKey: 'turret',         maxStack: 5, type: 'placeable', description: 'Shoots arrows at nearby enemies' },
  anvil:      { id: 'anvil',      label: 'Anvil',      spriteKey: 'item-anvil',     maxStack: 5, type: 'placeable', description: 'Durable obstacle that blocks enemies' },
};
