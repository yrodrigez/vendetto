export const CLASS_COLORS: Record<string, number> = {
    warrior:  0xC79C6E,
    paladin:  0xF58CBA,
    hunter:   0xABD473,
    rogue:    0xFFF569,
    priest:   0xFFFFFF,
    shaman:   0x0070DE,
    mage:     0x69CCF0,
    warlock:  0x9482C9,
    druid:    0xFF7D0A,
};

export const CLASS_ARMOR: Record<string, string[]> = {
    warrior:  ['Plate', 'Mail', 'Leather', 'Cloth', 'Miscellaneous', 'Shield'],
    paladin:  ['Plate', 'Mail', 'Leather', 'Cloth', 'Miscellaneous', 'Shield', 'Libram'],
    hunter:   ['Mail', 'Leather', 'Cloth', 'Miscellaneous'],
    rogue:    ['Leather', 'Cloth', 'Miscellaneous'],
    priest:   ['Cloth', 'Miscellaneous'],
    shaman:   ['Mail', 'Leather', 'Cloth', 'Miscellaneous', 'Shield', 'Totem'],
    mage:     ['Cloth', 'Miscellaneous'],
    warlock:  ['Cloth', 'Miscellaneous'],
    druid:    ['Leather', 'Cloth', 'Miscellaneous', 'Idol'],
};

export const ROLE_PRIMARY_STATS: Record<string, string[]> = {
    tank:   ['Stamina', 'Agility', 'Strength', 'Defense', 'dodge', 'parry', 'block'],
    healer: ['Intellect', 'Spirit', 'spell', 'healing', 'mana'],
    dps:    ['Strength', 'Agility', 'attack power', 'critical', 'hit', 'haste', 'expertise', 'armor penetration'],
    rdps:   ['Intellect', 'spell', 'critical', 'hit', 'haste', 'damage'],
    mdps:   ['Strength', 'Agility', 'attack power', 'critical', 'hit', 'haste', 'expertise', 'armor penetration'],
};

const CASTER_NEGATIVE = ['Intellect', 'Spirit', 'spell', 'healing', 'mana'];
const MELEE_NEGATIVE = ['Strength', 'Agility', 'attack power', 'expertise', 'armor penetration', 'Defense', 'dodge', 'parry', 'block'];

export const NEGATIVE_STATS: Record<string, string[]> = {
    'warrior:tank':   CASTER_NEGATIVE,
    'warrior:dps':    CASTER_NEGATIVE,
    'warrior:mdps':   CASTER_NEGATIVE,
    'rogue:dps':      CASTER_NEGATIVE,
    'rogue:mdps':     CASTER_NEGATIVE,
    'hunter:dps':     ['Spirit', 'healing', 'mana'],
    'hunter:rdps':    ['Spirit', 'healing', 'mana'],
    'mage:rdps':      MELEE_NEGATIVE,
    'warlock:rdps':   MELEE_NEGATIVE,
    'priest:healer':  MELEE_NEGATIVE,
    'priest:rdps':    MELEE_NEGATIVE,
    'druid:healer':   ['Strength', 'attack power', 'expertise', 'armor penetration', 'Defense', 'parry', 'block'],
    'druid:tank':     CASTER_NEGATIVE,
    'druid:dps':      CASTER_NEGATIVE,
    'druid:mdps':     CASTER_NEGATIVE,
    'druid:rdps':     MELEE_NEGATIVE,
    'paladin:tank':   ['Spirit'],
    'paladin:dps':    ['Spirit', 'healing'],
    'paladin:mdps':   ['Spirit', 'healing'],
    'paladin:healer': ['Strength', 'Agility', 'attack power', 'expertise', 'armor penetration'],
    'shaman:healer':  ['Strength', 'Agility', 'attack power', 'expertise', 'armor penetration'],
    'shaman:dps':     ['Spirit', 'healing'],
    'shaman:mdps':    ['Spirit', 'healing'],
    'shaman:rdps':    ['Strength', 'Agility', 'attack power', 'expertise', 'armor penetration'],
};
