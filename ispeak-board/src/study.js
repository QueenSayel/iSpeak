// src/study.js
import { supabase } from './supabaseClient.js';

// --- ELEMENT REFERENCES ---
const loadingOverlay = document.getElementById('loading-overlay');
const setNameHeading = document.getElementById('set-name-heading');
const prevBtn = document.getElementById('prev-card-btn');
const nextBtn = document.getElementById('next-card-btn');
const cardCounter = document.getElementById('card-counter');
const modeSwitcher = document.querySelector('.mode-switcher');
const cardContainer = document.getElementById('flashcard-container');
const cardFront = document.getElementById('card-front');
const cardBack = document.getElementById('card-back');
const revealBox = document.getElementById('reveal-box');
const flashcardViewport = document.getElementById('flashcard-viewport');
const memoryGameContainer = document.getElementById('memory-game-container');
const memoryGrid = document.getElementById('memory-grid');
const startGameBtn = document.getElementById('start-game-btn');
const memoryTimerInput = document.getElementById('memory-timer-input');
const studyControls = document.querySelector('.study-controls');
const missingGameContainer = document.getElementById('missing-game-container');
const missingGrid = document.getElementById('missing-grid');
const startMissingGameBtn = document.getElementById('start-missing-game-btn');
const missingCountInput = document.getElementById('missing-count-input');
const revealMissingBtn = document.getElementById('reveal-missing-btn');

// --- STATE MANAGEMENT ---
const state = {
    cards: [],
    currentIndex: 0,
    currentMode: 'linear',
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    isGameStarted: false,
    firstCardFlipped: null,
    secondCardFlipped: null,
    lockBoard: false,
    matchedPairs: 0,
    missingCards: [],
    isMissingGameStarted: false,
};

let resizeObserver = null;

// --- DATA FETCHING ---
async function loadSetData(setId) {
    const { data: setData, error: setError } = await supabase.from('flashcard_sets').select('name').eq('id', setId).single();
    if (setError) { console.error('Error fetching set name', setError); return; }
    
    const { data: cardsData, error: cardsError } = await supabase.from('flashcards').select('*').eq('set_id', setId).order('created_at');
    if (cardsError) { console.error('Error fetching cards', cardsError); return; }

    state.cards = cardsData;
    setNameHeading.textContent = setData.name;
    loadingOverlay.style.display = 'none';
    renderCurrentCard();
}

// --- RENDERING & UI LOGIC ---

function updateRevealBoxForImage(imageElement) {
    if (imageElement.style.display === 'none') {
        revealBox.style.display = 'none';
        return;
    }
    
    const REVEAL_BOX_PADDING = 20;

    const imageRect = imageElement.getBoundingClientRect();
    const viewportRect = flashcardViewport.getBoundingClientRect();

    const top = imageRect.top - viewportRect.top - (REVEAL_BOX_PADDING / 2);
    const left = imageRect.left - viewportRect.left - (REVEAL_BOX_PADDING / 2);
    const width = imageRect.width + REVEAL_BOX_PADDING;
    const height = imageRect.height + REVEAL_BOX_PADDING;

    revealBox.style.width = `${width}px`;
    revealBox.style.height = `${height}px`;
    revealBox.style.top = `${top}px`;
    revealBox.style.left = `${left}px`;
    
    if (state.currentMode === 'reveal') {
        revealBox.style.display = 'block';
    }
}

function renderCurrentCard() {
    if (state.cards.length === 0) return;

    cardContainer.style.transition = 'none';
    cardContainer.classList.remove('is-flipped');
    void cardContainer.offsetHeight;
    cardContainer.style.transition = '';

    const card = state.cards[state.currentIndex];

    revealBox.style.transition = 'none';

    const frontImage = cardFront.querySelector('.card-image');
    const frontText = cardFront.querySelector('.card-text');
    frontText.textContent = card.front_text || '';
    if (card.front_image_url) {
        frontImage.src = card.front_image_url;
        frontImage.style.display = 'block';
        frontImage.onload = () => {
            updateRevealBoxForImage(frontImage);
            setTimeout(() => {
                revealBox.style.transition = 'width 0.3s ease, height 0.3s ease, top 0.3s ease, left 0.3s ease';
            }, 50);
        };
    } else {
        frontImage.style.display = 'none';
        updateRevealBoxForImage(frontImage);
    }

    const backImage = cardBack.querySelector('.card-image');
    const backText = cardBack.querySelector('.card-text');
    const backDefinition = cardBack.querySelector('.card-definition');
    backText.textContent = card.back_text || '';
    backDefinition.textContent = card.definition || '';
    if (card.back_image_url) {
        backImage.src = card.back_image_url;
        backImage.style.display = 'block';
    } else {
        backImage.style.display = 'none';
    }

    cardCounter.textContent = `${state.currentIndex + 1} / ${state.cards.length}`;
}


// --- MEMORY GAME LOGIC ---

// ===== NEW DYNAMIC LAYOUT LOGIC =====
function updateMemoryGridLayout() {
    if (state.currentMode !== 'memory' || state.cards.length === 0) return;

    const totalCards = state.cards.length * 2;
    const containerWidth = memoryGrid.clientWidth;
    const containerHeight = memoryGrid.clientHeight;
    
    if (containerWidth === 0 || containerHeight === 0) return;
    const containerRatio = containerWidth / containerHeight;

    let bestLayout = { cols: totalCards, rows: 1, diff: Infinity };

    // Find all factor pairs of totalCards
    for (let rows = 1; rows * rows <= totalCards; rows++) {
        if (totalCards % rows === 0) {
            const cols = totalCards / rows;
            
            // Check layout: rows x cols
            let layoutRatio1 = cols / rows;
            let diff1 = Math.abs(layoutRatio1 - containerRatio);
            if (diff1 < bestLayout.diff) {
                bestLayout = { cols, rows, diff: diff1 };
            }

            // Check inverted layout: cols x rows
            let layoutRatio2 = rows / cols;
            let diff2 = Math.abs(layoutRatio2 - containerRatio);
            if (diff2 < bestLayout.diff) {
                bestLayout = { cols: rows, rows: cols, diff: diff2 };
            }
        }
    }

    const gapValue = parseFloat(getComputedStyle(memoryGrid).gap) || 16;
    
    const totalGapWidth = (bestLayout.cols - 1) * gapValue;
    const totalGapHeight = (bestLayout.rows - 1) * gapValue;

    const maxTileWidth = (containerWidth - totalGapWidth) / bestLayout.cols;
    const maxTileHeight = (containerHeight - totalGapHeight) / bestLayout.rows;

    const tileSize = Math.floor(Math.min(maxTileWidth, maxTileHeight));

    // Apply the calculated size to the grid
    memoryGrid.style.gridTemplateColumns = `repeat(${bestLayout.cols}, ${tileSize}px)`;
    memoryGrid.style.gridTemplateRows = `repeat(${bestLayout.rows}, ${tileSize}px)`;
    memoryGrid.style.justifyContent = 'center';
    memoryGrid.style.alignContent = 'center';
}
// ===== END OF NEW LAYOUT LOGIC =====

function setupMemoryGame() {
    state.isGameStarted = false;
    state.matchedPairs = 0;
    startGameBtn.textContent = 'Start Game';
    startGameBtn.disabled = false;
    memoryGrid.innerHTML = '';
    
    const pairedCards = [...state.cards, ...state.cards];
    for (let i = pairedCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pairedCards[i], pairedCards[j]] = [pairedCards[j], pairedCards[i]];
    }

    let cardIndex = 1;
    pairedCards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('memory-card');
        cardElement.dataset.matchId = card.id;
        const frontContent = card.front_image_url ? `<img src="${card.front_image_url}">` : card.front_text;
        cardElement.innerHTML = `
            <div class="memory-face memory-front">${cardIndex}</div>
            <div class="memory-face memory-back">${frontContent}</div>
        `;
        memoryGrid.appendChild(cardElement);
        cardIndex++;
    });

    updateMemoryGridLayout();
    if (!resizeObserver) {
        resizeObserver = new ResizeObserver(updateMemoryGridLayout);
        resizeObserver.observe(memoryGrid);
    }
}

function flipCard(card) {
    if (state.lockBoard || card === state.firstCardFlipped) return;
    card.classList.add('is-flipped');
    if (!state.firstCardFlipped) {
        state.firstCardFlipped = card;
        return;
    }
    state.secondCardFlipped = card;
    checkForMatch();
}

function checkForMatch() {
    state.lockBoard = true;
    const isMatch = state.firstCardFlipped.dataset.matchId === state.secondCardFlipped.dataset.matchId;
    isMatch ? disableCards() : unflipCards();
}

function disableCards() {
    state.firstCardFlipped.classList.add('is-matched');
    state.secondCardFlipped.classList.add('is-matched');
    state.matchedPairs++;
    if (state.matchedPairs === state.cards.length) {
        startGameBtn.textContent = 'You Won! Play Again?';
        startGameBtn.disabled = false;
    }
    resetBoard();
}

function unflipCards() {
    setTimeout(() => {
        state.firstCardFlipped.classList.remove('is-flipped');
        state.secondCardFlipped.classList.remove('is-flipped');
        resetBoard();
    }, 1200);
}

function resetBoard() {
    [state.firstCardFlipped, state.secondCardFlipped] = [null, null];
    state.lockBoard = false;
}

// --- WHAT'S MISSING GAME LOGIC ---

// ===== NEW DYNAMIC LAYOUT LOGIC for Missing Game =====
function updateMissingGridLayout() {
    if (state.currentMode !== 'missing' || state.cards.length === 0) return;

    const totalCards = state.cards.length;
    const containerWidth = missingGrid.clientWidth;
    const containerHeight = missingGrid.clientHeight;
    
    if (containerWidth === 0 || containerHeight === 0) return;
    const containerRatio = containerWidth / containerHeight;

    let bestLayout = { cols: totalCards, rows: 1, diff: Infinity };

    // Find all factor pairs
    for (let rows = 1; rows * rows <= totalCards; rows++) {
        if (totalCards % rows === 0) {
            const cols = totalCards / rows;

            // rows x cols
            let layoutRatio1 = cols / rows;
            let diff1 = Math.abs(layoutRatio1 - containerRatio);
            if (diff1 < bestLayout.diff) {
                bestLayout = { cols, rows, diff: diff1 };
            }

            // cols x rows (inverted)
            let layoutRatio2 = rows / cols;
            let diff2 = Math.abs(layoutRatio2 - containerRatio);
            if (diff2 < bestLayout.diff) {
                bestLayout = { cols: rows, rows: cols, diff: diff2 };
            }
        }
    }

    const gapValue = parseFloat(getComputedStyle(missingGrid).gap) || 16;
    const totalGapWidth = (bestLayout.cols - 1) * gapValue;
    const totalGapHeight = (bestLayout.rows - 1) * gapValue;

    const maxTileWidth = (containerWidth - totalGapWidth) / bestLayout.cols;
    const maxTileHeight = (containerHeight - totalGapHeight) / bestLayout.rows;
    const tileSize = Math.floor(Math.min(maxTileWidth, maxTileHeight));

    missingGrid.style.gridTemplateColumns = `repeat(${bestLayout.cols}, ${tileSize}px)`;
    missingGrid.style.gridTemplateRows = `repeat(${bestLayout.rows}, ${tileSize}px)`;
    missingGrid.style.justifyContent = 'center';
    missingGrid.style.alignContent = 'center';
}

function setupMissingGame() {
    state.isMissingGameStarted = false;
    state.missingCards = [];
    missingGrid.innerHTML = '';

    // Reset buttons
    startMissingGameBtn.textContent = 'Start Game';
    startMissingGameBtn.disabled = false;
    revealMissingBtn.style.display = 'none';
    missingCountInput.max = state.cards.length -1 || 1;


    state.cards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('missing-card');
        cardElement.dataset.id = card.id;

		const content = card.front_image_url 
			? `<img src="${card.front_image_url}">` 
			: `<span class="original-text">${card.front_text}</span>`;
        cardElement.innerHTML = content;
        missingGrid.appendChild(cardElement);
    });
    
    updateMissingGridLayout();
    if (!resizeObserver) {
        resizeObserver = new ResizeObserver(updateMissingGridLayout);
        resizeObserver.observe(missingGrid);
    }
}

function startMissingGame() {
    state.isMissingGameStarted = true;
    startMissingGameBtn.disabled = true;
    revealMissingBtn.style.display = 'none';
    missingGrid.querySelectorAll('.missing-card').forEach(c => c.classList.remove('is-revealed'));

    // 1. Hide all cards
    const allCardsInGrid = missingGrid.querySelectorAll('.missing-card');
    allCardsInGrid.forEach(cardEl => cardEl.classList.add('is-hidden'));

    // 2. Select the missing cards
    const numToRemove = parseInt(missingCountInput.value, 10) || 1;
    const shuffledCards = [...state.cards].sort(() => 0.5 - Math.random());
    state.missingCards = shuffledCards.slice(0, numToRemove);

    // 2a. Build a Set of missing IDs as strings
    const missingCardIds = new Set(state.missingCards.map(c => String(c.id)));

    // 3. Wait a moment, then reveal all but the missing one
    setTimeout(() => {
        allCardsInGrid.forEach(cardEl => {
            const cardId = cardEl.dataset.id; // keep as string
            if (missingCardIds.has(cardId)) {
                cardEl.classList.add('is-missing');
                cardEl.innerHTML = '?';              // replace content first
                cardEl.classList.remove('is-hidden'); // then un-hide
            } else {
                cardEl.classList.remove('is-hidden');
            }
        });
        revealMissingBtn.style.display = 'block';
    }, 2000); // 2-second delay
}

function revealMissing() {
    state.missingCards.forEach(missingCard => {
        const cardElement = missingGrid.querySelector(`.missing-card[data-id="${missingCard.id}"]`);
        if (cardElement) {
            cardElement.classList.remove('is-missing');
            cardElement.classList.add('is-revealed');
			const content = missingCard.front_image_url 
				? `<img src="${missingCard.front_image_url}">` 
				: `<span class="original-text">${missingCard.front_text}</span>`;
            cardElement.innerHTML = content;
        }
    });

    // Reset for next round
    startMissingGameBtn.textContent = 'Play Again?';
    startMissingGameBtn.disabled = false;
    revealMissingBtn.style.display = 'none';
}


// --- EVENT LISTENERS ---
cardContainer.addEventListener('click', () => cardContainer.classList.toggle('is-flipped'));

nextBtn.addEventListener('click', () => {
    if (state.currentIndex < state.cards.length - 1) {
        state.currentIndex++;
        renderCurrentCard();
    }
});
prevBtn.addEventListener('click', () => {
    if (state.currentIndex > 0) {
        state.currentIndex--;
        renderCurrentCard();
    }
});

modeSwitcher.addEventListener('click', (e) => {
    const btn = e.target.closest('.mode-btn');
    if (!btn) return;
    state.currentMode = btn.dataset.mode;
    modeSwitcher.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Hide all containers first
    flashcardViewport.style.display = 'none';
    memoryGameContainer.style.display = 'none';
    missingGameContainer.style.display = 'none';
    studyControls.style.display = 'none';
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }

    if (state.currentMode === 'memory') {
        memoryGameContainer.style.display = 'flex';
        setupMemoryGame();
    } else if (state.currentMode === 'missing') {
        missingGameContainer.style.display = 'flex';
        setupMissingGame();
    }
    else { // Linear or Reveal
        flashcardViewport.style.display = 'block';
        studyControls.style.display = 'flex';
        const frontImage = cardFront.querySelector('.card-image');
        revealBox.style.display = state.currentMode === 'reveal' && frontImage.style.display === 'block' ? 'block' : 'none';
    }
});

startGameBtn.addEventListener('click', () => {
    if (startGameBtn.textContent.includes('Play Again')) {
        setupMemoryGame();
        return;
    }
    state.isGameStarted = true;
    startGameBtn.disabled = true;
    memoryGrid.querySelectorAll('.memory-card').forEach(card => card.classList.add('is-flipped'));
    const revealTime = (parseInt(memoryTimerInput.value, 10) || 3) * 1000;
    setTimeout(() => {
        memoryGrid.querySelectorAll('.memory-card').forEach(card => card.classList.remove('is-flipped'));
    }, revealTime);
});

memoryGrid.addEventListener('click', (e) => {
    if (!state.isGameStarted) return;
    const clickedCard = e.target.closest('.memory-card');
    if (clickedCard && !clickedCard.classList.contains('is-matched')) {
        flipCard(clickedCard);
    }
});

startMissingGameBtn.addEventListener('click', () => {
    if (startMissingGameBtn.textContent.includes('Play Again')) {
        setupMissingGame(); // This will reset the board
    } else {
        startMissingGame();
    }
});

revealMissingBtn.addEventListener('click', revealMissing);

// --- DRAG-AND-DROP LOGIC ---
revealBox.addEventListener('mousedown', (e) => {
    revealBox.style.transition = 'none';
    state.isDragging = true;
    state.dragOffsetX = e.clientX - revealBox.offsetLeft;
    state.dragOffsetY = e.clientY - revealBox.offsetTop;
});

window.addEventListener('mousemove', (e) => {
    if (!state.isDragging) return;
    let newX = e.clientX - state.dragOffsetX;
    let newY = e.clientY - state.dragOffsetY;
    revealBox.style.left = `${newX}px`;
    revealBox.style.top = `${newY}px`;
});

window.addEventListener('mouseup', () => {
    revealBox.style.transition = 'width 0.3s ease, height 0.3s ease, top 0.3s ease, left 0.3s ease';
    state.isDragging = false;
});


// --- INITIALIZATION ---
async function initializeApp() {
    const params = new URLSearchParams(window.location.search);
    const setId = params.get('set_id');

    if (setId) {
        await loadSetData(setId);
    } else {
        loadingOverlay.innerHTML = '<p>Error: No Set ID provided.</p>';
    }
}

initializeApp();
