import { supabase } from './supabaseClient';

const logoutBtn = document.getElementById('logout-btn');
const myBoardList = document.getElementById('my-board-list');

// --- AUTHENTICATION GUARD ---
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/board/login.html';
    }
}

// --- LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/board/login.html';
});

// --- FETCH ASSIGNED BOARDS ---
async function fetchMyBoards() {
    // The Row Level Security policies on the 'boards' table ensure that this query
    // will ONLY return boards the currently logged-in user is a member of.
    const { data: boards, error } = await supabase
        .from('boards')
        .select('id, name, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching assigned boards:', error);
        myBoardList.innerHTML = '<li>Could not load your boards.</li>';
        return;
    }
    
    myBoardList.innerHTML = '';
    if (boards.length === 0) {
        myBoardList.innerHTML = '<li>You have not been assigned to any boards yet.</li>';
    } else {
        boards.forEach(board => {
            const li = document.createElement('li');
            // This link uses the "clean URL" format we set up
            li.innerHTML = `<a href="/board/b/${board.id}" target="_blank">${board.name}</a>`;
            myBoardList.appendChild(li);
        });
    }
}

// --- INITIALIZE THE PAGE ---
async function init() {
    await checkAuth();
    await fetchMyBoards();
}

// Run the initialization function
init();