import { ItemStack } from './GameState';
import { ITEMS } from '../data/items';

/**
 * Adds itemId×quantity into the player's slots.
 * Fills hotbar first (stacking then empty), then inventory.
 * Returns true if all quantity was placed.
 */
export function addItem(
  hotbar: (ItemStack | null)[],
  inventory: (ItemStack | null)[],
  itemId: string,
  quantity: number,
): boolean {
  const maxStack = ITEMS[itemId]?.maxStack ?? 99;
  let rem = quantity;

  for (const slots of [hotbar, inventory]) {
    for (const slot of slots) {
      if (!slot || slot.itemId !== itemId) continue;
      const space = maxStack - slot.quantity;
      if (space <= 0) continue;
      const add = Math.min(space, rem);
      slot.quantity += add;
      rem -= add;
      if (rem <= 0) return true;
    }
  }

  for (const slots of [hotbar, inventory]) {
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] !== null) continue;
      const add = Math.min(maxStack, rem);
      slots[i] = { itemId, quantity: add };
      rem -= add;
      if (rem <= 0) return true;
    }
  }

  return rem <= 0;
}

/**
 * Removes itemId×quantity from hotbar then inventory.
 * Returns true if the full quantity was removed; false (no mutation) if insufficient.
 */
export function removeItem(
  hotbar: (ItemStack | null)[],
  inventory: (ItemStack | null)[],
  itemId: string,
  quantity: number,
): boolean {
  let available = 0;
  for (const slots of [hotbar, inventory]) {
    for (const slot of slots) {
      if (slot?.itemId === itemId) available += slot.quantity;
    }
  }
  if (available < quantity) return false;

  let rem = quantity;
  for (const slots of [hotbar, inventory]) {
    for (let i = 0; i < slots.length && rem > 0; i++) {
      const slot = slots[i];
      if (!slot || slot.itemId !== itemId) continue;
      const take = Math.min(slot.quantity, rem);
      slot.quantity -= take;
      if (slot.quantity === 0) slots[i] = null;
      rem -= take;
    }
  }
  return true;
}
