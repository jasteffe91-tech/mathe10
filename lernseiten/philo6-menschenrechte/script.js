/* ===== Menschenrechte-Rallye · Philosophie Klasse 6 =====
   Läuft komplett lokal im Browser, ohne Server und ohne externe Bibliotheken.
   Gespeichert wird nur der Lernfortschritt (localStorage).
   Freie Texte (Philosophie-Ecke, Charta) liegen nur in sessionStorage
   und verschwinden, wenn der Tab geschlossen wird. Namen werden nie gespeichert. */
'use strict';

const IMG = 'public/images/menschenrechte-wimmelbild.jpeg';
const STORE_KEY = 'mr-rallye-v1';
const TEXT_KEY = 'mr-rallye-texte-v1';

/* ------------------------------------------------------------------ */
/* Begriffe (werden per Antippen erklärt)                              */
/* ------------------------------------------------------------------ */
const TERMS = {
  'Würde': 'Würde heißt: Jeder Mensch ist wertvoll – einfach, weil er ein Mensch ist. Niemand darf wie ein Ding behandelt werden.',
  'Diskriminierung': 'Diskriminierung heißt: Jemand wird schlechter behandelt, weil er z. B. eine andere Herkunft, Hautfarbe, Religion oder ein anderes Geschlecht hat.',
  'UN': 'UN = Vereinte Nationen. Fast alle Länder der Welt arbeiten dort zusammen, damit es mehr Frieden auf der Welt gibt.',
  'Demonstration': 'Bei einer Demonstration treffen sich viele Menschen friedlich, um öffentlich zu zeigen, was ihnen wichtig ist.',
  'Asyl': 'Asyl heißt Schutz. Wer in seinem Land verfolgt wird oder in Gefahr ist, darf in einem anderen Land um Schutz bitten.',
  'Teilhabe': 'Teilhabe heißt: Alle können mitmachen und dabei sein – auch Menschen mit Behinderung.',
  'Justitia': 'Justitia ist eine Figur, die für Gerechtigkeit vor Gericht steht. Du findest sie oft an Gerichtsgebäuden.',
  'Gleichberechtigung': 'Gleichberechtigung heißt: Alle Menschen haben die gleichen Rechte – zum Beispiel Mädchen und Jungen, Frauen und Männer.',
  'Menschenrechtsverletzung': 'Eine Menschenrechtsverletzung liegt vor, wenn einem Menschen ein Menschenrecht genommen wird – zum Beispiel vom Staat. Ob das wirklich so war, muss man genau prüfen.',
  'Gesetz': 'Ein Gesetz ist eine Regel, die der Staat für alle festlegt.',
  'Barrierefreiheit': 'Barrierefrei heißt: Alle Menschen kommen ohne fremde Hilfe hinein und zurecht – zum Beispiel mit Rampe, Aufzug oder Blindenschrift.'
};
const term = (w, label) => `<button type="button" class="term" data-term="${w}">${label || w}</button>`;

/* ------------------------------------------------------------------ */
/* Stationen                                                           */
/* ------------------------------------------------------------------ */
const STATIONS = [
  { id: 's1', nr: 1, icon: '🔍', title: 'Entdecke die Menschenrechte!', min: 10 },
  { id: 's2', nr: 2, icon: '📜', title: 'Was sind eigentlich Menschenrechte?', min: 8 },
  { id: 's3', nr: 3, icon: '🏫', title: 'Menschenrechte im Alltag entdecken', min: 7 },
  { id: 's4', nr: 4, icon: '🧠', title: 'Das Menschenrechte-Quiz', min: 8 },
  { id: 's5', nr: 5, icon: '🤔', title: 'Denke selbst nach! – Die Philosophie-Ecke', min: 8 },
  { id: 's6', nr: 6, icon: '🌍', title: 'Meine eigene Menschenrechte-Charta', min: 5 }
];

/* ------------------------------------------------------------------ */
/* STATION 1 – Bildaufgaben.                                           */
/* Bereiche in Prozent des Bildes: [links, oben, rechts, unten].       */
/* Die Bereiche wurden mit einem Prozent-Raster am Originalbild        */
/* (1600 × 1131 px) abgemessen.                                         */
/* ------------------------------------------------------------------ */
const S1_TASKS = [
  {
    id: 'demo',
    task: 'Finde eine Situation, in der Menschen gemeinsam für ihre Rechte eintreten.',
    regions: [[85, 13, 100, 32]],
    alts: [
      { r: [20, 52, 31, 75], msg: 'Gut beobachtet: Auch die Menschen mit dem „Welcome!“-Schild setzen sich für andere ein. Gesucht ist hier aber eine Gruppe mit vielen Schildern.' },
      { r: [25, 71, 37, 92], msg: 'Stimmt, dieser Mann sagt laut seine Meinung. Gesucht ist aber eine ganze Gruppe mit vielen Schildern.' }
    ],
    title: 'Eine Demonstration',
    question: 'Was machen die Menschen hier?',
    options: [
      'Sie warten auf den Bus.',
      'Sie demonstrieren friedlich und zeigen auf Schildern, was ihnen wichtig ist.',
      'Sie streiten sich um die Schilder.'
    ],
    correct: 1,
    explain: `Genau! Das ist eine ${term('Demonstration')}. Alle Menschen dürfen sich friedlich versammeln und zeigen, was sie denken. Schau genau: Jung und Alt sind dabei – und auch ein Mensch im Rollstuhl.`
  },
  {
    id: 'gericht',
    task: 'Entdecke eine Situation, in der ein Mensch möglicherweise ungerecht behandelt wird.',
    regions: [[49, 57, 66, 80]],
    alts: [
      { r: [1, 74, 26, 94], msg: 'Gut beobachtet! Hier wird ein Paar heimlich belauscht und fotografiert – das verletzt möglicherweise die Privatsphäre. Gesucht ist aber eine Szene mit einer Sprechblase vor Gericht.' },
      { r: [75, 30, 100, 48], msg: 'Gut beobachtet! Hier wird eine Frau an einer Grenze weggeschickt. Ob das ungerecht ist, müsste man genauer wissen. Gesucht ist aber eine Szene mit einer Sprechblase vor Gericht.' },
      { r: [1, 38, 14, 57], msg: 'Ja, hier wird ein Mensch mit Gewalt bedroht – das ist schlimm und verboten. Gesucht ist aber eine Szene mit einer Sprechblase vor Gericht.' }
    ],
    title: '„Name? Schuldig!!“',
    question: 'Der Richter ruft: „Name? Schuldig!!“ Was ist daran problematisch?',
    options: [
      'Er fragt nach dem Namen – das ist verboten.',
      'Gar nichts. Richter dürfen entscheiden, wie sie wollen.',
      'Er entscheidet sofort, ohne zuzuhören und ohne Beweise zu prüfen.'
    ],
    correct: 2,
    explain: `Richtig! Jeder Mensch hat das Recht auf ein <b>faires Verfahren</b>: Man darf sich verteidigen, und erst muss genau geprüft werden, was passiert ist.<br><br><b>Aber Achtung:</b> Wir sehen nur einen kurzen Moment. Ob wirklich eine ${term('Menschenrechtsverletzung')} vorliegt, müsste man genau prüfen. Klar ist aber: So sollte ein Gericht nicht arbeiten.`
  },
  {
    id: 'picknick',
    task: 'Suche Menschen, die gemeinsam etwas unternehmen.',
    regions: [[15, 38, 37, 53]],
    alts: [
      { r: [85, 13, 100, 32], msg: 'Stimmt, auch diese Menschen sind gemeinsam unterwegs! Gesucht ist aber eine Gruppe, die zusammen isst.' },
      { r: [16, 14, 29, 26], msg: 'Die drei Babys jubeln zusammen – schön! Gesucht ist aber eine Gruppe, die zusammen isst.' }
    ],
    title: 'Ein Picknick',
    question: 'Was fällt dir an der Gruppe beim Picknick auf?',
    options: [
      'Ganz unterschiedliche Menschen – jung und alt, mit und ohne Rollstuhl – essen zusammen.',
      'Alle sehen genau gleich aus.',
      'Nur Kinder dürfen mitessen.'
    ],
    correct: 0,
    explain: 'Richtig! Die Menschen sind sehr verschieden – und trotzdem gehören alle dazu. Niemand wird ausgeschlossen. Genau darum geht es bei den Menschenrechten: Jeder Mensch ist gleich viel wert.'
  },
  {
    id: 'justitia',
    task: 'Finde eine Figur, die für Gleichberechtigung und Gerechtigkeit steht. Tipp: Sie hält eine Waage.',
    regions: [[61, 27, 73, 53]],
    alts: [],
    title: 'Justitia',
    question: 'Die Frau trägt eine Augenbinde und hält eine Waage. Was soll das bedeuten?',
    options: [
      'Sie spielt Blinde Kuh.',
      'Vor Gericht werden alle gleich behandelt – egal, wer sie sind oder wie sie aussehen.',
      'Nur reiche Menschen bekommen recht.'
    ],
    correct: 1,
    explain: `Super! Das ist ${term('Justitia')}. Die Augenbinde bedeutet: Sie schaut nicht darauf, wer vor ihr steht – arm oder reich, Frau oder Mann, egal welche Herkunft. Mit der Waage wägt sie gerecht ab. Das nennt man <b>Gleichheit vor dem Gesetz</b>.`
  },
  {
    id: 'rollstuhl',
    task: 'Entdecke eine Situation, in der Menschen mit Behinderung dabei sind.',
    regions: [[27, 39, 36, 51], [87, 20, 94, 31]],
    alts: [
      { r: [44, 76, 51, 93], msg: 'Gut beobachtet: Der ältere Mann geht mit Stock und Hund über die Straße – vielleicht sieht er nicht gut. Für diese Aufgabe suchen wir einen Rollstuhl.' }
    ],
    title: 'Mittendrin dabei',
    question: 'Was zeigt das Bild über Menschen mit Behinderung?',
    options: [
      'Sie müssen zu Hause bleiben.',
      'Sie dürfen nur zuschauen.',
      'Sie sind mittendrin dabei – beim Picknick und bei der Demonstration.'
    ],
    correct: 2,
    explain: `Richtig! Im Bild gibt es sogar zwei Menschen im Rollstuhl. Menschen mit Behinderung haben die gleichen Rechte wie alle anderen. Das nennt man ${term('Teilhabe')}. Damit das klappt, braucht es zum Beispiel Rampen und Aufzüge.`
  },
  {
    id: 'wahl',
    task: 'Finde eine Situation, in der Menschen frei mitbestimmen können.',
    regions: [[50, 40, 62, 57]],
    alts: [
      { r: [85, 13, 100, 32], msg: 'Stimmt, auch bei einer Demonstration bestimmen Menschen mit! Gesucht ist hier aber eine Kiste mit einem Kreuz.' }
    ],
    title: 'Eine Wahl',
    question: 'Was macht die Frau mit dem Umschlag?',
    options: [
      'Sie wählt und bestimmt so mit, wer regiert.',
      'Sie schickt einen Brief an ihre Oma.',
      'Sie wirft Müll weg.'
    ],
    correct: 0,
    explain: 'Genau! Sie wirft ihren Stimmzettel in die Wahlurne. Bei einer freien und geheimen Wahl darf jeder selbst entscheiden – niemand darf zuschauen oder jemanden zwingen. Auch ihr bestimmt mit, zum Beispiel bei der Klassensprecherwahl.'
  },
  {
    id: 'schule',
    task: 'Finde eine Situation, in der Menschen gemeinsam lernen.',
    regions: [[26, 19, 41, 33]],
    alts: [],
    title: 'Ein Klassenzimmer',
    question: 'Welches Menschenrecht siehst du hier?',
    options: [
      'Recht auf Urlaub',
      'Recht auf Bildung',
      'Recht auf Eigentum'
    ],
    correct: 1,
    explain: 'Richtig! Jeder Mensch hat ein Recht auf Bildung. Lernen hilft, später einen Beruf zu finden, mitzureden und das eigene Leben zu gestalten. Schau: Im Bild lernen ganz unterschiedliche Menschen gemeinsam.'
  },
  {
    id: 'welcome',
    task: 'Finde Menschen, die ihre Heimat verlassen mussten – und Menschen, die sie willkommen heißen.',
    regions: [[3, 52, 31, 75]],
    alts: [
      { r: [75, 30, 100, 48], msg: 'Gut beobachtet: Auch hier steht eine Frau an einer Grenze. Gesucht ist aber eine Familie mit Koffer – und ein Schild, auf dem „Welcome!“ steht.' }
    ],
    title: '„Welcome!“',
    question: 'Was bedeutet das Schild „Welcome!“?',
    options: [
      'Hier hat ein neues Geschäft eröffnet.',
      'Hier darf niemand hinein.',
      'Die Menschen heißen die Ankommenden willkommen und wollen ihnen helfen.'
    ],
    correct: 2,
    explain: `Richtig! „Welcome“ ist Englisch und heißt „Willkommen“. Eine Familie mit Koffer kommt über eine Grenze. Wer in seinem Land verfolgt wird, darf in einem anderen Land um Schutz bitten. Das nennt man ${term('Asyl')}.`
  },
  {
    id: 'meinung',
    task: 'Finde einen Menschen, der öffentlich seine Meinung sagt.',
    regions: [[25, 71, 37, 92]],
    alts: [
      { r: [85, 13, 100, 32], msg: 'Stimmt, auch die Menschen mit Schildern zeigen ihre Meinung! Gesucht ist aber ein einzelner Mann, der auf einer Kiste steht.' }
    ],
    title: 'Freie Meinung',
    question: 'Der Mann steht auf einer Kiste und spricht zu anderen. Welches Recht nutzt er?',
    options: [
      'Recht auf freie Meinungsäußerung',
      'Recht auf Arbeit',
      'Recht auf Spielen'
    ],
    correct: 0,
    explain: 'Genau! Jeder darf sagen, was er denkt – auch wenn nicht alle einverstanden sind. Die Grenze: Man darf andere nicht beleidigen oder bedrohen.'
  }
];

/* ------------------------------------------------------------------ */
/* STATION 2 – Fünf Rechte + Wissenstest                               */
/* ------------------------------------------------------------------ */
const RIGHTS = [
  {
    icon: '🛡️', title: 'Recht auf Leben und Sicherheit',
    text: 'Jeder Mensch darf leben. Niemand darf dich schlagen, quälen oder bedrohen.',
    ex: 'Wenn ein Kind auf dem Schulhof bedroht wird, müssen Erwachsene helfen und es schützen.',
    pic: 'Im Wimmelbild: Ein Polizist und ein Soldat der UN halten Schirme über eine Mutter mit ihren Kindern.'
  },
  {
    icon: '📚', title: 'Recht auf Bildung',
    text: 'Jedes Kind darf zur Schule gehen und lernen. Die Grundschule soll kostenlos sein.',
    ex: 'Du lernst lesen, schreiben und rechnen – egal, wie viel Geld deine Familie hat.',
    pic: 'Im Wimmelbild: das Klassenzimmer mit der Tafel „E = mc²“.'
  },
  {
    icon: '💬', title: 'Recht auf freie Meinungsäußerung',
    text: 'Du darfst sagen, was du denkst – auch wenn andere anderer Meinung sind. Beleidigen oder bedrohen darfst du aber niemanden.',
    ex: 'Im Klassenrat sagst du, dass du dir einen anderen Ausflug wünschst.',
    pic: 'Im Wimmelbild: der Mann, der auf einer Kiste steht und spricht.'
  },
  {
    icon: '⚖️', title: 'Recht auf Gleichbehandlung',
    text: `Niemand darf schlechter behandelt werden wegen Herkunft, Hautfarbe, Geschlecht, Religion, Behinderung oder Geld. Wer das trotzdem tut, betreibt ${term('Diskriminierung')}.`,
    ex: 'Beim Wählen der Teams im Sport wird niemand ausgelassen, nur weil er anders aussieht.',
    pic: 'Im Wimmelbild: Justitia mit Waage und Augenbinde.'
  },
  {
    icon: '🕊️', title: 'Recht auf Freiheit und Selbstbestimmung',
    text: 'Du darfst über dein Leben mitbestimmen: woran du glaubst, mit wem du befreundet bist, was du denkst. Niemand darf ohne Grund eingesperrt oder wie ein Sklave gehalten werden.',
    ex: 'Du darfst selbst entscheiden, welches Hobby du ausprobierst oder mit wem du spielst.',
    pic: 'Im Wimmelbild: das Paar mit den Schlüsseln neben den geöffneten Fesseln.'
  }
];

const S2_QUIZ = [
  {
    q: 'Darf ein Kind wegen seiner Herkunft vom Schulbesuch ausgeschlossen werden?',
    options: ['Ja, wenn die Schule das entscheidet.', 'Nein, jedes Kind hat ein Recht auf Bildung.', 'Nur wenn die Eltern zustimmen.'],
    correct: 1,
    explain: 'Jedes Kind darf zur Schule gehen – egal, woher es kommt. Das Recht auf Bildung gilt für alle Kinder.'
  },
  {
    q: 'Für wen gelten die Menschenrechte?',
    options: ['Nur für Menschen in Deutschland.', 'Nur für Erwachsene.', 'Für alle Menschen auf der ganzen Welt.'],
    correct: 2,
    explain: 'Menschenrechte gelten für jeden Menschen – für Kinder und Erwachsene, überall auf der Welt. Man muss sie sich nicht verdienen.'
  },
  {
    q: 'Lena schreibt in der Schülerzeitung, dass sie die Pausenregeln doof findet. Darf sie das?',
    options: ['Ja, das ist ihre Meinung – solange sie niemanden beleidigt.', 'Nein, Kritik an Regeln ist verboten.', 'Nur, wenn alle Lehrkräfte zustimmen.'],
    correct: 0,
    explain: 'Lena nutzt ihr Recht auf freie Meinungsäußerung. Sie darf Regeln kritisieren. Sie darf aber niemanden beleidigen.'
  },
  {
    q: 'Ein Kind wird auf dem Schulweg immer wieder geschlagen. Welches Recht ist hier betroffen?',
    options: ['Recht auf Bildung', 'Recht auf Leben und Sicherheit', 'Recht auf freie Meinungsäußerung'],
    correct: 1,
    explain: 'Niemand darf verletzt werden. Das Kind hat ein Recht auf Sicherheit – Erwachsene müssen es schützen.'
  },
  {
    q: 'Was gehört zum Recht auf Freiheit und Selbstbestimmung?',
    options: ['Man darf alles machen, auch wenn andere dabei verletzt werden.', 'Man muss nie Regeln befolgen.', 'Man darf selbst entscheiden, woran man glaubt und mit wem man befreundet ist.'],
    correct: 2,
    explain: 'Freiheit heißt nicht: Ich darf alles. Meine Freiheit hört da auf, wo ich anderen schade. Aber über mein eigenes Leben darf ich mitbestimmen.'
  },
  {
    q: 'Im Sportverein heißt es: „Kinder mit Brille dürfen nicht mitspielen.“ Welches Recht wird hier nicht beachtet?',
    options: ['Recht auf Gleichbehandlung', 'Recht auf Eigentum', 'Recht auf Asyl'],
    correct: 0,
    explain: 'Kinder mit Brille werden ohne guten Grund schlechter behandelt. Das widerspricht dem Recht auf Gleichbehandlung.'
  }
];

/* ------------------------------------------------------------------ */
/* STATION 3 – Alltagssituationen                                      */
/* ------------------------------------------------------------------ */
const S3_SITUATIONS = [
  {
    icon: '⚽', text: 'Ein Mädchen möchte Fußball spielen. Die anderen Kinder sagen: „Fußball ist nur etwas für Jungen!“',
    judge: 'ungerecht',
    judgeExplain: 'Das Mädchen wird nur wegen ihres Geschlechts ausgeschlossen. Mädchen und Jungen haben die gleichen Rechte.',
    q: 'Welches Recht wird hier nicht beachtet?',
    options: ['Recht auf Gleichbehandlung', 'Recht auf Bildung', 'Recht auf Eigentum'],
    correct: 0,
    explain: `Genau – das Recht auf Gleichbehandlung (${term('Gleichberechtigung')}). Übrigens: Hier handeln Kinder unfair. Das ist ungerecht, aber noch keine Menschenrechtsverletzung durch den Staat. Menschenrechte leben aber davon, dass wir sie <b>alle</b> im Alltag achten.`
  },
  {
    icon: '🧱', text: 'Ein Kind kann nicht zur Schule gehen, weil es den ganzen Tag arbeiten muss.',
    judge: 'ungerecht',
    judgeExplain: 'Kinder sollen lernen und spielen dürfen – nicht den ganzen Tag arbeiten müssen.',
    q: 'Welches Menschenrecht wird hier verletzt?',
    options: ['Recht auf freie Meinungsäußerung', 'Recht auf Bildung', 'Recht auf Asyl'],
    correct: 1,
    explain: 'Richtig, das Recht auf Bildung. Außerdem sollen Kinder vor schwerer Arbeit geschützt werden. Leider gibt es Kinderarbeit noch in vielen Ländern der Welt.'
  },
  {
    icon: '🗣️', text: 'Ein Schüler traut sich nicht mehr, seine Meinung zu sagen, weil die anderen ihn jedes Mal auslachen.',
    judge: 'ungerecht',
    judgeExplain: 'Wer ausgelacht wird, sagt bald gar nichts mehr. Dann geht seine Meinung verloren.',
    q: 'Welches Recht spielt hier eine Rolle?',
    options: ['Recht auf Leben', 'Recht auf Eigentum', 'Recht auf freie Meinungsäußerung'],
    correct: 2,
    explain: 'Genau! Niemand verbietet ihm das Reden – aber das Auslachen macht ihn still. Das ist unfair und respektlos. Eine Menschenrechtsverletzung im engen Sinn wäre es, wenn zum Beispiel der Staat Meinungen verbietet. Trotzdem gilt: Jeder sollte sich trauen dürfen, seine Meinung zu sagen.'
  },
  {
    icon: '♿', text: 'Ein Kind im Rollstuhl kommt nicht in die Stadtbücherei, weil es dort nur Treppen und keine Rampe gibt.',
    judge: 'ungerecht',
    judgeExplain: 'Das Kind möchte hinein wie alle anderen, wird aber durch die Treppe ausgeschlossen.',
    q: 'Was müsste verändert werden?',
    options: ['Das Kind soll draußen warten.', 'Es muss eine Rampe oder einen Aufzug geben, damit alle hineinkommen.', 'Das Kind soll sich die Bücher von anderen holen lassen.'],
    correct: 1,
    explain: `Richtig! Öffentliche Gebäude sollen ${term('Barrierefreiheit', 'barrierefrei')} sein. Dann kann das Kind selbstständig hinein – wie alle anderen auch. Das nennt man ${term('Teilhabe')}.`
  },
  {
    icon: '🚫', text: 'Ein Kind darf bei einem Spiel nicht mitmachen. Die anderen sagen: „Du kommst ja nicht von hier.“',
    judge: 'ungerecht',
    judgeExplain: 'Das Kind wird nur wegen seiner Herkunft ausgeschlossen – nicht wegen dem, was es getan hat.',
    q: 'Warum ist das ungerecht?',
    options: ['Weil jeder Mensch gleich viel wert ist – egal, woher er kommt.', 'Weil das Kind sowieso keine Lust hatte.', 'Es ist nicht ungerecht, man darf sich seine Mitspieler immer aussuchen.'],
    correct: 0,
    explain: `Genau! Herkunft sagt nichts darüber, wie ein Mensch ist. Jemanden deshalb auszuschließen ist ${term('Diskriminierung')}.`
  },
  {
    icon: '🎲', text: 'Eine Gruppe von Kindern entscheidet gemeinsam, welches Spiel sie spielen möchte. Jeder darf seine Meinung sagen, dann wird abgestimmt.',
    judge: 'gerecht',
    judgeExplain: 'Alle werden gefragt und alle dürfen mitentscheiden. So soll es sein!',
    q: 'Welche Rechte werden hier berücksichtigt?',
    options: ['Recht auf Asyl', 'Freie Meinungsäußerung und Mitbestimmung', 'Recht auf Eigentum'],
    correct: 1,
    explain: 'Richtig! Jeder darf seine Meinung sagen, und alle stimmen gleichberechtigt ab. Im Kleinen ist das wie eine Wahl.'
  }
];

/* ------------------------------------------------------------------ */
/* STATION 4 – Quiz (gemischte Formate, 3 Schwierigkeitsstufen)         */
/* ------------------------------------------------------------------ */
const S4_QUIZ = [
  { type: 'tf', level: 1, q: 'Menschenrechte gelten nur für Erwachsene.', correct: false,
    explain: 'Falsch! Menschenrechte gelten für alle Menschen – auch für Kinder. Für Kinder gibt es zusätzlich noch eigene Kinderrechte.' },
  { type: 'mc', level: 1, q: 'Darf jeder Mensch seine Meinung äußern?',
    options: ['Nein, nur Erwachsene.', 'Ja – solange er andere nicht beleidigt oder bedroht.', 'Nur, wenn alle derselben Meinung sind.'], correct: 1,
    explain: 'Jeder darf seine Meinung sagen. Die Grenze ist da, wo andere beleidigt oder bedroht werden.' },
  { type: 'tf', level: 1, q: 'Ein Mensch darf wegen seiner Herkunft schlechter behandelt werden.', correct: false,
    explain: 'Falsch! Herkunft ist niemals ein Grund, jemanden schlechter zu behandeln. Das wäre Diskriminierung.' },
  { type: 'mc', level: 2, q: 'Warum ist das Recht auf Bildung wichtig?',
    options: ['Damit Kinder beschäftigt sind.', 'Weil Lernen hilft, das eigene Leben selbst zu gestalten und mitzureden.', 'Damit es Hausaufgaben gibt.'], correct: 1,
    explain: 'Wer lesen, schreiben und rechnen kann, kann sich informieren, einen Beruf lernen und mitbestimmen.' },
  { type: 'mc', level: 2, q: 'Was bedeutet Gleichberechtigung?',
    options: ['Alle Menschen müssen gleich aussehen.', 'Alle bekommen immer genau dasselbe Geschenk.', 'Alle Menschen haben die gleichen Rechte – egal ob Mädchen oder Junge, Frau oder Mann.'], correct: 2,
    explain: 'Gleichberechtigt heißt nicht „gleich“. Menschen sind verschieden – aber sie haben die gleichen Rechte.' },
  { type: 'match', level: 2, q: 'Ordne jeder Situation das passende Recht zu.',
    pairs: [
      ['Ein Mädchen darf nicht zur Schule.', 'Recht auf Bildung'],
      ['Eine Zeitung darf nicht über den König schreiben.', 'Recht auf freie Meinungsäußerung'],
      ['Ein Mann wird ohne Gerichtsverfahren eingesperrt.', 'Recht auf Freiheit'],
      ['Eine Frau bekommt die Wohnung nicht, weil sie eine andere Hautfarbe hat.', 'Recht auf Gleichbehandlung']
    ],
    explain: 'Super! Oft kann man eine Situation einem bestimmten Recht zuordnen – manchmal spielen auch mehrere Rechte eine Rolle.' },
  { type: 'mc', level: 2, q: 'Was bedeutet Menschenwürde?',
    options: ['Jeder Mensch ist wertvoll, einfach weil er ein Mensch ist.', 'Nur berühmte Menschen sind wertvoll.', 'Man muss sich Würde erst verdienen.'], correct: 0,
    explain: '„Alle Menschen sind frei und gleich an Würde und Rechten geboren.“ So steht es in Artikel 1 der Menschenrechte. Würde muss man sich nicht verdienen.' },
  { type: 'mc', level: 2, q: 'Warum brauchen Menschen Schutz vor Gewalt?',
    options: ['Weil Gewalt Körper und Seele verletzt und Angst macht.', 'Weil Streiten verboten ist.', 'Weil Gewalt nur bei Erwachsenen schlimm ist.'], correct: 0,
    explain: 'Gewalt verletzt Menschen und nimmt ihnen die Sicherheit. Ohne Sicherheit kann niemand frei leben. Streiten ohne Gewalt ist übrigens erlaubt!' },
  { type: 'mc', level: 3, situation: true, q: 'Situation: Eine Lehrerin gibt einem Jungen eine schlechtere Note, nur weil seine Familie aus einem anderen Land kommt. Wie beurteilst du das?',
    options: ['Das ist in Ordnung, Lehrkräfte dürfen das.', 'Das ist ungerecht – er wird wegen seiner Herkunft benachteiligt.', 'Das ist egal, Noten sind nicht wichtig.'], correct: 1,
    explain: 'Noten müssen sich nach der Leistung richten – nicht nach der Herkunft. Hier wird das Recht auf Gleichbehandlung missachtet.' },
  { type: 'multi', level: 3, q: 'Welche davon sind echte Menschenrechte? Wähle alle passenden aus.',
    options: ['Recht auf Bildung', 'Recht auf das neueste Handy', 'Schutz vor Folter', 'Recht, bei jedem Spiel zu gewinnen', 'Recht auf freie Meinungsäußerung'],
    correct: [0, 2, 4],
    explain: 'Menschenrechte schützen das, was jeder Mensch braucht, um frei, sicher und in Würde zu leben. Ein Handy oder immer zu gewinnen gehört nicht dazu.' },
  { type: 'tf', level: 3, q: 'Wer etwas Schlimmes getan hat, verliert alle seine Menschenrechte.', correct: false,
    explain: 'Falsch! Auch wer eine Strafe bekommt, behält seine Würde. Er hat zum Beispiel ein Recht auf ein faires Verfahren und darf nicht gefoltert werden.' },
  { type: 'mc', level: 3, q: 'Im Wimmelbild ruft ein Richter: „Name? Schuldig!!“ Welches Recht fehlt hier möglicherweise?',
    options: ['Recht auf ein faires Verfahren', 'Recht auf Erholung', 'Recht auf Eigentum'], correct: 0,
    explain: 'Vor Gericht muss man angehört werden und sich verteidigen dürfen. Erst dann darf entschieden werden.' },
  { type: 'mc', level: 2, q: 'Wann haben die Vereinten Nationen (UN) die Allgemeine Erklärung der Menschenrechte beschlossen?',
    options: ['1848', '1948', '2008'], correct: 1,
    explain: 'Am 10. Dezember 1948 – nach dem schrecklichen Zweiten Weltkrieg. Deshalb ist der 10. Dezember der „Tag der Menschenrechte“.' }
];

/* ------------------------------------------------------------------ */
/* STATION 5 – Philosophie-Ecke                                        */
/* ------------------------------------------------------------------ */
const S5_QUESTIONS = [
  {
    q: 'Sind wirklich alle Menschen gleich?',
    hints: ['Denke an deine Klasse: Worin seid ihr verschieden? Worin seid ihr gleich?', 'Ist „gleich aussehen“ dasselbe wie „gleich viel wert sein“?', 'Versuche, ein Beispiel zu finden.'],
    views: ['Manche sagen: „Nein! Jeder Mensch ist anders – groß, klein, laut, leise, schnell, langsam.“', 'Andere sagen: „Ja! Alle haben die gleiche Würde und die gleichen Rechte.“']
  },
  {
    q: 'Kann etwas erlaubt sein – und trotzdem ungerecht?',
    hints: [`Ein ${term('Gesetz')} ist eine Regel vom Staat. Kann eine solche Regel unfair sein?`, 'Früher durften Frauen in Deutschland nicht wählen. Das war erlaubt. War es auch gerecht?', 'Denke an eine Regel aus deinem Alltag, die du unfair findest.'],
    views: ['Manche sagen: „Was erlaubt ist, ist auch richtig – sonst hätte man es ja verboten.“', 'Andere sagen: „Regeln machen Menschen. Menschen können sich irren. Deshalb kann auch eine Regel ungerecht sein.“']
  },
  {
    q: 'Darf die Freiheit eines Menschen eingeschränkt werden, wenn dadurch andere geschützt werden?',
    hints: ['Denke an Regeln im Straßenverkehr oder in der Schule.', 'Wer sollte entscheiden, wie viel Einschränkung in Ordnung ist?', 'Kannst du auch eine andere Meinung verstehen?'],
    views: ['Manche sagen: „Ja – zum Beispiel darf niemand bei Rot über die Ampel fahren, weil das andere gefährdet.“', 'Andere sagen: „Vorsicht! Wenn man zu oft Freiheit einschränkt, ist irgendwann kaum noch etwas erlaubt.“']
  },
  {
    q: 'Warum sollten Menschen Rechte haben, auch wenn sie sich nicht immer richtig verhalten?',
    hints: ['Stell dir vor, du hast einen Fehler gemacht. Wie möchtest du dann behandelt werden?', 'Was wäre, wenn man sich Rechte erst „verdienen“ müsste? Wer würde das entscheiden?', 'Denke an den Richter im Wimmelbild: „Name? Schuldig!!“'],
    views: ['Manche sagen: „Wer anderen schadet, sollte auch weniger Rechte haben.“', 'Andere sagen: „Jeder Mensch behält seine Würde. Auch wer bestraft wird, darf nicht gequält werden.“']
  },
  {
    q: 'Stell dir vor, du dürftest drei Regeln für eine gerechte Welt aufstellen. Welche wären das?',
    three: true,
    hints: ['Denke an Dinge, die dich im Alltag ärgern oder traurig machen.', 'Was brauchen alle Menschen, um gut zu leben?', 'Begründe eine Regel mit „weil …“.'],
    views: ['Manche denken zuerst an Frieden und Sicherheit.', 'Andere denken zuerst an Fairness – zum Beispiel, dass alle mitbestimmen dürfen.']
  }
];

const S6_IDEAS = [
  'Jeder Mensch soll seine Meinung sagen dürfen.',
  'Niemand darf wegen seiner Herkunft ausgeschlossen werden.',
  'Alle Kinder sollen zur Schule gehen dürfen.',
  'Jeder Mensch soll vor Gewalt geschützt werden.',
  'Alle Menschen sollen respektvoll behandelt werden.'
];

/* ------------------------------------------------------------------ */
/* Speicher                                                            */
/* ------------------------------------------------------------------ */
function emptyState() {
  return { s1: {}, s2: {}, s3: {}, s4: { answers: {}, done: false, best: 0 }, s5: {}, s6: { done: false }, celebrated: {} };
}
function loadJSON(storage, key) {
  try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
let state = Object.assign(emptyState(), loadJSON(window.localStorage, STORE_KEY) || {});
let texts = Object.assign({ s5: {}, s6: ['', '', '', '', ''] }, loadJSON(window.sessionStorage, TEXT_KEY) || {});
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* privat: egal */ } updateChrome(); }
function saveTexts() { try { sessionStorage.setItem(TEXT_KEY, JSON.stringify(texts)); } catch (e) { /* egal */ } }

/* ------------------------------------------------------------------ */
/* Fortschritt + Punkte                                                */
/* ------------------------------------------------------------------ */
const MAX_POINTS = S1_TASKS.length * 2 + S2_QUIZ.length + S3_SITUATIONS.length + S4_QUIZ.length;

function stationFraction(id) {
  switch (id) {
    case 's1': return count(state.s1, v => v.answered) / S1_TASKS.length;
    case 's2': return Object.keys(state.s2).length / S2_QUIZ.length;
    case 's3': return count(state.s3, v => v.choice !== undefined) / S3_SITUATIONS.length;
    case 's4': return (state.s4.done || state.s4.finishedOnce) ? 1 : Object.keys(state.s4.answers).length / S4_QUIZ.length;
    case 's5': return Math.min(1, Object.keys(state.s5).length / 4);
    case 's6': return state.s6.done ? 1 : texts.s6.filter(t => t.trim()).length / 5 * 0.8;
  }
  return 0;
}
function count(obj, fn) { return Object.values(obj).filter(fn).length; }
const isDone = id => stationFraction(id) >= 1;
function points() {
  let p = 0;
  Object.values(state.s1).forEach(v => { if (v.found && !v.helped) p++; if (v.correct) p++; });
  p += count(state.s2, v => v.correct);
  p += count(state.s3, v => v.correct);
  p += Math.max(state.s4.best || 0, currentS4Score());
  return p;
}
function currentS4Score() { return count(state.s4.answers, v => v.correct); }
function totalProgress() { return STATIONS.reduce((s, st) => s + stationFraction(st.id), 0) / STATIONS.length; }

/* ------------------------------------------------------------------ */
/* Hilfsfunktionen                                                     */
/* ------------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const PRAISE = ['Richtig! ⭐', 'Super gemacht! ⭐', 'Genau so ist es! ⭐', 'Klasse! ⭐', 'Stark! ⭐'];
const SOFT = ['Nicht ganz – kein Problem!', 'Knapp daneben – aus Fehlern lernt man!', 'Fast! Lies dir die Erklärung durch.'];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

let toastTimer = null;
function toast(msg, good = false, ms = 3800) {
  const t = $('#toast');
  t.innerHTML = msg; t.className = 'toast' + (good ? ' good' : ''); t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
function confetti() {
  const em = ['⭐', '🎉', '✨', '🌟', '💛'];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('span');
    s.className = 'confetti'; s.textContent = pick(em);
    s.style.left = Math.random() * 100 + 'vw';
    s.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
    s.style.animationDelay = (Math.random() * .4) + 's';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 3800);
  }
}
function checkCelebrate() {
  STATIONS.forEach(st => {
    if (isDone(st.id) && !state.celebrated[st.id]) {
      state.celebrated[st.id] = true;
      save();
      confetti();
      toast(`⭐ Station ${st.nr} geschafft! Du hast einen Stern bekommen.`, true, 4500);
    }
  });
}

/* Multiple-Choice-Block (für Station 2, 3, 4 und Modals) */
function mcBlock({ options, correct, explain, saved, onAnswer, compact }) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="opts">${options.map((o, i) =>
    `<button type="button" class="opt" data-i="${i}"><span class="opt-letter">${LETTERS[i]}</span><span>${o}</span></button>`).join('')}</div>
    <div class="fb-slot"></div>`;
  const show = (choice) => {
    $$('.opt', wrap).forEach((b, i) => {
      b.disabled = true;
      if (i === correct) b.classList.add('correct');
      else if (i === choice) b.classList.add('wrong');
    });
    const ok = choice === correct;
    $('.fb-slot', wrap).innerHTML = `<div class="feedback ${ok ? 'good' : 'soft'}">
      <strong>${ok ? pick(PRAISE) : pick(SOFT)}</strong>
      ${ok ? '' : `Richtig ist: <b>${options[correct]}</b><br>`}${explain}</div>`;
  };
  if (saved !== undefined && saved !== null) show(saved);
  $$('.opt', wrap).forEach(b => b.addEventListener('click', () => {
    const choice = +b.dataset.i;
    show(choice);
    onAnswer && onAnswer(choice, choice === correct);
  }));
  return wrap;
}

/* Modal */
function openModal(html, onClose) {
  const m = $('#modal');
  $('#modal-content').innerHTML = html;
  m.hidden = false;
  m._onClose = onClose;
  setTimeout(() => { const f = $('.modal-box .opt, .modal-box .btn', m); f && f.focus({ preventScroll: true }); }, 50);
}
function closeModal() {
  const m = $('#modal');
  if (m.hidden) return;
  m.hidden = true;
  const cb = m._onClose; m._onClose = null;
  cb && cb();
}

/* Begriffs-Erklärungen */
function setupTerms() {
  const pop = $('#term-pop');
  document.addEventListener('click', e => {
    const t = e.target.closest('.term');
    if (!t) { pop.hidden = true; return; }
    e.preventDefault();
    pop.innerHTML = `<b>${esc(t.dataset.term)}:</b> ${esc(TERMS[t.dataset.term] || '')}`;
    pop.hidden = false;
    const r = t.getBoundingClientRect();
    const w = Math.min(300, window.innerWidth - 32);
    pop.style.maxWidth = w + 'px';
    let left = r.left + window.scrollX;
    left = Math.max(16, Math.min(left, window.scrollX + window.innerWidth - w - 16));
    pop.style.left = left + 'px';
    pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
  });
}

/* ------------------------------------------------------------------ */
/* Bildbetrachter mit Zoom, Verschieben, Großansicht                   */
/* ------------------------------------------------------------------ */
class Viewer {
  constructor(root, { onTap, banner } = {}) {
    this.root = root; this.onTap = onTap;
    root.classList.add('viewer');
    if (!onTap) root.classList.add('no-tap');
    root.innerHTML = `
      <div class="viewer-stage">
        <img src="${IMG}" alt="Wimmelbild zu den Menschenrechten von Detlef Surrey / Amnesty International: viele kleine Szenen, in denen Menschenrechte eine Rolle spielen." draggable="false">
        <div class="viewer-layer"></div>
      </div>
      ${banner ? '<div class="viewer-banner" hidden></div>' : ''}
      <div class="viewer-zoomlabel">100 %</div>
      <div class="viewer-controls">
        <button type="button" data-z="in" aria-label="Vergrößern" title="Vergrößern">＋</button>
        <button type="button" data-z="out" aria-label="Verkleinern" title="Verkleinern">－</button>
        <button type="button" data-z="reset" aria-label="Ganzes Bild zeigen" title="Ganzes Bild">⟲</button>
        <button type="button" data-z="full" aria-label="Großansicht" title="Großansicht">⛶</button>
      </div>`;
    this.stage = $('.viewer-stage', root);
    this.img = $('img', root);
    this.layer = $('.viewer-layer', root);
    this.label = $('.viewer-zoomlabel', root);
    this.bannerEl = $('.viewer-banner', root);
    this.s = 1; this.X = 0; this.Y = 0;
    this.pointers = new Map();
    this.ratio = 1600 / 1131;
    root.style.aspectRatio = '1600 / 1131';
    const ready = () => {
      if (this.img.naturalWidth) { this.ratio = this.img.naturalWidth / this.img.naturalHeight; root.style.aspectRatio = `${this.img.naturalWidth} / ${this.img.naturalHeight}`; }
      this.layout();
    };
    if (this.img.complete) ready(); else this.img.addEventListener('load', ready);
    if ('ResizeObserver' in window) new ResizeObserver(() => this.layout()).observe(root);
    else window.addEventListener('resize', () => this.layout());

    $$('.viewer-controls button', root).forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const z = b.dataset.z;
      const W = root.clientWidth, H = root.clientHeight;
      this.animated(() => {
        if (z === 'in') this.zoomAt(this.s * 1.6, W / 2, H / 2);
        if (z === 'out') this.zoomAt(this.s / 1.6, W / 2, H / 2);
        if (z === 'reset') this.zoomAt(1, W / 2, H / 2);
      });
      if (z === 'full') this.toggleFull();
    }));
    root.addEventListener('pointerdown', e => this.down(e));
    root.addEventListener('pointermove', e => this.move(e));
    root.addEventListener('pointerup', e => this.up(e));
    root.addEventListener('pointercancel', e => { this.pointers.delete(e.pointerId); if (!this.pointers.size) this.drag = null; root.classList.remove('dragging'); });
    root.addEventListener('wheel', e => {
      if (!e.ctrlKey && this.s === 1) return;          // normales Scrollen der Seite erlauben
      if (!e.ctrlKey && !this.isFull) return;
      e.preventDefault();
      const r = root.getBoundingClientRect();
      this.zoomAt(this.s * Math.exp(-e.deltaY * 0.006), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
  }
  layout() {
    const W = this.root.clientWidth, H = this.root.clientHeight;
    if (!W || !H) return;
    let bw = W, bh = W / this.ratio;
    if (bh > H) { bh = H; bw = H * this.ratio; }
    const oldBw = this.bw;
    this.bw = bw; this.bh = bh;
    this.stage.style.width = bw + 'px';
    this.stage.style.height = bh + 'px';
    if (!oldBw || this.s === 1) { this.X = (W - bw) / 2; this.Y = (H - bh) / 2; }
    this.clamp(); this.apply();
  }
  clamp() {
    const W = this.root.clientWidth, H = this.root.clientHeight;
    const cw = this.bw * this.s, ch = this.bh * this.s;
    this.X = cw <= W ? (W - cw) / 2 : Math.min(0, Math.max(W - cw, this.X));
    this.Y = ch <= H ? (H - ch) / 2 : Math.min(0, Math.max(H - ch, this.Y));
  }
  apply() {
    this.stage.style.transform = `translate(${this.X}px, ${this.Y}px) scale(${this.s})`;
    this.root.style.setProperty('--inv', (1 / this.s).toFixed(3));
    this.root.classList.toggle('zoomed', this.s > 1.01);
    this.label.textContent = Math.round(this.s * 100) + ' %';
  }
  zoomAt(ns, cx, cy) {
    ns = Math.max(1, Math.min(6, ns));
    const px = (cx - this.X) / this.s, py = (cy - this.Y) / this.s;
    this.X = cx - px * ns; this.Y = cy - py * ns; this.s = ns;
    this.clamp(); this.apply();
  }
  animated(fn) {
    this.root.classList.add('animate');
    fn();
    clearTimeout(this._anim);
    this._anim = setTimeout(() => this.root.classList.remove('animate'), 520);
  }
  focusRegion(r) {
    const W = this.root.clientWidth, H = this.root.clientHeight;
    const rw = (r[2] - r[0]) / 100 * this.bw, rh = (r[3] - r[1]) / 100 * this.bh;
    const ns = Math.max(1.6, Math.min(4, Math.min(W / rw, H / rh) * 0.7));
    const cx = (r[0] + r[2]) / 200 * this.bw, cy = (r[1] + r[3]) / 200 * this.bh;
    this.animated(() => {
      this.s = ns; this.X = W / 2 - cx * ns; this.Y = H / 2 - cy * ns;
      this.clamp(); this.apply();
    });
  }
  toggleFull(force) {
    this.isFull = force !== undefined ? force : !this.isFull;
    this.root.classList.toggle('is-full', this.isFull);
    document.body.classList.toggle('no-scroll', this.isFull);
    const b = $('[data-z="full"]', this.root);
    b.textContent = this.isFull ? '✕' : '⛶';
    b.setAttribute('aria-label', this.isFull ? 'Großansicht schließen' : 'Großansicht');
    this.s = 1; this.bw = 0;
    requestAnimationFrame(() => this.layout());
    if (this.isFull) {
      this._esc = e => { if (e.key === 'Escape') this.toggleFull(false); };
      document.addEventListener('keydown', this._esc);
    } else if (this._esc) document.removeEventListener('keydown', this._esc);
  }
  down(e) {
    if (e.target.closest('.viewer-controls, .hotspot')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { this.root.setPointerCapture(e.pointerId); } catch (_) { /* egal */ }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.drag = { x: e.clientX, y: e.clientY, X: this.X, Y: this.Y, moved: false };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: this.s };
      if (this.drag) this.drag.moved = true;
    }
  }
  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const r = this.root.getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoomAt(this.pinch.s * d / this.pinch.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    if (this.drag) {
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (Math.hypot(dx, dy) > 8) this.drag.moved = true;
      if (this.s > 1.01 && this.drag.moved) {
        this.root.classList.add('dragging');
        this.X = this.drag.X + dx; this.Y = this.drag.Y + dy;
        this.clamp(); this.apply();
      }
    }
  }
  up(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    this.root.classList.remove('dragging');
    if (this.pointers.size === 1) {          // von zwei auf einen Finger
      const p = [...this.pointers.values()][0];
      this.pinch = null;
      this.drag = { x: p.x, y: p.y, X: this.X, Y: this.Y, moved: true };
      return;
    }
    if (this.pointers.size === 0) {
      const d = this.drag; this.drag = null; this.pinch = null;
      if (d && !d.moved) {
        const r = this.img.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width * 100, py = (e.clientY - r.top) / r.height * 100;
        if (px >= 0 && px <= 100 && py >= 0 && py <= 100) {
          if (this.onTap) this.onTap(px, py);
          else {                              // Startseite: Antippen = hineinzoomen
            const rr = this.root.getBoundingClientRect();
            this.animated(() => this.zoomAt(this.s < 2.5 ? this.s * 2 : 1, e.clientX - rr.left, e.clientY - rr.top));
          }
        }
      }
    }
  }
  setBanner(html) {
    const outer = $('#s1-banner');
    if (outer && this.root.id === 's1-viewer') {
      const all = S1_TASKS.every(t => (state.s1[t.id] || {}).found);
      outer.innerHTML = html || (all ? '🎉 Du hast alle Szenen entdeckt!' : '👉 Wähle eine Entdeckungsaufgabe aus der Liste.');
      outer.classList.toggle('idle', !html);
    }
    if (!this.bannerEl) return;
    this.bannerEl.innerHTML = html || '';
    this.bannerEl.hidden = !html;
  }
  marker(x, y, label, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hotspot ' + (cls || '');
    b.style.left = x + '%'; b.style.top = y + '%';
    b.textContent = label;
    if (onClick) b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    else b.tabIndex = -1;
    this.layer.appendChild(b);
    return b;
  }
  clearMarkers() { this.layer.innerHTML = ''; }
}

/* ------------------------------------------------------------------ */
/* Kopfzeile, Navigation, Router                                       */
/* ------------------------------------------------------------------ */
function updateChrome() {
  const p = Math.round(totalProgress() * 100);
  $('#bar-fill').style.width = p + '%';
  $('#progress-text').textContent = p + ' %';
  $('#star-count').textContent = STATIONS.filter(s => isDone(s.id)).length;
  $('#point-count').textContent = points();
  const cur = currentView();
  $('#station-nav').innerHTML =
    `<a class="nav-chip ${cur === 'start' ? 'active' : ''}" href="#start">🏠 Übersicht</a>` +
    STATIONS.map(s => `<a class="nav-chip ${cur === s.id ? 'active' : ''} ${isDone(s.id) ? 'done' : ''}" href="#${s.id}">
      <span aria-hidden="true">${s.icon}</span> ${s.nr}${isDone(s.id) ? ' <span class="chip-star">⭐</span>' : ''}</a>`).join('') +
    `<a class="nav-chip ${cur === 'ende' ? 'active' : ''}" href="#ende">🏁 Abschluss</a>`;
  const active = $('.nav-chip.active');
  if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
const VIEWS = ['start', 's1', 's2', 's3', 's4', 's5', 's6', 'ende'];
function currentView() { const h = location.hash.replace('#', ''); return VIEWS.includes(h) ? h : 'start'; }

const renderers = {};
function route() {
  closeModal();
  const v = currentView();
  $$('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + v));
  renderers[v] && renderers[v]();
  updateChrome();
  window.scrollTo(0, 0);
}

function pager(id) {
  const i = VIEWS.indexOf(id);
  const prev = VIEWS[i - 1], next = VIEWS[i + 1];
  const name = v => v === 'start' ? 'Übersicht' : v === 'ende' ? 'Abschluss' : 'Station ' + v.slice(1);
  return `<div class="pager">
    ${prev ? `<a class="btn ghost" href="#${prev}">← Zurück: ${name(prev)}</a>` : ''}
    <a class="btn ghost" href="#start">🏠 Übersicht</a>
    ${next ? `<a class="btn" href="#${next}">Weiter: ${name(next)} →</a>` : ''}
  </div>`;
}
function stationHead(id, extra = '') {
  const s = STATIONS.find(x => x.id === id);
  return `<div class="station-head"><div class="station-badge" aria-hidden="true">${s.icon}</div>
    <div><small>Station ${s.nr} von 6 · ca. ${s.min} Minuten</small><h1>${s.title}</h1>${extra}</div></div>`;
}

/* ------------------------------------------------------------------ */
/* STARTSEITE                                                          */
/* ------------------------------------------------------------------ */
let heroViewer = null;
renderers.start = () => {
  const el = $('#view-start');
  const started = totalProgress() > 0;
  const firstOpen = STATIONS.find(s => !isDone(s.id));
  el.innerHTML = `
    <div class="hero">
      <div>
        <h1>Menschenrechte – <span>Jeder Mensch ist gleich viel wert!</span></h1>
      </div>
      <div id="hero-viewer"></div>
      <div class="card intro">
        <p>Stell dir vor, du lebst in einer Welt, in der nicht alle Menschen die gleichen Rechte haben. Manche dürfen nicht zur Schule gehen, andere dürfen ihre Meinung nicht sagen oder werden ungerecht behandelt. Wäre das fair?</p>
        <p>Menschenrechte sollen dafür sorgen, dass jeder Mensch frei, sicher und in ${term('Würde')} leben kann.</p>
        <p><b>Begib dich auf eine Entdeckungsreise und finde heraus, warum Menschenrechte so wichtig sind!</b></p>
        <div class="facts">
          <span class="fact">⏱️ ca. 30–45 Minuten</span>
          <span class="fact">🧭 6 Stationen</span>
          <span class="fact">⭐ 1 Stern pro Station</span>
          <span class="fact">🏅 bis zu ${MAX_POINTS} Punkte</span>
        </div>
        <a class="btn big sun" href="#${started && firstOpen ? firstOpen.id : (started ? 'ende' : 's1')}">${started ? (firstOpen ? '▶ Meine Rallye fortsetzen' : '🏁 Zum Abschluss') : '▶ Meine Rallye starten'}</a>
        <div class="big-progress">
          <p style="margin:16px 0 6px"><b>Dein Fortschritt:</b> ${Math.round(totalProgress() * 100)} % · ${STATIONS.filter(s => isDone(s.id)).length} von 6 Sternen</p>
          <div class="bar"><div class="bar-fill" style="width:${totalProgress() * 100}%"></div></div>
        </div>
      </div>
      <div>
        <h2>Die sechs Lernstationen</h2>
        <p>Am besten bearbeitest du die Stationen der Reihe nach. Du kannst aber auch jede Station einzeln antippen.</p>
        <div class="station-grid">
          ${STATIONS.map(s => `<a class="station-card ${isDone(s.id) ? 'done' : ''}" href="#${s.id}">
            <span class="sc-icon" aria-hidden="true">${s.icon}</span>
            <span style="flex:1">
              <span class="sc-nr">Station ${s.nr} ${isDone(s.id) ? '· ⭐ geschafft' : ''}</span><br>
              <span class="sc-title">${s.title}</span><br>
              <span class="sc-meta">ca. ${s.min} Minuten</span>
              <span class="mini-bar" style="display:block"><div style="width:${stationFraction(s.id) * 100}%"></div></span>
            </span></a>`).join('')}
          <a class="station-card ${STATIONS.every(s => isDone(s.id)) ? 'done' : ''}" href="#ende">
            <span class="sc-icon" aria-hidden="true">🏁</span>
            <span><span class="sc-nr">Ziel</span><br><span class="sc-title">Abschluss und Urkunde</span><br><span class="sc-meta">Deine Auswertung</span></span></a>
        </div>
      </div>
      <p style="text-align:center"><button type="button" class="btn ghost small" id="reset-all">↺ Ganz von vorne beginnen</button></p>
    </div>`;
  heroViewer = new Viewer($('#hero-viewer'));
  $('#reset-all').addEventListener('click', () => {
    if (!confirm('Möchtest du wirklich ganz von vorne beginnen? Dein Fortschritt wird gelöscht.')) return;
    state = emptyState(); texts = { s5: {}, s6: ['', '', '', '', ''] };
    save(); saveTexts(); route();
  });
};

/* ------------------------------------------------------------------ */
/* STATION 1                                                           */
/* ------------------------------------------------------------------ */
let s1Viewer = null, s1Active = null, s1Misses = 0;
function regionCenter(r) { return [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; }
function inside(r, x, y) { return x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]; }
function whereText(r) {
  const [x, y] = regionCenter(r);
  const v = y < 36 ? 'oben' : y > 64 ? 'unten' : 'in der Mitte';
  const h = x < 36 ? 'links' : x > 64 ? 'rechts' : 'in der Mitte';
  return v === h ? 'in der Mitte des Bildes' : `${v} ${h === 'in der Mitte' ? 'in der Mitte' : h}`;
}

renderers.s1 = () => {
  const el = $('#view-s1');
  el.innerHTML = `
    ${stationHead('s1')}
    <div class="instruction"><div><b>So geht's:</b> Wähle eine Entdeckungsaufgabe aus der Liste. Suche die passende Szene im Wimmelbild und <b>tippe sie an</b>. Mit ＋ und － kannst du zoomen, mit ⛶ wird das Bild ganz groß. Wenn du gezoomt hast, kannst du das Bild mit dem Finger oder der Maus verschieben.</div></div>
    <div class="s1-layout">
      <div class="s1-viewer-wrap"><div class="s1-banner idle" id="s1-banner">👉 Wähle eine Entdeckungsaufgabe aus der Liste.</div><div id="s1-viewer"></div></div>
      <div>
        <div class="s1-score"><span>Entdeckt: <span id="s1-count"></span></span><span>🏅 je 2 Punkte</span></div>
        <div class="task-list" id="task-list"></div>
      </div>
    </div>
    ${pager('s1')}`;
  s1Viewer = new Viewer($('#s1-viewer'), { onTap: s1Tap, banner: true });
  s1Active = null; s1Misses = 0;
  s1Viewer.setBanner('');
  drawS1();
};

function drawS1() {
  s1Viewer.clearMarkers();
  S1_TASKS.forEach((t, i) => {
    const st = state.s1[t.id];
    if (st && st.found) {
      const [x, y] = regionCenter(t.regions[st.region || 0]);
      s1Viewer.marker(x, y, i + 1, st.correct ? '' : 'wrong', () => openS1Question(t));
    }
  });
  const list = $('#task-list');
  list.innerHTML = S1_TASKS.map((t, i) => {
    const st = state.s1[t.id] || {};
    const active = s1Active === t.id;
    return `<div>
      <button type="button" class="task ${active ? 'active' : ''} ${st.answered ? 'solved' : ''}" data-id="${t.id}">
        <span class="task-nr">${i + 1}</span>
        <span class="task-text">${t.task}${active && !st.found ? '<br><small><b>👉 Jetzt im Bild antippen!</b></small>' : ''}</span>
        <span class="task-state" aria-hidden="true">${st.answered ? (st.correct ? '⭐' : '✅') : st.found ? '❓' : active ? '🔎' : ''}</span>
      </button>
      ${active && !st.found && s1Misses >= 2 ? `<div class="task-help"><button type="button" class="btn small sun" data-help="${t.id}">🆘 Zeig mir die Stelle</button></div>` : ''}
    </div>`;
  }).join('');
  $('#s1-count').textContent = `${count(state.s1, v => v.found)} von ${S1_TASKS.length}`;
  $$('.task', list).forEach(b => b.addEventListener('click', () => {
    const t = S1_TASKS.find(x => x.id === b.dataset.id);
    const st = state.s1[t.id];
    if (st && st.found) { openS1Question(t); return; }
    s1Active = t.id; s1Misses = 0;
    s1Viewer.setBanner(`🔎 ${t.task}`);
    drawS1();
    if (window.innerWidth < 900) $('#s1-viewer').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  $$('[data-help]', list).forEach(b => b.addEventListener('click', () => {
    const t = S1_TASKS.find(x => x.id === b.dataset.help);
    if (window.innerWidth < 900) $('#s1-viewer').scrollIntoView({ behavior: 'smooth', block: 'center' });
    s1Viewer.focusRegion(t.regions[0]);
    const [x, y] = regionCenter(t.regions[0]);
    s1Viewer.marker(x, y, '!', 'help');
    toast('Hier ist die Stelle! Schau sie dir genau an.');
    setTimeout(() => s1Found(t, 0, true), 1500);
  }));
}

function s1Tap(x, y) {
  const mark = s1Viewer.marker(x, y, '', 'tapmark');
  setTimeout(() => mark.remove(), 1200);
  if (!s1Active) {
    const open = S1_TASKS.find(t => !(state.s1[t.id] || {}).found);
    toast(open ? 'Wähle zuerst eine Entdeckungsaufgabe aus der Liste aus. 👉' : 'Du hast schon alles entdeckt! 🎉');
    return;
  }
  const t = S1_TASKS.find(x2 => x2.id === s1Active);
  const ri = t.regions.findIndex(r => inside(r, x, y));
  if (ri >= 0) { s1Found(t, ri, false); return; }
  const alt = t.alts.find(a => inside(a.r, x, y));
  if (alt) { toast('👀 ' + alt.msg, false, 6500); return; }
  s1Misses++;
  toast(s1Misses >= 2
    ? `Hier noch nicht. Tipp: Schau mal ${whereText(t.regions[0])}. Oder nutze „Zeig mir die Stelle“.`
    : 'Hier noch nicht – schau noch einmal genau hin! 🔍');
  if (s1Misses === 2) drawS1();
}

function s1Found(t, regionIdx, helped) {
  state.s1[t.id] = Object.assign(state.s1[t.id] || {}, { found: true, helped, region: regionIdx });
  s1Active = null;
  s1Viewer.setBanner('');
  save();
  drawS1();
  if (!helped) toast('🎯 Gefunden!' + ' +1 Punkt', true, 1800);
  setTimeout(() => openS1Question(t), helped ? 0 : 450);
}

function cropStyle(r) {
  const w = r[2] - r[0], h = r[3] - r[1];
  const px = w >= 100 ? 0 : r[0] / (100 - w) * 100, py = h >= 100 ? 0 : r[1] / (100 - h) * 100;
  return `background-image:url('${IMG}');background-size:${(100 / w * 100).toFixed(1)}% auto;background-position:${px.toFixed(1)}% ${py.toFixed(1)}%;aspect-ratio:${(w * 1600 / (h * 1131)).toFixed(3)};max-height:32vh;width:auto;margin:0 auto 12px;display:block`;
}

function openS1Question(t) {
  const st = state.s1[t.id] || {};
  const r = t.regions[st.region || 0];
  openModal(`<h2 id="modal-title">🔍 ${t.title}</h2>
    <div class="modal-crop" style="${cropStyle(r)}" role="img" aria-label="Ausschnitt aus dem Wimmelbild"></div>
    <p><b>${t.question}</b></p><div id="mq"></div>
    <div class="btn-row" id="mq-next" ${st.answered ? '' : 'hidden'}><button type="button" class="btn green" data-close>Weiter entdecken →</button></div>`,
  () => { drawS1(); checkCelebrate(); });
  $('#mq').appendChild(mcBlock({
    options: t.options, correct: t.correct, explain: t.explain,
    saved: st.answered ? st.choice : undefined,
    onAnswer: (choice, ok) => {
      Object.assign(state.s1[t.id], { answered: true, choice, correct: ok });
      save();
      $('#mq-next').hidden = false;
    }
  }));
  $('[data-close]', $('#modal')).addEventListener('click', closeModal);
}

/* ------------------------------------------------------------------ */
/* STATION 2                                                           */
/* ------------------------------------------------------------------ */
renderers.s2 = () => {
  const el = $('#view-s2');
  el.innerHTML = `
    ${stationHead('s2')}
    <div class="card">
      <p class="lead"><b>Menschenrechte sind Regeln und Rechte, die für alle Menschen gelten. Egal, woher sie kommen, wie sie aussehen, woran sie glauben oder wie viel Geld sie haben.</b></p>
      <p>Nach dem schrecklichen Zweiten Weltkrieg haben sich 1948 viele Länder in den ${term('UN', 'Vereinten Nationen (UN)')} auf 30 Menschenrechte geeinigt. Das ist die <b>Allgemeine Erklärung der Menschenrechte</b>. Ihr erster Satz lautet:</p>
      <div class="quote-box">„Alle Menschen sind frei und gleich an ${term('Würde')} und Rechten geboren.“</div>
      <p>Für Kinder gibt es zusätzlich die <b>UN-Kinderrechtskonvention</b> (seit 1989).</p>
    </div>
    <div class="instruction"><div>Lies dir die fünf wichtigen Menschenrechte durch. Tippe auf die <span style="color:var(--violet);font-weight:700">lila Wörter ⓘ</span>, wenn du ein Wort nicht kennst. Danach kommt ein kleiner Wissenstest.</div></div>
    <div class="rights-grid">
      ${RIGHTS.map(r => `<article class="right-card">
        <div class="right-icon" aria-hidden="true">${r.icon}</div>
        <h3>${r.title}</h3>
        <p>${r.text}</p>
        <div class="ex"><b>Beispiel:</b> ${r.ex}</div>
        <div class="pic">🖼️ ${r.pic}</div>
      </article>`).join('')}
    </div>
    <h2>✏️ Wissenstest</h2>
    <div class="instruction"><div>Beantworte die ${S2_QUIZ.length} Fragen. Tippe auf die Antwort, die du für richtig hältst. Du bekommst sofort eine Rückmeldung.</div></div>
    <div id="s2-quiz"></div>
    ${pager('s2')}`;
  const qz = $('#s2-quiz');
  S2_QUIZ.forEach((q, i) => {
    const card = document.createElement('div');
    card.className = 'q-card';
    card.innerHTML = `<h3><span class="q-num">${i + 1}.</span> ${q.q}</h3>`;
    const st = state.s2[i];
    card.appendChild(mcBlock({
      options: q.options, correct: q.correct, explain: q.explain, saved: st ? st.choice : undefined,
      onAnswer: (choice, ok) => { state.s2[i] = { choice, correct: ok }; save(); checkCelebrate(); }
    }));
    qz.appendChild(card);
  });
};

/* ------------------------------------------------------------------ */
/* STATION 3                                                           */
/* ------------------------------------------------------------------ */
const JUDGE = [['gerecht', '👍 gerecht'], ['ungerecht', '👎 ungerecht'], ['unsicher', '🤷 Ich bin mir nicht sicher']];
renderers.s3 = () => {
  const el = $('#view-s3');
  el.innerHTML = `
    ${stationHead('s3')}
    <div class="instruction"><div>Lies jede Situation genau. <b>Schritt 1:</b> Entscheide, ob sie gerecht oder ungerecht ist. <b>Schritt 2:</b> Beantworte dann die Frage dazu.</div></div>
    <div id="s3-list"></div>
    ${pager('s3')}`;
  const list = $('#s3-list');
  S3_SITUATIONS.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'q-card';
    list.appendChild(card);
    drawS3Card(card, s, i);
  });
};
function drawS3Card(card, s, i) {
  const st = state.s3[i] || {};
  card.innerHTML = `
    <div class="situation-text"><span class="sit-icon" aria-hidden="true">${s.icon}</span><div><small><b>Situation ${i + 1}</b></small><br>${s.text}</div></div>
    <p class="step-label">Schritt 1: Ist das gerecht?</p>
    <div class="opts row">${JUDGE.map(([k, l]) => `<button type="button" class="opt ${st.judge === k ? 'picked' : ''}" data-j="${k}" ${st.judge ? 'disabled' : ''}>${l}</button>`).join('')}</div>
    <div class="judge-fb"></div>
    <div class="step2"></div>`;
  const showJudge = j => {
    let html;
    if (j === s.judge) html = `<div class="feedback good"><strong>Das sehe ich auch so! 👍</strong>${s.judgeExplain}</div>`;
    else if (j === 'unsicher') html = `<div class="feedback info"><strong>Gut, dass du ehrlich bist! 🤔</strong>Viele Menschen würden sagen: Das ist <b>${s.judge}</b>. ${s.judgeExplain}</div>`;
    else html = `<div class="feedback soft"><strong>Schau noch einmal genau hin.</strong>Die meisten würden sagen: Das ist <b>${s.judge}</b>. ${s.judgeExplain}</div>`;
    $('.judge-fb', card).innerHTML = html;
    const step2 = $('.step2', card);
    step2.innerHTML = `<p class="step-label">Schritt 2: ${s.q}</p>`;
    step2.appendChild(mcBlock({
      options: s.options, correct: s.correct, explain: s.explain, saved: st.choice,
      onAnswer: (choice, ok) => { Object.assign(state.s3[i], { choice, correct: ok }); save(); checkCelebrate(); }
    }));
  };
  if (st.judge) showJudge(st.judge);
  $$('[data-j]', card).forEach(b => b.addEventListener('click', () => {
    state.s3[i] = { judge: b.dataset.j };
    save();
    $$('[data-j]', card).forEach(x => { x.disabled = true; x.classList.toggle('picked', x === b); });
    showJudge(b.dataset.j);
  }));
}

/* ------------------------------------------------------------------ */
/* STATION 4 – Quiz                                                    */
/* ------------------------------------------------------------------ */
let s4Index = 0;
const LEVEL = l => ['', '⭐ leicht', '⭐⭐ mittel', '⭐⭐⭐ knifflig'][l];
renderers.s4 = () => {
  const answered = Object.keys(state.s4.answers).length;
  s4Index = state.s4.done ? -1 : Math.min(answered, S4_QUIZ.length - 1);
  if (!state.s4.done) { const firstOpen = S4_QUIZ.findIndex((_, i) => !state.s4.answers[i]); s4Index = firstOpen < 0 ? S4_QUIZ.length - 1 : firstOpen; }
  drawS4();
};
function drawS4() {
  const el = $('#view-s4');
  const head = stationHead('s4');
  if (s4Index === -1 || state.s4.done) {
    const score = currentS4Score();
    const best = Math.max(state.s4.best || 0, score);
    const ratio = score / S4_QUIZ.length;
    const msg = ratio >= .9 ? 'Wow, du bist ein echter Menschenrechte-Profi! 🏆' :
      ratio >= .7 ? 'Sehr gut! Du weißt schon richtig viel. 🎉' :
      ratio >= .5 ? 'Gut gemacht! Mit einer zweiten Runde wirst du noch besser. 💪' :
      'Du hast tapfer durchgehalten! Lies die Erklärungen und versuch es noch einmal. 🌱';
    el.innerHTML = `${head}
      <div class="card result-box">
        <h2>Deine Auswertung</h2>
        <div class="result-big">${score} / ${S4_QUIZ.length}</div>
        <p>Punkte in dieser Runde · Bestes Ergebnis: <b>${best}</b></p>
        <p class="lead">${msg}</p>
        <div class="quiz-dots" style="justify-content:center;margin:12px 0">${S4_QUIZ.map((_, i) => `<span class="${state.s4.answers[i] && state.s4.answers[i].correct ? 'ok' : 'no'}"></span>`).join('')}</div>
        <div class="btn-row" style="justify-content:center">
          <button type="button" class="btn sun" id="s4-again">↺ Quiz noch einmal spielen</button>
          <a class="btn" href="#s5">Weiter zur Philosophie-Ecke →</a>
        </div>
      </div>
      ${pager('s4')}`;
    $('#s4-again').addEventListener('click', () => {
      state.s4.best = best; state.s4.answers = {}; state.s4.done = false;
      // Stern bleibt erhalten: Station gilt als geschafft, sobald sie einmal beendet wurde
      state.s4.finishedOnce = true;
      save(); s4Index = 0; drawS4();
    });
    return;
  }
  const q = S4_QUIZ[s4Index];
  const st = state.s4.answers[s4Index];
  el.innerHTML = `${head}
    <div class="instruction"><div>Beantworte die ${S4_QUIZ.length} Fragen nacheinander. Achtung: Die Fragen sind unterschiedlich – manchmal gibt es mehrere richtige Antworten oder du musst zuordnen.</div></div>
    <div class="quiz-top">
      <span>Frage ${s4Index + 1} von ${S4_QUIZ.length}</span>
      <span>🏅 ${currentS4Score()} Punkte</span>
    </div>
    <div class="quiz-dots" style="margin-bottom:12px">${S4_QUIZ.map((_, i) => {
      const a = state.s4.answers[i];
      return `<span class="${a ? (a.correct ? 'ok' : 'no') : ''} ${i === s4Index ? 'cur' : ''}"></span>`;
    }).join('')}</div>
    <div class="q-card">
      <h3><span class="q-num">${s4Index + 1}.</span> <span>${q.type === 'tf' ? 'Richtig oder falsch? „' + q.q + '“' : q.q}</span><span class="level">${LEVEL(q.level)}</span></h3>
      <div id="s4-body"></div>
      <div class="btn-row" id="s4-next" ${st ? '' : 'hidden'}>
        <button type="button" class="btn green">${s4Index === S4_QUIZ.length - 1 ? 'Zur Auswertung 🏁' : 'Nächste Frage →'}</button>
      </div>
    </div>
    ${pager('s4')}`;
  const body = $('#s4-body');
  const done = (ok, extra) => {
    state.s4.answers[s4Index] = Object.assign({ correct: ok }, extra || {});
    save();
    $('#s4-next').hidden = false;
    $('.quiz-top span:last-child').textContent = `🏅 ${currentS4Score()} Punkte`;
  };
  if (q.type === 'mc' || q.type === 'tf') {
    const options = q.type === 'tf' ? ['✔️ Richtig', '✖️ Falsch'] : q.options;
    const correct = q.type === 'tf' ? (q.correct ? 0 : 1) : q.correct;
    body.appendChild(mcBlock({ options, correct, explain: q.explain, saved: st ? st.choice : undefined, onAnswer: (choice, ok) => done(ok, { choice }) }));
  } else if (q.type === 'match') {
    const rights = q.pairs.map(p => p[1]);
    const sorted = [...rights].sort();
    body.innerHTML = `<p>Wähle bei jeder Situation das passende Recht aus.</p>
      ${q.pairs.map((p, i) => `<div class="match-row" data-i="${i}">
        <div>${p[0]}</div>
        <select aria-label="Recht für: ${esc(p[0])}"><option value="">– bitte wählen –</option>${sorted.map(r => `<option>${r}</option>`).join('')}</select>
        <div class="fix" hidden></div>
      </div>`).join('')}
      <div class="btn-row"><button type="button" class="btn" id="match-check">Prüfen</button></div>
      <div class="fb-slot"></div>`;
    const showMatch = sel => {
      let all = true;
      $$('.match-row', body).forEach((row, i) => {
        const s = $('select', row);
        s.value = sel[i] || '';
        s.disabled = true;
        const ok = sel[i] === q.pairs[i][1];
        if (!ok) all = false;
        row.classList.add(ok ? 'ok' : 'no');
        if (!ok) { const f = $('.fix', row); f.hidden = false; f.innerHTML = `Richtig wäre: <b>${q.pairs[i][1]}</b>`; }
      });
      $('#match-check').hidden = true;
      $('.fb-slot', body).innerHTML = `<div class="feedback ${all ? 'good' : 'soft'}"><strong>${all ? pick(PRAISE) : 'Einige Zuordnungen stimmen noch nicht – schau dir die Lösungen an.'}</strong>${q.explain}</div>`;
      return all;
    };
    if (st) showMatch(st.sel);
    $('#match-check').addEventListener('click', () => {
      const sel = $$('.match-row select', body).map(s => s.value);
      if (sel.some(v => !v)) { toast('Bitte wähle bei jeder Situation ein Recht aus.'); return; }
      const ok = showMatch(sel);
      done(ok, { sel });
    });
  } else if (q.type === 'multi') {
    body.innerHTML = `<div class="opts">${q.options.map((o, i) => `<label class="check"><input type="checkbox" value="${i}"> <span>${o}</span></label>`).join('')}</div>
      <div class="btn-row"><button type="button" class="btn" id="multi-check">Prüfen</button></div><div class="fb-slot"></div>`;
    const showMulti = sel => {
      $$('.check', body).forEach((lab, i) => {
        const inp = $('input', lab);
        inp.checked = sel.includes(i); inp.disabled = true;
        const shouldBe = q.correct.includes(i);
        if (shouldBe) lab.classList.add('correct');
        else if (sel.includes(i)) lab.classList.add('wrong');
      });
      const ok = sel.length === q.correct.length && q.correct.every(c => sel.includes(c));
      $('#multi-check').hidden = true;
      $('.fb-slot', body).innerHTML = `<div class="feedback ${ok ? 'good' : 'soft'}"><strong>${ok ? pick(PRAISE) : 'Nicht ganz. Die grün markierten sind die echten Menschenrechte.'}</strong>${q.explain}</div>`;
      return ok;
    };
    if (st) showMulti(st.sel);
    $('#multi-check').addEventListener('click', () => {
      const sel = $$('.check input', body).filter(i => i.checked).map(i => +i.value);
      if (!sel.length) { toast('Wähle mindestens eine Antwort aus.'); return; }
      done(showMulti(sel), { sel });
    });
  }
  $('#s4-next button').addEventListener('click', () => {
    if (s4Index === S4_QUIZ.length - 1) {
      state.s4.done = true;
      state.s4.best = Math.max(state.s4.best || 0, currentS4Score());
      save(); s4Index = -1; drawS4(); checkCelebrate();
    } else { s4Index++; drawS4(); }
    $('#view-s4').scrollIntoView({ block: 'start' });
  });
}

/* ------------------------------------------------------------------ */
/* STATION 5 – Philosophie-Ecke                                        */
/* ------------------------------------------------------------------ */
const WRITE_PRAISE = [
  'Danke für deine Gedanken! Philosophieren heißt genau das: selbst nachdenken.',
  'Spannender Gedanke! Hier gibt es kein Richtig oder Falsch – wichtig ist, dass du begründest.',
  'Toll, dass du dir Zeit zum Nachdenken nimmst!',
  'Interessant! Vergleiche deine Meinung später mit anderen aus deiner Klasse.'
];
renderers.s5 = () => {
  const el = $('#view-s5');
  el.innerHTML = `
    ${stationHead('s5')}
    <div class="card philo-intro">
      <p class="lead"><b>Hier gibt es kein Richtig und kein Falsch!</b> 🤔</p>
      <p>Philosophinnen und Philosophen denken über große Fragen nach. Sie sagen ihre Meinung – und sie <b>begründen</b> sie. Das heißt: Sie erklären, <i>warum</i> sie so denken. Ein guter Satzanfang ist: „Ich denke …, weil …“</p>
      <p style="margin:0">Deine Antworten werden <b>nicht bewertet</b>. Du bekommst für jede Antwort einen Denkanstoß, und am Ende siehst du, wie andere Menschen über die Frage denken.</p>
    </div>
    <div class="instruction"><div>Schreibe zu jeder Frage mindestens zwei Sätze. Wenn dir nichts einfällt, tippe auf <b>💡 Denkanstoß</b>. Tippe dann auf <b>Gedanken festhalten</b>. Für den Stern brauchst du mindestens 4 von 5 Fragen.</div></div>
    <div id="s5-list"></div>
    <p style="color:var(--muted);font-size:.9rem">🔒 Deine Texte bleiben nur in diesem Browser-Tab. Wenn du ihn schließt, sind sie weg. Möchtest du sie behalten, schreibe sie in dein Heft.</p>
    ${pager('s5')}`;
  const list = $('#s5-list');
  S5_QUESTIONS.forEach((q, i) => {
    const card = document.createElement('div');
    card.className = 'q-card philo-card';
    const saved = texts.s5[i] || (q.three ? ['', '', ''] : '');
    card.innerHTML = `
      <h3><span class="q-num">${i + 1}.</span> ${q.q}</h3>
      ${q.three
        ? `<div class="rules-form">${[0, 1, 2].map(k => `<div class="rule-line"><span>${k + 1}</span><input class="text-input" maxlength="160" placeholder="Regel ${k + 1} …" value="${esc(saved[k] || '')}"></div>`).join('')}</div>`
        : `<textarea placeholder="Ich denke …, weil …" maxlength="1200">${esc(saved)}</textarea>`}
      <ul class="hint-list"></ul>
      <div class="btn-row">
        <button type="button" class="btn ghost small" data-hint>💡 Denkanstoß</button>
        <button type="button" class="btn small" data-save>✍️ Gedanken festhalten</button>
        <span class="saved-tag" ${state.s5[i] ? '' : 'hidden'}>✔ festgehalten</span>
      </div>
      <div class="s5-fb"></div>`;
    list.appendChild(card);
    let hintN = 0;
    $('[data-hint]', card).addEventListener('click', e => {
      if (hintN < q.hints.length) {
        const li = document.createElement('li'); li.innerHTML = q.hints[hintN++]; $('.hint-list', card).appendChild(li);
      }
      if (hintN >= q.hints.length) e.currentTarget.disabled = true;
    });
    const read = () => q.three ? $$('input', card).map(x => x.value) : $('textarea', card).value;
    $$('textarea, input', card).forEach(f => f.addEventListener('input', () => { texts.s5[i] = read(); saveTexts(); }));
    const feedback = val => {
      const joined = Array.isArray(val) ? val.join(' ') : val;
      const reasons = /\b(weil|denn|da |deshalb|darum|sonst|zum beispiel|z\. ?b\.)/i.test(joined);
      $('.s5-fb', card).innerHTML = `
        <div class="feedback info"><strong>${pick(WRITE_PRAISE)}</strong>
        ${reasons ? '👍 Super: Du hast deine Meinung begründet!' : '💡 Tipp: Kannst du noch ergänzen, <i>warum</i> du so denkst? Zum Beispiel mit „weil …“.'}</div>
        <p class="step-label">🔭 So denken andere Menschen darüber:</p>
        <div class="views-box">${q.views.map(v => `<div>${v}</div>`).join('')}</div>
        <p style="margin-top:10px;font-size:.95rem">Kannst du auch die andere Meinung verstehen? Beide Seiten haben gute Gründe.</p>`;
    };
    if (state.s5[i] && (Array.isArray(saved) ? saved.join('').trim() : saved.trim())) feedback(saved);
    $('[data-save]', card).addEventListener('click', () => {
      const val = read();
      const filled = Array.isArray(val) ? val.filter(v => v.trim().length >= 3).length : val.trim().length;
      if (q.three ? filled < 3 : filled < 15) {
        toast(q.three ? 'Schreibe bitte alle drei Regeln auf. ✏️' : 'Schreibe bitte noch etwas mehr – mindestens einen ganzen Satz. ✏️');
        return;
      }
      texts.s5[i] = val; saveTexts();
      state.s5[i] = true; save();
      $('.saved-tag', card).hidden = false;
      feedback(val);
      checkCelebrate();
    });
  });
};

/* ------------------------------------------------------------------ */
/* STATION 6 – Charta                                                  */
/* ------------------------------------------------------------------ */
function chartaSheet(rules, name) {
  const date = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<div class="sheet">
    <div style="font-size:2.4rem" aria-hidden="true">🌍✋🕊️</div>
    <h2>Meine Menschenrechte-Charta</h2>
    <p class="sub">In meiner gerechten Welt gelten diese fünf Grundregeln:</p>
    <ol>${rules.map(r => `<li><span>${esc(r)}</span></li>`).join('')}</ol>
    <p class="core">Jeder Mensch ist gleich viel wert.</p>
    <div class="sign"><div>Name: ${name ? esc(name) : ''}</div><div>Datum: ${date}</div></div>
  </div>`;
}
function printSheet(html) {
  $('#print-area').innerHTML = html;
  window.print();
}
renderers.s6 = () => {
  const el = $('#view-s6');
  el.innerHTML = `
    ${stationHead('s6')}
    <div class="card">
      <p class="lead"><b>Stell dir vor, du kannst eine Welt erschaffen, in der alle Menschen gerecht und friedlich zusammenleben. Welche Regeln müssen dort gelten?</b></p>
      <p style="margin:0">Eine <b>Charta</b> ist eine Sammlung von wichtigen Grundregeln. Jetzt schreibst du deine eigene!</p>
    </div>
    <div class="instruction"><div>Schreibe <b>fünf eigene Grundregeln</b> in die Felder. Beginne zum Beispiel mit „Jeder Mensch …“, „Niemand darf …“ oder „Alle Kinder …“. Tippe dann auf <b>Meine Charta erstellen</b>. Du kannst sie ausdrucken oder als PDF speichern.</div></div>
    <div class="card">
      <div class="rules-form">${[0, 1, 2, 3, 4].map(i => `<div class="rule-line"><span>${i + 1}</span>
        <input class="rule-input" maxlength="160" placeholder="Regel ${i + 1} …" value="${esc(texts.s6[i] || '')}" aria-label="Regel ${i + 1}"></div>`).join('')}</div>
      <details style="margin-top:14px"><summary style="cursor:pointer;font-weight:700;min-height:44px;display:flex;align-items:center">💡 Brauchst du Ideen? (Tippe ein Beispiel an, um es zu übernehmen – oder schreibe es in eigenen Worten)</summary>
        <div class="idea-chips">${S6_IDEAS.map(x => `<button type="button" data-idea="${esc(x)}">${x}</button>`).join('')}</div>
      </details>
      <div class="btn-row"><button type="button" class="btn green big" id="make-charta">📜 Meine Charta erstellen</button></div>
    </div>
    <div id="charta-out"></div>
    ${pager('s6')}`;
  const inputs = $$('.rule-input', el);
  inputs.forEach((inp, i) => inp.addEventListener('input', () => { texts.s6[i] = inp.value; saveTexts(); updateChrome(); }));
  $$('[data-idea]', el).forEach(b => b.addEventListener('click', () => {
    const empty = inputs.find(x => !x.value.trim());
    if (!empty) { toast('Alle fünf Felder sind schon ausgefüllt.'); return; }
    empty.value = b.dataset.idea; empty.dispatchEvent(new Event('input'));
    toast('Übernommen! Du kannst die Regel noch verändern. ✏️');
  }));
  const show = () => {
    const rules = inputs.map(x => x.value.trim());
    $('#charta-out').innerHTML = `${chartaSheet(rules, '')}
      <div class="card">
        <label for="charta-name"><b>Dein Name für den Ausdruck</b> (freiwillig – wird nicht gespeichert):</label>
        <input id="charta-name" class="text-input" maxlength="60" autocomplete="off" style="margin:8px 0 12px">
        <div class="btn-row"><button type="button" class="btn sun" id="print-charta">🖨️ Charta drucken / als PDF speichern</button></div>
        <p style="font-size:.9rem;color:var(--muted);margin-top:8px">Tipp: Im Druckfenster kannst du statt eines Druckers „Als PDF sichern“ auswählen.</p>
      </div>`;
    $('#print-charta').addEventListener('click', () => printSheet(chartaSheet(rules, $('#charta-name').value.trim())));
  };
  if (state.s6.done && texts.s6.every(t => t.trim())) show();
  $('#make-charta').addEventListener('click', () => {
    const rules = inputs.map(x => x.value.trim());
    const missing = rules.findIndex(r => r.length < 5);
    if (missing >= 0) { toast(`Bitte schreibe noch Regel ${missing + 1} auf. ✏️`); inputs[missing].focus(); return; }
    state.s6.done = true; save();
    show();
    $('#charta-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
    checkCelebrate();
  });
};

/* ------------------------------------------------------------------ */
/* ABSCHLUSS + URKUNDE                                                 */
/* ------------------------------------------------------------------ */
function certSheet(name, form) {
  const stars = STATIONS.map(s => isDone(s.id) ? '⭐' : '☆').join('');
  const date = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<div class="sheet">
    <div style="font-size:2.6rem" aria-hidden="true">🏆</div>
    <h2>Urkunde</h2>
    <p class="sub">Menschenrechte-${esc(form)}</p>
    <div class="cert-name">${name ? esc(name) : '&nbsp;'}</div>
    <p>hat die <b>Menschenrechte-Rallye</b> bearbeitet und<br><b>${STATIONS.filter(s => isDone(s.id)).length} von 6 Stationen</b> geschafft.</p>
    <div class="stars">${stars}</div>
    <p>Punkte in den Wissensaufgaben: <b>${points()} von ${MAX_POINTS}</b></p>
    <p class="core">Menschenrechte gelten für alle Menschen. Jeder Mensch besitzt Würde. Jeder Mensch hat Rechte. Und jeder Mensch trägt Verantwortung dafür, dass andere Menschen ihre Rechte wahrnehmen können.</p>
    <div class="sign"><div>Datum: ${date}</div><div>Unterschrift Lehrkraft</div></div>
  </div>`;
}
renderers.ende = () => {
  const el = $('#view-ende');
  const allDone = STATIONS.every(s => isDone(s.id));
  const pts = points();
  el.innerHTML = `
    <div class="station-head"><div class="station-badge" aria-hidden="true">🏁</div>
      <div><small>Abschluss</small><h1>${allDone ? 'Geschafft! Du bist Menschenrechte-Expertin bzw. -Experte!' : 'Deine Auswertung'}</h1></div></div>
    ${allDone ? '' : `<div class="instruction"><div>Du hast noch nicht alle Stationen geschafft. Du kannst sie über die Leiste oben jederzeit weiterbearbeiten. Die Urkunde kannst du trotzdem schon ansehen.</div></div>`}
    <div class="card">
      <h2>Deine Stationen</h2>
      <table class="summary-table">
        ${STATIONS.map(s => `<tr><td>${s.icon} <a href="#${s.id}">Station ${s.nr}: ${s.title}</a></td><td>${isDone(s.id) ? '⭐ geschafft' : Math.round(stationFraction(s.id) * 100) + ' %'}</td></tr>`).join('')}
        <tr><td><b>🏅 Punkte aus den Wissensaufgaben</b><br><small>(Bildaufgaben, Wissenstest, Alltagssituationen, Quiz – die Philosophie-Ecke und die Charta werden nicht bewertet)</small></td><td><b>${pts} / ${MAX_POINTS}</b></td></tr>
      </table>
    </div>
    <div class="core-msg">
      <p>🌍 Menschenrechte gelten für alle Menschen.</p>
      <p>💛 Jeder Mensch besitzt Würde.</p>
      <p>⚖️ Jeder Mensch hat Rechte.</p>
      <p>🤝 Und jeder Mensch trägt Verantwortung dafür, dass andere Menschen ihre Rechte wahrnehmen können.</p>
    </div>
    <div class="card" style="margin-top:18px">
      <h2>🏆 Deine Urkunde</h2>
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
        <label><b>Dein Name</b> (freiwillig, wird nicht gespeichert)<input id="cert-name" class="text-input" maxlength="60" autocomplete="off" style="margin-top:6px"></label>
        <label><b>Titel auf der Urkunde</b><select id="cert-form" class="text-input" style="margin-top:6px">
          <option>Experte/Expertin</option><option>Expertin</option><option>Experte</option></select></label>
      </div>
      <div id="cert-preview"></div>
      <div class="btn-row"><button type="button" class="btn sun big" id="print-cert">🖨️ Urkunde drucken / als PDF speichern</button></div>
    </div>
    ${pager('ende')}`;
  const draw = () => { $('#cert-preview').innerHTML = certSheet($('#cert-name').value.trim(), $('#cert-form').value); };
  $('#cert-name').addEventListener('input', draw);
  $('#cert-form').addEventListener('change', draw);
  draw();
  $('#print-cert').addEventListener('click', () => printSheet(certSheet($('#cert-name').value.trim(), $('#cert-form').value)));
  if (allDone && !state.celebrated.ende) { state.celebrated.ende = true; save(); confetti(); }
};

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */
function init() {
  $('#no-js').remove();
  $$('.topbar, #station-nav, #app, .site-footer').forEach(e => { e.hidden = false; });
  setupTerms();
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('.modal-close')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  window.addEventListener('hashchange', route);
  window.addEventListener('afterprint', () => { $('#print-area').innerHTML = ''; });
  route();
}
init();
