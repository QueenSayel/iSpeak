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
const memoryTimerInput = document.getElementById('memory-timer-input'); // #2 New element

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
};

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

function renderCurrentCard() {
    if (state.cards.length === 0) return;

    cardContainer.classList.remove('is-flipped');
    const card = state.cards[state.currentIndex];

    // #3: RESET REVEAL BOX POSITION
    revealBox.style.top = '0px';
    revealBox.style.left = '0px';

    // Render Front
    const frontImage = cardFront.querySelector('.card-image');
    const frontText = cardFront.querySelector('.card-text');
    frontText.textContent = card.front_text || '';
    if (card.front_image_url) {
        frontImage.src = card.front_image_url;
        frontImage.style.display = 'block';
    } else {
        frontImage.style.display = 'none';
    }

    // Render Back
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

    pairedCards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('memory-card');
        cardElement.dataset.matchId = card.id;
        const frontContent = card.front_image_url ? `<img src="${card.front_image_url}">` : card.front_text;
        cardElement.innerHTML = `
            <div class="memory-face memory-front"></div>
            <div class="memory-face memory-back">${frontContent}</div>
        `;
        memoryGrid.appendChild(cardElement);
    });
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

// --- EVENT LISTENERS ---
cardContainer.addEventListener('click', () => {
    cardContainer.classList.toggle('is-flipped');
});

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
    if (state.currentMode === 'memory') {
        flashcardViewport.style.display = 'none';
        memoryGameContainer.style.display = 'flex';
        setupMemoryGame();
    } else {
        flashcardViewport.style.display = 'block';
        memoryGameContainer.style.display = 'none';
        revealBox.style.display = state.currentMode === 'reveal' ? 'block' : 'none';
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
    
    // #2: Use the value from the new input field
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

// --- DRAG-AND-DROP LOGIC ---
revealBox.addEventListener('mousedown', (e) => {
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