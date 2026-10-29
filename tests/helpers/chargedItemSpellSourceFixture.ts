import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import {hydrateSpellLookup} from '../../src/data/spellLookup';
import type {Entry} from '../../src/core/model';

// Pure source boundary: no Character factory, state, engine, actor or the
// evidence generated/checked from this helper. Cached Entries must be cloned
// by consumers before any card mutation.
export interface ChargedItemSpellSpec {ownerId:string;branchKey:string;targetId:string;targetInputPath:string;targetOriginalPath:string;targetOriginalSortedSha256:string;originalOwnerPath:string;originalOwnerSortedSha256:string;canonicalPoolAnchorSha256:string;cost:1;minAfter:0|1;castLevel:number;targetScope:'self'|'spell';sourceActionTiming:'action';timingBasis:'item-override'|'spell-default-policy';sourcePhysicalConstraint:'held'|'worn'|'worn-or-held';statistics:{kind:'none'}|{kind:'fixed-dc';saveDC:number};sourceDeclaredSaveDC:number|null;policyCode:'DMG'|'XDMG';sourceBinding:string;clauses:{path:string;sha256:string}[];manualBoundaries:string[]}
export const chargedItemSpellInputPins=[
 {path:'items-base.json',sha256:'8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff',bytes:149813},
 {path:'items.json',sha256:'883f7bb4df2eb35fb37e7caa3a8765e0209014caa360d1c0358daa6f4b2da488',bytes:2458443},
 {path:'magicvariants.json',sha256:'4a4b0f3c8b268d8b134386f16e705df9b14d60419b2f2fa160da45b78bd4967d',bytes:190573},
 {path:'spells/spells-phb.json',sha256:'e1f2221020cfb5d31995c99b78dc09435c9962476ef1cef81b52399e6df0263d',bytes:514953},
 {path:'spells/spells-xphb.json',sha256:'87e4b76595ea895e01641de2cba3d75bff590957f08a9210530c28ffa296770d',bytes:500124},
 {path:'generated/gendata-spell-source-lookup.json',sha256:'8b78d1ce68d080a760b41bc65e846755c98fa1a3916b70d3d5d0dc8f5af1b9a9',bytes:673279}
] as const;
export const chargedItemSpellSpecs:readonly ChargedItemSpellSpec[]=[
  {
    "ownerId": "kiwee:item:au:wand%20of%20slumber::::::",
    "branchKey": "cast-sleep",
    "targetId": "kiwee:spell:xphb:sleep::::::",
    "targetInputPath": "spells/spells-xphb.json",
    "targetOriginalPath": "spell[312]",
    "targetOriginalSortedSha256": "4a08244070bd5a776b8312f2a176e3869b3907e1ef30d3bd3928a9b77aab8d7a",
    "originalOwnerPath": "item[2421]",
    "originalOwnerSortedSha256": "ea8629a5f6b1708015303dba21bf29a35ab5e8fd3c828109740d271e4a91ea8d",
    "canonicalPoolAnchorSha256": "fc04635b9d7fb1adcef29cc21db5910e70276c48bbf877e827a33024e0054f2a",
    "cost": 1,
    "minAfter": 1,
    "castLevel": 1,
    "targetScope": "spell",
    "sourceActionTiming": "action",
    "timingBasis": "spell-default-policy",
    "sourcePhysicalConstraint": "held",
    "statistics": {
      "kind": "fixed-dc",
      "saveDC": 15
    },
    "sourceDeclaredSaveDC": 15,
    "policyCode": "XDMG",
    "sourceBinding": "explicit-XPHB-source-reference",
    "clauses": [
      {
        "path": "item[2421].entries[0]",
        "sha256": "532a79a11fb2d389939c1e56d7e479ff013ff0aec553b68171741cd94b3d48eb"
      },
      {
        "path": "item[2421].entries[2].rows[1]",
        "sha256": "d63969cbd75960445f24925e844bfcab1acd7c93fd6448f129b57ece31b21e4a"
      },
      {
        "path": "item[2421].reqAttune",
        "sha256": "b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b"
      },
      {
        "path": "item[2421].charges",
        "sha256": "7902699be42c8a8e46fbbb4501726517e86b22c56a189f7625a6da49081b2451"
      }
    ],
    "manualBoundaries": [
      "source-effects-target-legality-duration-concentration-and-ending-manual",
      "physical-holding-or-wearing-and-attunement-legality-manual",
      "one-selected-cost-one-branch-only",
      "recovery-and-terminal-outcomes-not-automated",
      "no-ordinary-slot-fallback-or-new-spell-counter"
    ]
  },
  {
    "ownerId": "kiwee:item:aud:spirit-binding%20censer::::::",
    "branchKey": "cast-bless",
    "targetId": "kiwee:spell:xphb:bless::::::",
    "targetInputPath": "spells/spells-xphb.json",
    "targetOriginalPath": "spell[35]",
    "targetOriginalSortedSha256": "5ecaa1ea6ef7db62618dea4ef79573de42aca0c762e11c9a8cfa493980d4aa3d",
    "originalOwnerPath": "item[2150]",
    "originalOwnerSortedSha256": "c4e0a469d50c2bbdf55656a89e4c46917304755751d3aa9958f7534b69b385bf",
    "canonicalPoolAnchorSha256": "e14a2b44d2111264482ce7f77793d87dd77eb84d45d34ddba754bf0164d72f87",
    "cost": 1,
    "minAfter": 1,
    "castLevel": 1,
    "targetScope": "spell",
    "sourceActionTiming": "action",
    "timingBasis": "spell-default-policy",
    "sourcePhysicalConstraint": "held",
    "statistics": {
      "kind": "none"
    },
    "sourceDeclaredSaveDC": 18,
    "policyCode": "XDMG",
    "sourceBinding": "explicit-XPHB-source-reference",
    "clauses": [
      {
        "path": "item[2150].entries[1].entries[0]",
        "sha256": "8c617120644d7174df77ee41d8bbfb9387addfc4053785aafd581108c62a7996"
      },
      {
        "path": "item[2150].entries[2].rows[1]",
        "sha256": "1f4217f97b3462ccd480404200684fba1fea2d2a820d70c93c8f5132c19144f2"
      },
      {
        "path": "item[2150].reqAttune",
        "sha256": "b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b"
      },
      {
        "path": "item[2150].charges",
        "sha256": "4a44dc15364204a80fe80e9039455cc1608281820fe2b24f1e5233ade6af1dd5"
      }
    ],
    "manualBoundaries": [
      "source-effects-target-legality-duration-concentration-and-ending-manual",
      "physical-holding-or-wearing-and-attunement-legality-manual",
      "one-selected-cost-one-branch-only",
      "recovery-and-terminal-outcomes-not-automated",
      "no-ordinary-slot-fallback-or-new-spell-counter"
    ]
  },
  {
    "ownerId": "kiwee:item:dmg:ring%20of%20animal%20influence::::::",
    "branchKey": "cast-animal-friendship",
    "targetId": "kiwee:spell:phb:animal%20friendship::::::",
    "targetInputPath": "spells/spells-phb.json",
    "targetOriginalPath": "spell[4]",
    "targetOriginalSortedSha256": "3ec7bdd6a1e399d6f85229e4666529a8457fd86764c6383c0ad219849075d2d8",
    "originalOwnerPath": "item[1756]",
    "originalOwnerSortedSha256": "a43f91c1ba42ff7dd59ab994a7251f5e56ef0b86599952fa41a8cdb35e2a1713",
    "canonicalPoolAnchorSha256": "fe7f20fa8c5bf78002840953b17be749ae7218b0716d4dc484772651d23ee6a9",
    "cost": 1,
    "minAfter": 0,
    "castLevel": 1,
    "targetScope": "spell",
    "sourceActionTiming": "action",
    "timingBasis": "item-override",
    "sourcePhysicalConstraint": "worn",
    "statistics": {
      "kind": "fixed-dc",
      "saveDC": 13
    },
    "sourceDeclaredSaveDC": 13,
    "policyCode": "DMG",
    "sourceBinding": "reviewed-DMG2014-original-to-unique-PHB2014-no-card-edition-switch",
    "clauses": [
      {
        "path": "item[1756].entries[0]",
        "sha256": "e18f0f893518ce5f3b744ca3de19675f36ead58e76f3bc3526a1ce5372689e9d"
      },
      {
        "path": "item[1756].entries[1].items[0]",
        "sha256": "78d7ac7c15a09f0712945cef0dc33fbd7c9e90ee2eb6dba0a95149ac0cebfc32"
      }
    ],
    "manualBoundaries": [
      "source-effects-target-legality-duration-concentration-and-ending-manual",
      "physical-holding-or-wearing-and-attunement-legality-manual",
      "one-selected-cost-one-branch-only",
      "recovery-and-terminal-outcomes-not-automated",
      "no-ordinary-slot-fallback-or-new-spell-counter"
    ]
  },
  {
    "ownerId": "kiwee:item:dmg:wand%20of%20magic%20missiles::::::",
    "branchKey": "cast-magic-missile-rank-1",
    "targetId": "kiwee:spell:phb:magic%20missile::::::",
    "targetInputPath": "spells/spells-phb.json",
    "targetOriginalPath": "spell[213]",
    "targetOriginalSortedSha256": "fb73e484ad7053fa374cc4f8cd4fc8617761974ed8a98bccaae6ce772ccea58e",
    "originalOwnerPath": "item[2408]",
    "originalOwnerSortedSha256": "58d2067b5d5033a3e8068d804cee57109a40942c1cc38ff5f1de7e14b4de735b",
    "canonicalPoolAnchorSha256": "5459cc2d9b7ddb7492500cfd8350cc832d47998b25e2912ca5bc519548488baf",
    "cost": 1,
    "minAfter": 1,
    "castLevel": 1,
    "targetScope": "spell",
    "sourceActionTiming": "action",
    "timingBasis": "item-override",
    "sourcePhysicalConstraint": "held",
    "statistics": {
      "kind": "none"
    },
    "sourceDeclaredSaveDC": null,
    "policyCode": "DMG",
    "sourceBinding": "reviewed-DMG2014-original-to-unique-PHB2014-no-card-edition-switch",
    "clauses": [
      {
        "path": "item[2408].entries[0]",
        "sha256": "7aeea791611c1723ca756369f8f9e47a864493c88bdbaa1deb43a43b0a7373ef"
      },
      {
        "path": "item[2408].entries[1]",
        "sha256": "5b5e19a61db98eeb2e79c5c499d295091b3b02c240a241789237dac92887a1ef"
      }
    ],
    "manualBoundaries": [
      "source-effects-target-legality-duration-concentration-and-ending-manual",
      "physical-holding-or-wearing-and-attunement-legality-manual",
      "one-selected-cost-one-branch-only",
      "recovery-and-terminal-outcomes-not-automated",
      "no-ordinary-slot-fallback-or-new-spell-counter"
    ]
  },
  {
    "ownerId": "kiwee:item:xdmg:hag%20eye::::::",
    "branchKey": "cast-darkvision-self",
    "targetId": "kiwee:spell:xphb:darkvision::::::",
    "targetInputPath": "spells/spells-xphb.json",
    "targetOriginalPath": "spell[89]",
    "targetOriginalSortedSha256": "470f319e56d22a2b94720c0c10bd0bef0a58b5dc274f4daa851fa4b9f2ce3b7f",
    "originalOwnerPath": "item[941]",
    "originalOwnerSortedSha256": "3aeae41c78c67cc0df9f911002d6743babed28b3193ec1d756f033854d9b94e4",
    "canonicalPoolAnchorSha256": "addfd4e88bf56360ea7a2cfa65c8d7a45f39b3b580b05bd457c6f2cd48adca35",
    "cost": 1,
    "minAfter": 0,
    "castLevel": 2,
    "targetScope": "self",
    "sourceActionTiming": "action",
    "timingBasis": "spell-default-policy",
    "sourcePhysicalConstraint": "worn-or-held",
    "statistics": {
      "kind": "none"
    },
    "sourceDeclaredSaveDC": null,
    "policyCode": "XDMG",
    "sourceBinding": "explicit-XPHB-source-reference",
    "clauses": [
      {
        "path": "item[941].entries[0]",
        "sha256": "99fe8d15b75e073f03d5282bc3df1f03fa9eefa6b6423a9fd2c673e0be81c502"
      }
    ],
    "manualBoundaries": [
      "source-effects-target-legality-duration-concentration-and-ending-manual",
      "physical-holding-or-wearing-and-attunement-legality-manual",
      "one-selected-cost-one-branch-only",
      "recovery-and-terminal-outcomes-not-automated",
      "no-ordinary-slot-fallback-or-new-spell-counter"
    ]
  },
  {
    "ownerId": "kiwee:item:xdmg:ring%20of%20animal%20influence::::::",
    "branchKey": "cast-animal-friendship",
    "targetId": "kiwee:spell:xphb:animal%20friendship::::::",
    "targetInputPath": "spells/spells-xphb.json",
    "targetOriginalPath": "spell[4]",
    "targetOriginalSortedSha256": "ba51efaa1a78361024e33bb1aeeb007940eb35c2dbac34a8f06c0a3a58979d94",
    "originalOwnerPath": "item[1757]",
    "originalOwnerSortedSha256": "431e17849cab0d46775178d76f2617db9b68bb3ac9b3dd19dba2f3b65ba53595",
    "canonicalPoolAnchorSha256": "3cba25c1191f56d17bb145c2d9479c487085688289b267865ee125bf10574478",
    "cost": 1,
    "minAfter": 0,
    "castLevel": 1,
    "targetScope": "spell",
    "sourceActionTiming": "action",
    "timingBasis": "spell-default-policy",
    "sourcePhysicalConstraint": "worn",
    "statistics": {
      "kind": "fixed-dc",
      "saveDC": 13
    },
    "sourceDeclaredSaveDC": 13,
    "policyCode": "XDMG",
    "sourceBinding": "explicit-XPHB-source-reference",
    "clauses": [
      {
        "path": "item[1757].entries[0]",
        "sha256": "096b9b457fed7f95e830a11c0845de3ed143291e009c690061254f5d5d68ba0a"
      },
      {
        "path": "item[1757].entries[1].items[0]",
        "sha256": "3453d6584be6e9fbabb7edca90e2a9d26bef3ab48830bfb476913720e33a4f17"
      }
    ],
    "manualBoundaries": [
      "source-effects-target-legality-duration-concentration-and-ending-manual",
      "physical-holding-or-wearing-and-attunement-legality-manual",
      "one-selected-cost-one-branch-only",
      "recovery-and-terminal-outcomes-not-automated",
      "no-ordinary-slot-fallback-or-new-spell-counter"
    ]
  },
  {
    "ownerId": "kiwee:item:xdmg:ring%20of%20elemental%20command%20(air)::::::",
    "branchKey": "cast-wind-wall",
    "targetId": "kiwee:spell:xphb:wind%20wall::::::",
    "targetInputPath": "spells/spells-xphb.json",
    "targetOriginalPath": "spell[383]",
    "targetOriginalSortedSha256": "ef028f7e4210e4f22665b349c7db17fcfe572dca2b0cd5a084e3c53be7c72ff9",
    "originalOwnerPath": "item[1766]",
    "originalOwnerSortedSha256": "54d493271128336be84330b5b6925521b804f12e506285b96af60964bfc7d96d",
    "canonicalPoolAnchorSha256": "74000f5fb1684f26bad201bcfeff40939891ebbfd003f5d81152f72c0c5bcf8b",
    "cost": 1,
    "minAfter": 1,
    "castLevel": 3,
    "targetScope": "spell",
    "sourceActionTiming": "action",
    "timingBasis": "spell-default-policy",
    "sourcePhysicalConstraint": "worn",
    "statistics": {
      "kind": "fixed-dc",
      "saveDC": 18
    },
    "sourceDeclaredSaveDC": 18,
    "policyCode": "XDMG",
    "sourceBinding": "explicit-XPHB-source-reference",
    "clauses": [
      {
        "path": "item[1766].entries[3].entries[0]",
        "sha256": "d0356fce892e1a2b98b20d5f88068f911a32dd81ea434e090e02a7e2601e69c0"
      },
      {
        "path": "item[1766].reqAttune",
        "sha256": "b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b"
      },
      {
        "path": "item[1766].charges",
        "sha256": "ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d"
      }
    ],
    "manualBoundaries": [
      "source-effects-target-legality-duration-concentration-and-ending-manual",
      "physical-holding-or-wearing-and-attunement-legality-manual",
      "one-selected-cost-one-branch-only",
      "recovery-and-terminal-outcomes-not-automated",
      "no-ordinary-slot-fallback-or-new-spell-counter"
    ]
  },
  {
    "ownerId": "kiwee:item:xdmg:ring%20of%20elemental%20command%20(fire)::::::",
    "branchKey": "cast-burning-hands",
    "targetId": "kiwee:spell:xphb:burning%20hands::::::",
    "targetInputPath": "spells/spells-xphb.json",
    "targetOriginalPath": "spell[41]",
    "targetOriginalSortedSha256": "ea158c41e374e6ed0c25400e5b1961b3b669629180db2a598e17c3a75a8dcd08",
    "originalOwnerPath": "item[1768]",
    "originalOwnerSortedSha256": "5dc1610765d4c497ba2b1be0959e11e5c4fe42c8dd8520c5fcdf690a5abea613",
    "canonicalPoolAnchorSha256": "9b82e2c0726e4b07fe9a443aaf1db95c7afeb20e9731e4746a9e17777f408009",
    "cost": 1,
    "minAfter": 1,
    "castLevel": 1,
    "targetScope": "spell",
    "sourceActionTiming": "action",
    "timingBasis": "spell-default-policy",
    "sourcePhysicalConstraint": "worn",
    "statistics": {
      "kind": "fixed-dc",
      "saveDC": 18
    },
    "sourceDeclaredSaveDC": 18,
    "policyCode": "XDMG",
    "sourceBinding": "explicit-XPHB-source-reference",
    "clauses": [
      {
        "path": "item[1768].entries[0]",
        "sha256": "1cca802986eebbb26f9f6cb057a8e3c8ecbd7e9601bb11cc11bff07e00d53358"
      },
      {
        "path": "item[1768].entries[3].entries[0]",
        "sha256": "1e3708499ab96174a301f56fc512595bdebd0b4580935f501901110792e4bf69"
      },
      {
        "path": "item[1768].reqAttune",
        "sha256": "b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b"
      },
      {
        "path": "item[1768].charges",
        "sha256": "ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d"
      }
    ],
    "manualBoundaries": [
      "source-effects-target-legality-duration-concentration-and-ending-manual",
      "physical-holding-or-wearing-and-attunement-legality-manual",
      "one-selected-cost-one-branch-only",
      "recovery-and-terminal-outcomes-not-automated",
      "no-ordinary-slot-fallback-or-new-spell-counter",
      "unrelated-plane-description-conflict-retained-no-elemental-property-claim"
    ]
  },
  {
    "ownerId": "kiwee:item:xdmg:ring%20of%20elemental%20command%20(water)::::::",
    "branchKey": "cast-create-or-destroy-water",
    "targetId": "kiwee:spell:xphb:create%20or%20destroy%20water::::::",
    "targetInputPath": "spells/spells-xphb.json",
    "targetOriginalPath": "spell[81]",
    "targetOriginalSortedSha256": "a41060d2a34b103fbc5d9844eb2f3117bc6a8b1534e6ac86e3b52ba39adbc4d0",
    "originalOwnerPath": "item[1769]",
    "originalOwnerSortedSha256": "5fb266c4584a94aef8da165d2eb8db4cd3e955bf48dbdc603ffecff400be92e7",
    "canonicalPoolAnchorSha256": "d58ee966d0d25e129b84d3b0d29d361e2b4ecd2740c1ec6f054e77e4488505ea",
    "cost": 1,
    "minAfter": 1,
    "castLevel": 1,
    "targetScope": "spell",
    "sourceActionTiming": "action",
    "timingBasis": "spell-default-policy",
    "sourcePhysicalConstraint": "worn",
    "statistics": {
      "kind": "none"
    },
    "sourceDeclaredSaveDC": 18,
    "policyCode": "XDMG",
    "sourceBinding": "explicit-XPHB-source-reference",
    "clauses": [
      {
        "path": "item[1769].entries[3].entries[0]",
        "sha256": "db9ff47c32677960506307483ff978c13cafff4e8482d39fbfc77df405ebd9e1"
      },
      {
        "path": "item[1769].reqAttune",
        "sha256": "b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b"
      },
      {
        "path": "item[1769].charges",
        "sha256": "ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d"
      }
    ],
    "manualBoundaries": [
      "source-effects-target-legality-duration-concentration-and-ending-manual",
      "physical-holding-or-wearing-and-attunement-legality-manual",
      "one-selected-cost-one-branch-only",
      "recovery-and-terminal-outcomes-not-automated",
      "no-ordinary-slot-fallback-or-new-spell-counter"
    ]
  },
  {
    "ownerId": "kiwee:item:xdmg:rod%20of%20resurrection::::::",
    "branchKey": "cast-heal",
    "targetId": "kiwee:spell:xphb:heal::::::",
    "targetInputPath": "spells/spells-xphb.json",
    "targetOriginalPath": "spell[179]",
    "targetOriginalSortedSha256": "f8c697e49a62468a8cb208a206c92418c4cb9d82f02bef17ff7a63ba31a110a6",
    "originalOwnerPath": "item[1858]",
    "originalOwnerSortedSha256": "2f49d4d5564ec7229ff90bba9d1aa74522d9207f31210288d53c56b860d2ec6d",
    "canonicalPoolAnchorSha256": "0096decc13407dc0dd298ed400be8eacfbf0f039200b7f706df43e4d113bdcc3",
    "cost": 1,
    "minAfter": 1,
    "castLevel": 6,
    "targetScope": "spell",
    "sourceActionTiming": "action",
    "timingBasis": "spell-default-policy",
    "sourcePhysicalConstraint": "held",
    "statistics": {
      "kind": "none"
    },
    "sourceDeclaredSaveDC": null,
    "policyCode": "XDMG",
    "sourceBinding": "explicit-XPHB-source-reference",
    "clauses": [
      {
        "path": "item[1858].entries[0]",
        "sha256": "4e57f8b0c0402f158da8659ccc61824442821c17e1bf7236971a174c42e0c36f"
      },
      {
        "path": "item[1858].entries[1]",
        "sha256": "2477ad0bed7051186a3af5eedaba235806241fbb9bb4949ae38080c401f6a163"
      },
      {
        "path": "item[1858].reqAttune",
        "sha256": "b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b"
      },
      {
        "path": "item[1858].charges",
        "sha256": "ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d"
      }
    ],
    "manualBoundaries": [
      "source-effects-target-legality-duration-concentration-and-ending-manual",
      "physical-holding-or-wearing-and-attunement-legality-manual",
      "one-selected-cost-one-branch-only",
      "recovery-and-terminal-outcomes-not-automated",
      "no-ordinary-slot-fallback-or-new-spell-counter"
    ]
  },
  {
    "ownerId": "kiwee:item:xdmg:wand%20of%20magic%20missiles::::::",
    "branchKey": "cast-magic-missile-rank-1",
    "targetId": "kiwee:spell:xphb:magic%20missile::::::",
    "targetInputPath": "spells/spells-xphb.json",
    "targetOriginalPath": "spell[220]",
    "targetOriginalSortedSha256": "7d81b0bbc7c984fe718418070571e863264e92c28eb2b2aafc6fe660aa82ece9",
    "originalOwnerPath": "item[2409]",
    "originalOwnerSortedSha256": "204b4be23906287bf1d34a0044814a7789d9de62eca191737deadc2b34acb17a",
    "canonicalPoolAnchorSha256": "3bdbc453be7c765441f21049306b9f5ac203d7fa87f39d3b65ad1b40391c9110",
    "cost": 1,
    "minAfter": 1,
    "castLevel": 1,
    "targetScope": "spell",
    "sourceActionTiming": "action",
    "timingBasis": "spell-default-policy",
    "sourcePhysicalConstraint": "held",
    "statistics": {
      "kind": "none"
    },
    "sourceDeclaredSaveDC": null,
    "policyCode": "XDMG",
    "sourceBinding": "explicit-XPHB-source-reference",
    "clauses": [
      {
        "path": "item[2409].entries[0]",
        "sha256": "e826e73bb55999cdedf549a1c36872dc397da44b9890dad4e0d46edab8ede269"
      },
      {
        "path": "item[2409].entries[1].entries[0]",
        "sha256": "6a4b7962de019900d46d787d8db3c80dbf2cbf2dcdccf91d0910bc731c59cf92"
      }
    ],
    "manualBoundaries": [
      "source-effects-target-legality-duration-concentration-and-ending-manual",
      "physical-holding-or-wearing-and-attunement-legality-manual",
      "one-selected-cost-one-branch-only",
      "recovery-and-terminal-outcomes-not-automated",
      "no-ordinary-slot-fallback-or-new-spell-counter"
    ]
  }
];
export const chargedItemSpellPolicies=[
  {
    "code": "DMG",
    "edition": "2014",
    "repository": "tjliqy/5etools-cn",
    "revision": "5cc0bbe2c2b241a334e731af4448bdba2168e8bd",
    "path": "data/book/book-dmg.json",
    "rawBytes": 1312030,
    "gitBlobSha1": "961454f0039f5c9d9a9f5272ff3003f0cbd91133",
    "rawSha256": "2cd30ce20ef2786b1153a85bec25beee8747793491a8f38123a1a9fb6aee06ba",
    "canonicalSha256": "1c9a98e4a2b108d8c47397de9c03165619f54d8ed6e0a736331e9a57f807c450",
    "policySection": {
      "path": "$.data[7].entries[6].entries[8].entries[4]",
      "id": "264",
      "page": 141,
      "englishHeader": "Spells",
      "sortedCanonicalSha256": "4aa12680e89e4fcd1bdb8d9d7016d7d9ff8f3fc55d26846f186f6c79ee825b74",
      "clauses": [
        {
          "path": "entries[0]",
          "sha256": "f17eb9d6fb44395562d6c9ac248e0c21af0551fecc7392e6a52006b160176af0"
        },
        {
          "path": "entries[1]",
          "sha256": "6b2eee05619a619ef7dcc696391dc7c1d358f6425e52853ba1ad4c3e3412935d"
        },
        {
          "path": "entries[2]",
          "sha256": "8ecb66491dbc5119b48a1f123b05964085aa6a94b9df41e8ba2a661c8b7e502d"
        }
      ]
    },
    "facts": {
      "appliesTo": "actual spells cast from magic item, not direct spell-effect-only properties",
      "minimumPossibleSpellAndCasterLevelUnlessItemOverride": true,
      "noUserSpellSlotExpended": true,
      "noSpellComponentsUnlessItemOverride": true,
      "underlyingNormalCastingTimeUnlessItemOverride": true,
      "underlyingNormalRangeUnlessItemOverride": true,
      "underlyingNormalDurationUnlessItemOverride": true,
      "userConcentrationRequiredIfUnderlyingSpellRequiresUnlessItemOverride": true,
      "itemSpecificChangesMustRemainExplicit": true,
      "ownCastingAbilityPolicyOnlyWhenItemRequiresIt": true,
      "multipleOwnSpellcastingAbilitiesRequireExplicitChoice": true,
      "noOwnSpellcastingAbilityUsesModifierZeroWithProficiencyOnlyWithinThatPolicy": true,
      "noUniversalUnknownSaveDCDefaultProved": true,
      "noUniversalUnknownAttackBonusDefaultProved": true,
      "fixedSaveDCDoesNotDefineAttackBonusOrCastingModifier": true,
      "unsuffixedReferenceDefaultSourceNotAddressed": true,
      "noEffectAutomationOrAutomaticEligibility": true
    }
  },
  {
    "code": "XDMG",
    "edition": "2024",
    "repository": "tjliqy/5etools-cn",
    "revision": "5cc0bbe2c2b241a334e731af4448bdba2168e8bd",
    "path": "data/book/book-xdmg.json",
    "rawBytes": 1452650,
    "gitBlobSha1": "78d798f3b8540a627dc37e1761c1b293175ca4fd",
    "rawSha256": "0be2e1fc83321379fb949d699dcf7c2aec9011a3278c1fce93ae4424737fc5aa",
    "canonicalSha256": "2dadc226f1b38ed500c2dc9b24e250771ba8cc0bedd27f7873cebc7e10b6f9de",
    "policySection": {
      "path": "$.data[6].entries[8].entries[5].entries[3]",
      "id": "432",
      "page": 220,
      "englishHeader": "Spells Cast from Items",
      "sortedCanonicalSha256": "d132bff2fb8240961427a8e3160ede24a4e4802e7435f3c11bf8aff717736fbd",
      "clauses": [
        {
          "path": "entries[0]",
          "sha256": "d999cb1dbbf5bfd9a8528b0c81cce9e9ae351c314518c6d2f272ae37872603bb"
        },
        {
          "path": "entries[1]",
          "sha256": "144d637cb2d2745346f6520f8cb7ab0525c45e31d437ad9567935809156a79c9"
        }
      ]
    },
    "facts": {
      "appliesTo": "actual spells cast from magic item, not direct spell-effect-only properties",
      "minimumPossibleSpellAndCasterLevelUnlessItemOverride": true,
      "noUserSpellSlotExpended": true,
      "noSpellComponentsUnlessItemOverride": true,
      "underlyingNormalCastingTimeUnlessItemOverride": true,
      "underlyingNormalRangeUnlessItemOverride": true,
      "underlyingNormalDurationUnlessItemOverride": true,
      "userConcentrationRequiredIfUnderlyingSpellRequiresUnlessItemOverride": true,
      "itemSpecificChangesMustRemainExplicit": true,
      "ownCastingAbilityPolicyOnlyWhenItemRequiresIt": true,
      "multipleOwnSpellcastingAbilitiesRequireExplicitChoice": true,
      "noOwnSpellcastingAbilityUsesModifierZeroWithProficiencyOnlyWithinThatPolicy": true,
      "noUniversalUnknownSaveDCDefaultProved": true,
      "noUniversalUnknownAttackBonusDefaultProved": true,
      "fixedSaveDCDoesNotDefineAttackBonusOrCastingModifier": true,
      "unsuffixedReferenceDefaultSourceNotAddressed": true,
      "noEffectAutomationOrAutomaticEligibility": true
    }
  }
] as const;
export const chargedItemSpellHolds=[
  {
    "id": "kiwee:item:au:staff%20of%20the%20lost::::::",
    "reasonCode": "conditional-current-context-held"
  },
  {
    "id": "kiwee:item:bmt:tidecaller%20trident::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:coa:sage's%20mirror::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:coa:wrought-iron%20tower::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:dmg:cubic%20gate::::::",
    "reasonCode": "conditional-current-context-held"
  },
  {
    "id": "kiwee:item:dmg:trident%20of%20fish%20command::::::",
    "reasonCode": "conditional-current-context-held"
  },
  {
    "id": "kiwee:item:egw:ring%20of%20obscuring::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:ggr:azorius%20guild%20signet::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:ggr:boros%20guild%20signet::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:ggr:dimir%20guild%20signet::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:ggr:golgari%20guild%20signet::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:ggr:gruul%20guild%20signet::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:ggr:izzet%20guild%20signet::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:ggr:orzhov%20guild%20signet::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:ggr:rakdos%20guild%20signet::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:ggr:selesnya%20guild%20signet::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:ggr:simic%20guild%20signet::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:kftgv:shard%20solitaire%20(black%20sapphire)::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:kftgv:shard%20solitaire%20(diamond)::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:kftgv:shard%20solitaire%20(jacinth)::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:kftgv:shard%20solitaire%20(rainbow%20pearl)::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:kftgv:shard%20solitaire%20(ruby)::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:skt:rod%20of%20the%20vonindod::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:xdmg:cubic%20gate::::::",
    "reasonCode": "conditional-current-context-held"
  },
  {
    "id": "kiwee:item:xdmg:ring%20of%20shooting%20stars::::::",
    "reasonCode": "UID-or-statistics-held"
  },
  {
    "id": "kiwee:item:xdmg:spirit%20board::::::",
    "reasonCode": "conditional-current-context-held"
  },
  {
    "id": "kiwee:item:xdmg:trident%20of%20fish%20command::::::",
    "reasonCode": "conditional-current-context-held"
  },
  {
    "id": "kiwee:item:xdmg:wand%20of%20fear::::::",
    "reasonCode": "conditional-current-context-held"
  }
] as const;
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
const bytesHash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const chargedItemSpellSnapshot=(value:unknown)=>bytesHash(JSON.stringify(sorted(value)));
const ordinarySnapshot=(entry:Entry)=>chargedItemSpellSnapshot({raw:entry.raw,entries:entry.entries,effects:entry.effects,choices:entry.choices,dependencies:entry.dependencies});
const fail:(code:string)=>never=code=>{throw Error('CHARGED_ITEM_SPELL_SOURCE_'+code);};
function offlineBoundary(){const marker=Symbol.for('dnd.offlineCatalogFetch.v1'),descriptor=Object.getOwnPropertyDescriptor(globalThis,marker),guard=(globalThis as any)[marker];if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||!Object.isFrozen(guard)||guard.version!==1||globalThis.fetch!==guard.deny||!Array.isArray(guard.unexpected)||guard.unexpected.length)fail('STARTUP_NETWORK_BOUNDARY');}
function at(body:any,path:string):any{let value=body;const tokens=path.replace(/^\$\.?/,'').match(/[A-Za-z_][A-Za-z_0-9]*|\[\d+\]/g);if(!tokens?.length)fail('CLAUSE_PATH');for(const token of tokens)value=value?.[token.startsWith('[')?Number(token.slice(1,-1)):token];if(value===undefined)fail('CLAUSE_PATH');return value;}
let originals:Record<string,any>|undefined;
function bodies():Record<string,any>{
 offlineBoundary();if(originals)return originals;const directory=process.env.CHARGED_ITEM_SPELL_FROZEN_DIR;if(!directory)fail('FROZEN_DIRECTORY');const root=realpathSync(directory),index=JSON.parse(readFileSync(root+'/index.json','utf8')),out:Record<string,any>={};if(!Array.isArray(index.rows))fail('INDEX');
 // All six exact originals are verified before any normalization starts.
 for(const pin of chargedItemSpellInputPins){const rows=index.rows.filter((row:any)=>row?.url==='https://5e.kiwee.top/data/'+pin.path);if(rows.length!==1||rows[0].sha256!==pin.sha256||!/^files\/[a-f0-9]{64}\.json$/.test(rows[0].path))fail('INPUT_PIN');const file=realpathSync(root+'/'+rows[0].path);if(!file.replaceAll('\\','/').startsWith(root.replaceAll('\\','/')+'/'))fail('INPUT_PATH');const bytes=readFileSync(file);if(bytes.length!==pin.bytes||bytesHash(bytes)!==pin.sha256)fail('INPUT_BYTES');const body=JSON.parse(bytes.toString('utf8'));if(bytesHash(JSON.stringify(body))!==pin.sha256)fail('INPUT_CANONICAL');out[pin.path]=body;}
 return originals=out;
}
let policyProof:typeof chargedItemSpellPolicies|undefined;
function policies(){
 offlineBoundary();if(policyProof)return policyProof;
 for(const policy of chargedItemSpellPolicies){const file=policy.code==='DMG'?process.env.CHARGED_ITEM_SPELL_POLICY_DMG_FILE:process.env.CHARGED_ITEM_SPELL_POLICY_XDMG_FILE;if(!file)fail('POLICY_FILE');const bytes=readFileSync(file);if(bytes.length!==policy.rawBytes||bytesHash(bytes)!==policy.rawSha256||createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex')!==policy.gitBlobSha1)fail('POLICY_BYTES');const body=JSON.parse(bytes.toString('utf8')),section=at(body,policy.policySection.path);if(section.id!==policy.policySection.id||section.page!==policy.policySection.page||section.ENG_name!==policy.policySection.englishHeader||chargedItemSpellSnapshot(section)!==policy.policySection.sortedCanonicalSha256)fail('POLICY_SECTION');for(const clause of policy.policySection.clauses)if(chargedItemSpellSnapshot(at(section,clause.path))!==clause.sha256)fail('POLICY_CLAUSE');}
 return policyProof=chargedItemSpellPolicies;
}
const selectedIds=new Set(chargedItemSpellSpecs.map(spec=>spec.ownerId));
const cache:Partial<Record<'canonical'|'final',Entry[]>>={};let targetCache:Entry[]|undefined;
function exactOwners(entries:Entry[]):Entry[]{return chargedItemSpellSpecs.map(spec=>{const matches=entries.filter(entry=>entry.id===spec.ownerId);if(matches.length!==1)fail('UNIQUE_OWNER_IDENTITY');return matches[0];});}
export function chargedItemSpellEntries(form:'canonical'|'final'='canonical'):Entry[]{
 offlineBoundary();if(form!=='canonical'&&form!=='final')fail('FORM');if(cache[form])return cache[form]!;const inputs=bodies(),itemsPin=chargedItemSpellInputPins.find(pin=>pin.path==='items.json')!;
 if(form==='canonical'){const normalized=normalizeCatalogData(structuredClone(inputs['items.json']),itemsPin.sha256,'kiwee');return cache.canonical=exactOwners(normalized.filter(entry=>selectedIds.has(entry.id)));}
 const pins=chargedItemSpellInputPins.slice(0,3),equipment=Object.assign({},...pins.map(pin=>structuredClone(inputs[pin.path])));
 // Same pure equipment body/operation and last-wins composition as the real
 // catalog loader/App. Revision uses that loader's sorted path:revision codec;
 // only id+revision are rebound when comparing existing canonical pool proof.
 const revision=pins.map(pin=>`data/${pin.path}:${pin.sha256}`).sort().join('|'),merged=new Map<string,Entry>();
 for(const operation of ['normalize','magicItems'] as const)for(const entry of normalizeCatalogData(equipment,revision,'kiwee',operation))if(selectedIds.has(entry.id))merged.set(entry.id,entry);
 return cache.final=exactOwners([...merged.values()]);
}
export function chargedItemSpellTargets():Entry[]{
 offlineBoundary();if(targetCache)return targetCache;const inputs=bodies(),lookupPin=chargedItemSpellInputPins.find(pin=>pin.path.startsWith('generated/'))!,wanted=new Set(chargedItemSpellSpecs.map(spec=>spec.targetId));
 const normalized=chargedItemSpellInputPins.filter(pin=>pin.path.startsWith('spells/')).flatMap(pin=>normalizeCatalogData(structuredClone(inputs[pin.path]),pin.sha256,'kiwee').map(entry=>hydrateSpellLookup(entry,inputs[lookupPin.path],lookupPin.sha256))).filter(entry=>wanted.has(entry.id));
 return targetCache=chargedItemSpellSpecs.map(spec=>{const matches=normalized.filter(entry=>entry.id===spec.targetId);if(matches.length!==1)fail('UNIQUE_TARGET_IDENTITY');return matches[0];});
}
export function chargedItemSpellFindOwner(id:string,form:'canonical'|'final'='canonical'):Entry{if(!selectedIds.has(id))fail('UNREVIEWED_OWNER');const matches=chargedItemSpellEntries(form).filter(entry=>entry.id===id);if(matches.length!==1)fail('UNIQUE_OWNER_IDENTITY');return matches[0];}
export function chargedItemSpellFindTarget(id:string):Entry{const matches=chargedItemSpellTargets().filter(entry=>entry.id===id);if(matches.length!==1)fail('UNIQUE_TARGET_IDENTITY');return matches[0];}
const header=(entry:Entry)=>({id:entry.id,kind:entry.kind,name:entry.name,english:entry.english,source:entry.source,edition:entry.edition,packId:entry.packId,revision:entry.revision,page:entry.page??null});
function sameHeader(entry:Entry,rule:any){return entry.id===rule.id&&entry.kind===rule.kind&&entry.packId===rule.packId&&entry.name===rule.name&&entry.english===rule.english&&entry.source===rule.source&&entry.edition===rule.edition&&(entry.page??null)===(rule.page??null);}
let sourceRules:ReturnType<typeof buildRules>|undefined;
function buildRules(){
 const inputs=bodies(),policyRows=policies(),basic:any[]=JSON.parse(readFileSync('src/core/automation/itemChargeDebitEvidence.json','utf8')).rules,attuned:any[]=JSON.parse(readFileSync('src/core/automation/attunedItemChargeDebitEvidence.json','utf8')).rules,forms:any[]=JSON.parse(readFileSync('src/core/automation/itemChargeCatalogFormsEvidence.json','utf8')).rules,ordinary:any[]=JSON.parse(readFileSync('src/core/automation/ordinarySpellCastingEvidence.json','utf8')).rules;
 return chargedItemSpellSpecs.map(spec=>{
  const poolRows=[...basic,...attuned].filter(rule=>rule.id===spec.ownerId);if(poolRows.length!==1)fail('UNIQUE_POOL_ANCHOR');const pool=poolRows[0];if(!pool.supported||pool.fullNormalizedSnapshotSha256!==spec.canonicalPoolAnchorSha256||pool.action?.key!==spec.branchKey||pool.action?.cost!==1||pool.action?.minAfter!==spec.minAfter)fail('EXISTING_POOL_POLICY');
  const original=at(inputs['items.json'],spec.originalOwnerPath);if(chargedItemSpellSnapshot(original)!==spec.originalOwnerSortedSha256||original._copy||original._unresolvedParent||original.reqAttune===true!==(pool.requiresAttunement===true)||original.charges!==pool.capacity)fail('OWNER_ORIGINAL');for(const clause of spec.clauses)if(chargedItemSpellSnapshot(at(inputs['items.json'],clause.path))!==clause.sha256)fail('ORIGINAL_CLAUSE');
  const closed=forms.find(rule=>rule.id===pool.id);if(closed&&closed.canonicalProofAnchorSha256!==pool.fullNormalizedSnapshotSha256)fail('EXISTING_FORM_ANCHOR');const accepted=new Set<string>([pool.fullNormalizedSnapshotSha256,...(closed?.compatibleFullSnapshotForms||[]).map((form:any)=>form.sha256)]);
  const ownerForms=(['canonical','final'] as const).map(form=>{const entry=chargedItemSpellFindOwner(spec.ownerId,form);if(!sameHeader(entry,pool)||entry.raw._copy||entry.raw._unresolvedParent||entry.raw._variantIdentity)fail('OWNER_HEADER');const rebound=chargedItemSpellSnapshot({...entry,id:pool.id,revision:pool.revision});if(!accepted.has(rebound))fail(form==='final'?'ACTUAL_FINAL_FORM_NOT_IN_EXISTING_POOL_PROOF':'CANONICAL_FORM_NOT_IN_EXISTING_POOL_PROOF');return {form,...header(entry),completeSnapshotSha256:chargedItemSpellSnapshot(entry),canonicalReboundFullSnapshotSha256:rebound,existingPoolFormAuthority:rebound===pool.fullNormalizedSnapshotSha256?'canonical-pool-anchor':'existing-closed-compatible-form'};});
  const target=chargedItemSpellFindTarget(spec.targetId),targetOriginal=at(inputs[spec.targetInputPath],spec.targetOriginalPath),targetProofs=ordinary.filter(rule=>rule.id===spec.targetId&&rule.kind==='spell');if(targetProofs.length!==1)fail('UNIQUE_TARGET_ANCHOR');const targetProof=targetProofs[0];if(!sameHeader(target,targetProof)||target.raw._copy||target.raw._unresolvedParent||ordinarySnapshot(target)!==targetProof.snapshotSha256||chargedItemSpellSnapshot(targetOriginal)!==spec.targetOriginalSortedSha256)fail('EXISTING_TARGET_PROOF');
  if(target.raw.level!==spec.castLevel||target.raw.time?.length!==1||target.raw.time[0].number!==1||target.raw.time[0].unit!=='action')fail('TARGET_LEVEL_TIME');const saves=target.raw.savingThrow||[],attacks=target.raw.spellAttack||[];if(spec.statistics.kind==='none'?(saves.length>0||attacks.length>0):(saves.length<1||attacks.length>0||![13,15,18].includes(spec.statistics.saveDC)))fail('EXACT_STATISTICS_SCOPE');
  const policy=policyRows.find(policy=>policy.code===spec.policyCode);if(!policy||target.edition!==policy.edition)fail('EXACT_POLICY_EDITION');
  const targetPin=chargedItemSpellInputPins.find(pin=>pin.path===spec.targetInputPath)!,lookupPin=chargedItemSpellInputPins.find(pin=>pin.path.startsWith('generated/'))!;
  const rule={...header(chargedItemSpellFindOwner(spec.ownerId)),fullNormalizedSnapshotSha256:pool.fullNormalizedSnapshotSha256,canonicalPoolProofAnchorSha256:pool.fullNormalizedSnapshotSha256,capacity:pool.capacity as number,requiresAttunement:pool.requiresAttunement===true,ownerForms,target:{...header(target),fullNormalizedSnapshotSha256:chargedItemSpellSnapshot(target),ordinarySnapshotSha256:ordinarySnapshot(target),baseSpellLevel:target.raw.level as number,inputSha256:targetPin.sha256,lookupSha256:lookupPin.sha256,originalObjectSortedSha256:spec.targetOriginalSortedSha256,normalizedForm:'actual-hydrated-original'},branch:{key:spec.branchKey,targetEntryId:target.id,sourceUid:target.english+'|'+target.source,cost:1 as const,minAfter:spec.minAfter,castLevel:spec.castLevel,targetScope:spec.targetScope,sourceActionTiming:spec.sourceActionTiming,timingBasis:spec.timingBasis,statistics:spec.statistics,sourceDeclaredSaveDC:spec.sourceDeclaredSaveDC,sourcePhysicalConstraint:spec.sourcePhysicalConstraint,equipmentRequired:true,requiresAttunement:pool.requiresAttunement===true,requiredSources:[...new Set<string>([pool.source,target.source,...(target.dependencies||[]),...(pool.action?.requiredSources||[])])],requiredCardEdition:pool.action?.requiredCardEdition??null,policyCode:spec.policyCode,policySectionSha256:policy.policySection.sortedCanonicalSha256,sourceBinding:spec.sourceBinding,clauses:spec.clauses,manualBoundaries:spec.manualBoundaries},sourceProof:{inputSha256:chargedItemSpellInputPins[1].sha256,originalPath:spec.originalOwnerPath,originalObjectSortedSha256:spec.originalOwnerSortedSha256,clauses:spec.clauses},wholeEntryCompletionCredit:0};
  return {...rule,policySha256:chargedItemSpellSnapshot(rule)};
 });
}
export function chargedItemSpellSourceRules(){offlineBoundary();return sourceRules??=buildRules();}
export function chargedItemSpellSourceEvidence(){const rules=chargedItemSpellSourceRules();return {schemaVersion:1,scope:'exact11-source-qualified-one-charge-item-owned-spell-delivery-and-payment',sourceProseIncluded:false,counts:{owners:11,targets:11,ownerCompleteForms:22,noStatistics:6,fixedSourceSaveDC:5,conditionalHeld:7,UIDOrStatisticsHeld:21},inputs:chargedItemSpellInputPins.map(pin=>({url:'https://5e.kiwee.top/data/'+pin.path,sha256:pin.sha256,bytes:pin.bytes})),policies:policies(),fullSnapshotHashMethod:'SHA256(JSON.stringify(recursivelySorted(entire Entry))); existing owner proof rebinds only canonical id and revision; targets are actual complete hydrated forms',rules,held:chargedItemSpellHolds,manualLimits:['source-owned cast and one-charge payment only; spell effects remain manual','no recovery, terminal outcome, other cost, conditional28 or unknown saved-form admission','sourcebook policy anchors are semantic proof, not new catalog grants'],wholeEntryCompletionCredit:0,newReportWitnessCredit:0};}
