import { ItemStack } from './GameState';
import { RecipeDefinition } from '../data/recipes';
import { addItem } from './InventorySystem';

function countItem(slots: (ItemStack | null)[], itemId: string): number {
  let total = 0;
  for (const slot of slots) {
    if (slot?.itemId === itemId) total += slot.quantity;
  }
  return total;
}

/** Returns true if combined hotbar + inventory contains all recipe inputs. */
export function canCraft(
  hotbar: (ItemStack | null)[],
  inventory: (ItemStack | null)[],
  recipe: RecipeDefinition,
): boolean {
  for (const input of recipe.inputs) {
    if (countItem(hotbar, input.itemId) + countItem(inventory, input.itemId) < input.quantity) {
      return false;
    }
  }
  return true;
}

/**
 * Removes inputs from hotbar+inventory and adds outputs.
 * Returns false without any mutation if materials are insufficient.
 */
export function doCraft(
  hotbar: (ItemStack | null)[],
  inventory: (ItemStack | null)[],
  recipe: RecipeDefinition,
): boolean {
  if (!canCraft(hotbar, inventory, recipe)) return false;

  for (const input of recipe.inputs) {
    let rem = input.quantity;
    for (const slots of [hotbar, inventory]) {
      for (let i = 0; i < slots.length && rem > 0; i++) {
        const slot = slots[i];
        if (!slot || slot.itemId !== input.itemId) continue;
        const take = Math.min(slot.quantity, rem);
        slot.quantity -= take;
        if (slot.quantity === 0) slots[i] = null;
        rem -= take;
      }
    }
  }

  for (const output of recipe.outputs) {
    addItem(hotbar, inventory, output.itemId, output.quantity);
  }

  return true;
}
