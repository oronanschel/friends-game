import { ItemKind } from '../items/items';
import type { Quest } from './quests';

/** A trade an NPC offers: the player gives `give` and receives `get`. */
export interface Trade {
  give: { kind: ItemKind; n: number };
  get: { kind: ItemKind; n: number };
  /** Said after a successful trade. */
  thanks: string;
}

/** Who an NPC is and what they say. */
export interface NpcDef {
  name: string;
  /** Shirt colour. */
  color: string;
  /** Hat colour, or none. */
  hat?: string;
  /** Where they live, in tiles from the spawn point. */
  home: { dx: number; dy: number };
  /** Lines shown one after another when you talk to them. */
  lines: string[];
  trade?: Trade;
  /** A one-time request; offered before the trade until it is done. */
  quest?: Quest;
}

/** The villagers who live around the spawn point. */
export const VILLAGERS: NpcDef[] = [
  {
    name: 'Mira the Baker',
    color: '#d0675b',
    hat: '#f4f1e8',
    home: { dx: 5, dy: -3 },
    lines: ['Welcome, traveller! Fresh bread every morning.', 'I could use some berries for my pies.'],
    trade: {
      give: { kind: ItemKind.Berry, n: 3 },
      get: { kind: ItemKind.Coin, n: 2 },
      thanks: 'Perfect, these are so ripe! Here are your coins.',
    },
  },
  {
    name: 'Ranger Tomas',
    color: '#5b7a3a',
    hat: '#7a5230',
    home: { dx: -6, dy: 2 },
    lines: [
      'Careful out there. Lions roam the open grasslands.',
      "They're quick, but if you hold Shift you can outrun them.",
      'Press M if you lose your way.',
    ],
    quest: {
      id: 'tomas-stew',
      title: "Ranger Tomas's stew",
      want: { kind: ItemKind.Mushroom, n: 3 },
      reward: { kind: ItemKind.Coin, n: 4 },
      ask: "I'm out of food for my patrol. Could you find me 3 mushrooms in the forest?",
      thanks: 'That will make a fine stew. Take these coins for your trouble!',
    },
  },
  {
    name: 'Juno the Collector',
    color: '#6a5acd',
    home: { dx: 2, dy: 6 },
    lines: ['Gems sparkle in the sand and the snow, did you know?', "Too far for me. I'll buy one for coins, though!"],
    quest: {
      id: 'juno-gems',
      title: "Juno's gem collection",
      want: { kind: ItemKind.Gem, n: 2 },
      reward: { kind: ItemKind.Coin, n: 12 },
      ask: 'My collection is missing two gems. Bring me 2 and I will pay you well!',
      thanks: 'Oh, they are beautiful! As promised, 12 coins.',
    },
    trade: {
      give: { kind: ItemKind.Coin, n: 5 },
      get: { kind: ItemKind.Gem, n: 1 },
      thanks: 'A fine deal! May it bring you luck.',
    },
  },
  {
    name: 'Pip',
    color: '#e0a83a',
    home: { dx: -3, dy: -6 },
    lines: ['Hi! Do you like mushrooms? They grow in the forests.', "Grandma makes soup. She'd pay you for some!"],
    trade: {
      give: { kind: ItemKind.Mushroom, n: 2 },
      get: { kind: ItemKind.Coin, n: 3 },
      thanks: 'Yay! Soup tonight! Here, take these coins.',
    },
  },
];
