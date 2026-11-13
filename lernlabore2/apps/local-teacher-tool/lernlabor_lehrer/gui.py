"""Grafische Oberfläche des Lehrerprogramms (Tkinter – in Python enthalten, keine Zusatzinstallation)."""
from __future__ import annotations

import json
import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
import traceback
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog, ttk
from typing import Any, Callable

from . import APP_NAME, __version__, berichte, demo, modell, sync, zugangsdaten
from .api import AnmeldungNoetig, ApiFehler, OfflineFehler, SupabaseClient
from .auswertung import build_rows, fmt_time
from .csvimport import read_csv
from .einstellungen import Einstellungen
from .tresor import FalschesPasswort, Tresor, TresorFehler, check_password_strength

PAD = 8


def open_path(path: Path) -> None:
    """Datei/Ordner mit dem Standardprogramm öffnen."""
    try:
        if sys.platform == "win32":
            os.startfile(str(path))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
        else:
            subprocess.Popen(["xdg-open", str(path)])
    except Exception:
        pass


# ====================================================================== Dialoge
class Dialog(tk.Toplevel):
    def __init__(self, master: tk.Misc, title: str):
        super().__init__(master)
        self.title(title)
        self.transient(master)
        self.resizable(False, False)
        self.result: Any = None
        self.body = ttk.Frame(self, padding=16)
        self.body.pack(fill="both", expand=True)
        self.protocol("WM_DELETE_WINDOW", self.cancel)
        self.bind("<Escape>", lambda e: self.cancel())

    def buttons(self, ok_text: str = "OK", cancel_text: str | None = "Abbrechen"):
        row = ttk.Frame(self.body)
        row.grid(column=0, columnspan=2, sticky="e", pady=(12, 0))
        if cancel_text:
            ttk.Button(row, text=cancel_text, command=self.cancel).pack(side="right", padx=(6, 0))
        b = ttk.Button(row, text=ok_text, command=self.ok, style="Accent.TButton")
        b.pack(side="right")
        self.bind("<Return>", lambda e: self.ok())

    def show(self) -> Any:
        self.grab_set()
        self.wait_window()
        return self.result

    def ok(self):
        self.destroy()

    def cancel(self):
        self.result = None
        self.destroy()


class PasswortDialog(Dialog):
    def __init__(self, master, neu: bool, hinweis: str = ""):
        super().__init__(master, "Neuen Tresor anlegen" if neu else "Tresor entsperren")
        self.neu = neu
        text = ("Der Tresor speichert die Zuordnung von Namen zu Teilnehmerkennungen verschlüsselt auf diesem Rechner.\n"
                "Wähle ein sicheres Passwort (mindestens 10 Zeichen). Ohne dieses Passwort sind die Daten nicht lesbar –\n"
                "auch nicht für den Support. Bitte sicher notieren!") if neu else "Bitte das Tresor-Passwort eingeben."
        ttk.Label(self.body, text=text, justify="left").grid(column=0, columnspan=2, sticky="w", pady=(0, 10))
        ttk.Label(self.body, text="Passwort:").grid(column=0, row=1, sticky="w")
        self.pw = ttk.Entry(self.body, show="•", width=34)
        self.pw.grid(column=1, row=1, sticky="we", pady=2)
        if neu:
            ttk.Label(self.body, text="Wiederholen:").grid(column=0, row=2, sticky="w")
            self.pw2 = ttk.Entry(self.body, show="•", width=34)
            self.pw2.grid(column=1, row=2, sticky="we", pady=2)
        self.msg = ttk.Label(self.body, text=hinweis, foreground="#b42318")
        self.msg.grid(column=0, columnspan=2, row=3, sticky="w")
        self.buttons("Anlegen" if neu else "Entsperren", "Beenden")
        self.pw.focus_set()

    def ok(self):
        pw = self.pw.get()
        if self.neu:
            if pw != self.pw2.get():
                self.msg.config(text="Die Passwörter stimmen nicht überein.")
                return
            try:
                check_password_strength(pw)
            except TresorFehler as e:
                self.msg.config(text=str(e))
                return
        self.result = pw
        self.destroy()


class LoginDialog(Dialog):
    def __init__(self, master, email: str, hinweis: str = ""):
        super().__init__(master, "Anmeldung am Onlinedienst")
        ttk.Label(self.body, text="Anmeldung als Lehrkraft (Supabase-Konto).\nDas Passwort wird nicht gespeichert.", justify="left").grid(column=0, columnspan=2, sticky="w", pady=(0, 10))
        ttk.Label(self.body, text="E-Mail:").grid(column=0, row=1, sticky="w")
        self.email = ttk.Entry(self.body, width=36)
        self.email.insert(0, email)
        self.email.grid(column=1, row=1, pady=2)
        ttk.Label(self.body, text="Passwort:").grid(column=0, row=2, sticky="w")
        self.pw = ttk.Entry(self.body, show="•", width=36)
        self.pw.grid(column=1, row=2, pady=2)
        ttk.Label(self.body, text=hinweis, foreground="#b42318").grid(column=0, columnspan=2, row=3, sticky="w")
        self.buttons("Anmelden")
        (self.pw if email else self.email).focus_set()

    def ok(self):
        if self.email.get().strip() and self.pw.get():
            self.result = (self.email.get().strip(), self.pw.get())
            self.destroy()


class EinstellungenDialog(Dialog):
    FIELDS = [
        ("supabase_url", "Server-Adresse (Supabase-URL)", "z. B. https://abcdefgh.supabase.co"),
        ("supabase_anon_key", "Öffentlicher Schlüssel (anon / publishable)", "NIEMALS den geheimen service_role-Schlüssel!"),
        ("email", "E-Mail der Lehrkraft", ""),
        ("lab_base_url", "Adresse der Lernlabore (für Zugangskarten)", "z. B. https://name.github.io/mathe10/lernlabore2/site/"),
        ("export_dir", "Ordner für Berichte", "Bitte einen lokalen Ordner wählen (nicht OneDrive/Dropbox)"),
    ]

    def __init__(self, master, settings: Einstellungen):
        super().__init__(master, "Einstellungen – Server-Verbindung")
        self.settings = settings
        self.entries: dict[str, ttk.Entry] = {}
        for i, (key, label, hint) in enumerate(self.FIELDS):
            ttk.Label(self.body, text=label).grid(column=0, row=2 * i, sticky="w", pady=(6, 0))
            e = ttk.Entry(self.body, width=64)
            e.insert(0, settings[key] or "")
            e.grid(column=0, row=2 * i + 1, sticky="we")
            if hint:
                ttk.Label(self.body, text=hint, foreground="#5b6577").grid(column=1, row=2 * i + 1, sticky="w", padx=6)
            self.entries[key] = e
        self.buttons("Speichern")

    def ok(self):
        for k, e in self.entries.items():
            self.settings[k] = e.get().strip()
        self.result = True
        self.destroy()


class ImportVorschau(Dialog):
    def __init__(self, master, res, gruppe_label: str):
        super().__init__(master, "Schülerliste prüfen")
        self.res = res
        ttk.Label(self.body, text=f"Gefunden: {len(res.personen)} Personen für „{gruppe_label}“ · Kodierung {res.kodierung} · Trennzeichen {res.trennzeichen}",
                  font=("TkDefaultFont", 10, "bold")).grid(column=0, columnspan=2, sticky="w")
        tree = ttk.Treeview(self.body, columns=("vorname", "nachname", "zeile"), show="headings", height=12)
        for c, t, w in (("vorname", "Vorname", 180), ("nachname", "Nachname", 200), ("zeile", "Zeile", 60)):
            tree.heading(c, text=t)
            tree.column(c, width=w)
        dup_keys = {b.schluessel for _, b in res.dubletten}
        for p in res.personen:
            tree.insert("", "end", values=(p.first_name, p.last_name, p.zeile), tags=("dup",) if p.schluessel in dup_keys else ())
        tree.tag_configure("dup", background="#fff4dc")
        tree.grid(column=0, columnspan=2, sticky="nsew", pady=6)
        hinweise = list(res.probleme)
        for a, b in res.dubletten:
            hinweise.append(f"Mögliche Dublette: „{a.anzeige}“ (Zeile {a.zeile}) und „{b.anzeige}“ (Zeile {b.zeile}).")
        txt = tk.Text(self.body, height=6, width=90, wrap="word")
        txt.insert("1.0", "\n".join(hinweise) if hinweise else "Keine Auffälligkeiten gefunden.")
        txt.config(state="disabled")
        txt.grid(column=0, columnspan=2, sticky="we")
        self.skip_dups = tk.BooleanVar(value=True)
        if res.dubletten:
            ttk.Checkbutton(self.body, text="Dubletten nur einmal übernehmen", variable=self.skip_dups).grid(column=0, sticky="w", pady=4)
        self.buttons("Übernehmen")

    def ok(self):
        dup_second = {id(b) for _, b in self.res.dubletten} if self.skip_dups.get() else set()
        self.result = [(p.first_name, p.last_name) for p in self.res.personen if id(p) not in dup_second]
        self.destroy()


class BerichtDialog(Dialog):
    def __init__(self, master, labs: list[tuple[str, str]]):
        super().__init__(master, "PDF-Auswertung erstellen")
        ttk.Label(self.body, text="Lernlabor:").grid(column=0, row=0, sticky="w")
        self.lab = ttk.Combobox(self.body, values=[t for _, t in labs], state="readonly", width=46)
        self.lab.current(0)
        self.lab.grid(column=1, row=0, sticky="w")
        self.labs = labs
        self.opts: dict[str, tk.BooleanVar] = {}
        items = [("uebersicht", "Klassenübersicht mit Einzelantworten (PDF)", True),
                 ("statistik", "Klassenübersicht – nur Statistik, datensparsam (PDF)", False),
                 ("einzeln", "Einzelauswertung je Person mit Antworten und Messwerten (PDF)", True),
                 ("offen", "Übersicht noch nicht abgeschlossener Aufgaben (PDF)", False),
                 ("anonym", "Anonymisierte Auswertung für Fortbildungen (PDF, ohne Namen)", False),
                 ("xlsx", "Excel-Datei (XLSX)", False), ("csv", "CSV-Datei (für Excel, Semikolon)", False)]
        for i, (k, t, v) in enumerate(items, start=1):
            self.opts[k] = tk.BooleanVar(value=v)
            ttk.Checkbutton(self.body, text=t, variable=self.opts[k]).grid(column=0, columnspan=2, row=i, sticky="w")
        self.buttons("Erstellen")

    def ok(self):
        self.result = (self.labs[self.lab.current()][0], {k: v.get() for k, v in self.opts.items()})
        self.destroy()


class DetailFenster(tk.Toplevel):
    def __init__(self, master, zeile):
        super().__init__(master)
        self.title(f"Antworten: {zeile.name}")
        self.geometry("900x420")
        f = ttk.Frame(self, padding=12)
        f.pack(fill="both", expand=True)
        ttk.Label(f, text=f"{zeile.name} · {zeile.pseudonym} · {zeile.lab_title} · Fortschritt {zeile.percent} % · Auswertungsfragen richtig: {zeile.ergebnis_text}",
                  font=("TkDefaultFont", 10, "bold")).pack(anchor="w")
        tree = ttk.Treeview(f, columns=("a", "s", "ant", "mess", "bew"), show="headings")
        for c, t, w in (("a", "Aufgabe", 260), ("s", "Status", 80), ("ant", "Antwort", 230), ("mess", "Messwerte", 200), ("bew", "Bewertung", 100)):
            tree.heading(c, text=t)
            tree.column(c, width=w, anchor="w")
        for a in zeile.antworten:
            bew = "–" if a.is_correct is None else ("richtig" if a.is_correct else "nicht richtig")
            tree.insert("", "end", values=(f"{a.aufgabe.position}. {a.aufgabe.title}", {"completed": "erledigt", "in_progress": "begonnen", "open": "offen"}[a.status],
                                           a.antwort_text or "–", a.messwerte or "–", bew))
        tree.pack(fill="both", expand=True, pady=8)


# ====================================================================== Hauptfenster
class App(tk.Tk):
    def __init__(self, settings: Einstellungen | None = None, interactive: bool = True):
        super().__init__()
        self.settings = settings or Einstellungen()
        self.interactive = interactive
        self.tresor: Tresor | None = None
        self.client: SupabaseClient | None = None
        self.group_id: str | None = None
        self.show_codes = tk.BooleanVar(value=False)
        self._jobs: queue.Queue = queue.Queue()
        self.busy = False
        self.title(f"{APP_NAME} {__version__}")
        self.geometry("1180x720")
        self.minsize(980, 600)
        self._style()
        self._build()
        self.after(100, self._poll)
        if interactive:
            self.after(200, self.unlock)

    # ------------------------------------------------------------ Aufbau
    def _style(self):
        st = ttk.Style(self)
        if "vista" in st.theme_names():
            st.theme_use("vista")
        elif "clam" in st.theme_names():
            st.theme_use("clam")
        st.configure("Big.TButton", padding=(10, 10), font=("TkDefaultFont", 10, "bold"))
        st.configure("Accent.TButton", padding=(10, 6))
        st.configure("Status.TLabel", padding=(8, 4))
        st.configure("Treeview", rowheight=24)

    def _build(self):
        menu = tk.Menu(self)
        datei = tk.Menu(menu, tearoff=False)
        datei.add_command(label="Verschlüsselte Sicherung erstellen …", command=self.backup)
        datei.add_command(label="Sicherung wiederherstellen …", command=self.restore)
        datei.add_command(label="Tresor-Passwort ändern …", command=self.change_password)
        datei.add_separator()
        datei.add_command(label="Pseudonymen Export (JSON) einlesen …", command=self.import_export_file)
        datei.add_separator()
        datei.add_command(label="Beenden", command=self.destroy)
        menu.add_cascade(label="Datei", menu=datei)
        einst = tk.Menu(menu, tearoff=False)
        einst.add_command(label="Server-Verbindung …", command=self.edit_settings)
        einst.add_command(label="Vom Onlinedienst abmelden", command=self.logout_server)
        menu.add_cascade(label="Einstellungen", menu=einst)
        hilfe = tk.Menu(menu, tearoff=False)
        hilfe.add_command(label="Datenschutz und Funktionsweise", command=self.about)
        menu.add_cascade(label="Hilfe", menu=hilfe)
        self.config(menu=menu)

        bar = ttk.Frame(self, padding=(PAD, PAD, PAD, 0))
        bar.pack(fill="x")
        self.buttons = {}
        for key, text, cmd in [
            ("import", "Schülerliste\nimportieren", self.action_import),
            ("codes", "Zugangscodes\nerstellen", self.action_codes),
            ("karten", "Zugangskarten\ndrucken", self.action_cards),
            ("sync", "Mit Online-Datenbank\nsynchronisieren", self.action_sync),
            ("abruf", "Lernstände\njetzt abrufen", self.action_fetch),
            ("auswertung", "Auswertung\nöffnen", self.action_open_evaluation),
            ("pdf", "PDF-Auswertung\nerstellen", self.action_pdf),
        ]:
            b = ttk.Button(bar, text=text, style="Big.TButton", command=cmd)
            b.pack(side="left", padx=(0, 6), fill="y")
            self.buttons[key] = b

        main = ttk.PanedWindow(self, orient="horizontal")
        main.pack(fill="both", expand=True, padx=PAD, pady=PAD)
        left = ttk.Frame(main, padding=(0, 0, 6, 0))
        ttk.Label(left, text="Lerngruppen", font=("TkDefaultFont", 10, "bold")).pack(anchor="w")
        self.groups = ttk.Treeview(left, columns=("art", "n"), show="tree headings", height=18, selectmode="browse")
        self.groups.heading("#0", text="Bezeichnung")
        self.groups.heading("art", text="Art")
        self.groups.heading("n", text="Pers.")
        self.groups.column("#0", width=180)
        self.groups.column("art", width=90)
        self.groups.column("n", width=45, anchor="e")
        self.groups.pack(fill="both", expand=True, pady=4)
        self.groups.bind("<<TreeviewSelect>>", lambda e: self._on_group())
        gb = ttk.Frame(left)
        gb.pack(fill="x")
        ttk.Button(gb, text="Neue Lerngruppe …", command=self.new_group).pack(fill="x", pady=2)
        ttk.Button(gb, text="Demo-Klasse (fiktiv) anlegen", command=self.new_demo_group).pack(fill="x", pady=2)
        ttk.Button(gb, text="Lerngruppe lokal löschen …", command=self.delete_group).pack(fill="x", pady=2)
        main.add(left, weight=1)

        right = ttk.Frame(main)
        self.tabs = ttk.Notebook(right)
        self.tabs.pack(fill="both", expand=True)
        # Schülerliste
        t1 = ttk.Frame(self.tabs, padding=6)
        self.people = ttk.Treeview(t1, columns=("name", "kennung", "code", "status", "online"), show="headings", selectmode="extended")
        for c, t, w in (("name", "Name (nur lokal)", 240), ("kennung", "Kennung", 90), ("code", "Zugangscode", 160), ("status", "Status", 90), ("online", "Online-Stand", 230)):
            self.people.heading(c, text=t)
            self.people.column(c, width=w, anchor="w")
        self.people.pack(fill="both", expand=True)
        pb = ttk.Frame(t1)
        pb.pack(fill="x", pady=(6, 0))
        ttk.Button(pb, text="Person hinzufügen …", command=self.add_person).pack(side="left")
        ttk.Button(pb, text="Entfernen", command=self.remove_people).pack(side="left", padx=4)
        ttk.Button(pb, text="Neuen Code ausstellen", command=self.reissue).pack(side="left", padx=4)
        ttk.Button(pb, text="Sperren / Entsperren", command=self.toggle_block).pack(side="left", padx=4)
        ttk.Checkbutton(pb, text="Codes anzeigen", variable=self.show_codes, command=self.refresh_people).pack(side="right")
        self.tabs.add(t1, text="Schülerliste")
        # Auswertung
        t2 = ttk.Frame(self.tabs, padding=6)
        top = ttk.Frame(t2)
        top.pack(fill="x")
        self.eval_info = ttk.Label(top, text="Noch keine Lernstände abgerufen.")
        self.eval_info.pack(side="left")
        ttk.Button(top, text="Details der Auswahl", command=self.show_details).pack(side="right")
        self.eval = ttk.Treeview(t2, columns=("name", "kennung", "labor", "fortschritt", "ergebnis", "zuletzt"), show="headings")
        for c, t, w in (("name", "Name", 220), ("kennung", "Kennung", 80), ("labor", "Lernlabor", 250), ("fortschritt", "Fortschritt", 100), ("ergebnis", "Ergebnis", 90), ("zuletzt", "Letzte Speicherung", 140)):
            self.eval.heading(c, text=t)
            self.eval.column(c, width=w, anchor="w")
        self.eval.pack(fill="both", expand=True, pady=6)
        self.eval.bind("<Double-1>", lambda e: self.show_details())
        self.tabs.add(t2, text="Auswertung")
        main.add(right, weight=4)

        status = ttk.Frame(self, relief="sunken")
        status.pack(fill="x", side="bottom")
        self.status_left = ttk.Label(status, text="", style="Status.TLabel")
        self.status_left.pack(side="left")
        self.status_right = ttk.Label(status, text="", style="Status.TLabel")
        self.status_right.pack(side="right")

    # ------------------------------------------------------------ Hilfen
    def info(self, title: str, text: str):
        if self.interactive:
            messagebox.showinfo(title, text, parent=self)
        else:
            self.last_message = (title, text)

    def error(self, title: str, text: str):
        if self.interactive:
            messagebox.showerror(title, text, parent=self)
        else:
            self.last_message = (title, text)

    def save(self):
        assert self.tresor
        self.tresor.save()

    @property
    def group(self) -> dict[str, Any] | None:
        if not self.tresor or not self.group_id:
            return None
        try:
            return modell.find_group(self.tresor.data, self.group_id)
        except KeyError:
            return None

    def require_group(self) -> dict[str, Any] | None:
        g = self.group
        if g is None:
            self.info("Lerngruppe wählen", "Bitte links eine Lerngruppe auswählen oder eine neue anlegen.")
        return g

    def run_bg(self, text: str, fn: Callable[[], Any], done: Callable[[Any], None], fail: Callable[[Exception], None] | None = None):
        """Netzwerkaufgaben im Hintergrund, damit die Oberfläche bedienbar bleibt."""
        if self.busy:
            return
        self.busy = True
        self.config(cursor="watch")
        self.status_right.config(text=text)

        def work():
            try:
                self._jobs.put((done, fn(), None))
            except Exception as e:  # noqa: BLE001
                self._jobs.put((fail, None, e))
        threading.Thread(target=work, daemon=True).start()

    def _poll(self):
        try:
            while True:
                cb, res, err = self._jobs.get_nowait()
                self.busy = False
                self.config(cursor="")
                self.update_status()
                if err is not None:
                    self.handle_error(err, cb)
                elif cb:
                    cb(res)
        except queue.Empty:
            pass
        self.after(100, self._poll)

    def handle_error(self, err: Exception, cb=None):
        if cb:
            try:
                cb(err)
                return
            except Exception:
                pass
        if isinstance(err, OfflineFehler):
            self.error("Keine Verbindung", f"{err}\n\nDie zuletzt abgerufenen Daten bleiben weiterhin sichtbar.")
        elif isinstance(err, AnmeldungNoetig):
            self.error("Anmeldung erforderlich", str(err))
        elif isinstance(err, ApiFehler):
            self.error("Serverfehler", str(err))
        else:
            traceback.print_exception(err)
            self.error("Fehler", str(err))

    # ------------------------------------------------------------ Tresor
    def unlock(self):
        path = Path(self.settings["vault_path"])
        hinweis = ""
        while self.tresor is None:
            neu = not path.exists()
            pw = PasswortDialog(self, neu, hinweis).show()
            if pw is None:
                self.destroy()
                return
            try:
                self.tresor = Tresor.create(path, pw) if neu else Tresor.open(path, pw)
            except FalschesPasswort as e:
                hinweis = str(e)
            except TresorFehler as e:
                hinweis = str(e)
        self.after_unlock()

    def after_unlock(self):
        self.settings.save()
        self.refresh_groups()
        self.update_status()

    def backup(self):
        if not self.tresor:
            return
        target = filedialog.asksaveasfilename(parent=self, title="Sicherung speichern", defaultextension=".llv",
                                              initialfile=f"tresor-sicherung-{modell.now_iso()[:10]}.llv", filetypes=[("Tresor-Sicherung", "*.llv")])
        if not target:
            return
        self.tresor.backup(target)
        self.info("Sicherung erstellt", f"Die verschlüsselte Sicherung wurde gespeichert:\n{target}\n\nSie lässt sich nur mit dem Tresor-Passwort öffnen. "
                                        "Bewahre sie z. B. auf einem USB-Stick an einem sicheren Ort auf.")

    def restore(self):
        if not self.tresor:
            return
        src = filedialog.askopenfilename(parent=self, title="Sicherung wählen", filetypes=[("Tresor-Sicherung", "*.llv")])
        if not src:
            return
        pw = simpledialog.askstring("Passwort der Sicherung", "Passwort der Sicherung:", show="•", parent=self)
        if not pw:
            return
        if not messagebox.askyesno("Wiederherstellen", "Der aktuelle Tresorinhalt wird durch die Sicherung ersetzt (der bisherige Stand bleibt als .bak-Datei erhalten). Fortfahren?", parent=self):
            return
        try:
            self.tresor.restore_from(src, pw)
        except TresorFehler as e:
            self.error("Wiederherstellung fehlgeschlagen", str(e))
            return
        self.refresh_groups()
        self.info("Wiederhergestellt", "Die Sicherung wurde wiederhergestellt.")

    def change_password(self):
        if not self.tresor:
            return
        pw = PasswortDialog(self, True).show()
        if pw:
            self.tresor.change_password(pw)
            self.info("Passwort geändert", "Das Tresor-Passwort wurde geändert.")

    # ------------------------------------------------------------ Gruppen
    def refresh_groups(self):
        self.groups.delete(*self.groups.get_children())
        if not self.tresor:
            return
        for g in self.tresor.data.get("groups", []):
            self.groups.insert("", "end", iid=g["id"], text=g["label"], values=(modell.KIND_NAME.get(g["kind"], g["kind"]), len(modell.active_people(g))))
        if self.group_id and self.groups.exists(self.group_id):
            self.groups.selection_set(self.group_id)
        elif self.groups.get_children():
            self.groups.selection_set(self.groups.get_children()[0])
        self._on_group()

    def _on_group(self):
        sel = self.groups.selection()
        self.group_id = sel[0] if sel else None
        self.refresh_people()
        self.refresh_evaluation()
        self.update_status()

    def new_group(self, label: str | None = None, kind: str = "class") -> dict[str, Any] | None:
        if not self.tresor:
            return None
        if label is None:
            label = simpledialog.askstring("Neue Lerngruppe", "Bezeichnung (z. B. „7a Physik“ – bitte keine Personennamen):", parent=self)
            if not label:
                return None
        g = modell.new_group(self.tresor.data, label, kind)
        self.save()
        self.group_id = g["id"]
        self.refresh_groups()
        return g

    def new_demo_group(self):
        if not self.tresor:
            return
        g = demo.create_online_demo_group(self.tresor.data)
        self.save()
        self.group_id = g["id"]
        self.refresh_groups()
        self.info("Demo-Klasse angelegt", "Eine Demo-Klasse mit 12 vollständig fiktiven Personen wurde angelegt.\n\n"
                                          "Nächster Schritt: „Mit Online-Datenbank synchronisieren“. Danach werden für 10 Personen "
                                          "fiktive Lernstände erzeugt; die ersten beiden bleiben frei für die Live-Vorführung.")

    def delete_group(self):
        g = self.require_group()
        if not g or not self.tresor:
            return
        if not messagebox.askyesno("Lerngruppe löschen", f"„{g['label']}“ mit allen Namen und Codes LOKAL löschen?\n\n"
                                   "Auf dem Server bleiben die pseudonymen Daten bis zur Löschfrist erhalten (Löschen dort im Dashboard).", parent=self):
            return
        self.tresor.data["groups"].remove(g)
        self.save()
        self.group_id = None
        self.refresh_groups()

    # ------------------------------------------------------------ Personen
    def refresh_people(self):
        self.people.delete(*self.people.get_children())
        g = self.group
        if not g:
            return
        for p in modell.sorted_people(g):
            code = p.get("code") or "– noch kein Code –"
            if p.get("code") and not self.show_codes.get():
                code = code[:4] + "-••••-••••"
            if not p.get("code"):
                online = "–"
            elif p.get("server_code") == p["code"]:
                online = "registriert" + (" (gesperrt)" if p.get("server_status") == "blocked" else "")
            else:
                online = "NOCH NICHT synchronisiert"
            status = {"active": "aktiv", "blocked": "gesperrt"}.get(p["status"], p["status"])
            self.people.insert("", "end", iid=p["id"], values=(modell.full_name(p), p["pseudonym"], code, status, online))

    def import_people(self, path: str | Path, interactive_preview: bool = True) -> int:
        g = self.group
        if g is None:
            g = self.new_group(Path(path).stem[:60] or "Neue Klasse")
        assert g is not None
        res = read_csv(path)
        if interactive_preview and self.interactive:
            chosen = ImportVorschau(self, res, g["label"]).show()
            if chosen is None:
                return 0
        else:
            dup = {id(b) for _, b in res.dubletten}
            chosen = [(p.first_name, p.last_name) for p in res.personen if id(p) not in dup]
        added = modell.add_people(g, chosen, with_codes=False)
        self.save()
        self.refresh_groups()
        return len(added)

    def action_import(self):
        if not self.tresor:
            return
        if self.group is None or self.group["kind"] != "class":
            if not self.new_group():
                return
        path = filedialog.askopenfilename(parent=self, title="Schülerliste (CSV) wählen", filetypes=[("CSV-Dateien", "*.csv *.txt"), ("Alle Dateien", "*.*")])
        if not path:
            return
        try:
            n = self.import_people(path)
        except Exception as e:  # noqa: BLE001
            self.error("Import fehlgeschlagen", str(e))
            return
        if n:
            self.info("Import abgeschlossen", f"{n} Personen übernommen.\n\nNächster Schritt: „Zugangscodes erstellen“.")

    def add_person(self):
        g = self.require_group()
        if not g:
            return
        first = simpledialog.askstring("Person hinzufügen", "Vorname:", parent=self)
        if first is None:
            return
        last = simpledialog.askstring("Person hinzufügen", "Nachname:", parent=self) or ""
        modell.add_people(g, [(first, last)], with_codes=True)
        self.save()
        self.refresh_groups()

    def selected_people(self) -> list[str]:
        return list(self.people.selection())

    def remove_people(self):
        g = self.require_group()
        ids = self.selected_people()
        if not g or not ids:
            return
        if not messagebox.askyesno("Entfernen", f"{len(ids)} Person(en) entfernen? Beim nächsten Synchronisieren werden auch die Online-Daten gelöscht.", parent=self):
            return
        for pid in ids:
            modell.mark_removed(g, pid)
        self.save()
        self.refresh_groups()

    def reissue(self):
        g = self.require_group()
        ids = self.selected_people()
        if not g or not ids:
            self.info("Auswahl", "Bitte in der Schülerliste mindestens eine Person markieren.")
            return
        for pid in ids:
            modell.reissue_code(g, pid)
        self.save()
        self.refresh_people()
        self.info("Neue Codes", f"{len(ids)} neue Code(s) erstellt. Die alten Codes werden beim nächsten Synchronisieren gesperrt.\n"
                                "Danach die neuen Zugangskarten drucken.")

    def toggle_block(self):
        g = self.require_group()
        ids = self.selected_people()
        if not g or not ids:
            return
        for pid in ids:
            p = modell.person(g, pid)
            modell.set_blocked(g, pid, p["status"] != "blocked")
        self.save()
        self.refresh_people()

    def action_codes(self):
        g = self.require_group()
        if not g:
            return
        n = modell.create_missing_codes(g)
        self.save()
        self.refresh_people()
        if n:
            self.info("Zugangscodes erstellt", f"{n} neue Zugangscodes erstellt (kryptografisch zufällig, ohne verwechselbare Zeichen).\n\n"
                                               "Nächster Schritt: „Mit Online-Datenbank synchronisieren“ – erst danach funktionieren die Codes.")
        else:
            self.info("Zugangscodes", "Alle Personen haben bereits einen Code. Einzelne Codes erneuerst du mit „Neuen Code ausstellen“.")

    def action_cards(self):
        g = self.require_group()
        if not g:
            return
        people = [p for p in modell.sorted_people(g) if p.get("code")]
        if not people:
            self.info("Keine Codes", "Bitte zuerst „Zugangscodes erstellen“.")
            return
        offen = [p for p in people if p.get("server_code") != p["code"]]
        if offen and self.interactive and not messagebox.askyesno("Noch nicht synchronisiert",
                f"{len(offen)} Codes sind noch nicht online registriert und funktionieren noch nicht.\nTrotzdem drucken?", parent=self):
            return
        base = self.settings["lab_base_url"]
        if not base and self.interactive:
            base = simpledialog.askstring("Adresse der Lernlabore", "Adresse der Lernlabore (für QR-Code), z. B. https://name.github.io/mathe10/lernlabore2/site/\n(leer lassen = ohne QR-Code):", parent=self) or ""
            if base:
                self.settings["lab_base_url"] = base
                self.settings.save()
        lab_id = (g.get("lab_ids") or ["physik-entdecker"])[0]
        title = "Physik-Entdecker: Bewegung und Strom" if lab_id == "physik-entdecker" else lab_id
        out = Path(self.settings["export_dir"]) / f"Zugangskarten_{_slug(g['label'])}_{modell.now_iso()[:10]}.pdf"
        berichte.pdf_zugangskarten(out, g, base, lab_id, title, people)
        self.last_output = out
        if self.interactive:
            open_path(out)
        self.info("Zugangskarten", f"PDF erstellt:\n{out}\n\nVertraulich behandeln – die Karten enthalten Namen und Codes.")

    # ------------------------------------------------------------ Server
    def make_client(self) -> SupabaseClient:
        if self.client is None:
            def on_session(s):
                if self.tresor:
                    zugangsdaten.save_token(self.settings["email"], s["refresh_token"] if s else None, self.tresor.data)
            self.client = SupabaseClient(self.settings["supabase_url"], self.settings["supabase_anon_key"], on_session=on_session)
        return self.client

    def ensure_login(self, then: Callable[[], None], hinweis: str = ""):
        if not self.settings.online_configured:
            if self.interactive and EinstellungenDialog(self, self.settings).show():
                self.settings.save()
                self.client = None
            if not self.settings.online_configured:
                self.info("Server nicht eingerichtet", "Bitte zuerst unter Einstellungen → Server-Verbindung die Adresse und den öffentlichen Schlüssel eintragen.")
                return
        try:
            client = self.make_client()
        except ApiFehler as e:
            self.error("Einstellungen prüfen", str(e))
            return
        if client.session:
            then()
            return
        token = zugangsdaten.load_token(self.settings["email"], self.tresor.data) if self.tresor and self.settings["email"] else None

        def ask_password(err: Exception | None = None):
            if isinstance(err, OfflineFehler):
                self.handle_error(err)
                return
            if not self.interactive:
                return
            r = LoginDialog(self, self.settings["email"], hinweis or (str(err) if err else "")).show()
            if not r:
                return
            email, pw = r
            self.settings["email"] = email
            self.settings.save()
            self.run_bg("Anmeldung …", lambda: client.login(email, pw), lambda _: (self.save(), then()),
                        lambda e: self.ensure_login(then, str(e)) if isinstance(e, AnmeldungNoetig) else self.handle_error(e))

        if token and not hinweis:
            self.run_bg("Anmeldung wird erneuert …", lambda: client.login_with_refresh_token(token), lambda _: (self.save(), then()), ask_password)
        else:
            ask_password()

    def logout_server(self):
        if self.client:
            self.client.logout()
        if self.tresor:
            zugangsdaten.save_token(self.settings["email"], None, self.tresor.data)
            self.save()
        self.client = None
        self.update_status()
        self.info("Abgemeldet", "Die gespeicherte Anmeldung wurde gelöscht.")

    def action_sync(self):
        g = self.require_group()
        if not g:
            return
        if g.get("offline_demo"):
            self.info("Browser-Demo", "Diese Demo-Gruppe gehört zum Demo-Modus im Browser und wird nicht synchronisiert.")
            return
        if not any(p.get("code") for p in modell.active_people(g)) and modell.active_people(g):
            self.info("Keine Codes", "Bitte zuerst „Zugangscodes erstellen“.")
            return

        def go():
            client = self.make_client()

            def job():
                r = sync.sync_group(client, g)
                if g["kind"] == "demo" and not g.get("demo_seeded"):
                    for lab in g.get("lab_ids") or []:
                        client.rpc("teacher_seed_demo_results", {"p_group_id": g["id"], "p_lab_id": lab, "p_leave_empty": 2})
                    g["demo_seeded"] = True
                return r

            def done(r):
                self.save()
                self.refresh_people()
                self.update_status()
                self.info("Synchronisierung erfolgreich", f"Vom Server bestätigt: {r.text()}.\nZeitpunkt: {fmt_time(g['server']['synced_at'])}")

            def fail(e):
                self.save()  # Teilerfolge (bestätigte Schritte) behalten
                self.refresh_people()
                if isinstance(e, AnmeldungNoetig):
                    if self.client:
                        self.client.session = None
                    self.ensure_login(go, str(e))
                else:
                    self.handle_error(e)
            self.run_bg("Synchronisiere …", job, done, fail)
        self.ensure_login(go)

    def action_fetch(self):
        g = self.require_group()
        if not g:
            return
        if g.get("offline_demo"):
            self.import_export_file()
            return

        def go():
            client = self.make_client()

            def done(_):
                self.save()
                self.refresh_evaluation()
                self.tabs.select(1)
                self.update_status()

            def fail(e):
                if isinstance(e, AnmeldungNoetig):
                    self.ensure_login(go, str(e))
                else:
                    self.handle_error(e)
            self.run_bg("Rufe Lernstände ab …", lambda: sync.fetch_results(client, g), done, fail)
        self.ensure_login(go)

    def import_export_file(self, path: str | None = None):
        if not self.tresor:
            return
        if path is None:
            path = filedialog.askopenfilename(parent=self, title="Pseudonymen Export (JSON) wählen", filetypes=[("JSON", "*.json")])
            if not path:
                return
        export = json.loads(Path(path).read_text(encoding="utf-8"))
        gid = (export.get("group") or {}).get("id")
        try:
            g = modell.find_group(self.tresor.data, gid)
        except KeyError:
            if export.get("demo") or (export.get("group") or {}).get("kind") == "demo":
                g = demo.browser_demo_group(self.tresor.data)
            else:
                self.error("Unbekannte Gruppe", "Zu diesem Export gibt es im Tresor keine Lerngruppe. Namen können nicht zugeordnet werden.")
                return
        sync.import_export_file(g, export)
        self.save()
        self.group_id = g["id"]
        self.refresh_groups()
        self.tabs.select(1)

    # ------------------------------------------------------------ Auswertung
    def refresh_evaluation(self):
        self.eval.delete(*self.eval.get_children())
        g = self.group
        if not g or not g.get("results"):
            self.eval_info.config(text="Noch keine Lernstände abgerufen. → „Lernstände jetzt abrufen“")
            self._rows = []
            return
        self._rows = build_rows(g)
        quelle = " (aus Datei)" if g["results"].get("quelle") else ""
        self.eval_info.config(text=f"Datenstand: {fmt_time(g['results']['fetched_at'])}{quelle} · Namen wurden lokal zugeordnet · auch offline verfügbar")
        for i, z in enumerate(self._rows):
            self.eval.insert("", "end", iid=str(i), values=(z.name, z.pseudonym, z.lab_title, f"{z.percent} %", z.ergebnis_text, fmt_time(z.last_saved)))

    def action_open_evaluation(self):
        if self.require_group():
            self.refresh_evaluation()
            self.tabs.select(1)

    def show_details(self):
        sel = self.eval.selection()
        if sel:
            DetailFenster(self, self._rows[int(sel[0])])

    def create_reports(self, lab_id: str, opts: dict[str, bool]) -> list[Path]:
        g = self.group
        assert g is not None
        rows = build_rows(g, lab_id)
        if not rows:
            raise ValueError("Für dieses Lernlabor liegen keine Ergebnisse vor.")
        base = Path(self.settings["export_dir"]) / f"{_slug(g['label'])}_{modell.now_iso()[:10]}"
        out: list[Path] = []
        if opts.get("uebersicht"):
            out.append(berichte.pdf_klassenuebersicht(f"{base}_Klassenuebersicht.pdf", g, rows, True))
        if opts.get("statistik"):
            out.append(berichte.pdf_klassenuebersicht(f"{base}_Klassenuebersicht_Statistik.pdf", g, rows, False))
        if opts.get("einzeln"):
            out.append(berichte.pdf_einzelauswertung(f"{base}_Einzelauswertungen.pdf", g, rows))
        if opts.get("offen"):
            out.append(berichte.pdf_offene_aufgaben(f"{base}_Offene_Aufgaben.pdf", g, rows))
        if opts.get("anonym"):
            out.append(berichte.pdf_anonym(f"{base}_anonym.pdf", g, rows))
        if opts.get("xlsx"):
            out.append(berichte.xlsx_export(f"{base}.xlsx", g, rows))
        if opts.get("csv"):
            out.append(berichte.csv_export(f"{base}_Antworten.csv", rows))
        return out

    def action_pdf(self):
        g = self.require_group()
        if not g:
            return
        if not g.get("results"):
            self.info("Keine Daten", "Bitte zuerst „Lernstände jetzt abrufen“.")
            return
        labs = [(l["id"], l["title"]) for l in g["results"]["export"].get("labs", [])]
        if not labs:
            self.info("Keine Daten", "Im Datenstand ist kein Lernlabor enthalten.")
            return
        r = BerichtDialog(self, labs).show()
        if not r:
            return
        try:
            files = self.create_reports(*r)
        except Exception as e:  # noqa: BLE001
            self.error("Bericht", str(e))
            return
        if files:
            open_path(files[0].parent)
            self.info("Berichte erstellt", "Gespeichert in:\n" + "\n".join(str(f) for f in files) + "\n\nVertraulich behandeln. Nicht in Cloud-Ordnern ablegen.")

    # ------------------------------------------------------------ Status & Einstellungen
    def update_status(self):
        g = self.group
        if g:
            synced = g["server"].get("synced_at")
            need = modell.needs_sync(g)
            offen = need["codes"] + need["status"] + need["removed"] + need["group"]
            text = f"„{g['label']}“ · Letzte erfolgreiche Synchronisierung: {fmt_time(synced) if synced else 'noch nie'}"
            if synced:
                text += " (vom Server bestätigt)"
            if offen:
                text += f" · {offen} Änderung(en) noch nicht übertragen"
            if g.get("results"):
                text += f" · Lernstände vom {fmt_time(g['results']['fetched_at'])}"
            self.status_left.config(text=text)
        else:
            self.status_left.config(text="Keine Lerngruppe gewählt.")
        if not self.busy:
            if not self.settings.online_configured:
                self.status_right.config(text="Server nicht eingerichtet (nur lokal)")
            elif self.client and self.client.session:
                self.status_right.config(text=f"Angemeldet: {self.settings['email']}")
            else:
                self.status_right.config(text="Nicht angemeldet")

    def edit_settings(self):
        if EinstellungenDialog(self, self.settings).show():
            self.settings.save()
            self.client = None
            self.update_status()

    def about(self):
        self.info("Datenschutz und Funktionsweise",
                  "• Namen, Codes und Zuordnungen liegen nur in deinem verschlüsselten Tresor (AES-256-GCM, Argon2id).\n"
                  "• An den Server gehen nur zufällige Teilnehmer-IDs, Kennungen (z. B. P-8F2A) und die Codes zur Prüfwert-Berechnung (dort nur als HMAC gespeichert).\n"
                  "• Ergebnisse werden pseudonym abgerufen und erst hier den Namen zugeordnet.\n"
                  "• Berichte mit Namen bitte nur lokal speichern.\n\n"
                  f"Tresordatei: {self.settings['vault_path']}\nBerichte: {self.settings['export_dir']}")


def _slug(s: str) -> str:
    import re
    return re.sub(r"[^A-Za-z0-9ÄÖÜäöüß_-]+", "_", s).strip("_")[:40] or "Gruppe"


def main() -> None:
    app = App()
    app.mainloop()
