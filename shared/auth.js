// shared/auth.js
// Autenticazione Email/Password e audit log per le mappe ASI Multiservices.
// Importato da map-core.js — nessuna modifica necessaria ai singoli file HTML.

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
    collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ─── Overlay di Login ─────────────────────────────────────────────────────────

function injectLoginOverlay() {
    if (document.getElementById('authOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'authOverlay';
    overlay.style.cssText = [
        'position:fixed', 'inset:0', 'background:rgba(15,23,42,0.97)',
        'z-index:9999', 'display:flex', 'align-items:center', 'justify-content:center',
        'font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif'
    ].join(';');

    overlay.innerHTML = `
        <div style="background:white;border-radius:16px;padding:32px;width:100%;max-width:380px;margin:16px;box-shadow:0 25px 60px rgba(0,0,0,0.5);">
            <div style="text-align:center;margin-bottom:24px;">
                <div style="width:60px;height:60px;background:#1e40af;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;">
                    <svg width="30" height="30" fill="white" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                </div>
                <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 4px;">ASI Multiservices</h2>
                <p style="font-size:13px;color:#64748b;margin:0;">Inserisci le tue credenziali per accedere</p>
            </div>

            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Email</label>
                <input id="authEmail" type="email" autocomplete="username" placeholder="nome@asimultiservices.it"
                    style="width:100%;box-sizing:border-box;padding:11px 13px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;transition:border-color 0.15s;"
                    onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#d1d5db'">
            </div>

            <div style="margin-bottom:20px;">
                <label style="display:block;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Password</label>
                <input id="authPassword" type="password" autocomplete="current-password" placeholder="••••••••"
                    style="width:100%;box-sizing:border-box;padding:11px 13px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;transition:border-color 0.15s;"
                    onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#d1d5db'">
            </div>

            <div id="authError" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 13px;font-size:13px;color:#dc2626;margin-bottom:16px;"></div>

            <button id="authSubmitBtn"
                style="width:100%;padding:13px;background:#1d4ed8;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.15s;"
                onmouseover="this.style.background='#1e40af'" onmouseout="this.style.background='#1d4ed8'">
                Accedi
            </button>
        </div>
    `;

    document.body.appendChild(overlay);
    document.getElementById('authSubmitBtn').addEventListener('click', () => window._authDoLogin?.());
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter') window._authDoLogin?.(); });
    setTimeout(() => document.getElementById('authEmail')?.focus(), 120);
}

// ─── requireAuth ──────────────────────────────────────────────────────────────
// Restituisce una Promise<FirebaseUser> che si risolve:
//  - immediatamente se c'è già una sessione valida
//  - dopo il login riuscito, altrimenti
export function requireAuth(auth) {
    return new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
            unsub(); // listener one-shot

            if (user) {
                document.getElementById('authOverlay')?.remove();
                resolve(user);
                return;
            }

            // Nessuna sessione → mostra form di login
            injectLoginOverlay();

            window._authDoLogin = async () => {
                const email = (document.getElementById('authEmail')?.value || '').trim();
                const pass  = document.getElementById('authPassword')?.value || '';
                const errEl = document.getElementById('authError');
                const btn   = document.getElementById('authSubmitBtn');

                errEl.style.display = 'none';

                if (!email || !pass) {
                    errEl.textContent = 'Inserisci email e password.';
                    errEl.style.display = 'block';
                    return;
                }

                btn.textContent = 'Accesso in corso…';
                btn.disabled = true;
                btn.style.opacity = '0.7';

                try {
                    const cred = await signInWithEmailAndPassword(auth, email, pass);
                    document.getElementById('authOverlay')?.remove();
                    resolve(cred.user);
                } catch (err) {
                    let msg = 'Errore di accesso. Riprova.';
                    if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(err.code))
                        msg = 'Email o password errati.';
                    else if (err.code === 'auth/too-many-requests')
                        msg = 'Troppi tentativi falliti. Riprova tra qualche minuto.';
                    else if (err.code === 'auth/network-request-failed')
                        msg = 'Errore di rete. Controlla la connessione.';
                    else if (err.code === 'auth/user-disabled')
                        msg = 'Account disabilitato. Contatta l\'amministratore.';

                    errEl.textContent = msg;
                    errEl.style.display = 'block';
                    btn.textContent = 'Accedi';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            };
        });
    });
}

// ─── Badge utente nella sidebar ───────────────────────────────────────────────
// Aggiorna l'elemento #statusMessage con email utente e pulsante logout.
export function showUserBadge(auth, userEmail) {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) return;

    const displayName = userEmail.split('@')[0];
    statusEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;">
            <span class="text-green-600 cursor-pointer" onclick="toggleSettings?.()">
                <i class="fa-solid fa-cloud"></i> Cloud Attivo
            </span>
            <span class="text-slate-300">|</span>
            <span class="text-slate-500" style="font-size:11px;" title="${userEmail}">
                <i class="fa-solid fa-user"></i> ${displayName}
            </span>
            <button onclick="window._authLogout()"
                style="font-size:10px;color:#dc2626;background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">
                Esci
            </button>
        </div>`;

    window._authLogout = async () => {
        if (!confirm('Disconnettersi dall\'account?')) return;
        await signOut(auth);
        location.reload();
    };
}

// ─── Audit log ────────────────────────────────────────────────────────────────
// Scrive un documento nella collection audit_log su Firestore.
// Non blocca il flusso principale in caso di errore.
export async function logAudit(db, appId, userEmail, action, mappa, pdr, extra) {
    try {
        await addDoc(
            collection(db, 'artifacts', appId, 'public', 'data', 'audit_log'),
            {
                user: userEmail,
                action,
                mappa,
                pdr: pdr || null,
                timestamp: serverTimestamp(),
                ...(extra || {})
            }
        );
    } catch (_) { /* non interrompere il flusso per errori di log */ }
}
