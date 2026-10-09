/* ==========================================================================
   Frase do Dia • Application Logic (Cycle-based non-repeating draw)
   ========================================================================== */

const STORAGE_KEYS = {
    PARTICIPANTS: 'frase_dia_participants_v1',
    CYCLE_STATE: 'frase_dia_cycle_v1',
    HISTORY: 'frase_dia_history_v1'
};

// Application State
let state = {
    participants: [], // Array of { id, name, active: true }
    cycleNumber: 1,
    drawnParticipantIds: [], // Array of IDs drawn in current cycle
    history: [], // Array of { id, date, participantId, participantName, phrase, cycleNumber }
    isSpinning: false,
    currentWinnerDrawRecord: null
};

// Default initial participants if local storage is empty
const DEFAULT_PARTICIPANTS = [
    { id: 'p_1', name: 'Ana Silva', active: true },
    { id: 'p_2', name: 'Bruno Santos', active: true },
    { id: 'p_3', name: 'Carla Lima', active: true },
    { id: 'p_4', name: 'Diego Oliveira', active: true },
    { id: 'p_5', name: 'Fernanda Costa', active: true }
];

/* ==========================================================================
   Initialization
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    loadStateFromStorage();
    initTabNavigation();
    initEventListeners();
    renderAll();
});

function loadStateFromStorage() {
    try {
        const savedParticipants = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
        if (savedParticipants) {
            state.participants = JSON.parse(savedParticipants);
        } else {
            state.participants = [...DEFAULT_PARTICIPANTS];
            saveParticipantsToStorage();
        }

        const savedCycleState = localStorage.getItem(STORAGE_KEYS.CYCLE_STATE);
        if (savedCycleState) {
            const parsed = JSON.parse(savedCycleState);
            state.cycleNumber = parsed.cycleNumber || 1;
            state.drawnParticipantIds = parsed.drawnParticipantIds || [];
        }

        const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
        if (savedHistory) {
            state.history = JSON.parse(savedHistory);
        }
    } catch (err) {
        console.error('Erro ao carregar dados do LocalStorage:', err);
    }
}

function saveParticipantsToStorage() {
    localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(state.participants));
}

function saveCycleStateToStorage() {
    localStorage.setItem(STORAGE_KEYS.CYCLE_STATE, JSON.stringify({
        cycleNumber: state.cycleNumber,
        drawnParticipantIds: state.drawnParticipantIds
    }));
}

function saveHistoryToStorage() {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history));
}

/* ==========================================================================
   Tab Navigation
   ========================================================================== */

function initTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

/* ==========================================================================
   Rendering & UI Updates
   ========================================================================== */

function renderAll() {
    renderCycleBadge();
    renderDrawStage();
    renderParticipantsTab();
    renderHistoryTab();
}

function getActiveParticipants() {
    return state.participants.filter(p => p.active);
}

function getRemainingCycleParticipants() {
    const active = getActiveParticipants();
    return active.filter(p => !state.drawnParticipantIds.includes(p.id));
}

function getDrawnCycleParticipants() {
    const active = getActiveParticipants();
    return active.filter(p => state.drawnParticipantIds.includes(p.id));
}

function renderCycleBadge() {
    const active = getActiveParticipants();
    const drawn = getDrawnCycleParticipants();
    const badgeText = `Ciclo ${state.cycleNumber} • ${drawn.length}/${active.length} sorteados`;
    
    document.getElementById('cycleBadgeText').textContent = badgeText;
    document.getElementById('participantsCountBadge').textContent = state.participants.length;
}

function renderPartialDrawLists() {
    const active = getActiveParticipants();
    const remaining = getRemainingCycleParticipants();
    const drawn = getDrawnCycleParticipants();

    // Progress Bar
    const total = active.length;
    const countDrawn = drawn.length;
    const percent = total > 0 ? Math.round((countDrawn / total) * 100) : 0;
    
    document.getElementById('cyclePercentText').textContent = `${percent}%`;
    document.getElementById('cycleProgressBar').style.width = `${percent}%`;

    // Counts
    document.getElementById('countRemaining').textContent = remaining.length;
    document.getElementById('countDrawn').textContent = countDrawn;

    // Available Tags
    const listRemaining = document.getElementById('listRemaining');
    if (remaining.length === 0) {
        listRemaining.innerHTML = `<span class="text-dim" style="font-size: 0.85rem;">${active.length === 0 ? 'Nenhum participante ativo cadastrado.' : '🎉 Todos sorteados neste ciclo! O próximo sorteio iniciará um novo ciclo.'}</span>`;
    } else {
        listRemaining.innerHTML = remaining.map(p => `
            <div class="tag-item">
                <span>👤 ${escapeHtml(p.name)}</span>
            </div>
        `).join('');
    }

    // Drawn Tags
    const listDrawn = document.getElementById('listDrawn');
    if (drawn.length === 0) {
        listDrawn.innerHTML = `<span class="text-dim" style="font-size: 0.85rem;">Nenhum sorteado no ciclo atual ainda.</span>`;
    } else {
        listDrawn.innerHTML = drawn.map(p => `
            <div class="tag-item drawn">
                <span>✅ ${escapeHtml(p.name)}</span>
            </div>
        `).join('');
    }
}

function renderDrawStage() {
    renderPartialDrawLists();
    if (!state.isSpinning) {
        startAmbientMarquee();
    }
}

function renderParticipantsTab() {
    const listContainer = document.getElementById('participantsList');
    if (state.participants.length === 0) {
        listContainer.innerHTML = `
            <div class="glass-panel" style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">
                Nenhum participante cadastrado. Adicione acima ou use a opção "Adicionar em Lote".
            </div>
        `;
        return;
    }

    listContainer.innerHTML = state.participants.map(p => {
        const isDrawnInCycle = state.drawnParticipantIds.includes(p.id);
        const initials = getInitials(p.name);
        const statusLabel = !p.active ? 'Inativo' : (isDrawnInCycle ? 'Já sorteado no ciclo' : 'Aguardando sorteio');

        return `
            <div class="participant-card" data-id="${p.id}">
                <div class="participant-info">
                    <div class="participant-avatar" style="${!p.active ? 'opacity:0.4;' : ''}">${initials}</div>
                    <div>
                        <div class="participant-name" style="${!p.active ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHtml(p.name)}</div>
                        <div class="participant-status">${statusLabel}</div>
                    </div>
                </div>
                <div class="participant-actions">
                    <label class="switch" title="${p.active ? 'Desativar participante' : 'Ativar participante'}">
                        <input type="checkbox" class="toggle-active" data-id="${p.id}" ${p.active ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <button class="btn-icon btn-delete" data-id="${p.id}" title="Remover participante">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderHistoryTab(searchQuery = '') {
    const historyContainer = document.getElementById('historyList');
    let items = state.history;

    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        items = items.filter(h => 
            h.participantName.toLowerCase().includes(q) || 
            (h.phrase && h.phrase.toLowerCase().includes(q))
        );
    }

    if (items.length === 0) {
        historyContainer.innerHTML = `
            <div class="glass-panel" style="padding: 40px; text-align: center; color: var(--text-muted);">
                ${searchQuery ? 'Nenhum resultado encontrado para a busca.' : 'Nenhum sorteio registrado ainda no histórico.'}
            </div>
        `;
        return;
    }

    historyContainer.innerHTML = items.map(item => {
        const dateObj = new Date(item.date);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const monthStr = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const year = dateObj.getFullYear();
        const hasPhrase = item.phrase && item.phrase.trim().length > 0;

        return `
            <div class="history-card" data-history-id="${item.id}">
                <div class="history-date-badge">
                    <span class="history-date-day">${day}</span>
                    <span class="history-date-month">${monthStr} ${year}</span>
                </div>
                <div class="history-content" style="position: relative; padding-right: 40px;">
                    <div class="history-author">👤 ${escapeHtml(item.participantName)} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(Ciclo ${item.cycleNumber})</span></div>
                    <div class="history-phrase ${!hasPhrase ? 'empty' : ''}">
                        ${hasPhrase ? `"${escapeHtml(item.phrase)}"` : '<em>Nenhuma frase registrada para este dia.</em>'}
                    </div>
                    <button class="btn-text-action btn-delete-history" data-id="${item.id}" title="Excluir Registro" style="position: absolute; top: 0; right: 0; color: #ff6b6b;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/* ==========================================================================
   Ambient Infinite Marquee System
   ========================================================================== */

let marqueeState = { timerId: null, isRunning: false, idx: 0 };

function getSlotEl()   { return document.getElementById('slotName'); }
function getBoxEl()    { return document.getElementById('rouletteBox'); }
function getStatusEl() { return document.getElementById('stageStatusText'); }

function setSlotIdle(msg) {
    stopAmbientMarquee();
    const el = getSlotEl();
    if (!el) return;
    el.classList.remove('winner-glow');
    el.classList.add('idle');
    el.textContent = msg;
    const box = getBoxEl();
    if (box) { box.classList.remove('spinning', 'winner'); }
}

function startAmbientMarquee() {
    if (state.isSpinning) return;
    stopAmbientMarquee();

    const active = getActiveParticipants();
    const el     = getSlotEl();
    const box    = getBoxEl();
    if (!el) return;

    if (active.length === 0) {
        setSlotIdle('Cadastre participantes para começar');
        return;
    }

    el.classList.remove('winner-glow');
    el.classList.add('idle');
    if (box) box.classList.remove('spinning', 'winner');

    let i = 0;
    function tick() {
        if (!marqueeState.isRunning || state.isSpinning) return;
        el.textContent = active[i % active.length].name;
        i++;
        marqueeState.timerId = setTimeout(tick, 900);
    }
    marqueeState.isRunning = true;
    tick();
}

function stopAmbientMarquee() {
    marqueeState.isRunning = false;
    if (marqueeState.timerId) { clearTimeout(marqueeState.timerId); marqueeState.timerId = null; }
}

/* ==========================================================================
   Core Cycle Draw Algorithm & Carousel Spin Modal
   ========================================================================== */

function startDrawSequence() {
    if (state.isSpinning) return;

    const active = getActiveParticipants();
    if (active.length === 0) {
        showToast('⚠️ Adicione ao menos um participante ativo para sortear!');
        return;
    }

    let remaining = getRemainingCycleParticipants();

    // CYCLE RESET CHECK
    let cycleWasReset = false;
    if (remaining.length === 0) {
        state.cycleNumber += 1;
        state.drawnParticipantIds = [];
        saveCycleStateToStorage();
        remaining = [...active];
        cycleWasReset = true;
        showToast(`🔄 Todos participaram do Ciclo ${state.cycleNumber - 1}! Iniciando Ciclo ${state.cycleNumber}.`, 'purple');
    }

    // Pick random winner from remaining pool
    const winner = remaining[Math.floor(Math.random() * remaining.length)];

    // Stop ambient ticker
    stopAmbientMarquee();

    state.isSpinning = true;
    document.getElementById('btnStartDraw').disabled = true;

    // Open the Spin Modal
    const modal = document.getElementById('spinModal');
    const wrapper = document.querySelector('.spin-wrapper');
    const track = document.getElementById('spinTrack');
    const status = document.getElementById('spinStatus');

    modal.classList.add('active');
    wrapper.classList.remove('winner');
    wrapper.classList.add('spinning');
    status.textContent = cycleWasReset ? 'Novo ciclo! Sorteando...' : 'Sorteando... ⏳';

    // Play drumroll sound
    const drumAudio = new Audio('drumroll.mp3');
    drumAudio.volume = 0.6;
    drumAudio.play().catch(e => console.log('Audio autoplay prevented:', e));

    // Populate the spin track
    const winnerIndex = 40; // Card where it will stop
    const totalCards = winnerIndex + 15; // Extra cards so the right side is never empty
    
    let cardsHtml = '';
    for (let i = 0; i < totalCards; i++) {
        let p;
        if (i === winnerIndex) {
            p = winner;
        } else {
            p = active[Math.floor(Math.random() * active.length)];
        }
        cardsHtml += `<div class="spin-card" id="spin_card_${i}">${escapeHtml(p.name)}</div>`;
    }
    
    track.style.transition = 'none';
    track.style.transform = `translateX(0px)`;
    track.innerHTML = cardsHtml;

    // Dimensions
    const cardWidth = 260;
    const cardMargin = 20; // 10px on each side based on CSS margin: 0 10px
    const itemWidth = cardWidth + cardMargin;

    // Wait for modal to render to get viewport dimensions
    setTimeout(() => {
        // Double check viewport width, fallback to 700 if hidden
        const viewportWidth = document.getElementById('spinViewport').offsetWidth || 700;
        const centerOffset = (viewportWidth / 2) - (itemWidth / 2);

        // Calculate final translation to center the winner card
        const targetX = -(winnerIndex * itemWidth) + centerOffset;

        // Force a reflow so transition works
        track.offsetHeight;

        // Animate! Uses a cubic-bezier for a strong ease-out (slot machine feel)
        const duration = 4800; // 4.8 seconds
        track.style.transition = `transform ${duration}ms cubic-bezier(0.15, 0.85, 0.25, 1)`;
        track.style.transform = `translateX(${targetX}px)`;

        // Handle animation end
        setTimeout(() => {
            // Highlight winner
            const winnerCard = document.getElementById(`spin_card_${winnerIndex}`);
            if (winnerCard) {
                winnerCard.classList.add('winner-card');
            }
            wrapper.classList.remove('spinning');
            wrapper.classList.add('winner');
            status.textContent = `✨ Ganhador do dia: ${winner.name}!`;

            // Stop the drumroll
            drumAudio.pause();
            drumAudio.currentTime = 0;

            // Play success sound
            const successAudio = new Audio('success.mp3');
            successAudio.volume = 0.7;
            successAudio.play().catch(e => console.log('Audio autoplay prevented:', e));

            // Wait a beat, close modal, and finish draw
            setTimeout(() => {
                modal.classList.remove('active');
                finishDraw(winner);
            }, 1500);

        }, duration);
    }, 50);
}

function finishDraw(winner) {
    state.isSpinning = false;
    document.getElementById('btnStartDraw').disabled = false;

    // Mark drawn in state
    state.drawnParticipantIds.push(winner.id);
    saveCycleStateToStorage();

    // Create history record for the next valid day (skipping weekends)
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Skip Saturdays (6) and Sundays (0)
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
        nextDay.setDate(nextDay.getDate() + 1);
    }
    
    const nextDayISO = nextDay.toISOString();
    
    const drawRecord = {
        id: 'draw_' + Date.now(),
        date: nextDayISO,
        participantId: winner.id,
        participantName: winner.name,
        phrase: '',
        cycleNumber: state.cycleNumber
    };

    state.history.unshift(drawRecord);
    state.currentWinnerDrawRecord = drawRecord;
    saveHistoryToStorage();

    // Update lists WITHOUT touching the slot display
    renderCycleBadge();
    renderPartialDrawLists();
    renderParticipantsTab();
    renderHistoryTab();

    // Trigger Confetti FX
    triggerConfetti();

    // Open Winner Modal after a beat so user sees the winner name
    setTimeout(() => { openWinnerModal(winner, nextDayISO); }, 900);
}

/* ==========================================================================
   Modals & Interaction Handlers
   ========================================================================== */

function triggerConfetti() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
}

function openWinnerModal(winner, dateISO) {
    const modal = document.getElementById('winnerModal');
    const dateFormatted = new Date(dateISO).toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });

    document.getElementById('winnerModalDate').textContent = dateFormatted;
    document.getElementById('winnerNameDisplay').textContent = winner.name;
    document.getElementById('winnerAvatar').textContent = getInitials(winner.name);
    document.getElementById('inputWinnerPhrase').value = '';

    modal.classList.add('active');
}

function closeWinnerModal() {
    document.getElementById('winnerModal').classList.remove('active');
    setTimeout(() => {
        if (!state.isSpinning) {
            startAmbientMarquee();
        }
    }, 400);
}

function initEventListeners() {
    // Draw button
    document.getElementById('btnStartDraw').addEventListener('click', startDrawSequence);

    // Manual cycle reset button
    document.getElementById('btnResetCycle').addEventListener('click', () => {
        if (confirm('Deseja realmente resetar o ciclo atual? Todos os integrantes voltarão a ficar disponíveis.')) {
            state.drawnParticipantIds = [];
            saveCycleStateToStorage();
            renderAll();
            showToast('🔄 Ciclo resetado com sucesso!');
        }
    });

    // Form Add Participant
    document.getElementById('formAddParticipant').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('inputName');
        const name = input.value.trim();

        if (name) {
            state.participants.push({
                id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                name: name,
                active: true
            });
            saveParticipantsToStorage();
            input.value = '';
            renderAll();
            showToast(`✅ ${name} adicionado ao grupo!`);
        }
    });

    // Delegate Participant List Actions (Toggle active / Delete)
    document.getElementById('participantsList').addEventListener('click', (e) => {
        const toggle = e.target.closest('.toggle-active');
        if (toggle) {
            const id = toggle.getAttribute('data-id');
            const participant = state.participants.find(p => p.id === id);
            if (participant) {
                participant.active = toggle.checked;
                saveParticipantsToStorage();
                renderAll();
            }
            return;
        }

        const btnDelete = e.target.closest('.btn-delete');
        if (btnDelete) {
            const id = btnDelete.getAttribute('data-id');
            const participant = state.participants.find(p => p.id === id);
            if (participant && confirm(`Remover "${participant.name}" dos participantes?`)) {
                state.participants = state.participants.filter(p => p.id !== id);
                state.drawnParticipantIds = state.drawnParticipantIds.filter(pid => pid !== id);
                saveParticipantsToStorage();
                saveCycleStateToStorage();
                renderAll();
                showToast(`🗑️ ${participant.name} foi removido.`);
            }
        }
    });

    // Winner Modal Form Submit (Save Phrase)
    document.getElementById('formSavePhrase').addEventListener('submit', (e) => {
        e.preventDefault();
        const phrase = document.getElementById('inputWinnerPhrase').value.trim();
        if (state.currentWinnerDrawRecord) {
            state.currentWinnerDrawRecord.phrase = phrase;
            saveHistoryToStorage();
            renderHistoryTab();
            showToast('✨ Frase do Dia gravada com sucesso!');
        }
        closeWinnerModal();
    });

    document.getElementById('btnSkipPhrase').addEventListener('click', () => {
        closeWinnerModal();
    });

    document.getElementById('btnCloseWinnerModal').addEventListener('click', closeWinnerModal);

    // Bulk Import Modal
    const bulkModal = document.getElementById('bulkModal');
    document.getElementById('btnOpenBulkModal').addEventListener('click', () => {
        document.getElementById('textareaBulkNames').value = '';
        bulkModal.classList.add('active');
    });

    document.getElementById('btnCloseBulkModal').addEventListener('click', () => bulkModal.classList.remove('active'));
    document.getElementById('btnCancelBulk').addEventListener('click', () => bulkModal.classList.remove('active'));

    document.getElementById('btnSaveBulk').addEventListener('click', () => {
        const text = document.getElementById('textareaBulkNames').value;
        const lines = text.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 0);

        if (lines.length > 0) {
            let count = 0;
            lines.forEach(name => {
                if (!state.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
                    state.participants.push({
                        id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        name: name,
                        active: true
                    });
                    count++;
                }
            });
            saveParticipantsToStorage();
            renderAll();
            bulkModal.classList.remove('active');
            showToast(`🎉 ${count} participantes importados com sucesso!`);
        }
    });

    // History Item Delete
    document.getElementById('historyList').addEventListener('click', (e) => {
        const btnDelete = e.target.closest('.btn-delete-history');
        if (btnDelete) {
            const id = btnDelete.getAttribute('data-id');
            if (confirm('Deseja excluir este registro de sorteio do histórico?')) {
                state.history = state.history.filter(h => h.id !== id);
                saveHistoryToStorage();
                renderHistoryTab();
                showToast('🗑️ Registro removido do histórico.');
            }
        }
    });

    // Reset All History
    document.getElementById('btnResetHistory').addEventListener('click', () => {
        if (confirm('CUIDADO: Deseja apagar TODO o histórico de sorteios e resetar o ciclo atual? Esta ação não pode ser desfeita.')) {
            state.history = [];
            state.cycleNumber = 1;
            state.drawnParticipantIds = [];
            saveHistoryToStorage();
            saveCycleStateToStorage();
            renderAll();
            showToast('🔄 Histórico e ciclos apagados com sucesso.');
        }
    });

    // History Search
    document.getElementById('inputSearchHistory').addEventListener('input', (e) => {
        renderHistoryTab(e.target.value);
    });

    // Export JSON
    document.getElementById('btnExportJSON').addEventListener('click', () => {
        const data = {
            exportDate: new Date().toISOString(),
            participants: state.participants,
            cycleState: { cycleNumber: state.cycleNumber, drawnParticipantIds: state.drawnParticipantIds },
            history: state.history
        };

        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `frase_do_dia_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

/* ==========================================================================
   Utilities
   ========================================================================== */

function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

function showToast(message, type = 'primary') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    if (type === 'purple') {
        toast.style.borderColor = 'var(--primary)';
    }

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
