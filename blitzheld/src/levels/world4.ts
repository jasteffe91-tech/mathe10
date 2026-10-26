import { LevelBuilder } from '../game/levelBuilder';
import type { LevelDef } from '../game/types';

// Welt 4: Die Vulkaninsel – freundliche Lava, Feuerfontänen mit deutlicher Warnung,
// bewegliche Steinplatten und mehrere Hindernisse hintereinander.

export function volcano1(): LevelDef {
  const b = new LevelBuilder({ id: '4-1', world: 3, index: 0, name: 'Heiße Steine', theme: 'volcano', speed: 244 });
  b.coins(6, 220, 40).run(650);
  b.hint('Heißer Stein!', 10).coinArc(5, -80, 210, 135).hazard('lavaRock', 440);
  b.coinArc(5, -70, 230, 140).gap(115).run(380);
  b.hint('Feuer! Drüberspringen!', 10, 190).coinArc(5, -80, 220, 160).fire({ offset: 0.2 }, 440);
  b.hazard('lavaRock', 300).coinArc(5, -70, 240, 140).gap(125).run(360);
  b.checkpoint(420);
  b.fire({ offset: 1.1 }, 360).fire({ offset: 2.0 }, 380);
  b.walker('blob', 40, 30, 50).coinArc(5, -40, 220, 140).run(420);
  b.platform(40, 110, 170).coins(4, 60, 150).star(140, 235).run(260).hazard('lavaRock', 380);
  b.coinArc(6, -70, 260, 150).gap(140).run(360);
  b.checkpoint(420);
  b.hazard('lavaRock').star(-16, 210).run(260).fire({ offset: 0.6 }, 380);
  b.mover(100, 0, 170, 70, 0, 3.2).coins(4, 130, 50).gap(400).run(360);
  b.fire({ offset: 1.5 }, 0).star(17, 230).run(380).walker('blob', 0, 0, 0).run(400);
  b.coinArc(6, -70, 260, 150).gap(140).run(300);
  b.coins(6, 40, 40);
  return b.goal();
}

export function volcano2(): LevelDef {
  const b = new LevelBuilder({ id: '4-2', world: 3, index: 1, name: 'Feuertanz', theme: 'volcano', speed: 250 });
  b.coins(6, 220, 40).run(650);
  b.fire({ offset: 0.4 }, 380).fire({ offset: 1.6 }, 400);
  b.mover(110, 0, 140, 0, -70, 2.8).coins(3, 140, 110).gap(350).run(380);
  b.walker('blob', 50, 35, 50).run(380).hazard('lavaRock', 360);
  b.checkpoint(420);
  b.fire({ offset: 0.9 }, 300).hazard('lavaRock', 300).fire({ offset: 2.2 }, 380);
  b.platform(130, 60, 160).platform(420, 120, 160).coins(3, 160, 100).coins(3, 450, 160).star(500, 250).gap(700).run(380);
  b.mover(100, 0, 170, 70, 0, 3.0).gap(400).run(300).fire({ offset: 0.3 }, 380);
  b.checkpoint(420);
  b.walker('blob', 40, 30, 40).run(340).walker('blob', 40, 30, 40).run(400);
  b.stepTo(-50).run(260).fire({ offset: 1.2 }, 240).stepTo(50).run(320);
  b.platform(30, 110, 170).star(120, 240).coins(4, 50, 150).run(260).hazard('lavaRock', 380);
  b.mover(110, 0, 140, 0, -70, 2.5).gap(350).run(300).coinArc(6, -70, 260, 150).gap(145).run(320);
  b.fire({ offset: 2.0 }, 0).star(17, 235).run(400);
  b.coins(6, 40, 40);
  return b.goal();
}

export function volcano3(): LevelDef {
  const b = new LevelBuilder({ id: '4-3', world: 3, index: 2, name: 'Drachenpfad', theme: 'volcano', speed: 255 });
  b.coins(6, 220, 40).run(650);
  b.hazard('lavaRock', 300).fire({ offset: 0.5 }, 300).hazard('lavaRock', 380);
  b.coinArc(6, -70, 270, 155).gap(150).run(340);
  b.mover(100, 0, 170, 70, 0, 2.9).gap(400).run(260).mover(110, 0, 140, 0, -70, 2.6).gap(350).run(380);
  b.checkpoint(420);
  b.walker('blob', 50, 35, 40).run(340).fire({ offset: 1.4 }, 300).hazard('lavaRock', 380);
  b.crates(1, 0).crates(2, 0).coins(2, -60, 130).star(-23, 250).run(260).fire({ offset: 0.2 }, 380);
  b.platform(140, 70, 150).platform(420, 130, 150).platform(700, 70, 150).coins(3, 450, 170).gap(960).run(380);
  b.checkpoint(420);
  b.fire({ offset: 0.8 }, 280).fire({ offset: 1.9 }, 280).fire({ offset: 3.0 }, 380);
  b.mover(100, 0, 170, 70, 0, 2.7, 1.2).gap(400).run(240).mover(100, 0, 170, 70, 0, 2.7).gap(400).run(340);
  b.walker('blob', 40, 30, 30).run(320).hazard('lavaRock', 280).star(-15, 240).run(100);
  b.coinArc(6, -70, 270, 155).gap(150, -40).run(300).fire({ offset: 1.0 }, 280).stepTo(40).run(320);
  b.platform(30, 110, 170).coins(4, 50, 150).star(130, 245).run(240).hazard('lavaRock', 400);
  b.coins(6, 40, 40);
  return b.goal();
}
