import { LevelBuilder } from '../game/levelBuilder';
import type { LevelDef } from '../game/types';

// Welt 1: Die grüne Wiese – sehr leichter Einstieg. Jede neue Hindernisart kommt zuerst
// allein, mit viel Platz und einem Münzbogen, der zeigt, wann man springen sollte.

export function meadow1(): LevelDef {
  const b = new LevelBuilder({ id: '1-1', world: 0, index: 0, name: 'Sonnige Wiese', theme: 'meadow', speed: 205 });
  b.coins(6, 220, 40).run(700);
  b.hint('Springen!', 10).coinArc(5, -80, 190, 125).hazard('stone', 460);
  b.coins(4, 80, 40).run(40).coinArc(5, -80, 190, 125).hazard('stone', 440);
  b.hint('Baumstumpf!', 10).coinArc(5, -80, 190, 130).hazard('stump', 460);
  b.coins(3, 40, 40).run(220).coinArc(5, -70, 200, 120).gap(75).run(420);
  b.checkpoint(420);
  b.coinArc(5, -80, 190, 125).hazard('stone', 300).coinArc(5, -80, 190, 125).hazard('stone', 420);
  b.coinArc(5, -70, 210, 125).gap(90).run(380);
  b.hazard('stump').star(-15, 205).run(440);
  b.coins(5, 20, 40).run(300).coinArc(5, -70, 210, 125).gap(95).run(420);
  b.checkpoint(420);
  b.coinArc(5, -80, 190, 125).hazard('stone', 280).coinArc(5, -80, 190, 130).hazard('stump', 440);
  b.platform(60, 120, 160).coins(4, 80, 160).star(220, 205).run(520);
  b.coinArc(5, -70, 220, 125).gap(105).run(360);
  b.hazard('stone', 300).hazard('stump', 260).star(-15, 205).run(300);
  b.coins(6, 40, 40);
  return b.goal();
}

export function meadow2(): LevelDef {
  const b = new LevelBuilder({ id: '1-2', world: 0, index: 1, name: 'Schneckenhügel', theme: 'meadow', speed: 215 });
  b.coins(6, 220, 40).run(650);
  b.coins(6, 40, 70, 60).hill(3, 70, 200).run(320);
  b.hint('Schnecke! Drüber oder drauf!', 0).walker('snail').coinArc(5, -80, 200, 130).run(460);
  b.coins(3, 10, 110).stepTo(-50).hint('Hochspringen!', 0, 170).run(420);
  b.hazard('stone', 380).stepTo(50).run(380);
  b.checkpoint(480);
  b.walker('snail', 60, 30).coinArc(5, -110, 220, 130).run(480);
  b.coins(5, 40, 70, 60).hill(2, 80, 160).run(300);
  b.hazard('stump', 340).walker('snail').run(480);
  b.coinArc(5, -70, 210, 125).gap(95).run(360);
  b.star(60, 205).hazard('stone', 400);
  b.checkpoint(420);
  b.stepTo(-45).run(260).stepTo(-45).run(320).star(-160, 230);
  b.hazard('stone', 320).stepTo(90).run(360);
  b.walker('snail', 80, 35).coinArc(5, -130, 230, 130).run(520);
  b.coinArc(5, -70, 220, 125).gap(105).run(340);
  b.hazard('stump', 260).walker('snail', 0, 0, 40).run(420);
  b.platform(40, 110, 200).coins(5, 60, 150).star(200, 210).run(460);
  b.coins(6, 40, 40);
  return b.goal();
}

export function meadow3(): LevelDef {
  const b = new LevelBuilder({ id: '1-3', world: 0, index: 2, name: 'Kistenpfad', theme: 'meadow', speed: 225 });
  b.coins(6, 220, 40).run(650);
  b.hint('Auf die Kiste!', 0).coins(3, 0, 80).crates(1, 360);
  b.crates(1, 0).crates(2, 0).coins(3, -60, 130).run(380);
  b.hazard('stone', 300).hazard('stump', 400);
  b.coinArc(5, -70, 220, 125).gap(110).run(400);
  b.checkpoint(420);
  b.crates(2, 0, 2).coins(2, -70, 130).star(-46, 240).run(400);
  b.walker('snail', 60, 30).run(440);
  b.platform(30, 90, 150).platform(240, 150, 150).coins(3, 60, 130).coins(3, 270, 190).star(380, 240).run(560);
  b.coinArc(5, -70, 230, 125).gap(120).run(320);
  b.hazard('stone', 300);
  b.checkpoint(420);
  b.crates(1, 200).hazard('stump', 320);
  b.crates(1, 0).crates(2, 0).crates(3, 0).coins(3, -100, 180).run(0);
  b.run(400);
  b.walker('snail', 0).run(300).hazard('stone', 380);
  b.coinArc(5, -70, 230, 125).gap(125).run(360);
  b.hazard('stump').star(-15, 205).run(280).hazard('stone', 400);
  b.coins(6, 40, 40);
  return b.goal();
}
