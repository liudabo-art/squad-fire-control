/*
 * Lightweight, dependency-free firing solution helpers for the prototype UI.
 * Coordinates use normalized map positions (0..1). x grows east and y grows
 * down on screen; the calculator converts y to northing before calculating
 * bearings. Weapon values are intentionally marked as estimates until they
 * are replaced with a licensed, version-pinned data set.
 */
(function (global) {
  "use strict";

  var GAME_GRAVITY = 9.78;
  var TABLE_GRAVITY = 9.8;
  var MILS_PER_TURN = 6400;

  var SQUADCALC_API = "https://squadcalc.app/api";
  var maps = [
    ["al-basrah", "Al Basrah", 4, 4, "albasrah", "official"],
    ["anvil", "Anvil", 3.06, 3.06, "anvil", "official"],
    ["black-coast", "Black Coast", 4.598, 4.599, "blackcoast", "official"],
    ["chora", "Chora", 4.064, 4.064, "chora", "official"],
    ["fallujah", "Fallujah", 3.005, 3.005, "fallujah", "official"],
    ["fools-road", "Fool's Road", 1.774, 1.774, "foolsroad", "official"],
    ["goose-bay", "Goose Bay", 4.031, 4.031, "goosebay", "official"],
    ["gorodok", "Gorodok", 4.064, 4.064, "gorodok", "official"],
    ["harju", "Harju", 4.032, 4.032, "harju", "official"],
    ["jensen-s-range", "Jensen's Range", 4.008, 4.008, "jensen", "official"],
    ["kamdesh-highlands", "Kamdesh Highlands", 4.032, 4.032, "kamdesh", "official"],
    ["kohat-toi-river-valley", "Kohat Toi River Valley", 4.617, 4.617, "kohat", "official"],
    ["kokan", "Kokan", 2.496, 2.496, "kokan", "official"],
    ["lashkar-valley", "Lashkar Valley", 4.334, 4.334, "lashkar", "official"],
    ["logar-valley", "Logar Valley", 1.761, 1.761, "logar", "official"],
    ["manic-5", "Manic-5", 4.031, 4.031, "manicouagan", "official"],
    ["mestia", "Mestia", 2.4, 2.4, "mestia", "official"],
    ["mutaha", "Mutaha", 2.755, 2.755, "mutaha", "official"],
    ["narva", "Narva", 2.8, 2.8, "narva", "official"],
    ["pacific-proving-grounds", "Pacific Proving Grounds", 4.032, 4.032, "pacific", "official"],
    ["sanxian-islands", "Sanxian Islands", 4.6, 4.6, "sanxian", "official"],
    ["skorpo", "Skorpo", 6.849, 6.869, "skorpo", "official"],
    ["sumari-bala", "Sumari Bala", 1.3, 1.3, "sumari", "official"],
    ["tallil-outskirts", "Tallil Outskirts", 4.68, 4.68, "tallil", "official"],
    ["yehorivka", "Yehorivka", 6.35, 6.35, "yehorivka", "official"],
    ["hrodna-border", "Hrodna Border", 4.032, 4.032, "MODS/SPM/hrodna", "SuperMod"],
    ["chornivsk", "Chornivsk", 3.184, 3.184, "MODS/SPM/chornivsk", "SuperMod"],
    ["al-basrah-legacy", "Al Basrah Legacy", 3.04, 3.04, "MODS/SD/albasrah_legacy", "Steel Division"],
    ["bespin", "Bespin", 4.06384, 4.06384, "MODS/GC/bespin", "Galactic Contention"],
    ["coruscant", "Coruscant", 4, 4, "MODS/GC/coruscant", "Galactic Contention"],
    ["corvette", "Corvette", 0.15955, 0.15955, "MODS/GC/corvette", "Galactic Contention"],
    ["felucia", "Felucia", 2.66663, 2.6667, "MODS/GC/felucia", "Galactic Contention"],
    ["galban", "Galban", 3.56996, 3.56988, "MODS/GC/galban", "Galactic Contention"],
    ["geonosis", "Geonosis", 4.03137, 4.03137, "MODS/GC/geonosis", "Galactic Contention"],
    ["kashyyyk", "Kashyyyk", 3.99999, 3.99998, "MODS/GC/kashyyyk", "Galactic Contention"],
    ["kavado", "Kavado", 3.12445, 3.12445, "MODS/GC/kavado", "Galactic Contention"],
    ["mallidon", "Mallidon", 2, 2, "MODS/GC/mallidon", "Galactic Contention"],
    ["miniosis", "Miniosis", 2.04, 2.04, "MODS/GC/miniosis", "Galactic Contention"],
    ["morak", "Morak", 6.5, 6.5, "MODS/GC/morak", "Galactic Contention"],
    ["morak-legacy", "Morak Legacy", 4.20494, 4.6037, "MODS/GC/moraklegacy", "Galactic Contention"],
    ["mygeeto", "Mygeeto", 4, 4, "MODS/GC/mygeeto", "Galactic Contention"],
    ["naboo-plains", "Naboo Plains", 3.93696, 3.93696, "MODS/GC/nabooplains", "Galactic Contention"],
    ["orto-plutonia", "Orto Plutonia", 4, 4, "MODS/GC/ortoplutonia", "Galactic Contention"],
    ["rhenvar", "Rhen Var", 8.13345, 8.13345, "MODS/GC/rhenvar", "Galactic Contention"],
    ["ryloth", "Ryloth", 1.24, 1.24, "MODS/GC/ryloth", "Galactic Contention"],
    ["sesid", "Sesid", 3.76, 3.76, "MODS/GC/sesid", "Galactic Contention"],
    ["sesid-equator", "Sesid Equator", 4.8, 4.8, "MODS/GC/sesidequator", "Galactic Contention"],
    ["sullust", "Sullust", 2.15833, 2.15833, "MODS/GC/sullust", "Galactic Contention"],
    ["tatooine", "Tatooine", 3.546, 3.546, "MODS/GC/tatooine", "Galactic Contention"],
    ["umbara", "Umbara", 1.6, 1.6, "MODS/GC/umbara", "Galactic Contention"],
    ["venator-assault", "Venator Assault", 0.8, 0.8, "MODS/GC/venator", "Galactic Contention"],
    ["venator-assault-2", "Venator Assault 2", 1.5, 1.5, "MODS/GC/venator2", "Galactic Contention"],
    ["yavin-4", "Yavin 4", 2.52004, 2.52004, "MODS/GC/yavin4", "Galactic Contention"]
  ].map(function (item) {
    var mapURL = "/img/maps/" + item[4] + "/";
    return {
      id: item[0], name: item[1], widthKm: item[2], heightKm: item[3],
      mapURL: mapURL, mapSlug: item[4], category: item[5],
      widthMeters: item[2] * 1000, heightMeters: item[3] * 1000,
      gridSizeMeters: 300,
      basemapUrl: SQUADCALC_API + mapURL + "basemap.webp",
      localBasemapUrl: "./map-assets/" + item[0] + ".webp",
      dataStatus: "squadcalc-sdk-bounds",
      verified: true,
      source: "SquadCalc map configuration and basemap asset"
    };
  });

  var SQUADCALC_REVISION = "24828d6d3081c7ce52b10ef39ec86036ebf010b5";
  var commonMortarTable = [
    [100, 1536], [150, 1519], [200, 1502], [250, 1485], [300, 1467],
    [350, 1450], [400, 1432], [450, 1415], [500, 1397], [550, 1378],
    [600, 1360], [650, 1341], [700, 1322], [750, 1302], [800, 1282],
    [850, 1262], [900, 1241], [950, 1219], [1000, 1196], [1050, 1172],
    [1100, 1147], [1150, 1121], [1200, 1092], [1250, 1062], [1300, 1027],
    [1350, 988], [1400, 939]
  ];
  var mortarTables = [
    { id: "mortar-table-squ", name: "标准迫击炮射表（SQU）", shortName: "SQU", group: "迫击炮射表", table: [[50, 1579], [100, 1558], [150, 1538], [200, 1517], [250, 1496], [300, 1475], [350, 1453], [400, 1431], [450, 1409], [500, 1387], [550, 1364], [600, 1341], [650, 1317], [700, 1292], [750, 1267], [800, 1240], [850, 1212], [900, 1183], [950, 1152], [1000, 1118], [1050, 1081], [1100, 1039], [1150, 988], [1200, 918], [1250, 800]] },
    { id: "mortar-table-ger", name: "德国迫击炮射表（GER）", shortName: "GER", group: "迫击炮射表", table: commonMortarTable },
    { id: "mortar-table-br3", name: "英军 3 英寸迫击炮射表（BR3）", shortName: "BR3", group: "迫击炮射表", table: commonMortarTable },
    { id: "mortar-table-br4", name: "英军 4 英寸迫击炮射表（BR4）", shortName: "BR4", group: "迫击炮射表", table: [[200, 1535], [300, 1517], [400, 1500], [500, 1482], [600, 1464], [700, 1446], [800, 1428], [900, 1409], [1000, 1391], [1100, 1372], [1200, 1353], [1300, 1333], [1400, 1313], [1500, 1293], [1600, 1272], [1700, 1250], [1800, 1228], [1900, 1205], [2000, 1181], [2100, 1155], [2200, 1128], [2300, 1100], [2400, 1069], [2500, 1034]] },
    { id: "mortar-table-us6", name: "美军 60mm 迫击炮射表（US6）", shortName: "US6", group: "迫击炮射表", table: commonMortarTable }
  ].map(function (item) {
    var first = item.table[0];
    var last = item.table[item.table.length - 1];
    return {
      id: item.id, name: item.name, shortName: item.shortName, group: item.group,
      modelType: "range-table", rangeTable: item.table, minRange: first[0], maxRange: last[0],
      source: "SquadMC community mortar table", status: "table"
    };
  });

  function modelWeapon(id, name, shortName, group, values) {
    return Object.assign({
      id: id, name: name, shortName: shortName, group: group,
      modelType: "ballistic", gravityScale: 1, minElevation: [-45, 135],
      angleType: "low", angleOffset: 0, heightOffset: 0,
      minRange: 0, projectileLifespan: 100,
      source: "SquadCalc@" + SQUADCALC_REVISION, status: "community-model"
    }, values);
  }

  var weapons = mortarTables.concat([
    modelWeapon("mortar-gc", "Galactic Contention Mortar", "GC Mortar", "SquadCalc 社区弹道模型", {
      muzzleVelocity: 110, minRange: 51, minElevation: [45, 88.875],
      angleType: "high", heightOffset: 1, mod: "Galactic Contention"
    }),
    modelWeapon("ub32", "UB-32 Rocket Pod", "UB-32", "Squad 原版曲射武器", {
      muzzleVelocity: 300, deceleration: 50, decelerationTime: 2, gravityScale: 2,
      minElevation: [-25, 35], heightOffset: 1, projectileLifespan: 20
    }),
    modelWeapon("hell-cannon", "Hell Cannon", "Hell Cannon", "Squad 原版曲射武器", {
      muzzleVelocity: 95, minElevation: [10, 90], angleType: "high", heightOffset: 1.5
    }),
    modelWeapon("tech-mortar", "Technical Mortar", "Tech Mortar", "Squad 原版曲射武器", {
      muzzleVelocity: 110, minRange: 51, angleType: "high", heightOffset: 2.5, angleOffset: 5
    }),
    modelWeapon("tech-ub32", "Technical UB-32", "Tech UB-32", "Squad 原版曲射武器", {
      muzzleVelocity: 300, deceleration: 50, decelerationTime: 2, gravityScale: 2,
      heightOffset: 2.5, projectileLifespan: 20
    }),
    modelWeapon("bm21", "BM-21 Grad", "BM-21", "Squad 原版曲射武器", {
      muzzleVelocity: 200, gravityScale: 2, heightOffset: 3
    }),
    modelWeapon("btr4-ags", "BTR4-AGS", "BTR4-AGS", "Squad 原版曲射武器", {
      muzzleVelocity: 190, minElevation: [-45, 135], heightOffset: 3.4,
      angleOffset: 0.73459689
    }),
    modelWeapon("mk19", "Mk19", "Mk19", "Squad 原版曲射武器", {
      muzzleVelocity: 230, minRange: 10, minElevation: [-45, 85.3],
      heightOffset: 4, angleOffset: 0.984
    }),
    modelWeapon("m1064-impact", "M1064 / M121 Mortar · Impact", "M1064 Impact", "Squad 原版曲射武器", {
      muzzleVelocity: 142, minRange: 340, minElevation: [-45, 85.3],
      angleType: "high", heightOffset: 3, shell: "impact"
    }),
    modelWeapon("m1064-near-surface", "M1064 / M121 Mortar · Near Surface", "M1064 Airburst", "Squad 原版曲射武器", {
      muzzleVelocity: 142, minRange: 340, minElevation: [-45, 85.3],
      angleType: "high", heightOffset: 3, shell: "nearSurface"
    }),
    modelWeapon("mo120-short", "MO120RTF1 · Short", "MO120 Short", "SuperMod 曲射武器", {
      muzzleVelocity: 110, minRange: 0, minElevation: [45, 85.3],
      angleType: "high", heightOffset: 3, mod: "SuperMod", shell: "MO-SHORT"
    }),
    modelWeapon("mo120-medium", "MO120RTF1 · Medium", "MO120 Medium", "SuperMod 曲射武器", {
      muzzleVelocity: 143.5, minRange: 0, minElevation: [45, 85.3],
      angleType: "high", heightOffset: 3, mod: "SuperMod", shell: "MO-MEDIUM"
    }),
    modelWeapon("mo120-long", "MO120RTF1 · Long", "MO120 Long", "SuperMod 曲射武器", {
      muzzleVelocity: 171.5, minRange: 0, minElevation: [45, 85.3],
      angleType: "high", heightOffset: 3, mod: "SuperMod", shell: "MO-LONG"
    }),
    modelWeapon("type-63", "Type 63 Rocket Launcher", "Type 63", "SuperMod 曲射武器", {
      muzzleVelocity: 300, gravityScale: 2, minElevation: [-20, 55],
      heightOffset: 3, mod: "SuperMod"
    }),
    modelWeapon("pzl07", "PZL-07", "PZL-07", "Infinite Warfare 模组", {
      muzzleVelocity: 140, minElevation: [-90, 90], heightOffset: 2,
      mod: "Infinite Warfare", shell: "High-Explosive"
    }),
    modelWeapon("pzl07-airburst", "PZL-07 · Air-Burst", "PZL-07 AB", "Infinite Warfare 模组", {
      muzzleVelocity: 140, minElevation: [-90, 90], heightOffset: 2,
      mod: "Infinite Warfare", shell: "Air-Burst"
    }),
    modelWeapon("m109", "M109", "M109", "Steel Division 模组", {
      muzzleVelocity: 225, gravityScale: 2, heightOffset: 2.206, angleOffset: -0.01,
      mod: "Steel Division"
    }),
    modelWeapon("m777", "M777", "M777", "Steel Division 模组", {
      muzzleVelocity: 200, gravityScale: 2, minRange: 700,
      minElevation: [15, 80], heightOffset: 4, mod: "Steel Division"
    }),
    modelWeapon("t62-dump-truck", "T62 Dump Truck", "T62 Truck", "Steel Division 模组", {
      muzzleVelocity: 210, gravityScale: 2, heightOffset: 3, mod: "Steel Division"
    }),
    modelWeapon("himars", "HIMARS", "HIMARS", "Steel Division 模组", {
      muzzleVelocity: 250, gravityScale: 2, minElevation: [-3, 84.7],
      heightOffset: 3, mod: "Steel Division"
    }),
    modelWeapon("tos-1a", "TOS-1A", "TOS-1A", "Steel Division 模组", {
      muzzleVelocity: 100, minElevation: [0, 80], heightOffset: 3,
      mod: "Steel Division"
    }),
    modelWeapon("ural-hellcannon", "Ural Hell Cannon", "Ural Hell Cannon", "Steel Division 模组", {
      muzzleVelocity: 180, gravityScale: 2, minElevation: [10, 85],
      angleType: "high", heightOffset: 3, mod: "Steel Division"
    }),
    modelWeapon("scud", "SCUD", "SCUD", "Steel Division 模组", {
      muzzleVelocity: 150, minRange: 100, minElevation: [10, 90],
      heightOffset: 3, projectileLifespan: 120, mod: "Steel Division"
    })
  ]);

  function blastProfile(maxDamage, minRadius, maxRadius, distanceFromImpact, falloff, source) {
    return {
      maxDamage: maxDamage,
      radius: [minRadius, maxRadius],
      distanceFromImpact: distanceFromImpact,
      falloff: falloff,
      source: source
    };
  }

  var squadCalcSource = "SquadCalc@" + SQUADCALC_REVISION;
  var mortarBlast = blastProfile(350, 0, 40, 1, 7, squadCalcSource + " Mortar shell");
  var blastProfiles = {
    "mortar-table-squ": mortarBlast,
    "mortar-table-ger": mortarBlast,
    "mortar-table-br3": mortarBlast,
    "mortar-table-br4": mortarBlast,
    "mortar-table-us6": mortarBlast,
    "mortar-gc": mortarBlast,
    "ub32": blastProfile(115, 5, 18, 0.2, 1, squadCalcSource),
    "hell-cannon": blastProfile(125, 1, 50, 2, 1, squadCalcSource),
    "tech-mortar": blastProfile(350, 0, 40, 0.5, 7, squadCalcSource),
    "tech-ub32": blastProfile(115, 5, 18, 0.2, 1, squadCalcSource),
    "bm21": blastProfile(140, 1, 35, 2, 1, squadCalcSource),
    "btr4-ags": blastProfile(115, 1, 15, 1, 1, squadCalcSource),
    "mk19": blastProfile(115, 1, 15, 0.08, 1, squadCalcSource),
    "m1064-impact": blastProfile(400, 0, 40, 1, 7, squadCalcSource),
    "m1064-near-surface": blastProfile(100, 10, 60, 10, 1.3, squadCalcSource),
    "mo120-short": blastProfile(500, 2, 60, 1, 7, squadCalcSource),
    "mo120-medium": blastProfile(500, 2, 60, 1, 7, squadCalcSource),
    "mo120-long": blastProfile(500, 2, 60, 1, 7, squadCalcSource),
    "type-63": blastProfile(250, 2, 10, 2, 1, squadCalcSource),
    "pzl07": blastProfile(375, 1.5, 10, 0.5, 3.5, squadCalcSource + " High-Explosive shell"),
    "pzl07-airburst": blastProfile(100, 10, 60, 10, 1.3, squadCalcSource + " Air-Burst shell"),
    "m109": blastProfile(2000, 40, 75, 1, 3.5, squadCalcSource),
    "m777": blastProfile(2000, 40, 75, 1, 3.5, squadCalcSource),
    "t62-dump-truck": blastProfile(400, 20, 40, 1, 1, squadCalcSource),
    "himars": blastProfile(300, 1.5, 50, 3, 1, squadCalcSource),
    "tos-1a": blastProfile(150, 15, 25, 0.2, 1, squadCalcSource),
    "ural-hellcannon": blastProfile(300, 1, 75, 2, 1, squadCalcSource),
    "scud": blastProfile(3000, 5, 50, 2, 1, squadCalcSource)
  };

  weapons.forEach(function (weapon) {
    weapon.blast = blastProfiles[weapon.id] || null;
  });

  var PLAYER_SIZE_METERS = 1.8;

  function calculateDamageRadius(blast, targetDamage) {
    var minRadius = blast.radius[0];
    var maxRadius = blast.radius[1];
    var damageRadius = maxRadius - Math.pow(targetDamage / blast.maxDamage, 1 / blast.falloff) * (maxRadius - minRadius);
    var impactOffset = blast.distanceFromImpact - PLAYER_SIZE_METERS;
    return Math.sqrt(Math.max(0, damageRadius * damageRadius - impactOffset * impactOffset));
  }

  function getDamageRadii(id) {
    var blast = findWeapon(id).blast;
    if (!blast) return null;
    return {
      hundredDamageRadius: calculateDamageRadius(blast, 100),
      twentyFiveDamageRadius: calculateDamageRadius(blast, 25),
      source: blast.source
    };
  }

  function getVelocityAtRange(weapon, range) {
    if (weapon.modelType === "range-table") {
      var tableMils = interpolateTable(weapon.rangeTable, range);
      if (tableMils == null) return null;
      var tableAngle = tableMils * 2 * Math.PI / MILS_PER_TURN;
      return Math.sqrt((TABLE_GRAVITY * range) / Math.sin(2 * tableAngle));
    }
    var velocity = weapon.muzzleVelocity;
    var deceleration = weapon.deceleration || 0;
    var duration = weapon.decelerationTime || 0;
    if (!deceleration || !duration) return velocity;
    var decelerationDistance = velocity * duration - 0.5 * deceleration * duration * duration;
    if (range <= decelerationDistance) {
      var discriminant = Math.sqrt(velocity * velocity + 2 * deceleration * range);
      var time = (discriminant - velocity) / deceleration;
      return velocity - deceleration * time;
    }
    var finalVelocity = velocity - deceleration * duration;
    var timeAfterDeceleration = (range - decelerationDistance) / finalVelocity;
    return range / (duration + timeAfterDeceleration);
  }

  function interpolateTable(table, range) {
    if (range < table[0][0] || range > table[table.length - 1][0]) return null;
    for (var i = 1; i < table.length; i++) {
      if (range <= table[i][0]) {
        var before = table[i - 1];
        var after = table[i];
        var fraction = (range - before[0]) / (after[0] - before[0]);
        return before[1] + (after[1] - before[1]) * fraction;
      }
    }
    return table[table.length - 1][1];
  }

  function solveElevation(range, deltaHeight, velocity, weapon) {
    if (!(range > 0)) return null;
    var baseGravity = weapon.modelType === "range-table" || weapon.tableGravity ? TABLE_GRAVITY : GAME_GRAVITY;
    var gravity = baseGravity * (weapon.gravityScale || 1);
    var height = deltaHeight - (weapon.heightOffset || 0);
    var v2 = velocity * velocity;
    var discriminant = v2 * v2 - gravity * (gravity * range * range + 2 * height * v2);
    if (discriminant < 0) return null;
    var root = Math.sqrt(discriminant);
    var angleFactor = weapon.angleType === "high" ? root : -root;
    var elevation = Math.atan((v2 + angleFactor) / (gravity * range)) * 180 / Math.PI - (weapon.angleOffset || 0);
    if (elevation < weapon.minElevation[0] - 0.001 || elevation > weapon.minElevation[1] + 0.001) return null;
    return elevation;
  }

  function getTableElevation(range, deltaHeight, weapon) {
    var mils = interpolateTable(weapon.rangeTable, range);
    if (mils == null) return null;
    if (!deltaHeight) return mils * 360 / MILS_PER_TURN;
    var angle = mils * 2 * Math.PI / MILS_PER_TURN;
    var velocitySquared = (TABLE_GRAVITY * range) / Math.sin(2 * angle);
    return solveElevation(range, deltaHeight, Math.sqrt(velocitySquared), {
      gravityScale: 1, heightOffset: 0, angleOffset: 0, angleType: "high", tableGravity: true,
      minElevation: [0, 90]
    });
  }

  function rangeAtAngle(weapon, aimAngle) {
    var angle = (aimAngle + (weapon.angleOffset || 0)) * Math.PI / 180;
    if (angle <= 0 || angle >= Math.PI / 2) return null;
    var gravity = GAME_GRAVITY * (weapon.gravityScale || 1);
    var height = -(weapon.heightOffset || 0);
    var range = weapon.muzzleVelocity * weapon.muzzleVelocity * Math.sin(2 * angle) / gravity;
    for (var i = 0; i < 30; i++) {
      var velocity = getVelocityAtRange(weapon, range);
      var vy = velocity * Math.sin(angle);
      var discriminant = vy * vy - 2 * gravity * height;
      if (discriminant < 0) return null;
      var time = (vy + Math.sqrt(discriminant)) / gravity;
      range = velocity * Math.cos(angle) * time;
    }
    var finalVelocity = getVelocityAtRange(weapon, range);
    var finalVy = finalVelocity * Math.sin(angle);
    var finalTime = (finalVy + Math.sqrt(finalVy * finalVy - 2 * gravity * height)) / gravity;
    if (finalTime > (weapon.projectileLifespan || 100)) return null;
    return range;
  }

  function computeMaxRange(weapon) {
    if (weapon.modelType === "range-table") return weapon.maxRange;
    var minAngle = weapon.minElevation[0];
    var maxAngle = weapon.minElevation[1];
    var step = 0.02;
    var maxRange = 0;
    var steps = Math.ceil((maxAngle - minAngle) / step);
    for (var i = 0; i <= steps; i++) {
      var aimAngle = Math.min(maxAngle, minAngle + i * step);
      var range = rangeAtAngle(weapon, aimAngle);
      if (range != null && range > maxRange) maxRange = range;
    }
    return maxRange ? Math.round(maxRange) : null;
  }

  weapons.forEach(function (weapon) { weapon.maxRange = computeMaxRange(weapon); });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeAngle(degrees) {
    var result = degrees % 360;
    return result < 0 ? result + 360 : result;
  }

  function round(value, digits) {
    var factor = Math.pow(10, digits || 0);
    return Math.round(value * factor) / factor;
  }

  var legacyWeaponIds = {
    "mortar-60": "mortar-table-us6",
    "mortar-81": "mortar-table-squ",
    "mortar-82": "mortar-table-ger",
    "mortar-120": "mo120-long"
  };

  function normalizeWeaponId(id) { return legacyWeaponIds[id] || id; }

  function findWeapon(id) {
    var resolvedId = normalizeWeaponId(id);
    return weapons.find(function (weapon) { return weapon.id === resolvedId; }) || weapons[0];
  }

  function findMap(id) {
    return maps.find(function (map) { return map.id === id; }) || maps[0];
  }

  function computeSolution(origin, target, options) {
    options = options || {};
    var map = findMap(options.mapId);
    var weapon = findWeapon(options.weaponId);
    map = Object.assign({}, map, {
      widthKm: Number(options.mapWidthKm) || map.widthKm,
      heightKm: Number(options.mapHeightKm) || map.heightKm
    });
    var width = map.widthKm * 1000;
    var height = map.heightKm * 1000;
    var ox = clamp(Number(origin.x) || 0, 0, 1) * width;
    var oy = (1 - clamp(Number(origin.y) || 0, 0, 1)) * height;
    var tx = clamp(Number(target.x) || 0, 0, 1) * width;
    var ty = (1 - clamp(Number(target.y) || 0, 0, 1)) * height;
    var dx = tx - ox;
    var dy = ty - oy;
    var horizontalDistance = Math.sqrt(dx * dx + dy * dy);
    var deltaHeight = (Number(target.elevation) || 0) - (Number(origin.elevation) || 0);
    var bearing = normalizeAngle(Math.atan2(dx, dy) * 180 / Math.PI);
    var bearingMils = bearing * MILS_PER_TURN / 360;
    var velocity = getVelocityAtRange(weapon, horizontalDistance);
    var elevation = weapon.modelType === "range-table" ?
      getTableElevation(horizontalDistance, deltaHeight, weapon) :
      solveElevation(horizontalDistance, deltaHeight, velocity, weapon);
    var reachable = elevation != null && horizontalDistance >= weapon.minRange && horizontalDistance <= weapon.maxRange;
    var elevationMils = elevation == null ? null : elevation * MILS_PER_TURN / 360;
    var flightAngle = elevation == null ? null : (elevation + (weapon.angleOffset || 0)) * Math.PI / 180;
    var gravity = weapon.modelType === "range-table" ? TABLE_GRAVITY : GAME_GRAVITY;
    gravity *= weapon.gravityScale || 1;
    var effectiveHeight = deltaHeight - (weapon.heightOffset || 0);
    var verticalVelocity = elevation == null || velocity == null ? null : velocity * Math.sin(flightAngle);
    var timeDiscriminant = verticalVelocity == null ? -1 : verticalVelocity * verticalVelocity - 2 * gravity * effectiveHeight;
    var flightTime = verticalVelocity == null || timeDiscriminant < 0 ? null : (verticalVelocity + Math.sqrt(timeDiscriminant)) / gravity;

    return {
      bearingDeg: round(bearing, 1),
      bearingMils: Math.round(bearingMils),
      elevationDeg: elevation == null ? null : round(elevation, 1),
      elevationMils: elevationMils == null ? null : Math.round(elevationMils),
      rangeMeters: Math.round(horizontalDistance),
      rangeKm: round(horizontalDistance / 1000, 2),
      flightTimeSeconds: flightTime == null ? null : Math.round(flightTime),
      deltaHeightMeters: Math.round(deltaHeight),
      reachable: reachable,
      outOfRange: horizontalDistance < weapon.minRange || horizontalDistance > weapon.maxRange,
      ballisticSolution: elevation != null,
      weapon: weapon,
      map: map,
      dataStatus: weapon.status,
      trajectoryModel: weapon.modelType === "range-table" ? "squadmc-table-interpolation" : "squadcalc-community-ballistics",
      muzzleVelocity: velocity
    };
  }

  global.MortarCalc = {
    gravity: GAME_GRAVITY,
    tableGravity: TABLE_GRAVITY,
    milsPerTurn: MILS_PER_TURN,
    maps: maps,
    weapons: weapons,
    findMap: findMap,
    findWeapon: findWeapon,
    normalizeWeaponId: normalizeWeaponId,
    getDamageRadii: getDamageRadii,
    computeSolution: computeSolution,
    computeMaxRange: computeMaxRange,
    interpolateTable: interpolateTable,
    clamp: clamp,
    normalizeAngle: normalizeAngle
  };
})(window);
