import { supabase } from './supabaseClient';

// --- ELEMENT REFERENCES ---
const logoutBtn = document.getElementById('logout-btn');
const myBoardList = document.getElementById('my-board-list');
const boardsTabBtn = document.getElementById('boards-tab-btn');
const scheduleTabBtn = document.getElementById('schedule-tab-btn');
const boardsContent = document.getElementById('boards-content');
const scheduleContent = document.getElementById('schedule-content');
const calendarEl = document.getElementById('calendar');

// Modal Elements
const bookingModal = document.getElementById('booking-modal');
const modalTitle = document.getElementById('modal-title');
const modalTimeDetails = document.getElementById('modal-time-details');
const availableBookingDetails = document.getElementById('available-booking-details');
const myBookingDetails = document.getElementById('my-booking-details');
const otherBookingDetails = document.getElementById('other-booking-details');
const meetingLink = document.getElementById('meeting-link');
const bookLessonBtn = document.getElementById('book-lesson-btn');
const cancelLessonBtn = document.getElementById('cancel-lesson-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

let calendar = null;
let userProfile = null;
let currentSelectedEvent = null;

// --- AUTH GUARD (Upgraded to fetch full profile) ---
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/login';
        return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (error || !data) {
        console.error('Could not fetch user profile:', error);
        await supabase.auth.signOut();
        window.location.href = '/login';
    } else {
        userProfile = data;
    }
}

// --- TAB SWITCHING (Unchanged) ---
boardsTabBtn.addEventListener('click', () => { boardsContent.classList.add('active'); scheduleContent.classList.remove('active'); boardsTabBtn.classList.add('active'); scheduleTabBtn.classList.remove('active'); });
scheduleTabBtn.addEventListener('click', () => { scheduleContent.classList.add('active'); boardsContent.classList.remove('active'); scheduleTabBtn.classList.add('active'); boardsTabBtn.classList.remove('active'); });

// --- STUDENT CALENDAR LOGIC (Unchanged) ---
function initializeStudentCalendar() {
    if (calendar) return;
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'listWeek',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'listWeek,timeGridWeek' },
        slotMinTime: '08:00:00', slotMaxTime: '20:00:00',
        allDaySlot: false, height: 'auto',
        events: async function() {
            const { data, error } = await supabase.from('availability').select('*');
            if (error) { console.error('Error fetching schedule:', error); return []; }
            return data.map(slot => {
                const isMyBooking = slot.booked_by === userProfile.id;
                return {
                    id: slot.id, start: slot.start_time, end: slot.end_time,
                    title: isMyBooking ? 'My Lesson' : (slot.status === 'available' ? 'Available' : 'Booked'),
                    backgroundColor: isMyBooking ? '#3182ce' : (slot.status === 'available' ? '#28a745' : '#e53e3e'),
                    borderColor: isMyBooking ? '#3182ce' : (slot.status === 'available' ? '#28a745' : '#e53e3e'),
                    interactive: slot.status === 'available' || isMyBooking
                };
            });
        },
        eventClick: function(info) {
            openBookingModal(info.event);
        }
    });
    calendar.render();
}

// --- BOOKING MODAL LOGIC (Unchanged) ---
function openBookingModal(event) {
    currentSelectedEvent = event;
    const isMyBooking = event.title === 'My Lesson';
    const isAvailable = event.title === 'Available';
    modalTitle.textContent = isMyBooking ? "Your Lesson Details" : (isAvailable ? "Book This Slot" : "Lesson Booked");
    modalTimeDetails.textContent = `${event.start.toLocaleString()} - ${event.end.toLocaleString()}`;
    availableBookingDetails.style.display = isAvailable ? 'block' : 'none';
    myBookingDetails.style.display = isMyBooking ? 'block' : 'none';
    otherBookingDetails.style.display = (!isAvailable && !isMyBooking) ? 'block' : 'none';
    if (isMyBooking) {
        if (userProfile.meeting_link) {
            meetingLink.href = userProfile.meeting_link;
            meetingLink.textContent = userProfile.meeting_link;
        } else {
            meetingLink.textContent = "No meeting link assigned. Please contact the admin.";
            meetingLink.removeAttribute('href');
        }
    }
    bookingModal.style.display = 'flex';
}

function closeModal() {
    bookingModal.style.display = 'none';
    currentSelectedEvent = null;
}

// --- MODAL BUTTON EVENT LISTENERS (CORRECTED) ---
bookLessonBtn.addEventListener('click', async () => {
    if (!currentSelectedEvent) return;
    
    // Use the event object directly, before it's cleared
    const eventToBook = currentSelectedEvent;

    // Optimistic UI Update
    eventToBook.setProp('title', 'My Lesson');
    eventToBook.setProp('backgroundColor', '#3182ce');
    eventToBook.setProp('borderColor', '#3182ce');
    
    // NOW close the modal. `eventToBook` still holds the reference we need.
    closeModal();
    
    // Database update
    const { error } = await supabase.from('availability')
        .update({ status: 'booked', booked_by: userProfile.id })
        .eq('id', eventToBook.id) // Use the stored reference
        .eq('status', 'available');

    if (error) {
        console.error('Error booking lesson:', error);
        alert('Could not book lesson. The schedule will refresh.');
        calendar.refetchEvents();
    }
});

cancelLessonBtn.addEventListener('click', async () => {
    if (!currentSelectedEvent) return;

    // --- ADDED CONFIRMATION WRAPPER ---
    if (confirm("Are you sure you want to cancel this booking?")) {
        const eventToCancel = currentSelectedEvent;

        // Optimistic UI Update
        eventToCancel.setProp('title', 'Available');
        eventToCancel.setProp('backgroundColor', '#28a745');
        eventToCancel.setProp('borderColor', '#28a745');
        
        closeModal();

        // Database update
        const { error } = await supabase.from('availability')
            .update({ status: 'available', booked_by: null })
            .eq('id', eventToCancel.id);

        if (error) {
            console.error('Error cancelling lesson:', error);
            alert('Could not cancel your booking. The schedule will refresh.');
            calendar.refetchEvents();
        }
    }
});

closeModalBtn.addEventListener('click', closeModal);

// --- FETCH ASSIGNED BOARDS (Unchanged) ---
async function fetchMyBoards() {
    const { data: boards, error } = await supabase.from('boards').select('id, name, created_at').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching assigned boards:', error); myBoardList.innerHTML = '<li>Could not load your boards.</li>'; return; }
    myBoardList.innerHTML = '';
    if (boards.length === 0) { myBoardList.innerHTML = '<li>You have not been assigned to any boards yet.</li>'; } else {
        boards.forEach(board => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="/board/b/${board.id}" target="_blank">${board.name}</a>`;
            myBoardList.appendChild(li);
        });
    }
}

// --- LOGOUT (Unchanged) ---
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
});

// --- INITIALIZE THE PAGE ---
async function init() {
    await checkAuth();
    fetchMyBoards();
    initializeStudentCalendar();
}

init();

