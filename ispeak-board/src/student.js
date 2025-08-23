import { supabase } from './supabaseClient';

// --- ELEMENT REFERENCES ---
const logoutBtn = document.getElementById('logout-btn');
const myBoardList = document.getElementById('my-board-list');
const boardsTabBtn = document.getElementById('boards-tab-btn');
const scheduleTabBtn = document.getElementById('schedule-tab-btn');
const boardsContent = document.getElementById('boards-content');
const scheduleContent = document.getElementById('schedule-content');
const calendarEl = document.getElementById('calendar');

let calendar = null;
let user = null; // This will store the logged-in user's data

// --- AUTHENTICATION GUARD ---
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/board/login.html';
    } else {
        user = session.user; // Store the user object for use in booking
    }
}

// --- TAB SWITCHING ---
boardsTabBtn.addEventListener('click', () => {
    boardsContent.classList.add('active');
    scheduleContent.classList.remove('active');
    boardsTabBtn.classList.add('active');
    scheduleTabBtn.classList.remove('active');
});

scheduleTabBtn.addEventListener('click', () => {
    scheduleContent.classList.add('active');
    boardsContent.classList.remove('active');
    scheduleTabBtn.classList.add('active');
    boardsTabBtn.classList.remove('active');
});

// --- STUDENT CALENDAR LOGIC WITH OPTIMISTIC UI ---
function initializeStudentCalendar() {
    if (calendar) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'listWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'listWeek,timeGridWeek'
        },
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        allDaySlot: false,
        height: 'auto',

        // Fetch all availability from Supabase
        events: async function() {
            const { data, error } = await supabase.from('availability').select('*');
            if (error) {
                console.error('Error fetching schedule:', error);
                return [];
            }
            return data.map(slot => {
                const isMyBooking = slot.booked_by === user.id;
                return {
                    id: slot.id,
                    start: slot.start_time,
                    end: slot.end_time,
                    title: slot.status === 'available' ? 'Available' : (isMyBooking ? 'My Lesson (Click to cancel)' : 'Booked'),
                    backgroundColor: slot.status === 'available' ? '#28a745' : (isMyBooking ? '#3182ce' : '#e53e3e'),
                    borderColor: slot.status === 'available' ? '#28a745' : (isMyBooking ? '#3182ce' : '#e53e3e'),
                    // A great UX feature: only "Available" and "My Lesson" slots are clickable
                    interactive: slot.status === 'available' || isMyBooking
                };
            });
        },
        
        // --- STUDENT BOOKING INTERACTION WITH OPTIMISTIC UI ---
        eventClick: async function(info) {
            const event = info.event;
            const eventId = event.id;
            const eventTitle = event.title;

            // --- Case 1: Booking an available lesson ---
            if (eventTitle === 'Available') {
                if (confirm('Do you want to book this lesson slot?')) {
                    // Optimistic UI Update: Instantly change the event's appearance
                    event.setProp('title', 'My Lesson (Click to cancel)');
                    event.setProp('backgroundColor', '#3182ce');
                    event.setProp('borderColor', '#3182ce');
                    
                    // Send the update to Supabase in the background
                    const { error } = await supabase
                        .from('availability')
                        .update({ status: 'booked', booked_by: user.id })
                        .eq('id', eventId)
                        .eq('status', 'available'); // Prevent booking an already taken slot

                    // Handle failure: If the update fails, roll back the UI
                    if (error) {
                        console.error('Error booking lesson:', error);
                        alert('Could not book lesson. It may have just been taken by another student. The schedule will now refresh.');
                        calendar.refetchEvents(); // The simplest way to roll back
                    }
                }
            } 
            // --- Case 2: Cancelling your own lesson ---
            else if (event.title.startsWith('My Lesson')) {
                 if (confirm('Do you want to cancel your booking for this lesson?')) {
                    // Optimistic UI Update: Instantly change it back to "Available"
                    event.setProp('title', 'Available');
                    event.setProp('backgroundColor', '#28a745');
                    event.setProp('borderColor', '#28a745');
                    
                    // Send the update to Supabase in the background
                    const { error } = await supabase
                        .from('availability')
                        .update({ status: 'available', booked_by: null })
                        .eq('id', eventId);

                    // Handle failure: Roll back the UI if the update fails
                     if (error) {
                         console.error('Error cancelling lesson:', error);
                         alert('Could not cancel your booking. The schedule will now refresh.');
                         calendar.refetchEvents();
                     }
                 }
            } 
        }
    });
    calendar.render();
}

// --- FETCH ASSIGNED BOARDS ---
async function fetchMyBoards() {
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
            li.innerHTML = `<a href="/board/b/${board.id}" target="_blank">${board.name}</a>`;
            myBoardList.appendChild(li);
        });
    }
}

// --- LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/board/login.html';
});

// --- INITIALIZE THE PAGE ---
async function init() {
    await checkAuth(); // First, get user data
    fetchMyBoards();
    initializeStudentCalendar();
}

init();
