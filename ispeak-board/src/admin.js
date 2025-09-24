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
const lessonsTabBtn = document.getElementById('lessons-tab-btn');
const lessonsContent = document.getElementById('lessons-content');
const lessonList = document.getElementById('lesson-list');
const lessonDetailsModal = document.getElementById('lesson-details-modal');
const modalLessonTitle = document.getElementById('modal-lesson-title');
const modalLessonInfo = document.getElementById('modal-lesson-info');
const saveLessonNotesBtn = document.getElementById('save-lesson-notes-btn');
const closeLessonModalBtn = document.getElementById('close-lesson-modal-btn');
const flashcardsTabBtn = document.getElementById('flashcards-tab-btn');
const flashcardsContent = document.getElementById('flashcards-content');
const categoryList = document.getElementById('flashcard-category-list');
const setList = document.getElementById('flashcard-set-list');
const flashcardList = document.getElementById('flashcard-list');
const newCategoryForm = document.getElementById('new-category-form');
const newSetForm = document.getElementById('new-set-form');
const newCategoryNameInput = document.getElementById('new-category-name');
const newSetNameInput = document.getElementById('new-set-name');
const selectedCategoryNameSpan = document.getElementById('selected-category-name');
const selectedSetNameSpan = document.getElementById('selected-set-name');
const flashcardListPlaceholder = document.getElementById('flashcard-list-placeholder');
const addNewCardBtn = document.getElementById('add-new-card-btn');
const flashcardEditorContainer = document.getElementById('flashcard-editor-container');
const editorHeading = document.getElementById('editor-heading');
const flashcardEditorForm = document.getElementById('flashcard-editor-form');
const editingCardIdInput = document.getElementById('editing-card-id');
const cardFrontTextInput = document.getElementById('card-front-text');
const cardBackTextInput = document.getElementById('card-back-text');
const cardDefinitionInput = document.getElementById('card-definition');
const frontImagePreview = document.getElementById('front-image-preview');
const backImagePreview = document.getElementById('back-image-preview');
const cardFrontImageInput = document.getElementById('card-front-image');
const cardBackImageInput = document.getElementById('card-back-image');
const saveCardBtn = document.getElementById('save-card-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

let currentManagingBoardId = null; // Stores the ID of the board being managed in the modal
let calendar = null; // A variable to hold the calendar instance
let adminProfile = null; // An in-memory array to hold our availability events
let currentSelectedEvent = null;
let currentNotesStudentId = null;
let studentNotesCache = new Map();
let lessonNotesCache = new Map();
let allStudentsCache = [];
let boardsCache = new Map();
let finishedLessonsCache = []; // Cache for finished lessons
let quill = null; // To hold the Quill editor instance
let currentLessonId = null; // To track the lesson in the modal

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
const sidebarNav = document.querySelector('.sidebar-nav');
const contentTabs = document.querySelectorAll('.content-tab');

sidebarNav.addEventListener('click', (e) => {
    const clickedLink = e.target.closest('.tab-btn');
    if (!clickedLink) return;

    e.preventDefault(); // Prevent default anchor link behavior

    const targetContentId = clickedLink.id.replace('-tab-btn', '-content');
    const targetContent = document.getElementById(targetContentId);

    // Deactivate all tab links and hide all content panes
    sidebarNav.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    contentTabs.forEach(content => content.classList.remove('active'));

    // Activate the clicked link and show the corresponding content
    clickedLink.classList.add('active');
    if (targetContent) {
        targetContent.classList.add('active');
    }

    // If the lessons tab was clicked, fetch its data
    if (clickedLink.id === 'lessons-tab-btn') {
        fetchFinishedLessons();
    }
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
				.select('*, profiles:booked_by(email, meeting_link)');
			if (error) { console.error('Error fetching availability:', error); return []; }

			return data.map(slot => {
				const isPast = new Date(slot.end_time) < new Date();
				let title, backgroundColor, editable;

				if (slot.status === 'available') {
					title = isPast ? 'Expired' : 'Available';
					backgroundColor = isPast ? '#6c757d' : '#28a745';
					editable = !isPast;
				} else { // status is 'booked'
					title = isPast ? 'Finished' : 'Booked';
					backgroundColor = isPast ? '#4a5568' : '#e53e3e'; // New color for Finished
					editable = false; // Booked slots are never editable
				}

				return {
					id: slot.id,
					start: slot.start_time,
					end: slot.end_time,
					title,
					backgroundColor,
					borderColor: backgroundColor, // Border matches background
					editable,
					extendedProps: {
						bookerEmail: slot.profiles ? slot.profiles.email : null,
						meetingLink: slot.profiles ? slot.profiles.meeting_link : null,
						isPast,
						status: slot.status // Pass status for modal logic
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
    // This single query gets all boards AND their members.
    const { data: boards, error } = await supabase
        .from('boards')
        .select('id, name, created_at, board_members(user_id)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching boards:', error);
        boardList.innerHTML = '<li>Could not load boards.</li>';
        return;
    }

    // Clear and populate the cache with board data and a Set of member IDs for fast lookups.
    boardsCache.clear();
    boards.forEach(board => {
        boardsCache.set(board.id, {
            ...board,
            memberIds: new Set(board.board_members.map(m => m.user_id))
        });
    });

    // Render the list to the DOM
    boardList.innerHTML = '';
    if (boards.length === 0) {
        boardList.innerHTML = '<li>No boards found. Create one below!</li>';
    } else {
        boards.forEach(board => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <a href="/board/b/${board.id}" target="_blank">${board.name}</a>
                    <small style="display: block; color: #888;">Created: ${new Date(board.created_at).toLocaleString()}</small>
                </div>
                <div>
                    <button class="action-icon-btn manage-btn" data-id="${board.id}" data-name="${board.name}" title="Manage Access">
                        <i class="fa-solid fa-users-gear"></i>
                    </button>
                    <button class="action-icon-btn delete-btn" data-id="${board.id}" title="Delete Board">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
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

	allStudentsCache = profiles.filter(p => p.role === 'student');

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
	
    if (status === 'booked' && isPast) {
        cancelBookingBtn.style.display = 'none';
    } else {
        cancelBookingBtn.style.display = 'inline-block';
    }
	
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

async function fetchFinishedLessons() {
    lessonList.innerHTML = '<li>Loading finished lessons...</li>';
    const { data, error } = await supabase
        .from('availability')
        .select('id, start_time, end_time, profiles:booked_by(id, email)')
        .eq('status', 'booked')
        .lt('end_time', new Date().toISOString()) // 'lt' = less than (in the past)
        .order('start_time', { ascending: false });

    if (error) {
        console.error('Error fetching finished lessons:', error);
        lessonList.innerHTML = '<li>Could not load lessons.</li>';
        return;
    }

    finishedLessonsCache = data; // Cache the data

    if (data.length === 0) {
        lessonList.innerHTML = '<li>No finished lessons found.</li>';
        return;
    }

    lessonList.innerHTML = '';
    data.forEach(lesson => {
        const li = document.createElement('li');
        li.className = 'lesson-item';
        li.dataset.lessonId = lesson.id;
        li.innerHTML = `
            <div>
                <strong>Student: ${lesson.profiles.email}</strong>
                <small>Finished: ${new Date(lesson.end_time).toLocaleString()}</small>
            </div>
            <div><i class="fa-solid fa-chevron-right"></i></div>
        `;
        lessonList.appendChild(li);
    });
}

async function openLessonDetailsModal(lessonId) {
    currentLessonId = lessonId;
    const lesson = finishedLessonsCache.find(l => l.id == lessonId);
    if (!lesson) return;

    modalLessonInfo.innerHTML = `
        <strong>Student:</strong> ${lesson.profiles.email}<br>
        <strong>Date:</strong> ${new Date(lesson.start_time).toLocaleDateString()}
    `;
    lessonDetailsModal.style.display = 'flex';

    // Initialize Quill Editor
    if (!quill) {
        quill = new Quill('#quill-editor', {
            theme: 'snow',
            modules: { toolbar: [
                [{ 'header': [1, 2, false] }],
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['clean']
            ]}
        });
    }
    quill.setContents([]); // Clear previous content

    // Fetch existing lesson notes
    const { data, error } = await supabase
        .from('lesson_notes')
        .select('note_content')
        .eq('lesson_id', lessonId)
        .single();

    if (data && data.note_content) {
        quill.setContents(data.note_content);
    }
    
    if (error && error.code !== 'PGRST116') {
        console.error("Error fetching lesson notes:", error);
    }
}

// Add New Event Listeners
lessonList.addEventListener('click', (e) => {
    const lessonItem = e.target.closest('.lesson-item');
    if (lessonItem) {
        openLessonDetailsModal(lessonItem.dataset.lessonId);
    }
});

saveLessonNotesBtn.addEventListener('click', async () => {
    if (!quill || !currentLessonId) return;

    const originalButtonText = saveLessonNotesBtn.innerHTML;
    saveLessonNotesBtn.disabled = true;
    saveLessonNotesBtn.innerHTML = 'Saving...';
    
    const noteContent = quill.getContents(); // Get content as Delta object

    const { error } = await supabase.from('lesson_notes').upsert({
        lesson_id: currentLessonId,
        note_content: noteContent,
        last_updated_by: adminProfile.id
    }, { onConflict: 'lesson_id' });

    if (error) {
        alert('Failed to save lesson notes.');
        console.error(error);
        saveLessonNotesBtn.innerHTML = originalButtonText;
    } else {
        saveLessonNotesBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
        setTimeout(() => {
            saveLessonNotesBtn.innerHTML = originalButtonText;
        }, 2000);
    }
    saveLessonNotesBtn.disabled = false;
});

closeLessonModalBtn.addEventListener('click', () => {
    lessonDetailsModal.style.display = 'none';
    currentLessonId = null;
});

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

function openManageModal(boardId, boardName) {
    currentManagingBoardId = boardId;
    modalBoardName.innerHTML = `<i class="fa-solid fa-user-gear"></i> Manage Access for "${boardName}"`;
    
    // 1. Get all necessary data directly from the cache.
    const boardData = boardsCache.get(boardId);
    if (!boardData) {
        modalStudentList.innerHTML = '<li>Error: Board data not found.</li>';
        return;
    }
    const currentMemberIds = boardData.memberIds;

    if (allStudentsCache.length === 0) {
        modalStudentList.innerHTML = '<li>No students found to grant access to.</li>';
        return;
    }

    // 2. Render the list INSTANTLY and ACCURATELY.
    modalStudentList.innerHTML = '';
    allStudentsCache.forEach(student => {
        const li = document.createElement('li');
        const isMember = currentMemberIds.has(student.id);
        li.innerHTML = `
            <span>${student.email}</span>
            <button class="action-icon-btn ${isMember ? 'remove-btn' : 'add-btn'}" data-student-id="${student.id}" title="${isMember ? 'Remove Access' : 'Add Access'}">
                <i class="fa-solid ${isMember ? 'fa-user-minus' : 'fa-user-plus'}"></i>
            </button>
        `;
        modalStudentList.appendChild(li);
    });

    manageAccessModal.style.display = 'flex';
}

// --- EVENT LISTENERS ---
newBoardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boardName = newBoardNameInput.value.trim();
    if (!boardName) return;

    // 1. Optimistic UI Update
    newBoardNameInput.value = ''; // Clear input immediately
    const tempListId = `temp-${Date.now()}`;
    const li = document.createElement('li');
    li.id = tempListId;
    li.style.opacity = '0.7';
    li.innerHTML = `
        <div>
            <a>${boardName}</a>
            <small style="display: block; color: #888;">Saving...</small>
        </div>
        <div><!-- Placeholder for buttons --></div>
    `;
    boardList.prepend(li); // Adds the new item to the top of the list

    // 2. Sync with Database
    const { data, error } = await supabase
        .from('boards')
        .insert({ name: boardName, content: {} })
        .select()
        .single();

    // 3. Handle Result
    const newBoardElement = document.getElementById(tempListId);
    if (error) {
        console.error('Error creating board:', error);
        alert('Failed to create board. The item will be removed.');
        newBoardElement?.remove(); // Rollback: Remove the temporary element
    } else {
        // Success: Update the temporary element with real data
        if (newBoardElement) {
            newBoardElement.style.opacity = '1';
            newBoardElement.innerHTML = `
                <div>
                    <a href="/board/b/${data.id}" target="_blank">${data.name}</a>
                    <small style="display: block; color: #888;">Created: ${new Date(data.created_at).toLocaleString()}</small>
                </div>
                <div>
                    <button class="action-icon-btn manage-btn" data-id="${data.id}" data-name="${data.name}" title="Manage Access">
                        <i class="fa-solid fa-users-gear"></i>
                    </button>
                    <button class="action-icon-btn delete-btn" data-id="${data.id}" title="Delete Board">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
        }
    }
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
        const boardItem = deleteButton.closest('li');
        const boardName = boardItem.querySelector('a').textContent;

        if (confirm(`Are you sure you want to delete the board "${boardName}"?`)) {
            // 1. Optimistic UI Update
            const originalDisplay = boardItem.style.display;
            boardItem.style.transition = 'opacity 0.3s ease';
            boardItem.style.opacity = '0.3'; // Visually indicate deletion
            
            // 2. Sync with Database
            const { error } = await supabase.from('boards').delete().eq('id', boardId);

            // 3. Handle Result
            if (error) {
                console.error('Error deleting board:', error);
                alert('Failed to delete board.');
                boardItem.style.opacity = '1'; // Rollback on failure
            } else {
                // Success: Permanently remove after the fade out
                setTimeout(() => boardItem.remove(), 300);
            }
        }
    }
});

modalStudentList.addEventListener('click', async (e) => {
    const actionButton = e.target.closest('.action-icon-btn');
    if (!actionButton || actionButton.disabled) return;

    const studentId = actionButton.dataset.studentId;
    const isRemoving = actionButton.classList.contains('remove-btn');
    const boardData = boardsCache.get(currentManagingBoardId);
    const icon = actionButton.querySelector('i'); // Get the icon element

    // 1. Optimistic UI and Cache Update
    actionButton.disabled = true;
    if (isRemoving) {
        boardData.memberIds.delete(studentId);
        actionButton.classList.replace('remove-btn', 'add-btn');
        icon.className = 'fa-solid fa-user-plus'; // Change icon
        actionButton.title = 'Add Access';
    } else {
        boardData.memberIds.add(studentId);
        actionButton.classList.replace('add-btn', 'remove-btn');
        icon.className = 'fa-solid fa-user-minus'; // Change icon
        actionButton.title = 'Remove Access';
    }

    // 2. Sync with Database
    const { error } = isRemoving
        ? await supabase.from('board_members').delete().match({ board_id: currentManagingBoardId, user_id: studentId })
        : await supabase.from('board_members').insert({ board_id: currentManagingBoardId, user_id: studentId });
    
    // 3. Handle Result (Rollback)
    if (error) {
        console.error('Error updating membership:', error);
        alert('Could not update membership.');
        // Revert cache and UI
        if (isRemoving) {
            boardData.memberIds.add(studentId);
            actionButton.classList.replace('add-btn', 'remove-btn');
            icon.className = 'fa-solid fa-user-minus';
            actionButton.title = 'Remove Access';
        } else {
            boardData.memberIds.delete(studentId);
            actionButton.classList.replace('remove-btn', 'add-btn');
            icon.className = 'fa-solid fa-user-plus';
            actionButton.title = 'Add Access';
        }
    }
    
    actionButton.disabled = false;
});

closeModalBtn.addEventListener('click', () => {
    manageAccessModal.style.display = 'none';
    currentManagingBoardId = null;
});

logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/board/login.html';
});

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    console.error("Cloudinary environment variables are not set! Please check your Netlify configuration.");
    // You could even disable the file inputs here to prevent errors.
}

let flashcardState = {
    categories: [],
    sets: [],
    cards: [],
    selectedCategoryId: null,
    selectedSetId: null,
};

let flashcardDataFetched = false;

// --- DATA FETCHING & RENDERING ---

async function fetchFlashcardCategories() {
    const { data, error } = await supabase.from('categories').select('id, name').order('created_at');
    if (error) { console.error('Error fetching categories', error); return; }
    flashcardState.categories = data;
    renderCategories();
}

function renderCategories() {
    categoryList.innerHTML = '';
    if (flashcardState.categories.length === 0) {
        categoryList.innerHTML = '<li>No categories yet.</li>';
    }
    flashcardState.categories.forEach(cat => {
        const li = document.createElement('li');
        li.dataset.id = cat.id;
        li.innerHTML = `<span>${cat.name}</span> <button class="delete-fc-btn" title="Delete Category"><i class="fa-solid fa-trash"></i></button>`;
        if (cat.id === flashcardState.selectedCategoryId) {
            li.classList.add('active');
        }
        categoryList.appendChild(li);
    });
}

async function fetchSetsForCategory(categoryId) {
    const { data, error } = await supabase.from('flashcard_sets').select('*').eq('category_id', categoryId).order('created_at');
    if (error) { console.error('Error fetching sets', error); return; }
    flashcardState.sets = data;
    renderSets();
}

function renderSets() {
    setList.innerHTML = '';
    if (flashcardState.sets.length === 0) {
        setList.innerHTML = '<li>No sets in this category.</li>';
    }
    flashcardState.sets.forEach(set => {
        const li = document.createElement('li');
        li.dataset.id = set.id;
        
        // ===== MODIFICATION START =====
        // We're adding an anchor tag <a> that acts as a button
        li.innerHTML = `
            <span>${set.name}</span> 
            <div class="fc-list-buttons">
                <a href="/board/study.html?set_id=${set.id}" target="_blank" class="action-icon-btn view-set-btn" title="Study this Set">
                    <i class="fa-solid fa-eye"></i>
                </a>
                <button class="delete-fc-btn" title="Delete Set">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        // ===== MODIFICATION END =====

        if (set.id === flashcardState.selectedSetId) {
            li.classList.add('active');
        }
        setList.appendChild(li);
    });
}

async function fetchFlashcardsForSet(setId) {
    const { data, error } = await supabase.from('flashcards').select('*').eq('set_id', setId).order('created_at');
    if (error) { console.error('Error fetching flashcards', error); return; }
    flashcardState.cards = data;
    renderFlashcards();
}

function renderFlashcards() {
    flashcardList.innerHTML = '';
    if (flashcardState.cards.length === 0) {
        flashcardList.innerHTML = '<li>This set is empty.</li>';
    }
    flashcardState.cards.forEach(card => {
        const li = document.createElement('li');
        li.dataset.id = card.id;
        const frontContent = card.front_image_url ? 'Image' : card.front_text;
        li.innerHTML = `<span>${frontContent}</span> <button class="delete-fc-btn" title="Delete Card"><i class="fa-solid fa-trash"></i></button>`;
        flashcardList.appendChild(li);
    });
}

// --- UI STATE MANAGEMENT ---

function showEditor(card = null) {
    flashcardEditorForm.reset();
    frontImagePreview.style.display = 'none';
    backImagePreview.style.display = 'none';

    if (card) {
        // Editing existing card
        editorHeading.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Card';
        editingCardIdInput.value = card.id;
        cardFrontTextInput.value = card.front_text || '';
        cardBackTextInput.value = card.back_text || '';
        cardDefinitionInput.value = card.definition || '';
        if (card.front_image_url) {
            frontImagePreview.src = card.front_image_url;
            frontImagePreview.style.display = 'block';
        }
        if (card.back_image_url) {
            backImagePreview.src = card.back_image_url;
            backImagePreview.style.display = 'block';
        }
    } else {
        // Creating new card
        editorHeading.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Create New Card';
        editingCardIdInput.value = '';
    }
	flashcardsContent.classList.add('editor-active');
    flashcardEditorContainer.style.display = 'block';
}

function hideEditor() {
	flashcardsContent.classList.remove('editor-active');
    flashcardEditorContainer.style.display = 'none';
    flashcardEditorForm.reset();
}

// --- EVENT LISTENERS ---

// Initial fetch when tab is clicked for the first time
flashcardsTabBtn.addEventListener('click', () => {
    if (!flashcardDataFetched) {
        fetchFlashcardCategories();
        flashcardDataFetched = true;
    }
});

// Select a category
categoryList.addEventListener('click', async (e) => {
    const li = e.target.closest('li');
    if (!li || !li.dataset.id) return;
    
    const deleteBtn = e.target.closest('.delete-fc-btn');
    if (deleteBtn) {
        if (confirm('Are you sure you want to delete this category and all of its sets/cards?')) {
            const { error } = await supabase.from('categories').delete().eq('id', li.dataset.id);
            if (error) alert('Failed to delete category.');
            else fetchFlashcardCategories();
        }
        return;
    }

    flashcardState.selectedCategoryId = li.dataset.id;
    flashcardState.selectedSetId = null;
    const category = flashcardState.categories.find(c => c.id === li.dataset.id);
    selectedCategoryNameSpan.textContent = category.name;
    
    // Reset and show/hide relevant UI
    setList.innerHTML = '<li>Loading sets...</li>';
    flashcardList.innerHTML = '';
    flashcardListPlaceholder.style.display = 'block';
    addNewCardBtn.style.display = 'none';
    newSetForm.style.display = 'flex';
    hideEditor();

    renderCategories(); // Re-render to show active state
    await fetchSetsForCategory(li.dataset.id);
});

// Select a set
setList.addEventListener('click', async (e) => {
    const li = e.target.closest('li');
    if (!li || !li.dataset.id) return;

    const deleteBtn = e.target.closest('.delete-fc-btn');
    if (deleteBtn) {
        if (confirm('Are you sure you want to delete this set and all of its cards?')) {
            const { error } = await supabase.from('flashcard_sets').delete().eq('id', li.dataset.id);
            if (error) alert('Failed to delete set.');
            else fetchSetsForCategory(flashcardState.selectedCategoryId);
        }
        return;
    }
    
    flashcardState.selectedSetId = li.dataset.id;
    const set = flashcardState.sets.find(s => s.id === li.dataset.id);
    selectedSetNameSpan.textContent = set.name;
    
    // Reset and show/hide
    flashcardList.innerHTML = '<li>Loading cards...</li>';
    flashcardListPlaceholder.style.display = 'none';
    addNewCardBtn.style.display = 'block';
    hideEditor();

    renderSets(); // Re-render to show active state
    await fetchFlashcardsForSet(li.dataset.id);
});

// Select a flashcard to edit
flashcardList.addEventListener('click', async (e) => {
    const li = e.target.closest('li');
    if (!li || !li.dataset.id) return;

    const deleteBtn = e.target.closest('.delete-fc-btn');
    if (deleteBtn) {
        if (confirm('Are you sure you want to delete this card?')) {
            const { error } = await supabase.from('flashcards').delete().eq('id', li.dataset.id);
            if (error) alert('Failed to delete card.');
            else fetchFlashcardsForSet(flashcardState.selectedSetId);
        }
        return;
    }

    const cardToEdit = flashcardState.cards.find(c => c.id === li.dataset.id);
    if (cardToEdit) showEditor(cardToEdit);
});

// Handle form submissions
newCategoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = newCategoryNameInput.value.trim();
    if (!name) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { error } = await supabase.from('categories').insert({ name, user_id: user.id });
    if (error) alert('Failed to create category.');
    else {
        newCategoryNameInput.value = '';
        fetchFlashcardCategories();
    }
});

newSetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = newSetNameInput.value.trim();
    if (!name || !flashcardState.selectedCategoryId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('flashcard_sets').insert({ name, category_id: flashcardState.selectedCategoryId, user_id: user.id });
    if (error) alert('Failed to create set.');
    else {
        newSetNameInput.value = '';
        fetchSetsForCategory(flashcardState.selectedCategoryId);
    }
});

// Show editor for new card
addNewCardBtn.addEventListener('click', () => showEditor(null));
cancelEditBtn.addEventListener('click', hideEditor);

// Image upload and preview logic
async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        return data.secure_url;
    } catch (e) {
        console.error('Upload failed', e);
        return null;
    }
}

cardFrontImageInput.addEventListener('change', () => {
    if (cardFrontImageInput.files[0]) {
        frontImagePreview.src = URL.createObjectURL(cardFrontImageInput.files[0]);
        frontImagePreview.style.display = 'block';
    }
});
 cardBackImageInput.addEventListener('change', () => {
    if (cardBackImageInput.files[0]) {
        backImagePreview.src = URL.createObjectURL(cardBackImageInput.files[0]);
        backImagePreview.style.display = 'block';
    }
});

// Save/Update a flashcard
flashcardEditorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!flashcardState.selectedSetId) return;

    saveCardBtn.disabled = true;
    saveCardBtn.innerHTML = 'Saving...';
    
    let frontImageUrl = editingCardIdInput.value ? flashcardState.cards.find(c => c.id === editingCardIdInput.value)?.front_image_url : undefined;
    let backImageUrl = editingCardIdInput.value ? flashcardState.cards.find(c => c.id === editingCardIdInput.value)?.back_image_url : undefined;

    if (cardFrontImageInput.files[0]) {
        frontImageUrl = await uploadImage(cardFrontImageInput.files[0]);
    }
    if (cardBackImageInput.files[0]) {
        backImageUrl = await uploadImage(cardBackImageInput.files[0]);
    }

    const cardData = {
        set_id: flashcardState.selectedSetId,
        front_text: cardFrontTextInput.value,
        back_text: cardBackTextInput.value,
        definition: cardDefinitionInput.value,
        front_image_url: frontImageUrl,
        back_image_url: backImageUrl,
    };
    
    const { error } = editingCardIdInput.value
        ? await supabase.from('flashcards').update(cardData).eq('id', editingCardIdInput.value)
        : await supabase.from('flashcards').insert(cardData);

    if (error) {
        alert('Failed to save card.');
        console.error(error);
    } else {
        hideEditor();
        await fetchFlashcardsForSet(flashcardState.selectedSetId);
    }
    saveCardBtn.disabled = false;
    saveCardBtn.innerHTML = '<i class="fa-solid fa-save"></i> Save Card';
});

// --- INITIALIZE THE PAGE ---
async function init() {
    await checkAdminAuth();
    // Set the initial active tab and content
    document.getElementById('boards-tab-btn').classList.add('active');
    document.getElementById('boards-content').classList.add('active');
    
    // Fetch data for the initially visible tabs or all tabs
    fetchBoards();
    fetchStudents();
	initializeCalendar();
}
init();
