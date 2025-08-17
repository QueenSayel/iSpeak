document.addEventListener('DOMContentLoaded', () => {

    // --- BILINGUAL DICTIONARY ---
    const translations = {
        en: {
            // Meta Tags
            title: "iSpeak - Modern English Language School",
            metaDescription: "Unlock your English potential with iSpeak. I offer personalized online courses, private tutoring, and business English training. Start your free consultation today!",
            
            // Navigation
            navAbout: "About Me",
            navCourses: "Courses",
            navProcess: "How It Works",
            navTestimonials: "Testimonials",
            navContact: "Contact",
            navBoard: "Board",
            navGetStarted: "Get Started",

            // Hero Section
            heroTitle: "Unlock Your English Potential.",
            heroSubtitle: "Personalized, engaging, and effective online English lessons designed for you.",
            heroBtnCourses: "Explore Courses",
            heroBtnConsultation: "Book a Free Consultation",

            // About Section
            aboutHeader: "Welcome to iSpeak",
            aboutSubheader: "Where fluency meets confidence.",
            aboutPhilosophyTitle: "My Philosophy",
            aboutPhilosophyP1: "At iSpeak, I believe that learning a language is about more than just grammar and vocabulary; it's about communication, connection, and culture. My mission is to provide a supportive and dynamic learning environment where students feel empowered to speak English confidently in any situation.",
            aboutPhilosophyP2: "As a certified instructor, I use modern, interactive methods to create lesson plans tailored to your specific goals, whether you're learning for travel, career advancement, or personal enrichment.",

            // Courses Section
            coursesHeader: "My Courses",
            coursesSubheader: "Find the perfect plan to achieve your language goals.",
            course1Title: "General English",
            course1Desc: "Improve your speaking, listening, reading, and writing skills for everyday communication. Perfect for all levels.",
            course2Title: "Business English",
            course2Desc: "Master the language of the professional world, from presentations and negotiations to emails and reports.",
            course3Title: "Exam Preparation",
            course3Desc: "Get ready for standardized tests like IELTS, TOEFL, and Cambridge exams with targeted strategies and practice.",
            course4Title: "Conversation Practice",
            course4Desc: "Build fluency and confidence in a relaxed, conversational setting with a native-speaking tutor.",

            // Process Section
            processHeader: "Start Your Journey in 3 Simple Steps",
            step1Title: "Free Consultation",
            step1Desc: "Book a free 20-minute video call to discuss your goals, assess your current level, and meet me, your potential teacher.",
            step2Title: "Personalized Plan",
            step2Desc: "I'll create a custom learning plan with materials and a schedule that fits your needs and lifestyle perfectly.",
            step3Title: "Start Learning",
            step3Desc: "Begin your interactive online lessons and track your progress as you become a more confident English speaker.",

            // Testimonials Section
            testimonialsHeader: "What My Students Say",
            testimonial1Author: "- Student A",
            testimonial2Author: "- Student B",

            // Contact Section
            contactHeader: "Ready to Begin?",
            contactSubheader: "Send me a message to book your free consultation or ask any questions.",
            formNamePlaceholder: "Your Name",
            formEmailPlaceholder: "Your Email",
            formInterestDefault: "I'm interested in...",
            formInterestOption1: "General English",
            formInterestOption2: "Business English",
            formInterestOption3: "Exam Preparation",
            formInterestOption4: "Other/Not Sure",
            formMessagePlaceholder: "Your Message",
            formSubmitBtn: "Send Message",

            // Footer
            footerSlogan: "Confidence in every conversation.",
            footerLinksTitle: "Quick Links",
            footerLinkAbout: "About",
            footerLinkCourses: "Courses",
            footerLinkContact: "Contact",
            footerLinkPrivacy: "Privacy Policy",
            footerSocialTitle: "Follow Me",
            footerRights: "All Rights Reserved."
        },
        pl: {
            // Meta Tags
            title: "iSpeak - Nowoczesna Szkoła Języka Angielskiego",
            metaDescription: "Odblokuj swój potencjał w języku angielskim z iSpeak. Oferuję spersonalizowane kursy online, prywatne korepetycje i szkolenia z Business English. Umów się na darmową konsultację już dziś!",
            
            // Navigation
            navAbout: "O Mnie",
            navCourses: "Kursy",
            navProcess: "Jak to działa",
            navTestimonials: "Opinie",
            navContact: "Kontakt",
            navBoard: "Tablica",
            navGetStarted: "Zacznij",

            // Hero Section
            heroTitle: "Odblokuj swój potencjał w języku angielskim.",
            heroSubtitle: "Spersonalizowane, angażujące i skuteczne lekcje angielskiego online, zaprojektowane dla Ciebie.",
            heroBtnCourses: "Zobacz kursy",
            heroBtnConsultation: "Darmowa konsultacja",

            // About Section
            aboutHeader: "Witaj w iSpeak",
            aboutSubheader: "Gdzie płynność spotyka się z pewnością siebie.",
            aboutPhilosophyTitle: "Moja Filozofia",
            aboutPhilosophyP1: "W iSpeak wierzę, że nauka języka to coś więcej niż gramatyka i słownictwo; to komunikacja, więzi i kultura. Moją misją jest zapewnienie wspierającego i dynamicznego środowiska nauki, w którym uczniowie czują się pewnie, mówiąc po angielsku w każdej sytuacji.",
            aboutPhilosophyP2: "Jako certyfikowany instruktor, używam nowoczesnych, interaktywnych metod do tworzenia planów lekcji dostosowanych do Twoich celów, niezależnie od tego, czy uczysz się do podróży, rozwoju kariery, czy dla osobistej satysfakcji.",

            // Courses Section
            coursesHeader: "Moje Kursy",
            coursesSubheader: "Znajdź idealny plan, aby osiągnąć swoje cele językowe.",
            course1Title: "Angielski Ogólny",
            course1Desc: "Popraw swoje umiejętności mówienia, słuchania, czytania i pisania w codziennej komunikacji. Idealny dla wszystkich poziomów.",
            course2Title: "Business English",
            course2Desc: "Opanuj język świata zawodowego, od prezentacji i negocjacji po e-maile i raporty.",
            course3Title: "Przygotowanie do Egzaminów",
            course3Desc: "Przygotuj się do egzaminów takich jak IELTS, TOEFL i Cambridge dzięki ukierunkowanym strategiom i praktyce.",
            course4Title: "Praktyka Konwersacji",
            course4Desc: "Zbuduj płynność i pewność siebie w zrelaksowanej, konwersacyjnej atmosferze z native speakerem.",

            // Process Section
            processHeader: "Rozpocznij swoją podróż w 3 prostych krokach",
            step1Title: "Darmowa Konsultacja",
            step1Desc: "Umów się na darmową 20-minutową rozmowę wideo, aby omówić swoje cele, ocenić obecny poziom i poznać mnie, Twojego nauczyciela.",
            step2Title: "Spersonalizowany Plan",
            step2Desc: "Stworzę spersonalizowany plan nauki z materiałami i harmonogramem, który idealnie pasuje do Twoich potrzeb i stylu życia.",
            step3Title: "Zacznij Naukę",
            step3Desc: "Rozpocznij interaktywne lekcje online i śledź swoje postępy, stając się coraz pewniejszym użytkownikiem języka angielskiego.",

            // Testimonials Section
            testimonialsHeader: "Co mówią moi uczniowie",
            testimonial1Author: "- Uczeń A",
            testimonial2Author: "- Uczeń B",

            // Contact Section
            contactHeader: "Gotowy, aby zacząć?",
            contactSubheader: "Wyślij mi wiadomość, aby umówić się na darmową konsultację lub zadać pytania.",
            formNamePlaceholder: "Twoje Imię",
            formEmailPlaceholder: "Twój Email",
            formInterestDefault: "Jestem zainteresowany/a...",
            formInterestOption1: "Angielskim Ogólnym",
            formInterestOption2: "Business English",
            formInterestOption3: "Przygotowaniem do Egzaminu",
            formInterestOption4: "Inne/Nie jestem pewien/pewna",
            formMessagePlaceholder: "Twoja Wiadomość",
            formSubmitBtn: "Wyślij Wiadomość",

            // Footer
            footerSlogan: "Pewność w każdej rozmowie.",
            footerLinksTitle: "Szybkie Linki",
            footerLinkAbout: "O mnie",
            footerLinkCourses: "Kursy",
            footerLinkContact: "Kontakt",
            footerLinkPrivacy: "Polityka Prywatności",
            footerSocialTitle: "Obserwuj Mnie",
            footerRights: "Wszelkie Prawa Zastrzeżone."
        }
    };

    const langBtns = document.querySelectorAll('.lang-btn');
    
    const setLanguage = (lang) => {
        // Update all elements with data-key
        document.querySelectorAll('[data-key]').forEach(element => {
            const key = element.getAttribute('data-key');
            const translation = translations[lang][key];
            
            if (translation !== undefined) {
                 if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = translation;
                } else {
                    element.innerHTML = translation;
                }
            }
        });

        // Update meta tags and title
        document.title = translations[lang].title;
        document.querySelector('meta[name="description"]').setAttribute('content', translations[lang].metaDescription);
        
        // Update html lang attribute
        document.documentElement.lang = lang;

        // Update active button state
        langBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-lang') === lang) {
                btn.classList.add('active');
            }
        });

        // Save language preference
        localStorage.setItem('iSpeakLang', lang);
    };

    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedLang = btn.getAttribute('data-lang');
            setLanguage(selectedLang);
        });
    });

    // --- END BILINGUAL LOGIC ---


    // Initialize Animate on Scroll (AOS)
    AOS.init({
        duration: 1000,
        once: true,
    });

    // Sticky Header on Scroll
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Hamburger Menu for Mobile
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });
    
    // Close mobile menu when a link is clicked
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });
    
    // Active Navigation Link on Scroll
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.6
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        observer.observe(section);
    });

    // Load saved language or default to English
    const savedLang = localStorage.getItem('iSpeakLang') || 'en';
    setLanguage(savedLang);

});
