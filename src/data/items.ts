export interface ItemDefinition {
  id: string;
  label: string;
  spriteKey: string;
  maxStack: number;
  type: 'resource' | 'tool' | 'weapon' | 'ammo' | 'placeable' | 'consumable';
}

export const ITEMS: Record<string, ItemDefinition> = {
  // ── Resources ──────────────────────────────────────────────────────────────
  wood:       { id: 'wood',       label: 'Wood',       spriteKey: 'item-branch',     maxStack: 99, type: 'resource' },
  stone:      { id: 'stone',      label: 'Stone',      spriteKey: 'item-rock',       maxStack: 99, type: 'resource' },
  iron_ore:   { id: 'iron_ore',   label: 'Iron Ore',   spriteKey: 'item-iron-ore',   maxStack: 99, type: 'resource' },
  copper_ore: { id: 'copper_ore', label: 'Copper Ore', spriteKey: 'item-copper-ore', maxStack: 99, type: 'resource' },
  leather:    { id: 'leather',    label: 'Leather',    spriteKey: 'item-leather',    maxStack: 99, type: 'resource' },
  gem:        { id: 'gem',        label: 'Gem',        spriteKey: 'item-gem',        maxStack: 99, type: 'resource' },
  bullet:     { id: 'bullet',     label: 'Bullet',     spriteKey: 'item-bullet',     maxStack: 99, type: 'ammo'     },

  // ── Tools ──────────────────────────────────────────────────────────────────
  stone_axe:      { id: 'stone_axe',      label: 'Stone Axe',      spriteKey: 'item-stone-axe',      maxStack: 1, type: 'tool' },
  stone_pickaxe:  { id: 'stone_pickaxe',  label: 'Stone Pickaxe',  spriteKey: 'item-stone-pickaxe',  maxStack: 1, type: 'tool' },
  repair_hammer:  { id: 'repair_hammer',  label: 'Repair Hammer',  spriteKey: 'item-repair-hammer',  maxStack: 1, type: 'tool' },

  // ── Weapons ────────────────────────────────────────────────────────────────
  stone_sword:  { id: 'stone_sword',  label: 'Stone Sword',  spriteKey: 'item-stone-sword',  maxStack: 1, type: 'weapon' },
  copper_sword: { id: 'copper_sword', label: 'Copper Sword', spriteKey: 'item-copper-sword', maxStack: 1, type: 'weapon' },
  pistol:       { id: 'pistol',       label: 'Pistol',       spriteKey: 'item-pistol',       maxStack: 1, type: 'weapon' },

  // ── Placeables ─────────────────────────────────────────────────────────────
  auto_miner: { id: 'auto_miner', label: 'Auto Miner', spriteKey: 'autominer-idle', maxStack: 5, type: 'placeable' },
};
