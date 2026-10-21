import { ItemKind } from '../items/items';

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
  },
  {
    name: 'Juno the Collector',
    color: '#6a5acd',
    home: { dx: 2, dy: 6 },
    lines: ['Gems sparkle in the sand and the snow, did you know?', "Too far for me. I'll buy one for coins, though!"],
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
