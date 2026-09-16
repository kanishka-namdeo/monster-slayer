// ============================================================
// Dialogue trees. Nodes keyed by id; engine picks entry node.
// Action codes: flag:x | give:item:n | take:item:n | crowns:n
//   quest:id | questdone:id | shop:x | rest | heal | battle:x
//   board | end | save | maxhp:n | xp:n
// ============================================================

export interface DlgChoice {
  label: string;
  next?: string | null;
  action?: string;
  cond?: string;
}

export interface DlgNode {
  speaker?: string;
  text?: string;
  cond?: string;             // entry condition: flag expr (a & !b)
  entry?: boolean;           // valid conversation entry point
  choices?: DlgChoice[];
  next?: string | null;
  action?: string;
}

export type DlgTree = Record<string, DlgNode>;

export const DIALOGUES: Record<string, DlgTree> = {
  // ---------------- ELDER BRAM ----------------
  bram: {
    intro0: {
      cond: '!metElder',
      entry: true,
      speaker: 'ELDER BRAM',
      text: 'Another witcher. Third this year... The first two did not come back from the mire.',
      choices: [
        { label: 'Work is work.', next: 'intro1' },
        { label: 'Charming place.', next: 'intro1b' },
      ],
    },
    intro1b: {
      speaker: 'ELDER BRAM',
      text: 'It was, once. Contracts hang on the BOARD by the well. Coin when the beasts are dead.',
      action: 'flag:metElder,questdone:q_intro,save',
      next: null,
    },
    intro1: {
      speaker: 'ELDER BRAM',
      text: 'Hm. It was, once. Contracts hang on the BOARD by the well. Coin when the beasts are dead.',
      action: 'flag:metElder,questdone:q_intro,save',
      next: null,
    },
    drownersDone: {
      cond: 'q_drownersActive&drownersReady',
      entry: true,
      speaker: 'ELDER BRAM',
      text: 'Three drowners float belly-up in the mire. Fishermen sing your name, witcher.',
      next: 'drownersPay',
    },
    drownersPay: {
      speaker: 'ELDER BRAM',
      text: 'Sixty crowns, as posted. ...The graves weep at night, too. If you have the stomach for it.',
      action: 'crowns:60,questdone:q_drowners,save',
      next: null,
    },
    mainOffer: {
      cond: 'contractsDone&!mainStarted',
      entry: true,
      speaker: 'ELDER BRAM',
      text: 'You did what two witchers could not. But it was never the drowners. It is the forest HEART.',
      next: 'mainOffer2',
    },
    mainOffer2: {
      speaker: 'ELDER BRAM',
      text: 'A LESHEN has claimed the old shrine past the northern thorns. The village withers with the wood.',
      choices: [
        { label: 'NAME A PRICE.', next: 'mainAccept' },
        { label: "I'LL KILL IT.", next: 'mainAccept' },
      ],
    },
    mainAccept: {
      speaker: 'ELDER BRAM',
      text: 'Everything in the coffers. My men clear the thorns at dawn. Go with both swords loose, Serpent.',
      action: 'flag:thornsCleared,flag:mainStarted,quest:q_main,save',
      next: null,
    },
    leshenDone: {
      cond: 'leshenDone',
      entry: true,
      speaker: 'ELDER BRAM',
      text: 'The crows came back at noon. All of them. At ONCE. ...Is it done, witcher?',
      next: 'epilogue',
    },
    epilogue: {
      speaker: 'ELDER BRAM',
      text: 'Then Hollow Creek owes you more than coin. Rest tonight. Tomorrow we speak of the future.',
      action: 'end',
      next: null,
    },
    idle: {
      entry: true,
      speaker: 'ELDER BRAM',
      text: 'The BOARD by the well lists what bites us. Mind the reeds - and the graves.',
      next: null,
    },
  },

  // ---------------- INNKEEPER PETRA ----------------
  petra: {
    start: {
      entry: true,
      speaker: 'PETRA',
      text: "Welcome to the Sleeping Griffin. Bed's five crowns. Soup's free if you live to breakfast.",
      choices: [
        { label: 'Rest (5c)', next: 'restAsk', action: '' },
        { label: 'Just talk.', next: 'talk' },
        { label: 'Nothing.', next: null },
      ],
    },
    restAsk: {
      speaker: 'PETRA',
      text: 'A bed it is. Sleep tight, witcher. Wake up less poisoned.',
      action: 'rest',
      next: null,
    },
    talk: {
      speaker: 'PETRA',
      text: 'The widow AGNES drowned herself when her husband never came home from the war. Now something weeps in the graves.',
      next: 'talk2',
    },
    talk2: {
      speaker: 'PETRA',
      text: 'Old Torv lost his boy to the wolves. And the swamp... the swamp was never kind. Choose your contracts, witcher.',
      next: null,
    },
  },

  // ---------------- SMITH TORV ----------------
  torv: {
    wolvesOffer: {
      cond: '!q_wolvesActive&!q_wolvesDone',
      entry: true,
      speaker: 'TORV',
      text: 'Steel? Silver? Or gossip? ...Wolves took my best ewe. FOUR nights running. My boy wont even sleep.',
      choices: [
        { label: "I'LL HUNT.", next: 'wolvesAccept' },
        { label: 'JUST BROWSING.', next: 'browse' },
      ],
    },
    wolvesAccept: {
      speaker: 'TORV',
      text: 'Seventy crowns for four wolf pelts, witcher. Oldewood, north. Make them regret the ewe.',
      action: 'quest:q_wolves,save',
      next: null,
    },
    wolvesDone: {
      cond: 'q_wolvesActive&wolvesReady',
      entry: true,
      speaker: 'TORV',
      text: 'Four pelts. My boy slept through the night - first time since spring. Here. Seventy, as posted.',
      action: 'crowns:70,questdone:q_wolves,save',
      next: 'browse',
    },
    browse: {
      entry: true,
      speaker: 'TORV',
      text: 'Forge is hot. Blades, armor - or bring me tongues and pelts, I pay fair.',
      choices: [
        { label: 'Show wares.', action: 'shop:torv' },
        { label: 'Sell parts.', action: 'shop:torv' },
        { label: 'Leave.', next: null },
      ],
    },
  },

  // ---------------- HERBALIST MIRA ----------------
  mira: {
    herbsOffer: {
      cond: '!q_herbsActive&!q_herbsDone',
      entry: true,
      speaker: 'MIRA',
      text: "A witcher! My stores run dry. FOOL'S LEAF grows in the mire - bitter thing, three sprigs. Fetch them?",
      choices: [
        { label: 'For a price.', next: 'herbsAccept' },
        { label: 'Later.', next: 'browse' },
      ],
    },
    herbsAccept: {
      speaker: 'MIRA',
      text: "Sharp as your swords. Three leaves from the swamp - look for the glimmer. I'll make it worth the mud.",
      action: 'quest:q_herbs,save',
      next: null,
    },
    herbsDone: {
      cond: 'q_herbsActive&herbsReady',
      entry: true,
      speaker: 'MIRA',
      text: "Fresh fool's leaf! Bitter as grief. Take these - and the oil recipe discount is yours, Serpent.",
      action: 'give:swallow:2,give:honey:1,take:foolleaf:3,questdone:q_herbs,save',
      next: 'browse',
    },
    browse: {
      entry: true,
      speaker: 'MIRA',
      text: 'Potions, oils, salves. A witcher who shuns alchemy is a dead witcher. Mostly.',
      choices: [
        { label: 'Browse.', action: 'shop:mira' },
        { label: 'About the wraith.', next: 'wraithHint', cond: 'q_wraithActive' },
        { label: 'Leave.', next: null },
      ],
    },
    wraithHint: {
      speaker: 'MIRA',
      text: 'Plain silver passes through grief, witcher. Anoint your blade with SPECTER OIL... or find what chains her here.',
      next: null,
    },
  },

  // ---------------- VILLAGERS ----------------
  kid: {
    start: {
      speaker: 'TOMMEN',
      text: "Mister! Your eyes are like a CAT'S! Pa says witchers drink blood. Do you?",
      choices: [
        { label: 'ON TUESDAYS.', next: 'laugh' },
        { label: 'NO.', next: 'aww' },
      ],
    },
    laugh: {
      speaker: 'TOMMEN',
      text: 'HA! I KNEW IT! The reeds by the swamp rustle at night. Pa says never go. I say GO.',
      next: null,
    },
    aww: {
      speaker: 'TOMMEN',
      text: "Pa's a liar anyway. Hey - your medallion GLOWS when you walk past the reeds!",
      next: null,
    },
  },
  villager1: {
    start: {
      speaker: 'VILLAGER',
      text: 'Monsters took our finest pig. The BOARD by the well lists what is biting us this week.',
      next: null,
    },
  },
  patron: {
    start: {
      speaker: 'PATRON',
      text: 'Burp. I saw a GRIFFIN once. Big as a barn. Nobody believes me... Your medallion is humming, witcher. Drink?',
      next: null,
    },
  },
  fisher: {
    start: {
      speaker: 'OLD FISHER',
      text: 'Reeds teem with drowners. One took my boot. THE BOOT, witcher. Watch the tall reeds - they rustle before they strike.',
      next: null,
    },
  },

  // ---------------- WIDOW AGNES (ghost) ----------------
  agnes: {
    locket: {
      cond: 'wraithMet&hasLocket',
      entry: true,
      speaker: 'AGNES',
      text: 'You found it... his locket... warm... like his hand... May I?',
      choices: [
        { label: 'GIVE THE LOCKET', next: 'peace' },
        { label: 'DESTROY WRAITH', next: 'destroyAsk' },
      ],
    },
    waiting: {
      cond: 'wraithMet',
      entry: true,
      speaker: 'AGNES',
      text: 'Find it... by the stones... his hand was warm, once... so warm...',
      next: null,
    },
    start: {
      cond: '!wraithChoiceMade',
      entry: true,
      speaker: '???',
      text: 'Cold... so cold... he never came home...',
      choices: [
        { label: 'Who never came home?', next: 'who' },
        { label: 'Pass on, spirit.', next: 'pass' },
      ],
    },
    who: {
      speaker: 'AGNES',
      text: 'My husband. The war ate him. They buried me ALONE... with his silver locket...',
      next: 'who2',
    },
    who2: {
      speaker: 'AGNES',
      text: 'It fell... by the stones... Find it... and I may sleep...',
      action: 'flag:wraithMet',
      next: null,
    },
    pass: {
      speaker: 'AGNES',
      text: 'Cannot... will not... the cold holds me like he never could...',
      action: 'flag:wraithMet',
      next: null,
    },
    peace: {
      speaker: 'AGNES',
      text: 'Ahh... the pond in summer... Bran, my love, I am coming... Your path is clear, Serpent. Take my cold blessing.',
      action: 'flag:wraithPeace,flag:wraithDone,take:locket:1,maxhp:5,xp:30,crowns:90,save',
      next: 'peaceEnd',
    },
    peaceEnd: {
      speaker: '',
      text: 'The air softens. The weeping stops. Only wind in the yew trees remains.',
      action: 'flag:wraithDone',
      next: null,
    },
    destroyAsk: {
      speaker: 'AGNES',
      text: 'Then cut, witcher. Grief has teeth...',
      choices: [
        { label: 'Draw silver.', action: 'flag:wraithDestroy,flag:wraithDone,battle:wraith' },
        { label: 'Wait. Not yet.', next: null },
      ],
    },
  },

  // ---------------- FIXED BATTLE TRIGGERS ----------------
  wwintro: {
    start: {
      speaker: '',
      text: 'A shape lopes between the pines - half hunter, half moonmad beast. It smells the curse on itself... and on you.',
      choices: [
        { label: 'FIGHT.', action: 'battle:werewolf' },
        { label: 'BACK AWAY.', next: 'flee' },
      ],
    },
    flee: {
      speaker: '',
      text: 'The werewolf lets you go. It is saving you... for the moon.',
      next: null,
    },
  },
  leshintro: {
    start: {
      speaker: '',
      text: 'The crows fall silent. The forest holds its breath. A crown of ANTLERS rises from the roots of the old shrine.',
      choices: [
        { label: 'Time to hunt.', action: 'battle:leshen' },
        { label: 'Not yet.', next: null },
      ],
    },
  },

  // ---------------- SIGN / TUTORIAL FLAVOR ----------------
  boardSign: {
    start: {
      speaker: 'BOARD',
      text: 'Nails, rope, and parchment. The contracts of Hollow Creek flutter in the wind.',
      next: null,
    },
  },
};

// ------------------------------------------------------------
// NOTICE BOARD entries (engine builds dynamic menu)
// ------------------------------------------------------------
export interface BoardEntry {
  id: string;
  label: string;
  text: string;
  action?: string;          // quest:start etc
  cond?: string;            // show condition
}

export const BOARD_ENTRIES: BoardEntry[] = [
  {
    id: 'b_drowners',
    label: 'RATS IN THE REEDS',
    text: 'DROWNERS foul the eastern mire. Three confirmed kills, sixty crowns. - ELDER BRAM',
    action: 'quest:q_drowners',
    cond: '!q_drownersActive&!q_drownersDone',
  },
  {
    id: 'b_wolves',
    label: "A WOLF'S HUNGER",
    text: 'Wolves slaughter livestock by night. Four pelts, seventy crowns. - TORV, SMITH',
    action: 'quest:q_wolves',
    cond: '!q_wolvesActive&!q_wolvesDone',
  },
  {
    id: 'b_wraith',
    label: 'THE WEEPING WIDOW',
    text: 'Something WEEPS in Weeping Graves. Our children cannot mourn in peace. Ninety crowns. - CONCERNED FAMILIES',
    action: 'quest:q_wraith,flag:wraithStarted',
    cond: '!q_wraithActive&!q_wraithDone',
  },
  {
    id: 'b_herbs',
    label: 'BITTER REMEDIES',
    text: "Wanted: FOOL'S LEAF x3 from the mire. Fair pay in tinctures. - MIRA, HERBALIST",
    action: 'quest:q_herbs',
    cond: '!q_herbsActive&!q_herbsDone',
  },
  {
    id: 'b_lost',
    label: 'LOST: ONE BOOT',
    text: 'Lost near the reeds. Sentimental value. Reward: gratitude. - THE FISHER',
    cond: '',
  },
  {
    id: 'b_dance',
    label: 'DANCE CANCELLED',
    text: 'The harvest dance is cancelled until further notice. The fiddler was eaten.',
    cond: '',
  },
];
