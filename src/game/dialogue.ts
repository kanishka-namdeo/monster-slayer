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
    passDone: {
      cond: 'q_passActive&barghestsReady',
      entry: true,
      speaker: 'ELDER BRAM',
      text: 'The caravan master reports the pass road red with barghest blood. Ninety crowns, as posted.',
      action: 'crowns:90,questdone:q_pass,save',
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
        { label: "I\'LL KILL IT.", next: 'mainAccept' },
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
      text: "Welcome to the Sleeping Griffin. Bed\'s five crowns. Soup\'s free if you live to breakfast.",
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
        { label: "I\'LL HUNT.", next: 'wolvesAccept' },
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
      text: "A witcher! My stores run dry. FOOL\'S LEAF grows in the mire - bitter thing, three sprigs. Fetch them?",
      choices: [
        { label: 'For a price.', next: 'herbsAccept' },
        { label: 'Later.', next: 'browse' },
      ],
    },
    herbsAccept: {
      speaker: 'MIRA',
      text: "Sharp as your swords. Three leaves from the swamp - look for the glimmer. I\'ll make it worth the mud.",
      action: 'quest:q_herbs,save',
      next: null,
    },
    herbsDone: {
      cond: 'q_herbsActive&herbsReady',
      entry: true,
      speaker: 'MIRA',
      text: "Fresh fool\'s leaf! Bitter as grief. Take these - and the oil recipe discount is yours, Serpent.",
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
      text: "Mister! Your eyes are like a CAT\'S! Pa says witchers drink blood. Do you?",
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
      text: "Pa\'s a liar anyway. Hey - your medallion GLOWS when you walk past the reeds!",
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
      action: 'flag:wraithPeace,flag:wraithDone,questdone:q_wraith,take:locket:1,maxhp:5,xp:30,crowns:90,save',
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
        { label: 'Draw silver.', action: 'flag:wraithDestroy,flag:wraithDone,questdone:q_wraith,battle:wraith' },
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

  // ---------------- NORTHERN REACHES ----------------
  griffinintro: {
    start: {
      speaker: '',
      text: 'The wind dies. Above the north ridge, wings the width of a sail catch the light. The ROYAL GRIFFIN has seen you.',
      choices: [
        { label: 'FIGHT.', action: 'battle:griffin' },
        { label: 'BACK AWAY.', next: 'flee' },
      ],
    },
    flee: {
      speaker: '',
      text: 'She shrieks once - a sound like torn iron - and lets you stumble down the scree.',
      next: null,
    },
  },
  arachasintro: {
    start: {
      speaker: '',
      text: 'The reeds ahead are woven with bone and nekker-hide. The "wall" unfolds eight armored legs. The ARACHAS was camouflaged as the nest itself.',
      choices: [
        { label: 'FIGHT.', action: 'battle:arachas' },
        { label: 'BACK AWAY.', next: 'flee' },
      ],
    },
    flee: {
      speaker: '',
      text: 'You step back slowly. The bone-wall folds shut behind you like a closing fist.',
      next: null,
    },
  },
  katakanintro: {
    start: {
      speaker: '',
      text: 'In the heart of the keep, something wears a witcher\'s face over its own. It smiles with too many teeth. The KATAKAN was waiting for a Serpent.',
      choices: [
        { label: 'FIGHT.', action: 'battle:katakan' },
        { label: 'BACK AWAY.', next: 'flee' },
      ],
    },
    flee: {
      speaker: '',
      text: 'It laughs - in a dead witcher\'s voice - and lets you carry your fear back down the pass.',
      next: null,
    },
  },

  // ---------------- TRAPPER WOY (Fangtooth Pass) ----------------
  trapper: {
    intro: {
      cond: '!griffinDone',
      entry: true,
      speaker: 'WOY',
      text: 'Don\'t mind the arm. The winged one did it - took my partner whole and spat out his boots. Up the north ridge, her EYRIE.',
      choices: [
        { label: 'I\'LL TAKE THE JOB.', next: 'accept' },
        { label: 'Just passing.', next: 'passing' },
      ],
    },
    accept: {
      speaker: 'WOY',
      text: 'One hundred fifty crowns, caravan\'s coin pooled. Mind her dives - AARD her out of the sky if you can.',
      action: 'quest:q_griffin,flag:griffinStarted,save',
      next: null,
    },
    passing: {
      speaker: 'WOY',
      text: 'Then keep to the low path. She hunts anything that walks the ridge.',
      next: null,
    },
    remind: {
      cond: 'q_griffinActive&!griffinDone',
      entry: true,
      speaker: 'WOY',
      text: 'The eyrie is the nest of white sticks up the north ridge. She sees you long before you see her.',
      next: null,
    },
    turnin: {
      cond: 'griffinDone&!griffinPaid',
      entry: true,
      speaker: 'WOY',
      text: 'The pass is quiet... Caravan\'s pooled one hundred fifty crowns. Take them, witcher. And this - my father\'s whetstone. His steel always sang after.',
      action: 'crowns:150,flag:griffinPaid,questdone:q_griffin,give:swallow:2,save',
      next: null,
    },
    after: {
      cond: 'griffinPaid',
      entry: true,
      speaker: 'WOY',
      text: 'Carts are rolling again. If you head north - the old keep, Kaer Serpen - light a candle for the dead School. And keep your steel oiled.',
      next: null,
    },
  },

  // ---------------- OLD KETTLE (Crookback Bog) ----------------
  kettle: {
    intro: {
      cond: '!metKettle',
      entry: true,
      speaker: 'OLD KETTLE',
      text: 'Heh. Folk come to Crookback to die or to trade. Which are you, pretty witcher?',
      choices: [
        { label: 'TO TRADE.', next: 'trade' },
        { label: 'To die, eventually.', next: 'flavor' },
      ],
    },
    trade: {
      speaker: 'OLD KETTLE',
      text: 'Ha! Honest AND alive. Kettle\'s Hollow has tinctures, oils, and prices that keep the bog fed.',
      action: 'flag:metKettle,shop:kettle,save',
      next: null,
    },
    flavor: {
      speaker: 'OLD KETTLE',
      text: 'Aren\'t we all. Bring Kettle your crowns anyway - dying is cheaper with a potion in your gut.',
      action: 'flag:metKettle,shop:kettle,save',
      next: null,
    },
    shop: {
      cond: 'metKettle&!arachasDone',
      entry: true,
      speaker: 'OLD KETTLE',
      text: 'Back again? The bog keeps you fed, you keep me paid. Wares are wares.',
      choices: [
        { label: 'SHOW WARES.', action: 'shop:kettle,save' },
        { label: 'The bog\'s beasts?', next: 'beasts' },
      ],
    },
    beasts: {
      speaker: 'OLD KETTLE',
      text: 'Nekkers by the dozen - small, black, never one at a time. And in the mist... FOGLETS. Follow their lanterns and you feed the reeds.',
      choices: [
        { label: 'NEKKERS IT IS.', next: 'nekkeroffer' },
        { label: 'AND THE MIST?', next: 'fogoffer' },
      ],
    },
    nekkeroffer: {
      speaker: 'OLD KETTLE',
      text: 'Four less of them, seventy-five crowns. They killed a goat I was fattening. Nothing personal to the goat.',
      action: 'quest:q_nekkers,save',
      next: null,
    },
    fogoffer: {
      speaker: 'OLD KETTLE',
      text: 'Two foglets banished, eighty crowns. Burn the mist with that fire-sign of yours - oil alone won\'t find them.',
      action: 'quest:q_fog,save',
      next: null,
    },
    nekkerturnin: {
      cond: 'q_nekkersActive&nekkersReady',
      entry: true,
      speaker: 'OLD KETTLE',
      text: 'Four nekkers belly-up. The goat is avenged. Seventy-five crowns, as promised.',
      action: 'crowns:75,questdone:q_nekkers,save',
      next: null,
    },
    fogturnin: {
      cond: 'q_fogActive&fogReady',
      entry: true,
      speaker: 'OLD KETTLE',
      text: 'The mist hangs empty where the foglets walked. Eighty crowns, witcher. You earn prettier than you look.',
      action: 'crowns:80,questdone:q_fog,save',
      next: null,
    },
    arachasoffer: {
      cond: 'q_nekkersDone&!arachasDone&!q_arachasActive',
      entry: true,
      speaker: 'OLD KETTLE',
      text: 'One more thing. Something ARMORED has been eating my nekkers. East reeds, the bone-wall. Kettle calls her the MOTHER OF THE BOG.',
      choices: [
        { label: 'I\'LL KILL THE MOTHER.', next: 'arachasaccept' },
        { label: 'Another day.', next: null },
      ],
    },
    arachasaccept: {
      speaker: 'OLD KETTLE',
      text: 'Heh. One hundred twenty crowns. Coat your blade with the INSECTOID OIL I sell - her shell turns plain steel.',
      action: 'quest:q_arachas,flag:arachasStarted,save',
      next: null,
    },
    arachasturnin: {
      cond: 'arachasDone&!arachasPaid',
      entry: true,
      speaker: 'OLD KETTLE',
      text: 'The Mother is dead and the bog knows it. The reeds stand straighter. One hundred twenty crowns - and a jar of my best, on the house.',
      action: 'crowns:120,flag:arachasPaid,questdone:q_arachas,give:honey:1,save',
      next: null,
    },
    doneshop: {
      cond: 'arachasDone',
      entry: true,
      speaker: 'OLD KETTLE',
      text: 'The bog is quiet as a church now. Wares for you anytime.',
      choices: [
        { label: 'SHOW WARES.', action: 'shop:kettle,save' },
        { label: 'FAREWELL.', next: null },
      ],
    },
  },

  // ---------------- THE PALE WITCHER (Kaer Serpen) ----------------
  shade: {
    intro: {
      cond: '!katakanDone',
      entry: true,
      speaker: 'PALE WITCHER',
      text: 'A Serpent medallion... So the School still crawls. I trained in this hall. I died in it too. The thing in the keep\'s heart wears our faces now.',
      choices: [
        { label: 'WHAT IS IT?', next: 'what' },
        { label: 'Rest, brother.', next: 'rest' },
      ],
    },
    what: {
      speaker: 'PALE WITCHER',
      text: 'A KATAKAN. A higher vampire that drank the garrison when the keep fell. Only SPECTER OIL bites it - plain steel passes like a lie.',
      next: 'offer',
    },
    offer: {
      cond: 'leshanDone',
      speaker: 'PALE WITCHER',
      text: 'You felled the forest king - I felt the crows settle. Then finish this too. Two hundred fifty crowns sleep in the vault below. End our shame.',
      choices: [
        { label: 'I\'LL END IT.', next: 'accept' },
        { label: 'Not yet.', next: null },
      ],
    },
    offeryet: {
      cond: '!leshanDone',
      speaker: 'PALE WITCHER',
      text: 'But you reek of the forest heart\'s rot. Finish your Leshen first, brother. The katakan has waited a century - it can wait a season.',
      next: null,
    },
    accept: {
      speaker: 'PALE WITCHER',
      text: 'Serpent\'s blessing on your blades. The heart of the keep is straight north, between the shrines. Do not believe the faces it shows you.',
      action: 'quest:q_katakan,flag:katakanStarted,save',
      next: null,
    },
    rest: {
      speaker: 'PALE WITCHER',
      text: 'Rest is a village word, witcher. I rest when the keep does.',
      next: null,
    },
    remind: {
      cond: 'q_katakanActive&!katakanDone',
      entry: true,
      speaker: 'PALE WITCHER',
      text: 'The heart of the keep, past the shrines. SPECTER OIL. And when it wears your own face - swing anyway.',
      next: null,
    },
    freed: {
      cond: 'katakanDone&!katakanPaid',
      entry: true,
      speaker: 'PALE WITCHER',
      text: 'The keep breathes... The vault is yours, as I promised. Two hundred fifty crowns. Spend them in sunlight, brother.',
      action: 'crowns:250,flag:katakanPaid,questdone:q_katakan,give:specteroil:1,save',
      next: null,
    },
    after: {
      cond: 'katakanPaid',
      entry: true,
      speaker: 'PALE WITCHER',
      text: 'The School of the Serpent has one living blade again. Walk the Path well, witcher. I can rest now.',
      next: null,
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
    label: "A WOLF\'S HUNGER",
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
    text: "Wanted: FOOL\'S LEAF x3 from the mire. Fair pay in tinctures. - MIRA, HERBALIST",
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
    id: 'b_pass',
    label: 'WINGS OVER THE PASS',
    text: 'Barghests run down carts on FANGTOOTH PASS (north of the wood). Three kills, ninety crowns. - CARAVAN MASTER',
    action: 'quest:q_pass',
    cond: '!q_passActive&!q_passDone',
  },
  {
    id: 'b_nekkers',
    label: 'LITTLE HORRORS',
    text: 'Nekkers nest in CROOKBACK BOG (east of the mire). Cull four before they carry off a child. Seventy-five crowns. - OLD KETTLE',
    action: 'quest:q_nekkers',
    cond: '!q_nekkersActive&!q_nekkersDone',
  },
  {
    id: 'b_fog',
    label: 'TEETH IN THE MIST',
    text: 'Follow no lantern in the bog. FOGLETS wait in the mist of Crookback. Two banished, eighty crowns. - MIRA, HERBALIST',
    action: 'quest:q_fog',
    cond: '!q_fogActive&!q_fogDone',
  },
  {
    id: 'b_passclosed',
    label: 'PASS CLOSED',
    text: 'Fangtooth Pass is closed to carts until the winged one is dealt with. Letters will be held at the forge. - ROAD WARDEN',
    cond: '!griffinDone',
  },
  {
    id: 'b_lights',
    label: 'DO NOT FOLLOW THE LIGHTS',
    text: 'If you see lanterns moving in Crookback Bog, they are not lanterns. This notice is paid for by the family of ODD.',
    cond: '',
  },
  {
    id: 'b_dance',
    label: 'DANCE CANCELLED',
    text: 'The harvest dance is cancelled until further notice. The fiddler was eaten.',
    cond: '',
  },
];
