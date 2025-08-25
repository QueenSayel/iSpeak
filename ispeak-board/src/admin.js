// src/admin.js

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
const eventDetailsModal = document.getElementById('event-details-modal');
const modalEventTitle = document.getElementById('modal-event-title');
const availableSlotDetails = document.getElementById('available-slot-details');
const bookedSlotDetails = document.getElementById('booked-slot-details');
const eventStartTimeInput = document.getElementById('event-start-time');
const eventEndTimeInput = document.getElementById('event-end-time');
const saveEventBtn = document.getElementById('save-event-btn');
const deleteEventBtn = document.getElementById('delete-event-btn');
const bookedByEmailSpan = document.getElementById('booked-by-email');
const cancelBookingBtn = document.getElementById('cancel-booking-btn');
const closeEventModalBtn = document.getElementById('close-event-modal-btn');
const adminMeetingLink = document.getElementById('admin-meeting-link');
const studentNotesModal = document.getElementById('student-notes-modal');
const modalStudentName = document.getElementById('modal-student-name');
const studentNotesTextarea = document.getElementById('student-notes-textarea');
const saveNotesBtn = document.getElementById('save-notes-btn');
const closeNotesModalBtn = document.getElementById('close-notes-modal-btn');

let currentManagingBoardId = null; // Stores the ID of the board being managed in the modal
let calendar = null; // A variable to hold the calendar instance
let adminProfile = null; // An in-memory array to hold our availability events
let currentSelectedEvent = null;
let currentNotesStudentId = null;
let studentNotesCache = new Map();

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
boardsTabBtn.addEventListener('click', () => { boardsContent.classList.add('active'); studentsContent.classList.remove('active'); scheduleContent.classList.remove('active'); boardsTabBtn.classList.add('active'); studentsTabBtn.classList.remove('active'); scheduleTabBtn.classList.remove('active'); });
studentsTabBtn.addEventListener('click', () => { studentsContent.classList.add('active'); boardsContent.classList.remove('active'); scheduleContent.classList.remove('active'); studentsTabBtn.classList.add('active'); boardsTabBtn.classList.remove('active'); scheduleTabBtn.classList.remove('active'); });
scheduleTabBtn.addEventListener('click', () => { scheduleContent.classList.add('active'); boardsContent.classList.remove('active'); studentsContent.classList.remove('active'); scheduleTabBtn.classList.add('active'); boardsTabBtn.classList.remove('active'); studentsTabBtn.classList.remove('active'); });

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
			// This query is now more powerful: it gets the email AND the meeting_link
			const { data, error } = await supabase
				.from('availability')
				.select('*, profiles:booked_by(email, meeting_link)'); // Get both fields
			
			if (error) { console.error('Error fetching availability:', error); return []; }

			return data.map(slot => {
				const isPast = new Date(slot.end_time) < new Date(); // past slot?

				// Only modify available slots that are past
				let title = slot.status === 'available' ? (isPast ? 'Expired' : 'Available') : 'Booked';

				return {
					id: slot.id,
					start: slot.start_time,
					end: slot.end_time,
					title,
					backgroundColor: slot.status === 'available'
						? (isPast ? '#6c757d' : '#28a745') // grey for expired available
						: '#e53e3e', // booked slots stay red
					borderColor: slot.status === 'available'
						? (isPast ? '#6c757d' : '#28a745')
						: '#e53e3e',
					editable: !isPast && slot.status === 'available', // past = not editable
					extendedProps: {
						bookerEmail: slot.profiles ? slot.profiles.email : null,
						meetingLink: slot.profiles ? slot.profiles.meeting_link : null,
						isPast
					}
				};
			});
		},

        // --- VISUAL CUSTOMIZATION ---
		eventContent: function(arg) {
			let iconEl = document.createElement('i');
			
			// Differentiate icons for all three states
			if (arg.event.title === 'Available') {
				iconEl.className = 'fa-solid fa-circle-check';
			} else if (arg.event.title === 'Expired') {
				iconEl.className = 'fa-solid fa-ban'; // New icon for expired/unavailable
			} else { // Catches 'Booked'
				iconEl.className = 'fa-solid fa-user-check';
			}
			
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
            }).select().single();

            if (error) {
                console.error('Error creating slot:', error);
                alert('Could not save the new slot. Please try again.');
                const event = calendar.getEventById(newSlot.id);
                if (event) event.remove(); // Rollback
            } else {
                // Update the temporary event with its permanent ID from the database
                const tempEvent = calendar.getEventById(newSlot.id);
                if (tempEvent) {
                    tempEvent.setProp('id', data.id);
                }
            }
        },
        eventClick: function(info) {
            // This function's only job is to open the new modal.
            openEventDetailsModal(info.event);
        },
        eventDrop: async function(info) { // Move an event
            const { error } = await supabase.from('availability').update({
                start_time: info.event.start.toISOString(),
                end_time: info.event.end.toISOString()
            }).eq('id', info.event.id);

            if (error) {
                console.error('Error moving slot:', error);
                info.revert(); // Rollback
            }
        },
        eventResize: async function(info) { // Resize an event
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
    studentList.innerHTML = '<li>Loading students...</li>'; // Show initial loading state

    // First, get all student profiles
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, role, created_at')
        .order('created_at', { ascending: false });

    if (profilesError) {
        console.error('Error fetching students:', profilesError);
        studentList.innerHTML = '<li>Could not load students.</li>';
        return;
    }

    if (profiles.length === 0) {
        studentList.innerHTML = '<li>No students have registered yet.</li>';
        return;
    }

    // If students exist, fetch all their notes in a single query
    const studentIds = profiles.map(p => p.id);
    const { data: notes, error: notesError } = await supabase
        .from('student_notes')
        .select('user_id, note_content')
        .in('user_id', studentIds);

    if (notesError) {
        console.error('Error fetching notes:', notesError);
        // Continue execution, but notes might be missing from cache
    } else {
        // Clear and populate the cache
        studentNotesCache.clear();
        notes.forEach(note => {
            studentNotesCache.set(note.user_id, note.note_content);
        });
    }

    // Finally, render the student list to the DOM
    studentList.innerHTML = '';
    profiles.forEach(profile => {
        const li = document.createElement('li');
        li.className = 'student-item';
        li.dataset.studentId = profile.id;
        li.dataset.studentEmail = profile.email;
        li.innerHTML = `
            <div>
                <strong>${profile.email}</strong>
                <small style="display: block; color: #888;">Role: ${profile.role} | Joined: ${new Date(profile.created_at).toLocaleDateString()}</small>
            </div>
            <div><i class="fa-solid fa-chevron-right"></i></div>
        `;
        studentList.appendChild(li);
    });
}

function openStudentNotesModal(studentId, studentEmail) {
    currentNotesStudentId = studentId;
    modalStudentName.innerHTML = `<i class="fa-solid fa-note-sticky"></i> Notes for ${studentEmail}`;
    
    // Instantly get the note from the cache; default to empty string if not found
    const noteContent = studentNotesCache.get(studentId) || '';
    studentNotesTextarea.value = noteContent;
    
    studentNotesModal.style.display = 'flex';
    studentNotesTextarea.focus(); // Set focus to the text area for better UX
}

function closeStudentNotesModal() {
    studentNotesModal.style.display = 'none';
    currentNotesStudentId = null; // Clear the stored ID
    studentNotesTextarea.value = ''; // Clear the textarea
}

function toLocalISOString(date) {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
}

async function openEventDetailsModal(event) {
    currentSelectedEvent = event;
    const isPast = event.extendedProps.isPast;
    const isAvailable = event.title === 'Available' || event.title === 'Expired';

    // Get the parent '.form-group' divs for the time inputs
    const startTimeGroup = document.getElementById('event-start-time').parentElement;
    const endTimeGroup = document.getElementById('event-end-time').parentElement;

    modalEventTitle.textContent = `Details for ${event.title} Slot${isPast ? ' (Past)' : ''}`;

    if (isAvailable) {
        // This block handles both 'Available' and 'Expired' slots
        availableSlotDetails.style.display = 'block';
        bookedSlotDetails.style.display = 'none';

        eventStartTimeInput.value = toLocalISOString(event.start);
        eventEndTimeInput.value = toLocalISOString(event.end);

        // --- MODIFICATION START ---
        if (isPast) {
            // For EXPIRED slots: Hide time controls and the save button.
            startTimeGroup.style.display = 'none';
            endTimeGroup.style.display = 'none';
            saveEventBtn.style.display = 'none';
            deleteEventBtn.style.display = 'inline-block';
        } else {
            // For future AVAILABLE slots: Show time controls and the save button.
            startTimeGroup.style.display = 'block';
            endTimeGroup.style.display = 'block';
            saveEventBtn.style.display = 'inline-block';
            deleteEventBtn.style.display = 'inline-block';
        }
        // --- MODIFICATION END ---

    } else { 
        // This block handles 'Booked' slots
        availableSlotDetails.style.display = 'none';
        bookedSlotDetails.style.display = 'block';
        bookedByEmailSpan.textContent = event.extendedProps.bookerEmail || 'Unknown Student';

        if (event.extendedProps.meetingLink) {
            adminMeetingLink.href = event.extendedProps.meetingLink;
            adminMeetingLink.textContent = event.extendedProps.meetingLink;
        } else {
            adminMeetingLink.textContent = "No meeting link assigned to this student.";
            adminMeetingLink.removeAttribute('href');
        }

        cancelBookingBtn.style.display = isPast ? 'none' : 'inline-block';
        saveEventBtn.style.display = 'none';
        deleteEventBtn.style.display = 'inline-block';
    }

    eventDetailsModal.style.display = 'flex';
}

function closeEventDetailsModal() {
    eventDetailsModal.style.display = 'none';
    currentSelectedEvent = null;
}

studentList.addEventListener('click', (e) => {
    const studentItem = e.target.closest('.student-item');
    if (studentItem) {
        const studentId = studentItem.dataset.studentId;
        const studentEmail = studentItem.dataset.studentEmail;
        openStudentNotesModal(studentId, studentEmail);
    }
});

saveNotesBtn.addEventListener('click', async () => {
    if (!currentNotesStudentId) return;

    const originalButtonText = saveNotesBtn.innerHTML;
    const newNoteContent = studentNotesTextarea.value;
    const studentIdForSave = currentNotesStudentId;
    const originalNoteContent = studentNotesCache.get(studentIdForSave) || '';

    // 1. Optimistic UI Update
    studentNotesCache.set(studentIdForSave, newNoteContent);
    saveNotesBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
    setTimeout(() => { saveNotesBtn.innerHTML = originalButtonText; }, 2000);

    // 2. Send the update to the database.
    // --- FIX IS HERE ---
    // We now tell Supabase to check for conflicts on the 'user_id' column.
    const { error } = await supabase.from('student_notes').upsert(
        {
            user_id: studentIdForSave,
            note_content: newNoteContent,
            last_updated_by: adminProfile.id
        },
        {
            onConflict: 'user_id', // This tells upsert which column to check
        }
    );
    // --- END OF FIX ---

    // 3. Rollback on failure.
    if (error) {
        console.error('Error saving notes:', error);
        alert('Failed to save notes to the server. Your changes have been reverted.');

        studentNotesCache.set(studentIdForSave, originalNoteContent);

        if (studentNotesModal.style.display === 'flex' && currentNotesStudentId === studentIdForSave) {
             studentNotesTextarea.value = originalNoteContent;
        }
        
        saveNotesBtn.innerHTML = 'Save Failed';
    }
});

closeNotesModalBtn.addEventListener('click', closeStudentNotesModal);

saveEventBtn.addEventListener('click', async () => {
    if (!currentSelectedEvent) return;
    const newStart = new Date(eventStartTimeInput.value);
    const newEnd = new Date(eventEndTimeInput.value);

    if (newStart >= newEnd) { alert("Error: Start time must be before end time."); return; }

    const allEvents = calendar.getEvents();
    const otherEvents = allEvents.filter(e => e.id !== currentSelectedEvent.id);
    const hasOverlap = otherEvents.some(otherEvent => (newStart < otherEvent.end) && (newEnd > otherEvent.start));

    if (hasOverlap) { alert('Error: The new time range overlaps with another existing slot.'); return; }

    const { error } = await supabase
        .from('availability')
        .update({ start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
        .eq('id', currentSelectedEvent.id);

    if (error) {
        alert('Failed to save changes.');
        console.error(error);
    } else {
        currentSelectedEvent.setStart(newStart);
        currentSelectedEvent.setEnd(newEnd);

        closeEventDetailsModal();
    }
});


deleteEventBtn.addEventListener('click', async () => {
    if (!currentSelectedEvent) return;
    if (confirm("Are you sure you want to permanently delete this available slot?")) {
        const eventToDelete = calendar.getEventById(currentSelectedEvent.id);

        if (eventToDelete) {
            // 1. Optimistically remove from UI and close modal
            eventToDelete.remove();
            closeEventDetailsModal();

            // 2. Send delete request to the database
            const { error } = await supabase
                .from('availability')
                .delete()
                .eq('id', eventToDelete.id);

            // 3. Handle failure
            if (error) {
                console.error('Error deleting slot:', error);
                alert('Could not delete the slot from the database. It has been restored.');
                // Rollback by refetching all events
                calendar.refetchEvents();
            }
        }
    }
});

cancelBookingBtn.addEventListener('click', async () => {
    if (!currentSelectedEvent) return;
    if (confirm("Are you sure you want to cancel this student's booking? The slot will become available again.")) {
        const { error } = await supabase.from('availability').update({ status: 'available', booked_by: null }).eq('id', currentSelectedEvent.id);
        if (error) { alert('Failed to cancel booking.'); console.error(error); }
        else { closeEventDetailsModal(); calendar.refetchEvents(); }
    }
});

closeEventModalBtn.addEventListener('click', closeEventDetailsModal);

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
