import { LevelBuilder } from '../game/levelBuilder';
import type { LevelDef } from '../game/types';

// Welt 3: Die Wolkenwelt – Wolkeninseln mit größeren Abständen, Sprungfedern,
// schwebende Münzen, Vögel und bewegliche Wolken.

export function clouds1(): LevelDef {
  const b = new LevelBuilder({ id: '3-1', world: 2, index: 0, name: 'Wolkenweg', theme: 'clouds', speed: 240, groundKind: 'cloud' });
  b.coins(6, 220, 40).run(650);
  b.coinArc(5, -70, 220, 130).gap(110).run(380);
  b.coinArc(5, -70, 230, 140).gap(125).run(340);
  b.coins(5, 0, 110, 40).coinArc(6, -70, 260, 150).gap(140).run(360);
  b.hazard('spikyBush', 380);
  b.checkpoint(420);
  b.coinArc(5, -70, 230, 140).gap(120, -50).run(320);
  b.coinArc(5, -70, 230, 140).gap(120, 50).run(320);
  b.platform(30, 130, 150, 'cloud').coins(4, 50, 170).star(110, 255).run(300).hazard('spikyBush', 360);
  b.coinArc(6, -70, 260, 150).gap(145).run(340);
  b.checkpoint(420);
  b.hint('Feder! Einfach drüberlaufen!', 0, 190).spring(8).coinArc(7, -20, 250, 270, 60).gap(180).run(420);
  b.flyer('bird', 16, 10, 1.7, 20).coinArc(5, -50, 220, 140).run(420);
  b.spring(8).star(110, 300).gap(180).run(380);
  b.hazard('spikyBush').star(-17, 210).run(300).coinArc(6, -70, 260, 150).gap(140).run(320);
  b.coins(6, 40, 40);
  return b.goal();
}

export function clouds2(): LevelDef {
  const b = new LevelBuilder({ id: '3-2', world: 2, index: 1, name: 'Federwolken', theme: 'clouds', speed: 246, groundKind: 'cloud' });
  b.coins(6, 220, 40).run(650);
  b.spring(8).coinArc(7, -20, 250, 270, 60).gap(185).run(400);
  b.hint('Ganz nach oben!', 0, 200).spring(0).platformAt(150, 230, 260, 'cloud').coins(5, 170, 240).star(320, 300).run(140).gap(160).run(380);
  b.flyer('bird', 16, 10, 1.6, 20).run(380).coinArc(6, -70, 260, 150).gap(140).run(320);
  b.checkpoint(420);
  b.spring(8).gap(190).run(260).spring(8).gap(190).run(380);
  b.hazard('spikyBush', 280).flyer('bird', 14, 12, 1.5, 20).run(400);
  b.coinArc(6, -70, 270, 155).gap(150, -40).run(300).coinArc(6, -70, 270, 155).gap(145, 40).run(340);
  b.checkpoint(420);
  b.spring(0).platformAt(140, 220, 300, 'cloud').coins(6, 150, 245).star(230, 310).run(150).gap(300).run(380);
  b.walker('blob', 40, 30, 60).run(420).hazard('spikyBush', 300);
  b.spring(8).star(120, 310).gap(190).run(300).coinArc(6, -70, 270, 155).gap(150).run(320);
  b.coins(6, 40, 40);
  return b.goal();
}

export function clouds3(): LevelDef {
  const b = new LevelBuilder({ id: '3-3', world: 2, index: 2, name: 'Himmelsleiter', theme: 'clouds', speed: 250, groundKind: 'cloud' });
  b.coins(6, 220, 40).run(650);
  b.hint('Wolke fährt mit!', 120, 160).mover(100, 0, 170, 70, 0, 3.2).coins(4, 140, 50).gap(400).run(380);
  b.mover(110, 0, 140, 0, -70, 2.8).coins(3, 140, 110).gap(350).run(360);
  b.flyer('bird', 16, 10, 1.6, 20).run(380);
  b.checkpoint(420);
  b.mover(100, 0, 170, 70, 0, 3.0).gap(400).run(260);
  b.mover(110, 0, 140, 0, -70, 2.6).star(175, 250).gap(350).run(340);
  b.hazard('spikyBush').star(-17, 210).run(300).coinArc(6, -70, 270, 155).gap(150).run(320);
  b.spring(8).gap(195).run(360);
  b.checkpoint(420);
  b.mover(100, 0, 170, 70, 0, 2.8, 1.5).gap(400).run(240).mover(100, 0, 170, 70, 0, 2.8).gap(400).run(320);
  b.flyer('bird', 14, 12, 1.4, 20).run(340).hazard('spikyBush', 320);
  b.spring(0).platformAt(140, 230, 280, 'cloud').coins(6, 150, 255).star(260, 320).run(150).gap(300).run(360);
  b.mover(110, 0, 140, 0, -70, 2.4).gap(350).run(320).coinArc(6, -70, 270, 155).gap(150).run(320);
  b.coins(6, 40, 40);
  return b.goal();
}
