import { supabase } from './supabaseClient';

// Form and element references
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const messageEl = document.getElementById('message');
const loginTabBtn = document.getElementById('login-tab-btn');
const signupTabBtn = document.getElementById('signup-tab-btn');

// --- TAB SWITCHING LOGIC ---
loginTabBtn.addEventListener('click', () => {
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
    loginTabBtn.classList.add('active');
    signupTabBtn.classList.remove('active');
    messageEl.textContent = '';
});

signupTabBtn.addEventListener('click', () => {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
    loginTabBtn.classList.remove('active');
    signupTabBtn.classList.add('active');
    messageEl.textContent = '';
});


// --- LOGIN HANDLER ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    messageEl.textContent = '';

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data: { session }, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        messageEl.style.color = 'red';
        messageEl.textContent = 'Login failed: ' + error.message;
        return;
    }

    // --- THE ROUTER LOGIC ---
    // After successful login, check the user's role from the 'profiles' table.
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (profileError) {
        messageEl.style.color = 'red';
        messageEl.textContent = 'Could not retrieve user role.';
        return;
    }

    // Redirect based on the role
    if (profile.role === 'admin') {
        window.location.href = '/admin';
    } else {
        window.location.href = '/student';
    }
});

// --- SIGN UP HANDLER ---
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    messageEl.textContent = '';

    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
        messageEl.style.color = 'red';
        messageEl.textContent = 'Sign up failed: ' + error.message;
    } else {
        messageEl.style.color = 'green';
        messageEl.textContent = 'Success! Please check your email to confirm your account.';
    }

});
