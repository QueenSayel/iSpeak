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
let calendar = null; // A variable to hold the calendar instance
let adminProfile = null; // An in-memory array to hold our availability events

// --- AUTH GUARD (Checks for admin role) ---
async function checkAdminAuth() {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) { window.location.href = '/board/login.html'; return; }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id, role').eq('id', session.user.id).single();
    if (profileError || !profile || profile.role !== 'admin') {
        alert('Access Denied. You do not have administrator privileges.');
        await supabase.auth.signOut();
        window.location.href = '/board/login.html';
    } else {
        adminProfile = profile; // Store the admin's profile for later
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
        // --- CALENDAR CONFIGURATION ---
        initialView: 'listWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'listWeek,timeGridWeek,timeGridDay'
        },
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        allDaySlot: false,
        height: 'auto',
        editable: true,
        selectable: true,

        // --- DATA SOURCE: FETCH FROM SUPABASE ---
        events: async function(fetchInfo) {
            const { data, error } = await supabase
                .from('availability')
                .select('id, start_time, end_time, status, booked_by');
            
            if (error) { console.error('Error fetching availability:', error); return []; }

            return data.map(slot => ({
                id: slot.id,
                start: slot.start_time,
                end: slot.end_time,
                title: slot.status === 'available' ? 'Available' : 'Booked',
                backgroundColor: slot.status === 'available' ? '#28a745' : '#e53e3e',
                borderColor: slot.status === 'available' ? '#28a745' : '#e53e3e',
            }));
        },

        // --- VISUAL CUSTOMIZATION ---
        eventContent: function(arg) {
            let iconEl = document.createElement('i');
            iconEl.className = arg.event.title === 'Available' ? 'fa-solid fa-circle-check' : 'fa-solid fa-user-check';
            iconEl.style.marginRight = '8px';
            let titleEl = document.createElement('span');
            titleEl.textContent = arg.event.title;
            let arrayOfNodes = [iconEl, titleEl];
            return { domNodes: arrayOfNodes };
        },

        // --- OPTIMISTIC UI INTERACTIVITY (WITH BUG FIX) ---
        select: async function(info) { // Create new availability
            const newSlot = {
                id: Date.now().toString(), // Temporary ID for the UI
                start: info.start,
                end: info.end,
                title: 'Available',
                backgroundColor: '#28a745',
                borderColor: '#28a745'
            };
            calendar.addEvent(newSlot); // Optimistically add to UI

            // Ask Supabase to return the newly created row
            const { data, error } = await supabase.from('availability').insert({
                start_time: info.start.toISOString(),
                end_time: info.end.toISOString(),
                status: 'available',
                admin_id: adminProfile.id
            }).select().single(); // This gets the new row back, including its real ID

            if (error) {
                console.error('Error creating slot:', error);
                alert('Could not save the new slot. Please try again.');
                const event = calendar.getEventById(newSlot.id);
                if (event) event.remove(); // Rollback
            } else {
                // --- THE FIX ---
                // Instead of refetching all events, we find our temporary event...
                const tempEvent = calendar.getEventById(newSlot.id);
                if (tempEvent) {
                    // ...and update its ID to the permanent one from the database.
                    tempEvent.setProp('id', data.id);
                }
            }
        },
        eventClick: async function(info) { // Delete availability or cancel booking
            const event = info.event;
            const eventId = event.id;
            const eventTitle = event.title;

            if (eventTitle === 'Available' && confirm("Are you sure you want to delete this available slot?")) {
                event.remove(); // Optimistically remove from UI
                const { error } = await supabase.from('availability').delete().eq('id', eventId);
                if (error) {
                    console.error('Error deleting slot:', error);
                    alert('Could not delete the slot. It has been restored.');
                    calendar.refetchEvents(); // Rollback by refetching
                }
            } else if (eventTitle === 'Booked' && confirm("Cancel this student's booking? This will make the slot available again.")) {
                event.setProp('title', 'Available');
                event.setProp('backgroundColor', '#28a745');
                event.setProp('borderColor', '#28a745'); // Optimistically update UI
                
                const { error } = await supabase
                    .from('availability')
                    .update({ status: 'available', booked_by: null })
                    .eq('id', eventId);

                if (error) {
                    console.error('Error cancelling booking:', error);
                    alert('Could not cancel the booking. It has been restored.');
                    calendar.refetchEvents(); // Rollback by refetching
                }
            }
        },
        eventDrop: async function(info) { // Move an event (already optimistic)
            const { error } = await supabase.from('availability').update({
                start_time: info.event.start.toISOString(),
                end_time: info.event.end.toISOString()
            }).eq('id', info.event.id);

            if (error) {
                console.error('Error moving slot:', error);
                info.revert(); // Rollback
            }
        },
        eventResize: async function(info) { // Resize an event (already optimistic)
            const { error } = await supabase.from('availability').update({
                end_time: info.event.end.toISOString()
            }).eq('id', info.event.id);

            if (error) {
                console.error('Error resizing slot:', error);
                info.revert(); // Rollback
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
