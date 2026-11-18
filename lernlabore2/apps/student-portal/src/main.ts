// Startseite für Lernende: Anmeldung mit Zugangscode → Liste der freigeschalteten Lernlabore.
import { LabClient, resolveConfig, createTransport, IndexedDbStore, MemoryStore, takeCodeFromFragment } from '../../../packages/lab-sdk/src/index';
import { promptLogin, mountSessionBar, mountDemoBanner } from '../../../packages/lab-sdk/src/ui';
import { DemoTransport } from '../../../packages/lab-sdk/src/demo-backend';
import { DEMO_DATA } from '../../../packages/lab-sdk/src/generated/demo-data';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: (Node | string | null)[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, String(v));
  }
  for (const c of children) if (c) e.append(c);
  return e;
}

async function main() {
  const area = document.getElementById('schueler')!;
  const startBtn = document.getElementById('anmelden') as HTMLButtonElement;
  const cfg = resolveConfig();
  let transport;
  try { transport = createTransport(cfg); } catch {
    area.replaceChildren(h('p', { class: 'hinweis', text: 'Die Lernlabore sind noch nicht mit dem Server verbunden (config.js).' }));
    return;
  }
  if (transport instanceof DemoTransport) {
    const b = transport.backend;
    mountDemoBanner({ isOffline: () => b.isOffline(), setOffline: (v) => b.setOffline(v) });
  }
  const store = await IndexedDbStore.create().catch(() => new MemoryStore());
  const client = new LabClient({ transport, store, labId: '_portal', labVersion: '0', sessionPersistence: cfg.sessionPersistence });

  const zeigeLabore = () => {
    const p = client.participant!;
    const liste = h('ul', { class: 'labore' }, ...p.labs.map((l) => h('li', {},
      h('a', { class: 'labor-link', href: `labore/${encodeURIComponent(l.id)}/` },
        h('strong', { text: l.title }),
        h('span', { class: 'leise', text: l.finished ? 'Geschafft!' : l.percent > 0 ? `${l.percent} % geschafft – weitermachen` : 'Noch nicht begonnen' }),
        h('span', { class: 'mini-balken' }, h('span', { style: `width:${l.percent}%` }))))));
    area.replaceChildren(h('h2', { text: 'Deine Lernlabore' }), p.labs.length ? liste : h('p', { text: 'Für deine Gruppe ist gerade kein Lernlabor freigeschaltet.' }));
    mountSessionBar(client, document.getElementById('sitzung'), () => location.reload());
  };

  const loginUi = { labTitle: 'Online-Lernlabore', demoCodes: transport.mode === 'demo' ? DEMO_DATA.participants.map((p) => p.code) : undefined };
  const fragment = takeCodeFromFragment();
  const restored = await client.restoreSession().catch(() => 'none');
  if (fragment) { await promptLogin(client, { ...loginUi, presetCode: fragment }); zeigeLabore(); return; }
  if (restored !== 'none' && client.participant) { zeigeLabore(); return; }
  startBtn.addEventListener('click', async () => { await promptLogin(client, loginUi); zeigeLabore(); });
}

void main();
