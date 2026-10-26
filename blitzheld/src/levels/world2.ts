import { LevelBuilder } from '../game/levelBuilder';
import type { LevelDef } from '../game/types';

// Welt 2: Die Kristallhöhle – Kristalle und Felsen, Felsplatten in verschiedenen Höhen,
// etwas längere Sprünge, Fledermäuse und Käfer.

export function cave1(): LevelDef {
  const b = new LevelBuilder({ id: '2-1', world: 1, index: 0, name: 'Glitzergang', theme: 'cave', speed: 228 });
  b.coins(6, 220, 40).run(650);
  b.hint('Kristall!', 10).coinArc(5, -80, 200, 135).hazard('crystal', 460);
  b.coinArc(5, -80, 200, 130).hazard('rock', 420);
  b.coinArc(5, -70, 220, 130).gap(100).run(380);
  b.platform(40, 100, 170).coins(4, 70, 140).star(150, 220).run(300).hazard('crystal', 380);
  b.checkpoint(420);
  b.hazard('rock', 280).hazard('crystal', 400);
  b.coinArc(5, -70, 230, 135).gap(120).run(360);
  b.stepTo(-48).run(300).hazard('crystal', 300).stepTo(48).run(340);
  b.coinArc(5, -70, 240, 140).gap(130).run(380);
  b.checkpoint(420);
  b.hazard('crystal', 240).hazard('crystal', 380);
  b.platform(20, 90, 140).platform(200, 160, 140).coins(3, 50, 130).star(270, 240).gap(380).run(380);
  b.hazard('rock').star(-18, 210).run(300).coinArc(5, -70, 230, 135).gap(115).run(300);
  b.coins(6, 40, 40);
  return b.goal();
}

export function cave2(): LevelDef {
  const b = new LevelBuilder({ id: '2-2', world: 1, index: 1, name: 'Fledermaushöhle', theme: 'cave', speed: 236 });
  b.coins(6, 220, 40).run(650);
  b.hint('Käfer!', 30).walker('beetle', 50, 40, 40).coinArc(5, -40, 220, 135).run(500);
  b.hint('Fledermaus!', 30).flyer('bat', 14, 10, 1.6, 40).coinArc(5, -40, 220, 145).run(500);
  b.hazard('crystal', 380);
  b.coinArc(5, -70, 230, 135).gap(115).run(380);
  b.checkpoint(420);
  b.walker('beetle', 60, 40, 30).run(400);
  b.flyer('bat', 16, 12, 1.8, 20).run(380).hazard('rock', 380);
  b.platform(40, 110, 200).coins(5, 60, 150).star(230, 230).run(320).walker('beetle', 40, 35, 60).run(420);
  b.coinArc(5, -70, 240, 140).gap(125).run(360);
  b.checkpoint(420);
  b.flyer('bat', 12, 10, 1.4, 20).run(340).flyer('bat', 18, 12, 1.7, 20).run(380);
  b.hazard('crystal').star(-12, 215).run(300).walker('beetle', 50, 40, 40).run(420);
  b.stepTo(-50).star(200, 220).run(320).stepTo(50).run(300);
  b.flyer('bat', 14, 10, 1.6, 30).run(360).coinArc(5, -70, 240, 140).gap(125).run(320);
  b.coins(6, 40, 40);
  return b.goal();
}

export function cave3(): LevelDef {
  const b = new LevelBuilder({ id: '2-3', world: 1, index: 2, name: 'Kristallsprünge', theme: 'cave', speed: 242 });
  b.coins(6, 220, 40).run(650);
  b.hint('Lang drücken = weit springen!', 0, 170).coinArc(6, -80, 270, 150).gap(150).run(420);
  b.hazard('crystal', 360);
  b.platform(130, 50, 160).platform(420, 110, 160).coins(3, 160, 90).coins(3, 450, 150).gap(700, 0).run(420);
  b.checkpoint(420);
  b.crates(1, 0).crates(2, 0).coins(2, -60, 130).run(260).hazard('rock', 360);
  b.coinArc(6, -80, 270, 150).gap(155).run(320);
  b.stepTo(-60).run(260).coinArc(6, -70, 260, 150).gap(140).run(260).stepTo(60).run(360);
  b.platform(40, 120, 150).star(110, 250).hazard('crystal', 0).run(280).hazard('crystal', 380);
  b.checkpoint(420);
  b.platform(140, 70, 150).platform(420, 130, 150).platform(700, 70, 150).coins(3, 450, 170).star(495, 255).gap(960).run(380);
  b.walker('beetle', 50, 40, 40).run(400).hazard('rock', 300);
  b.coinArc(6, -80, 270, 150).gap(150).run(300).hazard('crystal', 300);
  b.platform(30, 110, 160).coins(4, 50, 150).star(150, 245).run(240).walker('beetle', 0, 0, 0).run(400);
  b.coins(6, 40, 40);
  return b.goal();
}
