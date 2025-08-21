import { supabase } from './supabaseClient';

// --- ELEMENT REFERENCES (ALL) ---
const boardList = document.getElementById('board-list');
const newBoardForm = document.getElementById('new-board-form');
const logoutBtn = document.getElementById('logout-btn');
const newBoardNameInput = document.getElementById('new-board-name');
const studentList = document.getElementById('student-list');
const boardsTabBtn = document.getElementById('boards-tab-btn');
const studentsTabBtn = document.getElementById('students-tab-btn');
const boardsContent = document.getElementById('boards-content');
const studentsContent = document.getElementById('students-content');
const manageAccessModal = document.getElementById('manage-access-modal');
const modalBoardName = document.getElementById('modal-board-name');
const modalStudentList = document.getElementById('modal-student-list');
const closeModalBtn = document.getElementById('close-modal-btn');
const scheduleTabBtn = document.getElementById('schedule-tab-btn');
const scheduleContent = document.getElementById('schedule-content');
const calendarEl = document.getElementById('calendar');

let currentManagingBoardId = null; // Stores the ID of the board being managed in the modal
let availableSlots = []; // An in-memory array to hold our availability events
let calendar = null; // A variable to hold the calendar instance

// --- AUTH GUARD (Checks for admin role) ---
async function checkAdminAuth() {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
        window.location.href = '/board/login.html';
        return;
    }
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
    if (profileError || !profile || profile.role !== 'admin') {
        alert('Access Denied. You do not have administrator privileges.');
        await supabase.auth.signOut();
        window.location.href = '/board/login.html';
    }
}

// --- TAB SWITCHING LOGIC ---
boardsTabBtn.addEventListener('click', () => {
    boardsContent.classList.add('active');
    studentsContent.classList.remove('active');
    scheduleContent.classList.remove('active');
    boardsTabBtn.classList.add('active');
    studentsTabBtn.classList.remove('active');
    scheduleTabBtn.classList.remove('active');
});
studentsTabBtn.addEventListener('click', () => {
    studentsContent.classList.add('active');
    boardsContent.classList.remove('active');
    scheduleContent.classList.remove('active');
    studentsTabBtn.classList.add('active');
    boardsTabBtn.classList.remove('active');
    scheduleTabBtn.classList.remove('active');
});
scheduleTabBtn.addEventListener('click', () => {
    scheduleContent.classList.add('active');
    boardsContent.classList.remove('active');
    studentsContent.classList.remove('active');
    scheduleTabBtn.classList.add('active');
    boardsTabBtn.classList.remove('active');
    studentsTabBtn.classList.remove('active');
});

function initializeCalendar() {
    if (calendar) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        // --- VISUAL UPGRADE 1: A BETTER DEFAULT VIEW & MORE OPTIONS ---
        initialView: 'listWeek', // Start with the clean "agenda" view
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'listWeek,timeGridWeek,timeGridDay' // Let user switch views
        },
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        allDaySlot: false,
        height: 'auto',
        
        // --- THE FIX FOR THE COLORS ---
        // We provide events as a function. Now `refetchEvents()` works correctly.
        events: function(fetchInfo, successCallback, failureCallback) {
            successCallback(availableSlots);
        },

        // --- VISUAL UPGRADE 2: CUSTOM EVENT RENDERING ---
        // This function controls how each "Available" block looks.
        eventContent: function(arg) {
            let iconEl = document.createElement('i');
            iconEl.className = 'fa-solid fa-circle-check';
            iconEl.style.marginRight = '8px';

            let titleEl = document.createElement('span');
            titleEl.textContent = arg.event.title;

            let arrayOfNodes = [iconEl, titleEl];
            return { domNodes: arrayOfNodes };
        },
        
        // --- VISUAL UPGRADE 3: DRAG & DROP AND RESIZING ---
        editable: true,     // Allows dragging and resizing
        selectable: true,   // Allows clicking and dragging to select a time range

        // --- INTERACTIVITY (FIXED) ---
        
        // The redundant `dateClick` handler has been REMOVED from here.
        
        // This `select` handler now correctly handles both single clicks and dragging.
        select: function(info) {
            const newSlot = {
                id: Date.now().toString(),
                start: info.start,
                end: info.end,
                title: 'Available',
                backgroundColor: '#28a745',
                borderColor: '#28a745'
            };
            availableSlots.push(newSlot);
            calendar.refetchEvents();
            console.log("Added slot via selection:", newSlot);
        },

        eventClick: function(info) {
            if (confirm("Are you sure you want to remove this available time slot?")) {
                availableSlots = availableSlots.filter(slot => slot.id !== info.event.id);
                calendar.refetchEvents();
                console.log("Removed slot with ID:", info.event.id);
            }
        },

        // These functions run after you drag or resize an event
        eventDrop: function(info) {
            // Find the event in our array and update its start/end times
            let slot = availableSlots.find(s => s.id === info.event.id);
            if (slot) {
                slot.start = info.event.start;
                slot.end = info.event.end;
                console.log("Moved slot:", slot);
            }
        },

        eventResize: function(info) {
            // Find the event and update its end time
            let slot = availableSlots.find(s => s.id === info.event.id);
            if (slot) {
                slot.end = info.event.end;
                console.log("Resized slot:", slot);
            }
        }
    });

    calendar.render();
}

// --- DATA FETCHING ---
async function fetchBoards() {
    const { data: boards, error } = await supabase.from('boards').select('id, name, created_at').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching boards:', error); boardList.innerHTML = '<li>Could not load boards.</li>'; return; }
    boardList.innerHTML = '';
    if (boards.length === 0) { boardList.innerHTML = '<li>No boards found. Create one below!</li>'; } else {
        boards.forEach(board => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <a href="/board/b/${board.id}" target="_blank">${board.name}</a>
                    <small style="display: block; color: #888;">Created: ${new Date(board.created_at).toLocaleString()}</small>
                </div>
                <div>
                    <button class="manage-btn" data-id="${board.id}" data-name="${board.name}">Manage Access</button>
                    <button class="delete-btn" data-id="${board.id}">Delete</button>
                </div>
            `;
            boardList.appendChild(li);
        });
    }
}

async function fetchStudents() {
    const { data: profiles, error } = await supabase.from('profiles').select('email, role, created_at').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching students:', error); studentList.innerHTML = '<li>Could not load students.</li>'; return; }
    studentList.innerHTML = '';
    if (profiles.length === 0) { studentList.innerHTML = '<li>No students have registered yet.</li>'; } else {
        profiles.forEach(profile => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <strong>${profile.email}</strong>
                    <small style="display: block; color: #888;">Role: ${profile.role} | Joined: ${new Date(profile.created_at).toLocaleDateString()}</small>
                </div>
            `;
            studentList.appendChild(li);
        });
    }
}

// --- MANAGE ACCESS MODAL LOGIC ---
async function openManageModal(boardId, boardName) {
    currentManagingBoardId = boardId;
    modalBoardName.textContent = `Manage Access for "${boardName}"`;
    modalStudentList.innerHTML = '<li>Loading students...</li>';
    manageAccessModal.style.display = 'flex';

    try {
        const [allStudentsRes, currentMembersRes] = await Promise.all([
            supabase.from('profiles').select('id, email').eq('role', 'student'),
            supabase.from('board_members').select('user_id').eq('board_id', boardId)
        ]);
        if (allStudentsRes.error || currentMembersRes.error) throw new Error('Failed to fetch modal data.');
        
        const allStudents = allStudentsRes.data;
        const currentMemberIds = new Set(currentMembersRes.data.map(m => m.user_id));
        
        modalStudentList.innerHTML = '';
        allStudents.forEach(student => {
            const li = document.createElement('li');
            const isMember = currentMemberIds.has(student.id);
            li.innerHTML = `
                <span>${student.email}</span>
                <button class="action-btn ${isMember ? 'remove-btn' : 'add-btn'}" data-student-id="${student.id}">
                    ${isMember ? 'Remove' : 'Add'}
                </button>
            `;
            modalStudentList.appendChild(li);
        });
    } catch (error) {
        console.error(error);
        modalStudentList.innerHTML = '<li>Error loading data.</li>';
    }
}

// --- EVENT LISTENERS ---
newBoardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boardName = newBoardNameInput.value.trim();
    if (!boardName) return;
    const { error } = await supabase.from('boards').insert({ name: boardName, content: {} });
    if (error) { console.error('Error creating board:', error); alert('Failed to create board.'); }
    else { newBoardNameInput.value = ''; fetchBoards(); }
});

boardList.addEventListener('click', async (e) => {
    const manageButton = e.target.closest('.manage-btn');
    if (manageButton) {
        openManageModal(manageButton.dataset.id, manageButton.dataset.name);
        return;
    }
    const deleteButton = e.target.closest('.delete-btn');
    if (deleteButton) {
        const boardId = deleteButton.dataset.id;
        const boardName = deleteButton.parentElement.parentElement.querySelector('a').textContent;
        if (confirm(`Are you sure you want to delete the board "${boardName}"? This cannot be undone.`)) {
            const { error } = await supabase.from('boards').delete().eq('id', boardId);
            if (error) { console.error('Error deleting board:', error); alert('Failed to delete board.'); }
            else { fetchBoards(); }
        }
    }
});

modalStudentList.addEventListener('click', async (e) => {
    const actionButton = e.target.closest('.action-btn');
    if (!actionButton) return;

    const studentId = actionButton.dataset.studentId;
    const isRemoving = actionButton.classList.contains('remove-btn');
    let error;

    if (isRemoving) {
        ({ error } = await supabase.from('board_members').delete().match({ board_id: currentManagingBoardId, user_id: studentId }));
    } else {
        ({ error } = await supabase.from('board_members').insert({ board_id: currentManagingBoardId, user_id: studentId }));
    }
    if (error) { console.error('Error updating membership:', error); alert('Could not update membership.'); }
    else { openManageModal(currentManagingBoardId, modalBoardName.textContent.match(/"([^"]+)"/)[1]); }
});

closeModalBtn.addEventListener('click', () => {
    manageAccessModal.style.display = 'none';
    currentManagingBoardId = null;
});

logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/board/login.html';
});

// --- INITIALIZE THE PAGE ---
async function init() {
    await checkAdminAuth();
    fetchBoards();
    fetchStudents();
	initializeCalendar();
}
init();